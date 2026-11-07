// shared.ts — re-exports shared utilities from ../design/lib/.
// build does NOT require the full design workflow — it can build from
// any image source. The design lib is only needed for these path/name helpers.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const designLib = resolve(here, "..", "design", "lib");

if (!existsSync(designLib)) {
  throw new Error(
    `build requires the design skill's shared utilities at ${designLib}. ` +
    `Install both via the install.sh in design-build-skills. ` +
    `Note: you do not need to run the design workflow — only the shared library is needed.`
  );
}

export { toRequestName, requestPaths, ensureRequestDirs } from "../design/lib/storage.ts";
export { findDesignMd, readIfExists } from "../design/lib/prompt_prep.ts";

// App-root + new/extend resolver — the entry point for "where do I build, and is
// this a new app or an extension?". No cycle: resolve_target imports the design
// lib directly, not this module.
export { resolveTarget, findAppRoot } from "./scripts/resolve_target.ts";
export type {
  BuildIntent,
  BuildOperation,
  TargetResolution,
  ResolveTargetInputs,
} from "./scripts/resolve_target.ts";
