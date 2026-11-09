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

const WEIGHT: Record<CompartmentKind, number> = { shelf: 1, drawer: 1.3, door: 0.9 };
const LOOSE_WEIGHT = 0.8;
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

/** Height of a product picture on a row, in room units. */
export const spriteSize = (row: Rect) => Math.min(9, Math.max(3.4, row.height * 0.62));

/** How many copies are drawn for a quantity: 3 yogurts show as a small stack of 3. */
export function stackCount(item: Pick<PantryItem, "quantity" | "unit">): number {
  const countable = item.unit === "pieces" || item.unit === "pack";
  return countable ? Math.max(1, Math.min(3, Math.floor(item.quantity))) : 1;
}

/** Short quantity for the badge: "3", "500 g", "1.5 kg". */
export function badgeText(item: Pick<PantryItem, "quantity" | "unit">): string {
  const n = Math.round(item.quantity * 100) / 100;
  if (!isUnit(item.unit) || item.unit === "pieces") return String(n);
  return item.unit === "pack" ? `${n} pk` : `${n} ${item.unit}`;
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
  const pad = 1;
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
