export type ButtonKind = "upscale" | "variation" | "redo";

export interface ParsedButton {
  kind: ButtonKind;
  index: number;
}

export function parseButtonLabel(label: string): ParsedButton | null {
  const m = label.match(/^([UV])([1-4])$/);
  if (m) {
    return {
      kind: m[1] === "U" ? "upscale" : "variation",
      index: Number(m[2]),
    };
  }
  if (label === "🔄" || label === "Redo" || label === "redo") {
    return { kind: "redo", index: 0 };
  }
  return null;
}

interface ActionRow { type: 1; components: ButtonComponent[]; }
interface ButtonComponent { type: 2; label?: string; custom_id?: string; }
type MessageComponents = Array<ActionRow | unknown>;

export function extractUButtons(components: MessageComponents): Record<1|2|3|4, string> {
  const out: Partial<Record<1|2|3|4, string>> = {};
  for (const row of components) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as ActionRow;
    if (r.type !== 1 || !Array.isArray(r.components)) continue;
    for (const c of r.components) {
      if (c.type !== 2 || !c.label || !c.custom_id) continue;
      const parsed = parseButtonLabel(c.label);
      if (parsed?.kind === "upscale" && parsed.index >= 1 && parsed.index <= 4) {
        out[parsed.index as 1|2|3|4] = c.custom_id;
      }
    }
  }
  return out as Record<1|2|3|4, string>;
}

/**
 * Returns true only for a 2×2 grid reply — i.e. the message has all four
 * U1–U4 upscale buttons. Upscale replies have a different button set
 * ("Upscale (Subtle)", "Upscale (Creative)", etc.) and will return false.
 */
export function isGridMessage(components: MessageComponents): boolean {
  const uButtons = extractUButtons(components);
  return (
    Object.keys(uButtons).length === 4 &&
    [1, 2, 3, 4].every((i) => Boolean(uButtons[i as 1 | 2 | 3 | 4]))
  );
}

export const MIDJOURNEY_IMAGINE_COMMAND_NAME = "imagine";
