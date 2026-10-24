// utils/cierreCaja.ts
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { CierreCaja, Movimiento, DesgloseDigitalesCierre } from "@/types";
import { limpiarTextoWhatsApp } from "@/utils/whatsapp";

/**
 * Obtiene el último cierre de caja registrado para el negocio
 */
export async function obtenerUltimoCierreCaja(db: any, usuarioId: string): Promise<CierreCaja | null> {
  try {
    const q = query(
      collection(db, "cierres_caja"),
      where("usuarioId", "==", usuarioId),
      limit(50)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const lista: CierreCaja[] = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as CierreCaja));

    // Filtrar cierres definitivos (sin tipoRegistro o con tipoRegistro === 'cierre')
    const cierresDefinitivos = lista.filter(d => !d.tipoRegistro || d.tipoRegistro === 'cierre');

    cierresDefinitivos.sort((a, b) => {
      const tA = a.fechaCierre?.toMillis ? a.fechaCierre.toMillis() : (a.fechaCierre?.seconds ? a.fechaCierre.seconds * 1000 : (a.fechaCierre ? new Date(a.fechaCierre).getTime() : 0));
      const tB = b.fechaCierre?.toMillis ? b.fechaCierre.toMillis() : (b.fechaCierre?.seconds ? b.fechaCierre.seconds * 1000 : (b.fechaCierre ? new Date(b.fechaCierre).getTime() : 0));
      return tB - tA;
    });

    return cierresDefinitivos[0] || null;
  } catch (error) {
    console.error("Error al obtener último cierre de caja:", error);
    return null;
  }
}

export interface EstadoTurnoCaja {
  estaAbierta: boolean;
  baseInicial: number;
  fechaInicioTurno: Date;
  aperturaActual: CierreCaja | null;
  ultimoCierre: CierreCaja | null;
  arqueosParciales: CierreCaja[];
}

/**
 * Consulta el estado actual de la caja para el negocio:
 * Identifica si hay un turno abierto actualmente, la base inicial guardada,
 * la fecha de inicio del turno y los arqueos parciales realizados en este turno.
 */
export async function obtenerEstadoCaja(db: any, usuarioId: string): Promise<EstadoTurnoCaja> {
  const hoyCero = new Date();
  hoyCero.setHours(0, 0, 0, 0);

  try {
    const q = query(
      collection(db, "cierres_caja"),
      where("usuarioId", "==", usuarioId),
      limit(50)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return {
        estaAbierta: false,
        baseInicial: 0,
        fechaInicioTurno: hoyCero,
        aperturaActual: null,
        ultimoCierre: null,
        arqueosParciales: []
      };
    }

    const lista: CierreCaja[] = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as CierreCaja));

    const getTime = (doc: CierreCaja) => {
      const f = doc.fechaCierre || doc.fechaApertura || doc.creadoEn;
      if (f?.toMillis) return f.toMillis();
      if (f?.seconds) return f.seconds * 1000;
      if (f) return new Date(f).getTime();
      return 0;
    };

    lista.sort((a, b) => getTime(b) - getTime(a));

    const cierresDefinitivos = lista.filter(d => !d.tipoRegistro || d.tipoRegistro === 'cierre');
    const aperturas = lista.filter(d => d.tipoRegistro === 'apertura');

    const ultimoCierre = cierresDefinitivos[0] || null;
    const ultimaApertura = aperturas[0] || null;

    const timeUltimoCierre = ultimoCierre ? getTime(ultimoCierre) : 0;
    const timeUltimaApertura = ultimaApertura ? getTime(ultimaApertura) : 0;

    // La caja está abierta si la última apertura es posterior al último cierre definitivo
    const estaAbierta = timeUltimaApertura > timeUltimoCierre;

    let baseInicial = 0;
    let fechaInicioTurno = hoyCero;

    if (estaAbierta && ultimaApertura) {
      baseInicial = Number(ultimaApertura.baseInicial) || 0;
      const fAp = ultimaApertura.fechaApertura || ultimaApertura.creadoEn;
      fechaInicioTurno = fAp?.toDate ? fAp.toDate() : new Date(timeUltimaApertura);
    } else if (ultimoCierre) {
      const fCi = ultimoCierre.fechaCierre;
      fechaInicioTurno = fCi?.toDate ? fCi.toDate() : new Date(timeUltimoCierre);
    }

    // Filtrar arqueos parciales de este turno
    const timeInicioTurno = fechaInicioTurno.getTime();
    const arqueosParciales = lista.filter(d => 
      d.tipoRegistro === 'arqueo_parcial' && getTime(d) >= timeInicioTurno
    );

    return {
      estaAbierta,
      baseInicial,
      fechaInicioTurno,
      aperturaActual: estaAbierta ? ultimaApertura : null,
      ultimoCierre,
      arqueosParciales
    };
  } catch (error) {
    console.error("Error al obtener estado de caja:", error);
    return {
      estaAbierta: false,
      baseInicial: 0,
      fechaInicioTurno: hoyCero,
      aperturaActual: null,
      ultimoCierre: null,
      arqueosParciales: []
    };
  }
}

export interface CalculoMetricasCierre {
  baseInicial: number;
  ventasEfectivo: number;
  abonosEfectivo: number;
  egresosEfectivo: number;
  devolucionesEfectivo: number;
  totalEfectivoEsperado: number;
  desgloseDigitales: DesgloseDigitalesCierre;
  totalVentasDigitales: number;
  totalRecaudadoGeneral: number;
  totalTransacciones: number;
  conteoPorTipo: {
    ventas: number;
    abonos: number;
    egresos: number;
    devoluciones: number;
  };
}

/**
 * Normaliza el método de pago para agruparlo limpiamente
 */
export function normalizarMetodoPago(metodo?: string, subMetodo?: string, descripcion?: string): keyof DesgloseDigitalesCierre | 'efectivo' {
  const m = (metodo || '').toLowerCase().trim();
  const sub = (subMetodo || '').toLowerCase().trim();
  const desc = (descripcion || '').toLowerCase().trim();

  if (m === 'efectivo' || (!m && !sub && !desc.includes('transf') && !desc.includes('datafono'))) return 'efectivo';
  if (m.includes('nequi') || sub.includes('nequi') || desc.includes('nequi')) return 'nequi';
  if (m.includes('daviplata') || sub.includes('daviplata') || desc.includes('daviplata')) return 'daviplata';
  if (m.includes('davivienda') || sub.includes('davivienda') || desc.includes('davivienda')) return 'davivienda';
  if (m.includes('datafono') || m.includes('tarjeta') || sub.includes('datafono') || sub.includes('tarjeta') || desc.includes('datafono')) return 'datafono';
  if (m.includes('bancolombia') || sub.includes('bancolombia') || desc.includes('bancolombia')) return 'bancolombia';
  if (m === 'transferencia' || sub === 'transferencia' || desc.includes('transf')) return 'transferencia';
  return 'otros';
}

export interface InfoMedioPagoAuditoria {
  canal: string;
  icono: string;
  badgeClase: string;
  referencia?: string;
}

/**
 * Inspecciona un movimiento y extrae el canal exacto de pago para la auditoría de caja
 * (Nequi, Daviplata, Bancolombia, Davivienda, Datáfono, Addi, etc.)
 */
export function obtenerDetalleMedioPago(mov: any): InfoMedioPagoAuditoria {
  const m = (mov.metodoPago || '').toLowerCase().trim();
  const sub = (mov.subMetodoPago || '').trim();
  const desc = (mov.descripcion || '').trim();
  const descLower = desc.toLowerCase();
  const ref = (mov.referenciaPago || '').trim();

  // 1. Nequi
  if (m.includes('nequi') || sub.toLowerCase().includes('nequi') || descLower.includes('nequi')) {
    return {
      canal: 'Nequi',
      icono: '🟣',
      badgeClase: 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/60',
      referencia: ref || undefined
    };
  }

  // 2. Daviplata
  if (m.includes('daviplata') || sub.toLowerCase().includes('daviplata') || descLower.includes('daviplata')) {
    return {
      canal: 'Daviplata',
      icono: '🔴',
      badgeClase: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      referencia: ref || undefined
    };
  }

  // 3. Davivienda (Cuenta / Portal)
  if (m.includes('davivienda') || sub.toLowerCase().includes('davivienda') || descLower.includes('davivienda')) {
    return {
      canal: 'Davivienda',
      icono: '🔴',
      badgeClase: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800/60',
      referencia: ref || undefined
    };
  }

  // 4. Bancolombia
  if (m.includes('bancolombia') || sub.toLowerCase().includes('bancolombia') || descLower.includes('bancolombia')) {
    return {
      canal: 'Bancolombia',
      icono: '🟡',
      badgeClase: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      referencia: ref || undefined
    };
  }

  // 5. Datáfono / Tarjetas
  if (m === 'datafono' || sub.toLowerCase().includes('datafono') || descLower.includes('datafono') || sub.toLowerCase().includes('tarjeta')) {
    return {
      canal: 'Datáfono (Voucher)',
      icono: '💳',
      badgeClase: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
      referencia: ref || undefined
    };
  }

  // 6. PSE
  if (m.includes('pse') || sub.toLowerCase().includes('pse') || descLower.includes('pse')) {
    return {
      canal: 'PSE',
      icono: '🌐',
      badgeClase: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      referencia: ref || undefined
    };
  }

  // 7. Crédito externo (Addi, Sistecrédito)
  if (m === 'credito_externo' || sub.toLowerCase().includes('addi') || sub.toLowerCase().includes('sistecredito')) {
    const plataforma = sub || 'Crédito';
    return {
      canal: `Crédito (${plataforma})`,
      icono: '⚡',
      badgeClase: 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
      referencia: ref || undefined
    };
  }

  // 6. Transferencia con subMétodo personalizado
  if (sub) {
    return {
      canal: `Transf. (${sub})`,
      icono: '🏦',
      badgeClase: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
      referencia: ref || undefined
    };
  }

  // 7. Transferencia general
  return {
    canal: m === 'transferencia' ? 'Transferencia Bancaria' : (m ? `Pago ${m}` : 'Pago Digital'),
    icono: '🏦',
    badgeClase: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    referencia: ref || undefined
  };
}

/**
 * Calcula las métricas financieras de un rango de movimientos para el cierre de caja
 */
export function calcularMetricasCierre(
  movimientos: Movimiento[],
  baseInicial: number = 0
): CalculoMetricasCierre {
  let ventasEfectivo = 0;
  let abonosEfectivo = 0;
  let egresosEfectivo = 0;
  let devolucionesEfectivo = 0;

  const desgloseDigitales: DesgloseDigitalesCierre = {
    nequi: 0,
    daviplata: 0,
    bancolombia: 0,
    davivienda: 0,
    datafono: 0,
    transferencia: 0,
    otros: 0
  };

  const conteoPorTipo = {
    ventas: 0,
    abonos: 0,
    egresos: 0,
    devoluciones: 0
  };

  let totalTransacciones = 0;

  for (const mov of movimientos) {
    // Excluir movimientos puramente contables, sin dinero real, anulados o aperturas de separe sin abono
    if (
      mov.metodoPago === 'ajuste_contable' ||
      mov.metodoPago === 'separe_liquidado' ||
      mov.tipo === 'ingreso_inventario' ||
      mov.tipo === 'entrega_separe' ||
      mov.subtipo === 'apertura_separe_sin_abono' ||
      (mov as any).anulado === true
    ) {
      continue;
    }

    const monto = Number(mov.monto) || 0;
    const esCompensacionInterna = mov.metodoPago === 'saldo_interno' || mov.metodoPago === 'saldo_a_favor';

    // Si es un abono hecho 100% con saldo a favor interno, no ingresa dinero nuevo en este turno
    if (mov.tipo === 'abono' && (esCompensacionInterna || monto === 0)) {
      continue;
    }

    totalTransacciones++;
    const metodoNorm = normalizarMetodoPago(mov.metodoPago, mov.subMetodoPago, mov.descripcion);

    if (mov.tipo === 'venta') {
      conteoPorTipo.ventas++;
      const saldoFavor = Number(mov.montoPagadoConSaldoFavor) || 0;
      const montoNeto = Math.max(0, monto - saldoFavor);

      if (esCompensacionInterna || montoNeto === 0) {
        // Venta cubierta 100% con saldo a favor: no suma a efectivo ni a bancos
      } else if (metodoNorm === 'efectivo') {
        ventasEfectivo += montoNeto;
      } else {
        desgloseDigitales[metodoNorm] = (desgloseDigitales[metodoNorm] || 0) + montoNeto;
      }
    } else if (mov.tipo === 'abono') {
      conteoPorTipo.abonos++;
      if (metodoNorm === 'efectivo') {
        abonosEfectivo += monto;
      } else {
        desgloseDigitales[metodoNorm] = (desgloseDigitales[metodoNorm] || 0) + monto;
      }
    } else if (mov.tipo === 'egreso') {
      conteoPorTipo.egresos++;
      // Los egresos restan del efectivo si fueron en efectivo
      if (metodoNorm === 'efectivo') {
        egresosEfectivo += monto;
      } else if (desgloseDigitales[metodoNorm] !== undefined) {
        desgloseDigitales[metodoNorm] = Math.max(0, (desgloseDigitales[metodoNorm] || 0) - monto);
      }
    } else if (mov.tipo === 'devolucion') {
      conteoPorTipo.devoluciones++;
      // Si hubo reembolso en efectivo
      const reembolsadoEfectivo = Number(mov.montoEfectivoReembolsado) || (mov.metodoDevolucion === 'efectivo' ? monto : 0);
      if (reembolsadoEfectivo > 0) {
        devolucionesEfectivo += reembolsadoEfectivo;
      }
    }
  }

  const totalVentasDigitales = Object.values(desgloseDigitales).reduce((acc, val) => acc + (val || 0), 0);

  // Efectivo esperado físicamente en la gaveta:
  // Base inicial + Ventas efectivo + Abonos efectivo - Egresos efectivo - Devoluciones efectivo
  const totalEfectivoEsperado = Math.max(
    0,
    baseInicial + ventasEfectivo + abonosEfectivo - egresosEfectivo - devolucionesEfectivo
  );

  // Total recaudado bruto generado por ventas y abonos menos egresos
  const totalRecaudadoGeneral = Math.max(
    0,
    ventasEfectivo + abonosEfectivo + totalVentasDigitales - egresosEfectivo - devolucionesEfectivo
  );

  return {
    baseInicial,
    ventasEfectivo,
    abonosEfectivo,
    egresosEfectivo,
    devolucionesEfectivo,
    totalEfectivoEsperado,
    desgloseDigitales,
    totalVentasDigitales,
    totalRecaudadoGeneral,
    totalTransacciones,
    conteoPorTipo
  };
}

/**
 * Calcula la diferencia entre lo contado físicamente y lo esperado.
 * Si haIngresadoConteo es false (el usuario aún no ha contado), retorna 'pendiente' para no mostrar un falso faltante.
 */
export function calcularDiferenciaCierre(
  totalEfectivoReal: number, 
  totalEfectivoEsperado: number,
  haIngresadoConteo: boolean = true
): { diferencia: number; tipoDiferencia: 'exacto' | 'sobrante' | 'faltante' | 'pendiente' } {
  if (!haIngresadoConteo) {
    return { diferencia: 0, tipoDiferencia: 'pendiente' };
  }

  const diferencia = Math.round(totalEfectivoReal - totalEfectivoEsperado);
  let tipoDiferencia: 'exacto' | 'sobrante' | 'faltante' = 'exacto';

  if (diferencia > 0) {
    tipoDiferencia = 'sobrante';
  } else if (diferencia < 0) {
    tipoDiferencia = 'faltante';
  }

  return { diferencia, tipoDiferencia };
}

/**
 * Formatea el texto del resumen para compartir por WhatsApp
 */
export function generarTextoWhatsAppCierre(params: {
  negocioNombre: string;
  cierre: CierreCaja;
  fechaTexto?: string;
  rangoTexto?: string;
}): string {
  const { negocioNombre, cierre, fechaTexto, rangoTexto } = params;

  // 1. Caso de APERTURA DE CAJA
  if (cierre.tipoRegistro === 'apertura') {
    const mensajeApertura = `*🟢 APERTURA DE CAJA / INICIO DE TURNO*
*Negocio:* ${negocioNombre}
*Cajero(a):* ${cierre.cerradoPorNombre}
*Fecha y Hora:* ${fechaTexto || new Date().toLocaleString('es-CO')}
--------------------------------
*BASE INICIAL EN GAVETA:* $${(cierre.baseInicial || 0).toLocaleString('es-CO')}
${cierre.notas?.trim() ? `*Observaciones:* "${cierre.notas.trim()}"\n` : ''}--------------------------------
Turno iniciado en Fiabono.`;
    return limpiarTextoWhatsApp(mensajeApertura);
  }

  // 2. Caso de ARQUEO PARCIAL o CIERRE DEFINITIVO
  const esArqueo = cierre.tipoRegistro === 'arqueo_parcial';
  const tituloHeader = esArqueo 
    ? '*⏱️ ARQUEO PARCIAL DE CONTROL (Caja Abierta)*' 
    : '*🔒 COMPROBANTE CIERRE DE TURNO*';

  let estadoCuadre = "";
  if (cierre.tipoDiferencia === 'exacto') {
    estadoCuadre = "Cuadre Exacto en Efectivo ($0 dif)";
  } else if (cierre.tipoDiferencia === 'sobrante') {
    estadoCuadre = `Sobrante en Efectivo: +$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}`;
  } else if (cierre.tipoDiferencia === 'faltante') {
    estadoCuadre = `Faltante en Efectivo: -$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}`;
  } else {
    estadoCuadre = "Pendiente de conteo en gaveta";
  }

  // Estado de auditoría digital
  let estadoDigitalTxt = "";
  if (cierre.totalVentasDigitales > 0) {
    if (cierre.vouchersPendientesCount && cierre.vouchersPendientesCount > 0) {
      estadoDigitalTxt = `⚠️ ${cierre.vouchersAuditadosCount || 0} transferencias verificadas · ${cierre.vouchersPendientesCount} pendientes de cotejar en banco`;
    } else {
      estadoDigitalTxt = `✅ 100% de transferencias/vouchers verificados`;
    }
  }

  const lineasDigitales: string[] = [];
  if (cierre.desgloseDigitales?.nequi) {
    lineasDigitales.push(`- Nequi: $${cierre.desgloseDigitales.nequi.toLocaleString('es-CO')}`);
  }
  if (cierre.desgloseDigitales?.daviplata) {
    lineasDigitales.push(`- Daviplata: $${cierre.desgloseDigitales.daviplata.toLocaleString('es-CO')}`);
  }
  if (cierre.desgloseDigitales?.datafono) {
    lineasDigitales.push(`- Datafono/Tarjetas: $${cierre.desgloseDigitales.datafono.toLocaleString('es-CO')}`);
  }
  if (cierre.desgloseDigitales?.bancolombia) {
    lineasDigitales.push(`- Bancolombia: $${cierre.desgloseDigitales.bancolombia.toLocaleString('es-CO')}`);
  }
  if (cierre.desgloseDigitales?.davivienda) {
    lineasDigitales.push(`- Davivienda: $${cierre.desgloseDigitales.davivienda.toLocaleString('es-CO')}`);
  }
  if (cierre.desgloseDigitales?.transferencia) {
    lineasDigitales.push(`- Transferencias: $${cierre.desgloseDigitales.transferencia.toLocaleString('es-CO')}`);
  }
  if (cierre.desgloseDigitales?.otros) {
    lineasDigitales.push(`- Otros digitales: $${cierre.desgloseDigitales.otros.toLocaleString('es-CO')}`);
  }

  const seccionDigital = lineasDigitales.length > 0
    ? `\nRECAUDO DIGITAL (Bancos):\n${lineasDigitales.join('\n')}\n*Total Bancos/Digital:* $${cierre.totalVentasDigitales.toLocaleString('es-CO')}\n${estadoDigitalTxt ? `*Auditoría Digital:* ${estadoDigitalTxt}\n` : ''}--------------------------------`
    : '';

  const notasTexto = cierre.notas?.trim()
    ? `\nObservaciones: ${cierre.notas.trim()}`
    : '';

  const mensaje = `${tituloHeader}
*Negocio:* ${negocioNombre}
*Cajero(a):* ${cierre.cerradoPorNombre}
*Fecha Registro:* ${fechaTexto || new Date().toLocaleString('es-CO')}
${rangoTexto ? `*Periodo:* ${rangoTexto}\n` : ''}--------------------------------
*ARQUEO DE EFECTIVO:*
- Base Inicial (menudo): $${(cierre.baseInicial || 0).toLocaleString('es-CO')}
- Ventas en Efectivo: $${(cierre.ventasEfectivo || 0).toLocaleString('es-CO')}
- Abonos en Efectivo: $${(cierre.abonosEfectivo || 0).toLocaleString('es-CO')}
- Salidas / Egresos: -$${(cierre.egresosEfectivo || 0).toLocaleString('es-CO')}
- Devoluciones Efectivo: -$${(cierre.devolucionesEfectivo || 0).toLocaleString('es-CO')}
--------------------------------
*EFECTIVO ESPERADO:* $${cierre.totalEfectivoEsperado.toLocaleString('es-CO')}
*EFECTIVO CONTADO (Fisico):* $${cierre.totalEfectivoReal.toLocaleString('es-CO')}
*ESTADO EFECTIVO:* ${estadoCuadre}
--------------------------------${seccionDigital}
*TOTAL RECAUDADO DEL TURNO:* $${cierre.totalRecaudadoGeneral.toLocaleString('es-CO')}
*Total Transacciones:* ${cierre.totalTransacciones}${notasTexto}

Generado automaticamente por Fiabono.`;

  return limpiarTextoWhatsApp(mensaje);
}
