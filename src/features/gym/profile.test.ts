import { describe, expect, it } from "vitest";
import { parseProfileForm } from "./profile";

describe("parseProfileForm", () => {
  it("parses valid numbers, including a decimal comma", () => {
    expect(parseProfileForm({ height: "180", weight: "82,5", perWeek: "4" })).toEqual({
      ok: true,
      value: { height_cm: 180, weight_kg: 82.5, sessions_per_week: 4 },
    });
  });
  it("saves empty fields as null", () => {
    expect(parseProfileForm({ height: "", weight: " ", perWeek: "" })).toEqual({
      ok: true,
      value: { height_cm: null, weight_kg: null, sessions_per_week: null },
    });
  });
  it("rejects values out of range or not numbers", () => {
    expect(parseProfileForm({ height: "50", weight: "", perWeek: "" }).ok).toBe(false);
    expect(parseProfileForm({ height: "", weight: "abc", perWeek: "" }).ok).toBe(false);
    expect(parseProfileForm({ height: "", weight: "", perWeek: "0" }).ok).toBe(false);
    expect(parseProfileForm({ height: "", weight: "", perWeek: "3.5" }).ok).toBe(false);
  });
});
