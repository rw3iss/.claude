---
name: design
description: Generate application-style design images via Midjourney (through a Discord bot you own). Run this skill when the user wants a set of reference design images for a UI — a login form, dashboard, checkout flow, etc. — described in natural language, optionally combined with project-specific rules in a DESIGN.md file. Produces a folder of images and metadata under ./designs/<request-name>/.
---

# Design skill

Turns a design brief into Midjourney images saved in a request-scoped folder.

## First-run setup

If `~/.config/designer/config.json` does not exist, run setup before anything else:

```bash
~/.claude/skills/design/bin/designer setup
```

You'll need: Discord bot token, guild ID, channel ID (where Midjourney lives). You'll also pick a **trigger mode**:
- `manual` (default, safe): you paste `/imagine` into Discord yourself; the bot listens for Midjourney's reply and does the rest.
- `user-token` (⚠ Discord ToS violation): bot invokes `/imagine` programmatically using your Discord user token. Opt-in only, requires explicit acknowledgment.

## Commands this skill exposes

Use the `~/.claude/skills/design/bin/designer` dispatcher — it works from any CWD. All subcommands that take JSON args print one JSON line to stdout on success, or stderr + non-zero exit on failure.

| Command | Purpose |
|---|---|
| `designer setup` | Interactive setup + verification |
| `designer prepare-prompt '<json>'` | Merge brief + DESIGN.md + flags, write `prompts/original.md` + `prompts/prompt.md` |
| `designer generate '<json>'` | Trigger `/imagine` (via configured trigger mode), await reply, download grid, split into 4 images |
| `designer upscale '<json>'` | Click U1/U2/U3/U4 on a stored message_id to get hi-res upscales |
| `designer process-raw '<json>'` | Manual-mode ingestion: scan `raw/*.png` and split any 2×2 grids |
| `scripts/split_grid.ts` | Importable library (used internally by `generate` and `process-raw`) |

## Typical flow

1. User: "generate some designs for a checkout page with glassmorphism aesthetic"
2. Run `designer prepare-prompt '{"brief":"checkout page glassmorphism","projectCwd":"<cwd>"}'` — captures request name + path info, returns the prepared MJ prompt.
3. Run `designer generate '{"prompt":"<imaginePrompt>","request":"<name>","projectCwd":"<cwd>"}'` — in manual mode, prints the `/imagine` command for you to paste; then listens and downloads.
4. Show the user the indexed list of image files and ask which they want to build from (conversational — "build from 2 and 4, make the buttons rounder").

## Manual fallback when Discord is unreachable

If the bot can't connect, run `designer prepare-prompt` to get the prompt text, paste `/imagine <prompt>` in Discord yourself, save the resulting grid into `designs/<request>/raw/`, and run `designer process-raw '<json>'`.
