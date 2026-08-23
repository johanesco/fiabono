"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { OrdenPendiente } from "@/types";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import toast from "react-hot-toast";
import { 
  Receipt, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Package, 
  ArrowLeft, 
  AlertCircle, 
  Filter, 
  Store, 
  Printer, 
  MessageCircle,
  Eye,
  Trash2,
  Calendar,
  Edit2,
  Plus,
  Minus,
  Tag,
  Percent,
  Search,
  X,
  Banknote,
  Smartphone,
  CreditCard,
  Zap,
  ShoppingCart
} from "lucide-react";

export default function OrdenesPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.esAdmin ?? true;
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const nombreUsuario = datosSesion?.nombreUsuario || "Administrador";

  const [ordenes, setOrdenes] = useState<OrdenPendiente[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<'pendiente' | 'aprobado' | 'rechazado' | 'todos'>('pendiente');
  const [cargando, setCargando] = useState(true);

  // Modal de Detalle / Revisión
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenPendiente | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Modal de Edición de Orden
  const [modalEdicion, setModalEdicion] = useState<{
    visible: boolean;
    orden: OrdenPendiente | null;
    tipo: 'venta' | 'fiado';
    items: { descripcion: string; valor: string; cantidad: number }[];
    clienteId: string | null;
    clienteNombre: string;
    clienteCelular: string;
    descuentoTipo: 'porcentaje' | 'fijo' | null;
    descuentoValor: string;
    pagoCliente: string;
    metodoPago: string;
    subMetodoPago: string;
    referenciaPago: string;
    busquedaCliente: string;
    mostrarBuscadorCliente: boolean;
  }>({
    visible: false,
    orden: null,
    tipo: 'venta',
    items: [],
    clienteId: null,
    clienteNombre: "Mostrador",
    clienteCelular: "",
    descuentoTipo: null,
    descuentoValor: "",
    pagoCliente: "",
    metodoPago: "efectivo",
    subMetodoPago: "",
    referenciaPago: "",
    busquedaCliente: "",
    mostrarBuscadorCliente: false
  });
  const [busquedaProductoIndexEdicion, setBusquedaProductoIndexEdicion] = useState<number | null>(null);

  // Modal de Rechazo
  const [modalRechazo, setModalRechazo] = useState<{ visible: boolean; orden: OrdenPendiente | null; motivo: string }>({
    visible: false,
    orden: null,
    motivo: ""
  });
  // Modal de Ticket Térmico
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: DatosFacturaProps | null }>({
    visible: false,
    datos: null
  });

  // Modal de Éxito Integral tras Aprobar Orden (WhatsApp + Factura + Detalles)
  const [modalExitoAprobacion, setModalExitoAprobacion] = useState<{
    visible: boolean;
    orden: OrdenPendiente | null;
    ticketDatos: DatosFacturaProps | null;
  }>({
    visible: false,
    orden: null,
    ticketDatos: null
  });

  // Modal de Confirmación tras Guardar Cambios
  const [modalConfirmacionGuardado, setModalConfirmacionGuardado] = useState<{
    visible: boolean;
    ordenId: string;
    colaborador: string;
    total: number;
  }>({
    visible: false,
    ordenId: "",
    colaborador: "",
    total: 0
  });

  // Normalizar y abrir WhatsApp de comprobante
  const normalizarMensajeWhatsApp = (texto: string) => {
    return texto
      .replace(/\uFFFD/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\r\n/g, '\n')
      .trim();
  };

  const abrirWhatsAppComprobanteOrden = (orden: OrdenPendiente) => {
    const nombreDestino = orden.clienteNombre && orden.clienteNombre !== 'Mostrador' ? orden.clienteNombre : 'Estimado/a Cliente';
    const esFiado = orden.tipo === 'fiado';
    const encabezadoTitulo = esFiado ? 'COMPROBANTE DE FIADO' : 'COMPROBANTE DE COMPRA';

    let detalleTexto = '';
    orden.items.forEach(f => {
      const unitario = parseFloat(f.valor) || 0;
      const subtotalFila = unitario * f.cantidad;
      const desc = f.descripcion?.trim() || 'Artículo';
      detalleTexto += `• ${f.cantidad}x ${desc}\n  Precio unitario: *$${unitario.toLocaleString('es-CO')}*\n  Subtotal: *$${subtotalFila.toLocaleString('es-CO')}*\n\n`;
    });

    if (orden.montoDescuento && orden.montoDescuento > 0) {
      detalleTexto += `*Subtotal:* $${(orden.totalBruto || orden.total).toLocaleString('es-CO')}\n*Descuento:* -$${orden.montoDescuento.toLocaleString('es-CO')}\n`;
    }

    const texto = `¡Hola, *${nombreDestino}*! Gracias por tu confianza en *${nombreNegocio}*.

===================
*${encabezadoTitulo}*
===================

${detalleTexto}*TOTAL: $${orden.total.toLocaleString('es-CO')}*
*Atendido por:* ${orden.nombreColaborador}

¡Muchas gracias por tu compra! Estamos atentos para cualquier consulta.

*¡Te esperamos pronto!*`;

    const mensajeLimpio = normalizarMensajeWhatsApp(texto);
    const celularLimpio = orden.clienteCelular ? orden.clienteCelular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(mensajeLimpio)}` : `https://wa.me/?text=${encodeURIComponent(mensajeLimpio)}`;
    window.open(url, '_blank');
  };

  const abrirFacturaDeOrdenAprobada = (orden: OrdenPendiente) => {
    const detallesParaComprobante: any[] = [];
    const resumenNombres: string[] = [];

    for (const item of orden.items) {
      const valUnitario = parseFloat(item.valor) || 0;
      const subtotalFila = valUnitario * item.cantidad;
      const desc = item.descripcion?.trim() || "Artículo";
      detallesParaComprobante.push({
        descripcion: desc,
        valor: subtotalFila,
        cantidad: item.cantidad,
        valorUnitario: valUnitario
      });
      if (item.cantidad > 1) resumenNombres.push(`${item.cantidad}x ${desc}`);
      else resumenNombres.push(desc);
    }
    const descripcionUnificada = resumenNombres.join(", ");

    const ivaHabilitado = datosSesion?.habilitarIva || false;
    const tasaIvaPorcentaje = typeof datosSesion?.porcentajeIva === 'number' ? datosSesion.porcentajeIva : 19;
    const tasaIva = tasaIvaPorcentaje / 100;
    const subtotalCalculado = ivaHabilitado ? Math.round(orden.total / (1 + tasaIva)) : orden.total;
    const ivaCalculado = ivaHabilitado ? (orden.total - subtotalCalculado) : 0;

    const fechaTicket = orden.fechaProcesado?.toDate ? orden.fechaProcesado.toDate() : (orden.fecha?.toDate ? orden.fecha.toDate() : new Date());

    setModalTicketFactura({
      visible: true,
      datos: {
        nombreNegocio,
        telefonoNegocio: datosSesion?.telefonoNegocio || '',
        correoNegocio: datosSesion?.correoNegocio || '',
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || '',
        direccionNegocio: datosSesion?.direccionNegocio || '',
        mensajePieTicket: datosSesion?.mensajePieTicket || '',
        nombreCliente: orden.clienteNombre || 'Cliente',
        celularCliente: orden.clienteCelular || '',
        registradoPor: orden.nombreColaborador,
        fecha: fechaTicket,
        tipo: orden.tipo,
        detalles: detallesParaComprobante,
        descripcionGeneral: descripcionUnificada,
        montoTotal: orden.total,
        idTransaccion: orden.idTransaccion,
        metodoPago: (orden.metodoPago as any) || 'efectivo',
        referenciaPago: [orden.subMetodoPago, orden.referenciaPago].filter(Boolean).join(' — ') || undefined,
        subtotal: subtotalCalculado,
        valorIva: ivaCalculado,
        porcentajeIva: tasaIvaPorcentaje,
        descuentoTipo: orden.descuentoTipo,
        descuentoValor: orden.descuentoValor ?? undefined,
        montoDescuento: orden.montoDescuento
      }
    });
  };

  // Guardar Cambios de la Edición
  const guardarCambiosEdicion = async (yAprobar: boolean = false) => {
    if (!modalEdicion.orden) return;
    const filasValidas = modalEdicion.items.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) return toast.error("Ingresa al menos un artículo con valor válido.");

    const pagoRaw = (modalEdicion.pagoCliente || '').replace(/\D/g, '');
    const pagoNum = pagoRaw === '' ? (modalEdicion.tipo === 'fiado' ? 0 : totalEdicion) : parseFloat(pagoRaw);

    // Validar cliente obligatorio si es fiado total o parcial
    if ((modalEdicion.tipo === 'fiado' || pagoNum < totalEdicion) && (!modalEdicion.clienteNombre || modalEdicion.clienteNombre === 'Mostrador')) {
      return toast.error("Para fiar o registrar pago parcial se requiere seleccionar un cliente registrado.");
    }

    setProcesandoId(modalEdicion.orden.id);

    try {
      const ordenActualizada: Record<string, any> = {
        tipo: modalEdicion.tipo,
        items: filasValidas,
        totalBruto: subtotalEdicion,
        montoDescuento: montoDescuentoEdicion,
        total: totalEdicion,
        pagoCliente: pagoNum,
        metodoPago: modalEdicion.tipo === 'fiado' ? 'fiado' : (modalEdicion.metodoPago || 'efectivo'),
        clienteId: modalEdicion.clienteId || null,
        clienteNombre: modalEdicion.clienteNombre || 'Mostrador',
        clienteCelular: modalEdicion.clienteCelular || '',
        descuentoTipo: modalEdicion.descuentoTipo || null,
        descuentoValor: modalEdicion.descuentoTipo && modalEdicion.descuentoValor ? Number(modalEdicion.descuentoValor.replace(/\D/g, '')) : null,
        subMetodoPago: modalEdicion.subMetodoPago || null,
        referenciaPago: modalEdicion.referenciaPago || null,
        fechaModificado: new Date()
      };

      await updateDoc(doc(db, "ordenes_pendientes", modalEdicion.orden.id), ordenActualizada);

      const ordenCompletaParaAprobar: OrdenPendiente = {
        ...modalEdicion.orden,
        ...ordenActualizada
      } as OrdenPendiente;

      const ordenPrevia = modalEdicion.orden;
      setModalEdicion({ ...modalEdicion, visible: false, orden: null });

      if (yAprobar) {
        await aprobarOrden(ordenCompletaParaAprobar);
      } else {
        toast.success("¡Cambios guardados con éxito!", { icon: '💾' });
        setModalConfirmacionGuardado({
          visible: true,
          ordenId: ordenPrevia.id,
          colaborador: ordenPrevia.nombreColaborador,
          total: totalEdicion
        });
      }
    } catch (e: any) {
      console.error("Error al actualizar orden:", e);
      toast.error(e?.message || "Error al guardar cambios de la orden.");
    } finally {
      setProcesandoId(null);
    }
  };

  // Cargar inventario y clientes
  useEffect(() => {
    if (cuentaPrincipalId) {
      const cargarDatos = async () => {
        try {
          const qI = query(collection(db, "inventario"), where("usuarioId", "==", cuentaPrincipalId));
          const snapI = await getDocs(qI);
          const listaI: any[] = [];
          snapI.forEach(d => listaI.push({ id: d.id, ...d.data() }));
          setInventario(listaI);

          const qC = query(collection(db, "clientes"), where("usuarioId", "==", cuentaPrincipalId));
          const snapC = await getDocs(qC);
          const listaC: any[] = [];
          snapC.forEach(d => listaC.push({ id: d.id, ...d.data() }));
          listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
          setClientes(listaC);
        } catch (e) {
          console.error("Error al cargar datos auxiliares:", e);
        }
      };
      cargarDatos();
    }
  }, [cuentaPrincipalId]);

  // Abrir Modal de Edición
  const abrirModalEdicion = (orden: OrdenPendiente) => {
    const esFiado = orden.tipo === 'fiado';
    setModalEdicion({
      visible: true,
      orden: orden,
      tipo: orden.tipo || 'venta',
      items: orden.items.map(i => ({ ...i })),
      clienteId: orden.clienteId,
      clienteNombre: orden.clienteNombre,
      clienteCelular: orden.clienteCelular || "",
      descuentoTipo: orden.descuentoTipo || null,
      descuentoValor: orden.descuentoValor ? String(orden.descuentoValor) : "",
      pagoCliente: orden.pagoCliente !== undefined ? String(orden.pagoCliente) : (esFiado ? '0' : String(orden.total)),
      metodoPago: orden.metodoPago || (esFiado ? 'fiado' : 'efectivo'),
      subMetodoPago: orden.subMetodoPago || "",
      referenciaPago: orden.referenciaPago || "",
      busquedaCliente: "",
      mostrarBuscadorCliente: false
    });
  };

  const actualizarItemEdicion = (idx: number, campo: 'descripcion' | 'valor' | 'cantidad', valor: any) => {
    const nuevosItems = [...modalEdicion.items];
    if (campo === 'valor') {
      nuevosItems[idx][campo] = valor.replace(/\D/g, '');
    } else if (campo === 'cantidad') {
      nuevosItems[idx][campo] = Math.max(1, parseInt(valor) || 1);
    } else {
      nuevosItems[idx][campo] = valor;
    }
    setModalEdicion({ ...modalEdicion, items: nuevosItems });
  };

  const agregarFilaEdicion = () => {
    setModalEdicion({
      ...modalEdicion,
      items: [...modalEdicion.items, { descripcion: "", valor: "", cantidad: 1 }]
    });
  };

  const eliminarFilaEdicion = (idx: number) => {
    if (modalEdicion.items.length <= 1) {
      setModalEdicion({
        ...modalEdicion,
        items: [{ descripcion: "", valor: "", cantidad: 1 }]
      });
      return;
    }
    setModalEdicion({
      ...modalEdicion,
      items: modalEdicion.items.filter((_, i) => i !== idx)
    });
  };

  // Cálculos dinámicos en edición
  const subtotalEdicion = modalEdicion.items.reduce((acc, item) => {
    const val = parseFloat(item.valor || "0");
    return acc + (isNaN(val) ? 0 : val * item.cantidad);
  }, 0);

  const calcularDescuentoEdicion = () => {
    if (!modalEdicion.descuentoTipo || !modalEdicion.descuentoValor) return 0;
    const num = parseFloat(modalEdicion.descuentoValor.replace(/\D/g, '')) || 0;
    if (num <= 0) return 0;
    if (modalEdicion.descuentoTipo === 'porcentaje') {
      return Math.round(subtotalEdicion * (Math.min(100, num) / 100));
    }
    return Math.min(subtotalEdicion, num);
  };

  const montoDescuentoEdicion = calcularDescuentoEdicion();
  const totalEdicion = Math.max(0, subtotalEdicion - montoDescuentoEdicion);

  // Listener en tiempo real de órdenes
  useEffect(() => {
    if (!cuentaPrincipalId) return;

    setCargando(true);
    const qOrdenes = query(
      collection(db, "ordenes_pendientes"),
      where("usuarioId", "==", cuentaPrincipalId)
    );

    const unsub = onSnapshot(qOrdenes, (snapshot) => {
      const lista: OrdenPendiente[] = [];
      snapshot.forEach(docSnap => {
        lista.push({ id: docSnap.id, ...docSnap.data() } as OrdenPendiente);
      });
      // Ordenar por fecha descendente
      lista.sort((a, b) => {
        const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime();
        const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime();
        return timeB - timeA;
      });
      setOrdenes(lista);
      setCargando(false);
    }, (error) => {
      console.error("Error en listener de órdenes:", error);
      setCargando(false);
    });

    return () => unsub();
  }, [cuentaPrincipalId]);

  const ordenesFiltradas = ordenes.filter(ord => {
    if (filtroEstado === 'todos') return true;
    return ord.estado === filtroEstado;
  });

  const pendientesCount = ordenes.filter(o => o.estado === 'pendiente').length;

  // Aprobar y convertir en transacción real
  const aprobarOrden = async (orden: OrdenPendiente) => {
    if (!cuentaPrincipalId) return;
    setProcesandoId(orden.id);

    try {
      // 1. Validar stock de productos inventariables
      for (const item of orden.items) {
        const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
        const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
        if (esInv && (pInv.stock || 0) < item.cantidad) {
          toast.error(`Sin stock suficiente de "${item.descripcion}". Quedan: ${pInv.stock}`);
          setProcesandoId(null);
          return;
        }
      }

      // 2. Preparar detalles del comprobante
      const detallesParaComprobante: any[] = [];
      const resumenNombres: string[] = [];
      for (const item of orden.items) {
        const valUnitario = parseFloat(item.valor) || 0;
        const subtotalFila = valUnitario * item.cantidad;
        const desc = item.descripcion.trim() || "Artículo";
        detallesParaComprobante.push({
          descripcion: desc,
          valor: subtotalFila,
          cantidad: item.cantidad,
          valorUnitario: valUnitario
        });
        if (item.cantidad > 1) resumenNombres.push(`${item.cantidad}x ${desc}`);
        else resumenNombres.push(desc);
      }
      const descripcionUnificada = resumenNombres.join(", ");

      const ivaHabilitado = datosSesion?.habilitarIva || false;
      const tasaIvaPorcentaje = typeof datosSesion?.porcentajeIva === 'number' ? datosSesion.porcentajeIva : 19;
      const tasaIva = tasaIvaPorcentaje / 100;
      const subtotalCalculado = ivaHabilitado ? Math.round(orden.total / (1 + tasaIva)) : orden.total;
      const ivaCalculado = ivaHabilitado ? (orden.total - subtotalCalculado) : 0;

      let idTransaccionGenerada = "";
      let saldoClienteResultante: number | undefined = undefined;

      const pagoNum = typeof orden.pagoCliente === 'number' 
        ? orden.pagoCliente 
        : (typeof orden.pagoCliente === 'string' && orden.pagoCliente !== '' 
            ? parseFloat(orden.pagoCliente.replace(/\D/g, '')) 
            : (orden.tipo === 'fiado' ? 0 : orden.total));

      if (orden.tipo === 'fiado' || pagoNum === 0) {
        // 1. Fiado Total
        const resFiado = await API_DB.registrarMovimientoConTransaccion(
          {
            clienteId: orden.clienteId!,
            usuarioId: cuentaPrincipalId,
            tipo: 'fiado',
            monto: orden.total,
            descripcion: descripcionUnificada + ` (Aprobada de ${orden.nombreColaborador})` + (orden.montoDescuento > 0 ? ` [Dto: -$${orden.montoDescuento.toLocaleString('es-CO')}]` : ''),
            detalles: detallesParaComprobante,
            fecha: new Date(),
            registradoPor: orden.nombreColaborador,
            metodoPago: 'fiado',
            descuentoTipo: orden.descuentoTipo,
            descuentoValor: orden.descuentoValor ?? undefined,
            montoDescuento: orden.montoDescuento > 0 ? orden.montoDescuento : undefined
          },
          {
            ajustarSaldoCliente: true,
            cambioDeuda: orden.total
          }
        );
        idTransaccionGenerada = resFiado.movimientoId;
        saldoClienteResultante = resFiado.nuevoSaldoCliente;
      } else if (pagoNum > 0 && pagoNum < orden.total) {
        // 2. Venta y Fiado Mixto
        const saldoFiar = orden.total - pagoNum;
        const resVenta = await API_DB.registrarMovimientoConTransaccion({
          clienteId: orden.clienteId || 'mostrador',
          usuarioId: cuentaPrincipalId,
          tipo: 'venta',
          monto: pagoNum,
          descripcion: descripcionUnificada + ` (Pago inicial orden mixta de ${orden.nombreColaborador})`,
          detalles: detallesParaComprobante,
          fecha: new Date(),
          registradoPor: orden.nombreColaborador,
          metodoPago: (orden.metodoPago as any) || 'efectivo',
          referenciaPago: [orden.subMetodoPago, orden.referenciaPago].filter(Boolean).join(' — ') || undefined,
          descuentoTipo: orden.descuentoTipo,
          descuentoValor: orden.descuentoValor ?? undefined,
          montoDescuento: orden.montoDescuento > 0 ? orden.montoDescuento : undefined
        });
        idTransaccionGenerada = resVenta.movimientoId;

        if (orden.clienteId && orden.clienteId !== 'mostrador') {
          const resFiado = await API_DB.registrarMovimientoConTransaccion(
            {
              clienteId: orden.clienteId,
              usuarioId: cuentaPrincipalId,
              tipo: 'fiado',
              monto: saldoFiar,
              descripcion: `Saldo pendiente orden #${orden.id.substring(0, 5)} (Total: $${orden.total.toLocaleString('es-CO')}, Pagado: $${pagoNum.toLocaleString('es-CO')})`,
              fecha: new Date(),
              registradoPor: orden.nombreColaborador,
              metodoPago: 'fiado'
            },
            {
              ajustarSaldoCliente: true,
              cambioDeuda: saldoFiar
            }
          );
          saldoClienteResultante = resFiado.nuevoSaldoCliente;
        }
      } else {
        // 3. Venta Completa
        const resVenta = await API_DB.registrarMovimientoConTransaccion({
          clienteId: orden.clienteId || 'mostrador',
          usuarioId: cuentaPrincipalId,
          tipo: 'venta',
          monto: orden.total,
          descripcion: descripcionUnificada + ` (Aprobada de ${orden.nombreColaborador})` + (orden.montoDescuento > 0 ? ` [Dto: -$${orden.montoDescuento.toLocaleString('es-CO')}]` : ''),
          detalles: detallesParaComprobante,
          fecha: new Date(),
          registradoPor: orden.nombreColaborador,
          metodoPago: (orden.metodoPago as any) || 'efectivo',
          referenciaPago: [orden.subMetodoPago, orden.referenciaPago].filter(Boolean).join(' — ') || undefined,
          subtotal: subtotalCalculado,
          valorIva: ivaCalculado,
          porcentajeIva: tasaIvaPorcentaje,
          descuentoTipo: orden.descuentoTipo,
          descuentoValor: orden.descuentoValor ?? undefined,
          montoDescuento: orden.montoDescuento > 0 ? orden.montoDescuento : undefined
        });
        idTransaccionGenerada = resVenta.movimientoId;
      }

      // 3. Descontar stock de inventario físico
      for (const item of orden.items) {
        const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
        const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
        if (esInv) {
          await updateDoc(doc(db, "inventario", pInv.id), {
            stock: Math.max(0, (pInv.stock || 0) - item.cantidad)
          });
        }
      }

      // 4. Actualizar estado de la orden a 'aprobado'
      await updateDoc(doc(db, "ordenes_pendientes", orden.id), {
        estado: 'aprobado',
        fechaProcesado: new Date(),
        aprobadoPor: nombreUsuario,
        idTransaccion: idTransaccionGenerada
      });

      toast.success(`¡Orden de ${orden.nombreColaborador} aprobada y registrada!`, { icon: '✅' });
      setOrdenSeleccionada(null);

      const ticketGenerado: DatosFacturaProps = {
        nombreNegocio,
        telefonoNegocio: datosSesion?.telefonoNegocio || '',
        correoNegocio: datosSesion?.correoNegocio || '',
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || '',
        direccionNegocio: datosSesion?.direccionNegocio || '',
        mensajePieTicket: datosSesion?.mensajePieTicket || '',
        nombreCliente: orden.clienteNombre || 'Cliente',
        celularCliente: orden.clienteCelular || '',
        registradoPor: orden.nombreColaborador,
        fecha: new Date(),
        tipo: orden.tipo,
        detalles: detallesParaComprobante,
        descripcionGeneral: descripcionUnificada,
        montoTotal: orden.total,
        saldoNuevo: saldoClienteResultante,
        idTransaccion: idTransaccionGenerada,
        metodoPago: (orden.metodoPago as any) || 'efectivo',
        referenciaPago: [orden.subMetodoPago, orden.referenciaPago].filter(Boolean).join(' — ') || undefined,
        subtotal: subtotalCalculado,
        valorIva: ivaCalculado,
        porcentajeIva: tasaIvaPorcentaje,
        descuentoTipo: orden.descuentoTipo,
        descuentoValor: orden.descuentoValor ?? undefined,
        montoDescuento: orden.montoDescuento
      };

      setModalExitoAprobacion({
        visible: true,
        orden: {
          ...orden,
          idTransaccion: idTransaccionGenerada,
          estado: 'aprobado'
        },
        ticketDatos: ticketGenerado
      });
    } catch (e) {
      console.error(e);
      toast.error("Error al aprobar la orden.");
    } finally {
      setProcesandoId(null);
    }
  };

  // Rechazar orden
  const confirmarRechazo = async () => {
    if (!modalRechazo.orden) return;
    setProcesandoId(modalRechazo.orden.id);

    try {
      await updateDoc(doc(db, "ordenes_pendientes", modalRechazo.orden.id), {
        estado: 'rechazado',
        fechaProcesado: new Date(),
        aprobadoPor: nombreUsuario,
        motivoRechazo: modalRechazo.motivo.trim() || "Rechazada por el administrador"
      });

      toast.success("Orden rechazada.");
      setModalRechazo({ visible: false, orden: null, motivo: "" });
      setOrdenSeleccionada(null);
    } catch (e) {
      toast.error("Error al rechazar la orden.");
    } finally {
      setProcesandoId(null);
    }
  };

  const formatearFecha = (fechaTimestamp: any) => {
    if (!fechaTimestamp) return "";
    const f = fechaTimestamp.toDate ? fechaTimestamp.toDate() : new Date(fechaTimestamp);
    return f.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
      
      {/* HEADER SUPERIOR */}
      <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 p-4 md:p-6 flex justify-between items-center shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard/inicio')} 
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="text-amber-500" size={24} /> Órdenes Pendientes
              </h2>
              {pendientesCount > 0 && (
                <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full animate-pulse">
                  {pendientesCount} nueva{pendientesCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-400 mt-0.5">Revisa, aprueba o rechaza las ventas y fiados de tus colaboradores</p>
          </div>
        </div>

        {/* FILTROS DE ESTADO */}
        <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl gap-1">
          {(['pendiente', 'aprobado', 'rechazado', 'todos'] as const).map((est) => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all capitalize ${
                filtroEstado === est
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              {est === 'todos' ? 'Todas' : est} {est === 'pendiente' && pendientesCount > 0 ? `(${pendientesCount})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* FILTROS EN MÓVIL */}
      <div className="sm:hidden flex bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 p-2 gap-1 overflow-x-auto">
        {(['pendiente', 'aprobado', 'rechazado', 'todos'] as const).map((est) => (
          <button
            key={est}
            onClick={() => setFiltroEstado(est)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap capitalize transition-all ${
              filtroEstado === est
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {est === 'todos' ? 'Todas' : est} {est === 'pendiente' && pendientesCount > 0 ? `(${pendientesCount})` : ''}
          </button>
        ))}
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-bold">Cargando órdenes...</span>
            </div>
          ) : ordenesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-8 shadow-sm max-w-xl mx-auto">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">
                {filtroEstado === 'pendiente' ? '¡Todo al día! No hay órdenes pendientes' : 'No hay órdenes en esta sección'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                {filtroEstado === 'pendiente'
                  ? 'Cuando tus colaboradores registren ventas o fiados sin permisos de venta directa, aparecerán aquí para tu aprobación.'
                  : 'Las órdenes aprobadas o rechazadas se mostrarán en este historial.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
              {ordenesFiltradas.map((ord) => {
                const esPendiente = ord.estado === 'pendiente';
                const esFiado = ord.tipo === 'fiado';
                const estaProcesando = procesandoId === ord.id;

                return (
                  <div
                    key={ord.id}
                    className={`bg-white dark:bg-[#0f172a] rounded-3xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                      esPendiente
                        ? 'border-amber-200 dark:border-amber-500/30 shadow-sm'
                        : ord.estado === 'aprobado'
                        ? 'border-emerald-100 dark:border-emerald-500/20 opacity-85'
                        : 'border-rose-100 dark:border-rose-500/20 opacity-75'
                    }`}
                  >
                    {/* CABECERA DE LA TARJETA */}
                    <div className="p-4 sm:p-5 pb-3">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                              esFiado
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {ord.tipo}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold capitalize ${
                              ord.estado === 'pendiente'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : ord.estado === 'aprobado'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {ord.estado}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock size={12} /> {formatearFecha(ord.fecha)}
                        </span>
                      </div>

                      {/* INFORMACIÓN DE QUIÉN Y CLIENTE */}
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold">
                          <User size={13} className="text-slate-400" />
                          <span>Colaborador:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{ord.nombreColaborador}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold">
                          <Store size={13} className="text-slate-400" />
                          <span>Cliente:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{ord.clienteNombre}</strong>
                        </div>
                      </div>

                      {/* LISTA DE ARTÍCULOS */}
                      <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-3 space-y-1.5 mb-3 border border-slate-100 dark:border-slate-800/80">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                              {item.cantidad}x {item.descripcion || "Artículo"}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              ${((parseFloat(item.valor) || 0) * item.cantidad).toLocaleString('es-CO')}
                            </span>
                          </div>
                        ))}

                        {ord.montoDescuento > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-emerald-600 dark:text-emerald-400 pt-1 border-t border-slate-200/60 dark:border-slate-700 font-bold">
                            <span>Descuento aplicado:</span>
                            <span>-${ord.montoDescuento.toLocaleString('es-CO')}</span>
                          </div>
                        )}
                      </div>

                      {/* TOTAL */}
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Cobrar</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                          ${ord.total.toLocaleString('es-CO')}
                        </span>
                      </div>

                      {/* MOTIVO DE RECHAZO SI APLICA */}
                      {ord.estado === 'rechazado' && ord.motivoRechazo && (
                        <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-400">
                          <strong>Motivo:</strong> {ord.motivoRechazo}
                        </div>
                      )}
                    </div>

                    {/* BOTONES DE ACCIÓN PARA PENDIENTES */}
                    {esPendiente && (
                      <div className="p-3 bg-slate-50 dark:bg-[#020617]/50 border-t border-slate-100 dark:border-slate-800/80 flex gap-2">
                        <button
                          onClick={() => setModalRechazo({ visible: true, orden: ord, motivo: "" })}
                          disabled={estaProcesando}
                          className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          title="Rechazar orden"
                        >
                          <XCircle size={15} />
                        </button>
                        <button
                          onClick={() => abrirModalEdicion(ord)}
                          disabled={estaProcesando}
                          className="flex-1 py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-amber-500/20 cursor-pointer"
                        >
                          <Edit2 size={15} /> Editar
                        </button>
                        <button
                          onClick={() => aprobarOrden(ord)}
                          disabled={estaProcesando}
                          className="flex-1 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {estaProcesando ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <CheckCircle2 size={16} /> Aprobar
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* BOTONES DE ACCIÓN PARA ORDENES APROBADAS */}
                    {ord.estado === 'aprobado' && (
                      <div className="p-3 bg-slate-50 dark:bg-[#020617]/50 border-t border-slate-100 dark:border-slate-800/80 flex gap-2">
                        <button
                          type="button"
                          onClick={() => abrirFacturaDeOrdenAprobada(ord)}
                          className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Printer size={14} /> Ver Factura / Ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirWhatsAppComprobanteOrden(ord)}
                          className="py-2.5 px-3 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#1ebd5a] dark:text-[#25D366] font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 border border-[#25D366]/30 cursor-pointer"
                          title="Enviar Comprobante por WhatsApp"
                        >
                          <MessageCircle size={15} /> WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE EDICIÓN DE ORDEN INTEGRAL (IDÉNTICO A VENDER / FIAR - FOTOS 2 Y 3) */}
      {modalEdicion.visible && modalEdicion.orden && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-0 md:p-4 z-[999] animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] rounded-none md:rounded-[2.5rem] w-full max-w-7xl shadow-2xl border border-slate-100 dark:border-slate-800 my-auto animate-in zoom-in-95 duration-200 h-[100vh] md:h-[92vh] flex flex-col overflow-hidden">
            
            {/* CABECERA SUPERIOR CON SELECTOR DE MODALIDAD VENTA / FIADO */}
            <div className={`p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm gap-2 transition-colors ${modalEdicion.tipo === 'fiado' ? 'bg-rose-600 dark:bg-rose-700' : 'bg-emerald-600 dark:bg-emerald-700'}`}>
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button 
                  type="button"
                  onClick={() => setModalEdicion({ ...modalEdicion, visible: false, orden: null })} 
                  className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm cursor-pointer active:scale-95 shrink-0"
                  title="Volver"
                >
                  <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                </button>
                
                {/* Selector de Modalidad Venta / Fiado */}
                <div className="flex items-center bg-black/20 p-1 rounded-2xl border border-white/20">
                  <button
                    type="button"
                    onClick={() => setModalEdicion({ ...modalEdicion, tipo: 'venta', metodoPago: modalEdicion.metodoPago === 'fiado' ? 'efectivo' : modalEdicion.metodoPago })}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${modalEdicion.tipo === 'venta' ? 'bg-white text-emerald-800 shadow-md scale-105' : 'text-white/80 hover:text-white'}`}
                  >
                    <ShoppingCart size={14} /> Venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalEdicion({ ...modalEdicion, tipo: 'fiado', metodoPago: 'fiado', pagoCliente: '0' })}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${modalEdicion.tipo === 'fiado' ? 'bg-white text-rose-800 shadow-md scale-105' : 'text-white/80 hover:text-white'}`}
                  >
                    <Receipt size={14} /> Fiado
                  </button>
                </div>
              </div>

              {/* Vendedor Responsable */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/20 text-white text-xs font-bold gap-1.5">
                  <User size={14} className="text-white/80" />
                  <span className="truncate max-w-[120px]">{modalEdicion.orden.nombreColaborador}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalEdicion({ ...modalEdicion, visible: false, orden: null })}
                  className="bg-white/20 hover:bg-white/30 p-1.5 rounded-xl text-white transition-colors cursor-pointer"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* BARRA DE PESTAÑA */}
            <div className={`px-4 py-2 border-b flex items-center gap-2 shrink-0 z-20 transition-colors ${modalEdicion.tipo === 'fiado' ? 'bg-rose-700/90 dark:bg-slate-900 border-rose-800/40 dark:border-slate-800' : 'bg-emerald-700/90 dark:bg-slate-900 border-emerald-800/40 dark:border-slate-800'}`}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-slate-900 shadow-md font-black text-xs">
                {modalEdicion.tipo === 'fiado' ? <Receipt size={13} className="text-rose-600" /> : <ShoppingCart size={13} className="text-emerald-600" />}
                <span>{modalEdicion.clienteNombre || `Orden #${modalEdicion.orden.id.substring(0, 5)}`}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black bg-slate-100 text-slate-800">
                  ${totalEdicion.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* CUERPO PRINCIPAL EN 2 COLUMNAS (FOTO 2 Y 3) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-50/50 dark:bg-[#020617]/50">
              
              {/* COLUMNA IZQUIERDA: ARTÍCULOS O CONCEPTOS */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
                
                <div className="flex justify-between items-center px-1">
                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider">
                    {modalEdicion.orden.tipo === 'fiado' ? 'ARTÍCULOS A FIAR' : 'ARTÍCULOS O CONCEPTOS'}
                  </h4>
                </div>

                {/* FILAS DE PRODUCTOS */}
                <div className="space-y-3">
                  {modalEdicion.items.map((item, idx) => {
                    const productosFiltrados = inventario.filter(p =>
                      p.nombre?.toLowerCase().includes((item.descripcion || "").toLowerCase()) ||
                      p.sku?.toLowerCase().includes((item.descripcion || "").toLowerCase())
                    );

                    return (
                      <div
                        key={idx}
                        className="bg-white dark:bg-[#0f172a] p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative flex flex-col sm:flex-row gap-3 items-stretch sm:items-center group"
                      >
                        <button
                          type="button"
                          onClick={() => eliminarFilaEdicion(idx)}
                          className="absolute -top-2 -right-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 rounded-full p-1.5 shadow-sm hover:scale-110 transition-transform z-10 cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 size={13} />
                        </button>

                        {/* DESCRIPCIÓN O SKU */}
                        <div className="flex-1 min-w-0 relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                            <Package size={11} /> DESCRIPCIÓN O SKU
                          </label>
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => {
                              actualizarItemEdicion(idx, 'descripcion', e.target.value);
                              setBusquedaProductoIndexEdicion(idx);
                            }}
                            onFocus={() => setBusquedaProductoIndexEdicion(idx)}
                            placeholder="Escribe nombre o SKU..."
                            className="w-full p-3 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs sm:text-sm outline-none text-slate-900 dark:text-white focus:border-emerald-500"
                          />

                          {/* Autocompletar de inventario interactivo */}
                          {busquedaProductoIndexEdicion === idx && (item.descripcion || '').trim().length > 0 && productosFiltrados.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-40 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-150">
                              {productosFiltrados.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    const nuevos = [...modalEdicion.items];
                                    nuevos[idx].descripcion = p.nombre;
                                    if (p.precioVenta) nuevos[idx].valor = String(p.precioVenta);
                                    setModalEdicion({ ...modalEdicion, items: nuevos });
                                    setBusquedaProductoIndexEdicion(null);
                                  }}
                                  className="p-2.5 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center text-xs"
                                >
                                  <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-200">{p.nombre}</p>
                                    <p className="text-[10px] text-slate-400">Stock: {p.tipoProducto === 'servicio' ? '∞' : (p.stock ?? 0)}</p>
                                  </div>
                                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs">
                                    ${(p.precioVenta || 0).toLocaleString('es-CO')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* CONTROLES DE CANTIDAD */}
                        <div className="w-full sm:w-28 shrink-0">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                            CANT.
                          </label>
                          <div className="flex items-center bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-[44px]">
                            <button
                              type="button"
                              onClick={() => actualizarItemEdicion(idx, 'cantidad', Math.max(1, item.cantidad - 1))}
                              className="px-3 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 font-black cursor-pointer"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="flex-1 text-center font-black text-sm text-slate-900 dark:text-white">
                              {item.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => actualizarItemEdicion(idx, 'cantidad', item.cantidad + 1)}
                              className="px-3 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 font-black cursor-pointer"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        {/* PRECIO UNITARIO */}
                        <div className="w-full sm:w-36 shrink-0">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                            PRECIO UNIT.
                          </label>
                          <div className="relative h-[44px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                            <input
                              type="text"
                              value={item.valor ? parseInt(item.valor.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : ''}
                              onChange={(e) => actualizarItemEdicion(idx, 'valor', e.target.value)}
                              placeholder="0"
                              className="w-full pl-7 pr-3 h-full bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-sm text-right text-slate-900 dark:text-white focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* BOTONES: AÑADIR ARTÍCULO Y APLICAR DESCUENTO */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={agregarFilaEdicion}
                    className={`font-bold py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 text-xs shadow-sm cursor-pointer active:scale-95 ${
                      modalEdicion.orden.tipo === 'fiado'
                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                    }`}
                  >
                    <Plus size={15} /> + Añadir artículo
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalEdicion({
                      ...modalEdicion,
                      descuentoTipo: modalEdicion.descuentoTipo ? null : 'porcentaje',
                      descuentoValor: ""
                    })}
                    className="font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 text-xs cursor-pointer active:scale-95"
                  >
                    <Tag size={14} className={modalEdicion.orden.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'} />
                    <span>{modalEdicion.descuentoTipo ? 'Quitar Descuento' : '+ Aplicar Descuento'}</span>
                  </button>
                </div>

                {/* SECCIÓN DESCUENTO COMERCIAL SI ESTÁ ACTIVADO (SIN PRESELECCIÓN FORZADA) */}
                {modalEdicion.descuentoTipo && (
                  <div className="bg-white dark:bg-[#0f172a] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-150 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${modalEdicion.orden?.tipo === 'fiado' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        <Tag size={12} /> Descuento:
                      </span>
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                        <button
                          type="button"
                          onClick={() => setModalEdicion({ ...modalEdicion, descuentoTipo: 'porcentaje', descuentoValor: '' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${modalEdicion.descuentoTipo === 'porcentaje' ? (modalEdicion.orden?.tipo === 'fiado' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white') : 'text-slate-500'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalEdicion({ ...modalEdicion, descuentoTipo: 'fijo', descuentoValor: '' })}
                          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${modalEdicion.descuentoTipo === 'fijo' ? (modalEdicion.orden?.tipo === 'fiado' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white') : 'text-slate-500'}`}
                        >
                          $
                        </button>
                      </div>

                      <input
                        type="text"
                        value={modalEdicion.descuentoValor ? (modalEdicion.descuentoTipo === 'fijo' ? parseInt(modalEdicion.descuentoValor.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : modalEdicion.descuentoValor) : ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          if (modalEdicion.descuentoTipo === 'porcentaje') {
                            setModalEdicion({ ...modalEdicion, descuentoValor: raw ? String(Math.min(100, Number(raw))) : '' });
                          } else {
                            setModalEdicion({ ...modalEdicion, descuentoValor: raw });
                          }
                        }}
                        placeholder={modalEdicion.descuentoTipo === 'porcentaje' ? "Ej: 10" : "$0"}
                        className="w-24 px-2 py-1 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-black text-xs text-center text-slate-900 dark:text-white"
                      />

                      {modalEdicion.descuentoTipo === 'porcentaje' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {[5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setModalEdicion({ ...modalEdicion, descuentoValor: String(pct) })}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${modalEdicion.descuentoValor === String(pct) ? (modalEdicion.orden?.tipo === 'fiado' ? 'bg-rose-600 text-white border-rose-600 font-black' : 'bg-emerald-600 text-white border-emerald-600 font-black') : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalEdicion({ ...modalEdicion, descuentoTipo: null, descuentoValor: "" })}
                      className="text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors whitespace-nowrap"
                    >
                      <X size={12} /> Quitar
                    </button>
                  </div>
                )}

              </div>

              {/* COLUMNA DERECHA: CLIENTE + FORMA DE PAGO + TOTAL (ESPEJO EXACTO FOTO 1 Y 2) */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3">
                
                {/* TARJETA CLIENTE (ESPEJO FOTO 1) */}
                <div className="bg-white dark:bg-[#0f172a] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <User size={11} /> {modalEdicion.orden.tipo === 'fiado' ? 'CLIENTE (OBLIGATORIO)' : 'CLIENTE (OPCIONAL)'}
                  </span>

                  {modalEdicion.clienteNombre && modalEdicion.clienteNombre !== "Mostrador" ? (
                    <div className="py-1.5 px-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex justify-between items-center animate-in fade-in duration-150">
                      <span className="font-black text-slate-900 dark:text-emerald-300 text-xs truncate mr-2">
                        {modalEdicion.clienteNombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalEdicion({
                          ...modalEdicion,
                          clienteId: null,
                          clienteNombre: "Mostrador",
                          clienteCelular: ""
                        })}
                        className="text-rose-500 shrink-0 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-1 rounded-full cursor-pointer transition-colors"
                        title="Quitar cliente"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={modalEdicion.busquedaCliente}
                        onFocus={() => setModalEdicion({ ...modalEdicion, mostrarBuscadorCliente: true })}
                        onChange={(e) => setModalEdicion({ ...modalEdicion, busquedaCliente: e.target.value, mostrarBuscadorCliente: true })}
                        placeholder="Buscar / Crear cliente..."
                        className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none text-slate-900 dark:text-white focus:border-emerald-500 placeholder:text-slate-400 placeholder:font-normal"
                      />

                      {/* Desplegable de búsqueda de clientes */}
                      {modalEdicion.mostrarBuscadorCliente && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-30 max-h-44 overflow-y-auto p-1 animate-in fade-in duration-150">
                          {modalEdicion.orden.tipo !== 'fiado' && (
                            <div
                              onClick={() => setModalEdicion({
                                ...modalEdicion,
                                clienteId: null,
                                clienteNombre: "Mostrador",
                                clienteCelular: "",
                                mostrarBuscadorCliente: false,
                                busquedaCliente: ""
                              })}
                              className="p-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center"
                            >
                              <span>Cliente Mostrador (Genérico)</span>
                            </div>
                          )}
                          {clientes
                            .filter(c => 
                              (c.nombre || '').toLowerCase().includes((modalEdicion.busquedaCliente || '').toLowerCase()) ||
                              (c.celular || '').toString().includes(modalEdicion.busquedaCliente || '')
                            )
                            .map(c => (
                              <div
                                key={c.id}
                                onClick={() => setModalEdicion({
                                  ...modalEdicion,
                                  clienteId: c.id,
                                  clienteNombre: c.nombre,
                                  clienteCelular: c.celular || "",
                                  mostrarBuscadorCliente: false,
                                  busquedaCliente: ""
                                })}
                                className="p-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center"
                              >
                                <span>{c.nombre}</span>
                                <span className="text-[10px] text-slate-400">{c.celular || ''}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* TARJETA FORMA DE PAGO (ESPEJO EXACTO VENDER / FIAR) */}
                {modalEdicion.tipo !== 'fiado' ? (
                  <div className="bg-white dark:bg-[#0f172a] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      FORMA DE PAGO
                    </span>

                    {/* 4 chips idénticos a vender/page.tsx */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'efectivo', label: 'Efectivo', icon: Banknote, activeClass: 'bg-emerald-600 text-white shadow-sm' },
                        { id: 'transferencia', label: 'Transf.', icon: Smartphone, activeClass: 'bg-blue-600 text-white shadow-sm' },
                        { id: 'datafono', label: 'Datáfono', icon: CreditCard, activeClass: 'bg-indigo-600 text-white shadow-sm' },
                        { id: 'credito_externo', label: 'Crédito', icon: Zap, activeClass: 'bg-purple-600 text-white shadow-sm' }
                      ].map((m) => {
                        const Icon = m.icon;
                        const activo = modalEdicion.metodoPago === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setModalEdicion({ 
                                ...modalEdicion, 
                                metodoPago: m.id, 
                                subMetodoPago: '',
                                pagoCliente: m.id !== 'efectivo' ? String(totalEdicion) : modalEdicion.pagoCliente
                              });
                            }}
                            className={`py-2 px-1 rounded-xl font-bold text-[11px] flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                              activo
                                ? m.activeClass
                                : 'bg-slate-50 dark:bg-[#020617] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <Icon size={14} />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* SUB-SELECTORES SI NO ES EFECTIVO */}
                    {modalEdicion.metodoPago === 'transferencia' && (
                      <div className="flex flex-wrap gap-1 pt-0.5 animate-in fade-in duration-150">
                        {['Nequi', 'Daviplata', 'Bancolombia', 'PSE', 'Otro'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setModalEdicion({ ...modalEdicion, subMetodoPago: modalEdicion.subMetodoPago === b ? '' : b })}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${modalEdicion.subMetodoPago === b ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}

                    {modalEdicion.metodoPago === 'credito_externo' && (
                      <div className="flex flex-wrap gap-1 pt-0.5 animate-in fade-in duration-150">
                        {['Addi', 'Sistecrédito', 'Krediya', 'Otro'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setModalEdicion({ ...modalEdicion, subMetodoPago: modalEdicion.subMetodoPago === b ? '' : b })}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${modalEdicion.subMetodoPago === b ? 'bg-purple-600 text-white border-purple-700' : 'bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* INPUT DINERO RECIBIDO + BOTÓN EXACTO (EN EFECTIVO O MÉTODOS PARCIALES) */}
                    <div className="flex gap-2 items-center pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">$</span>
                        <input
                          type="text"
                          value={modalEdicion.pagoCliente !== "" ? (parseInt(modalEdicion.pagoCliente.replace(/\D/g, '') || '0', 10) === 0 ? "0" : parseInt(modalEdicion.pagoCliente.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO')) : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setModalEdicion({ ...modalEdicion, pagoCliente: raw });
                          }}
                          placeholder="Dinero entregado"
                          className="w-full pl-7 pr-3 py-1.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs outline-none text-slate-900 dark:text-white focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalEdicion({ ...modalEdicion, pagoCliente: String(totalEdicion) })}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                      >
                        ✓ Exacto
                      </button>
                    </div>

                    {/* PLACEHOLDER DINÁMICO EXACTO SEGÚN EL MÉTODO SI NO ES EFECTIVO */}
                    {modalEdicion.metodoPago !== 'efectivo' && (
                      <input
                        type="text"
                        value={modalEdicion.referenciaPago}
                        onChange={(e) => setModalEdicion({ ...modalEdicion, referenciaPago: e.target.value })}
                        placeholder={
                          modalEdicion.metodoPago === 'transferencia'
                            ? `Ref. ${modalEdicion.subMetodoPago || 'comprobante'} (Opcional)`
                            : modalEdicion.metodoPago === 'datafono'
                            ? "No. Voucher (Opcional)"
                            : `Aprobación ${modalEdicion.subMetodoPago || 'crédito'} (Opcional)`
                        }
                        className="w-full p-2 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    )}
                  </div>
                ) : (
                  /* ALERTA DEUDA EN FIADO */
                  <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-3 rounded-2xl text-xs text-rose-700 dark:text-rose-400">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <AlertCircle size={14} /> Fiado Directo a Cuenta
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      El monto total de <strong>${totalEdicion.toLocaleString('es-CO')}</strong> será asignado como saldo pendiente a la cuenta de <strong>{modalEdicion.clienteNombre || 'Cliente'}</strong>.
                    </p>
                  </div>
                )}

                {/* BLOQUE DE DEVUELTA / SALDO EN EFECTIVO O PAGO PARCIAL */}
                {(() => {
                  const rawP = modalEdicion.pagoCliente.replace(/\D/g, '');
                  const numP = rawP === "" ? 0 : parseFloat(rawP);

                  if (modalEdicion.tipo !== 'fiado' && rawP !== "" && numP > totalEdicion && totalEdicion > 0) {
                    return (
                      <div className="px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-150">
                        <span className="text-[10px] uppercase font-bold tracking-wider">DEVUELTA:</span>
                        <span className="text-base font-black">${(numP - totalEdicion).toLocaleString('es-CO')}</span>
                      </div>
                    );
                  }

                  if (modalEdicion.tipo !== 'fiado' && rawP !== "" && numP < totalEdicion && totalEdicion > 0) {
                    return (
                      <div className="px-3 py-2 bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-150">
                        <span className="text-[10px] uppercase font-bold tracking-wider">SALDO A FIAR:</span>
                        <span className="text-base font-black">${(totalEdicion - numP).toLocaleString('es-CO')}</span>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* BLOQUE INFERIOR OSCURO (CON SUB-TOTAL SI HAY DESCUENTO + BOTONES INTELIGENTES) */}
                <div className="mt-auto bg-slate-950 text-white p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col gap-2.5">
                  {montoDescuentoEdicion > 0 && (
                    <div className="text-xs text-slate-400 space-y-1 pb-2 border-b border-slate-800">
                      <div className="flex justify-between font-semibold">
                        <span>Subtotal bruto:</span>
                        <span className="text-slate-200">${subtotalEdicion.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-400">
                        <span>Descuento aplicado:</span>
                        <span>-${montoDescuentoEdicion.toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {modalEdicion.tipo === 'fiado' ? 'MONTO A FIAR' : 'TOTAL A COBRAR'}
                    </span>
                    <span className="text-3xl sm:text-4xl font-black text-white">
                      ${totalEdicion.toLocaleString('es-CO')}
                    </span>
                  </div>

                  {(() => {
                    const rawP = modalEdicion.pagoCliente.replace(/\D/g, '');
                    const numP = rawP === "" ? 0 : parseFloat(rawP);
                    let textoAprobar = "Aprobar";
                    let bgAprobar = "bg-emerald-500 hover:bg-emerald-600";

                    if (modalEdicion.tipo === 'fiado' || (rawP !== "" && numP === 0 && totalEdicion > 0)) {
                      textoAprobar = "Fiar Total";
                      bgAprobar = "bg-rose-600 hover:bg-rose-700";
                    } else if (numP > 0 && numP < totalEdicion) {
                      textoAprobar = "Vender y Fiar";
                      bgAprobar = "bg-emerald-600 hover:bg-emerald-700";
                    } else {
                      textoAprobar = "Vender y Aprobar";
                      bgAprobar = "bg-emerald-500 hover:bg-emerald-600";
                    }

                    return (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => guardarCambiosEdicion(false)}
                          disabled={procesandoId !== null}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 px-3 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                        >
                          💾 Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => guardarCambiosEdicion(true)}
                          disabled={procesandoId !== null}
                          className={`w-full ${bgAprobar} text-white font-black py-3 px-3 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1`}
                        >
                          <CheckCircle2 size={15} /> {textoAprobar}
                        </button>
                      </div>
                    );
                  })()}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL DE MOTIVO DE RECHAZO */}
      {modalRechazo.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-500/20 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1">Rechazar Orden</h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Indica una razón opcional para que el colaborador sepa por qué fue rechazada.
            </p>

            <textarea
              value={modalRechazo.motivo}
              onChange={(e) => setModalRechazo({ ...modalRechazo, motivo: e.target.value })}
              placeholder="Ej: Stock equivocado, cliente no autorizó, monto incorrecto..."
              rows={3}
              className="w-full p-3 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500 text-slate-900 dark:text-white mb-4 resize-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setModalRechazo({ visible: false, orden: null, motivo: "" })}
                className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRechazo}
                className="py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition-colors"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ÉXITO INTEGRAL TRAS APROBACIÓN (WHATSAPP + IMPRIMIR TICKET) */}
      {modalExitoAprobacion.visible && modalExitoAprobacion.orden && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[1000] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 size={44} />
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
              ¡Orden Aprobada!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              La transacción ha sido registrada y el inventario actualizado.
            </p>

            <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-5 text-left space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold">Tipo:</span>
                <span className="font-black uppercase text-slate-700 dark:text-slate-200">{modalExitoAprobacion.orden.tipo}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold">Colaborador:</span>
                <span className="font-black text-slate-800 dark:text-white">{modalExitoAprobacion.orden.nombreColaborador}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-bold">Cliente:</span>
                <span className="font-black text-slate-800 dark:text-white">{modalExitoAprobacion.orden.clienteNombre}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase">Monto Total:</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  ${modalExitoAprobacion.orden.total.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Botón WhatsApp */}
              <button
                type="button"
                onClick={() => abrirWhatsAppComprobanteOrden(modalExitoAprobacion.orden!)}
                className="w-full py-3.5 px-4 bg-[#25D366] hover:bg-[#1ebd5a] active:scale-95 text-white font-black rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle size={20} />
                <span>Enviar Comprobante WhatsApp</span>
              </button>

              {/* Botón Imprimir Ticket */}
              {modalExitoAprobacion.ticketDatos && (
                <button
                  type="button"
                  onClick={() => setModalTicketFactura({ visible: true, datos: modalExitoAprobacion.ticketDatos })}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={18} />
                  <span>Imprimir Factura / Ticket</span>
                </button>
              )}

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={() => setModalExitoAprobacion({ visible: false, orden: null, ticketDatos: null })}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN TRAS GUARDAR CAMBIOS SIN APROBAR */}
      {modalConfirmacionGuardado.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[1000] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              ¡Cambios Guardados!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              La orden de <strong>{modalConfirmacionGuardado.colaborador}</strong> ha sido actualizada correctamente en la lista pendiente.
            </p>

            <div className="bg-slate-50 dark:bg-[#020617] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-5 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold">Nuevo Total:</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                ${modalConfirmacionGuardado.total.toLocaleString('es-CO')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setModalConfirmacionGuardado({ visible: false, ordenId: "", colaborador: "", total: 0 })}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black rounded-2xl text-sm shadow-md transition-all cursor-pointer"
            >
              Listo, Continuar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE TICKET TÉRMICO */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />

    </div>
  );
}
