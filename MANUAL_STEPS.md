# Manual steps

Things only you can do. Nothing here has been applied for you.

## 1. SQL migrations (Supabase SQL editor)
Your project must already have the base schema (`setup.sql`). Then run these files from the `migrations/` folder,
in order, once each. Every file is safe to run again.

1. Open https://supabase.com/dashboard and pick your project.
2. Left menu: **SQL Editor** -> **New query**.
3. Open `migrations/0002_workout_logs.sql` on your computer, copy everything, paste it into the editor, click **Run**. It should say "Success. No rows returned".
4. Repeat with `migrations/0003_body_weight_logs.sql`.
5. Check: left menu **Table Editor** should now list `workout_logs`, `workout_sets` and `body_weight_logs`, each with a small "RLS enabled" badge.

| File | Adds | Needed for |
| --- | --- | --- |
| `0002_workout_logs.sql` | `workout_logs`, `workout_sets` | Start workout, progress charts, "Go up" marker, next suggested session |
| `0003_body_weight_logs.sql` | `body_weight_logs` | Weigh-ins on the Profile page |
| `0004_pantry.sql` | `pantry_locations`, `pantry_items`, `pantry_settings` | Pantry > Items |
| `0005_product_aliases.sql` | `product_aliases` | Pantry > Dictionary, receipt matching and learning |
| `0006_pantry_ai_check.sql` | AI check columns on `pantry_settings` | Optional AI check on receipt import |
| `0007_kitchen_zones.sql` | `kitchen_zones` | Pantry > Kitchen |
| `0008_recipes.sql` | `recipes`, `recipe_ingredients`, `ingredient_nutrition`, `cooked_log`, AI recipe columns on `pantry_settings`, and the functions `cook_recipe` and `undo_cook` | Pantry > Cook |
| `0009_kitchen_scene.sql` | `kitchen_layouts`; `icon` and `shelf` on `pantry_items`; `icon` on `product_aliases`; `undo_cook` now restores icon and shelf | The kitchen screen |
| `0010_categories_places.sql` | `accepts` on `pantry_locations`; `pantry_categories`; `aliases_seed_version` and `layout_upgraded` on `pantry_settings`; converts the old categories `produce` and `meat` on items and dictionary entries | New categories, places that accept categories, receipt placement, Organize |
| `0011_ai_chat_shopping.sql` | `ai_chat` and `ai_chat_requests` on `pantry_settings`; `shopping_list` | AI cooking chat, Shopping tab |

Run 0004 to 0011 the same way, in that order (0005 to 0011 add to tables made by 0004). Run 0010 and 0011 after pulling this branch: the receipt screen, Organize, Categories and the Cook > Ask AI and Shopping tabs need them (until then they show "Could not load this"). Run 0009 before opening the Pantry: the kitchen screen needs `kitchen_layouts` and the new columns (until then it shows "Could not load this"). The first time it opens, your old kitchen map (0007) is converted into the new layout; the old table stays untouched. After 0008, **Table Editor** should list the four new tables with the RLS badge, and **Database > Functions** should list `cook_recipe` and `undo_cook`. Until 0008 is run, the Cook tab shows "Could not load this"; cooking itself needs the two functions.

Until they are run, those screens show "Could not load this" or "Could not save the workout"; the rest of the app is unaffected.

## 2. Your Supabase project
1. **Google sign-in:** Supabase -> Authentication -> Providers -> Google -> turn on, paste the Client ID and Secret from Google Cloud Console (APIs & Services -> Credentials -> OAuth client).
   In that OAuth client add `https://<your-ref>.supabase.co/auth/v1/callback` under Authorized redirect URIs.
2. **Redirect URLs:** Supabase -> Authentication -> URL Configuration. Add `http://localhost:5173/**` now (use the port `npm run dev` prints), and your live address after deploying (see `DEPLOY.md`).

## 3. Deploy (when you want to)
Follow `DEPLOY.md`: pick Vercel or Cloudflare Pages, set the environment variables listed there, deploy, then add the live address to Supabase Redirect URLs.

## 4. Optional: AI chat and "Generate my plan"
1. Get a key (Google AI Studio for the default Gemini provider: https://aistudio.google.com/apikey -> Create API key).
2. Put it in your local `.env` as `AI_API_KEY=...` (never commit it; `.env` is ignored), and in the host's environment variables when deployed.
Without it the app works; chat and "Generate my plan" will say they are unavailable.

## 5. After pulling this branch
Run `npm install` (new packages: `@dnd-kit/sortable`, `@dnd-kit/utilities`; Lovable packages removed; the lockfile is now `package-lock.json`).

## 6. Pantry
1. **Migrations:** run `0004` to `0009` (step 1). Each Pantry tab shows "Could not load this" until its file is run.
2. **Optional AI check on receipts:** needs `AI_API_KEY` set (step 4). Then turn it on in Pantry > Receipt. It is off by default and sends only the text of lines the dictionary could not match.
3. **Photo receipts:** the first photo needs internet; the browser downloads the OCR engine and German data from a CDN once. The photo itself never leaves your device.
4. **Store-specific parsers:** only a generic German parser exists. To add one for your store, send 3 or more real receipts (PDF, pasted text or photo text; blank out anything private) and the store name.
5. **Measure OCR on your own photos:** put photos and expected text in `scripts/ocr-eval/samples/` (git-ignored) and run `npm run ocr:eval`. See `scripts/ocr-eval/README.md`.
6. **Your real kitchen layout:** the Kitchen tab starts with a default template. Edit it there, or send a photo and a description so a layout file can be written for you. Layouts are never read from a photo automatically.
7. After pulling: `npm install` (new: `pdfjs-dist`, `tesseract.js`; dev: `tsx`, `jpeg-js`, `pngjs`, `@electric-sql/pglite`, `puppeteer-core`).

## 7. Receipt photo helper
1. **Camera:** the in-app camera with the guide frame needs `https` (your deployed address) or `localhost`. Over plain `http` on your home network the browser refuses, and the app falls back to the phone's own camera app.
2. **Check the limits on your own photos:** the thresholds for "too dark", "too bright", "too blurry" and "too small" are in `src/features/pantry/photo-config.ts`. They were set on invented test images. Take 5 to 10 normal receipt photos; if a good one is rejected, lower the limit and tell me which number it was.
3. **See whether the helper really helps:** put your receipt photos and what they really say in `scripts/ocr-eval/samples/` (git-ignored, see `scripts/ocr-eval/README.md`) and run `npm run ocr:eval`. It reads every photo as taken and after the helper and prints both. I could not do this with real receipts; the only comparison I have is on invented ones. If the helper does not help on yours, tell me the numbers.

## 8. Cooking
1. **Migration:** `0008_recipes.sql` (step 1). It also creates two database functions; no extra setting is needed.
2. **Optional AI cooking chat:** needs `AI_API_KEY` set (step 4) and migration `0011`. Turn on **AI cooking chat** in Pantry > Settings > AI. It is off by default. It sends your message, your stock (item names, amounts and units) and your recipe titles; never receipts, photos or dates. The old "AI recipe ideas" switch on the Can cook tab is gone (the chat replaces it).
3. **Nutrition data:** the table is filled once from USDA FoodData Central the first time you open the Cook tab. Foods it does not cover (for example quark, passata, 1.5% milk) are not in it; add them in Cook > Nutrition from the package label, or tell me which ones you use most.
4. **Your recipes:** nothing is preloaded. Add your own in Cook > Recipes, or send me a few and I can load them.

## 9. Illustrated kitchen
1. **Migration:** `0009_kitchen_scene.sql` (step 1). Open Pantry afterwards; the default places it needs (for example "Meat and fish", "Base cabinet") are created automatically. Existing places and items are not touched.
2. **Your own kitchen:** when you have photos of your kitchen, send them, or write a layout file by hand (`docs/kitchen-layout.md`) and import it in Pantry > Settings > Kitchen layout.
3. **Icons:** already in `public/icons/food`. To download them again: `node scripts/icons/fetch.mjs`.
4. **Screenshots:** `npm install`, then `node scripts/kitchen-shots/shoot.mjs screenshots/kitchen` (needs Microsoft Edge; set `EDGE_PATH` otherwise).

## 10. Receipts, categories and places (build-fixes)
1. **Migration:** `0010_categories_places.sql` and `0011_ai_chat_shopping.sql` (step 1).
2. **Layout upgrade:** the first time you open Pantry after 0010, the app adds the missing default fridge and freezer compartments to your kitchen layout and moves a plant that stood on the cooker or hood. Nothing else in your layout changes; it happens once (`layout_upgraded`).
3. **Organize:** your existing items stay where they are. Pantry > All items > **Organize** lists suggested moves (for example fish out of the vegetable drawer); nothing moves until you confirm.
4. **Needs a category:** items whose old category could not be converted by name (old `produce` that is neither fruit nor vegetable) are listed under All items > Needs a category.
5. **Kaufland abbreviations:** only seven are seeded (`src/features/pantry/receipt-data.json`). Lines the parser cannot read stay "Unknown" in the review; confirm them once and they go into your dictionary. To add more, send the receipt line and the product.
6. **Screenshots and the overlap check:** `node scripts/kitchen-shots/shoot.mjs screenshots/kitchen` and `npx tsx scripts/kitchen-shots/layout-check.ts` (both need Microsoft Edge; set `EDGE_PATH` otherwise).
