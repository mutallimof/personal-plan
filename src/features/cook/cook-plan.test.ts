import { describe, expect, it } from "vitest";
import { item } from "@/features/pantry/fixtures";
import type { Need } from "./can-cook";
import { changesFor, planLines, withAmount, type PlanLine } from "./cook-plan";

const rice = item({ id: "rice", name: "Rice", quantity: 1, unit: "kg" });
const eggs = item({ id: "eggs", name: "Eggs", quantity: 6, unit: "pieces" });
const need = (name: string, quantity: number, unit: Need["unit"]): Need => ({ name, quantity, unit });
const first = (lines: PlanLine[]) => lines[0] as PlanLine;

describe("planLines", () => {
  it("starts at what the recipe needs", () => {
    expect(first(planLines([need("Rice", 400, "g")], [rice], 1))).toMatchObject({
      name: "Rice",
      unit: "g",
      wanted: 400,
      available: 1000,
      amount: 400,
      skip: false,
      itemIds: ["rice"],
    });
  });

  it("scales for more servings", () => {
    expect(first(planLines([need("Eggs", 2, "pieces")], [eggs], 2.5))).toMatchObject({ wanted: 5, amount: 5 });
  });

  it("takes only what is there and says so", () => {
    expect(first(planLines([need("Eggs", 10, "pieces")], [eggs], 1))).toMatchObject({ wanted: 10, available: 6, amount: 6, skip: false });
  });

  it("skips what the pantry does not have", () => {
    expect(first(planLines([need("Flour", 100, "g")], [rice, eggs], 1))).toMatchObject({ available: 0, amount: 0, skip: true, itemIds: [] });
  });

  it("skips what cannot be compared", () => {
    expect(first(planLines([need("Eggs", 300, "g")], [eggs], 1)).skip).toBe(true);
  });
});

describe("withAmount", () => {
  const line = first(planLines([need("Rice", 400, "g")], [rice], 1));

  it("lets you correct the amount", () => {
    expect(withAmount(line, 250).amount).toBe(250);
  });

  it("never goes above the pantry or below zero", () => {
    expect(withAmount(line, 5000).amount).toBe(1000);
    expect(withAmount(line, -3).amount).toBe(0);
    expect(withAmount(line, Number.NaN).amount).toBe(0);
  });
});

describe("changesFor", () => {
  it("lowers an item, converting units", () => {
    const lines = planLines([need("Rice", 400, "g")], [rice], 1);
    expect(changesFor(lines, [rice, eggs])).toEqual([{ id: "rice", name: "Rice", unit: "kg", before: 1, after: 0.6 }]);
  });

  it("removes an item that is used up", () => {
    const lines = planLines([need("Eggs", 6, "pieces")], [eggs], 1);
    expect(changesFor(lines, [eggs])).toEqual([{ id: "eggs", name: "Eggs", unit: "pieces", before: 6, after: 0 }]);
  });

  it("leaves out skipped rows and rows set to zero", () => {
    const [a, b] = planLines([need("Rice", 400, "g"), need("Eggs", 2, "pieces")], [rice, eggs], 1);
    expect(changesFor([{ ...(a as PlanLine), skip: true }, withAmount(b as PlanLine, 0)], [rice, eggs])).toEqual([]);
  });

  it("uses the item that expires first", () => {
    const early = item({ id: "early", name: "Milk", quantity: 0.3, unit: "l", expires_on: "2026-03-11" });
    const late = item({ id: "late", name: "Milk", quantity: 1, unit: "l", expires_on: "2026-03-20" });
    const lines = planLines([need("Milk", 500, "ml")], [late, early], 1);
    const changes = changesFor(lines, [late, early]);
    expect(changes.find((c) => c.id === "early")?.after).toBe(0);
    expect(changes.find((c) => c.id === "late")?.after).toBe(0.8);
  });

  it("adds up rows that draw on the same item", () => {
    const lines = planLines([need("Rice", 300, "g"), need("Rice", 200, "g")], [rice], 1);
    expect(changesFor(lines, [rice])).toEqual([{ id: "rice", name: "Rice", unit: "kg", before: 1, after: 0.5 }]);
  });

  it("does not take more than an item has", () => {
    const lines = planLines([need("Eggs", 6, "pieces"), need("Eggs", 6, "pieces")], [eggs], 1);
    expect(changesFor(lines, [eggs])[0]?.after).toBe(0);
  });

  it("ignores items that are gone", () => {
    const lines = planLines([need("Rice", 400, "g")], [rice], 1);
    expect(changesFor(lines, [eggs])).toEqual([]);
  });
});
