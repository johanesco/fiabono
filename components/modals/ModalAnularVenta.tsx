'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, RotateCcw, Package, User, DollarSign, ShieldAlert } from 'lucide-react';
import { auth } from '@/firebase';
import { Movimiento } from '@/types';
import toast from 'react-hot-toast';

interface ModalAnularVentaProps {
  isOpen: boolean;
  onClose: () => void;
  venta: Movimiento | null;
  onSuccess?: () => void;
}

const MOTIVOS_SUGERIDOS = [
  'Error de digitación en el monto o producto',
  'Transacción de prueba o demostración',
  'Cobro duplicado por error del cajero',
  'Cliente canceló la compra en el mostrador antes de pagar',
  'Otro motivo'
];

export default function ModalAnularVenta({
  isOpen,
  onClose,
  venta,
  onSuccess
}: ModalAnularVentaProps) {
  const [motivo, setMotivo] = useState<string>(MOTIVOS_SUGERIDOS[0]);
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('');
  const [fase, setFase] = useState<'detalle' | 'confirmar'>('detalle');
  const [procesando, setProcesando] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFase('detalle');
      setMotivo(MOTIVOS_SUGERIDOS[0]);
      setMotivoPersonalizado('');
    }
  }, [isOpen, venta?.id]);

  if (!isOpen || !venta || !mounted) return null;

  const esFiado = venta.tipo === 'fiado' || venta.metodoPago === 'fiado';
  const tieneDetalles = Array.isArray(venta.detalles) && venta.detalles.length > 0;
  const cantidadArticulos = tieneDetalles
    ? (venta.detalles || []).reduce((acc: number, d: any) => acc + (Number(d.cantidad) || 1), 0)
    : 0;

  const motivoFinal = motivo === 'Otro motivo' ? (motivoPersonalizado.trim() || 'Venta registrada por error') : motivo;

  const handleAnular = async () => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      toast.error('Acción restringida sin internet. Para anular una venta y reversar el stock necesitas conexión activa.', {
        icon: '🔒',
        duration: 5000
      });
      return;
    }

    if (procesando) return;
    setProcesando(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión no válida o expirada.');

      const res = await fetch('/api/ventas/anular', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          movimientoId: venta.id,
          motivo: motivoFinal
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al anular la venta.');
      }

      toast.success(data.mensaje || '¡Venta anulada con éxito!', { icon: '✅', duration: 4000 });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al anular venta:', error);
      toast.error(error.message || 'No se pudo anular la venta.');
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
              fase === 'confirmar'
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
            }`}>
              <RotateCcw size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {fase === 'confirmar' ? '¿Confirmar Anulación Definitiva?' : 'Anular Venta / Fiado por Error'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fase === 'confirmar' ? 'Paso 2 de 2: Esta acción revertirá stock y saldos' : 'Neutraliza el cobro y restaura el inventario'}
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

        {/* Alerta sin conexión si aplica */}
        {typeof window !== 'undefined' && !navigator.onLine && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
            <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-300">Conexión a internet requerida</p>
              <p className="text-[11px] text-amber-200/80 leading-snug">
                Para anular una venta y reintegrar el stock al catálogo necesitas recuperar la conexión.
              </p>
            </div>
          </div>
        )}

        {fase === 'detalle' ? (
          <>
            {/* Tarjeta con impacto de reversión */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-emerald-500" /> Monto de la transacción:
                </span>
                <span className="font-black text-base text-slate-900 dark:text-white">
                  ${Math.round(Number(venta.monto) || 0).toLocaleString('es-CO')}
                </span>
              </div>

              {venta.clienteNombre && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <User size={14} className="text-indigo-400" /> Cliente asignado:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {venta.clienteNombre}
                  </span>
                </div>
              )}

              {cantidadArticulos > 0 && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Package size={14} className="text-amber-500" /> Inventario a reintegrar:
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    +{cantidadArticulos} {cantidadArticulos === 1 ? 'artículo' : 'artículos'} al stock
                  </span>
                </div>
              )}

              {esFiado && (
                <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-800 font-semibold">
                  <span>Impacto en cartera:</span>
                  <span>Se restará de la deuda del cliente</span>
                </div>
              )}
            </div>

            {/* Selector de motivo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo de la anulación:
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#020617] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                {MOTIVOS_SUGERIDOS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {motivo === 'Otro motivo' && (
                <input
                  type="text"
                  placeholder="Describe brevemente el error..."
                  value={motivoPersonalizado}
                  onChange={(e) => setMotivoPersonalizado(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#020617] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/30 mt-1.5"
                />
              )}
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setFase('confirmar')}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Paso 2: Confirmación con advertencia de impacto */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <AlertTriangle size={16} />
                <span>Advertencia de Auditoría</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Esta acción es <strong>definitiva</strong>. Se registrará en la auditoría con tu nombre de usuario, se devolverán los productos al catálogo y el dinero no se contará en el total del día.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFase('detalle')}
                disabled={procesando}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleAnular}
                disabled={procesando}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {procesando ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sí, anular venta'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
