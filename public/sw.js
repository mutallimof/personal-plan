/* Lifeplan service worker: an offline shell, not an offline database.
 * - Built assets (/assets/*) and icons: cache first (file names are hashed).
 * - Pages under /gym and /: network first, last good copy when offline, /offline.html as the last resort.
 * - Everything else (Supabase, server functions, non-GET) is never touched.
 * Bump VERSION to drop old caches. */
const VERSION = "v2";
const SHELL = `lifeplan-shell-${VERSION}`;
const ASSETS = `lifeplan-assets-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/offline.html", "/favicon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (p) => p.startsWith("/assets/") || p.startsWith("/icons/") || p === "/favicon.svg" || p === "/manifest.webmanifest";
const isPage = (p) => p === "/" || p === "/gym" || p.startsWith("/gym/") || p === "/profile";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && isPage(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL);
          return (await cache.match(url.pathname)) || (await cache.match("/gym")) || (await cache.match("/offline.html"));
        }),
    );
  }
});
