// servicios/db.ts
import { collection, addDoc, getDocs, query, doc, updateDoc, where, deleteDoc, getDoc, setDoc, runTransaction, orderBy, limit, startAfter } from "firebase/firestore";
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
    } catch (error) {
      console.warn("Consulta paginada usando fallback en memoria:", error);
      const qFallback = query(collection(db, "movimientos"), where("usuarioId", "==", usuarioId));
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
        hayMas: listaM.length > tamanoPagina
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
  // REGISTRO SEGURO Y ATÓMICO CON TRANSACCIÓN
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
      const movimientoAGuardar = {
        ...datosMovimiento,
        ...(nuevoSaldo !== undefined ? { saldoResultante: nuevoSaldo } : {})
      };
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
  verificarCodigoPromocional: async (codigo: string) => {
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

      return { valido: true, beneficio: data.descuento };
    } catch (error) {
      console.error("Error al validar cupón:", error);
      return { valido: false, reason: 'error' };
    }
  }
  ,

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

      if (data.manualOverride !== true) {
        updateData.activo = calcularActivoPorHorarios(horarios);
      }

      await updateDoc(ref, updateData);
      return { ok: true, activo: updateData.activo ?? data.activo ?? false };
    } catch (error) {
      console.error("Error al actualizar horarios:", error);
      return { ok: false, error };
    }
  }
};