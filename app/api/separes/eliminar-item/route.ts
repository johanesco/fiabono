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
    const tienePermisoSepare = esAdmin || usuario.permisos?.planSepare === true;
    if (!cuentaPrincipalId || !tienePermisoSepare) {
      return NextResponse.json({ error: 'No tienes permiso para modificar planes separe.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId.trim() : '';
    const itemIndex = typeof body.itemIndex === 'number' ? body.itemIndex : -1;
    const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : 'Agregado por error humano';
    const destinoExcedente = body.destinoExcedente === 'efectivo' ? 'efectivo' : 'saldo_favor';

    if (!separeId || itemIndex < 0) {
      return NextResponse.json({ error: 'Parámetros inválidos para retirar el artículo.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');
      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_COMPLETADO');

      const items = Array.isArray(separe.items) ? [...separe.items] : [];
      if (items.length === 0) {
        throw new Error('SIN_ITEMS');
      }
      if (itemIndex >= items.length) {
        throw new Error('INDICE_ITEM_INVALIDO');
      }

      const esUltimoItem = items.length === 1;
      const itemRetirado = items[itemIndex];
      const cantTotalItem = Number(itemRetirado.cantidad || 1);
      const cantEntregada = Number(itemRetirado.cantidadEntregada || 0);

      // Si ya fue entregado físicamente, no se puede retirar sin devolución previa
      if (cantEntregada > 0) {
        throw new Error('ITEM_YA_ENTREGADO');
      }

      // Proporción de descuento si el separe original tuvo descuento
      const totalBruto = Number(separe.totalBruto || 0) || items.reduce((acc, it) => acc + (Number(it.valor) || 0) * (it.cantidad || 1), 0);
      const montoDescuento = Number(separe.montoDescuento || 0);
      const factorDescuento = totalBruto > 0 && montoDescuento > 0 ? (1 - (montoDescuento / totalBruto)) : 1;

      const valorUnitarioBruto = Number(itemRetirado.valor || 0);
      const valorBrutoRetirado = valorUnitarioBruto * cantTotalItem;
      const valorNetoRetirado = Math.round(valorBrutoRetirado * factorDescuento);

      const montoPagadoActual = Number(separe.montoPagado || 0);
      let nuevoTotal = 0;
      let nuevoTotalBruto = 0;
      let nuevoMontoPagado = 0;
      let nuevoSaldoPendiente = 0;
      let montoExcedente = 0;

      if (esUltimoItem) {
        // Al retirar el único artículo, el total pasa a 0 y todo lo abonado es excedente a favor del cliente
        nuevoTotal = 0;
        nuevoTotalBruto = 0;
        nuevoMontoPagado = 0;
        nuevoSaldoPendiente = 0;
        montoExcedente = montoPagadoActual;
      } else {
        nuevoTotal = Math.max(0, Number(separe.total || 0) - valorNetoRetirado);
        nuevoTotalBruto = Math.max(0, totalBruto - valorBrutoRetirado);

        if (montoPagadoActual > nuevoTotal) {
          montoExcedente = montoPagadoActual - nuevoTotal;
          nuevoMontoPagado = nuevoTotal;
          nuevoSaldoPendiente = 0;
        } else {
          nuevoMontoPagado = montoPagadoActual;
          nuevoSaldoPendiente = Math.max(0, nuevoTotal - montoPagadoActual);
        }
      }

      // Reintegrar stock a inventario si el producto pertenecía a inventario
      const productoId = itemRetirado.idProducto || itemRetirado.productoId;
      if (productoId) {
        const prodRef = adminDb.collection('inventario').doc(productoId);
        const prodSnap = await transaction.get(prodRef);
        if (prodSnap.exists && prodSnap.data()?.usuarioId === cuentaPrincipalId) {
          const prodData = prodSnap.data() as any;
          if (prodData.tipoProducto !== 'servicio' && prodData.inventariable !== false) {
            transaction.update(prodRef, {
              stock: Number(prodData.stock || 0) + cantTotalItem
            });
          }
        }
      }

      // Si hay excedente pagado, gestionarlo según la elección
      let clienteRef: any = null;
      let clienteSnap: any = null;
      if (montoExcedente > 0 && separe.clienteId) {
        const cRef = adminDb.collection('clientes').doc(separe.clienteId);
        clienteRef = cRef;
        clienteSnap = await transaction.get(cRef);

        if (destinoExcedente === 'saldo_favor' && clienteSnap.exists) {
          const saldoClienteActual = Number(clienteSnap.data()?.deudaTotal || 0);
          transaction.update(clienteRef, {
            deudaTotal: saldoClienteActual - montoExcedente, // Se resta para aumentar saldo a favor o reducir deuda
            fechaUltimoMovimiento: new Date()
          });

          // Registrar movimiento de saldo a favor asignado
          const movAbonoRef = adminDb.collection('movimientos').doc();
          transaction.create(movAbonoRef, {
            usuarioId: cuentaPrincipalId,
            clienteId: separe.clienteId,
            clienteNombre: separe.clienteNombre || 'Cliente',
            tipo: 'abono',
            subtipo: 'excedente_separe_saldo_favor',
            monto: montoExcedente,
            descripcion: `Saldo a favor por corrección de artículo retirado en Separe: ${itemRetirado.descripcion || 'Producto'}`,
            metodoPago: 'saldo_interno',
            fecha: new Date(),
            registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
            idSepareOrigen: separeId,
            esPublico: true
          });
        } else if (destinoExcedente === 'efectivo') {
          // Devolución física de efectivo de la gaveta: genera egreso para cuadre de caja
          const movEgresoRef = adminDb.collection('movimientos').doc();
          transaction.create(movEgresoRef, {
            usuarioId: cuentaPrincipalId,
            clienteId: separe.clienteId,
            clienteNombre: separe.clienteNombre || 'Cliente',
            tipo: 'egreso',
            categoria: 'devolucion_separe',
            concepto: `Devolución excedente en efectivo por corrección en Separe: ${itemRetirado.descripcion || 'Producto'}`,
            monto: montoExcedente,
            descripcion: `Devolución de $${montoExcedente.toLocaleString('es-CO')} en efectivo por retiro de artículo agregado por error (${motivo})`,
            metodoPago: 'efectivo',
            fecha: new Date(),
            registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
            idSepareOrigen: separeId,
            esPublico: true
          });
        }
      }

      // Filtrar items del separe (remover el artículo retirado)
      const itemsFiltrados = items.filter((_, idx) => idx !== itemIndex);

      // Bitácora de novedades interna del separe
      const bitacoraActual = Array.isArray(separe.bitacoraNovedades) ? [...separe.bitacoraNovedades] : [];
      const fechaAhora = new Date();
      const novedadTexto = `Producto "${itemRetirado.descripcion}" retirado (${motivo}). Valor: $${valorNetoRetirado.toLocaleString('es-CO')}. ${esUltimoItem ? 'El plan separe fue anulado al quedarse sin artículos.' : `Nuevo total: $${nuevoTotal.toLocaleString('es-CO')}.`}${montoExcedente > 0 ? ` Excedente de $${montoExcedente.toLocaleString('es-CO')} asignado a ${destinoExcedente === 'efectivo' ? 'efectivo devuelto' : 'saldo a favor'}.` : ''}`;

      bitacoraActual.push({
        id: `nov_ret_${Date.now()}`,
        nota: novedadTexto,
        texto: novedadTexto,
        fecha: fechaAhora,
        autor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        tipo: 'correccion_articulo'
      });

      // Registro histórico de items retirados para trazabilidad interna
      const itemsRetiradosActual = Array.isArray(separe.itemsRetirados) ? [...separe.itemsRetirados] : [];
      itemsRetiradosActual.push({
        ...itemRetirado,
        fechaRetiro: fechaAhora,
        retiradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        motivo,
        valorNetoRetirado,
        excedenteGenerado: montoExcedente,
        destinoExcedente: montoExcedente > 0 ? destinoExcedente : null,
        separeAnulado: esUltimoItem
      });

      // Registrar movimiento de auditoría en el Historial General (colección 'movimientos')
      const movAjusteRef = adminDb.collection('movimientos').doc();
      transaction.create(movAjusteRef, {
        usuarioId: cuentaPrincipalId,
        clienteId: separe.clienteId || null,
        clienteNombre: separe.clienteNombre || 'Cliente',
        tipo: 'separe',
        subtipo: 'retiro_item_separe',
        monto: valorNetoRetirado,
        descripcion: `Artículo "${itemRetirado.descripcion}" retirado de Plan Separe (${motivo}). ${esUltimoItem ? 'Plan Separe anulado.' : `Nuevo saldo: $${nuevoSaldoPendiente.toLocaleString('es-CO')}`}`,
        metodoPago: 'saldo_interno',
        fecha: fechaAhora,
        registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        idSepareOrigen: separeId,
        esPublico: true,
        detalles: [{
          descripcion: itemRetirado.descripcion,
          cantidad: cantTotalItem,
          valor: valorNetoRetirado,
          motivo: motivo
        }]
      });

      // Actualizar el documento de Separe
      const datosActualizacionSepare: any = {
        items: itemsFiltrados,
        total: nuevoTotal,
        totalBruto: nuevoTotalBruto,
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente,
        bitacoraNovedades: bitacoraActual,
        itemsRetirados: itemsRetiradosActual,
        fechaModificado: fechaAhora
      };

      if (esUltimoItem) {
        datosActualizacionSepare.estado = 'cancelado';
        datosActualizacionSepare.motivoCancelacion = `Anulado por retiro de único artículo (${motivo})`;
        datosActualizacionSepare.fechaCancelacion = fechaAhora;
      }

      transaction.update(separeRef, datosActualizacionSepare);

      return {
        separeId,
        itemRetirado,
        esUltimoItem,
        separeCancelado: esUltimoItem,
        nuevoTotal,
        nuevoSaldoPendiente,
        nuevoMontoPagado,
        montoExcedente,
        destinoExcedente,
        itemsActualizados: itemsFiltrados
      };
    });

    return NextResponse.json({
      ok: true,
      mensaje: resultado.esUltimoItem
        ? 'Único artículo retirado. El plan separe ha sido anulado exitosamente.'
        : 'Artículo retirado y plan separe corregido exitosamente.',
      ...resultado
    });
  } catch (error: any) {
    console.error('Error al retirar artículo del separe:', error);
    const mensaje = error.message;
    if (mensaje === 'ITEM_YA_ENTREGADO') {
      return NextResponse.json({ error: 'Este artículo ya fue entregado físicamente al cliente. No se puede retirar sin registrar una devolución previa.' }, { status: 400 });
    }
    if (mensaje === 'INDICE_ITEM_INVALIDO') {
      return NextResponse.json({ error: 'El artículo seleccionado ya no existe en el separe.' }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Error interno al corregir el separe.' }, { status: 500 });
  }
}
