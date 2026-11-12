import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CookedLog } from "./cooked";
import { cook } from "./data";
import { EatenSection } from "./EatenSection";

let logs: CookedLog[] = [];
vi.mock("./data", () => ({
  cook: { undoCook: vi.fn(async () => {}), removeFromLog: vi.fn(async () => {}) },
  cookedQuery: { queryKey: ["cook", "cooked"], queryFn: async () => logs },
  useInvalidateCook: () => async () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = new Date("2026-03-10T18:00:00");
let n = 0;
const log = (p: Partial<CookedLog> = {}): CookedLog => {
  n++;
  return {
    id: `c${n}`,
    user_id: "u",
    recipe_id: null,
    title: "Rice and eggs",
    servings: 2,
    kcal: 700,
    protein_g: 30,
    carbs_g: null,
    fat_g: null,
    portions: 1,
    kcal_missing: 0,
    cooked_at: "2026-03-10T12:00:00",
    removed: [],
    undone_at: null,
    ...p,
  };
};

function show() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EatenSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(cook.undoCook).mockClear();
  vi.mocked(cook.removeFromLog).mockClear();
});
afterEach(() => vi.useRealTimers());

describe("EatenSection", () => {
  it("says nothing is logged when nothing is", async () => {
    logs = [];
    show();
    expect(await screen.findByText(/Nothing logged yet/)).toBeInTheDocument();
    expect(screen.getByText("Nothing logged this week.")).toBeInTheDocument();
  });

  it("shows today, the week, and a bar for each of 7 days", async () => {
    logs = [
      log({ kcal: 700, protein_g: 30, carbs_g: 80, fat_g: 20 }),
      log({ kcal: 500, protein_g: 20, carbs_g: 50, fat_g: 10, cooked_at: "2026-03-10T08:00:00" }),
      log({ kcal: 900, protein_g: 40, cooked_at: "2026-03-07T20:00:00" }),
    ];
    show();
    expect(await screen.findByText("1,200 kcal")).toBeInTheDocument(); // today
    expect(screen.getByText("2,100 kcal")).toBeInTheDocument(); // week
    expect(screen.getAllByText(/50 g protein · 130 g carbs · 30 g fat/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button").filter((b) => /kcal$/.test(b.getAttribute("aria-label") ?? ""))).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Tuesday 10 Mar: 1,200 kcal" })).toBeInTheDocument();
  });

  it("reads a day when it is tapped, and has a table with the same numbers", async () => {
    logs = [log({ kcal: 900, protein_g: 40, cooked_at: "2026-03-07T20:00:00" })];
    show();
    await screen.findByText("Eaten");
    fireEvent.click(screen.getByRole("button", { name: "Saturday 7 Mar: 900 kcal" }));
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toMatch(/Saturday 7 Mar: 900 kcal · 40 g protein/);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(8); // header + 7 days
  });

  it("offers Undo for a meal cooked a minute ago and puts the food back", async () => {
    logs = [log({ cooked_at: "2026-03-10T17:58:00", title: "Pasta" })];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Undo Pasta" }));
    await waitFor(() => expect(cook.undoCook).toHaveBeenCalledWith(logs[0]?.id));
    expect(cook.removeFromLog).not.toHaveBeenCalled();
  });

  it("offers Remove for an older meal, which leaves the pantry alone", async () => {
    logs = [log({ cooked_at: "2026-03-10T09:00:00", title: "Porridge" })];
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Remove Porridge" }));
    await waitFor(() => expect(cook.removeFromLog).toHaveBeenCalledWith(logs[0]?.id));
    expect(cook.undoCook).not.toHaveBeenCalled();
  });

  it("lists logged meals with the numbers of one portion", async () => {
    logs = [log({ kcal: 600, protein_g: 24, carbs_g: 80, fat_g: 20, portions: 2, servings: 4, title: "Curry" })];
    show();
    expect(await screen.findByText(/2 portions/)).toBeInTheDocument();
    expect(screen.getByText(/300 kcal · 12 g protein · 40 g carbs · 10 g fat per portion/)).toBeInTheDocument();
  });
});
