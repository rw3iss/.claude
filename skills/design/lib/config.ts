import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { z } from "zod";

const ConfigSchema = z.object({
  discordBotToken: z.string().min(1),
  discordChannelId: z.string().min(1),
  discordGuildId: z.string().min(1),
  midjourneyAppId: z.string().optional(),
  midjourneyImagineCommandId: z.string().optional(),
  triggerMode: z.enum(["manual", "user-token"]).default("manual"),
  discordUserToken: z.string().optional(),
}).refine(
  (v) => v.triggerMode !== "user-token" || Boolean(v.discordUserToken),
  { message: "triggerMode='user-token' requires discordUserToken" }
);

export type Config = z.infer<typeof ConfigSchema>;

export interface LoadOptions {
  configPath?: string;
  env?: Record<string, string | undefined>;
}

export function defaultConfigPath(): string {
  return join(homedir(), ".config", "designer", "config.json");
}

export function loadConfig(opts: LoadOptions = {}): Config {
  const configPath = opts.configPath ?? defaultConfigPath();
  const env = opts.env ?? process.env;

  let fileData: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    fileData = JSON.parse(readFileSync(configPath, "utf-8"));
  }

  const merged = {
    discordBotToken: env.DESIGNER_DISCORD_TOKEN ?? fileData.discordBotToken,
    discordChannelId: env.DESIGNER_DISCORD_CHANNEL_ID ?? fileData.discordChannelId,
    discordGuildId: env.DESIGNER_DISCORD_GUILD_ID ?? fileData.discordGuildId,
    midjourneyAppId: env.DESIGNER_MJ_APP_ID ?? fileData.midjourneyAppId,
    midjourneyImagineCommandId:
      env.DESIGNER_MJ_IMAGINE_ID ?? fileData.midjourneyImagineCommandId,
    triggerMode: env.DESIGNER_TRIGGER_MODE ?? fileData.triggerMode ?? "manual",
    discordUserToken: env.DESIGNER_DISCORD_USER_TOKEN ?? fileData.discordUserToken,
  };

  return ConfigSchema.parse(merged);
}

export function writeConfig(cfg: Config, path: string = defaultConfigPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2));
}
