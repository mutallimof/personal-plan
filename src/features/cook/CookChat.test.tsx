import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { item } from "@/features/pantry/fixtures";
import type { PantrySettings } from "@/features/pantry/data";
import { AiChatSetting } from "./AiChatSetting";
import { cookChat } from "./chat.functions";
import { CookChat } from "./CookChat";
import { cook } from "./data";
import type { NutritionRow } from "./nutrition";
import { RecipesEmpty } from "./RecipesEmpty";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn, createServerFn: () => ({}) }));
vi.mock("./chat.functions", () => ({ cookChat: vi.fn() }));
vi.mock("./data", () => ({
  cook: { saveRecipe: vi.fn(), setAiChat: vi.fn(), undoCook: vi.fn(), saveNutrition: vi.fn() },
  shopping: { add: vi.fn() },
  recipesQuery: { queryKey: ["cook", "recipes"], queryFn: async () => ({ recipes: [], ingredients: [] }) },
  useInvalidateCook: () => async () => {},
}));
let settingsData: PantrySettings;
vi.mock("@/features/pantry/data", () => ({
  settingsQuery: { queryKey: ["pantry", "settings"], queryFn: async () => settingsData },
  useInvalidatePantry: () => async () => {},
}));

const ask = vi.mocked(cookChat) as unknown as ReturnType<typeof vi.fn>;
const settings = (over: Partial<PantrySettings> = {}): PantrySettings => ({ aiCheck: false, aiLinesSent: 0, aiRecipes: false, aiRecipeRequests: 0, aiChat: false, aiChatRequests: 0, ...over });
const rows: NutritionRow[] = [
  { name: "Chicken breast", basis: "100g", kcal: 110, protein_g: 23 },
  { name: "Potatoes", basis: "100g", kcal: 77, protein_g: 2 },
];
const chicken = item({ id: "c", name: "Chicken breast", quantity: 500, unit: "g" });

const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>;

function chat(over: Partial<PantrySettings> = {}) {
  const onOpenSettings = vi.fn();
  render(wrap(<CookChat settings={settings(over)} items={[chicken]} nutrition={rows} onOpenSettings={onOpenSettings} />));
  return { onOpenSettings };
}

const idea = {
  title: "Chicken and potatoes",
  servings: 2,
  minutes: 30,
  ingredients: [
    { name: "Chicken breast", quantity: 400, unit: "g" },
    { name: "Potatoes", quantity: 600, unit: "g" },
    { name: "Saffron", quantity: 1, unit: "g" },
  ],
  steps: ["Roast.", "Fry."],
};

async function send(text: string) {
  fireEvent.change(screen.getByLabelText("Ask what to cook"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  ask.mockReset();
  vi.mocked(cook.saveRecipe).mockReset();
  vi.mocked(cook.setAiChat).mockReset();
  vi.mocked(cook.setAiChat).mockResolvedValue();
  settingsData = settings();
});

describe("AI cooking chat is opt-in", () => {
  it("shows a helpful empty state and sends nothing while it is off", () => {
    const { onOpenSettings } = chat();
    expect(screen.getByText("AI cooking chat is off.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ask what to cook")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn it on in Settings" }));
    expect(onOpenSettings).toHaveBeenCalled();
    expect(ask).not.toHaveBeenCalled();
  });

  it("the Settings switch is off by default, says what is sent, and turns it on", async () => {
    render(wrap(<AiChatSetting />));
    const sw = await screen.findByRole("switch", { name: "AI cooking chat" });
    await waitFor(() => expect(sw).not.toBeDisabled());
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/item names, amounts and days until expiry, and your recipe titles/)).toBeInTheDocument();
    expect(screen.getByText(/Never receipts or photos/)).toBeInTheDocument();
    fireEvent.click(sw);
    await waitFor(() => expect(cook.setAiChat).toHaveBeenCalledWith(true));
  });

  it("shows the request counter", async () => {
    settingsData = settings({ aiChat: true, aiChatRequests: 3 });
    render(wrap(<AiChatSetting />));
    expect(await screen.findByText("3 requests so far")).toBeInTheDocument();
  });
});

describe("the chat", () => {
  it("sends the conversation and shows recipe cards with nutrition from the table only", async () => {
    ask.mockResolvedValue({ ok: true, requests: 1, reply: "Here are some ideas.", cards: [idea], cook: null, saved: [], shopping: [] });
    chat({ aiChat: true });
    await send("something with chicken");
    expect(await screen.findByText("Chicken and potatoes")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith({ data: { turns: [{ role: "user", content: "something with chicken" }] } });
    // 400 g chicken (440 kcal, 92 g) + 600 g potatoes (462 kcal, 12 g), two servings; saffron has no row
    expect(screen.getByText(/451 kcal · 52 g protein per serving \(approx\., 1 ingredient missing\)/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && /Missing:.*Saffron/.test(el.textContent ?? ""))).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  it("keeps the conversation for the next question but not error messages", async () => {
    ask.mockResolvedValueOnce({ ok: false, error: "I'm a bit busy right now — try again in a moment." });
    chat({ aiChat: true });
    await send("first");
    expect(await screen.findByRole("alert")).toHaveTextContent("busy right now");
    ask.mockResolvedValueOnce({ ok: true, requests: 2, reply: "Pasta.", cards: [], cook: null, saved: [], shopping: [] });
    await send("second");
    await screen.findByText("Pasta.");
    expect(ask).toHaveBeenLastCalledWith({ data: { turns: [{ role: "user", content: "first" }, { role: "user", content: "second" }] } });
  });

  it("shows a short message when the request itself fails, and keeps working", async () => {
    ask.mockRejectedValueOnce(new Error("network"));
    chat({ aiChat: true });
    await send("hello");
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI request failed");
    expect(screen.getByLabelText("Ask what to cook")).toBeEnabled();
  });

  it("does not send an empty message", () => {
    chat({ aiChat: true });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(ask).not.toHaveBeenCalled();
  });

  it("saves a recipe only when asked", async () => {
    vi.mocked(cook.saveRecipe).mockResolvedValue("r1");
    ask.mockResolvedValue({ ok: true, requests: 1, reply: "Idea", cards: [idea], cook: null, saved: [], shopping: [] });
    chat({ aiChat: true });
    await send("idea");
    await screen.findByText("Chicken and potatoes");
    expect(cook.saveRecipe).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
    await waitFor(() => expect(cook.saveRecipe).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
  });
});

describe("empty recipe list", () => {
  it("offers Add recipe and Import recipes (JSON), and hints at Settings when AI is off", () => {
    const onAdd = vi.fn();
    const onOpenSettings = vi.fn();
    render(wrap(<RecipesEmpty onAdd={onAdd} onOpenSettings={onOpenSettings} aiChat={false} />));
    fireEvent.click(screen.getByRole("button", { name: /Add recipe/ }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Import recipes \(JSON\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn it on in Settings" }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("has no AI hint when the chat is on", () => {
    render(wrap(<RecipesEmpty onAdd={() => {}} onOpenSettings={() => {}} aiChat />));
    expect(screen.queryByText(/AI cooking chat is off/)).not.toBeInTheDocument();
  });

  it("imports recipes from a file and says what happened", async () => {
    vi.mocked(cook.saveRecipe).mockResolvedValue("x");
    render(wrap(<RecipesEmpty onAdd={() => {}} onOpenSettings={() => {}} aiChat />));
    const json = JSON.stringify([{ title: "Soup", ingredients: [{ name: "Carrots", quantity: 500, unit: "g" }], steps: ["Boil."] }]);
    const file = new File([json], "recipes.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => json }); // jsdom has no Blob.text
    fireEvent.change(screen.getByLabelText("Recipes file"), { target: { files: [file] } });
    await waitFor(() => expect(cook.saveRecipe).toHaveBeenCalledTimes(1));
    expect(vi.mocked(cook.saveRecipe).mock.calls[0]?.[0]).toMatchObject({ title: "Soup", source: "manual" });
  });
});
