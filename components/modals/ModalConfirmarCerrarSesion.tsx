'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, X } from 'lucide-react';

interface ModalConfirmarCerrarSesionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  procesando?: boolean;
}

export default function ModalConfirmarCerrarSesion({
  isOpen,
  onClose,
  onConfirm,
  procesando = false
}: ModalConfirmarCerrarSesionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-sm p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
            <LogOut size={22} />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            ¿Deseas cerrar sesión?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Tendrás que ingresar nuevamente tus datos de acceso para ingresar a tu cuenta de Fiabono.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="py-2.5 px-4 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={procesando}
            className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {procesando ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogOut size={14} /> Cerrar Sesión
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
