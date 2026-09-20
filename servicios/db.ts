// servicios/db.ts
import { collection, addDoc, getDocs, query, doc, updateDoc, where, deleteDoc, getDoc, setDoc, runTransaction, orderBy, limit, startAfter, increment } from "firebase/firestore";
import { db } from "../firebase"; 
import { Cliente, Movimiento } from "../types";

const getDiaActualLabel = () => {
  const nombres = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  return nombres[new Date().getDay()];
};

const calcularActivoPorHorarios = (horarios: any[] = []) => {
  const ahora = new Date();
  const diaHoy = getDiaActualLabel();
  const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

  return (horarios || []).some((h) => {
    if (!h?.activoAuto) return false;
    const dias = h.dias || [];
    if (!dias.includes(diaHoy)) return false;
    const inicio = h.inicio || '00:00';
    const fin = h.fin || '23:59';
    return inicio <= horaActual && horaActual < fin;
  });
};

export const API_DB = {
  // LEGACY: Las operaciones financieras nuevas viven en /app/api/** y no deben
  // ser llamadas desde componentes cliente. Estos helpers se conservan sólo
  // para compatibilidad temporal con scripts internos y migraciones.
  // --------------------------------------------------------
  // CLIENTES
  // --------------------------------------------------------
  obtenerClientes: async (usuarioId: string): Promise<Cliente[]> => {
    const qC = query(collection(db, "clientes"), where("usuarioId", "==", usuarioId));
    const snapC = await getDocs(qC);
    const listaC: Cliente[] = [];
    snapC.forEach((documento) => listaC.push({ id: documento.id, ...documento.data() } as Cliente));
    return listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
  },

  crearCliente: async (datosCliente: Omit<Cliente, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, "clientes"), datosCliente);
    return docRef.id;
  },

  actualizarCliente: async (clienteId: string, datos: Partial<Cliente>): Promise<void> => {
    await updateDoc(doc(db, "clientes", clienteId), datos);
  },

  eliminarCliente: async (clienteId: string, opciones?: { omitirValidacionDeuda?: boolean }): Promise<void> => {
    // 1. Validar existencia del cliente
    const clientRef = doc(db, "clientes", clienteId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return;

    const data = clientSnap.data();

    // 2. Bloquear eliminación si tiene Planes Separe activos (integridad de mercancía y abonos)
    const qSep = query(collection(db, "separes"), where("clienteId", "==", clienteId), where("estado", "==", "activo"));
    const snapSep = await getDocs(qSep);
    if (!snapSep.empty) {
      throw new Error("No se puede eliminar el cliente: tiene Planes Separe activos pendientes de liquidar o cancelar.");
    }

    // 3. Bloquear eliminación si la cartera está viva y no se autorizó asiento contable explícito
    const deuda = Number(data?.deudaTotal || 0);
    if (deuda !== 0 && !opciones?.omitirValidacionDeuda) {
      throw new Error("No se puede eliminar un cliente con saldo pendiente o saldo a favor sin un asiento contable previo.");
    }

    await deleteDoc(clientRef);
  },

  // --------------------------------------------------------
  // MOVIMIENTOS (VENTAS, FIADOS, ABONOS)
  // --------------------------------------------------------
  obtenerMovimientos: async (usuarioId: string): Promise<Movimiento[]> => {
    const qM = query(collection(db, "movimientos"), where("usuarioId", "==", usuarioId));
    const snapM = await getDocs(qM);
    const listaM: Movimiento[] = [];
    snapM.forEach((documento) => listaM.push({ id: documento.id, ...documento.data() } as Movimiento));
    return listaM.sort((a, b) => (b.fecha?.toMillis ? b.fecha.toMillis() : 0) - (a.fecha?.toMillis ? a.fecha.toMillis() : 0));
  },

  obtenerMovimientosPaginados: async (
    usuarioId: string,
    tamanoPagina: number = 30,
    ultimoDocSnapshot?: any,
    clienteId?: string
  ): Promise<{ movimientos: Movimiento[]; ultimoDoc: any; hayMas: boolean }> => {
    try {
      let qM;
      if (clienteId && clienteId !== 'todos') {
        if (ultimoDocSnapshot) {
          qM = query(
            collection(db, "movimientos"),
            where("usuarioId", "==", usuarioId),
            where("clienteId", "==", clienteId),
            orderBy("fecha", "desc"),
            startAfter(ultimoDocSnapshot),
            limit(tamanoPagina + 1)
          );
        } else {
          qM = query(
            collection(db, "movimientos"),
            where("usuarioId", "==", usuarioId),
            where("clienteId", "==", clienteId),
            orderBy("fecha", "desc"),
            limit(tamanoPagina + 1)
          );
        }
      } else {
        if (ultimoDocSnapshot) {
          qM = query(
            collection(db, "movimientos"),
            where("usuarioId", "==", usuarioId),
            orderBy("fecha", "desc"),
            startAfter(ultimoDocSnapshot),
            limit(tamanoPagina + 1)
          );
        } else {
          qM = query(
            collection(db, "movimientos"),
            where("usuarioId", "==", usuarioId),
            orderBy("fecha", "desc"),
            limit(tamanoPagina + 1)
          );
        }
      }

      const snapM = await getDocs(qM);
      const docs = snapM.docs;
      const hayMas = docs.length > tamanoPagina;
      const docsAProcesar = hayMas ? docs.slice(0, tamanoPagina) : docs;
      const nuevoUltimoDoc = docsAProcesar.length > 0 ? docsAProcesar[docsAProcesar.length - 1] : null;

      const listaM: Movimiento[] = [];
      docsAProcesar.forEach((documento) => {
        listaM.push({ id: documento.id, ...documento.data() } as Movimiento);
      });

      return {
        movimientos: listaM,
        ultimoDoc: nuevoUltimoDoc,
        hayMas
      };
    } catch (error: any) {
      console.warn("Consulta paginada usando fallback acotado:", error?.message || error);
      // PARCHE P1-PERF: Nunca descargar la colección entera sin límite.
      // Se acota a máximo (tamanoPagina * 2) para proteger la memoria y cuota.
      const maxDocsFallback = Math.min(tamanoPagina * 2, 60);
      const qFallback = query(
        collection(db, "movimientos"), 
        where("usuarioId", "==", usuarioId),
        limit(maxDocsFallback)
      );
      const snapFallback = await getDocs(qFallback);
      let listaM: Movimiento[] = [];
      snapFallback.forEach((d) => listaM.push({ id: d.id, ...d.data() } as Movimiento));
      if (clienteId && clienteId !== 'todos') {
        listaM = listaM.filter(m => m.clienteId === clienteId);
      }
      listaM.sort((a, b) => (b.fecha?.toMillis ? b.fecha.toMillis() : 0) - (a.fecha?.toMillis ? a.fecha.toMillis() : 0));
      return {
        movimientos: listaM.slice(0, tamanoPagina),
        ultimoDoc: null,
        hayMas: false
      };
    }
  },

  obtenerMovimientosPorRango: async (
    usuarioId: string,
    fechaInicio: Date
  ): Promise<Movimiento[]> => {
    try {
      const qM = query(
        collection(db, "movimientos"),
        where("usuarioId", "==", usuarioId),
        where("fecha", ">=", fechaInicio)
      );
      const snapM = await getDocs(qM);
      const listaM: Movimiento[] = [];
      snapM.forEach((doc) => listaM.push({ id: doc.id, ...doc.data() } as Movimiento));
      return listaM.sort((a, b) => (b.fecha?.toMillis ? b.fecha.toMillis() : 0) - (a.fecha?.toMillis ? a.fecha.toMillis() : 0));
    } catch (error) {
      console.warn("Consulta por rango usando fallback:", error);
      const all = await API_DB.obtenerMovimientos(usuarioId);
      const msInicio = fechaInicio.getTime();
      return all.filter(m => (m.fecha?.toMillis ? m.fecha.toMillis() : (m.fecha instanceof Date ? m.fecha.getTime() : 0)) >= msInicio);
    }
  },

  obtenerMovimientosDeCliente: async (clienteId: string): Promise<Movimiento[]> => {
    const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
    const snapM = await getDocs(qM);
    const listaM: Movimiento[] = [];
    snapM.forEach((documento) => listaM.push({ id: documento.id, ...documento.data() } as Movimiento));
    return listaM.sort((a, b) => (b.fecha?.toMillis ? b.fecha.toMillis() : 0) - (a.fecha?.toMillis ? a.fecha.toMillis() : 0));
  },

  crearMovimiento: async (datosMovimiento: Omit<Movimiento, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, "movimientos"), datosMovimiento);
    return docRef.id;
  },

  // --------------------------------------------------------
  // PROCESAMIENTO INTELIGENTE DE DEVOLUCIONES (NOTA CRÉDITO)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/devoluciones/registrar. */
  procesarDevolucion: async (
    movimientoOrigen: Movimiento,
    articulosDevueltos: any[],
    metodoDevolucion: 'saldo_a_favor' | 'efectivo',
    registradoPor: string
  ): Promise<{ movimientoId: string, nuevoSaldoCliente?: number }> => {
    return await runTransaction(db, async (transaction) => {
      if (!movimientoOrigen?.id || !Array.isArray(articulosDevueltos) || articulosDevueltos.length === 0) {
        throw new Error("La devolución no contiene una venta y artículos válidos.");
      }
      if (!['saldo_a_favor', 'efectivo'].includes(metodoDevolucion)) {
        throw new Error("El método de devolución no es válido.");
      }

      const origenRef = doc(db, "movimientos", movimientoOrigen.id);
      const origenSnap = await transaction.get(origenRef);
      if (!origenSnap.exists()) {
        throw new Error("La venta original ya no existe.");
      }

      const origenData = origenSnap.data() as any;
      if (!['venta', 'fiado'].includes(origenData.tipo)) {
        throw new Error("Sólo se pueden devolver ventas o fiados.");
      }

      const detallesOrigen = Array.isArray(origenData.detalles) ? origenData.detalles : [];
      if (detallesOrigen.length === 0) {
        throw new Error("La venta original no contiene artículos devolvibles.");
      }

      const controlDevolucionRef = doc(db, "controles_devolucion", movimientoOrigen.id);
      const controlDevolucionSnap = await transaction.get(controlDevolucionRef);
      const cantidadesDevueltas = new Map<number, number>();
      if (controlDevolucionSnap.exists()) {
        const cantidadesControl = controlDevolucionSnap.data().cantidadesPorDetalle || {};
        Object.entries(cantidadesControl).forEach(([indice, cantidad]) => {
          cantidadesDevueltas.set(Number(indice), Number(cantidad) || 0);
        });
      } else {
        // Migra devoluciones antiguas al contador durante la primera operación nueva.
        const devolucionesPreviasQuery = query(
          collection(db, "movimientos"),
          where("movimientoOrigenId", "==", movimientoOrigen.id),
          where("tipo", "==", "devolucion")
        );
        const devolucionesPreviasSnap = await getDocs(devolucionesPreviasQuery);
        devolucionesPreviasSnap.forEach((devolucionDoc) => {
          const articulos = devolucionDoc.data().articulosDevueltos || [];
          articulos.forEach((art: any) => {
            if (Number.isInteger(art.detalleIndex)) {
              cantidadesDevueltas.set(
                art.detalleIndex,
                (cantidadesDevueltas.get(art.detalleIndex) || 0) + Number(art.cantidad || 0)
              );
            }
          });
        });
      }

      const articulosValidados = articulosDevueltos.map((art: any) => {
        const detalleIndex = Number.isInteger(art.detalleIndex)
          ? art.detalleIndex
          : detallesOrigen.findIndex((detalle: any) =>
              (art.productoId && detalle.productoId === art.productoId) ||
              (!art.productoId && detalle.descripcion === art.descripcion)
            );
        const detalleOrigen = detallesOrigen[detalleIndex];
        const cantidad = Number(art.cantidad);

        if (!detalleOrigen || !Number.isInteger(cantidad) || cantidad <= 0) {
          throw new Error("La devolución contiene un artículo o cantidad inválida.");
        }

        const cantidadOriginal = Number(detalleOrigen.cantidad || 1);
        const cantidadYaDevuelta = cantidadesDevueltas.get(detalleIndex) || 0;
        if (cantidad + cantidadYaDevuelta > cantidadOriginal) {
          throw new Error(`La cantidad devuelta supera la cantidad vendida para "${detalleOrigen.descripcion || 'artículo'}".`);
        }

        const cantidadDetalle = Number(detalleOrigen.cantidad || 1);
        const valorUnitarioBruto = Number(detalleOrigen.valorUnitario) ||
          (Number(detalleOrigen.valor || 0) / cantidadDetalle);
        if (!Number.isFinite(valorUnitarioBruto) || valorUnitarioBruto < 0) {
          throw new Error("El valor del artículo original no es válido.");
        }

        const montoDescuento = Number(origenData.montoDescuento || 0);
        const totalBruto = detallesOrigen.reduce((sum: number, detalle: any) => {
          const cantidadItem = Number(detalle.cantidad || 1);
          const unitario = Number(detalle.valorUnitario) || (Number(detalle.valor || 0) / cantidadItem);
          return sum + (cantidadItem * unitario);
        }, 0);
        const factorDescuento = totalBruto > 0 && montoDescuento > 0 && montoDescuento < totalBruto
          ? (totalBruto - montoDescuento) / totalBruto
          : 1;
        const valorUnitarioNeto = Math.round(valorUnitarioBruto * factorDescuento);

        cantidadesDevueltas.set(detalleIndex, cantidadYaDevuelta + cantidad);
        return {
          ...art,
          detalleIndex,
          descripcion: detalleOrigen.descripcion || art.descripcion,
          cantidad,
          valorUnitario: valorUnitarioNeto,
          subtotal: cantidad * valorUnitarioNeto
        };
      });

      const totalDevolver = articulosValidados.reduce((sum, art) => sum + art.subtotal, 0);
      if (!Number.isFinite(totalDevolver) || totalDevolver <= 0) {
        throw new Error("El valor total de la devolución no es válido.");
      }

      const cantidadesPorDetalle: Record<string, number> = {};
      cantidadesDevueltas.forEach((cantidad, indice) => {
        cantidadesPorDetalle[String(indice)] = cantidad;
      });
      transaction.set(controlDevolucionRef, {
        usuarioId: origenData.usuarioId,
        movimientoOrigenId: movimientoOrigen.id,
        cantidadesPorDetalle,
        fechaActualizacion: new Date()
      }, { merge: true });

      // 2. Ajuste de cartera inteligente:
      // Si el cliente tiene deuda pendiente (> 0), la devolución AMORTIZA esa deuda primero
      // para evitar que el negocio entregue efectivo físico mientras el cliente le debe dinero.
      let nuevoSaldo: number | undefined = undefined;
      let montoEfectivoDevolver = 0;
      let montoAmortizadoDeuda = 0;

      if (origenData.clienteId && origenData.clienteId !== 'mostrador') {
        const clienteRef = doc(db, "clientes", origenData.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (!clienteSnap.exists()) {
          throw new Error("El cliente asociado a la venta ya no existe.");
        }
        const saldoActual = Number(clienteSnap.data().deudaTotal || 0);
        if (!Number.isFinite(saldoActual)) {
          throw new Error("El saldo actual del cliente no es válido.");
        }

          if (origenData.tipo === 'fiado' || metodoDevolucion === 'saldo_a_favor') {
            // Amortización total de deuda o incremento de saldo a favor
            nuevoSaldo = saldoActual - totalDevolver;
            transaction.update(clienteRef, { deudaTotal: nuevoSaldo });
            montoAmortizadoDeuda = totalDevolver;
          } else {
            // metodoDevolucion === 'efectivo'
            if (saldoActual > 0) {
              // El cliente debe dinero: se amortiza su deuda pendiente prioritariamente
              montoAmortizadoDeuda = Math.min(saldoActual, totalDevolver);
              montoEfectivoDevolver = totalDevolver - montoAmortizadoDeuda;
              nuevoSaldo = saldoActual - montoAmortizadoDeuda;
              transaction.update(clienteRef, { deudaTotal: nuevoSaldo });
            } else {
              // El cliente está al día o tiene saldo a favor: se entrega el efectivo completo
              montoEfectivoDevolver = totalDevolver;
            }
        }
      } else {
        // Venta de mostrador anónima
        montoEfectivoDevolver = totalDevolver;
      }

      // 3. Restore inventory
      for (const art of articulosValidados) {
        if (art.productoId) {
          const invRef = doc(db, "inventario", art.productoId);
          const invSnap = await transaction.get(invRef);
          if (invSnap.exists()) {
             const stockActual = Number(invSnap.data().stock || 0);
             transaction.update(invRef, { stock: stockActual + art.cantidad });
          }
        }
      }

      // 4. Create the new return transaction
      const movRef = doc(collection(db, "movimientos"));
      const metodoFinal = montoEfectivoDevolver > 0 && montoAmortizadoDeuda > 0 
        ? 'mixto' 
        : (montoEfectivoDevolver > 0 ? 'efectivo' : 'saldo_a_favor');

      const movData: any = {
        usuarioId: origenData.usuarioId,
        clienteId: origenData.clienteId,
        clienteNombre: origenData.clienteNombre,
        tipo: 'devolucion',
        monto: totalDevolver,
        montoEfectivoReembolsado: montoEfectivoDevolver,
        montoAmortizadoCartera: montoAmortizadoDeuda,
        descripcion: `Devolución de mercancía (${montoAmortizadoDeuda > 0 ? `Amortizado: $${montoAmortizadoDeuda.toLocaleString('es-CO')}` : ''}${montoEfectivoDevolver > 0 ? ` Efectivo: $${montoEfectivoDevolver.toLocaleString('es-CO')}` : ''})`,
        fecha: new Date(),
        registradoPor,
        metodoDevolucion: metodoFinal,
        movimientoOrigenId: movimientoOrigen.id,
        origenTipo: origenData.tipo,
        articulosDevueltos: articulosValidados,
        saldoResultante: nuevoSaldo,
        esPublico: true
      };

      Object.keys(movData).forEach(k => movData[k] === undefined && delete movData[k]);

      transaction.set(movRef, movData as any);

      return { movimientoId: movRef.id, nuevoSaldoCliente: nuevoSaldo };
    });
  },

  // --------------------------------------------------------
  // TRANSACCIÓN ATÓMICA UNIFICADA: VENTA + STOCK + FIADO (P1-TX-01)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/ventas/registrar. */
  ejecutarVentaCompletaAtomo: async (params: {
    usuarioId: string;
    clienteId?: string;
    registradoPor: string;
    montoVentaReal: number;
    descripcionVenta: string;
    detalles: any[];
    metodoPago: string;
    referenciaPago?: string;
    subtotal?: number;
    valorIva?: number;
    porcentajeIva?: number;
    descuentoTipo?: string | null;
    descuentoValor?: number;
    montoDescuento?: number;
    // Items de inventario a descontar:
    itemsInventario: Array<{
      productoId: string;
      cantidad: number;
    }>;
    // Si hay fiado / crédito adicional:
    fiarFaltante?: boolean;
    montoFiado?: number;
    descripcionFiado?: string;
  }): Promise<{
    movimientoVentaId?: string;
    movimientoFiadoId?: string;
    nuevoSaldoCliente?: number;
  }> => {
    return await runTransaction(db, async (transaction) => {
      if (!Number.isFinite(params.montoVentaReal) || params.montoVentaReal < 0) {
        throw new Error("El monto real de la venta no es válido.");
      }
      if (params.fiarFaltante && (!Number.isFinite(params.montoFiado) || (params.montoFiado || 0) <= 0)) {
        throw new Error("El monto fiado no es válido.");
      }

      // 1. REGLA FIRESTORE OBLIGATORIA: TODAS LAS LECTURAS PRIMERO
      let nuevoSaldoCliente: number | undefined = undefined;
      let clienteRef: any = null;

      let consumoSaldoFavor = 0;
      let montoFiadoReal = 0;

      if (
        params.fiarFaltante &&
        params.clienteId &&
        params.clienteId !== 'mostrador' &&
        typeof params.montoFiado === 'number' &&
        params.montoFiado > 0
      ) {
        clienteRef = doc(db, "clientes", params.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (!clienteSnap.exists()) {
          throw new Error("El cliente seleccionado ya no existe.");
        }

        const cData = clienteSnap.data() as any;
        const deudaActual = Number(cData?.deudaTotal || 0);

        if (!Number.isFinite(deudaActual)) {
          throw new Error("El saldo actual del cliente no es válido.");
        }

        if (deudaActual < 0) {
          const saldoFavorDisponible = Math.abs(deudaActual);
          consumoSaldoFavor = Math.min(saldoFavorDisponible, params.montoFiado || 0);
          montoFiadoReal = (params.montoFiado || 0) - consumoSaldoFavor;
        } else {
          montoFiadoReal = params.montoFiado || 0;
        }

        nuevoSaldoCliente = deudaActual + (params.montoFiado || 0);
      }

      // Lectura y validación de existencias en fase de lectura para evitar sobreventas concurrentes
      const cantidadesConsolidadas = new Map<string, number>();
      for (const item of params.itemsInventario || []) {
        if (!item.productoId || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
          throw new Error("Los artículos de inventario no tienen cantidades válidas.");
        }
        cantidadesConsolidadas.set(
          item.productoId,
          (cantidadesConsolidadas.get(item.productoId) || 0) + item.cantidad
        );
      }

      const stockDocsMap = new Map<string, any>();
      for (const [productoId, cantidad] of cantidadesConsolidadas) {
        const prodRef = doc(db, "inventario", productoId);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists()) {
          throw new Error("Uno de los productos seleccionados ya no existe.");
        }

        const dataInv = prodSnap.data() as any;
        const stockActual = Number(dataInv.stock || 0);
        if (!Number.isFinite(stockActual) || stockActual < 0) {
          throw new Error(`El stock de "${dataInv.nombre || productoId}" no es válido.`);
        }
        if (dataInv.tipoProducto !== 'servicio' && dataInv.inventariable !== false) {
          if (cantidad > stockActual) {
            throw new Error(`¡Sin stock suficiente de "${dataInv.nombre}"! Solicitado: ${cantidad}, Quedan: ${stockActual}`);
            }
        }
        stockDocsMap.set(productoId, prodRef);
      }

      // 2. TODAS LAS ESCRITURAS DESPUÉS
      // a) Descontar stock de los productos inventariables
      for (const [productoId, cantidad] of cantidadesConsolidadas) {
        const prodRef = stockDocsMap.get(productoId);
        transaction.update(prodRef, {
          stock: increment(-cantidad)
        });
      }

      // b) Si hay saldo a crédito, actualizar deudaTotal del cliente
      if (clienteRef && nuevoSaldoCliente !== undefined) {
        transaction.update(clienteRef, {
          deudaTotal: nuevoSaldoCliente
        });
      }

      // c) Crear movimiento de venta (si se recibió algún pago O se consumió saldo a favor)
      let movimientoVentaId: string | undefined = undefined;
      const totalVentaRegistrar = params.montoVentaReal + consumoSaldoFavor;
      
      if (totalVentaRegistrar > 0) {
        const movVentaRef = doc(collection(db, "movimientos"));
        movimientoVentaId = movVentaRef.id;
        const movVentaData: Record<string, any> = {
          clienteId: params.clienteId || 'mostrador',
          usuarioId: params.usuarioId,
          tipo: 'venta',
          monto: totalVentaRegistrar,
          descripcion: params.descripcionVenta,
          detalles: params.detalles,
          fecha: new Date(),
          registradoPor: params.registradoPor,
          metodoPago: params.montoVentaReal > 0 ? params.metodoPago : 'saldo_interno',
          montoPagadoConSaldoFavor: consumoSaldoFavor > 0 ? consumoSaldoFavor : undefined,
          referenciaPago: params.referenciaPago || null,
          subtotal: params.subtotal,
          valorIva: params.valorIva,
          porcentajeIva: params.porcentajeIva,
          descuentoTipo: params.descuentoTipo || null,
          descuentoValor: params.descuentoValor,
          montoDescuento: params.montoDescuento,
          // SEC-01: Marcar como público para que la regla de Firestore permita acceso
          // desde el comprobante público /t/[id] sin exponer todos los documentos.
          esPublico: true
        };
        Object.keys(movVentaData).forEach(k => movVentaData[k] === undefined && delete movVentaData[k]);
        transaction.set(movVentaRef, movVentaData);
      }

      // d) Crear movimiento de fiado (solo si hubo crédito real)
      let movimientoFiadoId: string | undefined = undefined;
      if (montoFiadoReal > 0 && params.clienteId) {
        const movFiadoRef = doc(collection(db, "movimientos"));
        movimientoFiadoId = movFiadoRef.id;
        const movFiadoData: Record<string, any> = {
          clienteId: params.clienteId,
          usuarioId: params.usuarioId,
          tipo: 'fiado',
          monto: montoFiadoReal,
          descripcion: params.descripcionFiado || 'Saldo pendiente de venta',
          detalles: params.detalles,
          fecha: new Date(),
          registradoPor: params.registradoPor,
          metodoPago: 'fiado',
          saldoResultante: nuevoSaldoCliente,
          esPublico: true
        };
        Object.keys(movFiadoData).forEach(k => movFiadoData[k] === undefined && delete movFiadoData[k]);
        transaction.set(movFiadoRef, movFiadoData);
      }

      return {
        movimientoVentaId,
        movimientoFiadoId,
        nuevoSaldoCliente
      };
    });
  },

  // --------------------------------------------------------
  // REGISTRO SEGURO Y ATÓMICO CON TRANSACCIÓN (INDIVIDUAL)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/movimientos/registrar. */
  registrarMovimientoConTransaccion: async (
    datosMovimiento: Omit<Movimiento, 'id'>,
    opciones?: {
      ajustarSaldoCliente?: boolean;
      cambioDeuda?: number; // Valor numérico: positivo suma a deudaTotal, negativo resta
    }
  ): Promise<{ movimientoId: string; nuevoSaldoCliente?: number }> => {
    return await runTransaction(db, async (transaction) => {
      let nuevoSaldo: number | undefined = undefined;

      if (
        datosMovimiento.clienteId &&
        datosMovimiento.clienteId !== 'mostrador' &&
        opciones?.ajustarSaldoCliente &&
        typeof opciones?.cambioDeuda === 'number'
      ) {
        const clienteRef = doc(db, "clientes", datosMovimiento.clienteId);
        const clienteSnap = await transaction.get(clienteRef);

        if (clienteSnap.exists()) {
          const clienteData = clienteSnap.data();
          const deudaActual = Number(clienteData.deudaTotal || 0);
          nuevoSaldo = deudaActual + opciones.cambioDeuda;
          transaction.update(clienteRef, { deudaTotal: nuevoSaldo, fechaUltimoMovimiento: new Date() });
        }
      }

      const nuevoMovRef = doc(collection(db, "movimientos"));
      const movimientoAGuardar: Record<string, any> = {};
      Object.entries(datosMovimiento).forEach(([k, v]) => {
        if (v !== undefined) {
          movimientoAGuardar[k] = v;
        }
      });
      if (nuevoSaldo !== undefined) {
        movimientoAGuardar.saldoResultante = nuevoSaldo;
      }
      transaction.set(nuevoMovRef, movimientoAGuardar);

      return {
        movimientoId: nuevoMovRef.id,
        nuevoSaldoCliente: nuevoSaldo
      };
    });
  },

  // --------------------------------------------------------
  // TRANSACCIÓN ATÓMICA: ABONO A PLAN SEPARE (P1-TX-02)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/separes/abonar. */
  ejecutarAbonoSepareAtomo: async (params: {
    separeId: string;
    clienteId?: string;
    usuarioId: string;
    montoAbono: number;
    metodoPago: string;
    subMetodoPago?: string;
    referenciaPago?: string;
    registradoPor: string;
    clienteNombre: string;
    detallesItems?: any[];
  }): Promise<{
    movimientoId: string;
    nuevoSaldoPendiente: number;
    nuevoMontoPagado: number;
  }> => {
    return await runTransaction(db, async (transaction) => {
      // 1. REGLA FIRESTORE: Lectura obligatoria primero
      const separeRef = doc(db, "separes", params.separeId);
      const separeSnap = await transaction.get(separeRef);

      if (!separeSnap.exists()) {
        throw new Error("El Plan Separe no existe o fue eliminado.");
      }

      const separeData = separeSnap.data() as any;

      if (separeData.estado === 'cancelado') {
        throw new Error("No se pueden registrar abonos a un Plan Separe cancelado.");
      }
      if (separeData.estado === 'completado') {
        throw new Error("Este Plan Separe ya se encuentra completamente pagado y entregado.");
      }

      const saldoActual = Number(separeData.saldoPendiente || 0);
      const montoPagadoActual = Number(separeData.montoPagado || 0);
      const nuevoSaldoPendiente = Math.max(0, saldoActual - params.montoAbono);
      const nuevoMontoPagado = montoPagadoActual + params.montoAbono;

      // PARCHE P1-FIN-04: Soporte para consumir saldo a favor en abonos de Separe
      let clienteRef: any = null;
      let nuevoSaldoCliente: number | undefined = undefined;

      if (params.metodoPago === 'saldo_interno' && params.clienteId) {
        clienteRef = doc(db, "clientes", params.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (clienteSnap.exists()) {
          const cData = clienteSnap.data() as any;
          const deudaActual = Number(cData?.deudaTotal || 0);
          if (deudaActual >= 0 || Math.abs(deudaActual) < params.montoAbono) {
            throw new Error(`El cliente no tiene suficiente Saldo a Favor para cubrir este abono ($${params.montoAbono.toLocaleString('es-CO')}). Saldo disponible: $${Math.abs(deudaActual < 0 ? deudaActual : 0).toLocaleString('es-CO')}`);
          }
          nuevoSaldoCliente = deudaActual + params.montoAbono;
        } else {
          throw new Error("El cliente no fue encontrado para validar su Saldo a Favor.");
        }
      }

      const nuevoAbonoItem: Record<string, any> = {
        id: `abono_${Date.now()}`,
        monto: params.montoAbono,
        metodoPago: params.metodoPago,
        fecha: new Date(),
        registradoPor: params.registradoPor || "Vendedor"
      };
      if (params.subMetodoPago?.trim()) nuevoAbonoItem.subMetodoPago = params.subMetodoPago.trim();
      if (params.referenciaPago?.trim()) nuevoAbonoItem.referenciaPago = params.referenciaPago.trim();

      const abonosActualizados = Array.isArray(separeData.abonos) 
        ? [...separeData.abonos, nuevoAbonoItem] 
        : [nuevoAbonoItem];

      // 2. Escrituras: Actualizar Separe + Cliente + Registrar Movimiento
      transaction.update(separeRef, {
        abonos: abonosActualizados,
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente
      });

      if (clienteRef && nuevoSaldoCliente !== undefined) {
        transaction.update(clienteRef, {
          deudaTotal: nuevoSaldoCliente
        });
      }

      const movRef = doc(collection(db, "movimientos"));
      const movPayload: Record<string, any> = {
        clienteId: params.clienteId || null,
        clienteNombre: params.clienteNombre,
        usuarioId: params.usuarioId,
        tipo: 'abono',
        monto: params.montoAbono,
        descripcion: `Abono a Plan Separe - ${params.clienteNombre}`,
        detalles: params.detallesItems || separeData.items || [],
        fecha: new Date(),
        registradoPor: params.registradoPor,
        metodoPago: params.metodoPago,
        idSepareOrigen: params.separeId,
        saldoResultanteSepare: nuevoSaldoPendiente
      };
      if (params.subMetodoPago?.trim()) movPayload.subMetodoPago = params.subMetodoPago.trim();
      if (params.referenciaPago?.trim()) movPayload.referenciaPago = params.referenciaPago.trim();

      transaction.set(movRef, movPayload);

      return {
        movimientoId: movRef.id,
        nuevoSaldoPendiente,
        nuevoMontoPagado
      };
    });
  },

  // --------------------------------------------------------
  // TRANSACCIÓN ATÓMICA: CREACIÓN DE PLAN SEPARE + STOCK + ABONO (P1-TX-03)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/separes/crear. */
  ejecutarCreacionSepareAtomo: async (params: {
    separeData: Record<string, any>;
    abonoInicial: number;
    metodoPago: string;
    subMetodoPago?: string;
    referenciaPago?: string;
    registradoPor: string;
    itemsInventario: Array<{ productoId: string; cantidad: number }>;
  }): Promise<{
    separeId: string;
    movimientoAbonoId?: string;
  }> => {
    return await runTransaction(db, async (transaction) => {
      // 1. Crear documento de Separe
      const separeRef = doc(collection(db, "separes"));
      const separePayload = {
        ...params.separeData,
        fechaCreacion: new Date()
      };
      transaction.set(separeRef, separePayload);

      // 2. Si hubo abono inicial, registrar el ingreso contable indivisible
      let movimientoAbonoId: string | undefined = undefined;
      if (params.abonoInicial > 0) {
        const movRef = doc(collection(db, "movimientos"));
        movimientoAbonoId = movRef.id;
        const movPayload: Record<string, any> = {
          clienteId: params.separeData.clienteId || null,
          clienteNombre: params.separeData.clienteNombre || "Cliente",
          usuarioId: params.separeData.usuarioId,
          tipo: 'abono',
          subtipo: 'abono_inicial_separe',
          monto: params.abonoInicial,
          descripcion: `Abono inicial Plan Separe - ${params.separeData.clienteNombre || 'Cliente'}`,
          detalles: params.separeData.items || [],
          fecha: new Date(),
          registradoPor: params.registradoPor,
          metodoPago: params.metodoPago,
          idSepareOrigen: separeRef.id
        };
        if (params.subMetodoPago?.trim()) movPayload.subMetodoPago = params.subMetodoPago.trim();
        if (params.referenciaPago?.trim()) movPayload.referenciaPago = params.referenciaPago.trim();

        transaction.set(movRef, movPayload);
      }

      // 3. Descontar stock de inventario de forma unificada
      for (const item of params.itemsInventario) {
        if (item.productoId && item.cantidad > 0) {
          const invRef = doc(db, "inventario", item.productoId);
          transaction.update(invRef, {
            stock: increment(-item.cantidad)
          });
        }
      }

      return {
        separeId: separeRef.id,
        movimientoAbonoId
      };
    });
  },

  // --------------------------------------------------------
  // TRANSACCIÓN ATÓMICA: CANCELACIÓN DE PLAN SEPARE + STOCK + DEVOLUCIÓN (P1-TX-04)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/separes/cancelar. */
  ejecutarCancelacionSepareAtomo: async (params: {
    separeId: string;
    usuarioId: string;
    motivo: string;
    registradoPor: string;
    metodoPago?: string; // FIN-03: Método de pago real usado por el cliente al abonar
    itemsDevolver: Array<{ productoId: string; cantidad: number }>;
  }): Promise<{
    montoDevuelto: number;
    movimientoEgresoId?: string;
  }> => {
    return await runTransaction(db, async (transaction) => {
      // 1. Lectura del Separe
      const separeRef = doc(db, "separes", params.separeId);
      const separeSnap = await transaction.get(separeRef);

      if (!separeSnap.exists()) {
        throw new Error("El Plan Separe no existe.");
      }

      const separeData = separeSnap.data() as any;

      if (separeData.estado === 'cancelado') {
        throw new Error("Este Plan Separe ya fue cancelado previamente.");
      }
      if (separeData.estado === 'completado') {
        throw new Error("Un Plan Separe ya entregado no puede ser cancelado.");
      }

      const montoDevuelto = Number(separeData.montoPagado || 0);

      // 2. Marcar separe como cancelado
      transaction.update(separeRef, {
        estado: 'cancelado',
        fechaCancelado: new Date(),
        notaCancelacion: params.motivo,
        montoPagadoAlCancelar: montoDevuelto
      });

      // 3. Si hubo dinero recibido, asentar egreso/devolución contable
      let movimientoEgresoId: string | undefined = undefined;
      const metodoReembolso = params.metodoPago || separeData.metodoPago || 'efectivo';

      if (montoDevuelto > 0) {
        if (metodoReembolso === 'saldo_interno' && separeData.clienteId) {
          // Reintegrar a la cartera del cliente como saldo a favor si se pagó con saldo interno
          const clienteRef = doc(db, "clientes", separeData.clienteId);
          const clienteSnap = await transaction.get(clienteRef);
          if (clienteSnap.exists()) {
            transaction.update(clienteRef, {
              deudaTotal: increment(-montoDevuelto)
            });
          }
        }

        const movRef = doc(collection(db, "movimientos"));
        movimientoEgresoId = movRef.id;
        transaction.set(movRef, {
          clienteId: separeData.clienteId || null,
          clienteNombre: separeData.clienteNombre || "Cliente",
          usuarioId: params.usuarioId,
          tipo: 'egreso',
          categoria: 'devolucion_separe',
          concepto: `Devolución cancelación Plan Separe - ${separeData.clienteNombre || 'Cliente'}`,
          monto: montoDevuelto,
          descripcion: `Devolución de $${montoDevuelto.toLocaleString('es-CO')} por cancelación de separe (${params.motivo})`,
          fecha: new Date(),
          registradoPor: params.registradoPor,
          metodoPago: metodoReembolso,
          idSepareOrigen: params.separeId,
          esPublico: true
        });
      }

      // 4. Restaurar stock a inventario de forma segura (validando existencia previa)
      for (const item of params.itemsDevolver) {
        if (item.productoId && item.cantidad > 0) {
          const invRef = doc(db, "inventario", item.productoId);
          const invSnap = await transaction.get(invRef);
          if (invSnap.exists()) {
            transaction.update(invRef, {
              stock: increment(item.cantidad)
            });
          }
        }
      }

      return {
        montoDevuelto,
        movimientoEgresoId
      };
    });
  },

  // --------------------------------------------------------
  // TRANSACCIÓN ATÓMICA: ENTREGA / LIQUIDACIÓN DE PLAN SEPARE (P1-TX-05)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/separes/entregar. */
  ejecutarEntregaSepareAtomo: async (params: {
    separeId: string;
    usuarioId: string;
    registradoPor: string;
  }): Promise<{
    entregaMovimientoId: string;
  }> => {
    return await runTransaction(db, async (transaction) => {
      const separeRef = doc(db, "separes", params.separeId);
      const separeSnap = await transaction.get(separeRef);

      if (!separeSnap.exists()) {
        throw new Error("El Plan Separe no existe.");
      }

      const separeData = separeSnap.data() as any;

      if (separeData.estado === 'completado') {
        throw new Error("Este Plan Separe ya fue entregado y liquidado previamente.");
      }
      if (separeData.estado === 'cancelado') {
        throw new Error("Este Plan Separe se encuentra cancelado y no puede ser entregado.");
      }
      if (Number(separeData.saldoPendiente || 0) > 0) {
        throw new Error(`Prohibido: No se puede entregar el Plan Separe. Aún tiene un saldo pendiente de $${Number(separeData.saldoPendiente).toLocaleString('es-CO')}.`);
      }

      // 1. Crear movimiento de entrega (sin duplicar ingresos de caja)
      const movRef = doc(collection(db, "movimientos"));
      transaction.set(movRef, {
        clienteId: separeData.clienteId || null,
        clienteNombre: separeData.clienteNombre || "Cliente",
        usuarioId: params.usuarioId,
        tipo: 'entrega_separe',
        origen: 'separe',
        monto: 0,
        valorMercancia: Number(separeData.total || 0),
        descripcion: `Plan Separe entregado - ${separeData.clienteNombre || 'Cliente'}`,
        detalles: (separeData.items || []).map((it: any) => ({
          descripcion: it.descripcion,
          valor: (Number(it.valor) || 0) * (it.cantidad || 1),
          cantidad: it.cantidad || 1,
          valorUnitario: Number(it.valor) || 0
        })),
        fecha: new Date(),
        registradoPor: params.registradoPor,
        metodoPago: 'separe_liquidado',
        idSepareOrigen: params.separeId
      });

      // 2. Marcar separe como completado
      transaction.update(separeRef, {
        estado: 'completado',
        fechaCompletado: new Date(),
        idTransaccionCierre: movRef.id,
        saldoPendiente: 0
      });

      return {
        entregaMovimientoId: movRef.id
      };
    });
  },

  // --------------------------------------------------------
  // TRANSACCIÓN ATÓMICA: APROBACIÓN DE ÓRDENES DE CAJEROS (P1-TX-06)
  // --------------------------------------------------------
  /** @deprecated Usar POST /api/ordenes/aprobar. */
  ejecutarAprobacionOrdenAtomo: async (params: {
    ordenId: string;
    usuarioId: string;
    aprobadoPor: string;
    descontarStockItems: Array<{ productoId: string; cantidad: number }>;
    movimientoPrincipal?: any;
    movimientoFiadoSecundario?: any;
    payloadSepare?: any;
    movimientoAbonoSepare?: any;
    ajusteCliente?: {
      clienteId: string;
      cambioDeuda: number;
    };
  }): Promise<{
    idTransaccionGenerada: string;
    nuevoSaldoCliente?: number;
  }> => {
    return await runTransaction(db, async (transaction) => {
      // 1. Lectura y validación del estado de la orden
      const ordenRef = doc(db, "ordenes_pendientes", params.ordenId);
      const ordenSnap = await transaction.get(ordenRef);

      if (!ordenSnap.exists()) {
        throw new Error("La orden ya no existe o fue eliminada.");
      }

      const ordenData = ordenSnap.data() as any;
      if (ordenData.estado !== 'pendiente') {
        throw new Error(`La orden ya no está pendiente (estado actual: ${ordenData.estado}).`);
      }

      // 2. Lectura y validación de stock para productos a descontar
      const stockDocsMap = new Map<string, any>();
      for (const item of params.descontarStockItems) {
        if (item.productoId && item.cantidad > 0) {
          const invRef = doc(db, "inventario", item.productoId);
          const invSnap = await transaction.get(invRef);
          if (invSnap.exists()) {
            const dataInv = invSnap.data() as any;
            const stockActual = Number(dataInv.stock || 0);
            if (dataInv.tipoProducto !== 'servicio' && dataInv.inventariable !== false) {
              if (item.cantidad > stockActual) {
                throw new Error(`¡Sin stock suficiente de "${dataInv.nombre}"! Solicitado: ${item.cantidad}, Quedan: ${stockActual}`);
              }
            }
            stockDocsMap.set(item.productoId, invRef);
          }
        }
      }

      // 3. Lectura de cliente si hay ajuste de deuda
      let clienteRef: any = null;
      let nuevoSaldoCliente: number | undefined = undefined;
      if (params.ajusteCliente && params.ajusteCliente.clienteId && params.ajusteCliente.clienteId !== 'mostrador') {
        clienteRef = doc(db, "clientes", params.ajusteCliente.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (clienteSnap.exists()) {
          const cData = clienteSnap.data() as any;
          const deudaPrevia = Number(cData.deudaTotal || 0);
          nuevoSaldoCliente = deudaPrevia + params.ajusteCliente.cambioDeuda;
        }
      }

      // 4. Escrituras:
      // a) Descontar stock atómicamente
      for (const item of params.descontarStockItems) {
        const invRef = stockDocsMap.get(item.productoId);
        if (invRef && item.cantidad > 0) {
          transaction.update(invRef, {
            stock: increment(-item.cantidad)
          });
        }
      }

      // b) Ajustar deuda cliente atómicamente
      if (clienteRef && nuevoSaldoCliente !== undefined) {
        transaction.update(clienteRef, {
          deudaTotal: nuevoSaldoCliente,
          fechaUltimoMovimiento: new Date()
        });
      }

      let idTransaccionGenerada = "";

      // c) Plan Separe
      if (params.payloadSepare) {
        const separeRef = doc(collection(db, "separes"));
        idTransaccionGenerada = separeRef.id;
        transaction.set(separeRef, params.payloadSepare);

        if (params.movimientoAbonoSepare) {
          const movAbonoRef = doc(collection(db, "movimientos"));
          transaction.set(movAbonoRef, {
            ...params.movimientoAbonoSepare,
            idSepareOrigen: separeRef.id
          });
        }
      } else if (params.movimientoPrincipal) {
        // d) Venta / Fiado
        const movRef = doc(collection(db, "movimientos"));
        idTransaccionGenerada = movRef.id;
        transaction.set(movRef, params.movimientoPrincipal);

        if (params.movimientoFiadoSecundario) {
          const movFiadoRef = doc(collection(db, "movimientos"));
          transaction.set(movFiadoRef, params.movimientoFiadoSecundario);
        }
      }

      // e) Actualizar orden a 'aprobado'
      transaction.update(ordenRef, {
        estado: 'aprobado',
        fechaProcesado: new Date(),
        aprobadoPor: params.aprobadoPor,
        idTransaccion: idTransaccionGenerada
      });

      return {
        idTransaccionGenerada,
        nuevoSaldoCliente
      };
    });
  },


  // --------------------------------------------------------
  // NUEVA LÓGICA DE BONOS / SUSCRIPCIÓN
  // --------------------------------------------------------
  verificarCodigoPromocional: async (codigo: string, emailUsuario: string) => {
    try {
      const docRef = doc(db, "codigos_promocionales", codigo);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return { valido: false, reason: 'not_found' };
      }

      const data = docSnap.data();
      if (!data.activo) {
        return { valido: false, reason: 'inactive' };
      }

      // Validar si el código está restringido a un correo específico
      if (data.emailObjetivo && data.emailObjetivo.trim() !== "") {
        if (data.emailObjetivo.trim().toLowerCase() !== emailUsuario.trim().toLowerCase()) {
           return { valido: false, reason: 'unauthorized_email' };
        }
      }

      // Valores por defecto si el doc antiguo no los tiene
      const planOtorgado = data.planOtorgado || 'pro';
      const diasOtorgados = typeof data.diasOtorgados === 'number' ? data.diasOtorgados : 30;
      const unSoloUso = data.unSoloUso !== false; // Por defecto true, a menos que diga explícitamente false

      return { 
        valido: true, 
        planOtorgado,
        diasOtorgados,
        unSoloUso
      };
    } catch (error) {
      console.error("Error al validar cupón:", error);
      return { valido: false, reason: 'error' };
    }
  },

  crearCodigoPromocional: async (codigo: string, datos: { activo: boolean; descuento?: string; [key: string]: any } = { activo: true, descuento: '1mes' }) => {
    try {
      const docRef = doc(db, "codigos_promocionales", codigo);
      await setDoc(docRef, datos);
      return { ok: true };
    } catch (error) {
      console.error("Error al crear código promocional:", error);
      return { ok: false, error };
    }
  }
  ,

  actualizarHorariosColaborador: async (usuarioId: string, horarios: any[]) => {
    try {
      const ref = doc(db, "usuarios", usuarioId);
      const snap = await getDoc(ref);
      const data = snap.data() || {};
      const updateData: any = { horariosActividad: horarios };

      // Si se configuraron horarios válidos y no hay override manual, calcular estado activo en base al horario
      if (Array.isArray(horarios) && horarios.length > 0) {
        if (data.manualOverride !== true) {
          updateData.activo = calcularActivoPorHorarios(horarios);
        }
      } else {
        // Si se eliminan todos los horarios (acceso libre), habilitar al colaborador
        if (data.activo === false && data.manualOverride !== true) {
          updateData.activo = true;
        }
      }

      await updateDoc(ref, updateData);
      return { ok: true, activo: updateData.activo ?? data.activo ?? true };
    } catch (error) {
      console.error("Error al actualizar horarios:", error);
      return { ok: false, error };
    }
  }
};