import { describe, expect, it } from "vitest";
import defaultJson from "./default-layout.json";
import {
  addHotspot,
  exportLayout,
  fitRect,
  parseLayout,
  readLayout,
  removeHotspot,
  uniqueKey,
  updateHotspot,
} from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";

const spot = { key: "a", name: "A", door: "double", x: 5, y: 5, width: 20, height: 20 };
const minimal = (extra: object = {}) => ({
  version: 2,
  room: { width: 100, height: 80, worktopY: 50, floorY: 70 },
  hotspots: [spot],
  ...extra,
});

describe("layout file", () => {
  it("accepts the default layout and keeps it unchanged through export and import", () => {
    expect(readLayout(defaultJson).errors).toEqual([]);
    const again = parseLayout(exportLayout(DEFAULT_LAYOUT));
    expect(again.errors).toEqual([]);
    expect(again.layout).toEqual(DEFAULT_LAYOUT);
  });

  it("fills in defaults for optional fields", () => {
    const { layout } = readLayout(minimal());
    expect(layout?.hotspots[0]).toMatchObject({
      shelves: 1,
      kind: "cupboard",
      location: null,
      compartments: [],
    });
    expect(layout?.areas).toEqual([]);
    expect(layout?.decor).toEqual([]);
  });

  it("says what is wrong, naming the cabinet and the field", () => {
    const { layout, errors } = readLayout(minimal({ hotspots: [{ ...spot, door: "trapdoor" }] }));
    expect(layout).toBeNull();
    expect(errors[0]).toContain("hotspots[1].door");
  });

  it.each([
    ["two cabinets with the same key", { hotspots: [spot, spot] }, "used twice"],
    ["a cabinet outside the room", { hotspots: [{ ...spot, x: 95 }] }, "does not fit"],
    ["too many shelves", { hotspots: [{ ...spot, shelves: 20 }] }, "shelves"],
    ["a key with spaces", { hotspots: [{ ...spot, key: "my cabinet" }] }, "key"],
    ["a wrong version", { version: 1 }, "version"],
  ])("rejects %s", (_name, patch, text) => {
    const { layout, errors } = readLayout(minimal(patch));
    expect(layout).toBeNull();
    expect(errors.join(" ")).toContain(text);
  });

  it("rejects duplicate compartment keys inside one cabinet", () => {
    const comp = { key: "c", name: "C", kind: "shelf", location: null };
    const h = { ...spot, compartments: [comp, comp] };
    expect(readLayout(minimal({ hotspots: [h] })).errors.join(" ")).toContain("used twice");
  });

  it("explains broken JSON in one line", () => {
    expect(parseLayout("{nope")).toEqual({ layout: null, errors: ["The file is not valid JSON."] });
  });

  it("ignores a byte order mark", () => {
    expect(parseLayout("﻿" + JSON.stringify(minimal())).errors).toEqual([]);
  });

  it("lists at most ten problems", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      key: `k${i}`,
      name: "",
      door: "x",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    }));
    expect(readLayout(minimal({ hotspots: many })).errors.length).toBeLessThanOrEqual(10);
  });
});

describe("editing", () => {
  const room = { width: 100, height: 80 };
  const base = readLayout(minimal()).layout!;

  it("fits a rectangle on the room and snaps it to half units", () => {
    expect(fitRect({ x: 97.3, y: -4, width: 2, height: 200 }, room)).toEqual({
      x: 94,
      y: 0,
      width: 6,
      height: 80,
    });
    expect(fitRect({ x: 10.26, y: 10.74, width: 20, height: 20 }, room)).toEqual({
      x: 10.5,
      y: 10.5,
      width: 20,
      height: 20,
    });
  });

  it("makes keys unique and tidy", () => {
    expect(uniqueKey(["a"], "a")).toBe("a-2");
    expect(uniqueKey([], "My new cabinet!")).toBe("My-new-cabinet");
    expect(uniqueKey([], "!!!")).toBe("spot");
  });

  it("adds, changes and removes a cabinet and stays a valid layout", () => {
    const added = addHotspot(base, { name: "Pantry" });
    expect(added.hotspots).toHaveLength(2);
    const key = added.hotspots[1]!.key;
    expect(key).toBe("Pantry");
    const moved = updateHotspot(added, key, { x: 500, shelves: 99, door: "drawer" });
    expect(moved.hotspots[1]).toMatchObject({ door: "drawer", shelves: 8 });
    expect(moved.hotspots[1]!.x + moved.hotspots[1]!.width).toBeLessThanOrEqual(100);
    expect(removeHotspot(moved, key).hotspots).toHaveLength(1);
    expect(readLayout(moved).errors).toEqual([]);
  });
});
