"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs, increment, Timestamp 
} from "firebase/firestore";
import { db } from "../../../firebase";
import { 
  Bookmark, ArrowLeft, Search, Plus, X, ChevronRight, CheckCircle2, 
  MessageCircle, Printer, MoreVertical, Camera, AlertCircle, Banknote, 
  CreditCard, Smartphone, Zap, Clock, Calendar, ChevronDown, ChevronUp, 
  Trash2, User, Eye, Check, AlertTriangle, HelpCircle, FileText, RotateCcw, Package
} from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/AuthContext";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import { Separe, AbonoSepare } from "@/types";

export default function SeparesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando lista de separes...</div>}>
      <SeparesContenido />
    </Suspense>
  );
}

function SeparesContenido() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreUsuario = datosSesion?.nombreUsuario || "Vendedor";
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const esAdmin = datosSesion?.tipoUsuario === 'principal';
  const puedeVentaDirecta = esAdmin || (datosSesion?.puedeVentaDirecta === true);
  const puedeAbonar = esAdmin || (datosSesion?.permisos?.abonar === true);

  // Protección de acceso: si es colaborador sin permisos de dinero/abonos, redirigir a inicio
  useEffect(() => {
    if (datosSesion && !esAdmin && !puedeAbonar) {
      toast.error("No tienes permisos para administrar Planes Separe.");
      router.replace('/dashboard/inicio');
    }
  }, [datosSesion, esAdmin, puedeAbonar, router]);

  const [separes, setSepares] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState<'activos' | 'completados' | 'cancelados' | 'todos'>('activos');
  const [busqueda, setBusqueda] = useState("");

  // Modales
  const [separeSeleccionado, setSepareSeleccionado] = useState<any | null>(null);
  const [modalAbono, setModalAbono] = useState<boolean>(false);
  const [modalHistorial, setModalHistorial] = useState<boolean>(false);
  const [modalCompletar, setModalCompletar] = useState<boolean>(false);
  const [modalCancelar, setModalCancelar] = useState<boolean>(false);
  const [modalNotificacionCancelado, setModalNotificacionCancelado] = useState<{
    visible: boolean;
    clienteNombre: string;
    clienteCelular: string;
    montoDevuelto: number;
    motivo: string;
  } | null>(null);
  const [modalExitoAbono, setModalExitoAbono] = useState<{
    visible: boolean;
    separe: any;
    montoAbonado: number;
    nuevoSaldo: number;
    ticketDatos?: any;
  } | null>(null);
  const [modalExitoEntrega, setModalExitoEntrega] = useState<{
    visible: boolean;
    separe: any;
    ticketDatos?: any;
  } | null>(null);
  const [fotoLightbox, setFotoLightbox] = useState<string | null>(null);

  // Generadores de Sonidos Web Audio API
  const reproducirSonidoExito = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notas = [523.25, 659.25, 783.99]; // C5, E5, G5
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    } catch (e) {}
  };

  const reproducirSonidoCelebracion = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notas = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.35);
      });
    } catch (e) {}
  };

  const reproducirSonidoAlerta = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  };

  // Estados del Formulario de Abono
  const [montoAbono, setMontoAbono] = useState("");
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<'efectivo' | 'transferencia' | 'datafono' | 'credito_externo'>('efectivo');
  const [subMetodoAbono, setSubMetodoAbono] = useState("");
  const [referenciaAbono, setReferenciaAbono] = useState("");
  const [procesandoAbono, setProcesandoAbono] = useState(false);

  // Estados de Cancelación
  const [notaCancelacion, setNotaCancelacion] = useState("");
  const [procesandoCancelacion, setProcesandoCancelacion] = useState(false);

  // Modal Ticket / Factura
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: DatosFacturaProps | null }>({
    visible: false,
    datos: null
  });

  // Listener en tiempo real de separes
  useEffect(() => {
    if (!cuentaPrincipalId) return;

    const q = query(
      collection(db, "separes"),
      where("usuarioId", "==", cuentaPrincipalId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const lista: any[] = [];
      snapshot.forEach((docSnap) => {
        lista.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Ordenar: activos primero por fecha descendente, luego completados y cancelados
      lista.sort((a, b) => {
        const timeA = a.fechaCreacion?.toMillis ? a.fechaCreacion.toMillis() : 0;
        const timeB = b.fechaCreacion?.toMillis ? b.fechaCreacion.toMillis() : 0;
        return timeB - timeA;
      });

      setSepares(lista);
      setCargando(false);
    }, (error) => {
      console.error("Error cargando separes:", error);
      toast.error("Error al sincronizar separes");
      setCargando(false);
    });

    return () => unsub();
  }, [cuentaPrincipalId]);

  // Manejar query params (?tab=cancelados&busqueda=...)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const busquedaParam = searchParams.get('busqueda');
    if (tabParam === 'activos' || tabParam === 'completados' || tabParam === 'cancelados') {
      setTabActiva(tabParam);
    }
    if (busquedaParam) {
      setBusqueda(busquedaParam);
    }
  }, [searchParams]);

  // Contadores
  const countActivos = separes.filter(s => s.estado === 'activo').length;
  const countCompletados = separes.filter(s => s.estado === 'completado').length;
  const countCancelados = separes.filter(s => s.estado === 'cancelado').length;

  // Filtrado de separes
  const separesFiltrados = separes.filter((sep) => {
    if (tabActiva === 'activos' && sep.estado !== 'activo') return false;
    if (tabActiva === 'completados' && sep.estado !== 'completado') return false;
    if (tabActiva === 'cancelados' && sep.estado !== 'cancelado') return false;

    if (!busqueda.trim()) return true;

    const qLower = busqueda.toLowerCase();
    const clienteMatch = (sep.clienteNombre || "").toLowerCase().includes(qLower);
    const celularMatch = (sep.clienteCelular || "").toString().includes(qLower);
    const itemsMatch = (sep.items || []).some((it: any) => (it.descripcion || "").toLowerCase().includes(qLower));

    return clienteMatch || celularMatch || itemsMatch;
  });

  // Helpers de fecha y vencimiento
  const formatearFecha = (f: any) => {
    if (!f) return "Sin fecha";
    const date = f.toDate ? f.toDate() : (f instanceof Date ? f : new Date(f));
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getEstadoVencimiento = (sep: any) => {
    if (!sep.fechaLimite || sep.estado !== 'activo') return null;
    const limitDate = sep.fechaLimite.toDate ? sep.fechaLimite.toDate() : new Date(sep.fechaLimite);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limitClean = new Date(limitDate);
    limitClean.setHours(0, 0, 0, 0);

    const diffDays = Math.round((limitClean.getTime() - hoy.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return { tipo: 'vencido', texto: `Vencido hace ${Math.abs(diffDays)}d` };
    }
    if (diffDays === 0) {
      return { tipo: 'hoy', texto: '¡Vence hoy!' };
    }
    if (diffDays <= 5) {
      return { tipo: 'pronto', texto: `Vence en ${diffDays}d` };
    }
    return { tipo: 'normal', texto: `Vence: ${formatearFecha(sep.fechaLimite)}` };
  };

  const formatearMonedaInput = (valor: string) => {
    if (!valor) return "";
    const numeroStr = valor.replace(/\D/g, ''); 
    if (!numeroStr) return "";
    return parseInt(numeroStr, 10).toLocaleString('es-CO');
  };

  // Abrir Modal de Abono
  const abrirModalAbono = (sep: any) => {
    if (!esAdmin && !puedeAbonar) {
      toast.error("Tu usuario no tiene permisos para recibir abonos. Solicítalo al administrador.", { icon: "🔒" });
      return;
    }
    setSepareSeleccionado(sep);
    setMontoAbono("");
    setMetodoPagoAbono('efectivo');
    setSubMetodoAbono("");
    setReferenciaAbono("");
    setModalAbono(true);
  };

  // Registrar un Abono en Firestore
  const guardarAbono = async () => {
    if (!separeSeleccionado) return;
    const monto = Number(montoAbono.replace(/\D/g, ''));

    if (!monto || monto <= 0) {
      toast.error("Ingresa un monto válido mayor a 0", { icon: "⚠️" });
      return;
    }

    if (monto > (separeSeleccionado.saldoPendiente || 0)) {
      toast.error(`El abono no puede superar el saldo pendiente ($${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')})`, { icon: "⚠️" });
      return;
    }

    setProcesandoAbono(true);
    try {
      const nuevoAbono: any = {
        id: `abono_${Date.now()}`,
        monto,
        metodoPago: metodoPagoAbono,
        fecha: new Date(),
        registradoPor: nombreUsuario || "Vendedor"
      };
      if (subMetodoAbono.trim()) nuevoAbono.subMetodoPago = subMetodoAbono.trim();
      if (referenciaAbono.trim()) nuevoAbono.referenciaPago = referenciaAbono.trim();

      const abonosActuales = separeSeleccionado.abonos || [];
      const nuevoMontoPagado = (separeSeleccionado.montoPagado || 0) + monto;
      const nuevoSaldoPendiente = Math.max(0, (separeSeleccionado.total || 0) - nuevoMontoPagado);

      const separeRef = doc(db, "separes", separeSeleccionado.id);
      await updateDoc(separeRef, {
        abonos: [...abonosActuales, nuevoAbono],
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente
      });

      reproducirSonidoExito();
      toast.success(`Abono de $${monto.toLocaleString('es-CO')} registrado con éxito`);
      setModalAbono(false);

      const separeActualizado = {
        ...separeSeleccionado,
        abonos: [...abonosActuales, nuevoAbono],
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente
      };

      const ticketAbonoDatos: DatosFacturaProps = {
        nombreNegocio,
        telefonoNegocio: datosSesion?.telefonoNegocio || "",
        correoNegocio: datosSesion?.correoNegocio || "",
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || "",
        direccionNegocio: datosSesion?.direccionNegocio || "",
        mensajePieTicket: datosSesion?.mensajePieTicket || "Comprobante de Abono Plan Separe.",
        nombreCliente: separeActualizado.clienteNombre,
        celularCliente: separeActualizado.clienteCelular || "",
        registradoPor: nombreUsuario,
        fecha: new Date(),
        tipo: 'abono',
        detalles: (separeActualizado.items || []).map((it: any) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          valor: (Number(it.valor) || 0) * it.cantidad,
          valorUnitario: Number(it.valor) || 0
        })),
        descripcionGeneral: `Abono a Plan Separe: Monto abonado $${monto.toLocaleString('es-CO')} | Saldo restante $${nuevoSaldoPendiente.toLocaleString('es-CO')}`,
        montoTotal: monto,
        pagoRecibido: monto,
        saldoNuevo: nuevoSaldoPendiente,
        idTransaccion: separeActualizado.id,
        metodoPago: metodoPagoAbono,
        referenciaPago: referenciaAbono || undefined
      };

      // Si el saldo quedó en $0, ofrecer completar inmediatamente
      if (nuevoSaldoPendiente === 0) {
        setSepareSeleccionado(separeActualizado);
        setModalCompletar(true);
      } else {
        // Mostrar ventana de confirmación opcional de abono
        setModalExitoAbono({
          visible: true,
          separe: separeActualizado,
          montoAbonado: monto,
          nuevoSaldo: nuevoSaldoPendiente,
          ticketDatos: ticketAbonoDatos
        });
      }

    } catch (e) {
      console.error("Error al registrar abono:", e);
      toast.error("Error al registrar el abono");
    } finally {
      setProcesandoAbono(false);
    }
  };

  // Enviar comprobante de abono por WhatsApp (formato estructurado)
  const enviarWhatsAppAbono = (sep: any, montoAbonado: number, nuevoSaldo: number) => {
    let texto = `¡Hola, *${sep.clienteNombre}*! Gracias por tu abono en *${nombreNegocio || 'nuestra tienda'}*.

===================
*COMPROBANTE DE ABONO*
===================

• Abono recibido: *$${montoAbonado.toLocaleString('es-CO')}*
• Método: *${metodoPagoAbono.toUpperCase()}${subMetodoAbono ? ` (${subMetodoAbono})` : ''}*
• Total pagado acumulado: *$${(sep.montoPagado || 0).toLocaleString('es-CO')}*
• Saldo restante: *$${nuevoSaldo.toLocaleString('es-CO')}*

*Total del separe:* *$${(sep.total || 0).toLocaleString('es-CO')}*
`;

    if (sep.fechaLimite) {
      texto += `\n*Fecha límite de pago:* ${formatearFecha(sep.fechaLimite)}`;
    }

    texto += `\n\nGracias por tu pago y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;

    const celular = sep.clienteCelular?.replace(/\D/g, '') || "";
    const url = celular ? `https://wa.me/57${celular}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  // Completar / Entregar Separe
  const confirmarEntregaSepare = async () => {
    if (!separeSeleccionado) return;

    if (!esAdmin && !puedeVentaDirecta) {
      toast.error("Solo el administrador o usuarios con permiso de venta directa pueden confirmar entregas de Plan Separe.");
      return;
    }

    try {
      const separeRef = doc(db, "separes", separeSeleccionado.id);
      
      // 1. Crear movimiento de venta en historial
      const docMov = await addDoc(collection(db, "movimientos"), {
        clienteId: separeSeleccionado.clienteId,
        usuarioId: cuentaPrincipalId,
        tipo: 'venta',
        monto: separeSeleccionado.total || 0,
        descripcion: `Plan Separe entregado - ${separeSeleccionado.clienteNombre}`,
        detalles: (separeSeleccionado.items || []).map((it: any) => ({
          descripcion: it.descripcion,
          valor: (Number(it.valor) || 0) * it.cantidad,
          cantidad: it.cantidad,
          valorUnitario: Number(it.valor) || 0
        })),
        fecha: new Date(),
        registradoPor: nombreUsuario,
        metodoPago: 'efectivo',
        idSepareOrigen: separeSeleccionado.id
      });

      // 2. Actualizar estado del separe a completado
      await updateDoc(separeRef, {
        estado: 'completado',
        fechaCompletado: new Date(),
        idTransaccionCierre: docMov.id,
        saldoPendiente: 0
      });

      reproducirSonidoCelebracion();
      toast.success("¡Plan Separe completado y venta registrada con éxito! 🛍️");
      setModalCompletar(false);

      const ticketEntregaDatos: DatosFacturaProps = {
        nombreNegocio,
        telefonoNegocio: datosSesion?.telefonoNegocio || "",
        correoNegocio: datosSesion?.correoNegocio || "",
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || "",
        direccionNegocio: datosSesion?.direccionNegocio || "",
        mensajePieTicket: datosSesion?.mensajePieTicket || "Gracias por su compra y preferencia.",
        nombreCliente: separeSeleccionado.clienteNombre,
        celularCliente: separeSeleccionado.clienteCelular || "",
        registradoPor: nombreUsuario,
        fecha: new Date(),
        tipo: 'venta',
        detalles: (separeSeleccionado.items || []).map((it: any) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          valor: (Number(it.valor) || 0) * it.cantidad,
          valorUnitario: Number(it.valor) || 0
        })),
        descripcionGeneral: `ENTREGA PLAN SEPARE: Total cancelado $${(separeSeleccionado.total || 0).toLocaleString('es-CO')}`,
        montoTotal: separeSeleccionado.total || 0,
        pagoRecibido: separeSeleccionado.total || 0,
        saldoNuevo: 0,
        idTransaccion: docMov.id,
        metodoPago: 'efectivo'
      };

      setModalExitoEntrega({
        visible: true,
        separe: separeSeleccionado,
        ticketDatos: ticketEntregaDatos
      });

    } catch (e) {
      console.error("Error completando separe:", e);
      toast.error("Error al completar el separe");
    }
  };

  // Enviar mensaje de entrega por WhatsApp (formato estructurado)
  const enviarWhatsAppEntrega = (sep: any) => {
    let texto = `¡Hola, *${sep.clienteNombre}*! Felicitaciones por completar tu plan separe en *${nombreNegocio || 'nuestra tienda'}*.

===================
*ENTREGA DE PLAN SEPARE*
===================

`;
    (sep.items || []).forEach((it: any) => {
      texto += `• ${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}\n`;
    });

    texto += `\n*TOTAL CANCELADO:* *$${(sep.total || 0).toLocaleString('es-CO')}*
*SALDO RESTANTE:* *$0* (100% Pagado)

Tus productos han sido entregados con éxito.
Gracias por tu compra y preferencia.

*¡Te esperamos pronto!*`;

    const celular = sep.clienteCelular?.replace(/\D/g, '') || "";
    const url = celular ? `https://wa.me/57${celular}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  // Cancelar Separe con registro de movimiento de devolución y notificación
  const confirmarCancelacion = async () => {
    if (!separeSeleccionado) return;

    if (!esAdmin && !puedeVentaDirecta) {
      toast.error("Solo el administrador o usuarios con permiso de venta directa pueden cancelar un Plan Separe.");
      return;
    }

    setProcesandoCancelacion(true);

    try {
      const separeRef = doc(db, "separes", separeSeleccionado.id);
      const motivo = notaCancelacion.trim() || "Cancelado por el cliente";
      const montoDevuelto = separeSeleccionado.montoPagado || 0;

      // 1. Si hubo dinero abonado, registrar egreso/movimiento de devolución
      if (montoDevuelto > 0) {
        await addDoc(collection(db, "movimientos"), {
          clienteId: separeSeleccionado.clienteId,
          usuarioId: cuentaPrincipalId,
          tipo: 'egreso',
          categoria: 'devolucion_separe',
          concepto: `Devolución cancelación Plan Separe - ${separeSeleccionado.clienteNombre}`,
          monto: montoDevuelto,
          descripcion: `Devolución de $${montoDevuelto.toLocaleString('es-CO')} por cancelación de separe (${motivo})`,
          fecha: new Date(),
          registradoPor: nombreUsuario,
          metodoPago: 'efectivo',
          idSepareOrigen: separeSeleccionado.id
        });
      }

      // 2. Actualizar estado del separe a cancelado
      await updateDoc(separeRef, {
        estado: 'cancelado',
        fechaCancelado: new Date(),
        notaCancelacion: motivo,
        montoPagadoAlCancelar: montoDevuelto
      });

      // 3. Devolver artículos reservados al inventario físico
      if (separeSeleccionado.items && Array.isArray(separeSeleccionado.items)) {
        const qInv = query(
          collection(db, "inventario"),
          where("usuarioId", "==", cuentaPrincipalId)
        );
        const snapInv = await getDocs(qInv);
        for (const item of separeSeleccionado.items) {
          const prodDoc = snapInv.docs.find(d => {
            const data = d.data();
            return (data.nombre || '').toLowerCase() === (item.descripcion || '').toLowerCase();
          });
          if (prodDoc) {
            const data = prodDoc.data();
            if (data.tipoProducto !== 'servicio' && data.inventariable !== false) {
              await updateDoc(doc(db, "inventario", prodDoc.id), {
                stock: increment(item.cantidad || 1)
              });
            }
          }
        }
      }

      reproducirSonidoAlerta();
      setModalCancelar(false);
      setNotaCancelacion("");

      // 3. Abrir ventana de notificación de cancelación
      setModalNotificacionCancelado({
        visible: true,
        clienteNombre: separeSeleccionado.clienteNombre,
        clienteCelular: separeSeleccionado.clienteCelular || "",
        montoDevuelto: montoDevuelto,
        motivo: motivo
      });

      toast.success("Plan Separe cancelado con éxito");

    } catch (e) {
      console.error("Error cancelando separe:", e);
      toast.error("Error al cancelar el separe");
    } finally {
      setProcesandoCancelacion(false);
    }
  };

  // Enviar mensaje de cancelación por WhatsApp (formato estructurado)
  const enviarWhatsAppCancelacion = (datos: {
    clienteNombre: string;
    clienteCelular: string;
    montoDevuelto: number;
    motivo: string;
  }) => {
    let texto = `¡Hola, *${datos.clienteNombre}*! Información sobre tu plan separe en *${nombreNegocio || 'nuestra tienda'}*.

===================
*CANCELACIÓN DE PLAN SEPARE*
===================

• Total abonado a devolver: *$${(datos.montoDevuelto || 0).toLocaleString('es-CO')}*
• Motivo registrado: ${datos.motivo}

Quedamos a tu disposición ante cualquier duda o consulta.
Gracias por contactarnos.`;

    const celular = datos.clienteCelular?.replace(/\D/g, '') || "";
    const url = celular ? `https://wa.me/57${celular}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  // Imprimir Ticket de Historial / Estado de Separe
  const abrirTicketSepare = (sep: any) => {
    const ticketDatos: DatosFacturaProps = {
      nombreNegocio,
      telefonoNegocio: datosSesion?.telefonoNegocio || "",
      correoNegocio: datosSesion?.correoNegocio || "",
      logoNegocio: datosSesion?.logoNegocio || null,
      nitNegocio: datosSesion?.nitNegocio || "",
      direccionNegocio: datosSesion?.direccionNegocio || "",
      mensajePieTicket: datosSesion?.mensajePieTicket || "Comprobante de Plan Separe.",
      nombreCliente: sep.clienteNombre,
      celularCliente: sep.clienteCelular || "",
      registradoPor: sep.creadoPor || nombreUsuario,
      fecha: sep.fechaCreacion,
      tipo: 'abono',
      detalles: (sep.items || []).map((it: any) => ({
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        valor: (Number(it.valor) || 0) * it.cantidad,
        valorUnitario: Number(it.valor) || 0
      })),
      descripcionGeneral: `PLAN SEPARE: Total $${(sep.total || 0).toLocaleString('es-CO')} | Pagado $${(sep.montoPagado || 0).toLocaleString('es-CO')} | Saldo $${(sep.saldoPendiente || 0).toLocaleString('es-CO')}`,
      montoTotal: sep.montoPagado || 0,
      pagoRecibido: sep.montoPagado || 0,
      saldoNuevo: sep.saldoPendiente || 0,
      idTransaccion: sep.id,
      metodoPago: 'efectivo'
    };

    setModalTicketFactura({ visible: true, datos: ticketDatos });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-[#090d16] overflow-y-auto">
      {/* CABECERA VIOLETA */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-700 to-indigo-800 text-white p-4 sm:p-6 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/inicio')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/15 rounded-2xl">
                <Bookmark size={24} className="text-violet-200" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">PLANES SEPARE</h1>
                <p className="text-xs text-violet-200 font-medium">
                  {countActivos} {countActivos === 1 ? 'separe activo' : 'separes activos'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/dashboard/separe')}
            className="bg-white text-violet-800 hover:bg-violet-50 font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-transform transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus size={16} />
            <span>Nuevo Plan Separe</span>
          </button>
        </div>
      </div>

      {/* CONTENEDOR DE FILTROS Y CONTENIDO */}
      <div className="max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 flex-1 pb-24">

        {/* BARRA DE TABS Y BUSCADOR */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Tabs */}
          <div className="flex bg-white dark:bg-[#0f172a] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
            <button
              onClick={() => setTabActiva('activos')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                tabActiva === 'activos'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Activos</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tabActiva === 'activos' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {countActivos}
              </span>
            </button>

            <button
              onClick={() => setTabActiva('completados')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                tabActiva === 'completados'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Completados</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tabActiva === 'completados' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {countCompletados}
              </span>
            </button>

            <button
              onClick={() => setTabActiva('cancelados')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                tabActiva === 'cancelados'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Cancelados</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tabActiva === 'cancelados' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {countCancelados}
              </span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente o producto..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-violet-500 shadow-sm"
            />
          </div>
        </div>

        {/* LISTADO DE SEPARES */}
        {cargando ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">Cargando separes...</p>
          </div>
        ) : separesFiltrados.length === 0 ? (
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl p-8 sm:p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="w-16 h-16 bg-violet-50 dark:bg-violet-950/40 text-violet-500 rounded-3xl flex items-center justify-center mx-auto">
              <Bookmark size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
                {busqueda ? "No se encontraron coincidencias" : `No hay separes ${tabActiva}`}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {busqueda ? "Intenta con otro término de búsqueda" : "Crea tu primer Plan Separe para reservar productos y recibir abonos progresivos."}
              </p>
            </div>
            {!busqueda && tabActiva === 'activos' && (
              <button
                onClick={() => router.push('/dashboard/separe')}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <Plus size={16} /> Crear Plan Separe
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {separesFiltrados.map((sep) => {
              const total = sep.total || 0;
              const pagado = sep.montoPagado || 0;
              const saldo = sep.saldoPendiente !== undefined ? sep.saldoPendiente : Math.max(0, total - pagado);
              const porcentaje = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
              const estadoVenc = getEstadoVencimiento(sep);
              const esCompletado = sep.estado === 'completado';
              const esCancelado = sep.estado === 'cancelado';

              return (
                <div
                  key={sep.id}
                  className="bg-white dark:bg-[#0f172a] rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Encabezado: Cliente + Badges */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                          {sep.clienteNombre?.charAt(0).toUpperCase() || "C"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight truncate">
                            {sep.clienteNombre}
                          </h3>
                          <p className="text-[11px] font-bold text-slate-400 truncate">
                            {sep.clienteCelular || "Sin celular"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          esCompletado
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : esCancelado
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                        }`}>
                          {sep.estado}
                        </span>

                        {estadoVenc && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                            estadoVenc.tipo === 'vencido'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 animate-pulse'
                              : estadoVenc.tipo === 'hoy'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {estadoVenc.texto}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lista de Artículos */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800/60">
                      <div className="space-y-1.5">
                        {(sep.items || []).map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs min-w-0 gap-2">
                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
                              {it.cantidad > 1 && <strong className="text-violet-600 font-black mr-1">{it.cantidad}x</strong>}
                              {it.descripcion}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                              ${((Number(it.valor) || 0) * (it.cantidad || 1)).toLocaleString('es-CO')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Miniaturas de Fotos Si Existen */}
                      {sep.fotos && sep.fotos.length > 0 && (
                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Camera size={12} /> Fotos:
                          </span>
                          <div className="flex items-center gap-1.5 overflow-x-auto">
                            {sep.fotos.map((fUrl: string, fIdx: number) => (
                              <img
                                key={fIdx}
                                src={fUrl}
                                alt="Foto producto"
                                onClick={() => setFotoLightbox(fUrl)}
                                className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-slate-700 hover:scale-105 transition-transform"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {sep.notas && (
                        <p className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60 dark:border-slate-800">
                          "{sep.notas}"
                        </p>
                      )}
                    </div>

                    {/* Barra de Progreso Visual */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500">
                          Pagado: <strong className="text-slate-900 dark:text-white">${pagado.toLocaleString('es-CO')}</strong>
                        </span>
                        <span className="text-violet-700 dark:text-violet-300 font-black">
                          {porcentaje}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            porcentaje >= 100
                              ? 'bg-emerald-500'
                              : porcentaje >= 70
                                ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                                : porcentaje >= 35
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                  : 'bg-gradient-to-r from-red-500 to-rose-600'
                          }`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] font-black">
                        <span className="text-slate-400">Total: ${total.toLocaleString('es-CO')}</span>
                        <span className={saldo === 0 ? 'text-emerald-600' : 'text-rose-500'}>
                          {saldo === 0 ? '¡PAGADO TOTAL!' : `Falta: $${saldo.toLocaleString('es-CO')}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    {/* Botón Abonar (Solo si activo y con saldo) */}
                    {!esCompletado && !esCancelado && saldo > 0 && (
                      puedeAbonar ? (
                        <button
                          onClick={() => abrirModalAbono(sep)}
                          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <Banknote size={14} /> Abonar
                        </button>
                      ) : (
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-[11px] py-2 rounded-xl text-center">
                          🔒 Abonos restringidos
                        </div>
                      )
                    )}

                    {/* Botón Completar (Si saldo === 0 y activo) */}
                    {!esCompletado && !esCancelado && saldo === 0 && (
                      <button
                        onClick={() => {
                          setSepareSeleccionado(sep);
                          setModalCompletar(true);
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer animate-pulse"
                      >
                        <CheckCircle2 size={14} /> Entregar / Cerrar
                      </button>
                    )}

                    {/* Historial de Abonos */}
                    <button
                      onClick={() => {
                        setSepareSeleccionado(sep);
                        setModalHistorial(true);
                      }}
                      className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      title="Ver historial de abonos"
                    >
                      <Clock size={14} />
                      <span className="hidden sm:inline">Historial</span>
                    </button>

                    {/* Imprimir Ticket */}
                    <button
                      onClick={() => abrirTicketSepare(sep)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                      title="Imprimir Comprobante"
                    >
                      <Printer size={14} />
                    </button>

                    {/* Cancelar (Si activo) */}
                    {!esCompletado && !esCancelado && (
                      <button
                        onClick={() => {
                          setSepareSeleccionado(sep);
                          setModalCancelar(true);
                        }}
                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                        title="Cancelar Separe"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL 1: REGISTRAR ABONO */}
      {modalAbono && separeSeleccionado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[210] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-xl">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Registrar Abono</h3>
                  <p className="text-xs text-slate-400">{separeSeleccionado.clienteNombre}</p>
                </div>
              </div>
              <button
                onClick={() => setModalAbono(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Saldo Pendiente Actual */}
            <div className="p-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/40 rounded-2xl flex justify-between items-center text-xs">
              <span className="text-violet-700 dark:text-violet-300 font-bold">Saldo Pendiente Actual:</span>
              <span className="text-base font-black text-violet-900 dark:text-violet-100">
                ${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')}
              </span>
            </div>

            {/* Monto del Abono */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Monto a Abonar:</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(formatearMonedaInput(e.target.value))}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-lg text-slate-900 dark:text-white outline-none focus:border-violet-500"
                />
              </div>

              {/* Botón Saldo Completo */}
              <button
                type="button"
                onClick={() => setMontoAbono(formatearMonedaInput((separeSeleccionado.saldoPendiente || 0).toString()))}
                className="text-[11px] font-bold text-violet-600 hover:underline inline-flex items-center gap-1 pt-0.5"
              >
                <Check size={13} /> Pagar saldo completo (${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')})
              </button>
            </div>

            {/* Método de Pago */}
            <div className="flex flex-col bg-slate-50 dark:bg-[#020617] p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forma de Pago del Abono</label>

              {/* 4 chips en una sola fila */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => { setMetodoPagoAbono('efectivo'); setSubMetodoAbono(''); }}
                  title="Efectivo"
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                    metodoPagoAbono === 'efectivo'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  <Banknote size={14} />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMetodoPagoAbono('transferencia'); setSubMetodoAbono(''); }}
                  title="Transferencia / Pago en línea"
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                    metodoPagoAbono === 'transferencia'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  <Smartphone size={14} />
                  <span className="leading-tight text-center">Transf.</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMetodoPagoAbono('datafono'); setSubMetodoAbono(''); }}
                  title="Datáfono / Tarjeta"
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                    metodoPagoAbono === 'datafono'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Datáfono</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMetodoPagoAbono('credito_externo'); setSubMetodoAbono(''); }}
                  title="Crédito Externo (Addi, Sistecrédito…)"
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                    metodoPagoAbono === 'credito_externo'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:text-purple-600'
                  }`}
                >
                  <Zap size={14} />
                  <span className="leading-tight text-center">Crédito</span>
                </button>
              </div>

              {/* Sub-selector Transferencia */}
              {metodoPagoAbono === 'transferencia' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 pt-0.5">
                  <div className="flex flex-wrap gap-1">
                    {['Nequi', 'Daviplata', 'PSE', 'Bancolombia', 'Otro'].map(op => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setSubMetodoAbono(subMetodoAbono === op ? '' : op)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                          subMetodoAbono === op
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
                        }`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-selector Crédito */}
              {metodoPagoAbono === 'credito_externo' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 pt-0.5">
                  <div className="flex flex-wrap gap-1">
                    {['Addi', 'Sistecrédito', 'Krediya', 'Otro'].map(op => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setSubMetodoAbono(subMetodoAbono === op ? '' : op)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                          subMetodoAbono === op
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-purple-400'
                        }`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Referencia si no es efectivo */}
              {metodoPagoAbono !== 'efectivo' && (
                <div className="animate-in fade-in duration-150 pt-1">
                  <input
                    type="text"
                    value={referenciaAbono}
                    onChange={(e) => setReferenciaAbono(e.target.value)}
                    placeholder={
                      metodoPagoAbono === 'transferencia'
                        ? `Ref. ${subMetodoAbono || 'comprobante'} (Opcional)`
                        : metodoPagoAbono === 'datafono'
                        ? 'No. Voucher (Opcional)'
                        : `Aprobación ${subMetodoAbono || 'crédito'} (Opcional)`
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Cálculo de nuevo saldo */}
            {Number(montoAbono.replace(/\D/g, '')) > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">Nuevo Saldo Restante:</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  ${Math.max(0, (separeSeleccionado.saldoPendiente || 0) - Number(montoAbono.replace(/\D/g, ''))).toLocaleString('es-CO')}
                </span>
              </div>
            )}

            {/* Botón Confirmar */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAbono(false)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarAbono}
                disabled={procesandoAbono || !Number(montoAbono.replace(/\D/g, ''))}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-md text-sm cursor-pointer"
              >
                {procesandoAbono ? "Guardando..." : "Confirmar Abono"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: HISTORIAL DE ABONOS */}
      {modalHistorial && separeSeleccionado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[210] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Historial de Pagos</h3>
                  <p className="text-xs text-slate-400">{separeSeleccionado.clienteNombre}</p>
                </div>
              </div>
              <button
                onClick={() => setModalHistorial(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center text-xs shrink-0">
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block uppercase tracking-wider truncate">Total</span>
                <span className="font-black text-slate-800 dark:text-slate-200 text-xs sm:text-sm tracking-tight block truncate">${(separeSeleccionado.total || 0).toLocaleString('es-CO')}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block uppercase tracking-wider truncate">Abonado</span>
                <span className="font-black text-emerald-600 text-xs sm:text-sm tracking-tight block truncate">${(separeSeleccionado.montoPagado || 0).toLocaleString('es-CO')}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block uppercase tracking-wider truncate">Saldo</span>
                <span className="font-black text-rose-500 text-xs sm:text-sm tracking-tight block truncate">${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* Lista de Abonos */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(!separeSeleccionado.abonos || separeSeleccionado.abonos.length === 0) ? (
                <p className="text-center text-slate-400 py-8 text-xs font-bold">No se han registrado abonos aún.</p>
              ) : (
                separeSeleccionado.abonos.map((abono: any, idx: number) => (
                  <div
                    key={abono.id || idx}
                    className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 rounded-2xl flex justify-between items-center text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-emerald-600">
                          +${(abono.monto || 0).toLocaleString('es-CO')}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                          {abono.metodoPago || 'Efectivo'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {formatearFecha(abono.fecha)} {abono.registradoPor ? `• Por: ${abono.registradoPor}` : ''}
                      </p>
                      {abono.referenciaPago && (
                        <p className="text-[10px] text-slate-500 font-mono">Ref: {abono.referenciaPago}</p>
                      )}
                    </div>
                    <span className="text-slate-400 text-xs font-bold">#{idx + 1}</span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => setModalHistorial(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: COMPLETAR / ENTREGAR SEPARE */}
      {modalCompletar && separeSeleccionado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[220] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¡Separe 100% Pagado!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El cliente <strong className="text-slate-800 dark:text-slate-200">{separeSeleccionado.clienteNombre}</strong> ha completado la totalidad del pago.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-left text-xs space-y-1.5">
              <p className="font-bold text-emerald-800 dark:text-emerald-200">Al confirmar entrega:</p>
              <ul className="text-slate-600 dark:text-slate-300 space-y-1 text-[11px]">
                <li>• El separe se marcará como <strong>Completado</strong>.</li>
                <li>• Se generará el registro oficial de <strong>Venta</strong> en el historial.</li>
                <li>• Se abrirá el mensaje de WhatsApp para enviar al cliente.</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalCompletar(false)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEntregaSepare}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md text-sm cursor-pointer"
              >
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCELAR SEPARE */}
      {modalCancelar && separeSeleccionado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[220] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-500/20 text-rose-600 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">¿Cancelar este Plan Separe?</h3>
                <p className="text-xs text-slate-400">{separeSeleccionado.clienteNombre}</p>
              </div>
            </div>

            {/* Aviso explícito de cuánto ha pagado el cliente */}
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-rose-700 dark:text-rose-300">Total Abonado por el Cliente:</span>
                <span className="text-sm font-black text-rose-600">
                  ${(separeSeleccionado.montoPagado || 0).toLocaleString('es-CO')}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {separeSeleccionado.montoPagado > 0 
                  ? "Ten en cuenta que deberás devolver o gestionar este dinero directamente con el cliente."
                  : "No se registraron abonos en este separe."}
              </p>
            </div>

            {/* Motivo de Cancelación */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Motivo / Razón de cancelación:</label>
              <textarea
                value={notaCancelacion}
                onChange={(e) => setNotaCancelacion(e.target.value)}
                placeholder="Ej: Cliente desistió de la compra / Devolución acordada..."
                rows={2}
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium outline-none focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalCancelar(false)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl text-sm"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={confirmarCancelacion}
                disabled={procesandoCancelacion}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl shadow-md text-sm cursor-pointer"
              >
                {procesandoCancelacion ? "Cancelando..." : "Sí, Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICACIÓN DE CANCELACIÓN Y DEVOLUCIÓN */}
      {modalNotificacionCancelado?.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[230] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <RotateCcw size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Plan Separe Cancelado</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliente: <strong className="text-slate-800 dark:text-slate-200">{modalNotificacionCancelado.clienteNombre}</strong>
              </p>
            </div>

            {modalNotificacionCancelado.montoDevuelto > 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-2xl space-y-1 text-left text-xs font-bold">
                <div className="flex justify-between text-amber-900 dark:text-amber-200">
                  <span>Dinero abonado a devolver:</span>
                  <span className="text-base font-black text-rose-600">
                    ${modalNotificacionCancelado.montoDevuelto.toLocaleString('es-CO')}
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-1">
                  Se ha registrado la salida de este dinero en el historial de movimientos de caja.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-xs text-slate-500 font-bold">
                No hubo abonos previos recibidos en este separe.
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-left text-xs space-y-0.5">
              <span className="text-[10px] font-black uppercase text-slate-400">Motivo de cancelación:</span>
              <p className="font-bold text-slate-800 dark:text-slate-200">{modalNotificacionCancelado.motivo}</p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => enviarWhatsAppCancelacion(modalNotificacionCancelado)}
                className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
              >
                <MessageCircle size={18} /> Enviar Notificación por WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setModalNotificacionCancelado(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÉXITO DE ABONO (OPCIONAL WHATSAPP Y TICKET) */}
      {modalExitoAbono?.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[230] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¡Abono Registrado!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliente: <strong className="text-slate-800 dark:text-slate-200">{modalExitoAbono.separe.clienteNombre}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-2xl space-y-1.5 text-xs text-left font-bold border border-slate-200/60 dark:border-slate-800">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Abono registrado:</span>
                <span className="text-emerald-600 font-black text-sm">${modalExitoAbono.montoAbonado.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total pagado acumulado:</span>
                <span className="text-slate-900 dark:text-white">${(modalExitoAbono.separe.montoPagado || 0).toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>Saldo restante:</span>
                <span className="text-violet-600 dark:text-violet-400 font-black text-sm">${modalExitoAbono.nuevoSaldo.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => enviarWhatsAppAbono(modalExitoAbono.separe, modalExitoAbono.montoAbonado, modalExitoAbono.nuevoSaldo)}
                className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
              >
                <MessageCircle size={18} /> Enviar Comprobante por WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExitoAbono.ticketDatos })}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Printer size={16} /> Ver / Imprimir Ticket de Abono
              </button>

              <button
                type="button"
                onClick={() => setModalExitoAbono(null)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
              >
                Aceptar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ÉXITO DE ENTREGA (OPCIONAL WHATSAPP Y TICKET) */}
      {modalExitoEntrega?.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[230] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Package size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¡Plan Separe Entregado!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliente: <strong className="text-slate-800 dark:text-slate-200">{modalExitoEntrega.separe.clienteNombre}</strong>
              </p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl space-y-1.5 text-xs text-left font-bold border border-emerald-200 dark:border-emerald-800/40">
              <div className="flex justify-between text-emerald-900 dark:text-emerald-200">
                <span>Total cancelado al 100%:</span>
                <span className="text-emerald-600 font-black text-sm">${(modalExitoEntrega.separe.total || 0).toLocaleString('es-CO')}</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                Venta registrada en el historial y separe marcado como completado.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => enviarWhatsAppEntrega(modalExitoEntrega.separe)}
                className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
              >
                <MessageCircle size={18} /> Enviar Notificación de Entrega
              </button>

              <button
                type="button"
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExitoEntrega.ticketDatos })}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Printer size={16} /> Ver / Imprimir Ticket de Entrega
              </button>

              <button
                type="button"
                onClick={() => setModalExitoEntrega(null)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX DE FOTOS */}
      {fotoLightbox && (
        <div 
          onClick={() => setFotoLightbox(null)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[250] cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh]">
            <img src={fotoLightbox} alt="Foto ampliada" className="w-full h-full object-contain rounded-2xl shadow-2xl" />
            <button
              onClick={() => setFotoLightbox(null)}
              className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL TICKET FACTURA */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />
    </div>
  );
}

