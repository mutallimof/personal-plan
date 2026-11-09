import { describe, expect, it } from "vitest";
import { clearPlanCache, readPlanCache, writePlanCache } from "./plan-cache";

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("plan cache", () => {
  it("returns what was written for the same user", () => {
    const s = memory();
    writePlanCache(s, "u1", [{ id: "a" }]);
    expect(readPlanCache(s, "u1")).toEqual([{ id: "a" }]);
  });
  it("never returns another user's plan", () => {
    const s = memory();
    writePlanCache(s, "u1", [{ id: "a" }]);
    expect(readPlanCache(s, "u2")).toBeNull();
  });
  it("is empty after clearing and ignores corrupt data", () => {
    const s = memory();
    writePlanCache(s, "u1", []);
    clearPlanCache(s);
    expect(readPlanCache(s, "u1")).toBeNull();
    s.setItem("lifeplan:plan-cache", "{not json");
    expect(readPlanCache(s, "u1")).toBeNull();
  });
  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => writePlanCache(broken, "u1", [])).not.toThrow();
    expect(readPlanCache(broken, "u1")).toBeNull();
    expect(() => clearPlanCache(broken)).not.toThrow();
  });
});
