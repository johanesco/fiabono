// lib/enviarNotificacion.ts
// Servicio para despachar notificaciones Web Push nativas a través de Firebase Cloud Messaging (FCM)
// Tolerante a fallos: nunca rompe el flujo de la aplicación si el envío falla o el usuario no tiene dispositivos.

import { getAdminDb, getAdminMessaging } from './firebase-admin';

interface ParametrosNotificacion {
  usuarioId: string;
  titulo: string;
  mensaje: string;
  url?: string;
  tag?: string;
  datosExtra?: Record<string, string>;
}

export async function enviarNotificacionAUsuario({
  usuarioId,
  titulo,
  mensaje,
  url = '/dashboard/inicio',
  tag = 'fiabono-general',
  datosExtra = {}
}: ParametrosNotificacion): Promise<{ enviados: number; fallidos: number }> {
  try {
    if (!usuarioId) return { enviados: 0, fallidos: 0 };

    const adminDb = getAdminDb();
    
    // Consultar todos los tokens activos registrados para este usuario
    const tokensSnap = await adminDb
      .collection('usuarios')
      .doc(usuarioId)
      .collection('dispositivos_push')
      .get();

    if (tokensSnap.empty) {
      return { enviados: 0, fallidos: 0 };
    }

    const tokens: string[] = [];
    const docIdsPorToken: Record<string, string> = {};

    tokensSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data?.token && typeof data.token === 'string') {
        tokens.push(data.token);
        docIdsPorToken[data.token] = docSnap.id;
      }
    });

    if (tokens.length === 0) {
      return { enviados: 0, fallidos: 0 };
    }

    const messaging = getAdminMessaging();

    // Payload optimizado para Web Push en navegadores y Android PWA / TWA
    const respuesta = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: titulo,
        body: mensaje,
      },
      data: {
        url,
        tag,
        click_action: url,
        ...datosExtra
      },
      webpush: {
        notification: {
          title: titulo,
          body: mensaje,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag,
          requireInteraction: false
        },
        fcmOptions: {
          link: url
        }
      }
    });

    // Limpieza automática de tokens que hayan caducado o hayan sido desinstalados
    const promesasLimpieza: Promise<any>[] = [];
    respuesta.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const codigoError = resp.error.code;
        if (
          codigoError === 'messaging/registration-token-not-registered' ||
          codigoError === 'messaging/invalid-registration-token'
        ) {
          const tokenInvalido = tokens[idx];
          const docId = docIdsPorToken[tokenInvalido];
          if (docId) {
            promesasLimpieza.push(
              adminDb
                .collection('usuarios')
                .doc(usuarioId)
                .collection('dispositivos_push')
                .doc(docId)
                .delete()
                .catch(() => {})
            );
          }
        }
      }
    });

    if (promesasLimpieza.length > 0) {
      await Promise.all(promesasLimpieza);
    }

    return {
      enviados: respuesta.successCount,
      fallidos: respuesta.failureCount
    };
  } catch (error) {
    console.error('Error enviando notificación push:', error);
    return { enviados: 0, fallidos: 0 };
  }
}
