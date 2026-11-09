import { normalizeReceiptText } from "./normalize";
import type { AliasDraft } from "./aliases";
import type { Category, LocationKind, Unit } from "./model";

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
  ["Eier", "Eggs", "dairy", "fridge", "pieces", 10],
  ["Eier M 10er", "Eggs", "dairy", "fridge", "pieces", 10],
  ["Bio Eier", "Eggs", "dairy", "fridge", "pieces", 10],
  ["Freiland Eier", "Eggs", "dairy", "fridge", "pieces", 10],
  ["Naturjoghurt", "Natural yogurt", "dairy", "fridge", "pack", 1],
  ["Joghurt Natur", "Natural yogurt", "dairy", "fridge", "pack", 1],
  ["Griechischer Joghurt", "Greek yogurt", "dairy", "fridge", "pack", 1],
  ["Speisequark", "Quark", "dairy", "fridge", "pack", 1],
  ["Magerquark", "Quark (low fat)", "dairy", "fridge", "pack", 1],
  ["Butter", "Butter", "dairy", "fridge", "pack", 1],
  ["Gouda", "Gouda", "dairy", "fridge", "pack", 1],
  ["Mozzarella", "Mozzarella", "dairy", "fridge", "pack", 1],
  // Meat and fish
  ["Hähnchenbrustfilet", "Chicken breast", "meat", "fridge", "pack", 1],
  ["Hähnchen Brustfilet", "Chicken breast", "meat", "fridge", "pack", 1],
  ["Hähnch Brustfil", "Chicken breast", "meat", "fridge", "pack", 1],
  ["Putenbrust", "Turkey breast", "meat", "fridge", "pack", 1],
  ["Hackfleisch gemischt", "Mixed minced meat", "meat", "fridge", "pack", 1],
  ["Lachsfilet", "Salmon fillet", "fish", "fridge", "pack", 1],
  // Bread
  ["Brot", "Bread", "bakery", "shelf", "pieces", 1],
  ["Vollkornbrot", "Wholegrain bread", "bakery", "shelf", "pieces", 1],
  ["Toastbrot", "Toast bread", "bakery", "shelf", "pack", 1],
  ["Brötchen", "Bread rolls", "bakery", "shelf", "pieces", 1],
  // Vegetables and fruit
  ["Gurke", "Cucumber", "produce", "drawer", "pieces", 1],
  ["Tomaten", "Tomatoes", "produce", "drawer", "pack", 1],
  ["Rispentomaten", "Vine tomatoes", "produce", "drawer", "pack", 1],
  ["Paprika", "Bell pepper", "produce", "drawer", "pieces", 1],
  ["Karotten", "Carrots", "produce", "drawer", "pack", 1],
  ["Zucchini", "Zucchini", "produce", "drawer", "pieces", 1],
  ["Champignons", "Mushrooms", "produce", "drawer", "pack", 1],
  ["Kartoffeln", "Potatoes", "produce", "shelf", "pack", 1],
  ["Zwiebeln", "Onions", "produce", "shelf", "pack", 1],
  ["Bananen", "Bananas", "produce", "shelf", "pieces", 1],
  ["Äpfel", "Apples", "produce", "drawer", "pack", 1],
  ["Zitronen", "Lemons", "produce", "drawer", "pack", 1],
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

export const STARTER_ALIASES: readonly AliasDraft[] = ROWS.map(([text, name, category, place, unit, qty]) => ({
  raw_text: normalizeReceiptText(text),
  store: null,
  product_name: name,
  category,
  default_location_kind: place,
  default_unit: unit,
  default_quantity: qty,
}));
