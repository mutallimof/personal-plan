import { formatAmount } from "@/features/pantry/amounts";
import { expiryState } from "@/features/pantry/items";
import { isUnit, type PantryItem } from "@/features/pantry/model";
import type { Compartment, CompartmentKind, Hotspot, Rect } from "./layout";

/** Frame around the inside of a cabinet, in room units. */
export const FRAME = 1.2;
/** Thickness of a shelf board. */
export const BOARD = 1.1;

/** One place inside a cabinet where products stand: a shelf board, a drawer, a door rack or a fridge shelf. */
export type Row = {
  id: string;
  kind: CompartmentKind;
  /** Text drawn on it; none for plain shelves. */
  label: string | null;
  /** The pantry place it stands for, by name. */
  place: string | null;
  /** Number of the shelf (0 = top) for plain cabinets; compartments have none. */
  shelf: number | null;
  /** The compartment it came from, if any. */
  compartment: Compartment | null;
  rect: Rect;
};

export const LOOSE_ID = "loose";

const WEIGHT: Record<CompartmentKind, number> = { shelf: 1, drawer: 1, door: 1 };
const LOOSE_WEIGHT = 1;
const GAP = 0.8;

/** The inside of a cabinet: the area between its frame. */
export const cavity = (h: Rect): Rect => ({
  x: h.x + FRAME,
  y: h.y + FRAME,
  width: h.width - 2 * FRAME,
  height: h.height - 2 * FRAME,
});

/**
 * The rows of a cabinet from top to bottom. A plain cabinet has `shelves` equal rows that all belong to its
 * place. A cabinet with compartments has one row per compartment, plus a last row for things kept directly in
 * its own place.
 */
export function interiorRows(h: Hotspot): Row[] {
  const inner = cavity(h);
  const stack = (parts: { weight: number; make: (rect: Rect) => Row }[]): Row[] => {
    const total = parts.reduce((n, p) => n + p.weight, 0);
    let y = inner.y;
    return parts.map((p) => {
      const height = (p.weight / total) * inner.height;
      const row = p.make({ x: inner.x, y: y + GAP / 2, width: inner.width, height: height - GAP });
      y += height;
      return row;
    });
  };

  if (!h.compartments.length) {
    return stack(
      Array.from({ length: h.shelves }, (_, i) => ({
        weight: 1,
        make: (rect: Rect): Row => ({
          id: `shelf-${i}`,
          kind: "shelf",
          label: null,
          place: h.location,
          shelf: i,
          compartment: null,
          rect,
        }),
      })),
    );
  }
  const parts = h.compartments.map((c) => ({
    weight: WEIGHT[c.kind],
    make: (rect: Rect): Row => ({
      id: c.key,
      kind: c.kind,
      label: c.name,
      place: c.location,
      shelf: null,
      compartment: c,
      rect,
    }),
  }));
  if (h.location) {
    parts.push({
      weight: LOOSE_WEIGHT,
      make: (rect: Rect): Row => ({
        id: LOOSE_ID,
        kind: "shelf",
        label: "Other",
        place: h.location,
        shelf: null,
        compartment: null,
        rect,
      }),
    });
  }
  return stack(parts);
}

/** The row under a point, if any. The gaps between rows count for the row above. */
export function rowAt(rows: readonly Row[], x: number, y: number): Row | null {
  for (const r of rows) {
    const bottom = r.rect.y + r.rect.height + GAP / 2;
    if (x >= r.rect.x && x <= r.rect.x + r.rect.width && y >= r.rect.y - GAP / 2 && y <= bottom)
      return r;
  }
  return null;
}

/**
 * Which shelf each item of a plain cabinet stands on. An item with a saved shelf keeps it (when the cabinet
 * still has that many); the others fill the shelves from the top, `perShelf` at a time.
 */
export function assignShelves(
  items: readonly Pick<PantryItem, "id" | "name" | "shelf">[],
  shelves: number,
  perShelf: number,
): Map<string, number> {
  const out = new Map<string, number>();
  const load = Array.from({ length: shelves }, () => 0);
  const free: (typeof items)[number][] = [];
  for (const i of items) {
    if (i.shelf != null && i.shelf >= 0 && i.shelf < shelves) {
      out.set(i.id, i.shelf);
      load[i.shelf] = (load[i.shelf] ?? 0) + 1;
    } else free.push(i);
  }
  for (const i of [...free].sort((a, b) => a.name.localeCompare(b.name))) {
    let shelf = load.findIndex((n) => n < perShelf);
    if (shelf < 0) shelf = load.indexOf(Math.min(...load));
    out.set(i.id, shelf);
    load[shelf] = (load[shelf] ?? 0) + 1;
  }
  return out;
}

// ---------- products on a row ----------

export type Sprite = { item: PantryItem; x: number; y: number; size: number; stack: number };

/** Space between the edge of a row and what is drawn in it. */
export const PAD = 1;
/** Space between the top of the product area and the tallest product. */
const TOP_GAP = 0.6;
/** Pictures never get smaller than this, and never taller than the room between the top of the row and the board. */
const TINY_SPRITE = 0.8;
const MAX_SPRITE = 7.5;

export type RowParts = {
  /** Column on the right of the row that holds its name; none for plain shelves. */
  side: Rect | null;
  /** The part of the row left of the name: products stand on its bottom board. */
  stand: Rect;
  /** Font size of the name (0 when there is none). */
  labelSize: number;
  /** The name, broken into lines that fit the column. */
  lines: string[];
};

/** One label size for every row of a cabinet, so the labels look alike: it follows the shortest row, within limits. */
export function labelSizeFor(rows: readonly Pick<Row, "rect">[]): number {
  const shortest = rows.length ? Math.min(...rows.map((r) => r.rect.height)) : 10;
  return Math.min(1.5, Math.max(1.2, shortest * 0.18));
}

/** Width of a letter as a share of the font size: generous, so a name never runs out of its column. */
const CHAR = 0.62;
/** Line height as a share of the font size. */
export const LINE = 1.2;
const MAX_LINES = 3;
const MIN_LABEL = 0.9;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Breaks a name into at most `MAX_LINES` lines of at most `chars` letters, at spaces. */
export function wrapLabel(text: string, chars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (cur && (cur + " " + word).length > chars) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? cur + " " + word : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Splits a row into a column on the right for its name and the area where products stand. The name never
 * shares space with the products, their quantity chips or the board, so nothing drawn in one part can touch
 * another. The name shrinks (and wraps) until it fits its column.
 */
export function rowParts(row: Rect, labelSize: number, text = ""): RowParts {
  if (labelSize <= 0) return { side: null, stand: row, labelSize: 0, lines: [] };
  const width = clamp(row.width * 0.34, 7.5, 12);
  const side: Rect = { x: row.x + row.width - width, y: row.y, width, height: row.height - BOARD };
  const stand: Rect = { x: row.x, y: row.y, width: row.width - width, height: row.height };
  const room = width - 2 * PAD;
  let size = labelSize;
  let lines = wrapLabel(text, Math.max(1, Math.floor(room / (size * CHAR))));
  // shrink until the longest line fits the width and all lines fit the height
  while (
    size > MIN_LABEL &&
    (lines.length > MAX_LINES ||
      Math.max(0, ...lines.map((l) => l.length)) * size * CHAR > room ||
      lines.length * size * LINE > side.height - 0.4)
  ) {
    size = Math.max(MIN_LABEL, size - 0.05);
    lines = wrapLabel(text, Math.max(1, Math.floor(room / (size * CHAR))));
  }
  return { side, stand, labelSize: size, lines };
}

/** Height of a product picture on the standing area of a row, in room units: it always fits above the board. */
export const spriteSize = (stand: Rect) =>
  Math.min(MAX_SPRITE, stand.width * 0.28, Math.max(TINY_SPRITE, stand.height - BOARD - TOP_GAP));

/** How many copies are drawn for a quantity: 3 yogurts show as a small stack of 3. */
export function stackCount(item: Pick<PantryItem, "quantity" | "unit">): number {
  const countable = item.unit === "pieces" || item.unit === "pack";
  return countable ? Math.max(1, Math.min(3, Math.floor(item.quantity))) : 1;
}

/** Short quantity for the badge: "3", "500 g", "1.5 kg". */
export function badgeText(item: Pick<PantryItem, "quantity" | "unit">): string {
  if (!isUnit(item.unit) || item.unit === "pieces") return String(Math.round(item.quantity * 100) / 100);
  if (item.unit === "pack") return `${Math.round(item.quantity * 100) / 100} pk`;
  return formatAmount(item.quantity, item.unit);
}

export type ExpiryDot = "soon" | "expired" | null;
export function expiryDot(item: Pick<PantryItem, "expires_on">, today: Date): ExpiryDot {
  const s = expiryState(item.expires_on, today);
  return s === "soon" || s === "expired" ? s : null;
}

/**
 * Where the products of a row stand, left to right on the board. When they do not all fit, the last space
 * is kept for a "+n" marker and `overflow` says how many are not drawn.
 */
export function layOutRow(
  items: readonly PantryItem[],
  row: Rect,
  limit = Infinity,
): { sprites: Sprite[]; overflow: number; more: Rect | null } {
  const size = spriteSize(row);
  const y = row.y + row.height - BOARD - size;
  const pad = PAD;
  const sprites: Sprite[] = [];
  let x = row.x + pad;
  const right = row.x + row.width - pad;
  const take = items.slice(0, limit);
  const widthOf = (stack: number) => size + (stack - 1) * size * 0.28 + size * 0.2;
  for (const [i, item] of take.entries()) {
    const stack = stackCount(item);
    const w = widthOf(stack);
    const last = i === take.length - 1;
    // keep room for the "+n" marker unless this is the final product and it fits
    const needs = last && take.length === items.length ? w : w + size;
    if (x + needs > right + 0.001) break;
    sprites.push({ item, x, y, size, stack });
    x += w;
  }
  const overflow = items.length - sprites.length;
  return { sprites, overflow, more: overflow > 0 ? { x, y, width: size, height: size } : null };
}
