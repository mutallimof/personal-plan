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
