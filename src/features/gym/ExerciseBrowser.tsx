import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { PersonStanding, Search, Star, X } from "lucide-react";
import type { Muscle } from "react-body-highlighter";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Empty, Loading, QueryError } from "@/components/states";
import { BodyMap } from "./BodyMap";
import { matchesRegion } from "./bodyMuscles";
import { EQUIPMENT, MUSCLE_GROUPS, exercisesQuery, type Exercise } from "./data";
import { popularRank } from "./popular";

const ROW_HEIGHT = 64;
const OVERSCAN = 6;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 shrink-0 rounded-full border px-4 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-accent text-accent-foreground"
          : "bg-background text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

const byPopularThenName = (a: Exercise, b: Exercise) => {
  const ra = popularRank(a.slug);
  const rb = popularRank(b.slug);
  if (ra !== rb) return (ra === -1 ? Infinity : ra) - (rb === -1 ? Infinity : rb);
  return a.name.localeCompare(b.name);
};

function ExerciseRow({ e, onPick }: { e: Exercise; onPick?: ((e: Exercise) => void) | undefined }) {
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-medium">{e.name}</span>
        {popularRank(e.slug) !== -1 && (
          <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label="popular" />
        )}
      </span>
      <span className="truncate text-xs capitalize text-muted-foreground">
        {e.equipment} · {e.primary_muscles.join(", ").replace(/-/g, " ") || e.muscle_group}
      </span>
    </>
  );
  const cls = "flex h-full w-full flex-col justify-center gap-0.5 px-4 text-left";
  return onPick ? (
    <button type="button" className={cls} onClick={() => onPick(e)}>
      {inner}
    </button>
  ) : (
    <Link to="/gym/exercise/$id" params={{ id: e.id }} search={{ item: undefined }} className={cls}>
      {inner}
    </Link>
  );
}

/** Fixed-row-height windowed list: only the rows in view are in the DOM, so ~900 items stay fast. */
function VirtualList({
  items,
  onPick,
}: {
  items: Exercise[];
  onPick?: ((e: Exercise) => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.clientHeight);
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // New results: start from the top.
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [items]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN);

  return (
    <div
      ref={ref}
      onScroll={(ev) => setScrollTop(ev.currentTarget.scrollTop)}
      className="h-[60vh] min-h-72 overflow-y-auto tile"
      role="list"
      aria-label="Exercises"
    >
      {items.length === 0 ? (
        <div className="p-4">
          <Empty>No exercises found.</Empty>
        </div>
      ) : (
        <div style={{ height: items.length * ROW_HEIGHT, position: "relative" }}>
          {items.slice(start, end).map((e, i) => (
            <div
              key={e.id}
              role="listitem"
              className="absolute inset-x-0 border-b last:border-b-0"
              style={{ top: (start + i) * ROW_HEIGHT, height: ROW_HEIGHT }}
            >
              <ExerciseRow e={e} onPick={onPick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExerciseBrowser({
  onPick,
  bodyFilter,
}: {
  onPick?: (e: Exercise) => void;
  bodyFilter?: boolean;
}) {
  const { data, isLoading, isError, refetch } = useQuery(exercisesQuery);
  const [region, setRegion] = useState<Muscle | null>(null);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const deferredQ = useDeferredValue(q.trim().toLowerCase());

  const sorted = useMemo(() => [...(data ?? [])].sort(byPopularThenName), [data]);

  const list = useMemo(() => {
    const words = deferredQ.split(/\s+/).filter(Boolean);
    return sorted.filter((e) => {
      if (group && e.muscle_group !== group) return false;
      if (equip && e.equipment !== equip) return false;
      if (region && !matchesRegion(e.primary_muscles, region)) return false;
      if (!words.length) return true;
      const hay = `${e.name} ${e.primary_muscles.join(" ")} ${e.family}`
        .toLowerCase()
        .replace(/-/g, " ");
      return words.every((w) => hay.includes(w));
    });
  }, [sorted, deferredQ, group, equip, region]);

  if (isLoading) return <Loading rows={4} className="h-16" />;
  if (isError) return <QueryError onRetry={() => refetch()} />;

  return (
    <div className={bodyFilter ? "gap-6 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start" : ""}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-10"
            placeholder="Search exercises or muscles"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
              {g}
            </Chip>
          ))}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {EQUIPMENT.map((g) => (
            <Chip key={g} active={equip === g} onClick={() => setEquip(equip === g ? null : g)}>
              {g}
            </Chip>
          ))}
        </div>
        {bodyFilter && (
          <div className="flex gap-2 lg:hidden">
            <Chip active={bodyOpen || !!region} onClick={() => setBodyOpen(!bodyOpen)}>
              <span className="inline-flex items-center gap-1.5">
                <PersonStanding className="h-4 w-4" /> Body
              </span>
            </Chip>
            {region && (
              <Chip active onClick={() => setRegion(null)}>
                <span className="inline-flex items-center gap-1.5">
                  {region.replace(/-/g, " ")} <X className="h-3.5 w-3.5" aria-label="Clear" />
                </span>
              </Chip>
            )}
          </div>
        )}
        {bodyFilter && bodyOpen && (
          <div className="lg:hidden">
            <BodyMap compact selected={region} onSelect={setRegion} />
          </div>
        )}
        <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
          {list.length} {list.length === 1 ? "exercise" : "exercises"}
          {!deferredQ && !group && !equip && " · popular first"}
        </p>
        <VirtualList items={list} onPick={onPick} />
      </div>
      {bodyFilter && (
        <aside className="sticky top-6 hidden space-y-2 lg:block">
          <BodyMap compact selected={region} onSelect={setRegion} />
          {region && (
            <Chip active onClick={() => setRegion(null)}>
              <span className="inline-flex items-center gap-1.5">
                {region.replace(/-/g, " ")} <X className="h-3.5 w-3.5" aria-label="Clear" />
              </span>
            </Chip>
          )}
        </aside>
      )}
    </div>
  );
}
