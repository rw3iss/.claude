#!/usr/bin/env -S node --import tsx
import { connect, waitForMessage, downloadAttachment } from "../lib/discord_client.ts";
import { loadConfig } from "../lib/config.ts";
import { requestPaths } from "../lib/storage.ts";
import { createTrigger } from "../lib/triggers/index.ts";
import { isGridMessage } from "../lib/midjourney.ts";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const UpscaleArgs = z.object({
  request: z.string().min(1),
  indices: z.array(z.number().int().min(1).max(4)).nonempty(),
  projectCwd: z.string().min(1),
  timeoutMs: z.number().default(180_000),
});

async function upscale(raw: unknown) {
  const args = UpscaleArgs.parse(raw);
  const cfg = loadConfig();
  if (!cfg.midjourneyAppId) throw new Error("midjourneyAppId missing — run setup_check");

  const paths = requestPaths(args.projectCwd, args.request);
  const rawFiles = readdirSync(paths.raw).filter((f) => f.endsWith(".json"));
  if (rawFiles.length === 0) throw new Error(`no raw metadata in ${paths.raw}`);
  const metaPath = join(paths.raw, rawFiles[0]);
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
    message_id: string;
    u_button_custom_ids: Record<string, string>;
  };

  const trigger = createTrigger(cfg);
  const { channel, close } = await connect(cfg.discordBotToken, cfg.discordChannelId);
  try {
    const results: Array<{ index: number; path: string }> = [];
    for (const idx of args.indices) {
      const customId = meta.u_button_custom_ids[String(idx)];
      if (!customId) throw new Error(`no U${idx} button id in metadata`);

      await trigger.clickButton({
        messageId: meta.message_id,
        customId,
        applicationId: cfg.midjourneyAppId!,
        channelId: cfg.discordChannelId,
        guildId: cfg.discordGuildId,
      });

      // Upscale replies have "Image #N" in content and a different button set
      // (no U1-U4). Explicitly exclude grid messages so a concurrent /imagine
      // reply in the same channel cannot be mistaken for an upscale result.
      const upMsg = await waitForMessage(
        channel,
        (m) =>
          m.author.id === cfg.midjourneyAppId &&
          m.attachments.size > 0 &&
          !isGridMessage(m.components as unknown as unknown[]) &&
          m.content.includes(`Image #${idx}`),
        args.timeoutMs
      );

      const att = upMsg.attachments.first()!;
      const destPath = join(paths.images, `0${idx}-up.png`);
      await downloadAttachment(att.url, destPath);
      results.push({ index: idx, path: destPath });
    }

    console.log(JSON.stringify({ status: "ok", request: args.request, upscales: results }));
  } finally {
    await close();
  }
}

async function main() {
  const [jsonArg] = process.argv.slice(2);
  if (!jsonArg) {
    console.error("usage: upscale.ts '<json>'");
    process.exit(2);
  }
  await upscale(JSON.parse(jsonArg));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err?.message ?? String(err) }));
  process.exit(1);
});
