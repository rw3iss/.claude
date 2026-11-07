import { describe, it, expect } from "vitest";
import { composePlan, type ComposeInputs } from "./build_plan.ts";

function base(overrides: Partial<ComposeInputs> = {}): ComposeInputs {
  return {
    request: "settings-page",
    operation: "extend",
    objective: "add a settings page with profile + notifications sections",
    designRules: null,
    buildRules: null,
    componentIndex: null,
    extraPrompt: null,
    imagePaths: [],
    imageFollowMode: "exact",
    ...overrides,
  };
}

describe("composePlan — always present", () => {
  it("includes the objective and a header naming the request", () => {
    const md = composePlan(base());
    expect(md).toContain("# Build brief for settings-page");
    expect(md).toContain("add a settings page");
  });

  it("always includes the feature analysis & reuse-match first step", () => {
    const md = composePlan(base());
    expect(md).toContain("Feature analysis & reuse — MANDATORY FIRST STEP");
    expect(md).toContain("High-level analysis");
    expect(md).toContain("Granular/technical analysis");
    expect(md).toContain("Reuse match");
    expect(md).toMatch(/reuse|adapt\/extend|new/);
  });

  it("always includes the DRY + modularity directive", () => {
    const md = composePlan(base());
    expect(md).toContain("DRY + modularity directive");
    expect(md).toContain("Reuse before creating");
    expect(md).toContain("No duplication");
  });

  it("always includes the index + docs maintenance step", () => {
    const md = composePlan(base());
    expect(md).toContain("COMPONENT_INDEX.md");
    expect(md).toContain("keep the index and docs current");
  });
});

describe("composePlan — images optional", () => {
  it("omits the reference-image section entirely when no images are given", () => {
    const md = composePlan(base({ imagePaths: [] }));
    expect(md).not.toContain("Reference images");
    expect(md).not.toContain("Reference-image follow mode");
  });

  it("includes the exact image protocol when images are given (exact)", () => {
    const md = composePlan(base({ imagePaths: ["/x/01.png"], imageFollowMode: "exact" }));
    expect(md).toContain("Reference-image follow mode: exact");
    expect(md).toContain("replicate (exact follow mode)");
    expect(md).toContain("/x/01.png");
    expect(md).not.toContain("inspiration (creative follow mode)");
  });

  it("includes the creative image protocol when images are given (creative)", () => {
    const md = composePlan(base({ imagePaths: ["/x/01.png"], imageFollowMode: "creative" }));
    expect(md).toContain("inspiration (creative follow mode)");
    expect(md).not.toContain("replicate (exact follow mode)");
  });
});

describe("composePlan — design language branches", () => {
  it("uses DESIGN.md as authoritative when present", () => {
    const md = composePlan(base({ designRules: "# DESIGN\n- one accent only" }));
    expect(md).toContain("from DESIGN.md (authoritative)");
    expect(md).toContain("one accent only");
  });

  it("tells a new app with no DESIGN.md to establish and write one", () => {
    const md = composePlan(base({ operation: "new", designRules: null }));
    expect(md).toContain("establish it (no DESIGN.md yet)");
    expect(md).toContain("write the decisions into");
  });

  it("tells an extend with no DESIGN.md to derive from existing code", () => {
    const md = composePlan(base({ operation: "extend", designRules: null }));
    expect(md).toContain("derive from existing code");
  });
});

describe("composePlan — rules + index inlining", () => {
  it("inlines BUILD.md when present and omits the section when absent", () => {
    expect(composePlan(base({ buildRules: "# BUILD\n- vite" }))).toContain("from BUILD.md (authoritative)");
    expect(composePlan(base({ buildRules: null }))).not.toContain("from BUILD.md");
  });

  it("inlines the component index when present", () => {
    const md = composePlan(base({ componentIndex: "## Components\n| Button | ... |" }));
    expect(md).toContain("Reuse manifest (COMPONENT_INDEX.md)");
    expect(md).toContain("| Button |");
  });

  it("guides index creation differently for new vs extend when absent", () => {
    expect(composePlan(base({ operation: "new", componentIndex: null }))).toContain("this is a new app");
    expect(composePlan(base({ operation: "extend", componentIndex: null }))).toContain("Scan the existing");
  });
});

describe("composePlan — operation label", () => {
  it("labels a new-app build", () => {
    expect(composePlan(base({ operation: "new" }))).toContain("Operation: new app");
  });
  it("labels an extend build", () => {
    expect(composePlan(base({ operation: "extend" }))).toContain("Operation: extend existing app");
  });
});
