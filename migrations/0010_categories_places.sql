-- 0010_categories_places.sql
-- New category list, places that say which categories they accept, editable category names, and a version
-- counter for the starter dictionary. Needs 0004 and 0005 first. Safe to run more than once.
-- Nothing is deleted and no item changes its place.

-- 1. Places declare the categories they accept (empty = no preference).
ALTER TABLE public.pantry_locations ADD COLUMN IF NOT EXISTS accepts text[] NOT NULL DEFAULT '{}';

-- Defaults for places that carry the default names and have not been set yet.
UPDATE public.pantry_locations SET accepts = ARRAY['meat','poultry','fish']
  WHERE accepts = '{}' AND lower(name) = 'meat and fish';
UPDATE public.pantry_locations SET accepts = ARRAY['dairy','eggs']
  WHERE accepts = '{}' AND lower(name) = 'dairy and eggs';
UPDATE public.pantry_locations SET accepts = ARRAY['vegetables']
  WHERE accepts = '{}' AND lower(name) = 'vegetable drawer';
UPDATE public.pantry_locations SET accepts = ARRAY['fruit']
  WHERE accepts = '{}' AND lower(name) = 'fruit drawer';
UPDATE public.pantry_locations SET accepts = ARRAY['drinks','sauces and condiments']
  WHERE accepts = '{}' AND lower(name) = 'drinks and sauces';
UPDATE public.pantry_locations SET accepts = ARRAY['dry goods','canned','spices','oils and fats','snacks and sweets','bakery']
  WHERE accepts = '{}' AND lower(name) = 'dry-goods shelf';
UPDATE public.pantry_locations SET accepts = ARRAY['frozen']
  WHERE accepts = '{}' AND lower(name) = 'freezer';

-- 2. Category names a person added or renamed. The key is what items store; the label is what is shown.
CREATE TABLE IF NOT EXISTS public.pantry_categories (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9 ]{0,39}$'),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pantry_categories TO authenticated;
GRANT ALL ON public.pantry_categories TO service_role;
ALTER TABLE public.pantry_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own pantry_categories" ON public.pantry_categories;
CREATE POLICY "own pantry_categories" ON public.pantry_categories
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Starter dictionary version and the one-time layout upgrade flag.
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS aliases_seed_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.pantry_settings ADD COLUMN IF NOT EXISTS layout_upgraded boolean NOT NULL DEFAULT false;
UPDATE public.pantry_settings SET aliases_seed_version = 1 WHERE aliases_seeded AND aliases_seed_version = 0;

-- 4. Convert the old categories. Only old values are touched, so running this again changes nothing.
--    "produce" becomes fruit or vegetables by keyword; anything uncertain becomes "other" and shows up under
--    "Needs a category" on the All items sheet.
UPDATE public.pantry_items SET category = CASE
    WHEN name ~* 'apfel|äpfel|aepfel|banane|birne|orange|zitrone|limette|lemon|lime|trauben|grape|nektarine|pfirsich|peach|erdbeer|himbeer|blaubeer|berry|berries|kirsche|cherry|melone|melon|mango|ananas|pineapple|kiwi|avocado|beere|mandarine|clementine|apple|banana|pear' THEN 'fruit'
    WHEN name ~* 'tomat|gurke|cucumber|paprika|pepper|peperoni|karott|carrot|möhre|zwiebel|onion|knoblauch|garlic|kartoffel|potato|zucchini|champignon|mushroom|pilz|salat|lettuce|spinat|spinach|brokkoli|broccoli|blumenkohl|cauliflower|lauch|porree|leek|sellerie|celery|kohl|cabbage|radieschen|radish|spargel|asparagus|aubergine|eggplant|bohne|bean|erbse|\mpeas?\M|dill|petersilie|parsley|schnittlauch|chive|basilikum|basil|kräuter|herb' THEN 'vegetables'
    ELSE 'other' END
  WHERE category = 'produce';

UPDATE public.product_aliases SET category = CASE
    WHEN product_name || ' ' || raw_text ~* 'apfel|äpfel|aepfel|banane|birne|orange|zitrone|limette|lemon|lime|trauben|grape|nektarine|pfirsich|peach|erdbeer|himbeer|blaubeer|berry|berries|kirsche|cherry|melone|melon|mango|ananas|pineapple|kiwi|avocado|beere|mandarine|clementine|apple|banana|pear' THEN 'fruit'
    WHEN product_name || ' ' || raw_text ~* 'tomat|gurke|cucumber|paprika|pepper|peperoni|karott|carrot|möhre|zwiebel|onion|knoblauch|garlic|kartoffel|potato|zucchini|champignon|mushroom|pilz|salat|lettuce|spinat|spinach|brokkoli|broccoli|blumenkohl|cauliflower|lauch|porree|leek|sellerie|celery|kohl|cabbage|radieschen|radish|spargel|asparagus|aubergine|eggplant|bohne|bean|erbse|\mpeas?\M|dill|petersilie|parsley|schnittlauch|chive|basilikum|basil|kräuter|herb' THEN 'vegetables'
    ELSE 'other' END
  WHERE category = 'produce';

-- Old "meat" splits into meat and poultry.
UPDATE public.pantry_items SET category = 'poultry'
  WHERE category = 'meat' AND name ~* 'chicken|hähnchen|haehnchen|hähnch|huhn|brustfilet|pute|turkey|truthahn|geflügel|gefluegel|ente\M';
UPDATE public.product_aliases SET category = 'poultry'
  WHERE category = 'meat' AND product_name || ' ' || raw_text ~* 'chicken|hähnchen|haehnchen|haehnch|hähnch|huhn|brustfilet|pute|turkey|truthahn|geflügel|gefluegel|ente\M';

-- Eggs were part of dairy.
UPDATE public.pantry_items SET category = 'eggs' WHERE category = 'dairy' AND name ~* '\m(eggs?|eier|ei)\M';
UPDATE public.product_aliases SET category = 'eggs' WHERE category = 'dairy' AND product_name || ' ' || raw_text ~* '\m(eggs?|eier|ei)\M';

-- Renamed categories.
UPDATE public.pantry_items SET category = 'snacks and sweets' WHERE category = 'snacks';
UPDATE public.product_aliases SET category = 'snacks and sweets' WHERE category = 'snacks';
