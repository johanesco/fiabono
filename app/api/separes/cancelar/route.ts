import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const METODOS_PERMITIDOS = new Set(['efectivo', 'transferencia', 'datafono', 'credito_externo', 'saldo_interno']);

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
    if (!cuentaPrincipalId || (!esAdmin && usuario.permisos?.ventaDirecta !== true)) {
      return NextResponse.json({ error: 'No tienes permiso para cancelar Separes.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId : '';
    const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : 'Cancelado por el cliente';
    const metodoPago = typeof body.metodoPago === 'string' ? body.metodoPago : 'efectivo';
    const itemsDevolver = Array.isArray(body.itemsDevolver) ? body.itemsDevolver : [];
    if (!separeId || !METODOS_PERMITIDOS.has(metodoPago)) {
      return NextResponse.json({ error: 'Datos de cancelación inválidos.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');
      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_COMPLETADO');

      const montoDevuelto = Number(separe.montoPagado || 0);
      if (!Number.isFinite(montoDevuelto) || montoDevuelto < 0) throw new Error('MONTO_INVALIDO');
      const productos = new Map<string, { ref: any; data: any }>();
      for (const item of itemsDevolver) {
        if (!item?.productoId || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) throw new Error('ITEM_INVALIDO');
        const productoRef = adminDb.collection('inventario').doc(item.productoId);
        const productoSnap = await transaction.get(productoRef);
        if (!productoSnap.exists || productoSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('PRODUCTO_NO_AUTORIZADO');
        productos.set(item.productoId, { ref: productoRef, data: productoSnap.data() });
      }

      let clienteRef: any = null;
      if (metodoPago === 'saldo_interno' && separe.clienteId) {
        const clienteDocRef = adminDb.collection('clientes').doc(separe.clienteId);
        clienteRef = clienteDocRef;
        const clienteSnap = await transaction.get(clienteDocRef);
        if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('CLIENTE_NO_AUTORIZADO');
        const saldo = Number(clienteSnap.data()?.deudaTotal || 0);
        if (!Number.isFinite(saldo)) throw new Error('SALDO_INVALIDO');
        transaction.update(clienteRef, { deudaTotal: saldo - montoDevuelto, fechaUltimoMovimiento: new Date() });
      }

      transaction.update(separeRef, {
        estado: 'cancelado',
        fechaCancelado: new Date(),
        notaCancelacion: motivo,
        montoPagadoAlCancelar: montoDevuelto
      });

      for (const item of itemsDevolver) {
        const producto = productos.get(item.productoId)!;
        if (producto.data.tipoProducto !== 'servicio' && producto.data.inventariable !== false) {
          transaction.update(producto.ref, { stock: Number(producto.data.stock || 0) + Number(item.cantidad) });
        }
      }

      let movimientoEgresoId: string | undefined;
      if (montoDevuelto > 0) {
        const movimientoRef = adminDb.collection('movimientos').doc();
        movimientoEgresoId = movimientoRef.id;
        transaction.create(movimientoRef, {
          clienteId: separe.clienteId || null,
          clienteNombre: separe.clienteNombre || 'Cliente',
          usuarioId: cuentaPrincipalId,
          tipo: 'egreso',
          categoria: 'devolucion_separe',
          concepto: `Devolución cancelación Plan Separe - ${separe.clienteNombre || 'Cliente'}`,
          monto: montoDevuelto,
          descripcion: `Devolución de $${montoDevuelto.toLocaleString('es-CO')} por cancelación de separe (${motivo})`,
          fecha: new Date(),
          registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
          metodoPago,
          idSepareOrigen: separeId,
          esPublico: true
        });
      }
      return { montoDevuelto, movimientoEgresoId };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      SEPARE_NO_EXISTE: { status: 404, text: 'El Plan Separe no existe.' },
      SEPARE_NO_AUTORIZADO: { status: 403, text: 'El Plan Separe no pertenece a tu negocio.' },
      SEPARE_CANCELADO: { status: 409, text: 'El Plan Separe ya fue cancelado.' },
      SEPARE_COMPLETADO: { status: 409, text: 'Un Plan Separe entregado no puede cancelarse.' },
      PRODUCTO_NO_AUTORIZADO: { status: 403, text: 'Producto no autorizado.' },
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'Cliente no autorizado.' },
      MONTO_INVALIDO: { status: 400, text: 'Monto de devolución inválido.' },
      ITEM_INVALIDO: { status: 400, text: 'Artículo de devolución inválido.' },
      SALDO_INVALIDO: { status: 400, text: 'Saldo del cliente inválido.' }
    };
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error cancelando Separe:', error);
    return NextResponse.json({ error: 'No se pudo cancelar el Plan Separe.' }, { status: 500 });
  }
}
