import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapDocs } from "./bootstrap_docs.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bootstrap-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("bootstrapDocs", () => {
  it("writes only the requested docs, with appName substituted", () => {
    const r = bootstrapDocs({ projectDir: dir, docs: ["build"], appName: "wristleo" });
    expect(r.written).toEqual([join(dir, "BUILD.md")]);
    expect(existsSync(join(dir, "DESIGN.md"))).toBe(false);
    expect(existsSync(join(dir, "COMPONENT_INDEX.md"))).toBe(false);
    expect(readFileSync(join(dir, "BUILD.md"), "utf-8")).toContain("wristleo");
  });

  it("generates all three when asked", () => {
    const r = bootstrapDocs({ projectDir: dir, docs: ["design", "build", "index"] });
    expect(r.written.map((p) => p.split("/").pop()).sort()).toEqual([
      "BUILD.md",
      "COMPONENT_INDEX.md",
      "DESIGN.md",
    ]);
  });

  it("never clobbers an existing doc unless overwrite is set", () => {
    writeFileSync(join(dir, "BUILD.md"), "MINE");
    const r = bootstrapDocs({ projectDir: dir, docs: ["build"] });
    expect(r.written).toEqual([]);
    expect(r.skipped).toEqual([join(dir, "BUILD.md")]);
    expect(readFileSync(join(dir, "BUILD.md"), "utf-8")).toBe("MINE");
  });

  it("overwrites when overwrite=true", () => {
    writeFileSync(join(dir, "BUILD.md"), "MINE");
    const r = bootstrapDocs({ projectDir: dir, docs: ["build"], overwrite: true });
    expect(r.written).toEqual([join(dir, "BUILD.md")]);
    expect(readFileSync(join(dir, "BUILD.md"), "utf-8")).not.toBe("MINE");
  });

  it("defaults appName to the kebab-cased project dir name", () => {
    const r = bootstrapDocs({ projectDir: dir, docs: ["build"] });
    // tmp dir basename like "bootstrap-XXXXXX" → kebab-safe
    expect(r.appName).toMatch(/^bootstrap-/);
  });
});
