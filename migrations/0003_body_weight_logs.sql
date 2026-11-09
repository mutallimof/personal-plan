-- 0003_body_weight_logs.sql
-- Weekly body-weight log for the Profile page. One entry per user per date.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.body_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  date date NOT NULL,
  weight_kg numeric NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_weight_logs TO authenticated;
GRANT ALL ON public.body_weight_logs TO service_role;

ALTER TABLE public.body_weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own body_weight_logs" ON public.body_weight_logs;
CREATE POLICY "own body_weight_logs" ON public.body_weight_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
