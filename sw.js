// Offline ishlash uchun service worker. Yangi versiya chiqarilganda VERSION ni oshiring.
const VERSION = 'v8';
const CACHE = 'fason-hisob-' + VERSION;
const FILES = [
  './', './index.html', './css/style.css', './js/app.js', './js/calc.js', './js/store.js', './js/sync.js', './js/sync-core.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Avval tarmoqdan (yangilanishlar tez yetib borishi uchun), internet bo'lmasa keshdan.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Faqat ilova fayllari keshlanadi. Server API (/api/...) — hech qachon (jonli ma'lumot)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
