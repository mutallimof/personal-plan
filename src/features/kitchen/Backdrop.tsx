import { counterEnd as counterEndOf, WORKTOP_TOP, type Decor, type Layout } from "./layout";

const OUTLINE = { stroke: "var(--k-line)", strokeWidth: 0.3, strokeLinejoin: "round" } as const;

function Cooker({ x, y, width: w, height: h }: Decor) {
  const knobs = [0.2, 0.4, 0.6, 0.8];
  return (
    <g>
      <rect
        x={x}
        y={y + 3}
        width={w}
        height={h - 3}
        rx={1.2}
        fill="var(--k-appliance)"
        {...OUTLINE}
      />
      <rect
        x={x - 0.6}
        y={y}
        width={w + 1.2}
        height={3.2}
        rx={0.9}
        fill="var(--k-hob)"
        {...OUTLINE}
      />
      {knobs.map((k) => (
        <circle key={k} cx={x + w * k} cy={y + 6.4} r={1.15} fill="var(--k-brass)" {...OUTLINE} />
      ))}
      <rect
        x={x + 3}
        y={y + 10}
        width={w - 6}
        height={h - 15}
        rx={1.6}
        fill="var(--k-appliance)"
        {...OUTLINE}
      />
      <rect
        x={x + 5.5}
        y={y + 14}
        width={w - 11}
        height={h - 24}
        rx={1.2}
        fill="var(--k-oven-glass)"
        {...OUTLINE}
      />
      <rect
        x={x + 6}
        y={y + 11.4}
        width={w - 12}
        height={1.2}
        rx={0.6}
        fill="var(--k-brass)"
        {...OUTLINE}
      />
      {/* a pot with a lid on the hob */}
      <rect
        x={x + 4}
        y={y - 6.5}
        width={11}
        height={6.5}
        rx={1.2}
        fill="var(--k-terracotta)"
        {...OUTLINE}
      />
      <rect
        x={x + 3.4}
        y={y - 7.8}
        width={12.2}
        height={1.5}
        rx={0.7}
        fill="var(--k-terracotta)"
        {...OUTLINE}
      />
      <circle cx={x + 9.5} cy={y - 8.6} r={0.8} fill="var(--k-brass)" {...OUTLINE} />
      {/* a small pan */}
      <rect
        x={x + 19}
        y={y - 2.4}
        width={9}
        height={2.4}
        rx={0.8}
        fill="var(--k-label)"
        {...OUTLINE}
      />
      <rect
        x={x + 27.6}
        y={y - 1.9}
        width={5.6}
        height={0.9}
        rx={0.4}
        fill="var(--k-wood-dark)"
        {...OUTLINE}
      />
    </g>
  );
}

function Hood({ x, y, width: w, height: h }: Decor) {
  return (
    <g>
      <rect
        x={x + w / 2 - 4}
        y={0}
        width={8}
        height={y + 1}
        fill="var(--k-appliance)"
        {...OUTLINE}
      />
      <polygon
        points={`${x + 3},${y} ${x + w - 3},${y} ${x + w},${y + h} ${x},${y + h}`}
        fill="var(--k-appliance)"
        {...OUTLINE}
      />
      <line
        x1={x + 1}
        y1={y + h - 2.2}
        x2={x + w - 1}
        y2={y + h - 2.2}
        stroke="var(--k-brass)"
        strokeWidth={0.7}
        strokeLinecap="round"
      />
    </g>
  );
}

function Window({ x, y, width: w, height: h }: Decor) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={1}
        fill="var(--k-glass)"
        stroke="var(--k-wood-dark)"
        strokeWidth={1}
      />
      <line
        x1={x + w / 2}
        y1={y}
        x2={x + w / 2}
        y2={y + h}
        stroke="var(--k-wood-dark)"
        strokeWidth={0.7}
      />
      <line
        x1={x}
        y1={y + h / 2}
        x2={x + w}
        y2={y + h / 2}
        stroke="var(--k-wood-dark)"
        strokeWidth={0.7}
      />
    </g>
  );
}

function Plant({ x, y, width: w, height: h }: Decor) {
  const pot = h * 0.4;
  const top = y + h - pot;
  return (
    <g>
      <ellipse cx={x + w * 0.5} cy={y + h} rx={w * 0.46} ry={0.55} fill="var(--k-shadow)" />
      <ellipse
        cx={x + w * 0.3}
        cy={top - h * 0.28}
        rx={w * 0.18}
        ry={h * 0.32}
        fill="var(--k-leaf)"
        transform={`rotate(-24 ${x + w * 0.3} ${top - h * 0.28})`}
        {...OUTLINE}
      />
      <ellipse
        cx={x + w * 0.7}
        cy={top - h * 0.3}
        rx={w * 0.18}
        ry={h * 0.34}
        fill="var(--k-leaf)"
        transform={`rotate(22 ${x + w * 0.7} ${top - h * 0.3})`}
        {...OUTLINE}
      />
      <ellipse
        cx={x + w * 0.5}
        cy={top - h * 0.4}
        rx={w * 0.17}
        ry={h * 0.38}
        fill="var(--k-leaf)"
        {...OUTLINE}
      />
      <polygon
        points={`${x + w * 0.12},${top} ${x + w * 0.88},${top} ${x + w * 0.76},${y + h} ${x + w * 0.24},${y + h}`}
        fill="var(--k-terracotta)"
        {...OUTLINE}
      />
    </g>
  );
}

const DECOR = { cooker: Cooker, hood: Hood, window: Window, plant: Plant } as const;

/** The room itself: wall tiles, floor, worktop, the fridge-freezer body, and decoration. No inventory here. */
export function Backdrop({ layout }: { layout: Layout }) {
  const { room } = layout;
  const tall = layout.hotspots.filter((h) => h.kind === "fridge" || h.kind === "freezer");
  const left = tall.length ? Math.min(...tall.map((h) => h.x)) : room.width;
  const right = tall.length ? Math.max(...tall.map((h) => h.x + h.width)) : 0;
  const top = tall.length ? Math.min(...tall.map((h) => h.y)) : 0;
  const bottom = tall.length ? Math.max(...tall.map((h) => h.y + h.height)) : 0;
  const counterEnd = counterEndOf(layout);
  const { worktopY, floorY } = room;

  return (
    <g aria-hidden>
      <defs>
        <pattern id="k-tiles" width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="var(--k-wall)" />
          <rect
            x={0.35}
            y={0.35}
            width={7.3}
            height={7.3}
            rx={1.1}
            fill="none"
            stroke="var(--k-wall-line)"
            strokeWidth={0.28}
          />
        </pattern>
      </defs>
      <rect x={0} y={0} width={room.width} height={room.height} fill="url(#k-tiles)" />
      <rect x={0} y={0} width={room.width} height={3.2} fill="var(--k-ceiling)" />
      <line
        x1={0}
        y1={3.2}
        x2={room.width}
        y2={3.2}
        stroke="var(--k-wall-line)"
        strokeWidth={0.4}
      />
      <rect
        x={0}
        y={floorY}
        width={room.width}
        height={room.height - floorY}
        fill="var(--k-floor)"
      />
      <line
        x1={0}
        y1={floorY}
        x2={room.width}
        y2={floorY}
        stroke="var(--k-line)"
        strokeWidth={0.3}
      />

      {/* base carcass: the frame around the doors and drawers */}
      <rect
        x={1.5}
        y={worktopY + 1.4}
        width={counterEnd - 1.5}
        height={floorY - worktopY - 2.6}
        fill="var(--k-cabinet-panel)"
        {...OUTLINE}
      />
      <rect x={1.5} y={floorY - 1.4} width={counterEnd - 1.5} height={1.4} fill="var(--k-plinth)" />
      <rect
        x={0.5}
        y={worktopY - WORKTOP_TOP}
        width={counterEnd}
        height={3.4}
        rx={0.7}
        fill="var(--k-worktop)"
        {...OUTLINE}
      />

      {tall.length > 0 && (
        <rect
          x={left - 1.6}
          y={top - 1.6}
          width={right - left + 3.2}
          height={bottom - top + 3.2}
          rx={2}
          fill="var(--k-appliance)"
          {...OUTLINE}
        />
      )}

      {layout.decor.map((d, i) => {
        const Art = DECOR[d.type];
        return <Art key={`${d.type}-${i}`} {...d} />;
      })}
    </g>
  );
}

/** A soft diagonal beam of sunlight over the whole scene. It never takes taps. */
export function Sunlight({ layout }: { layout: Layout }) {
  const { width: w, height: h } = layout.room;
  return (
    <g pointerEvents="none" aria-hidden style={{ opacity: "var(--k-sun-opacity)" }}>
      <polygon
        points={`${w * 0.1},0 ${w * 0.42},0 ${w * 0.72},${h} ${w * 0.4},${h}`}
        fill="var(--k-sun)"
      />
      <polygon
        points={`${w * 0.5},0 ${w * 0.58},0 ${w * 0.88},${h} ${w * 0.8},${h}`}
        fill="var(--k-sun)"
      />
    </g>
  );
}
