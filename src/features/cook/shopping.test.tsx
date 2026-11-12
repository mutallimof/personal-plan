import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { item } from "@/features/pantry/fixtures";
import type { PantryItem } from "@/features/pantry/model";
import { lineStatus, type LineStatus, type Need } from "./can-cook";
import { describeAdd, planShoppingAdd } from "./shopping";

const need = (name: string, quantity = 1, unit: Need["unit"] = "pieces"): Need => ({ name, quantity, unit });
const lines = (stock: PantryItem[], ...needs: Need[]): LineStatus[] => needs.map((n) => lineStatus(n, stock));

describe("planShoppingAdd", () => {
  const stock = [item({ name: "Schlagsahne", quantity: 200, unit: "ml" }), item({ name: "Mehl", quantity: 1, unit: "kg" })];

  it("adds a missing ingredient with its amount and unit", () => {
    const sel = lines(stock, need("Lachsfilet", 2, "pieces"));
    expect(planShoppingAdd(sel, stock, [])).toEqual({ add: [{ name: "Lachsfilet", quantity: 2, unit: "pieces" }], skipped: [] });
  });

  it("skips what is in stock, by normalized name and synonyms (Sahne is Schlagsahne)", () => {
    const sel = lines([], need("Sahne", 100, "ml"), need("Mehl", 200, "g"));
    const plan = planShoppingAdd(sel, stock, []);
    expect(plan.add).toEqual([]);
    expect(plan.skipped).toEqual([
      { name: "Sahne", reason: "in-stock" },
      { name: "Mehl", reason: "in-stock" },
    ]);
  });

  it("skips what is already on the list (Zitrone is Zitronen), but not what was already bought", () => {
    const sel = lines(stock, need("Zitrone"), need("Dill", 1, "pack"));
    const plan = planShoppingAdd(sel, stock, [
      { name: "Zitronen", done: false },
      { name: "Dill", done: true },
    ]);
    expect(plan.skipped).toEqual([{ name: "Zitrone", reason: "on-list" }]);
    expect(plan.add.map((a) => a.name)).toEqual(["Dill"]);
  });

  it("adds the same food only once when it is ticked twice under different names", () => {
    const sel = lines([], need("Sahne", 200, "ml"), need("Schlagsahne", 100, "ml"));
    const plan = planShoppingAdd(sel, [], []);
    expect(plan.add).toHaveLength(1);
    expect(plan.skipped).toEqual([{ name: "Schlagsahne", reason: "duplicate" }]);
  });

  it("adds only the amount that is still short when there is some in stock", () => {
    const some = [item({ name: "Zucker", quantity: 100, unit: "g" })];
    const sel = lines([], need("Zucker", 250, "g"));
    expect(planShoppingAdd(sel, some, [])).toEqual({ add: [{ name: "Zucker", quantity: 150, unit: "g" }], skipped: [] });
  });

  it("checks the pantry as it is now, not as it was when the card was drawn", () => {
    const stale = lines([], need("Backpulver", 1, "pack")); // drawn when it was missing
    const nowInStock = [item({ name: "Backpulver", quantity: 2, unit: "pack" })];
    expect(planShoppingAdd(stale, nowInStock, []).skipped).toEqual([{ name: "Backpulver", reason: "in-stock" }]);
  });

  it("counts a used-up entry as not in stock", () => {
    const empty = [item({ name: "Puderzucker", quantity: 0, unit: "g" })];
    expect(planShoppingAdd(lines(empty, need("Puderzucker", 50, "g")), empty, []).add).toHaveLength(1);
  });

  it("adds nothing for nothing", () => {
    expect(planShoppingAdd([], stock, [])).toEqual({ add: [], skipped: [] });
  });
});

describe("describeAdd", () => {
  it("says what was added and what was skipped and why", () => {
    expect(describeAdd(2, [])).toBe("Added 2 to your shopping list.");
    expect(describeAdd(1, [{ name: "Dill", reason: "on-list" }, { name: "Mehl", reason: "in-stock" }])).toBe(
      "Added 1 to your shopping list. Skipped Dill (already on the list), Mehl (in stock).",
    );
    expect(describeAdd(0, [{ name: "Dill", reason: "on-list" }])).toBe("Nothing added. Skipped Dill (already on the list).");
  });
});

// ---- the checklist on a recipe: nothing is added until the button is pressed

const add = vi.fn(async (_rows: unknown) => {});
let listRows: { id: string; name: string; done: boolean }[] = [];
let pantryRows: PantryItem[] = [];
vi.mock("./data", () => ({
  shopping: { add: (rows: unknown) => add(rows) },
  shoppingQuery: { queryKey: ["cook", "shopping"], queryFn: async () => listRows },
  useInvalidateCook: () => async () => {},
}));
vi.mock("@/features/pantry/data", () => ({ itemsQuery: { queryKey: ["pantry", "items"], queryFn: async () => pantryRows } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("MissingToList", () => {
  async function show(missing: LineStatus[]) {
    const { MissingToList } = await import("./MissingToList");
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MissingToList missing={missing} />
      </QueryClientProvider>,
    );
  }

  it("lists each missing ingredient with a checkbox and adds nothing by itself", async () => {
    listRows = [];
    pantryRows = [];
    add.mockClear();
    await show(lines([], need("Lachsfilet", 2), need("Dill", 1, "pack"), need("Zitronen", 2)));
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    await new Promise((r) => setTimeout(r, 30));
    expect(add).not.toHaveBeenCalled();
  });

  it("adds only the ticked ingredients when the button is pressed", async () => {
    listRows = [];
    pantryRows = [];
    add.mockClear();
    await show(lines([], need("Lachsfilet", 2), need("Dill", 1, "pack"), need("Zitronen", 2)));
    fireEvent.click(screen.getByRole("checkbox", { name: /Dill/ })); // untick
    fireEvent.click(screen.getByRole("button", { name: "Add selected to shopping list" }));
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect((add.mock.calls[0] as unknown[])[0]).toEqual([
      { name: "Lachsfilet", quantity: 2, unit: "pieces" },
      { name: "Zitronen", quantity: 2, unit: "pieces" },
    ]);
  });

  it("shows what is already on the list as ticked-off and not selectable, and never adds it again", async () => {
    listRows = [{ id: "1", name: "Zitrone", done: false }];
    pantryRows = [];
    add.mockClear();
    await show(lines([], need("Zitronen", 2), need("Mehl", 200, "g")));
    const box = await screen.findByRole("checkbox", { name: /Zitronen/ });
    await waitFor(() => expect(box).toBeDisabled());
    expect(box).not.toBeChecked();
    expect(screen.getByText("on your list")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add selected to shopping list" }));
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect((add.mock.calls[0] as unknown[])[0]).toEqual([{ name: "Mehl", quantity: 200, unit: "g" }]);
  });

  it("skips an ingredient that is in stock by the time the button is pressed", async () => {
    listRows = [];
    pantryRows = [item({ name: "Backpulver", quantity: 2, unit: "pack" })];
    add.mockClear();
    await show(lines([], need("Backpulver", 1, "pack"), need("Mehl", 200, "g")));
    fireEvent.click(screen.getByRole("button", { name: "Add selected to shopping list" }));
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect((add.mock.calls[0] as unknown[])[0]).toEqual([{ name: "Mehl", quantity: 200, unit: "g" }]);
  });
});
