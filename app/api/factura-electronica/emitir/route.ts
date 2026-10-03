// app/api/factura-electronica/emitir/route.ts
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { emitirFacturaDian } from '@/servicios/facturacionDian';
import { Movimiento, Cliente } from '@/types';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const idToken = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const adminDb = getAdminDb();

    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 });
    }

    const usuario = usuarioSnap.data() as any;
    const esAdmin = usuario.rol !== 'cajero';
    const cuentaPrincipalId = esAdmin ? decodedToken.uid : usuario.adminId;

    if (!cuentaPrincipalId || (!esAdmin && usuario.activo === false)) {
      return NextResponse.json({ error: 'La cuenta no está activa o autorizada.' }, { status: 403 });
    }

    const adminDocSnap = esAdmin ? usuarioSnap : await adminDb.collection('usuarios').doc(cuentaPrincipalId).get();
    const adminData = adminDocSnap.data() as any;

    if (adminData?.facturacionDianHabilitada !== true) {
      return NextResponse.json({ 
        error: 'Tu negocio no tiene habilitado el servicio de Facturación Electrónica DIAN. Solicita la activación desde tu perfil de negocio.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const movimientoId = typeof body.movimientoId === 'string' ? body.movimientoId.trim() : '';

    if (!movimientoId) {
      return NextResponse.json({ error: 'Se requiere el ID del movimiento/venta.' }, { status: 400 });
    }

    // 1. Cargar el movimiento desde Firestore
    const movRef = adminDb.collection('movimientos').doc(movimientoId);
    const movSnap = await movRef.get();

    if (!movSnap.exists) {
      return NextResponse.json({ error: 'Venta no encontrada.' }, { status: 404 });
    }

    const movData = { id: movSnap.id, ...movSnap.data() } as Movimiento;

    // Verificar que pertenezca a la cuenta del negocio
    if (movData.usuarioId !== cuentaPrincipalId) {
      return NextResponse.json({ error: 'No tienes permiso para facturar esta venta.' }, { status: 403 });
    }

    // Si ya tiene factura electrónica emitida, no duplicar emisión
    if (movData.facturaElectronica?.estado === 'emitida' && movData.facturaElectronica?.cufe) {
      return NextResponse.json({
        success: true,
        yaEmitida: true,
        facturaElectronica: movData.facturaElectronica
      });
    }

    // 2. Resolver datos del cliente
    let cliente: Cliente | null = null;
    if (body.clienteDianManual?.numeroDocumento?.trim()) {
      cliente = {
        id: 'manual',
        nombre: body.clienteDianManual.nombre || 'Consumidor',
        numeroDocumento: body.clienteDianManual.numeroDocumento.trim(),
        tipoDocumento: body.clienteDianManual.tipoDocumento || 'CC',
        email: body.clienteDianManual.email?.trim() || '',
        usuarioId: cuentaPrincipalId,
        saldo: 0,
        fechaRegistro: new Date()
      } as any;
    } else if (movData.clienteId && movData.clienteId !== 'mostrador' && movData.clienteId !== 'consumidor_final') {
      const cliSnap = await adminDb.collection('clientes').doc(movData.clienteId).get();
      if (cliSnap.exists) {
        cliente = { id: cliSnap.id, ...cliSnap.data() } as Cliente;
      }
    }

    const ambiente = (process.env.NODE_ENV === 'production' && process.env.MATIAS_API_TOKEN_PROD)
      ? 'produccion'
      : 'sandbox';

    const resolucion = body.resolucion || adminData?.matiasResolucionCustom || '18760000001';
    const prefijo = body.prefijo || adminData?.matiasPrefijoCustom || (ambiente === 'produccion' ? 'SETP' : 'FEV');
    const tokenOverride = adminData?.matiasTokenCustom || body.tokenOverride || undefined;

    // 3. Obtener e incrementar consecutivamente el número de factura de forma atómica
    const userRef = adminDb.collection('usuarios').doc(cuentaPrincipalId);
    const consecutivo = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const userData = userDoc.data() || {};
      const campoConsecutivo = ambiente === 'produccion'
        ? 'consecutivoFacturaDianProd'
        : 'consecutivoFacturaDianSandbox';

      // Base: en Sandbox ya emitimos 1 y 2 en pruebas de verificación
      const actual = typeof userData[campoConsecutivo] === 'number'
        ? userData[campoConsecutivo]
        : (ambiente === 'sandbox' ? 2 : 0);

      const siguiente = actual + 1;
      transaction.update(userRef, { [campoConsecutivo]: siguiente });
      return siguiente;
    });

    // 4. Emitir a MATIAS API
    const resultado = await emitirFacturaDian({
      movimiento: movData,
      cliente,
      resolucion,
      prefijo,
      consecutivo,
      ambiente,
      tokenOverride
    });

    if (resultado.success && resultado.datos) {
      // Guardar en Firestore el resultado oficial con CUFE y QR
      await movRef.update({
        facturaElectronica: resultado.datos
      });

      return NextResponse.json({
        success: true,
        facturaElectronica: resultado.datos
      });
    }

    return NextResponse.json({
      success: false,
      error: resultado.error || 'No se pudo emitir la factura en la DIAN.',
      detalles: resultado.detallesError
    }, { status: 422 });

  } catch (error: any) {
    console.error('Error en /api/factura-electronica/emitir:', error);
    return NextResponse.json({
      error: error?.message || 'Error interno del servidor al procesar la factura electrónica.'
    }, { status: 500 });
  }
}
