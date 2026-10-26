const CACHE_NAME = 'fiabono-pwa-v3';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Error precacheando assets:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

// Listener fetch obligatorio para PWA de primer nivel y generación de Google WebAPK
self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignorar peticiones a otros orígenes (Firebase Firestore, Auth, APIs externas, Cloudinary)
  if (url.origin !== self.location.origin) return;

  // Ignorar rutas de API dinámicas internas
  if (url.pathname.startsWith('/api/')) return;

  // Estrategia Network-First:
  // Intentar red siempre para tener los datos más frescos en tiempo real.
  // Si no hay red (offline), responder con la versión cacheada.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cachear en segundo plano solo assets estáticos del mismo origen
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/i) || url.pathname === '/')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Si navega a una pantalla sin conexión, responder con la raíz cacheada
        if (event.request.mode === 'navigate') {
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
        }

        return new Response('Sin conexión a Internet', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        });
      })
  );
});
