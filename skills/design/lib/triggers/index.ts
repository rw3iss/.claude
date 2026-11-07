import type { Config } from "../config.ts";
import type { Trigger } from "./Trigger.ts";
import { ManualTrigger } from "./ManualTrigger.ts";
import { UserTokenTrigger } from "./UserTokenTrigger.ts";

export type { Trigger, TriggerImagineArgs, ClickButtonArgs } from "./Trigger.ts";

export function createTrigger(cfg: Config): Trigger {
  if (cfg.triggerMode === "user-token") {
    if (!cfg.discordUserToken) {
      throw new Error("triggerMode='user-token' but discordUserToken missing");
    }
    return new UserTokenTrigger({ userToken: cfg.discordUserToken });
  }
  return new ManualTrigger();
}
