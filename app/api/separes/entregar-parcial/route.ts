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
    const tienePermisoEntrega = esAdmin || usuario.permisos?.planSepare === true || usuario.permisos?.ventaDirecta === true || usuario.permisos?.abonar === true;
    if (!cuentaPrincipalId || !tienePermisoEntrega) {
      return NextResponse.json({ error: 'No tienes permiso para registrar entregas de Separe.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId.trim() : '';
    const entregas = Array.isArray(body.entregas) ? body.entregas : []; // Array<{ index: number, cantidad: number }>

    if (!separeId || entregas.length === 0) {
      return NextResponse.json({ error: 'Debes indicar el separe y al menos un producto a entregar.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');
      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_YA_COMPLETADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');

      const items = Array.isArray(separe.items) ? [...separe.items] : [];
      if (items.length === 0) throw new Error('SEPARE_SIN_ITEMS');

      // Calcular proporción de descuento si hubo descuento general
      const totalBruto = Number(separe.totalBruto || 0) || items.reduce((acc, it) => acc + (Number(it.valor) || 0) * (it.cantidad || 1), 0);
      const montoDescuento = Number(separe.montoDescuento || 0);
      const factorDescuento = totalBruto > 0 && montoDescuento > 0 ? (1 - (montoDescuento / totalBruto)) : 1;

      // Calcular valor ya entregado previamente
      const valorYaEntregadoPreviamente = Number(separe.valorEntregado || 0);
      const montoPagado = Number(separe.montoPagado || 0);
      const abonoDisponible = Math.max(0, montoPagado - valorYaEntregadoPreviamente);

      let valorAEntregarHoy = 0;
      const itemsEntregadosHoy: any[] = [];

      for (const entrega of entregas) {
        const idx = Number(entrega.index);
        const cant = Number(entrega.cantidad);
        if (isNaN(idx) || idx < 0 || idx >= items.length) throw new Error('INDICE_ITEM_INVALIDO');
        if (isNaN(cant) || cant <= 0) throw new Error('CANTIDAD_ENTREGA_INVALIDA');

        const itemActual = items[idx];
        const cantTotal = Number(itemActual.cantidad || 1);
        const cantYaEntregada = Number(itemActual.cantidadEntregada || 0);
        const cantDisponible = cantTotal - cantYaEntregada;

        if (cant > cantDisponible) throw new Error('CANTIDAD_EXCEDE_DISPONIBLE');

        const valorUnitarioBruto = Number(itemActual.valor || 0);
        const valorUnitarioNeto = Math.round(valorUnitarioBruto * factorDescuento);
        const subtotalItemHoy = valorUnitarioNeto * cant;

        valorAEntregarHoy += subtotalItemHoy;

        // Actualizar item
        const nuevaCantEntregada = cantYaEntregada + cant;
        items[idx] = {
          ...itemActual,
          cantidadEntregada: nuevaCantEntregada,
          entregadoCompleto: nuevaCantEntregada >= cantTotal,
          ultimaFechaEntrega: new Date()
        };

        itemsEntregadosHoy.push({
          descripcion: itemActual.descripcion || 'Artículo',
          cantidad: cant,
          valorUnitario: valorUnitarioNeto,
          valor: subtotalItemHoy
        });
      }

      // Validar que el dinero abonado respalde estrictamente el valor a retirar
      if (valorAEntregarHoy > abonoDisponible) {
        throw new Error('ABONO_INSUFICIENTE');
      }

      const nuevoValorEntregadoTotal = valorYaEntregadoPreviamente + valorAEntregarHoy;

      // Verificar si ya se entregó el 100% de todos los artículos
      const todosEntregados = items.every((it) => Number(it.cantidadEntregada || 0) >= Number(it.cantidad || 1));
      const saldoPendienteActual = Number(separe.saldoPendiente || 0);
      const esCierreTotal = todosEntregados && saldoPendienteActual <= 0;

      // Crear movimiento de entrega
      const movimientoRef = adminDb.collection('movimientos').doc();
      const responsable = usuario.nombreUsuario || decodedToken.email || 'Usuario';

      transaction.create(movimientoRef, {
        clienteId: separe.clienteId || null,
        clienteNombre: separe.clienteNombre || 'Cliente',
        usuarioId: cuentaPrincipalId,
        tipo: 'entrega_separe',
        origen: 'separe',
        subtipo: esCierreTotal ? 'total' : 'parcial',
        monto: 0,
        valorMercancia: valorAEntregarHoy,
        descripcion: esCierreTotal
          ? `Entrega Total Plan Separe - ${separe.clienteNombre || 'Cliente'}`
          : `Entrega Parcial Plan Separe - ${separe.clienteNombre || 'Cliente'}`,
        detalles: itemsEntregadosHoy,
        fecha: new Date(),
        registradoPor: responsable,
        metodoPago: 'separe_liquidado',
        idSepareOrigen: separeId,
        esPublico: true
      });

      // Actualizar registro del separe
      const dataUpdate: any = {
        items,
        valorEntregado: nuevoValorEntregadoTotal,
        ultimaEntregaFecha: new Date(),
        ultimaEntregaPor: responsable
      };

      if (esCierreTotal) {
        dataUpdate.estado = 'completado';
        dataUpdate.fechaCompletado = new Date();
        dataUpdate.idTransaccionCierre = movimientoRef.id;
      }

      transaction.update(separeRef, dataUpdate);

      return {
        movimientoId: movimientoRef.id,
        esCierreTotal,
        itemsEntregadosHoy,
        valorAEntregarHoy,
        nuevoValorEntregadoTotal,
        itemsActualizados: items
      };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      SEPARE_NO_EXISTE: { status: 404, text: 'El Plan Separe no existe.' },
      SEPARE_NO_AUTORIZADO: { status: 403, text: 'El Plan Separe no pertenece a tu negocio.' },
      SEPARE_YA_COMPLETADO: { status: 409, text: 'El Plan Separe ya fue entregado en su totalidad.' },
      SEPARE_CANCELADO: { status: 409, text: 'El Plan Separe está cancelado.' },
      SEPARE_SIN_ITEMS: { status: 400, text: 'El separe no contiene artículos válidos.' },
      INDICE_ITEM_INVALIDO: { status: 400, text: 'Artículo seleccionado no válido.' },
      CANTIDAD_ENTREGA_INVALIDA: { status: 400, text: 'Cantidad a entregar inválida.' },
      CANTIDAD_EXCEDE_DISPONIBLE: { status: 400, text: 'La cantidad seleccionada supera la cantidad pendiente por entregar.' },
      ABONO_INSUFICIENTE: { status: 400, text: 'El abono libre disponible no alcanza para respaldar los productos seleccionados.' }
    };
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error en entrega parcial de Separe:', error);
    return NextResponse.json({ error: 'No se pudo registrar la entrega parcial.' }, { status: 500 });
  }
}
