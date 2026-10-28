"use client";
import BannerDatosLocales from "@/components/BannerDatosLocales";
import { obtenerNombreCercano } from "@/utils/whatsapp";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import { API_DB } from "@/servicios/db";
import { Cliente, Movimiento, Separe } from "@/types";
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";
import { agregarMediosPagoAlEstado } from "@/utils/mediosPago";
import ModalGestionCliente from "@/components/ModalGestionCliente";
import ModalNuevoCliente from "@/components/ModalNuevoCliente";
import ModalProcesarDevolucion from "@/components/ModalProcesarDevolucion";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalExportarClientes from "@/components/clientes/ModalExportarClientes";
import ModalImportarClientes from "@/components/clientes/ModalImportarClientes";
import ModalAnularAbono from "@/components/modals/ModalAnularAbono";
import ModalAnularVenta from "@/components/modals/ModalAnularVenta";
import ModalSuscripcion from "@/components/ModalSuscripcion";
import toast from "react-hot-toast";
import { 
  RotateCcw,
  Ban,
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MessageCircle, 
  ChevronRight, 
  ChevronDown,
  ArrowLeft, 
  TrendingUp, 
  ShieldAlert, 
  Star, 
  Filter, 
  X, 
  FileText, 
  Calendar, 
  CreditCard,
  MapPin,
  Sparkles,
  RefreshCw,
  MoreVertical,
  History,
  Edit3,
  Trash2,
  Printer,
  Bookmark,
  Tag,
  Plus,
  Check,
  Download,
  Upload,
  Smile,
  Wallet
} from "lucide-react";

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando directorio de clientes...</div>}>
      <ClientesContenido />
    </Suspense>
  );
}

function ClientesContenido() {
  const { datosSesion, cargando: authCargando } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get("clienteId");
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const moduloSepareActivo = datosSesion?.moduloSepareActivo !== false;
  const puedeSepare = (datosSesion?.esPro === true) && (datosSesion?.puedeSepare !== false) && moduloSepareActivo;
  const esCajero = datosSesion?.rol === 'cajero';
  const puedeVerCartera = datosSesion?.puedeVerCartera === true;
  const puedeEnviarWhatsApp = Boolean(datosSesion?.puedeEnviarWhatsApp ?? false);

  useEffect(() => {
    if (!authCargando && datosSesion && !puedeVerCartera) {
      toast.error("No tienes permisos para ver esta sección.");
      router.replace("/dashboard/inicio");
    }
  }, [authCargando, datosSesion, puedeVerCartera, router]);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [separes, setSepares] = useState<Separe[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados de interfaz
  const [busqueda, setBusqueda] = useState("");
  const [mostrarIndicadores, setMostrarIndicadores] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'con_deuda' | 'con_separe' | 'en_riesgo' | 'mayor_deuda' | 'vip' | 'al_dia'>('todos');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [modalSuscripcionClientesOpen, setModalSuscripcionClientesOpen] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [nombresNuevo, setNombresNuevo] = useState("");
  const [apellidosNuevo, setApellidosNuevo] = useState("");
  const [apodoNuevo, setApodoNuevo] = useState("");
  const [tipoDocumentoNuevo, setTipoDocumentoNuevo] = useState<string>("CC");
  const [numeroDocumentoNuevo, setNumeroDocumentoNuevo] = useState("");
  const [saldoInicialNuevo, setSaldoInicialNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [direccionNueva, setDireccionNueva] = useState("");
  const [notasNuevas, setNotasNuevas] = useState("");
  const [etiquetasNuevas, setEtiquetasNuevas] = useState<string[]>([]);
  const [inputEtiquetaNueva, setInputEtiquetaNueva] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mostrarMasOpcionesNuevo, setMostrarMasOpcionesNuevo] = useState(false);

  // Modales Importar y Exportar
  const [modalExportarAbierto, setModalExportarAbierto] = useState(false);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);

  // Modal Gestión de Categorías
  const [modalCategoriasAbierto, setModalCategoriasAbierto] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState("");
  const [clientesAsignarCat, setClientesAsignarCat] = useState<string[]>([]);
  const [guardandoCategorias, setGuardandoCategorias] = useState(false);
  const [clienteDocDuplicadoNuevo, setClienteDocDuplicadoNuevo] = useState<Cliente | null>(null);
  const [clienteCelDuplicadoNuevo, setClienteCelDuplicadoNuevo] = useState<Cliente | null>(null);

  // Modal edición/eliminación
  const [modalGestion, setModalGestion] = useState<{ isOpen: boolean; modo: 'editar' | 'eliminar'; cliente: Cliente | null }>({
    isOpen: false,
    modo: 'editar',
    cliente: null
  });

  // Modal de ticket factura / comprobante térmico
  const [modalTicketFactura, setModalTicketFactura] = useState<{
    visible: boolean;
    datos: DatosFacturaProps | null;
  }>({
    visible: false,
    datos: null
  });

  const [modalDevolucion, setModalDevolucion] = useState<{ isOpen: boolean, venta: Movimiento | null }>({ isOpen: false, venta: null });
  const [modalAnularVenta, setModalAnularVenta] = useState<{ isOpen: boolean; venta: Movimiento | null }>({ isOpen: false, venta: null });
  const [modalAnularAbono, setModalAnularAbono] = useState<{
    isOpen: boolean;
    movimiento: any | null;
    cliente: Cliente | null;
  }>({
    isOpen: false,
    movimiento: null,
    cliente: null
  });

  // Modal Historial / Ficha del Cliente
  const [clienteFicha, setClienteFicha] = useState<any | null>(null);
  // Filtro de movimientos en historial: 'todos' | 'venta' | 'fiado' | 'abono'
  const [filtroTipoMov, setFiltroTipoMov] = useState<'todos' | 'venta' | 'fiado' | 'abono' | 'separe'>('todos');

  // Detección de dispositivo tablet táctil (iPad u otras tablets táctiles en horizontal)
  const [esTabletTactil, setEsTabletTactil] = useState(false);
  useEffect(() => {
    const detectarTablet = () => {
      if (typeof window === 'undefined') return;
      const esIPad = /iPad/i.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const esTabletTactilMedia = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
      setEsTabletTactil(esIPad || (esTabletTactilMedia && window.innerWidth < 1280));
    };
    detectarTablet();
    setMounted(true);
    window.addEventListener('resize', detectarTablet);
    return () => window.removeEventListener('resize', detectarTablet);
  }, []);

  // 1. Cargar Clientes en Tiempo Real
  useEffect(() => {
    if (!cuentaPrincipalId || !puedeVerCartera) return;

    const qC = query(
      collection(db, "clientes"),
      where("usuarioId", "==", cuentaPrincipalId)
    );

    const unsubC = onSnapshot(qC, (snap) => {
      const docs: Cliente[] = [];
      snap.forEach((d) => {
        docs.push({ id: d.id, ...d.data() } as Cliente);
      });
      setClientes(docs);
      setCargando(false);
    }, (err) => {
      console.error("Error al cargar clientes:", err);
      setCargando(false);
    });

    return () => unsubC();
  }, [cuentaPrincipalId, puedeVerCartera]);

  // 2. Cargar Movimientos para Inteligencia de Comportamiento
  useEffect(() => {
    if (!cuentaPrincipalId || !puedeVerCartera) return;

    const qM = query(
      collection(db, "movimientos"),
      where("usuarioId", "==", cuentaPrincipalId)
    );

    const unsubM = onSnapshot(qM, (snap) => {
      const movs: Movimiento[] = [];
      snap.forEach((d) => {
        movs.push({ id: d.id, ...d.data() } as Movimiento);
      });
      setMovimientos(movs);
    }, (err) => {
      console.error("Error al cargar movimientos para métricas:", err);
    });

    return () => unsubM();
  }, [cuentaPrincipalId, puedeVerCartera]);

  // 3. Cargar Separes del Negocio
  useEffect(() => {
    if (!cuentaPrincipalId || !puedeVerCartera) return;

    const qS = query(
      collection(db, "separes"),
      where("usuarioId", "==", cuentaPrincipalId)
    );

    const unsubS = onSnapshot(qS, (snap) => {
      const docs: Separe[] = [];
      snap.forEach((d) => {
        docs.push({ id: d.id, ...d.data() } as Separe);
      });
      setSepares(docs);
    }, (err) => {
      console.error("Error al cargar separes:", err);
    });

    return () => unsubS();
  }, [cuentaPrincipalId, puedeVerCartera]);

  // Auxiliar para convertir Timestamp a Date
  const obtenerFechaJS = (fecha: any): Date | null => {
    if (!fecha) return null;
    if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
    if (fecha.seconds) return new Date(fecha.seconds * 1000);
    if (fecha instanceof Date) return fecha;
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? null : d;
  };

  // 3. Procesar Métricas de Comportamiento por Cada Cliente
  const hoyMs = new Date().getTime();

  const clientesConAnalisis = useMemo(() => {
    return clientes.map((c) => {
      const deuda = c.deudaTotal || 0;

      // Buscar movimientos asociados al cliente
      const movsCliente = movimientos.filter(
        (m) => m.clienteId === c.id || (m.clienteNombre && m.clienteNombre.trim().toLowerCase() === c.nombre.trim().toLowerCase())
      );

      // Asegurar que cada Separe del cliente esté representado en su historial (incluso creados con $0 o previos)
      const idsSeparesConMov = new Set(
        movsCliente.filter(m => m.idSepareOrigen || (m as any).separeId).map(m => m.idSepareOrigen || (m as any).separeId)
      );

      const separesCliente = separes.filter(
        s => s.clienteId === c.id || (s.clienteNombre && s.clienteNombre.trim().toLowerCase() === c.nombre.trim().toLowerCase())
      );

      const separesActivos = separesCliente.filter((s: any) => s.estado === 'activo');
      const saldoSeparesActivos = separesActivos.reduce((acc: number, s: any) => acc + (s.saldoPendiente || 0), 0);
      const tieneSaldoAFavor = deuda < 0;
      const totalCompromiso = tieneSaldoAFavor 
        ? (saldoSeparesActivos > 0 ? (saldoSeparesActivos + deuda) : deuda)
        : (deuda + saldoSeparesActivos);

      const movsSinteticosSepare: Movimiento[] = [];
      for (const sep of separesCliente) {
        if (!idsSeparesConMov.has(sep.id)) {
          movsSinteticosSepare.push({
            id: `sep-apertura-${sep.id}`,
            clienteId: c.id,
            clienteNombre: c.nombre,
            usuarioId: c.usuarioId,
            tipo: 'abono',
            subtipo: (sep.montoPagado && sep.montoPagado > 0) ? 'abono_inicial_separe' : 'apertura_separe_sin_abono',
            monto: sep.montoPagado || 0,
            descripcion: `Plan Separe (${sep.estado === 'activo' ? 'Activo' : (sep.estado === 'completado' ? 'Entregado' : 'Cancelado')}) - ${sep.items?.map((i: any) => `${i.cantidad > 1 ? `${i.cantidad}x ` : ''}${i.descripcion}`).join(', ') || 'Productos'}`,
            detalles: (sep.items || []).map((it: any) => ({
              descripcion: it.descripcion,
              cantidad: it.cantidad || 1,
              valor: it.valor || 0,
              valorUnitario: it.valorUnitario ?? it.valor ?? 0
            })),
            fecha: sep.fechaCreacion || (sep as any).fecha || new Date(),
            idSepareOrigen: sep.id,
            saldoResultanteSepare: sep.saldoPendiente,
            registradoPor: (sep as any).creadoPor || (sep as any).vendedor || 'Sistema',
            metodoPago: (sep as any).metodoPago || 'separe'
          } as unknown as Movimiento);
        }
      }

      const todosMovsCliente = [...movsCliente, ...movsSinteticosSepare];

      // Total comprado histórico (ventas + fiados)
      const totalComprado = todosMovsCliente
        .filter((m) => m.tipo === 'venta' || m.tipo === 'fiado')
        .reduce((acc, m) => acc + (m.monto || 0), 0);

      // Total abonado histórico (abonos con monto > 0)
      const totalAbonado = todosMovsCliente
        .filter((m) => m.tipo === 'abono')
        .reduce((acc, m) => acc + (m.monto || 0), 0);

      // Último abono
      const abonosOrdenados = todosMovsCliente
        .filter((m) => m.tipo === 'abono' && m.fecha && (m.monto || 0) > 0)
        .sort((a, b) => {
          const tA = obtenerFechaJS(a.fecha)?.getTime() || 0;
          const tB = obtenerFechaJS(b.fecha)?.getTime() || 0;
          return tB - tA;
        });

      const ultimoAbonoMov = abonosOrdenados[0] || null;
      const fechaUltimoAbono = ultimoAbonoMov ? obtenerFechaJS(ultimoAbonoMov.fecha) : null;

      // Último movimiento en general
      const movsOrdenados = [...todosMovsCliente].sort((a, b) => {
        const tA = obtenerFechaJS(a.fecha)?.getTime() || 0;
        const tB = obtenerFechaJS(b.fecha)?.getTime() || 0;
        return tB - tA;
      });
      const ultimoMov = movsOrdenados[0] || null;
      const fechaCreacionCliente = c.fecha_creacion 
        ? obtenerFechaJS(c.fecha_creacion) 
        : ((c as any).creadoEl ? obtenerFechaJS((c as any).creadoEl) : ((c as any).createdAt ? obtenerFechaJS((c as any).createdAt) : null));
      const fechaUltimoMov = ultimoMov ? obtenerFechaJS(ultimoMov.fecha) : fechaCreacionCliente;

      // Cálculo de días sin abonar
      let diasSinAbonar = 0;
      if (deuda > 0) {
        if (fechaUltimoAbono) {
          diasSinAbonar = Math.max(0, Math.floor((hoyMs - fechaUltimoAbono.getTime()) / (1000 * 60 * 60 * 24)));
        } else if (fechaUltimoMov) {
          diasSinAbonar = Math.max(0, Math.floor((hoyMs - fechaUltimoMov.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          diasSinAbonar = 0; // Si no hay registro de fecha, no marcarlo como moroso por defecto
        }
      }

      // Clasificación de Semáforo
      let semaforo: 'al_dia' | 'observacion' | 'riesgo' = 'al_dia';
      let etiquetaSemaforo = 'Al Día';
      let colorSemaforo = 'emerald';

      if (deuda > 0) {
        if (diasSinAbonar > 30) {
          semaforo = 'riesgo';
          etiquetaSemaforo = `🚨 En Riesgo (${diasSinAbonar} días sin abono)`;
          colorSemaforo = 'rose';
        } else if (diasSinAbonar > 15) {
          semaforo = 'observacion';
          etiquetaSemaforo = `🟡 En Observación (${diasSinAbonar} días)`;
          colorSemaforo = 'amber';
        } else {
          semaforo = 'al_dia';
          etiquetaSemaforo = `🟢 Al Día (Abonó hace ${diasSinAbonar}d)`;
          colorSemaforo = 'emerald';
        }
      } else {
        semaforo = 'al_dia';
        etiquetaSemaforo = '🟢 Sin Deuda';
        colorSemaforo = 'emerald';
      }

      // Cliente VIP (compras frecuentes / alto volumen histórico sin mora crítica)
      const esVip = totalComprado >= 250000 && semaforo !== 'riesgo';

      return {
        ...c,
        deuda,
        saldoSeparesActivos,
        totalCompromiso,
        separesActivosCount: separesActivos.length,
        totalComprado,
        totalAbonado,
        movimientosCount: todosMovsCliente.length,
        fechaUltimoAbono,
        fechaUltimoMov,
        diasSinAbonar,
        semaforo,
        etiquetaSemaforo,
        colorSemaforo,
        esVip,
        movimientosHistorial: movsOrdenados
      };
    });
  }, [clientes, movimientos, separes, hoyMs]);

  // 4. Métricas Consolidadas Macro
  const metricasMacro = useMemo(() => {
    const totalClientes = clientesConAnalisis.length;

    // Fiados reales en la calle (mercancía entregada a crédito)
    const conFiado = clientesConAnalisis.filter((c) => (c.deuda || 0) > 0);
    const carteraFiadosTotal = conFiado.reduce((acc, c) => acc + (c.deuda || 0), 0);

    // Separes activos en bodega (mercancía apartada con saldo por cobrar)
    const conSepare = clientesConAnalisis.filter((c) => (c.saldoSeparesActivos || 0) > 0);
    const saldoSeparesTotal = conSepare.reduce((acc, c) => acc + (c.saldoSeparesActivos || 0), 0);

    // Compromiso total combinado (Fiados + Separes)
    const conDeuda = clientesConAnalisis.filter((c) => (c.totalCompromiso || 0) > 0);
    const carteraTotal = conDeuda.reduce((acc, c) => acc + (c.totalCompromiso || 0), 0);

    const enRiesgo = clientesConAnalisis.filter((c) => c.semaforo === 'riesgo');
    const dineroEnRiesgo = enRiesgo.reduce((acc, c) => acc + (c.deuda > 0 ? c.deuda : (c.totalCompromiso || 0)), 0);

    const vips = clientesConAnalisis.filter((c) => c.esVip);
    const alDia = clientesConAnalisis.filter((c) => (c.totalCompromiso || 0) <= 0);

    return {
      totalClientes,
      conFiadoCount: conFiado.length,
      carteraFiadosTotal,
      conSepareCount: conSepare.length,
      saldoSeparesTotal,
      conDeudaCount: conDeuda.length,
      carteraTotal,
      enRiesgoCount: enRiesgo.length,
      dineroEnRiesgo,
      vipsCount: vips.length,
      alDiaCount: alDia.length
    };
  }, [clientesConAnalisis]);

  // 5. Categorías / Etiquetas personalizadas extraídas dinámicamente de los clientes
  const todasLasEtiquetas = useMemo(() => {
    const conteos: Record<string, number> = {};
    clientes.forEach((c) => {
      if (Array.isArray(c.etiquetas)) {
        c.etiquetas.forEach((e) => {
          const t = String(e || "").trim();
          if (t) {
            conteos[t] = (conteos[t] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(conteos)
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre));
  }, [clientes]);

  // 6. Filtrado por Búsqueda, Pestañas y Categorías Personalizadas
  const clientesFiltrados = useMemo(() => {
    const normalizar = (texto: string) => (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const qNorm = normalizar(busqueda);

    return clientesConAnalisis.filter((c) => {
      // Filtro de texto insensible a mayúsculas y acentos
      const coincideBusqueda = 
        !qNorm ||
        normalizar(c.nombre).includes(qNorm) ||
        (c.apodo && normalizar(c.apodo).includes(qNorm)) ||
        (c.celular && c.celular.includes(busqueda.trim())) ||
        (c.numeroDocumento && c.numeroDocumento.includes(busqueda.trim())) ||
        normalizar(c.direccion || "").includes(qNorm) ||
        normalizar(c.notas || "").includes(qNorm) ||
        (c.etiquetas || []).some((t) => normalizar(t).includes(qNorm));

      if (!coincideBusqueda) return false;

      // Filtro de etiqueta personalizada
      if (etiquetaFiltro) {
        const tieneEtiqueta = (c.etiquetas || []).some(
          (t) => t.toLowerCase() === etiquetaFiltro.toLowerCase()
        );
        if (!tieneEtiqueta) return false;
      }

      // Filtro de pestaña
      if (filtroActivo === 'con_deuda') return (c.deuda || 0) > 0;
      if (filtroActivo === 'con_separe') return (c.saldoSeparesActivos || 0) > 0;
      if (filtroActivo === 'en_riesgo') return c.semaforo === 'riesgo';
      if (filtroActivo === 'mayor_deuda') return (c.totalCompromiso || 0) > 0;
      if (filtroActivo === 'vip') return c.esVip;
      if (filtroActivo === 'al_dia') return (c.totalCompromiso || 0) <= 0;

      return true;
    }).sort((a, b) => {
      // Ordenar por prioridad: primero los de mayor riesgo/deuda
      if (filtroActivo === 'con_separe') {
        return (b.saldoSeparesActivos || 0) - (a.saldoSeparesActivos || 0);
      }
      if (filtroActivo === 'con_deuda') {
        return (b.deuda || 0) - (a.deuda || 0);
      }
      if (filtroActivo === 'en_riesgo' || filtroActivo === 'mayor_deuda') {
        return (b.totalCompromiso || 0) - (a.totalCompromiso || 0);
      }
      if (filtroActivo === 'vip') {
        return b.totalComprado - a.totalComprado;
      }
      return a.nombre.localeCompare(b.nombre);
    });
  }, [clientesConAnalisis, busqueda, filtroActivo, etiquetaFiltro]);

  // Cliente activo para la ficha derecha en escritorio o modal móvil
  const clienteActivoDetalle = useMemo(() => {
    if (!clienteFicha) return null;
    return clientesConAnalisis.find(c => c.id === clienteFicha.id) || clienteFicha;
  }, [clienteFicha, clientesConAnalisis]);

  const separesClienteActivo = useMemo(() => {
    if (!clienteActivoDetalle) return [];
    return separes.filter(s => s.clienteId === clienteActivoDetalle.id);
  }, [clienteActivoDetalle, separes]);

  const filtroActivoNombre = useMemo(() => {
    let base = "Todos los clientes";
    if (filtroActivo === 'con_deuda') base = "Con Fiados en Calle";
    else if (filtroActivo === 'con_separe') base = "Con Separes en Bodega";
    else if (filtroActivo === 'en_riesgo') base = "En Riesgo (+30 días)";
    else if (filtroActivo === 'mayor_deuda') base = "Mayor Deuda";
    else if (filtroActivo === 'vip') base = "Clientes VIP";
    else if (filtroActivo === 'al_dia') base = "Cuentas al Día";
    if (etiquetaFiltro) base += ` • Categoría: ${etiquetaFiltro}`;
    if (busqueda.trim()) base += ` • Búsqueda: "${busqueda.trim()}"`;
    return base;
  }, [filtroActivo, etiquetaFiltro, busqueda]);

  // Si viene clienteId en URL, seleccionar directamente ese cliente
  useEffect(() => {
    if (clienteIdParam && clientesConAnalisis.length > 0) {
      const match = clientesConAnalisis.find(c => c.id === clienteIdParam);
      if (match && clienteFicha?.id !== match.id) {
        setClienteFicha(match);
      }
    }
  }, [clienteIdParam, clientesConAnalisis]);

  // En pantallas grandes (>= 1024px), si no hay cliente seleccionado, auto-seleccionar el primero
  useEffect(() => {
    if (!clienteIdParam && !clienteFicha && clientesFiltrados.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setClienteFicha(clientesFiltrados[0]);
    }
  }, [clientesFiltrados.length, !clienteFicha, clienteIdParam]);

  // Si el cliente seleccionado cambia en datos reales, mantenerlo actualizado
  useEffect(() => {
    if (clienteFicha) {
      const actualizado = clientesConAnalisis.find(c => c.id === clienteFicha.id);
      if (actualizado && (
        actualizado.deuda !== clienteFicha.deuda ||
        actualizado.totalCompromiso !== clienteFicha.totalCompromiso ||
        actualizado.nombre !== clienteFicha.nombre ||
        actualizado.apodo !== clienteFicha.apodo ||
        actualizado.notas !== clienteFicha.notas ||
        actualizado.movimientosCount !== clienteFicha.movimientosCount
      )) {
        setClienteFicha(actualizado);
      }
    }
  }, [clientesConAnalisis]);

  // Mensaje de comprobante / estado de cuenta idéntico al estándar oficial de Historial e Inicio
  const generarTextoComprobante = (tipo: 'estado' | 'comprobante' = 'estado', cliente: any = {}) => {
    const deuda = cliente.deudaTotal !== undefined ? cliente.deudaTotal : (cliente.deuda || 0);
    const nombreCliente = obtenerNombreCercano(cliente);
    const nombreTienda = nombreNegocio || 'nuestra tienda';
    
    // Obtener separes activos de la clienta
    const separesCliente = separes.filter(
      (s: any) => (s.clienteId === cliente.id || (s.clienteNombre && s.clienteNombre.trim().toLowerCase() === cliente.nombre?.trim().toLowerCase())) && s.estado === 'activo'
    );
    const saldoSeparesActivos = separesCliente.reduce((acc: number, s: any) => acc + (s.saldoPendiente || 0), 0);
    const totalCompromiso = deuda < 0 
      ? (saldoSeparesActivos > 0 ? (saldoSeparesActivos + deuda) : deuda)
      : (deuda + saldoSeparesActivos);

    let texto = '';

    if (tipo === 'estado') {
      if (deuda < 0 && saldoSeparesActivos > 0) {
        // Caso: Tiene saldo a favor en cuenta Y además Plan Separe activo
        const saldoNeto = saldoSeparesActivos + deuda;
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

💰 *SALDO NETO PENDIENTE: ${saldoNeto > 0 ? `$${Math.round(saldoNeto).toLocaleString('es-CO')}` : '$0'}*

📋 *Resumen de tu cuenta:*
• *Saldo en Planes Separe:* $${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}
• *Saldo a favor en cuenta:* -$${Math.round(Math.abs(deuda)).toLocaleString('es-CO')}
${saldoNeto > 0 ? `• *Valor neto restante:* $${Math.round(saldoNeto).toLocaleString('es-CO')}` : `• *¡Tu saldo a favor cubre la totalidad del separe!*`}

🔖 *Tus Planes Separe activos:*
${separesCliente.map((s: any) => `• ${s.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos'} (Saldo: $${Math.round(s.saldoPendiente || 0).toLocaleString('es-CO')})`).join('\n')}

💡 *Nota:* Puedes aplicar tu saldo a favor para abonar o retirar tus artículos reservados.
Quedamos atentos a cualquier consulta.

*¡Que tengas un gran día!*`;
      } else if (deuda > 0 && saldoSeparesActivos > 0) {
        // Caso 1: Tiene fiados y también tiene Planes Separe activos
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

💰 *SALDO TOTAL PENDIENTE: ${Math.round(totalCompromiso).toLocaleString('es-CO')}*

📋 *Resumen de tu cuenta:*
• *Deuda en fiados:* ${Math.round(deuda).toLocaleString('es-CO')}
• *Saldo en Planes Separe:* ${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}

🔖 *Tus Planes Separe activos:*
${separesCliente.map((s: any) => `• ${s.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos'} (Saldo: ${Math.round(s.saldoPendiente || 0).toLocaleString('es-CO')})`).join('\n')}

Quedamos a tu disposición para revisar cualquier detalle o realizar abonos.

*¡Que tengas un gran día!*`;
      } else if (deuda <= 0 && saldoSeparesActivos > 0) {
        // Caso 2: Solo tiene Planes Separe activos (cuenta de fiados al día)
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

💰 *SALDO EN PLANES SEPARE: ${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}*
• Tu cuenta de fiados se encuentra al día.

🔖 *Tus artículos reservados:*
${separesCliente.map((s: any) => `• ${s.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos'} (Saldo: ${Math.round(s.saldoPendiente || 0).toLocaleString('es-CO')} | Pagado: ${Math.round(s.montoPagado || 0).toLocaleString('es-CO')})`).join('\n')}

Quedamos a tu disposición para abonar y retirar tus productos.

*¡Que tengas un gran día!*`;
      } else if (deuda > 0) {
        // Caso 3: Solo fiados (sin separes)
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente presentas un saldo pendiente de: *${Math.round(deuda).toLocaleString('es-CO')}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      } else if (deuda < 0) {
        // Caso 4: Saldo a favor
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente tienes un saldo a favor de: *${Math.round(Math.abs(deuda)).toLocaleString('es-CO')}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      } else {
        // Caso 5: Totalmente al día
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Tu cuenta se encuentra totalmente al día.

Gracias por seguir con nosotros.

*¡Que tengas un gran día!*`;
      }
    }

    const ultimoAbono = Array.isArray(cliente.movimientosHistorial)
      ? cliente.movimientosHistorial
          .filter((mov: any) => mov.tipo === 'abono' && mov.fecha)
          .sort((a: any, b: any) => (obtenerFechaJS(b.fecha)?.getTime() || 0) - (obtenerFechaJS(a.fecha)?.getTime() || 0))[0]
      : undefined;
    return agregarMediosPagoAlEstado(texto, datosSesion?.mediosPago, nombreTienda, totalCompromiso, ultimoAbono);
  };

  // Abrir comprobante en modal térmico
  const abrirTicketDeMovimiento = (mov: Movimiento, clienteTarget?: any) => {
    if (mov.tipo === 'ingreso_inventario') return;

    const clienteEncontrado = clienteTarget || clientes.find(c => c.id === mov.clienteId);
    const nombreCli = mov.clienteId === 'mostrador' 
      ? (mov.clienteNombre && mov.clienteNombre !== 'Mostrador' ? mov.clienteNombre : 'Consumidor Final') 
      : (clienteEncontrado?.nombre || mov.clienteNombre || 'Cliente');
    const celularCli = clienteEncontrado?.celular || '';

    const datosTicket: DatosFacturaProps = {
      nombreNegocio: nombreNegocio || 'Mi Negocio',
      telefonoNegocio: datosSesion?.telefonoNegocio || '',
      correoNegocio: datosSesion?.correoNegocio || '',
      logoNegocio: datosSesion?.logoNegocio || null,
      nitNegocio: datosSesion?.nitNegocio || '',
      direccionNegocio: datosSesion?.direccionNegocio || '',
      mensajePieTicket: datosSesion?.mensajePieTicket || '',
      nombreCliente: nombreCli,
      celularCliente: celularCli,
      registradoPor: mov.registradoPor || '',
      fecha: mov.fecha,
      tipo: mov.tipo as any,
      detalles: mov.detalles && mov.detalles.length > 0 ? mov.detalles : undefined,
      descripcionGeneral: mov.descripcion,
      montoTotal: mov.monto,
      saldoNuevo: mov.saldoResultante !== undefined ? mov.saldoResultante : (clienteEncontrado ? ((clienteEncontrado as any).deudaTotal ?? clienteEncontrado.deuda) : undefined),
      idTransaccion: mov.id,
      metodoPago: mov.metodoPago || (mov.tipo === 'fiado' ? 'fiado' : 'efectivo'),
      referenciaPago: mov.referenciaPago,
      subtotal: mov.subtotal,
      valorIva: mov.valorIva,
      porcentajeIva: mov.porcentajeIva,
      facturaElectronica: mov.facturaElectronica
    };

    setModalTicketFactura({ visible: true, datos: datosTicket });
  };

  // Ejecutar creación del cliente (consumo de API y actualización de estado)
  const ejecutarCreacionCliente = async () => {
    // Consolidar categorías: si el usuario escribió en el campo pero no presionó "+ Agregar", incluirla automáticamente
    const tagsParaGuardar = [...etiquetasNuevas];
    if (inputEtiquetaNueva.trim()) {
      inputEtiquetaNueva.split(/[,;-]/).forEach(t => {
        const clean = t.trim();
        if (clean && !tagsParaGuardar.some(exist => exist.toLowerCase() === clean.toLowerCase())) {
          tagsParaGuardar.push(clean);
        }
      });
    }

    try {
      setGuardandoCliente(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const nombreCalculado = apellidosNuevo.trim() ? (nombresNuevo.trim() + ' ' + apellidosNuevo.trim()) : nombresNuevo.trim();
      const respuesta = await fetch('/api/clientes/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          nombre: nombreCalculado,
          nombres: nombresNuevo.trim(),
          apellidos: apellidosNuevo.trim(),
          apodo: apodoNuevo.trim(),
          tipoDocumento: tipoDocumentoNuevo || 'CC',
          numeroDocumento: numeroDocumentoNuevo.trim(),
          saldoInicial: saldoInicialNuevo.trim() ? Number(saldoInicialNuevo.replace(/[^\d]/g, '')) : 0,
          celular: celularNuevo, 
          direccion: direccionNueva, 
          notas: notasNuevas,
          etiquetas: tagsParaGuardar
        })
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo crear el cliente.');
      const docRef = { id: resultado.id };
      const saldoIni = saldoInicialNuevo.trim() ? Math.round(Number(saldoInicialNuevo.replace(/[^\d]/g, '')) || 0) : 0;

      const nuevoObj = {
        id: docRef.id,
        nombre: nombreNuevo.trim(),
        apodo: apodoNuevo.trim(),
        tipoDocumento: tipoDocumentoNuevo || 'CC',
        numeroDocumento: numeroDocumentoNuevo.trim(),
        celular: celularNuevo.trim() || "",
        direccion: direccionNueva.trim() || "",
        notas: notasNuevas.trim() || "",
        etiquetas: tagsParaGuardar,
        deudaTotal: saldoIni,
        usuarioId: cuentaPrincipalId,
      } as Cliente;

      setClientes(prev => [nuevoObj, ...prev.filter(c => c.id !== nuevoObj.id)]);

      toast.success(`Cliente ${nombreNuevo.trim()} registrado con éxito ✨`);
      setModalNuevoAbierto(false);
      setNombreNuevo("");
      setNombresNuevo("");
      setApellidosNuevo("");
      setApodoNuevo("");
      setTipoDocumentoNuevo("CC");
      setNumeroDocumentoNuevo("");
      setSaldoInicialNuevo("");
      setCelularNuevo("");
      setDireccionNueva("");
      setNotasNuevas("");
      setEtiquetasNuevas([]);
      setInputEtiquetaNueva("");
    } catch (err: any) {
      console.error("Error al crear cliente:", err);
      toast.error(err.message || "Error al crear el cliente.");
    } finally {
      setGuardandoCliente(false);
    }
  };

  // 7. Acción: Crear Nuevo Cliente
  const handleGuardarNuevoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreCalculado = apellidosNuevo.trim() ? (nombresNuevo.trim() + ' ' + apellidosNuevo.trim()) : nombresNuevo.trim();
    setNombreNuevo(nombreCalculado);
    if (!nombresNuevo.trim()) {
      toast.error("El nombre del cliente es obligatorio.");
      return;
    }

    // CONTROL DE CALIDAD Y NEGOCIO: Validar cupo máximo de clientes en Plan Gratis (15 clientes)
    const esGratis = datosSesion?.esGratis ?? (datosSesion?.planActual === 'gratis' || datosSesion?.planActual === 'basico');
    const limite = datosSesion?.limiteClientes ?? (esGratis ? 15 : Infinity);
    if (esGratis && clientes.length >= limite) {
      toast.error(
        `Has alcanzado el límite de ${limite} clientes del Plan Gratuito. Pasa al Plan Comercio o PRO para clientes ilimitados.`,
        { duration: 6000 }
      );
      setModalNuevoAbierto(false);
      if (!esCajero) setModalSuscripcionClientesOpen(true);
      return;
    }

    // CONTROL DE INTEGRIDAD: Validar documento / cédula duplicada (bloqueo estricto con ventana modal diseñada)
    const docNuevoLimpio = numeroDocumentoNuevo.trim();
    if (docNuevoLimpio) {
      const clienteConMismoDoc = clientes.find(c => 
        c.numeroDocumento && c.numeroDocumento.trim().toLowerCase() === docNuevoLimpio.toLowerCase()
      );
      if (clienteConMismoDoc) {
        setClienteDocDuplicadoNuevo(clienteConMismoDoc);
        return;
      }
    }

    // Celular duplicado: ventana emergente para advertir pero permitiendo continuar
    const celNuevoLimpio = celularNuevo.replace(/[^\d]/g, '');
    if (celNuevoLimpio && celNuevoLimpio.length >= 7) {
      const clienteConMismoCel = clientes.find(c => 
        c.celular && c.celular.replace(/[^\d]/g, '') === celNuevoLimpio
      );
      if (clienteConMismoCel) {
        setClienteCelDuplicadoNuevo(clienteConMismoCel);
        return;
      }
    }

    await ejecutarCreacionCliente();
  };

  // 8. Acción: Asignar etiqueta en lote a clientes seleccionados
  const handleGuardarCategoriaMasiva = async () => {
    const cat = nuevaCatNombre.trim();
    if (!cat) {
      toast.error("Ingresa el nombre de la etiqueta.");
      return;
    }
    if (clientesAsignarCat.length === 0) {
      toast.error("Selecciona al menos un cliente para asignarle esta etiqueta.");
      return;
    }

    setGuardandoCategorias(true);
    try {
      const promises = clientesAsignarCat.map(async (cid) => {
        const clienteActual = clientes.find(c => c.id === cid);
        if (!clienteActual) return;
        const tags = Array.isArray(clienteActual.etiquetas) ? [...clienteActual.etiquetas] : [];
        if (!tags.some(t => t.toLowerCase() === cat.toLowerCase())) {
          tags.push(cat);
          await API_DB.actualizarCliente(cid, { etiquetas: tags });
        }
      });

      await Promise.all(promises);
      toast.success(`Etiqueta "${cat}" asignada a ${clientesAsignarCat.length} cliente(s) ✨`);
      setModalCategoriasAbierto(false);
      setNuevaCatNombre("");
      setClientesAsignarCat([]);
      setEtiquetaFiltro(cat);
    } catch (err) {
      console.error("Error asignando etiqueta:", err);
      toast.error("Hubo un error al asignar la etiqueta.");
    } finally {
      setGuardandoCategorias(false);
    }
  };

  // 9. Acción: Desvincular una etiqueta de todos los clientes
  const handleEliminarCategoriaGlobal = async (nombreCategoria: string) => {
    if (!confirm(`¿Deseas desvincular la etiqueta "${nombreCategoria}" de todos los clientes?`)) return;

    setGuardandoCategorias(true);
    try {
      const afectados = clientes.filter(c => (c.etiquetas || []).some(t => t.toLowerCase() === nombreCategoria.toLowerCase()));
      const promises = afectados.map(async (c) => {
        const tagsActualizadas = (c.etiquetas || []).filter(t => t.toLowerCase() !== nombreCategoria.toLowerCase());
        await API_DB.actualizarCliente(c.id, { etiquetas: tagsActualizadas });
      });
      await Promise.all(promises);
      if (etiquetaFiltro?.toLowerCase() === nombreCategoria.toLowerCase()) {
        setEtiquetaFiltro(null);
      }
      toast.success(`Etiqueta "${nombreCategoria}" desvinculada.`);
    } catch (err) {
      console.error("Error al desvincular etiqueta global:", err);
      toast.error("No se pudo desvincular la etiqueta.");
    } finally {
      setGuardandoCategorias(false);
    }
  };

  // =========================================================================
  // SUB-COMPONENTE: FICHA OFICIAL DEL CLIENTE (IDÉNTICO A INICIO E HISTORIAL)
  // =========================================================================
  const renderFichaCliente = (cliente: any, separesList: Separe[], isMobileModal: boolean = false) => {
    const saldoSeparesActivos = separesList
      .filter((s: any) => s.estado === 'activo')
      .reduce((acc: number, s: any) => acc + (s.saldoPendiente || 0), 0);
    const deudaFiado = cliente.deuda ?? cliente.deudaTotal ?? 0;
    const tieneSaldoAFavorFiado = deudaFiado < 0;
    const tieneSaldoAFavor = tieneSaldoAFavorFiado;
    const totalCompromiso = tieneSaldoAFavorFiado 
      ? (saldoSeparesActivos > 0 ? (saldoSeparesActivos + deudaFiado) : deudaFiado)
      : (deudaFiado + saldoSeparesActivos);

    const esNetoDeuda = totalCompromiso > 0;
    const esNetoAFavor = totalCompromiso < 0;
    const esNetoAlDia = totalCompromiso === 0;

    const labelSaldo = esNetoAFavor
      ? (saldoSeparesActivos > 0 ? 'Saldo Neto a Favor' : 'Saldo a Favor')
      : esNetoDeuda
        ? (saldoSeparesActivos > 0 && tieneSaldoAFavorFiado
            ? 'Saldo Neto Pendiente'
            : saldoSeparesActivos > 0 && deudaFiado > 0
              ? 'Compromiso Total'
              : saldoSeparesActivos > 0
                ? 'Total Separes'
                : 'Deuda Total')
        : (saldoSeparesActivos > 0 ? 'Al Día (Separes cubiertos)' : 'Al Día');

    const valorSaldoTexto = esNetoAlDia
      ? 'Al Día'
      : `$${Math.round(Math.abs(totalCompromiso)).toLocaleString('es-CO')}`;

    const separesActivosCliente = separesList.filter((s: any) => s.estado === 'activo');

    // Banner inteligente cuando el cliente tiene saldo a favor y al mismo tiempo un Separe activo (Teal)
    const bannerSaldoAFavorSepare = tieneSaldoAFavorFiado && saldoSeparesActivos > 0 && (
      <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-teal-600/10 dark:bg-teal-400/20 text-teal-600 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Wallet size={15} />
            </div>
            <span className="text-xs font-bold text-teal-950 dark:text-teal-100 truncate">Saldo a favor</span>
          </div>
          <span className="text-sm font-black text-teal-700 dark:text-teal-300 shrink-0">
            ${Math.round(Math.abs(deudaFiado)).toLocaleString('es-CO')}
          </span>
        </div>
        <p className="text-[11px] text-teal-900/80 dark:text-teal-300/80 leading-snug">
          Tiene <strong>${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}</strong> pendientes en Separes. Puedes usar este saldo a favor para cubrir cuotas.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre || '')}`)}
          className="w-full py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <span>Abonar a Separe</span>
          <ChevronRight size={14} />
        </button>
      </div>
    );

    // Filtrado de movimientos por tipo en el expediente (sin hook useMemo dentro de función auxiliar)
    const todosMovs = cliente.movimientosHistorial || [];
    const movimientosFiltrados = filtroTipoMov === 'todos' 
      ? todosMovs 
      : filtroTipoMov === 'separe'
        ? todosMovs.filter((m: any) => Boolean(m.idSepareOrigen || m.separeId) || m.tipo === 'entrega_separe' || m.subtipo?.includes('separe') || (m.descripcion && m.descripcion.toLowerCase().includes('separe')))
        : filtroTipoMov === 'abono'
          ? todosMovs.filter((m: any) => m.tipo === 'abono' && (m.monto > 0 || m.subtipo !== 'apertura_separe_sin_abono'))
          : todosMovs.filter((m: Movimiento) => m.tipo === filtroTipoMov);

    // Renderizador común de tarjetas de movimientos
    const renderListaMovimientos = (movs: Movimiento[]) => {
      if (movs.length === 0) {
        return (
          <div className="py-10 text-center text-slate-400 space-y-1">
            <Clock size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Sin transacciones en este filtro.</p>
            <p className="text-[11px] text-slate-400">
              {todosMovs.length === 0 ? "Aún no se registran movimientos para este cliente." : "Prueba cambiando el filtro a 'Todos'."}
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-1.5">
          {movs.map((mov: Movimiento) => {
            const f = obtenerFechaJS(mov.fecha);
            const fechaStr = f 
              ? f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
              : '';
            const tieneDevolucion = (mov as any).tieneDevolucion;
            const esVentaOFiado = mov.tipo === 'venta' || mov.tipo === 'fiado';
            const esSepare = Boolean((mov as any).idSepareOrigen || (mov as any).separeId) || 
                             mov.tipo === 'entrega_separe' || 
                             mov.subtipo?.includes('separe') || 
                             Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes('separe'));
            const esAbonoSepare = (mov.tipo === 'abono' && esSepare) || mov.subtipo === 'abono_inicial_separe';
            const esEntregaSepare = mov.tipo === 'entrega_separe';

            return (
              <div 
                key={mov.id} 
                className={`p-2 sm:p-2.5 bg-slate-50 dark:bg-[#020617] rounded-xl border ${mov.tipo === 'devolucion' ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-100 dark:border-slate-800'} shadow-xs relative overflow-hidden space-y-1 sm:space-y-1.5`}
              >
                {/* Barra lateral de color según el tipo */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  mov.tipo === 'anulacion' ? 'bg-rose-600' :
                    mov.tipo === 'devolucion' ? 'bg-amber-500' :
                  esSepare ? 'bg-violet-600' :
                  mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')
                }`} />
                
                <div className="pl-1 sm:pl-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pb-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                        mov.anulado
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                          : mov.tipo === 'devolucion'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                          : esEntregaSepare
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                          : esSepare
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                          : mov.tipo === 'fiado' 
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' 
                          : (mov.tipo === 'venta' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')
                      }`}>
                        {mov.anulado ? '🚫 ANULADO' : mov.tipo === 'anulacion' ? '🚫 ANULACIÓN' :
                         mov.tipo === 'devolucion' ? '↩ DEVOLUCIÓN' :
                         esEntregaSepare ? '📦 SEPARE ENTREGADO' :
                         esSepare ? (
                           mov.subtipo === 'abono_inicial_separe' ? '🔖 SEPARE INICIAL' :
                           (mov.subtipo === 'apertura_separe_sin_abono' || mov.monto === 0 ? '🔖 NUEVO SEPARE' : '🔖 ABONO SEPARE')
                         ) :
                         mov.tipo === 'abono' ? 'ABONO CUENTA' :
                         mov.subtipo === 'traslado_separe_a_fiado' ? '📦 FIADO (DE SEPARE)' :
                         mov.tipo}
                      </span>
                      
                      {tieneDevolucion && (
                        <span className="text-[9px] sm:text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 bg-amber-500 text-white shadow-xs flex items-center gap-1">
                          <AlertTriangle size={10} /> Con Devolución
                        </span>
                      )}

                      {mov.facturaElectronica?.numeroFactura && (
                        <span className="text-[9px] sm:text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 bg-blue-600 text-white shadow-xs">
                          FE {mov.facturaElectronica.numeroFactura}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-x-1.5 text-[10px] font-bold uppercase text-slate-400 shrink-0 ml-auto">
                      {mov.registradoPor && (
                        <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                          👤 {mov.registradoPor}
                        </span>
                      )}
                      {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600">•</span>}
                      <span className="text-slate-400 whitespace-nowrap">
                        {fechaStr}
                      </span>
                    </div>
                  </div>
                  
                  {mov.detalles && mov.detalles.length > 0 ? (
                    <div className="space-y-0.5 pt-1">
                      {mov.detalles.map((d: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] sm:text-xs min-w-0 gap-2">
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate flex-1 min-w-0">
                            {d.cantidad > 1 && (
                              <strong className={`${
                                mov.tipo === 'anulacion' ? 'text-rose-600 dark:text-rose-400' :
                        mov.tipo === 'devolucion' ? 'text-amber-500' :
                                mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')
                              } font-black mr-1`}>
                                {d.cantidad}x
                              </strong>
                            )}
                            {d.descripcion}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">
                            ${Math.round(d.valor || 0).toLocaleString('es-CO')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 truncate pt-1">
                      {mov.descripcion || 'Sin descripción'}
                    </p>
                  )}
                  
                  {mov.articulosDevueltos && mov.articulosDevueltos.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 bg-amber-50 dark:bg-amber-950/20 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                      <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Artículos devueltos:</p>
                      {mov.articulosDevueltos.map((d: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs min-w-0 gap-2">
                          <span className="text-slate-600 dark:text-slate-300 truncate flex-1 min-w-0"><span className="text-amber-600 font-bold">{d.cantidad}x</span> {d.descripcion}</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0">${Math.round(d.subtotal || 0).toLocaleString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-1.5 mt-0.5 border-t border-slate-200/60 dark:border-slate-800 font-black">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">
                      {mov.anulado ? 'Monto anulado:' : (mov.tipo === 'abono' ? 'Abono recibido:' : (mov.tipo === 'devolucion' ? 'Valor devuelto:' : 'Total:'))}
                    </span>
                    <div className="flex items-center gap-2">
                      {mov.tipo === 'abono' && !mov.anulado && (!esCajero || datosSesion?.permisos?.hacerDevoluciones || datosSesion?.esAdmin !== false) && (
                        <button
                          type="button"
                          onClick={() => setModalAnularAbono({ isOpen: true, movimiento: mov, cliente })}
                          title="Anular abono registrado por error o duplicado"
                          className="text-[10px] font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                        >
                          <RotateCcw size={11} /> Anular
                        </button>
                      )}
                      {esVentaOFiado && !mov.anulado && !(mov as any).tieneDevolucion && (!esCajero || datosSesion?.permisos?.hacerDevoluciones || datosSesion?.esAdmin !== false) && (
                        <button
                          type="button"
                          onClick={() => setModalAnularVenta({ isOpen: true, venta: mov })}
                          className="text-[10px] font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-400 rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                          title={mov.tipo === 'fiado' ? "Anular fiado por error" : "Anular venta por error"}
                        >
                          <Ban size={11} /> Anular
                        </button>
                      )}
                      {esVentaOFiado && mov.detalles && mov.detalles.length > 0 && !mov.anulado && !(mov as any).tieneDevolucionTotal && (!esCajero || datosSesion?.permisos?.hacerDevoluciones) && (
                        <button
                          type="button"
                          onClick={() => setModalDevolucion({ isOpen: true, venta: mov })}
                          className="text-[10px] font-bold px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded-lg transition-colors cursor-pointer border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                        >
                          <RotateCcw size={11} /> Devolver
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirTicketDeMovimiento(mov, cliente)}
                        title="Imprimir Factura"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <Printer size={15} />
                      </button>
                      <span className={`text-base sm:text-lg font-black ${
                        mov.anulado ? 'line-through text-slate-400 dark:text-slate-500 opacity-60' :
                        mov.tipo === 'devolucion' ? 'text-amber-500' :
                        esSepare ? 'text-violet-600 dark:text-violet-400' :
                        mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')
                      }`}>
                        {mov.anulado ? `(Anulado) $${Math.round(mov.monto || 0).toLocaleString('es-CO')}` :
                         mov.subtipo === 'retiro_item_separe' ? `-${Math.round(mov.monto || 0).toLocaleString('es-CO')}` : (esEntregaSepare ? 'Entregado' : (mov.subtipo === 'apertura_separe_sin_abono' || (mov.monto === 0 && esSepare) ? 'Reservado ($0)' : `${mov.tipo === 'fiado' || mov.tipo === 'devolucion' ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}`))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    // Barra de filtros de historial (utilizada en escritorio y móvil)
    const chipsFiltrosHistorial = (
      <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setFiltroTipoMov('todos')}
          className={`px-2 py-1 rounded-lg transition cursor-pointer ${
            filtroTipoMov === 'todos'
              ? 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => setFiltroTipoMov('fiado')}
          className={`px-2 py-1 rounded-lg transition cursor-pointer ${
            filtroTipoMov === 'fiado'
              ? 'bg-rose-500 text-white shadow-xs'
              : 'text-slate-500 hover:text-rose-600 dark:text-slate-400'
          }`}
        >
          Fiados
        </button>
        <button
          type="button"
          onClick={() => setFiltroTipoMov('abono')}
          className={`px-2 py-1 rounded-lg transition cursor-pointer ${
            filtroTipoMov === 'abono'
              ? 'bg-blue-500 text-white shadow-xs'
              : 'text-slate-500 hover:text-blue-600 dark:text-slate-400'
          }`}
        >
          Abonos
        </button>
        <button
          type="button"
          onClick={() => setFiltroTipoMov('separe')}
          className={`px-2 py-1 rounded-lg transition cursor-pointer ${
            filtroTipoMov === 'separe'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-500 hover:text-violet-600 dark:text-slate-400'
          }`}
        >
          Separes
        </button>
        <button
          type="button"
          onClick={() => setFiltroTipoMov('venta')}
          className={`px-2 py-1 rounded-lg transition cursor-pointer ${
            filtroTipoMov === 'venta'
              ? 'bg-emerald-500 text-white shadow-xs'
              : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400'
          }`}
        >
          Ventas
        </button>
      </div>
    );

    // Componente de Separes Activos del cliente
    const seccionSeparesActivos = separesActivosCliente.length > 0 && (
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-violet-600 dark:text-violet-400 uppercase text-xs tracking-wider flex items-center gap-1.5">
            <Bookmark size={15} /> Separes Activos ({separesActivosCliente.length})
          </h4>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre)}`)}
            className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            Ver en separes <ChevronRight size={13} />
          </button>
        </div>

        <div className="space-y-2">
          {separesActivosCliente.map((sep: any) => {
            const porcentaje = sep.total > 0 ? Math.min(100, Math.round(((sep.montoPagado || 0) / sep.total) * 100)) : 0;

            return (
              <div 
                key={sep.id} 
                onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre)}`)}
                className="p-3 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-xl cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-all space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs min-w-0 gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                    {sep.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos separados'}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 shrink-0">
                    Activo
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        porcentaje >= 100 
                          ? 'bg-emerald-500' 
                          : porcentaje >= 50 
                            ? 'bg-violet-600' 
                            : 'bg-amber-500'
                      }`} 
                      style={{ width: `${porcentaje}%` }} 
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <span>Pagado: ${(sep.montoPagado || 0).toLocaleString('es-CO')}</span>
                    <span className="text-violet-700 dark:text-violet-300 font-black">Saldo: ${(sep.saldoPendiente || 0).toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    // Notas del cliente
    const seccionNotas = cliente.notas && (
      <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-xs">
        <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">Notas / Referencias:</span>
        <p className="text-slate-700 dark:text-slate-300">{cliente.notas}</p>
      </div>
    );

    return (
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* =========================================================================
            A. VISTA MÓVIL (< 1024px)
            Sin pestañas: Ficha completa continua con cabecera fija y scroll independiente del historial
            ========================================================================= */}
        <div className="lg:hidden flex flex-col h-full overflow-hidden">
          {/* Cabecera Móvil Fija: Nombre, Saldo y Botones de Acción */}
          <div className="shrink-0 p-3.5 sm:p-4 bg-slate-50/90 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            {/* Fila 1: Nombre del cliente + acciones + botón cerrar */}
            <div className="relative pt-0.5 px-1">
              <div className="flex items-center justify-between gap-2 mb-1.5 pr-8">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
                  👤 CLIENTE
                </span>
                {!esCajero && (
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer"
                      title="Editar datos del cliente"
                    >
                      <Edit3 size={11} className="shrink-0 text-slate-500 dark:text-slate-400" />
                      <span>Editar</span>
                    </button>
                    {datosSesion?.esAdmin !== false && (
                      <button
                        type="button"
                        onClick={() => setModalGestion({ isOpen: true, modo: 'eliminar', cliente })}
                        title="Eliminar Cliente"
                        className="p-1 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words">
                    {cliente.nombre}
                  </h2>
                  {cliente.apodo && (
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                      "{cliente.apodo}"
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-0.5">
                  {cliente.celular ? `📱 ${cliente.celular}` : "Sin celular registrado"}
                </p>
                {cliente.direccion && (
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    📍 {cliente.direccion}
                  </p>
                )}
              </div>

              {/* Categorías / Etiquetas personalizadas del cliente en móvil */}
              <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
                {(cliente.etiquetas || []).map((tag: string, i: number) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shadow-2xs"
                  >
                    <Tag size={10} className="shrink-0" />
                    <span>{tag}</span>
                  </span>
                ))}
                {!esCajero && (
                  <button
                    type="button"
                    onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 border border-dashed border-slate-300 dark:border-slate-700 transition cursor-pointer"
                    title="Editar etiquetas del cliente"
                  >
                    <Plus size={10} />
                    <span>{(cliente.etiquetas || []).length === 0 ? "Asignar Etiqueta" : "Editar"}</span>
                  </button>
                )}
              </div>

              {/* Botón cerrar modal en esquina */}
              {isMobileModal && (
                <button 
                  type="button"
                  onClick={() => setClienteFicha(null)} 
                  className="absolute right-0 top-0 p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  aria-label="Cerrar perfil"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Fila 2: Saldo Destacado compacto */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  esNetoAFavor 
                    ? 'text-teal-600 dark:text-teal-400' 
                    : (esNetoAlDia ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {labelSaldo}
                </span>
                <span className={`text-lg font-black ${
                  esNetoAlDia 
                    ? 'text-slate-400' 
                    : (esNetoAFavor ? 'text-teal-600 dark:text-teal-400' : (deudaFiado > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'))
                }`}>
                  {valorSaldoTexto}
                </span>
              </div>

              {saldoSeparesActivos > 0 && (
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-800">
                  {tieneSaldoAFavorFiado ? (
                    <span>A favor: <strong className="text-teal-600 dark:text-teal-400">${Math.round(Math.abs(deudaFiado)).toLocaleString('es-CO')}</strong></span>
                  ) : (
                    <span>Fiados: <strong className="text-rose-600 dark:text-rose-400">${Math.round(deudaFiado).toLocaleString('es-CO')}</strong></span>
                  )}
                  <span className="text-violet-600 dark:text-violet-400">Separes: <strong>${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}</strong></span>
                </div>
              )}
            </div>

            {/* Fila 3: Botones de Acción Rápidos (en fila como en inicio/directorio) */}
            <div className="flex items-center gap-1.5">
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/vender?clienteId=${cliente.id}`)} 
                className="flex-1 py-2 px-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
              >
                Vender
              </button>
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/fiar?clienteId=${cliente.id}`)} 
                className="flex-1 py-2 px-2 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
              >
                Fiar
              </button>
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/abonar?clienteId=${cliente.id}`)} 
                className="flex-1 py-2 px-2 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
              >
                Abonar
              </button>
              {puedeSepare ? (
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/separe?clienteId=${cliente.id}`)} 
                  className="flex-1 py-2 px-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  Separe
                </button>
              ) : separesActivosCliente.length > 0 ? (
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre)}`)} 
                  className="flex-1 py-2 px-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  Ver Separes
                </button>
              ) : null}
            </div>

            {/* Fila 4: Botón WhatsApp */}
            {cliente.celular && puedeEnviarWhatsApp && (
              <button 
                type="button"
                onClick={() => abrirEnlaceWhatsApp(cliente.celular, generarTextoComprobante('estado', cliente))} 
                className="w-full py-2 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl border border-[#25D366]/40 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs"
              >
                <MessageCircle size={15} className="text-[#25D366] fill-[#25D366]/30" />
                <span>Enviar estado de cuenta por WhatsApp</span>
              </button>
            )}
          </div>

          {/* Cuerpo Scrolleable en Móvil: Banner inteligente, Separes, Notas e Historial completo */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4 pb-28">
            {bannerSaldoAFavorSepare}
            {/* Separes activos */}
            {seccionSeparesActivos}

            {/* Notas */}
            {seccionNotas}

            {/* Historial de Movimientos con cabecera y chips de filtro */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-wider">
                    Historial de Movimientos
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {cliente.movimientosHistorial?.length || 0}
                  </span>
                </div>
                {chipsFiltrosHistorial}
              </div>

              {renderListaMovimientos(movimientosFiltrados)}
            </div>
          </div>
        </div>

        {/* =========================================================================
            B. VISTA TABLET EN HORIZONTAL (1024px a 1279px, iPad landscape táctil)
            Barra superior compacta (sin textos truncados) + Historial ancho abajo
            ========================================================================= */}
        <div className={`hidden ${esTabletTactil ? 'lg:flex' : 'hidden'} flex-col h-full overflow-hidden bg-white dark:bg-[#0f172a]`}>
          
          {/* Cabecera Tablet Compacta: Nombre completo, Saldo y Acciones Rápidas */}
          <div className="shrink-0 p-3.5 bg-slate-50/80 dark:bg-[#020617]/90 border-b border-slate-200 dark:border-slate-800 space-y-2.5 backdrop-blur-xs">
            
            {/* Fila 1: Nombre del Cliente sin truncar (Izquierda) + Saldo Compacto (Derecha) */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              
              {/* Lado Izquierdo: Avatar + Badge + Nombre Completo + Opciones */}
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs border border-blue-400/30">
                  {(cliente.nombre || 'C').charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md shrink-0">
                      👤 CLIENTE
                    </span>
                    {!esCajero && (
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalGestion({ isOpen: true, modo: 'editar', cliente });
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                        >
                          <Edit3 size={11} className="shrink-0" />
                          <span>Editar</span>
                        </button>
                        {datosSesion?.esAdmin !== false && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalGestion({ isOpen: true, modo: 'eliminar', cliente });
                            }}
                            title="Eliminar Cliente"
                            className="p-1 rounded-md bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Nombre completo sin corte con puntos suspensivos */}
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words mt-0.5">
                    {cliente.nombre}
                  </h2>
                </div>
              </div>

              {/* Lado Derecho: Tarjeta de Saldo Compacta */}
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs shrink-0 text-right">
                <span className={`text-[9px] font-black uppercase tracking-wider block ${
                  esNetoAFavor 
                    ? 'text-teal-600 dark:text-teal-400' 
                    : (esNetoAlDia ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {labelSaldo}
                </span>
                <span className={`text-lg sm:text-xl font-black tracking-tight ${
                  esNetoAlDia 
                    ? 'text-slate-400' 
                    : (esNetoAFavor ? 'text-teal-600 dark:text-teal-400' : (deudaFiado > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'))
                }`}>
                  {valorSaldoTexto}
                </span>

                {saldoSeparesActivos > 0 && (
                  <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 pt-0.5 border-t border-slate-100 dark:border-slate-800/80">
                    {tieneSaldoAFavorFiado ? (
                      <span>A favor: <strong className="text-teal-600 dark:text-teal-400">${Math.round(Math.abs(deudaFiado)).toLocaleString('es-CO')}</strong></span>
                    ) : (
                      <span>Fiados: ${Math.round(deudaFiado).toLocaleString('es-CO')}</span>
                    )}
                    <span>•</span>
                    <span className="text-violet-600">Separes: ${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fila 2: Apodo, Teléfono, WhatsApp y Botones POS Rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
              {/* Info secundaria: Apodo + Teléfono + Etiquetas */}
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {cliente.apodo && (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800/40 shrink-0">
                    "{cliente.apodo}"
                  </span>
                )}
                {cliente.celular ? (
                  <span className="font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 text-[11px]">
                    📱 {cliente.celular}
                  </span>
                ) : (
                  <span className="italic text-slate-400 text-[11px]">Sin teléfono</span>
                )}
                {(cliente.etiquetas || []).map((tag: string, i: number) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                  >
                    🏷️ {tag}
                  </span>
                ))}
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-1.5 shrink-0">
                {cliente.celular && puedeEnviarWhatsApp && (
                  <button 
                    type="button"
                    onClick={() => abrirEnlaceWhatsApp(cliente.celular, generarTextoComprobante('estado', cliente))} 
                    className="py-1.5 px-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-bold rounded-xl border border-[#25D366]/40 transition active:scale-95 cursor-pointer flex items-center gap-1 text-xs shadow-xs"
                    title="Enviar estado de cuenta por WhatsApp"
                  >
                    <MessageCircle size={14} className="text-[#25D366] fill-[#25D366]/30" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/vender?clienteId=${cliente.id}`)} 
                  className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Vender
                </button>
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/fiar?clienteId=${cliente.id}`)} 
                  className="py-1.5 px-3 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Fiar
                </button>
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/abonar?clienteId=${cliente.id}`)} 
                  className="py-1.5 px-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Abonar
                </button>
                {puedeSepare ? (
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/separe?clienteId=${cliente.id}`)} 
                    className="py-1.5 px-3 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    Separe
                  </button>
                ) : separesActivosCliente.length > 0 ? (
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre)}`)} 
                    className="py-1.5 px-3 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    Separes
                  </button>
                ) : null}
              </div>
            </div>

          </div>

          {/* Cuerpo Scrolleable en Tablet: Banner inteligente, Separes, Notas e Historial a Ancho Completo */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 pb-16">
            {bannerSaldoAFavorSepare}
            {seccionSeparesActivos}
            {seccionNotas}

            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-wider">
                    Historial de Movimientos
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {cliente.movimientosHistorial?.length || 0}
                  </span>
                </div>
                {chipsFiltrosHistorial}
              </div>

              {renderListaMovimientos(movimientosFiltrados)}
            </div>
          </div>

        </div>

        {/* =========================================================================
            C. VISTA ESCRITORIO (>= 1024px en PC / Laptops)
            Diseño Clásico Dividido idéntico a la versión original de escritorio:
            Perfil (5 cols) a la izquierda + Historial (7 cols) a la derecha
            100% fiel a la distribución original solicitada por el usuario
            ========================================================================= */}
        <div className={`hidden ${!esTabletTactil ? 'lg:grid' : 'hidden'} lg:grid-cols-12 h-full divide-x divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-[#0f172a]`}>
          {/* Sub-columna Izquierda (5 cols): Perfil, Saldo, Botones, Separes y Notas */}
          <div className="lg:col-span-5 h-full overflow-y-auto bg-slate-50/40 dark:bg-[#020617]/40 p-4 sm:p-5 space-y-4 pb-12">
            {/* Cabecera de Ficha: Badge, Acciones (Editar/Eliminar) y Nombre */}
            <div className="pt-1 px-1">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full">
                  👤 CLIENTE
                </span>
                {!esCajero && (
                  <div className="inline-flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer"
                      title="Editar datos del cliente"
                    >
                      <Edit3 size={12} className="shrink-0 text-slate-500 dark:text-slate-400" />
                      <span>Editar</span>
                    </button>
                    {datosSesion?.esAdmin !== false && (
                      <button
                        type="button"
                        onClick={() => setModalGestion({ isOpen: true, modo: 'eliminar', cliente })}
                        title="Eliminar Cliente"
                        className="p-1 rounded-lg bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <h2 className="text-[22px] sm:text-[26px] font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words">
                    {cliente.nombre}
                  </h2>
                  {cliente.apodo && (
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                      "{cliente.apodo}"
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
                  {cliente.celular ? `📱 ${cliente.celular}` : "Sin celular registrado"}
                </p>
                {cliente.direccion && (
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    📍 {cliente.direccion}
                  </p>
                )}
              </div>

              {/* Etiquetas */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                {(cliente.etiquetas || []).map((tag: string, i: number) => (
                  <span 
                    key={i} 
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shadow-2xs"
                  >
                    <Tag size={11} className="shrink-0" />
                    <span>{tag}</span>
                  </span>
                ))}
                {!esCajero && (
                  <button
                    type="button"
                    onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 border border-dashed border-slate-300 dark:border-slate-700 transition cursor-pointer"
                    title="Editar etiquetas del cliente"
                  >
                    <Plus size={10} />
                    <span>{(cliente.etiquetas || []).length === 0 ? "Asignar Etiqueta" : "Editar"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Fila 2: Saldo Destacado en tarjeta blanca (idéntico a la versión clásica) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  esNetoAFavor 
                    ? 'text-teal-600 dark:text-teal-400' 
                    : (esNetoAlDia ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {labelSaldo}
                </span>
                <span className={`text-xl sm:text-2xl font-black ${
                  esNetoAlDia 
                    ? 'text-slate-400' 
                    : (esNetoAFavor ? 'text-teal-600 dark:text-teal-400' : (deudaFiado > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'))
                }`}>
                  {valorSaldoTexto}
                </span>
              </div>

              {saldoSeparesActivos > 0 && (
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                  {tieneSaldoAFavorFiado ? (
                    <span>A favor: <strong className="text-teal-600 dark:text-teal-400">${Math.round(Math.abs(deudaFiado)).toLocaleString('es-CO')}</strong></span>
                  ) : (
                    <span>Fiados: <strong className="text-rose-600 dark:text-rose-400">${Math.round(deudaFiado).toLocaleString('es-CO')}</strong></span>
                  )}
                  <span className="text-violet-600 dark:text-violet-400">Separes: <strong>${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}</strong></span>
                </div>
              )}
            </div>

            {/* Fila 3: Botones de Acción Rápidos (Grilla 2x2 para fácil clic y sin apretarse) */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/vender?clienteId=${cliente.id}`)} 
                className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>Vender</span>
              </button>
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/fiar?clienteId=${cliente.id}`)} 
                className="py-2.5 px-3 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>Fiar</span>
              </button>
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/abonar?clienteId=${cliente.id}`)} 
                className={`py-2.5 px-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5 ${(!puedeSepare && separesActivosCliente.length === 0) ? 'col-span-2' : ''}`}
              >
                <span>Abonar</span>
              </button>
              {puedeSepare ? (
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/separe?clienteId=${cliente.id}`)} 
                  className="py-2.5 px-3 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <span>Separe</span>
                </button>
              ) : separesActivosCliente.length > 0 ? (
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre)}`)} 
                  className="py-2.5 px-3 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <span>Ver Separes</span>
                </button>
              ) : null}
            </div>

            {/* Fila 4: Botón WhatsApp Estado de Cuenta (con borde y estilo de la foto) */}
            {cliente.celular && puedeEnviarWhatsApp && (
              <button 
                type="button"
                onClick={() => abrirEnlaceWhatsApp(cliente.celular, generarTextoComprobante('estado', cliente))} 
                className="w-full py-2.5 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl border border-[#25D366]/40 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs"
              >
                <MessageCircle size={16} className="text-[#25D366] fill-[#25D366]/30" />
                <span>Enviar estado de cuenta por WhatsApp</span>
              </button>
            )}

            {/* Banner inteligente saldo a favor -> separe */}
            {bannerSaldoAFavorSepare}

            {/* Separes Activos en Escritorio */}
            {seccionSeparesActivos}

            {/* Notas del cliente en Escritorio */}
            {seccionNotas}
          </div>

          {/* Sub-columna Derecha (7 cols): Historial de Movimientos 100% vertical */}
          <div className="lg:col-span-7 h-full flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#0f172a]">
            {/* Cabecera del historial fija arriba */}
            <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-50/90 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <span className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-wider">
                  Historial de Movimientos
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {cliente.movimientosHistorial?.length || 0}
                </span>
              </div>
              {chipsFiltrosHistorial}
            </div>

            {/* Contenedor scrolleable 100% independiente para transacciones */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 pb-12">
              {renderListaMovimientos(movimientosFiltrados)}
            </div>
          </div>
        </div>

      </div>
    );
  };

  if (!puedeVerCartera) {
    return null;
  }

  return (
    <div className="w-full space-y-4 pb-24 lg:pb-8 pt-1 px-2 sm:px-4">
      <BannerDatosLocales modulo="clientes y cartera" />

      {/* 1. HEADER COMPACTO Y ELEGANTE */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#0f172a] p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push('/dashboard/inicio')}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
            title="Volver al Inicio"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate flex items-center gap-2">
              <span>Directorio de Clientes</span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                {metricasMacro.totalClientes} registrados
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              {metricasMacro.conFiadoCount > 0 || metricasMacro.conSepareCount > 0 ? (
                <>
                  {metricasMacro.conFiadoCount > 0 && `${metricasMacro.conFiadoCount} con fiado`}
                  {metricasMacro.conFiadoCount > 0 && metricasMacro.conSepareCount > 0 && " • "}
                  {metricasMacro.conSepareCount > 0 && `${metricasMacro.conSepareCount} con separe`}
                  {metricasMacro.enRiesgoCount > 0 && ` (${metricasMacro.enRiesgoCount} en riesgo)`}
                </>
              ) : (
                'Todas las cuentas están al día'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModalImportarAbierto(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            title="Importar clientes desde Excel (.xlsx) o CSV"
          >
            <Upload size={14} className="text-blue-500" />
            <span className="hidden sm:inline">Importar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalExportarAbierto(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            title="Exportar clientes a Excel (.xlsx) o CSV"
          >
            <Download size={14} className="text-emerald-500" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const esGratis = datosSesion?.esGratis ?? (datosSesion?.planActual === 'gratis' || datosSesion?.planActual === 'basico');
              const limite = datosSesion?.limiteClientes ?? (esGratis ? 15 : Infinity);
              if (esGratis && clientes.length >= limite) {
                toast.error(`Has alcanzado el límite de ${limite} clientes del Plan Gratuito. Mejora tu plan para registrar clientes ilimitados.`, { duration: 5000 });
                if (!esCajero) setModalSuscripcionClientesOpen(true);
                return;
              }
              setModalNuevoAbierto(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
          >
            <UserPlus size={15} />
            <span className="hidden xs:inline">Nuevo Cliente</span>
            <span className="xs:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* 2. INDICADORES OPCIONALES, OCULTOS POR DEFECTO */}
      <button
        type="button"
        onClick={() => setMostrarIndicadores(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0f172a]/80 text-xs font-black text-slate-600 dark:text-slate-300 hover:border-emerald-300 transition cursor-pointer"
        aria-expanded={mostrarIndicadores}
      >
        <span>{mostrarIndicadores ? 'Ocultar indicadores de cartera' : 'Ver indicadores de cartera'}</span>
        <ChevronDown size={15} className={`transition-transform ${mostrarIndicadores ? 'rotate-180' : ''}`} />
      </button>

      {mostrarIndicadores && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
        {/* Cartera Total (Fiados) */}
        <button
          type="button"
          onClick={() => setFiltroActivo('con_deuda')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filtroActivo === 'con_deuda' 
              ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500' 
              : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cartera en Calle</span>
            <DollarSign size={13} className="text-amber-500" />
          </div>
          <p className="text-sm sm:text-lg font-black text-amber-600 dark:text-amber-400 truncate">
            ${Math.round(metricasMacro.carteraFiadosTotal).toLocaleString('es-CO')}
          </p>
          <div className="text-[10px] text-slate-400 mt-0.5 space-y-0.5 leading-tight">
            <span>{metricasMacro.conFiadoCount} {metricasMacro.conFiadoCount === 1 ? 'fiado activo' : 'fiados activos'}</span>
            {metricasMacro.saldoSeparesTotal > 0 && (
              <span className="text-violet-600 dark:text-violet-400 font-bold block truncate">
                • {metricasMacro.conSepareCount} separe (${Math.round(metricasMacro.saldoSeparesTotal).toLocaleString('es-CO')})
              </span>
            )}
          </div>
        </button>

        {/* Cartera en Riesgo */}
        <button
          type="button"
          onClick={() => setFiltroActivo('en_riesgo')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filtroActivo === 'en_riesgo' 
              ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500' 
              : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <ShieldAlert size={12} /> Riesgo (+30d)
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white">
              {metricasMacro.enRiesgoCount}
            </span>
          </div>
          <p className="text-sm sm:text-lg font-black text-rose-600 dark:text-rose-400 truncate">
            ${Math.round(metricasMacro.dineroEnRiesgo).toLocaleString('es-CO')}
          </p>
          <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            Sin abono en 30 días
          </span>
        </button>

        {/* Clientes VIP */}
        <button
          type="button"
          onClick={() => setFiltroActivo('vip')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filtroActivo === 'vip' 
              ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500' 
              : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Star size={12} className="fill-emerald-500 text-emerald-500" /> Clientes VIP
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-600 text-white">
              {metricasMacro.vipsCount}
            </span>
          </div>
          <p className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
            {metricasMacro.vipsCount} Clientes
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5">
            Alta compra / cumplidos
          </span>
        </button>

        {/* Al Día */}
        <button
          type="button"
          onClick={() => setFiltroActivo('al_dia')}
          className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            filtroActivo === 'al_dia' 
              ? 'bg-slate-700/20 border-slate-600/40 ring-1 ring-slate-500' 
              : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800 hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" /> Al Día ($0)
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {metricasMacro.alDiaCount}
            </span>
          </div>
          <p className="text-sm sm:text-lg font-black text-slate-800 dark:text-white truncate">
            {metricasMacro.alDiaCount} Clientes
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5">
            Sin saldo pendiente
          </span>
        </button>
      </div>}

      {/* 3. BUSCADOR & FILTROS TIPO CHIPS */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono, dirección o notas..."
            className="w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Chips de filtro rápido: sin scroll horizontal, fluido y adaptable */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFiltroActivo('todos')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer ${
              filtroActivo === 'todos'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            Todos ({metricasMacro.totalClientes})
          </button>

          <button
            type="button"
            onClick={() => setFiltroActivo('en_riesgo')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
              filtroActivo === 'en_riesgo'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-300'
            }`}
          >
            <span>🚨 En Riesgo</span>
            <span className="text-[10px] font-black px-1.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
              {metricasMacro.enRiesgoCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroActivo('con_deuda')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
              filtroActivo === 'con_deuda'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-800 hover:border-amber-300'
            }`}
          >
            <span>Con Fiado</span>
            <span className="text-[10px] font-black px-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {metricasMacro.conFiadoCount}
            </span>
          </button>

          {metricasMacro.conSepareCount > 0 && (
            <button
              type="button"
              onClick={() => setFiltroActivo('con_separe')}
              className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                filtroActivo === 'con_separe'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#0f172a] text-violet-600 dark:text-violet-400 border border-slate-200 dark:border-slate-800 hover:border-violet-300'
              }`}
            >
              <span>🔖 Con Separe</span>
              <span className="text-[10px] font-black px-1.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                {metricasMacro.conSepareCount}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFiltroActivo('mayor_deuda')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
              filtroActivo === 'mayor_deuda'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-slate-800 hover:border-orange-300'
            }`}
          >
            <span>Mayor deuda</span>
            <span className="text-[10px] font-black px-1.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300">
              ↓
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroActivo('vip')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
              filtroActivo === 'vip'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 hover:border-emerald-300'
            }`}
          >
            <span>🌟 VIP</span>
            <span className="text-[10px] font-black px-1.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              {metricasMacro.vipsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFiltroActivo('al_dia')}
            className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
              filtroActivo === 'al_dia'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <span>Al Día</span>
            <span className="text-[10px] font-black px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
              {metricasMacro.alDiaCount}
            </span>
          </button>
        </div>

        {/* Chips de Etiquetas personalizadas */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 scrollbar-thin text-xs">
          <div className="flex items-center gap-1 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
            <Tag size={13} className="text-violet-500 shrink-0" />
            <span className="hidden xs:inline">Etiqueta:</span>
          </div>

          <button
            type="button"
            onClick={() => setEtiquetaFiltro(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer ${
              etiquetaFiltro === null
                ? 'bg-violet-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-violet-300'
            }`}
          >
            Todas
          </button>

          {todasLasEtiquetas.map((cat) => {
            const estaActiva = etiquetaFiltro?.toLowerCase() === cat.nombre.toLowerCase();
            return (
              <button
                key={cat.nombre}
                type="button"
                onClick={() => setEtiquetaFiltro(estaActiva ? null : cat.nombre)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer flex items-center gap-1.5 ${
                  estaActiva
                    ? 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-400/40'
                    : 'bg-white dark:bg-[#0f172a] text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-900/60 hover:bg-violet-50 dark:hover:bg-violet-950/40'
                }`}
              >
                <span>🏷️ {cat.nombre}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  estaActiva ? 'bg-white/20 text-white' : 'bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300'
                }`}>
                  {cat.count}
                </span>
                {estaActiva && (
                  <X size={12} className="opacity-80 hover:opacity-100" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setNuevaCatNombre("");
              setClientesAsignarCat([]);
              setModalCategoriasAbierto(true);
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-white hover:bg-violet-600 border border-dashed border-violet-300 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 shrink-0 transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Crear o gestionar etiquetas de clientes"
          >
            <Plus size={13} />
            <span>Nueva Etiqueta</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          4. LAYOUT MAESTRO - DETALLE (2 COLUMNAS EN ESCRITORIO, LISTA + EXPEDIENTE EN MÓVIL)
          ========================================================================= */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start w-full">
        
        {/* COLUMNA IZQUIERDA: LISTA DE CLIENTES / DIRECTORIO (5 cols en lg, 4 cols en xl+) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Contactos ({clientesFiltrados.length})
            </span>
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              Selecciona para ver expediente
            </span>
          </div>

          {cargando ? (
            <div className="py-20 text-center bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800">
              <RefreshCw className="animate-spin text-emerald-600 mx-auto mb-3" size={28} />
              <p className="text-xs font-bold text-slate-500">Cargando directorio de clientes...</p>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-10 text-center border border-slate-100 dark:border-slate-800">
              <Users size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                No se encontraron clientes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {busqueda ? "Intenta con otro término de búsqueda." : "No hay registros en esta categoría."}
              </p>
              {!busqueda && filtroActivo === 'todos' && (
                <button
                  type="button"
                  onClick={() => setModalNuevoAbierto(true)}
                  className="mt-3 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  Registrar Primer Cliente
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs overflow-hidden lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto scrollbar-thin">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 pb-20">
                {clientesFiltrados.map((c) => {
                const inicial = (c.nombre || 'C').charAt(0).toUpperCase();
                const estaSeleccionado = clienteFicha?.id === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => setClienteFicha(c)}
                    className={`flex items-center justify-between p-3 sm:px-4 sm:py-3.5 transition cursor-pointer group ${
                      estaSeleccionado 
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-l-emerald-600' 
                        : c.semaforo === 'riesgo' 
                          ? 'bg-rose-50/20 dark:bg-rose-950/5 hover:bg-rose-50/40 dark:hover:bg-rose-950/10' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Lado Izquierdo: Avatar + Info */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                      {/* Avatar con inicial e indicador VIP */}
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm tracking-tight ${
                          c.semaforo === 'riesgo'
                            ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                            : c.esVip
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {inicial}
                        </div>
                        {c.esVip && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-[9px] shadow-xs">
                            ★
                          </span>
                        )}
                      </div>

                      {/* Nombre y subtítulos */}
                      <div className="min-w-0 flex-1">
                        {/* Fila 1: Nombre en grande + Badge de riesgo (sin que el apodo lo corte) */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 
                            className={`text-sm font-bold truncate transition-colors leading-snug ${
                              estaSeleccionado 
                                ? 'text-emerald-700 dark:text-emerald-400' 
                                : 'text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                            }`}
                            title={c.nombre}
                          >
                            {c.nombre}
                          </h3>
                          {c.semaforo === 'riesgo' && (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0">
                              +30d
                            </span>
                          )}
                        </div>
                        
                        {/* Fila 2: Apodo entrecomillado + Teléfono + Dirección */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 truncate">
                          {c.apodo && (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800/40 shrink-0 truncate max-w-[120px]">
                              "{c.apodo}"
                            </span>
                          )}
                          {c.celular ? (
                            <span className="flex items-center gap-1 shrink-0 text-[11px]">
                              <Phone size={10} className="text-slate-400" />
                              <span>{c.celular}</span>
                            </span>
                          ) : (
                            <span className="italic text-[11px]">Sin tel</span>
                          )}
                          {c.direccion && (
                            <span className="hidden sm:inline-flex items-center gap-0.5 truncate text-[11px]">
                              • <MapPin size={9} className="shrink-0" /> {c.direccion}
                            </span>
                          )}
                        </div>

                        {/* Etiquetas personalizadas del cliente */}
                        {c.etiquetas && c.etiquetas.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {c.etiquetas.map((t, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEtiquetaFiltro(etiquetaFiltro?.toLowerCase() === t.toLowerCase() ? null : t);
                                }}
                                className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                                  etiquetaFiltro?.toLowerCase() === t.toLowerCase()
                                    ? 'bg-violet-600 text-white shadow-2xs'
                                    : 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/40 hover:bg-violet-100'
                                }`}
                                title={`Filtrar por etiqueta "${t}"`}
                              >
                                🏷️ {t}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lado Derecho: Deuda + Botones rápidos */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* Saldo / Estado */}
                      <div className="text-right">
                        <span className={`text-sm sm:text-base font-black tracking-tight block ${
                          (c.totalCompromiso || 0) > 0 
                            ? c.deuda > 0
                              ? (c.semaforo === 'riesgo' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')
                              : 'text-violet-600 dark:text-violet-400'
                            : (c.totalCompromiso || 0) < 0
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          ${Math.round(Math.abs(c.totalCompromiso || 0)).toLocaleString('es-CO')}
                        </span>
                        <span className={`text-[10px] block font-bold ${
                          (c.totalCompromiso || 0) < 0 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 font-medium'
                        }`}>
                          {c.deuda > 0 && (c.saldoSeparesActivos || 0) > 0 ? (
                            `Fiado ${Math.round(c.deuda).toLocaleString('es-CO')} • Separe ${Math.round(c.saldoSeparesActivos).toLocaleString('es-CO')}`
                          ) : c.deuda < 0 && (c.saldoSeparesActivos || 0) > 0 ? (
                            `Separe ${Math.round(c.saldoSeparesActivos).toLocaleString('es-CO')} • Favor ${Math.round(Math.abs(c.deuda)).toLocaleString('es-CO')}`
                          ) : (c.saldoSeparesActivos || 0) > 0 && c.deuda === 0 ? (
                            <span className="text-violet-600 dark:text-violet-400 font-bold">🔖 Separe activo</span>
                          ) : c.deuda > 0 ? (
                            c.diasSinAbonar > 0 ? `Hace ${c.diasSinAbonar}d` : 'Fiado reciente'
                          ) : c.deuda < 0 ? (
                            'Saldo a favor'
                          ) : (
                            'Al día'
                          )}
                        </span>
                      </div>

                      {/* Flecha indicadora */}
                      <div className={`p-1 transition-colors ${estaSeleccionado ? 'text-emerald-600' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-500'}`}>
                        <ChevronRight size={17} />
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: EXPEDIENTE OFICIAL DEL CLIENTE (7 cols en lg, 8 cols en xl+) */}
        <div className="hidden lg:block lg:col-span-7 xl:col-span-8 sticky top-4">
          {clienteActivoDetalle ? (
            <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)]">
              {renderFichaCliente(clienteActivoDetalle, separesClienteActivo, false)}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <Users size={48} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Ningún cliente seleccionado</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Haz clic sobre un cliente de la lista de la izquierda para ver su expediente, saldo y movimientos en tiempo real.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* =========================================================================
          4. FICHA OFICIAL DEL CLIENTE EN MÓVIL (< 1024px)
          Modal bottom sheet con la misma fidelidad estética y sin choques de navegación
          ========================================================================= */}
      {mounted && clienteActivoDetalle && createPortal(
        <div 
          className="lg:hidden fixed inset-0 z-[99999] flex items-end md:items-center justify-center bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 p-0 md:p-6"
          onClick={() => setClienteFicha(null)}
        >
          <div 
            className="bg-white dark:bg-[#0f172a] w-full md:max-w-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] max-h-[92dvh] md:max-h-[85vh] border-t md:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador táctil solo en móvil */}
            <div className="md:hidden w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 shrink-0" />

            {/* Ficha idéntica */}
            {renderFichaCliente(clienteActivoDetalle, separesClienteActivo, true)}
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL UNIFICADO: REGISTRAR NUEVO CLIENTE (SHARED COMPONENT)
          ========================================================================= */}
      <ModalNuevoCliente
        isOpen={modalNuevoAbierto}
        onClose={() => setModalNuevoAbierto(false)}
        onClienteCreado={(nuevoCliente) => {
          setClientes(prev => [nuevoCliente, ...prev.filter(c => c.id !== nuevoCliente.id)]);
        }}
      />

      {/* =========================================================================
          SUB-MODAL: ALERTA DE CÉDULA / DOCUMENTO DUPLICADO AL CREAR (DISEÑO PREMIUM)
          ========================================================================= */}
      {mounted && clienteDocDuplicadoNuevo && createPortal(
        <div 
          onClick={() => setClienteDocDuplicadoNuevo(null)}
          className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Cabecera con Icono */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs border border-amber-200/60 dark:border-amber-800/60">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
                  Documento ya registrado
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                  Esta identificación ya pertenece a otro cliente
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cada cliente debe contar con un número de documento único en tu negocio.
                </p>
              </div>
            </div>

            {/* Tarjeta de Conflicto */}
            <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800/80 space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Documento ingresado:
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-black text-xs tracking-wider border border-amber-500/20">
                  {tipoDocumentoNuevo} {numeroDocumentoNuevo.trim()}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Asignado actualmente a:
                </span>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {clienteDocDuplicadoNuevo.nombre}
                    </p>
                    {clienteDocDuplicadoNuevo.apodo && (
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                        Alias: &ldquo;{clienteDocDuplicadoNuevo.apodo}&rdquo;
                      </p>
                    )}
                    {clienteDocDuplicadoNuevo.celular && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        📱 {clienteDocDuplicadoNuevo.celular}
                      </p>
                    )}
                  </div>
                  {(clienteDocDuplicadoNuevo.deudaTotal || 0) > 0 && (
                    <div className="text-right shrink-0">
                      <span className="text-[9px] uppercase font-bold text-rose-500 block">Deuda actual</span>
                      <span className="font-black text-xs text-rose-600 dark:text-rose-400">
                        ${(clienteDocDuplicadoNuevo.deudaTotal || 0).toLocaleString('es-CO')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Cliente que intentas crear:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                  {nombreNuevo || "(Nuevo)"}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Revisa si hubo una equivocación al escribir el documento, o busca en tu lista a <strong className="text-slate-700 dark:text-slate-300">&ldquo;{clienteDocDuplicadoNuevo.nombre}&rdquo;</strong> si se trata del mismo usuario.
            </p>

            <button
              type="button"
              onClick={() => setClienteDocDuplicadoNuevo(null)}
              className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Entendido, Corregir Documento</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          SUB-MODAL: ALERTA DE CELULAR DUPLICADO AL CREAR (DISEÑO PREMIUM CON OPCIÓN CONTINUAR)
          ========================================================================= */}
      {mounted && clienteCelDuplicadoNuevo && createPortal(
        <div 
          onClick={() => setClienteCelDuplicadoNuevo(null)}
          className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Cabecera con Icono de Celular */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs border border-blue-200/60 dark:border-blue-800/60">
                <Phone size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider mb-1">
                  Celular compartido
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                  Este número de celular ya está registrado
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Puedes continuar si es una línea compartida o corregirlo si fue un error.
                </p>
              </div>
            </div>

            {/* Tarjeta de Comparación */}
            <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800/80 space-y-3.5">
              
              {/* Celular ingresado */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Celular ingresado:
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-black text-xs tracking-wider border border-blue-500/20">
                  📱 {celularNuevo.trim()}
                </span>
              </div>

              {/* Ficha del cliente que ya tiene este celular */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Asociado actualmente a:
                </span>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {clienteCelDuplicadoNuevo.nombre}
                    </p>
                    {clienteCelDuplicadoNuevo.apodo && (
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                        Alias: &ldquo;{clienteCelDuplicadoNuevo.apodo}&rdquo;
                      </p>
                    )}
                    {clienteCelDuplicadoNuevo.numeroDocumento && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        Doc: {clienteCelDuplicadoNuevo.tipoDocumento || 'CC'} {clienteCelDuplicadoNuevo.numeroDocumento}
                      </p>
                    )}
                  </div>
                  {((clienteCelDuplicadoNuevo.deudaTotal || 0) > 0) && (
                    <div className="text-right shrink-0">
                      <span className="text-[9px] uppercase font-bold text-rose-500 block">Deuda actual</span>
                      <span className="font-black text-xs text-rose-600 dark:text-rose-400">
                        ${(clienteCelDuplicadoNuevo.deudaTotal || 0).toLocaleString('es-CO')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cliente que estás creando */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Cliente que intentas crear:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                  {nombreNuevo || "(Nuevo)"}
                </span>
              </div>

            </div>

            {/* Mensaje de orientación */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Si ambos clientes son familiares o comparten el mismo teléfono, puedes continuar. Si fue una equivocación, puedes corregirlo ahora.
            </p>

            {/* Botones de acción: Corregir vs Continuar */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setClienteCelDuplicadoNuevo(null)}
                className="py-3 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-center"
              >
                Corregir Celular
              </button>
              <button
                type="button"
                onClick={() => {
                  setClienteCelDuplicadoNuevo(null);
                  ejecutarCreacionCliente();
                }}
                className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition cursor-pointer text-center"
              >
                Continuar de todos modos
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL: EDITAR / ELIMINAR CLIENTE (INTEGRADO)
          ========================================================================= */}
      {modalGestion.isOpen && modalGestion.cliente && (
        <ModalGestionCliente
          isOpen={modalGestion.isOpen}
          modo={modalGestion.modo}
          cliente={modalGestion.cliente}
          clientesExistentes={clientes}
          onClose={() => setModalGestion({ isOpen: false, modo: 'editar', cliente: null })}
          onSuccess={(clienteActualizado, fueEliminado) => {
            setModalGestion({ isOpen: false, modo: 'editar', cliente: null });
            if (fueEliminado) {
              if (clienteFicha?.id === modalGestion.cliente?.id) {
                setClienteFicha(null);
              }
              toast.success("Cliente eliminado exitosamente.");
            } else if (clienteActualizado) {
              if (clienteFicha?.id === clienteActualizado?.id) {
                setClienteFicha(clienteActualizado);
              }
              toast.success("Cliente actualizado exitosamente.");
            }
          }}
        />
      )}

      {/* =========================================================================
          MODAL: PROCESAR DEVOLUCIÓN
          ========================================================================= */}
      <ModalProcesarDevolucion
        isOpen={modalDevolucion.isOpen}
        ventaOrigen={modalDevolucion.venta as any}
        onClose={() => setModalDevolucion({ isOpen: false, venta: null })}
        onSuccess={() => {
          // No action needed; onSnapshot will update automatically.
        }}
      />

      {/* =========================================================================
          MODAL: TICKET FACTURA / COMPROBANTE TÉRMICO
          ========================================================================= */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
        onFacturaEmitida={(fe) => {
          setModalTicketFactura(prev => ({
            ...prev,
            datos: prev.datos ? { ...prev.datos, facturaElectronica: fe } : null
          }));
          const id = modalTicketFactura.datos?.idTransaccion;
          if (id) {
            setMovimientos(prev => prev.map(m => m.id === id ? { ...m, facturaElectronica: fe } : m));
          }
        }}
      />

      {/* =========================================================================
          MODAL: GESTIONAR ETIQUETAS PERSONALIZADAS
          ========================================================================= */}
      {mounted && modalCategoriasAbierto && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setModalCategoriasAbierto(false); }}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black">
                  <Tag size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Etiquetas de Clientes
                  </h3>
                  <p className="text-xs text-slate-400">Crea etiquetas personalizadas y clasifica a tus clientes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCategoriasAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Sección 1: Crear y asignar nueva etiqueta */}
              <div className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-2xl space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-violet-700 dark:text-violet-300 block">
                  1. Crear nueva etiqueta
                </span>
                <input
                  type="text"
                  value={nuevaCatNombre}
                  onChange={(e) => setNuevaCatNombre(e.target.value)}
                  placeholder="Nombre de etiqueta (ej: Mayoristas, Familia, Vecinos...)"
                  maxLength={25}
                  className="w-full bg-white dark:bg-[#020617] border border-violet-200 dark:border-violet-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      Selecciona los clientes ({clientesAsignarCat.length} seleccionados):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (clientesAsignarCat.length === clientes.length) {
                          setClientesAsignarCat([]);
                        } else {
                          setClientesAsignarCat(clientes.map(c => c.id));
                        }
                      }}
                      className="text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                    >
                      {clientesAsignarCat.length === clientes.length ? "Deseleccionar todos" : "Seleccionar todos"}
                    </button>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {clientes.map((c) => {
                      const seleccionado = clientesAsignarCat.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={seleccionado}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setClientesAsignarCat(prev => [...prev, c.id]);
                                } else {
                                  setClientesAsignarCat(prev => prev.filter(id => id !== c.id));
                                }
                              }}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-bold text-slate-800 dark:text-white truncate">
                              {c.nombre}
                            </span>
                          </div>
                          {c.celular && (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {c.celular}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGuardarCategoriaMasiva}
                  disabled={guardandoCategorias || !nuevaCatNombre.trim() || clientesAsignarCat.length === 0}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {guardandoCategorias ? "Guardando..." : <>Crear y Asignar Etiqueta <Check size={14} /></>}
                </button>
              </div>

              {/* Sección 2: Etiquetas actuales */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  2. Etiquetas existentes en uso
                </span>

                {todasLasEtiquetas.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    Aún no has creado ninguna etiqueta personalizada.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {todasLasEtiquetas.map((cat) => (
                      <div
                        key={cat.nombre}
                        className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">
                            🏷️ {cat.nombre}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                            {cat.count} cliente(s)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEtiquetaFiltro(cat.nombre);
                              setModalCategoriasAbierto(false);
                            }}
                            className="px-2 py-1 text-[11px] font-bold text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg transition cursor-pointer"
                          >
                            Filtrar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarCategoriaGlobal(cat.nombre)}
                            disabled={guardandoCategorias}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                            title="Desvincular etiqueta de todos los clientes"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setModalCategoriasAbierto(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODALES: EXPORTAR E IMPORTAR CLIENTES
          ========================================================================= */}
      <ModalExportarClientes
        isOpen={modalExportarAbierto}
        onClose={() => setModalExportarAbierto(false)}
        todosLosClientes={clientesConAnalisis as any}
        clientesFiltrados={clientesFiltrados as any}
        filtroActivoNombre={filtroActivoNombre}
        nombreNegocio={nombreNegocio}
      />

      <ModalImportarClientes
        isOpen={modalImportarAbierto}
        onClose={() => setModalImportarAbierto(false)}
        cuentaPrincipalId={cuentaPrincipalId}
        clientesExistentes={clientes}
        categoriasExistentes={todasLasEtiquetas.map(e => e.nombre)}
        esPlanGratis={datosSesion?.esGratis ?? (datosSesion?.planActual === 'gratis' || datosSesion?.planActual === 'basico')}
        limitePlan={datosSesion?.limiteClientes ?? 15}
        onSuccess={() => {}}
      />

      {cuentaPrincipalId && (
        <ModalSuscripcion
          isOpen={modalSuscripcionClientesOpen}
          onClose={() => setModalSuscripcionClientesOpen(false)}
          cuentaPrincipalId={cuentaPrincipalId}
          planInicial="comercio"
        />
      )}

      <ModalAnularVenta
        isOpen={modalAnularVenta.isOpen}
        onClose={() => setModalAnularVenta({ isOpen: false, venta: null })}
        venta={modalAnularVenta.venta}
      />

      <ModalAnularAbono
        isOpen={modalAnularAbono.isOpen}
        onClose={() => setModalAnularAbono({ isOpen: false, movimiento: null, cliente: null })}
        movimiento={modalAnularAbono.movimiento}
        clienteNombre={modalAnularAbono.cliente?.nombre || modalAnularAbono.movimiento?.clienteNombre || 'Cliente'}
        clienteDeudaActual={modalAnularAbono.cliente?.deudaTotal || 0}
        onSuccess={() => {
          // Las suscripciones en tiempo real de Firestore actualizarán clientes y movimientos automáticamente
        }}
      />
    </div>
  );
}
