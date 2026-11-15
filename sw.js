const CACHE_NAME = 'op24h-pwa-v1';
const CORE_ASSETS = [
  './',
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
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        CORE_ASSETS.map((asset) =>
          fetch(asset, { cache: 'no-store' })
            .then((res) => (res && res.ok ? cache.put(asset, res) : null))
            .catch(() => {})
        )
      );
    })
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/ws')) return;

  // Navegação de documento: usa req.url (nunca passar RequestInit junto com req.mode === 'navigate')
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req.url, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./', clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Demais assets locais: rede primeiro sem cache HTTP para código, fallback offline no cache
  const isMedia = /\.(mp3|wav|ogg|png|jpg|jpeg|webp|ico)$/i.test(url.pathname);
  event.respondWith(
    fetch(req.url, { cache: isMedia ? 'default' : 'no-store' })
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
