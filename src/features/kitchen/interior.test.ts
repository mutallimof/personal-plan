import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import {
  assignShelves,
  badgeText,
  cavity,
  expiryDot,
  interiorRows,
  LOOSE_ID,
  layOutRow,
  rowAt,
  spriteSize,
  stackCount,
} from "./interior";
import { readLayout, type Hotspot } from "./layout";
import { DEFAULT_LAYOUT } from "./legacy";

const hotspot = (key: string) => DEFAULT_LAYOUT.hotspots.find((h) => h.key === key) as Hotspot;

describe("interiorRows", () => {
  it("gives a plain cabinet equal shelves inside its frame, all in its own place", () => {
    const h = hotspot("wall-shelf");
    const rows = interiorRows(h);
    expect(rows).toHaveLength(h.shelves);
    expect(rows.every((r) => r.place === h.location && r.compartment === null)).toBe(true);
    expect(rows.map((r) => r.shelf)).toEqual([0, 1]);
    const inner = cavity(h);
    for (const r of rows) {
      expect(r.rect.x).toBeGreaterThanOrEqual(inner.x);
      expect(r.rect.y).toBeGreaterThanOrEqual(inner.y);
      expect(r.rect.y + r.rect.height).toBeLessThanOrEqual(inner.y + inner.height + 1e-9);
    }
    expect(rows[1]!.rect.y).toBeGreaterThan(rows[0]!.rect.y + rows[0]!.rect.height - 1e-9);
  });

  it("gives the fridge its labelled compartments, then a row for things kept loose", () => {
    const rows = interiorRows(hotspot("fridge"));
    expect(rows.map((r) => r.label)).toEqual([
      "Meat and fish",
      "Dairy and eggs",
      "Vegetables",
      "Fruit",
      "Drinks and sauces",
      "Other",
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      "shelf",
      "shelf",
      "drawer",
      "drawer",
      "door",
      "shelf",
    ]);
    expect(rows.at(-1)).toMatchObject({ id: LOOSE_ID, place: "Fridge" });
    expect(rows[2]!.place).toBe("Vegetable drawer");
  });

  it("gives the freezer three drawers", () => {
    expect(interiorRows(hotspot("freezer")).filter((r) => r.kind === "drawer")).toHaveLength(3);
  });

  it("leaves out the loose row when the cabinet has no place of its own", () => {
    const fridge = { ...hotspot("fridge"), location: null };
    expect(interiorRows(fridge).some((r) => r.id === LOOSE_ID)).toBe(false);
  });

  it("stacks rows without overlap, top to bottom", () => {
    const rows = interiorRows(hotspot("fridge"));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.rect.y).toBeGreaterThanOrEqual(
        rows[i - 1]!.rect.y + rows[i - 1]!.rect.height,
      );
    }
  });
});

describe("rowAt", () => {
  const rows = interiorRows(hotspot("fridge"));
  it("finds the row under a point", () => {
    const r = rows[2]!;
    expect(rowAt(rows, r.rect.x + 2, r.rect.y + r.rect.height / 2)?.id).toBe(r.id);
  });
  it("counts the gap below a row for that row", () => {
    const r = rows[0]!;
    expect(rowAt(rows, r.rect.x + 2, r.rect.y + r.rect.height + 0.2)?.id).toBe(r.id);
  });
  it("finds nothing outside the cabinet", () => {
    expect(rowAt(rows, 1, 1)).toBeNull();
  });
});

describe("assignShelves", () => {
  const mk = (id: string, name: string, shelf: number | null = null) => ({ id, name, shelf });
  it("keeps a saved shelf and fills the others from the top", () => {
    const out = assignShelves(
      [mk("a", "Apples", 1), mk("b", "Beans"), mk("c", "Corn"), mk("d", "Dates")],
      3,
      2,
    );
    expect(out.get("a")).toBe(1);
    expect([out.get("b"), out.get("c"), out.get("d")]).toEqual([0, 0, 1]);
  });
  it("ignores a saved shelf the cabinet no longer has", () => {
    expect(assignShelves([mk("a", "A", 7)], 2, 3).get("a")).toBe(0);
  });
  it("spreads evenly when every shelf is full", () => {
    const out = assignShelves([mk("a", "A"), mk("b", "B"), mk("c", "C")], 2, 1);
    expect(new Set([...out.values()]).size).toBe(2);
  });
});

describe("sprites", () => {
  it("stacks countable things up to three, and nothing else", () => {
    expect(stackCount({ quantity: 3, unit: "pieces" })).toBe(3);
    expect(stackCount({ quantity: 7, unit: "pack" })).toBe(3);
    expect(stackCount({ quantity: 1, unit: "pieces" })).toBe(1);
    expect(stackCount({ quantity: 0.5, unit: "pieces" })).toBe(1);
    expect(stackCount({ quantity: 500, unit: "g" })).toBe(1);
  });

  it("writes short badges", () => {
    expect(badgeText({ quantity: 3, unit: "pieces" })).toBe("3");
    expect(badgeText({ quantity: 500, unit: "g" })).toBe("500 g");
    expect(badgeText({ quantity: 1.5, unit: "kg" })).toBe("1.5 kg");
    expect(badgeText({ quantity: 2, unit: "pack" })).toBe("2 pk");
    expect(badgeText({ quantity: 0.1 + 0.2, unit: "l" })).toBe("0.3 l");
  });

  it("marks only food that expires soon or has expired", () => {
    const today = new Date("2026-03-10T12:00:00");
    expect(expiryDot({ expires_on: null }, today)).toBeNull();
    expect(expiryDot({ expires_on: "2026-04-30" }, today)).toBeNull();
    expect(expiryDot({ expires_on: "2026-03-12" }, today)).toBe("soon");
    expect(expiryDot({ expires_on: "2026-03-01" }, today)).toBe("expired");
  });

  it("lays products left to right on the board and keeps room for a +n marker", () => {
    const row = { x: 10, y: 10, width: 20, height: 12 };
    const many = Array.from({ length: 12 }, (_, i) => item({ name: `P${i}` }));
    const { sprites, overflow, more } = layOutRow(many, row);
    expect(sprites.length).toBeGreaterThan(0);
    expect(sprites.length + overflow).toBe(12);
    expect(overflow).toBeGreaterThan(0);
    expect(more).not.toBeNull();
    for (const s of sprites) expect(s.x + s.size).toBeLessThanOrEqual(row.x + row.width);
    expect(more!.x + more!.width).toBeLessThanOrEqual(row.x + row.width + 1e-9);
    expect(sprites.map((s) => s.x)).toEqual([...sprites.map((s) => s.x)].sort((a, b) => a - b));
    expect(sprites[0]!.y + sprites[0]!.size).toBeLessThan(row.y + row.height);
  });

  it("shows everything when it fits, and respects a limit", () => {
    const row = { x: 0, y: 0, width: 60, height: 12 };
    const few = [item({ name: "A" }), item({ name: "B" })];
    expect(layOutRow(few, row)).toMatchObject({ overflow: 0, more: null });
    expect(layOutRow(few, row, 1).overflow).toBe(1);
  });

  it("sizes pictures by the height of the shelf, within limits", () => {
    expect(spriteSize({ x: 0, y: 0, width: 10, height: 2 })).toBe(3.4);
    expect(spriteSize({ x: 0, y: 0, width: 10, height: 100 })).toBe(9);
  });
});

describe("a layout with a cabinet that has no shelves of its own place", () => {
  it("still validates", () => {
    expect(readLayout({ ...DEFAULT_LAYOUT }).errors).toEqual([]);
  });
});
