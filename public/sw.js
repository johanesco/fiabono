const CACHE_NAME = 'fiabono-v1';

self.addEventListener('install', () => {
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

self.addEventListener('fetch', (event) => {
  // Dejar que el navegador maneje todo normalmente sin interferir en la red
  // Solo se reserva para soporte PWA estándar
});

