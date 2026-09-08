import toast from 'react-hot-toast';
import { HelpCircle, AlertTriangle, X } from 'lucide-react';

interface CustomConfirmOpciones {
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  tipo?: 'peligro' | 'advertencia' | 'info';
}

export const customConfirm = (
  mensaje: string, 
  opciones?: CustomConfirmOpciones
): Promise<boolean> => {
  const tipo = opciones?.tipo || 'advertencia';
  const textoConfirmar = opciones?.textoConfirmar || 'Confirmar';
  const textoCancelar = opciones?.textoCancelar || 'Cancelar';
  const titulo = opciones?.titulo || (tipo === 'peligro' ? '¿Estás seguro?' : 'Confirmación requerida');

  return new Promise((resolve) => {
    toast.custom((t) => (
      <div 
        className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm sm:max-w-md w-full bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl shadow-2xl rounded-3xl pointer-events-auto border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 select-none transition-all`}
      >
        <div className="flex gap-4 items-start">
          <div className={`shrink-0 p-3 rounded-2xl shadow-xs ${
            tipo === 'peligro' 
              ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' 
              : (tipo === 'info' 
                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                  : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400')
          }`}>
            {tipo === 'peligro' ? (
              <AlertTriangle size={24} className="stroke-[2.5]" />
            ) : (
              <HelpCircle size={24} className="stroke-[2.5]" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
              {titulo}
            </h4>
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5 whitespace-pre-line">
              {mensaje}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => { toast.dismiss(t.id); resolve(false); }} 
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {textoCancelar}
              </button>
              
              <button 
                type="button"
                onClick={() => { toast.dismiss(t.id); resolve(true); }} 
                className={`px-4 py-2 text-xs font-black rounded-xl active:scale-95 text-white transition-all shadow-md cursor-pointer ${
                  tipo === 'peligro'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                {textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  });
};
