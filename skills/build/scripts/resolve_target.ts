import { existsSync } from "node:fs";
import { join, dirname, resolve, parse } from "node:path";
import { z } from "zod";
import { findDesignMd } from "../../design/lib/prompt_prep.ts";

// "auto" lets detection decide; "new"/"extend" force the operation.
export type BuildIntent = "auto" | "new" | "extend";
// The resolved operation the build will actually perform.
export type BuildOperation = "new" | "extend";

export interface TargetResolution {
  appRoot: string;             // directory the build writes into
  operation: BuildOperation;   // "new" = scaffold from template, "extend" = add to existing app
  appFound: boolean;           // whether an existing app (package.json) was detected
  designMdPath: string | null; // resolved DESIGN.md (walked up from appRoot), if any
  buildMdPath: string | null;  // resolved BUILD.md (walked up from appRoot), if any
  componentIndexPath: string | null; // <appRoot>/COMPONENT_INDEX.md, if present
}

// Walk up from startDir for the nearest package.json. Stops at the first .git
// boundary or the filesystem root. Returns the directory holding package.json,
// or null when none is found within the repo. This is how we tell "extend the
// existing app" (found) from "scaffold a new app" (not found).
export function findAppRoot(startDir: string): string | null {
  let dir = resolve(startDir);
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (existsSync(join(dir, ".git"))) return null; // repo root reached, no app package.json
    if (dir === root) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface ResolveTargetInputs {
  projectCwd: string;
  intent?: BuildIntent;     // default "auto"
  target?: string | null;   // explicit target dir; overrides detection
}

// Decide where to build and whether it's a new scaffold or an extension.
//
//   - explicit `target`  → use it; operation = extend if it has a package.json, else new
//   - intent "new"       → operation = new,    appRoot = target ?? projectCwd
//   - intent "extend"    → operation = extend, appRoot = found ?? projectCwd
//   - intent "auto"      → found ? extend@found : new@projectCwd
export function resolveTarget(inputs: ResolveTargetInputs): TargetResolution {
  const intent: BuildIntent = inputs.intent ?? "auto";
  const found = inputs.target ? null : findAppRoot(inputs.projectCwd);

  let appRoot: string;
  let operation: BuildOperation;
  let appFound: boolean;

  if (inputs.target) {
    appRoot = resolve(inputs.target);
    appFound = existsSync(join(appRoot, "package.json"));
    operation = intent === "new" ? "new" : intent === "extend" ? "extend" : appFound ? "extend" : "new";
  } else if (intent === "new") {
    appRoot = resolve(inputs.projectCwd);
    appFound = found !== null;
    operation = "new";
  } else if (intent === "extend") {
    appRoot = found ?? resolve(inputs.projectCwd);
    appFound = found !== null;
    operation = "extend";
  } else {
    // auto
    appRoot = found ?? resolve(inputs.projectCwd);
    appFound = found !== null;
    operation = found ? "extend" : "new";
  }

  const designMdPath = findDesignMd(appRoot, "DESIGN.md");
  const buildMdPath = findDesignMd(appRoot, "BUILD.md");
  const indexCandidate = join(appRoot, "COMPONENT_INDEX.md");
  const componentIndexPath = existsSync(indexCandidate) ? indexCandidate : null;

  return { appRoot, operation, appFound, designMdPath, buildMdPath, componentIndexPath };
}

// CLI entry:
//   { "projectCwd": ".", "intent": "auto", "target": null }
// Returns the TargetResolution as JSON.
const Args = z.object({
  projectCwd: z.string().min(1),
  intent: z.enum(["auto", "new", "extend"]).default("auto"),
  target: z.string().nullable().default(null),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));
    const result = resolveTarget(args);
    console.log(JSON.stringify({ status: "ok", ...result }));
  } catch (err: unknown) {
    console.error(
      JSON.stringify({ status: "error", message: (err as Error)?.message ?? String(err) })
    );
    process.exit(1);
  }
}
