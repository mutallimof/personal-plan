import { createFileRoute } from "@tanstack/react-router";
import { ExerciseBrowser } from "@/features/gym/ExerciseBrowser";

export const Route = createFileRoute("/_authenticated/_shell/gym/library")({
  head: () => ({ meta: [{ title: "Exercise library — Lifeplan" }] }),
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
      <ExerciseBrowser />
    </div>
  ),
});
