// Fixotech PWA service worker — offline app shell + runtime caching.
// Network-first: always load the freshest code when online (so updates show up
// immediately), fall back to cache only when offline.
const CACHE = 'fixo-v3';
const SHELL = [
  './', './index.html',
  './styles.css', './factory.css', './factory-big.css', './chatiq.css',
  './images.js', './product-images-data.js', './product-images.js',
  './vendor/pdf.min.js', './vendor/exceljs.min.js',
  './db.js', './customers-seed.js', './inventory-seed.js', './app.js', './clients.js',
  './shell.js', './testing-mode.js', './verify.js', './proforma.js', './factory.js', './dispatch.js', './chatiq.js', './inventory.js',
  './jspdf.umd.min.js',
  './assets/app-icons/app-192.png', './assets/app-icons/app-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first for same-origin GETs: fetch fresh, update the cache, and fall
// back to cache only when the network fails (offline).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    // `cache: 'no-store'` bypasses the browser HTTP cache so an update to any
    // app file (JS/CSS/HTML) is picked up the moment the device is online —
    // the SW cache below is kept only as the offline fallback.
    fetch(req, { cache: 'no-store' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
