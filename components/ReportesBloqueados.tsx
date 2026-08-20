"use client";
import { Sparkles, ArrowRight, EyeOff } from 'lucide-react';

interface ReportesBloqueadosProps {
  totalVentas: number;
  ingresosCaja: number;
  carteraActiva: number;
  onUpgradeClick?: () => void;
}

export default function ReportesBloqueados({ 
  onUpgradeClick 
}: ReportesBloqueadosProps) {
  return (
    <div className="w-full space-y-6">
      
      {/* 1. SECCIÓN SUPERIOR: TÍTULO */}
      <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black">Reportes y Analíticas</h2>
          <p className="text-slate-400 text-xs sm:text-sm">Supervisa el flujo de caja, el estado de créditos y el personal.</p>
        </div>
      </div>

      {/* 2. LAS TARJETAS NORMALES PERO CON LOS VALORES DIFUMINADOS/CENSURADOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tarjeta 1 */}
        <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Cartera en la Calle</span>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-3xl font-black text-amber-500 filter blur-sm select-none bg-amber-500/10 px-2 rounded">
              $00,000,000
            </span>
            <EyeOff size={18} className="text-slate-400" />
          </div>
        </div>

        {/* Tarjeta 2 */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-[2rem] shadow-lg text-white relative overflow-hidden">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-100 opacity-90">Total Ventas</span>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight filter blur-sm select-none bg-black/10 px-2 rounded">
              $00,000,000
            </span>
            <EyeOff size={18} className="text-emerald-200" />
          </div>
        </div>

        {/* Tarjeta 3 */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-lg text-white relative overflow-hidden">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 opacity-90">Ingresos (V+A)</span>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-3xl font-black tracking-tight text-emerald-400 filter blur-sm select-none bg-white/10 px-2 rounded">
              $00,000,000
            </span>
            <EyeOff size={18} className="text-slate-400" />
          </div>
        </div>

      </div>

      {/* 3. BANNER INFERIOR PARA INVITAR A DESBLOQUEAR EL PLAN PRO */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-900/40 border border-blue-500/20 p-6 sm:p-8 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md">
        <div className="space-y-1 text-center sm:text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2 border border-emerald-500/20">
            <Sparkles size={14} /> Tus datos están aquí, actívalos
          </span>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            ¿Quieres ver cuánto vendiste hoy y quién te debe?
          </h3>
          <p className="text-slate-300 text-sm">
            Ya calculamos tus movimientos de caja. Pásate al Plan PRO para desbloquear el informe detallado.
          </p>
        </div>

        <button
          type="button"
          onClick={onUpgradeClick}
          className="bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-600/30 transition-transform transform active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          Desbloquear mis reportes PRO <ArrowRight size={18} />
        </button>
      </div>

    </div>
  );
}