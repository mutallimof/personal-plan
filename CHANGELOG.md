# Changelog

Changes on branch `build-v1`. Behavior changes to existing features are marked **Behavior**.

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
