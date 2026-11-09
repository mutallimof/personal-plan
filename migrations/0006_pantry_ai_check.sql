-- 0006_pantry_ai_check.sql
-- Per-user setting for the optional "AI check for unknown lines" on receipt review, plus a usage counter.
-- Off by default. Safe to run more than once. Needs 0004 first (the table already has row-level security).

ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS ai_check boolean NOT NULL DEFAULT false;
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS ai_lines_sent integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pantry_settings_ai_lines_sent_check'
  ) THEN
    ALTER TABLE public.pantry_settings
      ADD CONSTRAINT pantry_settings_ai_lines_sent_check CHECK (ai_lines_sent >= 0);
  END IF;
END $$;
