export type PlanPagoId = 'comercio' | 'pro';

export const LIMITE_MOVIMIENTOS_MES_GRATIS = 30;
export const LIMITE_CLIENTES_GRATIS = 15;
export const LIMITE_PRODUCTOS_GRATIS = 30;

export interface InfoPrecioPlan {
  nombre: string;
  precioRegularMensual: number;
  precioRegularMensualTexto: string;
  precioLanzamientoMensual: number;
  precioLanzamientoMensualTexto: string;
  precioRegularAnualTexto: string;
  precioLanzamientoAnual: number;
  precioLanzamientoAnualTexto: string;
  equivalenteMensualAnualTexto: string;
  descuentoLanzamiento: string;
  costoDiarioTexto: string;
}

export const PLANES_PRECIOS: Record<PlanPagoId, InfoPrecioPlan> = {
  comercio: {
    nombre: 'Plan Comercio',
    precioRegularMensual: 39900,
    precioRegularMensualTexto: '$39.900',
    precioLanzamientoMensual: 29900,
    precioLanzamientoMensualTexto: '$29.900',
    precioRegularAnualTexto: '$399.000',
    precioLanzamientoAnual: 299000,
    precioLanzamientoAnualTexto: '$299.000',
    equivalenteMensualAnualTexto: '$24.916',
    descuentoLanzamiento: '-25%',
    costoDiarioTexto: '$996/día',
  },
  pro: {
    nombre: 'Plan PRO Almacén',
    precioRegularMensual: 79900,
    precioRegularMensualTexto: '$79.900',
    precioLanzamientoMensual: 59900,
    precioLanzamientoMensualTexto: '$59.900',
    precioRegularAnualTexto: '$799.000',
    precioLanzamientoAnual: 599000,
    precioLanzamientoAnualTexto: '$599.000',
    equivalenteMensualAnualTexto: '$49.916',
    descuentoLanzamiento: '-25%',
    costoDiarioTexto: '$1.996/día',
  },
};

export const ETIQUETA_LANZAMIENTO = 'Tarifa de Lanzamiento';
export const NOTA_TARIFA_CONGELADA = 'Mantienes esta tarifa especial mientras tu cuenta siga activa';
