const CACHE_NAME = 'fiabono-v1';

// Solo cacheamos assets estáticos — NUNCA las rutas de Firebase ni API
const STATIC_ASSETS = [
  '/',
  '/dashboard/inicio',
  '/manifest.json',
  '/icon-512.jpg',
];

self.addEventListener('install', (event) => {
  // Activar inmediatamente sin esperar a que cierren otras pestañas
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Si falla algún asset, no bloqueamos la instalación
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Tomar control inmediato de todas las pestañas abiertas
      self.clients.claim(),
      // Limpiar cachés viejas
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar: Firebase, APIs externas, o solicitudes POST
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Estrategia Network First para páginas HTML (siempre contenido fresco)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // Estrategia Cache First para assets estáticos (_next/static, imágenes, etc.)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});

