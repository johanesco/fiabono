"use client";
import { useState, useEffect } from "react";
import { Bell, BellOff, CheckCircle2, Send, Loader2, Smartphone } from "lucide-react";
import { 
  soportaNotificacionesPush, 
  obtenerEstadoPermiso, 
  activarNotificacionesPush, 
  desactivarNotificacionesPush 
} from "@/lib/notificacionesPush";
import { vibrarToque, vibrarExito, vibrarAlerta } from "@/lib/feedbackNativo";
import { auth } from "@/firebase";
import toast from "react-hot-toast";

export default function ToggleNotificacionesPush() {
  const [soportado, setSoportado] = useState(false);
  const [activo, setActivo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const soporta = soportaNotificacionesPush();
    setSoportado(soporta);

    if (soporta) {
      const permiso = obtenerEstadoPermiso();
      const localActivo = localStorage.getItem("fiabono_push_activo") === "1";
      setActivo(permiso === "granted" && localActivo);
    }
  }, []);

  if (!soportado) return null;

  const toggleNotificaciones = async () => {
    vibrarToque(8);
    setCargando(true);

    try {
      if (activo) {
        await desactivarNotificacionesPush();
        setActivo(false);
        toast.success("Notificaciones desactivadas en este dispositivo.");
      } else {
        const res = await activarNotificacionesPush();
        if (res.ok) {
          setActivo(true);
          vibrarExito();
          toast.success("¡Notificaciones push activadas con éxito! 🔔");
        } else {
          vibrarAlerta();
          toast.error(res.error || "No se pudieron activar las notificaciones.");
        }
      }
    } catch (err: any) {
      vibrarAlerta();
      toast.error(err?.message || "Ocurrió un error.");
    } finally {
      setCargando(false);
    }
  };

  const enviarPrueba = async () => {
    vibrarToque(8);
    setProbando(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sesión requerida");

      const res = await fetch("/api/notificaciones/probar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        vibrarExito();
        toast.success("¡Notificación de prueba enviada! Revisa la barra superior de tu celular.");
      } else {
        vibrarAlerta();
        toast.error(data.error || "No se pudo enviar la prueba.");
      }
    } catch (e: any) {
      vibrarAlerta();
      toast.error(e?.message || "Error al enviar la prueba.");
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-2xl shrink-0 transition-colors ${
            activo 
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
          }`}>
            {activo ? <Bell size={20} className="animate-bounce" /> : <BellOff size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base leading-tight">
                Alertas Push en este Celular
              </h4>
              {activo && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={11} />
                  Activas
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-md">
              Recibe avisos inmediatos en la barra de Android de nuevas órdenes de tus colaboradores, ventas y vencimientos, incluso con la app cerrada.
            </p>
          </div>
        </div>

        {/* Switch Toggle */}
        <button
          type="button"
          onClick={toggleNotificaciones}
          disabled={cargando}
          aria-label={activo ? "Desactivar notificaciones" : "Activar notificaciones"}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
              activo ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {cargando && <Loader2 size={12} className="animate-spin text-slate-600" />}
          </span>
        </button>
      </div>

      {/* Botón de prueba si ya está activo */}
      {activo && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Smartphone size={13} className="text-emerald-500" />
            Dispositivo vinculado
          </span>

          <button
            type="button"
            onClick={enviarPrueba}
            disabled={probando}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold py-1.5 px-3 rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {probando ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={12} className="text-emerald-500" />
            )}
            <span>Probar notificación</span>
          </button>
        </div>
      )}
    </div>
  );
}
