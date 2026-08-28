"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot, addDoc, increment } from "firebase/firestore";
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
  ShoppingCart,
  Bookmark,
  Camera,
  RotateCcw,
  Upload
} from "lucide-react";

export default function OrdenesPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.tipoUsuario === 'principal' || datosSesion?.esAdmin === true;
  const puedeVentaDirecta = esAdmin || (datosSesion?.puedeVentaDirecta === true);
  const puedeModificarPrecios = esAdmin || (datosSesion?.permisos?.editarInventario === true);
  const puedeAplicarDescuentos = esAdmin;
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const nombreUsuario = datosSesion?.nombreUsuario || "Vendedor";

  // Estados de Órdenes
  const [ordenes, setOrdenes] = useState<OrdenPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [filtroTab, setFiltroTab] = useState<'todas' | 'pendientes' | 'aprobadas' | 'rechazadas'>('pendientes');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'venta' | 'fiado' | 'separe'>('todos');
  const [busqueda, setBusqueda] = useState("");

  // Clientes e Inventario para Edición
  const [clientes, setClientes] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);

  // Modal de Edición de Orden
  const [modalEdicion, setModalEdicion] = useState<{
    visible: boolean;
    orden: OrdenPendiente | null;
    tipo: 'venta' | 'fiado' | 'separe';
    clienteId: string | null;
    clienteNombre: string;
    clienteCelular: string;
    items: {
      descripcion: string;
      valor: string;
      cantidad: number;
      fotoUrl?: string | null;
      esDeInventario?: boolean;
    }[];
    descuentoTipo: 'porcentaje' | 'fijo' | null;
    descuentoValor: string;
    mostrarModalDescuento: boolean;
    pagoCliente: string;
    metodoPago: string;
    subMetodoPago: string;
    referenciaPago: string;
    fechaLimite: string;
    notas: string;
    busquedaCliente: string;
    mostrarBuscadorCliente: boolean;
  }>({
    visible: false,
    orden: null,
    tipo: 'venta',
    clienteId: null,
    clienteNombre: "Mostrador",
    clienteCelular: "",
    items: [],
    descuentoTipo: null,
    descuentoValor: "",
    mostrarModalDescuento: false,
    pagoCliente: "",
    metodoPago: "efectivo",
    subMetodoPago: "",
    referenciaPago: "",
    fechaLimite: "",
    notas: "",
    busquedaCliente: "",
    mostrarBuscadorCliente: false
  });
  const [busquedaProductoIndexEdicion, setBusquedaProductoIndexEdicion] = useState<number | null>(null);
  const fileInputEdicionRef = useRef<HTMLInputElement | null>(null);
  const inputsDescripcionEdicionRef = useRef<(HTMLInputElement | null)[]>([]);
  const [itemIdxParaFotoEdicion, setItemIdxParaFotoEdicion] = useState<number | null>(null);
  const [fotoLightboxEdicion, setFotoLightboxEdicion] = useState<string | null>(null);

  // Modal de Cámara en Vivo para Edición de Órdenes
  const [modalCamaraEdicion, setModalCamaraEdicion] = useState(false);
  const [mediaStreamEdicion, setMediaStreamEdicion] = useState<MediaStream | null>(null);
  const [facingModeEdicion, setFacingModeEdicion] = useState<'environment' | 'user'>('environment');
  const [iniciandoCamaraEdicion, setIniciandoCamaraEdicion] = useState(false);
  const videoEdicionRef = useRef<HTMLVideoElement | null>(null);

  // Modal de Rechazozo
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
    cambios: string[];
  }>({
    visible: false,
    ordenId: "",
    colaborador: "",
    total: 0,
    cambios: []
  });

  // Sonido de éxito con Web Audio API
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
    const esSepare = orden.tipo === 'separe';
    const encabezadoTitulo = esSepare ? 'COMPROBANTE DE PLAN SEPARE' : (esFiado ? 'COMPROBANTE DE FIADO' : 'COMPROBANTE DE COMPRA');

    let detalleTexto = '';
    orden.items.forEach(f => {
      const unitario = parseFloat(f.valor) || 0;
      const subtotalFila = unitario * f.cantidad;
      const desc = f.descripcion?.trim() || 'Artículo';
      detalleTexto += `• ${f.cantidad}x ${desc}\n  Precio unitario: *$${unitario.toLocaleString('es-CO')}*\n  Subtotal: *$${subtotalFila.toLocaleString('es-CO')}*\n\n`;
    });

    let texto = "";
    if (esSepare) {
      const pagoNum = typeof orden.pagoCliente === 'number' ? orden.pagoCliente : (parseFloat(String(orden.pagoCliente || '0').replace(/\D/g, '')) || 0);
      const saldoPend = Math.max(0, orden.total - pagoNum);

      texto = `¡Hola, *${nombreDestino}*! Gracias por separar con nosotros en *${nombreNegocio}*.

===================
*COMPROBANTE DE PLAN SEPARE*
===================

${detalleTexto}`;

      if (orden.montoDescuento && orden.montoDescuento > 0) {
        const dtoDesc = orden.descuentoTipo === 'porcentaje' ? `${orden.descuentoValor}%` : `$${Number(orden.descuentoValor).toLocaleString('es-CO')}`;
        texto += `*Subtotal:* $${(orden.totalBruto || orden.total).toLocaleString('es-CO')}\n*Descuento (${dtoDesc}):* -$${orden.montoDescuento.toLocaleString('es-CO')}\n`;
      }

      texto += `*TOTAL SEPARE:* *$${orden.total.toLocaleString('es-CO')}*
*ABONO INICIAL RECIBIDO:* *$${pagoNum.toLocaleString('es-CO')}*
*SALDO PENDIENTE:* *$${saldoPend.toLocaleString('es-CO')}*`;

      if ((orden as any).payloadSepare?.fechaLimite || (orden as any).fechaLimite) {
        const fl = (orden as any).payloadSepare?.fechaLimite || (orden as any).fechaLimite;
        const d = fl.toDate ? fl.toDate() : new Date(fl);
        if (!isNaN(d.getTime())) {
          texto += `\n*Fecha límite de pago:* ${d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        }
      }

      if ((orden as any).notas || (orden as any).payloadSepare?.notas) {
        texto += `\n*Nota:* ${(orden as any).notas || (orden as any).payloadSepare?.notas}`;
      }

      texto += `\n*Atendido por:* ${orden.nombreColaborador}

Gracias por tu preferencia y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;

    } else {
      if (orden.montoDescuento && orden.montoDescuento > 0) {
        detalleTexto += `*Subtotal:* $${(orden.totalBruto || orden.total).toLocaleString('es-CO')}\n*Descuento:* -$${orden.montoDescuento.toLocaleString('es-CO')}\n`;
      }

      texto = `¡Hola, *${nombreDestino}*! Gracias por tu confianza en *${nombreNegocio}*.

===================
*${encabezadoTitulo}*
===================

${detalleTexto}*TOTAL: $${orden.total.toLocaleString('es-CO')}*
*Atendido por:* ${orden.nombreColaborador}

¡Muchas gracias por tu compra! Estamos atentos para cualquier consulta.

*¡Te esperamos pronto!*`;
    }

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

    const pagoNum = typeof orden.pagoCliente === 'number' ? orden.pagoCliente : (parseFloat(String(orden.pagoCliente || '0').replace(/\D/g, '')) || 0);
    const saldoPend = Math.max(0, orden.total - pagoNum);

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
        tipo: (orden.tipo as any),
        detalles: detallesParaComprobante,
        descripcionGeneral: orden.tipo === 'separe' ? `Plan Separe: ${descripcionUnificada}` : descripcionUnificada,
        montoTotal: orden.total,
        pagoRecibido: orden.tipo === 'separe' ? pagoNum : (orden.tipo === 'fiado' ? 0 : pagoNum),
        saldoNuevo: orden.tipo === 'separe' ? saldoPend : undefined,
        idTransaccion: orden.idTransaccion || orden.id,
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

    // Validar stock consolidado de productos inventariables
    for (const item of filasValidas) {
      const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
      const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
      if (esInv) {
        const totalRequerido = filasValidas
          .filter(it => it.descripcion.toLowerCase() === item.descripcion.toLowerCase())
          .reduce((sum, it) => sum + it.cantidad, 0);

        if (totalRequerido > (pInv.stock || 0)) {
          toast.error(`¡Stock insuficiente! Para "${pInv.nombre}" solicitas ${totalRequerido} pero solo quedan ${pInv.stock || 0} disponibles.`);
          return;
        }
      }
    }

    const pagoRaw = (modalEdicion.pagoCliente || '').replace(/\D/g, '');
    const pagoNum = pagoRaw === '' ? (modalEdicion.tipo === 'fiado' ? 0 : totalEdicion) : parseFloat(pagoRaw);

    // Validar cliente obligatorio según modalidad
    if (modalEdicion.tipo === 'separe' && (!modalEdicion.clienteNombre || modalEdicion.clienteNombre === 'Mostrador' || modalEdicion.clienteNombre.trim() === '')) {
      return toast.error("Para el Plan Separe es obligatorio seleccionar o ingresar un cliente.");
    }
    if (modalEdicion.tipo !== 'separe' && (modalEdicion.tipo === 'fiado' || pagoNum < totalEdicion) && (!modalEdicion.clienteNombre || modalEdicion.clienteNombre === 'Mostrador')) {
      return toast.error("Para fiar o registrar pago parcial se requiere seleccionar un cliente registrado.");
    }

    setProcesandoId(modalEdicion.orden.id);

    try {
      const ordenActualizada: Record<string, any> = {
        tipo: modalEdicion.tipo,
        items: filasValidas.map((it: any) => ({
          descripcion: it.descripcion,
          valor: String(it.valor),
          cantidad: it.cantidad || 1,
          fotoUrl: it.fotoUrl || null
        })),
        totalBruto: subtotalEdicion,
        montoDescuento: montoDescuentoEdicion,
        total: totalEdicion,
        pagoCliente: pagoNum,
        metodoPago: modalEdicion.tipo === 'fiado' ? 'fiado' : (modalEdicion.metodoPago || 'efectivo'),
        clienteId: modalEdicion.clienteId || null,
        clienteNombre: modalEdicion.clienteNombre || (modalEdicion.tipo === 'separe' ? 'Cliente' : 'Mostrador'),
        clienteCelular: modalEdicion.clienteCelular || '',
        descuentoTipo: modalEdicion.descuentoTipo || null,
        descuentoValor: modalEdicion.descuentoTipo && modalEdicion.descuentoValor ? Number(modalEdicion.descuentoValor.replace(/\D/g, '')) : null,
        subMetodoPago: modalEdicion.metodoPago === 'efectivo' ? null : (modalEdicion.subMetodoPago || null),
        referenciaPago: modalEdicion.metodoPago === 'efectivo' ? null : (modalEdicion.referenciaPago || null),
        fechaModificado: new Date()
      };

      if (modalEdicion.tipo === 'separe') {
        const abonoObj: any = {
          id: `abono_${Date.now()}`,
          monto: pagoNum || 0,
          metodoPago: modalEdicion.metodoPago || 'efectivo',
          subMetodoPago: modalEdicion.metodoPago !== 'efectivo' ? (modalEdicion.subMetodoPago || null) : null,
          referenciaPago: modalEdicion.metodoPago !== 'efectivo' ? (modalEdicion.referenciaPago || null) : null,
          fecha: new Date(),
          registradoPor: modalEdicion.orden.nombreColaborador || 'Vendedor'
        };

        ordenActualizada.payloadSepare = {
          ...(modalEdicion.orden.payloadSepare || {}),
          usuarioId: cuentaPrincipalId,
          creadoPor: modalEdicion.orden.nombreColaborador || 'Vendedor',
          vendedor: modalEdicion.orden.nombreColaborador || 'Vendedor',
          estado: 'activo',
          clienteId: modalEdicion.clienteId || null,
          clienteNombre: modalEdicion.clienteNombre || 'Cliente',
          clienteCelular: modalEdicion.clienteCelular || '',
          items: filasValidas.map((it: any) => ({
            descripcion: it.descripcion,
            valor: parseFloat(String(it.valor).replace(/\D/g, '')) || 0,
            cantidad: it.cantidad || 1,
            fotoUrl: it.fotoUrl || null
          })),
          totalBruto: subtotalEdicion,
          descuentoTipo: modalEdicion.descuentoTipo || null,
          descuentoValor: modalEdicion.descuentoTipo && modalEdicion.descuentoValor ? Number(modalEdicion.descuentoValor.replace(/\D/g, '')) : null,
          montoDescuento: montoDescuentoEdicion,
          total: totalEdicion,
          montoPagado: pagoNum || 0,
          saldoPendiente: Math.max(0, totalEdicion - (pagoNum || 0)),
          metodoPago: modalEdicion.metodoPago || 'efectivo',
          subMetodoPago: modalEdicion.metodoPago !== 'efectivo' ? (modalEdicion.subMetodoPago || null) : null,
          referenciaPago: modalEdicion.metodoPago !== 'efectivo' ? (modalEdicion.referenciaPago || null) : null,
          abonos: (pagoNum && pagoNum > 0) ? [abonoObj] : [],
          fotos: filasValidas.map((it: any) => it.fotoUrl).filter(Boolean),
          fechaCreacion: modalEdicion.orden.fecha || new Date(),
          fechaLimite: modalEdicion.fechaLimite ? new Date(modalEdicion.fechaLimite + "T23:59:59") : null,
          notas: modalEdicion.notas || ""
        };
        ordenActualizada.fechaLimite = modalEdicion.fechaLimite ? new Date(modalEdicion.fechaLimite + "T23:59:59") : null;
        ordenActualizada.notas = modalEdicion.notas || "";
      }

      await updateDoc(doc(db, "ordenes_pendientes", modalEdicion.orden.id), ordenActualizada);

      const ordenCompletaParaAprobar: OrdenPendiente = {
        ...modalEdicion.orden,
        ...ordenActualizada
      } as OrdenPendiente;

      const ordenPrevia = modalEdicion.orden;
      setModalEdicion({ ...modalEdicion, visible: false, orden: null });

      // Comparar y listar cambios detallados realizados por el Administrador
      const listaCambios: string[] = [];
      
      if (ordenPrevia.tipo !== modalEdicion.tipo) {
        listaCambios.push(`Modalidad cambiada de ${ordenPrevia.tipo === 'fiado' ? 'Fiado' : (ordenPrevia.tipo === 'separe' ? 'Plan Separe' : 'Venta')} a ${modalEdicion.tipo === 'fiado' ? 'Fiado' : (modalEdicion.tipo === 'separe' ? 'Plan Separe' : 'Venta')}`);
      }

      if (ordenPrevia.total !== totalEdicion) {
        listaCambios.push(`Total ajustado de $${ordenPrevia.total.toLocaleString('es-CO')} a $${totalEdicion.toLocaleString('es-CO')}`);
      }

      const itemsPreviosStr = JSON.stringify(ordenPrevia.items.map(i => ({ d: i.descripcion, v: i.valor, c: i.cantidad })));
      const itemsNuevosStr = JSON.stringify(filasValidas.map(i => ({ d: i.descripcion, v: i.valor, c: i.cantidad })));
      if (itemsPreviosStr !== itemsNuevosStr) {
        listaCambios.push(`Artículos modificados (${filasValidas.length} producto(s) en total)`);
      }

      if (ordenPrevia.montoDescuento !== montoDescuentoEdicion) {
        if (montoDescuentoEdicion > 0) {
          const dtoTexto = modalEdicion.descuentoTipo === 'porcentaje' ? `${modalEdicion.descuentoValor}%` : `$${Number(modalEdicion.descuentoValor).toLocaleString('es-CO')}`;
          listaCambios.push(`Descuento comercial aplicado: ${dtoTexto} (-$${montoDescuentoEdicion.toLocaleString('es-CO')})`);
        } else if (ordenPrevia.montoDescuento > 0 && montoDescuentoEdicion === 0) {
          listaCambios.push("Descuento comercial retirado");
        }
      }

      if (ordenPrevia.clienteNombre !== modalEdicion.clienteNombre) {
        listaCambios.push(`Cliente asignado: ${modalEdicion.clienteNombre}`);
      }

      if (modalEdicion.tipo !== 'fiado') {
        if (ordenPrevia.metodoPago !== modalEdicion.metodoPago || ordenPrevia.subMetodoPago !== modalEdicion.subMetodoPago) {
          const sub = modalEdicion.subMetodoPago ? ` (${modalEdicion.subMetodoPago})` : '';
          listaCambios.push(`Método de pago: ${modalEdicion.metodoPago}${sub}`);
        }
        if (ordenPrevia.pagoCliente !== pagoNum) {
          listaCambios.push(`Dinero recibido: $${pagoNum.toLocaleString('es-CO')}`);
        }
      }

      if (yAprobar) {
        await aprobarOrden(ordenCompletaParaAprobar);
      } else {
        setModalConfirmacionGuardado({
          visible: true,
          ordenId: ordenPrevia.id,
          colaborador: ordenPrevia.nombreColaborador || 'Colaborador',
          total: totalEdicion,
          cambios: listaCambios.length > 0 ? listaCambios : ["Sin modificaciones detectadas"]
        });
      }
    } catch (e) {
      console.error("Error al guardar cambios de la orden:", e);
      toast.error("No se pudieron guardar las modificaciones.");
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

  // Ordenamiento inteligente de sugerencias de inventario (Prioridad: Inicia con > Palabra inicia con > Contiene)
  const ordenarProductosSugeridos = (lista: any[], queryText: string) => {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];
    return lista.filter(p => {
      const n = (p.nombre || "").toLowerCase();
      const s = (p.sku || "").toLowerCase();
      const c = (p.codigo || "").toLowerCase();
      return n.includes(q) || s.includes(q) || c.includes(q);
    }).sort((a, b) => {
      const aName = (a.nombre || "").toLowerCase();
      const bName = (b.nombre || "").toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      const aWordStarts = aName.split(/\s+/).some((w: string) => w.startsWith(q));
      const bWordStarts = bName.split(/\s+/).some((w: string) => w.startsWith(q));
      if (aWordStarts && !bWordStarts) return -1;
      if (!aWordStarts && bWordStarts) return 1;
      return aName.localeCompare(bName);
    }).slice(0, 8);
  };

  // Abrir Modal de Edición (Administrador o Colaborador para su propia orden pendiente)
  const abrirModalEdicion = (orden: OrdenPendiente) => {
    if (!esAdmin && orden.estado !== 'pendiente') {
      toast.error("Solo puedes modificar tus órdenes mientras estén pendientes.");
      return;
    }
    const esFiado = orden.tipo === 'fiado';
    const esSepare = orden.tipo === 'separe';

    let fechaLimStr = "";
    if (orden.payloadSepare?.fechaLimite) {
      const d = orden.payloadSepare.fechaLimite.toDate ? orden.payloadSepare.fechaLimite.toDate() : new Date(orden.payloadSepare.fechaLimite);
      if (!isNaN(d.getTime())) {
        fechaLimStr = d.toISOString().split('T')[0];
      }
    } else if (orden.fechaLimite) {
      const d = orden.fechaLimite.toDate ? orden.fechaLimite.toDate() : new Date(orden.fechaLimite);
      if (!isNaN(d.getTime())) {
        fechaLimStr = d.toISOString().split('T')[0];
      }
    }

    setModalEdicion({
      visible: true,
      orden: orden,
      tipo: orden.tipo || 'venta',
      items: orden.items.map(i => ({ ...i, fotoUrl: (i as any).fotoUrl || null })),
      clienteId: orden.clienteId,
      clienteNombre: orden.clienteNombre,
      clienteCelular: orden.clienteCelular || "",
      descuentoTipo: orden.descuentoTipo || null,
      descuentoValor: orden.descuentoValor ? String(orden.descuentoValor) : "",
      mostrarModalDescuento: false,
      pagoCliente: orden.pagoCliente !== undefined ? String(orden.pagoCliente) : (esFiado ? '0' : String(orden.total)),
      metodoPago: orden.metodoPago || (esFiado ? 'fiado' : 'efectivo'),
      subMetodoPago: orden.subMetodoPago || "",
      referenciaPago: orden.referenciaPago || "",
      fechaLimite: fechaLimStr,
      notas: orden.payloadSepare?.notas || orden.notas || "",
      busquedaCliente: "",
      mostrarBuscadorCliente: false
    });
  };

  const actualizarItemEdicion = (idx: number, campo: 'descripcion' | 'valor' | 'cantidad' | 'fotoUrl', valor: any) => {
    const nuevosItems = [...modalEdicion.items];
    if (campo === 'valor') {
      nuevosItems[idx].valor = String(valor).replace(/\D/g, '');
    } else if (campo === 'cantidad') {
      const nuevaCant = Math.max(1, parseInt(valor) || 1);
      const itemActual = nuevosItems[idx];
      if (itemActual && itemActual.descripcion.trim()) {
        const pInv = inventario.find(p => p.nombre.toLowerCase() === itemActual.descripcion.toLowerCase());
        const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
        if (esInv) {
          const cantidadEnOtras = nuevosItems.reduce((acc, it, i) => i !== idx && it.descripcion.toLowerCase() === itemActual.descripcion.toLowerCase() ? acc + it.cantidad : acc, 0);
          const stockPermitido = (pInv.stock || 0) - cantidadEnOtras;
          if (nuevaCant > stockPermitido) {
            toast.error(`¡Límite alcanzado! Solo quedan ${stockPermitido} unidades de "${pInv.nombre}".`);
            return;
          }
        }
      }
      nuevosItems[idx].cantidad = nuevaCant;
    } else if (campo === 'fotoUrl') {
      nuevosItems[idx].fotoUrl = valor;
    } else {
      nuevosItems[idx].descripcion = valor;
    }
    setModalEdicion({ ...modalEdicion, items: nuevosItems });
  };

  const agregarFilaEdicion = () => {
    setModalEdicion(prev => {
      const nuevoIdx = prev.items.length;
      const nuevaLista = [...prev.items, { descripcion: "", valor: "", cantidad: 1, fotoUrl: null }];
      setBusquedaProductoIndexEdicion(nuevoIdx);
      setTimeout(() => {
        inputsDescripcionEdicionRef.current[nuevoIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        inputsDescripcionEdicionRef.current[nuevoIdx]?.focus();
      }, 80);
      return {
        ...prev,
        items: nuevaLista
      };
    });
  };

  const eliminarFilaEdicion = (idx: number) => {
    if (modalEdicion.items.length <= 1) {
      setModalEdicion({
        ...modalEdicion,
        items: [{ descripcion: "", valor: "", cantidad: 1, fotoUrl: null }]
      });
      return;
    }
    setModalEdicion({
      ...modalEdicion,
      items: modalEdicion.items.filter((_, i) => i !== idx)
    });
  };

  // -------------------------------------------------------------
  // CÁMARA EN VIVO PARA EDICIÓN DE ÓRDENES
  // -------------------------------------------------------------
  const abrirCamaraEdicion = async (index: number) => {
    setItemIdxParaFotoEdicion(index);
    setIniciandoCamaraEdicion(true);
    setModalCamaraEdicion(true);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingModeEdicion }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        setMediaStreamEdicion(stream);
      } catch (err) {
        console.warn("No se pudo iniciar cámara en vivo directa, permitiendo archivo/captura:", err);
      } finally {
        setIniciandoCamaraEdicion(false);
      }
    } else {
      setIniciandoCamaraEdicion(false);
    }
  };

  useEffect(() => {
    if (videoEdicionRef.current && mediaStreamEdicion) {
      videoEdicionRef.current.srcObject = mediaStreamEdicion;
      videoEdicionRef.current.play().catch(e => console.log("Play video error:", e));
    }
  }, [mediaStreamEdicion, modalCamaraEdicion]);

  const cerrarCamaraEdicion = () => {
    if (mediaStreamEdicion) {
      mediaStreamEdicion.getTracks().forEach(t => t.stop());
      setMediaStreamEdicion(null);
    }
    setModalCamaraEdicion(false);
  };

  useEffect(() => {
    return () => {
      if (mediaStreamEdicion) {
        mediaStreamEdicion.getTracks().forEach(t => t.stop());
      }
    };
  }, [mediaStreamEdicion]);

  const alternarCamaraEdicion = async () => {
    if (mediaStreamEdicion) {
      mediaStreamEdicion.getTracks().forEach(t => t.stop());
    }
    const nuevoModo = facingModeEdicion === 'environment' ? 'user' : 'environment';
    setFacingModeEdicion(nuevoModo);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nuevoModo }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setMediaStreamEdicion(stream);
    } catch (e) {
      console.error("Error al alternar cámara:", e);
    }
  };

  const reproducirSonidoCamaraEdicion = () => {
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

      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(950, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.05);
          gain2.gain.setValueAtTime(0.6, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.05);
        } catch (e) {}
      }, 30);

      setTimeout(() => {
        try {
          const osc3 = ctx.createOscillator();
          const gain3 = ctx.createGain();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(1760, ctx.currentTime);
          osc3.frequency.exponentialRampToValueAtTime(2093, ctx.currentTime + 0.06);
          gain3.gain.setValueAtTime(0.35, ctx.currentTime);
          gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
          osc3.connect(gain3);
          gain3.connect(ctx.destination);
          osc3.start(ctx.currentTime);
          osc3.stop(ctx.currentTime + 0.06);
        } catch (e) {}
      }, 65);
    } catch (e) {}
  };

  const capturarFotoCamaraEdicion = () => {
    if (!videoEdicionRef.current || itemIdxParaFotoEdicion === null) return;
    const video = videoEdicionRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    reproducirSonidoCamaraEdicion();
    actualizarItemEdicion(itemIdxParaFotoEdicion, 'fotoUrl', dataUrl);
    cerrarCamaraEdicion();
    toast.success("Foto capturada", { icon: "📸" });
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

  // Listener en tiempo real de órdenes con ordenamiento FIFO inteligente
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
      
      // Ordenamiento FIFO inteligente:
      // - Las órdenes PENDIENTES se ordenan en orden de llegada (la más antigua primero: timeA - timeB) para atender por turno exacto.
      // - Las órdenes PROCESADAS se ordenan LIFO (la más reciente arriba: timeB - timeA).
      lista.sort((a, b) => {
        if (a.estado === 'pendiente' && b.estado === 'pendiente') {
          const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime();
          const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime();
          return timeA - timeB; // FIFO
        }
        if (a.estado === 'pendiente') return -1;
        if (b.estado === 'pendiente') return 1;

        const timeA = a.fechaProcesado?.toMillis ? a.fechaProcesado.toMillis() : (a.fecha?.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime());
        const timeB = b.fechaProcesado?.toMillis ? b.fechaProcesado.toMillis() : (b.fecha?.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime());
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
    // 1. Filtro por Tab de Estado
    if (filtroTab === 'pendientes' && ord.estado !== 'pendiente') return false;
    if (filtroTab === 'aprobadas' && ord.estado !== 'aprobado') return false;
    if (filtroTab === 'rechazadas' && ord.estado !== 'rechazado') return false;

    // 2. Filtro por Tipo (Venta / Fiado / Separe)
    if (filtroTipo !== 'todos' && ord.tipo !== filtroTipo) return false;

    // 3. Búsqueda por cliente, colaborador o artículo
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const matchCliente = (ord.clienteNombre || '').toLowerCase().includes(q);
      const matchColaborador = (ord.nombreColaborador || '').toLowerCase().includes(q);
      const matchItem = ord.items.some(it => (it.descripcion || '').toLowerCase().includes(q));
      if (!matchCliente && !matchColaborador && !matchItem) return false;
    }

    return true;
  });

  const pendientesCount = ordenes.filter(o => o.estado === 'pendiente').length;

  // Aprobar y convertir en transacción real
  const aprobarOrden = async (orden: OrdenPendiente) => {
    if (!cuentaPrincipalId) return;

    if (!esAdmin && datosSesion?.puedeVentaDirecta !== true) {
      toast.error("Solo el administrador o usuarios autorizados pueden aprobar órdenes.");
      return;
    }

    setProcesandoId(orden.id);

    try {
      // 1. Validar stock consolidado de productos inventariables
      for (const item of orden.items) {
        const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
        const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
        if (esInv) {
          const totalRequerido = orden.items
            .filter(it => it.descripcion.toLowerCase() === item.descripcion.toLowerCase())
            .reduce((sum, it) => sum + it.cantidad, 0);

          if (totalRequerido > (pInv.stock || 0)) {
            toast.error(`¡Sin stock suficiente de "${pInv.nombre}"! Solicitado: ${totalRequerido}, Quedan: ${pInv.stock || 0}`);
            setProcesandoId(null);
            return;
          }
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

      if ((orden as any).tipo === 'separe') {
        const payloadExistente = (orden as any).payloadSepare || {};
        const payloadSepare: any = {
          usuarioId: cuentaPrincipalId,
          creadoPor: orden.nombreColaborador || "Colaborador",
          vendedor: (orden as any).vendedor || orden.nombreColaborador || "Vendedor",
          estado: 'activo',
          clienteId: orden.clienteId || null,
          clienteNombre: orden.clienteNombre || 'Cliente',
          clienteCelular: orden.clienteCelular || "",
          items: (orden.items || []).map(it => ({
            descripcion: it.descripcion || "Artículo",
            valor: typeof it.valor === 'number' ? it.valor : (parseFloat(String(it.valor).replace(/\D/g, '')) || 0),
            cantidad: it.cantidad || 1,
            fotoUrl: (it as any).fotoUrl || null
          })),
          totalBruto: orden.totalBruto || orden.total,
          descuentoTipo: orden.descuentoTipo || null,
          descuentoValor: orden.descuentoValor ?? null,
          montoDescuento: orden.montoDescuento || 0,
          total: orden.total,
          montoPagado: pagoNum || 0,
          saldoPendiente: Math.max(0, orden.total - (pagoNum || 0)),
          metodoPago: orden.metodoPago || 'efectivo',
          subMetodoPago: (orden.metodoPago !== 'efectivo' && orden.subMetodoPago) ? orden.subMetodoPago : null,
          referenciaPago: (orden.metodoPago !== 'efectivo' && orden.referenciaPago) ? orden.referenciaPago : null,
          abonos: (pagoNum && pagoNum > 0) ? [{
            id: `abono_${Date.now()}`,
            monto: pagoNum,
            metodoPago: orden.metodoPago || 'efectivo',
            subMetodoPago: (orden.metodoPago !== 'efectivo' && orden.subMetodoPago) ? orden.subMetodoPago : null,
            referenciaPago: (orden.metodoPago !== 'efectivo' && orden.referenciaPago) ? orden.referenciaPago : null,
            fecha: new Date(),
            registradoPor: orden.nombreColaborador || "Colaborador"
          }] : [],
          fotos: (orden.items || []).map(it => (it as any).fotoUrl).filter(Boolean),
          fechaCreacion: orden.fecha || new Date(),
          fechaLimite: orden.fechaLimite || payloadExistente.fechaLimite || null,
          notas: orden.notas || payloadExistente.notas || ""
        };

        const docSepare = await addDoc(collection(db, "separes"), payloadSepare);
        idTransaccionGenerada = docSepare.id;

        // Registrar movimiento de abono inicial en la colección de movimientos si hubo pago
        if (pagoNum && pagoNum > 0) {
          const payloadMovAbono: any = {
            clienteId: orden.clienteId || null,
            clienteNombre: orden.clienteNombre || 'Cliente',
            usuarioId: cuentaPrincipalId,
            tipo: 'abono',
            subtipo: 'abono_inicial_separe',
            monto: pagoNum,
            descripcion: `Abono inicial Plan Separe (${(orden.metodoPago || 'efectivo').toUpperCase()}) - ${orden.clienteNombre || 'Cliente'}`,
            fecha: new Date(),
            registradoPor: orden.nombreColaborador || nombreUsuario || "Colaborador",
            metodoPago: orden.metodoPago || 'efectivo',
            idSepareOrigen: docSepare.id,
            idOrdenOrigen: orden.id
          };
          if (orden.subMetodoPago) payloadMovAbono.subMetodoPago = orden.subMetodoPago;
          if (orden.referenciaPago) payloadMovAbono.referenciaPago = orden.referenciaPago;
          await addDoc(collection(db, "movimientos"), payloadMovAbono);
        }

      } else if (orden.tipo === 'fiado' || pagoNum === 0) {
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
          referenciaPago: orden.metodoPago === 'efectivo' ? undefined : ([orden.subMetodoPago, orden.referenciaPago].filter(Boolean).join(' — ') || undefined),
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
          referenciaPago: orden.metodoPago === 'efectivo' ? undefined : ([orden.subMetodoPago, orden.referenciaPago].filter(Boolean).join(' — ') || undefined),
          subtotal: subtotalCalculado,
          valorIva: ivaCalculado,
          porcentajeIva: tasaIvaPorcentaje,
          descuentoTipo: orden.descuentoTipo,
          descuentoValor: orden.descuentoValor ?? undefined,
          montoDescuento: orden.montoDescuento > 0 ? orden.montoDescuento : undefined
        });
        idTransaccionGenerada = resVenta.movimientoId;
      }

      // 3. Descontar stock consolidado de inventario físico
      const cantidadesPorProducto: Record<string, number> = {};
      for (const item of orden.items) {
        const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
        const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
        if (esInv && pInv.id) {
          cantidadesPorProducto[pInv.id] = (cantidadesPorProducto[pInv.id] || 0) + item.cantidad;
        }
      }

      for (const [pId, cant] of Object.entries(cantidadesPorProducto)) {
        await updateDoc(doc(db, "inventario", pId), {
          stock: increment(-cant)
        });
      }

      // 4. Actualizar estado de la orden a 'aprobado'
      await updateDoc(doc(db, "ordenes_pendientes", orden.id), {
        estado: 'aprobado',
        fechaProcesado: new Date(),
        aprobadoPor: nombreUsuario,
        idTransaccion: idTransaccionGenerada
      });

      toast.success(`¡Orden de ${orden.nombreColaborador} aprobada y registrada!`, { icon: '✅' });

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

      reproducirSonidoExito();
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

  // Rechazar orden (Solo Administrador)
  const confirmarRechazo = async () => {
    if (!modalRechazo.orden) return;
    if (!esAdmin) {
      toast.error("Solo el administrador puede rechazar órdenes");
      return;
    }
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
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button 
            onClick={() => router.push('/dashboard/inicio')} 
            className="p-2 sm:p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors active:scale-95 shrink-0"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
                <Receipt className="text-amber-500 shrink-0" size={20} /> <span className="truncate">Órdenes Pendientes</span>
              </h2>
              {pendientesCount > 0 && (
                <span className="bg-rose-500 text-white text-[11px] sm:text-xs font-black px-2.5 py-0.5 rounded-full animate-pulse shrink-0 whitespace-nowrap inline-flex items-center shadow-sm">
                  {pendientesCount} nueva{pendientesCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-slate-400 mt-0.5 truncate sm:whitespace-normal">Revisa, aprueba o rechaza las ventas y fiados de tus colaboradores</p>
          </div>
        </div>

        {/* FILTROS DE ESTADO */}
        <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl gap-1">
          {[
            { id: 'pendientes', label: 'Pendientes', count: pendientesCount },
            { id: 'aprobadas', label: 'Aprobadas' },
            { id: 'rechazadas', label: 'Rechazadas' },
            { id: 'todas', label: 'Todas' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltroTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all capitalize cursor-pointer ${
                filtroTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              {tab.label} {tab.count !== undefined && tab.count > 0 ? `(${tab.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS INTEGRADOS (CLIENTE, COLABORADOR, PRODUCTO) */}
      <div className="bg-white dark:bg-[#0f172a] px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        
        {/* Buscador */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cliente, colaborador o producto..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 transition-colors placeholder:text-slate-400 placeholder:font-normal"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtro por tipo de orden (Todos, Venta, Fiado, Separe) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'venta', label: 'Ventas', icon: ShoppingCart },
            { id: 'fiado', label: 'Fiados', icon: Receipt },
            { id: 'separe', label: 'Separes', icon: Bookmark }
          ].map((t) => {
            const Icon = (t as any).icon;
            const activo = filtroTipo === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFiltroTipo(t.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activo
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {Icon && <Icon size={12} />}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTROS EN MÓVIL (TABS DE ESTADO) */}
      <div className="sm:hidden flex bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 p-2 gap-1 overflow-x-auto">
        {[
          { id: 'pendientes', label: 'Pendientes', count: pendientesCount },
          { id: 'aprobadas', label: 'Aprobadas' },
          { id: 'rechazadas', label: 'Rechazadas' },
          { id: 'todas', label: 'Todas' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFiltroTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap capitalize transition-all cursor-pointer ${
              filtroTab === tab.id
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {tab.label} {tab.count !== undefined && tab.count > 0 ? `(${tab.count})` : ''}
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
                {filtroTab === 'pendientes' ? '¡Todo al día! No hay órdenes pendientes' : 'No hay órdenes en esta sección'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                {filtroTab === 'pendientes'
                  ? 'Cuando tus colaboradores registren ventas, fiados o planes separe sin permisos de venta directa, aparecerán aquí para tu aprobación.'
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
                              ord.tipo === 'separe'
                                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                                : esFiado
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
                          <div key={idx} className="flex justify-between items-center text-xs min-w-0 gap-2">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
                              {item.cantidad}x {item.descripcion || "Artículo"}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white shrink-0">
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

                      {/* DETALLE INTELIGENTE DE FORMA DE PAGO REGISTRADA */}
                      <div className="bg-slate-100/80 dark:bg-[#020617] rounded-xl p-2.5 mb-3 border border-slate-200/60 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Forma de Pago:</span>
                          <span className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            {ord.tipo === 'fiado' ? (
                              <span className="text-rose-600 dark:text-rose-400">🔴 Fiado Total</span>
                            ) : ord.metodoPago === 'credito_externo' ? (
                              <span className="text-purple-600 dark:text-purple-400 font-black">⚡ Crédito ({ord.subMetodoPago || 'Sistecrédito/Addi'})</span>
                            ) : ord.metodoPago === 'transferencia' ? (
                              <span className="text-blue-600 dark:text-blue-400 font-black">📱 Transferencia ({ord.subMetodoPago || 'Nequi/Banco'})</span>
                            ) : ord.metodoPago === 'datafono' ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-black">💳 Datáfono</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-black">💵 Efectivo</span>
                            )}
                          </span>
                        </div>

                        {/* Si hubo pago parcial o es separe */}
                        {ord.tipo !== 'fiado' && ord.pagoCliente !== undefined && Number(ord.pagoCliente) < ord.total && (
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/50 dark:border-slate-800 font-semibold">
                            <span className="text-slate-500">Recibido: <strong className="text-slate-800 dark:text-slate-200">${(Number(ord.pagoCliente) || 0).toLocaleString('es-CO')}</strong></span>
                            <span className="text-rose-500 font-bold">Saldo: ${(ord.total - (Number(ord.pagoCliente) || 0)).toLocaleString('es-CO')}</span>
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

                    {/* BOTONES DE ACCIÓN PARA PENDIENTES (SOLO ADMINISTRADOR) */}
                    {esPendiente && (
                      <div className="p-3 bg-slate-50 dark:bg-[#020617]/50 border-t border-slate-100 dark:border-slate-800/80">
                        {esAdmin ? (
                          <div className="space-y-1.5">
                            {/* Fila 1: Rechazar y Editar */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => setModalRechazo({ visible: true, orden: ord, motivo: "" })}
                                disabled={estaProcesando}
                                className="w-full py-2 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Rechazar orden"
                              >
                                <XCircle size={14} className="shrink-0" />
                                <span>Rechazar</span>
                              </button>
                              <button
                                onClick={() => abrirModalEdicion(ord)}
                                disabled={estaProcesando}
                                className="w-full py-2 px-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-amber-500/20 cursor-pointer"
                              >
                                <Edit2 size={14} className="shrink-0" />
                                <span>Editar</span>
                              </button>
                            </div>

                            {/* Fila 2: Aprobar Orden destacado */}
                            <button
                              onClick={() => aprobarOrden(ord)}
                              disabled={estaProcesando}
                              className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {estaProcesando ? (
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <>
                                  <CheckCircle2 size={15} className="shrink-0" />
                                  <span>Aprobar Orden</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                              <Clock size={13} className="shrink-0 animate-pulse text-amber-600" />
                              <span>Esperando aprobación</span>
                            </div>
                            <button
                              onClick={() => abrirModalEdicion(ord)}
                              disabled={estaProcesando}
                              className="py-1.5 px-3 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-black rounded-xl text-xs transition-all active:scale-95 flex items-center gap-1.5 border border-amber-500/30 cursor-pointer shadow-sm"
                            >
                              <Edit2 size={12} className="shrink-0" />
                              <span>Editar mi orden</span>
                            </button>
                          </div>
                        )}
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

      {/* MODAL DE EDICIÓN DE ORDEN INTEGRAL (IDÉNTICO A VENDER / FIAR / SEPARE ORIGINAL) */}
      {modalEdicion.visible && modalEdicion.orden && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-0 md:p-4 z-[999] animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] rounded-none md:rounded-[2.5rem] w-full max-w-7xl shadow-2xl border border-slate-100 dark:border-slate-800 my-auto animate-in zoom-in-95 duration-200 h-[100dvh] md:h-[92dvh] max-h-[100dvh] flex flex-col overflow-hidden">
            
            {/* CABECERA SUPERIOR CON SELECTOR DE MODALIDAD VENTA / FIADO / SEPARE */}
            <div className={`p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm gap-2 transition-colors ${
              modalEdicion.tipo === 'separe' 
                ? 'bg-gradient-to-r from-violet-600 via-purple-700 to-indigo-800' 
                : (modalEdicion.tipo === 'fiado' ? 'bg-rose-600 dark:bg-rose-700' : 'bg-emerald-600 dark:bg-emerald-700')
            }`}>
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button 
                  type="button"
                  onClick={() => setModalEdicion({ ...modalEdicion, visible: false, orden: null })} 
                  className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm cursor-pointer active:scale-95 shrink-0"
                  title="Volver"
                >
                  <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                </button>
                
                {/* Selector de Modalidad Venta / Fiado o Badge de Plan Separe */}
                {modalEdicion.tipo === 'separe' ? (
                  <div className="flex items-center gap-2 bg-black/25 px-3.5 py-1.5 rounded-2xl border border-white/20 text-white font-black text-xs sm:text-sm">
                    <Bookmark size={15} /> ✦ MODIFICAR PLAN SEPARE
                  </div>
                ) : (
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
                )}
              </div>

              {/* Vendedor Responsable */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 border border-white/20 text-white text-xs font-bold gap-1.5 max-w-[90px] sm:max-w-[140px] min-w-0">
                  <User size={14} className="text-white/80 shrink-0" />
                  <span className="truncate">{modalEdicion.orden.nombreColaborador}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalEdicion({ ...modalEdicion, visible: false, orden: null })}
                  className="bg-white/20 hover:bg-white/30 p-1.5 rounded-xl text-white transition-colors cursor-pointer shrink-0"
                  title="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* BARRA DE PESTAÑA */}
            <div className={`px-4 py-2 border-b flex items-center gap-2 shrink-0 z-20 transition-colors ${
              modalEdicion.tipo === 'separe'
                ? 'bg-violet-700/90 dark:bg-slate-900 border-violet-800/40 dark:border-slate-800'
                : (modalEdicion.tipo === 'fiado' ? 'bg-rose-700/90 dark:bg-slate-900 border-rose-800/40 dark:border-slate-800' : 'bg-emerald-700/90 dark:bg-slate-900 border-emerald-800/40 dark:border-slate-800')
            }`}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-slate-900 shadow-md font-black text-xs">
                {modalEdicion.tipo === 'separe' ? <Bookmark size={13} className="text-violet-600" /> : (modalEdicion.tipo === 'fiado' ? <Receipt size={13} className="text-rose-600" /> : <ShoppingCart size={13} className="text-emerald-600" />)}
                <span>{modalEdicion.clienteNombre || `Orden #${modalEdicion.orden.id.substring(0, 5)}`}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black bg-slate-100 text-slate-800">
                  ${totalEdicion.toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* CUERPO PRINCIPAL EN 2 COLUMNAS (FLEX LAYOUT LIMPIO IDÉNTICO A VENDER / FIAR / SEPARE) */}
            <div className="flex flex-col lg:flex-row flex-1 min-h-0 relative overflow-y-auto lg:overflow-hidden">
              
              {/* COLUMNA IZQUIERDA: ARTÍCULOS O CONCEPTOS */}
              <div className="lg:flex-1 flex flex-col relative bg-slate-50/50 dark:bg-[#0f172a] lg:overflow-hidden shrink-0 min-w-0">
                <div className="flex-1 lg:overflow-y-auto p-3 sm:p-5 space-y-4">
                  
                  <div className="flex justify-between items-center px-1">
                    <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider">
                      {modalEdicion.tipo === 'separe' ? 'ARTÍCULOS A SEPARAR' : (modalEdicion.tipo === 'fiado' ? 'ARTÍCULOS A FIAR' : 'ARTÍCULOS O CONCEPTOS')}
                    </h4>
                  </div>

                  {/* LISTA DE FILAS DE PRODUCTOS */}
                  <div className="space-y-3">
                    {modalEdicion.items.map((item, idx) => {
                      const productosFiltrados = ordenarProductosSugeridos(inventario, item.descripcion);

                      return (
                        <div
                          key={idx}
                          className={`bg-white dark:bg-[#020617] p-2.5 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative flex flex-col md:flex-row gap-2.5 items-stretch md:items-center group ${busquedaProductoIndexEdicion === idx ? 'z-40' : 'z-10'}`}
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
                            <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                              <Package size={11} /> DESCRIPCIÓN O SKU
                            </label>
                            <input
                              ref={(el) => { inputsDescripcionEdicionRef.current[idx] = el; }}
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => {
                                actualizarItemEdicion(idx, 'descripcion', e.target.value);
                                setBusquedaProductoIndexEdicion(idx);
                              }}
                              onFocus={() => {
                                setBusquedaProductoIndexEdicion(idx);
                                inputsDescripcionEdicionRef.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (busquedaProductoIndexEdicion === idx && productosFiltrados.length > 0) {
                                    const p = productosFiltrados[0];
                                    const nuevos = [...modalEdicion.items];
                                    nuevos[idx].descripcion = p.nombre;
                                    if (p.precioVenta !== undefined) nuevos[idx].valor = String(p.precioVenta);
                                    setModalEdicion({ ...modalEdicion, items: nuevos });
                                    setBusquedaProductoIndexEdicion(null);
                                    setTimeout(() => {
                                      agregarFilaEdicion();
                                    }, 80);
                                  } else if (item.descripcion.trim().length > 0) {
                                    agregarFilaEdicion();
                                  }
                                }
                              }}
                              placeholder="Escribe nombre o SKU..."
                              className="w-full px-3 py-2 h-[42px] sm:h-[46px] bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs sm:text-sm outline-none text-slate-900 dark:text-white focus:border-emerald-500 transition-colors"
                            />

                            {/* Autocompletar dropdown */}
                            {busquedaProductoIndexEdicion === idx && (item.descripcion || '').trim().length > 0 && productosFiltrados.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 backdrop-blur-md">
                                {productosFiltrados.map((p) => {
                                  const esInv = p.tipoProducto !== 'servicio' && p.inventariable !== false;
                                  const cantEnOtras = modalEdicion.items.reduce((acc, it, i) => i !== idx && it.descripcion.toLowerCase().trim() === p.nombre.toLowerCase().trim() ? acc + it.cantidad : acc, 0);
                                  const stockDisp = (p.stock || 0) - cantEnOtras;
                                  const estaAgotado = esInv && stockDisp <= 0;

                                  return (
                                    <div
                                      key={p.id}
                                      onClick={() => {
                                        if (estaAgotado) {
                                          toast.error(`⚠️ "${p.nombre}" no tiene existencias disponibles.`, { position: 'bottom-center', icon: '🚫' });
                                          return;
                                        }
                                        const nuevos = [...modalEdicion.items];
                                        nuevos[idx].descripcion = p.nombre;
                                        if (p.precioVenta !== undefined) nuevos[idx].valor = String(p.precioVenta);
                                        nuevos[idx].cantidad = esInv ? Math.min(1, stockDisp) : 1;
                                        setModalEdicion({ ...modalEdicion, items: nuevos });
                                        setBusquedaProductoIndexEdicion(null);
                                        setTimeout(() => {
                                          agregarFilaEdicion();
                                        }, 80);
                                      }}
                                      className={`p-3 transition-all flex justify-between items-center text-xs sm:text-sm ${
                                        estaAgotado 
                                          ? 'bg-rose-50/50 dark:bg-rose-950/20 opacity-60 cursor-not-allowed hover:bg-rose-100/60 border-l-4 border-rose-500' 
                                          : 'hover:bg-emerald-50/80 dark:hover:bg-slate-800/80 cursor-pointer active:scale-[0.99]'
                                      }`}
                                    >
                                      <div className="min-w-0 pr-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={`font-bold block truncate ${estaAgotado ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                                            {p.nombre}
                                          </span>
                                          {p.sku && (
                                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded shrink-0">
                                              {p.sku}
                                            </span>
                                          )}
                                        </div>

                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                          {!esInv ? (
                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                              🛠️ Servicio / Ilimitado
                                            </span>
                                          ) : estaAgotado ? (
                                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                              🚫 Agotado ({cantEnOtras > 0 ? `${cantEnOtras} en tu lista` : '0 disponibles'})
                                            </span>
                                          ) : stockDisp <= 5 ? (
                                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                              ⚡ ¡Solo quedan {stockDisp}!
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                              ✓ {stockDisp} disponibles
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <span className={`font-black shrink-0 ${estaAgotado ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        ${(p.precioVenta || 0).toLocaleString('es-CO')}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* CANTIDAD + PRECIO + FOTO */}
                          <div className="flex flex-row gap-2 sm:gap-3 w-full md:w-auto shrink-0 items-end">
                            {/* CANTIDAD */}
                            <div className="w-[85px] sm:w-[95px] shrink-0">
                              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Cant.
                              </label>
                              <div className="flex items-center bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden h-[42px] sm:h-[46px]">
                                <button
                                  type="button"
                                  onClick={() => actualizarItemEdicion(idx, 'cantidad', Math.max(1, item.cantidad - 1))}
                                  className="px-2 sm:px-2.5 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 font-black cursor-pointer"
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="flex-1 text-center font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {item.cantidad}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => actualizarItemEdicion(idx, 'cantidad', item.cantidad + 1)}
                                  className="px-2 sm:px-2.5 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 font-black cursor-pointer"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>

                            {/* PRECIO UNITARIO */}
                            <div className="flex-1 md:w-32 min-w-0">
                              <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Precio Unit.
                              </label>
                              {(() => {
                                const itemInventario = inventario.find(p => p.nombre.trim().toLowerCase() === (item.descripcion || '').trim().toLowerCase());
                                const precioBloqueado = !puedeModificarPrecios && !!itemInventario;

                                return (
                                  <div className="relative h-[42px] sm:h-[46px]">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">$</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={item.valor ? parseInt(item.valor.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : ''}
                                      onChange={(e) => actualizarItemEdicion(idx, 'valor', e.target.value)}
                                      disabled={precioBloqueado}
                                      title={precioBloqueado ? "Precio fijado por inventario (no editable por colaboradores)" : ""}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          agregarFilaEdicion();
                                        }
                                      }}
                                      placeholder="0"
                                      className={`w-full pl-6 pr-2.5 h-full border rounded-xl outline-none font-black text-xs sm:text-sm text-right focus:border-emerald-500 transition-colors ${
                                        precioBloqueado 
                                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700' 
                                          : 'bg-slate-50 dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                                      }`}
                                    />
                                  </div>
                                );
                              })()}
                            </div>

                            {/* FOTO (PLAN SEPARE) */}
                            {modalEdicion.tipo === 'separe' && (
                              <div className="shrink-0 h-[42px] sm:h-[46px] flex items-end">
                                {item.fotoUrl ? (
                                  <div className="relative group w-10 h-10 rounded-xl overflow-hidden border border-violet-300 dark:border-violet-700 shadow-sm shrink-0 bg-slate-900">
                                    <img
                                      src={item.fotoUrl}
                                      alt="Foto"
                                      onClick={() => setFotoLightboxEdicion(item.fotoUrl!)}
                                      className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                      title="Clic para ver foto en grande"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        actualizarItemEdicion(idx, 'fotoUrl', null);
                                      }}
                                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 z-10 cursor-pointer"
                                      title="Eliminar foto"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => abrirCamaraEdicion(idx)}
                                    className="h-10 px-2.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-xl hover:bg-violet-100 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
                                    title="Tomar o adjuntar foto con cámara"
                                  >
                                    <Camera size={14} />
                                    <span className="hidden sm:inline">Foto</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* INPUT OCULTO DE ARCHIVO PARA FOTOS */}
                  <input
                    type="file"
                    ref={fileInputEdicionRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && itemIdxParaFotoEdicion !== null) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          actualizarItemEdicion(itemIdxParaFotoEdicion, 'fotoUrl', ev.target?.result as string);
                          setItemIdxParaFotoEdicion(null);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  {/* BOTONES: AÑADIR ARTÍCULO Y APLICAR DESCUENTO */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={agregarFilaEdicion}
                      className={`font-bold py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-sm cursor-pointer active:scale-95 ${
                        modalEdicion.tipo === 'separe'
                          ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100'
                          : (modalEdicion.tipo === 'fiado'
                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100')
                      }`}
                    >
                      <Plus size={15} /> + Añadir artículo
                    </button>

                    {puedeAplicarDescuentos && (
                      <button
                        type="button"
                        onClick={() => setModalEdicion({
                          ...modalEdicion,
                          descuentoTipo: modalEdicion.descuentoTipo ? null : 'porcentaje',
                          descuentoValor: ""
                        })}
                        className="font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 px-4 rounded-xl transition-all flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
                      >
                        <Tag size={14} className={modalEdicion.tipo === 'separe' ? 'text-violet-500' : (modalEdicion.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500')} />
                        <span>{modalEdicion.descuentoTipo ? 'Quitar Descuento' : '+ Aplicar Descuento'}</span>
                      </button>
                    )}
                  </div>

                  {/* SECCIÓN DESCUENTO COMERCIAL SI ESTÁ ACTIVADO */}
                  {modalEdicion.descuentoTipo && puedeAplicarDescuentos && (
                    <div className="bg-white dark:bg-[#020617] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-150 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${modalEdicion.tipo === 'separe' ? 'text-violet-600 dark:text-violet-400' : (modalEdicion.tipo === 'fiado' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}`}>
                          <Tag size={12} /> Descuento:
                        </span>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                          <button
                            type="button"
                            onClick={() => setModalEdicion({ ...modalEdicion, descuentoTipo: 'porcentaje', descuentoValor: '' })}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${modalEdicion.descuentoTipo === 'porcentaje' ? (modalEdicion.tipo === 'separe' ? 'bg-violet-600 text-white' : (modalEdicion.tipo === 'fiado' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white')) : 'text-slate-500'}`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalEdicion({ ...modalEdicion, descuentoTipo: 'fijo', descuentoValor: '' })}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${modalEdicion.descuentoTipo === 'fijo' ? (modalEdicion.tipo === 'separe' ? 'bg-violet-600 text-white' : (modalEdicion.tipo === 'fiado' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white')) : 'text-slate-500'}`}
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
                          className="w-24 px-2 py-1 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-black text-xs text-center text-slate-900 dark:text-white"
                        />

                        {modalEdicion.descuentoTipo === 'porcentaje' && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {[5, 10, 15, 20].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => setModalEdicion({ ...modalEdicion, descuentoValor: String(pct) })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${modalEdicion.descuentoValor === String(pct) ? (modalEdicion.tipo === 'separe' ? 'bg-violet-600 text-white border-violet-600 font-black' : (modalEdicion.tipo === 'fiado' ? 'bg-rose-600 text-white border-rose-600 font-black' : 'bg-emerald-600 text-white border-emerald-600 font-black')) : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
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
                        className="text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <X size={12} /> Quitar
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* COLUMNA DERECHA: CLIENTE + FORMA DE PAGO + TOTAL (COMPACTA Y CON SCROLL DINÁMICO) */}
              <div className="w-full lg:w-[360px] xl:w-[390px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 p-3 sm:p-3.5 space-y-2 lg:overflow-y-auto min-h-0 pb-32 lg:pb-4">
                
                {/* TARJETA CLIENTE (COMPACTA) */}
                <div className="bg-white dark:bg-[#0f172a] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1">
                  <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${modalEdicion.tipo === 'separe' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`}>
                    <User size={11} /> {modalEdicion.tipo === 'separe' ? 'CLIENTE (OBLIGATORIO - PLAN SEPARE)' : (modalEdicion.tipo === 'fiado' ? 'CLIENTE (OBLIGATORIO)' : 'CLIENTE (OPCIONAL)')}
                  </span>

                  {modalEdicion.clienteNombre && modalEdicion.clienteNombre !== "Mostrador" ? (
                    <div className={`py-1 px-2.5 rounded-xl border flex justify-between items-center animate-in fade-in duration-150 ${
                      modalEdicion.tipo === 'separe' 
                        ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-800/50' 
                        : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/50'
                    }`}>
                      <span className={`font-black text-xs truncate mr-2 ${modalEdicion.tipo === 'separe' ? 'text-violet-900 dark:text-violet-300' : 'text-slate-900 dark:text-emerald-300'}`}>
                        {modalEdicion.clienteNombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalEdicion({
                          ...modalEdicion,
                          clienteId: null,
                          clienteNombre: modalEdicion.tipo === 'separe' ? "" : "Mostrador",
                          clienteCelular: ""
                        })}
                        className="text-rose-500 shrink-0 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-0.5 rounded-full cursor-pointer transition-colors"
                        title="Quitar cliente"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={modalEdicion.busquedaCliente}
                        onFocus={() => setModalEdicion({ ...modalEdicion, mostrarBuscadorCliente: true })}
                        onChange={(e) => setModalEdicion({ ...modalEdicion, busquedaCliente: e.target.value, mostrarBuscadorCliente: true })}
                        placeholder="Buscar / Crear cliente..."
                        className="w-full pl-7 pr-2 py-1 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none text-slate-900 dark:text-white focus:border-violet-500 placeholder:text-slate-400 placeholder:font-normal h-7"
                      />

                      {/* Desplegable de búsqueda de clientes */}
                      {modalEdicion.mostrarBuscadorCliente && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-30 max-h-44 overflow-y-auto p-1 animate-in fade-in duration-150">
                          {modalEdicion.tipo !== 'fiado' && modalEdicion.tipo !== 'separe' && (
                            <div
                              onClick={() => setModalEdicion({
                                ...modalEdicion,
                                clienteId: null,
                                clienteNombre: "Mostrador",
                                clienteCelular: "",
                                mostrarBuscadorCliente: false,
                                busquedaCliente: ""
                              })}
                              className="p-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center"
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
                                className="p-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer flex justify-between items-center"
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

                {/* FECHA LÍMITE Y NOTAS SI ES SEPARE (ULTRA COMPACTO) */}
                {modalEdicion.tipo === 'separe' && (
                  <div className="bg-white dark:bg-[#0f172a] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1.5 animate-in fade-in duration-150">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 flex items-center gap-1">
                        <Calendar size={11} /> Fecha Límite de Pago
                      </span>
                      <div className="flex items-center gap-1">
                        {[
                          { label: '1m', meses: 1 },
                          { label: '3m', meses: 3 },
                          { label: '6m', meses: 6 }
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setMonth(d.getMonth() + btn.meses);
                              setModalEdicion({ ...modalEdicion, fechaLimite: d.toISOString().split('T')[0] });
                            }}
                            className="px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 text-violet-700 dark:text-violet-300 font-bold text-[9px] transition-colors border border-violet-200/60 dark:border-violet-800/40 cursor-pointer"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="date"
                      value={modalEdicion.fechaLimite}
                      onChange={(e) => setModalEdicion({ ...modalEdicion, fechaLimite: e.target.value })}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none text-slate-900 dark:text-white h-7"
                    />

                    <input
                      type="text"
                      value={modalEdicion.notas}
                      onChange={(e) => setModalEdicion({ ...modalEdicion, notas: e.target.value })}
                      placeholder="Nota / Ubicación (Opcional)..."
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-[11px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 h-7"
                    />
                  </div>
                )}

                {/* TARJETA FORMA DE PAGO (COMPACTA) */}
                {modalEdicion.tipo !== 'fiado' ? (
                  <div className="bg-white dark:bg-[#0f172a] p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {modalEdicion.tipo === 'separe' ? 'FORMA DE PAGO DEL ABONO' : 'FORMA DE PAGO'}
                    </span>

                    {/* 4 chips de pago compactos */}
                    <div className="grid grid-cols-4 gap-1">
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
                                pagoCliente: (modalEdicion.tipo !== 'separe' && m.id !== 'efectivo') ? String(totalEdicion) : modalEdicion.pagoCliente
                              });
                            }}
                            className={`py-1.5 px-0.5 rounded-xl font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                              activo
                                ? m.activeClass
                                : 'bg-slate-50 dark:bg-[#020617] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <Icon size={13} />
                            <span>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* SUB-SELECTORES */}
                    {modalEdicion.metodoPago === 'transferencia' && (
                      <div className="flex flex-wrap gap-1 pt-0.5 animate-in fade-in duration-150">
                        {['Nequi', 'Daviplata', 'Bancolombia', 'PSE', 'Otro'].map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setModalEdicion({ ...modalEdicion, subMetodoPago: modalEdicion.subMetodoPago === b ? '' : b })}
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-colors cursor-pointer ${modalEdicion.subMetodoPago === b ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
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
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border transition-colors cursor-pointer ${modalEdicion.subMetodoPago === b ? 'bg-purple-600 text-white border-purple-700' : 'bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* INPUT DINERO RECIBIDO */}
                    <div className="flex gap-1.5 items-center pt-0.5 border-t border-slate-100 dark:border-slate-800">
                      <div className="relative flex-1">
                        <span className={`absolute left-2 top-1/2 -translate-y-1/2 font-black text-xs ${modalEdicion.tipo === 'separe' ? 'text-violet-600' : 'text-emerald-600'}`}>$</span>
                        <input
                          type="text"
                          value={modalEdicion.pagoCliente !== "" ? (parseInt(modalEdicion.pagoCliente.replace(/\D/g, '') || '0', 10) === 0 ? "0" : parseInt(modalEdicion.pagoCliente.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO')) : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setModalEdicion({ ...modalEdicion, pagoCliente: raw });
                          }}
                          placeholder={modalEdicion.tipo === 'separe' ? "Abono inicial (opcional)" : "Dinero entregado"}
                          className="w-full pl-5 pr-2 py-1 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs outline-none text-slate-900 dark:text-white focus:border-violet-500 h-7"
                        />
                      </div>
                      {modalEdicion.tipo !== 'separe' && (
                        <button
                          type="button"
                          onClick={() => setModalEdicion({ ...modalEdicion, pagoCliente: String(totalEdicion) })}
                          className="px-2 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold text-[10px] rounded-xl border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer shrink-0 h-7"
                        >
                          ✓ Exacto
                        </button>
                      )}
                    </div>

                    {/* REFERENCIA */}
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
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-[11px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 h-7"
                      />
                    )}
                  </div>
                ) : (
                  /* ALERTA DEUDA EN FIADO */
                  <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-2.5 rounded-2xl text-xs text-rose-700 dark:text-rose-400">
                    <p className="font-bold flex items-center gap-1 mb-0.5 text-[11px]">
                      <AlertCircle size={13} /> Fiado Directo a Cuenta
                    </p>
                    <p className="text-[10px] leading-tight">
                      El monto de <strong>${totalEdicion.toLocaleString('es-CO')}</strong> se sumará a la deuda de <strong>{modalEdicion.clienteNombre || 'Cliente'}</strong>.
                    </p>
                  </div>
                )}

                {/* BLOQUE DE DEVUELTA / SALDO EN EFECTIVO */}
                {modalEdicion.tipo !== 'separe' && (() => {
                  const rawP = modalEdicion.pagoCliente.replace(/\D/g, '');
                  const numP = rawP === "" ? 0 : parseFloat(rawP);

                  if (modalEdicion.tipo !== 'fiado' && rawP !== "" && numP > totalEdicion && totalEdicion > 0) {
                    return (
                      <div className="px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-150">
                        <span className="text-[9px] uppercase font-black tracking-wider">DEVUELTA:</span>
                        <span className="text-sm font-black">${(numP - totalEdicion).toLocaleString('es-CO')}</span>
                      </div>
                    );
                  }

                  if (modalEdicion.tipo !== 'fiado' && rawP !== "" && numP < totalEdicion && totalEdicion > 0) {
                    return (
                      <div className="px-2.5 py-1.5 bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-150">
                        <span className="text-[9px] uppercase font-black tracking-wider">SALDO A FIAR:</span>
                        <span className="text-sm font-black">${(totalEdicion - numP).toLocaleString('es-CO')}</span>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* BLOQUE INFERIOR OSCURO (TOTAL + BOTONES) */}
                <div className="mt-auto bg-slate-950 text-white p-3 rounded-2xl shadow-xl flex flex-col gap-1.5">
                  {montoDescuentoEdicion > 0 && (
                    <div className="text-[11px] text-slate-400 space-y-0.5 pb-1 border-b border-slate-800">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="text-slate-200">${subtotalEdicion.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-400">
                        <span>Descuento:</span>
                        <span>-${montoDescuentoEdicion.toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                  )}

                  {modalEdicion.tipo === 'separe' && (() => {
                    const rawP = modalEdicion.pagoCliente.replace(/\D/g, '');
                    const numP = rawP === "" ? 0 : parseFloat(rawP);
                    return (
                      <div className="text-[11px] text-slate-400 space-y-0.5 pb-1 border-b border-slate-800">
                        <div className="flex justify-between font-semibold">
                          <span>Abono inicial:</span>
                          <span className="text-emerald-400 font-bold">${numP.toLocaleString('es-CO')}</span>
                        </div>
                        <div className="flex justify-between font-bold text-violet-400">
                          <span>Saldo restante:</span>
                          <span>${Math.max(0, totalEdicion - numP).toLocaleString('es-CO')}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {modalEdicion.tipo === 'separe' ? 'TOTAL SEPARE' : (modalEdicion.tipo === 'fiado' ? 'MONTO FIAR' : 'TOTAL')}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-white">
                      ${totalEdicion.toLocaleString('es-CO')}
                    </span>
                  </div>

                  {(() => {
                    const rawP = modalEdicion.pagoCliente.replace(/\D/g, '');
                    const numP = rawP === "" ? 0 : parseFloat(rawP);
                    let textoAprobar = "Aprobar";
                    let bgAprobar = "bg-emerald-500 hover:bg-emerald-600";

                    if (modalEdicion.tipo === 'separe') {
                      textoAprobar = "Aprobar Separe";
                      bgAprobar = "bg-violet-600 hover:bg-violet-700";
                    } else if (modalEdicion.tipo === 'fiado' || (rawP !== "" && numP === 0 && totalEdicion > 0)) {
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
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => guardarCambiosEdicion(false)}
                          disabled={procesandoId !== null}
                          className={`w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1 ${
                            (!esAdmin && !puedeVentaDirecta) ? 'col-span-2' : ''
                          }`}
                        >
                          💾 Guardar
                        </button>
                        {(esAdmin || puedeVentaDirecta) && (
                          <button
                            type="button"
                            onClick={() => guardarCambiosEdicion(true)}
                            disabled={procesandoId !== null}
                            className={`w-full ${bgAprobar} text-white font-black py-2.5 px-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1`}
                          >
                            <CheckCircle2 size={14} /> {textoAprobar}
                          </button>
                        )}
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

      {/* MODAL DE CONFIRMACIÓN TRAS GUARDAR CAMBIOS SIN APROBAR (CON DETALLE DE CAMBIOS REALIZADOS) */}
      {modalConfirmacionGuardado.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[1000] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-7 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 size={32} />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1">
              ¡Cambios Guardados!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-3.5">
              La orden de <strong>{modalConfirmacionGuardado.colaborador}</strong> ha sido actualizada en la lista de pendientes.
            </p>

            {/* Nuevo Total */}
            <div className="bg-slate-50 dark:bg-[#020617] p-3 rounded-2xl border border-slate-200 dark:border-slate-800 mb-3 flex justify-between items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total Actualizado:</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                ${modalConfirmacionGuardado.total.toLocaleString('es-CO')}
              </span>
            </div>

            {/* Lista de Cambios Realizados */}
            {modalConfirmacionGuardado.cambios && modalConfirmacionGuardado.cambios.length > 0 && (
              <div className="mb-4 text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5 px-1">
                  Modificaciones Aplicadas:
                </span>
                <div className="bg-slate-50 dark:bg-[#020617] p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-1.5 max-h-40 overflow-y-auto">
                  {modalConfirmacionGuardado.cambios.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="text-amber-500 font-bold mt-0.5">•</span>
                      <span className="font-medium leading-tight">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalConfirmacionGuardado({ visible: false, ordenId: "", colaborador: "", total: 0, cambios: [] })}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-2xl text-xs sm:text-sm shadow-md transition-all cursor-pointer mt-auto"
            >
              Listo, Continuar
            </button>
          </div>
        </div>
      )}

      {/* LIGHTBOX PARA VER FOTO EN DETALLE EN EDICION */}
      {fotoLightboxEdicion && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[1050] animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full flex flex-col items-center space-y-3">
            <div className="w-full flex justify-between items-center text-white px-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-violet-300">
                <Eye size={15} /> Vista previa del artículo
              </span>
              <button
                type="button"
                onClick={() => setFotoLightboxEdicion(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="w-full max-h-[75vh] overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-black flex items-center justify-center">
              <img
                src={fotoLightboxEdicion}
                alt="Foto ampliada"
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => setFotoLightboxEdicion(null)}
              className="px-5 py-2 bg-white text-slate-900 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors shadow-lg cursor-pointer"
            >
              Cerrar Vista Previa
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CÁMARA EN VIVO PARA EDICIÓN */}
      {modalCamaraEdicion && (
        <div className="fixed inset-0 z-[1100] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
            
            {/* Header del visor */}
            <div className="p-3.5 bg-slate-900/80 flex items-center justify-between border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Cámara en Vivo — Foto del Producto
                </span>
              </div>
              <button
                type="button"
                onClick={cerrarCamaraEdicion}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Visor de Video */}
            <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              {iniciandoCamaraEdicion ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold">Iniciando cámara...</span>
                </div>
              ) : mediaStreamEdicion ? (
                <video
                  ref={videoEdicionRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-6 text-center text-slate-400 space-y-3">
                  <Camera size={36} className="mx-auto text-slate-600" />
                  <p className="text-xs font-medium">No se detectó cámara web directa o se denegaron permisos.</p>
                  <button
                    type="button"
                    onClick={() => {
                      cerrarCamaraEdicion();
                      fileInputEdicionRef.current?.click();
                    }}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Subir foto desde archivo
                  </button>
                </div>
              )}
            </div>

            {/* Controles de la cámara */}
            <div className="p-4 bg-slate-900 flex items-center justify-between gap-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={alternarCamaraEdicion}
                className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title="Cambiar entre cámara trasera y delantera"
              >
                <RotateCcw size={16} />
                <span className="hidden sm:inline">Girar</span>
              </button>

              {/* Botón Central de Disparo de Foto */}
              <button
                type="button"
                onClick={capturarFotoCamaraEdicion}
                disabled={!mediaStreamEdicion}
                className="w-14 h-14 rounded-full bg-white hover:bg-slate-200 text-slate-950 flex items-center justify-center shadow-2xl active:scale-90 transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-4 border-violet-600"
                title="Capturar foto ahora"
              >
                <Camera size={24} className="text-violet-900" />
              </button>

              <button
                type="button"
                onClick={() => {
                  cerrarCamaraEdicion();
                  fileInputEdicionRef.current?.click();
                }}
                className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                title="Cargar imagen existente"
              >
                <Upload size={16} />
                <span className="hidden sm:inline">Archivo</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE TICKET TÉRMICO */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />

      {/* LIGHTBOX DE FOTO EN EDICIÓN */}
      {fotoLightboxEdicion && (
        <div
          onClick={() => setFotoLightboxEdicion(null)}
          className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[2000] cursor-pointer animate-in fade-in duration-200"
        >
          <div className="relative max-w-2xl max-h-[85vh] w-auto flex flex-col items-center">
            <button
              onClick={() => setFotoLightboxEdicion(null)}
              className="absolute -top-12 right-0 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors cursor-pointer"
              title="Cerrar vista"
            >
              <X size={22} />
            </button>
            <img
              src={fotoLightboxEdicion}
              alt="Foto del producto"
              className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white/80 text-xs font-bold mt-3 text-center">Toca en cualquier parte para cerrar</p>
          </div>
        </div>
      )}

    </div>
  );
}
