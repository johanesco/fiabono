import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { ajustarLotesEnEdicionManual } from '@/utils/lotesInventario';

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

        if (body.precioFiado !== undefined) {
          const pf = Number(body.precioFiado);
          cambios.precioFiado = Number.isFinite(pf) && pf > 0 ? pf : null;
        }
        if (body.precioSepare !== undefined) {
          const ps = Number(body.precioSepare);
          cambios.precioSepare = Number.isFinite(ps) && ps > 0 ? ps : null;
        }
      }

      if (esAdmin) {
        const stock = inventariable ? Number(body.stock) : 0;
        if (!Number.isInteger(stock)) throw new Error('STOCK_INVALIDO');
        cambios.stock = stock;
      }

      const costoIngresado = typeof cambios.costoCompra === 'number' ? cambios.costoCompra : Number(productoActual.costoCompra || 0);
      const provIngresado = typeof body.proveedor === 'string' && body.proveedor.trim() ? body.proveedor.trim().slice(0, 80) : null;
      if (provIngresado !== null) {
        cambios.proveedor = provIngresado;
      }
      if (esAdmin && inventariable && Array.isArray(body.lotesEditados) && body.lotesEditados.length > 0) {
        const lotesSanitizados = body.lotesEditados
          .map((l: any, idx: number) => {
            const cant = Math.max(0, Math.round(Number(l?.cantidad) || 0));
            const cantIni = Math.max(cant, Math.round(Number(l?.cantidadInicial || cant) || 1));
            const costoU = Math.max(0, Number(l?.costoUnitario) || 0);
            const provLote = typeof l?.proveedor === 'string' && l.proveedor.trim() ? l.proveedor.trim().slice(0, 80) : undefined;
            return {
              id: typeof l?.id === 'string' && l.id ? l.id : `lote_${idx}_${Date.now()}`,
              cantidad: cant,
              cantidadInicial: cantIni,
              costoUnitario: costoU,
              fecha: typeof l?.fecha === 'string' && l.fecha ? l.fecha : new Date().toISOString(),
              ...(provLote ? { proveedor: provLote } : {}),
            };
          })
          .filter((l: any) => l.cantidad > 0);

        const sumaStockLotes = lotesSanitizados.reduce((acc: number, l: any) => acc + l.cantidad, 0);
        cambios.stock = sumaStockLotes;
        cambios.lotesCosto = lotesSanitizados;
        cambios.costoCompra = lotesSanitizados.length > 0 ? lotesSanitizados[0].costoUnitario : costoIngresado;
      } else if (esAdmin && inventariable && typeof cambios.stock === 'number') {
        const { lotesActualizados, costoCompraActivo } = ajustarLotesEnEdicionManual(
          productoActual,
          cambios.stock,
          costoIngresado,
          provIngresado
        );
        cambios.lotesCosto = lotesActualizados;
        cambios.costoCompra = costoCompraActivo;
      }

      transaction.update(productoRef, cambios);

      // Historial de compras (Fase 1): si al editar el administrador SUBE el stock,
      // se registra como "Entrada de Mercancía" con el costo pagado y el stock antes/después.
      // No altera ventas, reportes ni ningún cálculo existente.
      const stockAnterior = Number(productoActual.stock || 0);
      if (esAdmin && inventariable && typeof cambios.stock === 'number' && Number.isFinite(stockAnterior) && cambios.stock > stockAnterior) {
        const cantidad = cambios.stock - stockAnterior;
        const costoAnterior = Number(productoActual.costoCompra || 0);
        const costoUnitario = costoIngresado > 0 ? costoIngresado : costoAnterior;
        const nombreProducto = cambios.nombre || productoActual.nombre || 'Producto';
        transaction.create(adminDb.collection('movimientos').doc(), {
          usuarioId: cuentaPrincipalId,
          tipo: 'ingreso_inventario',
          categoria: 'edicion_producto',
          monto: 0,
          descripcion: `Entrada por edición: +${cantidad} unidades de ${nombreProducto}${provIngresado ? ` (${provIngresado})` : ''}`,
          fecha: new Date(),
          registradoPor: usuario.nombreUsuario || decodedToken.email || 'Usuario',
          idProducto: productoId,
          nombreProducto,
          cantidadAgregada: cantidad,
          costoUnitario,
          costoAnterior,
          stockAnterior,
          stockNuevo: cambios.stock,
          proveedor: provIngresado
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
