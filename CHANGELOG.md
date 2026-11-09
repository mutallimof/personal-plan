# Changelog

Changes on branch `build-v1`. Behavior changes to existing features are marked **Behavior**.

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
