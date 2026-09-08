"use client";
import { Movimiento } from "../types";
import { Printer } from "lucide-react";

interface TablaHistorialProps {
  movimientos: Movimiento[];
  getNombreCliente: (id?: string, tipo?: string) => string;
  onRowClick?: (clienteId?: string, tipo?: string) => void;
  onMovimientoClick?: (mov: Movimiento) => void;
  onImprimir?: (mov: Movimiento) => void;
}

export default function TablaHistorial({ movimientos, getNombreCliente, onRowClick, onMovimientoClick, onImprimir }: TablaHistorialProps) {
  return (
    <div className="hidden md:block w-full bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800">
            <th className="py-2.5 px-4 font-black text-slate-500 uppercase text-[11px] tracking-wider">Fecha y Hora</th>
            <th className="py-2.5 px-4 font-black text-slate-500 uppercase text-[11px] tracking-wider">Cliente / Concepto</th>
            <th className="py-2.5 px-4 font-black text-slate-500 uppercase text-[11px] tracking-wider">Descripción</th>
            <th className="py-2.5 px-4 font-black text-slate-500 uppercase text-[11px] tracking-wider">Tipo</th>
            <th className="py-2.5 px-4 font-black text-slate-500 uppercase text-[11px] tracking-wider text-right">Monto / Unidades</th>
            <th className="py-2.5 px-4 font-black text-slate-500 uppercase text-[11px] tracking-wider text-center">Factura</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((mov) => {
            const esIngresoInv = mov.tipo === 'ingreso_inventario';

            return (
              <tr 
                key={mov.id} 
                onClick={() => {
                  if (onMovimientoClick) {
                    onMovimientoClick(mov);
                  } else if (!esIngresoInv && onRowClick) {
                    onRowClick(mov.clienteId, mov.tipo);
                  }
                }} 
                className={`border-b border-slate-100 dark:border-slate-800/60 transition-colors cursor-pointer ${
                  esIngresoInv ? 'hover:bg-sky-50/40 dark:hover:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-[#1e293b]/50'
                }`}
              >
                <td className="py-2.5 px-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO') : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO') : '')}
                    </span>
                    <span className="text-[10.5px] font-semibold text-slate-400">
                      {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : (mov.fecha instanceof Date ? mov.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '')}
                    </span>
                  </div>
                  {mov.registradoPor && (
                    <div className="text-[10px] font-medium text-slate-400/90 truncate max-w-[150px]">
                      👤 {esIngresoInv ? `Recibido: ${mov.registradoPor}` : mov.registradoPor}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-4 font-bold text-sm text-slate-800 dark:text-slate-200">
                  {esIngresoInv ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 text-[11px] font-black">
                      📦 Entrada Mercancía
                    </span>
                  ) : (
                    <span className="truncate block max-w-[180px] lg:max-w-[240px]">
                      {getNombreCliente(mov.clienteId, mov.tipo)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="truncate max-w-[200px] xl:max-w-[320px]">
                    {esIngresoInv ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {(mov as any).nombreProducto || 'Recepción de Mercancía'}
                      </span>
                    ) : mov.descripcion}
                  </div>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-black uppercase ${
                    esIngresoInv ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' :
                    mov.tipo === 'egreso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                    mov.tipo === 'entrega_separe' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                    mov.separeId || mov.descripcion?.toLowerCase().includes('separe') ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' :
                    mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' : 
                    mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300'
                  }`}>
                    {esIngresoInv ? '📦 INVENTARIO' :
                     mov.tipo === 'egreso' ? 'EGRESO' :
                     mov.tipo === 'entrega_separe' ? 'ENTREGA' :
                     (mov.separeId || mov.descripcion?.toLowerCase().includes('separe') ? '✦ SEPARE' : mov.tipo)}
                  </span>
                </td>
                <td className={`py-2.5 px-4 font-black text-right text-sm lg:text-base ${
                  esIngresoInv ? 'text-sky-600 dark:text-sky-400' :
                  mov.tipo === 'egreso' ? 'text-amber-600 dark:text-amber-400' :
                  mov.tipo === 'fiado' ? 'text-rose-500' : 
                  mov.tipo === 'entrega_separe' ? 'text-purple-600 dark:text-purple-400' :
                  mov.separeId || mov.descripcion?.toLowerCase().includes('separe') ? 'text-violet-600 dark:text-violet-400' :
                  mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500'
                }`}>
                  {esIngresoInv ? `+${(mov as any).cantidadAgregada || 1} un.` : `${mov.tipo === 'fiado' || mov.tipo === 'egreso' ? '-' : '+'}$${mov.monto.toLocaleString('es-CO')}`}
                </td>
                <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                  {!esIngresoInv && onImprimir ? (
                    <button
                      type="button"
                      onClick={() => onImprimir(mov)}
                      title="Imprimir Factura / Ticket"
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto inline-flex items-center justify-center cursor-pointer"
                    >
                      <Printer size={14} />
                    </button>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}