/**
 * Words that mean the same food, German and English, written folded (lower case, no accents, ä = a, ß = ss).
 * The first word of a group is the one the others turn into. A small table on purpose: it is easy to read, and a
 * wrong entry is easy to find. Add groups here when a food keeps being flagged as missing.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["sahne", "schlagsahne", "kochsahne", "rahm", "obers", "schlagobers", "cream", "creme"],
  ["milch", "vollmilch", "hmilch", "milk", "frischmilch"],
  ["butter", "markenbutter", "streichfett"],
  ["ei", "eier", "egg", "eggs"],
  ["zitrone", "lemon", "limone"],
  ["lachs", "lachsfilet", "salmon", "lachsfilets"],
  ["huhn", "hahnchen", "hahnchenbrust", "hahnchenbrustfilet", "huhnchen", "chicken", "poulet", "hahnchenfilet"],
  ["pute", "puten", "putenbrust", "turkey"],
  ["rind", "rindfleisch", "beef"],
  ["schwein", "schweinefleisch", "pork"],
  ["hack", "hackfleisch", "mince", "minced", "gehacktes"],
  ["kartoffel", "potato", "erdapfel"],
  ["tomate", "tomato", "rispentomate", "cherrytomate"],
  ["zwiebel", "onion"],
  ["knoblauch", "garlic"],
  ["gurke", "cucumber", "salatgurke"],
  ["karotte", "mohre", "moehre", "carrot", "mohren", "mohre"],
  ["paprika", "peperoni"],
  ["pilz", "champignon", "mushroom", "champignons"],
  ["apfel", "apple"],
  ["banane", "banana"],
  ["petersilie", "parsley"],
  ["basilikum", "basil"],
  ["schnittlauch", "chives"],
  ["dill", "dille"],
  ["kase", "kaese", "cheese"],
  ["joghurt", "yogurt", "yoghurt", "jogurt"],
  ["reis", "rice"],
  ["nudel", "pasta", "spaghetti", "penne", "nudeln"],
  ["mehl", "flour"],
  ["zucker", "sugar"],
  ["salz", "salt"],
  ["pfeffer", "pepper"],
  ["wasser", "water", "mineralwasser"],
  ["brot", "bread"],
  ["olivenol", "olivenoel", "oliveoil"],
  ["essig", "vinegar"],
  ["honig", "honey"],
  ["garnele", "shrimp", "shrimps", "prawn", "prawns", "garnelen"],
  ["thunfisch", "tuna"],
  ["spinat", "spinach"],
  ["brokkoli", "broccoli"],
  ["blumenkohl", "cauliflower"],
  ["zucchini", "courgette"],
  ["aubergine", "eggplant"],
  ["erbse", "pea", "peas"],
  ["bohne", "bean", "beans"],
  ["linse", "lentil", "lentils"],
  ["sauer", "saure", "sour"],
];

/**
 * Words that say nothing about which food it is: amounts, freshness, cuts, brands and receipt abbreviations.
 * They are dropped before names are compared ("Dill Bund" is "Dill", "Weih.Butter" is "Butter").
 */
export const NOISE_WORDS: ReadonlySet<string> = new Set([
  "bund", "bd", "stuck", "stk", "stuk", "pck", "pkg", "packung", "pack", "dose", "glas", "beutel", "ca", "circa",
  "frisch", "frische", "frischer", "frisches", "bio", "gross", "grosse", "klein", "kleine", "natur", "naturell",
  "fillet", "filet", "fillets", "filets", "breast", "brust", "whipping", "double", "heavy", "single", "fresh", "organic",
  "rot", "rote", "roter", "rotes", "weiss", "weisse", "gelb", "gelbe", "grun", "grune", "red", "white", "yellow", "green",
  "uht", "weih", "k", "kpur", "klc", "kbb", "ja", "gut", "und", "the", "of", "aus", "mit", "ohne", "tk",
  "fein", "feine", "mittel", "lose", "kg", "g", "ml", "l", "x",
]);
