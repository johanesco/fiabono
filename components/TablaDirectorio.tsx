"use client";
import { Cliente } from "../types";

interface TablaProps {
  clientes: Cliente[];
  abrirPerfil: (clienteId: string) => void;
}

export default function TablaDirectorio({ clientes, abrirPerfil }: TablaProps) {
  return (
    <div className="hidden md:block w-full bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800">
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Cliente</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest">Celular</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest text-right">Saldo / Deuda</th>
            <th className="p-6 font-black text-slate-500 uppercase text-xs tracking-widest text-center">Acción</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-[#1e293b]/50 transition-colors">
              <td className="p-6 font-bold text-slate-800 dark:text-slate-200 text-lg">{c.nombre}</td>
              <td className="p-6 text-slate-500 dark:text-slate-400">{c.celular || "---"}</td>
              <td className={`p-6 font-black text-right text-lg ${c.deudaTotal === 0 ? 'text-slate-400' : (c.deudaTotal > 0 ? 'text-rose-500' : 'text-emerald-500')}`}>
                {c.deudaTotal === 0 ? "$0" : (c.deudaTotal > 0 ? `$${c.deudaTotal.toLocaleString('es-CO')}` : `A favor $${Math.abs(c.deudaTotal).toLocaleString('es-CO')}`)}
              </td>
              <td className="p-6 text-center">
                <button 
                  onClick={() => abrirPerfil(c.id)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl transition-all"
                >
                  Ver Perfil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}