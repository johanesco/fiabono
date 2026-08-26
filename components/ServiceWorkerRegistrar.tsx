"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registro) => {
        console.log("[SW] Registrado:", registro.scope);
      })
      .catch((err) => {
        // En desarrollo con Turbopack puede fallar — es normal, no bloqueamos nada
        console.warn("[SW] No se pudo registrar:", err);
      });
  }, []);

  return null; // Componente invisible — solo registra el SW
}

