import { describe, expect, it } from "vitest";
import { formatAmount, tidyAmount, unitLabel } from "./amounts";

describe("tidyAmount", () => {
  it("moves amounts to the nearer unit", () => {
    expect(tidyAmount(0.554, "kg")).toEqual({ quantity: 554, unit: "g" });
    expect(tidyAmount(1500, "g")).toEqual({ quantity: 1.5, unit: "kg" });
    expect(tidyAmount(0.5, "l")).toEqual({ quantity: 500, unit: "ml" });
    expect(tidyAmount(1000, "ml")).toEqual({ quantity: 1, unit: "l" });
    expect(tidyAmount(250, "g")).toEqual({ quantity: 250, unit: "g" });
    expect(tidyAmount(3, "pieces")).toEqual({ quantity: 3, unit: "pieces" });
  });
});

describe("unit labels", () => {
  it("uses singular and plural", () => {
    expect(formatAmount(1, "pieces")).toBe("1 piece");
    expect(formatAmount(20, "pieces")).toBe("20 pieces");
    expect(formatAmount(1, "pack")).toBe("1 pack");
    expect(formatAmount(2, "pack")).toBe("2 packs");
    expect(formatAmount(0, "pieces")).toBe("0 pieces");
    expect(unitLabel("l", 2)).toBe("l");
  });

  it("shows grams and litres in the nearer unit", () => {
    expect(formatAmount(1500, "g")).toBe("1.5 kg");
    expect(formatAmount(0.25, "l")).toBe("250 ml");
    expect(formatAmount(500, "g")).toBe("500 g");
  });
});
