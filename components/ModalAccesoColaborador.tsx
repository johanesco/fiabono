"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Lock, MessageCircle, X, ShieldAlert, ArrowRight, Calendar } from "lucide-react";
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";

export interface BloqueoColaboradorInfo {
  motivo: 'inactivo' | 'fuera_de_horario';
  nombreColaborador?: string;
  nombreNegocio?: string;
  telefonoAdmin?: string;
  horarios?: Array<{
    dias?: string[];
    inicio?: string;
    fin?: string;
    activoAuto?: boolean;
  }>;
}

interface ModalAccesoColaboradorProps {
  info: BloqueoColaboradorInfo | null;
  onCerrarSesion: () => void;
}

export default function ModalAccesoColaborador({
  info,
  onCerrarSesion
}: ModalAccesoColaboradorProps) {
  const [mounted, setMounted] = useState(false);
  const [horaActualTexto, setHoraActualTexto] = useState("");

  useEffect(() => {
    setMounted(true);
    const actualizarHora = () => {
      const ahora = new Date();
      const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const diaTexto = diasNombres[ahora.getDay()];
      const horaTexto = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
      setHoraActualTexto(`${diaTexto}, ${horaTexto}`);
    };
    actualizarHora();
    const interval = setInterval(actualizarHora, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!info || !mounted) return null;

  const esHorario = info.motivo === 'fuera_de_horario';
  const nombreColab = info.nombreColaborador || 'Vendedor';
  const nombreNeg = info.nombreNegocio || 'tu negocio';
  const telefonoAdmin = info.telefonoAdmin || '';

  // Formateador amigable de horarios configurados
  const formatearHorarioDetalle = () => {
    if (!info.horarios || info.horarios.length === 0) return null;
    const activos = info.horarios.filter(h => h.activoAuto !== false);
    if (activos.length === 0) return null;

    return activos.map((h, i) => {
      const dias = h.dias || [];
      let diasTexto = dias.join(', ');
      if (dias.length === 7) diasTexto = "Todos los días";
      else if (dias.length === 5 && !dias.includes('Sab') && !dias.includes('Dom')) diasTexto = "Lunes a Viernes";
      else if (dias.length === 6 && !dias.includes('Dom')) diasTexto = "Lunes a Sábado";

      return (
        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{diasTexto}:</span>
          <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
            {h.inicio || '00:00'} - {h.fin || '23:59'}
          </span>
        </div>
      );
    });
  };

  const contactarAdminWhatsApp = () => {
    if (!telefonoAdmin) return;
    const mensaje = esHorario
      ? `Hola! Intento ingresar a Fiabono pero mi cuenta de vendedor (${nombreColab}) figura fuera de horario laboral. ¿Podrías apoyarme?`
      : `Hola! Mi usuario de vendedor (${nombreColab}) en Fiabono aparece actualmente en pausa. ¿Podrías reactivar mi acceso?`;
    
    abrirEnlaceWhatsApp(telefonoAdmin, mensaje);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrarSesion();
      }}
    >
      <div 
        className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onCerrarSesion}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer z-10"
          aria-label="Cerrar y salir"
        >
          <X size={18} />
        </button>

        {/* Cabecera con degradado temático */}
        <div className={`p-6 sm:p-7 text-center relative overflow-hidden ${
          esHorario 
            ? 'bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent' 
            : 'bg-gradient-to-br from-rose-500/15 via-orange-500/10 to-transparent'
        }`}>
          {/* Icono central grande con halo */}
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-inner border ${
            esHorario
              ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-300/40 dark:border-amber-700/40'
              : 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-300/40 dark:border-rose-700/40'
          }`}>
            {esHorario ? (
              <Clock size={32} className="animate-pulse" />
            ) : (
              <Lock size={30} />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider mb-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs border border-slate-200/50 dark:border-slate-700/50">
            {esHorario ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-amber-800 dark:text-amber-300">Fuera de Horario Laboral</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-rose-800 dark:text-rose-300">Acceso Temporalmente Pausado</span>
              </>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {esHorario ? 'Acceso Restringido por Horario' : 'Cuenta de Vendedor Inactiva'}
          </h3>

          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
            {esHorario ? (
              <>
                Hola <strong className="text-slate-900 dark:text-white">{nombreColab}</strong>. Tu cuenta en <strong className="text-slate-900 dark:text-white">{nombreNeg}</strong> está programada para operar únicamente durante tu jornada laboral.
              </>
            ) : (
              <>
                Hola <strong className="text-slate-900 dark:text-white">{nombreColab}</strong>. El administrador de <strong className="text-slate-900 dark:text-white">{nombreNeg}</strong> ha pausado temporalmente el acceso de este usuario.
              </>
            )}
          </p>
        </div>

        {/* Cuerpo informativo */}
        <div className="p-6 space-y-4">
          {esHorario ? (
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-200 dark:border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-600 dark:text-amber-400" /> Horarios de atención asignados
                </span>
              </div>

              <div className="space-y-1">
                {formatearHorarioDetalle() || (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Horario de turno laboral restringido por el administrador.
                  </p>
                )}
              </div>

              {horaActualTexto && (
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Hora actual del intento:</span>
                  <strong className="text-slate-900 dark:text-white font-black">{horaActualTexto}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 p-4 flex items-start gap-3">
              <ShieldAlert size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-900 dark:text-rose-200">
                  ¿Necesitas iniciar tu turno de ventas?
                </p>
                <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                  Comunícate con el dueño o administrador del negocio para que reactive tu perfil desde su panel de colaboradores.
                </p>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="space-y-2 pt-1">
            {telefonoAdmin && (
              <button
                type="button"
                onClick={contactarAdminWhatsApp}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md shadow-emerald-600/20 text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <MessageCircle size={17} />
                <span>Contactar al Administrador por WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCerrarSesion}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>Entendido, Salir</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
