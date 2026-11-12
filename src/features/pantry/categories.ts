import type { LocationKind, Unit } from "./model";

/** The built-in categories. People can rename them and add their own in Settings (see `category-labels.ts`). */
export const BUILTIN_CATEGORIES = [
  "vegetables",
  "fruit",
  "meat",
  "poultry",
  "fish",
  "dairy",
  "eggs",
  "bakery",
  "dry goods",
  "canned",
  "sauces and condiments",
  "spices",
  "oils and fats",
  "snacks and sweets",
  "drinks",
  "frozen",
  "household",
  "other",
] as const;

export type BuiltinCategory = (typeof BUILTIN_CATEGORIES)[number];

export const isBuiltinCategory = (v: unknown): v is BuiltinCategory => BUILTIN_CATEGORIES.includes(v as BuiltinCategory);

/** Old names from before the category list changed. `produce` has no single answer, so it maps to "other". */
const LEGACY: Record<string, string> = {
  produce: "other",
  snacks: "snacks and sweets",
  spices: "spices",
};

/** Maps an old or imported category name onto the current list; unknown text is returned unchanged. */
export const legacyCategory = (v: string): string => LEGACY[v] ?? v;

/** Where a category usually lives, used when no place accepts it. */
export const CATEGORY_KIND: Record<BuiltinCategory, LocationKind> = {
  vegetables: "fridge",
  fruit: "fridge",
  meat: "fridge",
  poultry: "fridge",
  fish: "fridge",
  dairy: "fridge",
  eggs: "fridge",
  bakery: "shelf",
  "dry goods": "shelf",
  canned: "shelf",
  "sauces and condiments": "fridge",
  spices: "shelf",
  "oils and fats": "shelf",
  "snacks and sweets": "shelf",
  drinks: "shelf",
  frozen: "freezer",
  household: "cupboard",
  other: "shelf",
};

export const kindForCategory = (category: string): LocationKind =>
  isBuiltinCategory(category) ? CATEGORY_KIND[category] : "shelf";

export const CATEGORY_EMOJI: Record<BuiltinCategory, string> = {
  vegetables: "🥦",
  fruit: "🍎",
  meat: "🥩",
  poultry: "🍗",
  fish: "🐟",
  dairy: "🥛",
  eggs: "🥚",
  bakery: "🍞",
  "dry goods": "🌾",
  canned: "🥫",
  "sauces and condiments": "🍯",
  spices: "🧂",
  "oils and fats": "🫒",
  "snacks and sweets": "🍫",
  drinks: "🥤",
  frozen: "🧊",
  household: "🧽",
  other: "📦",
};

export const emojiForCategory = (category: string): string =>
  isBuiltinCategory(category) ? CATEGORY_EMOJI[category] : "📦";

/** Places that accept these categories by default, by place name (see `locations.ts`). */
export const DEFAULT_ACCEPTS: Record<string, readonly string[]> = {
  "Meat and fish": ["meat", "poultry", "fish"],
  "Dairy and eggs": ["dairy", "eggs"],
  "Vegetable drawer": ["vegetables"],
  "Fruit drawer": ["fruit"],
  "Drinks and sauces": ["drinks", "sauces and condiments"],
  "Dry-goods shelf": ["dry goods", "canned", "spices", "oils and fats", "snacks and sweets", "bakery"],
  Freezer: ["frozen"],
  "Frozen vegetables and fruit": ["frozen"],
};

/**
 * Keyword rules, German and English, first match wins. They only suggest a category for a product the
 * dictionary does not know; the person still confirms it. Words are matched inside compounds
 * ("Apfelsaft" is a drink, not a fruit, because drinks come first).
 */
const RULES: readonly (readonly [category: string, words: RegExp])[] = [
  [
    "household",
    /toipa|toilettenpapier|klopapier|k[uü]chenrolle|k[uü]chent[uü]ch|haushaltst[uü]ch|reiniger|sp[uü]lmittel|sp[uü]lmaschinen|waschmittel|weichsp[uü]ler|m[uü]llbeutel|m[uü]llsack|gefrierbeutel|alufolie|backpapier|frischhaltefolie|sp[uü]lschwamm|schwamm|taschent[uü]ch|zahnpasta|shampoo|duschgel|seife|deo\b|batterie|gl[uü]hbirne|kerze|windel|toilet paper|paper towel|detergent/i,
  ],
  ["frozen", /\btk\b|tiefk[uü]hl|tk-|pommes|frozen|\beis\b|eiscreme|ice cream/i],
  [
    "snacks and sweets",
    /schokolade|schoko|chips|kekse?\b|keks|gummib[aä]r|riegel|n[uü]sse|nuss\b|popcorn|bonbon|salzstangen|haribo|waffel|praline|lakritz|chocolate|cookie|candy/i,
  ],
  [
    "drinks",
    /wasser|saft\b|s[aä]fte|cola|limo|bier\b|wein\b|sprudel|\btee\b|kaffee|miwa|getr[aä]nk|schorle|fanta|sprite|energy|water|juice|beer|wine|coffee|\btea\b|mineral/i,
  ],
  ["canned", /\bdose\b|konserve|passierte|passata|kidney|mais\b|kichererbsen|thunfisch|tomatenmark|canned/i],
  ["sauces and condiments", /ketchup|senf\b|mayo|sauce|so[sß]e|pesto|essig|dressing|sambal|mustard|vinegar|sojasauce/i],
  ["spices", /gew[uü]rz|\bsalz\b|pfeffer|paprikapulver|zimt|curry|oregano|muskat|vanille|spice|cinnamon|\bsalt\b/i],
  ["oils and fats", /\böl\b|ö[l]\b|oel\b|olivenol|rapsol|sonnenblumenol|margarine|schmalz|kokosfett|\boil\b/i],
  ["poultry", /h[aä]hnchen|haehnchen|huhn|pute\b|puten|truthahn|ente\b|gans\b|brustfilet|chicken|turkey|geflügel|gefluegel/i],
  [
    "fish",
    /lachs|forelle|fisch|garnele|shrimp|hering|kabeljau|seelachs|makrele|salmon|fish|tuna|scholle|dorade/i,
  ],
  [
    "meat",
    /rind|schwein|hack\b|hackfleisch|wurst|schinken|salami|speck|steak|schnitzel|gulasch|lamm|bacon|beef|pork|fleisch|bratwurst|leberk[aä]se/i,
  ],
  ["eggs", /\beier\b|\bei\b|\beggs?\b/i],
  [
    "dairy",
    /milch|butter|sahne|joghurt|yoghurt|jogurt|quark|k[aä]se|gouda|mozzarella|skyr|schmand|frischk|kefir|parmesan|feta|cheese|cream|yogurt|milk/i,
  ],
  ["bakery", /brot|br[oö]tchen|toast|croissant|baguette|laugen|kuchen|brezel|bread|bagel/i],
  [
    "dry goods",
    /nudel|spaghetti|penne|fusilli|reis\b|mehl|zucker|haferflocken|m[uü]sli|linsen|couscous|cornflakes|semmelbr|pasta|rice|flour|sugar|oats|bulgur|gries/i,
  ],
  [
    "fruit",
    /apfel|[aä]pfel|banane|birne|orange|zitrone|limette|trauben|nektarine|pfirsich|erdbeer|himbeer|blaubeer|kirsche|melone|mango|ananas|kiwi|avocado|beere|mandarine|clementine|apple|grape|lemon|banana|pear|peach/i,
  ],
  [
    "vegetables",
    /tomate|gurke|paprika|peperoni|karotte|m[oö]hre|zwiebel|knoblauch|kartoffel|zucchini|champignon|pilz|salat|spinat|brokkoli|blumenkohl|lauch|porree|sellerie|kohl|rote bete|radieschen|spargel|aubergine|bohne|erbse|dill|petersilie|schnittlauch|basilikum|kr[aä]uter|potato|tomato|cucumber|carrot|onion|garlic|mushroom|lettuce/i,
  ],
];

/** Words that only point at non-food when the tax letter on the receipt is A (19%). Never enough on their own. */
const WEAK_HOUSEHOLD = /papier|tuch|t[uü]cher|rolle\b|beutel|tabs\b|folie|schwamm|b[uü]rste|tasche/i;

/** A suggested category for a product text, or null. `tax` is the letter printed after the price. */
export function guessCategory(text: string, tax: string | null = null): string | null {
  for (const [category, words] of RULES) if (words.test(text)) return category;
  if (tax === "A" && WEAK_HOUSEHOLD.test(text)) return "household";
  return null;
}

export const isNonFood = (category: string) => category === "household";

type Amount = { unit: Unit; quantity: number };

/** Default unit and quantity for a product that has no dictionary entry and no printed size. */
export function defaultAmount(name: string, category: string): Amount {
  const n = name.toLowerCase();
  if (/wasser|water|miwa|sprudel/.test(n)) return { unit: "l", quantity: 1 };
  if (/milch|milk/.test(n) && !/schokolade|kokos|hafer|reis/.test(n)) return { unit: "l", quantity: 1 };
  if (/butter/.test(n) && !/milch|keks/.test(n)) return { unit: "g", quantity: 250 };
  if (category === "eggs") return { unit: "pieces", quantity: 10 };
  if (category === "meat" || category === "poultry" || category === "fish") return { unit: "g", quantity: 500 };
  if (category === "drinks") return { unit: "l", quantity: 1 };
  if (category === "vegetables" || category === "fruit") return { unit: "pieces", quantity: 1 };
  return { unit: "pieces", quantity: 1 };
}
