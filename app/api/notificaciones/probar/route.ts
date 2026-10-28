import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { enviarNotificacionAUsuario } from '@/lib/enviarNotificacion';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const idToken = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const res = await enviarNotificacionAUsuario({
      usuarioId: uid,
      titulo: '🔔 ¡Notificaciones activas en Fiabono!',
      mensaje: 'Tu dispositivo está listo para recibir alertas de ventas, órdenes y vencimientos en tiempo real.',
      url: '/dashboard/inicio',
      tag: 'prueba-notificacion'
    });

    if (res.enviados > 0) {
      return NextResponse.json({ ok: true, mensaje: 'Notificación de prueba enviada con éxito' });
    } else {
      return NextResponse.json({ 
        ok: false, 
        error: 'No se encontraron dispositivos vinculados. Asegúrate de activar el permiso en este celular primero.' 
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error enviando prueba de notificación:', error);
    return NextResponse.json({ error: error?.message || 'Error al enviar notificación' }, { status: 500 });
  }
}
