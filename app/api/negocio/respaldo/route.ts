// app/api/negocio/respaldo/route.ts
// Endpoint seguro para validar el cupo de Copias de Seguridad por Plan:
// - Plan Gratuito: 1 Respaldo Básico cada 30 días (1 al mes)
// - Plan Comercio: Respaldos Completos ILIMITADOS (5 hojas: Resumen, Clientes, Inventario + Márgenes, Movimientos y Cierres de Caja)
// - Plan PRO Almacén: Respaldos Completos ILIMITADOS (6 hojas: incluye Planes Separe)

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

function parsearFechaFirestore(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'object' && (typeof val.seconds === 'number' || typeof val._seconds === 'number')) {
    const secs = typeof val.seconds === 'number' ? val.seconds : val._seconds;
    return new Date(secs * 1000);
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function serializarFechaISO(val: any): string | null {
  const d = parsearFechaFirestore(val);
  return d ? d.toISOString() : null;
}

function determinarPlanEfectivo(userData: any): 'gratis' | 'comercio' | 'pro' {
  const planRaw = userData?.plan || 'gratis';
  if (planRaw !== 'pro' && planRaw !== 'comercio') {
    return 'gratis';
  }

  const fechaVence = parsearFechaFirestore(userData?.planVence);
  if (!fechaVence) {
    return planRaw;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venceNorm = new Date(fechaVence);
  venceNorm.setHours(0, 0, 0, 0);

  const diffDias = Math.ceil((venceNorm.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  // Incluye los 3 días de gracia (0, -1, -2)
  if (diffDias >= -2) {
    return planRaw;
  }
  return 'gratis';
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Token de autenticación faltante.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada. Por favor recarga e intenta de nuevo.' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('usuarios').doc(decodedToken.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'No se encontró la cuenta del negocio.' }, { status: 404 });
    }

    const userData = userSnap.data()!;

    // Solo el administrador titular puede generar copias de seguridad del negocio
    if (userData.rol === 'cajero') {
      return NextResponse.json(
        { error: 'Por seguridad, solo el Administrador titular del negocio puede descargar copias de seguridad.' },
        { status: 403 }
      );
    }

    const uid = decodedToken.uid;
    const planEfectivo = determinarPlanEfectivo(userData);
    const ahora = new Date();
    const CICLO_DIAS_MENSUAL = 30;

    // =========================================================================
    // 1. VALIDACIÓN DE ESCALERA DE VALOR POR PLAN
    // =========================================================================
    if (planEfectivo === 'gratis') {
      const ultimaFechaGratis = parsearFechaFirestore(userData.ultimoRespaldoGratisFecha);
      if (ultimaFechaGratis) {
        const msTranscurridos = ahora.getTime() - ultimaFechaGratis.getTime();
        const diasTranscurridos = msTranscurridos / (1000 * 60 * 60 * 24);

        if (diasTranscurridos < CICLO_DIAS_MENSUAL) {
          const proximoDisponible = new Date(ultimaFechaGratis.getTime() + CICLO_DIAS_MENSUAL * 24 * 60 * 60 * 1000);
          const diasRestantes = Math.max(1, Math.ceil(CICLO_DIAS_MENSUAL - diasTranscurridos));
          return NextResponse.json(
            {
              codigo: 'LIMITE_GRATIS_MENSUAL',
              planEfectivo: 'gratis',
              diasRestantes,
              ultimoRespaldoFecha: ultimaFechaGratis.toISOString(),
              proximoDisponibleISO: proximoDisponible.toISOString(),
              error: `En el Plan Gratuito tienes 1 respaldo básico cada 30 días (próximo disponible en ${diasRestantes} ${diasRestantes === 1 ? 'día' : 'días'}). ¡Sube al Plan Comercio o Plan PRO Almacén para descargar copias de seguridad completas e ILIMITADAS cuando quieras con todo tu historial!`
            },
            { status: 403 }
          );
        }
      }
    }
    // Nota: Plan Comercio y Plan PRO Almacén tienen derecho a descargas ILIMITADAS de su información.

    // =========================================================================
    // 2. EXTRACCIÓN DE COLECCIONES DEL NEGOCIO
    // =========================================================================
    const [clientesSnap, inventarioSnap, movimientosSnap, cierresSnap, separesSnap] = await Promise.all([
      adminDb.collection('clientes').where('usuarioId', '==', uid).get(),
      adminDb.collection('inventario').where('usuarioId', '==', uid).get(),
      adminDb.collection('movimientos').where('usuarioId', '==', uid).get(),
      adminDb.collection('cierres_caja').where('usuarioId', '==', uid).get(),
      adminDb.collection('separes').where('usuarioId', '==', uid).get(),
    ]);

    const clientes = clientesSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nombre: data.nombre || '',
          tipoDocumento: data.tipoDocumento || 'CC',
          numeroDocumento: data.numeroDocumento || '',
          dv: data.dv || '',
          celular: data.celular || '',
          email: data.email || '',
          direccion: data.direccion || '',
          deudaTotal: Number(data.deudaTotal) || 0,
          notas: data.notas || '',
          etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas.join(', ') : '',
          fechaCreacion: serializarFechaISO(data.fecha_creacion || data.fechaCreacion),
        };
      })
      .sort((a, b) => (b.deudaTotal || 0) - (a.deudaTotal || 0));

    const inventario = inventarioSnap.docs
      .filter((d) => d.data().activo !== false)
      .map((d) => {
        const data = d.data();
        const esServicio = data.tipoProducto === 'servicio' || data.inventariable === false;
        return {
          id: d.id,
          sku: data.sku || data.codigoBarras || '',
          nombre: data.nombre || '',
          categoria: data.categoria || 'General',
          tipoProducto: esServicio ? 'Servicio' : 'Producto',
          inventariable: !esServicio,
          stock: esServicio ? 0 : Number(data.stock) || 0,
          precioVenta: Number(data.precioVenta) || 0,
          costoCompra: Number(data.costoCompra) || 0,
          fechaActualizacion: serializarFechaISO(data.fechaActualizacion || data.fechaCreacion),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const todosMovimientos = movimientosSnap.docs
      .map((d) => {
        const data = d.data();
        const detallesArr = Array.isArray(data.detalles) ? data.detalles : [];
        const resumenArticulos = detallesArr
          .map((item: any) => `${item.cantidad || 1}x ${item.descripcion || 'Artículo'} ($${Number(item.valorUnitario ?? item.valor ?? 0).toLocaleString('es-CO')})`)
          .join(' | ');

        return {
          id: d.id,
          fecha: serializarFechaISO(data.fecha),
          timestampMs: parsearFechaFirestore(data.fecha)?.getTime() || 0,
          tipo: data.tipo || 'venta',
          clienteNombre: data.clienteNombre || 'Cliente Mostrador',
          descripcion: data.descripcion || resumenArticulos || '',
          resumenArticulos,
          subtotal: Number(data.subtotal) || Number(data.monto) || 0,
          montoDescuento: Number(data.montoDescuento) || 0,
          valorIva: Number(data.valorIva) || 0,
          monto: Number(data.monto) || 0,
          valorMercancia: Number(data.valorMercancia) || Number(data.monto) || 0,
          metodoPago: data.metodoPago || 'efectivo',
          subMetodoPago: data.subMetodoPago || '',
          referenciaPago: data.referenciaPago || '',
          saldoResultante: data.saldoResultante !== undefined ? Number(data.saldoResultante) : null,
          registradoPor: data.registradoPor || userData.nombreUsuario || 'Admin',
          facturaDian: data.facturaElectronica?.numeroFactura
            ? `${data.facturaElectronica.prefijo || ''}${data.facturaElectronica.numeroFactura}`
            : '',
          anulado: data.anulado === true,
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);

    const todosCierres = cierresSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          fechaApertura: serializarFechaISO(data.fechaApertura),
          fechaCierre: serializarFechaISO(data.fechaCierre || data.creadoEn),
          timestampMs: parsearFechaFirestore(data.fechaCierre || data.creadoEn)?.getTime() || 0,
          tipoRegistro: data.tipoRegistro || 'cierre',
          cerradoPorNombre: data.cerradoPorNombre || 'Admin',
          baseInicial: Number(data.baseInicial) || 0,
          ventasEfectivo: Number(data.ventasEfectivo) || 0,
          abonosEfectivo: Number(data.abonosEfectivo) || 0,
          egresosEfectivo: Number(data.egresosEfectivo) || 0,
          devolucionesEfectivo: Number(data.devolucionesEfectivo) || 0,
          totalEfectivoEsperado: Number(data.totalEfectivoEsperado) || 0,
          totalEfectivoReal: Number(data.totalEfectivoReal) || 0,
          diferencia: Number(data.diferencia) || 0,
          tipoDiferencia: data.tipoDiferencia || 'exacto',
          totalVentasDigitales: Number(data.totalVentasDigitales) || 0,
          totalRecaudadoGeneral: Number(data.totalRecaudadoGeneral) || 0,
          totalTransacciones: Number(data.totalTransacciones) || 0,
          notas: data.notas || '',
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);

    const todosSepares = separesSnap.docs
      .map((d) => {
        const data = d.data();
        const itemsArr = Array.isArray(data.items) ? data.items : [];
        const articulosTexto = itemsArr
          .map((i: any) => `${i.cantidad || 1}x ${i.descripcion || 'Artículo'}`)
          .join(' | ');
        return {
          id: d.id,
          fechaCreacion: serializarFechaISO(data.fechaCreacion),
          fechaLimite: serializarFechaISO(data.fechaLimite),
          timestampMs: parsearFechaFirestore(data.fechaCreacion)?.getTime() || 0,
          estado: data.estado || 'activo',
          clienteNombre: data.clienteNombre || '',
          clienteCelular: data.clienteCelular || '',
          articulos: articulosTexto,
          total: Number(data.total) || 0,
          montoPagado: Number(data.montoPagado) || 0,
          saldoPendiente: Number(data.saldoPendiente) || 0,
          cantidadAbonos: Array.isArray(data.abonos) ? data.abonos.length : 0,
          creadoPor: data.creadoPor || 'Admin',
          notas: data.notas || '',
        };
      })
      .sort((a, b) => b.timestampMs - a.timestampMs);

    // =========================================================================
    // 3. REGISTRAR AUDITORÍA DEL RESPALDO EN FIRESTORE
    // =========================================================================
    const updatePayload: Record<string, any> = {
      ultimoRespaldoFecha: FieldValue.serverTimestamp(),
      ultimoRespaldoPlan: planEfectivo,
      totalRespaldosDescargados: FieldValue.increment(1),
    };

    if (planEfectivo === 'gratis') {
      updatePayload.ultimoRespaldoGratisFecha = FieldValue.serverTimestamp();
      updatePayload.respaldoCortesiaUsado = FieldValue.delete();
    } else if (planEfectivo === 'comercio') {
      updatePayload.ultimoRespaldoComercioFecha = FieldValue.serverTimestamp();
    }

    await userRef.update(updatePayload);

    // Estadísticas globales para el Resumen Ejecutivo y el gancho de conversión
    const totalCarteraPorCobrar = clientes.reduce((acc, c) => acc + (c.deudaTotal > 0 ? c.deudaTotal : 0), 0);
    const totalSaldosAFavor = clientes.reduce((acc, c) => acc + (c.deudaTotal < 0 ? Math.abs(c.deudaTotal) : 0), 0);
    const valorInventarioVenta = inventario.reduce((acc, p) => acc + (p.inventariable ? Math.max(0, p.stock) * p.precioVenta : 0), 0);
    const valorInventarioCosto = inventario.reduce((acc, p) => acc + (p.inventariable ? Math.max(0, p.stock) * p.costoCompra : 0), 0);
    const volumenHistoricoMovimientos = todosMovimientos
      .filter((m) => !m.anulado && (m.tipo === 'venta' || m.tipo === 'fiado' || m.tipo === 'entrega_separe'))
      .reduce((acc, m) => acc + (m.valorMercancia || m.monto || 0), 0);

    return NextResponse.json({
      exito: true,
      planEfectivo,
      fechaGeneracionISO: ahora.toISOString(),
      negocio: {
        nombreNegocio: userData.nombreNegocio || 'Mi Negocio',
        nitNegocio: userData.nitNegocio || 'No registrado',
        telefonoNegocio: userData.telefonoNegocio || 'No registrado',
        direccionNegocio: userData.direccionNegocio || 'No registrada',
        correoNegocio: userData.email || decodedToken.email || '',
        nombreAdmin: userData.nombreUsuario || 'Administrador',
        slugNegocio: userData.slugNegocio || '',
      },
      metricas: {
        totalClientes: clientes.length,
        totalCarteraPorCobrar,
        totalSaldosAFavor,
        totalProductos: inventario.length,
        valorInventarioVenta,
        valorInventarioCosto,
        totalMovimientos: todosMovimientos.length,
        volumenHistoricoMovimientos,
        totalCierresCaja: todosCierres.length,
        totalSepares: todosSepares.length,
      },
      datos: {
        clientes: planEfectivo === 'gratis' ? clientes.slice(0, 15) : clientes,
        inventario: planEfectivo === 'gratis' ? inventario.slice(0, 30).map((p) => ({ ...p, costoCompra: 0 })) : inventario,
        movimientos: planEfectivo === 'gratis' ? [] : todosMovimientos,
        cierresCaja: planEfectivo === 'gratis' ? [] : todosCierres,
        separes: planEfectivo === 'pro' ? todosSepares : [],
      },
    });
  } catch (error: any) {
    console.error('Error en /api/negocio/respaldo:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error al generar la copia de seguridad del negocio.' },
      { status: 500 }
    );
  }
}
