import type { Tables } from "@/integrations/supabase/types";

export type PantryItem = Tables<"pantry_items">;
export type PantryLocation = Tables<"pantry_locations">;

export const UNITS = ["g", "kg", "ml", "l", "pieces", "pack"] as const;
export type Unit = (typeof UNITS)[number];

export const CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "fish",
  "bakery",
  "dry goods",
  "frozen",
  "drinks",
  "spices",
  "snacks",
  "household",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LOCATION_KINDS = ["fridge", "freezer", "shelf", "drawer", "cupboard", "other"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const isUnit = (v: unknown): v is Unit => UNITS.includes(v as Unit);
export const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category);
export const isLocationKind = (v: unknown): v is LocationKind => LOCATION_KINDS.includes(v as LocationKind);

/** Where a category usually lives, used when the dictionary gives no place. */
export const CATEGORY_KIND: Record<Category, LocationKind> = {
  produce: "fridge",
  dairy: "fridge",
  meat: "fridge",
  fish: "fridge",
  bakery: "shelf",
  "dry goods": "shelf",
  frozen: "freezer",
  drinks: "shelf",
  spices: "shelf",
  snacks: "shelf",
  household: "cupboard",
  other: "shelf",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  produce: "🥦",
  dairy: "🥛",
  meat: "🥩",
  fish: "🐟",
  bakery: "🍞",
  "dry goods": "🌾",
  frozen: "🧊",
  drinks: "🥤",
  spices: "🧂",
  snacks: "🍫",
  household: "🧽",
  other: "📦",
};

/** Size of one tap on the +/- buttons. */
export function stepFor(unit: Unit): number {
  switch (unit) {
    case "g":
    case "ml":
      return 100;
    case "kg":
    case "l":
      return 0.5;
    default:
      return 1;
  }
}
