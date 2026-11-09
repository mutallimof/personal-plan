-- 0002_workout_logs.sql
-- Workout logging: one row per finished workout, one row per set.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  session_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  position int NOT NULL DEFAULT 0,
  set_number int NOT NULL,
  planned_reps text,
  planned_weight_kg numeric,
  reps int,
  weight_kg numeric,
  done boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS workout_logs_user_finished_idx ON public.workout_logs (user_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS workout_sets_user_exercise_idx ON public.workout_sets (user_id, exercise_id);
CREATE INDEX IF NOT EXISTS workout_sets_log_idx ON public.workout_sets (log_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;
GRANT ALL ON public.workout_sets TO service_role;

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own workout_logs" ON public.workout_logs;
CREATE POLICY "own workout_logs" ON public.workout_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own workout_sets" ON public.workout_sets;
CREATE POLICY "own workout_sets" ON public.workout_sets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
