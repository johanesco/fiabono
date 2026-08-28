"use client";
import React from "react";
import { X, CheckCircle2, Sparkles, Crown, Store, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export interface ModalUpsellProps {
  visible: boolean;
  titulo?: string;
  mensaje?: string;
  planRecomendado?: 'comercio' | 'pro';
  onClose: () => void;
}

export default function ModalUpsellSuscripcion({
  visible,
  titulo = "Haz crecer tu negocio",
  mensaje = "Desbloquea todo el potencial de Fiabono para vender sin límites.",
  planRecomendado = 'comercio',
  onClose
}: ModalUpsellProps) {
  const router = useRouter();

  if (!visible) return null;

  const irAPerfilPlanes = () => {
    onClose();
    router.push('/dashboard/perfil?tab=planes');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative animate-in zoom-in-95 duration-300">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors z-20 cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Cabecera con degradado */}
        <div className={`p-8 pb-6 text-center relative overflow-hidden ${
          planRecomendado === 'pro'
            ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-800 text-white'
            : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-800 text-white'
        }`}>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider mb-3">
            {planRecomendado === 'pro' ? <Crown size={13} className="text-amber-300" /> : <Sparkles size={13} />}
            <span>{planRecomendado === 'pro' ? 'Función Exclusiva PRO' : 'Desbloquea Plan Comercio'}</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            {titulo}
          </h3>
          <p className="text-sm text-white/80 max-w-md mx-auto leading-relaxed">
            {mensaje}
          </p>
        </div>

        {/* Contenido comparativo */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tarjeta Plan Comercio */}
            <div className={`p-4 rounded-2xl border transition-all ${
              planRecomendado === 'comercio'
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617]'
            }`}>
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-black text-xs uppercase mb-1">
                <Store size={14} /> Plan Comercio
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">$19.900 <span className="text-xs font-normal text-slate-500">/mes</span></p>
              <ul className="mt-3 space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Clientes e Inv. Ilimitados</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Factura Imprimible (58/80mm)</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> Alertas de Stock Bajo</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> 1 Usuario Colaborador</li>
              </ul>
            </div>

            {/* Tarjeta Plan PRO Almacén */}
            <div className={`p-4 rounded-2xl border transition-all ${
              planRecomendado === 'pro'
                ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617]'
            }`}>
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-black text-xs uppercase mb-1">
                <Crown size={14} className="text-amber-500" /> Plan PRO Almacén
              </div>
              <p className="text-xl font-black text-slate-900 dark:text-white">$44.900 <span className="text-xs font-normal text-slate-500">/mes</span></p>
              <ul className="mt-3 space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-500 shrink-0" /> Módulo PLAN SEPARE Completo</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-500 shrink-0" /> Etiquetas Adhesivas QR</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-500 shrink-0" /> Carga Masiva Excel</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-purple-500 shrink-0" /> 4 Colaboradores + Multi</li>
              </ul>
            </div>
          </div>

          {/* Botón CTA Principal */}
          <div className="flex flex-col gap-2">
            <button
              onClick={irAPerfilPlanes}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base text-white shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer ${
                planRecomendado === 'pro'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-purple-600/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/30'
              }`}
            >
              <span>Ver Planes y Activar Ahora</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              Continuar en mi plan actual
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}