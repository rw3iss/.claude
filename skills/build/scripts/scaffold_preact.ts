import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATE_ROOT = join(here, "..", "templates", "app-shell");

// Fallback scaffolder. New-app scaffolding normally delegates to the
// `scaffold-preact` skill; this reproduces its template output for when that
// skill isn't installed. The template tree mirrors scaffold-preact's, plus
// build's mandatory mock-data layer and the DESIGN/BUILD/COMPONENT_INDEX
// doc stubs.

// Files shipped un-prefixed in the template that must be dot/relocated on output
// (matches the scaffold-preact skill's rename step).
const RENAME: Record<string, string> = {
  "gitignore": ".gitignore",
  "editorconfig": ".editorconfig",
  "config/dockerignore": ".dockerignore", // Docker needs it at the build-context root
};

// Output paths that must never clobber an existing file (self-describing docs +
// ignore/editor files). Lets you re-scaffold over a dir that already has them.
const PRESERVE_IF_EXISTS = new Set([
  "DESIGN.md",
  "BUILD.md",
  "COMPONENT_INDEX.md",
  ".gitignore",
  ".editorconfig",
]);

export interface ScaffoldOptions {
  targetDir: string;
  appName: string;
  appTitle?: string; // default: Title-Cased appName
}

function titleCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const appTitle = opts.appTitle ?? titleCase(opts.appName);
  const files = walk(TEMPLATE_ROOT);
  for (const src of files) {
    const rel = relative(TEMPLATE_ROOT, src).split(sep).join("/");
    const destRel = RENAME[rel] ?? rel.replace(/\.tmpl$/, "");
    const dest = join(opts.targetDir, destRel);
    if (PRESERVE_IF_EXISTS.has(destRel) && existsSync(dest)) continue;
    mkdirSync(dirname(dest), { recursive: true });
    const content = readFileSync(src, "utf-8")
      .replace(/__APP_NAME__/g, opts.appName)
      .replace(/__APP_TITLE__/g, appTitle);
    writeFileSync(dest, content);
  }
}

const Args = z.object({
  targetDir: z.string().min(1),
  appName: z.string().min(1),
  appTitle: z.string().optional(),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));
  scaffold(args)
    .then(() => console.log(JSON.stringify({ status: "ok", targetDir: args.targetDir })))
    .catch((err) => {
      console.error(JSON.stringify({ status: "error", message: err?.message ?? String(err) }));
      process.exit(1);
    });
}
