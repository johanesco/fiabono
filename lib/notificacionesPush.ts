// lib/notificacionesPush.ts
// Gestión cliente de permisos y registro de tokens Web Push para PWA / Android Play Store

import { auth } from '@/firebase';

export const VAPID_KEY_PROD = 'BMC5R4ZqAz9yjgFEbtjm6VPlmcbMaDkcsJ2ITvspy34xTm5NdIfQyLa-ObLqBGhlDdumLkzKzXkfqW3HrEqsO5k';

export function soportaNotificacionesPush(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function obtenerEstadoPermiso(): NotificationPermission | 'unsupported' {
  if (!soportaNotificacionesPush()) return 'unsupported';
  return Notification.permission;
}

export async function activarNotificacionesPush(): Promise<{ ok: boolean; error?: string }> {
  if (!soportaNotificacionesPush()) {
    return { ok: false, error: 'Tu navegador o dispositivo no soporta notificaciones push.' };
  }

  try {
    // 1. Solicitar permiso nativo al usuario
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      if (permiso === 'denied') {
        return { ok: false, error: 'Las notificaciones fueron bloqueadas en los permisos del navegador. Puedes activarlas desde el candado de la barra de direcciones o ajustes de la app.' };
      }
      return { ok: false, error: 'No se concedió el permiso para notificaciones.' };
    }

    // 2. Esperar que el Service Worker esté listo y activo
    const registroSW = await navigator.serviceWorker.ready;
    if (!registroSW) {
      return { ok: false, error: 'El Service Worker no está activo en este momento.' };
    }

    // 3. Importar dinámicamente Firebase Messaging en cliente
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { default: app } = await import('@/firebase').then(m => ({ default: (m as any).auth?.app }));

    if (!app) {
      return { ok: false, error: 'No se pudo inicializar el servicio de mensajería.' };
    }

    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || VAPID_KEY_PROD;

    // 4. Obtener el token FCM para este dispositivo
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registroSW
    });

    if (!token) {
      return { ok: false, error: 'No se pudo generar el identificador del dispositivo.' };
    }

    // 5. Enviar el token al servidor para asociarlo al usuario autenticado
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      return { ok: false, error: 'Debes iniciar sesión para vincular las notificaciones.' };
    }

    const resp = await fetch('/api/notificaciones/guardar-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        token,
        plataforma: /android/i.test(navigator.userAgent) ? 'android_pwa' : 'web'
      })
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      return { ok: false, error: errData.error || 'No se pudo guardar el dispositivo en el servidor.' };
    }

    // Guardar referencia local
    try {
      localStorage.setItem('fiabono_push_activo', '1');
      localStorage.setItem('fiabono_push_token', token);
    } catch (_) {}

    return { ok: true };
  } catch (error: any) {
    console.error('Error activando notificaciones push:', error);
    return { ok: false, error: error?.message || 'Ocurrió un error al configurar las notificaciones.' };
  }
}

export async function desactivarNotificacionesPush(): Promise<{ ok: boolean }> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('fiabono_push_token') : null;
    if (token) {
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch('/api/notificaciones/guardar-token', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({ token })
        }).catch(() => {});
      }
    }

    try {
      localStorage.removeItem('fiabono_push_activo');
      localStorage.removeItem('fiabono_push_token');
    } catch (_) {}

    return { ok: true };
  } catch (_) {
    return { ok: true };
  }
}
