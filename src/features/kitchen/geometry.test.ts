import { describe, expect, it } from "vitest";
import { hitRect, idleBox, lerpBox, snapPan, zoomBox } from "./geometry";

const room = { width: 160, height: 100 };

describe("hitRect", () => {
  it("makes a small target at least 44 px on screen, around the same centre", () => {
    const r = hitRect({ x: 10, y: 20, width: 4, height: 3 }, 5);
    expect(r.width * 5).toBeGreaterThanOrEqual(44);
    expect(r.height * 5).toBeGreaterThanOrEqual(44);
    expect(r.x + r.width / 2).toBeCloseTo(12);
    expect(r.y + r.height / 2).toBeCloseTo(21.5);
  });
  it("leaves a big target alone", () => {
    const big = { x: 0, y: 0, width: 40, height: 30 };
    expect(hitRect(big, 5)).toEqual(big);
  });
  it("copes with an unknown scale", () => {
    const r = { x: 1, y: 2, width: 3, height: 4 };
    expect(hitRect(r, 0)).toEqual(r);
  });
});

describe("idleBox", () => {
  it("shows the whole room on a wide screen", () => {
    expect(idleBox(room, 2)).toEqual({ x: 0, y: 0, width: 160, height: 100 });
    expect(idleBox(room, 1.6)).toEqual({ x: 0, y: 0, width: 160, height: 100 });
  });
  it("shows a window as high as the room on a narrow one, kept inside the room", () => {
    expect(idleBox(room, 0.6, 30)).toEqual({ x: 30, y: 0, width: 60, height: 100 });
    expect(idleBox(room, 0.6, -50).x).toBe(0);
    expect(idleBox(room, 0.6, 500).x).toBe(100);
  });
});

describe("zoomBox", () => {
  const target = { x: 122, y: 34, width: 32, height: 56 };
  it("has the shape of the screen and contains the target with a margin", () => {
    const b = zoomBox(target, 0.6, room);
    expect(b.width / b.height).toBeCloseTo(0.6);
    expect(b.x).toBeLessThanOrEqual(target.x);
    expect(b.x + b.width).toBeGreaterThanOrEqual(target.x + target.width);
    expect(b.y).toBeLessThanOrEqual(target.y);
    expect(b.y + b.height).toBeGreaterThanOrEqual(target.y + target.height);
  });
  it("keeps the target below a reserved band at the top, whatever its place in the room", () => {
    for (const y of [0, 20, 34, 60]) {
      const t = { x: 60, y, width: 32, height: 30 };
      const b = zoomBox(t, 0.5, room, undefined, undefined, 0.1);
      expect(b.y + 0.1 * b.height).toBeLessThanOrEqual(t.y);
      expect(b.y + b.height).toBeGreaterThanOrEqual(t.y + t.height);
      expect(b.x).toBeLessThanOrEqual(t.x);
    }
  });
  it("is unchanged without a band", () => {
    expect(zoomBox(target, 0.6, room, undefined, undefined, 0)).toEqual(zoomBox(target, 0.6, room));
  });
  it("stays inside the room when it fits", () => {
    const b = zoomBox({ x: 0, y: 0, width: 20, height: 10 }, 1.6, room);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
  });
  it("centres on the target when it is wider than the room", () => {
    const b = zoomBox({ x: 0, y: 40, width: 160, height: 10 }, 0.5, room);
    expect(b.x + b.width / 2).toBeCloseTo(80);
  });
  it("uses the shape of the room when the screen shape is unknown", () => {
    expect(zoomBox(target, 0, room).width / zoomBox(target, 0, room).height).toBeCloseTo(1.6);
  });
});

describe("snapPan", () => {
  const areas = [
    { name: "Shelves", x: 0, width: 80 },
    { name: "Fridge", x: 80, width: 80 },
  ];
  it("centres the area nearest to the middle of the view", () => {
    expect(snapPan(areas, 5, 60, room)).toBe(10);
    expect(snapPan(areas, 90, 60, room)).toBe(90);
  });
  it("never leaves the room", () => {
    expect(snapPan(areas, 100, 60, room)).toBeLessThanOrEqual(100);
    expect(snapPan([{ name: "Edge", x: 0, width: 10 }], 0, 60, room)).toBe(0);
  });
  it("only keeps the position inside the room when there are no areas", () => {
    expect(snapPan([], 300, 60, room)).toBe(100);
  });
});

describe("lerpBox", () => {
  it("runs from one box to the other", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 10, y: 20, width: 20, height: 30 };
    expect(lerpBox(a, b, 0)).toEqual(a);
    expect(lerpBox(a, b, 1)).toEqual(b);
    expect(lerpBox(a, b, 0.5)).toEqual({ x: 5, y: 10, width: 15, height: 20 });
  });
});
