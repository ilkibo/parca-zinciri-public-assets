const CACHE = "pz-mobile-shell-v4-live";
const SHELL = [
  "/",
  "/app.js",
  "/live-api.js",
  "/style.css",
  "/contract.js",
  "/drafts.js",
  "/manifest.webmanifest",
  "/icon.svg",
  "/wordmark-horizontal.svg",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
].map(path=>new URL('.'+path,self.location.href).href);
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pz-mobile-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || Response.error()),
    ),
  );
});
