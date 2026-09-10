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

  eliminarCliente: async (clienteId: string): Promise<void> => {
    await deleteDoc(doc(db, "clientes", clienteId));
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
  // TRANSACCIÓN ATÓMICA UNIFICADA: VENTA + STOCK + FIADO (P1-TX-01)
  // --------------------------------------------------------
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
      // 1. REGLA FIRESTORE OBLIGATORIA: TODAS LAS LECTURAS PRIMERO
      let nuevoSaldoCliente: number | undefined = undefined;
      let clienteRef: any = null;

      if (
        params.fiarFaltante &&
        params.clienteId &&
        params.clienteId !== 'mostrador' &&
        typeof params.montoFiado === 'number' &&
        params.montoFiado > 0
      ) {
        clienteRef = doc(db, "clientes", params.clienteId);
        const clienteSnap = await transaction.get(clienteRef);
        if (clienteSnap.exists()) {
          const cData = clienteSnap.data() as any;
          const deudaActual = Number(cData?.deudaTotal || 0);
          nuevoSaldoCliente = deudaActual + params.montoFiado;
        }

      }

      // 2. TODAS LAS ESCRITURAS DESPUÉS
      // a) Descontar stock de los productos inventariables
      for (const item of params.itemsInventario) {
        if (item.productoId && item.cantidad > 0) {
          const prodRef = doc(db, "inventario", item.productoId);
          transaction.update(prodRef, {
            stock: increment(-item.cantidad)
          });
        }
      }

      // b) Si hay saldo a crédito, actualizar deudaTotal del cliente
      if (clienteRef && nuevoSaldoCliente !== undefined) {
        transaction.update(clienteRef, {
          deudaTotal: nuevoSaldoCliente
        });
      }

      // c) Crear movimiento de venta (si se recibió algún pago)
      let movimientoVentaId: string | undefined = undefined;
      if (params.montoVentaReal > 0) {
        const movVentaRef = doc(collection(db, "movimientos"));
        movimientoVentaId = movVentaRef.id;
        const movVentaData: Record<string, any> = {
          clienteId: params.clienteId || 'mostrador',
          usuarioId: params.usuarioId,
          tipo: 'venta',
          monto: params.montoVentaReal,
          descripcion: params.descripcionVenta,
          detalles: params.detalles,
          fecha: new Date(),
          registradoPor: params.registradoPor,
          metodoPago: params.metodoPago,
          referenciaPago: params.referenciaPago || null,
          subtotal: params.subtotal,
          valorIva: params.valorIva,
          porcentajeIva: params.porcentajeIva,
          descuentoTipo: params.descuentoTipo || null,
          descuentoValor: params.descuentoValor,
          montoDescuento: params.montoDescuento
        };
        Object.keys(movVentaData).forEach(k => movVentaData[k] === undefined && delete movVentaData[k]);
        transaction.set(movVentaRef, movVentaData);
      }

      // d) Crear movimiento de fiado (si faltante quedó a crédito)
      let movimientoFiadoId: string | undefined = undefined;
      if (params.fiarFaltante && params.clienteId && params.montoFiado && params.montoFiado > 0) {
        const movFiadoRef = doc(collection(db, "movimientos"));
        movimientoFiadoId = movFiadoRef.id;
        const movFiadoData: Record<string, any> = {
          clienteId: params.clienteId,
          usuarioId: params.usuarioId,
          tipo: 'fiado',
          monto: params.montoFiado,
          descripcion: params.descripcionFiado || 'Saldo pendiente de venta',
          detalles: params.detalles,
          fecha: new Date(),
          registradoPor: params.registradoPor,
          metodoPago: 'fiado',
          saldoResultante: nuevoSaldoCliente
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
          transaction.update(clienteRef, { deudaTotal: nuevoSaldo });
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