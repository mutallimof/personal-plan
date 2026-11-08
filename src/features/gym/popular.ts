/**
 * Common gym exercises, shown first in the library. Slugs, not ids, so this works without a database column.
 * Slugs that are not in the database yet (for example before the exercise import is applied) are simply ignored.
 */
export const POPULAR_SLUGS: readonly string[] = [
  // chest
  "barbell-bench-press-medium-grip",
  "barbell-incline-bench-press-medium-grip",
  "incline-db-press",
  "flat-db-press",
  "dumbbell-flyes",
  "cable-fly",
  "push-up",
  "dips",
  // back
  "barbell-deadlift",
  "pull-up",
  "chin-up",
  "lat-pulldown",
  "bent-over-barbell-row",
  "seated-cable-row",
  "db-row",
  "face-pull",
  // shoulders
  "barbell-shoulder-press",
  "seated-db-shoulder-press",
  "lateral-raise",
  "rear-delt-fly",
  "dumbbell-shrug",
  // arms
  "barbell-curl",
  "biceps-curl",
  "hammer-curl",
  "ez-bar-curl",
  "triceps-pushdown",
  "overhead-triceps-ext",
  "close-grip-press",
  // legs
  "squat",
  "leg-press",
  "hack-squat",
  "romanian-deadlift",
  "goblet-squat",
  "dumbbell-lunges",
  "barbell-hip-thrust",
  "leg-extensions",
  "leg-curl",
  "calf-raise",
  // core
  "plank",
  "crunches",
  "hanging-leg-raise",
  "russian-twist",
];

const rank = new Map(POPULAR_SLUGS.map((s, i) => [s, i]));

/** Position in the popular list, or -1 when the exercise is not popular. */
export const popularRank = (slug: string) => rank.get(slug) ?? -1;
