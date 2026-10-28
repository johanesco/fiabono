"use client";
import { Movimiento } from "../types";
import { Printer, RotateCcw, Package, User, Calculator, Clock, Eye, Ban } from "lucide-react";

interface TablaHistorialProps {
  movimientos: Movimiento[];
  getNombreCliente: (id?: string, tipo?: string, fallbackNombre?: string) => string;
  getApodoCliente?: (id?: string) => string | undefined;
  onRowClick?: (clienteId?: string, tipo?: string) => void;
  onMovimientoClick?: (mov: Movimiento) => void;
  onImprimir?: (mov: Movimiento) => void;
  onDevolucion?: (mov: Movimiento) => void;
  puedeHacerDevolucion?: boolean;
  onReintentarNC?: (mov: Movimiento) => void;
  onVerCierre?: (cierre: any) => void;
  onAnularAbono?: (mov: Movimiento) => void;
  onAnularVenta?: (mov: Movimiento) => void;
}

export default function TablaHistorial({ movimientos, getNombreCliente, getApodoCliente, onRowClick, onMovimientoClick, onImprimir, onDevolucion, puedeHacerDevolucion, onReintentarNC, onVerCierre, onAnularAbono, onAnularVenta }: TablaHistorialProps) {
  return (
    <div className="hidden md:block w-full bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800">
            <th className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-slate-500 uppercase text-[10px] sm:text-[11px] tracking-wider whitespace-nowrap">Fecha y Hora</th>
            <th className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-slate-500 uppercase text-[10px] sm:text-[11px] tracking-wider">Cliente / Concepto</th>
            <th className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-slate-500 uppercase text-[10px] sm:text-[11px] tracking-wider">Descripción</th>
            <th className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-slate-500 uppercase text-[10px] sm:text-[11px] tracking-wider">Tipo</th>
            <th className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-slate-500 uppercase text-[10px] sm:text-[11px] tracking-wider text-right whitespace-nowrap">Monto</th>
            <th className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-slate-500 uppercase text-[10px] sm:text-[11px] tracking-wider text-center min-w-[70px]">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((mov) => {
            const esCierreCaja = mov.tipo === 'cierre_caja';
            const esIngresoInv = mov.tipo === 'ingreso_inventario';
            const esSepare = Boolean((mov as any).idSepareOrigen || (mov as any).separeId) || 
                             mov.tipo === 'entrega_separe' || 
                             mov.subtipo?.includes('separe') || 
                             Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes('separe'));
            const esAbonoSepare = (mov.tipo === 'abono' && esSepare) || mov.subtipo === 'abono_inicial_separe';
            const esEntregaSepare = mov.tipo === 'entrega_separe';

            return (
              <tr 
                key={mov.id} 
                onClick={() => {
                  if (esCierreCaja) {
                    if (onVerCierre && mov.datosCierre) onVerCierre(mov.datosCierre);
                    else if (onMovimientoClick) onMovimientoClick(mov);
                  } else if (onMovimientoClick) {
                    onMovimientoClick(mov);
                  } else if (!esIngresoInv && onRowClick) {
                    onRowClick(mov.clienteId, mov.tipo);
                  }
                }} 
                className={`border-b border-slate-100 dark:border-slate-800/60 transition-colors cursor-pointer ${
                  esCierreCaja ? 'bg-amber-50/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/20' :
                  esIngresoInv ? 'hover:bg-sky-50/40 dark:hover:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-[#1e293b]/50'
                }`}
              >
                <td className="py-2.5 px-2.5 sm:px-3 lg:px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO') : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO') : '')}
                    </span>
                    <span className="text-[10px] sm:text-[10.5px] font-semibold text-slate-400">
                      {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : (mov.fecha instanceof Date ? mov.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '')}
                    </span>
                  </div>
                  {mov.registradoPor && (
                    <div className="text-[9.5px] sm:text-[10px] font-medium text-slate-400/90 truncate max-w-[100px] sm:max-w-[140px] flex items-center gap-0.5">
                      <User size={10} className="shrink-0 text-slate-400" />
                      <span className="truncate">{esIngresoInv ? `Recibido: ${mov.registradoPor}` : (esCierreCaja ? `Cajero: ${mov.registradoPor}` : mov.registradoPor)}</span>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2.5 sm:px-3 lg:px-4 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  {esCierreCaja ? (
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black ${
                      mov.subtipo === 'arqueo_parcial'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : mov.subtipo === 'apertura'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
                    }`}>
                      {mov.subtipo === 'arqueo_parcial' ? <Clock size={11} className="shrink-0" /> : <Calculator size={11} className="shrink-0" />}
                      <span>{mov.subtipo === 'arqueo_parcial' ? 'ARQUEO PARCIAL' : (mov.subtipo === 'apertura' ? 'APERTURA CAJA' : 'CIERRE TURNO')}</span>
                    </span>
                  ) : esIngresoInv ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 text-[10px] sm:text-[11px] font-black">
                      <Package size={12} className="shrink-0" />
                      <span>Entrada</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[160px] sm:max-w-[220px] lg:max-w-[300px]">
                      <span 
                        title={getNombreCliente(mov.clienteId, mov.tipo, mov.clienteNombre)}
                        className="truncate font-bold"
                      >
                        {getNombreCliente(mov.clienteId, mov.tipo, mov.clienteNombre)}
                      </span>
                      {getApodoCliente && getApodoCliente(mov.clienteId) && (
                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 shrink-0">
                          "{getApodoCliente(mov.clienteId)}"
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-2.5 sm:px-3 lg:px-4 text-xs text-slate-600 dark:text-slate-300">
                  <div 
                    title={esCierreCaja ? mov.descripcion : (esIngresoInv ? ((mov as any).nombreProducto || 'Recepción de Mercancía') : mov.descripcion)}
                    className="truncate max-w-[120px] sm:max-w-[180px] xl:max-w-[320px]"
                  >
                    {esCierreCaja ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {mov.descripcion}
                      </span>
                    ) : esIngresoInv ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {(mov as any).nombreProducto || 'Recepción de Mercancía'}
                      </span>
                    ) : mov.descripcion}
                  </div>
                </td>
                <td className="py-2.5 px-2.5 sm:px-3 lg:px-4 whitespace-nowrap">
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-black uppercase inline-flex items-center gap-1 ${
                    (mov as any).anulado ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through' :
                    esCierreCaja ? (mov.subtipo === 'arqueo_parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300') :
                    esIngresoInv ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' :
                    mov.tipo === 'anulacion' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' :
                    mov.tipo === 'devolucion' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                    mov.tipo === 'egreso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                    mov.tipo === 'entrega_separe' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                    esEntregaSepare ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                    esSepare ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' :
                    mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' : 
                    mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                  }`}>
                    {(mov as any).anulado ? (
                      '🚫 ANULADO'
                    ) : esCierreCaja ? (
                      mov.subtipo === 'arqueo_parcial' ? 'ARQUEO' : (mov.subtipo === 'apertura' ? 'APERTURA' : 'CIERRE')
                    ) : esIngresoInv ? (
                      <>
                        <Package size={11} className="shrink-0" />
                        <span>INV</span>
                      </>
                    ) : mov.tipo === 'anulacion' ? (
                      <>
                        <Ban size={11} className="shrink-0" />
                        <span>ANULACIÓN</span>
                      </>
                    ) : mov.tipo === 'devolucion' ? (
                      <>
                        <RotateCcw size={11} className="shrink-0" />
                        <span>DEVOLUCIÓN</span>
                      </>
                    ) : mov.tipo === 'egreso' ? (
                      'EGRESO'
                    ) : mov.tipo === 'entrega_separe' ? (
                      'ENTREGA'
                    ) : esEntregaSepare ? (
                      'ENTREGA SEPARE'
                    ) : esSepare ? (
                      mov.subtipo === 'retiro_item_separe' ? 'AJUSTE SEPARE' :
                      mov.subtipo === 'abono_inicial_separe' ? 'SEPARE INICIAL' :
                      (mov.subtipo === 'apertura_separe_sin_abono' || mov.monto === 0 ? 'NUEVO SEPARE' : 'ABONO SEPARE')
                    ) : mov.tipo === 'abono' ? (
                      'ABONO CUENTA'
                    ) : (mov.tipo === 'venta' && ((mov as any).subtipo === 'venta_parcial' || (mov as any).montoFiadoAsociado || (mov as any).fiarFaltante)) ? (
                      'ABONO INICIAL'
                    ) : (mov.tipo === 'fiado' && ((mov as any).subtipo === 'fiado_con_abono' || (mov as any).abonoInicialAsociado)) ? (
                      'FIADO CON ABONO'
                    ) : (
                      mov.tipo
                    )}
                  </span>
                </td>
                <td className={`py-2.5 px-2.5 sm:px-3 lg:px-4 font-black text-right text-xs sm:text-sm lg:text-base whitespace-nowrap ${
                  (mov as any).anulado ? 'line-through text-slate-400 dark:text-slate-500 opacity-60' :
                  esCierreCaja ? 'text-slate-900 dark:text-white' :
                  esIngresoInv ? 'text-sky-600 dark:text-sky-400' :
                  mov.tipo === 'anulacion' ? 'text-rose-600 dark:text-rose-400' :
                  mov.tipo === 'devolucion' ? 'text-amber-600 dark:text-amber-400' :
                  mov.tipo === 'egreso' ? 'text-amber-600 dark:text-amber-400' :
                  mov.tipo === 'fiado' ? 'text-rose-500' : 
                  mov.tipo === 'entrega_separe' ? 'text-purple-600 dark:text-purple-400' :
                  mov.subtipo === 'retiro_item_separe' ? 'text-rose-600 dark:text-rose-400' :
                  esEntregaSepare ? 'text-purple-600 dark:text-purple-400' :
                  esSepare ? 'text-violet-600 dark:text-violet-400' :
                  mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500'
                }`}>
                  {esCierreCaja ? (
                    <div>
                      <span>${Math.round(mov.monto || 0).toLocaleString('es-CO')}</span>
                      <span className="text-[9.5px] text-slate-400 font-bold block">{mov.subtipo === 'apertura' ? 'Base' : 'Gaveta'}</span>
                    </div>
                  ) : esIngresoInv ? (
                    `+${(mov as any).cantidadAgregada || 1} un.`
                  ) : (
                    (mov as any).anulado ? `(Anulado) $${Math.round(mov.monto || 0).toLocaleString('es-CO')}` :
                    mov.subtipo === 'retiro_item_separe' ? `-${Math.round(mov.monto || 0).toLocaleString('es-CO')}` : (esEntregaSepare ? 'Entregado' : (mov.subtipo === 'apertura_separe_sin_abono' || (mov.monto === 0 && esSepare) ? 'Reservado ($0)' : `${mov.tipo === 'fiado' || mov.tipo === 'egreso' || mov.tipo === 'devolucion' || mov.tipo === 'anulacion' ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}`))
                  )}
                </td>
                <td className="py-2.5 px-2.5 sm:px-3 lg:px-4 text-center whitespace-nowrap min-w-[70px]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    {esCierreCaja && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onVerCierre && mov.datosCierre) onVerCierre(mov.datosCierre);
                          else if (onMovimientoClick) onMovimientoClick(mov);
                        }}
                        title="Ver detalle del cierre/arqueo"
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    {!esIngresoInv && !esCierreCaja && onImprimir && (
                      <button
                        type="button"
                        onClick={() => onImprimir(mov)}
                        title="Imprimir Factura"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <Printer size={14} />
                      </button>
                    )}
                    {mov.tipo === 'abono' && !(mov as any).anulado && onAnularAbono && (
                      <button
                        type="button"
                        onClick={() => onAnularAbono(mov)}
                        title="Anular abono por error o duplicado"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {(mov.tipo === 'venta' || mov.tipo === 'fiado') && !(mov as any).anulado && !(mov as any).tieneDevolucion && onAnularVenta && (puedeHacerDevolucion !== false) && (
                      <button
                        type="button"
                        onClick={() => onAnularVenta(mov)}
                        title="Anular transacción por error"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <Ban size={13} />
                      </button>
                    )}
                    {(mov.tipo === 'venta' || mov.tipo === 'fiado') && mov.detalles && mov.detalles.length > 0 && !(mov as any).anulado && !(mov as any).tieneDevolucionTotal && onDevolucion && (puedeHacerDevolucion !== false) && (
                      <button
                        type="button"
                        onClick={() => onDevolucion(mov)}
                        title="Devolver mercancía"
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {mov.tipo === 'devolucion' && mov.errorNotaCredito && !mov.notaCreditoElectronica && onReintentarNC && (
                      <button
                        type="button"
                        onClick={() => onReintentarNC(mov)}
                        title={`Nota Crédito DIAN pendiente: ${mov.errorNotaCredito}. Clic para reintentar`}
                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 text-[10px] font-black whitespace-nowrap transition-colors cursor-pointer"
                      >
                        Reintentar NC
                      </button>
                    )}
                    {esIngresoInv && (
                      <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}