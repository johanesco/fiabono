"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, BarChart3, Clock, Settings, LogOut, ChevronLeft, ChevronRight, Package, Receipt, Bookmark, Users } from 'lucide-react';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import BottomNav from "../../components/BottomNav";
import ScrollIndicator from "../../components/ScrollIndicator";
import GlobalExpirationWarning from "@/components/GlobalExpirationWarning";
import GlobalAnnouncements from "@/components/GlobalAnnouncements";
import LogoFiabono, { IsotipoFiabono } from "@/components/LogoFiabono";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [fijadoExpandido, setFijadoExpandido] = useState(false);
  const [hoverSidebar, setHoverSidebar] = useState(false);
  const estaExpandido = fijadoExpandido || hoverSidebar;
  const menuColapsado = !estaExpandido;
  const [ordenesPendientesCount, setOrdenesPendientesCount] = useState(0);
  const [separesActivosCount, setSeparesActivosCount] = useState(0);

  const datosSesion = auth?.datosSesion;
  const cerrarSesion = auth?.cerrarSesion || (() => {});
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.tipoUsuario === 'principal' || datosSesion?.esAdmin === true || (datosSesion?.rol !== 'cajero');
  const puedeAbonar = esAdmin || (datosSesion?.permisos?.abonar === true);
  const moduloSepareActivo = datosSesion?.moduloSepareActivo !== false;
  const puedeSepare = (datosSesion?.puedeSepare ?? (datosSesion?.esPro === true)) && moduloSepareActivo;
  const puedeGestionarSepares = esAdmin === true && datosSesion?.esPro === true && moduloSepareActivo;
  // Función para reproducir sonido sutil de campana POS (Web Audio API)
  const reproducirSonidoOrden = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, delay: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur);
      };

      // Acorde alegre de campanilla (D5 -> A5 -> D6)
      playTone(587.33, 0, 0.35);
      playTone(880.00, 0.08, 0.45);
      playTone(1174.66, 0.16, 0.6);
    } catch (e) {
      // Ignorar restricciones de audio del navegador antes de interacción del usuario
    }
  };

  // Listener para contar órdenes pendientes en tiempo real
  useEffect(() => {
    if (!cuentaPrincipalId || !esAdmin) {
      setOrdenesPendientesCount(0);
      return;
    }

    let esCargaInicial = true;
    let conteoPrevio = 0;

    const q = query(
      collection(db, "ordenes_pendientes"),
      where("usuarioId", "==", cuentaPrincipalId),
      where("estado", "==", "pendiente")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const nuevoConteo = snapshot.size;
      setOrdenesPendientesCount(nuevoConteo);

      if (!esCargaInicial && nuevoConteo > conteoPrevio) {
        reproducirSonidoOrden();
      }

      conteoPrevio = nuevoConteo;
      esCargaInicial = false;
    }, (e) => {
      console.error("Error contando órdenes:", e);
    });

    return () => unsub();
  }, [cuentaPrincipalId, esAdmin]);

  // Listener para contar separes activos en tiempo real
  useEffect(() => {
    if (!cuentaPrincipalId || !puedeSepare) {
      setSeparesActivosCount(0);
      return;
    }
    const q = query(
      collection(db, "separes"),
      where("usuarioId", "==", cuentaPrincipalId),
      where("estado", "==", "activo")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSeparesActivosCount(snap.size);
    }, (e) => console.error("Error contando separes:", e));
    return () => unsub();
  }, [cuentaPrincipalId, puedeSepare]);

  // Adaptabilidad Inteligente: en tablets inicia colapsado, en pantallas grandes (1280px+) puede iniciar expandido
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1280) {
        setFijadoExpandido(false);
      } else if (window.innerWidth >= 1280) {
        setFijadoExpandido(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const rutaActiva = (ruta: string) => pathname === ruta;

  const puedeVerReportes = datosSesion?.rol !== 'cajero';

  if (auth?.cargando) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 dark:bg-slate-950 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Cargando Fiabono...</span>
        </div>
      </div>
    );
  }

  if (!datosSesion) return null;

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">

      {/* BARRA LATERAL INTELIGENTE (TABLETS & ESCRITORIO CON DESPLIEGUE POR HOVER O CLIC) */}
      <aside 
        onMouseEnter={() => setHoverSidebar(true)}
        onMouseLeave={() => setHoverSidebar(false)}
        className={`hidden md:flex flex-col bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-40 shrink-0 shadow-sm ${estaExpandido ? 'w-64' : 'w-20'}`}
      >
        <div className={`p-4 flex items-center border-b border-slate-100 dark:border-slate-800/60 ${!estaExpandido ? 'justify-center flex-col gap-2' : 'justify-between'}`}>
          {estaExpandido ? (
            <div className="min-w-0 pr-2 animate-in fade-in duration-200">
              <LogoFiabono size={30} showText={true} showBadge={false} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mt-1 pl-1">{nombreNegocio}</p>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-xs hover:scale-105 transition-transform shrink-0" title={nombreNegocio}>
              <IsotipoFiabono size={40} />
            </div>
          )}
          <button
            onClick={() => {
              setFijadoExpandido(!fijadoExpandido);
              setHoverSidebar(false);
            }}
            title={fijadoExpandido ? "Fijar menú colapsado" : "Fijar menú siempre abierto"}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all active:scale-95 cursor-pointer"
          >
            {fijadoExpandido ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => router.push('/dashboard/inicio')}
            title="Inicio"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/inicio') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Home size={22} className="shrink-0" />
            {!menuColapsado && <span>Inicio</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/inventario')}
            title="Inventario"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/inventario') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Package size={22} className="shrink-0" />
            {!menuColapsado && <span>Inventario</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/ordenes')}
            title="Órdenes"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 relative ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/ordenes') ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <div className="relative shrink-0">
              <Receipt size={22} />
              {ordenesPendientesCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {ordenesPendientesCount}
                </span>
              )}
            </div>
            {!menuColapsado && (
              <div className="flex-1 flex justify-between items-center">
                <span>Órdenes</span>
                {ordenesPendientesCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {ordenesPendientesCount}
                  </span>
                )}
              </div>
            )}
          </button>

          {/* Planes Separe (Solo Admin / Encargados con permiso de abono) */}
          {puedeGestionarSepares && (
            <button
              onClick={() => router.push('/dashboard/separes')}
              title="Planes Separe"
              className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 relative ${menuColapsado ? 'justify-center' : ''} ${pathname?.startsWith('/dashboard/separe') ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <div className="relative shrink-0">
                <Bookmark size={22} />
                {separesActivosCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-violet-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                    {separesActivosCount}
                  </span>
                )}
              </div>
              {!menuColapsado && (
                <div className="flex-1 flex justify-between items-center">
                  <span>Planes Separe</span>
                  {separesActivosCount > 0 && (
                    <span className="bg-violet-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {separesActivosCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard/clientes')}
            title="Clientes & Cartera"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/clientes') ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Users size={22} className="shrink-0" />
            {!menuColapsado && <span>Clientes & Cartera</span>}
          </button>

          {puedeVerReportes && (
            <button
              onClick={() => router.push('/dashboard/reportes')}
              title="Reportes"
              className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/reportes') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <BarChart3 size={22} className="shrink-0" />
              {!menuColapsado && <span>Reportes</span>}
            </button>
          )}

          <button
            onClick={() => router.push('/dashboard/historial')}
            title="Historial"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/historial') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Clock size={22} className="shrink-0" />
            {!menuColapsado && <span>Historial</span>}
          </button>

          <button
            onClick={() => router.push('/dashboard/perfil')}
            title="Ajustes"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/perfil') ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Settings size={22} className="shrink-0" />
            {!menuColapsado && <span>Ajustes</span>}
          </button>
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-1.5">
          {datosSesion?.correoNegocio === 'johanescobar1@gmail.com' && (
            <button
              onClick={() => router.push('/dashboard/master')}
              title="Panel Maestro"
              className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-black transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''} ${rutaActiva('/dashboard/master') ? 'bg-amber-500 text-white shadow-md' : 'text-amber-500 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20'}`}
            >
              <span className="shrink-0 text-xl">👑</span>
              {!menuColapsado && <span>Master</span>}
            </button>
          )}

          <button
            onClick={cerrarSesion}
            title="Cerrar Sesión"
            className={`w-full flex items-center gap-3.5 p-3 rounded-2xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95 ${menuColapsado ? 'justify-center' : ''}`}
          >
            <LogOut size={22} className="shrink-0" />
            {!menuColapsado && <span>Salir</span>}
          </button>
        </div>

      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full relative p-0 md:p-4 lg:p-6 pb-16 md:pb-0 overflow-hidden">
        <GlobalExpirationWarning />
        <GlobalAnnouncements />
        {/* Desplazamiento fluido sin solapamiento con BottomNav */}
        <div id="dashboard-scroll-container" className="flex-1 h-full w-full overflow-y-auto flex flex-col min-h-0">
          {children}
        </div>

        {/* Barra de navegación inferior móvil */}
        <div className="md:hidden">
          <BottomNav 
            puedeVerReportes={puedeVerReportes} 
            esAdmin={esAdmin}
            puedeAbonar={puedeAbonar}
            ordenesPendientesCount={ordenesPendientesCount}
            puedeSepare={puedeSepare}
            separesActivosCount={separesActivosCount}
            esMaster={datosSesion?.correoNegocio === 'johanescobar1@gmail.com'}
          />
        </div>

        {/* Indicador inteligente de desplazamiento arriba/abajo */}
        <ScrollIndicator />
      </main>

    </div>
  );
}