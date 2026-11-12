import { createFileRoute } from "@tanstack/react-router";
import { ExerciseBrowser } from "@/features/gym/ExerciseBrowser";

export const Route = createFileRoute("/_authenticated/_shell/gym/library")({
  head: () => ({ meta: [{ title: "Exercise library — Lifeplan" }] }),
  component: () => (
    <div className="space-y-4">
      <h1 className="text-[1.75rem] leading-tight">Library</h1>
      <ExerciseBrowser bodyFilter />
    </div>
  ),
});
