import type { Area, Rect, Room } from "./layout";

/** A part of the room, in room units. Used as the SVG viewBox. */
export type Box = Rect;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Minimum size of a tap target, in screen pixels. */
export const MIN_TAP_PX = 44;

/**
 * The rectangle that reacts to a tap. At least `minPx` on screen in both directions, grown around the centre,
 * so a small drawer is still easy to hit on a phone.
 */
export function hitRect(r: Rect, pxPerUnit: number, minPx: number = MIN_TAP_PX): Rect {
  if (!(pxPerUnit > 0)) return r;
  const width = Math.max(r.width, minPx / pxPerUnit);
  const height = Math.max(r.height, minPx / pxPerUnit);
  return { width, height, x: r.x - (width - r.width) / 2, y: r.y - (height - r.height) / 2 };
}

/**
 * What is visible when nothing is open. A wide screen shows the whole room; a narrow one shows a window as
 * high as the room, which can be moved sideways with `panX`.
 */
export function idleBox(room: Pick<Room, "width" | "height">, aspect: number, panX = 0): Box {
  const whole = { x: 0, y: 0, width: room.width, height: room.height };
  if (!(aspect > 0) || aspect >= room.width / room.height) return whole;
  const width = room.height * aspect;
  return { x: clamp(panX, 0, room.width - width), y: 0, width, height: room.height };
}

/**
 * The view for looking into a rectangle: the rectangle plus a margin, grown to the screen's shape and kept
 * inside the room when it fits. `topFraction` reserves that share of the view's height at the top (for the back
 * button and the title): the rectangle is fitted into the part below it, so nothing drawn there is covered.
 */
export function zoomBox(
  target: Rect,
  aspect: number,
  room: Pick<Room, "width" | "height">,
  margin = 0.14,
  minWidth = 56,
  topFraction = 0,
): Box {
  const a = aspect > 0 ? aspect : room.width / room.height;
  const f = Math.min(0.4, Math.max(0, topFraction));
  const usable = 1 - f;
  let width = target.width * (1 + 2 * margin);
  let height = (target.height * (1 + 2 * margin)) / usable;
  if (width / height < a) width = height * a;
  else height = width / a;
  // a small cabinet is not blown up to the whole screen
  if (width < minWidth) {
    height *= minWidth / width;
    width = minWidth;
  }
  const fit = (start: number, size: number, limit: number) =>
    size >= limit ? (limit - size) / 2 : clamp(start, 0, limit - size);
  // the rectangle's centre goes to the middle of the part below the reserved band
  const cy = target.y + target.height / 2;
  const wantY = cy - (f * height + (usable * height) / 2);
  const y = f === 0 ? fit(wantY, height, room.height) : height >= room.height ? wantY : clamp(wantY, -f * height, room.height - height);
  return { width, height, x: fit(target.x + target.width / 2 - width / 2, width, room.width), y };
}

/** Where to move the narrow view so the nearest area sits in the middle of it. Without areas the position stays. */
export function snapPan(
  areas: readonly Area[],
  panX: number,
  viewWidth: number,
  room: Pick<Room, "width">,
): number {
  if (!areas.length) return clamp(panX, 0, Math.max(0, room.width - viewWidth));
  const centre = panX + viewWidth / 2;
  let best = areas[0] as Area;
  for (const a of areas)
    if (Math.abs(a.x + a.width / 2 - centre) < Math.abs(best.x + best.width / 2 - centre)) best = a;
  return clamp(best.x + best.width / 2 - viewWidth / 2, 0, Math.max(0, room.width - viewWidth));
}

export const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;

/** Ease-in-out for the zoom. */
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  width: a.width + (b.width - a.width) * t,
  height: a.height + (b.height - a.height) * t,
});
