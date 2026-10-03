// servicios/facturacionDian.ts
/**
 * Servicio de Integración para Facturación Electrónica DIAN vía MATIAS API (UBL 2.1).
 * Convierte ventas y transacciones de Fiabono a la estructura estándar UBL 2.1.
 */

import { Movimiento, Cliente, DatosFacturaElectronica } from '@/types';

export interface ParametrosEmisionFactura {
  movimiento: Partial<Movimiento> & { id: string; monto: number };
  cliente?: Partial<Cliente> | null;
  resolucion?: string;
  prefijo?: string;
  consecutivo?: number;
  ambiente?: 'sandbox' | 'produccion';
  tokenOverride?: string;
}

export interface RespuestaEmisionDian {
  success: boolean;
  datos?: DatosFacturaElectronica;
  error?: string;
  detallesError?: any;
}

/**
 * Mapeo de métodos de pago de Fiabono al estándar DIAN UBL 2.1
 * DIAN Payment Means Codes:
 * 10: Efectivo
 * 47: Transferencia Débito Bancaria (Nequi, Daviplata, Bancolombia)
 * 48: Tarjeta de Crédito
 * 49: Tarjeta de Débito
 * 1: Instrumento no definido / Acuerdo mutuo
 */
function mapearMedioPagoDian(metodo?: string): { payment_method_id: number; means_payment_id: number } {
  const met = (metodo || 'efectivo').toLowerCase();

  if (met === 'fiado') {
    return {
      payment_method_id: 2, // 2 = Crédito
      means_payment_id: 10   // Efectivo diferido / acuerdo mutuo
    };
  }

  if (met === 'transferencia') {
    return {
      payment_method_id: 1, // 1 = Contado
      means_payment_id: 47   // Transferencia
    };
  }

  if (met === 'datafono') {
    return {
      payment_method_id: 1, // 1 = Contado
      means_payment_id: 49   // Tarjeta débito/crédito
    };
  }

  return {
    payment_method_id: 1, // 1 = Contado
    means_payment_id: 10   // 10 = Efectivo
  };
}

/**
 * Construye el objeto `customer` cumpliendo la normativa DIAN.
 * Si no hay cliente registrado o es venta anónima, se asigna el estándar oficial
 * "Consumidor Final" (NIT 222222222222).
 */
export function construirClienteDian(cliente?: Partial<Cliente> | null, clienteNombre?: string) {
  const nombreLimpio = (cliente?.nombre || clienteNombre || '').trim();
  const esConsumidorFinal =
    !nombreLimpio ||
    nombreLimpio.toLowerCase() === 'consumidor final' ||
    nombreLimpio.toLowerCase() === 'mostrador' ||
    nombreLimpio.toLowerCase() === 'venta de mostrador';

  if (esConsumidorFinal && !cliente?.numeroDocumento?.trim()) {
    return {
      dni: '222222222222',
      company_name: 'Consumidor Final',
      type_organization_id: 2, // Persona Natural
      identity_document_id: 1, // Cédula de ciudadanía / genérico
      tax_level_id: 5,        // No responsable de IVA
      tax_regime_id: 2,       // No responsable
      email: 'consumidorfinal@fiabono.com'
    };
  }

  // Cliente registrado o personalizado
  const dniLimpio = cliente?.numeroDocumento?.trim() || ((cliente?.id && /^\d+$/.test(cliente.id)) ? cliente.id : '222222222222');
  const esNit = cliente?.tipoDocumento === 'NIT';
  const identityDocumentId = esNit ? 3 : (cliente?.tipoDocumento === 'CE' ? 2 : 1);
  const typeOrganizationId = esNit ? 1 : 2; // 1 = Jurídica, 2 = Natural
  const nombreFinal = (cliente?.razonSocial || nombreLimpio || 'Consumidor Final').trim();

  return {
    dni: dniLimpio,
    company_name: nombreFinal,
    type_organization_id: typeOrganizationId,
    identity_document_id: identityDocumentId,
    tax_level_id: 5,
    tax_regime_id: 2,
    email: cliente?.email || 'consumidorfinal@fiabono.com',
    phone: cliente?.celular || undefined,
    address: cliente?.direccion || undefined
  };
}

/**
 * Convierte una venta de Fiabono a la estructura JSON UBL 2.1 exigida por MATIAS API.
 */
export function construirPayloadFacturaUbl21({
  movimiento,
  cliente,
  resolucion = '18760000001',
  prefijo = 'FEV',
  consecutivo = 1
}: {
  movimiento: Partial<Movimiento> & { id: string; monto: number };
  cliente?: Partial<Cliente> | null;
  resolucion?: string;
  prefijo?: string;
  consecutivo?: number;
}) {
  const customer = construirClienteDian(cliente, movimiento.clienteNombre);
  const { payment_method_id, means_payment_id } = mapearMedioPagoDian(movimiento.metodoPago);

  const totalVenta = Number(movimiento.monto || 0);
  const subtotal = Number(movimiento.subtotal || totalVenta);
  const montoDescuento = Number(movimiento.montoDescuento || 0);
  const valorIva = Number(movimiento.valorIva || 0);

  // Fecha y hora actual
  const ahora = new Date();
  const fechaStr = ahora.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const horaStr = ahora.toTimeString().slice(0, 8);  // 'HH:mm:ss'

  // Mapear líneas de artículos
  const detalles = movimiento.detalles || [];
  let lines: any[] = [];

  if (detalles.length > 0) {
    lines = detalles.map((det, index) => {
      const cantidad = Math.max(1, Number(det.cantidad || 1));
      const valorUnitario = Number(det.valorUnitario || (det.valor ? det.valor / cantidad : 0));
      const lineExtension = valorUnitario * cantidad;

      return {
        quantity_units_id: 70, // 70 = Unidad estándar DIAN (EA / Unit)
        invoiced_quantity: String(cantidad),
        base_quantity: '1',
        price_amount: valorUnitario.toFixed(2),
        line_extension_amount: lineExtension.toFixed(2),
        description: det.descripcion?.trim() || `Artículo #${index + 1}`,
        code: `ART-${index + 1}`,
        type_item_identifications_id: 4, // Estándar de adopción del contribuyente
        free_of_charge_indicator: false
      };
    });
  } else {
    // Si la venta no tenía desglose de items (venta rápida libre)
    lines = [{
      quantity_units_id: 70,
      invoiced_quantity: '1',
      base_quantity: '1',
      price_amount: totalVenta.toFixed(2),
      line_extension_amount: totalVenta.toFixed(2),
      description: movimiento.descripcion?.trim() || 'Venta de mostrador',
      code: 'VENTA-001',
      type_item_identifications_id: 4,
      free_of_charge_indicator: false
    }];
  }

  // Base gravable e importes monetarios
  const taxExclusive = subtotal.toFixed(2);
  const taxInclusive = (subtotal + valorIva).toFixed(2);
  const payableAmount = totalVenta.toFixed(2);

  const payload: any = {
    resolution_number: resolucion,
    prefix: prefijo,
    date: fechaStr,
    expiration_date: fechaStr,
    time: horaStr,
    notes: (movimiento.descripcion?.trim() || 'Factura de venta Fiabono POS').slice(0, 100),
    document_number: consecutivo,
    operation_type_id: 1, // 1 = Estándar / Factura electrónica de venta
    type_document_id: 7,  // 7 = Factura Electrónica de Venta (DIAN 01)
    graphic_representation: 1,
    send_email: (customer.email && customer.email !== 'consumidorfinal@fiabono.com') ? 1 : 0,
    currency_id: 272,
    customer,
    payments: [{
      payment_method_id,
      means_payment_id,
      value_paid: payableAmount,
      payment_due_date: fechaStr
    }],
    legal_monetary_totals: {
      line_extension_amount: subtotal.toFixed(2),
      tax_exclusive_amount: taxExclusive,
      tax_inclusive_amount: taxInclusive,
      payable_amount: payableAmount
    },
    lines
  };

  if (montoDescuento > 0) {
    payload.legal_monetary_totals.allowance_total_amount = montoDescuento.toFixed(2);
  }

  return payload;
}

/**
 * Envía la factura a MATIAS API para firma digital, validación DIAN y generación de CUFE.
 */
export async function emitirFacturaDian(params: ParametrosEmisionFactura): Promise<RespuestaEmisionDian> {
  const ambiente = params.ambiente || 'sandbox';
  const baseUrl = ambiente === 'produccion'
    ? (process.env.MATIAS_API_URL_PROD || 'https://api-v2.matias-api.com')
    : (process.env.MATIAS_API_URL_SANDBOX || 'https://sandbox-api.matias-api.com');

  const token = params.tokenOverride || (
    ambiente === 'produccion'
      ? process.env.MATIAS_API_TOKEN_PROD
      : process.env.MATIAS_API_TOKEN_SANDBOX
  );

  if (!token) {
    return {
      success: false,
      error: `Token de MATIAS API (${ambiente}) no configurado en variables de entorno.`
    };
  }

  const prefijo = params.prefijo || (ambiente === 'produccion' ? 'SETP' : 'FEV');
  const resolucion = params.resolucion || '18760000001';
  const consecutivo = params.consecutivo || 1;

  const payload = construirPayloadFacturaUbl21({
    movimiento: params.movimiento,
    cliente: params.cliente,
    resolucion,
    prefijo,
    consecutivo
  });

  try {
    const res = await fetch(`${baseUrl}/api/ubl2.1/invoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      const mensaje = data?.message || `Error del servidor DIAN (HTTP ${res.status})`;
      return {
        success: false,
        error: mensaje,
        detallesError: data?.errors || data
      };
    }

    // Si la respuesta fue exitosa y la DIAN emitió el documento
    if (data.success || data.XmlDocumentKey || data.response?.XmlDocumentKey) {
      const cufe = data.XmlDocumentKey || data.response?.XmlDocumentKey || data.uuid;
      const qrUrl = data.qr?.url || data.qr?.qrDian || (typeof data.qr === 'string' ? data.qr : undefined);
      const pdfUrl = data.pdf?.url || (typeof data.pdf === 'string' ? data.pdf : undefined);
      const xmlFileName = data.response?.XmlFileName || data.XmlFileName;
      const numeroFactura = `${prefijo}${consecutivo}`;

      const datos: DatosFacturaElectronica = {
        estado: 'emitida',
        cufe,
        qr: qrUrl,
        numeroFactura,
        prefijo,
        fechaEmision: new Date().toISOString(),
        urlPdf: pdfUrl,
        urlXml: xmlFileName ? `${baseUrl}/xml/${xmlFileName}.xml` : undefined,
        ambiente
      };

      return {
        success: true,
        datos
      };
    }

    return {
      success: false,
      error: data.message || 'La DIAN no devolvió aprobación.',
      detallesError: data
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error de conexión con el servicio de facturación electrónica.'
    };
  }
}
