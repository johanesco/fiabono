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
    const puedeIngresar = esAdmin || usuario.permisos?.ingresoInventario === true || usuario.permisos?.editarInventario === true;
    if (!cuentaPrincipalId || !puedeIngresar) {
      return NextResponse.json({ error: 'No tienes permiso para ingresar inventario.' }, { status: 403 });
    }

    const body = await request.json();
    const productos = Array.isArray(body.productos) ? body.productos : [];
    if (!productos.length || productos.length > 100) return NextResponse.json({ error: 'Lote de inventario inválido.' }, { status: 400 });

    const resultado = await adminDb.runTransaction(async (transaction) => {
      let actualizados = 0;
      let creados = 0;
      const idsCreados: string[] = [];
      const movimientos: Array<{ productoId: string; nombre: string; cantidad: number }> = [];

      // 1. LECTURAS PREVIAS (Requisito estricto de Firestore: todos los gets antes de cualquier set/update/create)
      const productosExistentesSnaps: Array<{ producto: any; snap: any; ref: any }> = [];
      for (const producto of productos) {
        if (producto.esExistente && typeof producto.productoId === 'string') {
          const productoRef = adminDb.collection('inventario').doc(producto.productoId);
          const snap = await transaction.get(productoRef);
          productosExistentesSnaps.push({ producto, snap, ref: productoRef });
        }
      }

      // 2. ACTUALIZACIÓN DE PRODUCTOS EXISTENTES
      for (const item of productosExistentesSnaps) {
        const { producto, snap, ref } = item;
        if (!snap.exists || snap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('PRODUCTO_NO_AUTORIZADO');
        const productoActual = snap.data() as any;
        const stockActual = Number(productoActual.stock || 0);
        if (!Number.isFinite(stockActual) || stockActual < 0) throw new Error('STOCK_INVALIDO');
        const cantidad = Number(producto.stock);
        if (!Number.isInteger(cantidad) || cantidad < 0) throw new Error('CANTIDAD_INVALIDA');
        const cantidadAplicada = productoActual.inventariable === false || productoActual.tipoProducto === 'servicio' ? 0 : cantidad;
        transaction.update(ref, { stock: stockActual + cantidadAplicada, fechaActualizacion: new Date() });
        if (cantidadAplicada > 0) movimientos.push({ productoId: producto.productoId, nombre: productoActual.nombre || producto.nombre || 'Producto', cantidad: cantidadAplicada });
        actualizados++;
      }

      // 3. CREACIÓN DE NUEVOS PRODUCTOS
      for (const producto of productos) {
        if (producto.esExistente) continue; // Ya procesado en el bloque anterior
        const cantidad = Number(producto.stock);
        if (!Number.isInteger(cantidad) || cantidad < 0) throw new Error('CANTIDAD_INVALIDA');
        const esInventariable = producto.inventariable !== false && producto.tipoProducto !== 'servicio';

        if (!producto.nombre || typeof producto.nombre !== 'string' || !producto.nombre.trim()) throw new Error('PRODUCTO_INVALIDO');
        const productoRef = adminDb.collection('inventario').doc();
        const cantidadInicial = esInventariable ? cantidad : 0;
        transaction.create(productoRef, {
          usuarioId: cuentaPrincipalId,
          nombre: producto.nombre.trim(),
          sku: producto.sku || `SKU-${productoRef.id.slice(-6).toUpperCase()}`,
          codigoBarras: producto.codigoBarras || producto.sku || null,
          stock: cantidadInicial,
          precioVenta: Number(producto.precioVenta) || 0,
          costoCompra: Number(producto.costoCompra) || 0,
          tipoProducto: producto.tipoProducto || 'producto',
          categoria: producto.categoria || 'General',
          inventariable: esInventariable,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        });
        idsCreados.push(productoRef.id);
        if (cantidadInicial > 0) movimientos.push({ productoId: productoRef.id, nombre: producto.nombre.trim(), cantidad: cantidadInicial });
        creados++;
      }

      // 4. REGISTRO DE MOVIMIENTOS DE AUDITORÍA
      for (const movimiento of movimientos) {
        const movimientoRef = adminDb.collection('movimientos').doc();
        transaction.create(movimientoRef, {
          usuarioId: cuentaPrincipalId,
          tipo: 'ingreso_inventario',
          categoria: 'recepcion_mercancia',
          monto: 0,
          descripcion: `Recepción: +${movimiento.cantidad} unidades de ${movimiento.nombre}`,
          fecha: new Date(),
          registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
          idProducto: movimiento.productoId,
          nombreProducto: movimiento.nombre,
          cantidadAgregada: movimiento.cantidad
        });
      }
      return { actualizados, creados, idsCreados };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    const mensajes: Record<string, string> = {
      CANTIDAD_INVALIDA: 'La cantidad debe ser un entero no negativo.',
      PRODUCTO_NO_AUTORIZADO: 'El producto no pertenece a tu negocio.',
      STOCK_INVALIDO: 'El stock actual no es válido.',
      PRODUCTO_INVALIDO: 'Los datos del producto son inválidos.'
    };
    if (mensajes[error?.message]) return NextResponse.json({ error: mensajes[error.message] }, { status: 400 });
    console.error('Error recibiendo inventario:', error);
    return NextResponse.json({ error: 'No se pudo registrar la recepción de inventario.' }, { status: 500 });
  }
}
