"use client";
import { useEffect, useState } from "react";
import { X, Download, ArrowUpFromLine, MoreHorizontal, Smartphone } from "lucide-react";

// Detecta si la app ya está en modo standalone (instalada y abierta desde icono)
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

// Detecta Chrome en iOS
function esChromeIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /CriOS/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [eventoAndroid, setEventoAndroid] = useState<Event & { prompt?: () => Promise<void> } | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [esDispositivoIOS, setEsDispositivoIOS] = useState(false);
  const [esChromeEnIOS, setEsChromeEnIOS] = useState(false);

  useEffect(() => {
    // Si ya está abierta como PWA instalada, no mostrar nada
    if (estaInstalada()) return;

    const esApple = esIOS();
    const esChrome = esChromeIOS();
    setEsDispositivoIOS(esApple);
    setEsChromeEnIOS(esChrome);

    // Escuchar evento de reapertura manual desde Ajustes o Inicio
    const handleAbrirManual = () => {
      setMostrarModal(true);
    };
    window.addEventListener("abrir-prompt-instalacion", handleAbrirManual);

    // Si ya la cerró en esta sesión actual, no molestar automáticamente
    const descartadoEnSesion = sessionStorage.getItem("fiabono-install-dismissed");

    // Android / Chrome Desktop
    const manejadorAndroid = (e: Event) => {
      e.preventDefault();
      setEventoAndroid(e as Event & { prompt?: () => Promise<void> });
      if (!descartadoEnSesion) {
        setMostrarModal(true);
      }
    };
    window.addEventListener("beforeinstallprompt", manejadorAndroid);

    // iOS (Safari o Chrome en iPhone)
    if (esApple && !descartadoEnSesion) {
      const timer = setTimeout(() => {
        setMostrarModal(true);
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", manejadorAndroid);
        window.removeEventListener("abrir-prompt-instalacion", handleAbrirManual);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", manejadorAndroid);
      window.removeEventListener("abrir-prompt-instalacion", handleAbrirManual);
    };
  }, []);

  function descartar() {
    sessionStorage.setItem("fiabono-install-dismissed", "1");
    setMostrarModal(false);
  }

  async function instalarAndroid() {
    if (!eventoAndroid || !eventoAndroid.prompt) return;
    await eventoAndroid.prompt();
    setMostrarModal(false);
  }

  if (!mostrarModal || estaInstalada()) return null;

  return (
    <div className="fixed inset-x-0 bottom-[80px] z-[999] px-4 pointer-events-none flex justify-center animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] border border-emerald-500/30 p-4 pointer-events-auto">
        
        {/* Cabecera del Prompt */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              F
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Instalar Fiabono App
              </h4>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Experiencia rápida como app nativa
              </p>
            </div>
          </div>
          
          <button 
            onClick={descartar} 
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido según plataforma */}
        {esDispositivoIOS ? (
          /* Instrucciones iOS (Safari o Chrome) */
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3 space-y-2 border border-slate-200/60 dark:border-slate-700/60">
            {esChromeEnIOS ? (
              <>
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">1</span>
                  <span>Toca el botón <MoreHorizontal size={14} className="inline mx-0.5" /> o <ArrowUpFromLine size={13} className="inline mx-0.5" /> en Chrome</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">2</span>
                  <span>Selecciona <strong>&quot;Añadir a pantalla de inicio&quot;</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">3</span>
                  <span>Toca <strong>Añadir</strong> en la esquina superior ✓</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">1</span>
                  <span>Toca el botón <ArrowUpFromLine size={13} className="inline mx-0.5 relative -top-px text-blue-500" /> <strong>Compartir</strong> en Safari</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">2</span>
                  <span>Baja y toca <strong>&quot;Añadir a pantalla de inicio&quot;</strong></span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">3</span>
                  <span>Toca <strong>Añadir</strong> ✓</span>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Android / Desktop Prompt */
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instala en 1 clic para abrir sin barra de navegador.
            </p>
            <button
              onClick={instalarAndroid}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 shrink-0"
            >
              <Download size={15} />
              Instalar Ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


