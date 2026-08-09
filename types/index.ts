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
}

export interface DatosSesionContext {
  uid: string;
  cuentaPrincipalId: string;
  nombreUsuario: string;
  nombreNegocio: string;
  telefonoNegocio: string;
  correoNegocio: string;
  rol: 'admin' | 'cajero';
  permisos: PermisosColaborador | null;
  planActual: 'basico' | 'pro';
  diasPro: number | null;
  avisoExpiracion: boolean;
  datosUsuarioOriginales: UsuarioBD;
}