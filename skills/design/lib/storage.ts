import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export function toRequestName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 60);
}

export interface RequestPaths {
  root: string;
  prompts: string;
  raw: string;
  images: string;
  app: string;
}

export function requestPaths(projectCwd: string, name: string): RequestPaths {
  const root = join(resolve(projectCwd), "designs", name);
  return {
    root,
    prompts: join(root, "prompts"),
    raw: join(root, "raw"),
    images: join(root, "images"),
    app: join(root, "app"),
  };
}

export function ensureRequestDirs(paths: RequestPaths): void {
  for (const p of [paths.root, paths.prompts, paths.raw, paths.images]) {
    mkdirSync(p, { recursive: true });
  }
}
