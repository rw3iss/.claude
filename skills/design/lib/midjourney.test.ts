import { describe, it, expect } from "vitest";
import { parseButtonLabel, extractUButtons, isGridMessage } from "./midjourney.ts";

describe("parseButtonLabel", () => {
  it("parses U1/U2/U3/U4", () => {
    expect(parseButtonLabel("U1")).toEqual({ kind: "upscale", index: 1 });
    expect(parseButtonLabel("U4")).toEqual({ kind: "upscale", index: 4 });
  });
  it("parses V1..V4", () => {
    expect(parseButtonLabel("V2")).toEqual({ kind: "variation", index: 2 });
  });
  it("parses redo", () => {
    expect(parseButtonLabel("🔄")).toEqual({ kind: "redo", index: 0 });
  });
  it("returns null for unknown labels", () => {
    expect(parseButtonLabel("wut")).toBeNull();
  });
});

describe("isGridMessage", () => {
  const makeRow = (labels: string[]) => ({
    type: 1,
    components: labels.map((label, i) => ({
      type: 2,
      label,
      custom_id: `MJ::JOB::${label}::${i}::abc`,
    })),
  });

  it("returns true when all four U1–U4 buttons are present", () => {
    const components = [
      makeRow(["U1", "U2", "U3", "U4"]),
      makeRow(["V1", "V2", "V3", "V4"]),
      makeRow(["🔄"]),
    ];
    expect(isGridMessage(components)).toBe(true);
  });

  it("returns false when only some U-buttons are present", () => {
    const components = [makeRow(["U1", "U2"])];
    expect(isGridMessage(components)).toBe(false);
  });

  it("returns false for an upscale reply (different button labels)", () => {
    const components = [
      makeRow(["Upscale (Subtle)", "Upscale (Creative)"]),
      makeRow(["Make Variations", "Redo Upscale"]),
    ];
    expect(isGridMessage(components)).toBe(false);
  });

  it("returns false when components is empty", () => {
    expect(isGridMessage([])).toBe(false);
  });
});

describe("extractUButtons", () => {
  it("flattens action-row components into { index -> custom_id } for U1..U4", () => {
    const components = [
      {
        type: 1,
        components: [
          { type: 2, label: "U1", custom_id: "MJ::JOB::upsample::1::abc" },
          { type: 2, label: "U2", custom_id: "MJ::JOB::upsample::2::abc" },
          { type: 2, label: "U3", custom_id: "MJ::JOB::upsample::3::abc" },
          { type: 2, label: "U4", custom_id: "MJ::JOB::upsample::4::abc" },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, label: "🔄", custom_id: "MJ::JOB::reroll::0::abc" },
        ],
      },
    ];
    expect(extractUButtons(components)).toEqual({
      1: "MJ::JOB::upsample::1::abc",
      2: "MJ::JOB::upsample::2::abc",
      3: "MJ::JOB::upsample::3::abc",
      4: "MJ::JOB::upsample::4::abc",
    });
  });
});
