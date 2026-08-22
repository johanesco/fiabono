// types/index.ts

export interface PermisosColaborador {
  verCelulares: boolean;
  verDirectorio: boolean;
  verReportes: boolean;
}

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
  plan?: 'basico' | 'pro';
  planVence?: any; // Timestamp de Firebase
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
  usuarioId: string;
  tipo: 'fiado' | 'abono' | 'venta';
  monto: number;
  descripcion: string;
  detalles: DetalleMovimiento[];
  saldoResultante?: number;
  fecha: any;
  registradoPor?: string;
  metodoPago?: TipoMetodoPago;
  referenciaPago?: string;
  subtotal?: number;
  valorIva?: number;
  porcentajeIva?: number;
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