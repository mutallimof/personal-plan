import type { IExerciseData, Muscle } from "react-body-highlighter";

export const PRIMARY_COLOR = "#22C55E";
export const SECONDARY_COLOR = "#BBF7D0";
export const BODY_COLOR = "#E5E7EB";

/**
 * Our muscle ids -> react-body-highlighter muscle names.
 * The package has no side-delt, lat or neck region: side delts light up both deltoid
 * regions, lats use the upper-back region, neck maps to nothing (page shows no highlights).
 */
export const MUSCLE_TO_PACKAGE: Record<string, Muscle[]> = {
  chest: ["chest"],
  "shoulders-front": ["front-deltoids"],
  "shoulders-side": ["front-deltoids", "back-deltoids"],
  "shoulders-rear": ["back-deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abs: ["abs"],
  obliques: ["obliques"],
  lats: ["upper-back"],
  "upper-back": ["upper-back"],
  traps: ["trapezius"],
  "lower-back": ["lower-back"],
  glutes: ["gluteal"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  calves: ["calves"],
};

function expand(ids: string[]): Muscle[] {
  return ids.flatMap((id) => MUSCLE_TO_PACKAGE[id] ?? []);
}

/**
 * Build the package `data` prop. Each package muscle is either primary or secondary
 * (primary wins), so overlapping mappings never stack into a darker colour.
 * With highlightedColors = [secondary, primary]: frequency 1 = light, 2 = solid.
 */
export function highlightData(primary: string[], secondary: string[]): IExerciseData[] {
  const p = new Set(expand(primary));
  const s = new Set(expand(secondary).filter((m) => !p.has(m)));
  const data: IExerciseData[] = [];
  if (p.size) data.push({ name: "primary", muscles: [...p], frequency: 2 });
  if (s.size) data.push({ name: "secondary", muscles: [...s], frequency: 1 });
  return data;
}
