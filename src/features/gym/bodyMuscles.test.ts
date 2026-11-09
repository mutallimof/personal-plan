import { describe, expect, it } from "vitest";
import { MUSCLE_TO_PACKAGE, highlightData } from "./bodyMuscles";

describe("highlightData", () => {
  it("maps primary to frequency 2 and secondary to frequency 1", () => {
    const d = highlightData(["chest"], ["shoulders-front", "triceps"]);
    expect(d).toEqual([
      { name: "primary", muscles: ["chest"], frequency: 2 },
      { name: "secondary", muscles: ["front-deltoids", "triceps"], frequency: 1 },
    ]);
  });

  it("lets primary win when mappings overlap", () => {
    const d = highlightData(["shoulders-front"], ["shoulders-side"]);
    expect(d[0]?.muscles).toEqual(["front-deltoids"]);
    expect(d[1]?.muscles).toEqual(["back-deltoids"]);
  });

  it("does not stack two secondaries on one region", () => {
    const d = highlightData([], ["shoulders-front", "shoulders-side"]);
    expect(d).toHaveLength(1);
    expect(d[0]?.frequency).toBe(1);
  });

  it("returns no highlights for exercises without a muscle match", () => {
    expect(highlightData([], [])).toEqual([]);
    expect(highlightData(["neck"], [])).toEqual([]);
  });

  it("covers every muscle id used by the exercise data", () => {
    for (const id of ["chest","shoulders-front","shoulders-side","shoulders-rear","biceps","triceps","forearms","abs","obliques","lats","upper-back","traps","lower-back","glutes","quads","hamstrings","calves"]) {
      expect(MUSCLE_TO_PACKAGE[id]?.length).toBeGreaterThan(0);
    }
  });
});

import { PACKAGE_TO_MUSCLES, matchesRegion } from "./bodyMuscles";

describe("region filter", () => {
  it("matches exercises whose primary muscles belong to the tapped region", () => {
    expect(matchesRegion(["lats"], "upper-back")).toBe(true);
    expect(matchesRegion(["shoulders-side"], "front-deltoids")).toBe(true);
    expect(matchesRegion(["shoulders-side"], "back-deltoids")).toBe(true);
    expect(matchesRegion(["quads"], "hamstring")).toBe(false);
  });
  it("ignores regions with no exercise data", () => {
    expect(matchesRegion(["chest"], "neck")).toBe(false);
  });
  it("only points at muscle ids that the forward mapping knows", () => {
    for (const ids of Object.values(PACKAGE_TO_MUSCLES)) for (const id of ids!) expect(MUSCLE_TO_PACKAGE[id]).toBeDefined();
  });
});
