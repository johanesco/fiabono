"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import { Movimiento } from '@/types';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/AuthContext';
import { customConfirm } from '@/utils/customConfirm';

interface ModalProcesarDevolucionProps {
  isOpen: boolean;
  ventaOrigen: Movimiento;
  onClose: () => void;
  onSuccess: (devolucionDatos: any) => void;
}

export default function ModalProcesarDevolucion({
  isOpen,
  ventaOrigen,
  onClose,
  onSuccess
}: ModalProcesarDevolucionProps) {
  const { datosSesion } = useAuth();
  
  // Estado de cantidas devueltas por index del detalle
  const [cantidadesDevueltas, setCantidadesDevueltas] = useState<Record<number, number>>({});
  const [yaDevueltos, setYaDevueltos] = useState<Record<number, number>>({});
  const esClienteRegistrado = ventaOrigen?.clienteId && ventaOrigen.clienteId !== 'mostrador';
  const [metodoDevolucion, setMetodoDevolucion] = useState<'saldo_a_favor' | 'efectivo'>(esClienteRegistrado ? 'saldo_a_favor' : 'efectivo');
  const [procesando, setProcesando] = useState(false);

  const detalles = ventaOrigen?.detalles || [];

  // Reset al abrir
  useEffect(() => {
    if (isOpen && ventaOrigen?.id) {
      setCantidadesDevueltas({});
      setYaDevueltos({});
      setMetodoDevolucion(esClienteRegistrado ? 'saldo_a_favor' : 'efectivo');

      const fetchDevoluciones = async () => {
        try {
          const qM = query(
            collection(db, "movimientos"),
            where("movimientoOrigenId", "==", ventaOrigen.id),
            where("tipo", "==", "devolucion")
          );
          const snap = await getDocs(qM);
          const mapaDevueltos: Record<number, number> = {};
          
          const todasLasDevoluciones = snap.docs.map(d => d.data());
          detalles.forEach((det, i) => {
             let cantidadAcumulada = 0;
             todasLasDevoluciones.forEach(dev => {
                const arr = dev.articulosDevueltos || [];
                const mat = arr.find((a: any) => 
                  ((det as any).productoId && a.productoId === (det as any).productoId) || 
                  (a.descripcion === det.descripcion)
                );
                if (mat) cantidadAcumulada += (mat.cantidad || 0);
             });
             mapaDevueltos[i] = cantidadAcumulada;
          });
          setYaDevueltos(mapaDevueltos);
        } catch (e) {
          console.error(e);
        }
      };
      fetchDevoluciones();
    }
  }, [isOpen, esClienteRegistrado, ventaOrigen?.id, detalles]);

  const handleIncrement = (index: number, max: number) => {
    const current = cantidadesDevueltas[index] || 0;
    if (current < max) {
      setCantidadesDevueltas(prev => ({ ...prev, [index]: current + 1 }));
    }
  };

  const handleDecrement = (index: number) => {
    const current = cantidadesDevueltas[index] || 0;
    if (current > 0) {
      setCantidadesDevueltas(prev => ({ ...prev, [index]: current - 1 }));
    }
  };

  // FIN-02: Factor de descuento comercial real de la venta original (evita crear dinero ficticio)
  const factorDescuentoReal = useMemo(() => {
    const montoDescuento = Number(ventaOrigen?.montoDescuento || 0);
    if (montoDescuento <= 0) return 1;

    // Calcular la suma bruta original sumando el valor de lista de todos los items
    const totalBrutoItems = (ventaOrigen?.detalles || []).reduce((sum: number, det: any) => {
      const cant = det.cantidad || 1;
      const vUnit = det.valorUnitario || (det.valor ? Number(det.valor) / cant : 0);
      return sum + (cant * vUnit);
    }, 0);

    if (totalBrutoItems > 0 && montoDescuento < totalBrutoItems) {
      return (totalBrutoItems - montoDescuento) / totalBrutoItems;
    }
    return 1;
  }, [ventaOrigen]);

  // Calcular total a devolver basado en lo seleccionado con descuento prorrateado
  const totalDevolver = useMemo(() => {
    return detalles.reduce((sum, det, index) => {
      const cant = cantidadesDevueltas[index] || 0;
      const vUnitBruto = det.valorUnitario || (det.cantidad && det.cantidad > 0 ? (det.valor || 0) / det.cantidad : det.valor || 0);
      const vUnitNeto = Math.round(vUnitBruto * factorDescuentoReal);
      return sum + (cant * vUnitNeto);
    }, 0);
  }, [cantidadesDevueltas, detalles, factorDescuentoReal]);

  const haySeleccion = totalDevolver > 0;

  const reproducirSonidoAlerta = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  };

  const procesarDevolucion = async () => {
    if (!haySeleccion) {
      toast.error("Selecciona al menos un artículo para devolver.");
      return;
    }

    reproducirSonidoAlerta();
    const confirmado = await customConfirm(
      `¿Estás seguro de registrar esta devolución por $${totalDevolver.toLocaleString('es-CO')}?\n\nEsta acción sumará al inventario y afectará los saldos/caja.`,
      {
        titulo: 'Confirmar Devolución',
        textoConfirmar: 'Sí, procesar devolución',
        tipo: 'advertencia'
      }
    );

    if (!confirmado) return;

    setProcesando(true);
    try {
      const articulosDevueltos: any[] = [];
      detalles.forEach((det, index) => {
        const cant = cantidadesDevueltas[index] || 0;
        if (cant > 0) {
          const vUnitBruto = det.valorUnitario || (det.cantidad && det.cantidad > 0 ? (det.valor || 0) / det.cantidad : det.valor || 0);
          const vUnit = Math.round(vUnitBruto * factorDescuentoReal);
          const articuloObj: any = {
            detalleIndex: index,
            cantidad: cant,
            descripcion: det.descripcion,
            valorUnitario: vUnit,
            subtotal: cant * vUnit
          };
          if ((det as any).productoId) articuloObj.productoId = (det as any).productoId;
          
          articulosDevueltos.push(articuloObj);
        }
      });

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const respuesta = await fetch('/api/devoluciones/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          movimientoOrigenId: ventaOrigen.id,
          metodoDevolucion,
          articulosDevueltos
        })
      });
      const res = await respuesta.json();
      if (!respuesta.ok) throw new Error(res.error || 'No se pudo registrar la devolución.');

      toast.success("Devolución procesada correctamente");
      onSuccess({
        idTransaccion: res.movimientoId,
        saldoNuevo: res.nuevoSaldoCliente,
        totalDevolver,
        articulosDevueltos,
        metodoDevolucion
      });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al procesar la devolución.");
    } finally {
      setProcesando(false);
    }
  };

  if (!isOpen || !ventaOrigen) return null;

  const modal = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[9999998] animate-in zoom-in-95 duration-200">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-hidden border border-slate-100 dark:border-slate-800">
        
        {/* HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <RotateCcw size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Procesar Devolución</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona los artículos que regresan</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider">Artículos en la factura</h3>
            <div className="space-y-3">
              {detalles.map((det, index) => {
                const devueltos = cantidadesDevueltas[index] || 0;
                const ya = yaDevueltos[index] || 0;
                const maxDisponible = det.cantidad - ya;
                const esActivo = devueltos > 0;
                
                if (maxDisponible <= 0 && devueltos === 0) {
                   return (
                     <div key={index} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex items-center justify-between gap-3 opacity-60">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-slate-500 line-through">{det.descripcion}</p>
                          <p className="text-xs text-slate-400">Ya se devolvió en su totalidad</p>
                        </div>
                     </div>
                   );
                }

                return (
                  <div 
                    key={index} 
                    className={`p-3 rounded-2xl border transition-all ${
                      esActivo 
                        ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50'
                    } flex items-center justify-between gap-3`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold truncate ${esActivo ? 'text-amber-900 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {det.descripcion}
                      </p>
                      <p className="text-xs text-slate-500">
                        {maxDisponible}x disponible a ${(Math.round((det.valorUnitario || (det.valor || 0) / (det.cantidad || 1)) * factorDescuentoReal)).toLocaleString('es-CO')} c/u
                        {factorDescuentoReal < 1 && <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-bold">(desc. prorrateado)</span>}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                      <button 
                        onClick={() => handleDecrement(index)}
                        disabled={devueltos === 0}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors ${
                          devueltos > 0 
                            ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50' 
                            : 'text-slate-400 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        -
                      </button>
                      <span className="w-4 text-center font-black text-slate-700 dark:text-slate-200 text-sm">{devueltos}</span>
                      <button 
                        onClick={() => handleIncrement(index, maxDisponible)}
                        disabled={devueltos === maxDisponible}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-bold transition-colors ${
                          devueltos < maxDisponible 
                            ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50' 
                            : 'text-slate-400 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-slate-600 dark:text-slate-400">Total a Reembolsar:</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">${totalDevolver.toLocaleString('es-CO')}</span>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider block mb-1">Método de reembolso</label>
              
              {/* Un cliente identificado puede elegir crédito a favor incluso si la venta original fue de contado. */}
              {(() => {
                const saldoFavorBloqueado = !esClienteRegistrado;
                // Auto-corregir la selección si el método actual ya no es válido
                if (saldoFavorBloqueado && metodoDevolucion === 'saldo_a_favor') {
                  // Usar setTimeout para evitar setState durante render
                  setTimeout(() => setMetodoDevolucion('efectivo'), 0);
                }
                return (
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    metodoDevolucion === 'saldo_a_favor' && !saldoFavorBloqueado
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' 
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                  } ${saldoFavorBloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input 
                      type="radio" 
                      name="metodoDevolucion" 
                      value="saldo_a_favor"
                      disabled={saldoFavorBloqueado}
                      checked={metodoDevolucion === 'saldo_a_favor' && !saldoFavorBloqueado} 
                      onChange={() => setMetodoDevolucion('saldo_a_favor')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Abonar como Saldo a Favor</p>
                      <p className="text-xs text-slate-500">
                        {saldoFavorBloqueado
                          ? 'No disponible: la venta no está asociada a un cliente registrado.'
                          : 'Se guardará como crédito para una compra futura y se aplicará a su cuenta.'}
                      </p>
                    </div>
                  </label>
                );
              })()}

               <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                metodoDevolucion === 'efectivo' 
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
              } ${ventaOrigen.tipo === 'fiado' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="radio" 
                  name="metodoDevolucion" 
                  value="efectivo"
                  disabled={ventaOrigen.tipo === 'fiado'}
                  checked={metodoDevolucion === 'efectivo'} 
                  onChange={() => setMetodoDevolucion('efectivo')}
                  className="w-4 h-4 text-amber-600"
                />
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">Entregar en Efectivo</p>
                  <p className="text-xs text-slate-500">Saca el dinero físico de la caja (No afecta deuda).</p>
                </div>
              </label>

              {!esClienteRegistrado && (
                <div className="flex gap-2 text-amber-600 dark:text-amber-400 text-xs mt-2 p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                  <AlertCircle size={14} className="shrink-0" />
                  <p>Venta de mostrador. Solo se permite reembolso en efectivo.</p>
                </div>
              )}
              {ventaOrigen.tipo === 'fiado' && (
                <div className="flex gap-2 text-amber-600 dark:text-amber-400 text-xs mt-2 p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg">
                  <AlertCircle size={14} className="shrink-0" />
                  <p>Esta transacción fue un <strong>Fiado</strong> original. No puedes entregar efectivo por algo que el cliente no ha pagado. Solo puedes abonar a la deuda.</p>
                </div>
              )}
            </div>
          </div>
          
        </div>

        {/* FOOTER */}
        <div className="p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shrink-0">
          <button 
            onClick={procesarDevolucion}
            disabled={!haySeleccion || procesando || (!esClienteRegistrado && metodoDevolucion === 'saldo_a_favor')}
            className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
              haySeleccion && !procesando
                ? 'bg-amber-500 hover:bg-amber-600 text-white active:scale-[0.98]' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {procesando ? 'Procesando...' : 'Confirmar Devolución'} <CheckCircle2 size={20} />
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(modal, document.body);
}
