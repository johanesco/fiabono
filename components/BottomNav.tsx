"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home as HomeIcon, PieChart, Clock, UserCog } from 'lucide-react';

export default function BottomNav({ puedeVerReportes }: { puedeVerReportes: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/60 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100] pb-safe transition-colors duration-500">
      <div className="max-w-4xl mx-auto flex px-2">
        <Link href="/dashboard/inicio" className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${pathname?.includes('/inicio') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
          <HomeIcon size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Inicio</span>
        </Link>
        
        {puedeVerReportes && (
          <Link href="/dashboard/reportes" className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${pathname?.includes('/reportes') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <PieChart size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Reportes</span>
          </Link>
        )}
        
        <Link href="/dashboard/historial" className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${pathname?.includes('/historial') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
          <Clock size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Historial</span>
        </Link>
        
        <Link href="/dashboard/perfil" className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${pathname?.includes('/perfil') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
          <UserCog size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Perfil</span>
        </Link>
      </div>
    </nav>
  );
}