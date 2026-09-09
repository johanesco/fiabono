import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { Movimiento, Cliente } from '../types';

export interface DatosExportacionReporte {
  nombreNegocio: string;
  logoNegocio?: string | null;
  nitNegocio?: string;
  telefonoNegocio?: string;
  direccionNegocio?: string;
  nombreGenerador?: string;
  rangoTexto: string;
  fechaGeneracion: Date;
  // Métricas del periodo
  totalVentas: number;
  countVentas: number;
  totalFiados: number;
  countFiados: number;
  totalAbonos: number;
  countAbonos: number;
  totalEgresos: number;
  countEgresos?: number;
  ingresosCaja: number;
  // Métodos de pago
  totalEfectivo: number;
  totalTransferencia: number;
  totalDatafono: number;
  totalCreditoExterno: number;
  // Cartera general
  carteraTotal: number;
  totalClientesConDeuda: number;
  // Utilidad estimada
  costoTotalMercancia?: number;
  utilidadBruta?: number;
  margenPorcentaje?: number;
  // Separes
  totalSeparesActivos?: number;
  abonosSeparesActivos?: number;
  saldoSeparesActivos?: number;
  countSeparesActivos?: number;
  // Listas de datos para auditoría
  movimientos: Movimiento[];
  clientesConDeuda: Cliente[];
  separesActivos?: any[];
  colaboradoresRanking?: { nombre: string; monto: number; cantidad: number }[];
  productosEstrella?: { nombre: string; cantidad: number; total: number }[];
}

const formatearMoneda = (val: number) => `$${Math.round(val || 0).toLocaleString('es-CO')}`;

const formatearFechaHora = (fecha: any) => {
  if (!fecha) return 'Sin fecha';
  let d: Date;
  if (typeof fecha.toDate === 'function') d = fecha.toDate();
  else if (fecha instanceof Date) d = fecha;
  else if (fecha?.seconds) d = new Date(fecha.seconds * 1000);
  else d = new Date(fecha);

  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatearFechaHoraCorta = (fecha: any) => {
  if (!fecha) return 'Sin fecha';
  let d: Date;
  if (typeof fecha.toDate === 'function') d = fecha.toDate();
  else if (fecha instanceof Date) d = fecha;
  else if (fecha?.seconds) d = new Date(fecha.seconds * 1000);
  else d = new Date(fecha);

  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatearPorcentaje = (monto: number, total: number): string => {
  if (!total || total <= 0 || !monto || monto <= 0) return '0%';
  const p = (monto / total) * 100;
  if (p >= 100) return '100%';
  if (p >= 99.0 && p < 100) return `${p.toFixed(1)}%`;
  if (p < 0.1) return '< 0.1%';
  if (p < 10 && !Number.isInteger(p)) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
};

/**
 * =========================================================================
 * 1. GENERADOR DE EXCEL MULTILIBRO FORMATEADO (EXCELJS)
 * =========================================================================
 */
export async function exportarReporteExcel(datos: DatosExportacionReporte): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fiabono POS';
  wb.created = new Date();

  const colorEsmeraldaOscuro = 'FF047857';
  const colorEsmeraldaClaro = 'FF10B981';
  const colorAzulNoche = 'FF0F172A';
  const colorGrisFondo = 'FFF8FAFC';
  const colorGrisBorde = 'FFE2E8F0';

  // -------------------------------------------------------------------------
  // HOJA 1: RESUMEN EJECUTIVO
  // -------------------------------------------------------------------------
  const wsResumen = wb.addWorksheet('Resumen Ejecutivo', {
    properties: { tabColor: { argb: colorEsmeraldaClaro } },
    views: [{ showGridLines: true }]
  });

  wsResumen.getColumn(1).width = 4;
  wsResumen.getColumn(2).width = 34;
  wsResumen.getColumn(3).width = 24;

  const rTit = wsResumen.getRow(2);
  rTit.getCell(2).value = datos.nombreNegocio.toUpperCase();
  rTit.getCell(2).font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: colorAzulNoche } };

  const rSub = wsResumen.getRow(3);
  rSub.getCell(2).value = `INFORME FINANCIERO EJECUTIVO • FIABONO POS`;
  rSub.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: colorEsmeraldaOscuro } };

  const rMeta = wsResumen.getRow(4);
  rMeta.getCell(2).value = `Periodo: ${datos.rangoTexto} | Emitido: ${formatearFechaHora(datos.fechaGeneracion)} | Generado por: ${datos.nombreGenerador || 'Administrador'}`;
  rMeta.getCell(2).font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };

  let filaActual = 6;

  const agregarSeccion = (titulo: string, items: { etiqueta: string; valor: any; esMoneda?: boolean; esPorcentaje?: boolean; formula?: string }[], colStart = 2) => {
    const rHead = wsResumen.getRow(filaActual);
    rHead.getCell(colStart).value = titulo;
    rHead.getCell(colStart).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    rHead.getCell(colStart).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorAzulNoche } };
    rHead.getCell(colStart + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorAzulNoche } };
    rHead.height = 24;

    filaActual++;
    items.forEach((item, idx) => {
      const r = wsResumen.getRow(filaActual);
      r.height = 20;
      const isOdd = idx % 2 === 1;
      const bg = isOdd ? colorGrisFondo : 'FFFFFFFF';

      r.getCell(colStart).value = item.etiqueta;
      r.getCell(colStart).font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
      r.getCell(colStart).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      r.getCell(colStart).border = { bottom: { style: 'thin', color: { argb: colorGrisBorde } }, left: { style: 'thin', color: { argb: colorGrisBorde } } };

      const cVal = r.getCell(colStart + 1);
      if (item.formula) {
        cVal.value = { formula: item.formula };
      } else {
        cVal.value = item.valor;
      }
      cVal.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cVal.border = { bottom: { style: 'thin', color: { argb: colorGrisBorde } }, right: { style: 'thin', color: { argb: colorGrisBorde } } };

      if (item.esMoneda) {
        cVal.numFmt = '$#,##0';
        cVal.alignment = { horizontal: 'right' };
      } else if (item.esPorcentaje) {
        cVal.numFmt = '0%';
        cVal.alignment = { horizontal: 'right' };
      } else if (typeof item.valor === 'number') {
        cVal.numFmt = '#,##0';
        cVal.alignment = { horizontal: 'right' };
      }

      filaActual++;
    });
    filaActual += 1;
  };

  const itemsFlujo: { etiqueta: string; valor: any; esMoneda?: boolean }[] = [
    { etiqueta: 'Ventas de Contado Totales', valor: datos.totalVentas, esMoneda: true },
    { etiqueta: 'Transacciones de Venta', valor: datos.countVentas },
    { etiqueta: 'Total Fiados Otorgados (Créditos)', valor: datos.totalFiados, esMoneda: true },
    { etiqueta: 'Abonos Recibidos en Caja', valor: datos.totalAbonos, esMoneda: true },
  ];
  if (datos.totalEgresos && datos.totalEgresos > 0) {
    itemsFlujo.push({ etiqueta: 'Egresos / Gastos Registrados', valor: datos.totalEgresos, esMoneda: true });
  }
  itemsFlujo.push({ etiqueta: 'TOTAL DINERO EN CAJA (Contado + Abonos)', valor: datos.ingresosCaja, esMoneda: true });

  agregarSeccion('1. FLUJO FINANCIERO Y CAJA', itemsFlujo);

  agregarSeccion('2. ARQUEO POR MÉTODOS DE PAGO', [
    { etiqueta: 'Efectivo Físico en Gaveta', valor: Math.max(0, datos.totalEfectivo), esMoneda: true },
    { etiqueta: 'Transferencias Digitales (Nequi/Daviplata)', valor: datos.totalTransferencia, esMoneda: true },
    { etiqueta: 'Datáfono (Tarjetas Débito/Crédito)', valor: datos.totalDatafono, esMoneda: true },
    { etiqueta: 'Crédito Externo (SisteCrédito/Addi)', valor: datos.totalCreditoExterno, esMoneda: true }
  ]);

  agregarSeccion('3. CARTERA Y RENTABILIDAD', [
    { etiqueta: 'Cartera Total Pendiente por Cobrar', valor: datos.carteraTotal, esMoneda: true },
    { etiqueta: 'Clientes con Saldo Pendiente', valor: datos.totalClientesConDeuda },
    { etiqueta: 'Inversión en Mercancía Vendida (Costo)', valor: datos.costoTotalMercancia || 0, esMoneda: true },
    { etiqueta: 'Ganancia Bruta Estimada', valor: datos.utilidadBruta || 0, esMoneda: true },
    { etiqueta: 'Margen de Rentabilidad Promedio', valor: (datos.margenPorcentaje || 0) / 100, esPorcentaje: true }
  ]);

  if (datos.countSeparesActivos !== undefined && datos.countSeparesActivos > 0) {
    agregarSeccion('4. PLANES SEPARE EN CUSTODIA (PRO)', [
      { etiqueta: 'Planes Separe Activos', valor: datos.countSeparesActivos },
      { etiqueta: 'Valor Total en Mercancía Apartada', valor: datos.totalSeparesActivos || 0, esMoneda: true },
      { etiqueta: 'Anticipos y Abonos Recibidos en Caja', valor: datos.abonosSeparesActivos || 0, esMoneda: true },
      { etiqueta: 'Saldo Restante por Recaudar al Entregar', valor: datos.saldoSeparesActivos || 0, esMoneda: true }
    ]);
  }

  // -------------------------------------------------------------------------
  // HOJA 2: LIBRO DE MOVIMIENTOS
  // -------------------------------------------------------------------------
  const wsMovs = wb.addWorksheet('Libro de Movimientos', {
    properties: { tabColor: { argb: 'FF3B82F6' } },
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const movHeaders = [
    'Fecha y Hora',
    'Tipo Operación',
    'Cliente / Destino',
    'Descripción / Detalle',
    'Método de Pago',
    'Responsable (Vendedor)',
    'Monto ($)'
  ];

  const rHeadMov = wsMovs.addRow(movHeaders);
  rHeadMov.height = 26;
  rHeadMov.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorAzulNoche } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  datos.movimientos.forEach((m, idx) => {
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? colorGrisFondo : 'FFFFFFFF';

    const r = wsMovs.addRow([
      formatearFechaHora(m.fecha),
      (m.tipo || '').toUpperCase(),
      (m as any).clienteNombre || (m.clienteId === 'mostrador' ? 'Venta de Mostrador' : 'Cliente General'),
      m.descripcion || (Array.isArray(m.detalles) ? m.detalles.map((d: any) => `${d.cantidad || 1}x ${d.descripcion}`).join(', ') : ''),
      (m.metodoPago || 'Efectivo').toUpperCase(),
      m.registradoPor || 'Admin',
      m.monto || 0
    ]);

    r.height = 20;
    r.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'thin', color: { argb: colorGrisBorde } } };

      if (colNum === 1 || colNum === 2 || colNum === 5 || colNum === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNum === 7) {
        cell.numFmt = '$#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: m.tipo === 'fiado' ? 'FFE11D48' : 'FF047857' } };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const filaTotalMov = wsMovs.addRow(['', '', '', '', '', 'TOTAL CONSOLIDADO:', { formula: `SUM(G2:G${datos.movimientos.length + 1})` }]);
  filaTotalMov.height = 24;
  filaTotalMov.getCell(6).font = { name: 'Segoe UI', size: 10, bold: true };
  filaTotalMov.getCell(7).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: colorEsmeraldaOscuro } };
  filaTotalMov.getCell(7).numFmt = '$#,##0';

  wsMovs.getColumn(1).width = 20;
  wsMovs.getColumn(2).width = 16;
  wsMovs.getColumn(3).width = 26;
  wsMovs.getColumn(4).width = 40;
  wsMovs.getColumn(5).width = 18;
  wsMovs.getColumn(6).width = 20;
  wsMovs.getColumn(7).width = 18;

  // -------------------------------------------------------------------------
  // HOJA 3: CARTERA Y CRÉDITOS PENDIENTES
  // -------------------------------------------------------------------------
  const wsCartera = wb.addWorksheet('Cartera Activa', {
    properties: { tabColor: { argb: 'FFF59E0B' } },
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  const cartHeaders = ['Nombre del Cliente', 'Celular de Contacto', 'Dirección / Notas', 'Deuda Pendiente ($)'];
  const rHeadCart = wsCartera.addRow(cartHeaders);
  rHeadCart.height = 26;
  rHeadCart.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  datos.clientesConDeuda.forEach((c, idx) => {
    const isOdd = idx % 2 === 1;
    const bg = isOdd ? colorGrisFondo : 'FFFFFFFF';

    const r = wsCartera.addRow([
      c.nombre,
      c.celular || 'Sin registrar',
      c.direccion || '',
      c.deudaTotal || 0
    ]);
    r.height = 20;
    r.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.border = { bottom: { style: 'thin', color: { argb: colorGrisBorde } } };

      if (colNum === 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      else if (colNum === 4) {
        cell.numFmt = '$#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFE11D48' } };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const filaTotalCart = wsCartera.addRow(['', '', 'TOTAL CARTERA PENDIENTE:', { formula: `SUM(D2:D${datos.clientesConDeuda.length + 1})` }]);
  filaTotalCart.height = 24;
  filaTotalCart.getCell(3).font = { name: 'Segoe UI', size: 10, bold: true };
  filaTotalCart.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFE11D48' } };
  filaTotalCart.getCell(4).numFmt = '$#,##0';

  wsCartera.getColumn(1).width = 30;
  wsCartera.getColumn(2).width = 20;
  wsCartera.getColumn(3).width = 35;
  wsCartera.getColumn(4).width = 24;

  // -------------------------------------------------------------------------
  // HOJA 4: PLANES SEPARE (PRO)
  // -------------------------------------------------------------------------
  if (datos.separesActivos && datos.separesActivos.length > 0) {
    const wsSepares = wb.addWorksheet('Planes Separe', {
      properties: { tabColor: { argb: 'FF8B5CF6' } },
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    const sepHeaders = ['Cliente', 'Prendas / Artículos Apartados', 'Fecha Creación', 'Fecha Límite', 'Total Separe ($)', 'Abonado en Caja ($)', 'Saldo Pendiente ($)'];
    const rHeadSep = wsSepares.addRow(sepHeaders);
    rHeadSep.height = 26;
    rHeadSep.eachCell(cell => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    datos.separesActivos.forEach((s, idx) => {
      const isOdd = idx % 2 === 1;
      const bg = isOdd ? colorGrisFondo : 'FFFFFFFF';
      const itemsStr = Array.isArray(s.items) ? s.items.map((it: any) => `${it.cantidad || 1}x ${it.descripcion}`).join(', ') : 'Prendas apartadas';

      const r = wsSepares.addRow([
        s.clienteNombre || 'Cliente',
        itemsStr,
        formatearFechaHora(s.fechaCreacion),
        s.fechaLimite ? formatearFechaHora(s.fechaLimite) : 'Sin fecha límite',
        s.total || 0,
        s.montoPagado || 0,
        s.saldoPendiente || 0
      ]);

      r.height = 20;
      r.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = { bottom: { style: 'thin', color: { argb: colorGrisBorde } } };

        if (colNum === 3 || colNum === 4) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (colNum >= 5) {
          cell.numFmt = '$#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true };
          if (colNum === 6) cell.font = { ...cell.font, color: { argb: 'FF047857' } };
          if (colNum === 7) cell.font = { ...cell.font, color: { argb: 'FF6D28D9' } };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    wsSepares.getColumn(1).width = 26;
    wsSepares.getColumn(2).width = 38;
    wsSepares.getColumn(3).width = 20;
    wsSepares.getColumn(4).width = 20;
    wsSepares.getColumn(5).width = 18;
    wsSepares.getColumn(6).width = 20;
    wsSepares.getColumn(7).width = 20;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * =========================================================================
 * 2. GENERADOR DE PDF EJECUTIVO DE ALTA DEFINICIÓN (JSPDF)
 * =========================================================================
 */
export async function exportarReportePdf(datos: DatosExportacionReporte): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const margenIzq = 14;
  const margenDer = anchoPagina - 14;
  const anchoUtil = margenDer - margenIzq;

  // 1. Barra superior decorativa verde esmeralda corporativo
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, anchoPagina, 4.5, 'F');

  let y = 14;

  // 2. Cabecera con Logomarca o Logo Real del Negocio
  let xTextoHeader = margenIzq;

  if (datos.logoNegocio) {
    try {
      // Intentar cargar la imagen del logo del usuario en el PDF
      const img = new Image();
      if (!datos.logoNegocio.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = datos.logoNegocio!;
      });
      // Altura máxima 12.5mm proporcional
      const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
      const altoImg = 12.5;
      const anchoImg = Math.min(32, altoImg * ratio);

      // Convertir a canvas para asegurar compatibilidad total de formato en jsPDF
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 200;
      canvas.height = img.height || 200;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      doc.addImage(dataUrl, 'PNG', margenIzq, y, anchoImg, altoImg);
      xTextoHeader = margenIzq + anchoImg + 4;
    } catch (err) {
      // Si falla por CORS o formato, usar isotipo sobrio con la inicial del negocio real
      const inicial = (datos.nombreNegocio || 'M').charAt(0).toUpperCase();
      doc.setFillColor(15, 23, 42); // slate-900
      doc.roundedRect(margenIzq, y, 11.5, 11.5, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(16, 185, 129); // esmeralda
      doc.text(inicial, margenIzq + 3.8, y + 8.2);
      xTextoHeader = margenIzq + 15;
    }
  } else {
    // Isotipo elegante con la inicial del nombre real del negocio
    const inicial = (datos.nombreNegocio || 'M').charAt(0).toUpperCase();
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margenIzq, y, 11.5, 11.5, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(16, 185, 129); // esmeralda
    doc.text(inicial, margenIzq + 3.8, y + 8.2);
    xTextoHeader = margenIzq + 15;
  }

  // Nombre del Negocio
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  const nombreNegocioLimpio = (datos.nombreNegocio || 'MI NEGOCIO').toUpperCase();
  doc.text(nombreNegocioLimpio, xTextoHeader, y + 5.5);

  // Subtítulo de información fiscal y contacto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const infoContacto = [
    datos.nitNegocio ? `NIT: ${datos.nitNegocio}` : null,
    datos.telefonoNegocio ? `Tel: ${datos.telefonoNegocio}` : null,
    datos.direccionNegocio || null
  ].filter(Boolean).join('  •  ');
  doc.text(infoContacto || 'Comercio Registrado en Fiabono Cloud POS', xTextoHeader, y + 10);

  // Badge PRO: recalculado ancho y alineación para evitar cualquier desbordamiento
  const anchoBadge = 48;
  const xBadge = margenDer - anchoBadge;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(xBadge, y + 1, anchoBadge, 7.8, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87); // emerald-700
  doc.text('INFORME FINANCIERO PRO', xBadge + (anchoBadge / 2), y + 6.1, { align: 'center' });

  y += 16;

  // 3. Tarjeta de Metadatos del Periodo y Auditoría
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margenIzq, y, anchoUtil, 12.5, 2.5, 2.5, 'FD');

  // Línea izquierda: Periodo
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PERIODO AUDITADO:', margenIzq + 4, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(4, 120, 87);
  doc.text(datos.rangoTexto, margenIzq + 34, y + 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado por: ${datos.nombreGenerador || 'Administrador'}`, margenIzq + 4, y + 9.5);

  // Línea derecha: Emisión y Sistema
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('FECHA DE EMISIÓN:', margenDer - 72, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(formatearFechaHora(datos.fechaGeneracion), margenDer - 40, y + 5);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Plataforma: Fiabono POS Cloud (Cifrado SHA-256)', margenDer - 72, y + 9.5);

  y += 17;

  // 4. KPIS PRINCIPALES (4 TARJETAS AMPLIAS Y DIRECTAS AL GRANO)
  const cantidadCards = 4;
  const gapCard = 3;
  const anchoCard = (anchoUtil - (gapCard * (cantidadCards - 1))) / cantidadCards;
  const altoCard = 22.5;

  const kpis = [
    { 
      label: 'VENTAS CONTADO', 
      val: formatearMoneda(datos.totalVentas), 
      sub: datos.countVentas === 1 ? '1 venta cobrada' : `${datos.countVentas} ventas`, 
      r: 16, g: 185, b: 129
    },
    { 
      label: 'FIADOS OTORGADOS', 
      val: formatearMoneda(datos.totalFiados), 
      sub: datos.countFiados === 1 ? '1 crédito dado' : `${datos.countFiados} créditos`, 
      r: 245, g: 158, b: 11
    },
    { 
      label: 'ABONOS RECAUDADOS', 
      val: formatearMoneda(datos.totalAbonos), 
      sub: datos.countAbonos === 1 ? '1 abono recibido' : `${datos.countAbonos} recaudos`, 
      r: 37, g: 99, b: 235
    },
    { 
      label: 'TOTAL DINERO EN CAJA', 
      val: formatearMoneda(datos.ingresosCaja), 
      sub: 'Ventas Contado + Abonos', 
      r: 5, g: 150, b: 105
    }
  ];

  kpis.forEach((k, idx) => {
    const xCard = margenIzq + idx * (anchoCard + gapCard);

    // Fondo blanco nítido (con suave realce esmeralda para la 4ta tarjeta de Gran Total)
    if (idx === 3) {
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(167, 243, 208); // emerald-200
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
    }
    doc.roundedRect(xCard, y, anchoCard, altoCard, 2, 2, 'FD');

    // Pastilla superior de color temático
    doc.setFillColor(k.r, k.g, k.b);
    doc.roundedRect(xCard, y, anchoCard, 2.2, 1, 1, 'F');

    // Título de la tarjeta
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, xCard + 3.5, y + 6.5);

    // Monto principal grande
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(k.val, xCard + 3.5, y + 13.8);

    // Subtexto descriptivo
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(k.sub, xCard + 3.5, y + 18.8);
  });

  y += altoCard + 6;

  // 5. DESGLOSE DE MÉTODOS DE PAGO Y ARQUEO FÍSICO CON BARRAS DE PROGRESO
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DESGLOSE DE MEDIOS DE PAGO Y ARQUEO EN CAJA', margenIzq, y);

  y += 3.5;

  const metodos = [
    { 
      nombre: 'Efectivo en Gaveta (Billetes / Monedas Físicas)', 
      monto: Math.max(0, datos.totalEfectivo), 
      color: [16, 185, 129] 
    },
    { 
      nombre: 'Transferencias Digitales (Nequi / Daviplata / Bancolombia)', 
      monto: datos.totalTransferencia, 
      color: [37, 99, 235] 
    },
    { 
      nombre: 'Datáfono (Tarjetas Débito y Crédito POS)', 
      monto: datos.totalDatafono, 
      color: [147, 51, 234] 
    },
    { 
      nombre: 'Crédito Externo (SisteCrédito / Addi / Financieras)', 
      monto: datos.totalCreditoExterno, 
      color: [245, 158, 11] 
    }
  ];

  const totalMetodos = (datos.totalVentas + datos.totalAbonos) || 1;

  metodos.forEach((m) => {
    const pctNum = totalMetodos > 0 && m.monto > 0 ? (m.monto / totalMetodos) * 100 : 0;
    const textoPct = formatearPorcentaje(m.monto, totalMetodos);
    
    // Fila blanca con borde sutil
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(241, 245, 249);
    doc.rect(margenIzq, y, anchoUtil, 7.2, 'FD');

    // Punto indicador de color
    doc.setFillColor(m.color[0], m.color[1], m.color[2]);
    doc.circle(margenIzq + 3.5, y + 3.6, 1.2, 'F');

    // Nombre
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(m.nombre, margenIzq + 7, y + 4.8);

    // Mini barra de progreso visual (ancho 28mm ubicada a la izquierda del porcentaje)
    const anchoBarraMax = 28;
    const xBarra = margenDer - 76;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(xBarra, y + 2.5, anchoBarraMax, 2.2, 1, 1, 'F');
    if (pctNum > 0) {
      const anchoProgreso = Math.max(1.5, Math.min(anchoBarraMax, (pctNum / 100) * anchoBarraMax));
      doc.setFillColor(m.color[0], m.color[1], m.color[2]);
      doc.roundedRect(xBarra, y + 2.5, anchoProgreso, 2.2, 1, 1, 'F');
    }

    // Porcentaje (ubicado entre la barra y el monto, sin tocarse)
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(textoPct, margenDer - 35, y + 4.8, { align: 'right' });

    // Monto alineado al margen derecho
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatearMoneda(m.monto), margenDer - 2, y + 4.8, { align: 'right' });

    y += 7.5;
  });

  y += 3.5;

  // 6. SECCIÓN DOBLE INTELIGENTE:
  // LADO IZQUIERDO: RENTABILIDAD Y RESUMEN DE NEGOCIO
  // LADO DERECHO: TOP PRODUCTOS VENDIDOS (O SEPARES SI HAY ACTIVOS)
  const mitad = (anchoUtil - 5) / 2;
  const altoBloqueMedio = 32;

  // Columna Izquierda: Utilidad y Cartera General
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margenIzq, y, mitad, altoBloqueMedio, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('SALUD FINANCIERA Y RENTABILIDAD', margenIzq + 4, y + 5.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Cartera total en la calle:', margenIzq + 4, y + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72);
  doc.text(formatearMoneda(datos.carteraTotal || 0), margenIzq + mitad - 4, y + 11.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Costo mercancía vendida:', margenIzq + 4, y + 17.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatearMoneda(datos.costoTotalMercancia || 0), margenIzq + mitad - 4, y + 17.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Ganancia bruta estimada:', margenIzq + 4, y + 23.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${formatearMoneda(datos.utilidadBruta || 0)} (${datos.margenPorcentaje || 0}%)`, margenIzq + mitad - 4, y + 23.5, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text('* Basado en costo vs precio de venta en Inventario', margenIzq + 4, y + 29);

  // Columna Derecha Inteligente:
  const xDer = margenIzq + mitad + 5;
  const tieneSepares = (datos.countSeparesActivos || 0) > 0;

  if (tieneSepares) {
    // Si tiene Plan Separe activo, muestra el módulo separe
    doc.setFillColor(250, 245, 255); // purple-50
    doc.setDrawColor(233, 213, 255); // purple-200
    doc.roundedRect(xDer, y, mitad, altoBloqueMedio, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text('CONTROL DE PLANES SEPARE (PRO)', xDer + 4, y + 5.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Prendas/Planes activos:', xDer + 4, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${datos.countSeparesActivos || 0} planes`, xDer + mitad - 4, y + 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Anticipos en caja:', xDer + 4, y + 18.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(formatearMoneda(datos.abonosSeparesActivos || 0), xDer + mitad - 4, y + 18.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Saldo por cobrar al entregar:', xDer + 4, y + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(147, 51, 234);
    doc.text(formatearMoneda(datos.saldoSeparesActivos || 0), xDer + mitad - 4, y + 25, { align: 'right' });
  } else {
    // Si NO usa separe o está en cero, muestra los TOP PRODUCTOS MÁS VENDIDOS (Altamente práctico)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(xDer, y, mitad, altoBloqueMedio, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PRODUCTOS MÁS VENDIDOS EN EL PERIODO', xDer + 4, y + 5.5);

    const prods = (datos.productosEstrella || []).slice(0, 3);
    if (prods.length > 0) {
      prods.forEach((p, idxP) => {
        const yP = y + 11.5 + (idxP * 6.5);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        const nomCortado = p.nombre.length > 22 ? p.nombre.slice(0, 20) + '..' : p.nombre;
        doc.text(`${idxP + 1}. ${nomCortado}`, xDer + 4, yP);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`${p.cantidad} unids`, xDer + mitad - 28, yP);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(formatearMoneda(p.total), xDer + mitad - 4, yP, { align: 'right' });
      });
    } else {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('Sin registro de productos vendidos en este periodo.', xDer + 4, y + 16);
      doc.text('Aparecerán automáticamente al realizar ventas.', xDer + 4, y + 22);
    }
  }

  y += altoBloqueMedio + 5;

  // 7. SECCIÓN DE COBRANZA PRIORITARIA (TOP CLIENTES CON DEUDA)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('COBRANZA PRIORITARIA • MAYORES SALDOS EN CARTERA', margenIzq, y);

  y += 3.5;

  const cabeceraCartera = ['Cliente', 'Contacto Celular', 'Saldo Pendiente', 'Participación en Cartera'];
  doc.setFillColor(15, 23, 42);
  doc.rect(margenIzq, y, anchoUtil, 5.5, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(cabeceraCartera[0], margenIzq + 4, y + 4);
  doc.text(cabeceraCartera[1], margenIzq + 65, y + 4);
  doc.text(cabeceraCartera[2], margenIzq + 115, y + 4);
  doc.text(cabeceraCartera[3], margenDer - 4, y + 4, { align: 'right' });

  y += 5.5;

  const topClientes = datos.clientesConDeuda.slice(0, 4);

  if (topClientes.length > 0) {
    topClientes.forEach((c, idx) => {
      const isOdd = idx % 2 === 1;
      doc.setFillColor(isOdd ? 248 : 255, isOdd ? 250 : 255, isOdd ? 252 : 255);
      doc.rect(margenIzq, y, anchoUtil, 5.8, 'F');

      const textoPct = formatearPorcentaje(c.deudaTotal || 0, datos.carteraTotal);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`#${idx + 1} ${c.nombre}`, margenIzq + 4, y + 4.1);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(c.celular || 'Sin teléfono', margenIzq + 65, y + 4.1);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(formatearMoneda(c.deudaTotal || 0), margenIzq + 115, y + 4.1);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${textoPct} del total`, margenDer - 4, y + 4.1, { align: 'right' });

      y += 5.8;
    });
  } else {
    doc.setFillColor(255, 255, 255);
    doc.rect(margenIzq, y, anchoUtil, 7, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('No hay clientes con saldos pendientes por cobrar en este momento. Cartera al 100% al día.', margenIzq + 4, y + 4.8);
    y += 7;
  }

  y += 5.5;

  // 8. LIBRO DIARIO • AUDITORÍA DE OPERACIONES EN EL PERIODO (Aprovechamiento integral de la hoja)
  const yPie = altoPagina - 11;
  const espacioDisponible = yPie - y - 6;
  const maxFilasOps = Math.max(0, Math.min(7, Math.floor((espacioDisponible - 11) / 5.5)));

  if (maxFilasOps >= 2 && datos.movimientos && datos.movimientos.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('AUDITORÍA DE OPERACIONES • MOVIMIENTOS RECIENTES DEL PERIODO', margenIzq, y);

    y += 3.5;

    const cabeceraOps = ['Fecha / Hora', 'Operación', 'Cliente / Concepto', 'Medio de Pago', 'Responsable', 'Monto'];
    doc.setFillColor(15, 23, 42);
    doc.rect(margenIzq, y, anchoUtil, 5.5, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(cabeceraOps[0], margenIzq + 4, y + 4);
    doc.text(cabeceraOps[1], margenIzq + 38, y + 4);
    doc.text(cabeceraOps[2], margenIzq + 72, y + 4);
    doc.text(cabeceraOps[3], margenIzq + 118, y + 4);
    doc.text(cabeceraOps[4], margenIzq + 148, y + 4);
    doc.text(cabeceraOps[5], margenDer - 4, y + 4, { align: 'right' });

    y += 5.5;

    // Ordenar cronológicamente descendente (más recientes primero)
    const movsOrdenados = [...datos.movimientos].sort((a, b) => {
      const getMs = (f: any) => {
        if (!f) return 0;
        if (f.seconds) return f.seconds * 1000;
        if (typeof f.toDate === 'function') return f.toDate().getTime();
        return new Date(f).getTime() || 0;
      };
      return getMs(b.fecha) - getMs(a.fecha);
    });

    const movsMuestra = movsOrdenados.slice(0, maxFilasOps);

    movsMuestra.forEach((m, idx) => {
      const isOdd = idx % 2 === 1;
      doc.setFillColor(isOdd ? 248 : 255, isOdd ? 250 : 255, isOdd ? 252 : 255);
      doc.rect(margenIzq, y, anchoUtil, 5.5, 'F');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(formatearFechaHoraCorta(m.fecha), margenIzq + 4, y + 3.8);

      // Tipo con etiqueta y color
      doc.setFont('helvetica', 'bold');
      let tipoTxt = 'Venta Contado';
      if (m.tipo === 'venta') {
        doc.setTextColor(16, 185, 129); // emerald
        tipoTxt = 'Venta Contado';
      } else if (m.tipo === 'abono') {
        doc.setTextColor(37, 99, 235); // blue
        tipoTxt = 'Abono Cartera';
      } else if (m.tipo === 'fiado') {
        doc.setTextColor(245, 158, 11); // amber
        tipoTxt = 'Fiado Otorgado';
      } else if (m.tipo === 'entrega_separe') {
        doc.setTextColor(147, 51, 234); // purple
        tipoTxt = 'Entrega Separe';
      } else {
        doc.setTextColor(100, 116, 139);
        tipoTxt = m.tipo || 'Operación';
      }
      doc.text(tipoTxt, margenIzq + 38, y + 3.8);

      // Cliente o Concepto
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const concepto = m.clienteNombre || m.descripcion || 'Venta general';
      const conceptoCorto = concepto.length > 22 ? concepto.slice(0, 20) + '..' : concepto;
      doc.text(conceptoCorto, margenIzq + 72, y + 3.8);

      // Medio
      doc.setTextColor(100, 116, 139);
      const medioTxt = m.metodoPago === 'transferencia' ? 'Transferencia' :
                       m.metodoPago === 'datafono' ? 'Datáfono' :
                       m.metodoPago === 'credito_externo' ? 'Crédito Ext.' :
                       m.metodoPago === 'fiado' ? 'A Crédito' : 'Efectivo';
      doc.text(medioTxt, margenIzq + 118, y + 3.8);

      // Vendedor
      const resp = m.registradoPor || 'Admin';
      const respCorto = resp.length > 12 ? resp.slice(0, 10) + '..' : resp;
      doc.text(respCorto, margenIzq + 148, y + 3.8);

      // Monto
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatearMoneda(m.monto || 0), margenDer - 4, y + 3.8, { align: 'right' });

      y += 5.5;
    });

    if (datos.movimientos.length > maxFilasOps) {
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text(`* Mostrando las ${maxFilasOps} transacciones más recientes de ${datos.movimientos.length} registradas. Consulta el libro íntegro en el Excel adjunto.`, margenIzq + 1, y + 3.5);
    }
  }

  // 9. PIE DE PÁGINA CORPORATIVO EJECUTIVO
  doc.setDrawColor(226, 232, 240);
  doc.line(margenIzq, yPie - 2, margenDer, yPie - 2);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Este documento es un informe gerencial confidencial emitido por Fiabono POS. Apto para auditoría contable y revisión tributaria.', margenIzq, yPie + 2);
  doc.setFont('helvetica', 'bold');
  doc.text('fiabono.com • Página 1 de 1', margenDer, yPie + 2, { align: 'right' });

  return doc.output('blob');
}