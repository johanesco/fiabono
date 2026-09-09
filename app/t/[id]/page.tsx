"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { DatosFacturaProps } from "@/components/TicketFacturaModal";
import VistaTicketCard from "@/components/VistaTicketCard";
import { Download, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { toBlob } from "html-to-image";
import toast from "react-hot-toast";

export default function PaginaTicketPublico() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const ticketRef = useRef<HTMLDivElement>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datosFactura, setDatosFactura] = useState<DatosFacturaProps | null>(null);
  const [generandoDescarga, setGenerandoDescarga] = useState(false);

  useEffect(() => {
    if (!id) return;

    const cargarTicket = async () => {
      setCargando(true);
      setError(null);

      try {
        // 1. Intentar consultar en colección 'movimientos'
        const docRefMov = doc(db, "movimientos", id);
        const snapMov = await getDoc(docRefMov);

        if (snapMov.exists()) {
          const movData = snapMov.data();
          const datosNegocio = await obtenerDatosNegocio(movData.usuarioId);

          setDatosFactura({
            ...datosNegocio,
            idTransaccion: snapMov.id,
            tipo: movData.tipo || 'venta',
            fecha: movData.fecha,
            nombreCliente: movData.clienteNombre || "Venta de Mostrador",
            celularCliente: movData.clienteCelular || "",
            registradoPor: movData.registradoPor || "",
            montoTotal: movData.monto || 0,
            detalles: movData.detalles || [],
            descripcionGeneral: movData.descripcion || "",
            metodoPago: movData.metodoPago,
            subMetodoPago: movData.subMetodoPago,
            referenciaPago: movData.referenciaPago,
            pagoRecibido: movData.pagoRecibido,
            devuelta: movData.devuelta,
            saldoNuevo: movData.saldoResultante,
            subtotal: movData.subtotal,
            valorIva: movData.valorIva,
            porcentajeIva: movData.porcentajeIva,
            descuentoTipo: movData.descuentoTipo,
            descuentoValor: movData.descuentoValor,
            montoDescuento: movData.montoDescuento,
          });
          setCargando(false);
          return;
        }

        // 2. Si no está en movimientos, intentar en colección 'separes'
        const docRefSep = doc(db, "separes", id);
        const snapSep = await getDoc(docRefSep);

        if (snapSep.exists()) {
          const sepData = snapSep.data();
          const datosNegocio = await obtenerDatosNegocio(sepData.usuarioId);

          const itemsTransformados = (sepData.items || []).map((it: any) => ({
            descripcion: it.descripcion,
            cantidad: it.cantidad || 1,
            valorUnitario: parseFloat(it.valor) || 0,
            valor: (parseFloat(it.valor) || 0) * (it.cantidad || 1)
          }));

          setDatosFactura({
            ...datosNegocio,
            idTransaccion: snapSep.id,
            tipo: 'separe',
            fecha: sepData.fechaCreacion,
            nombreCliente: sepData.clienteNombre || "",
            celularCliente: sepData.clienteCelular || "",
            registradoPor: sepData.creadoPor || "",
            montoTotal: sepData.total || 0,
            detalles: itemsTransformados,
            descripcionGeneral: sepData.notas || "",
            montoDescuento: sepData.montoDescuento || 0,
            saldoNuevo: sepData.saldoPendiente,
            pagoRecibido: sepData.montoPagado || 0,
          });
          setCargando(false);
          return;
        }

        setError("El comprobante solicitado no fue encontrado o el enlace es inválido.");
      } catch (err: any) {
        console.error("Error al cargar comprobante:", err);
        setError("Ocurrió un error al cargar el comprobante. Intenta recargar la página.");
      } finally {
        setCargando(false);
      }
    };

    cargarTicket();
  }, [id]);

  useEffect(() => {
    // Desactivar scrollRestoration automático del navegador para evitar que abra a mitad de página
    if (typeof window !== 'undefined') {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    if (datosFactura && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      const timer = setTimeout(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 50);

      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });

      return () => clearTimeout(timer);
    }
  }, [datosFactura]);

  const obtenerDatosNegocio = async (usuarioId: string): Promise<{
    nombreNegocio: string;
    telefonoNegocio?: string;
    correoNegocio?: string;
    logoNegocio?: string | null;
    nitNegocio?: string;
    direccionNegocio?: string;
    mensajePieTicket?: string;
  }> => {
    try {
      if (usuarioId) {
        const docUser = await getDoc(doc(db, "usuarios", usuarioId));
        if (docUser.exists()) {
          const u = docUser.data();
          return {
            nombreNegocio: u.nombreNegocio || "Mi Negocio",
            telefonoNegocio: u.telefonoNegocio || "",
            correoNegocio: u.email || "",
            logoNegocio: u.logoNegocio || null,
            nitNegocio: u.nitNegocio || "",
            direccionNegocio: u.direccionNegocio || "",
            mensajePieTicket: u.mensajePieTicket || "¡Gracias por su compra!",
          };
        }
      }
    } catch (e) {
      console.error("Error al cargar datos del negocio:", e);
    }
    return {
      nombreNegocio: "Comprobante de Venta",
      mensajePieTicket: "¡Gracias por su preferencia!"
    };
  };

  const descargarImagen = async () => {
    if (!ticketRef.current || generandoDescarga) return;
    setGenerandoDescarga(true);
    const toastId = toast.loading("Generando imagen para guardar...");

    try {
      const node = ticketRef.current;
      const rect = node.getBoundingClientRect();
      const anchoReal = Math.max(Math.ceil(rect.width || 0), node.scrollWidth, 360);
      const altoReal = Math.max(Math.ceil(rect.height || 0), node.scrollHeight);

      const blob = await toBlob(node, {
        width: anchoReal,
        height: altoReal,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          margin: '0px',
          transform: 'none',
          maxWidth: 'none',
          width: `${anchoReal}px`,
          boxSizing: 'border-box',
        }
      });

      if (!blob) throw new Error("No se pudo procesar la imagen");

      const nombreArchivo = `Comprobante-${id ? id.slice(0, 8).toUpperCase() : 'Fiabono'}.png`;
      const archivo = new File([blob], nombreArchivo, { type: 'image/png' });

      // En iOS: Usar navigator.share para permitir "Guardar imagen" directamente en el carrete
      const esIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (esIOS && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [archivo] })) {
        toast.dismiss(toastId);
        await navigator.share({
          files: [archivo],
          title: `Guardar ${nombreArchivo}`,
        });
        toast.success("¡Selecciona 'Guardar imagen' para guardarla en tus Fotos!");
        return;
      }

      // En Android y PC: Descarga directa de Blob URL
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
      toast.success("¡Comprobante guardado en imagen PNG!");
    } catch (err: any) {
      toast.dismiss(toastId);
      if (err?.name !== 'AbortError') {
        console.error("Error al descargar:", err);
        toast.error("No se pudo guardar la imagen.");
      }
    } finally {
      setGenerandoDescarga(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center px-2.5 pt-1 pb-4 sm:p-6 select-none font-sans">
      {/* HEADER DE LA PÁGINA PÚBLICA */}
      <header className="ticket-print-hide w-full max-w-[340px] sm:max-w-[380px] flex items-center justify-between py-1 mb-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
            F
          </div>
          <span className="font-black text-xs sm:text-sm tracking-tight text-slate-800 dark:text-slate-100">
            Fiabono
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9.5px] sm:text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
          <ShieldCheck size={12} />
          <span>Comprobante Verificado</span>
        </div>
      </header>

      {/* ESTADO DE CARGA */}
      {cargando && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
          <p className="font-bold text-xs text-slate-500">Cargando comprobante...</p>
        </div>
      )}

      {/* ESTADO DE ERROR */}
      {!cargando && error && (
        <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl border border-rose-100 dark:border-rose-950 text-center my-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={26} />
          </div>
          <h2 className="text-base font-black text-slate-900 dark:text-white mb-2">Comprobante no disponible</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
            {error}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs shadow-md"
          >
            <ArrowLeft size={14} />
            <span>Ir a Fiabono</span>
          </a>
        </div>
      )}

      {/* VISOR DEL TICKET */}
      {!cargando && datosFactura && (
        <main className="w-full max-w-[340px] sm:max-w-[380px] flex flex-col items-center">
          <div className="w-full flex justify-center">
            <VistaTicketCard datos={datosFactura} ticketRef={ticketRef} />
          </div>

          {/* BOTÓN DE ACCIÓN PARA EL CLIENTE */}
          <div className="ticket-print-hide w-full mt-2.5 sm:mt-4">
            <button
              type="button"
              disabled={generandoDescarga}
              onClick={descargarImagen}
              className="w-full py-2.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl sm:rounded-2xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 text-xs text-center cursor-pointer disabled:opacity-60"
            >
              {generandoDescarga ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Download size={15} className="shrink-0" />}
              <span>{generandoDescarga ? "Guardando imagen..." : "Guardar Comprobante"}</span>
            </button>
          </div>

          {/* PIE DE PÁGINA INFORMATIVO Y PROMOCIONAL */}
          <footer className="ticket-print-hide text-center py-3 text-slate-400 dark:text-slate-500 text-[10px] space-y-0.5">
            <p>Recibo digital emitido mediante Fiabono.</p>
            <p className="font-semibold text-slate-600 dark:text-slate-400">
              ¿Tienes un negocio? Administra tus ventas y fiados gratis en{" "}
              <a href="/" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                Fiabono.com
              </a>
            </p>
          </footer>
        </main>
      )}
    </div>
  );
}
