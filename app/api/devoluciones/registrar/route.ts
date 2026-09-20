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
    if (!cuentaPrincipalId || (!esAdmin && usuario.permisos?.hacerDevoluciones !== true)) {
      return NextResponse.json({ error: 'No tienes permiso para hacer devoluciones.' }, { status: 403 });
    }

    const body = await request.json();
    const origenId = typeof body.movimientoOrigenId === 'string' ? body.movimientoOrigenId : '';
    const metodoDevolucion = body.metodoDevolucion === 'saldo_a_favor' ? 'saldo_a_favor' : 'efectivo';
    const articulosSolicitados = Array.isArray(body.articulosDevueltos) ? body.articulosDevueltos : [];
    if (!origenId || !articulosSolicitados.length) return NextResponse.json({ error: 'Devolución incompleta.' }, { status: 400 });

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const origenRef = adminDb.collection('movimientos').doc(origenId);
      const origenSnap = await transaction.get(origenRef);
      if (!origenSnap.exists) throw new Error('ORIGEN_NO_EXISTE');
      const origen = origenSnap.data() as any;
      if (origen.usuarioId !== cuentaPrincipalId || !['venta', 'fiado'].includes(origen.tipo)) throw new Error('ORIGEN_NO_AUTORIZADO');

      const detallesOrigen = Array.isArray(origen.detalles) ? origen.detalles : [];
      if (!detallesOrigen.length) throw new Error('SIN_DETALLES');
      const controlRef = adminDb.collection('controles_devolucion').doc(origenId);
      const controlSnap = await transaction.get(controlRef);
      const cantidadesDevueltas = new Map<number, number>();
      if (controlSnap.exists) {
        Object.entries(controlSnap.data()?.cantidadesPorDetalle || {}).forEach(([indice, cantidad]) => {
          cantidadesDevueltas.set(Number(indice), Number(cantidad) || 0);
        });
      }

      const articulosValidados = articulosSolicitados.map((articulo: any) => {
        const indice = Number.isInteger(articulo.detalleIndex) ? articulo.detalleIndex : detallesOrigen.findIndex((detalle: any) => detalle.descripcion === articulo.descripcion);
        const detalle = detallesOrigen[indice];
        const cantidad = Number(articulo.cantidad);
        if (!detalle || !Number.isInteger(cantidad) || cantidad <= 0) throw new Error('ARTICULO_INVALIDO');
        const yaDevuelta = cantidadesDevueltas.get(indice) || 0;
        const cantidadOriginal = Number(detalle.cantidad || 1);
        if (yaDevuelta + cantidad > cantidadOriginal) throw new Error('CANTIDAD_EXCEDIDA');
        const brutoUnitario = Number(detalle.valorUnitario) || Number(detalle.valor || 0) / cantidadOriginal;
        const totalBruto = detallesOrigen.reduce((s: number, item: any) => {
          const cantidadItem = Number(item.cantidad || 1);
          return s + cantidadItem * (Number(item.valorUnitario) || Number(item.valor || 0) / cantidadItem);
        }, 0);
        const descuento = Number(origen.montoDescuento || 0);
        const factor = totalBruto > 0 && descuento > 0 && descuento < totalBruto ? (totalBruto - descuento) / totalBruto : 1;
        const valorUnitario = Math.round(brutoUnitario * factor);
        cantidadesDevueltas.set(indice, yaDevuelta + cantidad);
        return { ...articulo, detalleIndex: indice, descripcion: detalle.descripcion, cantidad, valorUnitario, subtotal: cantidad * valorUnitario };
      });
      const totalDevolver = articulosValidados.reduce((s: number, articulo: any) => s + articulo.subtotal, 0);
      if (!Number.isFinite(totalDevolver) || totalDevolver <= 0) throw new Error('TOTAL_INVALIDO');

      let nuevoSaldo: number | undefined;
      let efectivo = 0;
      let amortizado = 0;
      let clienteUpdateRef: FirebaseFirestore.DocumentReference | null = null;
      let clienteUpdateSaldo: number | undefined;
      if (origen.clienteId && origen.clienteId !== 'mostrador') {
        const clienteRef = adminDb.collection('clientes').doc(origen.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('CLIENTE_NO_AUTORIZADO');
        const saldoActual = Number(clienteSnap.data()?.deudaTotal || 0);
        if (!Number.isFinite(saldoActual)) throw new Error('SALDO_INVALIDO');
        if (origen.tipo === 'fiado' || metodoDevolucion === 'saldo_a_favor') {
          nuevoSaldo = saldoActual - totalDevolver;
          amortizado = totalDevolver;
          clienteUpdateRef = clienteRef;
          clienteUpdateSaldo = nuevoSaldo;
        } else if (saldoActual > 0) {
          amortizado = Math.min(saldoActual, totalDevolver);
          efectivo = totalDevolver - amortizado;
          nuevoSaldo = saldoActual - amortizado;
          clienteUpdateRef = clienteRef;
          clienteUpdateSaldo = nuevoSaldo;
        } else {
          efectivo = totalDevolver;
        }
      } else {
        efectivo = totalDevolver;
      }

      for (const articulo of articulosValidados) {
        if (!articulo.productoId) continue;
        const productoRef = adminDb.collection('inventario').doc(articulo.productoId);
        const productoSnap = await transaction.get(productoRef);
        if (productoSnap.exists && productoSnap.data()?.usuarioId === cuentaPrincipalId) {
          transaction.update(productoRef, { stock: Number(productoSnap.data()?.stock || 0) + articulo.cantidad });
        }
      }

      const cantidadesPorDetalle: Record<string, number> = {};
      cantidadesDevueltas.forEach((cantidad, indice) => { cantidadesPorDetalle[String(indice)] = cantidad; });
      transaction.set(controlRef, { usuarioId: cuentaPrincipalId, movimientoOrigenId: origenId, cantidadesPorDetalle, fechaActualizacion: new Date() }, { merge: true });
      if (clienteUpdateRef && clienteUpdateSaldo !== undefined) {
        transaction.update(clienteUpdateRef, { deudaTotal: clienteUpdateSaldo, fechaUltimoMovimiento: new Date() });
      }

      const movimientoRef = adminDb.collection('movimientos').doc();
      transaction.create(movimientoRef, {
        usuarioId: cuentaPrincipalId,
        clienteId: origen.clienteId || null,
        clienteNombre: origen.clienteNombre || 'Cliente',
        tipo: 'devolucion',
        monto: totalDevolver,
        montoEfectivoReembolsado: efectivo,
        montoAmortizadoCartera: amortizado,
        descripcion: `Devolución de mercancía (${amortizado > 0 ? `Amortizado: $${amortizado.toLocaleString('es-CO')}` : ''}${efectivo > 0 ? ` Efectivo: $${efectivo.toLocaleString('es-CO')}` : ''})`,
        fecha: new Date(),
        registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        metodoDevolucion: efectivo > 0 && amortizado > 0 ? 'mixto' : (efectivo > 0 ? 'efectivo' : 'saldo_a_favor'),
        movimientoOrigenId: origenId,
        origenTipo: origen.tipo,
        articulosDevueltos: articulosValidados,
        saldoResultante: nuevoSaldo ?? null,
        esPublico: true
      });
      return { movimientoId: movimientoRef.id, nuevoSaldoCliente: nuevoSaldo, totalDevolver, articulosDevueltos: articulosValidados };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      ORIGEN_NO_EXISTE: { status: 404, text: 'La venta original no existe.' },
      ORIGEN_NO_AUTORIZADO: { status: 403, text: 'La venta no pertenece a tu negocio.' },
      SIN_DETALLES: { status: 409, text: 'La venta no tiene artículos devolvibles.' },
      ARTICULO_INVALIDO: { status: 400, text: 'Artículo inválido.' },
      CANTIDAD_EXCEDIDA: { status: 409, text: 'La cantidad supera lo vendido.' },
      TOTAL_INVALIDO: { status: 400, text: 'Total de devolución inválido.' },
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'Cliente no autorizado.' },
      SALDO_INVALIDO: { status: 409, text: 'Saldo del cliente inválido.' }
    };
    const respuesta = mensajes[error?.message];
    if (respuesta) return NextResponse.json({ error: respuesta.text }, { status: respuesta.status });
    console.error('Error registrando devolución:', error);
    return NextResponse.json({ error: error?.message || 'No se pudo registrar la devolución.' }, { status: 500 });
  }
}
