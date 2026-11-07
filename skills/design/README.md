# design (Claude Code skill)

Design image generation via Midjourney through a user-owned Discord bot. Installed into `~/.claude/skills/design/` by the `design-build-skills` installer.

## Setup (once)

1. At https://discord.com/developers/applications, create an application, then a Bot. Enable **"Message Content Intent"**.
2. OAuth2 URL Generator → scopes `bot` + `applications.commands`, permissions: Read Messages, Read Message History, Use Application Commands, Send Messages. Invite to your server.
3. Subscribe to Midjourney, invite the Midjourney bot to your server.
4. Run `~/.claude/skills/design/bin/designer setup` and follow the prompts.

Config is stored at `~/.config/designer/config.json`. Env-var overrides:

| Env var | Config field |
|---|---|
| `DESIGNER_DISCORD_TOKEN` | `discordBotToken` |
| `DESIGNER_DISCORD_CHANNEL_ID` | `discordChannelId` |
| `DESIGNER_DISCORD_GUILD_ID` | `discordGuildId` |
| `DESIGNER_MJ_APP_ID` | `midjourneyAppId` |
| `DESIGNER_MJ_IMAGINE_ID` | `midjourneyImagineCommandId` |
| `DESIGNER_TRIGGER_MODE` | `triggerMode` (`manual` \| `user-token`) |
| `DESIGNER_DISCORD_USER_TOKEN` | `discordUserToken` (only when triggerMode=user-token) |

## Trigger modes

- **manual** (default): Bot only listens. When you run `mj_bot.ts generate`, it prints the `/imagine <prompt>` line for you to paste into Discord. Then it detects Midjourney's reply, downloads the grid, splits into four images, and exits. Completely ToS-safe.
- **user-token**: Bot POSTs directly to Discord's interactions endpoint using your user token. Fully automated — no paste required. Using a user token programmatically is explicitly prohibited by Discord's Terms of Service and can result in your personal Discord account being banned. Opt-in only via `setup_check`, with explicit acknowledgment.

## Updating

From inside Claude Code, run **`/build update`** to refresh both skills (`design` +
`build`) and the `/design` + `/build` commands to the latest — no restart
needed. Equivalent on the CLI: `~/.cache/design-build-skills/install.sh --update`.

## Running tests

```bash
cd ~/.claude/skills/design
npm test
```

Unit tests cover the pure code (storage, config, prompt prep, grid splitting, button parsing, trigger request-body building). Discord-facing code is verified via `setup_check.ts` end-to-end.
