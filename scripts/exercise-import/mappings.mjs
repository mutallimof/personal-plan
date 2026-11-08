// Mapping tables for the free-exercise-db import (https://github.com/yuhonas/free-exercise-db, Unlicense).
// Our ids come from src/features/gym/BodyMap.tsx (MUSCLES) and src/features/gym/data.ts.

/** free-exercise-db muscle -> our body-map muscle ids. `shoulders` is split by name, see shoulderIds(). */
export const MUSCLE_MAP = {
  abdominals: ["abs"],
  abductors: ["glutes"], // approximation: no abductor region on the body map
  adductors: ["quads"], // approximation: no adductor region on the body map
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  forearms: ["forearms"],
  glutes: ["glutes"],
  hamstrings: ["hamstrings"],
  lats: ["lats"],
  "lower back": ["lower-back"],
  "middle back": ["upper-back"],
  neck: [], // no neck region on the body map -> counted as "no muscle match"
  quadriceps: ["quads"],
  shoulders: null, // handled by shoulderIds()
  traps: ["traps"],
  triceps: ["triceps"],
};

/** free-exercise-db muscle -> our muscle_group (chest, back, shoulders, arms, core, legs). */
export const GROUP_MAP = {
  abdominals: "core",
  abductors: "legs",
  adductors: "legs",
  biceps: "arms",
  calves: "legs",
  chest: "chest",
  forearms: "arms",
  glutes: "legs",
  hamstrings: "legs",
  lats: "back",
  "lower back": "back",
  "middle back": "back",
  neck: "shoulders",
  quadriceps: "legs",
  shoulders: "shoulders",
  traps: "back",
  triceps: "arms",
};

/** free-exercise-db equipment -> our equipment (dumbbell, barbell, cable, machine, bodyweight, other). */
export const EQUIPMENT_MAP = {
  "body only": "bodyweight",
  dumbbell: "dumbbell",
  barbell: "barbell",
  "e-z curl bar": "barbell",
  cable: "cable",
  machine: "machine",
  kettlebells: "other",
  bands: "other",
  "medicine ball": "other",
  "exercise ball": "other",
  "foam roll": "other",
  other: "other",
};

/** Split the single "shoulders" muscle into front / side / rear by exercise name. */
export function shoulderIds(name) {
  const n = name.toLowerCase();
  if (/rear|reverse fl|face pull|bent over (dumbbell )?(lateral|raise)|back raise/.test(n)) return ["shoulders-rear"];
  if (/lateral|side raise|side lateral/.test(n)) return ["shoulders-side"];
  if (/front (dumbbell )?raise|front plate|front cable raise/.test(n)) return ["shoulders-front"];
  return ["shoulders-front", "shoulders-side"];
}

/** Ordered name rules -> family. First match wins. Anything else falls back to a cleaned-up name. */
export const FAMILY_RULES = [
  [/rear|reverse fl|face pull/, "rear-delt"],
  [/incline.*(press|bench)/, "incline-press"],
  [/decline.*press/, "decline-press"],
  [/close[- ]grip.*(bench|press)/, "close-grip-press"],
  [/bench press|chest press|floor press|machine press/, "flat-press"],
  [/push[- ]?ups?|pushups?/, "push-up"],
  [/\bfl(y|ye|yes|ies)\b|crossover|butterfly|pec deck/, "fly"],
  [/\bdips?\b/, "dips"],
  [/pulldown|pull-down|pull[- ]?ups?|chin[- ]?ups?|pullups?/, "vertical-pull"],
  [/\brows?\b/, "row"],
  [/lateral raise|side raise/, "lateral-raise"],
  [/front (dumbbell |plate |cable )?raise/, "front-raise"],
  [/shrug/, "shrug"],
  [/(shoulder|overhead|military|arnold|behind the neck|push) press|press behind/, "shoulder-press"],
  [/hammer/, "hammer-curl"],
  [/leg curl|hamstring curl/, "leg-curl"],
  [/wrist curl/, "wrist-curl"],
  [/curl/, "curl"],
  [/leg extension/, "leg-extension"],
  [/back extension|hyperextension/, "back-extension"],
  [/triceps|tricep|pushdown|skull|kickback|extension/, "triceps"],
  [/lunge|split squat|step[- ]?up|bulgarian/, "lunge"],
  [/squat|leg press|hack/, "squat"],
  [/romanian|stiff|good morning/, "hinge"],
  [/deadlift/, "deadlift"],
  [/calf|calves|heel raise/, "calf"],
  [/hip thrust|glute bridge|bridge/, "hip-thrust"],
  [/crunch|sit[- ]?up|situp/, "crunch"],
  [/plank/, "core-hold"],
  [/leg raise|knee raise|hanging|leg pull/, "leg-raise"],
  [/twist|russian|woodchop|chop/, "rotation"],
  [/clean|snatch|jerk/, "olympic-lift"],
];

/** Words dropped when building a fallback family from the name. */
export const FAMILY_NOISE = new Set([
  "dumbbell", "barbell", "cable", "machine", "kettlebell", "band", "ez", "bar", "smith", "seated", "standing",
  "one", "arm", "two", "alternating", "lying", "with", "on", "the", "a", "and", "to", "wide", "close", "grip",
  "reverse", "single", "leg", "bent", "over", "low", "high", "medium", "narrow", "stretch", "exercise", "ball",
]);

/**
 * Dataset exercises we already have under a different name. They are skipped so the library has no duplicates.
 * (Exact-name matches are skipped in SQL as well, see the NOT EXISTS check in convert.mjs.)
 * dataset name -> our existing slug
 */
export const ALREADY_HAVE = {
  "Dumbbell Bicep Curl": "biceps-curl",
  "Hammer Curls": "hammer-curl",
  Pushups: "push-up",
  Pullups: "pull-up",
  "Incline Dumbbell Press": "incline-db-press",
  "Dumbbell Bench Press": "flat-db-press",
  "Seated Dumbbell Press": "seated-db-shoulder-press",
  "Side Lateral Raise": "lateral-raise",
  "Seated Cable Rows": "seated-cable-row",
  "Lying Leg Curls": "leg-curl",
  "Standing Biceps Cable Curl": "cable-curl",
  "Reverse Flyes": "rear-delt-fly",
  Butterfly: "pec-deck",
  "Close-Grip Barbell Bench Press": "close-grip-press",
  "Machine Shoulder (Military) Press": "machine-shoulder-press",
  "Wide-Grip Lat Pulldown": "lat-pulldown",
  "Standing Calf Raises": "calf-raise",
  "Dips - Triceps Version": "dips",
};

/** Names already seeded by drizzle/migrations/0000_lifeplan_gym.sql. Same-name dataset rows are skipped. */
export const EXISTING_NAMES = [
  "Incline dumbbell press",
  "Incline machine press",
  "Flat dumbbell press",
  "Machine chest press",
  "Push-up",
  "Cable fly",
  "Pec deck",
  "Lat pulldown",
  "Neutral-grip pulldown",
  "Pull-up",
  "Seated cable row",
  "One-arm dumbbell row",
  "Lateral raise",
  "Cable lateral raise",
  "Machine lateral raise",
  "Seated dumbbell shoulder press",
  "Machine shoulder press",
  "Face pull",
  "Rear delt fly",
  "Reverse pec deck",
  "Biceps curl",
  "EZ-bar curl",
  "Close-grip EZ-bar curl",
  "Cable curl",
  "Hammer curl",
  "Triceps pushdown",
  "Overhead triceps extension",
  "Dips",
  "Close-grip bench press",
  "Hanging leg raise",
  "Plank",
  "Barbell squat",
  "Leg press",
  "Goblet squat",
  "Romanian deadlift",
  "Dumbbell Romanian deadlift",
  "Leg curl",
  "Calf raise"
];
