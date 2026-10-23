"use client";
import { obtenerNombreCercano } from "@/utils/whatsapp";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs, getDoc, increment, Timestamp 
} from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { 
  Bookmark, ArrowLeft, Search, Plus, Minus, X, ChevronRight, CheckCircle2, 
  MessageCircle, Printer, MoreVertical, Camera, AlertCircle, Banknote, 
  CreditCard, Smartphone, Zap, Clock, Calendar, ChevronDown, ChevronUp, 
  Trash2, User, Eye, Check, AlertTriangle, HelpCircle, FileText, RotateCcw, Package, Wallet, MapPin, Upload
} from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/AuthContext";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import { Separe, AbonoSepare } from "@/types";
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";
import { API_DB } from "../../../servicios/db";
import ModalSuscripcion from "@/components/ModalSuscripcion";

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
  const puedeEnviarWhatsApp = datosSesion?.puedeEnviarWhatsApp ?? true;
  const tienePermisoSepare = esAdmin || (datosSesion?.permisos?.planSepare === true);
  const moduloSepareActivo = datosSesion?.moduloSepareActivo !== false;

  // Protección de acceso
  useEffect(() => {
    if (datosSesion && !esAdmin && !puedeAbonar && !tienePermisoSepare) {
      toast.error("No tienes permisos para administrar Planes Separe.");
      router.replace('/dashboard/inicio');
    }
  }, [datosSesion, esAdmin, puedeAbonar, tienePermisoSepare, router]);

  const [separes, setSepares] = useState<any[]>([]);
  const [mapaInventario, setMapaInventario] = useState<Record<string, any>>({});
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
  const [fotoLightbox, setFotoLightbox] = useState<{
    url: string;
    productoNombre?: string | null;
    detalle?: string | null;
    esDeInventario?: boolean;
  } | null>(null);
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState<boolean>(false);

  // Estados de Entrega Parcial Inteligente
  const [modalEntregaParcial, setModalEntregaParcial] = useState<boolean>(false);
  const [pasoEntregaParcial, setPasoEntregaParcial] = useState<'seleccion' | 'confirmacion'>('seleccion');
  const [cantidadesEntregaParcial, setCantidadesEntregaParcial] = useState<Record<number, number>>({});
  const [procesandoEntregaParcial, setProcesandoEntregaParcial] = useState<boolean>(false);
  const isDeliveringParcialRef = useRef<boolean>(false);
  const [modalExitoEntregaParcial, setModalExitoEntregaParcial] = useState<{
    visible: boolean;
    separe: any;
    itemsEntregados: any[];
    valorEntregadoHoy: number;
    ticketDatos?: any;
  } | null>(null);

  // Estados de Bitácora de Novedades y Ubicación Física
  const [modalNovedades, setModalNovedades] = useState<boolean>(false);
  const [nuevaNotaNovedad, setNuevaNotaNovedad] = useState<string>("");
  const [ubicacionBodegaEdit, setUbicacionBodegaEdit] = useState<string>("");
  const [guardandoNovedad, setGuardandoNovedad] = useState<boolean>(false);

  // Estados para Anexar Fotos Adicionales con Cámara en Vivo (Antifraude / Vinculación a Producto)
  const fileInputPostSepareRef = useRef<HTMLInputElement>(null);
  const [modalCamaraPostSepare, setModalCamaraPostSepare] = useState<boolean>(false);
  const [separeParaFoto, setSepareParaFoto] = useState<any | null>(null);
  const [productoIndexParaFoto, setProductoIndexParaFoto] = useState<number | null>(null);
  const [mediaStreamPost, setMediaStreamPost] = useState<MediaStream | null>(null);
  const [facingModePost, setFacingModePost] = useState<'environment' | 'user'>('environment');
  const [iniciandoCamaraPost, setIniciandoCamaraPost] = useState<boolean>(false);
  const [flashEfectoPost, setFlashEfectoPost] = useState<boolean>(false);
  const videoPostRef = useRef<HTMLVideoElement | null>(null);
  const [errorCamaraPost, setErrorCamaraPost] = useState<'permiso_denegado' | 'no_disponible' | null>(null);
  const [subiendoFotoPost, setSubiendoFotoPost] = useState<boolean>(false);

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
  const [metodoPagoAbono, setMetodoPagoAbono] = useState("efectivo");
  const [subMetodoAbono, setSubMetodoAbono] = useState("");
  const [referenciaAbono, setReferenciaAbono] = useState("");
  const [procesandoAbono, setProcesandoAbono] = useState<boolean>(false);
  const isAbonandoRef = useRef(false);
  const [saldoFavorAbono, setSaldoFavorAbono] = useState<number>(0);

  // Estados de Cancelación
  const [notaCancelacion, setNotaCancelacion] = useState("");
  const [procesandoCancelacion, setProcesandoCancelacion] = useState(false);

  // Estados de Entrega y Bloqueos de Concurrencia (Anti Doble-Clic)
  const [procesandoEntrega, setProcesandoEntrega] = useState(false);
  const isDeliveringRef = useRef(false);
  const isCancelandoRef = useRef(false);

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

  // Listener en tiempo real del inventario para resolver fotos de catálogo en vivo
  useEffect(() => {
    if (!cuentaPrincipalId) return;

    const qInv = query(
      collection(db, "inventario"),
      where("usuarioId", "==", cuentaPrincipalId)
    );

    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const mapa: Record<string, any> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const prod = { id: docSnap.id, ...data };
        mapa[docSnap.id] = prod;
        if (data.nombre) {
          mapa[data.nombre.trim().toLowerCase()] = prod;
        }
      });
      setMapaInventario(mapa);
    }, (error) => {
      console.warn("Error cargando inventario en separes:", error);
    });

    return () => unsubInv();
  }, [cuentaPrincipalId]);

  // Obtener la foto más fidedigna de un artículo (prioriza foto propia > inventario por ID > inventario por nombre)
  const obtenerFotoProducto = (it: any) => {
    if (!it) return null;
    if (it.fotoUrl) return it.fotoUrl;
    if (it.foto) return it.foto;
    if (it.imagen) return it.imagen;
    if (it.imagenUrl) return it.imagenUrl;

    const prodInv = it.idProducto 
      ? mapaInventario[it.idProducto] 
      : (it.descripcion ? mapaInventario[it.descripcion.trim().toLowerCase()] : null);

    return prodInv?.imagen || prodInv?.imagenUrl || prodInv?.foto || prodInv?.fotoUrl || null;
  };

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

    const normalizar = (texto: string) => (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const qNorm = normalizar(busqueda);
    const clienteMatch = normalizar(sep.clienteNombre).includes(qNorm);
    const celularMatch = (sep.clienteCelular || "").toString().includes(busqueda.trim());
    const notasClienteMatch = normalizar(sep.clienteNotas || "").includes(qNorm);
    const notasSepareMatch = normalizar(sep.notas || "").includes(qNorm);
    const itemsMatch = (sep.items || []).some((it: any) => normalizar(it.descripcion).includes(qNorm));

    return clienteMatch || celularMatch || notasClienteMatch || notasSepareMatch || itemsMatch;
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
  const abrirModalAbono = async (sep: any) => {
    if (!esAdmin && !puedeAbonar) {
      toast.error("Tu usuario no tiene permisos para recibir abonos. Solicítalo al administrador.", { icon: "🔒" });
      return;
    }
    setSepareSeleccionado(sep);
    setMontoAbono("");
    setMetodoPagoAbono('efectivo');
    setSubMetodoAbono("");
    setReferenciaAbono("");
    setSaldoFavorAbono(0);
    setModalAbono(true);

    if (sep.clienteId && sep.clienteId !== 'mostrador') {
      try {
        const docRef = doc(db, "clientes", sep.clienteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = Number(docSnap.data().deudaTotal || 0);
          setSaldoFavorAbono(d < 0 ? Math.abs(d) : 0);
        }
      } catch (e) {
        console.error("Error obteniendo saldo a favor:", e);
      }
    }
  };

  // Registrar un Abono en Firestore
  const guardarAbono = async () => {
    if (!separeSeleccionado) return;
    if (isAbonandoRef.current || procesandoAbono) return;

    const monto = Number(montoAbono.replace(/\D/g, ''));

    if (!monto || monto <= 0) {
      toast.error("Ingresa un monto válido mayor a 0", { icon: "⚠️" });
      return;
    }

    if (monto > (separeSeleccionado.saldoPendiente || 0)) {
      toast.error(`El abono no puede superar el saldo pendiente ($${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')})`, { icon: "⚠️" });
      return;
    }

    if (metodoPagoAbono === 'saldo_interno' && monto > saldoFavorAbono) {
      toast.error(`El abono no puede superar tu Saldo a Favor disponible ($${saldoFavorAbono.toLocaleString('es-CO')})`, { icon: "⚠️" });
      return;
    }

    isAbonandoRef.current = true;
    setProcesandoAbono(true);
    try {
      const abonoRegistrado: any = {
        id: `abono_${Date.now()}`,
        monto,
        metodoPago: metodoPagoAbono,
        fecha: new Date(),
        registradoPor: nombreUsuario || "Vendedor"
      };
      if (subMetodoAbono.trim()) abonoRegistrado.subMetodoPago = subMetodoAbono.trim();
      if (referenciaAbono.trim()) abonoRegistrado.referenciaPago = referenciaAbono.trim();

      const abonosActuales = separeSeleccionado.abonos || [];
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const respuestaAbono = await fetch('/api/separes/abonar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          separeId: separeSeleccionado.id,
          clienteId: separeSeleccionado.clienteId,
          montoAbono: monto,
          metodoPago: metodoPagoAbono,
          subMetodoPago: subMetodoAbono.trim(),
          referenciaPago: referenciaAbono.trim(),
          detallesItems: (separeSeleccionado.items || []).map((it: any) => ({
            descripcion: it.descripcion || "Artículo",
            cantidad: it.cantidad || 1,
            valor: (Number(it.valor) || 0) * (it.cantidad || 1),
            valorUnitario: Number(it.valor) || 0
          }))
        })
      });
      const resAbono = await respuestaAbono.json();
      if (!respuestaAbono.ok) throw new Error(resAbono.error || 'No se pudo registrar el abono.');

      const nuevoMontoPagado = resAbono.nuevoMontoPagado;
      const nuevoSaldoPendiente = resAbono.nuevoSaldoPendiente;

      reproducirSonidoExito();
      toast.success(`Abono de $${monto.toLocaleString('es-CO')} registrado con éxito`);
      setModalAbono(false);

      const separeActualizado = {
        ...separeSeleccionado,
        abonos: [...abonosActuales, abonoRegistrado],
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
      isAbonandoRef.current = false;
      setProcesandoAbono(false);
    }
  };

  // Enviar comprobante de abono por WhatsApp (formato estructurado)
  const enviarWhatsAppAbono = (sep: any, montoAbonado: number, nuevoSaldo: number) => {
    let texto = `¡Hola, *${obtenerNombreCercano(sep.clienteNombre)}*! Gracias por tu abono en *${nombreNegocio || 'nuestra tienda'}*.

===================
*COMPROBANTE DE ABONO*
===================

- Abono recibido: *$${montoAbonado.toLocaleString('es-CO')}*
- Metodo: *${metodoPagoAbono.toUpperCase()}${subMetodoAbono ? ` (${subMetodoAbono})` : ''}*
- Total pagado acumulado: *$${(sep.montoPagado || 0).toLocaleString('es-CO')}*
- Saldo restante: *$${nuevoSaldo.toLocaleString('es-CO')}*

*Total del separe:* *$${(sep.total || 0).toLocaleString('es-CO')}*
`;

    if (sep.fechaLimite) {
      texto += `\n*Fecha limite de pago:* ${formatearFecha(sep.fechaLimite)}`;
    }

    if (sep.id && typeof window !== 'undefined') {
      texto += `\n\n*Ver o descargar comprobante digital:*\n${window.location.origin}/t/${sep.id}`;
    }

    texto += `\n\nGracias por tu pago y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran dia!*`;

    const celular = sep.clienteCelular?.replace(/\D/g, '') || "";
    abrirEnlaceWhatsApp(celular, texto);
  };

  // Completar / Entregar Separe
  const confirmarEntregaSepare = async () => {
    if (!separeSeleccionado) return;
    if (isDeliveringRef.current || procesandoEntrega) return;

    if (!esAdmin && !puedeVentaDirecta && !tienePermisoSepare && !puedeAbonar) {
      toast.error("No tienes permisos para confirmar entregas de Plan Separe.");
      return;
    }

    isDeliveringRef.current = true;
    setProcesandoEntrega(true);

    try {
      // Liquidación y entrega de Separe en una transacción server-side
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const respuestaEntrega = await fetch('/api/separes/entregar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ separeId: separeSeleccionado.id })
      });
      const resEntrega = await respuestaEntrega.json();
      if (!respuestaEntrega.ok) throw new Error(resEntrega.error || 'No se pudo entregar el separe.');

      reproducirSonidoCelebracion();
      toast.success("¡Plan Separe entregado con éxito! 🛍️");
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
        idTransaccion: resEntrega.entregaMovimientoId,
        metodoPago: 'efectivo'

      };

      setModalExitoEntrega({
        visible: true,
        separe: separeSeleccionado,
        ticketDatos: ticketEntregaDatos
      });

    } catch (e: any) {
      console.error("Error completando separe:", e);
      toast.error(e?.message || "Error al completar el separe");
    } finally {
      isDeliveringRef.current = false;
      setProcesandoEntrega(false);
    }
  };

  // Enviar mensaje de entrega por WhatsApp (formato estructurado)
  const enviarWhatsAppEntrega = (sep: any) => {
    let texto = `¡Hola, *${obtenerNombreCercano(sep.clienteNombre)}*! Felicitaciones por completar tu plan separe en *${nombreNegocio || 'nuestra tienda'}*.

===================
*ENTREGA DE PLAN SEPARE*
===================

`;
    (sep.items || []).forEach((it: any) => {
      texto += `- ${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}\n`;
    });

    texto += `\n*TOTAL CANCELADO:* *$${(sep.total || 0).toLocaleString('es-CO')}*
*SALDO RESTANTE:* *$0* (100% Pagado)`;

    if (sep.id && typeof window !== 'undefined') {
      texto += `\n\n*Ver o descargar comprobante digital:*\n${window.location.origin}/t/${sep.id}`;
    }

    texto += `\n\nTus productos han sido entregados con exito.
Gracias por tu compra y preferencia.

*¡Te esperamos pronto!*`;

    const celular = sep.clienteCelular?.replace(/\D/g, '') || "";
    abrirEnlaceWhatsApp(celular, texto);
  };

  // Abrir Modal de Entrega Parcial Inteligente
  const abrirModalEntregaParcial = (sep: any) => {
    setSepareSeleccionado(sep);
    setCantidadesEntregaParcial({});
    setPasoEntregaParcial('seleccion');
    setModalEntregaParcial(true);
  };

  // Confirmar Entrega Parcial Inteligente en Servidor
  const confirmarEntregaParcial = async () => {
    if (!separeSeleccionado) return;
    if (isDeliveringParcialRef.current || procesandoEntregaParcial) return;

    const items = separeSeleccionado.items || [];
    const entregasPayload = Object.entries(cantidadesEntregaParcial)
      .map(([idxStr, cant]) => ({ index: Number(idxStr), cantidad: Number(cant) }))
      .filter(e => e.cantidad > 0);

    if (entregasPayload.length === 0) {
      toast.error("Selecciona al menos un artículo para entregar.");
      return;
    }

    isDeliveringParcialRef.current = true;
    setProcesandoEntregaParcial(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');

      const respuesta = await fetch('/api/separes/entregar-parcial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          separeId: separeSeleccionado.id,
          entregas: entregasPayload
        })
      });

      const res = await respuesta.json();
      if (!respuesta.ok) throw new Error(res.error || 'No se pudo registrar la entrega parcial.');

      reproducirSonidoCelebracion();
      toast.success(res.esCierreTotal ? "¡Entrega total completada! 🛍️" : "¡Entrega parcial registrada con éxito! 📦");
      setModalEntregaParcial(false);

      const ticketParcialDatos: DatosFacturaProps = {
        nombreNegocio,
        telefonoNegocio: datosSesion?.telefonoNegocio || "",
        correoNegocio: datosSesion?.correoNegocio || "",
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || "",
        direccionNegocio: datosSesion?.direccionNegocio || "",
        mensajePieTicket: datosSesion?.mensajePieTicket || "Comprobante de Entrega Parcial.",
        nombreCliente: separeSeleccionado.clienteNombre,
        celularCliente: separeSeleccionado.clienteCelular || "",
        registradoPor: nombreUsuario,
        fecha: new Date(),
        tipo: 'entrega_separe',
        detalles: res.itemsEntregadosHoy.map((it: any) => ({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          valor: it.valor,
          valorUnitario: it.valorUnitario
        })),
        descripcionGeneral: `ENTREGA PARCIAL SEPARE: Valor retirado hoy $${Number(res.valorAEntregarHoy || 0).toLocaleString('es-CO')}`,
        montoTotal: res.valorAEntregarHoy,
        pagoRecibido: res.valorAEntregarHoy,
        saldoNuevo: Math.max(0, (separeSeleccionado.saldoPendiente || 0)),
        idTransaccion: res.movimientoId,
        metodoPago: 'separe_liquidado'
      };

      // Construir versión actualizada del separe con los artículos recién entregados
      const itemsActualizados = res.itemsActualizados || (separeSeleccionado.items || []).map((it: any, idx: number) => {
        const entregaDeEsteItem = entregasPayload.find((e: any) => e.index === idx);
        if (entregaDeEsteItem) {
          const nuevaCantEntregada = Number(it.cantidadEntregada || 0) + Number(entregaDeEsteItem.cantidad);
          return {
            ...it,
            cantidadEntregada: nuevaCantEntregada,
            entregadoCompleto: nuevaCantEntregada >= Number(it.cantidad || 1)
          };
        }
        return it;
      });

      const separeActualizado = {
        ...separeSeleccionado,
        items: itemsActualizados,
        valorEntregado: res.nuevoValorEntregadoTotal ?? ((Number(separeSeleccionado.valorEntregado) || 0) + res.valorAEntregarHoy),
        estado: res.esCierreTotal ? 'completado' : separeSeleccionado.estado
      };

      setModalExitoEntregaParcial({
        visible: true,
        separe: separeActualizado,
        itemsEntregados: res.itemsEntregadosHoy,
        valorEntregadoHoy: res.valorAEntregarHoy,
        ticketDatos: ticketParcialDatos
      });

    } catch (e: any) {
      console.error("Error en entrega parcial:", e);
      toast.error(e?.message || "Error al procesar la entrega parcial.");
    } finally {
      isDeliveringParcialRef.current = false;
      setProcesandoEntregaParcial(false);
    }
  };

  // Enviar mensaje de Entrega Parcial por WhatsApp con redacción clara y profesional
  const enviarWhatsAppEntregaParcial = (sep: any, itemsEntregados: any[], valorEntregadoHoy: number) => {
    let texto = `¡Hola, *${obtenerNombreCercano(sep.clienteNombre)}*! 👋
Te compartimos el comprobante de *entrega parcial* de tu Plan Separe en *${nombreNegocio || 'nuestra tienda'}*.

━━━━━━━━━━━━━━━━━━━━━
📦 *COMPROBANTE DE RETIRO PARCIAL*
━━━━━━━━━━━━━━━━━━━━━

✅ *PRODUCTOS RETIRADOS HOY:*
`;
    itemsEntregados.forEach((it: any) => {
      texto += `• ${it.cantidad > 1 ? `*${it.cantidad}x* ` : ''}${it.descripcion}  _($${Number(it.valor || 0).toLocaleString('es-CO')})_\n`;
    });

    // Artículos que verdaderamente CONTINÚAN en bodega/tienda (excluyendo lo entregado hoy y previamente)
    const pendientes = (sep.items || []).filter((it: any) => {
      const cantTotal = Number(it.cantidad || 1);
      const cantEntregada = Number(it.cantidadEntregada || 0);
      return (cantTotal - cantEntregada) > 0;
    });

    if (pendientes.length > 0) {
      texto += `\n🔒 *PRODUCTOS QUE QUEDAN EN RESERVA EN TIENDA:*\n`;
      pendientes.forEach((it: any) => {
        const cantPend = Number(it.cantidad || 1) - Number(it.cantidadEntregada || 0);
        texto += `• ${cantPend > 1 ? `*${cantPend}x* ` : ''}${it.descripcion}  _(Pendiente por retirar)_\n`;
      });
    } else {
      texto += `\n🎉 *¡Has retirado el 100% de los productos de tu Plan Separe!*\n`;
    }

    const totalPlan = Number(sep.total || 0);
    const montoPagado = Number(sep.montoPagado || 0);
    const saldoPendiente = Math.max(0, Number(sep.saldoPendiente || 0));

    texto += `\n━━━━━━━━━━━━━━━━━━━━━
💰 *ESTADO DE TU CUENTA:*
━━━━━━━━━━━━━━━━━━━━━
• *Valor retirado hoy:* $${valorEntregadoHoy.toLocaleString('es-CO')}
• *Total de tu Plan Separe:* $${totalPlan.toLocaleString('es-CO')}
• *Total que has abonado:* $${montoPagado.toLocaleString('es-CO')}
• *Saldo pendiente por pagar:* ${saldoPendiente === 0 ? '*$0 (100% PAGADO)* ✅' : `*$${saldoPendiente.toLocaleString('es-CO')}*`}`;

    if (sep.fechaLimite && saldoPendiente > 0) {
      texto += `\n• *Fecha límite para pagar saldo:* ${formatearFecha(sep.fechaLimite)}`;
    }

    if (sep.id && typeof window !== 'undefined') {
      texto += `\n\n📄 *Ver comprobante digital:*
${window.location.origin}/t/${sep.id}`;
    }

    texto += `\n\n¡Gracias por tu pago y preferencia! Cuidamos tus artículos reservados hasta que los retires todos. 😊`;

    const celular = sep.clienteCelular?.replace(/\D/g, '') || "";
    abrirEnlaceWhatsApp(celular, texto);
  };

  // Abrir Modal de Novedades y Ubicación Física
  const abrirModalNovedades = (sep: any) => {
    setSepareSeleccionado(sep);
    setNuevaNotaNovedad("");
    setUbicacionBodegaEdit(sep.ubicacionBodega || sep.notas || "");
    setModalNovedades(true);
  };

  // Guardar Novedades y Ubicación
  const guardarNovedades = async () => {
    if (!separeSeleccionado) return;
    if (guardandoNovedad) return;

    setGuardandoNovedad(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');

      const respuesta = await fetch('/api/separes/actualizar-notas-fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          separeId: separeSeleccionado.id,
          nuevaNota: nuevaNotaNovedad.trim() || null,
          ubicacionBodega: ubicacionBodegaEdit.trim()
        })
      });

      const res = await respuesta.json();
      if (!respuesta.ok) throw new Error(res.error || 'Error al actualizar.');

      toast.success("Novedad y ubicación guardadas con éxito");
      setModalNovedades(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "No se pudo actualizar.");
    } finally {
      setGuardandoNovedad(false);
    }
  };

  // Generador de sonido de obturador de cámara
  const reproducirSonidoCamara = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2400, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);
      gain1.gain.setValueAtTime(0.8, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.04);
    } catch (e) {}
  };

  // Limpiar stream al desmontar o cerrar
  useEffect(() => {
    return () => {
      if (mediaStreamPost) {
        mediaStreamPost.getTracks().forEach(t => t.stop());
      }
    };
  }, [mediaStreamPost]);

  // Asignar stream a videoPostRef cuando cambie
  useEffect(() => {
    if (videoPostRef.current && mediaStreamPost) {
      videoPostRef.current.srcObject = mediaStreamPost;
      videoPostRef.current.play().catch(e => console.log("Video post play error:", e));
    }
  }, [mediaStreamPost, modalCamaraPostSepare]);

  const iniciarCamaraPost = async (modo: 'environment' | 'user' = facingModePost) => {
    setIniciandoCamaraPost(true);
    setErrorCamaraPost(null);
    try {
      if (mediaStreamPost) {
        mediaStreamPost.getTracks().forEach(t => t.stop());
      }

      let stream: MediaStream | null = null;
      // Intento 1: Con facingMode flexible para móviles
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: modo },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err1) {
        // Intento 2: Fallback para laptops / webcams integradas sin facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err2: any) {
          throw err2;
        }
      }

      if (stream) {
        setMediaStreamPost(stream);
        setFacingModePost(modo);
        setErrorCamaraPost(null);
      }
    } catch (err: any) {
      console.warn("No se pudo iniciar cámara:", err);
      const esPermiso = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setErrorCamaraPost(esPermiso ? 'permiso_denegado' : 'no_disponible');
      if (esPermiso) {
        toast.error("Permiso de cámara no concedido en el navegador.");
      } else {
        toast("No se detectó cámara activa en este equipo. Puedes adjuntar fotos desde tus archivos.", { icon: "📸" });
      }
    } finally {
      setIniciandoCamaraPost(false);
    }
  };

  const cerrarCamaraPost = () => {
    if (mediaStreamPost) {
      mediaStreamPost.getTracks().forEach(t => t.stop());
      setMediaStreamPost(null);
    }
    setModalCamaraPostSepare(false);
    setSepareParaFoto(null);
    setProductoIndexParaFoto(null);
  };

  const alternarCamaraPost = async () => {
    const nuevoModo = facingModePost === 'environment' ? 'user' : 'environment';
    await iniciarCamaraPost(nuevoModo);
  };

  const abrirModalCamaraPostSepare = (sep: any, itemIdx: number | null = null) => {
    setSepareParaFoto(sep);
    setProductoIndexParaFoto(itemIdx);
    setModalCamaraPostSepare(true);
    iniciarCamaraPost('environment');
  };

  const capturarFotoPost = async () => {
    if (!videoPostRef.current || !separeParaFoto) return;
    reproducirSonidoCamara();
    setFlashEfectoPost(true);
    setTimeout(() => setFlashEfectoPost(false), 200);

    const canvas = document.createElement("canvas");
    canvas.width = videoPostRef.current.videoWidth || 800;
    canvas.height = videoPostRef.current.videoHeight || 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoPostRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

    cerrarCamaraPost();
    await guardarFotoEnServidor(separeParaFoto.id, dataUrl, productoIndexParaFoto);
  };

  const guardarFotoEnServidor = async (separeId: string, dataUrl: string, productoIdx: number | null) => {
    setSubiendoFotoPost(true);
    const toastId = toast.loading("Guardando foto de evidencia...");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesión inválida.");

      const respuesta = await fetch('/api/separes/actualizar-notas-fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          separeId,
          nuevaFoto: dataUrl,
          productoIndex: productoIdx
        })
      });

      const res = await respuesta.json();
      if (!respuesta.ok) throw new Error(res.error || 'No se pudo guardar la foto.');
      toast.success(productoIdx !== null ? "Foto vinculada al artículo con éxito 📸" : "Foto de evidencia guardada 📸", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || "Error al subir la foto.", { id: toastId });
    } finally {
      setSubiendoFotoPost(false);
    }
  };

  // Procesar archivo de foto adicional post-creación desde galería
  const procesarFotoPostSepare = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !separeParaFoto) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      cerrarCamaraPost();
      await guardarFotoEnServidor(separeParaFoto.id, dataUrl, productoIndexParaFoto);
      if (fileInputPostSepareRef.current) fileInputPostSepareRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  // Cancelar Separe con registro de movimiento de devolución y notificación
  const confirmarCancelacion = async () => {
    if (!separeSeleccionado) return;
    if (isCancelandoRef.current || procesandoCancelacion) return;

    if (!esAdmin && !puedeVentaDirecta) {
      toast.error("Solo el administrador o usuarios con permiso de venta directa pueden cancelar un Plan Separe.");
      return;
    }

    isCancelandoRef.current = true;
    setProcesandoCancelacion(true);

    try {
      const motivo = notaCancelacion.trim() || "Cancelado por el cliente";
      const montoDevuelto = Number(separeSeleccionado.montoPagado || 0);

      // Recopilar productos para reintegro de stock

      const itemsDevolver: Array<{ productoId: string; cantidad: number }> = [];
      if (separeSeleccionado.items && Array.isArray(separeSeleccionado.items)) {
        for (const item of separeSeleccionado.items) {
          const pId = item.idProducto || item.productoId;
          if (pId) {
            itemsDevolver.push({
              productoId: pId,
              cantidad: item.cantidad || 1
            });
          }
        }
      }

      // Cancelación de Separe + devolución contable + stock en una transacción server-side
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const respuestaCancelacion = await fetch('/api/separes/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          separeId: separeSeleccionado.id,
          motivo,
          metodoPago: separeSeleccionado.metodoPago || 'efectivo',
          itemsDevolver
        })
      });
      if (!respuestaCancelacion.ok) {
        throw new Error((await respuestaCancelacion.json()).error || 'No se pudo cancelar el separe.');
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
      isCancelandoRef.current = false;
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
    let texto = `¡Hola, *${obtenerNombreCercano(datos.clienteNombre)}*! Información sobre tu plan separe en *${nombreNegocio || 'nuestra tienda'}*.

===================
*CANCELACIÓN DE PLAN SEPARE*
===================

- Total abonado a devolver: *$${(datos.montoDevuelto || 0).toLocaleString('es-CO')}*
- Motivo registrado: ${datos.motivo}

Quedamos a tu disposición ante cualquier duda o consulta.
Gracias por contactarnos.`;

    const celular = datos.clienteCelular?.replace(/\D/g, '') || "";
    abrirEnlaceWhatsApp(celular, texto);
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
      tipo: 'separe',
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

          {moduloSepareActivo && (
            <button
              onClick={() => {
                if (!datosSesion?.esPro) {
                  toast.error("La creación de nuevos apartados requiere el Plan PRO.");
                  setModalSuscripcionOpen(true);
                  return;
                }
                router.push('/dashboard/separe');
              }}
              className="bg-white text-violet-800 hover:bg-violet-50 font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-transform transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Plus size={16} />
              <span>Nuevo Plan Separe</span>
              {!datosSesion?.esPro && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">PRO</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* CONTENEDOR DE FILTROS Y CONTENIDO */}
      <div className="max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-4 flex-1 pb-24">

        {/* BANNER MODO LIQUIDACIÓN CUANDO MÓDULO ESTÁ DESHABILITADO O NO-PRO */}
        {!moduloSepareActivo ? (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-200/60 dark:bg-amber-800/50 rounded-xl text-amber-800 dark:text-amber-200 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-black text-sm text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  <span>Módulo Deshabilitado en Ajustes</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100">
                    Modo Gestión de Activos
                  </span>
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Has desactivado la creación de nuevos apartados en Ajustes. Puedes seguir consultando el historial, registrando abonos y entregando los separes activos previamente guardados sin inconvenientes.
                </p>
              </div>
            </div>
            {esAdmin && (
              <button
                onClick={() => router.push('/dashboard/perfil')}
                className="shrink-0 w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Ir a Ajustes</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        ) : !datosSesion?.esPro ? (
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-200/60 dark:bg-amber-800/50 rounded-xl text-amber-800 dark:text-amber-200 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="font-black text-sm text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  <span>Modo Liquidación de Separes Activo</span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100">
                    {datosSesion?.planActual === 'comercio' ? 'Plan Comercio' : 'Plan Gratuito'}
                  </span>
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Tu plan actual no incluye la creación de nuevos apartados, pero puedes consultar tu historial, registrar abonos y entregar la mercancía ya apartada sin ninguna restricción.
                </p>
              </div>
            </div>
            <button
              onClick={() => setModalSuscripcionOpen(true)}
              className="shrink-0 w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Activar Plan PRO</span>
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}

        {/* BARRA DE TABS Y BUSCADOR */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Tabs con distribución perfecta */}
          <div className="grid grid-cols-3 sm:flex bg-white dark:bg-[#0f172a] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-full sm:w-auto shrink-0 gap-0.5">
            <button
              onClick={() => setTabActiva('activos')}
              className={`px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                tabActiva === 'activos'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Activos</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 font-bold ${tabActiva === 'activos' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {countActivos}
              </span>
            </button>

            <button
              onClick={() => setTabActiva('completados')}
              className={`px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                tabActiva === 'completados'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="truncate">Completados</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 font-bold ${tabActiva === 'completados' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {countCompletados}
              </span>
            </button>

            <button
              onClick={() => setTabActiva('cancelados')}
              className={`px-2 sm:px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                tabActiva === 'cancelados'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Cancelados</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full shrink-0 font-bold ${tabActiva === 'cancelados' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
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
            {!busqueda && tabActiva === 'activos' && moduloSepareActivo && (
              <button
                onClick={() => {
                  if (!datosSesion?.esPro) {
                    toast.error("La creación de nuevos apartados requiere el Plan PRO.");
                    setModalSuscripcionOpen(true);
                    return;
                  }
                  router.push('/dashboard/separe');
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus size={16} /> Crear Plan Separe
                {!datosSesion?.esPro && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">PRO</span>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
                    {/* Encabezado: Cliente + Badges (Sin truncar nombre) */}
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0 mt-0.5">
                          {sep.clienteNombre?.charAt(0).toUpperCase() || "C"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-tight break-words">
                            {sep.clienteNombre}
                          </h3>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                            {sep.clienteCelular || "Sin celular"}
                          </p>
                          {(sep.ubicacionBodega || sep.notas) && (
                            <span className="inline-block mt-1 text-[10.5px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 px-2 py-0.5 rounded-lg break-words">
                              📦 {sep.ubicacionBodega || sep.notas}
                            </span>
                          )}
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

                    {/* Lista de Artículos con estado de entrega parcial */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800/60">
                      <div className="space-y-2">
                        {(sep.items || []).map((it: any, idx: number) => {
                          const fotoItem = obtenerFotoProducto(it);
                          const cantTotal = Number(it.cantidad || 1);
                          const cantEnt = Number(it.cantidadEntregada || 0);
                          const esEntregadoTotal = cantEnt >= cantTotal;

                          return (
                            <div key={idx} className="flex flex-col text-xs min-w-0 border-b border-slate-200/50 dark:border-slate-800/50 pb-1.5 last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {cantTotal > 1 && <strong className="text-violet-600 font-black mr-0.5 shrink-0">{cantTotal}x</strong>}
                                  <span className="font-bold text-slate-700 dark:text-slate-300 break-words leading-tight flex-1">
                                    {it.descripcion}
                                  </span>
                                  {fotoItem ? (
                                    <button
                                      type="button"
                                      onClick={() => setFotoLightbox({
                                        url: fotoItem,
                                        productoNombre: it.descripcion,
                                        detalle: `Artículo en Separe • ${cantTotal > 1 ? `${cantTotal} unidades` : '1 unidad'}`,
                                        esDeInventario: Boolean(it.idProducto || mapaInventario[it.descripcion?.trim().toLowerCase()])
                                      })}
                                      className="shrink-0 p-1 bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                                      title={`Ver foto de "${it.descripcion}"`}
                                    >
                                      <Camera size={12} />
                                    </button>
                                  ) : (!esCompletado && !esCancelado && (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalCamaraPostSepare(sep, idx)}
                                      className="shrink-0 px-1.5 py-0.5 bg-slate-100 hover:bg-violet-100 dark:bg-slate-800 dark:hover:bg-violet-950/40 text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                      title="Tomar foto con cámara directa a este producto"
                                    >
                                      <Camera size={11} />
                                      <span className="hidden sm:inline">+Foto</span>
                                    </button>
                                  ))}
                                </div>
                                <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                                  ${((Number(it.valor) || 0) * cantTotal).toLocaleString('es-CO')}
                                </span>
                              </div>

                              {/* Badge de Entrega Parcial por Producto */}
                              {cantEnt > 0 && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 ${
                                    esEntregadoTotal
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  }`}>
                                    <Check size={10} />
                                    {esEntregadoTotal ? 'Entregado al cliente' : `${cantEnt} de ${cantTotal} entregados`}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Miniaturas de Fotos e Inserción Antifraude */}
                      {(() => {
                        const fotosColeccion: { url: string; productoNombre?: string | null; detalle?: string | null; esDeInventario?: boolean }[] = [];

                        // 1. Fotos de los artículos individuales del separe
                        (sep.items || []).forEach((it: any) => {
                          const fUrl = obtenerFotoProducto(it);
                          if (fUrl && !fotosColeccion.some(f => f.url === fUrl)) {
                            fotosColeccion.push({
                              url: fUrl,
                              productoNombre: it.descripcion,
                              detalle: `Artículo en Separe • ${Number(it.cantidad || 1)} un.`,
                              esDeInventario: Boolean(it.idProducto || mapaInventario[it.descripcion?.trim().toLowerCase()])
                            });
                          }
                        });

                        // 2. Fotos generales o evidencias anexadas al separe (sep.fotos)
                        if (Array.isArray(sep.fotos)) {
                          sep.fotos.forEach((fUrl: string, idx: number) => {
                            if (fUrl && !fotosColeccion.some(f => f.url === fUrl)) {
                              const itemVinculado = (sep.items || []).find((it: any) => it.fotoUrl === fUrl || it.foto === fUrl || it.imagen === fUrl);
                              if (itemVinculado) {
                                fotosColeccion.push({
                                  url: fUrl,
                                  productoNombre: itemVinculado.descripcion,
                                  detalle: `Artículo en Separe • ${Number(itemVinculado.cantidad || 1)} un.`,
                                  esDeInventario: false
                                });
                              } else {
                                fotosColeccion.push({
                                  url: fUrl,
                                  productoNombre: null,
                                  detalle: `Evidencia fotográfica #${idx + 1} • Separe`,
                                  esDeInventario: false
                                });
                              }
                            }
                          });
                        }

                        return (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar flex-1 min-w-0">
                              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 flex items-center gap-1 shrink-0">
                                <Camera size={13} /> Fotos ({fotosColeccion.length}):
                              </span>
                              {fotosColeccion.map((fotoObj, fIdx: number) => (
                                <img
                                  key={fIdx}
                                  src={fotoObj.url}
                                  alt={fotoObj.productoNombre || `Foto ${fIdx + 1}`}
                                  onClick={() => setFotoLightbox(fotoObj)}
                                  className="w-8 h-8 rounded-xl object-cover cursor-pointer border-2 border-violet-300 dark:border-violet-700 hover:scale-110 shadow-sm transition-transform shrink-0"
                                  title={fotoObj.productoNombre ? `Ver foto de "${fotoObj.productoNombre}"` : "Clic para ampliar foto"}
                                />
                              ))}
                            </div>

                            {/* Botón Anexar Foto Antifraude (Acumula foto) */}
                            {!esCancelado && !esCompletado && (
                              <button
                                type="button"
                                onClick={() => abrirModalCamaraPostSepare(sep, null)}
                                className="px-2 py-1 rounded-lg bg-violet-100 dark:bg-violet-950/50 hover:bg-violet-200 text-violet-700 dark:text-violet-300 text-[10.5px] font-black flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                title="Tomar foto con cámara o adjuntar evidencia"
                              >
                                <Plus size={11} />
                                <span>Foto</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}
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

                  {/* Acciones de la Tarjeta con Entrega Parcial Inteligente */}
                  {(() => {
                    const valorEntregadoTotal = Number(sep.valorEntregado || 0);
                    const abonoDisponible = Math.max(0, pagado - valorEntregadoTotal);
                    const itemsPendientes = (sep.items || []).filter((it: any) => (Number(it.cantidad || 1) - Number(it.cantidadEntregada || 0)) > 0);
                    const totalBrutoSep = Number(sep.totalBruto || 0) || (sep.items || []).reduce((acc: number, it: any) => acc + (Number(it.valor) || 0) * (it.cantidad || 1), 0);
                    const factorDto = totalBrutoSep > 0 && Number(sep.montoDescuento || 0) > 0 ? (1 - (Number(sep.montoDescuento || 0) / totalBrutoSep)) : 1;
                    const alcanzaParaAlguno = itemsPendientes.some((it: any) => {
                      const pNeto = Math.round((Number(it.valor) || 0) * factorDto);
                      return pNeto > 0 && abonoDisponible >= pNeto;
                    });

                    return (
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
                        {/* FILA 1: ACCIONES OPERATIVAS Y TRANSACCIONALES */}
                        <div className="flex items-center gap-2">
                          {/* Botón Abonar */}
                          {!esCompletado && !esCancelado && saldo > 0 && (
                            puedeAbonar ? (
                              <button
                                onClick={() => abrirModalAbono(sep)}
                                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
                              >
                                <Banknote size={14} className="shrink-0" />
                                <span>Abonar</span>
                              </button>
                            ) : (
                              <div className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-[11px] py-2.5 rounded-xl text-center">
                                Abonos restringidos
                              </div>
                            )
                          )}

                          {/* Botón Retiro Parcial (Habilitado si el abono libre alcanza) */}
                          {!esCompletado && !esCancelado && saldo > 0 && alcanzaParaAlguno && (
                            <button
                              type="button"
                              onClick={() => abrirModalEntregaParcial(sep)}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer animate-in fade-in whitespace-nowrap"
                              title={`Alcanza para entregar productos con los $${abonoDisponible.toLocaleString('es-CO')} libres abonados`}
                            >
                              <Package size={14} className="shrink-0" />
                              <span>Retiro Parcial</span>
                            </button>
                          )}

                          {/* Botón Completar / Entregar Total (Si saldo === 0 y activo) */}
                          {!esCompletado && !esCancelado && saldo === 0 && (
                            <button
                              onClick={() => {
                                setSepareSeleccionado(sep);
                                setModalCompletar(true);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer animate-pulse"
                            >
                              <CheckCircle2 size={14} className="shrink-0" />
                              <span>Entregar y Finalizar</span>
                            </button>
                          )}
                        </div>

                        {/* FILA 2: UTILIDADES (NOTAS, HISTORIAL, COMPROBANTE, CANCELAR) */}
                        <div className="flex items-center justify-between gap-1.5 pt-0.5">
                          {/* Botón Novedades / Notas con texto claro y badge de conteo */}
                          <button
                            onClick={() => abrirModalNovedades(sep)}
                            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              (sep.bitacoraNovedades && sep.bitacoraNovedades.length > 0) || sep.ubicacionBodega
                                ? 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                            title="Bitácora de notas, seguimiento y ubicación física"
                          >
                            <FileText size={13} className="shrink-0" />
                            <span>Notas</span>
                            {sep.bitacoraNovedades && sep.bitacoraNovedades.length > 0 && (
                              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                {sep.bitacoraNovedades.length}
                              </span>
                            )}
                          </button>

                          {/* Historial de Abonos */}
                          <button
                            onClick={() => {
                              setSepareSeleccionado(sep);
                              setModalHistorial(true);
                            }}
                            className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Ver historial de abonos"
                          >
                            <Clock size={13} className="shrink-0" />
                            <span>Historial</span>
                          </button>

                          {/* Imprimir Ticket */}
                          <button
                            onClick={() => abrirTicketSepare(sep)}
                            className="p-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
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
                              className="p-1.5 px-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer shrink-0"
                              title="Cancelar Separe"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
                  inputMode="decimal" pattern="[0-9]*"
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

              {/* Chips de métodos de pago en una sola fila */}
              <div className={`grid ${saldoFavorAbono > 0 ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5`}>
                <button
                  type="button"
                  onClick={() => { setMetodoPagoAbono('efectivo'); setSubMetodoAbono(''); }}
                  title="Efectivo"
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-0.5 transition-all ${
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
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-0.5 transition-all ${
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
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-0.5 transition-all ${
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
                  className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-0.5 transition-all ${
                    metodoPagoAbono === 'credito_externo'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-purple-400 hover:text-purple-600'
                  }`}
                >
                  <Zap size={14} />
                  <span className="leading-tight text-center">Crédito</span>
                </button>

                {saldoFavorAbono > 0 && (
                  <button
                    type="button"
                    onClick={() => { setMetodoPagoAbono('saldo_interno'); setSubMetodoAbono(''); }}
                    title={`Saldo a Favor (Disp: $${saldoFavorAbono.toLocaleString('es-CO')})`}
                    className={`py-2 rounded-xl text-[10px] font-black flex flex-col items-center justify-center gap-0.5 transition-all ${
                      metodoPagoAbono === 'saldo_interno'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100'
                    }`}
                  >
                    <Wallet size={14} />
                    <span className="leading-tight text-center">Saldo</span>
                  </button>
                )}
              </div>

              {/* Sub-selector Transferencia */}
              {metodoPagoAbono === 'transferencia' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 pt-0.5">
                  <div className="flex flex-wrap gap-1">
                    {['Nequi', 'Daviplata', 'Bancolombia', 'Davivienda', 'PSE', 'Otro'].map(op => (
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

            {separeSeleccionado.fotos && separeSeleccionado.fotos.length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-left border border-slate-100 dark:border-slate-800">
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-2 flex items-center gap-1.5"><Package size={14}/> Evidencia de artículos a entregar:</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {separeSeleccionado.fotos.map((fotoUrl: string, idx: number) => {
                    const itemVinculado = (separeSeleccionado.items || []).find((it: any) => it.fotoUrl === fotoUrl || it.foto === fotoUrl || it.imagen === fotoUrl);
                    return (
                      <img 
                        key={idx} 
                        src={fotoUrl} 
                        alt="Artículo separado" 
                        onClick={() => setFotoLightbox({
                          url: fotoUrl,
                          productoNombre: itemVinculado?.descripcion || null,
                          detalle: itemVinculado ? `Artículo a entregar • ${itemVinculado.cantidad || 1} un.` : `Foto de evidencia #${idx + 1}`
                        })}
                        className="w-16 h-16 object-cover rounded-xl cursor-pointer hover:scale-105 transition-transform shadow-sm border border-slate-200 dark:border-slate-700"
                        title={itemVinculado ? `Ver foto de "${itemVinculado.descripcion}"` : "Clic para ampliar foto"}
                      />
                    );
                  })}
                </div>
              </div>
            )}

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
                disabled={procesandoEntrega}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {procesandoEntrega ? "Entregando..." : "Confirmar Entrega"}
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
              {puedeEnviarWhatsApp && (
                <button
                  type="button"
                  onClick={() => enviarWhatsAppCancelacion(modalNotificacionCancelado)}
                  className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
                >
                  <MessageCircle size={18} /> Enviar Notificación por WhatsApp
                </button>
              )}

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
              {puedeEnviarWhatsApp && (
                <button
                  type="button"
                  onClick={() => enviarWhatsAppAbono(modalExitoAbono.separe, modalExitoAbono.montoAbonado, modalExitoAbono.nuevoSaldo)}
                  className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
                >
                  <MessageCircle size={18} /> Enviar Comprobante por WhatsApp
                </button>
              )}

              <button
                type="button"
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExitoAbono.ticketDatos })}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Printer size={16} /> Ver / Imprimir Factura de Abono
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
              {puedeEnviarWhatsApp && (
                <button
                  type="button"
                  onClick={() => enviarWhatsAppEntrega(modalExitoEntrega.separe)}
                  className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
                >
                  <MessageCircle size={18} /> Enviar Notificación de Entrega
                </button>
              )}

              <button
                type="button"
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExitoEntrega.ticketDatos })}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Printer size={16} /> Ver / Imprimir Factura de Entrega
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

      {/* MODAL DE ENTREGA PARCIAL INTELIGENTE */}
      {modalEntregaParcial && separeSeleccionado && (() => {
        const montoPagadoSep = Number(separeSeleccionado.montoPagado || 0);
        const valorEntregadoSep = Number(separeSeleccionado.valorEntregado || 0);
        const abonoDisponibleSep = Math.max(0, montoPagadoSep - valorEntregadoSep);

        const itemsSep = separeSeleccionado.items || [];
        const totalBrutoSep = itemsSep.reduce((acc: number, it: any) => acc + (Number(it.valor) || 0) * (it.cantidad || 1), 0);
        const montoDescuentoSep = Number(separeSeleccionado.descuento || 0);
        const factorDescuentoSep = (totalBrutoSep > 0 && montoDescuentoSep > 0) ? (1 - (montoDescuentoSep / totalBrutoSep)) : 1;

        const valorTotalHoy = itemsSep.reduce((acc: number, it: any, idx: number) => {
          const cant = cantidadesEntregaParcial[idx] || 0;
          const precioUnitarioNeto = Math.round((Number(it.valor) || 0) * factorDescuentoSep);
          return acc + (cant * precioUnitarioNeto);
        }, 0);

        const abonoRestante = abonoDisponibleSep - valorTotalHoy;
        const superaLimite = valorTotalHoy > abonoDisponibleSep;

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[220] animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
              
              {/* Encabezado del Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
                    <Package size={22} />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {pasoEntregaParcial === 'seleccion' ? 'Entrega Parcial Inteligente' : 'Confirmar Entrega de Artículos'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                      Cliente: <strong className="text-slate-800 dark:text-slate-200">{separeSeleccionado.clienteNombre}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalEntregaParcial(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* PASO 1: SELECCIÓN DE CANTIDADES */}
              {pasoEntregaParcial === 'seleccion' && (
                <>
                  {/* Panel Financiero en Vivo */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-center">
                    <div className="p-2">
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Abono Libre</p>
                      <p className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                        ${abonoDisponibleSep.toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div className="p-2 border-x border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">A Retirar Hoy</p>
                      <p className={`text-xs sm:text-sm font-black ${valorTotalHoy > 0 ? (superaLimite ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400') : 'text-slate-400'}`}>
                        ${valorTotalHoy.toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Abono Restante</p>
                      <p className={`text-xs sm:text-sm font-black ${abonoRestante < 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        ${abonoRestante.toLocaleString('es-CO')}
                      </p>
                    </div>
                  </div>

                  {superaLimite && (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span>El valor de los artículos supera el abono libre disponible (${abonoDisponibleSep.toLocaleString('es-CO')}). Reduce unidades para continuar.</span>
                    </div>
                  )}

                  {/* Listado de Artículos con Selectores de Cantidad */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Selecciona la cantidad de artículos que el cliente retira hoy:
                    </p>

                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {itemsSep.map((item: any, idx: number) => {
                        const cantTotal = Number(item.cantidad || 1);
                        const cantEntregada = Number(item.cantidadEntregada || 0);
                        const cantPendiente = Math.max(0, cantTotal - cantEntregada);
                        const valorUnitNeto = Math.round((Number(item.valor) || 0) * factorDescuentoSep);
                        const cantSeleccionada = cantidadesEntregaParcial[idx] || 0;
                        const yaCompletado = cantPendiente === 0;

                        const puedeSumarUno = !yaCompletado &&
                          cantSeleccionada < cantPendiente &&
                          (valorTotalHoy + valorUnitNeto) <= abonoDisponibleSep;

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              yaCompletado 
                                ? 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-200/40 dark:border-slate-800/40 opacity-60' 
                                : cantSeleccionada > 0
                                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white break-words">
                                {item.descripcion}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <span>Unitario: <strong className="text-slate-700 dark:text-slate-300">${valorUnitNeto.toLocaleString('es-CO')}</strong></span>
                                <span>• Total: {cantTotal}</span>
                                {cantEntregada > 0 && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ({cantEntregada} ya entregados)
                                  </span>
                                )}
                              </div>
                            </div>

                            {yaCompletado ? (
                              <span className="shrink-0 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg flex items-center gap-1">
                                <Check size={12} /> Entregado
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                {valorUnitNeto > abonoDisponibleSep && cantSeleccionada === 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold hidden sm:inline">
                                    Falta abono
                                  </span>
                                )}
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    disabled={cantSeleccionada <= 0}
                                    onClick={() => {
                                      setCantidadesEntregaParcial(prev => ({
                                        ...prev,
                                        [idx]: Math.max(0, (prev[idx] || 0) - 1)
                                      }));
                                    }}
                                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <span className="w-8 text-center text-xs font-black text-slate-900 dark:text-white">
                                    {cantSeleccionada}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!puedeSumarUno}
                                    onClick={() => {
                                      setCantidadesEntregaParcial(prev => ({
                                        ...prev,
                                        [idx]: (prev[idx] || 0) + 1
                                      }));
                                    }}
                                    className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-all"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Acciones Paso 1 */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setModalEntregaParcial(false)}
                      className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={valorTotalHoy <= 0 || superaLimite}
                      onClick={() => setPasoEntregaParcial('confirmacion')}
                      className="flex-[2] py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Package size={16} />
                      {valorTotalHoy > 0 
                        ? `Continuar a Verificación ($${valorTotalHoy.toLocaleString('es-CO')}) →` 
                        : "Selecciona artículos"}
                    </button>
                  </div>
                </>
              )}

              {/* PASO 2: CONFIRMACIÓN Y REVISIÓN VISUAL DE FOTOS */}
              {pasoEntregaParcial === 'confirmacion' && (() => {
                const itemsAEntregar = itemsSep
                  .map((it: any, idx: number) => ({
                    ...it,
                    originalIndex: idx,
                    cantidadAEntregar: cantidadesEntregaParcial[idx] || 0,
                    valorUnitNeto: Math.round((Number(it.valor) || 0) * factorDescuentoSep)
                  }))
                  .filter((it: any) => it.cantidadAEntregar > 0);

                const itemsQueQuedan = itemsSep
                  .map((it: any, idx: number) => {
                    const cantTotal = Number(it.cantidad || 1);
                    const cantEntregadaPrevia = Number(it.cantidadEntregada || 0);
                    const entregandoHoy = cantidadesEntregaParcial[idx] || 0;
                    const quedan = Math.max(0, cantTotal - (cantEntregadaPrevia + entregandoHoy));
                    return { ...it, cantidadQueQueda: quedan };
                  })
                  .filter((it: any) => it.cantidadQueQueda > 0);

                return (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <Camera size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black">Verificación física y fotográfica</strong>
                        <span>Comprueba que los artículos físicos que vas a entregar coincidan con sus fotos registradas:</span>
                      </div>
                    </div>

                    {/* Lista de Artículos a Entregar con Fotos Reales */}
                    <div className="space-y-2.5 max-h-[38vh] overflow-y-auto pr-1">
                      {itemsAEntregar.map((it: any, i: number) => {
                        const fotoItem = obtenerFotoProducto(it);
                        const fotoFallback = separeSeleccionado.fotos?.[0];
                        const fotoAMostrar = fotoItem || fotoFallback;

                        return (
                          <div
                            key={i}
                            className="p-3 bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 shadow-sm flex items-center gap-3"
                          >
                            {/* Miniatura de Foto del Producto */}
                            <div className="relative shrink-0">
                              {fotoAMostrar ? (
                                <img
                                  src={fotoAMostrar}
                                  alt={it.descripcion}
                                  onClick={() => setFotoLightbox({
                                    url: fotoAMostrar,
                                    productoNombre: it.descripcion,
                                    detalle: `Entrega física hoy: ${it.cantidadAEntregar} un. • Valor unitario: $${it.valorUnitNeto.toLocaleString('es-CO')}`,
                                    esDeInventario: Boolean(it.idProducto || mapaInventario[it.descripcion?.trim().toLowerCase()])
                                  })}
                                  className="w-16 h-16 rounded-xl object-cover border-2 border-amber-400 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                                  title="Clic para ampliar foto"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-300 dark:border-slate-700">
                                  <Camera size={18} />
                                  <span className="text-[9px] font-bold mt-1">Sin foto</span>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words">
                                {it.descripcion}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-black text-[11px]">
                                  Entrega hoy: {it.cantidadAEntregar} un.
                                </span>
                                <span className="text-slate-500 font-medium">
                                  Valor: <strong className="text-slate-900 dark:text-white">${(it.cantidadAEntregar * it.valorUnitNeto).toLocaleString('es-CO')}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Resumen Financiero y Artículos que Quedan */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                      <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                        <span>Total retirado en esta visita:</span>
                        <span className="text-amber-600 dark:text-amber-400 font-black text-sm">${valorTotalHoy.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Abono libre que queda en tienda:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">${abonoRestante.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span>Saldo pendiente por pagar del separe:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">${Number(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')}</span>
                      </div>

                      {itemsQueQuedan.length > 0 && (
                        <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400">
                          <strong className="block text-slate-700 dark:text-slate-300 mb-0.5">📦 Quedan guardados en bodega:</strong>
                          <ul className="list-disc list-inside space-y-0.5">
                            {itemsQueQuedan.map((itQ: any, qi: number) => (
                              <li key={qi}>
                                {itQ.cantidadQueQueda > 1 ? `${itQ.cantidadQueQueda}x ` : ''}{itQ.descripcion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Botones de Confirmación */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => setPasoEntregaParcial('seleccion')}
                        className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
                      >
                        ← Modificar Cantidades
                      </button>
                      <button
                        type="button"
                        disabled={procesandoEntregaParcial}
                        onClick={confirmarEntregaParcial}
                        className="flex-[2] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 size={16} />
                        {procesandoEntregaParcial ? "Registrando Entrega..." : "Confirmar y Entregar Mercancía"}
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        );
      })()}

      {/* MODAL DE CÁMARA EN VIVO POST-CREACIÓN (EVIDENCIA Y VINCULACIÓN A PRODUCTOS) */}
      {modalCamaraPostSepare && separeParaFoto && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[240] animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white rounded-3xl w-full max-w-md border border-slate-800 shadow-2xl overflow-hidden space-y-3">
            
            {/* Header del Modal Cámara */}
            <div className="p-4 pb-0 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center gap-2">
                  <Camera size={18} className="text-violet-400" />
                  Tomar Foto de Evidencia
                </h3>
                <p className="text-xs text-slate-400 break-words">
                  Cliente: <strong className="text-slate-200">{separeParaFoto.clienteNombre}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarCamaraPost}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de Producto / Referencia */}
            <div className="px-4 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Package size={13} className="text-violet-400" />
                Vincular foto a este artículo:
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setProductoIndexParaFoto(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    productoIndexParaFoto === null
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  📦 General del Separe
                </button>
                {(separeParaFoto.items || []).map((it: any, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProductoIndexParaFoto(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      productoIndexParaFoto === idx
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {it.descripcion}
                  </button>
                ))}
              </div>
            </div>

            {/* Viewport del Video en Vivo */}
            <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden mx-4 rounded-2xl border border-slate-800">
              {iniciandoCamaraPost ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Iniciando lente de la cámara...</span>
                </div>
              ) : errorCamaraPost ? (
                <div className="p-6 text-center flex flex-col items-center gap-2 text-slate-300">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center shadow-inner">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {errorCamaraPost === 'permiso_denegado'
                        ? 'Permiso de cámara no concedido'
                        : 'Cámara en vivo no disponible'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                      {errorCamaraPost === 'permiso_denegado'
                        ? 'Permite el acceso a la cámara en el ícono de candado o cámara de la barra superior de tu navegador.'
                        : 'Verifica los permisos de tu cámara en el navegador o puedes subir una foto directamente desde este equipo.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => iniciarCamaraPost()}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Reintentar cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputPostSepareRef.current) fileInputPostSepareRef.current.click();
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={13} />
                      <span>Subir foto</span>
                    </button>
                  </div>
                </div>
              ) : (
                <video
                  ref={videoPostRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {flashEfectoPost && (
                <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200"></div>
              )}
            </div>

            {/* Barra de Controles de Cámara */}
            <div className="p-4 bg-slate-950 flex items-center justify-around border-t border-slate-800/80">
              {/* Botón Galería / Subir Archivo */}
              <button
                type="button"
                onClick={() => {
                  if (fileInputPostSepareRef.current) {
                    fileInputPostSepareRef.current.click();
                  }
                }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors flex flex-col items-center gap-1 text-[10px] font-bold cursor-pointer"
                title="Subir foto desde galería"
              >
                <Upload size={17} />
                <span>Galería</span>
              </button>

              {/* Botón Central de Obturador */}
              <button
                type="button"
                onClick={capturarFotoPost}
                disabled={subiendoFotoPost || iniciandoCamaraPost}
                className="w-14 h-14 rounded-full bg-white border-4 border-violet-600 shadow-xl flex items-center justify-center text-violet-700 hover:scale-105 active:scale-90 transition-transform cursor-pointer disabled:opacity-50"
                title="Tomar Foto"
              >
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white">
                  <Camera size={20} />
                </div>
              </button>

              {/* Botón Girar Cámara */}
              <button
                type="button"
                onClick={alternarCamaraPost}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors flex flex-col items-center gap-1 text-[10px] font-bold cursor-pointer"
                title="Girar cámara frontal / trasera"
              >
                <RotateCcw size={17} />
                <span>Girar</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL BITÁCORA DE NOVEDADES Y UBICACIÓN FÍSICA */}
      {modalNovedades && separeSeleccionado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[220] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Novedades y Ubicación</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                    Separe de <strong className="text-slate-800 dark:text-slate-200">{separeSeleccionado.clienteNombre}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalNovedades(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Campo Ubicación en Bodega */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-500" />
                Ubicación Física en Bodega / Estantería
              </label>
              <input
                type="text"
                value={ubicacionBodegaEdit}
                onChange={(e) => setUbicacionBodegaEdit(e.target.value)}
                placeholder="Ej: Estante B - Caja 3, o bolsa azul rotulada"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Historial Inmutable de Novedades */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-500" />
                Historial de Notas y Novedades (Inmutable)
              </label>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {(separeSeleccionado.bitacoraNovedades && separeSeleccionado.bitacoraNovedades.length > 0) ? (
                  separeSeleccionado.bitacoraNovedades.map((nov: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        <span>{nov.autor || "Usuario"}</span>
                        <span>{nov.fecha ? new Date(nov.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{nov.nota}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic p-3 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                    No hay novedades registradas aún.
                  </p>
                )}
              </div>
            </div>

            {/* Agregar Nueva Nota */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Agregar Nueva Novedad
              </label>
              <textarea
                value={nuevaNotaNovedad}
                onChange={(e) => setNuevaNotaNovedad(e.target.value)}
                placeholder="Escribe un seguimiento o novedad (ej: Cliente confirmó que viene a pagar el viernes, o autorizó cambio de color)..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
              />
            </div>

            {/* Acciones */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setModalNovedades(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={guardandoNovedad}
                onClick={guardarNovedades}
                className="flex-[2] py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={16} />
                {guardandoNovedad ? "Guardando..." : "Guardar Novedad y Ubicación"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL ÉXITO ENTREGA PARCIAL */}
      {modalExitoEntregaParcial?.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[230] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Package size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¡Entrega Parcial Registrada!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                Cliente: <strong className="text-slate-800 dark:text-slate-200">{modalExitoEntregaParcial.separe.clienteNombre}</strong>
              </p>
            </div>

            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl space-y-2 text-xs text-left border border-amber-200 dark:border-amber-800/40">
              <p className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                Artículos entregados en esta visita:
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {modalExitoEntregaParcial.itemsEntregados.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-slate-700 dark:text-slate-300 text-[11px]">
                    <span className="break-words">{it.cantidad > 1 ? `${it.cantidad}x ` : ''}{it.descripcion}</span>
                    <span className="font-bold text-slate-900 dark:text-white shrink-0 ml-2">
                      ${Number(it.valor || 0).toLocaleString('es-CO')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 flex justify-between font-black text-xs text-amber-800 dark:text-amber-300">
                <span>Total Retirado Hoy:</span>
                <span>${Number(modalExitoEntregaParcial.valorEntregadoHoy || 0).toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {puedeEnviarWhatsApp && (
                <button
                  type="button"
                  onClick={() => enviarWhatsAppEntregaParcial(
                    modalExitoEntregaParcial.separe,
                    modalExitoEntregaParcial.itemsEntregados,
                    modalExitoEntregaParcial.valorEntregadoHoy
                  )}
                  className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
                >
                  <MessageCircle size={18} /> Enviar Comprobante por WhatsApp
                </button>
              )}

              <button
                type="button"
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExitoEntregaParcial.ticketDatos })}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Printer size={16} /> Ver / Imprimir Factura de Entrega Parcial
              </button>

              <button
                type="button"
                onClick={() => setModalExitoEntregaParcial(null)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
              >
                Aceptar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT OCULTO PARA SUBIR FOTOS POST-CREACIÓN (ANTIFRAUDE) */}
      <input
        type="file"
        ref={fileInputPostSepareRef}
        onChange={procesarFotoPostSepare}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* LIGHTBOX DE FOTOS CON IDENTIFICACIÓN ESTÉTICA DEL PRODUCTO */}
      {fotoLightbox && (
        <div 
          onClick={() => setFotoLightbox(null)}
          className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 z-[250] cursor-pointer animate-in fade-in duration-200 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative w-full max-w-2xl max-h-[92vh] flex flex-col items-center cursor-default gap-3"
          >
            {/* Barra / Badge Superior de Identificación del Producto */}
            {fotoLightbox.productoNombre ? (
              <div className="w-full bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-violet-500/40 p-3 sm:px-4 sm:py-2.5 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-violet-600/25 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0 shadow-inner">
                    <Package size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black text-white truncate max-w-full">
                        {fotoLightbox.productoNombre}
                      </h4>
                      <span className="px-2 py-0.5 text-[9.5px] font-black rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 shrink-0">
                        {fotoLightbox.esDeInventario ? "Catálogo Inventario" : "Artículo Vinculado"}
                      </span>
                    </div>
                    {fotoLightbox.detalle && (
                      <p className="text-[11px] text-slate-300 truncate font-medium mt-0.5">
                        {fotoLightbox.detalle}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFotoLightbox(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer shrink-0"
                  title="Cerrar vista previa"
                >
                  <X size={18} />
                </button>
              </div>
            ) : fotoLightbox.detalle ? (
              <div className="w-full bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/60 p-2.5 sm:px-4 text-slate-300 shadow-xl flex items-center justify-between gap-2 text-xs font-semibold animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <Camera size={15} className="text-violet-400 shrink-0" />
                  <span>{fotoLightbox.detalle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFotoLightbox(null)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer shrink-0"
                  title="Cerrar vista previa"
                >
                  <X size={18} />
                </button>
              </div>
            ) : null}

            {/* Contenedor Visual de la Imagen */}
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-black/60 max-h-[75vh] w-full flex items-center justify-center">
              <img 
                src={fotoLightbox.url} 
                alt={fotoLightbox.productoNombre || "Foto de producto"} 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl" 
              />
              {!fotoLightbox.productoNombre && !fotoLightbox.detalle && (
                <button
                  type="button"
                  onClick={() => setFotoLightbox(null)}
                  className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer shadow-lg border border-white/20"
                  title="Cerrar vista previa"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET FACTURA */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />

      {/* MODAL SUSCRIPCIÓN PARA DESBLOQUEAR SEPARES */}
      <ModalSuscripcion
        isOpen={modalSuscripcionOpen}
        onClose={() => setModalSuscripcionOpen(false)}
        cuentaPrincipalId={cuentaPrincipalId || ""}
        planInicial="pro"
      />
    </div>
  );
}

