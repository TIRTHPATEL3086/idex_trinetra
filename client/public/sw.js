/**
 * IDEX Trinetra — Offline Service Worker
 * Enables 100% air-gapped, zero-internet offline PWA capability on mobile and desktop.
 */

const CACHE_NAME = 'idex-trinetra-v2';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/logo-mark-transparent.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[WESEE ServiceWorker] Pre-caching offline shell');
      return cache.addAll(STATIC_PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[WESEE ServiceWorker] Removing legacy cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST /api/auth/login)
  if (request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (HTML pages) -> Stale-while-revalidate or Network-first with /index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 2. API calls -> Network first, do not aggressively cache dynamic API responses unless offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
          JSON.stringify({ error: { code: 'OFFLINE', message: 'Air-gapped mode active: Network unreachable' } }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, Fonts, Images) -> Cache-first with network fallback & auto-caching
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        // Only cache valid responses
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for image requests when offline
        if (request.destination === 'image') {
          return caches.match('/favicon-32.png');
        }
      });
    })
  );
});
