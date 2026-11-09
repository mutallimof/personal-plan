-- 0007_kitchen_zones.sql
-- Visual kitchen: rectangles on a 100 x 70 canvas that map to pantry places. Zones can sit inside other zones
-- (fridge compartments). Private to the owner (row-level security). Safe to run more than once. Needs 0004 first.

CREATE TABLE IF NOT EXISTS public.kitchen_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('fridge','freezer','shelf','drawer','cupboard','other')),
  x numeric NOT NULL,
  y numeric NOT NULL,
  width numeric NOT NULL CHECK (width > 0),
  height numeric NOT NULL CHECK (height > 0),
  parent_id uuid REFERENCES public.kitchen_zones(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  -- The pantry place whose items this zone shows. Deleting the place unlinks the zone.
  location_id uuid REFERENCES public.pantry_locations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kitchen_zones_user_idx ON public.kitchen_zones (user_id);

-- The app creates the default layout once, then sets this flag so a layout you clear stays cleared.
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS kitchen_seeded boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_zones TO authenticated;
GRANT ALL ON public.kitchen_zones TO service_role;

ALTER TABLE public.kitchen_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own kitchen_zones" ON public.kitchen_zones;
CREATE POLICY "own kitchen_zones" ON public.kitchen_zones
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
