"use client";
import { useEffect, useState } from "react";
import { Database, WifiOff } from "lucide-react";

interface Props {
  className?: string;
  modulo?: string;
}

/**
 * Banner contextual que avisa con elegancia cuando una pantalla
 * está mostrando datos guardados en el dispositivo por falta de conexión.
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
      className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium animate-in fade-in duration-200 ${className}`}
    >
      <Database size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">
        Viendo {modulo ? `${modulo} guardados` : "información guardada"} en tu dispositivo. Las actualizaciones de otros equipos se sincronizarán al recuperar la red.
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-full shrink-0">
        <WifiOff size={11} /> Offline
      </span>
    </div>
  );
}
