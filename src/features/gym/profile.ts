type Parsed =
  | { ok: true; value: { height_cm: number | null; weight_kg: number | null; sessions_per_week: number | null } }
  | { ok: false; error: string };

function optionalNumber(raw: string, min: number, max: number): number | null | "bad" {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : "bad";
}

/** Validate the profile form. Empty fields are allowed and saved as null. */
export function parseProfileForm(f: { height: string; weight: string; perWeek: string }): Parsed {
  const height = optionalNumber(f.height, 100, 250);
  if (height === "bad") return { ok: false, error: "Height must be 100 to 250 cm" };
  const weight = optionalNumber(f.weight, 20, 400);
  if (weight === "bad") return { ok: false, error: "Weight must be 20 to 400 kg" };
  const perWeek = optionalNumber(f.perWeek, 1, 14);
  if (perWeek === "bad" || (perWeek != null && !Number.isInteger(perWeek)))
    return { ok: false, error: "Sessions per week must be 1 to 14" };
  return { ok: true, value: { height_cm: height, weight_kg: weight, sessions_per_week: perWeek } };
}
