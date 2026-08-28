"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home as HomeIcon, PieChart, Clock, UserCog, Package, Receipt, Bookmark } from 'lucide-react';

export default function BottomNav({ 
  puedeVerReportes,
  esAdmin = true,
  puedeAbonar = true,
  ordenesPendientesCount = 0,
  puedeSepare = false,
  separesActivosCount = 0
}: { 
  puedeVerReportes: boolean;
  esAdmin?: boolean;
  puedeAbonar?: boolean;
  ordenesPendientesCount?: number;
  puedeSepare?: boolean;
  separesActivosCount?: number;
}) {
  const pathname = usePathname();
  const puedeGestionarSepares = esAdmin === true && puedeSepare === true;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100] pb-safe transition-colors duration-300">
      <div className="max-w-lg mx-auto flex items-center justify-around px-0.5 py-1">
        
        {/* Inicio */}
        <Link 
          href="/dashboard/inicio" 
          className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${pathname?.includes('/inicio') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <HomeIcon size={20} className={pathname?.includes('/inicio') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Inicio</span>
        </Link>

        {/* Inventario */}
        <Link 
          href="/dashboard/inventario" 
          className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${pathname?.includes('/inventario') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <Package size={20} className={pathname?.includes('/inventario') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Inventario</span>
        </Link>

        {/* Órdenes */}
        <Link 
          href="/dashboard/ordenes" 
          className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 relative ${pathname?.includes('/ordenes') ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <div className="relative">
            <Receipt size={20} className={pathname?.includes('/ordenes') ? 'stroke-[2.5]' : 'stroke-2'} />
            {ordenesPendientesCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {ordenesPendientesCount}
              </span>
            )}
          </div>
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Órdenes</span>
        </Link>

        {/* Planes Separe */}
        {puedeGestionarSepares && (
          <Link 
            href="/dashboard/separes" 
            className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 relative ${pathname?.startsWith('/dashboard/separe') ? 'text-violet-600 dark:text-violet-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
          >
            <div className="relative">
              <Bookmark size={20} className={pathname?.startsWith('/dashboard/separe') ? 'stroke-[2.5]' : 'stroke-2'} />
              {separesActivosCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] px-0.5 bg-violet-600 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {separesActivosCount}
                </span>
              )}
            </div>
            <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Separe</span>
          </Link>
        )}
        
        {/* Reportes */}
        {puedeVerReportes && !esAdmin && !puedeSepare && (
          <Link 
            href="/dashboard/reportes" 
            className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${pathname?.includes('/reportes') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
          >
            <PieChart size={20} className={pathname?.includes('/reportes') ? 'stroke-[2.5]' : 'stroke-2'} /> 
            <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Reportes</span>
          </Link>
        )}
        
        {/* Historial */}
        <Link 
          href="/dashboard/historial" 
          className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${pathname?.includes('/historial') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <Clock size={20} className={pathname?.includes('/historial') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Historial</span>
        </Link>
        
        {/* Perfil / Ajustes */}
        <Link 
          href="/dashboard/perfil" 
          className={`flex-1 py-1.5 sm:py-2 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${pathname?.includes('/perfil') ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-bold'}`}
        >
          <UserCog size={20} className={pathname?.includes('/perfil') ? 'stroke-[2.5]' : 'stroke-2'} /> 
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider leading-none">Ajustes</span>
        </Link>

      </div>
    </nav>
  );
}
