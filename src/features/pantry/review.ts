import type { Alias, AliasDraft } from "./aliases";
import { isIconKey } from "./icons/registry";
import type { NewItem } from "./data";
import { defaultAmount, isNonFood, kindForCategory, legacyCategory } from "./categories";
import { accepts, pickPlace } from "./locations";
import { draftFromCorrection } from "./learn";
import { matchAlias, type Match } from "./match";
import { isCategory, isLocationKind, isUnit, type Category, type LocationKind, type PantryLocation, type Unit } from "./model";
import { displayName, normalizeReceiptText } from "./normalize";
import type { Suggestion } from "./ai-suggest";
import type { IgnoredLine, ParsedLine } from "./receipt";
import { roundQty } from "./items";
import { LOW_CONFIDENCE } from "./ocr";

export type ReviewStatus = "matched" | "uncertain" | "unknown";

/** One receipt line on the review screen, with the values that would be saved. */
export type ReviewLine = {
  id: string;
  rawText: string;
  /** How many were bought, as printed. */
  count: number;
  /** The receipt gave a weight. */
  weighed: boolean;
  status: ReviewStatus;
  /** OCR confidence of the source line (0-100), or null for text that was not read from a photo. */
  confidence: number | null;
  /** Matched lines start confirmed, unless OCR was unsure of them. The others stay highlighted until confirmed, edited or skipped. */
  confirmed: boolean;
  skip: boolean;
  /** Left out because it is not food. The person can switch "Track anyway" on. */
  autoSkip: boolean;
  /** Price after discounts, shown on the line. */
  price: number | null;
  /** Changed by hand (or confirmed as a correction), so it is written back to the dictionary. */
  edited: boolean;
  /** A guess from the optional AI check. Only used when the person accepts it. */
  suggestion: Suggestion | null;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  locationId: string | null;
  /** Picture from the matched dictionary entry; the saved item keeps it. */
  icon: string | null;
};

type Fields = Pick<ReviewLine, "name" | "quantity" | "unit" | "category" | "locationId" | "icon">;

function fieldsFor(line: ParsedLine, alias: Alias | null, locations: readonly PantryLocation[]): Fields {
  const text = line.text ?? line.raw_text;
  const category = alias && isCategory(alias.category) ? legacyCategory(alias.category) : (line.guess ?? "other");
  const name = alias?.product_name ?? (displayName(text) || text);
  let unit: Unit;
  let quantity: number;
  if (line.unit !== null) {
    // A printed weight, size or piece count wins over the dictionary default.
    unit = line.unit;
    quantity = line.quantity;
  } else if (alias) {
    unit = isUnit(alias.default_unit) ? alias.default_unit : "pieces";
    quantity = roundQty((alias.default_quantity ?? 1) * line.quantity);
  } else {
    const d = defaultAmount(name, category);
    unit = d.unit;
    quantity = roundQty(d.quantity * line.quantity);
  }
  const wanted = alias && isLocationKind(alias.default_location_kind) ? alias.default_location_kind : null;
  return {
    name,
    unit,
    quantity,
    category,
    locationId: pickPlace(locations, category, wanted, kindForCategory(category))?.id ?? null,
    icon: alias && isIconKey(alias.icon) ? alias.icon : null,
  };
}

/**
 * Dictionary match for a parsed line: the text as printed first (so entries written for a store's own-brand
 * names still match), then the text without prefix and size. An exact match from either wins.
 */
export function matchLine(aliases: readonly Alias[], p: ParsedLine, store: string | null): Match {
  const first = matchAlias(aliases, p.raw_text, store);
  if (first.kind === "exact" || !p.text || p.text === p.raw_text) return first;
  const second = matchAlias(aliases, p.text, store);
  if (second.kind === "exact") return second;
  if (first.kind === "none") return second;
  if (second.kind === "none") return first;
  return first.score >= second.score ? first : second;
}

/** The OCR was unsure about this line, so its text (and with it the match) may be wrong. */
export const isLowConfidence = (l: Pick<ReviewLine, "confidence">) => l.confidence !== null && l.confidence < LOW_CONFIDENCE;

/**
 * Review lines for a parsed receipt: unknown lines first, then uncertain, then low-confidence ones, then the
 * rest, each group in receipt order. `confidence` maps source line numbers to OCR confidence.
 */
export function buildReview(
  parsed: readonly ParsedLine[],
  aliases: readonly Alias[],
  store: string | null,
  locations: readonly PantryLocation[],
  confidence: ReadonlyMap<number, number> = new Map(),
): ReviewLine[] {
  const lines = parsed.map((p): ReviewLine => {
    const m = matchLine(aliases, p, store);
    const alias = m.kind === "none" ? null : m.alias;
    const conf = confidence.get(p.lineNo) ?? null;
    const fields = fieldsFor(p, alias, locations);
    const nonFood = isNonFood(fields.category);
    return {
      id: String(p.lineNo),
      rawText: p.raw_text,
      count: p.quantity,
      weighed: p.unit !== null,
      status: m.kind === "exact" ? "matched" : m.kind === "uncertain" ? "uncertain" : "unknown",
      confidence: conf,
      confirmed: m.kind === "exact" && !isLowConfidence({ confidence: conf }),
      skip: nonFood,
      autoSkip: nonFood,
      price: p.total_price,
      edited: false,
      suggestion: null,
      ...fields,
    };
  });
  const rank = (l: ReviewLine) => (l.status === "unknown" ? 0 : l.status === "uncertain" ? 1 : l.confirmed ? 3 : 2);
  return lines
    .map((l, i) => ({ l, i }))
    .sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i)
    .map(({ l }) => l);
}

/** Changes fields by hand. Editing counts as confirming. */
export function editLine(l: ReviewLine, patch: Partial<Fields>, locations?: readonly PantryLocation[]): ReviewLine {
  // A different name is a different product, so the matched entry's picture no longer fits.
  const renamed = patch.name !== undefined && patch.name !== l.name;
  const next: ReviewLine = { ...l, ...(renamed ? { icon: null } : {}), ...patch, edited: true, confirmed: true };
  if (patch.category !== undefined && patch.category !== l.category) {
    // Another category: leave "not food" behind, and move to a place that takes the new category.
    if (l.autoSkip && !isNonFood(patch.category)) {
      next.skip = false;
      next.autoSkip = false;
    }
    if (patch.locationId === undefined && locations) {
      const here = locations.find((p) => p.id === l.locationId);
      if (!here || !accepts(here, patch.category)) next.locationId = pickPlace(locations, patch.category, null, kindForCategory(patch.category))?.id ?? null;
    }
  }
  return next;
}

/** A line that was left out of the review, put back as a product to be reviewed. */
export function restoreLine(
  ignored: IgnoredLine,
  aliases: readonly Alias[],
  store: string | null,
  locations: readonly PantryLocation[],
): ReviewLine | null {
  if (!ignored.restore) return null;
  const [line] = buildReview([ignored.restore], aliases, store, locations);
  // The person asked for it, so it is tracked and still has to be confirmed.
  return line ? { ...line, skip: false, autoSkip: false, confirmed: false } : null;
}

/** Attaches AI suggestions to the unknown lines they answer. Nothing else about the lines changes. */
export function withSuggestions(lines: readonly ReviewLine[], suggestions: readonly Suggestion[]): ReviewLine[] {
  const byText = new Map(suggestions.map((s) => [s.text, s]));
  return lines.map((l) => {
    const suggestion = l.status === "unknown" ? byText.get(normalizeReceiptText(l.rawText)) : undefined;
    return suggestion ? { ...l, suggestion } : l;
  });
}

/** Fills the line from its suggestion. This is the person accepting it, so it counts as an edit. */
export function applySuggestion(l: ReviewLine, locations: readonly PantryLocation[]): ReviewLine {
  const s = l.suggestion;
  if (!s) return l;
  return { ...editLine(l, { name: s.name, category: s.category, locationId: pickPlace(locations, s.category, s.kind, kindForCategory(s.category))?.id ?? null }), suggestion: null };
}

export const confirmLine = (l: ReviewLine): ReviewLine => ({ ...l, confirmed: true });

export const toggleSkip = (l: ReviewLine): ReviewLine => ({ ...l, skip: !l.skip, autoSkip: false });

/** Lines still waiting for a person to confirm, edit or skip them. */
export const unresolvedCount = (lines: readonly ReviewLine[]) => lines.filter((l) => !l.skip && !l.confirmed).length;

/** Why a line cannot be saved yet, or null. */
export function lineProblem(l: ReviewLine): string | null {
  if (!l.name.trim()) return "Name is empty";
  if (!(l.quantity > 0)) return "Quantity must be above 0";
  return null;
}

export function canSave(lines: readonly ReviewLine[]): boolean {
  const active = lines.filter((l) => !l.skip);
  return active.length > 0 && unresolvedCount(lines) === 0 && active.every((l) => lineProblem(l) === null);
}

/** Pantry items for the lines that are not skipped. */
export function itemsToSave(lines: readonly ReviewLine[]): NewItem[] {
  return lines
    .filter((l) => !l.skip)
    .map((l) => ({
      name: l.name.trim(),
      quantity: l.quantity,
      unit: l.unit,
      category: l.category,
      location_id: l.locationId,
      icon: l.icon,
    }));
}

function kindOf(locations: readonly PantryLocation[], id: string | null): LocationKind | null {
  const kind = locations.find((p) => p.id === id)?.kind;
  return isLocationKind(kind) ? kind : null;
}

/**
 * Dictionary entries to write after saving: every line that was not an exact match, and every matched
 * line that was changed. Skipped lines teach nothing.
 */
export function aliasesToLearn(
  lines: readonly ReviewLine[],
  store: string | null,
  locations: readonly PantryLocation[],
): AliasDraft[] {
  const drafts: AliasDraft[] = [];
  for (const l of lines) {
    if (l.skip || (l.status === "matched" && !l.edited)) continue;
    const draft = draftFromCorrection({
      rawText: l.rawText,
      store,
      name: l.name,
      category: l.category,
      placeKind: kindOf(locations, l.locationId),
      unit: l.unit,
      quantity: l.quantity,
      count: l.count,
      weighed: l.weighed,
    });
    if (draft) drafts.push(draft);
  }
  return drafts;
}
