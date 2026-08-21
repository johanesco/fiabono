// servicios/db.ts
import { collection, addDoc, getDocs, query, doc, updateDoc, where, deleteDoc, getDoc, setDoc } from "firebase/firestore";
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
    return listaM.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
  },

  obtenerMovimientosDeCliente: async (clienteId: string): Promise<Movimiento[]> => {
    const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
    const snapM = await getDocs(qM);
    const listaM: Movimiento[] = [];
    snapM.forEach((documento) => listaM.push({ id: documento.id, ...documento.data() } as Movimiento));
    return listaM.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
  },

  crearMovimiento: async (datosMovimiento: Omit<Movimiento, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, "movimientos"), datosMovimiento);
    return docRef.id;
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