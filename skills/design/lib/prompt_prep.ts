import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, parse } from "node:path";

export function findDesignMd(startDir: string, filename = "DESIGN.md"): string | null {
  let dir = resolve(startDir);
  const { root } = parse(dir);
  while (true) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(dir, ".git"))) return null;
    if (dir === root) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export type PromptKind = "web-ui" | "raw";

export interface PromptInputs {
  brief: string;
  designRules: string | null;
  aspectRatio: string;
  version: string;
  style: string;
  kind?: PromptKind;
  excludes?: string[];
}

export interface PreparedPrompt {
  promptMd: string;
  imaginePrompt: string;
}

// Prefix that reframes the brief as a flat 2D web UI mockup, based on current
// community best practice for Midjourney v6/v7 UI-design prompts. See
// https://uxplanet.org/ui-design-with-midjourney-df78eaa2d292 and
// https://aituts.com/midjourney-web-design/ for the patterns. The phrasing
// deliberately avoids words like "frame" or "screen" which MJ often interprets
// as a device bezel; instead we emphasize "full viewport, edge-to-edge".
const UI_MOCKUP_FRAMING =
  "modern minimal website UI design, flat 2D web page, " +
  "full viewport edge-to-edge screenshot, full-bleed browser content only, " +
  "Dribbble UI style, clean editorial layout, pixel-perfect mockup, " +
  "straight-on front view, the image IS the web page itself";

// --no exclusions — device-frame only. The UI_MOCKUP_FRAMING prefix already
// handles flat/2D/perspective, so duplicating those here just over-constrains
// MJ and produces degraded or near-blank output. Keep this list short.
export const DEFAULT_UI_EXCLUDES = [
  "device mockup", "device frame", "laptop", "phone", "tablet",
  "bezel", "screen frame", "desk scene",
];

export function assemblePrompt(inputs: PromptInputs): PreparedPrompt {
  const kind = inputs.kind ?? "web-ui";
  const excludes = inputs.excludes ?? (kind === "web-ui" ? DEFAULT_UI_EXCLUDES : []);
  const briefOneLine = inputs.brief.replace(/\s+/g, " ").trim();
  const rulesOneLine = inputs.designRules
    ? " | " + inputs.designRules.replace(/\s+/g, " ").trim().slice(0, 400)
    : "";

  const core =
    kind === "web-ui"
      ? `${UI_MOCKUP_FRAMING}, ${briefOneLine}${rulesOneLine}`
      : `${briefOneLine}${rulesOneLine}`;

  const flagParts = [
    `--ar ${inputs.aspectRatio}`,
    `--v ${inputs.version}`,
  ];
  if (inputs.style) {
    flagParts.push(`--style ${inputs.style}`);
  }
  if (excludes.length > 0) {
    flagParts.push(`--no ${excludes.join(", ")}`);
  }
  const imaginePrompt = `${core} ${flagParts.join(" ")}`;

  const sections: string[] = [];
  sections.push(`# Prompt kind\n\n${kind}`);
  sections.push("# Brief (user input)\n\n" + inputs.brief.trim());
  if (inputs.designRules) {
    sections.push("# Project rules (from DESIGN.md)\n\n" + inputs.designRules.trim());
  }
  if (kind === "web-ui") {
    sections.push("# Framing added to /imagine\n\n" + UI_MOCKUP_FRAMING);
  }
  sections.push("# Midjourney flags\n\n" + flagParts.join("  "));
  sections.push("# Final /imagine prompt (sent to Midjourney)\n\n```\n" + imaginePrompt + "\n```");
  const promptMd = sections.join("\n\n");

  return { promptMd, imaginePrompt };
}

export function readIfExists(path: string | null): string | null {
  if (!path) return null;
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}
