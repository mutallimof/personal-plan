import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { exerciseImageUrls } from "./exercise-media";

const FLIP_MS = 1000;
const QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(QUERY).matches));
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const frame = "relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-white";

/** Start/end pictures above the steps. Renders nothing when there are none or one fails to load. */
export function ExerciseImages({ slug, name }: { slug: string | null | undefined; name: string }) {
  const urls = exerciseImageUrls(slug);
  const key = urls.join("|");
  const reduced = useReducedMotion();
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setFrameIdx(0);
    setPlaying(true);
  }, [key]);

  const animate = !reduced && urls.length === 2 && playing && !failed;
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setFrameIdx((i) => (i + 1) % 2), FLIP_MS);
    return () => clearInterval(t);
  }, [animate]);

  if (!urls.length || failed) return null;
  const onError = () => setFailed(true);

  if (reduced) {
    return (
      <div className="grid grid-cols-2 gap-2 tile p-3">
        {urls.map((u, i) => (
          <div key={u} className={frame}>
            <img
              src={u}
              alt={`${name}, ${i === 0 ? "start" : "end"} position`}
              loading="lazy"
              decoding="async"
              onError={onError}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tile p-3">
      <div className={frame}>
        {urls.map((u, i) => (
          <img
            key={u}
            src={u}
            alt={i === frameIdx ? `${name}, ${i === 0 ? "start" : "end"} position` : ""}
            aria-hidden={i === frameIdx ? undefined : true}
            loading="lazy"
            decoding="async"
            onError={onError}
            className={
              "absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ease-in-out " +
              (i === frameIdx ? "opacity-100" : "opacity-0")
            }
          />
        ))}
        {urls.length === 2 && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause animation" : "Play animation"}
            className="absolute bottom-2 right-2 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
