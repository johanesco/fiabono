"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PieChart, Clock, UserCog, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

interface SidebarProps {
  sidebarAbierto: boolean;
  setSidebarAbierto: (estado: boolean) => void;
  puedeVerReportes: boolean;
  nombreNegocio: string;
}

export default function Sidebar({ sidebarAbierto, setSidebarAbierto, puedeVerReportes, nombreNegocio }: SidebarProps) {
  const pathname = usePathname();

  const enlaces = [
    { href: "/dashboard/inicio", label: "Inicio / Caja", icon: Home },
    ...(puedeVerReportes ? [{ href: "/dashboard/reportes", label: "Reportes", icon: PieChart }] : []),
    { href: "/dashboard/historial", label: "Historial", icon: Clock },
    { href: "/dashboard/perfil", label: "Ajustes", icon: UserCog },
  ];

  return (
    <aside className={`${sidebarAbierto ? 'w-72' : 'w-24'} transition-all duration-300 hidden md:flex flex-col bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 p-6 shrink-0 h-screen sticky top-0 justify-between select-none`}>
      <div>
        {/* Cabecera con botón de colapsar */}
        <div className="flex items-center justify-between mb-8 px-2">
          {sidebarAbierto && (
            <div className="truncate">
              <h1 className="text-xl font-black text-blue-600 dark:text-blue-500">Fiabono</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase truncate">{nombreNegocio}</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarAbierto(!sidebarAbierto)} 
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {sidebarAbierto ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Menú */}
        <nav className="flex flex-col gap-3">
          {enlaces.map((item) => {
            const Icon = item.icon;
            const activo = pathname?.includes(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                title={item.label}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-300 ${
                  activo 
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon size={24} className="shrink-0" />
                {sidebarAbierto && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <button 
        onClick={() => signOut(auth)}
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
      >
        <LogOut size={24} className="shrink-0" />
        {sidebarAbierto && <span>Salir</span>}
      </button>
    </aside>
  );
}