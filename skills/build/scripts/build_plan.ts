import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readIfExists, resolveTarget } from "../shared.ts";
import type { BuildOperation } from "./resolve_target.ts";
import { z } from "zod";

// How literally to follow reference images — only relevant when images are given.
export type ImageFollowMode = "exact" | "creative";

export interface ComposeInputs {
  request: string;                  // short name/description of the feature or page
  operation: BuildOperation;        // "new" = scaffold from template, "extend" = add to existing app
  objective: string;                // the ask: what to build
  designRules: string | null;       // DESIGN.md content (if found)
  buildRules: string | null;        // BUILD.md content (if found)
  componentIndex: string | null;    // COMPONENT_INDEX.md content (if present)
  extraPrompt: string | null;       // extra invocation-time guidance
  imagePaths: string[];             // optional reference images (often empty)
  imageFollowMode: ImageFollowMode; // exact | creative — used only when imagePaths is non-empty
}

// ─── Feature analysis & reuse — MANDATORY FIRST STEP ─────────────────────────

const FEATURE_ANALYSIS = `\
## Feature analysis & reuse — MANDATORY FIRST STEP

Before writing a single line of code, analyze the request and plan for reuse.
Write this analysis **in your response** before any code. Do not skip it.

1. **High-level analysis.** State the feature's goal/objective in 1–2 sentences:
   what does it accomplish for the user, and where does it fit in the app?

2. **Granular/technical analysis.** Decompose it into its constituent pieces:
   the discrete UI sections, interactive elements, data it reads/writes, states
   (loading / empty / error), and any shared behavior. List them.

3. **Reuse match — consult \`COMPONENT_INDEX.md\` (below).** For each piece from
   step 2, scan the index for an existing component, utility/hook, or SCSS
   mixin/class that already does it, or could with a small modification. This
   includes layout components, page elements, and small or large feature units.
   For each piece, decide and record one of:
      - **reuse** — use an existing entry as-is
      - **adapt/extend** — extend an existing entry (add a prop, variant, or mixin
        parameter) rather than cloning it
      - **new** — create new ONLY when the need is genuinely unique and nothing
        existing fits or can reasonably be adapted

4. **Default to modular.** Prefer breaking HTML sections and elements out into
   discrete, single-purpose, reusable components over inlining large blocks.
   If a piece you're about to build could plausibly be reused elsewhere, make it
   a standalone component and add it to the index.

Everything reusable should be reused. New component layouts and new components are
for the genuinely unique parts only.`;

// ─── DRY + modularity directive ──────────────────────────────────────────────

const DRY_DIRECTIVE = `\
## DRY + modularity directive — non-negotiable

- **Reuse before creating.** Honor the reuse decisions from the feature analysis.
- **No duplication.** Never duplicate a token, mixin, SCSS class, utility, or
  component. If two things need the same value or behavior, factor it into a
  shared variable / mixin / utility and reference it.
- **Extend, don't clone.** When something is close, add a prop/variant/parameter
  to the existing piece instead of copying it.
- **Keep components small and discrete.** One component = one responsibility.
- **Tokens & fonts only.** Every color/space/radius comes from CSS custom
  properties — \`var(--color-*)\` / \`var(--space-*)\` / \`var(--radius-*)\`; every
  font from \`var(--font-*)\`. No raw values, no raw
  \`font-family\` strings in component SCSS.`;

// ─── Reference-image analysis (only when images present) ─────────────────────

const IMAGE_ANALYSIS_EXACT = `\
## Reference images — replicate (exact follow mode)

Reference images were provided. Treat them as a layout blueprint. Before coding,
produce a written zone inventory of the relevant image(s):

For each distinct visual zone (top to bottom): **Name · Purpose · Layout
(columns + proportions) · Content slots (in order) · Visual treatment
(bg/borders/accents) · Approx. height**.

Then build exactly what you documented — exact column splits, exact content
slots, exact visual treatment. "Similar but different" is a failure. Still route
all colors/spacing/fonts through the app's tokens (do not hardcode values pulled
from the image).`;

const IMAGE_ANALYSIS_CREATIVE = `\
## Reference images — inspiration (creative follow mode)

Reference images were provided as a mood board, not a blueprint. Before coding,
extract: **color story · typographic personality · spatial density · 1–2
signature moves**. Then invent a bolder layout in the same spirit, expressed
entirely through the app's existing tokens and components. Capture the aesthetic,
not the literal arrangement.`;

// ─── Design language ──────────────────────────────────────────────────────────

function designLanguageSection(inputs: ComposeInputs): string {
  if (inputs.designRules) {
    return `\
## Design language — from DESIGN.md (authoritative)

The app's design rules are below. Follow them. Also read the live tokens in
\`styles/_variables.scss\` (CSS custom properties, including \`--font-*\`) and theme
overrides in \`styles/_themes.scss\`; DESIGN.md is the intent, the SCSS holds the
values — they must stay consistent.

${inputs.designRules.trim()}`;
  }

  if (inputs.operation === "new") {
    return `\
## Design language — establish it (no DESIGN.md yet)

No DESIGN.md was found and this is a new app. **Establish** the design language as
part of this build: choose the aesthetic, color ramp (one accent + neutrals),
type stacks, spacing/radii scales, and motion policy. Set them in
CSS custom properties in \`styles/_variables.scss\` (theme overrides in
\`styles/_themes.scss\`), then **write the decisions into
\`DESIGN.md\`** (the seeded stub) so every later build stays consistent.`;
  }

  return `\
## Design language — derive from existing code (no DESIGN.md)

No DESIGN.md was found. Derive the design language from the existing app: read
\`styles/_variables.scss\` (and \`styles/_themes.scss\`) plus a few existing components
to learn the tokens, type, and conventions. Match them. Consider writing a DESIGN.md
to capture what you inferred so future builds have a source of truth.`;
}

// ─── Typography mining ─────────────────────────────────────────────────────────

const TYPOGRAPHY_MINING = `\
## Typography (use the established stacks)

Fonts are CSS custom properties — \`--font-body\`, \`--font-mono\`, and any you add
such as \`--font-heading\` — declared in \`:root\` in \`styles/_variables.scss\`.
Components use \`font-family: var(--font-*)\`, never a raw \`font-family\` string.

- **Extending an app with fonts already chosen:** reuse the existing \`--font-*\`
  custom properties. Do not introduce a new typeface unless the feature genuinely
  needs one (and if you do, add the \`--font-*\` property and note it in DESIGN.md).
- **New app, or a deliberate type decision needed:** enumerate the text zones
  (wordmark, headings, labels, body, numeric/mono data), pick stacks per zone
  (prefer Google Fonts with a generic fallback), add ONE \`@import url(...)\` with
  \`display=swap\` at the top of \`styles/_variables.scss\`, and define the
  \`--font-*\` custom properties for each role.`;

// ─── Component + styling rules ────────────────────────────────────────────────

const COMPONENT_RULES = `\
## Component + styling rules

- Preact components with one per-component \`.scss\` imported once at the top of the
  component (real class names, no CSS modules). Mobile-first: base styles target
  small screens; layer up with \`@include tablet\` / \`@include desktop\` from
  \`styles/_responsive.scss\`.
- Wire any data the feature shows through the mock-data layer: add methods to
  \`src/services/api/ApiClient.ts\`, implement them in \`MockApiAdapter\`, and add
  realistic fixtures to \`src/mock/data/*.json\`. The feature must demo with no
  backend and no env vars.
- **Placement — keep pages and components separate.** A **page** (route/screen view)
  goes in \`src/pages/<PageName>/\`; a **feature/UI component** in
  \`src/components/<feature-or-component>/\`; a **primitive/core "common" component**
  (Button, Input, Modal, …) in \`src/components/common/<Component>/\`. Never dump
  everything flat into \`src/components/\`. (Honor BUILD.md if it specifies otherwise.)`;

// ─── Index + docs maintenance ─────────────────────────────────────────────────

const INDEX_MAINTENANCE = `\
## After building — keep the index and docs current

- **Update \`COMPONENT_INDEX.md\`.** Add a row for every new shared component,
  utility/hook, or SCSS mixin/class you created: path · one-line purpose ·
  reuse-for hint. If you extended an existing entry, update its row.
- **Note new shared surface in the docs.** When you introduce a notable shared
  component, utility, or style, add a short line to the app's README and/or
  CLAUDE.md so the rest of the project knows it exists.
- The index is the contract the next build reads first — leave it accurate.`;

// ─── Composer ────────────────────────────────────────────────────────────────

export function composePlan(inputs: ComposeInputs): string {
  const hasImages = inputs.imagePaths.length > 0;
  const lines: string[] = [];

  lines.push(`# Build brief for ${inputs.request}`, "");
  lines.push(
    `**Operation: ${inputs.operation === "new" ? "new app (scaffold from template, then build the request)" : "extend existing app (add this to the current codebase)"}**`,
    ""
  );
  if (hasImages) {
    lines.push(`**Reference-image follow mode: ${inputs.imageFollowMode}**`, "");
  }
  lines.push(
    "This is the authoritative brief for the build. The builder (Claude) follows",
    "it top-to-bottom: analyze and plan reuse first, honor the design and build",
    "rules, reuse existing components/styles, then implement.",
    ""
  );

  // The ask
  lines.push("## Objective (the request)", "", inputs.objective.trim() || "_(none provided)_", "");
  if (inputs.extraPrompt) {
    lines.push("## Additional guidance", "", inputs.extraPrompt.trim(), "");
  }

  // 1. Feature analysis & reuse (mandatory first step)
  lines.push(FEATURE_ANALYSIS, "");

  // 2. Reuse manifest
  lines.push("## Reuse manifest (COMPONENT_INDEX.md)", "");
  if (inputs.componentIndex) {
    lines.push(inputs.componentIndex.trim(), "");
  } else {
    lines.push(
      inputs.operation === "new"
        ? "_(no index yet — this is a new app. Create COMPONENT_INDEX.md as you build, adding a row per shared component/utility/style.)_"
        : "_(no COMPONENT_INDEX.md found at the app root. Scan the existing components/ and styles/ directories directly to find reusable pieces, then create the index to record them.)_",
      ""
    );
  }

  // 3. DRY directive
  lines.push(DRY_DIRECTIVE, "");

  // 4. Design language
  lines.push(designLanguageSection(inputs), "");

  // 5. Build rules
  if (inputs.buildRules) {
    lines.push("## Build rules — from BUILD.md (authoritative)", "", inputs.buildRules.trim(), "");
  }

  // 6. Reference images (optional)
  if (hasImages) {
    lines.push("## Reference images", "");
    for (const p of inputs.imagePaths) lines.push(`- ${p}`);
    lines.push("");
    lines.push(inputs.imageFollowMode === "creative" ? IMAGE_ANALYSIS_CREATIVE : IMAGE_ANALYSIS_EXACT, "");
  }

  // 7. Typography
  lines.push(TYPOGRAPHY_MINING, "");

  // 8. Component + styling rules
  lines.push(COMPONENT_RULES, "");

  // 9. Index + docs maintenance
  lines.push(INDEX_MAINTENANCE, "");

  return lines.join("\n");
}

// ─── CLI entry ───────────────────────────────────────────────────────────────

const Args = z.object({
  request: z.string().min(1),
  projectCwd: z.string().min(1),
  objective: z.string().default(""),
  extraPrompt: z.string().nullable().default(null),
  intent: z.enum(["auto", "new", "extend"]).default("auto"),
  target: z.string().nullable().default(null),
  designMd: z.string().nullable().optional(), // override DESIGN.md path
  buildMd: z.string().nullable().optional(),  // override BUILD.md path
  imagePaths: z.array(z.string()).default([]),
  imageFollowMode: z.enum(["exact", "creative"]).default("exact"),
});

async function main() {
  const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));

  const resolution = resolveTarget({
    projectCwd: args.projectCwd,
    intent: args.intent,
    target: args.target,
  });

  const designRules = readIfExists(args.designMd ?? resolution.designMdPath);
  const buildRules = readIfExists(args.buildMd ?? resolution.buildMdPath);
  const componentIndex = readIfExists(resolution.componentIndexPath);

  const plan = composePlan({
    request: args.request,
    operation: resolution.operation,
    objective: args.objective,
    designRules,
    buildRules,
    componentIndex,
    extraPrompt: args.extraPrompt,
    imagePaths: args.imagePaths,
    imageFollowMode: args.imageFollowMode,
  });

  const planPath = join(resolution.appRoot, "PLAN.md");
  writeFileSync(planPath, plan);

  console.log(
    JSON.stringify({
      status: "ok",
      planPath,
      appRoot: resolution.appRoot,
      operation: resolution.operation,
      appFound: resolution.appFound,
      hasDesignMd: Boolean(designRules),
      hasBuildMd: Boolean(buildRules),
      hasComponentIndex: Boolean(componentIndex),
      imageCount: args.imagePaths.length,
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(JSON.stringify({ status: "error", message: err?.message ?? String(err) }));
    process.exit(1);
  });
}
