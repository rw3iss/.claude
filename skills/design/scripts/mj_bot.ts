#!/usr/bin/env -S node --import tsx
import { connect, waitForMessage, downloadAttachment } from "../lib/discord_client.ts";
import type { Message } from "discord.js";
import { loadConfig } from "../lib/config.ts";
import { extractUButtons, isGridMessage } from "../lib/midjourney.ts";
import { requestPaths, ensureRequestDirs } from "../lib/storage.ts";
import { createTrigger } from "../lib/triggers/index.ts";
import { splitGrid } from "./split_grid.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const GenerateArgs = z.object({
  prompt: z.string().min(1),
  request: z.string().min(1),
  projectCwd: z.string().min(1),
  timeoutMs: z.number().default(300_000),
});

async function generate(raw: unknown) {
  const args = GenerateArgs.parse(raw);
  const cfg = loadConfig();
  if (!cfg.midjourneyAppId) {
    throw new Error("midjourneyAppId missing in config — run designer setup");
  }
  if (cfg.triggerMode === "user-token" && !cfg.midjourneyImagineCommandId) {
    throw new Error(
      "triggerMode='user-token' requires midjourneyImagineCommandId. " +
      "Set DESIGNER_MJ_IMAGINE_ID or edit ~/.config/designer/config.json."
    );
  }

  const paths = requestPaths(args.projectCwd, args.request);
  ensureRequestDirs(paths);

  const trigger = createTrigger(cfg);
  const { channel, close } = await connect(cfg.discordBotToken, cfg.discordChannelId);
  try {
    await trigger.triggerImagine({
      prompt: args.prompt,
      applicationId: cfg.midjourneyAppId,
      imagineCommandId: cfg.midjourneyImagineCommandId ?? "",
      channelId: cfg.discordChannelId,
      guildId: cfg.discordGuildId,
    });

    // MJ echoes the full prompt back inside **...** in msg.content. Use a
    // normalized substring of our prompt to disambiguate between concurrent
    // or recent /imagine calls that differ only by framing. Skip generic
    // UI-mockup boilerplate at the start (anything before the first comma)
    // so the key reflects what's actually distinctive about THIS request.
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const promptNorm = normalize(args.prompt);
    const firstComma = promptNorm.indexOf(",");
    const keyStart = firstComma >= 0 && firstComma < 40 ? firstComma + 1 : 0;
    const promptKey = promptNorm.slice(keyStart, keyStart + 60).trim();

    // isGridMessage() requires all four U1–U4 buttons, which MJ only adds on
    // the final fully-rendered 2×2 grid. This excludes:
    //   • in-progress blurry previews (no components yet)
    //   • upscale replies (different button set: "Upscale (Subtle)" etc.)
    // promptKey is derived from the descriptive portion of the prompt, not
    // the flags, so changing --ar or --v in the prompt does not affect matching.
    const matches = (msg: Message) =>
      msg.author.id === cfg.midjourneyAppId &&
      msg.attachments.size > 0 &&
      isGridMessage(msg.components as unknown as unknown[]) &&
      Array.from(msg.attachments.values()).some(
        (a) => (a.contentType ?? "").startsWith("image/") || /\.png$|\.jpg$|\.jpeg$|\.webp$/i.test(a.name ?? "")
      ) &&
      normalize(msg.content).includes(promptKey);

    // Before subscribing to future events, check recent channel history:
    // MJ may have already replied (e.g., the user pasted /imagine and MJ
    // completed before this bot connected, or a prior bot run died). Use a
    // short window (3 min) so we don't match a completed result from a
    // previous bot run on the same prompt. History matches also require
    // components (final image only — no blurry previews).
    const FRESHNESS_MS = 3 * 60 * 1000;
    const recent = await channel.messages.fetch({ limit: 20 });
    const existingMatch = recent.find(
      (m) => Date.now() - m.createdTimestamp < FRESHNESS_MS && matches(m)
    );

    let reply: Message;
    if (existingMatch) {
      console.error(`  ✓ found existing MJ reply in recent history (msg ${existingMatch.id})`);
      reply = existingMatch;
    } else {
      reply = await waitForMessage(channel, matches, args.timeoutMs);
    }

    const attachment = reply.attachments.first()!;
    const rawPath = join(paths.raw, `mj-${reply.id}.png`);
    await downloadAttachment(attachment.url, rawPath);

    const uButtons = extractUButtons(reply.components as unknown as unknown[]);
    const metaPath = join(paths.raw, `mj-${reply.id}.json`);
    writeFileSync(
      metaPath,
      JSON.stringify(
        {
          prompt: args.prompt,
          message_id: reply.id,
          channel_id: reply.channelId,
          timestamp: reply.createdTimestamp,
          u_button_custom_ids: uButtons,
          attachment_url: attachment.url,
        },
        null,
        2
      )
    );

    const files = await splitGrid(rawPath, paths.images);

    console.log(
      JSON.stringify({
        status: "ok",
        request: args.request,
        rawPath,
        metaPath,
        images: files,
      })
    );
  } finally {
    await close();
  }
}

async function main() {
  const [sub, jsonArg] = process.argv.slice(2);
  if (sub !== "generate") {
    console.error("usage: mj_bot.ts generate '<json>'");
    process.exit(2);
  }
  const raw = JSON.parse(jsonArg);
  await generate(raw);
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err?.message ?? String(err) }));
  process.exit(1);
});
