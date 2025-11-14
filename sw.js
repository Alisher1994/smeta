// Simple service worker for SMETA PWA
const CACHE_NAME = 'smeta-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './object.html',
  './styles.css',
  './index_app.js',
  './object.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(() => caches.match('./index.html')))
  );
});
