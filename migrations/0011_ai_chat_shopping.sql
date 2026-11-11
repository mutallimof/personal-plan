-- 0011_ai_chat_shopping.sql
-- The AI cooking chat (off by default, with a request counter) and a simple shopping list.
-- Needs 0004 first (pantry_settings). Safe to run more than once. Nothing is deleted.

ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS ai_chat boolean NOT NULL DEFAULT false;
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS ai_chat_requests integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pantry_settings_ai_chat_requests_check') THEN
    ALTER TABLE public.pantry_settings
      ADD CONSTRAINT pantry_settings_ai_chat_requests_check CHECK (ai_chat_requests >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.shopping_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  quantity numeric CHECK (quantity IS NULL OR quantity > 0),
  unit text CHECK (unit IS NULL OR unit IN ('g','kg','ml','l','pieces','pack')),
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shopping_list_user_idx ON public.shopping_list (user_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list TO authenticated;
GRANT ALL ON public.shopping_list TO service_role;

ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own shopping_list" ON public.shopping_list;
CREATE POLICY "own shopping_list" ON public.shopping_list
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
