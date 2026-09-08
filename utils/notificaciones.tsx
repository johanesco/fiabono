import React from 'react';
import toast, { Toast } from 'react-hot-toast';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Sparkles, 
  X 
} from 'lucide-react';

type TipoNotificacion = 'exito' | 'error' | 'advertencia' | 'info';

interface NotificacionConfig {
  titulo?: string;
  duracion?: number;
  icono?: React.ReactNode;
}

const renderizarNotificacion = (
  t: Toast,
  mensaje: string,
  tipo: TipoNotificacion,
  config?: NotificacionConfig
) => {
  // Configuración de colores e iconos según el tipo
  const configs = {
    exito: {
      borde: 'border-emerald-500/25 dark:border-emerald-500/30',
      fondoIcono: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      iconoDefault: <CheckCircle2 size={20} className="stroke-[2.5]" />,
      tituloDefault: '¡Operación Exitosa!',
      brillo: 'from-emerald-500/10 to-transparent'
    },
    error: {
      borde: 'border-rose-500/25 dark:border-rose-500/30',
      fondoIcono: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      iconoDefault: <XCircle size={20} className="stroke-[2.5]" />,
      tituloDefault: 'Atención requerida',
      brillo: 'from-rose-500/10 to-transparent'
    },
    advertencia: {
      borde: 'border-amber-500/25 dark:border-amber-500/30',
      fondoIcono: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      iconoDefault: <AlertTriangle size={20} className="stroke-[2.5]" />,
      tituloDefault: 'Advertencia',
      brillo: 'from-amber-500/10 to-transparent'
    },
    info: {
      borde: 'border-blue-500/25 dark:border-blue-500/30',
      fondoIcono: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      iconoDefault: <Info size={20} className="stroke-[2.5]" />,
      tituloDefault: 'Información',
      brillo: 'from-blue-500/10 to-transparent'
    }
  };

  const c = configs[tipo];
  const tituloMostrar = config?.titulo || c.tituloDefault;
  const iconoMostrar = config?.icono || c.iconoDefault;

  return (
    <div
      className={`relative overflow-hidden w-full max-w-sm sm:max-w-md rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border ${c.borde} shadow-xl shadow-slate-900/10 dark:shadow-slate-950/60 p-3.5 sm:p-4 transition-all pointer-events-auto select-none ${
        t.visible ? 'animate-enter' : 'animate-leave'
      }`}
    >
      {/* Luz ambiental sutil en la esquina superior */}
      <div className={`absolute -top-10 -left-10 w-28 h-28 bg-gradient-to-br ${c.brillo} rounded-full blur-xl pointer-events-none`} />

      <div className="flex items-start gap-3 relative z-10">
        {/* Contenedor del Icono con relieve */}
        <div className={`shrink-0 p-2 sm:p-2.5 rounded-xl ${c.fondoIcono} shadow-xs`}>
          {iconoMostrar}
        </div>

        {/* Textos */}
        <div className="flex-1 min-w-0 pt-0.5">
          {tituloMostrar && (
            <h5 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
              {tituloMostrar}
            </h5>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-0.5 whitespace-pre-line">
            {mensaje}
          </p>
        </div>

        {/* Botón cerrar sutil */}
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export const notificar = {
  exito: (mensaje: string, config?: NotificacionConfig) => {
    return toast.custom(
      (t) => renderizarNotificacion(t, mensaje, 'exito', config),
      { duration: config?.duracion || 3200, position: 'top-right' }
    );
  },

  error: (mensaje: string, config?: NotificacionConfig) => {
    return toast.custom(
      (t) => renderizarNotificacion(t, mensaje, 'error', config),
      { duration: config?.duracion || 4000, position: 'top-right' }
    );
  },

  advertencia: (mensaje: string, config?: NotificacionConfig) => {
    return toast.custom(
      (t) => renderizarNotificacion(t, mensaje, 'advertencia', config),
      { duration: config?.duracion || 3800, position: 'top-right' }
    );
  },

  info: (mensaje: string, config?: NotificacionConfig) => {
    return toast.custom(
      (t) => renderizarNotificacion(t, mensaje, 'info', config),
      { duration: config?.duracion || 3500, position: 'top-right' }
    );
  }
};
