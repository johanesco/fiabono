"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home as HomeIcon, PieChart, Clock, UserCog, Package, Receipt } from 'lucide-react';

export default function BottomNav({ 
  puedeVerReportes,
  esAdmin = true,
  ordenesPendientesCount = 0
}: { 
  puedeVerReportes: boolean;
  esAdmin?: boolean;
  ordenesPendientesCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100] pb-safe transition-colors duration-300">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1">
        
        {/* Inicio */}
        <Link 
          href="/dashboard/inicio" 
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-90 ${pathname?.includes('/inicio') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <HomeIcon size={21} className={pathname?.includes('/inicio') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[10px] uppercase tracking-wider">Inicio</span>
        </Link>

        {/* Inventario */}
        <Link 
          href="/dashboard/inventario" 
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-90 ${pathname?.includes('/inventario') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <Package size={21} className={pathname?.includes('/inventario') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[10px] uppercase tracking-wider">Inventario</span>
        </Link>

        {/* Órdenes */}
        <Link 
          href="/dashboard/ordenes" 
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-90 relative ${pathname?.includes('/ordenes') ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <div className="relative">
            <Receipt size={21} className={pathname?.includes('/ordenes') ? 'stroke-[2.5]' : 'stroke-2'} />
            {ordenesPendientesCount > 0 && (
              <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                {ordenesPendientesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider">Órdenes</span>
        </Link>
        
        {/* Reportes (Solo si tiene permiso y no se satura la barra) */}
        {puedeVerReportes && !esAdmin && (
          <Link 
            href="/dashboard/reportes" 
            className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-90 ${pathname?.includes('/reportes') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
          >
            <PieChart size={21} className={pathname?.includes('/reportes') ? 'stroke-[2.5]' : 'stroke-2'} /> 
            <span className="text-[10px] uppercase tracking-wider">Reportes</span>
          </Link>
        )}
        
        {/* Historial */}
        <Link 
          href="/dashboard/historial" 
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-90 ${pathname?.includes('/historial') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <Clock size={21} className={pathname?.includes('/historial') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[10px] uppercase tracking-wider">Historial</span>
        </Link>
        
        {/* Perfil / Ajustes */}
        <Link 
          href="/dashboard/perfil" 
          className={`flex-1 py-2.5 flex flex-col items-center gap-1 transition-all active:scale-90 ${pathname?.includes('/perfil') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <UserCog size={21} className={pathname?.includes('/perfil') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[10px] uppercase tracking-wider">Ajustes</span>
        </Link>

      </div>
    </nav>
  );
}