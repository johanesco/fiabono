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
    if (!cuentaPrincipalId || (!esAdmin && usuario.permisos?.abonar !== true)) {
      return NextResponse.json({ error: 'No tienes permiso para registrar abonos.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId : '';
    const clienteId = typeof body.clienteId === 'string' ? body.clienteId : '';
    const montoAbono = Number(body.montoAbono);
    const metodoPago = typeof body.metodoPago === 'string' ? body.metodoPago : '';
    if (!separeId || !clienteId || !Number.isFinite(montoAbono) || montoAbono <= 0 || !METODOS_PERMITIDOS.has(metodoPago)) {
      return NextResponse.json({ error: 'Datos de abono inválidos.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const separeRef = adminDb.collection('separes').doc(separeId);
      const separeSnap = await transaction.get(separeRef);
      if (!separeSnap.exists) throw new Error('SEPARE_NO_EXISTE');
      const separe = separeSnap.data() as any;
      if (separe.usuarioId !== cuentaPrincipalId) throw new Error('SEPARE_NO_AUTORIZADO');
      if (separe.clienteId !== clienteId) throw new Error('CLIENTE_NO_AUTORIZADO');
      if (separe.estado === 'cancelado') throw new Error('SEPARE_CANCELADO');
      if (separe.estado === 'completado') throw new Error('SEPARE_COMPLETADO');

      const saldoActual = Number(separe.saldoPendiente || 0);
      const montoPagadoActual = Number(separe.montoPagado || 0);
      if (!Number.isFinite(saldoActual) || !Number.isFinite(montoPagadoActual) || montoAbono > saldoActual) {
        throw new Error('MONTO_EXCEDE_SALDO');
      }

      let clienteRef: any = null;
      if (metodoPago === 'saldo_interno') {
        const clienteDocRef = adminDb.collection('clientes').doc(clienteId);
        clienteRef = clienteDocRef;
        const clienteSnap = await transaction.get(clienteDocRef);
        if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('CLIENTE_NO_AUTORIZADO');
        const deudaActual = Number(clienteSnap.data()?.deudaTotal || 0);
        if (!Number.isFinite(deudaActual) || deudaActual >= 0 || Math.abs(deudaActual) < montoAbono) throw new Error('SALDO_FAVOR_INSUFICIENTE');
        transaction.update(clienteRef, { deudaTotal: deudaActual + montoAbono, fechaUltimoMovimiento: new Date() });
      }

      const nuevoSaldoPendiente = saldoActual - montoAbono;
      const nuevoMontoPagado = montoPagadoActual + montoAbono;
      const abono = {
        id: `abono_${Date.now()}`,
        monto: montoAbono,
        metodoPago,
        fecha: new Date(),
        registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        ...(typeof body.subMetodoPago === 'string' && body.subMetodoPago.trim() ? { subMetodoPago: body.subMetodoPago.trim() } : {}),
        ...(typeof body.referenciaPago === 'string' && body.referenciaPago.trim() ? { referenciaPago: body.referenciaPago.trim() } : {})
      };
      transaction.update(separeRef, {
        abonos: Array.isArray(separe.abonos) ? [...separe.abonos, abono] : [abono],
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente
      });

      const movimientoRef = adminDb.collection('movimientos').doc();
      transaction.create(movimientoRef, {
        clienteId,
        clienteNombre: separe.clienteNombre || 'Cliente',
        usuarioId: cuentaPrincipalId,
        tipo: 'abono',
        monto: montoAbono,
        descripcion: `Abono a Plan Separe - ${separe.clienteNombre || 'Cliente'}`,
        detalles: Array.isArray(body.detallesItems) ? body.detallesItems : separe.items || [],
        fecha: new Date(),
        registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        metodoPago,
        ...(typeof body.subMetodoPago === 'string' && body.subMetodoPago.trim() ? { subMetodoPago: body.subMetodoPago.trim() } : {}),
        ...(typeof body.referenciaPago === 'string' && body.referenciaPago.trim() ? { referenciaPago: body.referenciaPago.trim() } : {}),
        idSepareOrigen: separeId,
        saldoResultanteSepare: nuevoSaldoPendiente
      });

      return { movimientoId: movimientoRef.id, nuevoSaldoPendiente, nuevoMontoPagado };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      SEPARE_NO_EXISTE: { status: 404, text: 'El Plan Separe no existe.' },
      SEPARE_NO_AUTORIZADO: { status: 403, text: 'El Plan Separe no pertenece a tu negocio.' },
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'El cliente no pertenece a tu negocio o no coincide con el Separe.' },
      SEPARE_CANCELADO: { status: 409, text: 'No se pueden registrar abonos a un Separe cancelado.' },
      SEPARE_COMPLETADO: { status: 409, text: 'El Plan Separe ya fue entregado.' },
      MONTO_EXCEDE_SALDO: { status: 409, text: 'El abono supera el saldo pendiente actual.' },
      SALDO_FAVOR_INSUFICIENTE: { status: 409, text: 'El cliente no tiene suficiente saldo a favor.' }
    };
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error registrando abono de Separe:', error);
    return NextResponse.json({ error: 'No se pudo registrar el abono.' }, { status: 500 });
  }
}
