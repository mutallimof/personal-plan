import type { CSSProperties } from "react";
import type { Hotspot, Rect } from "./layout";

const OUTLINE = { stroke: "var(--k-line)", strokeWidth: 0.3, strokeLinejoin: "round" } as const;

type Motion = { open: boolean; reduced: boolean; ms: number };

/** A door that swings: seen from the front it narrows towards its hinge. With reduced motion it only fades. */
function swing(side: "left" | "right", { open, reduced, ms }: Motion): CSSProperties {
  return {
    transformBox: "fill-box",
    transformOrigin: `${side} center`,
    transform: open && !reduced ? "scaleX(0.08)" : "none",
    // Once swung open the door is gone: it must not leave a sliver over the inside.
    opacity: open ? 0 : 1,
    transition: reduced
      ? `opacity ${ms}ms linear`
      : open
        ? `transform ${ms}ms ease-in-out, opacity ${Math.round(ms * 0.35)}ms linear ${Math.round(ms * 0.65)}ms`
        : `transform ${ms}ms ease-in-out, opacity 60ms linear`,
    pointerEvents: open ? "none" : undefined,
  };
}

/** A drawer front that slides down and away. */
function slide(h: Rect, { open, reduced, ms }: Motion): CSSProperties {
  return {
    transform: open && !reduced ? `translateY(${h.height * 1.05}px)` : "none",
    opacity: open ? (reduced ? 0 : 0.0) : 1,
    transition: reduced
      ? `opacity ${ms}ms linear`
      : `transform ${ms}ms ease-in-out, opacity ${ms}ms ease-in`,
    pointerEvents: open ? "none" : undefined,
  };
}

function Front({ x, y, width, height, fill }: Rect & { fill: string }) {
  const m = Math.min(2, width * 0.12, height * 0.2);
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx={0.9} fill={fill} {...OUTLINE} />
      <rect
        x={x + m}
        y={y + m}
        width={Math.max(1, width - 2 * m)}
        height={Math.max(1, height - 2 * m)}
        rx={0.5}
        fill="none"
        stroke="var(--k-line)"
        strokeWidth={0.18}
        strokeOpacity={0.55}
      />
    </>
  );
}

function Handle({
  x,
  y,
  vertical,
  length,
}: {
  x: number;
  y: number;
  vertical: boolean;
  length: number;
}) {
  return vertical ? (
    <rect x={x} y={y} width={0.9} height={length} rx={0.45} fill="var(--k-brass)" {...OUTLINE} />
  ) : (
    <rect x={x} y={y} width={length} height={0.9} rx={0.45} fill="var(--k-brass)" {...OUTLINE} />
  );
}

function Hinged({ h, side, motion }: { h: Hotspot; side: "left" | "right"; motion: Motion }) {
  const tall = h.kind === "fridge" || h.kind === "freezer";
  const len = Math.min(tall ? 14 : 7, h.height * 0.35);
  const hx = side === "left" ? h.x + h.width - 3.4 : h.x + 2.5;
  return (
    <g data-door style={swing(side, motion)}>
      <Front
        x={h.x}
        y={h.y}
        width={h.width}
        height={h.height}
        fill={tall ? "var(--k-fridge)" : "var(--k-cabinet)"}
      />
      <Handle
        x={hx}
        y={tall && h.kind === "fridge" ? h.y + 4 : h.y + h.height / 2 - len / 2}
        vertical
        length={len}
      />
    </g>
  );
}

function Double({ h, motion }: { h: Hotspot; motion: Motion }) {
  const half = h.width / 2;
  const len = Math.min(7, h.height * 0.35);
  return (
    <g>
      <g style={swing("left", motion)}>
        <Front x={h.x} y={h.y} width={half} height={h.height} fill="var(--k-cabinet)" />
        <Handle x={h.x + half - 2.4} y={h.y + h.height / 2 - len / 2} vertical length={len} />
      </g>
      <g style={swing("right", motion)}>
        <Front x={h.x + half} y={h.y} width={half} height={h.height} fill="var(--k-cabinet)" />
        <Handle x={h.x + half + 1.5} y={h.y + h.height / 2 - len / 2} vertical length={len} />
      </g>
    </g>
  );
}

function Drawer({ h, motion }: { h: Hotspot; motion: Motion }) {
  const len = Math.min(12, h.width * 0.4);
  return (
    <g style={slide(h, motion)}>
      <Front x={h.x} y={h.y} width={h.width} height={h.height} fill="var(--k-cabinet)" />
      <Handle
        x={h.x + h.width / 2 - len / 2}
        y={h.y + h.height / 2 - 0.45}
        vertical={false}
        length={len}
      />
    </g>
  );
}

/** Glass doors: the contents stay visible. When the cabinet is opened the glass fades to let them through. */
function Glass({ h, open, reduced, ms }: { h: Hotspot } & Motion) {
  const half = h.width / 2;
  const pane = (x: number) => (
    <g>
      <rect
        x={x + 1.1}
        y={h.y + 1.1}
        width={half - 2.2}
        height={h.height - 2.2}
        rx={0.5}
        fill="var(--k-glass)"
        fillOpacity={0.38}
        stroke="var(--k-wood-dark)"
        strokeWidth={0.4}
      />
      <line
        x1={x + 2.6}
        y1={h.y + h.height * 0.55}
        x2={x + half * 0.62}
        y2={h.y + 3}
        stroke="#fff"
        strokeOpacity={0.55}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
    </g>
  );
  return (
    <g
      style={{
        opacity: open ? 0.14 : 1,
        transition: `opacity ${ms}ms ${reduced ? "linear" : "ease-in-out"}`,
        pointerEvents: "none",
      }}
    >
      <rect
        x={h.x}
        y={h.y}
        width={h.width}
        height={h.height}
        rx={1}
        fill="none"
        stroke="var(--k-wood-dark)"
        strokeWidth={1.2}
      />
      {pane(h.x)}
      {pane(h.x + half)}
      <circle
        cx={h.x + half - 1.6}
        cy={h.y + h.height / 2}
        r={0.7}
        fill="var(--k-brass)"
        {...OUTLINE}
      />
      <circle
        cx={h.x + half + 1.6}
        cy={h.y + h.height / 2}
        r={0.7}
        fill="var(--k-brass)"
        {...OUTLINE}
      />
    </g>
  );
}

/** The closed front of a cabinet, by door type. Open shelves have none. */
export function Door({ h, open, reduced, ms }: { h: Hotspot } & Motion) {
  const motion = { open, reduced, ms };
  switch (h.door) {
    case "hinged-left":
      return <Hinged h={h} side="left" motion={motion} />;
    case "hinged-right":
      return <Hinged h={h} side="right" motion={motion} />;
    case "double":
      return <Double h={h} motion={motion} />;
    case "drawer":
      return <Drawer h={h} motion={motion} />;
    case "glass":
      return <Glass h={h} {...motion} />;
    case "open-shelf":
      return null;
  }
}

/** Doors that hide the inside until opened. */
export const hidesInside = (h: Hotspot) => h.door !== "open-shelf" && h.door !== "glass";
