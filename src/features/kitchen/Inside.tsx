import type { KeyboardEvent, PointerEvent } from "react";
import type { PantryItem } from "@/features/pantry/model";
import { iconUrl } from "@/features/pantry/icons/registry";
import { badgeText, BOARD, cavity, expiryDot, labelSizeFor, layOutRow, LINE, PAD, rowParts, type Row, type Sprite } from "./interior";
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
  const fs = Math.max(size * 0.27, 1.1);
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
            data-sprite
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
      <g data-badge transform={`translate(${width - bw + size * 0.08} ${size - bh - 0.3})`}>
        <rect width={bw} height={bh} rx={bh / 2} fill="var(--k-badge)" {...OUTLINE} />
        <text
          data-badge-text
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
  /** A shelf or drawer was tapped (only when opened). */
  onOpenRow?: (row: Row) => void;
};

const IDLE_LIMIT = 4;
/** Rows lower than this have no room for the "Empty" text and the add button. */
const MIN_EMPTY_ZONE = 3.2;

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
  onOpenRow,
}: InteriorProps) {
  const inner = cavity(h);
  const labelSizeAll = labelSizeFor(rows);
  const back =
    h.kind === "fridge"
      ? "var(--k-fridge-in)"
      : h.kind === "freezer"
        ? "var(--k-freezer-in)"
        : "var(--k-inside)";
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
        const labeled = r.label !== null && (full || h.compartments.length > 0);
        const { side, stand, labelSize, lines } = rowParts(r.rect, labeled ? labelSizeAll : 0, r.label ?? "");
        const { sprites, overflow, more } = layOutRow(items, stand, full ? Infinity : IDLE_LIMIT);
        const boardY = r.rect.y + r.rect.height - BOARD;
        // the height above the board, where products stand
        const zone = stand.height - BOARD;
        const fs = Math.min(2.4, Math.max(1.3, zone * 0.34));
        const button = Math.min(3, Math.max(1.3, zone / 2 - 0.5));
        const midY = stand.y + zone / 2;
        return (
          <g key={r.id} data-row={r.id}>
            {r.kind === "drawer" ? (
              <rect
                x={stand.x + 0.4}
                y={stand.y}
                width={stand.width - 0.8}
                height={zone}
                rx={0.8}
                fill="var(--k-glass)"
                fillOpacity={0.3}
                {...OUTLINE}
              />
            ) : r.kind === "door" ? (
              <rect
                x={stand.x + 0.4}
                y={stand.y}
                width={stand.width - 0.8}
                height={zone}
                rx={0.6}
                fill="var(--k-inside-dark)"
                fillOpacity={0.4}
                {...OUTLINE}
              />
            ) : null}
            {full && onOpenRow && (
              <rect
                data-row-hit={r.id}
                x={r.rect.x}
                y={r.rect.y}
                width={r.rect.width}
                height={r.rect.height}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={`Open ${r.label ?? h.name} list`}
                style={{ cursor: "pointer" }}
                onClick={() => onOpenRow(r)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenRow(r)}
              />
            )}
            {sprites.map((sp) => (
              <ProductSprite
                key={sp.item.id}
                sprite={sp}
                icon={iconOf(sp.item)}
                today={today}
                highlight={highlightId === sp.item.id}
                dimmed={draggingId === sp.item.id}
                {...(full && handlers ? { handlers } : {})}
              />
            ))}
            {more && (
              <text
                data-more
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
              data-board
              x={r.rect.x}
              y={boardY}
              width={r.rect.width}
              height={BOARD}
              rx={0.3}
              fill="var(--k-wood)"
              {...OUTLINE}
            />
            {side && (
              <text
                data-label
                x={side.x + side.width - PAD}
                y={side.y + side.height / 2 - ((lines.length - 1) * labelSize * LINE) / 2}
                fontSize={labelSize}
                textAnchor="end"
                dominantBaseline="central"
                fill="var(--k-label)"
                fontWeight={600}
                style={{ pointerEvents: "none" }}
              >
                {lines.map((line, i) => (
                  <tspan key={i} x={side.x + side.width - PAD} dy={i === 0 ? 0 : labelSize * LINE}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
            {full && items.length === 0 && zone >= MIN_EMPTY_ZONE && (
              <g>
                <text
                  data-empty
                  x={stand.x + PAD + 0.6}
                  y={midY}
                  fontSize={fs}
                  dominantBaseline="central"
                  fill="var(--k-label)"
                  fillOpacity={0.7}
                >
                  Empty
                </text>
                <g
                  data-button
                  role="button"
                  tabIndex={0}
                  aria-label={`Add item to ${r.label ?? h.name}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => onAdd(r)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onAdd(r)}
                >
                  <circle
                    cx={stand.x + stand.width - PAD - button}
                    cy={midY}
                    r={Math.min(button + 1.2, zone / 2 - 0.1)}
                    fill="transparent"
                  />
                  <circle
                    cx={stand.x + stand.width - PAD - button}
                    cy={midY}
                    r={button}
                    fill="var(--k-badge)"
                    {...OUTLINE}
                  />
                  <text
                    x={stand.x + stand.width - PAD - button}
                    y={midY}
                    fontSize={button * 1.3}
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
