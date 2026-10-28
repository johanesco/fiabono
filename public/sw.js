const CACHE_NAME = 'fiabono-pwa-v5';

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

  const esNavegacion = event.request.mode === 'navigate';
  const esAssetEstatico =
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/i.test(url.pathname);

  // Estrategia Network-First:
  // Intentar red siempre para tener los datos más frescos en tiempo real.
  // Si no hay red (offline), responder con la versión cacheada.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // MODO OFFLINE (Fase 1): cachear en segundo plano los assets estáticos y las
        // pantallas visitadas (HTML del panel). Si se cae el internet, las pantallas
        // que ya se abrieron antes vuelven a cargar.
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          (esAssetEstatico || esNavegacion || url.pathname === '/')
        ) {
          const responseToCache = networkResponse.clone();
          // Las pantallas se guardan sin parámetros (?x=) para encontrarlas luego offline
          const clave = esNavegacion ? url.origin + url.pathname : event.request;
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(clave, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (esNavegacion) {
          // 1. La misma pantalla guardada (ignorando parámetros)
          const mismaPantalla = await caches.match(url.origin + url.pathname);
          if (mismaPantalla) return mismaPantalla;

          // 2. Dentro del panel, abrir otra pantalla del panel ya visitada
          if (url.pathname.startsWith('/dashboard')) {
            const pantallaPanel =
              (await caches.match(url.origin + '/dashboard/inicio')) ||
              (await caches.match(url.origin + '/dashboard/vender'));
            if (pantallaPanel) return pantallaPanel;
          }

          // 3. Último recurso: la raíz cacheada
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

// -------------------------------------------------------------
// NOTIFICACIONES PUSH NATIVAS EN ANDROID (PWA / TWA / Google Play)
// -------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      notification: {
        title: 'Fiabono',
        body: event.data.text()
      }
    };
  }

  const notif = payload.notification || payload;
  const data = payload.data || {};
  const titulo = notif.title || 'Fiabono';
  const opciones = {
    body: notif.body || 'Tienes una nueva actualización en tu negocio.',
    icon: notif.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [80, 40, 80],
    tag: data.tag || 'fiabono-alerta',
    renotify: true,
    data: {
      url: data.url || '/dashboard/inicio',
      ...data
    }
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

// Al tocar la notificación en la barra de Android
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destinoUrl = event.notification.data?.url || '/dashboard/inicio';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta, enfocamos la ventana y navegamos al destino
      for (const client of clientList) {
        if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(destinoUrl);
          }
          return client.focus();
        }
      }
      // Si la app está cerrada, abrimos la ventana en la URL de destino
      if (clients.openWindow) {
        return clients.openWindow(destinoUrl);
      }
    })
  );
});
