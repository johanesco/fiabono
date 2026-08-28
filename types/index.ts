// types/index.ts

export interface PermisosColaborador {
  verCelulares: boolean;
  verDirectorio: boolean;
  verReportes: boolean;
  ventaDirecta: boolean;   // Puede confirmar venta/fiado sin aprobación del admin
  abonar: boolean;         // Puede registrar abonos
  editarInventario: boolean; // Puede editar/agregar productos en inventario
  terminalMultivendedor?: boolean; // Permite seleccionar vendedor y cambiar turnos en una misma terminal
  modificarPrecios?: boolean; // Permite cambiar precios de productos ya registrados en inventario
  aplicarDescuentos?: boolean; // Permite aplicar descuentos comerciales a ventas/fiados
  planSepare?: boolean;   // Permite registrar y gestionar planes de separe (pago en abonos)
}

// -------------------------------------------------------
// PLAN SEPARE (Layaway)
// -------------------------------------------------------
export interface AbonoSepare {
  id: string;
  monto: number;
  metodoPago: 'efectivo' | 'transferencia' | 'datafono' | 'credito_externo';
  subMetodoPago?: string;
  referenciaPago?: string;
  fecha: any; // Timestamp
  registradoPor: string;
}

export interface ItemSepare {
  descripcion: string;
  valor: string;        // precio unitario como string (igual que movimientos)
  cantidad: number;
  fotoUrl?: string | null; // URL Firebase Storage de la foto del producto
}

export type EstadoSepare = 'activo' | 'completado' | 'cancelado';

export interface Separe {
  id: string;
  usuarioId: string;           // cuentaPrincipalId del admin
  creadoPor: string;           // nombre del colaborador
  estado: EstadoSepare;
  clienteId: string;
  clienteNombre: string;
  clienteCelular: string;
  items: ItemSepare[];
  totalBruto: number;
  montoDescuento: number;
  total: number;               // total acordado a pagar
  montoPagado: number;         // suma de todos los abonos
  saldoPendiente: number;      // total - montoPagado
  abonos: AbonoSepare[];
  fotos: string[];             // URLs de todas las fotos (resumen rápido)
  notas?: string;
  fechaCreacion: any;          // Timestamp
  fechaLimite?: any | null;    // Timestamp opcional
  fechaCompletado?: any | null;
  fechaCancelado?: any | null;
  notaCancelacion?: string;
  montoPagadoAlCancelar?: number;
  idTransaccionCierre?: string; // ID del movimiento generado al completar
}

export type EstadoOrden = 'pendiente' | 'aprobado' | 'rechazado';

export interface OrdenPendiente {
  id: string;
  tipo: 'venta' | 'fiado' | 'separe';
  estado: EstadoOrden;
  usuarioId: string;              // adminId (dueño de la cuenta)
  creadoPor: string;              // uid del colaborador
  nombreColaborador: string;
  clienteId: string | null;
  clienteNombre: string;
  clienteCelular?: string;
  items: { descripcion: string; valor: string; cantidad: number; fotoUrl?: string | null }[];
  totalBruto: number;
  descuentoTipo: 'porcentaje' | 'fijo' | null;
  descuentoValor: number | null;
  montoDescuento: number;
  total: number;
  pagoCliente?: number | string;            // cuánto pagó el cliente (para venta+fiado mixto o efectivo recibido)
  metodoPago: string;
  subMetodoPago?: string;
  referenciaPago?: string;
  fecha: any;
  fechaProcesado: any | null;
  aprobadoPor: string | null;
  motivoRechazo: string | null;
  idTransaccion?: string;
  fechaModificado?: any;
  fechaLimite?: any | null;
  notas?: string;
  payloadSepare?: any;
}

export type TipoPlan = 'gratis' | 'comercio' | 'pro' | 'basico';
export type CicloPlan = 'mensual' | 'anual';

export interface UsuarioBD {
  id?: string;
  nombreUsuario: string;
  nombreNegocio?: string;
  telefonoNegocio?: string;
  logoNegocio?: string | null;
  nitNegocio?: string;
  direccionNegocio?: string;
  mensajePieTicket?: string;
  habilitarIva?: boolean;
  porcentajeIva?: number;
  email: string;
  rol: 'admin' | 'cajero';
  adminId?: string;
  plan?: TipoPlan;
  planVence?: any; // Timestamp de Firebase
  cicloPlan?: CicloPlan;
  permisos?: PermisosColaborador;
  activo?: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  celular: string;
  deudaTotal: number;
  usuarioId: string;
  fecha_creacion?: any;
}

export interface DetalleMovimiento {
  descripcion: string;
  valor: number;
  cantidad: number;
  valorUnitario: number;
}

export type TipoMetodoPago = 'efectivo' | 'transferencia' | 'datafono' | 'credito_externo' | 'fiado';

export interface Movimiento {
  id: string;
  clienteId: string;
  clienteNombre?: string;
  usuarioId: string;
  tipo: 'fiado' | 'abono' | 'venta' | 'egreso' | 'entrega_separe';
  subtipo?: string;
  origen?: string;
  monto: number;
  valorMercancia?: number;
  descripcion: string;
  detalles?: DetalleMovimiento[];
  saldoResultante?: number;
  fecha: any;
  registradoPor?: string;
  metodoPago?: TipoMetodoPago | string;
  subMetodoPago?: string;
  referenciaPago?: string;
  subtotal?: number;
  valorIva?: number;
  porcentajeIva?: number;
  descuentoTipo?: 'porcentaje' | 'fijo' | null;
  descuentoValor?: number;
  montoDescuento?: number;
  separeId?: string;
  idSepareOrigen?: string;
}

export interface DatosSesionContext {
  uid: string;
  cuentaPrincipalId: string;
  nombreUsuario: string;
  nombreNegocio: string;
  telefonoNegocio: string;
  correoNegocio: string;
  logoNegocio?: string | null;
  nitNegocio?: string;
  direccionNegocio?: string;
  mensajePieTicket?: string;
  habilitarIva?: boolean;
  porcentajeIva?: number;
  rol: 'admin' | 'cajero';
  permisos: PermisosColaborador | null;
  planActual: 'basico' | 'pro';
  diasPro: number | null;
  avisoExpiracion: boolean;
  datosUsuarioOriginales: UsuarioBD;
}