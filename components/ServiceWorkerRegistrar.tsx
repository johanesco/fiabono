"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // En localhost / desarrollo, desregistramos activamente cualquier service worker
    // para evitar que intercepte y bloquee las peticiones de desarrollo
    const esLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local");

    if (esLocalhost || process.env.NODE_ENV === "development") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      return;
    }

    // En producción (ej. Vercel, dominio real) se registra con seguridad
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registro) => {
        console.log("[SW] Registrado:", registro.scope);
      })
      .catch((err) => {
        console.warn("[SW] No se pudo registrar:", err);
      });
  }, []);

  return null;
}

