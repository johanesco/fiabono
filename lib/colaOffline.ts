/**
 * Gestor de Cola de Ventas Offline para Fiabono.
 * Almacena de forma segura las ventas realizadas sin conexión
 * y las sincroniza en orden cuando regresa internet.
 */

export interface VentaOfflinePendiente {
  idLocal: string; // Clave única local (timestamp + random)
  creadoEn: number;
  payload: {
    clienteId: string;
    montoVentaReal: number;
    descripcionVenta: string;
    detalles: any[];
    metodoPago: string;
    referenciaPago?: string;
    subtotal: number;
    valorIva: number;
    porcentajeIva: number;
    descuentoTipo?: string | null;
    descuentoValor?: number;
    montoDescuento?: number;
    itemsInventario: any[];
    fiarFaltante?: boolean;
    montoFiado?: number;
    descripcionFiado?: string;
  };
  ticketDatosPreview: any;
  intentos: number;
  ultimoError?: string;
}

const STORAGE_KEY = 'fiabono_ventas_offline_cola_v1';

export function obtenerColaVentasOffline(): VentaOfflinePendiente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[OfflineQueue] Error leyendo cola:', e);
    return [];
  }
}

export function guardarEnColaVentasOffline(venta: Omit<VentaOfflinePendiente, 'idLocal' | 'creadoEn' | 'intentos'>): VentaOfflinePendiente {
  const cola = obtenerColaVentasOffline();
  const nuevaVenta: VentaOfflinePendiente = {
    ...venta,
    idLocal: `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    creadoEn: Date.now(),
    intentos: 0,
  };

  cola.push(nuevaVenta);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
    window.dispatchEvent(new CustomEvent('fiabono_cola_offline_actualizada', { detail: { count: cola.length } }));
  } catch (e) {
    console.error('[OfflineQueue] Error guardando en cola:', e);
  }
  return nuevaVenta;
}

export function eliminarDeColaVentasOffline(idLocal: string) {
  const cola = obtenerColaVentasOffline().filter(v => v.idLocal !== idLocal);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
    window.dispatchEvent(new CustomEvent('fiabono_cola_offline_actualizada', { detail: { count: cola.length } }));
  } catch (e) {}
}

export function contarVentasOfflinePendientes(): number {
  return obtenerColaVentasOffline().length;
}
