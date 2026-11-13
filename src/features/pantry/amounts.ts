import { roundQty } from "./items";
import type { Unit } from "./model";

/** Moves an amount to the unit people read most easily: 0.554 kg is 554 g, 1500 g is 1.5 kg, 0.5 l is 500 ml. */
export function tidyAmount(quantity: number, unit: Unit): { quantity: number; unit: Unit } {
  if (unit === "kg" && quantity < 1) return { quantity: roundQty(quantity * 1000), unit: "g" };
  if (unit === "g" && quantity >= 1000) return { quantity: roundQty(quantity / 1000), unit: "kg" };
  if (unit === "l" && quantity < 1) return { quantity: roundQty(quantity * 1000), unit: "ml" };
  if (unit === "ml" && quantity >= 1000) return { quantity: roundQty(quantity / 1000), unit: "l" };
  return { quantity: roundQty(quantity), unit };
}

/** "piece" or "pieces", "pack" or "packs"; the other units never change. */
export function unitLabel(unit: string, quantity: number): string {
  if (unit === "pieces") return quantity === 1 ? "piece" : "pieces";
  if (unit === "pack") return quantity === 1 ? "pack" : "packs";
  return unit;
}

/** "1 piece", "20 pieces", "1.5 kg", "250 g". Big or small amounts are shown in the nearer unit. */
export function formatAmount(quantity: number, unit: string): string {
  const t = unit === "g" || unit === "kg" || unit === "ml" || unit === "l" ? tidyAmount(quantity, unit) : { quantity: roundQty(quantity), unit };
  return `${t.quantity} ${unitLabel(t.unit, t.quantity)}`;
}
