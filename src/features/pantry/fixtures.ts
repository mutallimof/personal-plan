import type { Alias } from "./aliases";
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

export function alias(raw_text: string, product_name: string, p: Partial<Alias> = {}): Alias {
  n++;
  return {
    id: `a${n}`,
    user_id: "u1",
    raw_text,
    store: null,
    product_name,
    category: "dairy",
    default_location_kind: null,
    default_unit: "pieces",
    default_quantity: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

// Invented receipts. Never put real ones in the repo.
export const SYNTHETIC_RECEIPT = `REWE Markt GmbH
Beispielstrasse 12
12345 Musterstadt
Tel: 01234 567890
Datum: 12.03.2026   Zeit: 17:45

H-MILCH 1,5% 1L            0,99 B
BIO EIER M 10ER            2,49 B
BANANEN                    1,89 B
  0,946 kg x 1,99 EUR/kg
JOGHURT NATUR              1,47 B
  3 x 0,49
SPAGHETTI 500G             1,29 B
TOMATEN 3 x 1,29           3,87 B
PFAND 0,25                 0,25 A
RABATT                    -0,50 B
--------------------------------
SUMME                      9,81
BAR                       10,00
RUECKGELD                  0,19
MWST A 19%    B 7%
GURKE                      0,79 B
`;
