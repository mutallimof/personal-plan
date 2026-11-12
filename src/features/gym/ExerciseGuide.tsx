import { ExerciseImages } from "@/features/gym/ExerciseImages";
import type { Exercise } from "@/features/gym/data";

/** How to do an exercise: the demo images and the numbered steps. Shared by the library page and the workout sheet. */
export function ExerciseGuide({ exercise }: { exercise: Exercise }) {
  return (
    <>
      <ExerciseImages slug={exercise.slug} name={exercise.name} />
      {exercise.steps.length > 0 && (
        <ol className="list-decimal space-y-2 tile py-4 pl-9 pr-4 text-sm">
          {exercise.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </>
  );
}
