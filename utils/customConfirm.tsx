import toast from 'react-hot-toast';
import { AlertCircle } from 'lucide-react';

export const customConfirm = (mensaje: string): Promise<boolean> => {
  return new Promise((resolve) => {
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white dark:bg-[#0f172a] shadow-2xl rounded-[1.5rem] pointer-events-auto border border-slate-100 dark:border-slate-800 p-5`}>
        <div className="flex gap-4 items-start">
          <div className="shrink-0 bg-amber-100 dark:bg-amber-500/20 p-2.5 rounded-2xl text-amber-600 dark:text-amber-400">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-900 dark:text-white leading-relaxed whitespace-pre-line">
              {mensaje}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button 
                onClick={() => { toast.dismiss(t.id); resolve(false); }} 
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { toast.dismiss(t.id); resolve(true); }} 
                className="px-4 py-2.5 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-md shadow-blue-500/20"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </div>
    ), { duration: Infinity, position: 'top-center' });
  });
};
