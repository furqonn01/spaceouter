const CACHE_NAME = 'astro-strike-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './models/millitary/Military_Rockett.fbx'
];

// Install: pre-cache critical shell and assets safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets for offline play');
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches and take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Safe Cache First with Network Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle HTTP/HTTPS GET requests
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const url = new URL(req.url);

  // Skip dev server WebSockets, HMR, and extension schemes
  if (url.pathname.startsWith('/@') || url.pathname.includes('__vite') || url.search.includes('t=')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch update in background if online
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // If not cached, fetch from network and cache
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const toCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, toCache);
        });

        return networkResponse;
      }).catch((err) => {
        // If offline and navigating to a page, return index.html
        if (req.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
        throw err;
      });
    })
  );
});
