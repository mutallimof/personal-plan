/**
 * The open/close sequence of the kitchen scene. The address says which cabinet should be open; this machine
 * keeps track of the animation in between.
 *
 *   idle --open--> opening --done--> open --back--> closing --done--> idle
 *
 * Opening another cabinet while one is open (or closing) starts opening that one. Going back while opening
 * turns around at once.
 */
export type Phase = "idle" | "opening" | "open" | "closing";

export type ViewState = { phase: Phase; key: string | null };

export type ViewEvent = { type: "open"; key: string } | { type: "back" } | { type: "done" };

export const INITIAL_VIEW: ViewState = { phase: "idle", key: null };

export function viewReducer(state: ViewState, event: ViewEvent): ViewState {
  switch (event.type) {
    case "open":
      if (state.key === event.key && (state.phase === "opening" || state.phase === "open"))
        return state;
      return { phase: "opening", key: event.key };
    case "back":
      return state.phase === "opening" || state.phase === "open"
        ? { phase: "closing", key: state.key }
        : state;
    case "done":
      if (state.phase === "opening") return { phase: "open", key: state.key };
      if (state.phase === "closing") return INITIAL_VIEW;
      return state;
  }
}

/** The cabinet whose inside is drawn: from the start of opening until the door has shut again. */
export const activeKey = (s: ViewState): string | null => (s.phase === "idle" ? null : s.key);

/** The cabinet the view is zoomed in on (or zooming towards). */
export const zoomedKey = (s: ViewState): string | null =>
  s.phase === "opening" || s.phase === "open" ? s.key : null;

export const MOTION_MS = 450;
export const REDUCED_MS = 160;

/** How long door and zoom take. With reduced motion there is only a short fade. */
export const motionMs = (reduced: boolean) => (reduced ? REDUCED_MS : MOTION_MS);
