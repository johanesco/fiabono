"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Receipt, Bookmark, BarChart3, Clock, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

interface SidebarProps {
  sidebarAbierto: boolean;
  setSidebarAbierto: (estado: boolean) => void;
  puedeVerReportes: boolean;
  puedeSepare?: boolean;
  nombreNegocio: string;
  ordenesPendientesCount?: number;
  separesActivosCount?: number;
}

export default function Sidebar({
  sidebarAbierto,
  setSidebarAbierto,
  puedeVerReportes,
  puedeSepare = true,
  nombreNegocio,
  ordenesPendientesCount = 0,
  separesActivosCount = 0
}: SidebarProps) {
  const pathname = usePathname();

  const enlaces = [
    { href: "/dashboard/inicio", label: "Inicio", icon: Home },
    { href: "/dashboard/inventario", label: "Inventario", icon: Package },
    { href: "/dashboard/ordenes", label: "Órdenes", icon: Receipt, badge: ordenesPendientesCount, badgeColor: "bg-rose-500" },
    ...(puedeSepare ? [{ href: "/dashboard/separes", label: "Planes Separe", icon: Bookmark, badge: separesActivosCount, badgeColor: "bg-violet-500" }] : []),
    ...(puedeVerReportes ? [{ href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 }] : []),
    { href: "/dashboard/historial", label: "Historial", icon: Clock },
    { href: "/dashboard/perfil", label: "Ajustes", icon: Settings },
  ];

  return (
    <aside className={`${sidebarAbierto ? 'w-64' : 'w-20'} transition-all duration-300 hidden md:flex flex-col bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 p-4 shrink-0 h-screen sticky top-0 justify-between select-none`}>
      <div className="flex flex-col min-h-0">
        {/* Cabecera con botón de colapsar */}
        <div className={`flex items-center mb-6 px-2 ${sidebarAbierto ? 'justify-between' : 'justify-center'}`}>
          {sidebarAbierto && (
            <div className="truncate min-w-0 pr-2">
              <h1 className="text-lg font-black text-slate-900 dark:text-white truncate">Fiabono</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{nombreNegocio}</p>
            </div>
          )}
          <button 
            onClick={() => setSidebarAbierto(!sidebarAbierto)} 
            title={sidebarAbierto ? "Colapsar menú" : "Expandir menú"}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
          >
            {sidebarAbierto ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Menú */}
        <nav className="flex flex-col gap-1.5 overflow-y-auto">
          {enlaces.map((item) => {
            const Icon = item.icon;
            const activo = pathname?.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                title={item.label}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold transition-all ${
                  sidebarAbierto ? '' : 'justify-center'
                } ${
                  activo 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="relative shrink-0">
                  <Icon size={20} />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 ${item.badgeColor || 'bg-rose-500'} text-white text-[9px] font-black rounded-full flex items-center justify-center`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                {sidebarAbierto && (
                  <div className="flex-1 flex justify-between items-center truncate">
                    <span className="truncate">{item.label}</span>
                    {Boolean(item.badge && item.badge > 0) && (
                      <span className={`${item.badgeColor || 'bg-rose-500'} text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1 shrink-0`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <button 
        onClick={() => signOut(auth)}
        title="Cerrar Sesión"
        className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer mt-4 ${
          sidebarAbierto ? '' : 'justify-center'
        }`}
      >
        <LogOut size={20} className="shrink-0" />
        {sidebarAbierto && <span>Salir</span>}
      </button>
      
    </aside>
  );
}