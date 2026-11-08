# Lifeplan

A personal life planner, currently focused on gym training. Built with
[Lovable](https://lovable.dev).

## What works today
- Email/password and Google sign-in (Supabase auth), onboarding profile form
- Plan page: training sessions as cards, add a session
- Session page: rename, delete, edit sets / reps / weight, swap, add and remove exercises
- Exercise library with search and muscle/equipment filters (about 38 exercises seeded)
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
