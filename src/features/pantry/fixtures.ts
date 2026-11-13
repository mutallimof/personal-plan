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
    icon: null,
    shelf: null,
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
    accepts: [],
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
    icon: null,
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

/** Invented receipt in the layout of a store with two-line items and own-brand prefixes. No real data. */
export const SYNTHETIC_KAUFLAND = `Kaufland Musterstadt
Beispielweg 1
12345 Musterstadt
Tel. 01234 567890

Tomaten Rispen kg
 0,554 kg                 0,71 B
Äpfel Waage kg
 0,480 kg                 1,44 B
2 Cent OuG Beutel
 4 * 0,02                 0,08 A
Nektarinen kg     0,406 kg            1,21 B
Champignon w. 400g   1,99 B
Kartoffeln 2,5Kg   3,49 B
Peperoni Mix 100g   1,29 B
Trauben 500g rot   2,49 B
KBB Lachsfil 500g   5,99 B
Zitronen St   0,59 B
Dill Bund St.   0,99 B
K.H-Milch   1,15 B
 2 x 1,15   2,30 B
Weih.Butter   2,29 B
KPur.H.Brustfilet   6,49 B
Rhönsp.Miwa Natur.   0,79 A
Pfandartikel   0,25 A
Pfandartikel  0,25 A
Toipa   2,99 A
Artikelrabatt   -0,50 A
KLC Papr. edels.   1,49 B
Summe   30,17
Mastercard   30,17
Kaufland Card Punkte 12
MwSt A 19%   B 7%
`;
