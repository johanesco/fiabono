import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const body = await request.json().catch(() => ({}));
    const requestedPlan = body.plan === 'comercio' ? 'comercio' : 'pro';

    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection('usuarios').doc(uid);
    const userSnap = await userDocRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    if (userData.rol === 'cajero') {
      return NextResponse.json({ error: 'Solo el administrador del negocio puede activar periodos de prueba.' }, { status: 403 });
    }

    // Verificar si ya consumió la prueba gratuita
    if (userData.pruebaGratisUsada === true) {
      return NextResponse.json({
        error: 'Tu negocio ya utilizó previamente el periodo de prueba gratuito de 14 días. Puedes contactarnos por WhatsApp para activar tu plan.'
      }, { status: 400 });
    }

    const fechaVence = new Date();
    fechaVence.setDate(fechaVence.getDate() + 14);

    await userDocRef.update({
      plan: requestedPlan,
      planVence: fechaVence,
      cicloPlan: 'mensual',
      pruebaGratisUsada: true,
      fechaActivacionPrueba: new Date()
    });

    return NextResponse.json({
      ok: true,
      plan: requestedPlan,
      dias: 14,
      mensaje: `¡Plan ${requestedPlan === 'pro' ? 'PRO Almacén' : 'Comercio'} activado por 14 días!`
    });
  } catch (error: any) {
    console.error('Error en /api/suscripcion/activar-prueba:', error);
    return NextResponse.json({ error: error?.message || 'Error al activar la prueba gratuita.' }, { status: 500 });
  }
}
