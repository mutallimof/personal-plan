import { isUnit, type Unit } from "@/features/pantry/model";

/** What a unit measures. Units of different kinds are never converted into each other (no guessing grams from pieces). */
export type Dimension = "mass" | "volume" | "pieces" | "pack";

const UNIT: Record<Unit, { dimension: Dimension; factor: number }> = {
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  l: { dimension: "volume", factor: 1000 },
  pieces: { dimension: "pieces", factor: 1 },
  pack: { dimension: "pack", factor: 1 },
};

// Database rows carry the unit as plain text; the table only allows the six known units, so anything else is treated as a pack.
const info = (unit: string) => UNIT[isUnit(unit) ? unit : "pack"];

export const dimensionOf = (unit: string): Dimension => info(unit).dimension;

/** Amount in the base unit of its kind: grams, millilitres, pieces or packs. */
export const toBase = (quantity: number, unit: string): number => quantity * info(unit).factor;

export const fromBase = (base: number, unit: string): number => base / info(unit).factor;

export const comparable = (a: string, b: string): boolean => dimensionOf(a) === dimensionOf(b);
