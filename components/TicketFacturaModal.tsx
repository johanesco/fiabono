"use client";
import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Receipt, Crown, MessageCircle, Download, Share2, Loader2 } from "lucide-react";
import { toBlob, toPng } from "html-to-image";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/AuthContext";
import ModalUpsellSuscripcion from "./ModalUpsellSuscripcion";

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
  const { datosSesion } = useAuth() || {};
  const ticketRef = useRef<HTMLDivElement>(null);
  const [modalUpsell, setModalUpsell] = useState(false);
  const [montado, setMontado] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

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
    try {
      window.print();
    } catch (e) {
      console.error("Error al invocar impresión:", e);
    }
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

  const generarTextoTicketWhatsApp = () => {
    const lineas: string[] = [];
    const nombreNegocio = datos.nombreNegocio || "MI NEGOCIO";
    const titulo = (() => {
      if (datos.tipo === 'venta') return '🧾 *COMPROBANTE DE VENTA*';
      if (datos.tipo === 'fiado') return '📋 *COMPROBANTE DE FIADO / CRÉDITO*';
      if (datos.tipo === 'abono') return '💵 *COMPROBANTE DE ABONO*';
      if (datos.tipo === 'separe') return '📦 *PLAN SEPARE REGISTRADO*';
      if (datos.tipo === 'abono_separe') return '💵 *ABONO A PLAN SEPARE*';
      if (datos.tipo === 'entrega_separe') return '🎉 *ENTREGA DE PLAN SEPARE*';
      if (datos.tipo === 'egreso') return '↩️ *COMPROBANTE DE DEVOLUCIÓN*';
      return '🧾 *COMPROBANTE DE CAJA*';
    })();

    lineas.push(titulo);
    lineas.push(`🏬 *${nombreNegocio.toUpperCase()}*`);
    if (datos.nitNegocio) lineas.push(`NIT/RUT: ${datos.nitNegocio}`);
    if (datos.direccionNegocio) lineas.push(`📍 ${datos.direccionNegocio}`);
    if (datos.telefonoNegocio) lineas.push(`📱 Tel: ${datos.telefonoNegocio}`);
    lineas.push(`────────────────────`);

    lineas.push(`📅 *Fecha:* ${formatearFecha(datos.fecha)} - ${formatearHora(datos.fecha)}`);
    lineas.push(`👤 *Cliente:* ${datos.nombreCliente || "Venta de Mostrador"}`);
    if (datos.registradoPor) lineas.push(`💼 *Atendido por:* ${datos.registradoPor}`);
    if (datos.idTransaccion) lineas.push(`🔢 *Ticket:* #${datos.idTransaccion.slice(0, 8).toUpperCase()}`);
    lineas.push(`────────────────────`);

    if (datos.detalles && datos.detalles.length > 0) {
      lineas.push(`🛍️ *DETALLE:*`);
      datos.detalles.forEach(item => {
        const cant = item.cantidad || 1;
        const vUnit = item.valorUnitario || (cant > 0 ? (item.valor || 0) / cant : item.valor || 0);
        const vTotal = item.valor || (cant * vUnit);
        lineas.push(`• *${cant}x* ${item.descripcion || "Artículo"}`);
        if (cant > 1 || item.valorUnitario) {
          lineas.push(`   $${vUnit.toLocaleString('es-CO')} c/u → *$${vTotal.toLocaleString('es-CO')}*`);
        } else {
          lineas.push(`   Subtotal: *$${vTotal.toLocaleString('es-CO')}*`);
        }
      });
    } else if (datos.descripcionGeneral) {
      lineas.push(`🛍️ *DETALLE:*`);
      lineas.push(datos.descripcionGeneral);
    }
    lineas.push(`────────────────────`);

    if (datos.montoDescuento && datos.montoDescuento > 0) {
      lineas.push(`🏷️ Descuento: -$${datos.montoDescuento.toLocaleString('es-CO')}`);
    }
    if (datos.valorIva && datos.valorIva > 0) {
      lineas.push(`🏛️ IVA (${datos.porcentajeIva || 19}%): $${datos.valorIva.toLocaleString('es-CO')}`);
    }
    lineas.push(`💰 *TOTAL:* *$${(datos.montoTotal || 0).toLocaleString('es-CO')}*`);

    if (datos.metodoPago) {
      const metodosTexto: Record<string, string> = {
        efectivo: 'Efectivo',
        transferencia: 'Transferencia / Nequi',
        datafono: 'Datáfono / Tarjeta',
        credito_externo: 'Crédito Addi / Sistecrédito',
        fiado: 'Crédito Directo (Fiado)'
      };
      lineas.push(`💳 *Forma de Pago:* ${metodosTexto[datos.metodoPago] || datos.metodoPago}`);
      if (datos.referenciaPago) lineas.push(`🔖 *Ref. Pago:* #${datos.referenciaPago}`);
    }

    if (datos.pagoRecibido !== undefined && datos.pagoRecibido > 0) {
      lineas.push(`💵 *Recibido:* $${datos.pagoRecibido.toLocaleString('es-CO')}`);
    }
    if (datos.devuelta !== undefined && datos.devuelta > 0) {
      lineas.push(`🪙 *Devuelta:* $${datos.devuelta.toLocaleString('es-CO')}`);
    }

    if (datos.saldoNuevo !== undefined && datos.nombreCliente !== "Venta de Mostrador") {
      lineas.push(`────────────────────`);
      if (datos.saldoNuevo === 0) {
        lineas.push(`✅ *Estado de Cuenta:* Al día ($0 pendiente)`);
      } else if (datos.saldoNuevo < 0) {
        lineas.push(`🟢 *Saldo a Favor:* $${Math.abs(datos.saldoNuevo).toLocaleString('es-CO')}`);
      } else {
        lineas.push(`⚠️ *Saldo Pendiente:* *$${datos.saldoNuevo.toLocaleString('es-CO')}*`);
      }
    }

    lineas.push(`────────────────────`);
    lineas.push(`${datos.mensajePieTicket || "¡Muchas gracias por su preferencia! 🙌"}`);

    return lineas.join('\n');
  };

  const compartirPorWhatsApp = () => {
    const texto = generarTextoTicketWhatsApp();
    const celRaw = (datos.celularCliente || '').toString().replace(/\D/g, '');
    const celLimpio = celRaw.startsWith('57') && celRaw.length > 10 ? celRaw : (celRaw ? `57${celRaw}` : '');
    const url = celLimpio
      ? `https://wa.me/${celLimpio}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const capturarBlobTicket = async (): Promise<Blob | null> => {
    if (!ticketRef.current) return null;
    return await toBlob(ticketRef.current, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
  };

  const manejarCompartirOdescargarImagen = async () => {
    if (!ticketRef.current || generandoImagen) return;
    setGenerandoImagen(true);
    const toastId = toast.loading("Generando imagen del ticket...");

    try {
      const blob = await capturarBlobTicket();
      if (!blob) throw new Error("No se pudo generar la imagen");

      const nombreArchivo = `Ticket-${datos.idTransaccion ? datos.idTransaccion.slice(0, 8).toUpperCase() : Date.now()}.png`;
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' });

      // Si el navegador soporta compartir archivos (dispositivos móviles Android / iOS)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [archivo] })) {
        toast.dismiss(toastId);
        await navigator.share({
          files: [archivo],
          title: `Factura ${datos.nombreNegocio}`,
          text: `Comprobante de compra de ${datos.nombreNegocio}`
        });
        toast.success("¡Comprobante compartido!");
      } else {
        // En computador o si no soporta compartir archivos, descargar directamente
        const urlDescarga = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = urlDescarga;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(urlDescarga);
        toast.dismiss(toastId);
        toast.success("¡Imagen del ticket descargada!");
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      if (error?.name !== 'AbortError') {
        console.error("Error compartiendo imagen del ticket:", error);
        toast.error("No se pudo compartir la imagen. Puedes descargarla o enviar el texto.");
      }
    } finally {
      setGenerandoImagen(false);
    }
  };

  const manejarDescargarImagenDirecta = async () => {
    if (!ticketRef.current || generandoImagen) return;
    setGenerandoImagen(true);
    const toastId = toast.loading("Preparando descarga de imagen...");

    try {
      const dataUrl = await toPng(ticketRef.current, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const nombreArchivo = `Ticket-${datos.idTransaccion ? datos.idTransaccion.slice(0, 8).toUpperCase() : Date.now()}.png`;
      const enlace = document.createElement('a');
      enlace.href = dataUrl;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      toast.dismiss(toastId);
      toast.success("¡Ticket descargado como imagen PNG!");
    } catch (error) {
      console.error("Error al descargar imagen:", error);
      toast.dismiss(toastId);
      toast.error("Error al descargar la imagen.");
    } finally {
      setGenerandoImagen(false);
    }
  };

  const contenidoModal = (
    <>
      {/* ESTILOS DE IMPRESIÓN EXCLUSIVOS PARA IMPRESORAS POS / TÉRMICAS (80mm / 58mm) */}
      <style jsx global>{`
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          body > * {
            display: none !important;
          }
          /* Mostrar únicamente el contenedor del modal donde reside el ticket */
          body > .ticket-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .ticket-print-portal > div {
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            position: static !important;
            height: auto !important;
            display: block !important;
          }
          .ticket-print-modal-card {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Ocultar header y footer del modal en la impresión */
          .ticket-print-hide {
            display: none !important;
          }
          #seccion-ticket-impresion {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 2mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            box-shadow: none !important;
            border: none !important;
          }
          #seccion-ticket-impresion * {
            visibility: visible !important;
          }
          @page {
            margin: 0;
            size: 80mm auto;
          }
        }
      `}</style>

      {/* MODAL EN PANTALLA (SIEMPRE EN PRIMER PLANO ABSOLUTO) */}
      <div className="ticket-print-portal fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[999999] animate-in fade-in duration-200">
        <div className="ticket-print-modal-card bg-white dark:bg-[#0f172a] rounded-3xl sm:rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col h-[80dvh] sm:h-auto sm:max-h-[86dvh] overflow-hidden my-auto">
          
          {/* HEADER DEL MODAL */}
          <div className="ticket-print-hide p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60 shrink-0">
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
                      crossOrigin="anonymous"
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
                <div className="flex justify-between font-black text-[10.5px] sm:text-[11px] text-slate-800 pb-1.5 border-b border-slate-200">
                  <span className="w-1/2">CANT / PRODUCTO</span>
                  <span className="w-1/4 text-right">VR. UNIT</span>
                  <span className="w-1/4 text-right">TOTAL</span>
                </div>

                <div className="space-y-1.5 pt-2">
                  {datos.detalles && datos.detalles.length > 0 ? (
                    datos.detalles.map((item, idx) => {
                      const cant = item.cantidad || 1;
                      const vUnit = item.valorUnitario || (cant > 0 ? (item.valor || 0) / cant : item.valor || 0);
                      const vTotal = item.valor || (cant * vUnit);

                      return (
                        <div key={idx} className="flex justify-between items-start text-[11px] leading-tight py-0.5">
                          <div className="w-1/2 pr-1">
                            <p className="font-bold text-slate-900">{cant}x {item.descripcion || "Artículo"}</p>
                          </div>
                          <span className="w-1/4 text-right text-slate-600 font-mono text-[10.5px]">
                            ${vUnit.toLocaleString('es-CO')}
                          </span>
                          <span className="w-1/4 text-right font-black text-slate-900 font-mono text-[11px] shrink-0">
                            ${vTotal.toLocaleString('es-CO')}
                          </span>
                        </div>
                      );
                    })
                  ) : (() => {
                    const desc = (datos.descripcionGeneral || '').trim();
                    const prefijoMatch = desc.match(/^(Saldo pendiente de venta|Saldo pendiente|Venta de|Venta|Fiado de|Fiado):\s*(.+)$/i);
                    const prefijoTexto = prefijoMatch ? prefijoMatch[1] : null;
                    const cuerpoItems = prefijoMatch ? prefijoMatch[2] : desc;
                    const partes = cuerpoItems.includes(',') ? cuerpoItems.split(',').map(s => s.trim()).filter(Boolean) : [];

                    if (partes.length > 1) {
                      return (
                        <div className="space-y-1.5">
                          {prefijoTexto && (
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-0.5">
                              {prefijoTexto}:
                            </p>
                          )}
                          {partes.map((p, idx) => {
                            const matchCant = p.match(/^(\d+)[xX]\s*(.+)$/);
                            const cant = matchCant ? parseInt(matchCant[1], 10) : 1;
                            const nombreArt = matchCant ? matchCant[2].trim() : p;
                            return (
                              <div key={idx} className="flex justify-between items-start text-[11px] leading-tight border-b border-dashed border-slate-100 last:border-none py-0.5">
                                <div className="w-1/2 pr-1">
                                  <p className="font-bold text-slate-900">{cant}x {nombreArt}</p>
                                </div>
                                <span className="w-1/4 text-right text-slate-400 font-mono text-[10px]">-</span>
                                <span className="w-1/4 text-right text-slate-400 font-mono text-[10px]">-</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="w-3/4 font-bold text-slate-800">
                          {datos.descripcionGeneral || (datos.tipo === 'abono' ? 'Abono a cuenta' : (datos.tipo === 'fiado' ? 'Fiado de mercancía' : 'Venta directa'))}
                        </span>
                        <span className="w-1/4 text-right font-black text-slate-900 font-mono">
                          ${(datos.montoTotal || 0).toLocaleString('es-CO')}
                        </span>
                      </div>
                    );
                  })()}
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

                {datos.pagoRecibido !== undefined && (
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
          <div className="ticket-print-hide p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] flex flex-col sm:flex-row gap-2 sm:gap-2.5 shrink-0">
            
            {/* VISTA MÓVIL: 2 FILAS ORGANIZADAS */}
            <div className="sm:hidden flex flex-col gap-2 w-full">
              {/* Fila 1 en móvil: WhatsApp (Texto e Imagen directa) */}
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={compartirPorWhatsApp}
                  className="flex-1 py-2.5 px-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer"
                  title={datos.celularCliente ? `Enviar al WhatsApp de ${datos.nombreCliente} (${datos.celularCliente})` : "Compartir por WhatsApp"}
                >
                  <MessageCircle size={15} className="shrink-0 fill-white/20" />
                  <span className="truncate">
                    {datos.celularCliente ? 'Enviar WhatsApp' : 'Texto WhatsApp'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={generandoImagen}
                  onClick={manejarCompartirOdescargarImagen}
                  className="flex-1 py-2.5 px-2.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer disabled:opacity-60"
                  title="Compartir tíquet como foto/imagen a WhatsApp"
                >
                  {generandoImagen ? (
                    <Loader2 size={15} className="animate-spin shrink-0" />
                  ) : (
                    <Share2 size={15} className="shrink-0" />
                  )}
                  <span className="truncate">
                    {generandoImagen ? 'Generando...' : 'Compartir Foto'}
                  </span>
                </button>
              </div>

              {/* Fila 2 en móvil: Cerrar, Descargar PNG e Imprimir */}
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs text-center cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  disabled={generandoImagen}
                  onClick={manejarDescargarImagenDirecta}
                  className="flex-1 py-2 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center justify-center gap-1 text-xs text-center cursor-pointer disabled:opacity-60"
                  title="Descargar imagen en la galería"
                >
                  <Download size={13} />
                  <span>Guardar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (datosSesion?.esGratis) {
                      setModalUpsell(true);
                      return;
                    }
                    manejarImprimir();
                  }}
                  className="flex-1 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-1 text-xs text-center cursor-pointer"
                  title="Imprimir en impresora térmica"
                >
                  <Printer size={13} />
                  <span>Imprimir</span>
                  {datosSesion?.esGratis && <Crown size={12} className="text-amber-300 shrink-0" />}
                </button>
              </div>
            </div>

            {/* VISTA ESCRITORIO: EN UNA SOLA FILA ELEGANTE */}
            <div className="hidden sm:flex items-center justify-between gap-2.5 w-full">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition text-xs text-center cursor-pointer"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={compartirPorWhatsApp}
                  className="py-2.5 px-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer"
                  title={datos.celularCliente ? `Enviar al WhatsApp de ${datos.nombreCliente} (${datos.celularCliente})` : "Compartir por WhatsApp"}
                >
                  <MessageCircle size={15} className="shrink-0 fill-white/20" />
                  <span>{datos.celularCliente ? 'Enviar WhatsApp' : 'WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  disabled={generandoImagen}
                  onClick={manejarDescargarImagenDirecta}
                  className="py-2.5 px-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer disabled:opacity-60"
                  title="Descargar imagen PNG del tíquet térmico"
                >
                  {generandoImagen ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Download size={15} className="shrink-0" />}
                  <span>Descargar Imagen</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (datosSesion?.esGratis) {
                      setModalUpsell(true);
                      return;
                    }
                    manejarImprimir();
                  }}
                  className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer"
                >
                  <Printer size={15} className="shrink-0" /> 
                  <span>{datosSesion?.esGratis ? 'Factura Imprimible' : 'Imprimir'}</span>
                  {datosSesion?.esGratis && <Crown size={12} className="text-amber-300 shrink-0" />}
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* MODAL UPSELL SI ESTÁ EN PLAN GRATIS */}
      <ModalUpsellSuscripcion
        visible={modalUpsell}
        titulo="Facturas Imprimibles en Plan Comercio"
        mensaje="Imprime facturas térmicas de 58mm y 80mm para tus ventas, abonos y separes mejorando al Plan Comercio o PRO Almacén."
        planRecomendado="comercio"
        onClose={() => setModalUpsell(false)}
      />
    </>
  );

  if (montado && typeof document !== "undefined") {
    return createPortal(contenidoModal, document.body);
  }

  return contenidoModal;
}
