import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { splitGrid } from "./split_grid.ts";

describe("splitGrid", () => {
  it("splits a 512×512 grid into four 256×256 quadrants", async () => {
    const out = mkdtempSync(join(tmpdir(), "split-"));
    try {
      const files = await splitGrid("scripts/fixtures/grid-512.png", out);
      expect(files).toHaveLength(4);
      const names = readdirSync(out).sort();
      expect(names).toEqual(["01.png", "02.png", "03.png", "04.png"]);
      const meta = await sharp(join(out, "01.png")).metadata();
      expect(meta.width).toBe(256);
      expect(meta.height).toBe(256);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("splits rectangular (non-square) grids like --ar 3:2", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "split-rect-"));
    const rect = join(tmp, "rect.png");
    // 600x400 = 2x2 grid of 300x200 quadrants (3:2 aspect per quadrant)
    await sharp({ create: { width: 600, height: 400, channels: 3, background: "#fff" }})
      .png().toFile(rect);
    const outDir = join(tmp, "out");
    try {
      const files = await splitGrid(rect, outDir);
      expect(files).toHaveLength(4);
      const meta = await sharp(join(outDir, "02.png")).metadata();
      expect(meta.width).toBe(300);
      expect(meta.height).toBe(200);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects images smaller than 2x2", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "split-tiny-"));
    const tiny = join(tmp, "tiny.png");
    await sharp({ create: { width: 1, height: 1, channels: 3, background: "#000" }})
      .png().toFile(tiny);
    try {
      await expect(splitGrid(tiny, tmp)).rejects.toThrow(/too small/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
