import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TIPOS_COMPROBANTE_PUBLICO = new Set([
  'venta',
  'fiado',
  'abono',
  'separe',
  'abono_separe',
  'entrega_separe',
  'devolucion',
]);

function serializarFecha(f: any): string | null {
  if (!f) return null;
  if (typeof f.toDate === 'function') return f.toDate().toISOString();
  if (f instanceof Date) return f.toISOString();
  if (typeof f._seconds === 'number') return new Date(f._seconds * 1000).toISOString();
  if (typeof f.seconds === 'number') return new Date(f.seconds * 1000).toISOString();
  if (typeof f === 'string' || typeof f === 'number') {
    const d = new Date(f);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

async function obtenerBrandingNegocio(db: FirebaseFirestore.Firestore, usuarioId: string) {
  const fallback = {
    nombreNegocio: 'Comprobante de Venta',
    telefonoNegocio: '',
    logoNegocio: '/logo-verde-linea-blanca-grande.png',
    nitNegocio: '',
    direccionNegocio: '',
    mensajePieTicket: '¡Gracias por su preferencia!',
  };

  if (!usuarioId) return fallback;

  try {
    const docSnap = await db.collection('usuarios').doc(usuarioId).get();
    if (!docSnap.exists) return fallback;

    let u = docSnap.data()!;
    let idBranding = usuarioId;

    if (u.rol === 'cajero' && u.adminId) {
      const adminSnap = await db.collection('usuarios').doc(u.adminId).get();
      if (adminSnap.exists) {
        u = adminSnap.data()!;
        idBranding = u.adminId;
      }
    }

    const logoNegocio =
      typeof u.logoUrl === 'string' && u.logoUrl.trim()
        ? `/api/logo-negocio/${idBranding}`
        : typeof u.logoNegocio === 'string' && u.logoNegocio.trim()
        ? u.logoNegocio.trim()
        : typeof u.logo === 'string' && u.logo.trim()
        ? u.logo.trim()
        : '/logo-verde-linea-blanca-grande.png';

    return {
      nombreNegocio: u.nombreNegocio || 'Mi Negocio',
      telefonoNegocio: u.telefonoNegocio || '',
      logoNegocio,
      nitNegocio: u.nitNegocio || '',
      direccionNegocio: u.direccionNegocio || '',
      mensajePieTicket: u.mensajePieTicket || '¡Gracias por su compra!',
    };
  } catch (e) {
    console.error('[API ticket-publico] Error obteniendo branding:', e);
    return fallback;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || typeof id !== 'string' || id.length < 5) {
    return NextResponse.json({ error: 'ID de comprobante inválido.' }, { status: 400 });
  }

  try {
    const db = getAdminDb();

    // 1. Buscar en 'movimientos'
    const snapMov = await db.collection('movimientos').doc(id).get();
    if (snapMov.exists) {
      const movData = snapMov.data()!;
      const tipo = movData.tipo || 'venta';

      // No exponer movimientos internos del comercio (ej. ingreso_inventario o egresos internos)
      if (!TIPOS_COMPROBANTE_PUBLICO.has(tipo)) {
        return NextResponse.json({ error: 'Comprobante no disponible públicamente.' }, { status: 404 });
      }

      const datosNegocio = await obtenerBrandingNegocio(db, movData.usuarioId);

      // Sanitizar detalles (nunca exponer costos internos ni márgenes)
      const detallesSanitizados = Array.isArray(movData.detalles)
        ? movData.detalles.map((it: any) => ({
            descripcion: String(it.descripcion || 'Artículo'),
            cantidad: Number(it.cantidad) || 1,
            valorUnitario: Number(it.valorUnitario) || 0,
            valor: Number(it.valor) || 0,
          }))
        : [];

      return NextResponse.json({
        ok: true,
        datosFactura: {
          ...datosNegocio,
          idTransaccion: snapMov.id,
          tipo,
          fecha: serializarFecha(movData.fecha),
          nombreCliente:
            movData.clienteNombre && movData.clienteNombre !== 'Mostrador'
              ? movData.clienteNombre
              : 'Consumidor Final',
          celularCliente: movData.clienteCelular || '',
          registradoPor: movData.registradoPor || '',
          montoTotal: Number(movData.monto) || 0,
          detalles: detallesSanitizados,
          descripcionGeneral: movData.descripcion || '',
          metodoPago: movData.metodoPago,
          subMetodoPago: movData.subMetodoPago,
          referenciaPago: movData.referenciaPago,
          pagoRecibido: movData.pagoRecibido,
          devuelta: movData.devuelta,
          saldoNuevo: movData.saldoResultante,
          subtotal: movData.subtotal,
          valorIva: movData.valorIva,
          porcentajeIva: movData.porcentajeIva,
          montoBruto:
            movData.montoBruto ||
            (movData.montoDescuento
              ? (Number(movData.monto) || 0) + Number(movData.montoDescuento)
              : undefined),
          descuentoTipo: movData.descuentoTipo,
          descuentoValor: movData.descuentoValor,
          montoDescuento: movData.montoDescuento,
          saldoFavorAplicado: movData.montoPagadoConSaldoFavor,
          facturaElectronica: movData.facturaElectronica || undefined,
        },
      });
    }

    // 2. Buscar en 'separes'
    const snapSep = await db.collection('separes').doc(id).get();
    if (snapSep.exists) {
      const sepData = snapSep.data()!;
      const datosNegocio = await obtenerBrandingNegocio(db, sepData.usuarioId);

      const itemsTransformados = Array.isArray(sepData.items)
        ? sepData.items.map((it: any) => {
            const cant = Number(it.cantidad) || 1;
            const vUnit = parseFloat(it.valor) || 0;
            return {
              descripcion: String(it.descripcion || 'Artículo'),
              cantidad: cant,
              valorUnitario: vUnit,
              valor: vUnit * cant,
            };
          })
        : [];

      return NextResponse.json({
        ok: true,
        datosFactura: {
          ...datosNegocio,
          idTransaccion: snapSep.id,
          tipo: 'separe',
          fecha: serializarFecha(sepData.fechaCreacion),
          nombreCliente: sepData.clienteNombre || 'Cliente',
          celularCliente: sepData.clienteCelular || '',
          registradoPor: sepData.creadoPor || '',
          montoTotal: Number(sepData.total) || 0,
          detalles: itemsTransformados,
          descripcionGeneral: sepData.notas || '',
          montoDescuento: Number(sepData.montoDescuento) || 0,
          saldoNuevo: sepData.saldoPendiente,
          pagoRecibido: Number(sepData.montoPagado) || 0,
        },
      });
    }

    return NextResponse.json(
      { error: 'El comprobante solicitado no fue encontrado o el enlace es inválido.' },
      { status: 404 }
    );
  } catch (error) {
    console.error('[API ticket-publico] Error al consultar comprobante:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al cargar el comprobante.' },
      { status: 500 }
    );
  }
}
