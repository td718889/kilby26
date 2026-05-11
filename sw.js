// Kilby Block Party 2026 — service worker
// Goal: instant repeat loads + offline access during the festival.
//
// Caching strategy:
//   • index.html         → NetworkFirst (3s timeout). Fresh when online so the
//                          publish flow's stale-check (kbp-published-at) stays
//                          accurate; cached only as an offline fallback.
//   • /assets/*, icons,  → CacheFirst. These don't change between deploys.
//     manifest.json
//   • /.netlify/functions/* → bypassed entirely. Never cache POSTs or auth.
//
// Cache version is bumped on every deploy so old assets are evicted cleanly.
// Bump this string to force all clients to refresh their caches.
const VERSION = 'kbp26-v1';
const STATIC_CACHE = `${VERSION}-static`;
const HTML_CACHE = `${VERSION}-html`;

// Files to pre-cache so the site works offline on the very first revisit.
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/kbp-map.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch((err) => {
        // Don't fail install if one asset is missing — just log it.
        console.warn('[sw] precache partial failure:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Delete any caches that don't match the current VERSION.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs. Skip POST (publish flow) and cross-origin.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never touch Netlify Functions — they're dynamic, auth-gated, or POST-only.
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  // HTML / navigation requests → NetworkFirst with cache fallback.
  // This is the key choice that keeps the publish flow correct: when online,
  // you always see the latest published HTML (and its current kbp-published-at).
  const isHTML =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Everything else (images, manifest, icons) → CacheFirst.
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const fresh = await fetchWithTimeout(req, 3000);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(req) || await cache.match('/index.html') || await cache.match('/');
    if (cached) return cached;
    // Last resort — let the browser show its offline page.
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // No cache + no network — let it fail naturally.
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
