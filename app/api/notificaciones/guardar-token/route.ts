import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const idToken = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Token FCM requerido' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    // Generar un id determinista a partir del token para no duplicar documentos por dispositivo
    const hashId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);

    const docRef = adminDb
      .collection('usuarios')
      .doc(uid)
      .collection('dispositivos_push')
      .doc(hashId);

    await docRef.set({
      token,
      actualizadoEn: new Date(),
      userAgent: request.headers.get('user-agent') || 'desconocido',
      plataforma: typeof body.plataforma === 'string' ? body.plataforma : 'web_pwa'
    }, { merge: true });

    return NextResponse.json({ ok: true, mensaje: 'Dispositivo registrado para notificaciones' });
  } catch (error: any) {
    console.error('Error registrando token push:', error);
    return NextResponse.json({ error: 'Error al registrar dispositivo' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const idToken = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const hashId = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);

    await adminDb
      .collection('usuarios')
      .doc(uid)
      .collection('dispositivos_push')
      .doc(hashId)
      .delete()
      .catch(() => {});

    return NextResponse.json({ ok: true, mensaje: 'Dispositivo desvinculado' });
  } catch (error) {
    console.error('Error eliminando token push:', error);
    return NextResponse.json({ error: 'Error al desvincular dispositivo' }, { status: 500 });
  }
}
