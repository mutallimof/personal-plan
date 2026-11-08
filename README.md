# Lifeplan

A personal life planner, currently focused on gym training. Built with
[Lovable](https://lovable.dev).

## What works today
- Email/password and Google sign-in (Supabase auth), onboarding profile form
- Plan page: training sessions as cards, add a session
- Session page: rename, delete, edit sets / reps / weight, swap, add and remove exercises
- Exercise library: virtualized list, search, muscle and equipment filters, common exercises shown first.
  38 exercises are seeded; an optional import adds about 850 more (see below)
- Week view (drag sessions onto days) and month calendar
- AI chat panel that edits your plan through tools (add, swap, update, schedule, profile)
- "Languages" and "Pantry" tabs are placeholders

See `AUDIT.md` for what is still missing (week view, month view, exercise detail page).

## Stack
TanStack Start (React 19) + Vite, Tailwind v4 + shadcn/Radix, Supabase (auth, Postgres with RLS),
TanStack Query, Lovable AI Gateway.

## Run
```sh
npm install
npm run dev     # dev server
npm run build   # production build
npm test        # vitest
```
Needs `.env` with the Supabase URL and publishable key (already in the repo for the Lovable project).

## Layout
- `src/routes/` file-based routes (`routeTree.gen.ts` is generated, do not edit)
- `src/features/gym/` data access, AI tools, body map, exercise browser
- `drizzle/migrations/` database schema and seed data (managed by Lovable)

## Exercise import (optional)
`scripts/exercise-import/` turns [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Unlicense, public domain) into idempotent SQL. It is data only: it never changes existing rows or the schema.

```sh
node scripts/exercise-import/convert.mjs      # regenerates scripts/exercise-import/sql/
```
Then run `scripts/exercise-import/sql/exercises-import.sql` (or the smaller files in `sql/parts/`) once in the
Supabase SQL editor. Running it again adds nothing. Muscle, equipment and family mappings are in
`scripts/exercise-import/mappings.mjs`. The "popular first" list is `src/features/gym/popular.ts`.

Exercise data: free-exercise-db by yuhonas and contributors, released under the Unlicense.
