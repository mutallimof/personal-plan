-- 0004_pantry.sql
-- Pantry: places (fridge, shelf, ...), the items in them, and a small per-user settings row.
-- Every table is private to its owner (row-level security). Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.pantry_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('fridge','freezer','shelf','drawer','cupboard','other')),
  parent_id uuid REFERENCES public.pantry_locations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pantry_locations_user_idx ON public.pantry_locations (user_id);

-- Deleting a place keeps its items; they show up under "No place".
CREATE TABLE IF NOT EXISTS public.pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'pieces' CHECK (unit IN ('g','kg','ml','l','pieces','pack')),
  category text NOT NULL DEFAULT 'other',
  location_id uuid REFERENCES public.pantry_locations(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  expires_on date,
  note text
);
CREATE INDEX IF NOT EXISTS pantry_items_user_idx ON public.pantry_items (user_id);
CREATE INDEX IF NOT EXISTS pantry_items_location_idx ON public.pantry_items (location_id);

-- One row per user. The app uses the flags to seed the default places only once.
CREATE TABLE IF NOT EXISTS public.pantry_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  locations_seeded boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_locations, public.pantry_items, public.pantry_settings TO authenticated;
GRANT ALL ON public.pantry_locations, public.pantry_items, public.pantry_settings TO service_role;

ALTER TABLE public.pantry_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own pantry_locations" ON public.pantry_locations;
CREATE POLICY "own pantry_locations" ON public.pantry_locations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own pantry_items" ON public.pantry_items;
CREATE POLICY "own pantry_items" ON public.pantry_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own pantry_settings" ON public.pantry_settings;
CREATE POLICY "own pantry_settings" ON public.pantry_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
