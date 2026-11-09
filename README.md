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
- Pantry: items by place with expiry markers, a product dictionary, and receipt import (paste, PDF, HTML, photo OCR) with a review screen
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
- `scripts/ocr-eval/` measures OCR accuracy on your own receipt photos
- `drizzle/migrations/` and `setup.sql` original schema and seed data; `migrations/` newer changes (run by hand in the Supabase SQL editor)

## Pantry
Tabs: **Items**, **Receipt**, **Dictionary**. All tables are private to the signed-in user (row-level security, see
`migrations/0004` and `0005`).

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

**Photo OCR.** The photo is converted to grey, its contrast stretched, resized, and optionally reduced to black and
white (`image-prep.ts`), then read by [tesseract.js](https://github.com/naptha/tesseract.js) with the German language
data. It runs in a web worker in the browser and is loaded only when you use it. The photo is never uploaded. The
first use downloads Tesseract and the language data (about 10 MB; the browser keeps it afterwards), so it needs a
connection once. Each line gets a confidence from Tesseract; lines below 80% are highlighted.

*Limits.* Thermal paper is the hard case: faded or grey print, curled paper and shiny glare cost accuracy, and
prices are misread more often than names. Expect to correct some lines. Tips for a good photo:
- Flatten the receipt on a dark, matte surface, or hold it flat against a wall.
- Daylight from the side or from above; no flash and no shadow of the phone.
- Fill the frame with the receipt and keep it upright; photograph a long receipt in two parts.
- Hold still, tap to focus on the text, and check that the photo is sharp before using it.
- If faint print is lost, try the *Black and white* switch.

**Measuring accuracy.** `npm run ocr:eval` runs the same pipeline over your own photos and prints line-level accuracy;
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
