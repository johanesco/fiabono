"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
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
import ModalProcesarDevolucion from "@/components/ModalProcesarDevolucion";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalExportarClientes from "@/components/clientes/ModalExportarClientes";
import ModalImportarClientes from "@/components/clientes/ModalImportarClientes";
import toast from "react-hot-toast";
import { 
  RotateCcw,
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
  Smile
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
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'con_deuda' | 'en_riesgo' | 'mayor_deuda' | 'vip' | 'al_dia'>('todos');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
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

  // Modal Historial / Ficha del Cliente
  const [clienteFicha, setClienteFicha] = useState<any | null>(null);
  // Filtro de movimientos en historial: 'todos' | 'venta' | 'fiado' | 'abono'
  const [filtroTipoMov, setFiltroTipoMov] = useState<'todos' | 'venta' | 'fiado' | 'abono'>('todos');

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

      // Total comprado histórico (ventas + fiados)
      const totalComprado = movsCliente
        .filter((m) => m.tipo === 'venta' || m.tipo === 'fiado')
        .reduce((acc, m) => acc + (m.monto || 0), 0);

      // Total abonado histórico
      const totalAbonado = movsCliente
        .filter((m) => m.tipo === 'abono')
        .reduce((acc, m) => acc + (m.monto || 0), 0);

      // Último abono
      const abonosOrdenados = movsCliente
        .filter((m) => m.tipo === 'abono' && m.fecha)
        .sort((a, b) => {
          const tA = obtenerFechaJS(a.fecha)?.getTime() || 0;
          const tB = obtenerFechaJS(b.fecha)?.getTime() || 0;
          return tB - tA;
        });

      const ultimoAbonoMov = abonosOrdenados[0] || null;
      const fechaUltimoAbono = ultimoAbonoMov ? obtenerFechaJS(ultimoAbonoMov.fecha) : null;

      // Último movimiento en general
      const movsOrdenados = [...movsCliente].sort((a, b) => {
        const tA = obtenerFechaJS(a.fecha)?.getTime() || 0;
        const tB = obtenerFechaJS(b.fecha)?.getTime() || 0;
        return tB - tA;
      });
      const ultimoMov = movsOrdenados[0] || null;
      const fechaUltimoMov = ultimoMov ? obtenerFechaJS(ultimoMov.fecha) : (c.fecha_creacion ? obtenerFechaJS(c.fecha_creacion) : null);

      // Cálculo de días sin abonar
      let diasSinAbonar = 0;
      if (deuda > 0) {
        if (fechaUltimoAbono) {
          diasSinAbonar = Math.max(0, Math.floor((hoyMs - fechaUltimoAbono.getTime()) / (1000 * 60 * 60 * 24)));
        } else if (fechaUltimoMov) {
          diasSinAbonar = Math.max(0, Math.floor((hoyMs - fechaUltimoMov.getTime()) / (1000 * 60 * 60 * 24)));
        } else {
          diasSinAbonar = 31; // Asumir riesgo si debe y no hay registro
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
        totalComprado,
        totalAbonado,
        movimientosCount: movsCliente.length,
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
  }, [clientes, movimientos, hoyMs]);

  // 4. Métricas Consolidadas Macro
  const metricasMacro = useMemo(() => {
    const totalClientes = clientesConAnalisis.length;
    const conDeuda = clientesConAnalisis.filter((c) => c.deuda > 0);
    const carteraTotal = conDeuda.reduce((acc, c) => acc + c.deuda, 0);

    const enRiesgo = clientesConAnalisis.filter((c) => c.semaforo === 'riesgo');
    const dineroEnRiesgo = enRiesgo.reduce((acc, c) => acc + c.deuda, 0);

    const vips = clientesConAnalisis.filter((c) => c.esVip);
    const alDia = clientesConAnalisis.filter((c) => c.deuda === 0);

    return {
      totalClientes,
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
      if (filtroActivo === 'con_deuda') return c.deuda > 0;
      if (filtroActivo === 'en_riesgo') return c.semaforo === 'riesgo';
      if (filtroActivo === 'mayor_deuda') return c.deuda > 0;
      if (filtroActivo === 'vip') return c.esVip;
      if (filtroActivo === 'al_dia') return c.deuda === 0;

      return true;
    }).sort((a, b) => {
      // Ordenar por prioridad: primero los de mayor riesgo/deuda
      if (filtroActivo === 'en_riesgo' || filtroActivo === 'con_deuda' || filtroActivo === 'mayor_deuda') {
        return b.deuda - a.deuda;
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
    if (filtroActivo === 'con_deuda') base = "Con Deuda Activa";
    else if (filtroActivo === 'en_riesgo') base = "En Riesgo (+30 días)";
    else if (filtroActivo === 'mayor_deuda') base = "Mayor Deuda";
    else if (filtroActivo === 'vip') base = "Clientes VIP";
    else if (filtroActivo === 'al_dia') base = "Cuentas al Día";
    if (etiquetaFiltro) base += ` • Categoría: ${etiquetaFiltro}`;
    if (busqueda.trim()) base += ` • Búsqueda: "${busqueda.trim()}"`;
    return base;
  }, [filtroActivo, etiquetaFiltro, busqueda]);

  // En pantallas grandes (>= 1024px), si no hay cliente seleccionado, auto-seleccionar el primero
  useEffect(() => {
    if (!clienteFicha && clientesFiltrados.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setClienteFicha(clientesFiltrados[0]);
    }
  }, [clientesFiltrados, clienteFicha]);

  // Si el cliente seleccionado cambia en datos reales, mantenerlo actualizado
  useEffect(() => {
    if (clienteFicha) {
      const actualizado = clientesConAnalisis.find(c => c.id === clienteFicha.id);
      if (actualizado && JSON.stringify(actualizado) !== JSON.stringify(clienteFicha)) {
        setClienteFicha(actualizado);
      }
    }
  }, [clientesConAnalisis]);

  // Mensaje de comprobante / estado de cuenta idéntico al estándar oficial de Historial e Inicio
  const generarTextoComprobante = (tipo: 'estado' | 'comprobante' = 'estado', cliente: any = {}) => {
    const deuda = cliente.deudaTotal !== undefined ? cliente.deudaTotal : (cliente.deuda || 0);
    const saldoFormat = `$${Math.abs(deuda).toLocaleString('es-CO')}`;
    const nombreCliente = cliente.nombre || 'Cliente';
    const nombreTienda = nombreNegocio || 'nuestra tienda';
    let texto = '';

    if (tipo === 'estado') {
      texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente presentas un saldo pendiente de: *${saldoFormat}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;

      if (deuda === 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Tu cuenta se encuentra al día.

Gracias por seguir con nosotros.

*¡Que tengas un gran día!*`;
      } else if (deuda < 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente tienes un saldo a favor de: *${saldoFormat}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      }
    }

    const ultimoAbono = Array.isArray(cliente.movimientosHistorial)
      ? cliente.movimientosHistorial
          .filter((mov: any) => mov.tipo === 'abono' && mov.fecha)
          .sort((a: any, b: any) => (obtenerFechaJS(b.fecha)?.getTime() || 0) - (obtenerFechaJS(a.fecha)?.getTime() || 0))[0]
      : undefined;
    return agregarMediosPagoAlEstado(texto, datosSesion?.mediosPago, nombreTienda, deuda, ultimoAbono);
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
      const respuesta = await fetch('/api/clientes/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          nombre: nombreNuevo, 
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
    if (!nombreNuevo.trim()) {
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
    const tieneSaldoAFavor = deudaFiado < 0;
    const totalCompromiso = tieneSaldoAFavor ? Math.abs(deudaFiado) : (deudaFiado + saldoSeparesActivos);
    const separesActivosCliente = separesList.filter((s: any) => s.estado === 'activo');

    // Filtrado de movimientos por tipo en el expediente (sin hook useMemo dentro de función auxiliar)
    const todosMovs = cliente.movimientosHistorial || [];
    const movimientosFiltrados = filtroTipoMov === 'todos' 
      ? todosMovs 
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

            return (
              <div 
                key={mov.id} 
                className={`p-2 sm:p-2.5 bg-slate-50 dark:bg-[#020617] rounded-xl border ${mov.tipo === 'devolucion' ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-100 dark:border-slate-800'} shadow-xs relative overflow-hidden space-y-1 sm:space-y-1.5`}
              >
                {/* Barra lateral de color según el tipo */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  mov.tipo === 'devolucion' ? 'bg-amber-500' :
                  mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')
                }`} />
                
                <div className="pl-1 sm:pl-1.5">
                  <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-1 pb-1 border-b border-slate-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                        mov.tipo === 'devolucion'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                          : mov.tipo === 'fiado' 
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' 
                          : (mov.tipo === 'venta' 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')
                      }`}>
                        {mov.tipo === 'devolucion' ? '↩ DEVOLUCIÓN' : mov.tipo}
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
                    
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:text-[11px] font-bold uppercase">
                      {mov.registradoPor && (
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          👤  {mov.registradoPor}
                        </span>
                      )}
                      {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
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
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Total:</span>
                    <div className="flex items-center gap-2">
                      {esVentaOFiado && mov.detalles && mov.detalles.length > 0 && (!esCajero || datosSesion?.permisos?.hacerDevoluciones) && (
                        <button
                          type="button"
                          onClick={() => setModalDevolucion({ isOpen: true, venta: mov })}
                          className="text-[10px] font-bold px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded-lg transition-colors cursor-pointer border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                        >
                          <RotateCcw size={12} /> Hacer Devolución
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => abrirTicketDeMovimiento(mov, cliente)}
                        title="Imprimir Factura / Ticket"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <Printer size={15} />
                      </button>
                      <span className={`text-base sm:text-lg ${
                        mov.tipo === 'devolucion' ? 'text-amber-500' :
                        mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')
                      }`}>
                        {mov.tipo === 'fiado' || mov.tipo === 'devolucion' ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}
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
            {/* Fila 1: Nombre del cliente + botón cerrar */}
            <div className="relative text-center pt-0.5 px-7">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full mb-1">
                👤 CLIENTE
              </span>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words">
                  {cliente.nombre}
                </h2>
                {cliente.apodo && (
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                    "{cliente.apodo}"
                  </span>
                )}
                {!esCajero && (
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                      title="Modificar Cliente"
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                    >
                      <Edit3 size={13} />
                    </button>
                    {datosSesion?.esAdmin !== false && (
                      <button
                        type="button"
                        onClick={() => setModalGestion({ isOpen: true, modo: 'eliminar', cliente })}
                        title="Eliminar Cliente"
                        className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
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
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  tieneSaldoAFavor 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : (totalCompromiso === 0 ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {tieneSaldoAFavor ? 'Saldo a Favor' : (totalCompromiso === 0 ? 'Estado' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                </span>
                <span className={`text-lg font-black ${
                  !tieneSaldoAFavor && totalCompromiso === 0 
                    ? 'text-slate-400' 
                    : (tieneSaldoAFavor ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                }`}>
                  {!tieneSaldoAFavor && totalCompromiso === 0 ? 'Al Día' : `$${Math.round(Math.abs(totalCompromiso)).toLocaleString('es-CO')}`}
                </span>
              </div>

              {saldoSeparesActivos > 0 && (
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-800">
                  {tieneSaldoAFavor ? (
                    <span>A favor: <strong className="text-emerald-600 dark:text-emerald-400">${Math.round(Math.abs(deudaFiado)).toLocaleString('es-CO')}</strong></span>
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

          {/* Cuerpo Scrolleable en Móvil: Separes, Notas e Historial completo */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4 pb-28">
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
            B. VISTA TABLET & ESCRITORIO (>= 1024px)
            Diseño Ejecutivo Tipo iPadOS Master-Detail:
            - Cabecera Fija Compacta: Perfil + Saldo + Barra de Acciones y WhatsApp
            - Cuerpo Inferior Scrolleable: Separes Activos, Notas e Historial de Movimientos a ancho completo
            ========================================================================= */}
        <div className="hidden lg:flex flex-col h-full overflow-hidden bg-white dark:bg-[#0f172a]">
          
          {/* Cabecera Ejecutiva Fija: Perfil, Saldo y Acciones Rápidas */}
          <div className="shrink-0 p-4 sm:p-5 bg-slate-50/80 dark:bg-[#020617]/90 border-b border-slate-200 dark:border-slate-800 space-y-3.5 backdrop-blur-xs">
            
            {/* Fila 1: Datos del Cliente (Izquierda) + Saldo Destacado (Derecha) */}
            <div className="flex items-start justify-between gap-3 min-w-0">
              
              {/* Lado Izquierdo: Avatar + Nombre + Apodo + Teléfono + Categorías */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Avatar con inicial */}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs border border-blue-400/30">
                  {(cliente.nombre || 'C').charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  {/* Badge + Nombre + Apodo + Opciones de edición */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">
                      👤 CLIENTE
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                      {cliente.nombre}
                    </h2>
                    {cliente.apodo && (
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/40 shrink-0">
                        "{cliente.apodo}"
                      </span>
                    )}
                    {!esCajero && (
                      <div className="inline-flex items-center gap-1 shrink-0 ml-1">
                        <button
                          type="button"
                          onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                          title="Modificar Cliente"
                          className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition active:scale-95"
                        >
                          <Edit3 size={13} />
                        </button>
                        {datosSesion?.esAdmin !== false && (
                          <button
                            type="button"
                            onClick={() => setModalGestion({ isOpen: true, modo: 'eliminar', cliente })}
                            title="Eliminar Cliente"
                            className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition active:scale-95"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Teléfono, Dirección y Categorías */}
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    {cliente.celular ? (
                      <span className="font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">
                        📱 {cliente.celular}
                      </span>
                    ) : (
                      <span className="italic text-slate-400 text-[11px]">Sin teléfono</span>
                    )}

                    {cliente.direccion && (
                      <span className="text-slate-400 text-[11px] inline-flex items-center gap-1 truncate max-w-xs">
                        📍 {cliente.direccion}
                      </span>
                    )}

                    {/* Categorías / Etiquetas */}
                    {(cliente.etiquetas || []).map((tag: string, i: number) => (
                      <span 
                        key={i} 
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shadow-2xs"
                      >
                        <Tag size={10} className="shrink-0" />
                        <span>{tag}</span>
                      </span>
                    ))}
                    {!esCajero && (
                      <button
                        type="button"
                        onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md text-slate-500 hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 border border-dashed border-slate-300 dark:border-slate-700 transition cursor-pointer"
                        title="Editar etiquetas del cliente"
                      >
                        <Plus size={9} />
                        <span>{(cliente.etiquetas || []).length === 0 ? "Etiqueta" : "Editar"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Lado Derecho: Tarjeta de Saldo Destacado */}
              <div className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs shrink-0 text-right min-w-[150px] sm:min-w-[190px]">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  tieneSaldoAFavor 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : (totalCompromiso === 0 ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {tieneSaldoAFavor ? 'Saldo a Favor' : (totalCompromiso === 0 ? 'Estado' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                </span>
                <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                  !tieneSaldoAFavor && totalCompromiso === 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : (tieneSaldoAFavor ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                }`}>
                  {!tieneSaldoAFavor && totalCompromiso === 0 ? 'Al Día' : `$${Math.round(Math.abs(totalCompromiso)).toLocaleString('es-CO')}`}
                </span>

                {saldoSeparesActivos > 0 && (
                  <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 pt-1 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                    {tieneSaldoAFavor ? (
                      <span>A favor: <strong className="text-emerald-600 dark:text-emerald-400">${Math.round(Math.abs(deudaFiado)).toLocaleString('es-CO')}</strong></span>
                    ) : (
                      <span>Fiados: <strong className="text-rose-600 dark:text-rose-400">${Math.round(deudaFiado).toLocaleString('es-CO')}</strong></span>
                    )}
                    <span>•</span>
                    <span className="text-violet-600 dark:text-violet-400">Separes: <strong>${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Fila 2: Barra de Botones de Acción Táctiles y WhatsApp */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
              {/* Botón WhatsApp */}
              {cliente.celular && puedeEnviarWhatsApp ? (
                <button 
                  type="button"
                  onClick={() => abrirEnlaceWhatsApp(cliente.celular, generarTextoComprobante('estado', cliente))} 
                  className="py-2 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-bold rounded-xl border border-[#25D366]/40 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                  title="Enviar estado de cuenta a WhatsApp"
                >
                  <MessageCircle size={15} className="text-[#25D366] fill-[#25D366]/30" />
                  <span>WhatsApp</span>
                </button>
              ) : <div />}

              {/* Botones POS Rápidos */}
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/vender?clienteId=${cliente.id}`)} 
                  className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Vender</span>
                </button>
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/fiar?clienteId=${cliente.id}`)} 
                  className="py-2 px-3.5 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Fiar</span>
                </button>
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/abonar?clienteId=${cliente.id}`)} 
                  className="py-2 px-3.5 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Abonar</span>
                </button>
                {puedeSepare ? (
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/separe?clienteId=${cliente.id}`)} 
                    className="py-2 px-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Separe</span>
                  </button>
                ) : separesActivosCliente.length > 0 ? (
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(cliente.nombre)}`)} 
                    className="py-2 px-3.5 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Ver Separes</span>
                  </button>
                ) : null}
              </div>
            </div>

          </div>

          {/* Cuerpo Scrolleable a Ancho Completo: Separes, Notas e Historial */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 pb-8 overscroll-contain">
            {/* Separes activos */}
            {seccionSeparesActivos}

            {/* Notas del cliente */}
            {seccionNotas}

            {/* Cabecera del Historial con Filtros */}
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

              {/* Lista de movimientos espaciosa y sin compresión */}
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
    <div className="min-h-screen pb-24 lg:pb-8 pt-1 px-2 sm:px-4 w-full space-y-4">

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
              {metricasMacro.conDeudaCount > 0 
                ? `${metricasMacro.conDeudaCount} con saldo pendiente (${metricasMacro.enRiesgoCount} en riesgo)` 
                : 'Todas las cuentas están al día'}
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
            onClick={() => setModalNuevoAbierto(true)}
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
        {/* Cartera Total */}
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
            ${Math.round(metricasMacro.carteraTotal).toLocaleString('es-CO')}
          </p>
          <span className="text-[10px] text-slate-400 mt-0.5">
            {metricasMacro.conDeudaCount} fiados activos
          </span>
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
            <span>Con Deuda</span>
            <span className="text-[10px] font-black px-1.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
              {metricasMacro.conDeudaCount}
            </span>
          </button>

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
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden lg:h-[calc(100vh-210px)] lg:overflow-y-auto overscroll-contain">
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
                          c.deuda > 0 
                            ? c.semaforo === 'riesgo' 
                              ? 'text-rose-600 dark:text-rose-400' 
                              : 'text-amber-600 dark:text-amber-400' 
                            : c.deuda < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          ${Math.round(Math.abs(c.deuda)).toLocaleString('es-CO')}
                        </span>
                        <span className={`text-[10px] block font-bold ${
                          c.deuda < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 font-medium'
                        }`}>
                          {c.deuda > 0 ? (
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
          )}
        </div>

        {/* COLUMNA DERECHA: EXPEDIENTE OFICIAL DEL CLIENTE (7 cols en lg, 8 cols en xl+) */}
        <div className="hidden lg:block lg:col-span-7 xl:col-span-8 sticky top-4">
          {clienteActivoDetalle ? (
            <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:h-[calc(100vh-210px)]">
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
      {clienteActivoDetalle && (
        <div 
          className="lg:hidden fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 p-0 md:p-6"
          onClick={() => setClienteFicha(null)}
        >
          <div 
            className="bg-white dark:bg-[#0f172a] w-full md:max-w-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] max-h-[90vh] md:max-h-[85vh] border-t md:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador táctil solo en móvil */}
            <div className="md:hidden w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 shrink-0" />

            {/* Ficha idéntica */}
            {renderFichaCliente(clienteActivoDetalle, separesClienteActivo, true)}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REGISTRAR NUEVO CLIENTE
          ========================================================================= */}
      {modalNuevoAbierto && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setModalNuevoAbierto(false); }}
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Registrar Nuevo Cliente
                  </h3>
                  <p className="text-xs text-slate-400">Guarda datos para fiados, separes y WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGuardarNuevoCliente} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Ej: Doña Carmen, Andrés Pérez..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Smile size={13} className="text-amber-500" /> Apodo / Alias (Opcional)
                </label>
                <input
                  type="text"
                  value={apodoNuevo}
                  onChange={(e) => setApodoNuevo(e.target.value)}
                  placeholder="Ej: Cachaco, El Paisa, Doña Mary..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Documento (CC / NIT / CE) */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Tipo Doc.
                  </label>
                  <select
                    value={tipoDocumentoNuevo}
                    onChange={(e) => setTipoDocumentoNuevo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">CE</option>
                    <option value="PP">Pasaporte</option>
                    <option value="TI">TI</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Cédula / Documento (Opcional)
                  </label>
                  <input
                    type="text"
                    value={numeroDocumentoNuevo}
                    onChange={(e) => setNumeroDocumentoNuevo(e.target.value)}
                    placeholder="Ej: 1020304050"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Celular (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={celularNuevo}
                  onChange={(e) => setCelularNuevo(e.target.value)}
                  placeholder="Ej: 3101234567"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Dirección o Referencia
                </label>
                <input
                  type="text"
                  value={direccionNueva}
                  onChange={(e) => setDireccionNueva(e.target.value)}
                  placeholder="Ej: Carrera 5 # 12-30 / Casa esquinera"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Saldo Inicial Pendiente Opcional */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <DollarSign size={13} className="text-amber-500" /> Saldo Inicial Pendiente (Opcional)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Si ya te debía dinero</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                  <input
                    type="text"
                    value={saldoInicialNuevo ? Number(saldoInicialNuevo).toLocaleString('es-CO') : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setSaldoInicialNuevo(val);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-bold text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Notas / Referencias (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notasNuevas}
                  onChange={(e) => setNotasNuevas(e.target.value)}
                  placeholder="Ej: Parentesco (Hermana de Juan), casa azul frente al parque..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Etiquetas en Modal Nuevo Cliente */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Tag size={13} className="text-violet-500" /> Etiquetas Personalizadas (Opcional)
                </label>
                {etiquetasNuevas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {etiquetasNuevas.map((t, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                        🏷️ {t}
                        <button
                          type="button"
                          onClick={() => setEtiquetasNuevas(prev => prev.filter((_, i) => i !== idx))}
                          className="hover:text-rose-500 p-0.5 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputEtiquetaNueva}
                    onChange={(e) => setInputEtiquetaNueva(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const valor = inputEtiquetaNueva.trim();
                        if (valor) {
                          const partes = valor.split(/[,;-]/).map(t => t.trim()).filter(Boolean);
                          setEtiquetasNuevas(prev => {
                            const lista = [...prev];
                            partes.forEach(p => {
                              if (!lista.some(exist => exist.toLowerCase() === p.toLowerCase())) {
                                lista.push(p);
                              }
                            });
                            return lista;
                          });
                          setInputEtiquetaNueva("");
                        }
                      }
                    }}
                    placeholder="Ej: Mayorista, Vecino, Familia (o escribe y da Guardar)"
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const valor = inputEtiquetaNueva.trim();
                      if (valor) {
                        const partes = valor.split(/[,;-]/).map(t => t.trim()).filter(Boolean);
                        setEtiquetasNuevas(prev => {
                          const lista = [...prev];
                          partes.forEach(p => {
                            if (!lista.some(exist => exist.toLowerCase() === p.toLowerCase())) {
                              lista.push(p);
                            }
                          });
                          return lista;
                        });
                        setInputEtiquetaNueva("");
                      }
                    }}
                    disabled={!inputEtiquetaNueva.trim()}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer shrink-0"
                  >
                    <Plus size={13} /> Agregar
                  </button>
                </div>
                {todasLasEtiquetas.some(cat => !etiquetasNuevas.some(e => e.toLowerCase() === cat.nombre.toLowerCase())) && (
                  <div className="flex flex-wrap items-center gap-1 pt-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold">Existentes:</span>
                    {todasLasEtiquetas
                      .filter(cat => !etiquetasNuevas.some(e => e.toLowerCase() === cat.nombre.toLowerCase()))
                      .slice(0, 6)
                      .map((cat) => (
                        <button
                          key={cat.nombre}
                          type="button"
                          onClick={() => {
                            setEtiquetasNuevas(prev => [...prev, cat.nombre]);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-violet-50 dark:bg-slate-800 dark:hover:bg-violet-950/40 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-300 border border-slate-200/60 dark:border-slate-700 transition cursor-pointer"
                        >
                          + {cat.nombre}
                        </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalNuevoAbierto(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCliente}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {guardandoCliente ? "Guardando..." : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-MODAL: ALERTA DE CÉDULA / DOCUMENTO DUPLICADO AL CREAR (DISEÑO PREMIUM)
          ========================================================================= */}
      {clienteDocDuplicadoNuevo && (
        <div 
          onClick={() => setClienteDocDuplicadoNuevo(null)}
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
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
        </div>
      )}

      {/* =========================================================================
          SUB-MODAL: ALERTA DE CELULAR DUPLICADO AL CREAR (DISEÑO PREMIUM CON OPCIÓN CONTINUAR)
          ========================================================================= */}
      {clienteCelDuplicadoNuevo && (
        <div 
          onClick={() => setClienteCelDuplicadoNuevo(null)}
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
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
        </div>
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
      {modalCategoriasAbierto && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setModalCategoriasAbierto(false); }}
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
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
        </div>
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
    </div>
  );
}
