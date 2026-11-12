import { z } from "zod";
import { LOCATION_KINDS } from "@/features/pantry/model";

/** Version of the layout file format. See docs/kitchen-layout.md. */
export const LAYOUT_VERSION = 2;

/** Revision of the built-in tidy-ups a saved layout has had (kept inside the file, so no database change is needed). */
export const LAYOUT_REV = 4;

export const DOORS = [
  "hinged-left",
  "hinged-right",
  "double",
  "drawer",
  "open-shelf",
  "glass",
] as const;
export type Door = (typeof DOORS)[number];

export const COMPARTMENT_KINDS = ["shelf", "drawer", "door"] as const;
export type CompartmentKind = (typeof COMPARTMENT_KINDS)[number];

export const DECOR_TYPES = ["cooker", "hood", "window", "plant"] as const;
export type DecorType = (typeof DECOR_TYPES)[number];

/** How far the worktop slab rises above `room.worktopY`: things that stand on the counter rest on this line. */
export const WORKTOP_TOP = 2;

export const MIN_SIZE = 6;
export const MAX_HOTSPOTS = 60;
export const MAX_SHELVES = 8;
export const MAX_COMPARTMENTS = 12;

export type Rect = { x: number; y: number; width: number; height: number };

const key = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "use letters, digits, - and _");
const name = z.string().trim().min(1).max(60);
/** A pantry place, by name. It is created when it does not exist yet. */
const place = z
  .string()
  .trim()
  .max(60)
  .nullable()
  .default(null)
  .transform((v) => v || null);

const rect = {
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(MIN_SIZE),
  height: z.number().min(MIN_SIZE),
};

const compartment = z.object({
  key,
  name,
  kind: z.enum(COMPARTMENT_KINDS).default("shelf"),
  location: place,
});

const hotspot = z.object({
  key,
  name,
  kind: z.enum(LOCATION_KINDS).default("cupboard"),
  door: z.enum(DOORS),
  shelves: z.number().int().min(1).max(MAX_SHELVES).default(1),
  location: place,
  compartments: z.array(compartment).max(MAX_COMPARTMENTS).default([]),
  ...rect,
});

const decor = z.object({ type: z.enum(DECOR_TYPES), ...rect });

const area = z.object({ name, x: z.number().min(0), width: z.number().min(MIN_SIZE) });

const room = z.object({
  width: z.number().min(60).max(400),
  height: z.number().min(40).max(300),
  /** Height of the top of the worktop. */
  worktopY: z.number().min(0),
  /** Where the floor begins. */
  floorY: z.number().min(0),
});

const layoutSchema = z
  .object({
    version: z.literal(LAYOUT_VERSION),
    rev: z.number().int().min(0).default(0),
    room,
    areas: z.array(area).max(12).default([]),
    hotspots: z.array(hotspot).max(MAX_HOTSPOTS),
    decor: z.array(decor).max(MAX_HOTSPOTS).default([]),
  })
  .superRefine((l, ctx) => {
    const fits = (r: Rect) => r.x + r.width <= l.room.width && r.y + r.height <= l.room.height;
    const seen = new Set<string>();
    l.hotspots.forEach((h, i) => {
      if (seen.has(h.key))
        ctx.addIssue({
          code: "custom",
          path: ["hotspots", i, "key"],
          message: `the key "${h.key}" is used twice`,
        });
      seen.add(h.key);
      if (!fits(h))
        ctx.addIssue({
          code: "custom",
          path: ["hotspots", i],
          message: `"${h.key}" does not fit in the room`,
        });
      const inner = new Set<string>();
      h.compartments.forEach((c, j) => {
        if (inner.has(c.key))
          ctx.addIssue({
            code: "custom",
            path: ["hotspots", i, "compartments", j, "key"],
            message: `the key "${c.key}" is used twice`,
          });
        inner.add(c.key);
      });
    });
    l.decor.forEach((d, i) => {
      if (!fits(d))
        ctx.addIssue({ code: "custom", path: ["decor", i], message: "does not fit in the room" });
    });
    if (l.room.floorY > l.room.height)
      ctx.addIssue({ code: "custom", path: ["room", "floorY"], message: "is below the room" });
    l.areas.forEach((a, i) => {
      if (a.x + a.width > l.room.width)
        ctx.addIssue({ code: "custom", path: ["areas", i], message: "does not fit in the room" });
    });
  });

export type Compartment = z.infer<typeof compartment>;
export type Hotspot = z.infer<typeof hotspot>;
export type Decor = z.infer<typeof decor>;
export type Area = z.infer<typeof area>;
export type Room = z.infer<typeof room>;
export type Layout = z.infer<typeof layoutSchema>;

const describe = (issue: z.ZodIssue) => {
  const where = issue.path
    .map((p) => (typeof p === "number" ? `[${p + 1}]` : `.${p}`))
    .join("")
    .replace(/^\./, "");
  return where ? `${where}: ${issue.message}` : issue.message;
};

/** Checks a layout that is already a JavaScript value. All or nothing; every problem is listed (at most 10). */
export function readLayout(input: unknown): { layout: Layout | null; errors: string[] } {
  const res = layoutSchema.safeParse(input);
  if (res.success) return { layout: res.data, errors: [] };
  return { layout: null, errors: res.error.issues.slice(0, 10).map(describe) };
}

/** Reads the text of a layout file. */
export function parseLayout(text: string): { layout: Layout | null; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { layout: null, errors: ["The file is not valid JSON."] };
  }
  return readLayout(json);
}

export const exportLayout = (layout: Layout): string => JSON.stringify(layout, null, 2) + "\n";

// ---------- editing helpers (used by the layout editor) ----------

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Positions and sizes snap to half units so layouts stay tidy. */
export const snap = (n: number) => Math.round(n * 2) / 2;

/** Puts a rectangle on the room: at least the minimum size, and not sticking out. */
export function fitRect(r: Rect, roomSize: Pick<Room, "width" | "height">): Rect {
  const width = clamp(snap(r.width), MIN_SIZE, roomSize.width);
  const height = clamp(snap(r.height), MIN_SIZE, roomSize.height);
  return {
    width,
    height,
    x: clamp(snap(r.x), 0, roomSize.width - width),
    y: clamp(snap(r.y), 0, roomSize.height - height),
  };
}

export function uniqueKey(existing: readonly string[], base: string): string {
  const clean =
    base
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "spot";
  if (!existing.includes(clean)) return clean;
  for (let n = 2; ; n++) if (!existing.includes(`${clean}-${n}`)) return `${clean}-${n}`;
}

export function addHotspot(layout: Layout, base: Partial<Hotspot> = {}): Layout {
  const keyName = uniqueKey(
    layout.hotspots.map((h) => h.key),
    base.name ?? "new-spot",
  );
  const fitted = fitRect({ x: 6, y: 6, width: 24, height: 20, ...base }, layout.room);
  const h: Hotspot = {
    name: "New spot",
    kind: "cupboard",
    door: "hinged-left",
    shelves: 2,
    location: null,
    compartments: [],
    ...base,
    ...fitted,
    key: keyName,
  };
  return { ...layout, hotspots: [...layout.hotspots, h] };
}

export const updateHotspot = (
  layout: Layout,
  hotspotKey: string,
  patch: Partial<Omit<Hotspot, "key">>,
): Layout => ({
  ...layout,
  hotspots: layout.hotspots.map((h) => {
    if (h.key !== hotspotKey) return h;
    const next = { ...h, ...patch };
    return {
      ...next,
      ...fitRect(next, layout.room),
      shelves: clamp(Math.round(next.shelves), 1, MAX_SHELVES),
    };
  }),
});

export const removeHotspot = (layout: Layout, hotspotKey: string): Layout => ({
  ...layout,
  hotspots: layout.hotspots.filter((h) => h.key !== hotspotKey),
});

/** Right end of the worktop: it stops 3 units short of the fridge-freezer (or runs to the wall when there is none). */
export function counterEnd(layout: Pick<Layout, "room" | "hotspots">): number {
  const tall = layout.hotspots.filter((h) => h.kind === "fridge" || h.kind === "freezer");
  return tall.length ? Math.min(...tall.map((h) => h.x)) - 3 : layout.room.width;
}
