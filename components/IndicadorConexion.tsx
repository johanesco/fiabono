"use client";
import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Píldora flotante ultra-compacta, limpia y no invasiva para el estado de red.
 * Sigue el estilo minimalista de iOS / macOS / Linear:
 * - Sin internet: Píldora pequeña semitransparente con desenfoque de fondo (backdrop-blur)
 *   que no tapa botones ni satura la vista del cajero.
 * - Al reconectar: Desvanece suavemente tras 3 segundos.
 */
export default function IndicadorConexion() {
  const [enLinea, setEnLinea] = useState(true);
  const [mostrarRestablecida, setMostrarRestablecida] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEnLinea(navigator.onLine);

    const alConectar = () => {
      setEnLinea(true);
      setMostrarRestablecida(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMostrarRestablecida(false), 3000);
    };
    const alDesconectar = () => {
      setEnLinea(false);
      setMostrarRestablecida(false);
    };

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (enLinea && !mostrarRestablecida) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed top-2.5 left-1/2 -translate-x-1/2 z-[90] pointer-events-none select-none transition-all duration-300 animate-in fade-in slide-in-from-top-1"
    >
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md border text-[11px] sm:text-xs font-semibold tracking-wide ${
          enLinea
            ? "bg-emerald-950/85 text-emerald-200 border-emerald-500/30 shadow-emerald-950/30"
            : "bg-slate-900/90 text-amber-300 border-amber-500/30 shadow-black/40"
        }`}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              enLinea ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              enLinea ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
        </span>

        {enLinea ? (
          <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
            <Wifi size={13} className="shrink-0" />
            Conexión en línea
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-amber-200 font-medium">
            <WifiOff size={13} className="shrink-0 text-amber-400" />
            Modo sin conexión · Datos locales
          </span>
        )}
      </div>
    </aside>
  );
}
