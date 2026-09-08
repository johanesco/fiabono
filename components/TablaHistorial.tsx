"use client";
import { Movimiento } from "../types";
import { Printer } from "lucide-react";

interface TablaHistorialProps {
  movimientos: Movimiento[];
  getNombreCliente: (id?: string, tipo?: string) => string;
  onRowClick?: (clienteId?: string, tipo?: string) => void;
  onImprimir?: (mov: Movimiento) => void;
}

export default function TablaHistorial({ movimientos, getNombreCliente, onRowClick, onImprimir }: TablaHistorialProps) {
  return (
    <div className="hidden md:block w-full bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800">
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Fecha y Hora</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Cliente / Concepto</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Descripción</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Tipo</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest text-right">Monto / Unidades</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest text-center">Factura</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((mov) => {
            const esIngresoInv = mov.tipo === 'ingreso_inventario';

            return (
              <tr 
                key={mov.id} 
                onClick={() => {
                  if (!esIngresoInv && onRowClick) onRowClick(mov.clienteId, mov.tipo);
                }} 
                className={`border-b border-slate-100 dark:border-slate-800/60 transition-colors ${
                  esIngresoInv ? 'hover:bg-sky-50/40 dark:hover:bg-sky-950/20' : 'hover:bg-slate-50 dark:hover:bg-[#1e293b]/50 cursor-pointer'
                }`}
              >
                <td className="p-6 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO') : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO') : '')}
                  </div>
                  <div className="text-[11px] font-bold mt-0.5 text-slate-400 uppercase">
                    {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : (mov.fecha instanceof Date ? mov.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '')}
                  </div>
                  {mov.registradoPor && (
                    <div className="text-[10px] font-bold mt-1.5 text-slate-400/80">
                      👤 {esIngresoInv ? `Recibido: ${mov.registradoPor}` : mov.registradoPor}
                    </div>
                  )}
                </td>
                <td className="p-6 font-bold text-slate-800 dark:text-slate-200">
                  {esIngresoInv ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 text-xs font-black">
                      📦 Entrada de Mercancía
                    </span>
                  ) : (
                    getNombreCliente(mov.clienteId, mov.tipo)
                  )}
                </td>
                <td className="p-6 text-slate-600 dark:text-slate-300">
                  <div className="truncate max-w-[200px] xl:max-w-[300px]">
                    {esIngresoInv ? ((mov as any).nombreProducto ? `${(mov as any).nombreProducto} • ${mov.descripcion}` : mov.descripcion) : mov.descripcion}
                  </div>
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                    esIngresoInv ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' :
                    mov.tipo === 'egreso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                    mov.tipo === 'entrega_separe' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                    mov.separeId || mov.descripcion?.toLowerCase().includes('separe') ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' :
                    mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600' : 
                    mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {esIngresoInv ? '📦 INVENTARIO' :
                     mov.tipo === 'egreso' ? 'EGRESO' :
                     mov.tipo === 'entrega_separe' ? 'ENTREGA SEPARE' :
                     (mov.separeId || mov.descripcion?.toLowerCase().includes('separe') ? '✦ SEPARE' : mov.tipo)}
                  </span>
                </td>
                <td className={`p-6 font-black text-right text-lg ${
                  esIngresoInv ? 'text-sky-600 dark:text-sky-400' :
                  mov.tipo === 'egreso' ? 'text-amber-600 dark:text-amber-400' :
                  mov.tipo === 'fiado' ? 'text-rose-500' : 
                  mov.tipo === 'entrega_separe' ? 'text-purple-600 dark:text-purple-400' :
                  mov.separeId || mov.descripcion?.toLowerCase().includes('separe') ? 'text-violet-600 dark:text-violet-400' :
                  mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500'
                }`}>
                  {esIngresoInv ? `+${(mov as any).cantidadAgregada || 1} un.` : `${mov.tipo === 'fiado' || mov.tipo === 'egreso' ? '-' : '+'}$${mov.monto.toLocaleString('es-CO')}`}
                </td>
                <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                  {!esIngresoInv && onImprimir ? (
                    <button
                      type="button"
                      onClick={() => onImprimir(mov)}
                      title="Imprimir Factura / Ticket"
                      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-auto inline-flex items-center justify-center"
                    >
                      <Printer size={16} />
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