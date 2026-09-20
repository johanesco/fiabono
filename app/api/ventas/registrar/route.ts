import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const METODOS_PERMITIDOS = new Set(['efectivo', 'transferencia', 'datafono', 'credito_externo', 'fiado']);

function numeroValido(value: unknown, minimo = 0) {
  const numero = Number(value);
  return Number.isFinite(numero) && numero >= minimo;
}

function quitarUndefined<T extends Record<string, any>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 });
    }

    const usuario = usuarioSnap.data() as any;
    const esAdmin = usuario.rol !== 'cajero';
    const cuentaPrincipalId = esAdmin ? decodedToken.uid : usuario.adminId;
    if (!cuentaPrincipalId || (!esAdmin && usuario.activo === false)) {
      return NextResponse.json({ error: 'La cuenta no está habilitada.' }, { status: 403 });
    }
    if (!esAdmin && usuario.permisos?.ventaDirecta !== true) {
      return NextResponse.json({ error: 'No tienes permiso para confirmar ventas directamente.' }, { status: 403 });
    }

    const body = await request.json();
    const clienteId = typeof body.clienteId === 'string' ? body.clienteId : 'mostrador';
    const metodoPago = typeof body.metodoPago === 'string' ? body.metodoPago : '';
    const montoVentaReal = Number(body.montoVentaReal);
    const montoFiado = Number(body.montoFiado || 0);
    const fiarFaltante = body.fiarFaltante === true;
    const itemsInventario = Array.isArray(body.itemsInventario) ? body.itemsInventario : [];
    const detalles = Array.isArray(body.detalles) ? body.detalles : [];

    if (!METODOS_PERMITIDOS.has(metodoPago) || !numeroValido(montoVentaReal) || !numeroValido(montoFiado)) {
      return NextResponse.json({ error: 'Datos de pago o montos inválidos.' }, { status: 400 });
    }
    if (fiarFaltante && montoFiado <= 0) {
      return NextResponse.json({ error: 'El monto fiado debe ser mayor que cero.' }, { status: 400 });
    }
    if (!detalles.length) {
      return NextResponse.json({ error: 'La venta debe contener artículos.' }, { status: 400 });
    }
    for (const item of itemsInventario) {
      if (!item?.productoId || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        return NextResponse.json({ error: 'Los artículos de inventario son inválidos.' }, { status: 400 });
      }
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      let clienteRef: FirebaseFirestore.DocumentReference | null = null;
      let clienteData: any = null;
      let nuevoSaldoCliente: number | undefined;
      let consumoSaldoFavor = 0;
      let montoFiadoReal = 0;

      if (clienteId !== 'mostrador') {
        clienteRef = adminDb.collection('clientes').doc(clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) {
          throw new Error('CLIENTE_NO_AUTORIZADO');
        }
        clienteData = clienteSnap.data();
      }

      const cantidadesPorProducto = new Map<string, number>();
      for (const item of itemsInventario) {
        const cantidad = Number(item.cantidad);
        cantidadesPorProducto.set(item.productoId, (cantidadesPorProducto.get(item.productoId) || 0) + cantidad);
      }

      const productos = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: any }>();
      for (const [productoId, cantidad] of cantidadesPorProducto) {
        const productoRef = adminDb.collection('inventario').doc(productoId);
        const productoSnap = await transaction.get(productoRef);
        if (!productoSnap.exists || productoSnap.data()?.usuarioId !== cuentaPrincipalId) {
          throw new Error('PRODUCTO_NO_AUTORIZADO');
        }
        const producto = productoSnap.data() as any;
        if (producto.activo === false) throw new Error('PRODUCTO_ARCHIVADO');
        const stock = Number(producto.stock || 0);
        if (!Number.isFinite(stock) || stock < 0) throw new Error('STOCK_INVALIDO');
        if (producto.tipoProducto !== 'servicio' && producto.inventariable !== false && cantidad > stock) {
          throw new Error(`SIN_STOCK:${producto.nombre || productoId}`);
        }
        productos.set(productoId, { ref: productoRef, data: producto });
      }

      const detallesValidados = detalles.map((detalle: any) => {
        const cantidad = Number(detalle?.cantidad || 1);
        if (!Number.isInteger(cantidad) || cantidad <= 0) throw new Error('DETALLE_INVALIDO');

        const productoId = typeof detalle?.productoId === 'string'
          ? detalle.productoId
          : [...productos.entries()].find(([, producto]) =>
              producto.data.nombre?.trim().toLowerCase() === String(detalle?.descripcion || '').trim().toLowerCase()
            )?.[0];
        const producto = productoId ? productos.get(productoId) : undefined;
        const precioRecibido = Number(detalle?.valorUnitario);
        if (!Number.isFinite(precioRecibido) || precioRecibido < 0) throw new Error('DETALLE_INVALIDO');

        const puedeModificarPrecio = esAdmin || usuario.permisos?.modificarPrecios === true;
        const precioUnitario = producto && !puedeModificarPrecio
          ? Number(producto.data.precioVenta || 0)
          : precioRecibido;
        if (!Number.isFinite(precioUnitario) || precioUnitario < 0) throw new Error('DETALLE_INVALIDO');

        return {
          ...detalle,
          productoId: productoId || undefined,
          cantidad,
          valorUnitario: precioUnitario,
          valor: precioUnitario * cantidad,
          costoUnitario: producto ? Number(producto.data.costoCompra || 0) : Number(detalle.costoUnitario || 0)
        };
      });

      const subtotalBruto = detallesValidados.reduce((total: number, detalle: any) => total + detalle.valor, 0);
      const descuentoTipo = body.descuentoTipo === 'porcentaje' || body.descuentoTipo === 'fijo'
        ? body.descuentoTipo
        : null;
      const descuentoSolicitado = Number(body.montoDescuento || 0);
      if (!Number.isFinite(descuentoSolicitado) || descuentoSolicitado < 0 || descuentoSolicitado > subtotalBruto) {
        throw new Error('DESCUENTO_INVALIDO');
      }
      const descuentoCalculado = descuentoTipo === 'porcentaje'
        ? Math.round(subtotalBruto * Math.min(100, Math.max(0, Number(body.descuentoValor || 0))) / 100)
        : descuentoSolicitado;
      if (descuentoTipo === 'porcentaje' && descuentoCalculado !== descuentoSolicitado) {
        throw new Error('DESCUENTO_INVALIDO');
      }
      const totalCalculado = subtotalBruto - descuentoSolicitado;
      if (!Number.isFinite(totalCalculado) || totalCalculado <= 0) throw new Error('TOTAL_INVALIDO');
      if (Math.abs((montoVentaReal + montoFiado) - totalCalculado) > 0.01) {
        throw new Error('TOTAL_NO_COINCIDE');
      }

      if (fiarFaltante && clienteRef && clienteData) {
        const deudaActual = Number(clienteData.deudaTotal || 0);
        if (!Number.isFinite(deudaActual)) throw new Error('SALDO_INVALIDO');
        if (deudaActual < 0) {
          consumoSaldoFavor = Math.min(Math.abs(deudaActual), montoFiado);
        }
        montoFiadoReal = montoFiado - consumoSaldoFavor;
        nuevoSaldoCliente = deudaActual + montoFiado;
      }

      for (const [productoId, cantidad] of cantidadesPorProducto) {
        const producto = productos.get(productoId)!;
        if (producto.data.tipoProducto !== 'servicio' && producto.data.inventariable !== false) {
          transaction.update(producto.ref, { stock: Number(producto.data.stock || 0) - cantidad });
        }
      }
      if (clienteRef && nuevoSaldoCliente !== undefined) {
        transaction.update(clienteRef, { deudaTotal: nuevoSaldoCliente, fechaUltimoMovimiento: new Date() });
      }

      const descripcionVenta = typeof body.descripcionVenta === 'string' ? body.descripcionVenta : 'Venta';
      const registradoPor = usuario.nombreUsuario || decodedToken.email || 'Vendedor';
      let movimientoVentaId: string | undefined;
      let movimientoFiadoId: string | undefined;
      const baseMovimiento = {
        clienteId,
        clienteNombre: clienteData?.nombre,
        usuarioId: cuentaPrincipalId,
        detalles: detallesValidados,
        registradoPor,
        fecha: new Date(),
        referenciaPago: typeof body.referenciaPago === 'string' ? body.referenciaPago : undefined,
        subtotal: Number.isFinite(Number(body.subtotal)) ? Number(body.subtotal) : subtotalBruto,
        valorIva: Number.isFinite(Number(body.valorIva)) ? Number(body.valorIva) : 0,
        porcentajeIva: body.porcentajeIva,
        descuentoTipo: body.descuentoTipo || null,
        descuentoValor: body.descuentoValor,
        montoDescuento: body.montoDescuento,
        esPublico: true
      };

      const totalVentaRegistrar = montoVentaReal + consumoSaldoFavor;
      if (totalVentaRegistrar > 0) {
        const movimientoRef = adminDb.collection('movimientos').doc();
        movimientoVentaId = movimientoRef.id;
        transaction.create(movimientoRef, quitarUndefined({
          ...baseMovimiento,
          tipo: 'venta',
          monto: totalVentaRegistrar,
          descripcion: descripcionVenta,
          metodoPago: montoVentaReal > 0 ? metodoPago : 'saldo_interno',
          montoPagadoConSaldoFavor: consumoSaldoFavor || undefined
        }));
      }
      if (montoFiadoReal > 0 && clienteRef) {
        const movimientoRef = adminDb.collection('movimientos').doc();
        movimientoFiadoId = movimientoRef.id;
        transaction.create(movimientoRef, quitarUndefined({
          ...baseMovimiento,
          tipo: 'fiado',
          monto: montoFiadoReal,
          descripcion: typeof body.descripcionFiado === 'string' ? body.descripcionFiado : 'Saldo pendiente de venta',
          metodoPago: 'fiado',
          saldoResultante: nuevoSaldoCliente
        }));
      }

      return { movimientoVentaId, movimientoFiadoId, nuevoSaldoCliente };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, string> = {
      CLIENTE_NO_AUTORIZADO: 'Cliente no encontrado o no pertenece a tu negocio.',
      PRODUCTO_NO_AUTORIZADO: 'Producto no encontrado o no pertenece a tu negocio.',
      PRODUCTO_ARCHIVADO: 'El producto está archivado y no se puede vender.',
      STOCK_INVALIDO: 'El stock del producto no es válido.',
      SALDO_INVALIDO: 'El saldo del cliente no es válido.',
      DETALLE_INVALIDO: 'Los detalles de la venta no son válidos.',
      DESCUENTO_INVALIDO: 'El descuento no es válido.',
      TOTAL_INVALIDO: 'El total de la venta no es válido.',
      TOTAL_NO_COINCIDE: 'El pago y el fiado no coinciden con el total calculado.'
    };
    if (error?.message?.startsWith('SIN_STOCK:')) {
      return NextResponse.json({ error: `Sin stock suficiente de ${error.message.slice(9)}.` }, { status: 409 });
    }
    if (mensajes[error?.message]) {
      return NextResponse.json({ error: mensajes[error.message] }, { status: 409 });
    }
    console.error('Error registrando venta:', error);
    return NextResponse.json({ error: 'No se pudo registrar la venta.' }, { status: 500 });
  }
}
