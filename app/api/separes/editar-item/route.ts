import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

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
    const tienePermisoEditarSepare =
      esAdmin || (usuario.permisos?.planSepare === true && usuario.permisos?.modificarPrecios === true);

    if (!cuentaPrincipalId || !tienePermisoEditarSepare) {
      return NextResponse.json(
        { error: 'No tienes permiso para editar precios o artículos en un Plan Separe. Solicita autorización al administrador.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId.trim() : '';
    const itemIndex = typeof body.itemIndex === 'number' ? body.itemIndex : -1;
    const nuevoValorUnitario = Math.round(
      Number(String(body.nuevoValorUnitario || '0').replace(/\D/g, '')) || Number(body.nuevoValorUnitario || 0)
    );
    const nuevaCantidad = Math.max(1, Math.round(Number(body.nuevaCantidad || 1)));
    const nuevaDescripcionRaw = typeof body.nuevaDescripcion === 'string' ? body.nuevaDescripcion.trim() : '';
    const motivo =
      typeof body.motivo === 'string' && body.motivo.trim()
        ? body.motivo.trim()
        : 'Corrección de precio o digitación';
    const destinoExcedente = body.destinoExcedente === 'efectivo' ? 'efectivo' : 'saldo_favor';

    if (!separeId || itemIndex < 0) {
      return NextResponse.json({ error: 'Parámetros inválidos para editar el artículo.' }, { status: 400 });
    }
    if (!Number.isFinite(nuevoValorUnitario) || nuevoValorUnitario <= 0) {
      return NextResponse.json({ error: 'El precio unitario debe ser mayor a $0.' }, { status: 400 });
    }
    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad < 1) {
      return NextResponse.json({ error: 'La cantidad debe ser al menos 1 unidad.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      // 1. TODAS LAS LECTURAS PRIMERO
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');

      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_COMPLETADO');

      const items = Array.isArray(separe.items) ? [...separe.items] : [];
      if (items.length === 0) throw new Error('SIN_ITEMS');
      if (itemIndex >= items.length) throw new Error('INDICE_ITEM_INVALIDO');

      const itemActual = items[itemIndex];
      const cantEntregada = Number(itemActual.cantidadEntregada || 0);
      if (cantEntregada > 0) {
        throw new Error('ITEM_YA_ENTREGADO');
      }

      const productoId = itemActual.idProducto || itemActual.productoId || null;
      const esDeInventario = Boolean(productoId);

      let prodRef: any = null;
      let prodSnap: any = null;
      if (esDeInventario) {
        prodRef = adminDb.collection('inventario').doc(productoId);
        prodSnap = await transaction.get(prodRef);
      }

      let clienteRef: any = null;
      let clienteSnap: any = null;
      if (separe.clienteId) {
        clienteRef = adminDb.collection('clientes').doc(separe.clienteId);
        clienteSnap = await transaction.get(clienteRef);
      }

      // 2. VALIDACIONES DE NEGOCIO Y CÁLCULOS MATEMÁTICOS
      const descripcionAnterior = String(itemActual.descripcion || 'Producto').trim();
      // Regla de oro: Si pertenece a inventario, el nombre está estrictamente bloqueado
      const descripcionFinal = esDeInventario
        ? descripcionAnterior
        : (nuevaDescripcionRaw.length > 0 ? nuevaDescripcionRaw : descripcionAnterior);

      const valorUnitarioAnterior = Math.round(Number(itemActual.valor || 0));
      const cantidadAnterior = Math.max(1, Math.round(Number(itemActual.cantidad || 1)));
      const deltaCantidad = nuevaCantidad - cantidadAnterior;

      if (
        valorUnitarioAnterior === nuevoValorUnitario &&
        cantidadAnterior === nuevaCantidad &&
        descripcionAnterior === descripcionFinal
      ) {
        throw new Error('SIN_CAMBIOS');
      }

      // Validar stock si es producto inventariable y cambió la cantidad
      let actualizarStockInv = false;
      let nuevoStockInv = 0;
      if (esDeInventario && deltaCantidad !== 0 && prodSnap && prodSnap.exists && prodSnap.data()?.usuarioId === cuentaPrincipalId) {
        const prodData = prodSnap.data() as any;
        if (prodData.tipoProducto !== 'servicio' && prodData.inventariable !== false) {
          const stockActual = Number(prodData.stock || 0);
          if (deltaCantidad > 0 && stockActual < deltaCantidad) {
            throw new Error(`STOCK_INSUFICIENTE:${stockActual}`);
          }
          nuevoStockInv = stockActual - deltaCantidad;
          actualizarStockInv = true;
        }
      }

      const subtotalBrutoAnterior = valorUnitarioAnterior * cantidadAnterior;
      const nuevoSubtotalBruto = nuevoValorUnitario * nuevaCantidad;
      const deltaBruto = nuevoSubtotalBruto - subtotalBrutoAnterior;

      const totalBrutoActual =
        Number(separe.totalBruto || 0) ||
        items.reduce((acc: number, it: any) => acc + (Number(it.valor) || 0) * (Number(it.cantidad) || 1), 0);
      const nuevoTotalBruto = Math.max(0, totalBrutoActual + deltaBruto);

      const montoDescuentoActual = Number(separe.montoDescuento || 0);
      let nuevoMontoDescuento = montoDescuentoActual;
      if (montoDescuentoActual > 0) {
        if (separe.descuentoTipo === 'porcentaje' && Number(separe.descuentoValor) > 0 && !itemActual.anexadoPosteriormente) {
          const pct = Math.min(100, Number(separe.descuentoValor)) / 100;
          const deltaDescuento = Math.round(deltaBruto * pct);
          nuevoMontoDescuento = Math.max(0, Math.min(nuevoTotalBruto, montoDescuentoActual + deltaDescuento));
        } else {
          nuevoMontoDescuento = Math.min(nuevoTotalBruto, montoDescuentoActual);
        }
      }

      const totalActual = Number(separe.total || 0);
      const nuevoTotal = Math.max(0, nuevoTotalBruto - nuevoMontoDescuento);
      const diferenciaNeto = nuevoTotal - totalActual;

      const montoPagadoActual = Number(separe.montoPagado || 0);
      let nuevoMontoPagado = montoPagadoActual;
      let nuevoSaldoPendiente = 0;
      let montoExcedente = 0;

      if (montoPagadoActual > nuevoTotal) {
        montoExcedente = montoPagadoActual - nuevoTotal;
        nuevoMontoPagado = nuevoTotal;
        nuevoSaldoPendiente = 0;
      } else {
        nuevoMontoPagado = montoPagadoActual;
        nuevoSaldoPendiente = Math.max(0, nuevoTotal - montoPagadoActual);
      }

      const fechaAhora = new Date();
      const autorNombre = usuario.nombreUsuario || decodedToken.email || 'Usuario';

      // 3. ESCRITURAS ATÓMICAS
      // 3.1 Actualizar stock en inventario si cambió la cantidad
      if (actualizarStockInv && prodRef) {
        transaction.update(prodRef, {
          stock: nuevoStockInv
        });
      }

      // 3.2 Gestionar excedente si lo abonado supera el nuevo total del separe
      if (montoExcedente > 0 && separe.clienteId) {
        if (destinoExcedente === 'saldo_favor' && clienteRef && clienteSnap && clienteSnap.exists) {
          const saldoClienteActual = Number(clienteSnap.data()?.deudaTotal || 0);
          transaction.update(clienteRef, {
            deudaTotal: saldoClienteActual - montoExcedente,
            fechaUltimoMovimiento: fechaAhora
          });

          const movAbonoRef = adminDb.collection('movimientos').doc();
          transaction.create(movAbonoRef, {
            usuarioId: cuentaPrincipalId,
            clienteId: separe.clienteId,
            clienteNombre: separe.clienteNombre || 'Cliente',
            tipo: 'abono',
            subtipo: 'excedente_separe_saldo_favor',
            monto: montoExcedente,
            descripcion: `Saldo a favor por ajuste de precio en Separe: ${descripcionFinal} (${motivo})`,
            metodoPago: 'saldo_interno',
            fecha: fechaAhora,
            registradoPor: autorNombre,
            idSepareOrigen: separeId,
            esPublico: true
          });
        } else if (destinoExcedente === 'efectivo') {
          const movEgresoRef = adminDb.collection('movimientos').doc();
          transaction.create(movEgresoRef, {
            usuarioId: cuentaPrincipalId,
            clienteId: separe.clienteId,
            clienteNombre: separe.clienteNombre || 'Cliente',
            tipo: 'egreso',
            categoria: 'devolucion_separe',
            concepto: `Devolución excedente en efectivo por ajuste de precio en Separe: ${descripcionFinal}`,
            monto: montoExcedente,
            descripcion: `Devolución de $${montoExcedente.toLocaleString('es-CO')} en efectivo por corrección de precio en Separe (${motivo})`,
            metodoPago: 'efectivo',
            fecha: fechaAhora,
            registradoPor: autorNombre,
            idSepareOrigen: separeId,
            esPublico: true
          });
        }
      }

      // 3.3 Construir el item actualizado y bitácoras de auditoría
      const cambiosTextoPartes: string[] = [];
      if (descripcionAnterior !== descripcionFinal) {
        cambiosTextoPartes.push(`nombre: "${descripcionAnterior}" → "${descripcionFinal}"`);
      }
      if (valorUnitarioAnterior !== nuevoValorUnitario) {
        cambiosTextoPartes.push(
          `precio unit.: $${valorUnitarioAnterior.toLocaleString('es-CO')} → $${nuevoValorUnitario.toLocaleString('es-CO')}`
        );
      }
      if (cantidadAnterior !== nuevaCantidad) {
        cambiosTextoPartes.push(`cantidad: ${cantidadAnterior} → ${nuevaCantidad}`);
      }
      const resumenCambios = cambiosTextoPartes.join(', ');

      const itemEditado = {
        ...itemActual,
        descripcion: descripcionFinal,
        valor: String(nuevoValorUnitario),
        cantidad: nuevaCantidad,
        editadoPosteriormente: true,
        ultimaEdicion: {
          fecha: fechaAhora.toISOString(),
          autor: autorNombre,
          motivo,
          valorAnterior: valorUnitarioAnterior,
          valorNuevo: nuevoValorUnitario,
          cantidadAnterior,
          cantidadNueva: nuevaCantidad,
          descripcionAnterior,
          descripcionNueva: descripcionFinal
        }
      };

      const itemsActualizados = items.map((it: any, idx: number) => (idx === itemIndex ? itemEditado : it));

      const bitacoraActual = Array.isArray(separe.bitacoraNovedades) ? [...separe.bitacoraNovedades] : [];
      const novedadTexto = `Artículo "${descripcionFinal}" corregido (${resumenCambios}). Motivo: ${motivo}. Total separe: $${totalActual.toLocaleString('es-CO')} → $${nuevoTotal.toLocaleString('es-CO')} | Saldo pendiente: $${nuevoSaldoPendiente.toLocaleString('es-CO')}.${
        montoExcedente > 0
          ? ` Excedente de $${montoExcedente.toLocaleString('es-CO')} asignado a ${
              destinoExcedente === 'efectivo' ? 'efectivo devuelto de caja' : 'saldo a favor del cliente'
            }.`
          : ''
      }`;

      bitacoraActual.push({
        id: `nov_edit_${Date.now()}`,
        nota: novedadTexto,
        texto: novedadTexto,
        fecha: fechaAhora,
        autor: autorNombre,
        tipo: 'correccion_articulo'
      });

      const historialEdicionesActual = Array.isArray(separe.historialEdicionesItems)
        ? [...separe.historialEdicionesItems]
        : [];
      historialEdicionesActual.push({
        itemIndex,
        idProducto: productoId,
        esDeInventario,
        descripcionAnterior,
        descripcionNueva: descripcionFinal,
        valorUnitarioAnterior,
        valorUnitarioNuevo: nuevoValorUnitario,
        cantidadAnterior,
        cantidadNueva: nuevaCantidad,
        totalSepareAnterior: totalActual,
        totalSepareNuevo: nuevoTotal,
        diferenciaNeto,
        excedenteGenerado: montoExcedente,
        destinoExcedente: montoExcedente > 0 ? destinoExcedente : null,
        motivo,
        autor: autorNombre,
        fecha: fechaAhora
      });

      // 3.4 Registrar movimiento de auditoría en Historial General ('movimientos')
      const movAjusteRef = adminDb.collection('movimientos').doc();
      transaction.create(movAjusteRef, {
        usuarioId: cuentaPrincipalId,
        clienteId: separe.clienteId || null,
        clienteNombre: separe.clienteNombre || 'Cliente',
        tipo: 'separe',
        subtipo: 'edicion_item_separe',
        monto: Math.abs(diferenciaNeto),
        diferenciaNeto,
        descripcion: `Corrección en Plan Separe (${descripcionFinal}: ${resumenCambios}). Motivo: ${motivo}. Nuevo saldo: $${nuevoSaldoPendiente.toLocaleString('es-CO')}`,
        metodoPago: 'saldo_interno',
        fecha: fechaAhora,
        registradoPor: autorNombre,
        idSepareOrigen: separeId,
        esPublico: true,
        detalles: [
          {
            descripcion: `${descripcionFinal} (${resumenCambios})`,
            cantidad: nuevaCantidad,
            valorUnitario: nuevoValorUnitario,
            valor: nuevoSubtotalBruto,
            motivo
          }
        ]
      });

      // 3.5 Actualizar documento del Plan Separe
      transaction.update(separeRef, {
        items: itemsActualizados,
        totalBruto: nuevoTotalBruto,
        montoDescuento: nuevoMontoDescuento,
        total: nuevoTotal,
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente,
        bitacoraNovedades: bitacoraActual,
        historialEdicionesItems: historialEdicionesActual,
        fechaModificado: fechaAhora
      });

      return {
        separeId,
        itemEditado,
        nuevoTotal,
        nuevoTotalBruto,
        nuevoMontoDescuento,
        nuevoMontoPagado,
        nuevoSaldoPendiente,
        diferenciaNeto,
        montoExcedente,
        destinoExcedente,
        itemsActualizados
      };
    });

    return NextResponse.json({
      ok: true,
      mensaje: 'Artículo corregido y saldos del Plan Separe recalibrados exitosamente.',
      ...resultado
    });
  } catch (error: any) {
    console.error('Error al editar artículo del separe:', error);
    const mensaje = String(error?.message || '');

    if (mensaje === 'ITEM_YA_ENTREGADO') {
      return NextResponse.json(
        { error: 'Este artículo ya tiene unidades entregadas físicamente al cliente y no puede modificarse.' },
        { status: 400 }
      );
    }
    if (mensaje === 'SIN_CAMBIOS') {
      return NextResponse.json({ error: 'No realizaste ningún cambio en el artículo.' }, { status: 400 });
    }
    if (mensaje.startsWith('STOCK_INSUFICIENTE:')) {
      const disp = mensaje.split(':')[1] || '0';
      return NextResponse.json(
        { error: `No hay suficiente stock en inventario para aumentar la cantidad (Disponible en bodega: ${disp}).` },
        { status: 400 }
      );
    }
    if (mensaje === 'INDICE_ITEM_INVALIDO') {
      return NextResponse.json({ error: 'El artículo seleccionado ya no existe en el separe.' }, { status: 400 });
    }
    if (mensaje === 'SEPARE_CANCELADO' || mensaje === 'SEPARE_COMPLETADO') {
      return NextResponse.json({ error: 'Solo se pueden editar artículos de un Plan Separe activo.' }, { status: 400 });
    }

    return NextResponse.json({ error: error?.message || 'Error interno al editar el artículo del separe.' }, { status: 500 });
  }
}
