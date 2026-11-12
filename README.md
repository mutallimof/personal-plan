# Lifeplan

A personal life planner, currently focused on gym training.

## What works today
- Email/password and Google sign-in (Supabase auth), onboarding profile form
- Plan page: training sessions as cards, add a session
- Session page: rename, delete, edit sets / reps / weight, swap, add and remove exercises
- Exercise library: virtualized list, search, muscle and equipment filters, common exercises shown first.
  38 exercises are seeded; an optional import adds about 850 more (see below)
- Workout logging ("Start workout"), per-exercise progress charts and a "Go up" marker, next suggested session
- Body diagram on exercise pages and as a tap-to-filter in the library; exercise pages with steps and variations
- Session page: drag to reorder, duplicate, estimated duration
- Profile page with a weekly body-weight log
- Installable on a phone (PWA) with an offline copy of the plan
- Week view (drag sessions onto days) and month calendar
- AI chat panel that edits your plan through tools (add, swap, update, schedule, profile)
- Pantry: items by place with expiry markers, a product dictionary, receipt import (paste, PDF, HTML, photo OCR with a photo helper) with a review screen, a visual kitchen map, and cooking: recipes, rough calories and protein, what you can cook now, and removing used food when you cook
- "Languages" tab is a placeholder

See `AUDIT.md` for open items.

## Stack
TanStack Start (React 19) + Vite, Tailwind v4 + shadcn/Radix, Supabase (auth, Postgres with RLS),
TanStack Query, and a configurable AI provider (Gemini by default, see `.env.example`).

## Run
```sh
npm install
npm run dev     # dev server
npm run build   # production build
npm test        # vitest
```
Needs a `.env` with your Supabase URL and publishable key. Copy `.env.example` and fill it in.

## Docs
- `MANUAL_STEPS.md` things only you can do (SQL files to paste, Supabase settings), `TESTING.md` what to click, `DEPLOY.md` hosting, `CHANGELOG.md` what changed.

## Layout
- `src/routes/` file-based routes (`routeTree.gen.ts` is generated, do not edit)
- `src/features/gym/` data access, AI tools, body map, exercise browser
- `src/features/pantry/` pantry items, product dictionary, receipt parsing, OCR, review screen
- `src/features/cook/` recipes, nutrition, what can I cook, cooking and undo
- `src/features/kitchen/` the illustrated kitchen: layout file, open/zoom view, interiors; `docs/kitchen-layout.md` describes the layout file
- `scripts/icons/` downloads the product icons; `scripts/kitchen-shots/` takes screenshots of the kitchen scene
- `scripts/ocr-eval/` measures OCR accuracy on your own receipt photos
- `scripts/nutrition-import/` builds the starter nutrition table from USDA FoodData Central
- `drizzle/migrations/` and `setup.sql` original schema and seed data; `migrations/` newer changes (run by hand in the Supabase SQL editor)

## Pantry
The Pantry opens on one illustrated **kitchen**: wall shelf, glass cabinet, spice shelf, drawers, base cabinets and a
tall fridge-freezer. Tap a cabinet: the door opens, the view zooms in and the products stand on shelves as pictures
(quantity badge, amber or red dot when they expire soon, a small stack for several). Tap a product for its sheet
(quantity, unit, expiry, place, icon, remove), drag it to another shelf or compartment, or drop it outside the cabinet to
choose another place. The back button, Escape, a tap on the wall and the browser back button all close it; with reduced
motion there is a short fade instead of the animation. The search box finds an item and opens the cabinet it is in.
**Add receipt**, **Add item**, **Cook** and **All items** open as sheets; **Settings** (gear) holds the dictionary,
nutrition table, AI check and the layout editor with import and export. The scene is drawn by code
(`src/features/kitchen/`), its colours are in `scene-theme.css`, and every cabinet comes from a layout file, see
`docs/kitchen-layout.md`. All tables are private to the signed-in user (row-level security, see `migrations/0004` to
`0009`). Older text below that says "tab" now refers to these sheets and settings pages.

**Product pictures** come from Twemoji (graphics copyright Twitter, Inc and other contributors, licensed CC-BY 4.0,
https://github.com/jdecked/twemoji). About 100 SVGs are copied into `public/icons/food` (nothing is loaded from a CDN);
`node scripts/icons/fetch.mjs` re-downloads them from the list in `src/features/pantry/icons/icons.json`. The app shows
the credit under the kitchen. A product gets its picture from the icon chosen for the item, then the one chosen in the
dictionary, then a keyword match on the name (English and German), then its category.

**Screenshots.** `node scripts/kitchen-shots/shoot.mjs <folder>` draws the scene with invented data in Edge (headless,
uses `puppeteer-core`) at 375 and 1280 px, light and dark.

**Items.** Items live in places (fridge, vegetable drawer, freezer, shelves, ...; a default set is created once).
Adding an item with the same name and unit in the same place adds to the existing one. Items expiring within three
days, or already expired, are marked.

**Receipts, step by step.** Everything below runs in the browser.
1. *Input.* Paste text, upload a PDF (text is extracted with pdf.js; a scanned PDF has no text, use a photo),
   upload a text or HTML file, or take a photo (see OCR below).
2. *Parse.* `receipt.ts` finds the store from the header and reads the purchased lines: name, quantity (`2 x 0,99`),
   weight (`0,532 kg x 2,99`), prices. It stops at the total and skips deposits and discounts. A generic parser covers
   the usual German layout; a parser per store can be added to `STORE_PARSERS`.
3. *Match.* `normalize.ts` turns the printed text into a key (upper case, umlauts spelled out, prices, weights, pack
   counts and article numbers removed; fat percentages stay). `match.ts` looks it up in the dictionary: an exact
   match is accepted, a close spelling is only offered as **uncertain**, and different numbers never match.
4. *Review.* `review.ts` builds one line per product with name, quantity, unit, category and place. Unknown, uncertain
   and low-confidence lines are highlighted and listed first. Nothing is saved until every highlighted line is
   confirmed (edit it or tap *Looks right*) or skipped.
5. *Save.* Items go into the pantry. Every line you corrected, or that was not an exact match, is written to the
   dictionary (`learn.ts`), so the same text is recognized next time.

**Dictionary.** View, search, edit, add and delete entries, or import and export them as JSON to write them by
hand. A small starter set of German supermarket texts is added once.

**Photo OCR.** A photo goes through the photo helper (below) and is then read by
[tesseract.js](https://github.com/naptha/tesseract.js) with the German language data. It runs in a web worker in the
browser and is loaded only when you use it. The photo is never uploaded. The first use downloads Tesseract and the
language data (about 10 MB; the browser keeps it afterwards), so it needs a connection once. Each line gets a
confidence from Tesseract; lines below 80% are highlighted.

**Taking a good receipt photo.** On a phone, *Photo of a receipt* then *Take photo* opens the camera with a frame to
line the receipt up in (if the camera cannot be opened, the phone's own camera app is used instead). On a computer,
choose a file or drop it on the box. All of this runs in the browser; nothing is uploaded.

Before reading, the helper checks the photo and cleans it up (`photo-quality.ts`, `receipt-prep.ts`,
`image-geometry.ts`, `image-prep.ts`: plain functions over pixels, no image library):

| Step | What it does |
| --- | --- |
| Too small | Rejects photos under 600 x 900 px. Small print needs pixels. |
| Too dark / too bright | Looks at the mean grey level of the paper (not the table around it). Below 85 or above 238 of 255 is flagged. |
| Too blurry | Variance of the Laplacian (how strong the edges are) at a fixed working size. Below 60 is flagged. |
| Crop | Finds the largest bright region (the paper) and cuts to it with a small margin. Skipped when the paper already fills the photo. |
| Straighten | Estimates the tilt of the text lines (where dark pixels pile up into the fullest rows, up to 12 degrees) and turns the image level. Tilts under 0.4 degrees are left alone. |
| Contrast | Stretches the grey range. *Black and white* additionally applies a local threshold (follows shadows). |

The limits are in `photo-config.ts`. They were set on invented test images, not on a collection of real phone photos, so
adjust them if good photos are rejected. A failed check shows one short message with *Retake* and *Use anyway*. The next
screen shows the original and the cleaned-up photo side by side; *Use original* reads the untouched photo instead.

Tips:
- Flatten the receipt on a dark, matte surface, or hold it flat against a wall.
- Daylight from the side or from above; no flash and no shadow of the phone.
- Fill the frame with the receipt and hold the phone straight above it, not at an angle.
- Photograph a long receipt in two parts. Hold still and tap to focus on the text.

*Limits.* Thermal paper is the hard case: faded or grey print, curled paper and shiny glare cost accuracy, and prices
are misread more often than names. The straightening only fixes a flat tilt, not a curled or folded receipt, and the
crop assumes the paper is brighter than what is under it (a white receipt on a white table is not cropped). On
invented test receipts (rendered text on a dark table, tilted up to 5 degrees, with shadow or dim light) the helper
read 100% of the lines exactly against 84% for the untouched photo, and *Black and white* was worse than plain grey
(it found 36 of 40 products, plain grey found 40). That is a synthetic result; run `npm run ocr:eval` on your own photos, which
reads each one both ways and prints the comparison. *Black and white* is therefore off by default.

**Optional AI check (off by default).** The *AI check for unknown lines* switch on the Receipt tab is stored per user
(`pantry_settings`, `migrations/0006`). When it is on, the text of lines the dictionary could not match goes to the AI
provider you configured with the `AI_*` variables (`ai.functions.ts`, server side, the key never reaches the browser).
What is sent is only the normalized text of those lines (no prices or weights), never a photo, a whole receipt or
anything from your pantry. The answer (name, category, usual place) appears as a suggestion on the line; it is applied
only when you tap *Use*, and the line still has to be confirmed. A counter shows how many lines have been sent so far.
If the provider fails or is not configured, you get a message and the import carries on.

**Visual kitchen.** The *Kitchen* tab draws your kitchen as rounded rectangles ("zones") on a fixed 100 x 70 canvas
(`migrations/0007`). Each zone points at a pantry place, and shows that place's items as small category emoji.
- *Look.* Tap a zone to see its items below (or beside) the map. A zone with compartments, like the fridge with its
  drawers, opens up to fill the map; use *Back* to zoom out. Drag an emoji onto another zone to move that item
  there; if an equal item is already in the new place the two are merged. Dropping on a zone that is not linked to a
  place does nothing.
- *Edit.* *Edit layout* lets you drag zones (what is inside moves along), drag the green corner to resize, or type
  exact values; add, rename, re-link, nest and delete zones. Deleting a zone keeps its pantry place and items.
- *Your own layout.* *Export* writes `kitchen-layout.json`; *Import* replaces the layout with one from a file after
  asking. The file is a list of zones: `key`, `name`, `kind` (fridge, freezer, shelf, drawer, cupboard, other),
  `x`, `y`, `width`, `height`, `parent` (another zone's key, or null) and `location` (the pantry place's name, created
  if missing). A file with any mistake is rejected as a whole, with every problem listed. New users start with a
  default template (`DEFAULT_LAYOUT` in `kitchen.ts`), created once.

**Cook.** The *Cook* tab (`src/features/cook/`, `migrations/0008`) has three views.
- *Can cook.* Your recipes ranked against the pantry: everything available first, then "missing 1" and "missing 2" with
  what is missing named; recipes that use food expiring in the next three days come first inside each group.
  Amounts are compared in grams, millilitres, pieces or packs: g/kg and ml/l convert into each other, but pieces are
  never turned into grams or the other way round (such an ingredient is shown as "different unit"). Names match
  ignoring case, accents and a plural *s*; a recipe ingredient can also be linked to one pantry item.
- *Cook this* opens a confirmation listing every ingredient with the amount that will leave the pantry. Each amount is
  editable (never above what you have), any ingredient can be skipped, and the servings can be changed. Taking food from
  items that expire first, *Cook* reduces or removes the pantry quantities and writes the log in one database
  transaction (`cook_recipe` in the migration: if any part fails, nothing changes). *Undo* (right after cooking, and in the
  *Cooked recently* list for ten minutes) puts the amounts back (`undo_cook`). The list also shows today's energy and
  protein of the meals cooked, labeled approximate.
- *Recipes* and *Nutrition.* Create, edit, delete and search your own recipes (name, servings, ingredients with amount
  and unit, steps) without any AI. The nutrition table holds energy and protein per 100 g, per 100 ml or per piece; you
  can edit, add and delete rows. Per-serving numbers are summed from it. An ingredient with no matching row (or only a
  row for another kind of unit) is left out and the label says so: "approx., 2 ingredients missing". Numbers are rough
  by nature (raw weights, generic foods, no cooking losses).

*Nutrition data.* The starter table (42 foods, 60 rows) is read from **USDA FoodData Central**, Foundation Foods
(2025-12) and SR Legacy (2018-04), which are public domain (CC0 1.0); every row names its record, e.g.
`USDA FoodData Central SR Legacy 2018-04, 171287: Egg, whole, raw, fresh; 1 large = 50 g`. Per-100-ml values are worked
out from the dataset's own weight of one cup (236.588 ml); per-piece values from its portion weights. Nothing is
estimated; foods the dataset does not have in a usable form (for example quark, passata, 1.5% milk, minced mixed meat)
are left out and can be added in the UI. The table is copied into your account once (rows you delete stay deleted).
To regenerate it, download the two CSV archives named in `scripts/nutrition-import/build.mjs`, unzip them and run
`node scripts/nutrition-import/build.mjs <foundation folder> <sr legacy folder>`; edit the curated list in
`scripts/nutrition-import/foods.json`, and look for foods with `node scripts/nutrition-import/search.mjs <folder> <word>`.

**Optional AI recipe ideas (off by default).** The *AI recipe ideas* switch on the *Can cook* view is stored per user
(`pantry_settings`). When on, *Get ideas* sends the provider you configured with the `AI_*` variables (server side, the key
never reaches the browser) a list of ingredient **names, quantities and units** from your pantry, nothing else (no
dates, places, notes or account data), and asks for three recipes as strict JSON. The answer is validated against a schema
(anything malformed is dropped), ingredients are matched to your pantry names where they are the same food, and energy and
protein are computed from your nutrition table: numbers from the model are never used. An idea is only a suggestion;
*Review and save* opens the normal recipe form and nothing is stored until you save. Provider errors show a short message
and the page keeps working; the number of requests made is shown next to the switch.

*SQL tests.* `src/test/migrations.test.ts` runs migration 0008 on an in-memory Postgres (PGlite, a dev dependency) with a
stand-in for Supabase's `auth.uid()`: it checks that the file can be run twice, that row-level security keeps users apart,
that `cook_recipe` is all-or-nothing and that `undo_cook` restores amounts (also when the place was deleted meanwhile).
It does not test Supabase itself.

**Measuring accuracy.** `npm run ocr:eval` runs the same pipeline over your own photos, once as taken and once through the helper, and prints line-level accuracy for both;
see `scripts/ocr-eval/README.md`. Receipt photos and text are private: never commit them (the samples folder is
ignored by git).

## Exercise import (optional)
`scripts/exercise-import/` turns [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Unlicense, public domain) into idempotent SQL. It is data only: it never changes existing rows or the schema.

```sh
node scripts/exercise-import/convert.mjs      # regenerates scripts/exercise-import/sql/
```
Then run `scripts/exercise-import/sql/exercises-import.sql` (or the smaller files in `sql/parts/`) once in the
Supabase SQL editor. Running it again adds nothing. Muscle, equipment and family mappings are in
`scripts/exercise-import/mappings.mjs`. The "popular first" list is `src/features/gym/popular.ts`.

The same script writes `src/features/gym/exercise-images.ts` (exercise slug -> free-exercise-db id). The exercise page builds its
movement-picture URLs from it and loads them from the public repo via jsDelivr; nothing is copied.

Exercise data and pictures: free-exercise-db by yuhonas and contributors, released under the Unlicense.
