import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.ts";

function withTmp<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "designer-"));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

describe("loadConfig", () => {
  it("reads from a config file", () => {
    withTmp((dir) => {
      const file = join(dir, "config.json");
      writeFileSync(file, JSON.stringify({
        discordBotToken: "Bot abc",
        discordChannelId: "123",
        discordGuildId: "456",
      }));
      const cfg = loadConfig({ configPath: file, env: {} });
      expect(cfg.discordBotToken).toBe("Bot abc");
      expect(cfg.discordChannelId).toBe("123");
    });
  });

  it("env vars override file values", () => {
    withTmp((dir) => {
      const file = join(dir, "config.json");
      writeFileSync(file, JSON.stringify({
        discordBotToken: "Bot file",
        discordChannelId: "ch-file",
        discordGuildId: "g-file",
      }));
      const cfg = loadConfig({
        configPath: file,
        env: { DESIGNER_DISCORD_TOKEN: "Bot env" },
      });
      expect(cfg.discordBotToken).toBe("Bot env");
      expect(cfg.discordChannelId).toBe("ch-file");
    });
  });

  it("throws with a useful message when required fields missing", () => {
    withTmp((dir) => {
      const file = join(dir, "config.json");
      writeFileSync(file, "{}");
      expect(() => loadConfig({ configPath: file, env: {} }))
        .toThrow(/discordBotToken/);
    });
  });

  it("defaults triggerMode to 'manual'", () => {
    withTmp((dir) => {
      const file = join(dir, "config.json");
      writeFileSync(file, JSON.stringify({
        discordBotToken: "Bot x", discordChannelId: "c", discordGuildId: "g",
      }));
      const cfg = loadConfig({ configPath: file, env: {} });
      expect(cfg.triggerMode).toBe("manual");
    });
  });

  it("rejects triggerMode='user-token' without discordUserToken", () => {
    withTmp((dir) => {
      const file = join(dir, "config.json");
      writeFileSync(file, JSON.stringify({
        discordBotToken: "Bot x", discordChannelId: "c", discordGuildId: "g",
        triggerMode: "user-token",
      }));
      expect(() => loadConfig({ configPath: file, env: {} }))
        .toThrow(/discordUserToken/);
    });
  });
});
