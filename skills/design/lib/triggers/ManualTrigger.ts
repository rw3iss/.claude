import type { Trigger, TriggerImagineArgs, ClickButtonArgs } from "./Trigger.ts";

export interface ManualTriggerOptions {
  write?: (line: string) => void;
}

export class ManualTrigger implements Trigger {
  readonly mode = "manual" as const;
  private write: (line: string) => void;

  constructor(opts: ManualTriggerOptions = {}) {
    this.write = opts.write ?? ((s: string) => process.stderr.write(s));
  }

  async triggerImagine(args: TriggerImagineArgs): Promise<void> {
    this.write("\n");
    this.write("==> manual trigger — paste this into Discord now:\n");
    this.write("    /imagine " + args.prompt + "\n");
    this.write("    (listening for Midjourney's reply…)\n\n");
  }

  async clickButton(args: ClickButtonArgs): Promise<void> {
    const m = args.customId.match(/upsample::([1-4])/);
    const which = m ? `U${m[1]}` : "the relevant button";
    this.write("\n");
    this.write(`==> manual trigger — click ${which} on Midjourney's message in Discord\n`);
    this.write("    (listening for the upscale reply…)\n\n");
  }
}
