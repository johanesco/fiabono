"use client";
import { useEffect, useState } from "react";
import { HardDrive, WifiOff } from "lucide-react";

interface Props {
  className?: string;
  modulo?: string;
}

/**
 * Indicador contextual sobrio y compacto.
 * En lugar de una caja pesada, es una línea sutil con estilo glassmorphism.
 */
export default function BannerDatosLocales({ className = "", modulo }: Props) {
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    setEnLinea(navigator.onLine);
    const alConectar = () => setEnLinea(true);
    const alDesconectar = () => setEnLinea(false);

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  if (enLinea) return null;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-xs border border-amber-500/25 text-amber-200/90 text-[11px] font-medium transition-all duration-200 ${className}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <HardDrive size={13} className="shrink-0 text-amber-400" />
        <span className="truncate">
          Datos {modulo ? `de ${modulo}` : ""} guardados en este equipo
        </span>
      </div>
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0">
        <WifiOff size={10} /> Local
      </span>
    </div>
  );
}
