"use client";
import React, { useEffect, useState } from "react";
import { CloudUpload, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { contarVentasOfflinePendientes, obtenerColaVentasOffline, eliminarDeColaVentasOffline } from "@/lib/colaOffline";
import { auth } from "@/firebase";
import toast from "react-hot-toast";

/**
 * Componente centinela que se encarga de:
 * 1. Mostrar badge discreto si hay ventas guardadas en este equipo pendientes por subir.
 * 2. Escuchar la reconexión a internet (`online`) y sincronizar automáticamente cada venta.
 */
export default function SincronizadorOffline() {
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const actualizarConteo = () => {
    setPendientes(contarVentasOfflinePendientes());
  };

  useEffect(() => {
    actualizarConteo();

    const alActualizar = () => actualizarConteo();
    window.addEventListener("fiabono_cola_offline_actualizada", alActualizar);
    window.addEventListener("online", sincronizarAhora);

    return () => {
      window.removeEventListener("fiabono_cola_offline_actualizada", alActualizar);
      window.removeEventListener("online", sincronizarAhora);
    };
  }, []);

  const sincronizarAhora = async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    const cola = obtenerColaVentasOffline();
    if (cola.length === 0 || sincronizando) return;

    setSincronizando(true);
    let subidas = 0;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setSincronizando(false);
        return;
      }

      for (const item of cola) {
        try {
          const res = await fetch("/api/ventas/registrar", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.payload),
          });

          if (res.ok) {
            eliminarDeColaVentasOffline(item.idLocal);
            subidas++;
          }
        } catch (err) {
          console.error("[SincronizadorOffline] Error sincronizando venta:", err);
          break; // Si se cortó la red en pleno bucle, pausar hasta la próxima reconexión
        }
      }

      if (subidas > 0) {
        toast.success(
          subidas === 1
            ? "¡Venta offline sincronizada con éxito en la nube!"
            : `¡${subidas} ventas offline sincronizadas con éxito!`,
          { icon: "☁️", duration: 4000 }
        );
      }
    } finally {
      setSincronizando(false);
      actualizarConteo();
    }
  };

  if (pendientes === 0) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-[85] animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 text-white border border-amber-500/30 shadow-2xl backdrop-blur-md">
        <div className="relative">
          <CloudUpload size={17} className={`text-amber-400 ${sincronizando ? "animate-bounce" : ""}`} />
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-slate-950">
            {pendientes}
          </span>
        </div>

        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-amber-200">
            {pendientes === 1 ? "1 venta por subir" : `${pendientes} ventas por subir`}
          </span>
          <span className="text-[10px] text-slate-400">
            {sincronizando ? "Subiendo a la nube..." : "Se sincronizarán al haber red"}
          </span>
        </div>

        <button
          type="button"
          onClick={sincronizarAhora}
          disabled={sincronizando}
          title="Sincronizar ahora"
          className="ml-1 p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={sincronizando ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
