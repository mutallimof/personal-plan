import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import {
  assignShelves,
  BOARD,
  badgeText,
  cavity,
  expiryDot,
  interiorRows,
  labelSizeFor,
  LOOSE_ID,
  layOutRow,
  rowAt,
  rowParts,
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
      "drawer",
      "shelf",
      "shelf",
      "shelf",
      "door",
      "shelf",
    ]);
    expect(rows.at(-1)).toMatchObject({ id: LOOSE_ID, place: "Fridge" });
    expect(rows[2]!.place).toBe("Vegetable drawer");
  });

  it("gives the freezer one drawer (Meat and fish); Ready meals and Other are open shelves", () => {
    const rows = interiorRows(hotspot("freezer"));
    expect(rows.filter((r) => r.kind === "drawer").map((r) => r.label)).toEqual(["Meat and fish"]);
    expect(rows.filter((r) => r.kind === "shelf").map((r) => r.label)).toEqual(["Ready meals", "Other"]);
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
    expect(badgeText({ quantity: 0.1 + 0.2, unit: "l" })).toBe("300 ml");
    expect(badgeText({ quantity: 1500, unit: "g" })).toBe("1.5 kg");
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
    expect(spriteSize({ x: 0, y: 0, width: 100, height: 2 })).toBe(0.8); // a very low row: small, but never above the board
    expect(spriteSize({ x: 0, y: 0, width: 100, height: 100 })).toBe(7.5);
    expect(spriteSize({ x: 0, y: 0, width: 10, height: 100 })).toBeCloseTo(2.8); // never wider than the row allows
  });

  it("always fits above the board, so it never touches the label or the board", () => {
    for (const height of [4, 6, 8, 10, 14, 30]) {
      const stand = { x: 0, y: 0, width: 40, height };
      const size = spriteSize(stand);
      if (size > 2.2) expect(size + BOARD).toBeLessThanOrEqual(height);
    }
  });

  it("splits a row into a standing area on the left and a column for the name on the right", () => {
    const row = { x: 5, y: 10, width: 30, height: 9 };
    const none = rowParts(row, 0);
    expect(none.side).toBeNull();
    expect(none.stand).toEqual(row);
    const { side, stand, labelSize, lines } = rowParts(row, 1.5, "Meat and fish");
    expect(lines.join(" ")).toBe("Meat and fish");
    expect(labelSize).toBeLessThanOrEqual(1.5);
    // the column is at the right edge, and the products stay left of it
    expect(side!.x + side!.width).toBeCloseTo(row.x + row.width);
    expect(stand.x + stand.width).toBeLessThanOrEqual(side!.x + 1e-9);
    expect(stand.y).toBe(row.y);
    expect(stand.height).toBe(row.height);
    const { sprites } = layOutRow([item({ name: "A" }), item({ name: "B" }), item({ name: "C" }), item({ name: "D" })], stand);
    for (const sp of sprites) expect(sp.x + sp.size).toBeLessThanOrEqual(side!.x + 1e-9);
    expect(sprites[0]!.y + sprites[0]!.size).toBeCloseTo(row.y + row.height - BOARD);
  });

  it("wraps and shrinks a long name until it fits its column", () => {
    const row = { x: 0, y: 0, width: 29.6, height: 8.4 };
    for (const name of ["Vegetables and fruit", "Drinks and sauces", "Dairy and eggs", "Ready meals", "Frozen vegetables and fruit"]) {
      const { side, lines, labelSize } = rowParts(row, 1.3, name);
      expect(lines.length).toBeLessThanOrEqual(3);
      for (const l of lines) expect(l.length * labelSize * 0.62).toBeLessThanOrEqual(side!.width - 2 + 1e-9);
      expect(lines.length * labelSize * 1.2).toBeLessThanOrEqual(side!.height);
    }
  });

  it("uses one label size for a cabinet, following its shortest row", () => {
    const rows = [{ rect: { x: 0, y: 0, width: 10, height: 20 } }, { rect: { x: 0, y: 0, width: 10, height: 5 } }];
    expect(labelSizeFor(rows)).toBe(1.2);
    expect(labelSizeFor([{ rect: { x: 0, y: 0, width: 10, height: 30 } }])).toBe(1.5);
  });
});

describe("a layout with a cabinet that has no shelves of its own place", () => {
  it("still validates", () => {
    expect(readLayout({ ...DEFAULT_LAYOUT }).errors).toEqual([]);
  });
});

describe("a crowded cabinet: label, pictures and chips never share space", () => {
  const sweep = [3.5, 4, 4.5, 5, 5.3, 6, 7.1, 9, 12];
  for (const height of sweep) {
    it(`row height ${height}`, () => {
      const row = { x: 0, y: 10, width: 40, height };
      const parts = rowParts(row, 1.2, "Vegetables and fruit");
      expect(parts.side).not.toBeNull();
      const side = parts.side!;
      // the name sits in its own column, right of the standing area, and above the board
      expect(parts.stand.x + parts.stand.width).toBeLessThanOrEqual(side.x + 1e-9);
      expect(side.y + side.height).toBeLessThanOrEqual(row.y + row.height - BOARD + 1e-9);
      // pictures stand left of the name and above the board
      const { sprites } = layOutRow([item({ name: "A", quantity: 500, unit: "g" }), item({ name: "B", quantity: 2, unit: "pieces" })], parts.stand);
      for (const s of sprites) {
        expect(s.y).toBeGreaterThanOrEqual(parts.stand.y - 1e-9);
        expect(s.y + s.size).toBeLessThanOrEqual(parts.stand.y + parts.stand.height - BOARD + 1e-9);
      }
    });
  }
});
