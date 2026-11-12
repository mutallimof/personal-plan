# Changelog

Changes on branch `build-v1`. Behavior changes to existing features are marked **Behavior**.

## Feedback round (branch `build-fixes`)
### Fridge and freezer
- **Behavior:** the compartment names are now on the right side of each row (wrapped and shrunk to fit their column), so they never overlap pictures, quantity chips or the Empty / + controls. Products stand in the part left of the name.
- **Behavior:** the fridge and the freezer have one drawer, **Meat and fish**. Vegetables, Fruit, Vegetables and fruit, Ready meals and Other are open shelves where the items are visible. Saved layouts are tidied once (layout `rev` 2, stored inside the layout file, no migration): Top, Middle and Bottom drawer compartments are removed, other drawers become shelves, and items that were in the removed drawers move to a shelf of the same cabinet that accepts their category (else the cabinet's own place). Pantry places are never deleted.

### Plant
- **Behavior:** the plant stands on the top edge of the worktop (it used to sink 2 units into the slab) with a small contact shadow, and never overlaps the cooker, a cabinet, the hood or the window. Saved layouts are corrected once (layout `rev` 3): a plant that is not properly grounded moves along the counter to the nearest free spot.

### AI chat errors
- **Behavior:** a rejected request is no longer always reported as "I'm a bit busy". The real cause was HTTP 429 `quota limit: 0` (free tier has no allowance for `gemini-4-carbon`). Failures are now sorted: no quota, rate limit, overloaded (5xx), timeout, network, rejected key, unknown model. Busy, overloaded, timeout and network failures are retried up to 3 times with a growing wait (honoring `Retry-After`); no quota or an unknown model goes straight to a fallback model (`AI_FALLBACK_MODEL`, default `gemini-3.6-flash` for Gemini). If everything fails, the message names the model and the HTTP status and says what to change. The first answer is awaited at most 60 s (`AI_TIMEOUT_MS`), and a stream that goes quiet is cut off, so the chat can no longer spin forever.
- **Behavior:** the default Gemini model is now `gemini-3.6-flash` (stable; `gemini-3.8-flash` stalled in a test).
- The server log shows `AI provider error: model=... attempt=... kind=... status=...` and the provider's message, never the key.

## Fixes round (branch `build-fixes`)
### Receipts
- **Behavior:** the receipt parser was rewritten. Two-line items (name, then "2 x 1,29" or a weight line), sizes inside names ("1L", "250g", "6x0,33") and own-brand prefixes (Kaufland: K., KPur.H., KLC., KBB, ...; kept in `receipt-data.json`) are understood. A discount line now belongs to the previous product (price only). Deposit, bag, payment, loyalty and tax lines go to a collapsed **Ignored lines** list with **Restore**.
- **Behavior:** weights under 1 kg are now stored in grams (0.946 kg becomes 946 g); the unit is taken from the name when it has one ("1L" gives 1 l). Unknown meat and fish without a printed weight default to 500 g.
- **Behavior:** non-food (toilet paper, ...) goes to the new category *Household* and is skipped by default, with a **Track anyway** switch.
- New: Kaufland parser module and seed of seven sure abbreviations; invented-receipt test suite.
- **Behavior:** the review screen has a category dropdown and a place dropdown filtered by category; changing the category moves the item to a place that accepts it.
### Categories, places, units
- **Behavior:** the category list is new: vegetables, fruit, meat, poultry, fish, dairy, eggs, bakery, dry goods, canned, sauces and condiments, spices, oils and fats, snacks and sweets, drinks, frozen, household, other. Migration 0010 converts `produce` (by keyword to fruit, vegetables or other) and `meat` (poultry items to poultry) and moves nothing. Categories can be added and renamed in Settings > Categories (not deleted).
- **Behavior:** places declare the categories they accept (editable in the layout editor). A receipt line goes to the first place that accepts its category, then to a place of the wanted kind. The default fridge has Meat and fish, Dairy and eggs and Drinks and sauces; the freezer compartments are renamed (Vegetables and fruit / Meat and fish / Ready meals). **Organize** proposes moves for existing items.
- **Behavior:** the starter dictionary is versioned (`aliases_seed_version`); new entries are added once, your edits are kept.
- **Behavior:** amounts read "1 piece" / "20 pieces"; items and recipes get sensible default units per category.
### Icons
- **Behavior:** icons are chosen by user icon, then dictionary icon, then specific keywords, then category. Cream and sauce bottle are new (Twemoji, CC-BY 4.0); pork goes with ham, cream words no longer show milk, "bananas" no longer shows a pineapple. A table of 85 names and a distinctness test guard this.
### Kitchen visuals
- **Behavior:** each compartment has a header strip with its name; products stand on the shelf line with the quantity badge fully visible; the open door fades out instead of leaving a sliver over the fridge; "Empty" and "+" no longer overlap (they are hidden when the shelf is too low); the plant no longer overlaps the cooker or hood (and existing layouts are corrected once).
- New: an automated overlap check (`scripts/kitchen-shots/layout-check.ts`, also run by `npm test` when Edge is installed) opens every cabinet in headless Edge at 375 and 1280 px, light and dark, and fails on text over text, badge, button or shelf line, and on badges or buttons cut by a shelf line.
### AI cooking chat
- **Behavior:** the "AI recipe ideas" switch and **Get ideas** button on Can cook are replaced by the chat: Cook > **Ask AI**. Off by default; turn it on in Settings > AI (one line says what is sent). The model gets a compact stock list (name, amount, unit) and your recipe titles, and uses five tools: `search_pantry`, `suggest_recipes`, `save_recipe`, `cook_recipe` (only opens the existing confirmation screen; nothing leaves the pantry without your confirmation) and `add_to_shopping_list`. Every tool call and reply is validated; malformed output is handled without a crash. Calories and protein come only from your nutrition table. A request counter and short messages for provider errors and rate limits are included.
- New: Cook > **Shopping** (a plain list), migration `0011` (`shopping_list` with row-level security, `ai_chat`, `ai_chat_requests`). Empty recipe list shows **Add recipe**, **Import recipes (JSON)** and, with AI off, a link to Settings. The manual path (Can cook ranking, recipe editor, Cook this with undo) is unchanged. The old `ai_recipes` columns stay in the database unused.
- **Behavior (fixes after the round):** the chat reply is streamed (words appear as they arrive, with a typing indicator before the first one); the model gets only the stock as one short line per item (name, amount, unit; no expiry dates, so "use up what expires soon" is no longer something it can see); the thinking effort is set low for Gemini (`AI_REASONING`, see `.env.example`).
- **Behavior (fixes after the round):** "missing ingredient" matching is now done in code only: names are compared word by word after dropping amounts and freshness words ("Dill Bund" is "Dill"), folding plural endings (Zitrone/Zitronen), a small German/English synonym table (Sahne/Schlagsahne/cream, Lachs/Lachsfilet/salmon, ...) and receipt-style cut-off words ("Lachsfil"). Food that is in the pantry in a unit that cannot be compared (2 pieces of salmon against 500 g, a bunch of dill against a pack) counts as in stock, not missing; used-up entries (quantity 0) count as absent. "Cook this" says so and takes nothing out for such a line unless you enter an amount. The state "different unit" is gone.
- **Behavior (fixes after the round):** opening a cabinet no longer draws the other cabinets' contents, the title and back button never cover the cabinet (it is fitted below them), and in crowded cabinets the label strip shrinks before pictures can rise into it.
- The Cook tab bar now has five tabs (Can cook, Recipes, Ask AI, Shopping, Nutrition), slightly narrower on phones.

## Kitchen round (branch `build-kitchen`)
- **Behavior:** the Pantry tab bar (Items / Receipt / Dictionary / Kitchen / Cook) is gone. `/pantry` opens on the illustrated kitchen. Add receipt, Cook and All items open as full-screen sheets; Dictionary, Nutrition table, AI check and the layout editor are under Settings (gear). The AI check switch moved from the receipt page to Settings. Old addresses (`/pantry/receipt`, `/pantry/cook`, `/pantry/dictionary`, `/pantry/kitchen`) redirect.
- **Behavior:** the flat zone map is replaced by the illustrated kitchen. The layout is one JSON document per user (`kitchen_layouts`, migration 0009), importable and exportable; your earlier map is converted the first time. The old `kitchen_zones` table is no longer used (not deleted).
- New: open a cabinet (door animation, zoom, interior with products as pictures), drag products between shelves and compartments, search that zooms to the item, product icons (Twemoji, CC-BY 4.0) chosen automatically or by you per item and per dictionary entry; receipts keep the dictionary icon. Respects reduced motion.
- New: layout editor and file format (`docs/kitchen-layout.md`); headless screenshot script.
- `undo_cook` now also restores the icon and shelf of an item that cooking used up. Test timeouts were raised for slow machines.

## Next round (branch `build-next`)
### Receipt photo helper
- New: *Photo of a receipt* opens a capture screen (camera with a guide frame on phones, file picker and drag and drop on a computer), checks the photo (too dark, too bright, too blurry, too small) with *Retake* and *Use anyway*, then crops to the paper, straightens the text lines and stretches the contrast. A preview shows the original next to the cleaned-up photo, with a *Use original* switch.
- **Behavior:** photos used to be converted to grey and contrast-stretched before reading; they now go through the helper (crop and straighten as well) unless *Use original* is on. On invented test receipts this read more lines exactly (100% against 84%); on real photos it is unmeasured (see `MANUAL_STEPS.md`).
- **Behavior:** the *Black and white* switch moved from the Receipt page into the photo preview, and it now uses a local threshold that follows shadows instead of one global cut. It stays off by default because on the invented receipts it found fewer products than plain grey.
- **Behavior:** `npm run ocr:eval` now reads every image twice (as taken, and through the helper) and prints both with the difference. Removed the unused `enhance` and `binarize` functions.
- Tests: new unit tests for each step on invented images, and for the capture screen.

### Cooking (Phase G)
- New: Pantry > **Cook** with *Can cook*, *Recipes* and *Nutrition*. Recipes can be created, edited, searched and deleted without AI. Rough energy and protein per serving come from an editable nutrition table filled once from USDA FoodData Central (public domain); ingredients without data are left out and labeled ("approx., 2 ingredients missing").
- *Can cook* ranks recipes against the pantry (complete first, then missing 1 or 2, preferring food that expires soon). Units g/kg and ml/l convert; pieces are never converted to grams.
- *Cook this* shows every ingredient with the amount to remove (editable, skippable), updates the pantry and writes the log in one database transaction, and offers *Undo* for ten minutes. A *Cooked recently* list shows today's totals, labeled approximate.
- Optional AI recipe ideas (off by default): only ingredient names, quantities and units are sent; the answer is validated, nutrition is computed from the table (the model's numbers are not used), and nothing is saved without you saving it. A request counter is shown.
- New tables and functions in `migrations/0008_recipes.sql` (row-level security on all four tables). New dev dependency `@electric-sql/pglite`, used only to test the migration.
- **Behavior:** the Pantry tab bar has a fifth tab, so the tabs are slightly narrower on phones. The shared settings query now also returns the AI recipe settings. `src/test/setup.ts` no longer assumes a browser window (so one test can run in plain Node). No gym behavior changed.

## Pantry (branch `build-pantry`, phases A to F)
- New: Pantry replaces the "coming soon" page with four tabs. **Items** (places, units, expiry markers, equal items merge), **Receipt** (paste, PDF, HTML or photo OCR, then a review screen where unknown lines come first),
  **Dictionary** (product aliases, starter data, JSON import and export, learning from your confirmations) and **Kitchen** (SVG map of zones, drag items between zones, layout editor, JSON import and export).
- Optional AI check for unmatched receipt lines: off by default, text only, suggestions are never saved without your confirmation.
- New tables (migrations `0004` to `0007`, RLS on all): `pantry_locations`, `pantry_items`, `pantry_settings`, `product_aliases`, `kitchen_zones`.
- New packages: `pdfjs-dist`, `tesseract.js`; dev `tsx`, `jpeg-js`, `pngjs`. New script `npm run ocr:eval`.
- Existing behavior: the Pantry nav entry now opens real pages instead of the placeholder. The gym section is unchanged.

## Exercise movement images
- The exercise page shows a start/end picture card above the steps. The two pictures fade into each other every second; a pause/play button stops it. With reduced motion on, both pictures show side by side and nothing animates.
- Pictures are not copied into the repo. They load from the public free-exercise-db repo (Unlicense, no separate image terms) through jsDelivr, pinned to a commit. Lazy-loaded, 3:2 box reserved up front.
- No schema change and no migration. `src/features/gym/exercise-images.ts` is a generated slug -> source id map (`node scripts/exercise-import/convert.mjs` rewrites it). Exercises you created yourself, or that fail to load, show no card.
- No existing behavior changed.

## Phase 0: Lovable removed
- Removed `src/integrations/lovable/`, `.lovable/`, `@lovable.dev/cloud-auth-js`, `@lovable.dev/vite-tanstack-config`,
  the Lovable error reporter, the preview-auth storage broker, and the unused `cron-auth.ts` and `client.server.ts`
  (nothing imported them; `client.server.ts` held the service-role client).
- **Behavior:** the Supabase session now uses the browser's normal storage (it was routed through a Lovable preview broker that only acted on Lovable preview domains).
- Replaced the Lovable Vite wrapper with a plain `vite.config.ts` (TanStack Start, React, Tailwind v4, tsconfig paths, nitro on build).
  The build now picks its output format from the host (Vercel/Cloudflare Pages auto-detected, Node server locally) instead of always targeting a Cloudflare Worker.
- **Package manager: npm.** bun is not installed here, so `bun.lock` and `bunfig.toml` were deleted and `package-lock.json` is now tracked (no longer git-ignored).
- Favicon is a green dumbbell SVG (`public/favicon.svg`); the old `favicon.ico` was removed. `twitter:card` changed to `summary` (there is no share image).
- `AGENTS.md` rewritten for this project; README, AUDIT, error messages and `supabase/config.toml` project id updated.
- Package renamed `tanstack_start_ts` to `lifeplan`; `drizzle.config.ts` reads `DATABASE_URL`.

## Phase 1: gym features
- **Workout logging.** "Start workout" on every session card and session page opens `/gym/workout/:id`. Tick sets, edit reps and weight per set,
  finish to save. An unfinished workout is kept in the browser and resumes on reload. After finishing, if every set was done and you lifted
  heavier than planned, "Update plan weight?" offers to change the plan. New tables `workout_logs`, `workout_sets` (`migrations/0002_workout_logs.sql`).
- **Progress.** Exercise pages show a weight/reps line chart from your logs. A "Go up" marker appears (exercise page and session page) when the last two
  logged sessions both hit the top of the rep range on all sets at the same weight.
- **Library muscle filter.** Tap a muscle on the body diagram to filter the library by primary muscle (side panel on desktop, "Body" chip on phones).
- **Session page.** Drag handle to reorder, duplicate button, estimated duration (40 s work + 90 s rest per set, 1 min per exercise).
  **Behavior:** the exercise name in a session row is now a link to the exercise page (added earlier on this branch's parent).
- **Plan home.** A "Next" card suggests the session after the one you logged last (plan order, wraps around, no weekdays). Each session card has a Start button.
  **Behavior:** the plan cards are now a container with a link plus a button instead of one big link.
- **Profile page** (`/profile`, new nav item): edit height, weight, goal, sessions per week; weekly body-weight log with chart (`migrations/0003_body_weight_logs.sql`).
  **Behavior:** on phones "Sign out" moved from the bottom bar to the Profile page (the bar now has Gym, Languages, Pantry, Profile). Desktop sidebar is unchanged.
- New dependencies: `@dnd-kit/sortable`, `@dnd-kit/utilities`.

## Phase 2: polish
- **PWA.** `manifest.webmanifest`, green dumbbell icons (`scripts/make-icons.mjs` regenerates them), `sw.js` and `offline.html`. The service worker caches built assets and the
  last good copy of `/`, `/gym*` and `/profile`; it never touches Supabase or non-GET requests, and only registers on production builds.
  The last loaded plan is also kept in localStorage per user (cleared on sign-out) so the Plan page shows offline.
- **Behavior:** the sign-in guard for the app now reads the stored session (`getSession`) instead of asking the server (`getUser`), so the app opens offline.
- **Behavior (look):** text on green is now near-black (`--primary-foreground`), since white on #22C55E is 2.3:1; green *text* uses a darker green (`--primary-ink`);
  muted grey text is slightly darker; focus rings are 2 px dark green on buttons, inputs, chips and links.
- **Mobile pass at 375 px** (checked in a browser with a mocked API): default buttons, inputs and icon buttons are 44 px tall on phones (still compact on desktop);
  chat button hidden on the workout screen so it does not cover Finish; no horizontal scroll on any page.
- **Fixed on the way:** week header read "Nov 9 – 2026 (day: 15)", now "Nov 9 – 15, 2026"; "1 exercises" now "1 exercise".
- **States.** Shared `Loading`, `QueryError` (with Try again) and `Empty` in `src/components/states.tsx`, used on plan, session, workout, exercise, library, profile, week and month.
- **Accessibility.** Labels on sign-in and onboarding fields, `aria-pressed` on chips, `aria-label`s on workout set inputs and checkboxes, radio semantics on session/goal pickers.
- `DEPLOY.md` added (Vercel and Cloudflare Pages, env vars, Supabase redirect URLs). Nothing deployed.
- Tests: 42 total (progress rules, workout rows and saving with rollback, region mapping, profile form, plan cache, PWA files).
