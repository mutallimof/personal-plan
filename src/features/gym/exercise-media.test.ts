import { describe, expect, it } from "vitest";
import { exerciseImageUrls } from "./exercise-media";
import { EXERCISE_IMAGE_IDS } from "./exercise-images";

describe("exerciseImageUrls", () => {
  it("builds start and end URLs from the source id", () => {
    const urls = exerciseImageUrls("incline-db-press");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[0-9a-f]{40}\/exercises\/Incline_Dumbbell_Press\/0\.jpg$/);
    expect(urls[1]).toMatch(/Incline_Dumbbell_Press\/1\.jpg$/);
  });

  it("returns nothing for custom or unknown exercises", () => {
    expect(exerciseImageUrls("my-own-exercise")).toEqual([]);
    expect(exerciseImageUrls(null)).toEqual([]);
    expect(exerciseImageUrls(undefined)).toEqual([]);
    expect(exerciseImageUrls("")).toEqual([]);
  });

  it("does not match inherited object keys", () => {
    expect(exerciseImageUrls("constructor")).toEqual([]);
    expect(exerciseImageUrls("toString")).toEqual([]);
  });

  it("covers the imported dataset", () => {
    expect(Object.keys(EXERCISE_IMAGE_IDS).length).toBeGreaterThan(800);
  });
});
