import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/styles.css";
import { KitchenScene } from "@/features/kitchen/KitchenScene";
import { DEFAULT_LAYOUT } from "@/features/kitchen/legacy";
import { item, loc } from "@/features/pantry/fixtures";
import { ItemDialog } from "@/features/pantry/ItemDialog";
import { alias } from "@/features/pantry/fixtures";
import { SYNTHETIC_KAUFLAND } from "@/features/pantry/fixtures";
import { parseReceipt } from "@/features/pantry/receipt";
import { buildReview, type ReviewLine } from "@/features/pantry/review";
import { ReviewScreen } from "@/features/pantry/ReviewScreen";
import { STORE_ALIASES } from "@/features/pantry/starter-aliases";
import { categoryOptions } from "@/features/pantry/category-labels";
import { DEFAULT_ACCEPTS } from "@/features/pantry/categories";

const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle("dark", params.get("dark") === "1");

const places = [
  "Fridge",
  "Meat and fish",
  "Dairy and eggs",
  "Vegetable drawer",
  "Fruit drawer",
  "Drinks and sauces",
  "Freezer",
  "Frozen vegetables and fruit",
  "Frozen meat and fish",
  "Dry-goods shelf",
  "Spice shelf",
  "Glass cabinet",
  "Base cabinet",
  "Under the sink",
  "Kitchen drawers",
].map((name) => loc({ id: name, name }));

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const at = (
  location_id: string,
  name: string,
  quantity: number,
  unit: string,
  extra: object = {},
) => item({ id: `${location_id}-${name}`, name, quantity, unit, location_id, ...extra });

const items = [
  at("Fridge", "Leftover soup", 1, "pack"),
  at("Meat and fish", "Salmon", 300, "g", { expires_on: day(1) }),
  at("Meat and fish", "Chicken breast", 500, "g"),
  at("Dairy and eggs", "Yogurt", 3, "pieces"),
  at("Dairy and eggs", "Eggs", 6, "pieces"),
  at("Dairy and eggs", "Butter", 1, "pack", { expires_on: day(-1) }),
  at("Dairy and eggs", "Milk", 1, "l"),
  at("Vegetable drawer", "Carrots", 500, "g"),
  at("Vegetable drawer", "Tomatoes", 4, "pieces"),
  at("Vegetable drawer", "Cucumber", 1, "pieces"),
  at("Fruit drawer", "Apples", 5, "pieces"),
  at("Fruit drawer", "Lemon", 2, "pieces"),
  at("Drinks and sauces", "Ketchup", 1, "pack"),
  at("Drinks and sauces", "Orange juice", 1, "l"),
  at("Frozen vegetables and fruit", "Pizza", 2, "pieces"),
  at("Frozen meat and fish", "Peas", 450, "g"),
  at("Dry-goods shelf", "Basmati rice", 1, "kg"),
  at("Dry-goods shelf", "Spaghetti", 500, "g"),
  at("Dry-goods shelf", "Black beans", 2, "pack"),
  at("Dry-goods shelf", "Oats", 500, "g"),
  at("Dry-goods shelf", "Honey", 1, "pieces"),
  at("Dry-goods shelf", "Coffee", 250, "g"),
  at("Spice shelf", "Salt", 1, "pack"),
  at("Spice shelf", "Cinnamon", 1, "pack"),
  at("Spice shelf", "Basil", 1, "pack"),
  at("Glass cabinet", "Tea", 1, "pack"),
  at("Glass cabinet", "Chocolate", 2, "pieces"),
  at("Glass cabinet", "Cookies", 1, "pack"),
  at("Base cabinet", "Dish soap", 1, "pieces"),
  at("Kitchen drawers", "Batteries", 1, "pack"),
];

function Preview() {
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [edit, setEdit] = useState(params.get("item") === "1");
  return (
    <div className="mx-auto max-w-5xl p-4">
      <KitchenScene
        layout={DEFAULT_LAYOUT}
        items={items}
        locations={places}
        aliasIcons={new Map()}
        openKey={open}
        highlightItemId={null}
        onOpen={setOpen}
        onClose={() => setOpen(null)}
        onSelectItem={() => setEdit(true)}
        onDropOnRow={() => {}}
        onDropOutside={() => {}}
        onAdd={() => {}}
      />
      {edit && <ItemDialog item={items[3]!} locations={places} onClose={() => setEdit(false)} />}
    </div>
  );
}

/** The receipt review screen with an invented receipt, for screenshots. */
function ReviewPreview() {
  const accepting = places.map((p) => ({ ...p, accepts: [...(DEFAULT_ACCEPTS[p.name] ?? [])] }));
  const dictionary = STORE_ALIASES.map((a) => alias(a.raw_text, a.product_name, { ...a }));
  const parsed = parseReceipt(SYNTHETIC_KAUFLAND);
  const [lines, setLines] = useState<ReviewLine[]>(() => buildReview(parsed.lines, dictionary, "kaufland", accepting));
  const [ignored, setIgnored] = useState(parsed.ignored);
  return (
    <div className="mx-auto max-w-3xl p-4">
      <ReviewScreen
        lines={lines}
        locations={accepting}
        store="kaufland"
        onStore={() => {}}
        onChange={setLines}
        onSave={() => {}}
        onBack={() => {}}
        saving={false}
        categories={categoryOptions([])}
        ignored={ignored}
        onRestore={(g) => setIgnored(ignored.filter((x) => x !== g))}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      {params.get("view") === "review" ? <ReviewPreview /> : <Preview />}
    </QueryClientProvider>
  </StrictMode>,
);
