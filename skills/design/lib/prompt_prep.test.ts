import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findDesignMd, assemblePrompt } from "./prompt_prep.ts";

function withTmpTree<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "prompt-"));
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

describe("findDesignMd", () => {
  it("finds DESIGN.md in the current directory", () => {
    withTmpTree((root) => {
      writeFileSync(join(root, "DESIGN.md"), "# rules");
      expect(findDesignMd(root)).toBe(join(root, "DESIGN.md"));
    });
  });

  it("walks up to find DESIGN.md in a parent", () => {
    withTmpTree((root) => {
      mkdirSync(join(root, ".git"), { recursive: true });
      writeFileSync(join(root, "DESIGN.md"), "# rules");
      const nested = join(root, "packages", "x");
      mkdirSync(nested, { recursive: true });
      expect(findDesignMd(nested)).toBe(join(root, "DESIGN.md"));
    });
  });

  it("stops at a .git boundary", () => {
    withTmpTree((root) => {
      writeFileSync(join(root, "DESIGN.md"), "# outer");
      const inner = join(root, "sub");
      mkdirSync(join(inner, ".git"), { recursive: true });
      writeFileSync(join(inner, "other.txt"), "");
      expect(findDesignMd(inner)).toBeNull();
    });
  });

  it("returns null when nothing found", () => {
    withTmpTree((root) => {
      expect(findDesignMd(root)).toBeNull();
    });
  });
});

describe("assemblePrompt", () => {
  it("appends MJ flags and preserves original brief", () => {
    const result = assemblePrompt({
      brief: "a glassy login form with hero gradient",
      designRules: null,
      aspectRatio: "3:2",
      version: "6.1",
      style: "raw",
    });
    expect(result.promptMd).toContain("a glassy login form");
    expect(result.imaginePrompt).toContain("--ar 3:2");
    expect(result.imaginePrompt).toContain("--v 6.1");
    expect(result.imaginePrompt).toContain("--style raw");
  });

  it("includes DESIGN.md rules when provided", () => {
    const result = assemblePrompt({
      brief: "a login form",
      designRules: "# Project rules\nUse violet accents only.",
      aspectRatio: "3:2",
      version: "6.1",
      style: "raw",
    });
    expect(result.promptMd).toContain("violet accents");
  });

  it("defaults to web-ui kind: adds UI framing + --no exclusions", () => {
    const result = assemblePrompt({
      brief: "a glassy login form",
      designRules: null,
      aspectRatio: "16:9",
      version: "6.1",
      style: "raw",
    });
    expect(result.imaginePrompt).toContain("Dribbble UI style");
    expect(result.imaginePrompt).toContain("full viewport edge-to-edge");
    // --no list is device-frame only (anti-3d/isometric removed to avoid over-constraining MJ)
    expect(result.imaginePrompt).toContain("--no ");
    expect(result.imaginePrompt).toMatch(/device mockup|device frame|laptop/);
  });

  it("kind='raw' skips the UI framing and --no block", () => {
    const result = assemblePrompt({
      brief: "a sunset",
      designRules: null,
      aspectRatio: "3:2",
      version: "6.1",
      style: "raw",
      kind: "raw",
    });
    expect(result.imaginePrompt).not.toContain("Figma");
    expect(result.imaginePrompt).not.toContain("--no ");
  });

  it("accepts custom excludes list", () => {
    const result = assemblePrompt({
      brief: "a dashboard",
      designRules: null,
      aspectRatio: "16:9",
      version: "6.1",
      style: "raw",
      excludes: ["cartoon", "watermark"],
    });
    expect(result.imaginePrompt).toContain("--no cartoon, watermark");
    expect(result.imaginePrompt).not.toContain("isometric");
  });
});
