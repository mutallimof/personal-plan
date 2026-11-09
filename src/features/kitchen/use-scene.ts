import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ease, lerpBox, type Box } from "./geometry";

/** True when the person asked their system for less motion. */
export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** Width and height of an element, kept up to date. Zero until it has been measured. */
export function useElementSize(ref: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

const same = (a: Box, b: Box) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * The box to draw, moving towards `target` over `ms`. With 0 it jumps. A new target during a move starts from
 * wherever the picture is at that moment.
 */
export function useAnimatedBox(target: Box, ms: number): Box {
  const [box, setBox] = useState(target);
  const current = useRef(box);
  current.current = box;

  useEffect(() => {
    if (same(current.current, target)) return;
    if (ms <= 0 || typeof requestAnimationFrame === "undefined") {
      setBox(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setBox(t >= 1 ? target : lerpBox(from, target, ease(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new box object with the same numbers must not restart the move
  }, [target.x, target.y, target.width, target.height, ms]);

  return box;
}
