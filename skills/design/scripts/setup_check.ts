#!/usr/bin/env -S node --import tsx
import { connect } from "../lib/discord_client.ts";
import { writeConfig, defaultConfigPath, type Config } from "../lib/config.ts";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const MJ_BOT_ID = "936929561302675456";

// --skip-discord: verify tools are installed without touching Discord.
// Useful for users who only want to use build.
const SKIP_DISCORD = process.argv.includes("--skip-discord");

async function prompt(rl: readline.Interface, label: string, existing?: string): Promise<string> {
  const suffix = existing ? ` [${existing.slice(0, 6)}…]` : "";
  const ans = (await rl.question(`${label}${suffix}: `)).trim();
  return ans || existing || "";
}

function checkToolsOnly(): void { // sync — no async ops needed
  const here = fileURLToPath(new URL(".", import.meta.url));
  const designLib = resolve(here, "..", "lib");
  const designBuildLib = resolve(here, "..", "..", "build", "scripts");

  console.error(`
──────────────────────────────────────────────────────────────────
  Skills tool check (--skip-discord)
──────────────────────────────────────────────────────────────────
`);

  let ok = true;

  // Check design lib
  if (existsSync(designLib)) {
    console.error(`  ✓ design lib present at ${designLib}`);
  } else {
    console.error(`  ✗ design lib MISSING at ${designLib}`);
    ok = false;
  }

  // Check build scripts
  if (existsSync(designBuildLib)) {
    console.error(`  ✓ build scripts present at ${designBuildLib}`);
  } else {
    console.error(`  ✗ build scripts MISSING at ${designBuildLib}`);
    ok = false;
  }

  // Check node version
  try {
    const nodeVer = execSync("node --version", { encoding: "utf-8" }).trim();
    console.error(`  ✓ node ${nodeVer}`);
  } catch {
    console.error("  ✗ node not found");
    ok = false;
  }

  const cfgPath = defaultConfigPath();
  if (existsSync(cfgPath)) {
    console.error(`  ✓ design config present at ${cfgPath}`);
  } else {
    console.error(`  · no design config (${cfgPath}) — that's fine if you're only using build`);
  }

  if (!ok) {
    console.error(`
  One or more checks failed. Re-run the installer:
    curl -fsSL https://raw.githubusercontent.com/rw3iss/design-build-skills/main/install.sh | bash
`);
    process.exit(1);
  }

  console.error(`
  ✓ build is ready to use — no Discord setup required.
    Give it any image (file path, folder, or indices from a prior
    design run) and Claude will scaffold a Preact app from it.

  To use the design skill (Midjourney image generation), also run:
    ~/.claude/skills/design/bin/designer setup
──────────────────────────────────────────────────────────────────
`);
}

async function main() {
  if (SKIP_DISCORD) {
    checkToolsOnly();
    return;
  }

  const cfgPath = defaultConfigPath();
  let existing: Partial<Config> = {};
  if (existsSync(cfgPath)) {
    try { existing = JSON.parse(readFileSync(cfgPath, "utf-8")); } catch { /* ignore */ }
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  console.error(`
──────────────────────────────────────────────────────────────────
  Design setup
──────────────────────────────────────────────────────────────────

  You'll be asked for three Discord values. Here's where to get each:

  1) Bot token
     • Open:  https://discord.com/developers/applications
     • Click your application → left sidebar → "Bot"
     • Click "Reset Token" → "Copy"
     • Discord HIDES the token after you leave the page — copy it
       now and paste below. If you miss it, just reset again.
     • Paste the RAW token; do NOT prefix with "Bot ".

     !!  WHILE YOU'RE ON THE BOT TAB, also enable the required intent:
         • Scroll down to "Privileged Gateway Intents"
         • Toggle ON:  [x] Message Content Intent
         Without this, the bot cannot read Midjourney's replies and
         this setup check will fail with "Used disallowed intents".

  2) Server (guild) ID   and   3) Channel ID
     • In the Discord app:  User Settings → Advanced → Developer Mode
     • Right-click your server icon → "Copy Server ID"
     • Right-click the channel where Midjourney lives → "Copy Channel ID"

  Press Enter on any prompt to keep the existing value (shown as [abc…]).
──────────────────────────────────────────────────────────────────
`);

  const token = await prompt(rl, "Discord bot token", existing.discordBotToken);
  const guild = await prompt(rl, "Discord guild (server) ID", existing.discordGuildId);
  const channel = await prompt(rl, "Discord channel ID (where Midjourney lives)", existing.discordChannelId);

  console.error(`\nTrigger mode:`);
  console.error(`  1) manual     — you paste /imagine into Discord yourself (safe, default)`);
  console.error(`  2) user-token — bot invokes /imagine via your Discord user token (AUTOMATED)`);
  console.error(`                  WARNING: using a user token programmatically violates Discord's`);
  console.error(`                  Terms of Service and can get your personal Discord account banned.`);
  console.error(`                  The risk applies to your whole Discord identity across all servers.`);
  const modeChoice = await prompt(rl, "Pick 1 or 2", existing.triggerMode === "user-token" ? "2" : "1");
  const triggerMode = modeChoice.trim() === "2" ? "user-token" : "manual";

  let userToken: string | undefined = existing.discordUserToken;
  if (triggerMode === "user-token") {
    console.error("\nYou have chosen 'user-token' mode. Confirm by typing: I ACCEPT THE TOS RISK");
    const ack = (await rl.question("> ")).trim();
    if (ack !== "I ACCEPT THE TOS RISK") {
      console.error("acknowledgment not given — aborting (config unchanged)");
      rl.close();
      process.exit(1);
    }
    const nextUserToken = await prompt(rl, "Discord user token (from DevTools → Application → localStorage → token)", userToken);
    if (!nextUserToken) {
      console.error("user token required for user-token mode");
      rl.close();
      process.exit(1);
    }
    if (nextUserToken.startsWith("Bot ")) {
      console.error("that looks like a bot token — user tokens don't have a 'Bot ' prefix");
      rl.close();
      process.exit(1);
    }
    userToken = nextUserToken;
  }
  rl.close();

  if (!token || !guild || !channel) {
    console.error("bot token, guild, and channel are all required");
    process.exit(1);
  }

  console.error("\nconnecting to Discord…");
  const { client, channel: ch, close } = await connect(token, channel);
  try {
    console.error(`  ✓ connected as ${client.user?.tag}`);

    const members = await ch.guild.members.fetch({ user: [MJ_BOT_ID] });
    if (members.size === 0) {
      throw new Error("Midjourney bot not found in this guild. Invite it first (docs.midjourney.com).");
    }
    console.error("  ✓ Midjourney bot is in the server");

    // The /imagine command ID isn't discoverable from a bot token —
    // `/applications/{id}/commands` is scoped to the bot that owns {id}.
    // Keep any previously-known value, otherwise leave it empty.
    // Manual mode doesn't need this field at all. User-token mode needs
    // it, but can only get it from the user's own Discord client (see
    // README "Trouble?" section for the lookup).
    const imagineCommandId = existing.midjourneyImagineCommandId;
    if (imagineCommandId) {
      console.error(`  ✓ /imagine command id kept from existing config: ${imagineCommandId}`);
    } else {
      console.error("  · /imagine command id not set (fine for manual mode)");
      if (triggerMode === "user-token") {
        console.error(`
  ! You picked user-token mode but no /imagine command id is known.
    Manual mode would still work as-is. To populate the id for
    user-token mode: run /imagine once in your channel normally,
    capture the command id from browser DevTools (Network tab →
    request to /interactions), then edit $HOME/.config/designer/config.json
    and set midjourneyImagineCommandId, OR set the env var
    DESIGNER_MJ_IMAGINE_ID before running design commands.
`);
      }
    }

    const cfg: Config = {
      discordBotToken: token,
      discordChannelId: channel,
      discordGuildId: guild,
      midjourneyAppId: MJ_BOT_ID,
      midjourneyImagineCommandId: imagineCommandId,
      triggerMode,
      discordUserToken: userToken,
    };
    writeConfig(cfg, cfgPath);
    console.error(`\n  ✓ config saved to ${cfgPath}`);
    console.error(`  ✓ trigger mode: ${triggerMode}\n`);
  } finally {
    await close();
  }
}

function diagnose(msg: string): string | null {
  if (/disallowed intents|not enabled or whitelisted|DisallowedIntents/i.test(msg)) {
    return `
  → Your bot is missing the "Message Content Intent" privileged toggle.

    Fix:
      1. Open  https://discord.com/developers/applications
      2. Click your application → left sidebar → "Bot"
      3. Scroll to "Privileged Gateway Intents"
      4. TOGGLE ON:  [x] Message Content Intent
      5. Re-run:  ~/.claude/skills/design/bin/designer setup
`;
  }
  if (/TokenInvalid|An invalid token was provided|401: Unauthorized/i.test(msg)) {
    return `
  → Discord rejected the bot token. Common causes:
    - You pasted with "Bot " in front — paste the RAW token only.
    - You pasted the Application ID / Client ID, not the bot token.
    - A later "Reset Token" invalidated the one you copied.

    Fix:
      Developer portal → Bot tab → Reset Token → Copy → re-run setup.
`;
  }
  if (/MissingAccess|channel .* is not a text channel|is not accessible/i.test(msg)) {
    return `
  → The bot can't see the channel you gave. Common causes:
    - Wrong channel ID (right-click the channel → Copy Channel ID,
      not Copy Message Link or Copy Server ID).
    - The bot isn't in the server at all — did you run the OAuth URL
      and authorize it into the correct server?
    - Channel permissions deny "View Channel" for the bot role.
`;
  }
  if (/Midjourney bot not found/i.test(msg)) {
    return `
  → Your custom bot is in the server, but Midjourney's bot isn't.

    Fix:
      1. Confirm your Midjourney subscription at
         https://www.midjourney.com/account
      2. From your MJ account page, use "Invite the Bot" → pick your
         server. Or from Discord, Explore Apps → "Midjourney Bot" →
         Add to Server.
`;
  }
  return null;
}

main().catch((err) => {
  const msg = err?.message ?? String(err);
  console.error("\n[setup_check failed]");
  const fix = diagnose(msg);
  if (fix) {
    console.error(fix);
    console.error(`  (underlying error: ${msg})\n`);
  } else {
    console.error(msg);
  }
  process.exit(1);
});
