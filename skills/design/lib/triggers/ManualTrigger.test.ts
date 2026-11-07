import { describe, it, expect } from "vitest";
import { ManualTrigger } from "./ManualTrigger.ts";

describe("ManualTrigger", () => {
  it("writes the /imagine line to stderr and resolves", async () => {
    const errs: string[] = [];
    const t = new ManualTrigger({ write: (s) => { errs.push(s); } });
    await t.triggerImagine({
      prompt: "a glassy login form",
      applicationId: "mj", imagineCommandId: "cmd",
      channelId: "c", guildId: "g",
    });
    expect(errs.join("")).toContain("/imagine a glassy login form");
    expect(errs.join("")).toContain("paste this");
  });

  it("writes click instructions to stderr and resolves", async () => {
    const errs: string[] = [];
    const t = new ManualTrigger({ write: (s) => { errs.push(s); } });
    await t.clickButton({
      messageId: "123", customId: "MJ::JOB::upsample::2::x",
      applicationId: "mj", channelId: "c", guildId: "g",
    });
    expect(errs.join("")).toContain("click U2");
  });

  it("reports mode = 'manual'", () => {
    const t = new ManualTrigger();
    expect(t.mode).toBe("manual");
  });
});
