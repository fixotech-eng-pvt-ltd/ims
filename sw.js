// Fixotech PWA service worker — fast loads + offline.
// Strategy:
//   • Big, rarely-changing assets (images, vendor libs, seed data, fonts):
//     CACHE-FIRST — served instantly from cache, refreshed in the background.
//     This is what makes repeat loads (and the phone/APK) fast.
//   • App shell + logic (HTML, app JS/CSS): NETWORK-FIRST — always fresh when
//     online so fixes roll out immediately; falls back to cache when offline.
const CACHE = 'fixo-v13';
const SHELL = [
  './', './index.html',
  './styles.css', './factory.css', './factory-big.css', './chatiq.css', './automate.css', './indent.css', './progress.css', './mobile.css',
  './images.js', './product-images-data.js', './product-images.js',
  './vendor/pdf.min.js', './vendor/exceljs.min.js',
  './db.js', './auth.js', './customers-seed.js', './inventory-seed.js', './app.js', './clients.js',
  './shell.js', './testing-mode.js', './verify.js', './proforma.js', './factory.js', './dispatch.js', './chatiq.js', './inventory.js', './admin.js', './automate.js', './indent.js', './progress.js', './sync.js',
  './jspdf.umd.min.js',
  './assets/app-icons/app-192.png', './assets/app-icons/app-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Big / static assets that rarely change → cache-first (instant load).
function isStaticAsset(url) {
  return /product-images-data\.js$/.test(url) ||
    /-seed\.js$/.test(url) ||                          // customers-seed.js, inventory-seed.js
    /\/vendor\//.test(url) ||
    /\/assets\//.test(url) ||
    /(jspdf|exceljs|images)\.[^/]*js$/.test(url) ||
    /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i.test(url);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = req.url;

  if (isStaticAsset(url)) {
    // Cache-first: serve immediately, refresh in the background.
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // App shell + logic: network-first (fresh), fall back to cache offline.
  e.respondWith(
    fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
