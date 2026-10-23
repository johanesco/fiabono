// components/caja/ModalDetalleCierre.tsx
'use client';

import React from 'react';
import { X, CheckCircle2, AlertTriangle, Printer, Send, Clock, User, DollarSign, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';
import { CierreCaja } from '@/types';
import { useAuth } from '@/hooks/AuthContext';
import { generarTextoWhatsAppCierre } from '@/utils/cierreCaja';
import { abrirEnlaceWhatsApp } from '@/utils/whatsapp';
import toast from 'react-hot-toast';

interface ModalDetalleCierreProps {
  cierre: CierreCaja | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalDetalleCierre({ cierre, isOpen, onClose }: ModalDetalleCierreProps) {
  const { datosSesion } = useAuth();
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const telefonoAdmin = datosSesion?.telefonoAdmin || "";

  if (!isOpen || !cierre) return null;

  const fechaCierre = cierre.fechaCierre?.toDate ? cierre.fechaCierre.toDate() : new Date(cierre.fechaCierre);
  const fechaApertura = cierre.fechaApertura?.toDate ? cierre.fechaApertura.toDate() : (cierre.fechaApertura ? new Date(cierre.fechaApertura) : null);

  const fechaCierreTxt = fechaCierre.toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const fechaAperturaTxt = fechaApertura ? fechaApertura.toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }) : 'Inicio del día';

  // Compartir por WhatsApp
  const compartirWhatsApp = () => {
    const rangoTxt = `${fechaAperturaTxt} - ${fechaCierreTxt}`;
    const texto = generarTextoWhatsAppCierre({
      negocioNombre: nombreNegocio,
      cierre,
      fechaTexto: fechaCierreTxt,
      rangoTexto: rangoTxt
    });

    abrirEnlaceWhatsApp(telefonoAdmin || "", texto);
  };

  // Imprimir Ticket
  const imprimirTicket = () => {
    if (typeof window === 'undefined') return;

    const ventanaimpresion = window.open('', '_blank', 'width=400,height=600');
    if (!ventanaimpresion) {
      toast.error("Por favor habilita las ventanas emergentes para imprimir.");
      return;
    }

    const estadoCuadreTxt = cierre.tipoDiferencia === 'exacto' 
      ? 'CUADRE EXACTO ($0)' 
      : (cierre.tipoDiferencia === 'sobrante' 
        ? `SOBRANTE: +$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}` 
        : `FALTANTE: -$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}`);

    ventanaimpresion.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cierre de Caja - ${nombreNegocio}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #000;
            background: #fff;
            padding: 12px;
            margin: 0;
            width: 100%;
            max-width: 320px;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .title { font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
          .subtitle { font-size: 11px; margin-bottom: 5px; }
          .highlight { font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${nombreNegocio}</div>
          <div class="subtitle">AUDITORÍA DE CIERRE DE CAJA</div>
          <div style="font-size: 10px;">ID: ${cierre.id || 'N/A'}</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Cajero:</span><span class="bold">${cierre.cerradoPorNombre}</span></div>
        <div class="row"><span>Apertura:</span><span>${fechaAperturaTxt}</span></div>
        <div class="row"><span>Cierre:</span><span>${fechaCierreTxt}</span></div>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">ARQUEO DE EFECTIVO:</div>
        <div class="row"><span>Base Inicial:</span><span>$${(cierre.baseInicial || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(+) Ventas Efectivo:</span><span>$${(cierre.ventasEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(+) Abonos Efectivo:</span><span>$${(cierre.abonosEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(-) Egresos / Gastos:</span><span>-$${(cierre.egresosEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(-) Devoluciones:</span><span>-$${(cierre.devolucionesEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="divider"></div>
        <div class="row highlight"><span>EFECTIVO ESPERADO:</span><span>$${cierre.totalEfectivoEsperado.toLocaleString('es-CO')}</span></div>
        <div class="row highlight"><span>EFECTIVO CONTADO:</span><span>$${cierre.totalEfectivoReal.toLocaleString('es-CO')}</span></div>
        <div class="row bold" style="margin-top: 4px;"><span>DIFERENCIA:</span><span>${estadoCuadreTxt}</span></div>
        
        ${cierre.totalVentasDigitales > 0 ? `
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 4px;">RECAUDO DIGITAL (BANCOS):</div>
          ${cierre.desgloseDigitales?.nequi ? `<div class="row"><span>Nequi:</span><span>$${cierre.desgloseDigitales.nequi.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierre.desgloseDigitales?.daviplata ? `<div class="row"><span>Daviplata:</span><span>$${cierre.desgloseDigitales.daviplata.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierre.desgloseDigitales?.datafono ? `<div class="row"><span>Datáfono / Tarjetas:</span><span>$${cierre.desgloseDigitales.datafono.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierre.desgloseDigitales?.bancolombia ? `<div class="row"><span>Bancolombia:</span><span>$${cierre.desgloseDigitales.bancolombia.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierre.desgloseDigitales?.transferencia ? `<div class="row"><span>Transferencias:</span><span>$${cierre.desgloseDigitales.transferencia.toLocaleString('es-CO')}</span></div>` : ''}
          <div class="row bold"><span>Total Digital:</span><span>$${cierre.totalVentasDigitales.toLocaleString('es-CO')}</span></div>
        ` : ''}

        <div class="divider"></div>
        <div class="row highlight"><span>TOTAL RECAUDADO:</span><span>$${cierre.totalRecaudadoGeneral.toLocaleString('es-CO')}</span></div>
        <div class="row"><span>Total Movimientos:</span><span>${cierre.totalTransacciones}</span></div>
        
        ${cierre.notas ? `
          <div class="divider"></div>
          <div style="font-size: 10px; word-break: break-word;">Notas: ${cierre.notas}</div>
        ` : ''}
        
        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
          Fiabono - Sistema de Gestión Comercial
        </div>
      </body>
      </html>
    `);

    ventanaimpresion.document.close();
    ventanaimpresion.focus();
    setTimeout(() => {
      ventanaimpresion.print();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 my-auto overflow-hidden">
        
        {/* CABECERA */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-900 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                Auditoría de Cierre de Caja
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Cerrado por: <span className="font-bold text-slate-200">{cierre.cerradoPorNombre}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
          
          {/* META INFO */}
          <div className="bg-slate-50 dark:bg-[#1e293b]/50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Fecha de Cierre:</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{fechaCierreTxt}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Apertura del Turno:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{fechaAperturaTxt}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Transacciones Auditadas:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{cierre.totalTransacciones} movs</span>
            </div>
          </div>

          {/* ARQUEO DE EFECTIVO */}
          <div className="bg-slate-50 dark:bg-[#090d16] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Arqueo de Efectivo Físico
            </span>

            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span>Base Inicial:</span>
              <span className="font-bold">${(cierre.baseInicial || 0).toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1"><ArrowUpRight size={13} /> (+) Ventas en Efectivo:</span>
              <span className="font-bold">${(cierre.ventasEfectivo || 0).toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-1"><ArrowUpRight size={13} /> (+) Abonos en Efectivo:</span>
              <span className="font-bold">${(cierre.abonosEfectivo || 0).toLocaleString('es-CO')}</span>
            </div>
            {cierre.egresosEfectivo > 0 && (
              <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1"><ArrowDownRight size={13} /> (-) Egresos / Gastos:</span>
                <span className="font-bold">-${cierre.egresosEfectivo.toLocaleString('es-CO')}</span>
              </div>
            )}
            {cierre.devolucionesEfectivo > 0 && (
              <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
                <span className="flex items-center gap-1"><ArrowDownRight size={13} /> (-) Devoluciones:</span>
                <span className="font-bold">-${cierre.devolucionesEfectivo.toLocaleString('es-CO')}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-300">Efectivo Esperado:</span>
              <span className="font-black text-base text-slate-900 dark:text-white">
                ${cierre.totalEfectivoEsperado.toLocaleString('es-CO')}
              </span>
            </div>

            <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400">
              <span className="font-bold">Efectivo Real Contado:</span>
              <span className="font-black text-lg">
                ${cierre.totalEfectivoReal.toLocaleString('es-CO')}
              </span>
            </div>
          </div>

          {/* BANNER DE DIFERENCIA */}
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
            cierre.tipoDiferencia === 'exacto'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
              : cierre.tipoDiferencia === 'sobrante'
                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800/60 text-blue-800 dark:text-blue-300'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {cierre.tipoDiferencia === 'exacto' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle size={18} className="shrink-0" />
              )}
              <span className="font-black">
                {cierre.tipoDiferencia === 'exacto' ? 'Caja Cuadrada Exacta' : (cierre.tipoDiferencia === 'sobrante' ? 'Sobrante' : 'Faltante')}
              </span>
            </div>
            <span className="font-black text-base">
              {cierre.tipoDiferencia === 'exacto' ? '$0' : `${cierre.diferencia > 0 ? '+' : '-'}$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}`}
            </span>
          </div>

          {/* RECAUDO DIGITAL SI EXISTE */}
          {cierre.totalVentasDigitales > 0 && (
            <div className="bg-slate-50 dark:bg-[#090d16] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-200 dark:border-slate-800">
                <span>📱 Recaudo Digital (Bancos):</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">${cierre.totalVentasDigitales.toLocaleString('es-CO')}</span>
              </div>
              {cierre.desgloseDigitales?.nequi ? <div className="flex justify-between"><span>Nequi:</span><span className="font-bold">${cierre.desgloseDigitales.nequi.toLocaleString('es-CO')}</span></div> : null}
              {cierre.desgloseDigitales?.daviplata ? <div className="flex justify-between"><span>Daviplata:</span><span className="font-bold">${cierre.desgloseDigitales.daviplata.toLocaleString('es-CO')}</span></div> : null}
              {cierre.desgloseDigitales?.datafono ? <div className="flex justify-between"><span>Datáfono / Tarjetas:</span><span className="font-bold">${cierre.desgloseDigitales.datafono.toLocaleString('es-CO')}</span></div> : null}
              {cierre.desgloseDigitales?.bancolombia ? <div className="flex justify-between"><span>Bancolombia:</span><span className="font-bold">${cierre.desgloseDigitales.bancolombia.toLocaleString('es-CO')}</span></div> : null}
              {cierre.desgloseDigitales?.transferencia ? <div className="flex justify-between"><span>Transferencias:</span><span className="font-bold">${cierre.desgloseDigitales.transferencia.toLocaleString('es-CO')}</span></div> : null}
            </div>
          )}

          {/* TOTAL RECAUDADO GENERAL */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-200 dark:border-indigo-800/40 flex justify-between items-center">
            <div>
              <span className="font-black text-xs text-indigo-700 dark:text-indigo-300 block uppercase">
                Total Recaudado en el Turno
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Efectivo contado + Digitales - Egresos</span>
            </div>
            <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">
              ${cierre.totalRecaudadoGeneral.toLocaleString('es-CO')}
            </span>
          </div>

          {/* NOTAS */}
          {cierre.notas && (
            <div className="p-3 bg-slate-50 dark:bg-[#1e293b]/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold block text-slate-500 text-[10px] uppercase">Observaciones:</span>
              <p className="mt-0.5">{cierre.notas}</p>
            </div>
          )}

          {/* BOTONES */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={compartirWhatsApp}
              className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Send size={15} /> Compartir WhatsApp
            </button>
            <button
              type="button"
              onClick={imprimirTicket}
              className="py-3 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Printer size={15} /> Imprimir Ticket
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
