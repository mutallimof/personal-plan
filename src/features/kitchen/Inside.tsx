import type { KeyboardEvent, PointerEvent } from "react";
import type { PantryItem } from "@/features/pantry/model";
import { iconUrl } from "@/features/pantry/icons/registry";
import { badgeText, BOARD, cavity, expiryDot, layOutRow, type Row, type Sprite } from "./interior";
import type { Hotspot } from "./layout";

const OUTLINE = { stroke: "var(--k-line)", strokeWidth: 0.25, strokeLinejoin: "round" } as const;

export type SpriteHandlers = {
  onPointerDown: (e: PointerEvent<SVGGElement>, item: PantryItem, sprite: Sprite) => void;
  onPointerMove: (e: PointerEvent<SVGGElement>) => void;
  onPointerUp: (e: PointerEvent<SVGGElement>) => void;
  onKey: (e: KeyboardEvent<SVGGElement>, item: PantryItem) => void;
};

type SpriteProps = {
  sprite: Sprite;
  icon: string;
  today: Date;
  highlight: boolean;
  dimmed?: boolean;
  handlers?: SpriteHandlers;
};

/** One product: its picture (a small stack for several), a quantity badge and an expiry dot. */
export function ProductSprite({ sprite, icon, today, highlight, dimmed, handlers }: SpriteProps) {
  const { item, size, stack, x, y } = sprite;
  const step = size * 0.28;
  const width = size + (stack - 1) * step;
  const dot = expiryDot(item, today);
  const text = badgeText(item);
  const fs = size * 0.27;
  const bw = Math.max(size * 0.36, text.length * fs * 0.62 + size * 0.14);
  const bh = size * 0.34;
  return (
    <g
      transform={`translate(${x} ${y})`}
      data-item={item.id}
      role={handlers ? "button" : undefined}
      tabIndex={handlers ? 0 : undefined}
      aria-label={`${item.name}, ${text}`}
      opacity={dimmed ? 0.35 : 1}
      style={{
        cursor: handlers ? "grab" : "default",
        touchAction: "none",
        pointerEvents: handlers ? "auto" : "none",
      }}
      onPointerDown={handlers ? (e) => handlers.onPointerDown(e, item, sprite) : undefined}
      onPointerMove={handlers?.onPointerMove}
      onPointerUp={handlers?.onPointerUp}
      onPointerCancel={handlers?.onPointerUp}
      onKeyDown={handlers ? (e) => handlers.onKey(e, item) : undefined}
    >
      <rect x={-0.5} y={-0.5} width={width + 1} height={size + 1} fill="transparent" />
      {highlight && (
        <rect
          x={-0.8}
          y={-0.8}
          width={width + 1.6}
          height={size + 1.6}
          rx={1.4}
          fill="none"
          stroke="var(--k-highlight)"
          strokeWidth={0.6}
          className="k-pulse"
        />
      )}
      <ellipse
        cx={width / 2}
        cy={size + 0.1}
        rx={width * 0.45}
        ry={size * 0.07}
        fill="var(--k-shadow)"
      />
      {Array.from({ length: stack }, (_, k) => {
        const i = stack - 1 - k;
        return (
          <image
            key={i}
            href={iconUrl(icon)}
            x={i * step}
            y={-i * size * 0.06}
            width={size}
            height={size}
          />
        );
      })}
      {dot && (
        <circle
          cx={width - size * 0.08}
          cy={size * 0.1}
          r={size * 0.11}
          fill={dot === "expired" ? "var(--k-expired)" : "var(--k-soon)"}
          stroke="var(--k-badge)"
          strokeWidth={0.25}
        />
      )}
      <g transform={`translate(${width - bw + size * 0.08} ${size - bh + size * 0.04})`}>
        <rect width={bw} height={bh} rx={bh / 2} fill="var(--k-badge)" {...OUTLINE} />
        <text
          x={bw / 2}
          y={bh / 2}
          fontSize={fs}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--k-badge-text)"
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {text}
        </text>
      </g>
    </g>
  );
}

type InteriorProps = {
  hotspot: Hotspot;
  rows: readonly Row[];
  contents: ReadonlyMap<string, PantryItem[]>;
  /** Draw everything (opened) or only the first few products per row (seen from afar). */
  full: boolean;
  today: Date;
  iconOf: (item: PantryItem) => string;
  highlightId: string | null;
  draggingId: string | null;
  handlers: SpriteHandlers | undefined;
  onAdd: (row: Row) => void;
};

const IDLE_LIMIT = 4;

/** The inside of a cabinet: back wall, boards, drawers and the products standing on them. */
export function Interior({
  hotspot: h,
  rows,
  contents,
  full,
  today,
  iconOf,
  highlightId,
  draggingId,
  handlers,
  onAdd,
}: InteriorProps) {
  const inner = cavity(h);
  const back =
    h.kind === "fridge"
      ? "var(--k-fridge-in)"
      : h.kind === "freezer"
        ? "var(--k-freezer-in)"
        : "var(--k-inside)";
  const shortest = rows.length ? Math.min(...rows.map((r) => r.rect.height)) : inner.height;
  const labelSize = Math.min(2.3, Math.max(1.3, shortest * 0.32));
  return (
    <g>
      <rect
        x={h.x}
        y={h.y}
        width={h.width}
        height={h.height}
        rx={1}
        fill="var(--k-wood)"
        {...OUTLINE}
      />
      <rect
        x={inner.x}
        y={inner.y}
        width={inner.width}
        height={inner.height}
        fill={back}
        stroke="var(--k-wood-dark)"
        strokeWidth={0.3}
      />
      {rows.map((r) => {
        const items = contents.get(r.id) ?? [];
        const showLabel = r.label !== null && (full || h.compartments.length > 0);
        // products stand below the label
        const below = showLabel ? labelSize * 0.9 : 0;
        const stand = { ...r.rect, y: r.rect.y + below, height: r.rect.height - below };
        const { sprites, overflow, more } = layOutRow(items, stand, full ? Infinity : IDLE_LIMIT);
        return (
          <g key={r.id} data-row={r.id}>
            {r.kind === "drawer" ? (
              <rect
                x={r.rect.x}
                y={r.rect.y + r.rect.height * 0.12}
                width={r.rect.width}
                height={r.rect.height * 0.88}
                rx={0.8}
                fill="var(--k-glass)"
                fillOpacity={0.3}
                {...OUTLINE}
              />
            ) : r.kind === "door" ? (
              <rect
                x={r.rect.x}
                y={r.rect.y}
                width={r.rect.width}
                height={r.rect.height}
                rx={0.6}
                fill="var(--k-inside-dark)"
                fillOpacity={0.4}
                {...OUTLINE}
              />
            ) : null}
            {sprites.map((s) => (
              <ProductSprite
                key={s.item.id}
                sprite={s}
                icon={iconOf(s.item)}
                today={today}
                highlight={highlightId === s.item.id}
                dimmed={draggingId === s.item.id}
                {...(full && handlers ? { handlers } : {})}
              />
            ))}
            {more && (
              <text
                x={more.x + more.width / 2}
                y={more.y + more.height / 2}
                fontSize={more.height * 0.4}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--k-label)"
                fontWeight={600}
              >
                +{overflow}
              </text>
            )}
            <rect
              x={r.rect.x}
              y={r.rect.y + r.rect.height - BOARD}
              width={r.rect.width}
              height={BOARD}
              rx={0.3}
              fill="var(--k-wood)"
              {...OUTLINE}
            />
            {showLabel && (
              <text
                x={r.rect.x + 1}
                y={r.rect.y + labelSize}
                fontSize={labelSize}
                fill="var(--k-label)"
                fontWeight={600}
                style={{ pointerEvents: "none" }}
              >
                {r.label}
              </text>
            )}
            {full && items.length === 0 && (
              <g>
                <text
                  x={r.rect.x + r.rect.width - 7}
                  y={r.rect.y + r.rect.height / 2}
                  fontSize={labelSize}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill="var(--k-label)"
                  fillOpacity={0.7}
                >
                  Empty
                </text>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`Add item to ${r.label ?? h.name}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => onAdd(r)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAdd(r)}
                >
                  <circle
                    cx={r.rect.x + r.rect.width - 3}
                    cy={r.rect.y + r.rect.height / 2}
                    r={Math.max(2, Math.min(3.2, r.rect.height / 2.6))}
                    fill="var(--k-badge)"
                    {...OUTLINE}
                  />
                  <text
                    x={r.rect.x + r.rect.width - 3}
                    y={r.rect.y + r.rect.height / 2}
                    fontSize={3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--k-badge-text)"
                    style={{ pointerEvents: "none" }}
                  >
                    +
                  </text>
                </g>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
