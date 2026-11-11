/** What the layout check looks at: boxes of things drawn on screen, in pixels. */
export type BoxKind = "text" | "badge" | "button" | "board" | "sprite";
export type Box = { kind: BoxKind; name: string; x: number; y: number; width: number; height: number };

export type Clash = { a: Box; b: Box };

/** Pairs of kinds that must never overlap: text with anything, and badges or buttons with a shelf line. */
const FORBIDDEN: ReadonlySet<string> = new Set(["text|text", "badge|text", "button|text", "board|text", "badge|board", "board|button", "badge|badge", "sprite|text"]);

const key = (a: BoxKind, b: BoxKind) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Smaller overlaps than this many pixels in either direction are anti-aliasing, not a collision. */
export const TOLERANCE = 0.75;

const depth = (a: Box, b: Box) => ({
  x: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  y: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
});

/** Every pair of boxes that overlap although they must not. A box is never compared with itself. */
export function findClashes(boxes: readonly Box[]): Clash[] {
  const out: Clash[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]!;
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]!;
      // text/text is checked as "text|text"; the others by their sorted pair of kinds
      if (!FORBIDDEN.has(key(a.kind, b.kind))) continue;
      const d = depth(a, b);
      if (d.x > TOLERANCE && d.y > TOLERANCE) out.push({ a, b });
    }
  }
  return out;
}

export const describeClash = ({ a, b }: Clash): string =>
  `${a.kind} "${a.name}" overlaps ${b.kind} "${b.name}"`;
