import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists || usuarioSnap.data()?.rol === 'cajero') return NextResponse.json({ error: 'Sólo el administrador puede rechazar órdenes.' }, { status: 403 });

    const body = await request.json();
    const ordenId = typeof body.ordenId === 'string' ? body.ordenId : '';
    const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : 'Rechazada por el administrador';
    if (!ordenId) return NextResponse.json({ error: 'Orden requerida.' }, { status: 400 });

    await adminDb.runTransaction(async (transaction) => {
      const ordenRef = adminDb.collection('ordenes_pendientes').doc(ordenId);
      const ordenSnap = await transaction.get(ordenRef);
      if (!ordenSnap.exists) throw new Error('ORDEN_NO_EXISTE');
      const orden = ordenSnap.data() as any;
      if (orden.usuarioId !== decodedToken.uid) throw new Error('ORDEN_NO_AUTORIZADA');
      if (orden.estado !== 'pendiente') throw new Error('ORDEN_NO_PENDIENTE');
      transaction.update(ordenRef, {
        estado: 'rechazado',
        fechaProcesado: new Date(),
        aprobadoPor: usuarioSnap.data()?.nombreUsuario || decodedToken.email || 'Administrador',
        motivoRechazo: motivo
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const respuestas: Record<string, { status: number; text: string }> = {
      ORDEN_NO_EXISTE: { status: 404, text: 'La orden no existe.' },
      ORDEN_NO_AUTORIZADA: { status: 403, text: 'La orden no pertenece a tu negocio.' },
      ORDEN_NO_PENDIENTE: { status: 409, text: 'La orden ya fue procesada.' }
    };
    const respuesta = respuestas[error?.message];
    if (respuesta) return NextResponse.json({ error: respuesta.text }, { status: respuesta.status });
    console.error('Error rechazando orden:', error);
    return NextResponse.json({ error: 'No se pudo rechazar la orden.' }, { status: 500 });
  }
}
