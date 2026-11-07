#!/usr/bin/env -S node --import tsx
import { findDesignMd, assemblePrompt, readIfExists, type PromptKind } from "../lib/prompt_prep.ts";
import { requestPaths, ensureRequestDirs, toRequestName } from "../lib/storage.ts";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const Args = z.object({
  brief: z.string().min(1),
  projectCwd: z.string().min(1),
  requestName: z.string().optional(),
  designMd: z.string().nullable().optional(),
  // Default 16:9 for UI mockups (closer to standard desktop viewport than 3:2).
  aspectRatio: z.string().default("16:9"),
  version: z.string().default("6.1"),
  // No --style flag by default for web-ui: MJ's default aesthetic renders
  // UI mockups better than --style raw (which strips helpful enhancement).
  style: z.string().default(""),
  kind: z.enum(["web-ui", "raw"]).default("web-ui"),
  excludes: z.array(z.string()).optional(),
});

async function main() {
  const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));
  const name = args.requestName ?? toRequestName(args.brief);
  const paths = requestPaths(args.projectCwd, name);
  ensureRequestDirs(paths);

  writeFileSync(join(paths.prompts, "original.md"), args.brief);

  const designMdPath = args.designMd ?? findDesignMd(args.projectCwd);
  const rules = readIfExists(designMdPath);
  const { promptMd, imaginePrompt } = assemblePrompt({
    brief: args.brief,
    designRules: rules,
    aspectRatio: args.aspectRatio,
    version: args.version,
    style: args.style,
    kind: args.kind as PromptKind,
    excludes: args.excludes,
  });
  writeFileSync(join(paths.prompts, "prompt_design.md"), promptMd);
  // Clean up legacy filename from earlier skill versions, if present.
  const legacy = join(paths.prompts, "prompt.md");
  if (existsSync(legacy)) unlinkSync(legacy);

  console.log(
    JSON.stringify({
      status: "ok",
      request: name,
      paths,
      imaginePrompt,
      designMdFound: Boolean(designMdPath),
      kind: args.kind,
    })
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err?.message ?? String(err) }));
  process.exit(1);
});
