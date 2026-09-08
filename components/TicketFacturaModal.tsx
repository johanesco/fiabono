"use client";
import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Receipt, Crown, MessageCircle, Download, Share2, Loader2, FileText } from "lucide-react";
import { toBlob, toPng } from "html-to-image";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/AuthContext";
import ModalUpsellSuscripcion from "./ModalUpsellSuscripcion";
import VistaTicketCard from "./VistaTicketCard";

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
  subMetodoPago?: string;
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
    const nombreNegocio = datos.nombreNegocio || "nuestra tienda";
    const nombreCliente = datos.nombreCliente && datos.nombreCliente !== "Venta de Mostrador" ? datos.nombreCliente : "Cliente";

    let enlaceTexto = "";
    if (datos.idTransaccion && typeof window !== 'undefined') {
      enlaceTexto = `\n\n🔗 *Ver o descargar comprobante digital:*\n${window.location.origin}/t/${datos.idTransaccion}`;
    }

    // Detalle simplificado de productos
    let detalleTexto = "";
    if (datos.detalles && datos.detalles.length > 0) {
      datos.detalles.forEach(item => {
        const cant = item.cantidad || 1;
        const vUnit = item.valorUnitario || (cant > 0 ? (item.valor || 0) / cant : item.valor || 0);
        const vTotal = item.valor || (cant * vUnit);
        detalleTexto += `• ${cant}x ${item.descripcion || "Artículo"}\n  Precio unitario: *$${vUnit.toLocaleString('es-CO')}*\n  Total: *$${vTotal.toLocaleString('es-CO')}*\n\n`;
      });
    } else if (datos.descripcionGeneral) {
      detalleTexto = `• ${datos.descripcionGeneral}\n\n`;
    }

    if (datos.montoDescuento && datos.montoDescuento > 0) {
      detalleTexto += `*Descuento:* -$${datos.montoDescuento.toLocaleString('es-CO')}\n`;
    }

    if (datos.tipo === 'fiado') {
      const saldoTotalStr = datos.saldoNuevo !== undefined ? `\n*Saldo de crédito Total: $${datos.saldoNuevo.toLocaleString('es-CO')}*` : "";
      return `¡Hola, *${nombreCliente}*! Gracias por tu confianza en *${nombreNegocio}*.

===================
*DETALLE DEL CRÉDITO*
===================

${detalleTexto.trim()}
*TOTAL DE ESTE FIADO: $${(datos.montoTotal || 0).toLocaleString('es-CO')}*${saldoTotalStr}${enlaceTexto}

Gracias por confiar en nosotros.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;
    }

    if (datos.tipo === 'abono') {
      const saldoFormat = datos.saldoNuevo !== undefined 
        ? (datos.saldoNuevo < 0 ? `$${Math.abs(datos.saldoNuevo).toLocaleString('es-CO')} a favor` : `$${datos.saldoNuevo.toLocaleString('es-CO')}`)
        : "";
      const metodos: Record<string, string> = {
        efectivo: 'EFECTIVO',
        transferencia: 'TRANSFERENCIA',
        datafono: 'DATÁFONO',
        credito_externo: 'CRÉDITO'
      };
      const metodoStr = datos.metodoPago ? (metodos[datos.metodoPago] || datos.metodoPago.toUpperCase()) : "EFECTIVO";

      return `¡Hola, *${nombreCliente}*! Gracias por tu abono en *${nombreNegocio}*.

===================
*COMPROBANTE DE ABONO*
===================

• Abono recibido: *$${(datos.montoTotal || 0).toLocaleString('es-CO')}*
• Método: *${metodoStr}*${saldoFormat ? `\n• Saldo actual en cuenta: *${saldoFormat}*` : ""}${enlaceTexto}

Gracias por tu abono y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;
    }

    if (datos.tipo === 'separe') {
      const abonoInicial = datos.pagoRecibido || 0;
      const saldoPend = datos.saldoNuevo !== undefined ? datos.saldoNuevo : Math.max((datos.montoTotal || 0) - abonoInicial, 0);
      return `¡Hola, *${nombreCliente}*! Gracias por separar con nosotros en *${nombreNegocio}*.

===================
*PLAN SEPARE REGISTRADO*
===================

${detalleTexto.trim()}
*TOTAL SEPARE: $${(datos.montoTotal || 0).toLocaleString('es-CO')}*
• Abono inicial: *$${abonoInicial.toLocaleString('es-CO')}*
• Saldo pendiente: *$${saldoPend.toLocaleString('es-CO')}*${enlaceTexto}

Gracias por tu confianza.
Estamos atentos para cualquier consulta.

*¡Te esperamos pronto!*`;
    }

    if (datos.tipo === 'abono_separe') {
      const saldoPend = datos.saldoNuevo !== undefined ? datos.saldoNuevo : 0;
      const metodos: Record<string, string> = {
        efectivo: 'EFECTIVO',
        transferencia: 'TRANSFERENCIA',
        datafono: 'DATÁFONO',
        credito_externo: 'CRÉDITO'
      };
      const metodoStr = datos.metodoPago ? (metodos[datos.metodoPago] || datos.metodoPago.toUpperCase()) : "EFECTIVO";

      return `¡Hola, *${nombreCliente}*! Gracias por tu abono en *${nombreNegocio}*.

===================
*ABONO A PLAN SEPARE*
===================

• Abono recibido: *$${(datos.montoTotal || 0).toLocaleString('es-CO')}*
• Método: *${metodoStr}*
• Saldo restante: *$${saldoPend.toLocaleString('es-CO')}*${enlaceTexto}

Gracias por tu abono y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;
    }

    if (datos.tipo === 'entrega_separe') {
      return `¡Hola, *${nombreCliente}*! Tus productos han sido pagados en su totalidad en *${nombreNegocio}*.

===================
*ENTREGA DE PLAN SEPARE*
===================

${detalleTexto.trim()}
*TOTAL CANCELADO: $${(datos.montoTotal || 0).toLocaleString('es-CO')}*
✅ Estado: Completamente pagado y entregado${enlaceTexto}

¡Gracias por tu preferencia!
Estamos atentos para cualquier consulta.

*¡Te esperamos pronto!*`;
    }

    if (datos.tipo === 'egreso') {
      return `¡Hola, *${nombreCliente}*! Comprobante de egreso o devolución en *${nombreNegocio}*.

===================
*COMPROBANTE DE DEVOLUCIÓN*
===================

${detalleTexto.trim()}
*TOTAL DEVUELTO: $${(datos.montoTotal || 0).toLocaleString('es-CO')}*${enlaceTexto}

Estamos atentos para cualquier consulta.`;
    }

    // Por defecto: COMPROBANTE DE VENTA
    let infoExtra = "";
    if (datos.devuelta && datos.devuelta > 0) {
      infoExtra = `\n*Entregaste:* $${(datos.pagoRecibido || 0).toLocaleString('es-CO')}\n*Devuelta:* $${datos.devuelta.toLocaleString('es-CO')}*`;
    } else {
      infoExtra = '\n*Pago completo.*';
    }

    return `¡Hola, *${nombreCliente}*! Gracias por tu compra en *${nombreNegocio}*.

===================
*COMPROBANTE DE VENTA*
===================

${detalleTexto.trim()}
*TOTAL: $${(datos.montoTotal || 0).toLocaleString('es-CO')}*
${infoExtra.trim()}${enlaceTexto}

Gracias por tu compra.
Estamos atentos para cualquier consulta.

*¡Te esperamos pronto!*`;
  };

  const celClienteRaw = (datos.celularCliente || '').toString().replace(/\D/g, '');
  const tieneCelularValido = celClienteRaw.length >= 7;
  const celClienteLimpio = celClienteRaw.startsWith('57') && celClienteRaw.length > 10 ? celClienteRaw : (celClienteRaw ? `57${celClienteRaw}` : '');

  const compartirPorWhatsApp = () => {
    if (!tieneCelularValido) return;
    const texto = generarTextoTicketWhatsApp();
    const url = `https://wa.me/${celClienteLimpio}?text=${encodeURIComponent(texto)}`;

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const capturarBlobTicket = async (): Promise<Blob | null> => {
    if (!ticketRef.current) return null;
    const node = ticketRef.current;
    const rect = node.getBoundingClientRect();
    const anchoReal = Math.max(Math.ceil(rect.width || 0), node.scrollWidth, 360);
    const altoReal = Math.max(Math.ceil(rect.height || 0), node.scrollHeight);

    return await toBlob(node, {
      width: anchoReal,
      height: altoReal,
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
      style: {
        margin: '0px',
        marginLeft: '0px',
        marginRight: '0px',
        marginTop: '0px',
        marginBottom: '0px',
        transform: 'none',
        left: '0px',
        top: '0px',
        maxWidth: 'none',
        width: `${anchoReal}px`,
        boxSizing: 'border-box',
      }
    });
  };

  const manejarEnviarImagenWhatsApp = async () => {
    if (!ticketRef.current || generandoImagen) return;
    setGenerandoImagen(true);
    const toastId = toast.loading("Preparando foto para WhatsApp...");

    try {
      const blob = await capturarBlobTicket();
      if (!blob) throw new Error("No se pudo generar la imagen");

      const nombreArchivo = `Ticket-${datos.idTransaccion ? datos.idTransaccion.slice(0, 8).toUpperCase() : Date.now()}.png`;
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' });

      // En móviles (Android / iOS): abre la bandeja nativa con la foto adjunta lista para enviar a WhatsApp
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [archivo] })) {
        toast.dismiss(toastId);
        await navigator.share({
          files: [archivo],
          title: `Factura ${datos.nombreNegocio}`,
          text: `Comprobante de compra de ${datos.nombreNegocio}`
        });
        toast.success("¡Foto lista para enviar!");
      } else {
        // En computador: Copia la imagen al portapapeles + descarga el archivo + abre WhatsApp Web
        let copiado = false;
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            copiado = true;
          }
        } catch (clipErr) {
          console.log("No se pudo copiar al portapapeles:", clipErr);
        }

        // Descarga de soporte
        const urlDescarga = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = urlDescarga;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(urlDescarga);

        // Abrir WhatsApp Web con el contacto si existe
        const celRaw = (datos.celularCliente || '').toString().replace(/\D/g, '');
        const celLimpio = celRaw.startsWith('57') && celRaw.length > 10 ? celRaw : (celRaw ? `57${celRaw}` : '');
        const waUrl = celLimpio
          ? `https://web.whatsapp.com/send?phone=${celLimpio}`
          : `https://web.whatsapp.com/`;

        if (typeof window !== 'undefined') {
          window.open(waUrl, '_blank');
        }

        toast.dismiss(toastId);
        if (copiado) {
          toast.success("📸 ¡Foto copiada! En WhatsApp Web solo presiona Ctrl + V para pegarla.", { duration: 6000 });
        } else {
          toast.success("📸 Imagen descargada. Puedes arrastrarla a WhatsApp Web.", { duration: 6000 });
        }
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      if (error?.name !== 'AbortError') {
        console.error("Error al preparar imagen para WhatsApp:", error);
        toast.error("No se pudo enviar la imagen. Puedes usar la opción de texto o descargarla.");
      }
    } finally {
      setGenerandoImagen(false);
    }
  };

  const manejarDescargarImagenDirecta = async () => {
    if (!ticketRef.current || generandoImagen) return;
    setGenerandoImagen(true);
    const toastId = toast.loading("Preparando descarga...");

    try {
      const blob = await capturarBlobTicket();
      if (!blob) throw new Error("No se pudo generar la imagen");

      const nombreArchivo = `Ticket-${datos.idTransaccion ? datos.idTransaccion.slice(0, 8).toUpperCase() : Date.now()}.png`;
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' });

      const esIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

      // En iOS Safari, las descargas automáticas por enlace están bloqueadas por el navegador.
      // La única vía oficial para guardar en Fotos de iPhone es la opción nativa "Guardar imagen".
      if (esIOS && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [archivo] })) {
        toast.dismiss(toastId);
        await navigator.share({
          files: [archivo],
          title: `Guardar ${nombreArchivo}`,
        });
        toast.success("¡Selecciona 'Guardar imagen' para tenerla en tus Fotos!");
        return;
      }

      // En Android y Computadores: Descarga mediante Blob URL sin bloqueos
      const urlDescarga = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = urlDescarga;
      enlace.download = nombreArchivo;
      enlace.style.display = 'none';
      document.body.appendChild(enlace);
      enlace.click();

      setTimeout(() => {
        if (document.body.contains(enlace)) {
          document.body.removeChild(enlace);
        }
        URL.revokeObjectURL(urlDescarga);
      }, 3000);

      toast.dismiss(toastId);
      toast.success("¡Ticket descargado en imagen PNG!");
    } catch (error: any) {
      toast.dismiss(toastId);
      if (error?.name !== 'AbortError') {
        console.error("Error al descargar imagen:", error);
        toast.error("Error al descargar la imagen.");
      }
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
            <VistaTicketCard datos={datos} ticketRef={ticketRef} />
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="ticket-print-hide p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f172a] flex flex-col sm:flex-row gap-2 sm:gap-2.5 shrink-0">
            
            {/* VISTA MÓVIL: ORGANIZADA SEGÚN SI TIENE NÚMERO O NO */}
            <div className="sm:hidden flex flex-col gap-2 w-full">
              {/* Fila 1 en móvil: WhatsApp (solo si el cliente tiene número guardado) */}
              {tieneCelularValido && (
                <button
                  type="button"
                  onClick={compartirPorWhatsApp}
                  className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-xl shadow-xs flex items-center justify-center gap-2 transition active:scale-95 text-xs text-center cursor-pointer"
                  title="Enviar comprobante directo al chat de WhatsApp del cliente"
                >
                  <MessageCircle size={16} className="shrink-0 fill-white/20" />
                  <span className="truncate">
                    Enviar a WhatsApp 💬
                  </span>
                </button>
              )}

              {/* Fila en móvil: Cerrar, Guardar en galería e Imprimir */}
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs text-center cursor-pointer"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  disabled={generandoImagen}
                  onClick={manejarDescargarImagenDirecta}
                  className="flex-1 py-2.5 px-2 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs text-center cursor-pointer disabled:opacity-60"
                  title="Descargar imagen en la galería"
                >
                  <Download size={14} />
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
                  className="flex-1 py-2.5 px-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 text-xs text-center cursor-pointer"
                  title="Imprimir en impresora térmica"
                >
                  <Printer size={14} />
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
                {tieneCelularValido && (
                  <button
                    type="button"
                    onClick={compartirPorWhatsApp}
                    className="py-2.5 px-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer"
                    title="Enviar comprobante al chat de WhatsApp del cliente"
                  >
                    <MessageCircle size={15} className="shrink-0 fill-white/20" />
                    <span>Enviar a WhatsApp</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={generandoImagen}
                  onClick={manejarDescargarImagenDirecta}
                  className="py-2.5 px-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 text-xs text-center cursor-pointer disabled:opacity-60"
                  title="Descargar imagen PNG completa del tíquet térmico"
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
