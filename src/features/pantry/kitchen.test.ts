import { describe, expect, it } from "vitest";
import {
  CANVAS,
  DEFAULT_LAYOUT,
  changedZones,
  adoptZone,
  childrenOf,
  descendantIds,
  exportLayout,
  iconGrid,
  itemsInZone,
  moveZone,
  parentsFirst,
  parseLayout,
  possibleParents,
  resizeZone,
  setZoneRect,
  snap,
  zoneAt,
  type Zone,
} from "./kitchen";
import { DEFAULT_LOCATIONS } from "./locations";
import { item, loc } from "./fixtures";

const zone = (id: string, x: number, y: number, width: number, height: number, p: Partial<Zone> = {}): Zone => ({
  id,
  user_id: "u1",
  name: id,
  kind: "other",
  x,
  y,
  width,
  height,
  parent_id: null,
  position: 0,
  location_id: null,
  created_at: "2026-01-01T00:00:00Z",
  ...p,
});

const fridge = zone("fridge", 4, 6, 34, 58);
const drawer = zone("drawer", 6, 44, 14, 17, { parent_id: "fridge" });
const box = zone("box", 7, 46, 6, 6, { parent_id: "drawer" });
const freezer = zone("freezer", 42, 6, 22, 28);
const all = [fridge, drawer, box, freezer];
const byId = (zs: readonly Zone[], id: string) => zs.find((z) => z.id === id) as Zone;

describe("DEFAULT_LAYOUT", () => {
  it("is valid and fits the canvas", () => {
    const { layout, errors } = parseLayout(JSON.stringify(DEFAULT_LAYOUT));
    expect(errors).toEqual([]);
    expect(layout?.zones).toHaveLength(DEFAULT_LAYOUT.zones.length);
  });

  it("maps every zone to one of the default pantry places", () => {
    const names = DEFAULT_LOCATIONS.map((l) => l.name);
    for (const z of DEFAULT_LAYOUT.zones) expect(names).toContain(z.location);
  });

  it("keeps the drawers inside the fridge", () => {
    const fridgeZone = DEFAULT_LAYOUT.zones.find((z) => z.key === "fridge")!;
    for (const z of DEFAULT_LAYOUT.zones.filter((o) => o.parent === "fridge")) {
      expect(z.x).toBeGreaterThanOrEqual(fridgeZone.x);
      expect(z.y).toBeGreaterThanOrEqual(fridgeZone.y);
      expect(z.x + z.width).toBeLessThanOrEqual(fridgeZone.x + fridgeZone.width);
      expect(z.y + z.height).toBeLessThanOrEqual(fridgeZone.y + fridgeZone.height);
    }
  });
});

describe("parseLayout", () => {
  const z = (p: Record<string, unknown> = {}) => ({ key: "a", name: "A", kind: "shelf", x: 1, y: 1, width: 20, height: 10, ...p });
  const parse = (zones: unknown[]) => parseLayout(JSON.stringify({ zones }));

  it("reads a list or an object", () => {
    expect(parseLayout(JSON.stringify([z()])).layout?.zones).toHaveLength(1);
    expect(parse([z()]).layout?.zones[0]).toMatchObject({ key: "a", parent: null, location: null, kind: "shelf" });
  });

  it("defaults the kind and trims the name", () => {
    expect(parse([z({ kind: undefined, name: "  Pantry " })]).layout?.zones[0]).toMatchObject({ kind: "other", name: "Pantry" });
  });

  it("tolerates a byte order mark", () => {
    expect(parseLayout("﻿" + JSON.stringify([z()])).errors).toEqual([]);
  });

  it.each([
    ["{nope", "The file is not valid JSON."],
    ['{"x":1}', 'Expected a "zones" list.'],
  ])("rejects %s", (text, message) => {
    expect(parseLayout(text)).toEqual({ layout: null, errors: [message] });
  });

  it("lists every problem and returns nothing if any zone is bad", () => {
    const res = parse([z(), z({ key: "b", name: "" }), z({ key: "c", kind: "attic" }), z({ key: "d", width: "wide" }), 5]);
    expect(res.layout).toBeNull();
    expect(res.errors).toEqual([
      'Zone 2 "b" has no name.',
      'Zone 3 "c" has an unknown kind "attic".',
      'Zone 4 "d": x, y, width and height must be numbers.',
      "Zone 5 is not an object.",
    ]);
  });

  it("rejects zones that are too small or off the canvas", () => {
    expect(parse([z({ width: 2 })]).errors[0]).toContain("smaller than");
    expect(parse([z({ x: 95 })]).errors[0]).toContain("does not fit");
    expect(parse([z({ y: -1 })]).errors[0]).toContain("does not fit");
  });

  it("rejects duplicate keys, unknown parents and loops", () => {
    expect(parse([z(), z()]).errors[0]).toContain('"a" is used twice');
    expect(parse([z({ parent: "nope" })]).errors).toContain('"a": parent "nope" does not exist.');
    expect(parse([z({ parent: "a" })]).errors).toContain('"a" is its own parent.');
    const loop = parse([z({ key: "a", parent: "b" }), z({ key: "b", parent: "a" })]);
    expect(loop.errors).toContain('"a" is part of a parent loop.');
  });

  it("rejects too many zones", () => {
    const many = Array.from({ length: 201 }, (_, i) => z({ key: `k${i}` }));
    expect(parse(many).errors).toEqual(["At most 200 zones."]);
  });
});

describe("parentsFirst", () => {
  it("puts parents before children whatever the input order", () => {
    const out = parentsFirst([
      { key: "c", parent: "b" },
      { key: "b", parent: "a" },
      { key: "a", parent: null },
    ]);
    expect(out.map((z) => z.key)).toEqual(["a", "b", "c"]);
  });

  it("does not drop zones that sit in a loop", () => {
    expect(
      parentsFirst([
        { key: "a", parent: "b" },
        { key: "b", parent: "a" },
      ]),
    ).toHaveLength(2);
  });
});

describe("exportLayout", () => {
  const places = [loc({ id: "p1", name: "Fridge" }), loc({ id: "p2", name: "Vegetable drawer" })];

  it("names places and links children to parents by key", () => {
    const text = exportLayout([drawer, { ...fridge, location_id: "p1" }], places);
    const { layout } = parseLayout(text);
    expect(layout?.zones.map((z) => [z.key, z.parent, z.location])).toEqual([
      ["z1", null, "Fridge"],
      ["z2", "z1", null],
    ]);
  });

  it("round-trips through parseLayout", () => {
    const text = exportLayout(all, places);
    expect(parseLayout(text).errors).toEqual([]);
  });

  it("does not leak ids", () => {
    expect(exportLayout(all, places)).not.toContain("u1");
  });
});

describe("tree helpers", () => {
  it("finds children and descendants", () => {
    expect(childrenOf(all, "fridge").map((z) => z.id)).toEqual(["drawer"]);
    expect(descendantIds(all, "fridge").sort()).toEqual(["box", "drawer"]);
    expect(descendantIds(all, "freezer")).toEqual([]);
  });
});

describe("zoneAt", () => {
  it("returns the deepest zone under a point", () => {
    expect(zoneAt(all, 8, 48)?.id).toBe("box");
    expect(zoneAt(all, 15, 55)?.id).toBe("drawer");
    expect(zoneAt(all, 10, 10)?.id).toBe("fridge");
    expect(zoneAt(all, 50, 10)?.id).toBe("freezer");
  });

  it("returns nothing in empty space and can ignore a zone", () => {
    expect(zoneAt(all, 95, 60)).toBeUndefined();
    expect(zoneAt(all, 10, 10, "fridge")).toBeUndefined();
    expect(zoneAt(all, 8, 48, "box")?.id).toBe("drawer");
  });
});

describe("moveZone", () => {
  it("moves a zone together with what is inside it", () => {
    const out = moveZone(all, "fridge", 10, 2);
    expect(byId(out, "fridge")).toMatchObject({ x: 14, y: 8 });
    expect(byId(out, "drawer")).toMatchObject({ x: 16, y: 46 });
    expect(byId(out, "box")).toMatchObject({ x: 17, y: 48 });
    expect(byId(out, "freezer")).toMatchObject({ x: 42, y: 6 });
  });

  it("keeps the zone on the canvas", () => {
    const out = moveZone(all, "freezer", 500, 500);
    expect(byId(out, "freezer")).toMatchObject({ x: CANVAS.width - 22, y: CANVAS.height - 28 });
    const left = moveZone(all, "fridge", -100, -100);
    expect(byId(left, "fridge")).toMatchObject({ x: 0, y: 0 });
    expect(byId(left, "drawer")).toMatchObject({ x: 2, y: 38 });
  });

  it("snaps to half units", () => {
    expect(byId(moveZone(all, "freezer", 0.3, 0.8), "freezer")).toMatchObject({ x: 42.5, y: 7 });
    expect(snap(1.24)).toBe(1);
    expect(snap(1.26)).toBe(1.5);
  });

  it("ignores an unknown id", () => {
    expect(moveZone(all, "nope", 5, 5)).toEqual(all);
  });
});

describe("resizeZone", () => {
  it("resizes within limits", () => {
    expect(byId(resizeZone(all, "freezer", 30, 20), "freezer")).toMatchObject({ width: 30, height: 20 });
    expect(byId(resizeZone(all, "freezer", 1, 1), "freezer")).toMatchObject({ width: 6, height: 4 });
    expect(byId(resizeZone(all, "freezer", 500, 500), "freezer")).toMatchObject({ width: CANVAS.width - 42, height: CANVAS.height - 6 });
  });

  it("pulls zones inside back in when the parent shrinks", () => {
    const out = resizeZone(all, "fridge", 12, 20);
    const f = byId(out, "fridge");
    for (const id of ["drawer", "box"]) {
      const z = byId(out, id);
      expect(z.x).toBeGreaterThanOrEqual(f.x);
      expect(z.y).toBeGreaterThanOrEqual(f.y);
      expect(z.x + z.width).toBeLessThanOrEqual(f.x + f.width);
      expect(z.y + z.height).toBeLessThanOrEqual(f.y + f.height);
    }
  });

  it("leaves zones that still fit alone", () => {
    const out = resizeZone(all, "fridge", 36, 60);
    expect(byId(out, "drawer")).toEqual(drawer);
  });
});

describe("setZoneRect", () => {
  it("sets position and size, and moves what is inside", () => {
    const out = setZoneRect(all, "fridge", { x: 10, y: 8, width: 30, height: 56 });
    expect(byId(out, "fridge")).toMatchObject({ x: 10, y: 8, width: 30, height: 56 });
    expect(byId(out, "drawer")).toMatchObject({ x: 12, y: 46 });
  });

  it("keeps the zone on the canvas whatever is typed", () => {
    const out = byId(setZoneRect(all, "freezer", { x: 99, y: 69, width: 40, height: 40 }), "freezer");
    expect(out.x + out.width).toBeLessThanOrEqual(CANVAS.width);
    expect(out.y + out.height).toBeLessThanOrEqual(CANVAS.height);
    expect(out.x).toBeGreaterThanOrEqual(0);
  });
});

describe("possibleParents / adoptZone", () => {
  it("does not offer a zone itself or anything inside it as a parent", () => {
    expect(possibleParents(all, "fridge").map((z) => z.id)).toEqual(["freezer"]);
    expect(possibleParents(all, "box").map((z) => z.id).sort()).toEqual(["drawer", "freezer", "fridge"]);
  });

  it("moves a zone into a parent and pulls it inside, with what it holds", () => {
    const out = adoptZone(all, "freezer", "fridge");
    const f = byId(out, "fridge");
    const z = byId(out, "freezer");
    expect(z.parent_id).toBe("fridge");
    expect(z.x).toBeGreaterThanOrEqual(f.x);
    expect(z.x + z.width).toBeLessThanOrEqual(f.x + f.width);
    expect(z.y + z.height).toBeLessThanOrEqual(f.y + f.height);
  });

  it("brings the contents along", () => {
    const withKid = [...all, zone("kid", 44, 8, 6, 5, { parent_id: "freezer" })];
    const out = adoptZone(withKid, "freezer", "fridge");
    const z = byId(out, "freezer");
    const kid = byId(out, "kid");
    expect(kid.x).toBeGreaterThanOrEqual(z.x);
    expect(kid.x + kid.width).toBeLessThanOrEqual(z.x + z.width);
  });

  it("can return a zone to the top level without moving it", () => {
    const out = adoptZone(all, "drawer", null);
    expect(byId(out, "drawer")).toEqual({ ...drawer, parent_id: null });
  });

  it("refuses a loop or an unknown parent", () => {
    expect(adoptZone(all, "fridge", "box")).toEqual(all);
    expect(adoptZone(all, "fridge", "fridge")).toEqual(all);
    expect(adoptZone(all, "fridge", "nope")).toEqual(all);
  });
});

describe("changedZones", () => {
  it("lists zones whose rectangle changed", () => {
    const after = moveZone(all, "fridge", 2, 0);
    expect(changedZones(all, after).map((z) => z.id).sort()).toEqual(["box", "drawer", "fridge"]);
    expect(changedZones(all, all)).toEqual([]);
  });
});

describe("itemsInZone", () => {
  it("lists items kept in the zone's place", () => {
    const milk = item({ location_id: "p1" });
    const rice = item({ location_id: "p2" });
    expect(itemsInZone([milk, rice], { location_id: "p1" })).toEqual([milk]);
  });

  it("shows nothing for a zone with no place", () => {
    expect(itemsInZone([item({ location_id: null })], { location_id: null })).toEqual([]);
  });
});

describe("iconGrid", () => {
  const rect = { x: 10, y: 10, width: 20, height: 16 };

  it("lays icons out in a grid under the label, inside the zone", () => {
    const g = iconGrid(rect, 4);
    expect(g.cells).toHaveLength(4);
    expect(g.overflow).toBe(0);
    expect(g.badge).toBeNull();
    for (const c of g.cells) {
      expect(c.x).toBeGreaterThanOrEqual(rect.x);
      expect(c.x + g.size).toBeLessThanOrEqual(rect.x + rect.width + 1e-9);
      expect(c.y).toBeGreaterThan(rect.y + 3);
      expect(c.y + g.size).toBeLessThanOrEqual(rect.y + rect.height + 1e-9);
    }
  });

  it("shows nothing for no items", () => {
    expect(iconGrid(rect, 0)).toMatchObject({ cells: [], overflow: 0, badge: null });
  });

  it("reserves the last cell for a +n marker when they do not all fit", () => {
    const g = iconGrid(rect, 100);
    expect(g.badge).not.toBeNull();
    expect(g.cells.length + 1 + (g.overflow - 1)).toBe(100);
    expect(g.overflow).toBe(100 - g.cells.length);
  });

  it("only reports a count when the zone is too small for any icon", () => {
    expect(iconGrid({ x: 0, y: 0, width: 6, height: 4 }, 3)).toMatchObject({ cells: [], overflow: 3, badge: null });
  });
});
