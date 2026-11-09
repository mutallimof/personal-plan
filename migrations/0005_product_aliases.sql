-- 0005_product_aliases.sql
-- Product dictionary: maps the text printed on a receipt to a product, category, place and unit.
-- Private to its owner (row-level security). Safe to run more than once. Needs 0004 first.

CREATE TABLE IF NOT EXISTS public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  raw_text text NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 200),
  store text CHECK (store IS NULL OR char_length(store) BETWEEN 1 AND 60),
  product_name text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'other',
  default_location_kind text CHECK (default_location_kind IS NULL OR default_location_kind IN ('fridge','freezer','shelf','drawer','cupboard','other')),
  default_unit text NOT NULL DEFAULT 'pieces' CHECK (default_unit IN ('g','kg','ml','l','pieces','pack')),
  default_quantity numeric CHECK (default_quantity IS NULL OR default_quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One alias per user, store and normalized text. A missing store counts as one value of its own.
CREATE UNIQUE INDEX IF NOT EXISTS product_aliases_unique
  ON public.product_aliases (user_id, COALESCE(store, ''), raw_text);

-- The app fills the starter dictionary once, then sets this flag so deleted entries stay deleted.
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS aliases_seeded boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_aliases TO authenticated;
GRANT ALL ON public.product_aliases TO service_role;

ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own product_aliases" ON public.product_aliases;
CREATE POLICY "own product_aliases" ON public.product_aliases
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
