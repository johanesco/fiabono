"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, BarChart3, Clock, Settings, LogOut, ChevronLeft, ChevronRight, Package, Receipt } from 'lucide-react';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import BottomNav from "../../components/BottomNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (!auth) return <div className="p-10 font-bold text-slate-500">Cargando sistema...</div>;

  const { datosSesion, cerrarSesion } = auth;
  const router = useRouter();
  const pathname = usePathname();
  const [menuColapsado, setMenuColapsado] = useState(false);
  const [ordenesPendientesCount, setOrdenesPendientesCount] = useState(0);

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.esAdmin ?? (datosSesion?.rol !== 'cajero');

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

  // Adaptabilidad Inteligente: en tablets (768px - 1023px) inicia colapsado, en PC (1024px+) expandido
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setMenuColapsado(true);
      } else if (window.innerWidth >= 1024) {
        setMenuColapsado(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const rutaActiva = (ruta: string) => pathname === ruta;

  const puedeVerReportes = datosSesion?.rol !== 'cajero';

  return (
    <div className="flex h-screen w-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">

      {/* BARRA LATERAL INTELIGENTE (TABLETS & ESCRITORIO) */}
      <aside className={`hidden md:flex flex-col bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-40 shrink-0 ${menuColapsado ? 'w-20' : 'w-64'}`}>
        <div className={`p-5 flex items-center border-b border-slate-100 dark:border-slate-800/60 ${menuColapsado ? 'justify-center' : 'justify-between'}`}>
          {!menuColapsado && (
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 dark:text-white truncate">Fiabono</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{nombreNegocio}</p>
            </div>
          )}
          <button
            onClick={() => setMenuColapsado(!menuColapsado)}
            title={menuColapsado ? "Expandir menú" : "Colapsar menú"}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-all active:scale-95"
          >
            {menuColapsado ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
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

        <div className="p-3 border-t border-slate-100 dark:border-slate-800/60">
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
        {/* Desplazamiento fluido sin solapamiento con BottomNav */}
        <div className="flex-1 h-full w-full overflow-y-auto flex flex-col min-h-0">
          {children}
        </div>

        {/* Barra de navegación inferior móvil */}
        <div className="md:hidden">
          <BottomNav 
            puedeVerReportes={puedeVerReportes} 
            esAdmin={esAdmin}
            ordenesPendientesCount={ordenesPendientesCount}
          />
        </div>
      </main>

    </div>
  );
}