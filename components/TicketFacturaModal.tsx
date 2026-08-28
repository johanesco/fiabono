"use client";
import React, { useRef } from "react";
import { X, Printer, CheckCircle2, Receipt, Store, Phone, User, Calendar, Clock } from "lucide-react";

export interface DetalleFacturaItem {
  descripcion: string;
  cantidad: number;
  valorUnitario?: number;
  valor: number;
}

export interface DatosFacturaProps {
  nombreNegocio: string;
  telefonoNegocio?: string;
  correoNegocio?: string;
  logoNegocio?: string | null;
  nitNegocio?: string;
  direccionNegocio?: string;
  mensajePieTicket?: string;
  nombreCliente: string;
  celularCliente?: string;
  registradoPor?: string;
  fecha?: any;
  tipo: 'venta' | 'fiado' | 'abono' | 'separe' | 'abono_separe' | 'egreso' | 'entrega_separe';
  detalles?: DetalleFacturaItem[];
  descripcionGeneral?: string;
  montoTotal: number;
  pagoRecibido?: number;
  devuelta?: number;
  saldoAnterior?: number;
  saldoNuevo?: number;
  idTransaccion?: string;
  metodoPago?: 'efectivo' | 'transferencia' | 'datafono' | 'credito_externo' | 'fiado' | string;
  referenciaPago?: string;
  subtotal?: number;
  valorIva?: number;
  porcentajeIva?: number;
  montoBruto?: number;
  descuentoTipo?: 'porcentaje' | 'fijo' | null;
  descuentoValor?: number;
  montoDescuento?: number;
}

interface TicketFacturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  datos: DatosFacturaProps | null;
}

export default function TicketFacturaModal({ isOpen, onClose, datos }: TicketFacturaModalProps) {
  const ticketRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !datos) return null;

  const formatearFecha = (f: any) => {
    if (!f) return new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (f.toDate && typeof f.toDate === 'function') {
      return f.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (f instanceof Date) {
      return f.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatearHora = (f: any) => {
    if (!f) return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (f.toDate && typeof f.toDate === 'function') {
      return f.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (f instanceof Date) {
      return f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const manejarImprimir = () => {
    window.print();
  };

  const getTituloTipo = () => {
    if (datos.tipo === 'venta') return 'COMPROBANTE DE VENTA';
    if (datos.tipo === 'fiado') return 'COMPROBANTE DE FIADO';
    if (datos.tipo === 'abono') return 'COMPROBANTE DE ABONO';
    if (datos.tipo === 'separe') return 'COMPROBANTE DE PLAN SEPARE';
    if (datos.tipo === 'abono_separe') return 'ABONO A PLAN SEPARE';
    if (datos.tipo === 'entrega_separe') return 'ENTREGA DE PLAN SEPARE';
    if (datos.tipo === 'egreso') return 'COMPROBANTE DE EGRESO / DEVOLUCIÓN';
    return 'COMPROBANTE DE CAJA';
  };

  return (
    <>
      {/* ESTILOS DE IMPRESIÓN EXCLUSIVOS PARA IMPRESORAS POS / TÉRMICAS (80mm / 58mm) */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #seccion-ticket-impresion, #seccion-ticket-impresion * {
            visibility: visible !important;
          }
          #seccion-ticket-impresion {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            margin: 0;
            size: 80mm auto;
          }
        }
      `}</style>

      {/* MODAL EN PANTALLA */}
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[9999] animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#0f172a] rounded-3xl sm:rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col h-[80dvh] sm:h-auto sm:max-h-[86dvh] overflow-hidden my-auto">
          
          {/* HEADER DEL MODAL */}
          <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
                <Receipt size={18} className="sm:w-5 sm:h-5" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">Vista Previa de Factura / Ticket</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* CONTENIDO SCROLLEABLE - TICKET TÉRMICO */}
          <div className="p-2 sm:p-6 overflow-y-auto flex-1 bg-slate-100/80 dark:bg-slate-950 flex flex-col items-center min-h-0">
            
            {/* CONTENEDOR DEL TICKET (Diseño tipo rollo térmico de 80mm) */}
            <div
              id="seccion-ticket-impresion"
              ref={ticketRef}
              className="w-full max-w-[340px] h-fit bg-white text-slate-900 p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-200 font-mono text-xs flex flex-col shrink-0 mx-auto my-2"
            >
              {/* ENCABEZADO NEGOCIO */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                {/* LOGO DEL NEGOCIO (SI ESTÁ CONFIGURADO) */}
                {datos.logoNegocio && (
                  <div className="flex justify-center mb-2.5">
                    <img 
                      src={datos.logoNegocio} 
                      alt="Logo Negocio" 
                      className="max-h-16 max-w-[140px] object-contain filter grayscale contrast-125"
                    />
                  </div>
                )}
                
                <h2 className="text-base font-black uppercase tracking-wider text-slate-900 leading-tight">
                  {datos.nombreNegocio || "MI NEGOCIO"}
                </h2>
                
                {datos.nitNegocio && (
                  <p className="text-[11px] font-bold text-slate-700 mt-0.5">
                    NIT / RUT: {datos.nitNegocio}
                  </p>
                )}
                
                {datos.direccionNegocio && (
                  <p className="text-[10.5px] text-slate-600 font-medium mt-0.5">
                    {datos.direccionNegocio}
                  </p>
                )}
                
                {datos.telefonoNegocio && (
                  <p className="text-[10.5px] text-slate-600 font-medium">
                    Tel / WhatsApp: {datos.telefonoNegocio}
                  </p>
                )}
                
                {datos.correoNegocio && (
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    {datos.correoNegocio}
                  </p>
                )}

                <div className="mt-2.5 inline-block bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-widest border border-slate-300">
                  {getTituloTipo()}
                </div>
              </div>

              {/* METADATOS DE LA FACTURA */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Fecha:</span>
                  <span className="font-bold text-slate-900">{formatearFecha(datos.fecha)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Hora:</span>
                  <span className="font-bold text-slate-900">{formatearHora(datos.fecha)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Cliente:</span>
                  <span className="font-black text-slate-900 truncate max-w-[180px] text-right">
                    {datos.nombreCliente || "Venta de Mostrador"}
                  </span>
                </div>
                {datos.celularCliente && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Tel. Cliente:</span>
                    <span className="font-bold text-slate-900">{datos.celularCliente}</span>
                  </div>
                )}
                {datos.registradoPor && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Atendido por:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[160px] text-right">
                      {datos.registradoPor}
                    </span>
                  </div>
                )}
                {datos.idTransaccion && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Ticket #:</span>
                    <span className="font-mono text-[10px] text-slate-700">
                      {datos.idTransaccion.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* LISTA DE ARTÍCULOS O DESCRIPCIÓN */}
              <div className="py-3 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-black text-[11px] text-slate-800 pb-1.5 border-b border-slate-200">
                  <span>CANT / DESCRIPCIÓN</span>
                  <span>TOTAL</span>
                </div>

                <div className="space-y-1.5 pt-2">
                  {datos.detalles && datos.detalles.length > 0 ? (
                    datos.detalles.map((item, idx) => {
                      const cant = item.cantidad || 1;
                      const vUnit = item.valorUnitario || item.valor || 0;
                      const vTotal = cant * vUnit;

                      return (
                        <div key={idx} className="flex justify-between items-start text-[11px] leading-tight">
                          <div className="flex-1 pr-2">
                            <p className="font-bold text-slate-900">{cant}x {item.descripcion || "Artículo"}</p>
                            {cant > 1 && (
                              <p className="text-[10px] text-slate-500">
                                @ ${vUnit.toLocaleString('es-CO')} c/u
                              </p>
                            )}
                          </div>
                          <span className="font-black text-slate-900 shrink-0">
                            ${vTotal.toLocaleString('es-CO')}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-800">
                        {datos.descripcionGeneral || (datos.tipo === 'abono' ? 'Abono a cuenta' : (datos.tipo === 'fiado' ? 'Fiado de mercancía' : 'Venta directa'))}
                      </span>
                      <span className="font-black text-slate-900">
                        ${(datos.montoTotal || 0).toLocaleString('es-CO')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* TOTALES Y PAGOS */}
              <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-[11px]">
                {/* Desglose de Descuento si aplica */}
                {datos.montoDescuento !== undefined && datos.montoDescuento > 0 && (
                  <>
                    {datos.montoBruto && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Subtotal Bruto:</span>
                        <span className="font-bold">${datos.montoBruto.toLocaleString('es-CO')}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-900 font-bold">
                      <span>Descuento {datos.descuentoTipo === 'porcentaje' ? `(${datos.descuentoValor}%)` : ''}:</span>
                      <span>-${datos.montoDescuento.toLocaleString('es-CO')}</span>
                    </div>
                  </>
                )}

                {/* Desglose de IVA si aplica */}
                {datos.subtotal !== undefined && datos.valorIva !== undefined && datos.valorIva > 0 && (
                  <>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Base gravable:</span>
                      <span className="font-bold">${datos.subtotal.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>IVA ({datos.porcentajeIva || 19}%):</span>
                      <span className="font-bold">${datos.valorIva.toLocaleString('es-CO')}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between items-center text-sm font-black pt-1">
                  <span className="uppercase text-slate-900">TOTAL:</span>
                  <span className="text-base text-slate-900">
                    ${(datos.montoTotal || 0).toLocaleString('es-CO')}
                  </span>
                </div>

                {/* MÉTODO DE PAGO */}
                {datos.metodoPago && (
                  <div className="flex justify-between items-center text-slate-700 pt-1">
                    <span className="font-bold">Forma de Pago:</span>
                    <span className="font-black uppercase text-slate-900">
                      {datos.metodoPago === 'transferencia' && 'Transferencia / Nequi'}
                      {datos.metodoPago === 'datafono' && 'Datáfono / Tarjeta'}
                      {datos.metodoPago === 'credito_externo' && 'Crédito Addi / Sistecrédito'}
                      {datos.metodoPago === 'efectivo' && 'Efectivo'}
                      {datos.metodoPago === 'fiado' && 'Crédito Directo (Fiado)'}
                    </span>
                  </div>
                )}

                {/* REFERENCIA DE COMPROBANTE */}
                {datos.referenciaPago && (
                  <div className="flex justify-between items-center text-slate-600 text-[10px]">
                    <span className="font-medium">Ref. / Aprobación:</span>
                    <span className="font-mono font-bold text-slate-800">#{datos.referenciaPago}</span>
                  </div>
                )}

                {datos.pagoRecibido !== undefined && datos.pagoRecibido > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-bold">Monto Recibido:</span>
                    <span className="font-bold">${datos.pagoRecibido.toLocaleString('es-CO')}</span>
                  </div>
                )}

                {datos.devuelta !== undefined && datos.devuelta > 0 && (
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-bold">Cambio / Devuelta:</span>
                    <span className="font-black text-emerald-600">${datos.devuelta.toLocaleString('es-CO')}</span>
                  </div>
                )}

                {/* ESTADO DE CUENTA RESULTANTE (SI CORRESPONDE A CLIENTE REGISTRADO) */}
                {datos.saldoNuevo !== undefined && datos.nombreCliente !== "Venta de Mostrador" && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-600">Saldo en Cuenta:</span>
                      <span className={`font-black ${
                        datos.saldoNuevo === 0
                          ? 'text-slate-500'
                          : (datos.saldoNuevo < 0 ? 'text-emerald-600' : 'text-rose-600')
                      }`}>
                        {datos.saldoNuevo === 0
                          ? '$0 (Al día)'
                          : (datos.saldoNuevo < 0
                              ? `A favor: $${Math.abs(datos.saldoNuevo).toLocaleString('es-CO')}`
                              : `Pendiente: $${datos.saldoNuevo.toLocaleString('es-CO')}`
                            )
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PIE DEL TICKET */}
              <div className="pt-3 text-center text-[10px] text-slate-500 space-y-1">
                <p className="font-black text-slate-800 uppercase">
                  {datos.mensajePieTicket || "¡GRACIAS POR SU COMPRA!"}
                </p>
                <p className="text-[9px] text-slate-600">Conserve este comprobante para cualquier aclaración.</p>
                <p className="text-[8px] text-slate-400 font-sans mt-2">Generado por Fiabono.com</p>
              </div>

            </div>

          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] flex gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 sm:py-3.5 px-3 sm:px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl sm:rounded-2xl transition-colors text-xs sm:text-sm text-center cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={manejarImprimir}
              className="flex-1 py-2.5 sm:py-3.5 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl sm:rounded-2xl shadow-md sm:shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 sm:gap-2 transition-transform transform active:scale-95 text-xs sm:text-sm text-center cursor-pointer"
            >
              <Printer size={16} className="shrink-0" /> <span className="truncate">Imprimir Factura</span>
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

