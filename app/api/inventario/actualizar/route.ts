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
    if (!cuentaPrincipalId || (!esAdmin && usuario.permisos?.editarInventario !== true)) {
      return NextResponse.json({ error: 'No tienes permiso para editar inventario.' }, { status: 403 });
    }

    const body = await request.json();
    const productoId = typeof body.productoId === 'string' ? body.productoId : '';
    if (!productoId || typeof body.nombre !== 'string' || !body.nombre.trim()) {
      return NextResponse.json({ error: 'Datos de producto inválidos.' }, { status: 400 });
    }

    const productoRef = adminDb.collection('inventario').doc(productoId);
    const resultado = await adminDb.runTransaction(async (transaction) => {
      const productoSnap = await transaction.get(productoRef);
      if (!productoSnap.exists || productoSnap.data()?.usuarioId !== cuentaPrincipalId) throw new Error('PRODUCTO_NO_AUTORIZADO');

      const productoActual = productoSnap.data() as any;
      const modificarPrecios = esAdmin || usuario.permisos?.modificarPrecios === true;
      const tipoProducto = body.tipoProducto === 'servicio' ? 'servicio' : 'producto';
      const inventariable = tipoProducto === 'producto' && body.inventariable === true;
      const cambios: Record<string, any> = {
        nombre: body.nombre.trim(),
        sku: typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : productoActual.sku,
        categoria: typeof body.categoria === 'string' && body.categoria.trim() ? body.categoria.trim() : 'General',
        tipoProducto,
        inventariable,
        fechaActualizacion: new Date()
      };
      if (body.imagen !== undefined) {
        cambios.imagen = body.imagen;
      }

      if (modificarPrecios) {
        const precioVenta = Number(body.precioVenta);
        const costoCompra = Number(body.costoCompra);
        if (!Number.isFinite(precioVenta) || precioVenta < 0 || !Number.isFinite(costoCompra) || costoCompra < 0) {
          throw new Error('PRECIOS_INVALIDOS');
        }
        cambios.precioVenta = precioVenta;
        cambios.costoCompra = costoCompra;
      }

      if (esAdmin) {
        const stock = inventariable ? Number(body.stock) : 0;
        if (!Number.isInteger(stock)) throw new Error('STOCK_INVALIDO');
        cambios.stock = stock;
      }

      transaction.update(productoRef, cambios);

      // Historial de compras (Fase 1): si al editar el administrador SUBE el stock,
      // se registra como "Entrada de Mercancía" con el costo pagado y el stock antes/después.
      // No altera ventas, reportes ni ningún cálculo existente.
      const stockAnterior = Number(productoActual.stock || 0);
      if (esAdmin && inventariable && typeof cambios.stock === 'number' && Number.isFinite(stockAnterior) && cambios.stock > stockAnterior) {
        const cantidad = cambios.stock - stockAnterior;
        const costoAnterior = Number(productoActual.costoCompra || 0);
        const costoUnitario = typeof cambios.costoCompra === 'number' && cambios.costoCompra > 0 ? cambios.costoCompra : costoAnterior;
        const nombreProducto = cambios.nombre || productoActual.nombre || 'Producto';
        transaction.create(adminDb.collection('movimientos').doc(), {
          usuarioId: cuentaPrincipalId,
          tipo: 'ingreso_inventario',
          categoria: 'edicion_producto',
          monto: 0,
          descripcion: `Entrada por edición: +${cantidad} unidades de ${nombreProducto}`,
          fecha: new Date(),
          registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
          idProducto: productoId,
          nombreProducto,
          cantidadAgregada: cantidad,
          costoUnitario,
          costoAnterior,
          stockAnterior,
          stockNuevo: cambios.stock,
          proveedor: null
        });
      }
      return { productoId, precioActualizado: modificarPrecios };
    });

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    if (error?.message === 'PRODUCTO_NO_AUTORIZADO') return NextResponse.json({ error: 'Producto no encontrado o no pertenece a tu negocio.' }, { status: 403 });
    if (error?.message === 'PRECIOS_INVALIDOS') return NextResponse.json({ error: 'Los precios deben ser números no negativos.' }, { status: 400 });
    if (error?.message === 'STOCK_INVALIDO') return NextResponse.json({ error: 'El stock debe ser un número entero válido.' }, { status: 400 });
    console.error('Error actualizando inventario:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el producto.' }, { status: 500 });
  }
}
