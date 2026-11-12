/** Which full-screen sheet is open on the Pantry screen, kept in the address so the browser back button closes it. */
export const SHEETS = ["receipt", "cook", "items", "settings"] as const;
export type Sheet = (typeof SHEETS)[number];

export const SETTINGS_SECTIONS = ["appearance", "dictionary", "categories", "nutrition", "ai", "layout"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export type PantrySearch = {
  sheet?: Sheet | undefined;
  /** Settings page to show; none means the list. */
  section?: SettingsSection | undefined;
  /** Text typed in the search box. */
  q?: string | undefined;
  /** Key of the cabinet that is open. */
  open?: string | undefined;
  /** Id of the item to highlight inside it. */
  item?: string | undefined;
};

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined => list.find((x) => x === v);
const text = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.slice(0, 80) : undefined);

/** Reads the address query; anything unknown is dropped. */
export function parsePantrySearch(raw: Record<string, unknown>): PantrySearch {
  const sheet = oneOf(SHEETS, raw["sheet"]);
  const section = sheet === "settings" ? oneOf(SETTINGS_SECTIONS, raw["section"]) : undefined;
  return { sheet, section, q: text(raw["q"]), open: text(raw["open"]), item: text(raw["item"]) };
}

/** Where the old tab addresses go now. */
export function legacyTarget(path: "receipt" | "cook" | "dictionary" | "kitchen"): PantrySearch {
  switch (path) {
    case "receipt":
      return { sheet: "receipt" };
    case "cook":
      return { sheet: "cook" };
    case "dictionary":
      return { sheet: "settings", section: "dictionary" };
    case "kitchen":
      return {};
  }
}
