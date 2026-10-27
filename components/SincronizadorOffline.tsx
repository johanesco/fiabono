"use client";
import React, { useEffect, useState } from "react";
import { CloudUpload, RefreshCw } from "lucide-react";
import { contarOperacionesOffline, obtenerColaOffline, eliminarOperacionOffline } from "@/lib/colaOffline";
import { auth } from "@/firebase";
import toast from "react-hot-toast";

/**
 * Centinela de sincronización offline:
 * - Detecta operaciones pendientes (ventas, fiados, abonos).
 * - Muestra un badge flotante compacto y estilizado.
 * - Sincroniza automáticamente en bucle controlado al detectar red.
 */
export default function SincronizadorOffline() {
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  const actualizarConteo = () => {
    setPendientes(contarOperacionesOffline());
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
    const cola = obtenerColaOffline();
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
          const res = await fetch(item.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.payload),
          });

          if (res.ok) {
            eliminarOperacionOffline(item.idLocal);
            subidas++;
          } else {
            console.warn(`[SincronizadorOffline] Error en ${item.endpoint}:`, await res.text());
          }
        } catch (err) {
          console.error("[SincronizadorOffline] Error de red durante sincronización:", err);
          break; // Pausar hasta nueva reconexión estable
        }
      }

      if (subidas > 0) {
        toast.success(
          subidas === 1
            ? "¡Operación offline sincronizada con la nube!"
            : `¡${subidas} operaciones offline sincronizadas con éxito!`,
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
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-[85] animate-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-900/95 text-white border border-amber-500/30 shadow-2xl backdrop-blur-md">
        <div className="relative">
          <CloudUpload size={15} className={`text-amber-400 ${sincronizando ? "animate-bounce" : ""}`} />
          <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-slate-950">
            {pendientes}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-left text-xs font-semibold text-amber-200">
          <span>{pendientes === 1 ? "1 pendiente por subir" : `${pendientes} pendientes por subir`}</span>
        </div>

        <button
          type="button"
          onClick={sincronizarAhora}
          disabled={sincronizando}
          title="Sincronizar ahora"
          className="ml-0.5 p-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={11} className={sincronizando ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
