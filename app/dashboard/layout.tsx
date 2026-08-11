"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, BarChart3, Clock, Settings, LogOut, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import BottomNav from "../../components/BottomNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (!auth) return <div className="p-10 font-bold text-slate-500">Cargando sistema...</div>;

  const { datosSesion, cerrarSesion } = auth;
  const router = useRouter();
  const pathname = usePathname();
  const [menuColapsado, setMenuColapsado] = useState(false);

  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const rutaActiva = (ruta: string) => pathname === ruta;

  const puedeVerReportes = datosSesion?.rol !== 'cajero';

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">

      {/* BARRA LATERAL (ESCRITORIO) */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-40 ${menuColapsado ? 'w-24' : 'w-72'}`}>

        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
          {!menuColapsado && (
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 dark:text-white truncate">Fiabono</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{nombreNegocio}</p>
            </div>
          )}
          <button
            onClick={() => setMenuColapsado(!menuColapsado)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors mx-auto"
          >
            {menuColapsado ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => router.push('/dashboard/inicio')}
            className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-bold transition-all ${rutaActiva('/dashboard/inicio') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Home size={22} className="shrink-0" />
            {!menuColapsado && <span>Inicio</span>}
          </button>

          {puedeVerReportes && (
            <button
              onClick={() => router.push('/dashboard/reportes')}
              className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-bold transition-all ${rutaActiva('/dashboard/reportes') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <BarChart3 size={22} className="shrink-0" />
              {!menuColapsado && <span>Reportes</span>}
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard/historial')}
            className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-bold transition-all ${rutaActiva('/dashboard/historial') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Clock size={22} className="shrink-0" />
            {!menuColapsado && <span>Historial</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/inventario')}
            className={`w-full hidden lg:flex items-center gap-4 p-3.5 rounded-2xl font-bold transition-all ${rutaActiva('/dashboard/inventario') ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Package size={22} className="shrink-0" />
            {!menuColapsado && <span>Inventario</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/ajustes')}
            className={`w-full flex items-center gap-4 p-3.5 rounded-2xl font-bold transition-all ${rutaActiva('/dashboard/ajustes') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Settings size={22} className="shrink-0" />
            {!menuColapsado && <span>Ajustes</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800/60">
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center gap-4 p-3.5 rounded-2xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={22} className="shrink-0" />
            {!menuColapsado && <span>Salir</span>}
          </button>
        </div>

      </aside>

      {/* CONTENEDOR PRINCIPAL CORREGIDO */}
      <main className="flex-1 flex flex-col h-full relative p-0 md:p-4 lg:p-6 pb-20 md:pb-0 overflow-hidden">
        {/* Cambiamos overflow-hidden por overflow-y-auto para permitir desplazamiento fluido */}
        <div className="flex-1 h-full w-full overflow-y-auto flex flex-col">
          {children}
        </div>

        {/* La clase md:hidden lo oculta en cuanto la pantalla crece a modo escritorio */}
        <div className="md:hidden">
          <BottomNav puedeVerReportes={puedeVerReportes} />
        </div>
      </main>

    </div>
  );
}