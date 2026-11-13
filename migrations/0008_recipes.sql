-- 0008_recipes.sql
-- Cooking: recipes and their ingredients, a nutrition table you can edit, a log of what you cooked, and two
-- functions that change the pantry and the log in one step (cook, undo). Safe to run more than once.
-- Needs 0004 first (pantry_items, pantry_settings). Every table is private to its owner (row-level security).

CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  servings numeric NOT NULL DEFAULT 2 CHECK (servings > 0),
  steps text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipes_user_idx ON public.recipes (user_id);

-- pantry_item_id is an optional hint to one pantry item; the app also matches by name.
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'pieces' CHECK (unit IN ('g','kg','ml','l','pieces','pack')),
  pantry_item_id uuid REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON public.recipe_ingredients (recipe_id);

-- Energy and protein per 100 g, per 100 ml or per piece. The app fills it once from USDA FoodData Central
-- (public domain); you can edit, add and delete rows.
CREATE TABLE IF NOT EXISTS public.ingredient_nutrition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  basis text NOT NULL CHECK (basis IN ('100g', '100ml', 'piece')),
  kcal numeric NOT NULL CHECK (kcal >= 0),
  protein_g numeric NOT NULL CHECK (protein_g >= 0),
  source text NOT NULL DEFAULT 'own'
);
CREATE UNIQUE INDEX IF NOT EXISTS ingredient_nutrition_unique_idx ON public.ingredient_nutrition (user_id, lower(name), basis);

-- One row per cooked meal. kcal and protein are a snapshot at cooking time (approximate: ingredients without
-- nutrition data are left out, kcal_missing counts them). `removed` holds what was taken from the pantry, for undo.
CREATE TABLE IF NOT EXISTS public.cooked_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  title text NOT NULL,
  servings numeric NOT NULL CHECK (servings > 0),
  kcal numeric CHECK (kcal >= 0),
  protein_g numeric CHECK (protein_g >= 0),
  kcal_missing integer NOT NULL DEFAULT 0 CHECK (kcal_missing >= 0),
  cooked_at timestamptz NOT NULL DEFAULT now(),
  removed jsonb NOT NULL DEFAULT '[]'::jsonb,
  undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS cooked_log_user_idx ON public.cooked_log (user_id, cooked_at DESC);

-- Settings: optional AI recipe ideas (off by default) with a request counter, and a flag for the one-time nutrition fill.
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS ai_recipes boolean NOT NULL DEFAULT false;
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS ai_recipe_requests integer NOT NULL DEFAULT 0;
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS nutrition_seeded boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pantry_settings_ai_recipe_requests_check') THEN
    ALTER TABLE public.pantry_settings
      ADD CONSTRAINT pantry_settings_ai_recipe_requests_check CHECK (ai_recipe_requests >= 0);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes, public.recipe_ingredients, public.ingredient_nutrition, public.cooked_log TO authenticated;
GRANT ALL ON public.recipes, public.recipe_ingredients, public.ingredient_nutrition, public.cooked_log TO service_role;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooked_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own recipes" ON public.recipes;
CREATE POLICY "own recipes" ON public.recipes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- An ingredient can only be added to one of your own recipes.
DROP POLICY IF EXISTS "own recipe_ingredients" ON public.recipe_ingredients;
CREATE POLICY "own recipe_ingredients" ON public.recipe_ingredients
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "own ingredient_nutrition" ON public.ingredient_nutrition;
CREATE POLICY "own ingredient_nutrition" ON public.ingredient_nutrition
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own cooked_log" ON public.cooked_log;
CREATE POLICY "own cooked_log" ON public.cooked_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cook: lowers or removes pantry quantities and writes the log in ONE transaction (a function call is atomic: if
-- anything fails, nothing changes). p_changes is [{"id": <pantry item>, "after": <new quantity>}]; an "after" of 0
-- removes the item. Runs with the caller's rights, so row-level security still applies. Returns the log id.
CREATE OR REPLACE FUNCTION public.cook_recipe(
  p_recipe_id uuid,
  p_title text,
  p_servings numeric,
  p_kcal numeric,
  p_protein_g numeric,
  p_kcal_missing integer,
  p_changes jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c jsonb;
  r public.pantry_items;
  v_after numeric;
  v_removed jsonb := '[]'::jsonb;
  v_log uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Changes must be a list';
  END IF;

  FOR c IN SELECT * FROM jsonb_array_elements(p_changes) LOOP
    v_after := (c ->> 'after')::numeric;
    SELECT * INTO r FROM public.pantry_items WHERE id = (c ->> 'id')::uuid AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A pantry item is no longer there';
    END IF;
    IF v_after IS NULL OR v_after < 0 OR v_after > r.quantity THEN
      RAISE EXCEPTION 'Invalid amount for %', r.name;
    END IF;
    v_removed := v_removed || jsonb_build_array(jsonb_build_object('item', to_jsonb(r), 'after', v_after));
    IF v_after = 0 THEN
      DELETE FROM public.pantry_items WHERE id = r.id;
    ELSE
      UPDATE public.pantry_items SET quantity = v_after WHERE id = r.id;
    END IF;
  END LOOP;

  INSERT INTO public.cooked_log (recipe_id, title, servings, kcal, protein_g, kcal_missing, removed)
  VALUES (p_recipe_id, p_title, p_servings, p_kcal, p_protein_g, p_kcal_missing, v_removed)
  RETURNING id INTO v_log;
  RETURN v_log;
END;
$$;

-- Undo: puts the removed amounts back (adds them to what is there now, or brings a removed item back) and marks the
-- log as undone. Only within 10 minutes of cooking, and only once.
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
      INSERT INTO public.pantry_items (id, user_id, name, quantity, unit, category, location_id, added_at, expires_on, note)
      SELECT s.id, s.user_id, s.name, s.quantity, s.unit, s.category,
             CASE WHEN EXISTS (SELECT 1 FROM public.pantry_locations pl WHERE pl.id = s.location_id) THEN s.location_id END,
             s.added_at, s.expires_on, s.note
      FROM jsonb_populate_record(NULL::public.pantry_items, e -> 'item') s;
    END IF;
  END LOOP;

  UPDATE public.cooked_log SET undone_at = now() WHERE id = l.id;
END;
$$;

REVOKE ALL ON FUNCTION public.cook_recipe(uuid, text, numeric, numeric, numeric, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_cook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cook_recipe(uuid, text, numeric, numeric, numeric, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_cook(uuid) TO authenticated;
