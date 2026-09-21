import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const TIPOS_PERMITIDOS = new Set(['abono', 'egreso']);
const METODOS_PERMITIDOS = new Set(['efectivo', 'transferencia', 'datafono', 'credito_externo', 'ajuste_contable']);

function quitarUndefined<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(quitarUndefined) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, quitarUndefined(value)])
    ) as unknown as T;
  }
  return data;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
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
      return NextResponse.json({ error: 'La cuenta principal no es válida.' }, { status: 403 });
    }

    const body = await request.json();
    const tipo = typeof body.tipo === 'string' ? body.tipo : '';
    const metodoPago = typeof body.metodoPago === 'string' ? body.metodoPago : '';
    const monto = Number(body.monto);
    const clienteId = typeof body.clienteId === 'string' ? body.clienteId : '';

    if (!TIPOS_PERMITIDOS.has(tipo) || !Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json({ error: 'Tipo o monto de movimiento inválido.' }, { status: 400 });
    }
    if (!METODOS_PERMITIDOS.has(metodoPago)) {
      return NextResponse.json({ error: 'Método de pago inválido.' }, { status: 400 });
    }
    if (tipo === 'abono' && (!usuario.permisos?.abonar && !esAdmin)) {
      return NextResponse.json({ error: 'No tienes permiso para registrar abonos.' }, { status: 403 });
    }
    if (tipo === 'egreso' && (!esAdmin || metodoPago !== 'ajuste_contable')) {
      return NextResponse.json({ error: 'Sólo un administrador puede registrar ajustes contables.' }, { status: 403 });
    }
    if (!clienteId) {
      return NextResponse.json({ error: 'Cliente requerido.' }, { status: 400 });
    }

    const clienteRef = adminDb.collection('clientes').doc(clienteId);
    const movimientoRef = adminDb.collection('movimientos').doc();
    const resultado = await adminDb.runTransaction(async (transaction) => {
      const clienteSnap = await transaction.get(clienteRef);
      if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) {
        throw new Error('CLIENTE_NO_AUTORIZADO');
      }

      const clienteData = clienteSnap.data() as any;
      const deudaActual = Number(clienteData.deudaTotal || 0);
      if (!Number.isFinite(deudaActual)) {
        throw new Error('SALDO_INVALIDO');
      }

      const nuevoSaldo = tipo === 'abono' ? deudaActual - monto : deudaActual;
      if (tipo === 'abono') {
        transaction.update(clienteRef, {
          deudaTotal: nuevoSaldo,
          fechaUltimoMovimiento: new Date()
        });
      }

      transaction.create(movimientoRef, quitarUndefined({
        usuarioId: cuentaPrincipalId,
        clienteId,
        clienteNombre: clienteData.nombre || 'Cliente',
        tipo,
        monto,
        descripcion: typeof body.descripcion === 'string' && body.descripcion.trim()
          ? body.descripcion.trim()
          : tipo === 'abono' ? 'Abono a cuenta' : 'Ajuste contable',
        fecha: new Date(),
        registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
        metodoPago,
        subMetodoPago: typeof body.subMetodoPago === 'string' ? body.subMetodoPago.trim() : undefined,
        referenciaPago: typeof body.referenciaPago === 'string' ? body.referenciaPago.trim() : undefined,
        detalles: [],
        esPublico: body.esPublico === true,
        saldoResultante: tipo === 'abono' ? nuevoSaldo : undefined
      }));

      return { movimientoId: movimientoRef.id, nuevoSaldo };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    if (error?.message === 'CLIENTE_NO_AUTORIZADO') {
      return NextResponse.json({ error: 'Cliente no encontrado o no pertenece a tu negocio.' }, { status: 403 });
    }
    if (error?.message === 'SALDO_INVALIDO') {
      return NextResponse.json({ error: 'El saldo actual del cliente no es válido.' }, { status: 409 });
    }
    console.error('Error registrando movimiento:', error);
    return NextResponse.json({ error: error?.message || 'No se pudo registrar el movimiento.' }, { status: 500 });
  }
}
