import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { item } from "@/features/pantry/fixtures";
import type { Need } from "./can-cook";
import { CookScreen } from "./CookScreen";
import { cook } from "./data";
import type { NutritionRow } from "./nutrition";

vi.mock("./data", () => ({
  cook: { cookRecipe: vi.fn() },
  useInvalidateCook: () => async () => {},
}));

const rice = item({ id: "rice", name: "Rice", quantity: 1, unit: "kg" });
const eggs = item({ id: "eggs", name: "Eggs", quantity: 6, unit: "pieces" });
const recipe = { id: "r1", title: "Rice and eggs", servings: 2 };
const needs: Need[] = [
  { name: "Rice", quantity: 400, unit: "g" },
  { name: "Eggs", quantity: 2, unit: "pieces" },
  { name: "Saffron", quantity: 1, unit: "g" },
];
const nutrition: NutritionRow[] = [
  { name: "Rice", basis: "100g", kcal: 360, protein_g: 7 },
  { name: "Eggs", basis: "piece", kcal: 72, protein_g: 6 },
];

const cookRecipe = vi.mocked(cook.cookRecipe);

function setup() {
  const onCooked = vi.fn();
  const onCancel = vi.fn();
  render(<CookScreen recipe={recipe} needs={needs} items={[rice, eggs]} nutrition={nutrition} onCooked={onCooked} onCancel={onCancel} />);
  return { onCooked, onCancel };
}

const row = (name: string) => screen.getByText(name, { selector: "span.font-medium" }).closest("li") as HTMLElement;
const amount = (name: string) => within(row(name)).getByLabelText("Quantity") as HTMLInputElement;

beforeEach(() => {
  cookRecipe.mockReset();
  cookRecipe.mockResolvedValue("log-1");
});

describe("CookScreen", () => {
  it("lists every ingredient with the amount that will be removed", () => {
    setup();
    expect(amount("Rice").value).toBe("400");
    expect(amount("Eggs").value).toBe("2");
    expect(within(row("Rice")).getByText("Needs 400 g, you have 1000 g")).toBeInTheDocument();
    expect(within(row("Saffron")).getByText("Not in your pantry")).toBeInTheDocument();
  });

  it("shows rough nutrition per serving, labeled approximate", () => {
    setup();
    // (400 g rice = 1440 kcal + 2 eggs = 144 kcal) / 2 servings, saffron has no data
    expect(screen.getByText(/792 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/approx\., 1 ingredient missing/)).toBeInTheDocument();
  });

  it("takes the confirmed amounts out in one call and reports the new log", async () => {
    const { onCooked } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    await waitFor(() => expect(onCooked).toHaveBeenCalledWith("log-1", "Rice and eggs"));
    expect(cookRecipe).toHaveBeenCalledTimes(1);
    const args = cookRecipe.mock.calls[0]?.[0];
    expect(args).toMatchObject({ recipeId: "r1", title: "Rice and eggs", servings: 2, missing: 1 });
    expect(args?.changes).toEqual([
      { id: "rice", name: "Rice", unit: "kg", before: 1, after: 0.6 },
      { id: "eggs", name: "Eggs", unit: "pieces", before: 6, after: 4 },
    ]);
    // one portion eaten by default: (400 g rice + 2 eggs) / 2 servings
    expect(args?.nutrition.kcal).toBeCloseTo(792);
    expect(args?.portions).toBe(1);
  });

  it("logs what you eat: per portion times the portions entered", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Portions I eat"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    await waitFor(() => expect(cookRecipe).toHaveBeenCalled());
    const args = cookRecipe.mock.calls[0]?.[0];
    expect(args?.portions).toBe(2);
    expect(args?.nutrition.kcal).toBeCloseTo(1584);
    expect(args?.nutrition.carbs_g).toBeNull(); // the invented table has no carbs
  });

  it("will not cook with no portions to eat", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Portions I eat"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Cook" })).toBeDisabled();
  });

  it("lets you correct the amount", async () => {
    setup();
    fireEvent.change(amount("Rice"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    await waitFor(() => expect(cookRecipe).toHaveBeenCalled());
    expect(cookRecipe.mock.calls[0]?.[0].changes[0]).toMatchObject({ id: "rice", after: 0.75 });
  });

  it("never takes more than the pantry has", () => {
    setup();
    fireEvent.change(amount("Eggs"), { target: { value: "50" } });
    expect(amount("Eggs").value).toBe("6");
  });

  it("lets you skip an ingredient", async () => {
    setup();
    fireEvent.click(screen.getByRole("switch", { name: "Skip Rice" }));
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    await waitFor(() => expect(cookRecipe).toHaveBeenCalled());
    expect(cookRecipe.mock.calls[0]?.[0].changes.map((c) => c.id)).toEqual(["eggs"]);
  });

  it("scales the amounts when the servings change", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Servings"), { target: { value: "4" } });
    expect(amount("Rice").value).toBe("800");
    expect(amount("Eggs").value).toBe("4");
  });

  it("will not cook for zero servings", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Servings"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Cook" })).toBeDisabled();
  });

  it("keeps the screen open and the button usable when the update fails", async () => {
    cookRecipe.mockRejectedValue(new Error("A pantry item is no longer there"));
    const { onCooked } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cook" })).not.toBeDisabled());
    expect(onCooked).not.toHaveBeenCalled();
  });

  it("goes back without changing anything", () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(cookRecipe).not.toHaveBeenCalled();
  });
});
