import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { iconForItem } from "@/features/pantry/icons/registry";
import type { PantryItem, PantryLocation } from "@/features/pantry/model";
import { Backdrop, Sunlight } from "./Backdrop";
import { contentsOf } from "./contents";
import { Door, hidesInside } from "./Doors";
import { contains, hitRect, idleBox, snapPan, zoomBox } from "./geometry";
import { Interior, ProductSprite, type SpriteHandlers } from "./Inside";
import { interiorRows, rowAt, type Row, type Sprite } from "./interior";
import type { Hotspot, Layout } from "./layout";
import "./scene-theme.css";
import { useAnimatedBox, useElementSize, usePrefersReducedMotion } from "./use-scene";
import { activeKey, INITIAL_VIEW, motionMs, viewReducer, zoomedKey } from "./view-machine";

export type SceneProps = {
  layout: Layout;
  items: readonly PantryItem[];
  locations: readonly PantryLocation[];
  aliasIcons: ReadonlyMap<string, string>;
  /** Cabinet that should be open (from the address). */
  openKey: string | null;
  highlightItemId: string | null;
  onOpen: (key: string) => void;
  onClose: () => void;
  onSelectItem: (item: PantryItem) => void;
  /** An item was dropped on a row of the open cabinet. */
  onDropOnRow: (item: PantryItem, hotspot: Hotspot, row: Row) => void;
  /** An item was dropped outside the open cabinet: pick another place. */
  onDropOutside: (item: PantryItem) => void;
  onAdd: (hotspot: Hotspot, row: Row) => void;
  /** A shelf or drawer of the open cabinet was tapped. */
  onOpenRow?: (hotspot: Hotspot, row: Row) => void;
};

const DRAG_PX = 6;
/** Height in pixels of the back button and title above a zoomed cabinet; the cabinet is fitted below it. */
const TITLE_BAND = 68;

export function KitchenScene(p: SceneProps) {
  const { layout, openKey } = p;
  const { room } = layout;
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const size = useElementSize(frame);
  const reduced = usePrefersReducedMotion();
  const ms = motionMs(reduced);
  const today = useMemo(() => new Date(), []);
  const aspect =
    size.width > 0 && size.height > 0 ? size.width / size.height : room.width / room.height;

  const [view, dispatch] = useReducer(viewReducer, INITIAL_VIEW);
  useEffect(() => {
    if (openKey && layout.hotspots.some((h) => h.key === openKey))
      dispatch({ type: "open", key: openKey });
    else dispatch({ type: "back" });
  }, [openKey, layout]);
  useEffect(() => {
    if (view.phase !== "opening" && view.phase !== "closing") return;
    const t = setTimeout(() => dispatch({ type: "done" }), ms);
    return () => clearTimeout(t);
  }, [view, ms]);

  const [pan, setPan] = useState(0);
  const [panning, setPanning] = useState(false);
  const zoomed = zoomedKey(view);
  const active = activeKey(view);
  const zoomedSpot = layout.hotspots.find((h) => h.key === zoomed);
  const target = zoomedSpot ? zoomBox(zoomedSpot, aspect, room, undefined, undefined, size.height > 0 ? TITLE_BAND / size.height : 0) : idleBox(room, aspect, pan);
  const box = useAnimatedBox(target, panning ? 0 : ms);
  const pxPerUnit = size.width > 0 ? size.width / box.width : 0;

  const contents = useMemo(
    () => contentsOf(layout, p.items, p.locations),
    [layout, p.items, p.locations],
  );
  const rowsOf = useMemo(
    () => new Map(layout.hotspots.map((h) => [h.key, interiorRows(h)])),
    [layout],
  );
  const iconOf = (item: PantryItem) => iconForItem(item, p.aliasIcons);

  // ----- panning on a narrow screen -----
  const panStart = useRef<{ x: number; pan: number; moved: boolean } | null>(null);
  const justPanned = useRef(false);
  const narrow = box.width < room.width - 0.01 || idleBox(room, aspect).width < room.width;
  const onFramePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (zoomed || !narrow) return;
    panStart.current = { x: e.clientX, pan, moved: false };
  };
  const onFramePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = panStart.current;
    if (!s || pxPerUnit <= 0) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < DRAG_PX) return;
    if (!s.moved) {
      s.moved = true;
      setPanning(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setPan(idleBox(room, aspect, s.pan - dx / pxPerUnit).x);
  };
  const onFramePointerUp = () => {
    const s = panStart.current;
    panStart.current = null;
    if (!s?.moved) return;
    justPanned.current = true;
    setTimeout(() => (justPanned.current = false), 0);
    setPanning(false);
    setPan((x) => snapPan(layout.areas, x, idleBox(room, aspect).width, room));
  };

  // ----- dragging a product -----
  const [drag, setDrag] = useState<{ sprite: Sprite; x: number; y: number } | null>(null);
  const press = useRef<{
    item: PantryItem;
    sprite: Sprite;
    sx: number;
    sy: number;
    moved: boolean;
  } | null>(null);
  const toScene = (cx: number, cy: number) => {
    const el = svg.current;
    const m = el?.getScreenCTM?.();
    if (!el || !m) return null;
    const pt = el.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const q = pt.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  };
  const handlers: SpriteHandlers = {
    onPointerDown: (e, item, sprite) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      press.current = { item, sprite, sx: e.clientX, sy: e.clientY, moved: false };
    },
    onPointerMove: (e) => {
      const s = press.current;
      if (!s) return;
      if (!s.moved && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < DRAG_PX) return;
      s.moved = true;
      const pt = toScene(e.clientX, e.clientY);
      if (pt)
        setDrag({ sprite: s.sprite, x: pt.x - s.sprite.size / 2, y: pt.y - s.sprite.size / 2 });
    },
    onPointerUp: (e) => {
      const s = press.current;
      press.current = null;
      setDrag(null);
      if (!s) return;
      if (!s.moved) {
        p.onSelectItem(s.item);
        return;
      }
      const pt = toScene(e.clientX, e.clientY);
      const h = layout.hotspots.find((x) => x.key === active);
      if (!pt || !h) return;
      const row = rowAt(rowsOf.get(h.key) ?? [], pt.x, pt.y);
      if (row) p.onDropOnRow(s.item, h, row);
      else if (!contains(h, pt.x, pt.y)) p.onDropOutside(s.item);
    },
    onKey: (e: KeyboardEvent<SVGGElement>, item) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        p.onSelectItem(item);
      }
    },
  };

  const open = (h: Hotspot) => {
    if (justPanned.current) return;
    p.onOpen(h.key);
  };

  return (
    <div
      ref={frame}
      className="kitchen-scene relative h-[min(68dvh,34rem)] w-full touch-pan-y select-none overflow-hidden rounded-3xl border bg-[var(--k-wall)] md:aspect-[8/5] md:h-auto"
      onPointerDown={onFramePointerDown}
      onPointerMove={onFramePointerMove}
      onPointerUp={onFramePointerUp}
      onPointerCancel={onFramePointerUp}
    >
      <svg
        ref={svg}
        role="group"
        aria-label="Kitchen"
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <rect
          x={0}
          y={0}
          width={room.width}
          height={room.height}
          fill="transparent"
          data-backdrop
          onClick={() => zoomed && p.onClose()}
        />
        <Backdrop layout={layout} />
        {layout.hotspots.map((h) => {
          const isActive = active === h.key;
          // while one cabinet is open, the others show nothing: their pictures would sit under the title and back button
          const shows = isActive || (!zoomed && !hidesInside(h));
          const hit = hitRect(h, pxPerUnit);
          const doorOpen = isActive && (view.phase === "opening" || view.phase === "open");
          return (
            <g key={h.key} data-hotspot={h.key}>
              {shows && (
                <Interior
                  hotspot={h}
                  rows={rowsOf.get(h.key) ?? []}
                  contents={contents.get(h.key) ?? new Map()}
                  full={isActive}
                  today={today}
                  iconOf={iconOf}
                  highlightId={p.highlightItemId}
                  draggingId={drag?.sprite.item.id ?? null}
                  handlers={zoomed === h.key ? handlers : undefined}
                  onAdd={(row) => p.onAdd(h, row)}
                  {...(p.onOpenRow ? { onOpenRow: (row: Row) => p.onOpenRow?.(h, row) } : {})}
                />
              )}
              <Door h={h} open={doorOpen} reduced={reduced} ms={ms} />
              {!zoomed && !isActive && (
                <rect
                  x={hit.x}
                  y={hit.y}
                  width={hit.width}
                  height={hit.height}
                  fill="transparent"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${h.name}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => open(h)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(h)}
                />
              )}
            </g>
          );
        })}
        {drag && (
          <ProductSprite
            sprite={{ ...drag.sprite, x: drag.x, y: drag.y }}
            icon={iconOf(drag.sprite.item)}
            today={today}
            highlight={false}
          />
        )}
        <Sunlight layout={layout} />
      </svg>

      {zoomedSpot && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-11 w-11 rounded-full shadow"
            aria-label="Back"
            onClick={p.onClose}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span data-overlay-text className="rounded-full bg-background/90 px-3 py-1.5 text-sm font-medium shadow">
            {zoomedSpot.name}
          </span>
        </div>
      )}
    </div>
  );
}
