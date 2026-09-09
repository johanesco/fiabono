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
import { db } from "../../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import { Cliente, Movimiento, Separe } from "@/types";
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";
import ModalGestionCliente from "@/components/ModalGestionCliente";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import toast from "react-hot-toast";
import { 
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
  Bookmark
} from "lucide-react";

export default function ClientesPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando directorio de clientes...</div>}>
      <ClientesContenido />
    </Suspense>
  );
}

function ClientesContenido() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const puedeSepare = Boolean(datosSesion?.puedeSepare ?? true);
  const esCajero = datosSesion?.rol === 'cajero';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [separes, setSepares] = useState<Separe[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados de interfaz
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'con_deuda' | 'en_riesgo' | 'vip' | 'al_dia'>('todos');

  // Modales
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [direccionNueva, setDireccionNueva] = useState("");
  const [notasNuevas, setNotasNuevas] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

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
    datos: null,
  });

  // Modal Historial / Ficha del Cliente
  const [clienteFicha, setClienteFicha] = useState<any | null>(null);
  // Filtro de movimientos en historial: 'todos' | 'venta' | 'fiado' | 'abono'
  const [filtroTipoMov, setFiltroTipoMov] = useState<'todos' | 'venta' | 'fiado' | 'abono'>('todos');

  // 1. Cargar Clientes en Tiempo Real
  useEffect(() => {
    if (!cuentaPrincipalId) return;

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
  }, [cuentaPrincipalId]);

  // 2. Cargar Movimientos para Inteligencia de Comportamiento
  useEffect(() => {
    if (!cuentaPrincipalId) return;

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
  }, [cuentaPrincipalId]);

  // 3. Cargar Separes del Negocio
  useEffect(() => {
    if (!cuentaPrincipalId) return;

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
  }, [cuentaPrincipalId]);

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

  // 5. Filtrado por Búsqueda y Pestañas
  const clientesFiltrados = useMemo(() => {
    return clientesConAnalisis.filter((c) => {
      // Filtro de texto
      const coincideBusqueda = 
        !busqueda.trim() ||
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (c.celular && c.celular.includes(busqueda)) ||
        (c.direccion && c.direccion.toLowerCase().includes(busqueda.toLowerCase())) ||
        (c.notas && c.notas.toLowerCase().includes(busqueda.toLowerCase()));

      if (!coincideBusqueda) return false;

      // Filtro de pestaña
      if (filtroActivo === 'con_deuda') return c.deuda > 0;
      if (filtroActivo === 'en_riesgo') return c.semaforo === 'riesgo';
      if (filtroActivo === 'vip') return c.esVip;
      if (filtroActivo === 'al_dia') return c.deuda === 0;

      return true;
    }).sort((a, b) => {
      // Ordenar por prioridad: primero los de mayor riesgo/deuda
      if (filtroActivo === 'en_riesgo' || filtroActivo === 'con_deuda') {
        return b.deuda - a.deuda;
      }
      if (filtroActivo === 'vip') {
        return b.totalComprado - a.totalComprado;
      }
      return a.nombre.localeCompare(b.nombre);
    });
  }, [clientesConAnalisis, busqueda, filtroActivo]);

  // Cliente activo para la ficha derecha en escritorio o modal móvil
  const clienteActivoDetalle = useMemo(() => {
    if (!clienteFicha) return null;
    return clientesConAnalisis.find(c => c.id === clienteFicha.id) || clienteFicha;
  }, [clienteFicha, clientesConAnalisis]);

  const separesClienteActivo = useMemo(() => {
    if (!clienteActivoDetalle) return [];
    return separes.filter(s => s.clienteId === clienteActivoDetalle.id);
  }, [clienteActivoDetalle, separes]);

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

    return texto;
  };

  // Abrir comprobante en modal térmico
  const abrirTicketDeMovimiento = (mov: Movimiento, clienteTarget?: any) => {
    if (mov.tipo === 'ingreso_inventario') return;

    const clienteEncontrado = clienteTarget || clientes.find(c => c.id === mov.clienteId);
    const nombreCli = mov.clienteId === 'mostrador' ? 'Venta de Mostrador' : (clienteEncontrado?.nombre || mov.clienteNombre || 'Cliente');
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
      porcentajeIva: mov.porcentajeIva
    };

    setModalTicketFactura({ visible: true, datos: datosTicket });
  };

  // 6. Acción: Cobrar o escribir por WhatsApp desde la lista
  const handleCobrarWhatsApp = (cliente: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!cliente.celular) {
      toast.error("Este cliente no tiene número de celular registrado.");
      return;
    }

    const mensaje = generarTextoComprobante('estado', cliente);
    abrirEnlaceWhatsApp(cliente.celular, mensaje);
  };

  // 7. Acción: Crear Nuevo Cliente
  const handleGuardarNuevoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevo.trim()) {
      toast.error("El nombre del cliente es obligatorio.");
      return;
    }

    try {
      setGuardandoCliente(true);
      const docRef = await addDoc(collection(db, "clientes"), {
        nombre: nombreNuevo.trim(),
        celular: celularNuevo.trim() || "",
        direccion: direccionNueva.trim() || "",
        notas: notasNuevas.trim() || "",
        deudaTotal: 0,
        usuarioId: cuentaPrincipalId,
        fecha_creacion: serverTimestamp()
      });

      const nuevoObj = {
        id: docRef.id,
        nombre: nombreNuevo.trim(),
        celular: celularNuevo.trim() || "",
        direccion: direccionNueva.trim() || "",
        notas: notasNuevas.trim() || "",
        deudaTotal: 0,
        usuarioId: cuentaPrincipalId,
      } as Cliente;

      toast.success(`Cliente ${nombreNuevo.trim()} registrado con éxito ✨`);
      setModalNuevoAbierto(false);
      setNombreNuevo("");
      setCelularNuevo("");
      setDireccionNueva("");
      setNotasNuevas("");
      setClienteFicha(nuevoObj);
    } catch (err) {
      console.error("Error al crear cliente:", err);
      toast.error("No se pudo registrar el cliente.");
    } finally {
      setGuardandoCliente(false);
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
    const totalCompromiso = deudaFiado + saldoSeparesActivos;
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
        <div className="space-y-2.5">
          {movs.map((mov: Movimiento) => {
            const f = obtenerFechaJS(mov.fecha);
            const fechaStr = f 
              ? f.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
              : '';

            return (
              <div 
                key={mov.id} 
                className="p-3.5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden space-y-2"
              >
                {/* Barra lateral de color según el tipo */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')
                }`} />
                
                <div className="pl-1.5 sm:pl-2">
                  <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-1.5 pb-1.5 border-b border-slate-200/60 dark:border-slate-800/80">
                    <span className={`text-[10px] sm:text-xs font-black uppercase px-2.5 py-0.5 rounded-md shrink-0 ${
                      mov.tipo === 'fiado' 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' 
                        : (mov.tipo === 'venta' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' 
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')
                    }`}>
                      {mov.tipo}
                    </span>
                    
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:text-[11px] font-bold uppercase">
                      {mov.registradoPor && (
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          👤 {mov.registradoPor}
                        </span>
                      )}
                      {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                      <span className="text-slate-400 whitespace-nowrap">
                        {fechaStr}
                      </span>
                    </div>
                  </div>
                  
                  {mov.detalles && mov.detalles.length > 0 ? (
                    <div className="space-y-1 pt-1.5">
                      {mov.detalles.map((d: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs sm:text-sm min-w-0 gap-2">
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate flex-1 min-w-0">
                            {d.cantidad > 1 && (
                              <strong className={`${
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
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate pt-1">
                      {mov.descripcion || 'Sin descripción'}
                    </p>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-200/60 dark:border-slate-800 font-black">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Total:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => abrirTicketDeMovimiento(mov, cliente)}
                        title="Imprimir Factura / Ticket"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <Printer size={15} />
                      </button>
                      <span className={`text-base sm:text-lg ${
                        mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')
                      }`}>
                        {mov.tipo === 'fiado' ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}
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
                    <button
                      type="button"
                      onClick={() => setModalGestion({ isOpen: true, modo: 'eliminar', cliente })}
                      title="Eliminar Cliente"
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                    >
                      <Trash2 size={13} />
                    </button>
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
                  deudaFiado < 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : (totalCompromiso === 0 ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {deudaFiado < 0 ? 'Saldo a Favor' : (totalCompromiso === 0 ? 'Estado' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                </span>
                <span className={`text-lg font-black ${
                  totalCompromiso === 0 
                    ? 'text-slate-400' 
                    : (deudaFiado < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                }`}>
                  {totalCompromiso === 0 ? 'Al Día' : `$${Math.round(Math.abs(totalCompromiso)).toLocaleString('es-CO')}`}
                </span>
              </div>

              {saldoSeparesActivos > 0 && (
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-800">
                  <span>Fiados: <strong className="text-rose-600 dark:text-rose-400">${Math.round(deudaFiado).toLocaleString('es-CO')}</strong></span>
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
              {puedeSepare && (
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/separe?clienteId=${cliente.id}`)} 
                  className="flex-1 py-2 px-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  Separe
                </button>
              )}
            </div>

            {/* Fila 4: Botón WhatsApp */}
            {cliente.celular && !esCajero && (
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
            B. VISTA ESCRITORIO (>= 1024px)
            Dos columnas: Izquierda (Ficha + Saldo + Acciones) y Derecha (Historial con scroll 100% independiente)
            ========================================================================= */}
        <div className="hidden lg:grid lg:grid-cols-12 h-full divide-x divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {/* Columna Izquierda (5 cols): Perfil, Saldo y Acciones con su propio scroll */}
          <div className="lg:col-span-5 h-full overflow-y-auto bg-slate-50/40 dark:bg-[#020617]/40 p-4 sm:p-5 space-y-4">
            {/* Fila 1: Nombre del cliente + badge distinguido + opciones de edición */}
            <div className="text-center pt-1 px-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full mb-1.5">
                👤 CLIENTE
              </span>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h2 className="text-[22px] sm:text-[26px] font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words">
                  {cliente.nombre}
                </h2>
                {!esCajero && (
                  <div className="inline-flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModalGestion({ isOpen: true, modo: 'editar', cliente })}
                      title="Modificar Cliente"
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalGestion({ isOpen: true, modo: 'eliminar', cliente })}
                      title="Eliminar Cliente"
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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

            {/* Fila 2: Saldo Destacado en tarjeta compacta */}
            <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${
                  deudaFiado < 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : (totalCompromiso === 0 ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                }`}>
                  {deudaFiado < 0 ? 'Saldo a Favor' : (totalCompromiso === 0 ? 'Estado' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                </span>
                <span className={`text-xl sm:text-2xl font-black ${
                  totalCompromiso === 0 
                    ? 'text-slate-400' 
                    : (deudaFiado < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                }`}>
                  {totalCompromiso === 0 ? 'Al Día' : `$${Math.round(Math.abs(totalCompromiso)).toLocaleString('es-CO')}`}
                </span>
              </div>

              {saldoSeparesActivos > 0 && (
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Fiados: <strong className="text-rose-600 dark:text-rose-400">${Math.round(deudaFiado).toLocaleString('es-CO')}</strong></span>
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
                <span>🛍️ Vender</span>
              </button>
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/fiar?clienteId=${cliente.id}`)} 
                className="py-2.5 px-3 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>📋 Fiar</span>
              </button>
              <button 
                type="button"
                onClick={() => router.push(`/dashboard/abonar?clienteId=${cliente.id}`)} 
                className="py-2.5 px-3 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>💵 Abonar</span>
              </button>
              {puedeSepare && (
                <button 
                  type="button"
                  onClick={() => router.push(`/dashboard/separe?clienteId=${cliente.id}`)} 
                  className="py-2.5 px-3 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <span>🔖 Separe</span>
                </button>
              )}
            </div>

            {/* Fila 4: Botón de WhatsApp oficial */}
            {cliente.celular && !esCajero && (
              <button 
                type="button"
                onClick={() => abrirEnlaceWhatsApp(cliente.celular, generarTextoComprobante('estado', cliente))} 
                className="w-full py-2.5 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl border border-[#25D366]/40 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs"
              >
                <MessageCircle size={16} className="text-[#25D366] fill-[#25D366]/30" />
                <span>Enviar estado de cuenta por WhatsApp</span>
              </button>
            )}

            {/* Separes Activos en Escritorio */}
            {seccionSeparesActivos}

            {/* Notas del cliente en Escritorio */}
            {seccionNotas}
          </div>

          {/* Columna Derecha (7 cols): Historial de Movimientos con Scroll 100% Independiente */}
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
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 pb-8">
              {renderListaMovimientos(movimientosFiltrados)}
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-8 pt-1 px-1 sm:px-3 w-full space-y-4">

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

        <button
          type="button"
          onClick={() => setModalNuevoAbierto(true)}
          className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer shrink-0"
        >
          <UserPlus size={15} />
          <span className="hidden xs:inline">Nuevo Cliente</span>
          <span className="xs:hidden">Nuevo</span>
        </button>
      </div>

      {/* 2. BANNER DE INDICADORES EN PÍLDORAS (HORIZONTAL Y COMPACTO) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
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
      </div>

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
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/60 overflow-hidden lg:max-h-[calc(100vh-270px)] lg:overflow-y-auto">
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
                    <div className="flex items-center gap-3 min-w-0 pr-2">
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
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className={`text-sm font-bold truncate transition-colors ${
                            estaSeleccionado 
                              ? 'text-emerald-700 dark:text-emerald-400' 
                              : 'text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                          }`}>
                            {c.nombre}
                          </h3>
                          {c.semaforo === 'riesgo' && (
                            <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 shrink-0">
                              +30d
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 truncate">
                          {c.celular ? (
                            <span className="flex items-center gap-1 shrink-0">
                              <Phone size={11} className="text-slate-400" />
                              <span>{c.celular}</span>
                            </span>
                          ) : (
                            <span className="italic text-[11px]">Sin teléfono</span>
                          )}
                          {c.direccion && (
                            <span className="hidden sm:inline-flex items-center gap-1 truncate text-[11px]">
                              • <MapPin size={10} className="shrink-0" /> {c.direccion}
                            </span>
                          )}
                        </div>
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
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          ${Math.round(c.deuda).toLocaleString('es-CO')}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {c.deuda > 0 ? (
                            c.diasSinAbonar > 0 ? `Hace ${c.diasSinAbonar}d` : 'Fiado reciente'
                          ) : (
                            'Al día'
                          )}
                        </span>
                      </div>

                      {/* Botón WhatsApp rápido */}
                      {c.celular ? (
                        <button
                          type="button"
                          onClick={(e) => handleCobrarWhatsApp(c, e)}
                          className={`p-2 rounded-xl transition cursor-pointer shrink-0 ${
                            c.deuda > 0
                              ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400'
                          }`}
                          title={c.deuda > 0 ? "Cobrar por WhatsApp" : "Escribir por WhatsApp"}
                        >
                          <MessageCircle size={15} />
                        </button>
                      ) : null}

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
      {clienteActivoDetalle && (
        <div 
          className="lg:hidden fixed inset-0 z-[150] flex items-end justify-center bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150 p-0"
          onClick={() => setClienteFicha(null)}
        >
          <div 
            className="bg-white dark:bg-[#0f172a] w-full rounded-t-[2.5rem] max-h-[90vh] border-t border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tirador táctil */}
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 shrink-0" />

            {/* Ficha idéntica */}
            {renderFichaCliente(clienteActivoDetalle, separesClienteActivo, true)}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REGISTRAR NUEVO CLIENTE
          ========================================================================= */}
      {modalNuevoAbierto && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
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

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Notas o Parentesco
                </label>
                <textarea
                  rows={2}
                  value={notasNuevas}
                  onChange={(e) => setNotasNuevas(e.target.value)}
                  placeholder="Ej: Hermana de Juan, compra los viernes..."
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                />
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
          MODAL: EDITAR / ELIMINAR CLIENTE (INTEGRADO)
          ========================================================================= */}
      {modalGestion.isOpen && modalGestion.cliente && (
        <ModalGestionCliente
          isOpen={modalGestion.isOpen}
          modo={modalGestion.modo}
          cliente={modalGestion.cliente}
          onClose={() => setModalGestion({ isOpen: false, modo: 'editar', cliente: null })}
          onSuccess={(clienteActualizado, fueEliminado) => {
            setModalGestion({ isOpen: false, modo: 'editar', cliente: null });
            if (fueEliminado) {
              if (clienteFicha?.id === modalGestion.cliente?.id) {
                setClienteFicha(null);
              }
              toast.success("Cliente eliminado exitosamente.");
            } else if (clienteActualizado) {
              setClienteFicha(clienteActualizado);
              toast.success("Cliente actualizado exitosamente.");
            }
          }}
        />
      )}

      {/* =========================================================================
          MODAL: TICKET FACTURA / COMPROBANTE TÉRMICO
          ========================================================================= */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />
    </div>
  );
}
