/**
 * Gestor Unificado de Cola Offline para Fiabono.
 * Soporta:
 * - Ventas (contado y parcial fiada)
 * - Fiados
 * - Abonos a cartera
 * - Creación de Plan Separe
 * - Abonos a Plan Separe
 */

export type TipoOperacionOffline = 'venta' | 'fiado' | 'abono_cartera' | 'separe_crear' | 'separe_abonar';

export interface OperacionOfflinePendiente {
  idLocal: string;
  tipo: TipoOperacionOffline;
  creadoEn: number;
  endpoint: '/api/ventas/registrar' | '/api/movimientos/registrar' | '/api/separes/crear' | '/api/separes/abonar';
  payload: any;
  ticketDatosPreview?: any;
  intentos: number;
  ultimoError?: string;
}

const STORAGE_KEY = 'fiabono_operaciones_offline_cola_v2';

export function obtenerColaOffline(): OperacionOfflinePendiente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[ColaOffline] Error leyendo cola:', e);
    return [];
  }
}

export function guardarOperacionOffline(
  op: Omit<OperacionOfflinePendiente, 'idLocal' | 'creadoEn' | 'intentos'>
): OperacionOfflinePendiente {
  const cola = obtenerColaOffline();
  const nuevaOp: OperacionOfflinePendiente = {
    ...op,
    idLocal: `local_${op.tipo}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    creadoEn: Date.now(),
    intentos: 0,
  };

  cola.push(nuevaOp);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
    window.dispatchEvent(
      new CustomEvent('fiabono_cola_offline_actualizada', { detail: { count: cola.length } })
    );
  } catch (e) {
    console.error('[ColaOffline] Error guardando operacion:', e);
  }
  return nuevaOp;
}

export function eliminarOperacionOffline(idLocal: string) {
  const cola = obtenerColaOffline().filter((v) => v.idLocal !== idLocal);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
    window.dispatchEvent(
      new CustomEvent('fiabono_cola_offline_actualizada', { detail: { count: cola.length } })
    );
  } catch (e) {}
}

export function contarOperacionesOffline(): number {
  return obtenerColaOffline().length;
}

// Compatibilidad retroactiva
export const obtenerColaVentasOffline = obtenerColaOffline;
export const eliminarDeColaVentasOffline = eliminarOperacionOffline;
export const contarVentasOfflinePendientes = contarOperacionesOffline;
export function guardarEnColaVentasOffline(venta: any) {
  return guardarOperacionOffline({
    tipo: 'venta',
    endpoint: '/api/ventas/registrar',
    payload: venta.payload,
    ticketDatosPreview: venta.ticketDatosPreview,
  });
}
