import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 });

    const usuario = usuarioSnap.data() as any;
    const esAdmin = usuario.rol !== 'cajero';
    const cuentaPrincipalId = esAdmin ? decodedToken.uid : usuario.adminId;
    if (!cuentaPrincipalId || (!esAdmin && usuario.permisos?.planSepare !== true)) {
      return NextResponse.json({ error: 'No tienes permiso para entregar Separes.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId : '';
    if (!separeId) return NextResponse.json({ error: 'Separe requerido.' }, { status: 400 });

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');
      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_COMPLETADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');

      const saldoPendiente = Number(separe.saldoPendiente || 0);
      if (!Number.isFinite(saldoPendiente) || saldoPendiente > 0) throw new Error('SALDO_PENDIENTE');

      const movimientoRef = adminDb.collection('movimientos').doc();
      transaction.create(movimientoRef, {
        clienteId: separe.clienteId || null,
        clienteNombre: separe.clienteNombre || 'Cliente',
        usuarioId: cuentaPrincipalId,
        tipo: 'entrega_separe',
        origen: 'separe',
        monto: 0,
        valorMercancia: Number(separe.total || 0),
        descripcion: `Plan Separe entregado - ${separe.clienteNombre || 'Cliente'}`,
        detalles: (separe.items || []).map((item: any) => ({
          descripcion: item.descripcion,
          valor: (Number(item.valor) || 0) * (item.cantidad || 1),
          cantidad: item.cantidad || 1,
          valorUnitario: Number(item.valor) || 0
        })),
        fecha: new Date(),
        registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        metodoPago: 'separe_liquidado',
        idSepareOrigen: separeId
      });
      transaction.update(separeRef, {
        estado: 'completado',
        fechaCompletado: new Date(),
        idTransaccionCierre: movimientoRef.id,
        saldoPendiente: 0
      });
      return { entregaMovimientoId: movimientoRef.id };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      SEPARE_NO_EXISTE: { status: 404, text: 'El Plan Separe no existe.' },
      SEPARE_NO_AUTORIZADO: { status: 403, text: 'El Plan Separe no pertenece a tu negocio.' },
      SEPARE_COMPLETADO: { status: 409, text: 'El Plan Separe ya fue entregado.' },
      SEPARE_CANCELADO: { status: 409, text: 'El Plan Separe está cancelado.' },
      SALDO_PENDIENTE: { status: 409, text: 'El Plan Separe aún tiene saldo pendiente.' }
    };
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error entregando Separe:', error);
    return NextResponse.json({ error: 'No se pudo entregar el Plan Separe.' }, { status: 500 });
  }
}
