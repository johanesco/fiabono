"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home as HomeIcon, 
  Clock, 
  Receipt, 
  Menu, 
  X, 
  Package, 
  Bookmark, 
  PieChart, 
  UserCog, 
  Crown, 
  LogOut, 
  Sun, 
  Moon, 
  ChevronRight,
  ShieldCheck,
  User,
  Users,
  ExternalLink
} from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";

interface BottomNavProps {
  puedeVerReportes: boolean;
  esAdmin?: boolean;
  puedeAbonar?: boolean;
  ordenesPendientesCount?: number;
  puedeSepare?: boolean;
  separesActivosCount?: number;
  esMaster?: boolean;
}

export default function BottomNav({ 
  puedeVerReportes,
  esAdmin = true,
  puedeAbonar = true,
  ordenesPendientesCount = 0,
  puedeSepare = false,
  separesActivosCount = 0,
  esMaster = false
}: BottomNavProps) {
  const pathname = usePathname();
  const { datosSesion, cerrarSesion } = useAuth();
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const [temaActual, setTemaActual] = useState<'clara' | 'oscura'>('clara');

  // Detectar tema actual
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const esOscuro = document.documentElement.classList.contains('dark');
      setTemaActual(esOscuro ? 'oscura' : 'clara');
    }
  }, [drawerAbierto]);

  // Cerrar drawer automáticamente al cambiar de ruta
  useEffect(() => {
    setDrawerAbierto(false);
  }, [pathname]);

  // Bloquear scroll de fondo cuando el drawer esté abierto
  useEffect(() => {
    if (drawerAbierto) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerAbierto]);

  const toggleTema = () => {
    if (typeof document !== 'undefined') {
      const nuevo = temaActual === 'clara' ? 'oscura' : 'clara';
      if (nuevo === 'oscura') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('tema', 'oscura');
        localStorage.setItem('temaFiabono', 'oscura');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('tema', 'clara');
        localStorage.setItem('temaFiabono', 'clara');
      }
      setTemaActual(nuevo);
    }
  };

  // Permisos para el menú
  const puedeInventario = esAdmin || Boolean(datosSesion?.permisos?.editarInventario || datosSesion?.permisos?.ingresoInventario);
  const puedeGestionarSepares = (esAdmin || Boolean(datosSesion?.permisos?.planSepare)) && puedeSepare;
  const esCajero = datosSesion?.rol === 'cajero';
  
  // Colaborador ve la pestaña de órdenes solo si es admin o si tiene órdenes/directa
  const mostrarPestanaOrdenes = esAdmin || ordenesPendientesCount > 0;

  // Saber si alguna ruta del menú está activa
  const esRutaMenuActiva = 
    pathname?.includes('/inventario') ||
    pathname?.includes('/separes') ||
    pathname?.includes('/clientes') ||
    pathname?.includes('/reportes') ||
    pathname?.includes('/perfil') ||
    pathname?.includes('/master');

  return (
    <>
      {/* BARRA INFERIOR MODERNA (DOCK MINIMALISTA) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100] pb-safe transition-all duration-300">
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1">
          
          {/* 1. INICIO */}
          <Link 
            href="/dashboard/inicio" 
            className={`flex-1 py-1 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${
              pathname?.includes('/inicio') 
                ? 'text-blue-600 dark:text-blue-400 font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${pathname?.includes('/inicio') ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
              <HomeIcon size={19} className={pathname?.includes('/inicio') ? 'stroke-[2.5]' : 'stroke-2'} /> 
            </div>
            <span className="text-[9.5px] tracking-tight leading-none">Inicio</span>
          </Link>

          {/* 2. ÓRDENES (Solo si es Admin o si el colaborador tiene órdenes pendientes) */}
          {mostrarPestanaOrdenes && (
            <Link 
              href="/dashboard/ordenes" 
              className={`flex-1 py-1 flex flex-col items-center gap-0.5 transition-all active:scale-90 relative ${
                pathname?.includes('/ordenes') 
                  ? 'text-amber-600 dark:text-amber-400 font-black' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-colors ${pathname?.includes('/ordenes') ? 'bg-amber-50 dark:bg-amber-500/10' : ''}`}>
                <Receipt size={19} className={pathname?.includes('/ordenes') ? 'stroke-[2.5]' : 'stroke-2'} />
                {ordenesPendientesCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[8.5px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                    {ordenesPendientesCount}
                  </span>
                )}
              </div>
              <span className="text-[9.5px] tracking-tight leading-none">Órdenes</span>
            </Link>
          )}

          {/* 3. HISTORIAL */}
          <Link 
            href="/dashboard/historial" 
            className={`flex-1 py-1 flex flex-col items-center gap-0.5 transition-all active:scale-90 ${
              pathname?.includes('/historial') 
                ? 'text-emerald-600 dark:text-emerald-400 font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${pathname?.includes('/historial') ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
              <Clock size={19} className={pathname?.includes('/historial') ? 'stroke-[2.5]' : 'stroke-2'} /> 
            </div>
            <span className="text-[9.5px] tracking-tight leading-none">Historial</span>
          </Link>

          {/* 4. MENÚ MÓVIL (DRAWER) */}
          <button
            type="button"
            onClick={() => setDrawerAbierto(true)}
            className={`flex-1 py-1 flex flex-col items-center gap-0.5 transition-all active:scale-90 cursor-pointer ${
              esRutaMenuActiva || drawerAbierto
                ? 'text-slate-900 dark:text-white font-black' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold'
            }`}
          >
            <div className={`relative p-1 rounded-xl transition-colors ${esRutaMenuActiva || drawerAbierto ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
              <Menu size={19} className={esRutaMenuActiva ? 'stroke-[2.5]' : 'stroke-2'} />
              {separesActivosCount > 0 && puedeGestionarSepares && (
                <span className="absolute -top-0.5 -right-1.5 w-2 h-2 bg-violet-600 rounded-full"></span>
              )}
            </div>
            <span className="text-[9.5px] tracking-tight leading-none">Menú</span>
          </button>

        </div>
      </nav>

      {/* ACTION SHEET / DRAWER LATERAL INFERIOR */}
      {drawerAbierto && (
        <div className="fixed inset-0 z-[1000] flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          
          {/* Fondo para cerrar al tocar fuera */}
          <div 
            className="flex-1 w-full" 
            onClick={() => setDrawerAbierto(false)} 
          />

          {/* Panel Flotante Modal */}
          <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] p-6 max-h-[85vh] overflow-y-auto shadow-2xl border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom duration-300">
            
            {/* Tirador visual (Handle) */}
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

            {/* Cabecera del Drawer */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                  {esCajero ? <User size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                    {datosSesion?.nombreUsuario || "Mi Cuenta"}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    {esCajero ? `Colaborador en ${datosSesion?.nombreNegocio}` : (datosSesion?.nombreNegocio || "Administrador")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Switch de Modo Oscuro / Claro rápido */}
                <button
                  type="button"
                  onClick={toggleTema}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="Cambiar tema"
                >
                  {temaActual === 'clara' ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />}
                </button>

                {/* Botón Cerrar */}
                <button
                  type="button"
                  onClick={() => setDrawerAbierto(false)}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* LISTA DE MÓDULOS DISPONIBLES */}
            <div className="py-4 space-y-2">

              {/* 1. INVENTARIO */}
              {puedeInventario && (
                <Link
                  href="/dashboard/inventario"
                  className={`flex items-center justify-between p-3.5 rounded-2xl transition active:scale-[0.98] ${
                    pathname?.includes('/inventario')
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black'
                      : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="text-sm leading-tight">Inventario de Productos</p>
                      <p className="text-[11px] text-slate-400 font-normal">Stock, precios y recepciones</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              )}

              {/* 2. PLANES SEPARE */}
              {puedeGestionarSepares && (
                <Link
                  href="/dashboard/separes"
                  className={`flex items-center justify-between p-3.5 rounded-2xl transition active:scale-[0.98] ${
                    pathname?.startsWith('/dashboard/separe')
                      ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 font-black'
                      : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                      <Bookmark size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm leading-tight">Planes Separe</p>
                        {separesActivosCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-black">
                            {separesActivosCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-normal">Mercancía apartada y abonos</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              )}

              {/* 3. CLIENTES & CARTERA */}
              <Link
                href="/dashboard/clientes"
                className={`flex items-center justify-between p-3.5 rounded-2xl transition active:scale-[0.98] ${
                  pathname?.startsWith('/dashboard/clientes')
                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black'
                    : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-sm leading-tight">Clientes y Cartera</p>
                    <p className="text-[11px] text-slate-400 font-normal">Saldos, riesgo y cobranza</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </Link>

              {/* 4. REPORTES Y ESTADÍSTICAS (Solo Admin o con permiso) */}
              {puedeVerReportes && (
                <Link
                  href="/dashboard/reportes"
                  className={`flex items-center justify-between p-3.5 rounded-2xl transition active:scale-[0.98] ${
                    pathname?.includes('/reportes')
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black'
                      : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <PieChart size={20} />
                    </div>
                    <div>
                      <p className="text-sm leading-tight">Reportes y Finanzas</p>
                      <p className="text-[11px] text-slate-400 font-normal">Ganancias, balances y caja</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              )}

              {/* 4. AJUSTES / MI PERFIL */}
              <Link
                href="/dashboard/perfil"
                className={`flex items-center justify-between p-3.5 rounded-2xl transition active:scale-[0.98] ${
                  pathname?.includes('/perfil')
                    ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-black'
                    : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <UserCog size={20} />
                  </div>
                  <div>
                    <p className="text-sm leading-tight">
                      {esCajero ? "Mi Cuenta y Ajustes" : "Configuración del Negocio"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {esCajero ? "Datos de usuario y preferencias" : "Datos fiscales, logo y colaboradores"}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </Link>

              {/* 5. MASTER (Solo Superadmin) */}
              {esMaster && (
                <Link
                  href="/dashboard/master"
                  className={`flex items-center justify-between p-3.5 rounded-2xl transition active:scale-[0.98] ${
                    pathname?.includes('/master')
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black'
                      : 'bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Crown size={20} />
                    </div>
                    <div>
                      <p className="text-sm leading-tight">Panel Master Global</p>
                      <p className="text-[11px] text-slate-400 font-normal">Administración general de la plataforma</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              )}

            </div>

            {/* PIE DEL DRAWER: CERRAR SESIÓN */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={async () => {
                  setDrawerAbierto(false);
                  await cerrarSesion();
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <LogOut size={16} />
                <span>Cerrar Sesión</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}