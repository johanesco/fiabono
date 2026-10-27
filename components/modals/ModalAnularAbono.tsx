// components/modals/ModalAnularAbono.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { auth } from '@/firebase';
import toast from 'react-hot-toast';

interface ModalAnularAbonoProps {
  isOpen: boolean;
  onClose: () => void;
  movimiento: {
    id: string;
    monto: number;
    clienteNombre?: string;
    fecha?: any;
    idSepareOrigen?: string;
    separeId?: string;
    descripcion?: string;
  } | null;
  clienteNombre?: string;
  clienteDeudaActual?: number;
  onSuccess?: () => void;
}

export default function ModalAnularAbono({
  isOpen,
  onClose,
  movimiento,
  clienteNombre,
  clienteDeudaActual,
  onSuccess
}: ModalAnularAbonoProps) {
  const [motivo, setMotivo] = useState<string>('Abono registrado por error o duplicado');
  const [fase, setFase] = useState<'formulario' | 'confirmacion'>('formulario');
  const [procesando, setProcesando] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resetear fase al abrir o cambiar movimiento
  useEffect(() => {
    if (isOpen) {
      setFase('formulario');
      setMotivo('Abono registrado por error o duplicado');
    }
  }, [isOpen, movimiento?.id]);

  if (!isOpen || !movimiento || !mounted) return null;

  const esSepare = Boolean(movimiento.idSepareOrigen || movimiento.separeId || movimiento.descripcion?.toLowerCase().includes('separe'));
  const nombreFinal = clienteNombre || movimiento.clienteNombre || 'Cliente';

  const handleAnular = async () => {
    if (procesando) return;
    setProcesando(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión no válida o expirada.');

      const res = await fetch('/api/abonos/anular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          movimientoId: movimiento.id,
          motivo: motivo.trim() || 'Abono registrado por error'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al anular el abono.');
      }

      toast.success(data.mensaje || '¡Abono anulado y saldo restaurado correctamente!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al anular abono:', error);
      toast.error(error.message || 'No se pudo anular el abono.');
    } finally {
      setProcesando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-md p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
        
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              fase === 'confirmacion'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
            }`}>
              {fase === 'confirmacion' ? <AlertTriangle size={20} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {fase === 'confirmacion' ? 'Confirmar Anulación de Abono' : 'Anular Abono por Error'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fase === 'confirmacion' ? 'Paso 2 de 2: Confirmación de seguridad' : 'Reversión contable de pago o abono duplicado'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {fase === 'formulario' ? (
          <>
            {/* Tarjeta de Resumen del Abono */}
            {typeof window !== 'undefined' && !navigator.onLine && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-300">Conexión requerida para anular</p>
              <p className="text-[11px] text-amber-200/80 leading-snug">
                Por seguridad contable y auditoría fiscal, no es posible revertir abonos sin validar primero los saldos en el servidor central.
              </p>
            </div>
          </div>
        )}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Cliente:</span>
                <span className="font-bold text-slate-900 dark:text-white">{nombreFinal}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Destino:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {esSepare ? '🔖 Plan Separe' : '🤝 Cartera / Fiado'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">Monto del abono:</span>
                <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                  -${Number(movimiento.monto || 0).toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Advertencia Pedagógica */}
            <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle size={17} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <p className="font-bold">¿Qué sucederá al anular?</p>
                <p>
                  El saldo del cliente se <strong>restaurará automáticamente</strong> (se sumarán de nuevo <strong>${Number(movimiento.monto || 0).toLocaleString('es-CO')}</strong> a su deuda/separe) y este abono se marcará como <em>ANULADO</em>.
                </p>
              </div>
            </div>

            {/* Selector de Motivo */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                Motivo de anulación
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Se registró dos veces, digitación equivocada..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-rose-500 transition-colors"
              />
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                {['Abono duplicado', 'Monto incorrecto', 'Cliente equivocado'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setMotivo(sug)}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Botones Paso 1 */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-3 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setFase('confirmacion')}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>Continuar</span>
                <RotateCcw size={13} />
              </button>
            </div>
          </>
        ) : (
          /* FASE 2: CONFIRMACIÓN DEFINITIVA */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-center space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-white dark:bg-rose-900/60 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-700/60 inline-block">
                ⚠️ Atención: Acción contable
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold leading-relaxed">
                ¿Estás seguro de anular el abono de <strong className="text-rose-600 dark:text-rose-400 font-black text-sm">${Number(movimiento.monto || 0).toLocaleString('es-CO')}</strong> a nombre de <strong className="text-slate-900 dark:text-white font-black">{nombreFinal}</strong>?
              </p>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-[#020617]/80 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/40 text-left space-y-1">
                <p>• <strong>Destino:</strong> {esSepare ? 'Plan Separe' : 'Cartera / Fiado'}</p>
                <p>• <strong>Impacto:</strong> Se reincorporará la deuda al cliente y se restará del total del turno.</p>
                <p>• <strong>Motivo:</strong> "{motivo || 'Abono registrado por error'}"</p>
              </div>
            </div>

            {/* Botones Paso 2 */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFase('formulario')}
                disabled={procesando}
                className="py-2.5 px-3 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                Volver atrás
              </button>
              <button
                type="button"
                onClick={handleAnular}
                disabled={procesando}
                className="py-2.5 px-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-black rounded-xl text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {procesando ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Confirmar Anulación
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
