import { describe, expect, it } from "vitest";
import { passwordProblem, resetRedirectUrl } from "./reset";

describe("resetRedirectUrl", () => {
  it("uses the current address, local or live", () => {
    expect(resetRedirectUrl("http://localhost:5173")).toBe("http://localhost:5173/reset-password");
    expect(resetRedirectUrl("https://personal-plan-nine.vercel.app/")).toBe(
      "https://personal-plan-nine.vercel.app/reset-password",
    );
  });
});

describe("passwordProblem", () => {
  it("rejects short and mismatching passwords", () => {
    expect(passwordProblem("abc", "abc")).toMatch(/6/);
    expect(passwordProblem("abcdef", "abcdeg")).toMatch(/match/);
    expect(passwordProblem("abcdef", "abcdef")).toBeNull();
  });
});
