// ⚠ WARNING: Uses a Discord USER token (not a bot token).
// Automating a user account is explicitly prohibited by Discord's Terms of
// Service and can result in account termination. This module exists because
// the user has opted in knowing the risk. Do NOT enable triggerMode=user-token
// without explicit consent from the account holder.

import type { Trigger, TriggerImagineArgs, ClickButtonArgs } from "./Trigger.ts";
import { fetch } from "undici";

const INTERACTIONS_URL = "https://discord.com/api/v10/interactions";

export function buildImagineBody(args: TriggerImagineArgs, sessionId: string) {
  return {
    type: 2,
    application_id: args.applicationId,
    guild_id: args.guildId,
    channel_id: args.channelId,
    session_id: sessionId,
    data: {
      version: args.imagineCommandId,
      id: args.imagineCommandId,
      name: "imagine",
      type: 1,
      options: [{ type: 3, name: "prompt", value: args.prompt }],
      application_command: {
        id: args.imagineCommandId,
        application_id: args.applicationId,
        name: "imagine",
        type: 1,
      },
      attachments: [],
    },
  };
}

export function buildButtonClickBody(args: ClickButtonArgs, sessionId: string) {
  return {
    type: 3,
    application_id: args.applicationId,
    guild_id: args.guildId,
    channel_id: args.channelId,
    message_id: args.messageId,
    session_id: sessionId,
    data: { component_type: 2, custom_id: args.customId },
  };
}

export interface UserTokenTriggerOptions {
  userToken: string;
  sessionIdFactory?: () => string;
}

export class UserTokenTrigger implements Trigger {
  readonly mode = "user-token" as const;
  private userToken: string;
  private sessionIdFactory: () => string;

  constructor(opts: UserTokenTriggerOptions) {
    if (!opts.userToken || opts.userToken.startsWith("Bot ")) {
      throw new Error("UserTokenTrigger requires a user token (not a bot token)");
    }
    this.userToken = opts.userToken;
    this.sessionIdFactory = opts.sessionIdFactory ?? (() => Math.random().toString(36).slice(2));
  }

  private async post(body: unknown): Promise<void> {
    const res = await fetch(INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.userToken,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `interaction POST failed: ${res.status} ${text.slice(0, 500)} ` +
        `(if 401/403, Discord rejected the user token — the account may have been flagged; ` +
        `fall back to triggerMode='manual')`
      );
    }
  }

  async triggerImagine(args: TriggerImagineArgs): Promise<void> {
    await this.post(buildImagineBody(args, this.sessionIdFactory()));
  }

  async clickButton(args: ClickButtonArgs): Promise<void> {
    await this.post(buildButtonClickBody(args, this.sessionIdFactory()));
  }
}
