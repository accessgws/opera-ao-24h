const CACHE_NAME = 'op24h-pwa-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './js/main.js',
  './js/config.js',
  './js/dom.js',
  './js/state.js',
  './js/audio.js',
  './js/storage.js',
  './js/ui.js',
  './js/input.js',
  './js/gameplay.js',
  './js/multiplayer.js',
  './js/render/utils.js',
  './js/render/world.js',
  './js/render/pursuers.js',
  './js/render/player.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/ws')) return;

  // Network-first para sempre pegar atualizações online, com fallback offline no cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
