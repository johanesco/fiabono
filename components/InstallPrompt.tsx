"use client";
import { useEffect, useState } from "react";
import { X, Download, ArrowUpFromLine } from "lucide-react";

// Detecta si la app ya está en modo standalone (instalada)
function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Detecta iOS (iPhone, iPad, iPod)
function esIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  // El evento nativo de Android/Chrome para instalar la PWA
  const [eventoAndroid, setEventoAndroid] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  // Para iOS mostramos instrucciones manuales
  const [mostrarIOS, setMostrarIOS] = useState(false);
  // Para Android mostramos botón de instalación
  const [mostrarAndroid, setMostrarAndroid] = useState(false);

  useEffect(() => {
    // Si ya está instalada o el usuario ya la descartó, no mostrar nada
    if (estaInstalada()) return;
    if (localStorage.getItem("fiabono-install-dismissed") === "1") return;

    // Android / Chrome Desktop: capturar el evento antes de que Chrome lo muestre
    const manejadorAndroid = (e: Event) => {
      e.preventDefault(); // Evitar que el banner nativo aparezca automáticamente
      setEventoAndroid(e as Event & { prompt?: () => Promise<void> });
      setMostrarAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", manejadorAndroid);

    // iOS: si está en Safari móvil y no está instalada, mostrar instrucciones
    if (esIOS()) {
      // Pequeño delay para no interferir con la carga inicial
      const timer = setTimeout(() => setMostrarIOS(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", manejadorAndroid);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", manejadorAndroid);
  }, []);

  function descartar() {
    localStorage.setItem("fiabono-install-dismissed", "1");
    setMostrarAndroid(false);
    setMostrarIOS(false);
  }

  async function instalarAndroid() {
    if (!eventoAndroid || !eventoAndroid.prompt) return;
    await eventoAndroid.prompt();
    setMostrarAndroid(false);
  }

  // ─── Banner Android ───────────────────────────────────────────────────────
  if (mostrarAndroid) {
    return (
      <div className="fixed bottom-[72px] left-4 right-4 z-[200] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-700/60 p-4 flex items-center gap-3">
          {/* Ícono */}
          <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-white font-black text-xl">
            F
          </div>
          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Instalar Fiabono
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Accede más rápido desde tu pantalla de inicio
            </p>
          </div>
          {/* Botones */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={instalarAndroid}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <Download size={14} />
              Instalar
            </button>
            <button
              onClick={descartar}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Banner iOS ───────────────────────────────────────────────────────────
  if (mostrarIOS) {
    return (
      <div className="fixed bottom-[72px] left-4 right-4 z-[200] animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-slate-200/60 dark:border-slate-700/60 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-base">
                F
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Instalar Fiabono
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Agregar a pantalla de inicio
                </p>
              </div>
            </div>
            <button onClick={descartar} className="p-1 text-slate-400" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          {/* Instrucciones paso a paso para iOS */}
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
              <span>Toca el botón <ArrowUpFromLine size={12} className="inline mx-0.5 relative -top-px" /> <strong>Compartir</strong> en Safari</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
              <span>Selecciona <strong>&quot;Añadir a pantalla de inicio&quot;</strong></span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
              <span>Toca <strong>Añadir</strong> ✓</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

