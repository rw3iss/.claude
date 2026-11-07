import { existsSync, readdirSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { z } from "zod";

export interface SelectionOptions {
  preferUpscaled?: boolean;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

// Resolve by numeric indices from a designs/<request>/images/ dir (existing design-phase output).
export function resolveSelection(
  imagesDir: string,
  indices: number[],
  opts: SelectionOptions = {}
): string[] {
  return indices.map((i) => {
    const pad = i.toString().padStart(2, "0");
    const upscaled = join(imagesDir, `${pad}-up.png`);
    const base = join(imagesDir, `${pad}.png`);
    if (opts.preferUpscaled && existsSync(upscaled)) return upscaled;
    if (existsSync(base)) return base;
    if (existsSync(upscaled)) return upscaled;
    throw new Error(`no image for index ${i} in ${imagesDir}`);
  });
}

// Resolve all image files from a directory (sorted alphabetically).
export function resolveFromDir(dir: string): string[] {
  const abs = resolve(dir);
  if (!existsSync(abs)) throw new Error(`directory not found: ${abs}`);
  const entries = readdirSync(abs)
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
    .sort();
  if (entries.length === 0) throw new Error(`no images found in ${abs}`);
  return entries.map((f) => join(abs, f));
}

// Resolve an explicit list of file paths (validates each exists).
export function resolvePaths(paths: string[]): string[] {
  return paths.map((p) => {
    const abs = resolve(p);
    if (!existsSync(abs)) throw new Error(`image not found: ${abs}`);
    return abs;
  });
}

// Detect whether a path looks like a design-project root (has an images/ subdir with images).
export function isDesignProjectRoot(dir: string): boolean {
  try {
    return resolveFromDir(join(dir, "images")).length > 0;
  } catch {
    return false;
  }
}

// CLI entry — accepts one of three modes:
//   { "mode": "indices", "imagesDir": "...", "indices": [2,4], "preferUpscaled"?: true }
//   { "mode": "dir",     "dir": "/some/folder/of/images" }
//   { "mode": "paths",   "paths": ["/abs/img1.png", "/abs/img2.png"] }
// Returns: { "status": "ok", "imagePaths": [...] }
const Args = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("indices"),
    imagesDir: z.string().min(1),
    indices: z.array(z.number().int().positive()),
    preferUpscaled: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal("dir"),
    dir: z.string().min(1),
  }),
  z.object({
    mode: z.literal("paths"),
    paths: z.array(z.string().min(1)).min(1),
  }),
]);

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = Args.parse(JSON.parse(process.argv[2] ?? "{}"));
    let imagePaths: string[];
    if (args.mode === "indices") {
      imagePaths = resolveSelection(args.imagesDir, args.indices, {
        preferUpscaled: args.preferUpscaled,
      });
    } else if (args.mode === "dir") {
      imagePaths = resolveFromDir(args.dir);
    } else {
      imagePaths = resolvePaths(args.paths);
    }
    console.log(JSON.stringify({ status: "ok", imagePaths }));
  } catch (err: unknown) {
    console.error(
      JSON.stringify({ status: "error", message: (err as Error)?.message ?? String(err) })
    );
    process.exit(1);
  }
}
