// utils/generarExcelRespaldo.ts
// Generador del Libro Excel Maestro (.xlsx) de Copia de Seguridad de Fiabono con ExcelJS.

import ExcelJS from 'exceljs';

export interface RespuestaRespaldoAPI {
  exito: boolean;
  planEfectivo: 'gratis' | 'comercio' | 'pro';
  fechaGeneracionISO: string;
  negocio: {
    nombreNegocio: string;
    nitNegocio: string;
    telefonoNegocio: string;
    direccionNegocio: string;
    correoNegocio: string;
    nombreAdmin: string;
    slugNegocio: string;
  };
  metricas: {
    totalClientes: number;
    totalCarteraPorCobrar: number;
    totalSaldosAFavor: number;
    totalProductos: number;
    valorInventarioVenta: number;
    valorInventarioCosto: number;
    totalMovimientos: number;
    volumenHistoricoMovimientos: number;
    totalCierresCaja: number;
    totalSepares: number;
  };
  datos: {
    clientes: any[];
    inventario: any[];
    movimientos: any[];
    cierresCaja: any[];
    separes: any[];
  };
}

function formatearFechaHoraColombia(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function estilizarEncabezadoTabla(row: ExcelJS.Row, colorHexARGB: string = 'FF0F172A') {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colorHexARGB },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: colorHexARGB } },
      bottom: { style: 'medium', color: { argb: colorHexARGB } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
}

export async function generarYDescargarExcelRespaldo(payload: RespuestaRespaldoAPI): Promise<string> {
  const { planEfectivo, fechaGeneracionISO, negocio, metricas, datos } = payload;
  const esGratis = planEfectivo === 'gratis';
  const esPro = planEfectivo === 'pro';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fiabono POS Cloud';
  wb.created = new Date();

  const fechaLegible = formatearFechaHoraColombia(fechaGeneracionISO);
  const etiquetaPlan =
    planEfectivo === 'pro'
      ? 'PLAN PRO ALMACÉN (Respaldo Maestro Ilimitado — 6 Hojas)'
      : planEfectivo === 'comercio'
        ? 'PLAN COMERCIO (Respaldo Maestro Ilimitado — 5 Hojas)'
        : 'PLAN GRATUITO (Respaldo Básico Mensual — 1 al mes)';

  // =========================================================================
  // HOJA 1: RESUMEN EJECUTIVO DEL NEGOCIO
  // =========================================================================
  const wsResumen = wb.addWorksheet('1. Resumen Ejecutivo', {
    properties: { tabColor: { argb: esPro ? 'FF7C3AED' : esGratis ? 'FF64748B' : 'FF2563EB' } },
  });

  wsResumen.mergeCells('A1:E1');
  const cellTitulo = wsResumen.getCell('A1');
  cellTitulo.value = `COPIA DE SEGURIDAD OFICIAL — ${String(negocio.nombreNegocio || 'MI NEGOCIO').toUpperCase()}`;
  cellTitulo.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cellTitulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: esPro ? 'FF5B21B6' : esGratis ? 'FF1E293B' : 'FF1D4ED8' },
  };
  cellTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 36;

  wsResumen.mergeCells('A2:E2');
  const cellSub = wsResumen.getCell('A2');
  cellSub.value = `Generado por Fiabono POS • Fecha de exportación: ${fechaLegible} • Nivel: ${etiquetaPlan}`;
  cellSub.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF334155' } };
  cellSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cellSub.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(2).height = 24;

  wsResumen.addRow([]);

  // Bloque 1: Ficha técnica del establecimiento
  const headerFicha = wsResumen.addRow(['FICHA DEL ESTABLECIMIENTO', 'DETALLE REGISTRADO', '', 'INDICADOR CLAVE DEL NEGOCIO', 'VALOR ACTUAL']);
  estilizarEncabezadoTabla(headerFicha, 'FF0F172A');
  wsResumen.mergeCells(`B${headerFicha.number}:C${headerFicha.number}`);

  const filasResumen: Array<[string, string, string, number | string, boolean]> = [
    ['Nombre Comercial', negocio.nombreNegocio, 'Total Clientes en Base de Datos', metricas.totalClientes, false],
    ['NIT / RUT / Documento', negocio.nitNegocio, 'Cartera Pendiente por Cobrar ($)', metricas.totalCarteraPorCobrar, true],
    ['Teléfono / WhatsApp', negocio.telefonoNegocio, 'Saldos a Favor de Clientes ($)', metricas.totalSaldosAFavor, true],
    ['Dirección Comercial', negocio.direccionNegocio, 'Referencias Activas en Inventario', metricas.totalProductos, false],
    ['Administrador Titular', negocio.nombreAdmin, 'Valor Inventario a Precio Venta ($)', metricas.valorInventarioVenta, true],
    [
      'Correo Electrónico',
      negocio.correoNegocio,
      'Valor Inventario al Costo ($)',
      esGratis ? '🔒 Exclusivo Plan Comercio / PRO' : metricas.valorInventarioCosto,
      !esGratis,
    ],
    [
      'Código Identificador',
      negocio.slugNegocio || 'N/A',
      'Transacciones Históricas Registradas',
      esGratis ? `${metricas.totalMovimientos} (🔒 Detalle en Comercio/PRO)` : metricas.totalMovimientos,
      false,
    ],
    [
      'Fecha de este Respaldo',
      fechaLegible,
      'Arqueos y Cierres de Caja',
      esGratis ? `${metricas.totalCierresCaja} (🔒 Detalle en Comercio/PRO)` : metricas.totalCierresCaja,
      false,
    ],
  ];

  filasResumen.forEach((f, idx) => {
    const r = wsResumen.addRow([f[0], f[1], '', f[2], f[3]]);
    wsResumen.mergeCells(`B${r.number}:C${r.number}`);
    r.height = 23;
    const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
    r.eachCell({ includeEmpty: true }, (c, colNum) => {
      c.font = {
        name: 'Segoe UI',
        size: 10,
        bold: colNum === 1 || colNum === 4 || colNum === 5,
        color: { argb: colNum === 5 && typeof f[3] === 'string' && f[3].includes('🔒') ? 'FFB45309' : 'FF1E293B' },
      };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNum === 5 && f[4] && typeof f[3] === 'number') {
        c.numFmt = '$#,##0';
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        c.alignment = { horizontal: colNum === 5 ? 'right' : 'left', vertical: 'middle' };
      }
    });
  });

  // Si es Plan Gratuito, agregar banner de incentivo comercial en la Hoja 1
  if (esGratis) {
    wsResumen.addRow([]);
    const bannerRow1 = wsResumen.addRow([
      '🚀 ¡DESBLOQUEA EL RESPALDO TOTAL DE TU NEGOCIO CON PLAN COMERCIO O PLAN PRO ALMACÉN!',
    ]);
    wsResumen.mergeCells(`A${bannerRow1.number}:E${bannerRow1.number}`);
    bannerRow1.height = 28;
    const cBanner1 = wsResumen.getCell(`A${bannerRow1.number}`);
    cBanner1.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cBanner1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
    cBanner1.alignment = { horizontal: 'center', vertical: 'middle' };

    const bannerRow2 = wsResumen.addRow([
      'Este archivo es tu respaldo mensual del Plan Gratuito (incluye hasta 15 clientes y 30 productos básicos). Al subir a Plan Comercio o Plan PRO Almacén desbloqueas Copias de Seguridad Completas e ILIMITADAS cuando quieras con TODO tu historial de ventas, fiados, abonos, costos y cierres de caja.',
    ]);
    wsResumen.mergeCells(`A${bannerRow2.number}:E${bannerRow2.number}`);
    bannerRow2.height = 42;
    const cBanner2 = wsResumen.getCell(`A${bannerRow2.number}`);
    cBanner2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF78350F' } };
    cBanner2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cBanner2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  wsResumen.getColumn(1).width = 28;
  wsResumen.getColumn(2).width = 24;
  wsResumen.getColumn(3).width = 18;
  wsResumen.getColumn(4).width = 36;
  wsResumen.getColumn(5).width = 34;

  // =========================================================================
  // HOJA 2: CLIENTES Y CARTERA
  // =========================================================================
  const wsClientes = wb.addWorksheet('2. Clientes y Cartera', {
    properties: { tabColor: { argb: 'FF059669' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headersClientes = [
    'Nombre Completo / Razón Social',
    'Tipo Doc.',
    'Número Documento',
    'Celular / WhatsApp',
    'Dirección',
    'Correo Electrónico',
    'Estado de Cuenta',
    'Deuda por Cobrar ($)',
    'Saldo a Favor ($)',
    'Notas / Observaciones',
  ];

  const hRowClientes = wsClientes.addRow(headersClientes);
  estilizarEncabezadoTabla(hRowClientes, 'FF059669');

  datos.clientes.forEach((c, idx) => {
    const deuda = Number(c.deudaTotal) || 0;
    const porCobrar = deuda > 0 ? deuda : 0;
    const saldoFavor = deuda < 0 ? Math.abs(deuda) : 0;
    const estado = deuda > 0 ? 'Con Deuda Pendiente' : deuda < 0 ? 'Saldo a Favor' : 'Al Día (Paz y Salvo)';

    const row = wsClientes.addRow([
      c.nombre || 'Sin nombre',
      c.tipoDocumento || 'CC',
      c.numeroDocumento ? `${c.numeroDocumento}${c.dv ? `-${c.dv}` : ''}` : '',
      c.celular || '',
      c.direccion || '',
      c.email || '',
      estado,
      porCobrar,
      saldoFavor,
      c.notas || '',
    ]);

    row.height = 22;
    const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: colNumber === 1 || colNumber === 8 || colNumber === 9,
        color: {
          argb:
            colNumber === 8 && porCobrar > 0
              ? 'FFDC2626'
              : colNumber === 9 && saldoFavor > 0
                ? 'FF059669'
                : 'FF1E293B',
        },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 8 || colNumber === 9) {
        cell.numFmt = '$#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  wsClientes.getColumn(1).width = 34;
  wsClientes.getColumn(2).width = 12;
  wsClientes.getColumn(3).width = 20;
  wsClientes.getColumn(4).width = 18;
  wsClientes.getColumn(5).width = 28;
  wsClientes.getColumn(6).width = 26;
  wsClientes.getColumn(7).width = 22;
  wsClientes.getColumn(8).width = 22;
  wsClientes.getColumn(9).width = 20;
  wsClientes.getColumn(10).width = 32;

  // =========================================================================
  // HOJA 3: INVENTARIO (BÁSICO EN GRATIS / CON COSTOS Y MÁRGENES EN COMERCIO Y PRO)
  // =========================================================================
  const wsInv = wb.addWorksheet(esGratis ? '3. Inventario Básico' : '3. Inventario y Costos', {
    properties: { tabColor: { argb: 'FF2563EB' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headersInv = esGratis
    ? [
        'Código / SKU',
        'Categoría',
        'Nombre del Producto / Servicio',
        'Tipo',
        'Stock Actual',
        'Precio de Venta ($)',
        'Valor Total a Precio Venta ($)',
        'Costo y Margen de Ganancia',
      ]
    : [
        'Código / SKU',
        'Categoría',
        'Nombre del Producto / Servicio',
        'Tipo',
        'Stock Actual',
        'Costo Unitario ($)',
        'Precio de Venta ($)',
        'Utilidad Unitaria ($)',
        'Margen (%)',
        'Valor Total Costo ($)',
        'Valor Total Venta ($)',
      ];

  const hRowInv = wsInv.addRow(headersInv);
  estilizarEncabezadoTabla(hRowInv, 'FF1D4ED8');

  datos.inventario.forEach((p, idx) => {
    const stock = p.inventariable ? Number(p.stock) || 0 : 0;
    const stockPositivo = Math.max(0, stock);
    const precio = Number(p.precioVenta) || 0;
    const costo = Number(p.costoCompra) || 0;
    const utilidadUnitaria = precio - costo;
    const margenPct = precio > 0 && costo > 0 ? ((precio - costo) / precio) * 100 : 0;
    const totalCosto = stockPositivo * costo;
    const totalVenta = stockPositivo * precio;

    const rowValues = esGratis
      ? [
          p.sku || '',
          p.categoria || 'General',
          p.nombre || '',
          p.tipoProducto || 'Producto',
          p.inventariable ? stock : 'Servicio',
          precio,
          totalVenta,
          '🔒 Disponible en Plan Comercio y PRO',
        ]
      : [
          p.sku || '',
          p.categoria || 'General',
          p.nombre || '',
          p.tipoProducto || 'Producto',
          p.inventariable ? stock : 'Servicio',
          costo,
          precio,
          utilidadUnitaria,
           `${margenPct.toFixed(1)}%`,
          totalCosto,
          totalVenta,
        ];

    const row = wsInv.addRow(rowValues);
    row.height = 22;
    const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: colNumber === 3 || (!esGratis && colNumber === 11) || (esGratis && colNumber === 7),
        color: { argb: esGratis && colNumber === 8 ? 'FFB45309' : 'FF1E293B' },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      const colsMoneda = esGratis ? [6, 7] : [6, 7, 8, 10, 11];
      if (colsMoneda.includes(colNumber)) {
        cell.numFmt = '$#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1 || colNumber === 4 || colNumber === 5 || (!esGratis && colNumber === 9)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  wsInv.getColumn(1).width = 18;
  wsInv.getColumn(2).width = 24;
  wsInv.getColumn(3).width = 36;
  wsInv.getColumn(4).width = 14;
  wsInv.getColumn(5).width = 15;
  wsInv.getColumn(6).width = 20;
  wsInv.getColumn(7).width = 22;
  wsInv.getColumn(8).width = esGratis ? 34 : 20;
  if (!esGratis) {
    wsInv.getColumn(9).width = 14;
    wsInv.getColumn(10).width = 22;
    wsInv.getColumn(11).width = 22;
  }

  // =========================================================================
  // SI ES PLAN GRATUITO -> HOJA 4 DEMOSTRATIVA DE CONVERSIÓN (UPSELL)
  // =========================================================================
  if (esGratis) {
    const wsUpsell = wb.addWorksheet('4. Historial y Caja (🔒 PRO)', {
      properties: { tabColor: { argb: 'FFD97706' } },
    });

    wsUpsell.mergeCells('A1:F1');
    const cUpTitle = wsUpsell.getCell('A1');
    cUpTitle.value = '🔒 HISTORIAL DE MOVIMIENTOS, CIERRES DE CAJA Y PLANES SEPARE (EXCLUSIVO COMERCIO Y PRO)';
    cUpTitle.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    cUpTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };
    cUpTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsUpsell.getRow(1).height = 34;

    wsUpsell.mergeCells('A2:F2');
    const cUpSub = wsUpsell.getCell('A2');
    cUpSub.value = `Tu negocio ya tiene ${metricas.totalMovimientos} movimientos registrados en Fiabono. ¡Sube a Plan Comercio o Plan PRO Almacén para descargarlos completos en Excel!`;
    cUpSub.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF78350F' } };
    cUpSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    cUpSub.alignment = { horizontal: 'center', vertical: 'middle' };
    wsUpsell.getRow(2).height = 26;

    wsUpsell.addRow([]);

    const hComparativa = wsUpsell.addRow([
      'MÓDULO DE RESPALDO EN EXCEL',
      'PLAN GRATUITO (Actual)',
      'PLAN COMERCIO',
      'PLAN PRO ALMACÉN',
      'DATOS ACUMULADOS EN TU NEGOCIO',
      'ESTADO EN ESTE ARCHIVO',
    ]);
    estilizarEncabezadoTabla(hComparativa, 'FF1E293B');

    const filasUpsell = [
      ['Frecuencia de Copias de Seguridad', '1 al mes (Básico)', 'ILIMITADAS (Completo)', 'ILIMITADAS (Completo + Separe)', 'Siempre disponible en la nube', 'Respaldo Básico Mensual'],
      ['Directorio de Clientes y Deudas', 'Hasta 15 clientes', '100% Ilimitados', '100% Ilimitados', `${metricas.totalClientes} clientes registrados`, 'Incluido en Hoja 2'],
      ['Inventario, Precios y Valorización', 'Hasta 30 productos', 'Ilimitado + Costos y Márgenes', 'Ilimitado + Costos y Márgenes', `${metricas.totalProductos} productos activos`, 'Básico en Hoja 3'],
      ['Historial Detallado de Ventas, Fiados y Abonos', 'No incluido', '✅ Incluido Completo', '✅ Incluido Completo', `${metricas.totalMovimientos} transacciones históricas`, '🔒 Sube a Comercio o PRO'],
      ['Auditoría de Cierres y Arqueos de Caja', 'No incluido', '✅ Incluido Completo', '✅ Incluido Completo', `${metricas.totalCierresCaja} cierres de turno`, '🔒 Sube a Comercio o PRO'],
      ['Control de Apartados y Planes Separe', 'No incluido', 'No incluido', '✅ Exclusivo Plan PRO', `${metricas.totalSepares} planes separe`, '🔒 Sube a Plan PRO'],
    ];

    filasUpsell.forEach((fila, idx) => {
      const r = wsUpsell.addRow(fila);
      r.height = 24;
      const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
      r.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          bold: colNumber === 1 || colNumber === 4 || colNumber === 6,
          color: { argb: colNumber === 6 && String(cell.value).includes('🔒') ? 'FFB45309' : 'FF1E293B' },
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center', vertical: 'middle' };
      });
    });

    wsUpsell.getColumn(1).width = 40;
    wsUpsell.getColumn(2).width = 24;
    wsUpsell.getColumn(3).width = 28;
    wsUpsell.getColumn(4).width = 28;
    wsUpsell.getColumn(5).width = 30;
    wsUpsell.getColumn(6).width = 28;
  } else {
    // =========================================================================
    // HOJA 4 (COMERCIO Y PRO): HISTORIAL COMPLETO DE MOVIMIENTOS
    // =========================================================================
    const wsMovs = wb.addWorksheet('4. Historial Movimientos', {
      properties: { tabColor: { argb: 'FF0D9488' } },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const headersMovs = [
      'Fecha y Hora',
      'Tipo de Operación',
      'Cliente',
      'Detalle de Artículos / Concepto',
      'Subtotal ($)',
      'Descuento ($)',
      'IVA ($)',
      'Monto Total ($)',
      'Medio de Pago',
      'Sub-Medio / Entidad',
      'Referencia / Voucher',
      'Saldo Cartera Resultante ($)',
      'Atendido por',
      'Factura Electrónica DIAN',
      'Estado',
    ];

    const hRowMovs = wsMovs.addRow(headersMovs);
    estilizarEncabezadoTabla(hRowMovs, 'FF0F766E');

    datos.movimientos.forEach((m, idx) => {
      const etiquetaTipo: Record<string, string> = {
        venta: 'Venta Contado',
        fiado: 'Fiado / Crédito',
        abono: 'Abono a Cartera',
        egreso: 'Gasto / Salida de Caja',
        entrega_separe: 'Entrega Plan Separe',
        ingreso_inventario: 'Ingreso de Mercancía',
        devolucion: 'Devolución',
      };

      const row = wsMovs.addRow([
        formatearFechaHoraColombia(m.fecha),
        etiquetaTipo[m.tipo] || String(m.tipo || '').toUpperCase(),
        m.clienteNombre || 'Cliente Mostrador',
        m.resumenArticulos || m.descripcion || '',
        Number(m.subtotal) || 0,
        Number(m.montoDescuento) || 0,
        Number(m.valorIva) || 0,
        Number(m.monto) || 0,
        String(m.metodoPago || 'efectivo').toUpperCase(),
        m.subMetodoPago || '',
        m.referenciaPago || '',
        m.saldoResultante !== null && m.saldoResultante !== undefined ? Number(m.saldoResultante) : '',
        m.registradoPor || 'Admin',
        m.facturaDian || '',
        m.anulado ? 'ANULADO' : 'VIGENTE',
      ]);

      row.height = 22;
      const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          bold: colNumber === 2 || colNumber === 8,
          color: { argb: m.anulado ? 'FF94A3B8' : 'FF1E293B' },
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if ([5, 6, 7, 8, 12].includes(colNumber) && typeof cell.value === 'number') {
          cell.numFmt = '$#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if ([1, 2, 9, 10, 11, 13, 14, 15].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    wsMovs.getColumn(1).width = 20;
    wsMovs.getColumn(2).width = 22;
    wsMovs.getColumn(3).width = 28;
    wsMovs.getColumn(4).width = 45;
    wsMovs.getColumn(5).width = 16;
    wsMovs.getColumn(6).width = 15;
    wsMovs.getColumn(7).width = 14;
    wsMovs.getColumn(8).width = 18;
    wsMovs.getColumn(9).width = 16;
    wsMovs.getColumn(10).width = 18;
    wsMovs.getColumn(11).width = 18;
    wsMovs.getColumn(12).width = 22;
    wsMovs.getColumn(13).width = 18;
    wsMovs.getColumn(14).width = 20;
    wsMovs.getColumn(15).width = 14;

    // =========================================================================
    // HOJA 5 (COMERCIO Y PRO): ARQUEOS Y CIERRES DE CAJA
    // =========================================================================
    const wsCierres = wb.addWorksheet('5. Cierres de Caja', {
      properties: { tabColor: { argb: 'FFD97706' } },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    const headersCierres = [
      'Fecha y Hora de Cierre',
      'Tipo',
      'Cajero / Responsable',
      'Base Inicial ($)',
      'Ventas Efectivo ($)',
      'Abonos Efectivo ($)',
      'Gastos / Egresos ($)',
      'Devoluciones Efectivo ($)',
      'Efectivo Esperado ($)',
      'Efectivo Contado Real ($)',
      'Diferencia ($)',
      'Estado de Cuadre',
      'Ventas Medios Digitales ($)',
      'Total Recaudado Turno ($)',
      'Observaciones',
    ];

    const hRowCierres = wsCierres.addRow(headersCierres);
    estilizarEncabezadoTabla(hRowCierres, 'FFB45309');

    datos.cierresCaja.forEach((c, idx) => {
      const row = wsCierres.addRow([
        formatearFechaHoraColombia(c.fechaCierre),
        c.tipoRegistro === 'arqueo_parcial' ? 'Arqueo Parcial' : 'Cierre de Turno',
        c.cerradoPorNombre || 'Admin',
        Number(c.baseInicial) || 0,
        Number(c.ventasEfectivo) || 0,
        Number(c.abonosEfectivo) || 0,
        Number(c.egresosEfectivo) || 0,
        Number(c.devolucionesEfectivo) || 0,
        Number(c.totalEfectivoEsperado) || 0,
        Number(c.totalEfectivoReal) || 0,
        Number(c.diferencia) || 0,
        String(c.tipoDiferencia || 'exacto').toUpperCase(),
        Number(c.totalVentasDigitales) || 0,
        Number(c.totalRecaudadoGeneral) || 0,
        c.notas || '',
      ]);

      row.height = 22;
      const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          bold: colNumber === 10 || colNumber === 11 || colNumber === 14,
          color: { argb: 'FF1E293B' },
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if ([4, 5, 6, 7, 8, 9, 10, 11, 13, 14].includes(colNumber)) {
          cell.numFmt = '$#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if ([1, 2, 3, 12].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    for (let i = 1; i <= 15; i++) {
      wsCierres.getColumn(i).width = i === 15 ? 34 : 20;
    }

    // =========================================================================
    // HOJA 6 (EXCLUSIVO PLAN PRO ALMACÉN): PLANES SEPARE
    // =========================================================================
    if (esPro) {
      const wsSepares = wb.addWorksheet('6. Planes Separe', {
        properties: { tabColor: { argb: 'FF7C3AED' } },
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      const headersSepares = [
        'Fecha de Creación',
        'Fecha Límite',
        'Estado',
        'Nombre del Cliente',
        'Celular Cliente',
        'Artículos Apartados',
        'Valor Total Acordado ($)',
        'Total Abonado ($)',
        'Saldo Pendiente ($)',
        'N° de Abonos',
        'Registrado por',
        'Notas',
      ];

      const hRowSepares = wsSepares.addRow(headersSepares);
      estilizarEncabezadoTabla(hRowSepares, 'FF6D28D9');

      datos.separes.forEach((s, idx) => {
        const row = wsSepares.addRow([
          formatearFechaHoraColombia(s.fechaCreacion),
          formatearFechaHoraColombia(s.fechaLimite),
          String(s.estado || 'activo').toUpperCase(),
          s.clienteNombre || '',
          s.clienteCelular || '',
          s.articulos || '',
          Number(s.total) || 0,
          Number(s.montoPagado) || 0,
          Number(s.saldoPendiente) || 0,
          Number(s.cantidadAbonos) || 0,
          s.creadoPor || 'Admin',
          s.notas || '',
        ]);

        row.height = 22;
        const bg = idx % 2 === 1 ? 'FFF8FAFC' : 'FFFFFFFF';
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: 'Segoe UI',
            size: 9.5,
            bold: colNumber === 3 || colNumber === 9,
            color: { argb: 'FF1E293B' },
          };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };

          if ([7, 8, 9].includes(colNumber)) {
            cell.numFmt = '$#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if ([1, 2, 3, 5, 10, 11].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });

      wsSepares.getColumn(1).width = 20;
      wsSepares.getColumn(2).width = 20;
      wsSepares.getColumn(3).width = 16;
      wsSepares.getColumn(4).width = 28;
      wsSepares.getColumn(5).width = 18;
      wsSepares.getColumn(6).width = 42;
      wsSepares.getColumn(7).width = 22;
      wsSepares.getColumn(8).width = 20;
      wsSepares.getColumn(9).width = 20;
      wsSepares.getColumn(10).width = 14;
      wsSepares.getColumn(11).width = 18;
      wsSepares.getColumn(12).width = 30;
    }
  }

  // Generar archivo y disparar descarga en el navegador
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fechaCorta = new Date(fechaGeneracionISO).toISOString().slice(0, 10);
  const slugLimpio = String(negocio.nombreNegocio || 'Negocio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 28);

  const nombreArchivo = `Respaldo_Fiabono_${slugLimpio}_${fechaCorta}.xlsx`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return nombreArchivo;
}
