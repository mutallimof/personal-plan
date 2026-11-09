/**
 * A name reduced to what should not matter when matching: case, accents, spacing and a plural "s"
 * ("Eggs" = "egg", "Tomatoes" = "tomato"). Used to match recipe ingredients to pantry items and nutrition rows.
 */
export function ingredientKey(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (folded.length > 4 && folded.endsWith("oes")) return folded.slice(0, -2);
  if (folded.length > 3 && folded.endsWith("s") && !folded.endsWith("ss")) return folded.slice(0, -1);
  return folded;
}

export const sameIngredient = (a: string, b: string): boolean => ingredientKey(a) === ingredientKey(b);
