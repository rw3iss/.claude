#!/usr/bin/env -S node --import tsx
import { requestPaths } from "../lib/storage.ts";
import { splitGrid } from "./split_grid.ts";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { z } from "zod";

const Args = z.object({
  request: z.string().min(1),
  projectCwd: z.string().min(1),
});

async function main() {
  const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));
  const paths = requestPaths(args.projectCwd, args.request);
  const entries = readdirSync(paths.raw)
    .filter((f) => f.endsWith(".png"))
    .map((f) => join(paths.raw, f))
    .filter((p) => statSync(p).isFile());

  const splits: string[] = [];
  for (const p of entries) {
    const meta = await sharp(p).metadata();
    if (!meta.width || !meta.height) continue;
    try {
      const files = await splitGrid(p, paths.images);
      splits.push(...files);
    } catch {
      // not a splittable grid (e.g. already an upscale); skip
    }
  }

  console.log(JSON.stringify({ status: "ok", processed: entries, images: splits }));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err?.message ?? String(err) }));
  process.exit(1);
});
