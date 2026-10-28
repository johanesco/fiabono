import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Endpoint de Anulación de Ventas y Fiados por Error (Reversión Atómica).
 * 
 * Acciones atómicas en una sola transacción:
 * 1. Valida permisos: Solo administradores (o usuarios autorizados).
 * 2. Valida pertenencia: Que el movimiento pertenezca a la cuenta principal.
 * 3. Valida estado: No permite re-anular si ya está anulado.
 * 4. Reversa Stock: Reintegra al inventario las cantidades vendidas (si tenían productoId).
 * 5. Reversa Cartera: Si fue una venta fiada o con saldo pendiente, descuenta la deuda al cliente.
 * 6. Marca el movimiento como anulado: { anulado: true, motivoAnulacion, fechaAnulacion, anuladoPor }.
 * 7. Registra un evento de auditoría contable.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const adminDb = getAdminDb();

    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 });
    }
    const usuario = usuarioSnap.data() as any;
    const esAdmin = usuario.rol !== 'cajero';
    const cuentaPrincipalId = esAdmin ? decodedToken.uid : usuario.adminId;

    if (!cuentaPrincipalId) {
      return NextResponse.json({ error: 'Cuenta principal no identificada.' }, { status: 403 });
    }

    // Regla de seguridad estricta: Cajeros no pueden anular ventas directamente a menos que tengan permiso explícito
    const puedeAnularVentas = esAdmin || usuario.permisos?.anularVentas === true;
    if (!puedeAnularVentas) {
      return NextResponse.json({ error: 'No tienes permisos de administrador para anular ventas.' }, { status: 403 });
    }

    const body = await request.json();
    const movimientoId = typeof body.movimientoId === 'string' ? body.movimientoId.trim() : '';
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : 'Venta registrada por error';

    if (!movimientoId) {
      return NextResponse.json({ error: 'El ID de la venta es obligatorio.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const movRef = adminDb.collection('movimientos').doc(movimientoId);
      const movSnap = await transaction.get(movRef);

      if (!movSnap.exists) {
        throw new Error('MOVIMIENTO_NO_EXISTE');
      }

      const mov = movSnap.data() as any;

      if (mov.usuarioId !== cuentaPrincipalId) {
        throw new Error('NO_AUTORIZADO');
      }

      if (mov.tipo !== 'venta' && mov.tipo !== 'fiado') {
        throw new Error('TIPO_INVALIDO');
      }

      if (mov.anulado === true) {
        throw new Error('YA_ANULADO');
      }

      if (mov.tieneDevolucion === true || (Array.isArray(mov.articulosDevueltos) && mov.articulosDevueltos.length > 0)) {
        throw new Error('TIENE_DEVOLUCION');
      }

      // 1. Revertir inventario si la venta tenía productos vinculados
      const detalles = Array.isArray(mov.detalles) ? mov.detalles : [];
      const productosAfectados: Array<{ id: string; cantidad: number; nombre: string }> = [];

      for (const d of detalles) {
        const prodId = d.productoId || d.id;
        const cant = Number(d.cantidad) || 0;
        if (prodId && cant > 0) {
          const prodRef = adminDb.collection('productos').doc(prodId);
          const prodSnap = await transaction.get(prodRef);
          if (prodSnap.exists) {
            const prodData = prodSnap.data() as any;
            if (prodData.usuarioId === cuentaPrincipalId) {
              const stockActual = Number(prodData.stock) || 0;
              transaction.update(prodRef, {
                stock: stockActual + cant,
                actualizadoEl: new Date()
              });
              productosAfectados.push({
                id: prodId,
                cantidad: cant,
                nombre: prodData.nombre || d.descripcion || 'Producto'
              });
            }
          }
        }
      }

      // 2. Revertir saldo en cartera de cliente si fue fiado o tuvo fiado restante
      let clienteAfectado: { id: string; nombre: string; saldoAnterior: number; saldoNuevo: number } | null = null;
      const clienteId = mov.clienteId;
      const esFiado = mov.tipo === 'fiado' || mov.metodoPago === 'fiado';
      const montoFiado = Number(mov.montoFiado || (esFiado ? mov.monto : 0)) || 0;

      if (clienteId && clienteId !== 'mostrador' && montoFiado > 0) {
        const cliRef = adminDb.collection('clientes').doc(clienteId);
        const cliSnap = await transaction.get(cliRef);
        if (cliSnap.exists) {
          const cliData = cliSnap.data() as any;
          if (cliData.usuarioId === cuentaPrincipalId) {
            const deudaActual = Number(cliData.deudaTotal) || 0;
            const nuevoSaldo = deudaActual - montoFiado;
            transaction.update(cliRef, {
              deudaTotal: nuevoSaldo,
              fechaUltimoMovimiento: new Date()
            });
            clienteAfectado = {
              id: clienteId,
              nombre: cliData.nombre || 'Cliente',
              saldoAnterior: deudaActual,
              saldoNuevo: nuevoSaldo
            };
          }
        }
      }

      // 3. Marcar el movimiento como anulado
      const datosAnulacion = {
        anulado: true,
        motivoAnulacion: motivo,
        fechaAnulacion: new Date(),
        anuladoPor: usuario.nombre || usuario.displayName || usuario.email || 'Administrador',
        anuladoPorUid: decodedToken.uid
      };

      transaction.update(movRef, datosAnulacion);

      // 3.1 Registrar movimiento cronológico de Anulación en la colección principal para evidencia en el Historial General
      const movAnulacionRef = adminDb.collection('movimientos').doc();
      const nombreUsuarioOperador = usuario.nombre || usuario.displayName || usuario.email || 'Administrador';
      transaction.set(movAnulacionRef, {
        usuarioId: cuentaPrincipalId,
        clienteId: mov.clienteId || 'mostrador',
        clienteNombre: mov.clienteNombre || (mov.clienteId === 'mostrador' ? 'Consumidor Final' : 'Cliente'),
        tipo: 'anulacion',
        subtipo: mov.tipo === 'fiado' ? 'anulacion_fiado' : 'anulacion_venta',
        monto: mov.monto || 0,
        descripcion: `Anulación de ${mov.tipo === 'fiado' ? 'fiado' : 'venta'}: ${motivo}`,
        motivoAnulacion: motivo,
        movimientoOrigenId: movimientoId,
        registradoPor: nombreUsuarioOperador,
        anuladoPor: nombreUsuarioOperador,
        anuladoPorUid: decodedToken.uid,
        fecha: new Date(),
        metodoPago: 'ajuste_contable',
        detalles: mov.detalles || []
      });

      // 4. Si el movimiento generó un fiado paralelo (ej. venta mixta contado + fiado), buscar y anular la contraparte
      if (mov.movimientoFiadoId) {
        const contraparteRef = adminDb.collection('movimientos').doc(mov.movimientoFiadoId);
        const contraSnap = await transaction.get(contraparteRef);
        if (contraSnap.exists && contraSnap.data()?.usuarioId === cuentaPrincipalId) {
          transaction.update(contraparteRef, datosAnulacion);
        }
      }

      // 5. Registrar entrada de auditoría contable
      const logRef = adminDb.collection('auditoria_anulaciones').doc();
      transaction.create(logRef, {
        usuarioId: cuentaPrincipalId,
        movimientoId,
        tipo: mov.tipo,
        monto: mov.monto,
        clienteId: mov.clienteId || null,
        clienteNombre: mov.clienteNombre || null,
        motivo,
        anuladoPor: usuario.nombre || usuario.email || 'Administrador',
        anuladoPorUid: decodedToken.uid,
        productosReintegrados: productosAfectados,
        clienteSaldoAjustado: clienteAfectado,
        fecha: new Date()
      });

      return {
        movimientoId,
        monto: mov.monto,
        productosReintegrados: productosAfectados.length,
        clienteAjustado: clienteAfectado !== null,
        nuevoSaldoCliente: clienteAfectado ? clienteAfectado.saldoNuevo : undefined
      };
    });

    return NextResponse.json({
      ok: true,
      mensaje: '¡Venta anulada con éxito! El inventario y saldos han sido restaurados correctamente.',
      resultado
    });

  } catch (error: any) {
    console.error('Error al anular venta:', error);
    const codigosError: Record<string, { status: number; msg: string }> = {
      MOVIMIENTO_NO_EXISTE: { status: 404, msg: 'La venta o fiado que intentas anular no existe.' },
      NO_AUTORIZADO: { status: 403, msg: 'No tienes autorización sobre esta transacción.' },
      TIPO_INVALIDO: { status: 400, msg: 'Solo se pueden anular movimientos de tipo venta o fiado.' },
      YA_ANULADO: { status: 400, msg: 'Esta venta ya se encuentra anulada.' },
      TIENE_DEVOLUCION: { status: 400, msg: 'Esta venta ya tiene devoluciones procesadas. No puede anularse para evitar duplicar el reingreso de mercancía.' }
    };

    const coincidencia = codigosError[error.message];
    if (coincidencia) {
      return NextResponse.json({ error: coincidencia.msg }, { status: coincidencia.status });
    }

    return NextResponse.json({ error: 'Ocurrió un error inesperado al anular la venta.' }, { status: 500 });
  }
}
