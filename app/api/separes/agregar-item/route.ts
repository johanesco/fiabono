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
    const tienePermisoSepare = esAdmin || usuario.permisos?.planSepare === true || usuario.permisos?.abonar === true;
    if (!cuentaPrincipalId || !tienePermisoSepare) {
      return NextResponse.json({ error: 'No tienes permiso para modificar planes separe.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId.trim() : '';
    const nuevosItemsRaw = Array.isArray(body.nuevosItems) ? body.nuevosItems : [];
    const abonoAdicional = Math.max(0, Math.round(Number(body.abonoAdicional || 0)));
    const metodoPago = typeof body.metodoPago === 'string' && body.metodoPago.trim() ? body.metodoPago.trim() : 'efectivo';
    const subMetodoPago = typeof body.subMetodoPago === 'string' && body.subMetodoPago.trim() ? body.subMetodoPago.trim() : null;
    const referenciaPago = typeof body.referenciaPago === 'string' && body.referenciaPago.trim() ? body.referenciaPago.trim() : null;
    const notaOpcional = typeof body.notaOpcional === 'string' && body.notaOpcional.trim() ? body.notaOpcional.trim() : '';

    if (!separeId || nuevosItemsRaw.length === 0) {
      return NextResponse.json({ error: 'Debes indicar el Plan Separe y al menos un artículo para anexar.' }, { status: 400 });
    }

    // Normalizar y validar nuevos items
    const nuevosItemsLimpios = nuevosItemsRaw.map((it: any) => {
      const descripcion = typeof it?.descripcion === 'string' ? it.descripcion.trim() : '';
      const valor = Math.round(Number(String(it?.valor || '0').replace(/\D/g, '')) || Number(it?.valor || 0));
      const cantidad = Math.max(1, Math.round(Number(it?.cantidad || 1)));
      const idProducto = typeof it?.idProducto === 'string' && it.idProducto.trim() ? it.idProducto.trim() : null;
      const fotoUrl = typeof it?.fotoUrl === 'string' && it.fotoUrl.trim() ? it.fotoUrl.trim() : null;
      return {
        descripcion,
        valor: String(valor),
        valorNum: valor,
        cantidad,
        cantidadEntregada: 0,
        idProducto,
        fotoUrl
      };
    }).filter((it: any) => it.descripcion.length > 0 && it.valorNum > 0);

    if (nuevosItemsLimpios.length === 0) {
      return NextResponse.json({ error: 'Todos los artículos anexados deben tener nombre y un valor mayor a $0.' }, { status: 400 });
    }

    if (abonoAdicional > 0 && !METODOS_PERMITIDOS.has(metodoPago)) {
      return NextResponse.json({ error: 'Método de pago inválido para el abono adicional.' }, { status: 400 });
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

      // Lectura de cliente si se usa saldo a favor
      let clienteRef: any = null;
      let clienteSnap: any = null;
      if (abonoAdicional > 0 && metodoPago === 'saldo_interno' && separe.clienteId) {
        clienteRef = adminDb.collection('clientes').doc(separe.clienteId);
        clienteSnap = await transaction.get(clienteRef);
        if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) {
          throw new Error('CLIENTE_NO_AUTORIZADO');
        }
        const saldoCliente = Number(clienteSnap.data()?.deudaTotal || 0);
        if (saldoCliente >= 0 || Math.abs(saldoCliente) < abonoAdicional) {
          throw new Error('SALDO_FAVOR_INSUFICIENTE');
        }
      }

      // Agrupar productos de inventario por ID para leer cada documento una sola vez
      const mapaCantidadesInv = new Map<string, number>();
      for (const it of nuevosItemsLimpios) {
        if (it.idProducto) {
          mapaCantidadesInv.set(it.idProducto, (mapaCantidadesInv.get(it.idProducto) || 0) + it.cantidad);
        }
      }

      const productosLeidos = new Map<string, { ref: any; data: any; cantidadRequerida: number }>();
      for (const [prodId, cantReq] of Array.from(mapaCantidadesInv.entries())) {
        const prodRef = adminDb.collection('inventario').doc(prodId);
        const prodSnap = await transaction.get(prodRef);
        if (prodSnap.exists && prodSnap.data()?.usuarioId === cuentaPrincipalId) {
          const prodData = prodSnap.data() as any;
          productosLeidos.set(prodId, { ref: prodRef, data: prodData, cantidadRequerida: cantReq });
        }
      }

      // 2. CÁLCULOS MATEMÁTICOS EXACTOS
      const itemsActuales = Array.isArray(separe.items) ? [...separe.items] : [];
      const valorAgregado = nuevosItemsLimpios.reduce((acc: number, it: any) => acc + (it.valorNum * it.cantidad), 0);

      const totalBrutoActual = Number(separe.totalBruto || 0) || itemsActuales.reduce((acc: number, it: any) => acc + (Number(it.valor) || 0) * (Number(it.cantidad) || 1), 0);
      const totalActual = Number(separe.total || 0);
      const montoPagadoActual = Number(separe.montoPagado || 0);

      const nuevoTotalBruto = totalBrutoActual + valorAgregado;
      // El descuento original (si lo hubo) se conserva en su monto en pesos sobre los artículos iniciales,
      // de modo que los nuevos artículos suman su valor íntegro sin alterar acuerdos previos.
      const nuevoTotal = totalActual + valorAgregado;
      const maxAbonoPermitido = Math.max(0, nuevoTotal - montoPagadoActual);

      if (abonoAdicional > maxAbonoPermitido) {
        throw new Error('ABONO_EXCEDE_SALDO');
      }

      const nuevoMontoPagado = montoPagadoActual + abonoAdicional;
      const nuevoSaldoPendiente = Math.max(0, nuevoTotal - nuevoMontoPagado);
      const quedaCompletado = nuevoSaldoPendiente === 0 && nuevoTotal > 0;

      const fechaAhora = new Date();
      const autorNombre = usuario.nombreUsuario || decodedToken.email || 'Usuario';

      // Preparar los items que se guardan en separe.items
      const nuevosItemsParaGuardar = nuevosItemsLimpios.map((it: any) => ({
        descripcion: it.descripcion,
        valor: it.valor,
        cantidad: it.cantidad,
        cantidadEntregada: 0,
        idProducto: it.idProducto,
        fotoUrl: it.fotoUrl,
        anexadoPosteriormente: true,
        fechaAnexo: fechaAhora.toISOString(),
        anexadoPor: autorNombre
      }));

      const itemsActualizados = [...itemsActuales, ...nuevosItemsParaGuardar];

      // Agregar fotos nuevas al arreglo general de fotos del separe si vienen con foto
      const fotosActuales = Array.isArray(separe.fotos) ? [...separe.fotos] : [];
      for (const it of nuevosItemsLimpios) {
        if (it.fotoUrl && !fotosActuales.includes(it.fotoUrl) && fotosActuales.length < 8) {
          fotosActuales.push(it.fotoUrl);
        }
      }

      // Actualizar historial de abonos si hubo abono adicional hoy
      const abonosActuales = Array.isArray(separe.abonos) ? [...separe.abonos] : [];
      if (abonoAdicional > 0) {
        abonosActuales.push({
          id: `abn_anx_${Date.now()}`,
          monto: abonoAdicional,
          metodoPago,
          ...(subMetodoPago ? { subMetodoPago } : {}),
          ...(referenciaPago ? { referenciaPago } : {}),
          fecha: fechaAhora,
          registradoPor: autorNombre,
          nota: 'Abono registrado al anexar artículo(s)'
        });
      }

      // Bitácora de novedades interna del separe
      const bitacoraActual = Array.isArray(separe.bitacoraNovedades) ? [...separe.bitacoraNovedades] : [];
      const resumenArticulos = nuevosItemsLimpios
        .map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion} ($${(it.valorNum * it.cantidad).toLocaleString('es-CO')})`)
        .join(', ');

      const textoNovedad = `Se anexó al Plan Separe: ${resumenArticulos}. Valor sumado: +$${valorAgregado.toLocaleString('es-CO')}. ${
        abonoAdicional > 0
          ? `Abono adicional recibido hoy: $${abonoAdicional.toLocaleString('es-CO')} (${metodoPago}).`
          : `Respaldado con el abono acumulado ($${montoPagadoActual.toLocaleString('es-CO')}) sin cobro adicional hoy.`
      } Nuevo total: $${nuevoTotal.toLocaleString('es-CO')} | Nuevo saldo pendiente: $${nuevoSaldoPendiente.toLocaleString('es-CO')}.${
        notaOpcional ? ` Nota: ${notaOpcional}` : ''
      }`;

      bitacoraActual.push({
        id: `nov_anx_${Date.now()}`,
        nota: textoNovedad,
        texto: textoNovedad,
        fecha: fechaAhora,
        autor: autorNombre,
        tipo: 'anexo_articulo'
      });

      // 3. TODAS LAS ESCRITURAS
      // 3.1 Descontar stock de productos inventariables
      for (const [, infoProd] of Array.from(productosLeidos.entries())) {
        if (infoProd.data.tipoProducto !== 'servicio' && infoProd.data.inventariable !== false) {
          transaction.update(infoProd.ref, {
            stock: Number(infoProd.data.stock || 0) - infoProd.cantidadRequerida
          });
        }
      }

      // 3.2 Si usó saldo a favor para el abono adicional, descontarlo del cliente
      if (abonoAdicional > 0 && metodoPago === 'saldo_interno' && clienteRef && clienteSnap) {
        const saldoCliente = Number(clienteSnap.data()?.deudaTotal || 0);
        transaction.update(clienteRef, {
          deudaTotal: saldoCliente + abonoAdicional,
          fechaUltimoMovimiento: fechaAhora
        });
      }

      // 3.3 Registrar movimiento(s) en la colección 'movimientos'
      let movimientoId: string | undefined;
      if (abonoAdicional > 0) {
        const movAbonoRef = adminDb.collection('movimientos').doc();
        movimientoId = movAbonoRef.id;
        transaction.create(movAbonoRef, {
          usuarioId: cuentaPrincipalId,
          clienteId: separe.clienteId || null,
          clienteNombre: separe.clienteNombre || 'Cliente',
          tipo: 'abono',
          subtipo: 'abono_separe',
          monto: abonoAdicional,
          descripcion: `Abono Plan Separe (+ Anexo: ${resumenArticulos}) - ${separe.clienteNombre || 'Cliente'}`,
          detalles: nuevosItemsParaGuardar,
          metodoPago,
          ...(subMetodoPago ? { subMetodoPago } : {}),
          ...(referenciaPago ? { referenciaPago } : {}),
          fecha: fechaAhora,
          registradoPor: autorNombre,
          idSepareOrigen: separeId,
          esPublico: true
        });
      } else {
        // Si abonoAdicional === 0, registramos movimiento informativo tipo 'separe' que NO altera el efectivo en caja
        const movAnexoRef = adminDb.collection('movimientos').doc();
        movimientoId = movAnexoRef.id;
        transaction.create(movAnexoRef, {
          usuarioId: cuentaPrincipalId,
          clienteId: separe.clienteId || null,
          clienteNombre: separe.clienteNombre || 'Cliente',
          tipo: 'separe',
          subtipo: 'anexo_item_separe',
          monto: valorAgregado,
          descripcion: `Artículo(s) anexado(s) a Plan Separe activo (${resumenArticulos}) respaldado con abono previo. Nuevo saldo: $${nuevoSaldoPendiente.toLocaleString('es-CO')}`,
          detalles: nuevosItemsParaGuardar,
          metodoPago: 'separe',
          fecha: fechaAhora,
          registradoPor: autorNombre,
          idSepareOrigen: separeId,
          esPublico: true
        });
      }

      // 3.4 Actualizar el documento de Plan Separe
      const datosActualizacion: any = {
        items: itemsActualizados,
        fotos: fotosActuales,
        totalBruto: nuevoTotalBruto,
        total: nuevoTotal,
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente,
        abonos: abonosActuales,
        bitacoraNovedades: bitacoraActual,
        fechaModificado: fechaAhora
      };

      if (quedaCompletado) {
        datosActualizacion.estado = 'completado';
        datosActualizacion.fechaCompletado = fechaAhora;
      }

      transaction.update(separeRef, datosActualizacion);

      return {
        separeId,
        movimientoId,
        valorAgregado,
        abonoAdicional,
        totalAnterior: totalActual,
        saldoAnterior: Math.max(0, totalActual - montoPagadoActual),
        nuevoTotal,
        nuevoTotalBruto,
        nuevoMontoPagado,
        nuevoSaldoPendiente,
        quedaCompletado,
        itemsActualizados,
        abonosActualizados: abonosActuales,
        bitacoraActualizada: bitacoraActual,
        fotosActualizadas: fotosActuales,
        nuevosItemsAnexados: nuevosItemsParaGuardar
      };
    });

    return NextResponse.json({
      ok: true,
      mensaje: 'Artículo(s) anexado(s) exitosamente al Plan Separe.',
      ...resultado
    });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      SEPARE_NO_EXISTE: { status: 404, text: 'El Plan Separe no existe.' },
      SEPARE_NO_AUTORIZADO: { status: 403, text: 'No tienes permiso sobre este Plan Separe.' },
      SEPARE_CANCELADO: { status: 400, text: 'No se pueden agregar artículos a un Plan Separe cancelado.' },
      SEPARE_COMPLETADO: { status: 400, text: 'Este Plan Separe ya fue completado y entregado.' },
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'El cliente no pertenece a tu negocio.' },
      SALDO_FAVOR_INSUFICIENTE: { status: 400, text: 'El cliente no tiene suficiente Saldo a Favor disponible.' },
      ABONO_EXCEDE_SALDO: { status: 400, text: 'El abono adicional no puede superar el nuevo saldo pendiente del Plan Separe.' }
    };
    if (error?.message?.startsWith('SIN_STOCK:')) {
      return NextResponse.json({ error: `Sin stock disponible en inventario para "${error.message.slice(10)}".` }, { status: 409 });
    }
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error al anexar artículo al separe:', error);
    return NextResponse.json({ error: 'Ocurrió un error al anexar el artículo al Plan Separe.' }, { status: 500 });
  }
}
