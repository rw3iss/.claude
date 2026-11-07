import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { toRequestName } from "../shared.ts";

// Bootstrap an *existing* project with the build doc files only — no app
// scaffold, no code. This is the "give my project a DESIGN.md / BUILD.md /
// COMPONENT_INDEX.md from the template" entrypoint, so build (or the user)
// can establish the rule files standalone, then tailor them.

const here = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATE_DIR = join(here, "..", "templates", "app-shell");

export type DocKind = "design" | "build" | "index";

const TEMPLATE_FILE: Record<DocKind, string> = {
  design: "DESIGN.md.tmpl",
  build: "BUILD.md.tmpl",
  index: "COMPONENT_INDEX.md.tmpl",
};
const OUTPUT_FILE: Record<DocKind, string> = {
  design: "DESIGN.md",
  build: "BUILD.md",
  index: "COMPONENT_INDEX.md",
};

export interface BootstrapInputs {
  projectDir: string;
  docs: DocKind[];        // which docs to generate
  appName?: string;       // default: kebab-cased basename of projectDir
  overwrite?: boolean;    // default false — never clobber an existing doc
}

export interface BootstrapResult {
  projectDir: string;
  appName: string;
  written: string[];      // output paths created/overwritten
  skipped: string[];      // output paths left alone (existed, no overwrite)
}

export function bootstrapDocs(inputs: BootstrapInputs): BootstrapResult {
  const projectDir = resolve(inputs.projectDir);
  const appName = inputs.appName?.trim() || toRequestName(basename(projectDir));
  const overwrite = inputs.overwrite ?? false;

  if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });

  const written: string[] = [];
  const skipped: string[] = [];

  for (const doc of inputs.docs) {
    const dest = join(projectDir, OUTPUT_FILE[doc]);
    if (existsSync(dest) && !overwrite) {
      skipped.push(dest);
      continue;
    }
    const tmpl = readFileSync(join(TEMPLATE_DIR, TEMPLATE_FILE[doc]), "utf-8");
    writeFileSync(dest, tmpl.replace(/__APP_NAME__/g, appName));
    written.push(dest);
  }

  return { projectDir, appName, written, skipped };
}

// CLI:
//   { "projectDir": "/path", "docs": ["build"], "appName"?: "...", "overwrite"?: false }
//   docs: "all" expands to ["design","build","index"]
const DocsArg = z
  .union([z.literal("all"), z.array(z.enum(["design", "build", "index"])).min(1)])
  .transform((v) => (v === "all" ? (["design", "build", "index"] as DocKind[]) : v));

const Args = z.object({
  projectDir: z.string().min(1),
  docs: DocsArg,
  appName: z.string().optional(),
  overwrite: z.boolean().optional(),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));
    const result = bootstrapDocs(args);
    console.log(JSON.stringify({ status: "ok", ...result }));
  } catch (err: unknown) {
    console.error(
      JSON.stringify({ status: "error", message: (err as Error)?.message ?? String(err) })
    );
    process.exit(1);
  }
}
