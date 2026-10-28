import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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

    const body = await request.json();
    const movimientoId = typeof body.movimientoId === 'string' ? body.movimientoId.trim() : '';
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : 'Abono registrado por error';

    if (!movimientoId) {
      return NextResponse.json({ error: 'ID del movimiento a anular es requerido.' }, { status: 400 });
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
      if (mov.tipo !== 'abono') {
        throw new Error('SOLO_ABONOS');
      }
      if (mov.anulado === true) {
        throw new Error('YA_ANULADO');
      }

      const monto = Number(mov.monto) || 0;
      const separeId = mov.idSepareOrigen || mov.separeId;

      // 1. Reversión para Plan Separe
      if (separeId) {
        const sepRef = adminDb.collection('separes').doc(separeId);
        const sepSnap = await transaction.get(sepRef);
        if (sepSnap.exists) {
          const sepData = sepSnap.data() as any;
          const nuevoSaldoPendiente = (Number(sepData.saldoPendiente) || 0) + monto;
          const nuevoMontoPagado = Math.max(0, (Number(sepData.montoPagado) || 0) - monto);

          const abonosActuales = Array.isArray(sepData.abonos) ? sepData.abonos : [];
          let marcado = false;
          const abonosActualizados = abonosActuales.map((ab: any) => {
            if (!marcado && (ab.id === movimientoId || Number(ab.monto) === monto)) {
              marcado = true;
              return { ...ab, anulado: true, motivoAnulacion: motivo, fechaAnulacion: new Date() };
            }
            return ab;
          });

          transaction.update(sepRef, {
            saldoPendiente: nuevoSaldoPendiente,
            montoPagado: nuevoMontoPagado,
            abonos: abonosActualizados,
            estado: nuevoSaldoPendiente > 0 && sepData.estado === 'completado' ? 'activo' : sepData.estado,
            actualizadoEn: FieldValue.serverTimestamp()
          });
        }
      } 
      // 2. Reversión para Cartera / Fiado general de cliente
      else if (mov.clienteId) {
        const clienteRef = adminDb.collection('clientes').doc(mov.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (clienteSnap.exists) {
          const clienteData = clienteSnap.data() as any;
          const deudaActual = Number(clienteData.deudaTotal) || 0;
          const nuevaDeuda = deudaActual + monto;

          transaction.update(clienteRef, {
            deudaTotal: nuevaDeuda,
            actualizadoEn: FieldValue.serverTimestamp()
          });
        }
      }

      // 3. Marcar el movimiento original como anulado
      transaction.update(movRef, {
        anulado: true,
        motivoAnulacion: motivo,
        anuladoEn: FieldValue.serverTimestamp(),
        anuladoPorUid: decodedToken.uid,
        anuladoPorNombre: usuario.nombre || usuario.nombreUsuario || 'Usuario'
      });

      // Crear movimiento cronológico de Anulación de Abono para evidencia en el Historial General
      const movAnulacionRef = adminDb.collection('movimientos').doc();
      const nombreUsuarioOperador = usuario.nombre || usuario.nombreUsuario || 'Usuario';
      transaction.set(movAnulacionRef, {
        usuarioId: cuentaPrincipalId,
        clienteId: mov.clienteId || 'mostrador',
        clienteNombre: mov.clienteNombre || 'Cliente',
        tipo: 'anulacion',
        subtipo: 'anulacion_abono',
        monto: monto,
        descripcion: `Anulación de abono: ${motivo}`,
        motivoAnulacion: motivo,
        movimientoOrigenId: movimientoId,
        registradoPor: nombreUsuarioOperador,
        anuladoPor: nombreUsuarioOperador,
        anuladoPorUid: decodedToken.uid,
        fecha: new Date(),
        metodoPago: 'ajuste_contable',
        separeId: separeId || null
      });

      return {
        monto,
        clienteNombre: mov.clienteNombre || 'Cliente',
        esSepare: Boolean(separeId)
      };
    });

    return NextResponse.json({
      ok: true,
      mensaje: `Abono de $${resultado.monto.toLocaleString('es-CO')} anulado con éxito. El saldo fue restaurado.`,
      resultado
    });
  } catch (error: any) {
    console.error('Error al anular abono:', error);
    if (error?.message === 'MOVIMIENTO_NO_EXISTE') return NextResponse.json({ error: 'El abono no existe en el sistema.' }, { status: 404 });
    if (error?.message === 'SOLO_ABONOS') return NextResponse.json({ error: 'Solo se pueden anular transacciones de tipo abono.' }, { status: 400 });
    if (error?.message === 'YA_ANULADO') return NextResponse.json({ error: 'Este abono ya se encuentra anulado.' }, { status: 400 });
    if (error?.message === 'NO_AUTORIZADO') return NextResponse.json({ error: 'No tienes permiso para anular este movimiento.' }, { status: 403 });
    return NextResponse.json({ error: error?.message || 'Error interno al anular el abono.' }, { status: 500 });
  }
}
