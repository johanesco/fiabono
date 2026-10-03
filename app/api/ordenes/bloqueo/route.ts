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

    const usuarioData = usuarioSnap.data() || {};
    const esAdmin = usuarioData.tipoUsuario === 'principal' || !usuarioData.rol || usuarioData.rol !== 'cajero';
    const cuentaPrincipalId = esAdmin ? decodedToken.uid : (usuarioData.adminId || usuarioData.cuentaPrincipalId || '');
    if (!cuentaPrincipalId) return NextResponse.json({ error: 'Cuenta no autorizada.' }, { status: 403 });

    const nombreUsuario = (usuarioData.nombreUsuario || usuarioData.nombre || (esAdmin ? 'Administrador' : 'Colaborador')).trim();

    const body = await request.json();
    const ordenId = typeof body.ordenId === 'string' ? body.ordenId.trim() : '';
    const accion = body.accion as 'bloquear' | 'liberar' | 'heartbeat';
    const sessId = typeof body.sessionId === 'string' && body.sessionId.trim() ? body.sessionId.trim() : null;

    if (!ordenId || !['bloquear', 'liberar', 'heartbeat'].includes(accion)) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const ordenRef = adminDb.collection('ordenes_pendientes').doc(ordenId);
      const ordenSnap = await transaction.get(ordenRef);
      if (!ordenSnap.exists) throw new Error('ORDEN_NO_EXISTE');
      const orden = ordenSnap.data() as any;
      if (orden.usuarioId !== cuentaPrincipalId) throw new Error('ORDEN_NO_AUTORIZADA');

      if (orden.estado !== 'pendiente') {
        return { ok: false, estado: orden.estado, mensaje: 'La orden ya fue procesada.' };
      }

      const ahora = Date.now();
      const bloqueoActual = orden.bloqueoEdicion;
      const tiempoBloqueoMs = bloqueoActual?.timestamp ? ahora - Number(bloqueoActual.timestamp) : Infinity;
      const lockVigente = Boolean(bloqueoActual && tiempoBloqueoMs < 90000);

      const esMiSesion = Boolean(
        bloqueoActual && (
          (sessId && bloqueoActual.sessionId)
            ? (bloqueoActual.sessionId === sessId)
            : (bloqueoActual.uid === decodedToken.uid)
        )
      );

      if (accion === 'bloquear') {
        if (lockVigente) {
          if (esMiSesion) {
            // Misma sesión/pantalla refrescando su propio bloqueo
            transaction.update(ordenRef, { 
              'bloqueoEdicion.timestamp': ahora,
              ...(sessId ? { 'bloqueoEdicion.sessionId': sessId } : {})
            });
            return { ok: true, bloqueado: true };
          }
          if (esAdmin) {
            // El administrador tiene jerarquía de tomar el control
            transaction.update(ordenRef, {
              bloqueoEdicion: {
                uid: decodedToken.uid,
                sessionId: sessId,
                nombre: nombreUsuario,
                rol: 'admin',
                timestamp: ahora
              }
            });
            return { ok: true, bloqueado: true, tomoControl: true };
          }
          // Colaborador u otra terminal intentando editar una orden bloqueada
          return {
            ok: false,
            bloqueado: false,
            bloqueadoPor: bloqueoActual.nombre || 'Otro usuario',
            rolBloqueador: bloqueoActual.rol || 'colaborador'
          };
        }

        // Si no está bloqueada o el bloqueo expiró (>90s)
        transaction.update(ordenRef, {
          bloqueoEdicion: {
            uid: decodedToken.uid,
            sessionId: sessId,
            nombre: nombreUsuario,
            rol: esAdmin ? 'admin' : 'colaborador',
            timestamp: ahora
          }
        });
        return { ok: true, bloqueado: true };
      }

      if (accion === 'heartbeat') {
        if (esMiSesion) {
          transaction.update(ordenRef, { 'bloqueoEdicion.timestamp': ahora });
          return { ok: true };
        }
        return { ok: false, lockPerdido: true };
      }

      if (accion === 'liberar') {
        if (esMiSesion || esAdmin) {
          transaction.update(ordenRef, { bloqueoEdicion: null });
          return { ok: true, liberado: true };
        }
        return { ok: true, ignorado: true };
      }

      return { ok: true };
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    const respuestas: Record<string, { status: number; text: string }> = {
      ORDEN_NO_EXISTE: { status: 404, text: 'La orden no existe.' },
      ORDEN_NO_AUTORIZADA: { status: 403, text: 'No tienes autorización para acceder a esta orden.' }
    };
    const respuesta = respuestas[error?.message];
    if (respuesta) return NextResponse.json({ error: respuesta.text }, { status: respuesta.status });
    console.error('Error gestionando bloqueo de orden:', error);
    return NextResponse.json({ error: 'No se pudo gestionar el estado de edición.' }, { status: 500 });
  }
}
