# Deploy

Nothing here has been done for you. Pick one host. Both build the same code with the same command.

## Settings for either host
- **Build command:** `npm run build`
- **Install command:** `npm install`
- **Node version:** 22 or newer
- **Environment variables** (set them in the host's dashboard *before* the first build; the `VITE_*` ones are baked into the build):

| Name | Value | Where to find it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase -> Project Settings -> API -> Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (or the legacy `anon` key) | same page |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` | |
| `SUPABASE_PUBLISHABLE_KEY` | same as `VITE_SUPABASE_PUBLISHABLE_KEY` | |
| `AI_API_KEY` | your provider key | optional; leave unset to run without the AI chat |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL` | see `.env.example` | optional |

Never set the `service_role` / `sb_secret_` key anywhere. The app does not use it.

## Option A: Vercel
1. Push the repo to GitHub. On https://vercel.com click **Add New -> Project** and import it.
2. Framework preset: **Other**. Leave the output directory empty (the build writes `.vercel/output`, which Vercel detects on its own).
3. Add the environment variables above, then **Deploy**.

## Option B: Cloudflare Pages
1. On https://dash.cloudflare.com go to **Workers & Pages -> Create -> Pages -> Connect to Git** and pick the repo.
2. Framework preset: **None**. Build command `npm run build`. **Build output directory: `dist`**.
3. Add the environment variables above (under **Settings -> Variables and Secrets**, for Production). Also add `NODE_VERSION` = `22`.
4. **Save and Deploy**.

(Both outputs were test-built locally with `NITRO_PRESET=vercel` and `NITRO_PRESET=cloudflare_pages`. Neither has been deployed, so the first real deploy is the real test.)

## After the first deploy: tell Supabase about the new address
In Supabase -> **Authentication -> URL Configuration**:
1. **Site URL:** `https://YOUR-DOMAIN`
2. **Redirect URLs:** add `https://YOUR-DOMAIN/**` (keep `http://localhost:5173/**` for local work; use the port `npm run dev` prints).

For Google sign-in also check Supabase -> **Authentication -> Providers -> Google** is on, and in Google Cloud Console -> **APIs & Services -> Credentials** your OAuth client lists
`https://<ref>.supabase.co/auth/v1/callback` under *Authorized redirect URIs*.

## Install on a phone
Open the deployed address in Chrome (Android) or Safari (iPhone) over **https**. Android: menu -> **Install app**. iPhone: Share -> **Add to Home Screen**.
The service worker only runs on the deployed (production) build, not on `npm run dev`.
