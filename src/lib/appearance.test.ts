import { describe, expect, it } from "vitest";
import { APPEARANCE_SCRIPT, DEFAULT_APPEARANCE, isDark, parseAppearance } from "./appearance";

describe("parseAppearance", () => {
  it("falls back to the default for nothing, rubbish and unknown values", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("not json")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("null")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance(JSON.stringify({ theme: "neon", mode: "dim" }))).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps a known theme and mode", () => {
    expect(parseAppearance(JSON.stringify({ theme: "clay", mode: "dark" }))).toEqual({ theme: "clay", mode: "dark" });
    expect(parseAppearance(JSON.stringify({ theme: "tide" }))).toEqual({ theme: "tide", mode: "system" });
  });
});

describe("isDark", () => {
  it("follows the system only in system mode", () => {
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
    expect(isDark("light", true)).toBe(false);
    expect(isDark("dark", false)).toBe(true);
  });
});

describe("APPEARANCE_SCRIPT", () => {
  it("is valid JavaScript", () => {
    expect(() => new Function(APPEARANCE_SCRIPT)).not.toThrow();
  });
});
