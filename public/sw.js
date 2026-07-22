// Bump this on every deploy-shape change so `activate` purges the previous
// cache. A stale cache here served old JS chunks after deploys (the app ran
// outdated code until a hard refresh).
const CACHE_NAME = 'fitclaude-v2';

// Pre-cache a minimal shell on install.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['/manifest.json'])));
  self.skipWaiting();
});

// Drop every older cache on activate, then take control.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept API/auth — always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // Content-hashed immutable build assets → cache-first (a new deploy has new
  // hashes, so this can never serve stale code; old entries are purged above).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        }),
      ),
    );
    return;
  }

  // Everything else (documents, RSC, data) → network-first so the app is always
  // fresh; fall back to cache only when the network is unavailable (offline).
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});
