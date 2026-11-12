import { describe, expect, it } from "vitest";
import { findClashes, type Box } from "./overlap";

const box = (kind: Box["kind"], x: number, y: number, width = 20, height = 10, name: string = kind): Box => ({ kind, name, x, y, width, height });

describe("findClashes", () => {
  it("finds text on text", () => {
    expect(findClashes([box("text", 0, 0), box("text", 10, 5)])).toHaveLength(1);
  });

  it("finds text on a badge, a button or a shelf line", () => {
    for (const other of ["badge", "button", "board"] as const) {
      expect(findClashes([box("text", 0, 0), box(other, 5, 5)])).toHaveLength(1);
    }
  });

  it("finds a label over a product picture, and a chip over another chip", () => {
    expect(findClashes([box("text", 0, 0), box("sprite", 5, 5)])).toHaveLength(1);
    expect(findClashes([box("badge", 0, 0), box("badge", 5, 5)])).toHaveLength(1);
  });

  it("finds a badge or a button cut by a shelf line", () => {
    expect(findClashes([box("badge", 0, 0), box("board", 0, 8, 50, 3)])).toHaveLength(1);
    expect(findClashes([box("button", 0, 0), box("board", 0, 8, 50, 3)])).toHaveLength(1);
  });

  it("lets things that only touch or sit apart be", () => {
    expect(findClashes([box("text", 0, 0), box("text", 20, 0)])).toEqual([]);
    expect(findClashes([box("text", 0, 0), box("text", 0, 10)])).toEqual([]);
    expect(findClashes([box("text", 0, 0), box("badge", 19.5, 0)])).toEqual([]); // under a pixel
    expect(findClashes([box("text", 0, 0), box("board", 0, 30)])).toEqual([]);
  });

  it("allows what is allowed to overlap: badges on pictures, badges next to buttons", () => {
    expect(findClashes([box("badge", 0, 0), box("sprite", 5, 5)])).toEqual([]);
    expect(findClashes([box("sprite", 0, 0), box("sprite", 5, 5)])).toEqual([]); // stacks overlap on purpose
    expect(findClashes([box("badge", 0, 0), box("button", 5, 5)])).toEqual([]);
    expect(findClashes([box("board", 0, 0), box("board", 5, 5)])).toEqual([]);
  });

  it("does not compare a box with itself and reports each pair once", () => {
    const a = box("text", 0, 0, 20, 10, "a");
    const b = box("text", 5, 5, 20, 10, "b");
    expect(findClashes([a])).toEqual([]);
    expect(findClashes([a, b, box("text", 100, 100)])).toEqual([{ a, b }]);
  });
});
