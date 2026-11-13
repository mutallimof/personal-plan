-- 0009_kitchen_scene.sql
-- The illustrated kitchen: the layout is one JSON document per user, items and dictionary entries can carry a
-- picture (icon key), and items remember which shelf of a cabinet they stand on. Safe to run more than once.
-- Needs 0004, 0005 and 0008 first. The old table kitchen_zones (0007) is left as it is; the app converts its
-- content into the new layout the first time the kitchen opens, and nothing is deleted.

ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS icon text CHECK (icon IS NULL OR char_length(icon) BETWEEN 1 AND 40);
ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS shelf smallint CHECK (shelf IS NULL OR shelf BETWEEN 0 AND 20);
ALTER TABLE public.product_aliases
  ADD COLUMN IF NOT EXISTS icon text CHECK (icon IS NULL OR char_length(icon) BETWEEN 1 AND 40);

CREATE TABLE IF NOT EXISTS public.kitchen_layouts (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  layout jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_layouts TO authenticated;
GRANT ALL ON public.kitchen_layouts TO service_role;

ALTER TABLE public.kitchen_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own kitchen_layouts" ON public.kitchen_layouts;
CREATE POLICY "own kitchen_layouts" ON public.kitchen_layouts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Undo of a cooked meal (0008) brings removed items back; it now restores their icon and shelf as well.
CREATE OR REPLACE FUNCTION public.undo_cook(p_log_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  l public.cooked_log;
  e jsonb;
  v_back numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  SELECT * INTO l FROM public.cooked_log WHERE id = p_log_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That meal is not in the log';
  END IF;
  IF l.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'Already undone';
  END IF;
  IF l.cooked_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Too late to undo';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(l.removed) LOOP
    v_back := (e -> 'item' ->> 'quantity')::numeric - (e ->> 'after')::numeric;
    UPDATE public.pantry_items SET quantity = quantity + v_back
      WHERE id = (e -> 'item' ->> 'id')::uuid AND user_id = auth.uid();
    IF NOT FOUND THEN
      INSERT INTO public.pantry_items (id, user_id, name, quantity, unit, category, location_id, added_at, expires_on, note, icon, shelf)
      SELECT s.id, s.user_id, s.name, s.quantity, s.unit, s.category,
             CASE WHEN EXISTS (SELECT 1 FROM public.pantry_locations pl WHERE pl.id = s.location_id) THEN s.location_id END,
             s.added_at, s.expires_on, s.note, s.icon, s.shelf
      FROM jsonb_populate_record(NULL::public.pantry_items, e -> 'item') s;
    END IF;
  END LOOP;

  UPDATE public.cooked_log SET undone_at = now() WHERE id = l.id;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_cook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_cook(uuid) TO authenticated;
