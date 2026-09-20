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
    if (!cuentaPrincipalId || (!esAdmin && (usuario.permisos?.ventaDirecta !== true || usuario.permisos?.planSepare !== true))) {
      return NextResponse.json({ error: 'No tienes permiso para crear Separes directamente.' }, { status: 403 });
    }

    const body = await request.json();
    const separeData = body.separeData as any;
    const abonoInicial = Number(body.abonoInicial || 0);
    const metodoPago = typeof body.metodoPago === 'string' ? body.metodoPago : '';
    const itemsInventario = Array.isArray(body.itemsInventario) ? body.itemsInventario : [];
    if (!separeData || !separeData.clienteId || !Array.isArray(separeData.items) || !separeData.items.length) {
      return NextResponse.json({ error: 'Datos del Plan Separe incompletos.' }, { status: 400 });
    }
    if (!Number.isFinite(abonoInicial) || abonoInicial < 0 || !METODOS_PERMITIDOS.has(metodoPago)) {
      return NextResponse.json({ error: 'Abono inicial o método de pago inválido.' }, { status: 400 });
    }

    const resultado = await adminDb.runTransaction(async (transaction) => {
      const clienteRef = adminDb.collection('clientes').doc(separeData.clienteId);
      const clienteSnap = await transaction.get(clienteRef);
      if (!clienteSnap.exists || clienteSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('CLIENTE_NO_AUTORIZADO');

      const total = Number(separeData.total);
      if (!Number.isFinite(total) || total <= 0 || abonoInicial > total) throw new Error('TOTAL_INVALIDO');

      const productos = new Map<string, { ref: any; data: any }>();
      for (const item of itemsInventario) {
        if (!item?.productoId || !Number.isInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) throw new Error('ITEM_INVALIDO');
        const productoRef = adminDb.collection('inventario').doc(item.productoId);
        const productoSnap = await transaction.get(productoRef);
        if (!productoSnap.exists || productoSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('PRODUCTO_NO_AUTORIZADO');
        const producto = productoSnap.data() as any;
        const stock = Number(producto.stock || 0);
        if (!Number.isFinite(stock) || stock < 0) throw new Error('STOCK_INVALIDO');
        if (producto.tipoProducto !== 'servicio' && producto.inventariable !== false && Number(item.cantidad) > stock) throw new Error(`SIN_STOCK:${producto.nombre || item.productoId}`);
        productos.set(item.productoId, { ref: productoRef, data: producto });
      }

      const separeRef = adminDb.collection('separes').doc();
      const fechaLimite = separeData.fechaLimite ? new Date(separeData.fechaLimite) : null;
      const payload = {
        ...separeData,
        usuarioId: cuentaPrincipalId,
        clienteId: separeData.clienteId,
        clienteNombre: clienteSnap.data()?.nombre || separeData.clienteNombre || 'Cliente',
        estado: 'activo',
        total,
        montoPagado: abonoInicial,
        saldoPendiente: total - abonoInicial,
        metodoPago,
        fechaCreacion: new Date(),
        fechaLimite,
        creadoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario'
      };
      transaction.create(separeRef, payload);

      for (const item of itemsInventario) {
        const producto = productos.get(item.productoId)!;
        if (producto.data.tipoProducto !== 'servicio' && producto.data.inventariable !== false) {
          transaction.update(producto.ref, { stock: Number(producto.data.stock || 0) - Number(item.cantidad) });
        }
      }

      let movimientoAbonoId: string | undefined;
      if (abonoInicial > 0) {
        const movimientoRef = adminDb.collection('movimientos').doc();
        movimientoAbonoId = movimientoRef.id;
        transaction.create(movimientoRef, {
          clienteId: separeData.clienteId,
          clienteNombre: clienteSnap.data()?.nombre || separeData.clienteNombre || 'Cliente',
          usuarioId: cuentaPrincipalId,
          tipo: 'abono',
          subtipo: 'abono_inicial_separe',
          monto: abonoInicial,
          descripcion: `Abono inicial Plan Separe - ${clienteSnap.data()?.nombre || 'Cliente'}`,
          detalles: separeData.items,
          fecha: new Date(),
          registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
          metodoPago,
          ...(typeof body.subMetodoPago === 'string' && body.subMetodoPago.trim() ? { subMetodoPago: body.subMetodoPago.trim() } : {}),
          ...(typeof body.referenciaPago === 'string' && body.referenciaPago.trim() ? { referenciaPago: body.referenciaPago.trim() } : {}),
          idSepareOrigen: separeRef.id
        });
      }
      return { separeId: separeRef.id, movimientoAbonoId };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, { status: number; text: string }> = {
      CLIENTE_NO_AUTORIZADO: { status: 403, text: 'El cliente no pertenece a tu negocio.' },
      PRODUCTO_NO_AUTORIZADO: { status: 403, text: 'Producto no autorizado.' },
      ITEM_INVALIDO: { status: 400, text: 'Artículo de inventario inválido.' },
      STOCK_INVALIDO: { status: 400, text: 'Stock inválido.' },
      TOTAL_INVALIDO: { status: 400, text: 'Total o abono inicial inválido.' }
    };
    if (error?.message?.startsWith('SIN_STOCK:')) return NextResponse.json({ error: `Sin stock suficiente de ${error.message.slice(9)}.` }, { status: 409 });
    const conocido = mensajes[error?.message];
    if (conocido) return NextResponse.json({ error: conocido.text }, { status: conocido.status });
    console.error('Error creando Plan Separe:', error);
    return NextResponse.json({ error: 'No se pudo crear el Plan Separe.' }, { status: 500 });
  }
}
