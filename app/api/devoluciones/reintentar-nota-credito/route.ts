import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { emitirYGuardarNotaCredito } from '@/lib/notaCreditoServidor';

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
      return NextResponse.json({ error: 'No tienes permiso para esta acción.' }, { status: 403 });
    }

    const body = await request.json();
    const devolucionId = typeof body.movimientoDevolucionId === 'string' ? body.movimientoDevolucionId : '';
    if (!devolucionId) return NextResponse.json({ error: 'Falta la devolución.' }, { status: 400 });

    const devRef = adminDb.collection('movimientos').doc(devolucionId);
    const devSnap = await devRef.get();
    if (!devSnap.exists) return NextResponse.json({ error: 'La devolución no existe.' }, { status: 404 });
    const dev = devSnap.data() as any;
    if (dev.usuarioId !== cuentaPrincipalId || dev.tipo !== 'devolucion') {
      return NextResponse.json({ error: 'La devolución no pertenece a tu negocio.' }, { status: 403 });
    }
    if (dev.notaCreditoElectronica?.cufe || dev.notaCreditoElectronica?.cude) {
      return NextResponse.json({ error: 'Esta devolución ya tiene Nota Crédito emitida.' }, { status: 409 });
    }

    const origenId = dev.movimientoOrigenId;
    const origenSnap = origenId ? await adminDb.collection('movimientos').doc(origenId).get() : null;
    if (!origenSnap?.exists) return NextResponse.json({ error: 'La venta original no existe.' }, { status: 404 });
    const origen = origenSnap.data() as any;
    if (origen.usuarioId !== cuentaPrincipalId) {
      return NextResponse.json({ error: 'La venta no pertenece a tu negocio.' }, { status: 403 });
    }
    if (!origen.facturaElectronica?.cufe) {
      return NextResponse.json({ error: 'La venta original no tiene factura electrónica DIAN.' }, { status: 409 });
    }

    const r = await emitirYGuardarNotaCredito({
      adminDb,
      cuentaPrincipalId,
      usuario: esAdmin ? usuario : ((await adminDb.collection('usuarios').doc(cuentaPrincipalId).get()).data() || {}),
      movimientoDevolucionId: devolucionId,
      movimientoOrigenId: origenId,
      totalDevolver: Number(dev.monto) || 0,
      articulosDevueltos: Array.isArray(dev.articulosDevueltos) ? dev.articulosDevueltos : [],
      origenClienteId: origen.clienteId || null,
      origenClienteNombre: origen.clienteNombre || null,
      origenFecha: origen.fecha || null,
      origenFacturaElectronica: origen.facturaElectronica
    });

    if (r.error) return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, notaCreditoDian: r.datos });
  } catch (error: any) {
    console.error('Error reintentando Nota Crédito:', error);
    return NextResponse.json({ error: error?.message || 'No se pudo reintentar la Nota Crédito.' }, { status: 500 });
  }
}
