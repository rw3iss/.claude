export interface TriggerImagineArgs {
  prompt: string;
  applicationId: string;
  imagineCommandId: string;
  channelId: string;
  guildId: string;
}

export interface ClickButtonArgs {
  messageId: string;
  customId: string;
  applicationId: string;
  channelId: string;
  guildId: string;
}

export interface Trigger {
  /**
   * Kick off /imagine. For manual mode this prints the command and resolves
   * immediately; the caller's wait-for-reply listener does the rest. For
   * user-token mode this POSTs to Discord's interactions endpoint.
   */
  triggerImagine(args: TriggerImagineArgs): Promise<void>;

  /** Click a U-button on an existing message (upscale). */
  clickButton(args: ClickButtonArgs): Promise<void>;

  readonly mode: "manual" | "user-token";
}
