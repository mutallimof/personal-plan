import type { Tables } from "@/integrations/supabase/types";
import { BUILTIN_CATEGORIES } from "./categories";

export type PantryItem = Tables<"pantry_items">;
export type PantryLocation = Tables<"pantry_locations">;

export const UNITS = ["g", "kg", "ml", "l", "pieces", "pack"] as const;
export type Unit = (typeof UNITS)[number];

/** A category key as stored on items. The built-in ones are in `categories.ts`; people can add their own. */
export type Category = string;
export const CATEGORIES = BUILTIN_CATEGORIES;

export const LOCATION_KINDS = ["fridge", "freezer", "shelf", "drawer", "cupboard", "other"] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const isUnit = (v: unknown): v is Unit => UNITS.includes(v as Unit);
/** Category keys are short lower-case text; custom ones are made from the name a person types. */
export const isCategory = (v: unknown): v is Category => typeof v === "string" && /^[a-z0-9][a-z0-9 ]{0,39}$/.test(v);
export const isLocationKind = (v: unknown): v is LocationKind => LOCATION_KINDS.includes(v as LocationKind);

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
