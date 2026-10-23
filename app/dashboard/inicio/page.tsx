"use client";
import { obtenerNombreCercano } from "@/utils/whatsapp";
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { Search, ShoppingBag, Banknote, Users, Calculator, CheckCircle2, ChevronRight, X, MessageCircle, UserCog, ShoppingCart, Star, Clock, Store, Printer, Edit3, Trash2, Receipt, Bookmark, Sparkles, RotateCcw, AlertTriangle, Crown, User, Phone, ArrowLeft, Pencil } from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "../../../hooks/AuthContext";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalGestionCliente from "@/components/ModalGestionCliente";
import ModalProcesarDevolucion from "@/components/ModalProcesarDevolucion";
import ModalTourBienvenida from "@/components/ModalTourBienvenida";
import ModalNuevoCliente from "@/components/ModalNuevoCliente";
import ModalAnularAbono from "@/components/modals/ModalAnularAbono";
import { obtenerEstadoCaja, EstadoTurnoCaja } from "@/utils/cierreCaja";
import ModalCierreCaja from "@/components/caja/ModalCierreCaja";
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";
import { agregarMediosPagoAlEstado } from "@/utils/mediosPago";

export default function InicioPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { datosSesion } = useAuth();
  const router = useRouter();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.esAdmin ?? (datosSesion?.rol !== 'cajero');
  const planActual = datosSesion?.planActual;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerDirectorio = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verDirectorio === true;
  const puedeAbonar: boolean = datosSesion?.puedeAbonar ?? true;
  const moduloSepareActivo: boolean = datosSesion?.moduloSepareActivo !== false;
  const [separesActivosTotal, setSeparesActivosTotal] = useState(0);
  const puedePlanSepare = (datosSesion?.tipoUsuario === 'principal' || datosSesion?.permisos?.planSepare === true) && (moduloSepareActivo || separesActivosTotal > 0);
  const puedeSepare: boolean = datosSesion?.esPro === true && datosSesion?.puedeSepare !== false && moduloSepareActivo;
  const puedeEnviarWhatsApp = datosSesion?.puedeEnviarWhatsApp ?? true;
  const puedeHacerCierreCaja = datosSesion?.puedeHacerCierreCaja ?? false;
  const [modalCierreCajaOpen, setModalCierreCajaOpen] = useState(false);
  const [estadoCaja, setEstadoCaja] = useState<EstadoTurnoCaja | null>(null);

  useEffect(() => {
    if (!cuentaPrincipalId || !puedeHacerCierreCaja) return;
    const consultarEstado = async () => {
      try {
        const est = await obtenerEstadoCaja(db, cuentaPrincipalId);
        setEstadoCaja(est);
      } catch (err) {
        console.error("Error al consultar estado de caja en inicio:", err);
      }
    };
    consultarEstado();
  }, [cuentaPrincipalId, puedeHacerCierreCaja, modalCierreCajaOpen]);

  const [clientes, setClientes] = useState<any[]>([]);
  const [separesGlobales, setSeparesGlobales] = useState<any[]>([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<any[]>([]);
  const [separesCliente, setSeparesCliente] = useState<any[]>([]);

  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [verTodosClientes, setVerTodosClientes] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: DatosFacturaProps | null }>({ visible: false, datos: null });
  const [modalDevolucion, setModalDevolucion] = useState<{ isOpen: boolean, venta: any | null }>({ isOpen: false, venta: null });
  const [modalAnularAbono, setModalAnularAbono] = useState<{ isOpen: boolean; mov: any | null }>({ isOpen: false, mov: null });
  const [modalGestionCliente, setModalGestionCliente] = useState<{
    visible: boolean;
    modo: 'editar' | 'eliminar';
    cliente: any | null;
  }>({ visible: false, modo: 'editar', cliente: null });
  const [modalTourBienvenida, setModalTourBienvenida] = useState(false);
  const [mostrarBotonTour, setMostrarBotonTour] = useState(false);

  // Detectar si el usuario recién completó el registro para desplegar el Tour de Bienvenida
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const debeMostrar = localStorage.getItem('fiabono_mostrar_tour');
      const yaCompletado = localStorage.getItem('fiabono_tour_completado') === 'true';
      if (debeMostrar === 'true') {
        setModalTourBienvenida(true);
        localStorage.removeItem('fiabono_mostrar_tour');
      }
      setMostrarBotonTour(!yaCompletado);
    }
  }, []);

  // Listener para contar separes activos en tiempo real (mantiene visible el módulo si hay apartados pendientes)
  useEffect(() => {
    const tienePermisoSepare = datosSesion?.tipoUsuario === 'principal' || datosSesion?.permisos?.planSepare === true;
    if (!cuentaPrincipalId || !tienePermisoSepare) {
      setSeparesActivosTotal(0);
      return;
    }
    const q = query(
      collection(db, "separes"),
      where("usuarioId", "==", cuentaPrincipalId),
      where("estado", "==", "activo")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSeparesActivosTotal(snap.size);
    }, (e) => console.error("Error contando separes en inicio:", e));
    return () => unsub();
  }, [cuentaPrincipalId, datosSesion?.tipoUsuario, datosSesion?.permisos?.planSepare]);

  const handleGestionClienteSuccess = (clienteActualizado?: any, fueEliminado?: boolean) => {
    if (fueEliminado) {
      setClientes(prev => prev.filter(c => c.id !== clienteActivo?.id));
      setClienteActivo(null);
      setMovimientosCliente([]);
    } else if (clienteActualizado) {
      setClientes(prev => prev.map(c => c.id === clienteActualizado.id ? clienteActualizado : c).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setClienteActivo(clienteActualizado);
    }
  };

  const abrirTicketDeMovimiento = (mov: any, cliente: any) => {
    const datosTicket: DatosFacturaProps = {
      nombreNegocio: nombreNegocio || 'Mi Negocio',
      telefonoNegocio: datosSesion?.telefonoNegocio || '',
      correoNegocio: datosSesion?.correoNegocio || '',
      logoNegocio: datosSesion?.logoNegocio || null,
      nitNegocio: datosSesion?.nitNegocio || '',
      direccionNegocio: datosSesion?.direccionNegocio || '',
      mensajePieTicket: datosSesion?.mensajePieTicket || '',
      nombreCliente: cliente?.nombre || 'Cliente',
      celularCliente: cliente?.celular || '',
      registradoPor: mov.registradoPor || '',
      fecha: mov.fecha,
      tipo: mov.tipo,
      detalles: mov.detalles && mov.detalles.length > 0 ? mov.detalles : undefined,
      descripcionGeneral: mov.descripcion,
      montoTotal: mov.monto,
      saldoNuevo: mov.saldoResultante !== undefined ? mov.saldoResultante : cliente?.deudaTotal,
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

  useEffect(() => {
    if (!cuentaPrincipalId) return;

    // 1. Clientes en tiempo real
    const qC = query(collection(db, "clientes"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubClientes = onSnapshot(qC, (snapC) => {
      const listaC: any[] = [];
      snapC.forEach((doc) => listaC.push({ id: doc.id, ...doc.data() }));
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);
    }, (err) => console.error("Error listener clientes:", err));

    // 2. Separes en tiempo real para sincronizar cartera y separes en buscador y directorio
    const qS = query(collection(db, "separes"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubSepares = onSnapshot(qS, (snapS) => {
      const listaS: any[] = [];
      snapS.forEach((doc) => listaS.push({ id: doc.id, ...doc.data() }));
      setSeparesGlobales(listaS);
    }, (err) => console.error("Error listener separes:", err));

    let unsubOrd: (() => void) | null = null;
    if (esAdmin) {
      const qOrd = query(
        collection(db, "ordenes_pendientes"),
        where("usuarioId", "==", cuentaPrincipalId),
        where("estado", "==", "pendiente")
      );
      unsubOrd = onSnapshot(qOrd, (snap) => {
        const lista: any[] = [];
        snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
        lista.sort((a, b) => {
          const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime();
          const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime();
          return timeB - timeA;
        });
        setOrdenesPendientes(lista);
      });
    }

    return () => {
      unsubClientes();
      unsubSepares();
      if (unsubOrd) unsubOrd();
    };
  }, [cuentaPrincipalId, esAdmin]);

  // Clientes enriquecidos en tiempo real con saldo real de Fiados + Separes activos (sincronizados con Clientes y Cartera)
  const clientesConTotales = useMemo(() => {
    return clientes.map(c => {
      const separesCliente = separesGlobales.filter(
        s => s.clienteId === c.id || (s.clienteNombre && s.clienteNombre.trim().toLowerCase() === c.nombre.trim().toLowerCase())
      );
      const separesActivos = separesCliente.filter((s: any) => s.estado === 'activo');
      const saldoSeparesActivos = separesActivos.reduce((acc: number, s: any) => acc + (Number(s.saldoPendiente) || 0), 0);
      const deudaFiado = Number(c.deudaTotal) || 0;
      const tieneSaldoAFavor = deudaFiado < 0;
      const totalCompromiso = tieneSaldoAFavor ? deudaFiado : (deudaFiado + saldoSeparesActivos);

      return {
        ...c,
        deudaFiado,
        saldoSeparesActivos,
        totalCompromiso,
        tieneSaldoAFavor,
        separesActivosCount: separesActivos.length
      };
    });
  }, [clientes, separesGlobales]);

  const cargarMovimientosClienteDirecto = async (clienteId: string) => {
    try {
      const qM = query(
        collection(db, "movimientos"),
        where("usuarioId", "==", cuentaPrincipalId),
        where("clienteId", "==", clienteId)
      );
      const qS = query(
        collection(db, "separes"),
        where("usuarioId", "==", cuentaPrincipalId),
        where("clienteId", "==", clienteId)
      );
      const [snapM, snapS] = await Promise.all([getDocs(qM), getDocs(qS)]);
      const lista: any[] = [];
      snapM.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));

      const listaS: any[] = [];
      snapS.forEach(doc => listaS.push({ id: doc.id, ...doc.data() }));
      listaS.sort((a, b) => (b.fechaCreacion?.toMillis ? b.fechaCreacion.toMillis() : 0) - (a.fechaCreacion?.toMillis ? a.fechaCreacion.toMillis() : 0));
      setSeparesCliente(listaS);

      const idsSeparesConMov = new Set(
        lista.filter(m => m.idSepareOrigen || (m as any).separeId).map(m => m.idSepareOrigen || (m as any).separeId)
      );

      for (const sep of listaS) {
        if (!idsSeparesConMov.has(sep.id)) {
          lista.push({
            id: `sep-apertura-${sep.id}`,
            clienteId: clienteId,
            clienteNombre: sep.clienteNombre || 'Cliente',
            usuarioId: cuentaPrincipalId,
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
            fecha: sep.fechaCreacion || sep.fecha || new Date(),
            idSepareOrigen: sep.id,
            saldoResultanteSepare: sep.saldoPendiente,
            registradoPor: (sep as any).creadoPor || (sep as any).vendedor || 'Sistema',
            metodoPago: sep.metodoPago || 'separe'
          });
        }
      }

      lista.sort((a, b) => {
        const tA = (a.fecha as any)?.toMillis ? (a.fecha as any).toMillis() : (a.fecha ? new Date(a.fecha as any).getTime() : 0);
        const tB = (b.fecha as any)?.toMillis ? (b.fecha as any).toMillis() : (b.fecha ? new Date(b.fecha as any).getTime() : 0);
        return tB - tA;
      });
      setMovimientosCliente(lista);
    } catch (e) {
      console.error("Error cargando historial de movimientos del cliente:", e);
    }
  };

  const abrirUpsell = (titulo: string, mensaje: string) => { setModalSuscripcion({ visible: true, titulo, mensaje }); };

  const normalizarMensajeWhatsApp = (texto: string) => {
    return texto
      .replace(/\uFFFD/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\r\n/g, '\n')
      .trim();
  };

  const generarTextoComprobante = (tipo: 'estado' | 'comprobante' = 'estado', cliente: any = {}, accion?: 'fiado' | 'abono' | 'venta' | null, detallesArray?: any[], totalMov?: number) => {
    const deuda = cliente.deudaTotal !== undefined ? cliente.deudaTotal : (cliente.deuda || 0);
    const saldoFormat = `$${Math.abs(deuda).toLocaleString('es-CO')}`;
    const nombreCliente = obtenerNombreCercano(cliente);
    const nombreTienda = nombreNegocio || 'nuestra tienda';

    const separesActivos = separesCliente.filter((s: any) => s.estado === 'activo');
    const saldoSeparesActivos = separesActivos.reduce((acc: number, s: any) => acc + (s.saldoPendiente || 0), 0);
    const totalCompromiso = deuda < 0 ? deuda : (deuda + saldoSeparesActivos);

    let texto = '';

    if (tipo === 'estado') {
      if (deuda > 0 && saldoSeparesActivos > 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

💰 *SALDO TOTAL PENDIENTE: ${Math.round(totalCompromiso).toLocaleString('es-CO')}*

📋 *Resumen de tu cuenta:*
• *Deuda en fiados:* ${Math.round(deuda).toLocaleString('es-CO')}
• *Saldo en Planes Separe:* ${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}

🔖 *Tus Planes Separe activos:*
${separesActivos.map((s: any) => `• ${s.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos'} (Saldo: ${Math.round(s.saldoPendiente || 0).toLocaleString('es-CO')})`).join('\n')}

Quedamos a tu disposición para revisar cualquier detalle o realizar abonos.

*¡Que tengas un gran día!*`;
      } else if (deuda <= 0 && saldoSeparesActivos > 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

💰 *SALDO EN PLANES SEPARE: ${Math.round(saldoSeparesActivos).toLocaleString('es-CO')}*
• Tu cuenta de fiados se encuentra al día.

🔖 *Tus artículos reservados:*
${separesActivos.map((s: any) => `• ${s.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos'} (Saldo: ${Math.round(s.saldoPendiente || 0).toLocaleString('es-CO')} | Pagado: ${Math.round(s.montoPagado || 0).toLocaleString('es-CO')})`).join('\n')}

Quedamos a tu disposición para abonar y retirar tus productos.

*¡Que tengas un gran día!*`;
      } else if (deuda > 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente presentas un saldo pendiente de: *${Math.round(deuda).toLocaleString('es-CO')}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      } else if (deuda < 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente tienes un saldo a favor de: *${Math.round(Math.abs(deuda)).toLocaleString('es-CO')}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      } else {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Tu cuenta se encuentra totalmente al día.

Gracias por seguir con nosotros.

*¡Que tengas un gran día!*`;
      }
    } else if (tipo === 'comprobante') {
      const nombreDestino = cliente.id === 'mostrador' || !cliente.nombre ? 'Cliente' : obtenerNombreCercano(cliente);
      texto = `¡Hola, *${nombreDestino}*! Gracias por tu compra en *${nombreTienda}*.

===================
*COMPROBANTE DE COMPRA*
===================

`;

      if (detallesArray && detallesArray.length > 0) {
        detallesArray.forEach((d: any) => {
          const cantidad = d.cantidad || 1;
          const descripcion = d.descripcion || 'Producto';
          const valorUnitario = d.valorUnitario ?? d.valor ?? 0;
          const totalProducto = Number(cantidad) * Number(valorUnitario || 0);
          texto += `• ${cantidad}x ${descripcion}\n  Precio unitario: *$${Number(valorUnitario).toLocaleString('es-CO')}*\n  Total: *$${Number(totalProducto).toLocaleString('es-CO')}*\n\n`;
        });
        texto += `*TOTAL: $${(totalMov ?? 0).toLocaleString('es-CO')}*\n\nGracias por tu compra. Estamos atentos para cualquier consulta.\n\n*¡Te esperamos pronto!*`;
      }

      if (cliente.id !== 'mostrador') {
        if ((cliente.deudaTotal || 0) === 0) {
          texto += '\n\nTu cuenta queda al día. Gracias por tu confianza.';
        } else if ((cliente.deudaTotal || 0) < 0) {
          texto += `\n\nTu saldo a favor es de *${saldoFormat}*.`;
        } else {
          texto += `\n\nTu saldo pendiente actual es de *${saldoFormat}*.`;
        }
      }
    }

    const ultimoAbono = movimientosCliente
      .filter((mov: any) => mov.tipo === 'abono' && mov.fecha)
      .sort((a: any, b: any) => {
        const fechaA = a.fecha?.toDate ? a.fecha.toDate().getTime() : new Date(a.fecha).getTime();
        const fechaB = b.fecha?.toDate ? b.fecha.toDate().getTime() : new Date(b.fecha).getTime();
        return fechaB - fechaA;
      })[0];
    return normalizarMensajeWhatsApp(agregarMediosPagoAlEstado(texto, datosSesion?.mediosPago, nombreTienda, cliente.deudaTotal || 0, ultimoAbono));
  };

  const abrirWhatsApp = (texto: string, celular?: string) => {
    abrirEnlaceWhatsApp(celular || '', texto);
  };

  const buscadorHomeRef = useRef<HTMLElement | null>(null);

  const normalizarBusqueda = (str: string) =>
    (str || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const qHomeNorm = normalizarBusqueda(busqueda);
  const clientesFiltrados = clientesConTotales.filter(c =>
    normalizarBusqueda(c.nombre || "").includes(qHomeNorm) ||
    normalizarBusqueda(c.notas || "").includes(qHomeNorm) ||
    normalizarBusqueda(c.direccion || "").includes(qHomeNorm) ||
    (c.celular || "").toString().includes(busqueda.trim())
  );

  const qDirNorm = normalizarBusqueda(busquedaDirectorio);
  const directorioFiltrado = clientesConTotales.filter(c => 
    normalizarBusqueda(c.nombre || "").includes(qDirNorm) ||
    normalizarBusqueda(c.notas || "").includes(qDirNorm) ||
    normalizarBusqueda(c.direccion || "").includes(qDirNorm) ||
    (c.celular || "").toString().includes(busquedaDirectorio.trim())
  );

  // Cerrar desplegable de búsqueda en Home al hacer clic fuera y cerrar Directorio con Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (buscadorHomeRef.current && !buscadorHomeRef.current.contains(e.target as Node)) {
        if (busqueda.length > 0) setBusqueda("");
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalNuevoCliente || modalTicketFactura.visible || modalDevolucion.isOpen || modalGestionCliente.visible || modalSuscripcion.visible) {
          return;
        }
        if (verTodosClientes || clienteActivo) {
          setVerTodosClientes(false);
          setClienteActivo(null);
        } else if (busqueda.length > 0) {
          setBusqueda("");
        }
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busqueda, verTodosClientes, clienteActivo, modalNuevoCliente, modalTicketFactura.visible, modalDevolucion.isOpen, modalGestionCliente.visible, modalSuscripcion.visible]);

  const getSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <>
      {/* REDUCIMOS LOS GAPS PARA ESCRITORIO: md:gap-3 lg:gap-4 xl:gap-4. Móvil sigue intacto (gap-6 sm:gap-8) */}
      <div className="flex flex-col gap-6 sm:gap-8 md:gap-3 lg:gap-4 xl:gap-4 px-4 sm:px-6 lg:px-8 pt-4 md:pt-2 pb-8 md:pb-2 h-full w-full max-w-[1600px] mx-auto">
        {/* ENCABEZADO DE BIENVENIDA */}
        <header className="flex flex-col gap-1 px-1 md:mb-1 lg:mb-2">
          {/* LOGO DE FIABONO (Solo visible en celular) */}
          <div className="md:hidden flex items-center mb-1">
            <span className="text-[22px] font-black tracking-tighter text-blue-600 dark:text-blue-500 flex items-center gap-1">
              Fiabono
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate tracking-tight">
              {getSaludo()}, <span className="text-blue-600 dark:text-blue-500">{datosSesion?.nombreUsuario?.split(' ')[0] || 'Usuario'}</span> 
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1.5 max-w-full">
                <Store size={14} className="shrink-0 text-blue-600 dark:text-blue-400"/> <span>{nombreNegocio || 'Mi Negocio'}</span>
              </span>
              <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] md:text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md shrink-0">
                {datosSesion?.rol === 'cajero' ? 'Colaborador' : 'Administrador'}
              </span>
              {mostrarBotonTour && (
                <button
                  type="button"
                  onClick={() => setModalTourBienvenida(true)}
                  className="bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  title="Ver tour interactivo de bienvenida"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Tour Rápido</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* BUSCADOR */}
        <section ref={buscadorHomeRef} className="relative z-20">
          <div className="relative shadow-sm rounded-[2rem]">
            <Search className="absolute left-4 sm:left-5 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 sm:w-7 sm:h-7 md:w-5 md:h-5" />
            {/* Input más compacto en escritorio: md:p-3 lg:p-4 */}
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (clientesFiltrados.length > 0) {
                    const primerCliente = clientesFiltrados[0];
                    setClienteActivo(primerCliente);
                    cargarMovimientosClienteDirecto(primerCliente.id);
                    setBusqueda("");
                    setVerTodosClientes(true);
                  }
                }
              }}
              placeholder="Buscar cliente por nombre o celular..."
              className="w-full text-lg sm:text-xl md:text-base lg:text-lg p-5 sm:p-6 md:p-3 lg:p-4 pl-12 sm:pl-16 md:pl-12 lg:pl-12 pr-12 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/60 rounded-[2rem] md:rounded-2xl lg:rounded-3xl focus:border-blue-500 dark:focus:border-blue-400 outline-none shadow-sm dark:shadow-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
            />
            {busqueda.length > 0 && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {busqueda.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/80 rounded-3xl mt-2 shadow-2xl max-h-[60vh] overflow-y-auto z-40 p-3">
              {clientesFiltrados.length > 0 ? (
                clientesFiltrados.map((c) => (
                  <div key={c.id} onClick={() => { 
                    setClienteActivo(c); 
                    cargarMovimientosClienteDirecto(c.id); 
                    setBusqueda(""); 
                    setVerTodosClientes(true);
                  }} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-2xl cursor-pointer flex justify-between items-center transition-colors mb-1.5 gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg md:text-base truncate">{c.nombre}</p>
                        {c.notas && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 truncate max-w-[200px]" title={c.notas}>
                            {c.notas}
                          </span>
                        )}
                      </div>
                      {c.celular && <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{c.celular}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-base md:text-sm font-black tracking-tight block whitespace-nowrap ${
                        c.totalCompromiso === 0 
                          ? 'text-slate-400 dark:text-slate-500' 
                          : (c.tieneSaldoAFavor 
                            ? 'text-emerald-500 dark:text-emerald-400' 
                            : (c.deudaFiado > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'))
                      }`}>
                        {c.tieneSaldoAFavor 
                          ? `A favor: $${Math.abs(c.totalCompromiso).toLocaleString('es-CO')}` 
                          : (c.totalCompromiso === 0 ? '$0 (Al día)' : `$${c.totalCompromiso.toLocaleString('es-CO')}`)}
                      </span>
                      {c.totalCompromiso > 0 && (
                        <span className="text-[10px] block font-bold text-slate-400">
                          {c.deudaFiado > 0 && c.saldoSeparesActivos > 0 ? (
                            `Fiado $${c.deudaFiado.toLocaleString('es-CO')} • Separe $${c.saldoSeparesActivos.toLocaleString('es-CO')}`
                          ) : c.saldoSeparesActivos > 0 ? (
                            '🔖 Separe activo'
                          ) : (
                            'Fiado pendiente'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="mb-6 text-xl md:text-lg">"{busqueda}" no está en tu directorio.</p>
                  <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 md:py-3 px-8 rounded-2xl text-lg md:text-base transition-colors flex items-center justify-center gap-2 mx-auto shadow-md cursor-pointer">
                    <UserCog size={24} className="md:w-5 md:h-5" /> Crear Cliente
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* BANNER MINIMALISTA DE NOTIFICACIÓN DE ÓRDENES PENDIENTES */}
        {esAdmin && ordenesPendientes.length > 0 && (
          <div 
            onClick={() => router.push('/dashboard/ordenes')}
            className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-400/40 dark:border-amber-500/30 rounded-2xl p-2.5 sm:p-3 shadow-sm flex items-center justify-between gap-2.5 transition-all cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Receipt size={16} />
              </div>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                  {ordenesPendientes.length} {ordenesPendientes.length === 1 ? 'orden pendiente' : 'órdenes pendientes'}
                </span>
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                  Revisar
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
              <span className="hidden sm:inline">Ver órdenes</span>
              <ChevronRight size={15} />
            </div>
          </div>
        )}

        {/* BOTONES PRINCIPALES: Vender full width, Fiar, Abonar y Separe adaptativos abajo */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Botón VENDER (Todo el ancho) */}
          <button
            onClick={() => router.push('/dashboard/vender')}
            className="w-full bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-600 hover:to-green-800 text-white font-black text-2xl sm:text-3xl lg:text-4xl py-6 sm:py-8 lg:py-10 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30 dark:border-emerald-500/20 cursor-pointer"
          >
            <ShoppingCart className="mb-2 opacity-90 shrink-0 w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14" />
            VENDER
          </button>

          {/* Fila inferior adaptativa */}
          {(() => {
            const botonesSecundarios = [
              {
                id: 'fiar',
                nombre: 'FIAR',
                icono: ShoppingBag,
                ruta: '/dashboard/fiar',
                gradiente: 'from-rose-500 to-red-700 hover:from-rose-600 hover:to-red-800 border-rose-400/30 dark:border-rose-500/20'
              },
              ...(puedeAbonar ? [{
                id: 'abonar',
                nombre: 'ABONAR',
                icono: Banknote,
                ruta: '/dashboard/abonar',
                gradiente: 'from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 hover:from-blue-600 hover:to-blue-700 border-blue-400/30 dark:border-blue-500/20'
              }] : []),
              ...(puedePlanSepare ? [{
                id: 'separe',
                nombre: 'SEPARE',
                icono: Bookmark,
                ruta: '/dashboard/separes',
                esProOnly: !datosSesion?.esPro,
                gradiente: 'from-violet-600 to-purple-800 hover:from-violet-700 hover:to-purple-900 border-violet-400/30 dark:border-violet-500/20'
              }] : [])
            ];
            const gridColsClass = botonesSecundarios.length === 3 
              ? 'grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5'
              : botonesSecundarios.length === 2
                ? 'grid grid-cols-2 gap-3 sm:gap-5'
                : 'grid grid-cols-1 gap-4 sm:gap-5';

            return (
              <div className={gridColsClass}>
                {botonesSecundarios.map((btn) => {
                  const Icono = btn.icono;
                  return (
                    <button
                      key={btn.id}
                      onClick={() => {
                        router.push(btn.ruta);
                      }}
                      className={`w-full bg-gradient-to-br ${btn.gradiente} text-white font-black text-sm xs:text-base sm:text-2xl lg:text-3xl py-4 sm:py-7 lg:py-8 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border cursor-pointer relative`}
                    >
                      {btn.esProOnly && (
                        <span className="absolute top-2 right-2 bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                          <Crown size={11} /> PRO
                        </span>
                      )}
                      <Icono className="mb-1 sm:mb-2 opacity-90 shrink-0 w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10" />
                      {btn.nombre}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* FILA DE DIRECTORIO DE CLIENTES Y CIERRE DE CAJA */}
        <div className={`grid gap-3 sm:gap-4 lg:gap-5 w-full ${puedeVerDirectorio && puedeHacerCierreCaja ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* 1. DIRECTORIO DE CLIENTES (PRIMERO: CUBRE TODA LA FILA SI CIERRE NO ESTÁ HABILITADO) */}
          {puedeVerDirectorio && (
            <button 
              onClick={() => setVerTodosClientes(true)}
              className="w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 hover:border-blue-400/50 py-3 sm:py-3.5 px-4 sm:px-5 rounded-2xl shadow-sm flex items-center justify-between transition-all group cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div className="text-left min-w-0">
                  <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    Directorio de Clientes
                  </span>
                  <span className="text-xs text-slate-400 font-medium block truncate">
                    {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} registrados
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-bold text-xs shrink-0">
                <span className="hidden sm:inline">Ver todos</span>
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {/* 2. CIERRE DE CAJA (SEGUNDO: SOLO SI TIENE PERMISO) */}
          {puedeHacerCierreCaja && (
            <button
              type="button"
              onClick={() => setModalCierreCajaOpen(true)}
              className="w-full bg-white dark:bg-[#0f172a] hover:bg-slate-50/80 dark:hover:bg-[#1e293b]/70 border border-slate-200 dark:border-slate-800 hover:border-amber-400/60 dark:hover:border-amber-500/40 py-3 sm:py-3.5 px-4 sm:px-5 rounded-2xl shadow-xs flex items-center justify-between transition-all group cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                  estadoCaja?.estaAbierta
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                }`}>
                  <Calculator size={18} />
                </div>
                <div className="text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {estadoCaja?.estaAbierta 
                        ? `Caja Abierta · Base: $${(estadoCaja.baseInicial || 0).toLocaleString('es-CO')}` 
                        : 'Abrir Caja / Arqueo'}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                      estadoCaja?.estaAbierta
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${estadoCaja?.estaAbierta ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {estadoCaja?.estaAbierta ? 'Turno Activo' : 'Caja'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {estadoCaja?.estaAbierta ? 'Arqueo parcial y cierre de jornada' : 'Iniciar turno con base o cuadrar caja'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors font-bold text-xs shrink-0">
                <span className="hidden sm:inline">{estadoCaja?.estaAbierta ? 'Ver Caja' : 'Abrir'}</span>
                <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}
        </div>

      </div>

      {/* --- MODAL DIRECTORIO DE CLIENTES CON PANTALLA DIVIDIDA (IDÉNTICO A HISTORIAL / FOTO 1) --- */}
      {(verTodosClientes || clienteActivo) && mounted && createPortal(
        <div
          onClick={() => {
            setVerTodosClientes(false);
            setClienteActivo(null);
          }}
          className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 z-[99999] overflow-hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] md:rounded-[2.5rem] w-full h-[96vh] md:h-[90vh] md:max-w-7xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-100 dark:border-slate-800/60 animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300"
          >
            
            {/* PANEL IZQUIERDO: DIRECTORIO (SOLO ESCRITORIO O SI NO HAY CLIENTE EN MÓVIL) */}
            <div className={`w-full md:w-5/12 flex flex-col border-r border-slate-100 dark:border-slate-800 h-full bg-slate-50/50 dark:bg-[#020617]/50 ${clienteActivo ? 'hidden md:flex' : 'flex'}`}>
              <div className="bg-blue-600 dark:bg-blue-900 p-6 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
                  <Users size={26}/> Directorio de Clientes
                </h2>
                <button 
                  onClick={() => {
                    setVerTodosClientes(false);
                    setClienteActivo(null);
                  }} 
                  className="text-blue-200 hover:text-white transition-colors bg-blue-700/50 p-2 rounded-full cursor-pointer"
                >
                  <X size={24}/>
                </button>
              </div>
              
              <div className="p-4 bg-white dark:bg-[#0f172a] shrink-0 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    value={busquedaDirectorio}
                    onChange={(e) => setBusquedaDirectorio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (directorioFiltrado.length > 0) {
                          setClienteActivo(directorioFiltrado[0]);
                          cargarMovimientosClienteDirecto(directorioFiltrado[0].id);
                        }
                      }
                    }}
                    placeholder="Buscar nombre o celular en el directorio..."
                    className="w-full p-4 pl-12 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium"
                  />
                  {busquedaDirectorio.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBusquedaDirectorio("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                      aria-label="Limpiar filtro"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {directorioFiltrado.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      setClienteActivo(c);
                      cargarMovimientosClienteDirecto(c.id);
                    }} 
                    className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${clienteActivo?.id === c.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/50 shadow-sm' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/80 hover:border-blue-300'}`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{c.nombre}</p>
                        {c.notas && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 truncate max-w-[160px]" title={c.notas}>
                            {c.notas}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.celular || "Sin celular"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.tieneSaldoAFavor && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-black px-1.5 py-0.5 rounded mr-1">
                          A favor
                        </span>
                      )}
                      <span className={`font-black text-lg tracking-tight block ${
                        c.totalCompromiso === 0 
                          ? 'text-slate-400' 
                          : (c.tieneSaldoAFavor 
                            ? 'text-emerald-500 dark:text-emerald-400 font-black' 
                            : (c.deudaFiado > 0 ? 'text-rose-500' : 'text-violet-600 dark:text-violet-400 font-black'))
                      }`}>
                        {c.totalCompromiso === 0 ? '$0' : `$${Math.abs(c.totalCompromiso || 0).toLocaleString('es-CO')}`}
                      </span>
                      <span className="text-[10px] block font-bold text-slate-400">
                        {c.deudaFiado > 0 && c.saldoSeparesActivos > 0 ? (
                          `Fiado $${c.deudaFiado.toLocaleString('es-CO')} • Separe $${c.saldoSeparesActivos.toLocaleString('es-CO')}`
                        ) : c.saldoSeparesActivos > 0 ? (
                          '🔖 Separe activo'
                        ) : c.deudaFiado > 0 ? (
                          'Fiado pendiente'
                        ) : (
                          'Al día'
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                {directorioFiltrado.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    <p>No se encontraron clientes.</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button onClick={() => { setNombreNuevo(""); setModalNuevoCliente(true); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-colors flex justify-center items-center gap-2 text-base cursor-pointer">
                  <UserCog size={20} /> Nuevo Cliente
                </button>
              </div>
            </div>

            {/* PANEL DERECHO: PERFIL E HISTORIAL DEL CLIENTE */}
            {clienteActivo ? (
              <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0f172a] overflow-hidden">
                
                {/* HEADER ESCRITORIO */}
                {(() => {
                  const deudaFiado = clienteActivo.deudaTotal || 0;
                  const saldoSeparesActivos = separesCliente
                    .filter((s: any) => s.estado === 'activo')
                    .reduce((acc: number, s: any) => acc + (s.saldoPendiente || 0), 0);
                  const tieneSaldoAFavor = deudaFiado < 0;
                  const totalCompromiso = tieneSaldoAFavor ? Math.abs(deudaFiado) : (deudaFiado + saldoSeparesActivos);

                  return (
                    <div className="hidden md:flex p-6 bg-slate-900 text-white justify-between items-center shrink-0 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <h3 className="text-2xl font-black truncate">{clienteActivo.nombre}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-slate-400 text-sm flex items-center gap-1.5">
                              {clienteActivo.celular ? (
                                <>
                                  <Phone size={13} className="text-slate-400 shrink-0" />
                                  <span>{clienteActivo.celular}</span>
                                </>
                              ) : (
                                "Sin celular registrado"
                              )}
                            </p>
                          </div>
                        </div>
                        {datosSesion?.rol !== 'cajero' && (
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-700 shadow-xs"
                            >
                              <Edit3 size={14} />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                              title="Eliminar Cliente"
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1 inline-block ${
                            tieneSaldoAFavor ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
                          }`}>
                            {tieneSaldoAFavor ? 'Saldo a favor' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual')}
                          </span>
                          <span className={`text-3xl font-black block ${
                            !tieneSaldoAFavor && totalCompromiso === 0
                              ? 'text-slate-300'
                              : (tieneSaldoAFavor ? 'text-emerald-400' : 'text-rose-400')
                          }`}>
                            ${totalCompromiso.toLocaleString('es-CO')}
                          </span>
                          {saldoSeparesActivos > 0 && (
                            <div className="flex items-center justify-end gap-2 text-[11px] font-bold text-slate-400 mt-0.5">
                              {tieneSaldoAFavor ? (
                                <span className="text-emerald-400">A favor: ${Math.abs(deudaFiado).toLocaleString('es-CO')}</span>
                              ) : (
                                <span>Fiados: ${deudaFiado.toLocaleString('es-CO')}</span>
                              )}
                              <span>•</span>
                              <span className="text-violet-400">Separes: ${saldoSeparesActivos.toLocaleString('es-CO')}</span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVerTodosClientes(false);
                            setClienteActivo(null);
                          }}
                          title="Cerrar directorio (Esc)"
                          className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* BARRA DE ACCIONES RÁPIDAS Y WHATSAPP (SOLO ESCRITORIO / TABLET) */}
                <div className="hidden md:flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5 px-6 py-3 bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="grid grid-cols-4 gap-2 w-full xl:w-auto xl:flex xl:items-center">
                    <button 
                      type="button"
                      onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} 
                      className="px-3 sm:px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Vender
                    </button>
                    <button 
                      type="button"
                      onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} 
                      className="px-3 sm:px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Fiar
                    </button>
                    <button 
                      type="button"
                      onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} 
                      className="px-3 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Abonar
                    </button>
                    {puedeSepare ? (
                      <button 
                        type="button"
                        onClick={() => router.push(`/dashboard/separe?clienteId=${clienteActivo.id}`)} 
                        className="px-3 sm:px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                      >
                        Separe
                      </button>
                    ) : separesCliente.some(s => s.estado === 'activo') ? (
                      <button 
                        type="button"
                        onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(clienteActivo.nombre)}`)} 
                        className="px-3 sm:px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                      >
                        Ver Separes
                      </button>
                    ) : (
                      <div className="hidden xl:block" />
                    )}
                  </div>

                  {clienteActivo.celular && puedeEnviarWhatsApp && (
                    <button 
                      type="button"
                      onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} 
                      className="w-full xl:w-auto py-2 px-4 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl border border-emerald-300/80 dark:border-emerald-700/50 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs shrink-0 whitespace-nowrap"
                    >
                      <MessageCircle size={16} className="text-[#25D366] fill-[#25D366]/30 shrink-0" />
                      <span>Enviar estado de cuenta por WhatsApp</span>
                    </button>
                  )}
                </div>

                {/* HEADER MÓVIL OPTIMIZADO (Nombre centrado y prominente, saldo destacado, acciones claras) */}
                <div className="md:hidden bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800 shrink-0 px-4 py-3 space-y-2.5 relative">
                  {/* Botón volver a la lista (solo en móvil cuando el directorio está activo) */}
                  {verTodosClientes && (
                    <button
                      type="button"
                      onClick={() => setClienteActivo(null)}
                      className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer z-10 flex items-center gap-1 text-xs font-bold"
                      aria-label="Volver a la lista"
                    >
                      <ArrowLeft size={14} />
                      <span>Lista</span>
                    </button>
                  )}

                  {/* Botón cerrar en esquina superior derecha */}
                  <button 
                    onClick={() => {
                      setVerTodosClientes(false);
                      setClienteActivo(null);
                    }} 
                    className="absolute top-3 right-3 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer z-10"
                    aria-label="Cerrar perfil"
                  >
                    <X size={18} />
                  </button>

                  {/* Fila 1: Nombre del cliente centrado + badge distinguido + opciones de edición */}
                  <div className="pt-1 px-8 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full mb-1">
                      <User size={11} /> CLIENTE
                    </span>

                    {/* Nombre centrado limpio y sin elementos al lado */}
                    <h2 className="text-[26px] sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words text-center">
                      {clienteActivo.nombre}
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1 flex items-center justify-center gap-1">
                      {clienteActivo.celular ? (
                        <>
                          <Phone size={12} className="shrink-0" />
                          <span>{clienteActivo.celular}</span>
                        </>
                      ) : (
                        "Sin celular registrado"
                      )}
                    </p>

                    {/* Acciones de edición y eliminación centradas y estéticas */}
                    {datosSesion?.rol !== 'cajero' && (
                      <div className="flex items-center justify-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 transition cursor-pointer active:scale-95 shadow-2xs"
                        >
                          <Edit3 size={12} className="shrink-0 text-slate-500 dark:text-slate-400" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                          title="Eliminar Cliente"
                          className="p-1 rounded-full bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700 cursor-pointer transition active:scale-95 shadow-2xs"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Fila 2: Saldo Destacado en tarjeta compacta */}
                  {(() => {
                    const deudaFiado = clienteActivo.deudaTotal || 0;
                    const saldoSeparesActivos = separesCliente
                      .filter((s: any) => s.estado === 'activo')
                      .reduce((acc: number, s: any) => acc + (s.saldoPendiente || 0), 0);
                    const tieneSaldoAFavor = deudaFiado < 0;
                    const totalCompromiso = tieneSaldoAFavor ? Math.abs(deudaFiado) : (deudaFiado + saldoSeparesActivos);

                    return (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs">
                        <div>
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${
                            tieneSaldoAFavor 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : (totalCompromiso === 0 ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                          }`}>
                            {tieneSaldoAFavor ? 'Saldo a Favor' : (totalCompromiso === 0 ? 'Estado' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                          </span>
                          {saldoSeparesActivos > 0 && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
                              {tieneSaldoAFavor ? (
                                <span className="text-emerald-600 dark:text-emerald-400">A favor: ${Math.abs(deudaFiado).toLocaleString('es-CO')}</span>
                              ) : (
                                <span>Fiados: ${deudaFiado.toLocaleString('es-CO')}</span>
                              )}
                              <span>•</span>
                              <span className="text-violet-600 dark:text-violet-400">Separes: ${saldoSeparesActivos.toLocaleString('es-CO')}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`text-xl font-black ${
                            !tieneSaldoAFavor && totalCompromiso === 0 
                              ? 'text-slate-400' 
                              : (tieneSaldoAFavor ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                          }`}>
                            {!tieneSaldoAFavor && totalCompromiso === 0 ? 'Al Día' : `$${totalCompromiso.toLocaleString('es-CO')}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Fila 3: Botones de Acción Rápidos */}
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} 
                      className="flex-1 py-2 px-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Vender
                    </button>
                    <button 
                      onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} 
                      className="flex-1 py-2 px-2 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Fiar
                    </button>
                    <button 
                      onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} 
                      className="flex-1 py-2 px-2 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Abonar
                    </button>
                    {puedeSepare ? (
                      <button 
                        onClick={() => router.push(`/dashboard/separe?clienteId=${clienteActivo.id}`)} 
                        className="flex-1 py-2 px-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                      >
                        Separe
                      </button>
                    ) : separesCliente.some(s => s.estado === 'activo') ? (
                      <button 
                        onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(clienteActivo.nombre)}`)} 
                        className="flex-1 py-2 px-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                      >
                        Ver Separes
                      </button>
                    ) : null}
                  </div>

                  {/* Fila 4: Botón de WhatsApp con texto visible y claro */}
                  {clienteActivo.celular && puedeEnviarWhatsApp && (
                    <button 
                      type="button"
                      onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} 
                      className="w-full py-2 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl border border-[#25D366]/40 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs"
                    >
                      <MessageCircle size={15} className="text-[#25D366] fill-[#25D366]/30" />
                      <span>Enviar estado de cuenta por WhatsApp</span>
                    </button>
                  )}
                </div>

                {/* HISTORIAL INTERNO DEL PERFIL */}
                <div className="bg-white dark:bg-[#0f172a] p-4 md:p-6 pb-32 md:pb-10 flex-1 overflow-y-auto space-y-4">
                  {/* CAJA DE NOTAS / REFERENCIAS DEL CLIENTE (IDÉNTICO A CLIENTES & CARTERA) */}
                  {(clienteActivo.notas || clienteActivo.direccion) && (
                    <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl space-y-1.5 text-left">
                      {clienteActivo.notas && (
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 block mb-0.5">
                            Notas / Referencias:
                          </span>
                          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                            {clienteActivo.notas}
                          </p>
                        </div>
                      )}
                      {clienteActivo.direccion && (
                        <div className={clienteActivo.notas ? "pt-1.5 border-t border-amber-200/50 dark:border-amber-900/30" : ""}>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                            Dirección:
                          </span>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {clienteActivo.direccion}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* SECCIÓN DE PLANES SEPARE DEL CLIENTE (SOLO SI TIENE ACTIVOS ANCLADOS) */}
                  {(() => {
                    const separesActivosCliente = separesCliente.filter(s => s.estado === 'activo');
                    if (separesActivosCliente.length === 0) return null;

                    return (
                      <div className="space-y-2.5 pb-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-violet-600 dark:text-violet-400 uppercase text-xs tracking-wider flex items-center gap-1.5">
                            <Bookmark size={15} /> Planes Separe Activos ({separesActivosCliente.length})
                          </h4>
                          <button
                            onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(clienteActivo.nombre)}`)}
                            className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            Ver en separes <ChevronRight size={13} />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {separesActivosCliente.map((sep) => {
                            const porcentaje = sep.total > 0 ? Math.min(100, Math.round(((sep.montoPagado || 0) / sep.total) * 100)) : 0;

                            return (
                              <div 
                                key={sep.id} 
                                onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(clienteActivo.nombre)}`)}
                                className="p-3.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-all space-y-2"
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
                                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
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
                                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    <span>Pagado: ${(sep.montoPagado || 0).toLocaleString('es-CO')} ({porcentaje}%)</span>
                                    <span className="text-violet-700 dark:text-violet-300 font-black">Saldo: ${(sep.saldoPendiente || 0).toLocaleString('es-CO')}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <Clock size={16}/> Historial de Movimientos
                  </h4>
                  {movimientosCliente.map(mov => {
                    const esDevolucionSepare = mov.categoria === 'devolucion_separe' || (mov.tipo === 'egreso' && (mov.concepto || '').toLowerCase().includes('separe'));
                    const esEgreso = mov.tipo === 'egreso';
                    const esDevolucion = mov.tipo === 'devolucion';
                    const esVentaOFiado = mov.tipo === 'venta' || mov.tipo === 'fiado';
                    const esSepare = Boolean((mov as any).idSepareOrigen || (mov as any).separeId) || 
                                     mov.tipo === 'entrega_separe' || 
                                     mov.subtipo?.includes('separe') || 
                                     Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes('separe'));
                    const esEntregaSepare = mov.tipo === 'entrega_separe';
                    const devolucionesAsociadas = movimientosCliente.filter((m: any) => m.tipo === 'devolucion' && m.movimientoOrigenId === mov.id);
                    const tieneDevolucion = devolucionesAsociadas.length > 0;

                    return (
                      <div key={mov.id} className={`p-4 md:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border ${esDevolucion ? 'border-amber-200 dark:border-amber-800/50' : 'border-slate-100 dark:border-slate-800'} shadow-sm relative overflow-hidden space-y-2 md:space-y-3`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          esDevolucion ? 'bg-amber-500' : (esDevolucionSepare ? 'bg-amber-500' : (esEgreso ? 'bg-orange-500' : (esEntregaSepare ? 'bg-purple-600' : (esSepare ? 'bg-violet-600' : (mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500'))))))
                        }`}></div>
                        
                        <div className="pl-1 md:pl-2">
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg shrink-0 inline-flex items-center gap-1 ${
                                mov.anulado
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                  : esDevolucion || esDevolucionSepare
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                  : (esEgreso
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300'
                                    : (esEntregaSepare
                                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                                      : (esSepare
                                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                                        : (mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')))))
                              }`}>
                                {mov.anulado ? (
                                  '🚫 ABONO ANULADO'
                                ) : (
                                  <>
                                    {(esDevolucion || esDevolucionSepare) && <RotateCcw size={10} />}
                                    {esDevolucion ? 'DEVOLUCIÓN' : (esDevolucionSepare ? 'DEV. SEPARE' : (esEgreso ? 'EGRESO' : (esEntregaSepare ? '📦 SEPARE ENTREGADO' : (esSepare ? (mov.subtipo === 'abono_inicial_separe' ? '🔖 SEPARE INICIAL' : (mov.subtipo === 'apertura_separe_sin_abono' || mov.monto === 0 ? '🔖 NUEVO SEPARE' : '🔖 ABONO SEPARE')) : (mov.tipo === 'abono' ? 'ABONO CUENTA' : mov.tipo)))))}
                                  </>
                                )}
                              </span>

                              {tieneDevolucion && (
                                <span className="text-[9px] md:text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 bg-amber-500 text-white shadow-xs flex items-center gap-1">
                                  <AlertTriangle size={10} /> Con Devolución
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-x-1.5 text-[10px] md:text-[11px] font-bold uppercase text-slate-400 shrink-0 ml-auto">
                              {mov.registradoPor && (
                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap inline-flex items-center gap-1">
                                  <User size={10} /> {mov.registradoPor}
                                </span>
                              )}
                              {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                              <span className="text-slate-400 whitespace-nowrap">
                                {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '')}
                              </span>
                            </div>
                          </div>
                          
                          {mov.detalles && mov.detalles.length > 0 ? (
                            <div className="space-y-1 md:space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700 md:border-none">
                              {mov.detalles.map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs md:text-sm min-w-0 gap-2">
                                  <span className="text-slate-600 dark:text-slate-300 font-medium truncate flex-1 min-w-0">
                                    {d.cantidad > 1 && <strong className={`${esDevolucion ? 'text-amber-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500'))} font-black mr-1 md:mr-1.5`}>{d.cantidad}x</strong>}
                                    {d.descripcion}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">${d.valor.toLocaleString('es-CO')}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{mov.descripcion || mov.concepto}</p>
                          )}

                          {mov.articulosDevueltos && mov.articulosDevueltos.length > 0 && (
                            <div className="mt-2 space-y-1 bg-amber-50 dark:bg-amber-950/20 p-2 md:p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                              <p className="text-[10px] md:text-[11px] font-black uppercase text-amber-600 dark:text-amber-400">Artículos devueltos:</p>
                              {mov.articulosDevueltos.map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs md:text-sm min-w-0 gap-2">
                                  <span className="text-slate-600 dark:text-slate-300 truncate flex-1 min-w-0"><span className="text-amber-600 font-bold">{d.cantidad}x</span> {d.descripcion}</span>
                                  <span className="font-bold text-amber-700 dark:text-amber-400 shrink-0">${Math.round(d.subtotal || 0).toLocaleString('es-CO')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center pt-2 mt-1 md:mt-0 md:pt-3 border-t border-slate-200 dark:border-slate-700 md:border-slate-100 dark:md:border-slate-800 font-black">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">
                              {esDevolucion || esDevolucionSepare || esEgreso ? 'Devuelto:' : 'Total:'}
                            </span>
                            <div className="flex items-center gap-2">
                              {esVentaOFiado && mov.detalles && mov.detalles.length > 0 && (datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.hacerDevoluciones) && (
                                <button
                                  type="button"
                                  onClick={() => setModalDevolucion({ isOpen: true, venta: mov })}
                                  className="text-[10px] md:text-[11px] font-bold px-2 py-1 md:px-2.5 md:py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 rounded-lg transition-colors cursor-pointer border border-amber-200 dark:border-amber-800 flex items-center gap-1 mr-1"
                                >
                                  <RotateCcw size={12} /> <span className="hidden md:inline">Hacer Devolución</span><span className="md:hidden">Devolver</span>
                                </button>
                              )}
                              {mov.tipo === 'abono' && Number(mov.monto) > 0 && !mov.anulado && !mov.id.startsWith('sep-apertura-') && (datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.hacerDevoluciones) && (
                                <button
                                  type="button"
                                  onClick={() => setModalAnularAbono({ isOpen: true, mov })}
                                  className="text-[10px] md:text-[11px] font-bold px-2 py-1 md:px-2.5 md:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1 mr-1"
                                  title="Anular abono ingresado por error o duplicado"
                                >
                                  <RotateCcw size={12} /> <span className="hidden md:inline">Anular Abono</span><span className="md:hidden">Anular</span>
                                </button>
                              )}
                              {mov.tipo !== 'egreso' && (
                                <button
                                  type="button"
                                  onClick={() => abrirTicketDeMovimiento(mov, clienteActivo)}
                                  title="Imprimir Factura"
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                                >
                                  <Printer size={14} />
                                </button>
                              )}
                              <span className={`text-base md:text-xl font-black ${
                                mov.anulado ? 'line-through text-slate-400 opacity-60' :
                                (esDevolucion || esDevolucionSepare || esEgreso ? 'text-amber-600 dark:text-amber-400' : (esEntregaSepare ? 'text-purple-600 dark:text-purple-400' : (esSepare ? 'text-violet-600 dark:text-violet-400' : (mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')))))
                              }`}>
                                {mov.anulado ? `(Anulado) $${Math.round(mov.monto || 0).toLocaleString('es-CO')}` : (esEntregaSepare ? 'Entregado' : (mov.subtipo === 'apertura_separe_sin_abono' || (mov.monto === 0 && esSepare) ? 'Reservado ($0)' : `${mov.tipo === 'fiado' || esDevolucion || esDevolucionSepare || esEgreso ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}`))}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {movimientosCliente.length === 0 && <p className="text-center text-slate-400 py-10">Sin transacciones registradas.</p>}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 flex-col items-center justify-center p-12 text-center text-slate-400 relative">
                <button
                  type="button"
                  onClick={() => {
                    setVerTodosClientes(false);
                    setClienteActivo(null);
                  }}
                  title="Cerrar directorio (Esc)"
                  className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
                <Users size={48} className="text-slate-300 dark:text-slate-700 mb-4 stroke-1" />
                <p className="text-base font-bold text-slate-600 dark:text-slate-300 mb-1">Selecciona un cliente</p>
                <p className="text-xs text-slate-400">Haz clic en cualquier cliente de la lista para ver su perfil e historial de movimientos.</p>
              </div>
            )}
            
          </div>
        </div>,
        document.body
      )}

      {/* --- MODAL UNIFICADO REGISTRAR NUEVO CLIENTE --- */}
      <ModalNuevoCliente
        isOpen={modalNuevoCliente}
        onClose={() => setModalNuevoCliente(false)}
        nombreInicial={nombreNuevo || busqueda}
        onClienteCreado={(nuevoCliente) => {
          setClienteActivo(nuevoCliente);
          cargarMovimientosClienteDirecto(nuevoCliente.id);
          setVerTodosClientes(true);
          setBusqueda("");
          setNombreNuevo("");
        }}
      />

      {modalSuscripcion.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[800]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center">
            <Star size={40} className="text-blue-600 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalSuscripcion.titulo}</h3>
            <p className="text-base text-slate-500 mb-6">{modalSuscripcion.mensaje}</p>
            <button onClick={() => setModalSuscripcion({ visible: false, titulo: "", mensaje: "" })} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl">Entendido</button>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN DE TICKET TÉRMICO */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
        onFacturaEmitida={(fInfo) => {
          setModalTicketFactura((prev) => prev.datos ? ({
            ...prev,
            datos: { ...prev.datos, facturaElectronica: fInfo }
          }) : prev);
          if (clienteActivo) {
            cargarMovimientosClienteDirecto(clienteActivo.id);
          }
        }}
      />

      {/* MODAL DE MODIFICAR / ELIMINAR CLIENTE */}
      <ModalGestionCliente
        isOpen={modalGestionCliente.visible}
        modo={modalGestionCliente.modo}
        cliente={modalGestionCliente.cliente}
        onClose={() => setModalGestionCliente({ visible: false, modo: 'editar', cliente: null })}
        onSuccess={handleGestionClienteSuccess}
      />

      {/* MODAL DE PROCESAR DEVOLUCIÓN */}
      <ModalProcesarDevolucion
        isOpen={modalDevolucion.isOpen}
        ventaOrigen={modalDevolucion.venta as any}
        onClose={() => setModalDevolucion({ isOpen: false, venta: null })}
        onSuccess={(res) => {
          if (clienteActivo) {
            if (res.saldoNuevo !== undefined) {
               setClienteActivo({ ...clienteActivo, deudaTotal: res.saldoNuevo });
            }
            cargarMovimientosClienteDirecto(clienteActivo.id);
          }
        }}
      />

      {/* MODAL PARA ANULAR ABONO POR ERROR */}
      <ModalAnularAbono
        isOpen={modalAnularAbono.isOpen}
        movimiento={modalAnularAbono.mov}
        onClose={() => setModalAnularAbono({ isOpen: false, mov: null })}
        onSuccess={() => {
          if (clienteActivo) {
            cargarMovimientosClienteDirecto(clienteActivo.id);
          }
        }}
      />

      {/* MODAL CIERRE DE CAJA */}
      <ModalCierreCaja
        isOpen={modalCierreCajaOpen}
        onClose={() => setModalCierreCajaOpen(false)}
      />

      {/* MODAL DE TOUR INTERACTIVO DE BIENVENIDA */}
      <ModalTourBienvenida
        isOpen={modalTourBienvenida}
        onClose={() => {
          setModalTourBienvenida(false);
          setMostrarBotonTour(false);
        }}
        nombreUsuario={datosSesion?.nombreUsuario || ''}
        nombreNegocio={nombreNegocio || ''}
        cuentaPrincipalId={cuentaPrincipalId || ''}
        plan={planActual || 'comercio'}
      />

    </>
  );
}