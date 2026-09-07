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

  // Interceptar navegación
  useEffect(() => {
    if (pathname !== rutaAnterior) {
      setRutaAnterior(pathname);
      // Si cambia de ruta y está en estado crítico, abrir modal molesto
      if (esCritico && plan !== 'gratis') {
        // Excluimos algunas rutas para que no sea *tan* loco
        if (pathname !== '/dashboard/perfil' && pathname !== '/dashboard/inicio') {
           setModalAbierto(true);
        }
      }
    }
  }, [pathname, rutaAnterior, esCritico, plan]);

  if (!datosSesion || plan === 'gratis' || dias === null || dias === undefined || dias > 8) {
    return null;
  }

  return (
    <>
      {/* BANNER PERSISTENTE SUPERIOR */}
      <div className={`w-full text-center py-1.5 px-4 flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold z-[9000] relative
        ${esCritico ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-950'}
      `}>
        {esCritico ? <AlertTriangle size={14} /> : <Clock size={14} />}
        
        {enGracia ? (
          <span>
            TU PLAN SE HA VENCIDO. Tienes {2 + dias} días de gracia para renovar antes de que tu cuenta vuelva a Gratis.
          </span>
        ) : esCritico ? (
          <span>
            ¡Tu plan vence en {dias} {dias === 1 ? 'día' : 'días'}! Evita perder acceso.
          </span>
        ) : (
          <span>
            Tu plan vencerá en {dias} días.
          </span>
        )}

        <button 
          onClick={() => setModalSuscripcionOpen(true)}
          className={`ml-2 px-3 py-0.5 rounded-full text-[10px] hover:opacity-80 transition-opacity uppercase tracking-wider
            ${esCritico ? 'bg-white text-red-600' : 'bg-amber-900 text-amber-100'}
          `}
        >
          Renovar
        </button>
      </div>

      {/* MODAL INVASIVO CRÍTICO */}
      {modalAbierto && esCritico && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border-2 border-red-500">
            <div className="bg-red-500 p-6 flex flex-col items-center justify-center text-white text-center">
              <AlertTriangle size={48} className="mb-2 animate-pulse" />
              <h2 className="text-xl font-black uppercase tracking-tight">Atención</h2>
            </div>
            
            <div className="p-6 text-center space-y-4">
              <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {enGracia 
                  ? "Tu plan ya se encuentra vencido. Estás usando los días de gracia de emergencia. Si no renuevas pronto, el sistema bloqueará las funciones premium."
                  : `Te quedan solo ${dias} días de plan. Asegura la continuidad de tu negocio renovando hoy mismo.`
                }
              </p>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => {
                    setModalAbierto(false);
                    setModalSuscripcionOpen(true);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center gap-2"
                >
                  <Lock size={18} /> Renovar Suscripción
                </button>
                <button 
                  onClick={() => setModalAbierto(false)}
                  className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors"
                >
                  Entendido, renovaré pronto
                </button>
              </div>
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
