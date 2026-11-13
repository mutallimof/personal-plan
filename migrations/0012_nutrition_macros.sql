-- 0012_nutrition_macros.sql
-- Carbohydrate and fat per food (optional) and in the cooked log, and how many portions were eaten.
-- Safe to run again. Existing rows keep working: new columns are empty, and a log without "portions" counts
-- everything that was cooked as eaten (how it worked before).

ALTER TABLE public.ingredient_nutrition ADD COLUMN IF NOT EXISTS carbs_g numeric;
ALTER TABLE public.ingredient_nutrition ADD COLUMN IF NOT EXISTS fat_g numeric;

ALTER TABLE public.cooked_log ADD COLUMN IF NOT EXISTS carbs_g numeric;
ALTER TABLE public.cooked_log ADD COLUMN IF NOT EXISTS fat_g numeric;
ALTER TABLE public.cooked_log ADD COLUMN IF NOT EXISTS portions numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_nutrition_carbs_g_check') THEN
    ALTER TABLE public.ingredient_nutrition ADD CONSTRAINT ingredient_nutrition_carbs_g_check CHECK (carbs_g IS NULL OR carbs_g >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_nutrition_fat_g_check') THEN
    ALTER TABLE public.ingredient_nutrition ADD CONSTRAINT ingredient_nutrition_fat_g_check CHECK (fat_g IS NULL OR fat_g >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cooked_log_carbs_g_check') THEN
    ALTER TABLE public.cooked_log ADD CONSTRAINT cooked_log_carbs_g_check CHECK (carbs_g IS NULL OR carbs_g >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cooked_log_fat_g_check') THEN
    ALTER TABLE public.cooked_log ADD CONSTRAINT cooked_log_fat_g_check CHECK (fat_g IS NULL OR fat_g >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cooked_log_portions_check') THEN
    ALTER TABLE public.cooked_log ADD CONSTRAINT cooked_log_portions_check CHECK (portions IS NULL OR portions > 0);
  END IF;
END $$;

-- cook_recipe gets three more optional inputs. The old 7-argument version is dropped first: two versions with the
-- same leading arguments would make a call ambiguous. kcal, protein_g, carbs_g and fat_g are what was EATEN
-- (per portion times portions); portions says how many.
DROP FUNCTION IF EXISTS public.cook_recipe(uuid, text, numeric, numeric, numeric, integer, jsonb);

CREATE OR REPLACE FUNCTION public.cook_recipe(
  p_recipe_id uuid,
  p_title text,
  p_servings numeric,
  p_kcal numeric,
  p_protein_g numeric,
  p_kcal_missing integer,
  p_changes jsonb,
  p_carbs_g numeric DEFAULT NULL,
  p_fat_g numeric DEFAULT NULL,
  p_portions numeric DEFAULT NULL
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

  INSERT INTO public.cooked_log (recipe_id, title, servings, kcal, protein_g, carbs_g, fat_g, portions, kcal_missing, removed)
  VALUES (p_recipe_id, p_title, p_servings, p_kcal, p_protein_g, p_carbs_g, p_fat_g, p_portions, p_kcal_missing, v_removed)
  RETURNING id INTO v_log;
  RETURN v_log;
END;
$$;

REVOKE ALL ON FUNCTION public.cook_recipe(uuid, text, numeric, numeric, numeric, integer, jsonb, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cook_recipe(uuid, text, numeric, numeric, numeric, integer, jsonb, numeric, numeric, numeric) TO authenticated;
