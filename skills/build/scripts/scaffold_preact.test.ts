import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffold } from "./scaffold_preact.ts";

describe("scaffold", () => {
  it("writes the scaffold-preact base file tree into target dir", async () => {
    const out = mkdtempSync(join(tmpdir(), "scaf-"));
    try {
      await scaffold({ targetDir: out, appName: "my-demo" });
      // configs live under config/
      expect(existsSync(join(out, "package.json"))).toBe(true);
      expect(existsSync(join(out, "config/vite.config.ts"))).toBe(true);
      expect(existsSync(join(out, "config/tsconfig.app.json"))).toBe(true);
      // entry + styles + scaffold-preact utilities
      expect(existsSync(join(out, "src/main.tsx"))).toBe(true);
      expect(existsSync(join(out, "styles/global.scss"))).toBe(true);
      expect(existsSync(join(out, "styles/_variables.scss"))).toBe(true);
      expect(existsSync(join(out, "src/lib/storage.ts"))).toBe(true);
      expect(existsSync(join(out, "src/hooks/useUIState.ts"))).toBe(true);

      const pkg = JSON.parse(readFileSync(join(out, "package.json"), "utf-8"));
      expect(pkg.name).toBe("my-demo");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("carries the mandatory mock-data layer", async () => {
    const out = mkdtempSync(join(tmpdir(), "scaf-"));
    try {
      await scaffold({ targetDir: out, appName: "my-demo" });
      expect(existsSync(join(out, "src/services/api/ApiClient.ts"))).toBe(true);
      expect(existsSync(join(out, "src/services/api/index.ts"))).toBe(true);
      expect(existsSync(join(out, "src/mock/MockApiAdapter.ts"))).toBe(true);
      expect(existsSync(join(out, "src/mock/data/.gitkeep"))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("renames gitignore/editorconfig/dockerignore and seeds the root docs", async () => {
    const out = mkdtempSync(join(tmpdir(), "scaf-"));
    try {
      await scaffold({ targetDir: out, appName: "my-demo" });
      expect(existsSync(join(out, ".gitignore"))).toBe(true);
      expect(existsSync(join(out, ".editorconfig"))).toBe(true);
      expect(existsSync(join(out, ".dockerignore"))).toBe(true);
      expect(existsSync(join(out, "gitignore"))).toBe(false); // un-prefixed source not left behind
      expect(existsSync(join(out, "DESIGN.md"))).toBe(true);
      expect(existsSync(join(out, "BUILD.md"))).toBe(true);
      expect(existsSync(join(out, "COMPONENT_INDEX.md"))).toBe(true);
      // Dockerfile stays in config/
      expect(existsSync(join(out, "config/Dockerfile"))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("substitutes __APP_NAME__ and __APP_TITLE__ everywhere (no leftovers)", async () => {
    const out = mkdtempSync(join(tmpdir(), "scaf-"));
    try {
      await scaffold({ targetDir: out, appName: "checkout-glass" });
      const app = readFileSync(join(out, "src/app/App.tsx"), "utf-8");
      expect(app).toContain("Checkout Glass"); // __APP_TITLE__ → Title Case
      expect(readFileSync(join(out, "DESIGN.md"), "utf-8")).toContain("checkout-glass");
      // no unsubstituted placeholders, no leftover .tmpl files
      for (const f of ["src/app/App.tsx", "README.md", "package.json", "index.html"]) {
        const c = readFileSync(join(out, f), "utf-8");
        expect(c).not.toContain("__APP_NAME__");
        expect(c).not.toContain("__APP_TITLE__");
      }
      expect(existsSync(join(out, "config/vite.config.ts.tmpl"))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("does not clobber existing DESIGN.md / BUILD.md / COMPONENT_INDEX.md", async () => {
    const out = mkdtempSync(join(tmpdir(), "scaf-"));
    try {
      writeFileSync(join(out, "DESIGN.md"), "MY OWN DESIGN");
      await scaffold({ targetDir: out, appName: "my-demo" });
      expect(readFileSync(join(out, "DESIGN.md"), "utf-8")).toBe("MY OWN DESIGN");
      expect(existsSync(join(out, "BUILD.md"))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
