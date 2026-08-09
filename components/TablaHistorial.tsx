"use client";
import { Movimiento } from "../types";

interface TablaHistorialProps {
  movimientos: Movimiento[];
  getNombreCliente: (id: string) => string;
}

export default function TablaHistorial({ movimientos, getNombreCliente }: TablaHistorialProps) {
  return (
    <div className="hidden md:block w-full bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800">
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Fecha</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Cliente</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Descripción</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Tipo</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((mov) => (
            <tr key={mov.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-[#1e293b]/50 transition-colors">
              <td className="p-6 text-sm text-slate-500 dark:text-slate-400">
                {mov.fecha?.toDate().toLocaleDateString('es-CO')}
              </td>
              <td className="p-6 font-bold text-slate-800 dark:text-slate-200">{getNombreCliente(mov.clienteId)}</td>
              <td className="p-6 text-slate-600 dark:text-slate-300">{mov.descripcion}</td>
              <td className="p-6">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                  mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600' : 
                  mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {mov.tipo}
                </span>
              </td>
              <td className={`p-6 font-black text-right text-lg ${
                mov.tipo === 'fiado' ? 'text-rose-500' : 
                mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500'
              }`}>
                {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}