const CACHE_NAME = 'astro-strike-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './models/millitary/Military_Rockett.fbx'
];

// Install: pre-cache critical shell and assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets for offline play');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some assets could not be pre-cached, will cache on fetch:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache First with Network Fallback & Dynamic Caching
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset immediately, but revalidate in background if online
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => {
          // Offline, cachedResponse is fine
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache for next time
      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        // If offline and requesting document, fallback to cached index.html
        if (req.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
        throw err;
      });
    })
  );
});
