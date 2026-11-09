# Lifeplan audit

Date: 2026-11-08. Nothing here was tested against a signed-in session, because I have no login for the
Supabase project. "Done" means the code exists and looks right; it does not mean I ran it end to end.

## Build and run
- `npm install` works (13 audit warnings, not touched). `npm run build`, `npm test` (1 test) and `npm run dev` all pass; `/`, `/auth` and `/gym` return 200.
- `tsc --noEmit` fails. Vite does not type-check, so the build ignores it. Causes:
  - links to routes that do not exist (`/gym/week`, `/gym/month`, `/gym/exercise/$id`)
  - strict-null errors in `ExerciseBrowser.tsx`, `gym.index.tsx`, `dates.ts`, `onboarding.tsx`
  - `noPropertyAccessFromIndexSignature` and typing errors in `ai-tools.server.ts`
- Correction to my earlier summary: `routeTree.gen.ts` never referenced `/gym/session/$id`. The links were in `gym.index.tsx`, and the route file was missing, so clicking a session card would 404.
- **Fixed:** I added `src/routes/_authenticated/_shell/gym.session.$id.tsx`. The route tree regenerated and now includes it.
- `.env` is tracked in git. It holds only the public Supabase URL and publishable key as far as I can tell. Worth confirming.

## Checklist
| Item | Status | Notes |
| --- | --- | --- |
| Weekly view with drag-and-drop onto days | **Missing** | The Week tab links to `/gym/week`, but no route file exists. `@dnd-kit/core` is installed and unused. The data layer (`scheduleQuery`, `schedule`, `moveScheduled`) is ready. |
| Monthly calendar view | **Missing** | Same: tab exists, no route. `calendar.tsx` UI component is available. |
| Exercise page: body SVG, form steps, equipment variations | **Partial** | `BodyMap.tsx` exists and highlights primary/secondary muscles, but its artwork is placeholder rounded rectangles and its highlight colour is the theme `primary`; I did not check that this is green. The `/gym/exercise/$id` route does not exist. Steps and a `family` column (for variations) are in the database, with no UI. |
| Seed plan: Upper A/B/C/Lower with my weights | **Partial** | `seed_example_plan()` creates all four sessions. Only Upper A and Upper B have weights; Upper C and Lower have none (NULL). I can't tell whether those weights are yours. It only runs from the onboarding "example" button. |
| Email + Google sign-in | **Done (untested)** | `auth.tsx` has email/password sign-in and sign-up, plus Google through Supabase (`supabase.auth.signInWithOAuth`). The Google provider has to be enabled in your Supabase project. |
| Manual editing of sets, reps, weight, swap | **Done (untested)** | Previously the session page was missing, so there was no UI for it. The new page edits sets, reps and weight, and can swap, add and remove exercises. Reordering is not in the UI (`gym.reorder` exists but is unused). |
| AI chat tools working end to end | **Partial** | 14 tools are defined and the server function, chat history and panel are wired. Not verified: the model id `openai/gpt-6-astra` against the gateway, and the `ai-tools.server.ts` type errors. `schedule_session` and `move_scheduled` work on data that has no UI yet. The onboarding "AI generate" path calls `gen()`, which I did not read. |

## Other gaps
- Languages and Pantry are `ComingSoon` stubs.
- Only one test, a routing smoke test.

## Suggested order (waiting for your go-ahead)
1. Make `tsc` pass (small).
2. Week view with drag-and-drop, then Month view.
3. Exercise page: real body artwork, green highlight, steps, variations by `family`.
4. Fill in Upper C and Lower weights (I need your numbers) and reorder in the session page.
5. Test auth and chat against the live project (I need a test login).
