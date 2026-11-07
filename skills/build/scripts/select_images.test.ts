import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveSelection,
  resolveFromDir,
  resolvePaths,
  isDesignProjectRoot,
} from "./select_images.ts";

function withFakeImages<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "sel-"));
  ["01.png", "02.png", "03.png", "04.png", "02-up.png"].forEach((n) =>
    writeFileSync(join(dir, n), "")
  );
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("resolveSelection", () => {
  it("resolves numeric indices to 0N.png", () => {
    withFakeImages((dir) => {
      const out = resolveSelection(dir, [2, 4]);
      expect(out.map((p) => p.replace(dir + "/", ""))).toEqual(["02.png", "04.png"]);
    });
  });

  it("prefers -up.png when present and prefer flag set", () => {
    withFakeImages((dir) => {
      const out = resolveSelection(dir, [2], { preferUpscaled: true });
      expect(out.map((p) => p.replace(dir + "/", ""))).toEqual(["02-up.png"]);
    });
  });

  it("falls back to 0N.png if upscale missing", () => {
    withFakeImages((dir) => {
      const out = resolveSelection(dir, [3], { preferUpscaled: true });
      expect(out.map((p) => p.replace(dir + "/", ""))).toEqual(["03.png"]);
    });
  });

  it("throws on unknown index", () => {
    withFakeImages((dir) => {
      expect(() => resolveSelection(dir, [9])).toThrow(/no image for index 9/);
    });
  });
});

describe("resolveFromDir", () => {
  it("returns all image files sorted", () => {
    const dir = mkdtempSync(join(tmpdir(), "dir-"));
    try {
      writeFileSync(join(dir, "c.jpg"), "");
      writeFileSync(join(dir, "a.png"), "");
      writeFileSync(join(dir, "b.webp"), "");
      writeFileSync(join(dir, "notes.txt"), "");
      const out = resolveFromDir(dir).map((p) => p.replace(dir + "/", ""));
      expect(out).toEqual(["a.png", "b.webp", "c.jpg"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when no images found", () => {
    const dir = mkdtempSync(join(tmpdir(), "empty-"));
    try {
      expect(() => resolveFromDir(dir)).toThrow(/no images found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when directory does not exist", () => {
    expect(() => resolveFromDir("/nonexistent/path/xyz")).toThrow(/directory not found/);
  });
});

describe("resolvePaths", () => {
  it("returns a single resolved absolute path", () => {
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    try {
      const f1 = join(dir, "img1.png");
      writeFileSync(f1, "");
      const out = resolvePaths([f1]);
      expect(out).toEqual([f1]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns multiple resolved absolute paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "paths-"));
    try {
      const f1 = join(dir, "img1.png");
      const f2 = join(dir, "img2.jpg");
      writeFileSync(f1, "");
      writeFileSync(f2, "");
      const out = resolvePaths([f1, f2]);
      expect(out).toEqual([f1, f2]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws when a path does not exist", () => {
    expect(() => resolvePaths(["/nonexistent/img.png"])).toThrow(/image not found/);
  });
});

describe("isDesignProjectRoot", () => {
  it("returns true when images/ subdir has images", () => {
    const dir = mkdtempSync(join(tmpdir(), "proj-"));
    try {
      const imagesDir = join(dir, "images");
      mkdirSync(imagesDir);
      writeFileSync(join(imagesDir, "01.png"), "");
      expect(isDesignProjectRoot(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns false when images/ subdir is empty", () => {
    const dir = mkdtempSync(join(tmpdir(), "proj-"));
    try {
      mkdirSync(join(dir, "images"));
      expect(isDesignProjectRoot(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns false when no images/ subdir", () => {
    const dir = mkdtempSync(join(tmpdir(), "proj-"));
    try {
      expect(isDesignProjectRoot(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
