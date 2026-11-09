import { EXERCISE_IMAGE_IDS } from "./exercise-images";

// Pictures come from the public free-exercise-db repo (Unlicense), served by jsDelivr. Pinned to a commit so
// the URLs never change under us. Nothing is copied into this repo.
const BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises";

/** Start and end picture URLs for an exercise slug, or [] when it has none (e.g. exercises you created). */
export function exerciseImageUrls(slug: string | null | undefined): string[] {
  if (!slug || !Object.hasOwn(EXERCISE_IMAGE_IDS, slug)) return [];
  const id = EXERCISE_IMAGE_IDS[slug];
  if (!id) return [];
  return [0, 1].map((n) => `${BASE}/${encodeURIComponent(id)}/${n}.jpg`);
}
