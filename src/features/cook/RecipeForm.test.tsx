import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { item } from "@/features/pantry/fixtures";
import { cook } from "./data";
import { RecipeForm } from "./RecipeForm";
import { emptyDraft, type RecipeDraft } from "./recipes";

vi.mock("./data", () => ({
  cook: { saveRecipe: vi.fn() },
  useInvalidateCook: () => async () => {},
}));

const saveRecipe = vi.mocked(cook.saveRecipe);
const rice = item({ id: "rice", name: "Rice", unit: "kg" });

const filled: RecipeDraft = {
  title: "Rice and eggs",
  servings: 2,
  steps: "Cook.\nServe.",
  source: "manual",
  ingredients: [
    { name: "rice", quantity: 200, unit: "g" },
    { name: "Saffron", quantity: 1, unit: "g" },
  ],
};

function setup(initial: RecipeDraft, recipeId?: string) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(<RecipeForm initial={initial} recipeId={recipeId} items={[rice]} onSaved={onSaved} onCancel={onCancel} />);
  return { onSaved, onCancel };
}

beforeEach(() => {
  saveRecipe.mockReset();
  saveRecipe.mockResolvedValue("new-id");
});

describe("RecipeForm", () => {
  it("shows what is wrong instead of saving an incomplete recipe", () => {
    setup(emptyDraft());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Give the recipe a name.");
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one ingredient.");
    expect(saveRecipe).not.toHaveBeenCalled();
  });

  it("saves a new recipe, linking ingredients to pantry items by name", async () => {
    const { onSaved } = setup(filled);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [draft, id] = saveRecipe.mock.calls[0] ?? [];
    expect(id).toBeUndefined();
    expect(draft).toMatchObject({ title: "Rice and eggs", servings: 2, steps: "Cook.\nServe.", source: "manual" });
    expect(draft?.ingredients).toEqual([
      { name: "rice", quantity: 200, unit: "g", pantry_item_id: "rice" },
      { name: "Saffron", quantity: 1, unit: "g", pantry_item_id: null },
    ]);
  });

  it("updates an existing recipe", async () => {
    const { onSaved } = setup(filled, "r1");
    fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "Rice with eggs" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveRecipe.mock.calls[0]?.[0].title).toBe("Rice with eggs");
    expect(saveRecipe.mock.calls[0]?.[1]).toBe("r1");
  });

  it("adds and removes ingredient rows", () => {
    setup(filled);
    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
    expect(screen.getByLabelText("Ingredient 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove ingredient 1" }));
    expect(screen.queryByLabelText("Ingredient 3")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ingredient 1")).toHaveValue("Saffron");
  });

  it("ignores a blank ingredient row", async () => {
    const { onSaved } = setup(filled);
    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveRecipe.mock.calls[0]?.[0].ingredients).toHaveLength(2);
  });

  it("keeps the form open when saving fails", async () => {
    saveRecipe.mockRejectedValue(new Error("nope"));
    const { onSaved } = setup(filled);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("cancels", () => {
    const { onCancel } = setup(filled);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
