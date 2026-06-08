// Offline-tolerant service worker: cache-first with background refresh (stale-while-revalidate).
// Quote data itself lives in IndexedDB; this caches the app shell + assets so it loads with no signal.
const CACHE = 'rr-quoting-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const reqUrl = new URL(e.request.url);
  if (e.request.method !== 'GET' || reqUrl.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => { if (res && res.status === 200) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
