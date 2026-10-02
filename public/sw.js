const CACHE_NAME = "split-app-next-v2";
const ASSETS = ["/manifest.webmanifest", "/icons/icon.svg", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("split-app-next-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // HTML, RSC payloads, account/project pages and Supabase responses must
  // never enter the cache. Only public same-origin static assets are allowed.
  const cacheable = url.origin === self.location.origin &&
    event.request.mode !== "navigate" &&
    (ASSETS.includes(url.pathname) || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/_next/static/"));

  event.respondWith(
    fetch(event.request).then((response) => {
      if (cacheable && response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => {
      if (cacheable) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
      }
      return new Response("Нет соединения. Подключитесь к интернету и обновите страницу.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }),
  );
});
