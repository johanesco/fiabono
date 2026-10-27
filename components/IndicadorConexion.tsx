"use client";
import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * MODO OFFLINE (Fase 1): aviso discreto de conexión.
 * - Sin internet: banner ámbar fijo. Se puede consultar lo ya cargado,
 *   pero las ventas/abonos/fiados necesitan conexión por ahora.
 * - Al volver la red: banner verde breve "Conexión restablecida".
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
      timerRef.current = setTimeout(() => setMostrarRestablecida(false), 3500);
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
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border text-xs sm:text-sm font-bold max-w-[92vw] animate-in fade-in slide-in-from-top-2 duration-200 ${
        enLinea
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
      }`}
    >
      {enLinea ? (
        <>
          <Wifi size={16} className="shrink-0" />
          <span>Conexión restablecida</span>
        </>
      ) : (
        <>
          <WifiOff size={16} className="shrink-0" />
          <span>Sin internet: puedes consultar datos guardados. Para registrar ventas y abonos se necesita conexión.</span>
        </>
      )}
    </div>
  );
}
