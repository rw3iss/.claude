import { describe, it, expect } from "vitest";
import { toRequestName, requestPaths } from "./storage.ts";

describe("toRequestName", () => {
  it("kebab-cases input", () => {
    expect(toRequestName("Login Form Glass")).toBe("login-form-glass");
  });
  it("strips punctuation and collapses whitespace", () => {
    expect(toRequestName("  Check-Out!!  (v2)  ")).toBe("check-out-v2");
  });
  it("truncates to 60 chars", () => {
    expect(toRequestName("a ".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe("requestPaths", () => {
  it("produces the flat designs/<name>/ layout", () => {
    const p = requestPaths("/tmp/proj", "login-form");
    expect(p.root).toBe("/tmp/proj/designs/login-form");
    expect(p.prompts).toBe("/tmp/proj/designs/login-form/prompts");
    expect(p.raw).toBe("/tmp/proj/designs/login-form/raw");
    expect(p.images).toBe("/tmp/proj/designs/login-form/images");
    expect(p.app).toBe("/tmp/proj/designs/login-form/app");
  });
});
