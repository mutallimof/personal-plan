/**
 * Placeholder front/back body artwork. Every muscle is its own <path> with an id
 * (`front-chest`, `back-lats`, ...). Highlighting is driven purely by the
 * `primary` / `secondary` muscle lists passed in — never per exercise.
 * Replace the `d` strings below with real artwork later; keep the ids.
 */
export const MUSCLES = [
  "chest", "shoulders-front", "shoulders-side", "shoulders-rear", "biceps", "triceps", "forearms",
  "abs", "obliques", "lats", "upper-back", "traps", "lower-back", "glutes", "quads", "hamstrings", "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

const W = 200;
function rr(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`;
}
const pair = (x: number, y: number, w: number, h: number, r: number) => rr(x, y, w, h, r) + rr(W - x - w, y, w, h, r);

const FRONT: Partial<Record<Muscle, string>> = {
  "shoulders-front": pair(56, 60, 18, 18, 8),
  "shoulders-side": pair(42, 64, 14, 26, 7),
  chest: pair(74, 66, 25, 30, 9),
  biceps: pair(40, 94, 14, 34, 7),
  forearms: pair(34, 132, 14, 44, 7),
  abs: rr(86, 100, 28, 66, 7),
  obliques: pair(70, 104, 14, 54, 6),
  quads: pair(70, 182, 27, 82, 13),
  calves: pair(74, 286, 18, 62, 9),
};
const BACK: Partial<Record<Muscle, string>> = {
  traps: rr(80, 50, 40, 30, 12),
  "shoulders-rear": pair(56, 62, 18, 18, 8),
  "shoulders-side": pair(42, 64, 14, 26, 7),
  "upper-back": pair(74, 82, 25, 26, 7),
  lats: pair(68, 110, 27, 44, 11),
  triceps: pair(40, 94, 14, 34, 7),
  forearms: pair(34, 132, 14, 44, 7),
  "lower-back": rr(86, 150, 28, 26, 7),
  glutes: pair(72, 180, 27, 34, 13),
  hamstrings: pair(72, 218, 25, 64, 12),
  calves: pair(74, 286, 18, 62, 9),
};

const SILHOUETTE =
  `M100 6a20 22 0 1 1 0 44a20 22 0 1 1 0-44z` +
  rr(90, 44, 20, 14, 4) +
  rr(52, 54, 96, 132, 26) +
  pair(32, 64, 24, 116, 12) +
  pair(66, 176, 33, 180, 16) +
  pair(70, 350, 26, 14, 6);

function Figure({ view, map, primary, secondary }: { view: "front" | "back"; map: Partial<Record<Muscle, string>>; primary: Set<string>; secondary: Set<string> }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 370" className="h-72 w-auto sm:h-80" role="img" aria-label={`${view} view`}>
        <path d={SILHOUETTE} className="fill-body-base" />
        {Object.entries(map).map(([m, d]) => (
          <path
            key={m}
            id={`${view}-${m}`}
            data-muscle={m}
            d={d}
            className={
              primary.has(m) ? "fill-primary" : secondary.has(m) ? "fill-primary-soft" : "fill-muscle-idle"
            }
          />
        ))}
      </svg>
      <figcaption className="text-xs uppercase tracking-wide text-muted-foreground">{view}</figcaption>
    </figure>
  );
}

export function BodyMap({ primary, secondary }: { primary: string[]; secondary: string[] }) {
  const p = new Set(primary);
  const s = new Set(secondary);
  return (
    <div className="flex justify-center gap-4 rounded-2xl bg-card p-4">
      <Figure view="front" map={FRONT} primary={p} secondary={s} />
      <Figure view="back" map={BACK} primary={p} secondary={s} />
    </div>
  );
}
