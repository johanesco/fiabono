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
    await getAdminAuth().verifyIdToken(idToken);

    const body = await request.json();
    const adminId = typeof body.adminId === 'string' ? body.adminId.trim() : '';
    const colaboradorNombre = typeof body.colaboradorNombre === 'string' ? body.colaboradorNombre.trim() : 'Un colaborador';
    const total = typeof body.total === 'number' ? body.total : 0;
    const clienteNombre = typeof body.clienteNombre === 'string' ? body.clienteNombre.trim() : 'Cliente';
    const tipo = body.tipo === 'fiado' ? 'Fiado' : 'Venta';

    if (!adminId) {
      return NextResponse.json({ error: 'adminId requerido' }, { status: 400 });
    }

    // Disparar push en segundo plano sin bloquear
    enviarNotificacionAUsuario({
      usuarioId: adminId,
      titulo: `🔔 Nueva orden de ${tipo} para aprobar`,
      mensaje: `${colaboradorNombre} registró una orden de $${total.toLocaleString('es-CO')} para ${clienteNombre}.`,
      url: '/dashboard/ordenes',
      tag: 'orden-pendiente'
    }).catch((e) => console.error('Error enviando push orden pendiente:', e));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error en alerta-orden:', error);
    return NextResponse.json({ error: 'Error procesando alerta' }, { status: 500 });
  }
}
