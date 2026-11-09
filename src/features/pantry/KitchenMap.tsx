import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import {
  CANVAS,
  childrenOf,
  descendantIds,
  iconGrid,
  itemsInZone,
  moveZone,
  resizeZone,
  zoneAt,
  zoneDepth,
  type Zone,
} from "./kitchen";
import { CATEGORY_EMOJI, isCategory, type LocationKind, type PantryItem } from "./model";

const KIND_STYLE: Record<LocationKind, string> = {
  fridge: "fill-sky-50 stroke-sky-300",
  freezer: "fill-indigo-50 stroke-indigo-300",
  shelf: "fill-amber-50 stroke-amber-300",
  drawer: "fill-emerald-50 stroke-emerald-300",
  cupboard: "fill-orange-50 stroke-orange-300",
  other: "fill-slate-50 stroke-slate-300",
};

const emojiOf = (i: PantryItem) => (isCategory(i.category) ? CATEGORY_EMOJI[i.category] : CATEGORY_EMOJI.other);
const shorten = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s);
/** Pointer movement (in canvas units) below which a press counts as a tap. */
const TAP = 0.8;

type Drag =
  | { kind: "move" | "resize"; id: string; start: Point; before: Zone[] }
  | { kind: "item"; item: PantryItem; from: Zone; start: Point; moved: boolean };
type Point = { x: number; y: number };

type Props = {
  zones: readonly Zone[];
  items: readonly PantryItem[];
  selectedId: string | null;
  /** Show only this zone and what is inside it, filling the view. */
  zoomId: string | null;
  editing: boolean;
  onSelect: (id: string | null) => void;
  /** Called continuously while a zone is dragged or resized. */
  onDraft: (zones: Zone[]) => void;
  /** Called once when a drag or resize ends with a changed layout. */
  onCommit: (before: Zone[], after: Zone[]) => void;
  /** Called when an item is dropped on another zone. */
  onMoveItem: (item: PantryItem, target: Zone) => void;
};

export function KitchenMap({ zones, items, selectedId, zoomId, editing, onSelect, onDraft, onCommit, onMoveItem }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const draft = useRef<Zone[] | null>(null);
  const [ghost, setGhost] = useState<(Point & { emoji: string }) | null>(null);

  const visible = useMemo(() => {
    if (!zoomId) return [...zones];
    const inside = new Set([zoomId, ...descendantIds(zones, zoomId)]);
    return zones.filter((z) => inside.has(z.id));
  }, [zones, zoomId]);
  const ordered = useMemo(() => [...visible].sort((a, b) => zoneDepth(zones, a) - zoneDepth(zones, b)), [visible, zones]);
  const zoomed = zoomId ? zones.find((z) => z.id === zoomId) : undefined;
  const view = zoomed
    ? `${zoomed.x - 1.5} ${zoomed.y - 1.5} ${zoomed.width + 3} ${zoomed.height + 3}`
    : `0 0 ${CANVAS.width} ${CANVAS.height}`;

  function point(e: PointerEvent): Point {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function begin(e: PointerEvent, d: Drag) {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    drag.current = d;
    draft.current = null;
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.kind === "item") {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > TAP) d.moved = true;
      if (d.moved) setGhost({ ...p, emoji: emojiOf(d.item) });
      return;
    }
    const z = d.before.find((o) => o.id === d.id);
    if (!z) return;
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    const next = d.kind === "move" ? moveZone(d.before, d.id, dx, dy) : resizeZone(d.before, d.id, z.width + dx, z.height + dy);
    draft.current = next;
    onDraft(next);
  }

  function onUp(e: PointerEvent) {
    const d = drag.current;
    drag.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.kind === "item") {
      setGhost(null);
      if (!d.moved) {
        onSelect(d.from.id);
        return;
      }
      const p = point(e);
      const target = zoneAt(visible, p.x, p.y, d.from.id);
      if (target) onMoveItem(d.item, target);
      return;
    }
    if (draft.current) onCommit(d.before, draft.current);
    draft.current = null;
  }

  function onKey(e: KeyboardEvent, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  }

  return (
    <div className="aspect-[10/7] w-full overflow-hidden rounded-2xl border bg-card">
      <svg
        ref={svgRef}
        viewBox={view}
        preserveAspectRatio="xMidYMid meet"
        className={cn("h-full w-full select-none", editing && "touch-none")}
        role="group"
        aria-label="Kitchen"
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClick={() => onSelect(null)}
      >
        {ordered.map((z) => {
          const selected = z.id === selectedId;
          const kids = childrenOf(zones, z.id).length > 0;
          const own = itemsInZone(items, z);
          const grid = kids ? null : iconGrid(z, own.length);
          const top = !z.parent_id || z.id === zoomId;
          return (
            <g
              key={z.id}
              role="button"
              tabIndex={0}
              aria-label={`${z.name}, ${own.length} ${own.length === 1 ? "item" : "items"}`}
              aria-pressed={selected}
              className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-primary"
              onKeyDown={(e) => onKey(e, z.id)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(z.id);
              }}
              onPointerDown={editing ? (e) => begin(e, { kind: "move", id: z.id, start: point(e), before: [...zones] }) : undefined}
            >
              <rect
                x={z.x}
                y={z.y}
                width={z.width}
                height={z.height}
                rx={1.2}
                strokeWidth={selected ? 0.7 : 0.35}
                className={cn(KIND_STYLE[(z.kind as LocationKind) in KIND_STYLE ? (z.kind as LocationKind) : "other"], selected && "!stroke-primary")}
              />
              <text x={z.x + 1.2} y={z.y + 3} fontSize={top ? 2.4 : 2} fontWeight={600} className="fill-foreground">
                {shorten(z.name, Math.floor(z.width / (top ? 1.4 : 1.2)))}
              </text>
              {grid?.cells.map((c) => {
                const item = own[c.index];
                if (!item) return null;
                return (
                  <g
                    key={item.id}
                    className="cursor-grab touch-none"
                    onPointerDown={editing ? undefined : (e) => begin(e, { kind: "item", item, from: z, start: point(e), moved: false })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <title>{item.name}</title>
                    <text x={c.x + grid.size / 2} y={c.y + grid.size * 0.78} fontSize={grid.size * 0.8} textAnchor="middle">
                      {emojiOf(item)}
                    </text>
                  </g>
                );
              })}
              {grid?.badge && (
                <text x={grid.badge.x + grid.size / 2} y={grid.badge.y + grid.size * 0.7} fontSize={grid.size * 0.6} textAnchor="middle" className="fill-muted-foreground">
                  +{grid.overflow}
                </text>
              )}
              {grid && !grid.cells.length && grid.overflow > 0 && (
                <text x={z.x + z.width / 2} y={z.y + z.height - 0.8} fontSize={1.8} textAnchor="middle" className="fill-muted-foreground">
                  {grid.overflow}
                </text>
              )}
              {editing && selected && (
                <rect
                  x={z.x + z.width - 3}
                  y={z.y + z.height - 3}
                  width={3}
                  height={3}
                  rx={0.8}
                  className="cursor-nwse-resize fill-primary touch-none"
                  onPointerDown={(e) => begin(e, { kind: "resize", id: z.id, start: point(e), before: [...zones] })}
                  onClick={(e) => e.stopPropagation()}
                >
                  <title>Resize</title>
                </rect>
              )}
            </g>
          );
        })}
        {ghost && (
          <text x={ghost.x} y={ghost.y} fontSize={4} textAnchor="middle" opacity={0.85} pointerEvents="none">
            {ghost.emoji}
          </text>
        )}
      </svg>
    </div>
  );
}
