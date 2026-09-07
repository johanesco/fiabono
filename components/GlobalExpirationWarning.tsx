"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/AuthContext";
import { AlertTriangle, Clock, X, Lock } from "lucide-react";
import ModalSuscripcion from "./ModalSuscripcion";

export default function GlobalExpirationWarning() {
  const { datosSesion } = useAuth();
  const pathname = usePathname();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState(false);
  const [rutaAnterior, setRutaAnterior] = useState(pathname);

  const dias = datosSesion?.diasRestantesPlan;
  const plan = datosSesion?.planActual;
  const enGracia = datosSesion?.enPeriodoGracia;
  
  // Condición de Peligro Crítico: 2 días o menos, o en gracia (-2, -1, 0, 1, 2)
  const esCritico = dias !== undefined && dias !== null && dias <= 2;
  // Condición de Alerta: de 3 a 8 días
  const esAlerta = dias !== undefined && dias !== null && dias > 2 && dias <= 8;

  // Verificar si ya se mostró en esta sesión
  useEffect(() => {
    if (!datosSesion) return;
    const yaMostrado = sessionStorage.getItem('fiabono_alerta_vencimiento');
    if (!yaMostrado && (esCritico || esAlerta)) {
      setModalAbierto(true);
      sessionStorage.setItem('fiabono_alerta_vencimiento', 'true');
    }
  }, [datosSesion, esCritico, esAlerta]);

  if (!datosSesion || plan === 'gratis' || dias === null || dias === undefined || dias > 8) {
    return null;
  }

  return (
    <>
      {/* PÍLDORA FLOTANTE (siempre visible si hay alerta) */}
      {!modalAbierto && (esCritico || esAlerta) && (
        <button
          onClick={() => setModalSuscripcionOpen(true)}
          className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[8000] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95 font-bold text-xs sm:text-sm animate-in slide-in-from-bottom-4 ${esCritico ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-amber-500 text-white shadow-amber-500/30'}`}
        >
          {esCritico ? <AlertTriangle size={16} /> : <Clock size={16} />}
          <span>{enGracia ? 'Vencido' : `Vence en ${dias}d`}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] ml-1 uppercase">Renovar</span>
        </button>
      )}

      {/* MODAL PROFESIONAL CENTRADO */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in zoom-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
            
            {/* Decal superior */}
            <div className={`h-2 w-full ${esCritico ? 'bg-rose-500' : 'bg-amber-500'}`} />
            
            <button 
              onClick={() => setModalAbierto(false)} 
              className="absolute top-4 right-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="p-8 text-center flex flex-col items-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-xl ${esCritico ? 'bg-rose-100 text-rose-600 shadow-rose-500/20' : 'bg-amber-100 text-amber-600 shadow-amber-500/20'}`}>
                {esCritico ? <AlertTriangle size={36} /> : <Clock size={36} />}
              </div>

              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                {enGracia ? '¡Plan Vencido!' : esCritico ? 'Atención Requerida' : 'Tu plan está por vencer'}
              </h2>
              
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                {enGracia 
                  ? `Estás utilizando tus últimos ${2 + dias} días de gracia. Renueva ahora para no perder el acceso a tu información.`
                  : `Te quedan solo ${dias} ${dias === 1 ? 'día' : 'días'} de suscripción. Asegura la continuidad de tu negocio renovando hoy mismo.`
                }
              </p>

              <button 
                onClick={() => {
                  setModalAbierto(false);
                  setModalSuscripcionOpen(true);
                }}
                className={`w-full py-4 font-black text-white rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg ${esCritico ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`}
              >
                <Lock size={18} /> Renovar Suscripción
              </button>
              
              <button 
                onClick={() => setModalAbierto(false)}
                className="w-full mt-3 py-3 font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Recordarme luego
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSuscripcionOpen && (
        <ModalSuscripcion 
          isOpen={modalSuscripcionOpen} 
          onClose={() => setModalSuscripcionOpen(false)} 
          cuentaPrincipalId={datosSesion.cuentaPrincipalId}
          planInicial={plan === 'pro' ? 'pro' : 'comercio'}
        />
      )}
    </>
  );
}
