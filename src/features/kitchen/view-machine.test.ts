import { describe, expect, it } from "vitest";
import {
  activeKey,
  INITIAL_VIEW,
  motionMs,
  MOTION_MS,
  REDUCED_MS,
  viewReducer,
  zoomedKey,
  type ViewEvent,
  type ViewState,
} from "./view-machine";

const run = (events: ViewEvent[], from: ViewState = INITIAL_VIEW) =>
  events.reduce(viewReducer, from);

describe("view machine", () => {
  it("opens, settles, goes back and settles again", () => {
    expect(run([{ type: "open", key: "fridge" }])).toEqual({ phase: "opening", key: "fridge" });
    expect(run([{ type: "open", key: "fridge" }, { type: "done" }])).toEqual({
      phase: "open",
      key: "fridge",
    });
    expect(run([{ type: "open", key: "fridge" }, { type: "done" }, { type: "back" }])).toEqual({
      phase: "closing",
      key: "fridge",
    });
    expect(
      run([{ type: "open", key: "fridge" }, { type: "done" }, { type: "back" }, { type: "done" }]),
    ).toEqual(INITIAL_VIEW);
  });

  it("turns around at once when going back while opening", () => {
    expect(run([{ type: "open", key: "a" }, { type: "back" }])).toEqual({
      phase: "closing",
      key: "a",
    });
  });

  it("goes straight to another cabinet, also while one is closing", () => {
    const open = run([{ type: "open", key: "a" }, { type: "done" }]);
    expect(run([{ type: "open", key: "b" }], open)).toEqual({ phase: "opening", key: "b" });
    const closing = run([{ type: "back" }], open);
    expect(run([{ type: "open", key: "a" }], closing)).toEqual({ phase: "opening", key: "a" });
  });

  it("ignores events that do nothing", () => {
    expect(run([{ type: "back" }])).toBe(INITIAL_VIEW);
    expect(run([{ type: "done" }])).toBe(INITIAL_VIEW);
    const opening = run([{ type: "open", key: "a" }]);
    expect(viewReducer(opening, { type: "open", key: "a" })).toBe(opening);
    const open = run([{ type: "done" }], opening);
    expect(viewReducer(open, { type: "done" })).toBe(open);
    expect(viewReducer(open, { type: "open", key: "a" })).toBe(open);
  });

  it("draws the inside until the door has shut, but zooms only while opening or open", () => {
    const closing: ViewState = { phase: "closing", key: "a" };
    expect(activeKey(closing)).toBe("a");
    expect(zoomedKey(closing)).toBeNull();
    expect(activeKey(INITIAL_VIEW)).toBeNull();
    expect(zoomedKey({ phase: "open", key: "a" })).toBe("a");
  });

  it("is quick with reduced motion", () => {
    expect(motionMs(false)).toBe(MOTION_MS);
    expect(motionMs(true)).toBe(REDUCED_MS);
    expect(MOTION_MS).toBeGreaterThanOrEqual(300);
    expect(MOTION_MS).toBeLessThanOrEqual(500);
    expect(REDUCED_MS).toBeLessThan(MOTION_MS);
  });
});
