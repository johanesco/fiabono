"use client";
import { usePathname } from "next/navigation";
import { BadgeCheck } from 'lucide-react';

export default function Header({ planActual, nombreNegocio, nombreUsuario, rol }: any) {
  const pathname = usePathname();

  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const getTituloVista = () => {
    if (pathname?.includes('/reportes')) return 'Reportes';
    if (pathname?.includes('/historial')) return 'Historial';
    if (pathname?.includes('/perfil')) return 'Ajustes';
    return '';
  };

  return (
    <header className="sticky top-0 left-0 right-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/60 z-[140] pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 px-6 flex flex-col justify-center transition-colors duration-500">
      <div className="flex justify-between items-center max-w-4xl mx-auto w-full mb-2">
        <h1 className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-500 tracking-tight">Fiabono<span className="text-emerald-500">.com</span></h1>
        {planActual === 'pro' && <span className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">PRO</span>}
      </div>
      <div className="max-w-4xl mx-auto w-full flex justify-between items-end">
        <div className="flex flex-col min-w-0 pr-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">{nombreNegocio}</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
            {rol === 'cajero' && <BadgeCheck size={14} className="text-blue-500 shrink-0"/>}
            <span className="truncate">{obtenerSaludo()}, {nombreUsuario?.split(' ')[0]}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">{getTituloVista()}</p>
        </div>
      </div>
    </header>
  );
}