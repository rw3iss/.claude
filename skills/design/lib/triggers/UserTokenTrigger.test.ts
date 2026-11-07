import { describe, it, expect } from "vitest";
import { buildImagineBody, buildButtonClickBody, UserTokenTrigger } from "./UserTokenTrigger.ts";

describe("buildImagineBody", () => {
  it("produces a type=2 application command interaction payload", () => {
    const body = buildImagineBody({
      prompt: "glassy login",
      applicationId: "mj-app", imagineCommandId: "cmd-xyz",
      channelId: "ch1", guildId: "g1",
    }, "session-abc");
    expect(body).toMatchObject({
      type: 2,
      application_id: "mj-app",
      channel_id: "ch1",
      guild_id: "g1",
      session_id: "session-abc",
    });
    expect(body.data.name).toBe("imagine");
    expect(body.data.options[0]).toEqual({ type: 3, name: "prompt", value: "glassy login" });
  });
});

describe("buildButtonClickBody", () => {
  it("produces a type=3 component interaction payload", () => {
    const body = buildButtonClickBody({
      messageId: "m1", customId: "cid",
      applicationId: "mj-app", channelId: "ch1", guildId: "g1",
    }, "session-abc");
    expect(body).toMatchObject({
      type: 3,
      application_id: "mj-app",
      channel_id: "ch1",
      guild_id: "g1",
      message_id: "m1",
      session_id: "session-abc",
    });
    expect(body.data).toEqual({ component_type: 2, custom_id: "cid" });
  });
});

describe("UserTokenTrigger constructor", () => {
  it("rejects a bot token", () => {
    expect(() => new UserTokenTrigger({ userToken: "Bot abc" }))
      .toThrow(/user token/);
  });
  it("rejects empty token", () => {
    expect(() => new UserTokenTrigger({ userToken: "" }))
      .toThrow(/user token/);
  });
  it("accepts a plausible user token", () => {
    const t = new UserTokenTrigger({ userToken: "MTIzNDU.xxxxx.xxxxx" });
    expect(t.mode).toBe("user-token");
  });
});
