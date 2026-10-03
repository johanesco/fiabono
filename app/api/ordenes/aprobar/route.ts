import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

function parseMonto(valor: any): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.round(valor);
  const raw = String(valor ?? '');
  // Handle locale-formatted numbers: "15.000" or "15,000" => 15000
  // Try direct parse first
  let n = Number(raw.replace(/[.,]/g, '').replace(/\s/g, ''));
  if (!Number.isFinite(n)) {
    n = Number(raw.replace(/\D/g, ''));
  }
  return Number.isFinite(n) ? n : NaN;
}

function calcularTotalOrden(orden: any) {
  const items = Array.isArray(orden.items) ? orden.items : [];
  if (!items.length) throw new Error('TOTAL_INVALIDO');
  const subtotal = items.reduce((total: number, item: any) => {
    const cantidad = Number(item.cantidad || 1);
    const valor = parseMonto(item.valor);
    if (!Number.isInteger(cantidad) || cantidad <= 0 || !Number.isFinite(valor) || valor < 0) throw new Error('TOTAL_INVALIDO');
    return total + valor * cantidad;
  }, 0);
  const descuento = Number(orden.montoDescuento || 0);
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > subtotal) throw new Error('TOTAL_INVALIDO');
  const total = subtotal - descuento;
  const totalDeclarado = parseMonto(orden.total);
  if (!Number.isFinite(total) || total <= 0) throw new Error('TOTAL_INVALIDO');
  if (Number.isFinite(totalDeclarado) && Math.abs(total - totalDeclarado) > 1) throw new Error('TOTAL_INVALIDO');
  return total;
}

function aFecha(valor: any): Date {
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
  if (valor?.toDate) return valor.toDate();
  if (typeof valor?.seconds === 'number') return new Date(valor.seconds * 1000);
  if (typeof valor?._seconds === 'number') return new Date(valor._seconds * 1000);
  if (typeof valor === 'string' || typeof valor === 'number') {
    const d = new Date(valor);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function sanitizarNumero(valor: any, fallback = 0) {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizarMovimiento(movimiento: any, orden: any, usuarioId: string) {
  if (!movimiento || typeof movimiento !== 'object') return null;
  const clienteId = movimiento.clienteId || orden.clienteId || 'mostrador';
  const detalles = Array.isArray(movimiento.detalles)
    ? movimiento.detalles.map((item: any) => ({
        descripcion: item?.descripcion || 'Artículo',
        cantidad: sanitizarNumero(item?.cantidad, 1),
        valor: sanitizarNumero(item?.valor),
        valorUnitario: sanitizarNumero(item?.valorUnitario)
      }))
    : undefined;

  return {
    ...movimiento,
    usuarioId,
    clienteId,
    clienteNombre: (movimiento.clienteNombre && movimiento.clienteNombre !== 'Mostrador') ? movimiento.clienteNombre : (orden.clienteNombre && orden.clienteNombre !== 'Mostrador' ? orden.clienteNombre : 'Consumidor Final'),
    clienteCelular: movimiento.clienteCelular || orden.clienteCelular || '',
    fecha: aFecha(movimiento.fecha),
    monto: sanitizarNumero(movimiento.monto),
    esPublico: true,
    ...(detalles ? { detalles } : {})
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists || usuarioSnap.data()?.rol === 'cajero') {
      return NextResponse.json({ error: 'Sólo el administrador puede aprobar órdenes.' }, { status: 403 });
    }

    const body = await request.json();
    const ordenId = typeof body.ordenId === 'string' ? body.ordenId : '';
    if (!ordenId) return NextResponse.json({ error: 'Orden requerida.' }, { status: 400 });

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const ordenRef = adminDb.collection('ordenes_pendientes').doc(ordenId);
      const ordenSnap = await transaction.get(ordenRef);
      if (!ordenSnap.exists) throw new Error('ORDEN_NO_EXISTE');

      const orden = ordenSnap.data() as any;
      if (orden.usuarioId !== decodedToken.uid) throw new Error('ORDEN_NO_AUTORIZADA');
      if (orden.estado === 'aprobado') {
        return { idTransaccionGenerada: orden.idTransaccion || '', yaProcesada: true };
      }
      if (orden.estado !== 'pendiente') throw new Error('ORDEN_NO_PENDIENTE');
      const totalOrden = calcularTotalOrden(orden);
      const pagoOrden = typeof orden.pagoCliente === 'number'
        ? orden.pagoCliente
        : parseMonto(orden.pagoCliente || 0);
      if (!Number.isFinite(pagoOrden) || pagoOrden < 0) throw new Error('PAGO_INVALIDO');

      const itemsStock = Array.isArray(body.descontarStockItems) ? body.descontarStockItems : [];
      const stockDocs = new Map<string, { ref: any; data: any }>();
      for (const item of itemsStock) {
        if (!item?.productoId || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
          throw new Error('STOCK_INVALIDO');
        }
        const productoRef = adminDb.collection('inventario').doc(item.productoId);
        const productoSnap = await transaction.get(productoRef);
        if (!productoSnap.exists || productoSnap.data()?.usuarioId !== decodedToken.uid) {
          throw new Error('PRODUCTO_NO_AUTORIZADO');
        }
        const producto = productoSnap.data() as any;
        const stock = Number(producto.stock || 0);
        if (producto.tipoProducto !== 'servicio' && producto.inventariable !== false && Number(item.cantidad) > stock) {
          throw new Error(`SIN_STOCK:${producto.nombre || item.productoId}`);
        }
        stockDocs.set(item.productoId, { ref: productoRef, data: producto });
      }

      const ajusteCliente = body.ajusteCliente;
      let clienteRef: any = null;
      let nuevoSaldoCliente: number | undefined;
      if (ajusteCliente?.clienteId) {
        const clienteDocRef = adminDb.collection('clientes').doc(ajusteCliente.clienteId);
        clienteRef = clienteDocRef;
        const clienteSnap = await transaction.get(clienteDocRef);
        if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== decodedToken.uid) throw new Error('CLIENTE_NO_AUTORIZADO');
        const deudaActual = Number(clienteSnap.data()?.deudaTotal || 0);
        const cambioDeuda = Number(ajusteCliente.cambioDeuda);
        if (!Number.isFinite(deudaActual) || !Number.isFinite(cambioDeuda)) throw new Error('SALDO_INVALIDO');
        nuevoSaldoCliente = deudaActual + cambioDeuda;
      }

      for (const item of itemsStock) {
        const producto = stockDocs.get(item.productoId)!;
        if (producto.data.tipoProducto !== 'servicio' && producto.data.inventariable !== false) {
          transaction.update(producto.ref, { stock: Number(producto.data.stock || 0) - Number(item.cantidad) });
        }
      }
      if (clienteRef && nuevoSaldoCliente !== undefined) {
        transaction.update(clienteRef, { deudaTotal: nuevoSaldoCliente, fechaUltimoMovimiento: new Date() });
      }

      let idTransaccionGenerada = '';
      const payloadSepare = body.payloadSepare;
      const movimientoAbonoSepare = sanitizarMovimiento(body.movimientoAbonoSepare, orden, decodedToken.uid);
      const movimientoPrincipal = sanitizarMovimiento(body.movimientoPrincipal, orden, decodedToken.uid);
      const movimientoFiadoSecundario = sanitizarMovimiento(body.movimientoFiadoSecundario, orden, decodedToken.uid);

      if (payloadSepare) {
        const separeRef = adminDb.collection('separes').doc();
        idTransaccionGenerada = separeRef.id;
        transaction.create(separeRef, {
          ...payloadSepare,
          usuarioId: decodedToken.uid,
          esPublico: true,
          fechaCreacion: aFecha(payloadSepare.fechaCreacion || orden.fecha),
          fechaLimite: payloadSepare.fechaLimite ? aFecha(payloadSepare.fechaLimite) : null
        });
        if (movimientoAbonoSepare) {
          const movimientoRef = adminDb.collection('movimientos').doc();
          transaction.create(movimientoRef, { ...movimientoAbonoSepare, idSepareOrigen: separeRef.id });
        }
      } else if (movimientoPrincipal) {
        const movimientoRef = adminDb.collection('movimientos').doc();
        idTransaccionGenerada = movimientoRef.id;
        transaction.create(movimientoRef, movimientoPrincipal);
        if (movimientoFiadoSecundario) {
          const fiadoRef = adminDb.collection('movimientos').doc();
          transaction.create(fiadoRef, movimientoFiadoSecundario);
        }
      } else {
        throw new Error('MOVIMIENTO_REQUERIDO');
      }

      transaction.update(ordenRef, {
        estado: 'aprobado',
        fechaProcesado: new Date(),
        aprobadoPor: usuarioSnap.data()?.nombreUsuario || decodedToken.email || 'Administrador',
        idTransaccion: idTransaccionGenerada
      });

      return { idTransaccionGenerada, nuevoSaldoCliente };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      ORDEN_NO_EXISTE: { status: 404, text: 'La orden ya no existe.' },
      ORDEN_NO_AUTORIZADA: { status: 403, text: 'La orden no pertenece a tu negocio.' },
      ORDEN_NO_PENDIENTE: { status: 409, text: 'La orden ya fue procesada.' },
      PRODUCTO_NO_AUTORIZADO: { status: 403, text: 'Producto no autorizado.' },
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'Cliente no autorizado.' },
      STOCK_INVALIDO: { status: 400, text: 'Stock inválido.' },
      SALDO_INVALIDO: { status: 400, text: 'Saldo inválido.' },
      TOTAL_INVALIDO: { status: 409, text: 'El total de la orden no coincide con sus artículos y descuento.' },
      PAGO_INVALIDO: { status: 409, text: 'El pago registrado en la orden no es válido.' },
      MOVIMIENTO_REQUERIDO: { status: 400, text: 'No se recibió una transacción válida.' }
    };
    if (error?.message?.startsWith('SIN_STOCK:')) {
      return NextResponse.json({ error: `Sin stock suficiente de ${error.message.slice(9)}.` }, { status: 409 });
    }
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error aprobando orden:', error);
    return NextResponse.json({ error: 'No se pudo aprobar la orden.' }, { status: 500 });
  }
}
