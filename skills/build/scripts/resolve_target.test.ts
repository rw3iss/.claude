import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTarget, findAppRoot } from "./resolve_target.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "resolve-target-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("findAppRoot", () => {
  it("finds the nearest ancestor with a package.json", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    const sub = join(dir, "src", "feature");
    mkdirSync(sub, { recursive: true });
    expect(findAppRoot(sub)).toBe(dir);
  });

  it("stops at a .git boundary and returns null when no package.json is found", () => {
    mkdirSync(join(dir, ".git"));
    const sub = join(dir, "work");
    mkdirSync(sub, { recursive: true });
    expect(findAppRoot(sub)).toBeNull();
  });
});

describe("resolveTarget — auto", () => {
  it("extends in place when an app is detected", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    const r = resolveTarget({ projectCwd: dir, intent: "auto" });
    expect(r.operation).toBe("extend");
    expect(r.appFound).toBe(true);
    expect(r.appRoot).toBe(dir);
  });

  it("scaffolds new at CWD when no app is detected", () => {
    mkdirSync(join(dir, ".git"));
    const r = resolveTarget({ projectCwd: dir, intent: "auto" });
    expect(r.operation).toBe("new");
    expect(r.appFound).toBe(false);
    expect(r.appRoot).toBe(dir);
  });
});

describe("resolveTarget — explicit intent overrides detection", () => {
  it("intent=new forces a new build even when an app exists", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    const r = resolveTarget({ projectCwd: dir, intent: "new" });
    expect(r.operation).toBe("new");
  });

  it("intent=extend forces extend even when no app is found", () => {
    mkdirSync(join(dir, ".git"));
    const r = resolveTarget({ projectCwd: dir, intent: "extend" });
    expect(r.operation).toBe("extend");
  });
});

describe("resolveTarget — design/build/index detection", () => {
  it("reports DESIGN.md, BUILD.md, and COMPONENT_INDEX.md when present at the app root", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(dir, "DESIGN.md"), "# design");
    writeFileSync(join(dir, "BUILD.md"), "# build");
    writeFileSync(join(dir, "COMPONENT_INDEX.md"), "# index");
    const r = resolveTarget({ projectCwd: dir, intent: "auto" });
    expect(r.designMdPath).toBe(join(dir, "DESIGN.md"));
    expect(r.buildMdPath).toBe(join(dir, "BUILD.md"));
    expect(r.componentIndexPath).toBe(join(dir, "COMPONENT_INDEX.md"));
  });

  it("returns null paths when the rule files are absent", () => {
    writeFileSync(join(dir, "package.json"), "{}");
    const r = resolveTarget({ projectCwd: dir, intent: "auto" });
    expect(r.designMdPath).toBeNull();
    expect(r.buildMdPath).toBeNull();
    expect(r.componentIndexPath).toBeNull();
  });
});
