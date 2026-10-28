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
    // Entregar a Fiado genera deuda en cartera: solo permitido a admin o colaboradores con permiso de fiar (ventaDirecta)
    const tienePermiso = esAdmin || (usuario.activo !== false && usuario.permisos?.ventaDirecta === true);
    if (!cuentaPrincipalId || !tienePermiso) {
      return NextResponse.json({ error: 'No tienes permiso para fiar. Pídele al administrador que active el permiso de venta y fiado directo en tu usuario.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId.trim() : '';
    if (!separeId) return NextResponse.json({ error: 'Separe requerido.' }, { status: 400 });

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');
      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_YA_COMPLETADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');

      if (!separe.clienteId) throw new Error('CLIENTE_REQUERIDO');

      const clienteRef = adminDb.collection('clientes').doc(separe.clienteId);
      const clienteSnap = await transaction.get(clienteRef);
      if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) {
        throw new Error('CLIENTE_NO_AUTORIZADO');
      }

      const saldoPendiente = Number(separe.saldoPendiente || 0);
      if (!Number.isFinite(saldoPendiente) || saldoPendiente <= 0) {
        throw new Error('SIN_SALDO_PENDIENTE');
      }

      const clienteData = clienteSnap.data() as any;
      const deudaActual = Number(clienteData?.deudaTotal || 0);
      const nuevaDeuda = deudaActual + saldoPendiente;

      // Actualizar deuda del cliente en cartera
      transaction.update(clienteRef, {
        deudaTotal: nuevaDeuda,
        fechaUltimoMovimiento: new Date()
      });

      // Marcar todos los ítems como entregados
      const items = Array.isArray(separe.items) ? [...separe.items] : [];
      const itemsActualizados = items.map((it: any) => ({
        ...it,
        cantidadEntregada: Number(it.cantidad || 1),
        entregadoCompleto: true,
        ultimaFechaEntrega: new Date()
      }));

      const totalSepare = Number(separe.total || 0);
      const responsable = usuario.nombreUsuario || decodedToken.email || 'Usuario';
      const clienteNombre = separe.clienteNombre || clienteData?.nombre || 'Cliente';

      // Crear movimiento de tipo fiado en el historial
      const movimientoRef = adminDb.collection('movimientos').doc();
      transaction.create(movimientoRef, {
        clienteId: separe.clienteId,
        clienteNombre,
        usuarioId: cuentaPrincipalId,
        tipo: 'fiado',
        subtipo: 'traslado_separe_a_fiado',
        monto: saldoPendiente,
        valorMercancia: totalSepare,
        descripcion: `Entrega Plan Separe trasladado a Fiado`,
        detalles: items.map((item: any) => ({
          descripcion: item.descripcion,
          valor: (Number(item.valor) || 0) * (item.cantidad || 1),
          cantidad: item.cantidad || 1,
          valorUnitario: Number(item.valor) || 0
        })),
        fecha: new Date(),
        registradoPor: responsable,
        metodoPago: 'fiado',
        idSepareOrigen: separeId,
        saldoResultante: nuevaDeuda,
        esPublico: true
      });

      // Marcar separe como completado con subtipo traslado_fiado
      transaction.update(separeRef, {
        estado: 'completado',
        subtipoEntrega: 'traslado_fiado',
        entregadoComoFiado: true,
        saldoPendiente: 0,
        valorEntregado: totalSepare,
        fechaCompletado: new Date(),
        idTransaccionCierre: movimientoRef.id,
        ultimaEntregaFecha: new Date(),
        ultimaEntregaPor: responsable,
        items: itemsActualizados
      });

      return {
        movimientoId: movimientoRef.id,
        saldoTrasladado: saldoPendiente,
        nuevaDeuda,
        clienteNombre
      };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      SEPARE_NO_EXISTE: { status: 404, text: 'El Plan Separe no existe.' },
      SEPARE_NO_AUTORIZADO: { status: 403, text: 'El Plan Separe no pertenece a tu negocio.' },
      SEPARE_YA_COMPLETADO: { status: 409, text: 'El Plan Separe ya fue entregado.' },
      SEPARE_CANCELADO: { status: 409, text: 'El Plan Separe está cancelado.' },
      CLIENTE_REQUERIDO: { status: 400, text: 'El Plan Separe no tiene un cliente vinculado para fiar.' },
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'El cliente no pertenece a tu negocio o no existe.' },
      SIN_SALDO_PENDIENTE: { status: 409, text: 'El Plan Separe no tiene saldo pendiente. Puedes entregarlo con la opción normal.' }
    };
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error entregando Separe a Fiado:', error);
    return NextResponse.json({ error: 'No se pudo entregar el Plan Separe a fiado.' }, { status: 500 });
  }
}
