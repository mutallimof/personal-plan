import type { Tables } from "@/integrations/supabase/types";
import { isLocationKind, type LocationKind, type PantryItem, type PantryLocation } from "./model";

export type Zone = Tables<"kitchen_zones">;

/** The kitchen is drawn on a fixed 100 x 70 canvas; every zone uses these units, children included. */
export const CANVAS = { width: 100, height: 70 } as const;
export const MIN_WIDTH = 6;
export const MIN_HEIGHT = 4;
export const MAX_ZONES = 200;

export type Rect = { x: number; y: number; width: number; height: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Positions snap to half units so layouts stay tidy. */
export const snap = (n: number) => Math.round(n * 2) / 2;

/** A zone as written in a layout file. `parent` is another zone's key; `location` is a pantry place by name. */
export type LayoutZone = Rect & {
  key: string;
  name: string;
  kind: LocationKind;
  parent: string | null;
  location: string | null;
};
export type Layout = { version: 1; zones: LayoutZone[] };

/** The layout new users start with. Place names match the default pantry places. */
export const DEFAULT_LAYOUT: Layout = {
  version: 1,
  zones: [
    { key: "fridge", name: "Fridge", kind: "fridge", x: 4, y: 6, width: 34, height: 58, parent: null, location: "Fridge" },
    { key: "veg", name: "Vegetable drawer", kind: "drawer", x: 6, y: 44, width: 14.5, height: 17, parent: "fridge", location: "Vegetable drawer" },
    { key: "fruit", name: "Fruit drawer", kind: "drawer", x: 21.5, y: 44, width: 14.5, height: 17, parent: "fridge", location: "Fruit drawer" },
    { key: "freezer", name: "Freezer", kind: "freezer", x: 42, y: 6, width: 22, height: 28, parent: null, location: "Freezer" },
    { key: "dry", name: "Dry-goods shelf", kind: "shelf", x: 68, y: 6, width: 28, height: 28, parent: null, location: "Dry-goods shelf" },
    { key: "spice", name: "Spice shelf", kind: "shelf", x: 68, y: 38, width: 28, height: 12, parent: null, location: "Spice shelf" },
  ],
};

// ---------- reading a layout file ----------

const rectProblem = (r: Rect): string | null => {
  if (![r.x, r.y, r.width, r.height].every(Number.isFinite)) return "x, y, width and height must be numbers";
  if (r.width < MIN_WIDTH || r.height < MIN_HEIGHT) return `is smaller than ${MIN_WIDTH} x ${MIN_HEIGHT}`;
  if (r.x < 0 || r.y < 0 || r.x + r.width > CANVAS.width || r.y + r.height > CANVAS.height) {
    return `does not fit on the ${CANVAS.width} x ${CANVAS.height} canvas`;
  }
  return null;
};

function readZone(input: unknown): LayoutZone | string {
  if (!input || typeof input !== "object") return "is not an object";
  const o = input as Record<string, unknown>;
  const key = typeof o["key"] === "string" ? o["key"].trim() : "";
  if (!key) return "has no key";
  const name = typeof o["name"] === "string" ? o["name"].trim().slice(0, 60) : "";
  if (!name) return `"${key}" has no name`;
  const kind = o["kind"] ?? "other";
  if (!isLocationKind(kind)) return `"${key}" has an unknown kind "${String(kind)}"`;
  const rect = { x: Number(o["x"]), y: Number(o["y"]), width: Number(o["width"]), height: Number(o["height"]) };
  const problem = rectProblem(rect);
  if (problem) return `"${key}": ${problem}`;
  const parent = o["parent"] ?? null;
  const location = o["location"] ?? null;
  if (parent !== null && typeof parent !== "string") return `"${key}": parent must be a key or null`;
  if (location !== null && typeof location !== "string") return `"${key}": location must be a place name or null`;
  return { key, name, kind, ...rect, parent, location: location?.trim() || null };
}

/** Reads a layout file. All or nothing: if anything is wrong, nothing is returned and every problem is listed. */
export function parseLayout(text: string): { layout: Layout | null; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { layout: null, errors: ["The file is not valid JSON."] };
  }
  const list = Array.isArray(json) ? json : (json as { zones?: unknown } | null)?.zones;
  if (!Array.isArray(list)) return { layout: null, errors: ['Expected a "zones" list.'] };
  if (list.length > MAX_ZONES) return { layout: null, errors: [`At most ${MAX_ZONES} zones.`] };

  const errors: string[] = [];
  const zones: LayoutZone[] = [];
  list.forEach((entry, i) => {
    const z = readZone(entry);
    if (typeof z === "string") errors.push(`Zone ${i + 1} ${z}.`);
    else if (zones.some((o) => o.key === z.key)) errors.push(`Zone ${i + 1}: the key "${z.key}" is used twice.`);
    else zones.push(z);
  });
  for (const z of zones) {
    if (z.parent !== null && !zones.some((o) => o.key === z.parent)) errors.push(`"${z.key}": parent "${z.parent}" does not exist.`);
    if (z.parent === z.key) errors.push(`"${z.key}" is its own parent.`);
  }
  if (!errors.length) {
    const byKey = new Map(zones.map((z) => [z.key, z]));
    for (const z of zones) {
      const seen = new Set<string>();
      for (let cur: LayoutZone | undefined = z; cur; cur = cur.parent ? byKey.get(cur.parent) : undefined) {
        if (seen.has(cur.key)) {
          errors.push(`"${z.key}" is part of a parent loop.`);
          break;
        }
        seen.add(cur.key);
      }
    }
  }
  return errors.length ? { layout: null, errors } : { layout: { version: 1, zones }, errors };
}

/** Parents before their children, otherwise in the order given. */
export function parentsFirst<T extends { key: string; parent: string | null }>(zones: readonly T[]): T[] {
  const out: T[] = [];
  const done = new Set<string>();
  const pending = [...zones];
  while (pending.length) {
    const before = pending.length;
    for (let i = 0; i < pending.length; ) {
      const z = pending[i] as T;
      if (z.parent === null || done.has(z.parent) || !zones.some((o) => o.key === z.parent)) {
        out.push(z);
        done.add(z.key);
        pending.splice(i, 1);
      } else i++;
    }
    if (pending.length === before) {
      out.push(...pending); // a loop; parseLayout rejects these, so this only keeps the function total
      break;
    }
  }
  return out;
}

/** Turns stored zones into a layout file. Keys are z1, z2, ... and places are named. */
export function exportLayout(zones: readonly Zone[], locations: readonly PantryLocation[]): string {
  const ordered = parentsFirst(zones.map((z) => ({ ...z, key: z.id, parent: z.parent_id })));
  const keyOf = new Map(ordered.map((z, i) => [z.id, `z${i + 1}`]));
  const layout: Layout = {
    version: 1,
    zones: ordered.map((z) => ({
      key: keyOf.get(z.id) ?? z.id,
      name: z.name,
      kind: isLocationKind(z.kind) ? z.kind : "other",
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      parent: z.parent_id ? (keyOf.get(z.parent_id) ?? null) : null,
      location: locations.find((l) => l.id === z.location_id)?.name ?? null,
    })),
  };
  return JSON.stringify(layout, null, 2) + "\n";
}

// ---------- geometry ----------

export const childrenOf = (zones: readonly Zone[], id: string) => zones.filter((z) => z.parent_id === id);

export function descendantIds(zones: readonly Zone[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift();
    for (const z of zones) {
      if (z.parent_id === cur && z.id !== id && !out.includes(z.id)) {
        out.push(z.id);
        queue.push(z.id);
      }
    }
  }
  return out;
}

export function zoneDepth(zones: readonly Zone[], z: Zone): number {
  let d = 0;
  const seen = new Set<string>();
  for (let cur: Zone | undefined = z; cur?.parent_id && !seen.has(cur.id); d++) {
    seen.add(cur.id);
    cur = zones.find((o) => o.id === cur?.parent_id);
  }
  return d;
}

const hit = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** The zone under a point: the deepest one (a drawer rather than its fridge), then the smallest. */
export function zoneAt(zones: readonly Zone[], x: number, y: number, ignoreId?: string): Zone | undefined {
  return zones
    .filter((z) => z.id !== ignoreId && hit(z, x, y))
    .sort((a, b) => zoneDepth(zones, b) - zoneDepth(zones, a) || a.width * a.height - b.width * b.height)[0];
}

/** Shifts a zone and everything inside it by the same amount, without any limit. */
function translate(zones: readonly Zone[], id: string, dx: number, dy: number): Zone[] {
  const moving = new Set([id, ...descendantIds(zones, id)]);
  return zones.map((o) => (moving.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o));
}

/** Moves a zone and everything inside it, keeping the zone on the canvas. */
export function moveZone(zones: readonly Zone[], id: string, dx: number, dy: number): Zone[] {
  const z = zones.find((o) => o.id === id);
  if (!z) return [...zones];
  const x = snap(clamp(z.x + dx, 0, CANVAS.width - z.width));
  const y = snap(clamp(z.y + dy, 0, CANVAS.height - z.height));
  return translate(zones, id, x - z.x, y - z.y);
}

/** Pulls a rectangle inside another one, shrinking it if it is too big. */
function fitInside(r: Rect, outer: Rect): Rect {
  const width = Math.min(r.width, outer.width);
  const height = Math.min(r.height, outer.height);
  return {
    width,
    height,
    x: clamp(r.x, outer.x, outer.x + outer.width - width),
    y: clamp(r.y, outer.y, outer.y + outer.height - height),
  };
}

/** Resizes a zone from its top-left corner. Zones inside it are pulled in if they would stick out. */
export function resizeZone(zones: readonly Zone[], id: string, width: number, height: number): Zone[] {
  const z = zones.find((o) => o.id === id);
  if (!z) return [...zones];
  const next: Rect = {
    x: z.x,
    y: z.y,
    width: snap(clamp(width, MIN_WIDTH, CANVAS.width - z.x)),
    height: snap(clamp(height, MIN_HEIGHT, CANVAS.height - z.y)),
  };
  const result = new Map<string, Rect>([[id, next]]);
  const queue = [id];
  while (queue.length) {
    const parent = queue.shift() as string;
    for (const child of childrenOf(zones, parent)) {
      const fitted = fitInside(child, result.get(parent) as Rect);
      result.set(child.id, fitted);
      queue.push(child.id);
    }
  }
  return zones.map((o) => (result.has(o.id) ? { ...o, ...result.get(o.id) } : o));
}

/** Sets a zone's rectangle from typed values: it stays on the canvas, and zones inside follow or shrink. */
export function setZoneRect(zones: readonly Zone[], id: string, r: Rect): Zone[] {
  const z = zones.find((o) => o.id === id);
  if (!z) return [...zones];
  const width = snap(clamp(r.width, MIN_WIDTH, CANVAS.width));
  const height = snap(clamp(r.height, MIN_HEIGHT, CANVAS.height));
  const x = clamp(snap(r.x), 0, CANVAS.width - width);
  const y = clamp(snap(r.y), 0, CANVAS.height - height);
  return resizeZone(translate(zones, id, x - z.x, y - z.y), id, width, height);
}

/** Zones a zone can be placed inside: not itself and not anything it contains (that would make a loop). */
export const possibleParents = (zones: readonly Zone[], id: string) => {
  const banned = new Set([id, ...descendantIds(zones, id)]);
  return zones.filter((z) => !banned.has(z.id));
};

/** Puts a zone inside another one (or back at the top level) and pulls it, and what it holds, inside the new parent. */
export function adoptZone(zones: readonly Zone[], id: string, parentId: string | null): Zone[] {
  const z = zones.find((o) => o.id === id);
  const parent = parentId ? zones.find((o) => o.id === parentId) : undefined;
  if (!z || (parentId && (!parent || !possibleParents(zones, id).includes(parent)))) return [...zones];
  const linked = zones.map((o) => (o.id === id ? { ...o, parent_id: parentId } : o));
  if (!parent) return linked;
  const fitted = fitInside(z, parent);
  return resizeZone(translate(linked, id, fitted.x - z.x, fitted.y - z.y), id, fitted.width, fitted.height);
}

/** Zones whose position or size differ between two versions of the layout. */
export const changedZones = (before: readonly Zone[], after: readonly Zone[]): Zone[] =>
  after.filter((a) => {
    const b = before.find((o) => o.id === a.id);
    return b && (b.x !== a.x || b.y !== a.y || b.width !== a.width || b.height !== a.height);
  });

// ---------- items in zones ----------

/** Items kept in a zone's own place (not in the places of zones inside it). */
export const itemsInZone = (items: readonly PantryItem[], zone: Pick<Zone, "location_id">) =>
  zone.location_id ? items.filter((i) => i.location_id === zone.location_id) : [];

export type IconCell = { x: number; y: number; index: number };

/**
 * Where to draw item icons inside a zone: a grid under the label. If they do not all fit, the last cell is left
 * for a "+n" marker and `overflow` says how many are hidden.
 */
export function iconGrid(zone: Rect, count: number): { cells: IconCell[]; size: number; overflow: number; badge: IconCell | null } {
  const size = clamp(Math.min(zone.width, zone.height) / 3.2, 3, 5.5);
  const left = zone.x + 1;
  const top = zone.y + 4.6;
  const cols = Math.floor((zone.width - 2) / size);
  const rows = Math.floor((zone.height - 5.6) / size);
  const capacity = Math.max(0, cols * rows);
  const cell = (i: number): IconCell => ({ x: left + (i % cols) * size, y: top + Math.floor(i / cols) * size, index: i });
  if (count <= capacity) return { cells: Array.from({ length: count }, (_, i) => cell(i)), size, overflow: 0, badge: null };
  if (capacity === 0) return { cells: [], size, overflow: count, badge: null };
  const shown = capacity - 1;
  return { cells: Array.from({ length: shown }, (_, i) => cell(i)), size, overflow: count - shown, badge: cell(shown) };
}
