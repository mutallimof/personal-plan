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

Run 0004 to 0007 the same way, in that order (0005 to 0007 add to tables made by 0004).

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
1. **Migrations:** run `0004` to `0007` (step 1). Each Pantry tab shows "Could not load this" until its file is run.
2. **Optional AI check on receipts:** needs `AI_API_KEY` set (step 4). Then turn it on in Pantry > Receipt. It is off by default and sends only the text of lines the dictionary could not match.
3. **Photo receipts:** the first photo needs internet; the browser downloads the OCR engine and German data from a CDN once. The photo itself never leaves your device.
4. **Store-specific parsers:** only a generic German parser exists. To add one for your store, send 3 or more real receipts (PDF, pasted text or photo text; blank out anything private) and the store name.
5. **Measure OCR on your own photos:** put photos and expected text in `scripts/ocr-eval/samples/` (git-ignored) and run `npm run ocr:eval`. See `scripts/ocr-eval/README.md`.
6. **Your real kitchen layout:** the Kitchen tab starts with a default template. Edit it there, or send a photo and a description so a layout file can be written for you. Layouts are never read from a photo automatically.
7. After pulling: `npm install` (new: `pdfjs-dist`, `tesseract.js`; dev: `tsx`, `jpeg-js`, `pngjs`).
