import { MediosPagoNegocio } from '@/types';

export function agregarMediosPagoAlEstado(
  mensaje: string,
  medios: MediosPagoNegocio | undefined,
  nombreNegocio: string,
  deuda: number,
  ultimoAbono?: { fecha?: any; monto?: number }
): string {
  let resultado = mensaje;
  if (ultimoAbono?.fecha) {
    const fecha = typeof ultimoAbono.fecha?.toDate === 'function' ? ultimoAbono.fecha.toDate() : new Date(ultimoAbono.fecha);
    if (!Number.isNaN(fecha.getTime())) {
      const fechaTexto = fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
      resultado += `\n\n*ÚLTIMO ABONO REGISTRADO*\n${fechaTexto}${ultimoAbono.monto ? ` por $${Number(ultimoAbono.monto).toLocaleString('es-CO')}` : ''}`;
    }
  }
  if (!medios || deuda <= 0) return resultado;
  const lineas: string[] = [];
  if (medios.nequi?.trim()) lineas.push(`- Nequi: ${medios.nequi.trim()}`);
  if (medios.bancolombiaNumero?.trim()) {
    const tipo = medios.bancolombiaTipo ? ` (${medios.bancolombiaTipo})` : '';
    const titular = medios.bancolombiaTitular?.trim() ? ` - Titular: ${medios.bancolombiaTitular.trim()}` : '';
    lineas.push(`- Bancolombia${tipo}: ${medios.bancolombiaNumero.trim()}${titular}`);
  }
  if (medios.daviviendaNumero?.trim()) {
    const tipo = medios.daviviendaTipo ? ` (${medios.daviviendaTipo})` : '';
    const titular = medios.daviviendaTitular?.trim() ? ` - Titular: ${medios.daviviendaTitular.trim()}` : '';
    lineas.push(`- Davivienda${tipo}: ${medios.daviviendaNumero.trim()}${titular}`);
  }
  if (medios.brebLlave?.trim()) {
    const tipo = medios.brebTipo?.trim() ? ` (${medios.brebTipo.trim()})` : '';
    lineas.push(`- Llave Bre-B${tipo}: ${medios.brebLlave.trim()}`);
  }
  if (!lineas.length && !medios.mensajePresencial?.trim()) return mensaje;

  const presencial = medios.mensajePresencial?.trim() || `También puedes pagar directamente en ${nombreNegocio || 'nuestro almacén'}.`;
  return `${resultado}\n\n===================\n*MEDIOS PARA PAGAR*\n===================\n\n${lineas.length ? `${lineas.join('\n')}\n\n` : ''}${presencial}\n\nCuando realices el pago, envíanos el comprobante por este mismo chat indicando tu nombre.`;
}
