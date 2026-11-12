import { normalizeReceiptText } from "./normalize";
import type { AliasDraft } from "./aliases";
import type { Category, LocationKind, Unit } from "./model";
import storeSeed from "./receipt-data.json";

// A small starter dictionary of common German supermarket receipt texts. Texts are written the way they are
// printed and normalized when loaded. Sizes are left out on purpose (the weight in the text is stripped), so
// packaged goods default to one "pack". Extend it on the Dictionary page or by importing JSON.

type Row = readonly [text: string, name: string, category: Category, place: LocationKind, unit: Unit, qty: number | null];

const ROWS: readonly Row[] = [
  // Milk, eggs, dairy
  ["H-Milch 1,5%", "Milk (UHT) 1.5%", "dairy", "shelf", "l", 1],
  ["H-Milch 3,5%", "Milk (UHT) 3.5%", "dairy", "shelf", "l", 1],
  ["Frischmilch 1,5%", "Fresh milk 1.5%", "dairy", "fridge", "l", 1],
  ["Frischmilch 3,5%", "Fresh milk 3.5%", "dairy", "fridge", "l", 1],
  ["Vollmilch 3,5%", "Whole milk", "dairy", "fridge", "l", 1],
  ["Bio Vollmilch 3,5%", "Whole milk", "dairy", "fridge", "l", 1],
  ["Eier", "Eggs", "eggs", "fridge", "pieces", 10],
  ["Eier M 10er", "Eggs", "eggs", "fridge", "pieces", 10],
  ["Bio Eier", "Eggs", "eggs", "fridge", "pieces", 10],
  ["Freiland Eier", "Eggs", "eggs", "fridge", "pieces", 10],
  ["Naturjoghurt", "Natural yogurt", "dairy", "fridge", "pack", 1],
  ["Joghurt Natur", "Natural yogurt", "dairy", "fridge", "pack", 1],
  ["Griechischer Joghurt", "Greek yogurt", "dairy", "fridge", "pack", 1],
  ["Speisequark", "Quark", "dairy", "fridge", "pack", 1],
  ["Magerquark", "Quark (low fat)", "dairy", "fridge", "pack", 1],
  ["Butter", "Butter", "dairy", "fridge", "pack", 1],
  ["Gouda", "Gouda", "dairy", "fridge", "pack", 1],
  ["Mozzarella", "Mozzarella", "dairy", "fridge", "pack", 1],
  // Meat and fish
  ["Hähnchenbrustfilet", "Chicken breast", "poultry", "fridge", "pack", 1],
  ["Hähnchen Brustfilet", "Chicken breast", "poultry", "fridge", "pack", 1],
  ["Hähnch Brustfil", "Chicken breast", "poultry", "fridge", "pack", 1],
  ["Putenbrust", "Turkey breast", "poultry", "fridge", "pack", 1],
  ["Hackfleisch gemischt", "Mixed minced meat", "meat", "fridge", "pack", 1],
  ["Lachsfilet", "Salmon fillet", "fish", "fridge", "pack", 1],
  // Bread
  ["Brot", "Bread", "bakery", "shelf", "pieces", 1],
  ["Vollkornbrot", "Wholegrain bread", "bakery", "shelf", "pieces", 1],
  ["Toastbrot", "Toast bread", "bakery", "shelf", "pack", 1],
  ["Brötchen", "Bread rolls", "bakery", "shelf", "pieces", 1],
  // Vegetables and fruit
  ["Gurke", "Cucumber", "vegetables", "drawer", "pieces", 1],
  ["Tomaten", "Tomatoes", "vegetables", "drawer", "pack", 1],
  ["Rispentomaten", "Vine tomatoes", "vegetables", "drawer", "pack", 1],
  ["Paprika", "Bell pepper", "vegetables", "drawer", "pieces", 1],
  ["Karotten", "Carrots", "vegetables", "drawer", "pack", 1],
  ["Zucchini", "Zucchini", "vegetables", "drawer", "pieces", 1],
  ["Champignons", "Mushrooms", "vegetables", "drawer", "pack", 1],
  ["Kartoffeln", "Potatoes", "vegetables", "shelf", "pack", 1],
  ["Zwiebeln", "Onions", "vegetables", "shelf", "pack", 1],
  ["Bananen", "Bananas", "fruit", "shelf", "pieces", 1],
  ["Äpfel", "Apples", "fruit", "drawer", "pack", 1],
  ["Zitronen", "Lemons", "fruit", "drawer", "pack", 1],
  // Dry goods
  ["Spaghetti", "Spaghetti", "dry goods", "shelf", "pack", 1],
  ["Penne", "Penne", "dry goods", "shelf", "pack", 1],
  ["Nudeln", "Pasta", "dry goods", "shelf", "pack", 1],
  ["Basmati Reis", "Basmati rice", "dry goods", "shelf", "pack", 1],
  ["Langkornreis", "Long-grain rice", "dry goods", "shelf", "pack", 1],
  ["Haferflocken", "Oats", "dry goods", "shelf", "pack", 1],
  ["Zarte Haferflocken", "Oats", "dry goods", "shelf", "pack", 1],
  ["Weizenmehl Type 405", "Wheat flour", "dry goods", "shelf", "pack", 1],
  ["Zucker", "Sugar", "dry goods", "shelf", "pack", 1],
  ["Passierte Tomaten", "Passata", "dry goods", "shelf", "pack", 1],
  // Frozen, drinks
  ["TK Spinat", "Frozen spinach", "frozen", "freezer", "pack", 1],
  ["TK Erbsen", "Frozen peas", "frozen", "freezer", "pack", 1],
  ["Mineralwasser", "Mineral water", "drinks", "shelf", "l", 1],
  ["Apfelsaft", "Apple juice", "drinks", "shelf", "l", 1],
];

/** Version 1 of the starter dictionary: general German supermarket names. */
export const STARTER_ALIASES: readonly AliasDraft[] = ROWS.map(([text, name, category, place, unit, qty]) => ({
  raw_text: normalizeReceiptText(text),
  store: null,
  product_name: name,
  category,
  default_location_kind: place,
  default_unit: unit,
  default_quantity: qty,
}));

type StoreAlias = { raw_text: string; product_name: string; category: Category; place: LocationKind; unit: Unit; quantity: number | null };

/** Version 2: store-specific entries from `receipt-data.json` (only ones whose meaning is certain). */
export const STORE_ALIASES: readonly AliasDraft[] = Object.entries(
  (storeSeed.stores ?? {}) as Record<string, { aliases?: StoreAlias[] }>,
).flatMap(([store, d]) =>
  (d.aliases ?? []).map(
    (a): AliasDraft => ({
      raw_text: normalizeReceiptText(a.raw_text),
      store,
      product_name: a.product_name,
      category: a.category,
      default_location_kind: a.place,
      default_unit: a.unit,
      default_quantity: a.quantity,
    }),
  ),
);

/** What to add for a user whose dictionary was filled up to `seeded` (0 means never). Entries they deleted in earlier versions stay deleted. */
export const SEED_VERSION = 2;

export function seedsSince(seeded: number): readonly AliasDraft[] {
  return [...(seeded < 1 ? STARTER_ALIASES : []), ...(seeded < 2 ? STORE_ALIASES : [])];
}
