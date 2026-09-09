"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { UserCog, CheckCircle2 } from 'lucide-react';

interface ModalNuevoClienteProps {
  visible: boolean;
  cerrarModal: () => void;
  nombreNuevo: string;
  setNombreNuevo: (nombre: string) => void;
  celularNuevo: string;
  setCelularNuevo: (celular: string) => void;
  guardarClienteNuevo: () => void;
  guardandoCliente: boolean;
}

export default function ModalNuevoCliente({
  visible,
  cerrarModal,
  nombreNuevo,
  setNombreNuevo,
  celularNuevo,
  setCelularNuevo,
  guardarClienteNuevo,
  guardandoCliente
}: ModalNuevoClienteProps) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);
  
  // Si no está visible, no renderizamos nada
  if (!visible) return null;

  const modalJSX = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[999999]">
      <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/60 animate-in zoom-in-95 duration-200">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <UserCog size={28}/> Registrar Cliente
        </h3>
        
        <div className="flex flex-col gap-4 mb-8">
          <input 
            type="text" 
            value={nombreNuevo} 
            onChange={(e) => setNombreNuevo(e.target.value)} 
            placeholder="Nombre completo" 
            autoFocus
            className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" 
          />
          <input 
            type="tel" 
            value={celularNuevo} 
            onChange={(e) => setCelularNuevo(e.target.value)} 
            placeholder="WhatsApp (Opcional)" 
            className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={cerrarModal} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg cursor-pointer">
            Cancelar
          </button>
          <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 transition-colors flex justify-center items-center gap-2 text-lg cursor-pointer">
            Guardar <CheckCircle2 size={20}/>
          </button>
        </div>
      </div>
    </div>
  );

  if (montado && typeof document !== "undefined") {
    return createPortal(modalJSX, document.body);
  }

  return modalJSX;
}