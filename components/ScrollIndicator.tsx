"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ScrollIndicator() {
  const pathname = usePathname();
  const [montado, setMontado] = useState(false);
  const [modo, setModo] = useState<"bajar" | "subir">("bajar");
  const [visible, setVisible] = useState(false);
  const [activo, setActivo] = useState(false);
  const timerInactividadRef = useRef<NodeJS.Timeout | null>(null);
  const activeContainerRef = useRef<HTMLElement | Window | null>(null);

  // 1. En Inicio, Ajustes/Perfil u otras páginas de configuración, NUNCA mostrar
  const paginasExcluidas = ["/dashboard/inicio", "/dashboard", "/dashboard/perfil"];
  const esExcluida = paginasExcluidas.includes(pathname || "");

  useEffect(() => {
    setMontado(true);

    const getScrollableElement = (): HTMLElement | null => {
      const dashContainer = document.getElementById("dashboard-scroll-container");
      if (dashContainer && dashContainer.scrollHeight - dashContainer.clientHeight > 70) {
        return dashContainer;
      }

      const scrollables = document.querySelectorAll<HTMLElement>(
        "main div.overflow-y-auto, main div.overflow-y-scroll, div.overflow-y-auto, div.overflow-y-scroll"
      );

      for (let i = 0; i < scrollables.length; i++) {
        const el = scrollables[i];
        if (el.scrollHeight - el.clientHeight > 70 && el.clientHeight > 100) {
          return el;
        }
      }

      return null;
    };

    const updateScrollStatus = () => {
      if (esExcluida) {
        setVisible(false);
        setActivo(false);
        return;
      }

      try {
        const scrollable = getScrollableElement();
        let top = 0;
        let height = 0;
        let scrollHeight = 0;

        if (scrollable) {
          activeContainerRef.current = scrollable;
          top = scrollable.scrollTop;
          height = scrollable.clientHeight;
          scrollHeight = scrollable.scrollHeight;
        } else {
          activeContainerRef.current = window;
          top = window.scrollY || document.documentElement.scrollTop;
          height = window.innerHeight || document.documentElement.clientHeight;
          scrollHeight = document.documentElement.scrollHeight;
        }

        // Umbral inteligente: requiere al menos 85px de contenido real para considerar scroll
        const scrollRestante = scrollHeight - (top + height);
        const hayScrollTotal = scrollHeight - height > 85;
        const canDown = scrollRestante > 80;
        const estaArriba = top <= 45;

        if (!hayScrollTotal) {
          setVisible(false);
          setActivo(false);
          return;
        }

        setVisible(true);
        // Activar visibilidad por interacción
        setActivo(true);

        // Reiniciar timer de inactividad (desaparece tras 1.2 segundos sin scroll)
        if (timerInactividadRef.current) {
          clearTimeout(timerInactividadRef.current);
        }
        timerInactividadRef.current = setTimeout(() => {
          setActivo(false);
        }, 1200);

        setModo((prevModo) => {
          if (prevModo === "subir") {
            if (estaArriba) return "bajar";
            return "subir";
          }
          if (!canDown) {
            return "subir";
          }
          return "bajar";
        });
      } catch (err) {}
    };

    window.addEventListener("scroll", updateScrollStatus, { capture: true, passive: true });
    window.addEventListener("resize", updateScrollStatus, { passive: true });

    updateScrollStatus();
    const interval = setInterval(updateScrollStatus, 600);

    return () => {
      window.removeEventListener("scroll", updateScrollStatus, { capture: true } as any);
      window.removeEventListener("resize", updateScrollStatus);
      clearInterval(interval);
      if (timerInactividadRef.current) {
        clearTimeout(timerInactividadRef.current);
      }
    };
  }, [pathname, esExcluida]);

  if (!montado || esExcluida || !visible) {
    return null;
  }

  const deslizarAbajo = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const target = activeContainerRef.current;
      if (target && target !== window && "scrollBy" in target) {
        const h = (target as HTMLElement).clientHeight * 0.75;
        (target as HTMLElement).scrollBy({ top: h, behavior: "smooth" });
      } else {
        window.scrollBy({ top: window.innerHeight * 0.75, behavior: "smooth" });
      }
    } catch (err) {}
  };

  const deslizarArriba = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const target = activeContainerRef.current;
      if (target && target !== window && "scrollTo" in target) {
        (target as HTMLElement).scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {}
  };

  return (
    <div
      className={`fixed right-3.5 bottom-20 sm:bottom-20 md:bottom-8 md:right-8 z-50 transition-all duration-300 ${
        activo
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-90 pointer-events-none"
      }`}
    >
      {modo === "bajar" ? (
        <button
          onClick={deslizarAbajo}
          className="bg-emerald-600/95 hover:bg-emerald-600 active:bg-emerald-700 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-[0_8px_20px_rgba(16,185,129,0.35)] border border-white/20 flex items-center gap-1.5 text-xs font-black active:scale-90 transition-all cursor-pointer group"
          title="Deslizar hacia abajo"
          aria-label="Ver más contenido"
        >
          <span>Ver más</span>
          <ChevronDown size={14} className="animate-bounce shrink-0" />
        </button>
      ) : (
        <button
          onClick={deslizarArriba}
          className="bg-slate-800/95 hover:bg-slate-900 active:bg-slate-950 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-xl border border-slate-700 flex items-center gap-1.5 text-xs font-black active:scale-90 transition-all cursor-pointer group"
          title="Subir al inicio"
          aria-label="Subir al inicio"
        >
          <ChevronUp size={14} className="animate-bounce shrink-0" />
          <span>Subir</span>
        </button>
      )}
    </div>
  );
}
