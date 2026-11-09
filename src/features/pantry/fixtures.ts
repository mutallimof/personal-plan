import type { PantryItem, PantryLocation } from "./model";

// Builders for tests. Not used by the app.
let n = 0;

export function item(p: Partial<PantryItem> = {}): PantryItem {
  n++;
  return {
    id: `i${n}`,
    user_id: "u1",
    name: "Milk",
    quantity: 1,
    unit: "l",
    category: "dairy",
    location_id: null,
    added_at: "2026-01-01T00:00:00Z",
    expires_on: null,
    note: null,
    ...p,
  };
}

export function loc(p: Partial<PantryLocation> = {}): PantryLocation {
  n++;
  return {
    id: `l${n}`,
    user_id: "u1",
    name: "Fridge",
    kind: "fridge",
    parent_id: null,
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}
