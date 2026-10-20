"use client";
import { obtenerNombreCercano } from "@/utils/whatsapp";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { Search, X, Clock, MessageCircle, Star, Users, Store, Printer, Edit3, Trash2, Bookmark, ChevronRight, Package, ArrowRight, User, RotateCcw, Smartphone, Calendar, ChevronDown } from 'lucide-react';
import toast from "react-hot-toast";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";
import TablaHistorial from "../../../components/TablaHistorial";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalProcesarDevolucion from "@/components/ModalProcesarDevolucion";
import ModalGestionCliente from "@/components/ModalGestionCliente";
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";
import { agregarMediosPagoAlEstado } from "@/utils/mediosPago";

export default function HistorialPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { datosSesion } = useAuth();
  const router = useRouter();
  
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;
  const moduloSepareActivo = datosSesion?.moduloSepareActivo !== false;
  const puedeSepare = (datosSesion?.esPro === true) && (datosSesion?.puedeSepare !== false) && moduloSepareActivo;
  const esAdmin = datosSesion?.rol !== 'cajero';
  const puedeEnviarWhatsApp = datosSesion?.puedeEnviarWhatsApp ?? true;
  const puedeHacerDevolucion = esAdmin || Boolean(datosSesion?.permisos?.hacerDevoluciones);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroTiempoHistorial, setFiltroTiempoHistorial] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState<'todos' | 'venta' | 'abono' | 'separe' | 'fiado' | 'devolucion' | 'ingreso_inventario'>('todos');
  const [filtroVendedorHistorial, setFiltroVendedorHistorial] = useState<string>('todos');
  const [colaboradoresNegocio, setColaboradoresNegocio] = useState<string[]>([]);
  
  const [movimientoInventarioDetalle, setMovimientoInventarioDetalle] = useState<Movimiento | null>(null);
  const [ultimoDocSnapshot, setUltimoDocSnapshot] = useState<any>(null);
  const [hayMasMovimientos, setHayMasMovimientos] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: DatosFacturaProps | null }>({ visible: false, datos: null });
  const [modalGestionCliente, setModalGestionCliente] = useState<{
    visible: boolean;
    modo: 'editar' | 'eliminar';
    cliente: Cliente | null;
  }>({ visible: false, modo: 'editar', cliente: null });

  const handleGestionClienteSuccess = (clienteActualizado?: Cliente, fueEliminado?: boolean) => {
    if (fueEliminado) {
      setClientes(prev => prev.filter(c => c.id !== clienteActivo?.id));
      setClienteActivo(null);
      setMovimientosCliente([]);
      setSeparesCliente([]);
    } else if (clienteActualizado) {
      setClientes(prev => prev.map(c => c.id === clienteActualizado.id ? clienteActualizado : c).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setClienteActivo(clienteActualizado);
    }
  };

  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [modalMostrador, setModalMostrador] = useState(false);
  const [movimientoMostrador, setMovimientoMostrador] = useState<Movimiento | null>(null);
  const [modalDevolucion, setModalDevolucion] = useState<{ isOpen: boolean; venta: Movimiento | null }>({ isOpen: false, venta: null });

  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<Movimiento[]>([]);
  const [separesCliente, setSeparesCliente] = useState<any[]>([]);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");

  const scrollHistorialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cuentaPrincipalId) return;

    // Carga inicial de colaboradores activos del negocio para el selector de vendedores
    const qColabs = query(
      collection(db, "usuarios"),
      where("adminId", "==", cuentaPrincipalId),
      where("rol", "==", "cajero")
    );
    getDocs(qColabs).then(snap => {
      const nombres: string[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.activo !== false && !d.esCajaMostrador && !d.esTerminalMultivendedor) {
          const nom = d.nombreUsuario || d.nombre;
          if (nom && !nombres.includes(nom)) nombres.push(nom);
        }
      });
      setColaboradoresNegocio(nombres);
    }).catch(e => console.error("Error cargando colaboradores en historial:", e));

    // Carga inicial de clientes
    API_DB.obtenerClientes(cuentaPrincipalId).then(listaC => {
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);
    }).catch(e => console.error("Error cargando clientes en historial:", e));

    // Listener en tiempo real de movimientos recientes (primer lote de 15 transacciones)
    let unsubFallback: (() => void) | null = null;
    const qM = query(
      collection(db, "movimientos"),
      where("usuarioId", "==", cuentaPrincipalId),
      orderBy("fecha", "desc"),
      limit(16)
    );

    const unsubM = onSnapshot(qM, (snap) => {
      const docs = snap.docs;
      const hayMas = docs.length > 15;
      const docsAProcesar = hayMas ? docs.slice(0, 15) : docs;
      const movs: Movimiento[] = [];
      docsAProcesar.forEach(d => {
        movs.push({ id: d.id, ...d.data() } as Movimiento);
      });
      setTodosMovimientos(movs);
      if (docsAProcesar.length > 0) {
        setUltimoDocSnapshot(docsAProcesar[docsAProcesar.length - 1]);
      }
      setHayMasMovimientos(hayMas);
    }, (err) => {
      console.warn("Listener indexado de movimientos no disponible, usando listener en tiempo real con ordenamiento local:", err?.message || err);
      try {
        const qFallback = query(
          collection(db, "movimientos"),
          where("usuarioId", "==", cuentaPrincipalId)
        );
        unsubFallback = onSnapshot(qFallback, (snap) => {
          const movs: Movimiento[] = [];
          snap.forEach(d => {
            movs.push({ id: d.id, ...d.data() } as Movimiento);
          });
          movs.sort((a, b) => (b.fecha?.toMillis ? b.fecha.toMillis() : 0) - (a.fecha?.toMillis ? a.fecha.toMillis() : 0));
          const hayMas = movs.length > 15;
          const primeros = movs.slice(0, 15);
          setTodosMovimientos(primeros);
          if (primeros.length > 0) {
            setUltimoDocSnapshot({ id: primeros[primeros.length - 1].id });
          }
          setHayMasMovimientos(hayMas);
        }, (err2) => {
          console.warn("Fallo listener fallback, cargando estático:", err2);
          cargarDatosHistorial(cuentaPrincipalId);
        });
      } catch (e) {
        cargarDatosHistorial(cuentaPrincipalId);
      }
    });

    return () => {
      unsubM();
      if (unsubFallback) unsubFallback();
    };
  }, [cuentaPrincipalId]);

  const cargarDatosHistorial = async (uid: string) => {
    try {
      const listaC = await API_DB.obtenerClientes(uid);
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);
      
      const resPaginada = await API_DB.obtenerMovimientosPaginados(uid, 15);
      setTodosMovimientos(resPaginada.movimientos);
      setUltimoDocSnapshot(resPaginada.ultimoDoc);
      setHayMasMovimientos(resPaginada.hayMas);
      
      if (clienteActivo) {
         try {
           const qM = query(
             collection(db, "movimientos"),
             where("usuarioId", "==", uid),
             where("clienteId", "==", clienteActivo.id)
           );
           const snapM = await getDocs(qM);
           const movs: any[] = [];
           snapM.forEach(doc => movs.push({ id: doc.id, ...doc.data() }));
           movs.sort((a, b) => {
             const tA = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
             const tB = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
             return tB - tA;
           });
           setMovimientosCliente(movs);
         } catch (e) {
           console.error("Error al actualizar movimientos del cliente activo:", e);
         }
         
         const clienteActualizado = listaC.find(c => c.id === clienteActivo.id);
         if(clienteActualizado) setClienteActivo(clienteActualizado);
      }
    } catch (error) { 
      toast.error("Error al cargar el historial.");
    }
  };

  const cargarMasMovimientos = async () => {
    if (!cuentaPrincipalId || cargandoMas || !hayMasMovimientos) return;
    setCargandoMas(true);
    try {
      const res = await API_DB.obtenerMovimientosPaginados(cuentaPrincipalId, 15, ultimoDocSnapshot);
      setTodosMovimientos(prev => {
        const idsExistentes = new Set(prev.map(m => m.id));
        const nuevos = res.movimientos.filter(m => !idsExistentes.has(m.id));
        return [...prev, ...nuevos];
      });
      setUltimoDocSnapshot(res.ultimoDoc);
      setHayMasMovimientos(res.hayMas);
    } catch (error) {
      toast.error("Error al cargar más registros.");
    } finally {
      setCargandoMas(false);
    }
  };

  const abrirTicketDeMovimiento = (mov: Movimiento) => {
    if (mov.tipo === 'ingreso_inventario') return;

    const clienteEncontrado = clientes.find(c => c.id === mov.clienteId);
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
      saldoNuevo: mov.saldoResultante !== undefined ? mov.saldoResultante : (clienteEncontrado ? clienteEncontrado.deudaTotal : undefined),
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

  const getNombreCliente = (id?: string, tipo?: string, fallbackNombre?: string) => {
    if (tipo === 'ingreso_inventario') return 'Entrada de Mercancía';
    if (!id) return 'Entrada de Stock';
    if (id === 'mostrador') return fallbackNombre && fallbackNombre !== 'Mostrador' ? fallbackNombre : 'Consumidor Final';
    const cli = clientes.find(c => c.id === id);
    if (cli) return cli.nombre;
    if (fallbackNombre && fallbackNombre !== 'Mostrador') return fallbackNombre;
    if (clientes.length === 0) return '...';
    return "Cliente Eliminado";
  };

  const reintentarNotaCredito = async (mov: Movimiento) => {
    const toastId = toast.loading('Reintentando Nota Crédito ante la DIAN...');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/devoluciones/reintentar-nota-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ movimientoDevolucionId: mov.id })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        toast.success('Nota Crédito emitida correctamente.', { id: toastId });
      } else {
        toast.error(data.error || 'No se pudo emitir la Nota Crédito.', { id: toastId, duration: 6000 });
      }
      if (cuentaPrincipalId) cargarDatosHistorial(cuentaPrincipalId);
    } catch {
      toast.error('Error de conexión al reintentar la Nota Crédito.', { id: toastId });
    }
  };

  const abrirHistorialCliente = async (clienteId?: string, mov?: Movimiento) => {
    if (!clienteId) return;
    if (clienteId === 'mostrador') {
      if (mov) setMovimientoMostrador(mov);
      setModalMostrador(true);
      return;
    }
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      setClienteActivo(cliente);
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
        const movs: any[] = [];
        snapM.forEach(doc => movs.push({ id: doc.id, ...doc.data() }));

        const listaS: any[] = [];
        snapS.forEach(doc => listaS.push({ id: doc.id, ...doc.data() }));
        listaS.sort((a, b) => ((b.fechaCreacion as any)?.toMillis ? (b.fechaCreacion as any).toMillis() : 0) - ((a.fechaCreacion as any)?.toMillis ? (a.fechaCreacion as any).toMillis() : 0));
        setSeparesCliente(listaS);

        const idsSeparesConMov = new Set(
          movs.filter(m => m.idSepareOrigen || (m as any).separeId).map(m => m.idSepareOrigen || (m as any).separeId)
        );

        for (const sep of listaS) {
          if (!idsSeparesConMov.has(sep.id)) {
            movs.push({
              id: `sep-apertura-${sep.id}`,
              clienteId: clienteId,
              clienteNombre: cliente.nombre,
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

        movs.sort((a, b) => {
          const tA = (a.fecha as any)?.toMillis ? (a.fecha as any).toMillis() : (a.fecha ? new Date(a.fecha as any).getTime() : 0);
          const tB = (b.fecha as any)?.toMillis ? (b.fecha as any).toMillis() : (b.fecha ? new Date(b.fecha as any).getTime() : 0);
          return tB - tA;
        });
        setMovimientosCliente(movs);
      } catch (e) {
        console.error("Error cargando historial de movimientos del cliente:", e);
      }
    } else {
      toast.error("El perfil del cliente ya no existe.");
    }
  };

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

  const normalizarBusqueda = (texto: string) => {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const directorioFiltrado = clientes.filter(c => {
    const q = normalizarBusqueda(busquedaDirectorio);
    if (!q) return true;
    return (
      normalizarBusqueda(c.nombre).includes(q) ||
      (c.celular && c.celular.toString().includes(busquedaDirectorio.trim())) ||
      normalizarBusqueda(c.notas || "").includes(q) ||
      normalizarBusqueda(c.direccion || "").includes(q)
    );
  });

  const hoyDate = new Date();
  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1; 
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum);

  // Permiso para gestionar y consultar ingresos de inventario
  const puedeGestionarInventario = esAdmin || Boolean(datosSesion?.permisos?.editarInventario || datosSesion?.permisos?.ingresoInventario);

  // Lista de vendedores reales del negocio (Admin + Colaboradores activos configurados en Ajustes)
  const adminNombre = (datosSesion?.nombreUsuario || '').trim();
  const listaVendedores = Array.from(
    new Set([adminNombre, ...colaboradoresNegocio])
  ).filter((v): v is string => Boolean(v && typeof v === 'string' && v.trim().length > 0))
   .sort((a, b) => a.localeCompare(b));

  const historialFiltrado = todosMovimientos.filter(mov => {
    const filtroForzado = (!puedeVerReportes || planActual === 'basico') ? 'hoy' : filtroTiempoHistorial;
    
    // Regla de privacidad: Inventario solo visible si tiene permiso de inventario
    if (mov.tipo === 'ingreso_inventario') {
      if (!puedeGestionarInventario) return false;
      
      // Si es colaborador con permiso de inventario, solo ve lo que él mismo registró
      if (!esAdmin) {
        const nombreActual = (datosSesion?.nombreUsuario || '').trim().toLowerCase();
        const regPor = (mov.registradoPor || '').trim().toLowerCase();
        const creador = (mov as any).creadoPor || '';
        const matchPropio = (nombreActual && regPor === nombreActual) || (datosSesion?.uid && creador === datosSesion.uid);
        if (!matchPropio) return false;
      }
    }

    const esIngresoInv = mov.tipo === 'ingreso_inventario';
    const clienteMov = clientes.find(c => c.id === mov.clienteId);
    const nombreCliente = esIngresoInv 
      ? 'Entrada de Mercancía' 
      : (clienteMov?.nombre || (mov.clienteId === 'mostrador' ? (mov.clienteNombre && mov.clienteNombre !== 'Mostrador' ? mov.clienteNombre : 'Consumidor Final') : (mov.clienteNombre || (clientes.length === 0 ? '' : 'Cliente Eliminado'))));
    const celularCliente = clienteMov?.celular || '';
    const vendedorMov = (mov.registradoPor || (mov as any).vendedor || '').toString();
    
    const qNorm = normalizarBusqueda(busquedaHistorial);
    const notasCliente = clienteMov?.notas || '';
    const direccionCliente = clienteMov?.direccion || '';
    const detallesMatch = Boolean(
      Array.isArray(mov.detalles) &&
      mov.detalles.some((d: any) => normalizarBusqueda(d.descripcion || '').includes(qNorm))
    );
    
    const matchBusqueda = 
      !qNorm ||
      normalizarBusqueda(nombreCliente).includes(qNorm) ||
      celularCliente.toString().includes(busquedaHistorial.trim()) ||
      normalizarBusqueda(vendedorMov).includes(qNorm) ||
      normalizarBusqueda(notasCliente).includes(qNorm) ||
      normalizarBusqueda(direccionCliente).includes(qNorm) ||
      Boolean(mov.nombreProducto && normalizarBusqueda(mov.nombreProducto).includes(qNorm)) ||
      Boolean(mov.descripcion && normalizarBusqueda(mov.descripcion).includes(qNorm)) ||
      detallesMatch;

    if (busquedaHistorial && !matchBusqueda) return false;
    const esSepareMov = Boolean((mov as any).idSepareOrigen || (mov as any).separeId) || 
                        mov.tipo === 'entrega_separe' || 
                        mov.subtipo?.includes('separe') || 
                        Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes('separe'));

    if (filtroTipoHistorial === 'separe') {
      if (!esSepareMov) return false;
    } else if (filtroTipoHistorial === 'abono') {
      if (mov.tipo !== 'abono' || (mov.monto === 0 && (mov as any).subtipo === 'apertura_separe_sin_abono')) return false;
    } else if (filtroTipoHistorial !== 'todos' && mov.tipo !== filtroTipoHistorial) {
      return false;
    }

    // Filtro desplegable por vendedor (Admin o usuario con permisos)
    if (filtroVendedorHistorial !== 'todos') {
      const matchVendedor = vendedorMov.trim().toLowerCase() === filtroVendedorHistorial.trim().toLowerCase();
      if (!matchVendedor) return false;
    }

    // Regla de privacidad para ventas/abonos/fiados: Colaborador solo ve sus propios movimientos
    const esColaborador = datosSesion?.rol === 'cajero' || datosSesion?.tipoUsuario === 'colaborador';
    if (esColaborador && mov.tipo !== 'ingreso_inventario') {
      const nombreActual = (datosSesion?.nombreUsuario || '').trim().toLowerCase();
      const regPor = (mov.registradoPor || '').trim().toLowerCase();
      const vend = ((mov as any).vendedor || '').trim().toLowerCase();
      const creador = (mov as any).creadoPor || '';
      const matchUsuario = (nombreActual && (regPor === nombreActual || vend === nombreActual)) ||
                           (datosSesion?.uid && creador === datosSesion.uid);
      if (!matchUsuario) return false;
    }

    const ms = mov.fecha?.toMillis ? mov.fecha.toMillis() : (mov.fecha ? new Date(mov.fecha).getTime() : 0);
    const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
    const inicioSemana = inicioSemanaDate.getTime();
    const inicioMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1).getTime();

    if (filtroForzado === 'hoy') return ms >= inicioHoy;
    if (filtroForzado === 'semana') return ms >= inicioSemana;
    if (filtroForzado === 'mes') return ms >= inicioMes;
    return true; 
  });

  // Determinar con precisión si realmente puede haber más registros para el filtro activo:
  const puedeHaberMasParaFiltro = (() => {
    if (!hayMasMovimientos || todosMovimientos.length === 0) return false;
    
    const filtroForzado = (!puedeVerReportes || planActual === 'basico') ? 'hoy' : filtroTiempoHistorial;

    const ultimoCargado = todosMovimientos[todosMovimientos.length - 1];
    const msUltimoCargado = ultimoCargado?.fecha?.toMillis 
      ? ultimoCargado.fecha.toMillis() 
      : (ultimoCargado?.fecha ? new Date(ultimoCargado.fecha).getTime() : 0);

    const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
    const inicioSemana = inicioSemanaDate.getTime();
    const inicioMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1).getTime();

    // Como los movimientos vienen ordenados descendentemente (los más recientes primero):
    // Si se está filtrando por "hoy" y el lote actual ya alcanzó fechas anteriores a hoy,
    // es imposible que en lotes siguientes haya más movimientos de hoy.
    if (filtroForzado === 'hoy' && msUltimoCargado < inicioHoy) {
      return false;
    }

    if (filtroForzado === 'semana' && msUltimoCargado < inicioSemana) {
      return false;
    }

    if (filtroForzado === 'mes' && msUltimoCargado < inicioMes) {
      return false;
    }

    return true;
  })();

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden h-full">
      <div className="bg-slate-50 dark:bg-[#0f172a] p-4 md:py-3 md:px-5 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-3 md:gap-2.5 sticky top-0 z-10 shrink-0">
        
        {/* FILA SUPERIOR: BUSCADOR, SELECTOR DE VENDEDOR Y SELECTOR DE TIEMPO */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 sm:gap-3 w-full">
          {/* BUSCADOR */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <input 
              type="text" 
              value={busquedaHistorial} 
              onChange={(e) => setBusquedaHistorial(e.target.value)} 
              placeholder="Buscar por cliente, notas, celular, vendedor o producto..." 
              className="w-full py-2.5 md:py-2 pl-10 pr-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 text-sm transition-all shadow-xs dark:text-slate-200 placeholder:text-xs sm:placeholder:text-sm placeholder:text-slate-400" 
            />
          </div>

          {/* FILTRO DESPLEGABLE POR VENDEDOR (VISIBLE SI HAY VENDEDORES Y ES ADMIN) */}
          {esAdmin && listaVendedores.length > 0 && (
            <div className="relative flex items-center shrink-0">
              <div className="absolute left-2.5 pointer-events-none text-slate-400">
                <User size={13} />
              </div>
              <select
                value={filtroVendedorHistorial}
                onChange={(e) => setFiltroVendedorHistorial(e.target.value)}
                className="py-2.5 md:py-2 pl-7 pr-7 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl outline-none focus:border-blue-500 shadow-xs cursor-pointer appearance-none"
                title="Filtrar por vendedor o cajero"
              >
                <option value="todos">Todos los vendedores</option>
                {listaVendedores.map((vendedor) => (
                  <option key={vendedor} value={vendedor}>
                    {vendedor}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 pointer-events-none text-slate-400">
                <ChevronDown size={13} />
              </div>
            </div>
          )}

          {/* FILTRO DE TIEMPO (EN LA MISMA FILA EN PC) */}
          {puedeVerReportes && (
            <div className="flex bg-slate-200/60 dark:bg-[#020617] p-1 rounded-xl shrink-0">
              {['hoy', 'semana', 'mes', 'todos'].map((filtro) => (
                <button key={filtro} 
                  onClick={() => {
                    if (planActual === 'basico' && filtro !== 'hoy') setModalSuscripcion({ visible: true, titulo: "Función PRO", mensaje: "Los filtros históricos avanzados están disponibles en el plan PRO." });
                    else setFiltroTiempoHistorial(filtro as any);
                  }}
                  className={`px-3 md:px-3.5 py-1.5 md:py-1 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${filtroTiempoHistorial === filtro ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                  {filtro}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* FILA INFERIOR: FILTRO DE TIPOS */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
          {(puedeGestionarInventario ? ['todos', 'venta', 'abono', 'separe', 'fiado', 'devolucion', 'ingreso_inventario'] : ['todos', 'venta', 'abono', 'separe', 'fiado', 'devolucion']).map((tipo) => (
            <button 
              key={tipo} 
              onClick={() => setFiltroTipoHistorial(tipo as any)} 
              className={`flex-1 md:flex-initial text-[11px] sm:text-xs font-black py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                filtroTipoHistorial === tipo 
                  ? (tipo === 'ingreso_inventario' 
                      ? 'bg-sky-600 text-white shadow-xs' 
                      : (tipo === 'devolucion'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs')) 
                  : 'bg-white dark:bg-[#020617] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80'
              }`}
            >
              {tipo === 'ingreso_inventario' ? (
                <span className="inline-flex items-center gap-1"><Package size={11} /> INVENTARIO</span>
              ) : tipo === 'devolucion' ? (
                <span className="inline-flex items-center gap-1"><RotateCcw size={11} /> DEVOLUCIÓN</span>
              ) : (
                tipo.toUpperCase()
              )}
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-3 overflow-y-auto scroll-smooth flex-1" ref={scrollHistorialRef}>
        
        {/* VISTA MÓVIL */}
        <div className="md:hidden">
          {historialFiltrado.map((mov) => {
            const esIngresoInv = mov.tipo === 'ingreso_inventario';
            const esSepare = Boolean((mov as any).idSepareOrigen || (mov as any).separeId) || 
                             mov.tipo === 'entrega_separe' || 
                             mov.subtipo?.includes('separe') || 
                             Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes('separe'));
            const esAbonoSepare = (mov.tipo === 'abono' && esSepare) || mov.subtipo === 'abono_inicial_separe';
            const esEntregaSepare = mov.tipo === 'entrega_separe';

            return (
              <div 
                key={mov.id} 
                onClick={() => {
                  if (esIngresoInv) {
                    setMovimientoInventarioDetalle(mov);
                    return;
                  }
                  abrirHistorialCliente(mov.clienteId, mov);
                }} 
                className="p-5 mx-2 my-3 rounded-2xl flex flex-col gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/60 shadow-sm relative cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors active:scale-[0.98]"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  esIngresoInv ? 'bg-sky-500' :
                  mov.tipo === 'devolucion' ? 'bg-amber-500' :
                  esEntregaSepare ? 'bg-purple-600' :
                  esSepare ? 'bg-violet-600' :
                  mov.tipo === 'fiado' ? 'bg-rose-500' : 
                  (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')
                }`}></div>
                <div className="flex justify-between items-start gap-3 pl-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    {esIngresoInv ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 text-[10px] font-black shrink-0 inline-flex items-center gap-1">
                          <Package size={11} /> INVENTARIO
                        </span>
                        <p className="font-bold text-base text-slate-900 dark:text-slate-200 truncate">
                          {mov.nombreProducto || 'Recepción de Mercancía'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-lg text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId, mov.tipo, mov.clienteNombre)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                      </>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-2 text-[10px] font-bold uppercase">
                      {mov.registradoPor && (
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap inline-flex items-center gap-1">
                          <User size={10} className="text-slate-400" />
                          <span>{esIngresoInv ? `Inventariado: ${mov.registradoPor}` : mov.registradoPor}</span>
                        </span>
                      )}
                      {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                      <span className="text-slate-400 whitespace-nowrap">
                        {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {!esIngresoInv && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirTicketDeMovimiento(mov);
                          }}
                          title="Imprimir Factura"
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                      {(mov.tipo === 'venta' || mov.tipo === 'fiado') && mov.detalles && mov.detalles.length > 0 && puedeHacerDevolucion && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalDevolucion({ isOpen: true, venta: mov });
                          }}
                          title="Hacer Devolución"
                          className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                        >
                          <RotateCcw size={15} />
                        </button>
                      )}
                      {mov.tipo === 'devolucion' && mov.errorNotaCredito && !mov.notaCreditoElectronica && puedeHacerDevolucion && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            reintentarNotaCredito(mov);
                          }}
                          title={`Nota Crédito DIAN pendiente: ${mov.errorNotaCredito}`}
                          className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[10px] font-black transition-colors cursor-pointer"
                        >
                          Reintentar NC
                        </button>
                      )}
                      {esIngresoInv ? (
                        <span className="font-black text-sm text-sky-600 dark:text-sky-400 px-2 py-1 bg-sky-50 dark:bg-sky-950/40 rounded-xl">
                          +{mov.cantidadAgregada || 1} un.
                        </span>
                      ) : (
                        <p className={`font-black text-xl text-right ${
                          mov.tipo === 'devolucion' || mov.tipo === 'egreso' ? 'text-amber-600 dark:text-amber-400' :
                          esEntregaSepare ? 'text-purple-600 dark:text-purple-400' :
                          esSepare ? 'text-violet-600 dark:text-violet-400' :
                          mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')
                        }`}>
                          {esEntregaSepare ? 'Entregado' : (mov.subtipo === 'apertura_separe_sin_abono' || (mov.monto === 0 && esSepare) ? 'Reservado ($0)' : `${mov.tipo === 'fiado' || mov.tipo === 'egreso' || mov.tipo === 'devolucion' ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}`)}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      esIngresoInv ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' :
                      mov.tipo === 'devolucion' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                      mov.tipo === 'egreso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' :
                      esEntregaSepare ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                      esSepare ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' :
                      mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 
                      (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')
                    }`}>
                      {esIngresoInv ? '+STOCK' : (mov.tipo === 'devolucion' ? '↩ DEVOLUCIÓN' : (esEntregaSepare ? '📦 SEPARE ENTREGADO' : (esSepare ? (mov.subtipo === 'abono_inicial_separe' ? '🔖 SEPARE INICIAL' : (mov.subtipo === 'apertura_separe_sin_abono' || mov.monto === 0 ? '🔖 NUEVO SEPARE' : '🔖 ABONO SEPARE')) : (mov.tipo === 'abono' ? 'ABONO CUENTA' : mov.tipo))))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* VISTA ESCRITORIO */}
        <TablaHistorial 
          movimientos={historialFiltrado} 
          getNombreCliente={getNombreCliente} 
          onRowClick={(cliId) => abrirHistorialCliente(cliId)}
          onMovimientoClick={(mov) => {
            if (mov.tipo === 'ingreso_inventario') {
              setMovimientoInventarioDetalle(mov);
            } else if (mov.clienteId === 'mostrador') {
              setMovimientoMostrador(mov);
              setModalMostrador(true);
            } else {
              abrirHistorialCliente(mov.clienteId, mov);
            }
          }}
          onImprimir={abrirTicketDeMovimiento}
          onDevolucion={(mov) => setModalDevolucion({ isOpen: true, venta: mov })}
          puedeHacerDevolucion={puedeHacerDevolucion}
          onReintentarNC={puedeHacerDevolucion ? reintentarNotaCredito : undefined}
        />

        {puedeHaberMasParaFiltro && (
          <div className="p-5 text-center">
            <button
              type="button"
              onClick={cargarMasMovimientos}
              disabled={cargandoMas}
              className="px-6 py-2.5 bg-white dark:bg-[#0f172a] hover:bg-blue-50/50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-500/50 transition-all text-xs sm:text-sm disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
            >
              {cargandoMas ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cargando más movimientos...</span>
                </>
              ) : (
                <span>Cargar más movimientos (+15) ↓</span>
              )}
            </button>
          </div>
        )}

        {historialFiltrado.length === 0 && (
          <div className="p-10 text-center text-slate-400">No hay registros para mostrar.</div>
        )}
      </div>

      {/* MODAL DEL PERFIL DEL CLIENTE CLICKEADO (ESCRITORIO DIVIDIDO) */}
      {clienteActivo && mounted && createPortal(
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 z-[99999] overflow-hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] md:rounded-[2.5rem] w-full h-[96vh] md:h-[90vh] md:max-w-7xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-100 dark:border-slate-800/60 animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300">
            
            {/* PANEL IZQUIERDO: DIRECTORIO (SOLO ESCRITORIO) */}
            <div className="hidden md:flex w-5/12 flex-col border-r border-slate-100 dark:border-slate-800 h-full bg-slate-50/50 dark:bg-[#020617]/50">
              <div className="bg-blue-600 dark:bg-blue-900 p-6 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2"><Users size={26}/> Directorio de Clientes</h2>
                <button onClick={() => setClienteActivo(null)} className="text-blue-200 hover:text-white transition-colors bg-blue-700/50 p-2 rounded-full"><X size={24}/></button>
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
                          abrirHistorialCliente(directorioFiltrado[0].id);
                        }
                      }
                    }}
                    placeholder="Buscar por nombre, celular, apodo o notas..."
                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {directorioFiltrado.map(c => (
                  <div key={c.id} onClick={() => abrirHistorialCliente(c.id)} className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${clienteActivo?.id === c.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/50 shadow-sm' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/80 hover:border-blue-300'}`}>
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{c.nombre}</p>
                        {c.notas && (
                          <span className="text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 px-1.5 py-0.5 rounded-md">
                            {c.notas}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.celular || "Sin celular"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {(c.deudaTotal || 0) < 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-black px-1.5 py-0.5 rounded mr-1">A favor</span>}
                      <span className={`font-black text-lg tracking-tight ${c.deudaTotal === 0 ? 'text-slate-400' : ((c.deudaTotal || 0) < 0 ? 'text-emerald-500 dark:text-emerald-400 font-black' : 'text-rose-500')}`}>
                        {c.deudaTotal === 0 ? '$0' : `$${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}`}
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
            </div>

            {/* PANEL DERECHO: PERFIL DEL CLIENTE */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0f172a] overflow-hidden">
              
              {/* HEADER ESCRITORIO */}
              <div className="hidden md:flex p-6 bg-slate-900 text-white justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-2xl font-black">{clienteActivo.nombre}</h3>
                      {clienteActivo.notas && (
                        <span className="text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                          {clienteActivo.notas}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-slate-400 text-sm">{clienteActivo.celular || "Sin celular registrado"}</p>
                      {clienteActivo.celular && puedeEnviarWhatsApp && (
                        <button
                          type="button"
                          onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)}
                          title="Enviar WhatsApp al cliente"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-[11px] transition cursor-pointer border border-emerald-500/30 active:scale-95"
                        >
                          <MessageCircle size={12} className="text-[#25D366] fill-[#25D366]/30" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {datosSesion?.rol !== 'cajero' && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                        title="Modificar Cliente"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/80 text-slate-300 hover:text-white transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                        title="Eliminar Cliente"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {(() => {
                  const saldoSeparesActivos = separesCliente
                    .filter(s => s.estado === 'activo')
                    .reduce((acc, s) => acc + (s.saldoPendiente || 0), 0);
                  const totalCompromiso = (clienteActivo.deudaTotal || 0) + saldoSeparesActivos;

                  return (
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1 inline-block ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}>
                        {(clienteActivo.deudaTotal || 0) < 0 ? ' Saldo a favor' : (totalCompromiso === 0 ? 'Cuenta al Día' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                      </span>
                      <span className={`text-3xl font-black block ${totalCompromiso === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                        ${Math.abs(totalCompromiso).toLocaleString('es-CO')}
                      </span>
                    </div>
                  );
                })()}
              </div>

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
                  ) : separesCliente.some((s: any) => s.estado === 'activo') ? (
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
                {/* Botón cerrar en esquina superior derecha */}
                <button 
                  onClick={() => setClienteActivo(null)} 
                  className="absolute top-3 right-3 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer z-10"
                  aria-label="Cerrar perfil"
                >
                  <X size={18} />
                </button>

                {/* Fila 1: Nombre del cliente centrado + badge distinguido + opciones de edición */}
                <div className="pt-1 px-6 text-center">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full mb-1">
                    <User size={11} className="shrink-0" /> CLIENTE
                  </span>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h2 className="text-[26px] sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words">
                      {clienteActivo.nombre}
                    </h2>
                    {clienteActivo.notas && (
                      <span className="text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-lg">
                        {clienteActivo.notas}
                      </span>
                    )}
                    {datosSesion?.rol !== 'cajero' && (
                      <div className="inline-flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                          title="Modificar Cliente"
                          className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                          title="Eliminar Cliente"
                          className="p-1 rounded-lg bg-white dark:bg-slate-800 text-slate-500 hover:text-rose-600 shadow-xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mt-1">
                    {clienteActivo.celular ? (
                      <span className="inline-flex items-center gap-1">
                        <Smartphone size={12} className="text-slate-400 shrink-0" />
                        <span>{clienteActivo.celular}</span>
                      </span>
                    ) : (
                      "Sin celular registrado"
                    )}
                  </p>
                </div>

                {/* Fila 2: Saldo Destacado en tarjeta compacta */}
                {(() => {
                  const saldoSeparesActivos = separesCliente
                    .filter(s => s.estado === 'activo')
                    .reduce((acc, s) => acc + (s.saldoPendiente || 0), 0);
                  const totalCompromiso = (clienteActivo.deudaTotal || 0) + saldoSeparesActivos;

                  return (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-xs">
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-wider block ${
                          (clienteActivo.deudaTotal || 0) < 0 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : (totalCompromiso === 0 ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400')
                        }`}>
                          {(clienteActivo.deudaTotal || 0) < 0 ? 'Saldo a Favor' : (totalCompromiso === 0 ? 'Estado' : (saldoSeparesActivos > 0 ? 'Saldo Total Pendiente' : 'Saldo Actual'))}
                        </span>
                        {saldoSeparesActivos > 0 && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
                            <span>Fiados: ${(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</span>
                            <span>•</span>
                            <span className="text-violet-600 dark:text-violet-400">Separes: ${saldoSeparesActivos.toLocaleString('es-CO')}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-xl font-black ${
                          totalCompromiso === 0 
                            ? 'text-slate-400' 
                            : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')
                        }`}>
                          {totalCompromiso === 0 ? 'Al Día' : `$${Math.abs(totalCompromiso).toLocaleString('es-CO')}`}
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
                  ) : separesCliente.some((s: any) => s.estado === 'activo') ? (
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
                {/* SECCIÓN DE PLANES SEPARE DEL CLIENTE */}
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

                {(clienteActivo.notas || clienteActivo.direccion) && (
                  <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl flex items-start gap-3">
                    <User size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1 min-w-0">
                      {clienteActivo.notas && (
                        <div>
                          <span className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[10px] block">Notas / Referencias / Apodo</span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{clienteActivo.notas}</p>
                        </div>
                      )}
                      {clienteActivo.direccion && (
                        <div>
                          <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block">Dirección</span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium">{clienteActivo.direccion}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Clock size={16}/> Historial Completo</h4>
                {movimientosCliente.map(mov => {
                  const esSepare = Boolean((mov as any).idSepareOrigen || (mov as any).separeId) || 
                                   mov.tipo === 'entrega_separe' || 
                                   mov.subtipo?.includes('separe') || 
                                   Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes('separe'));
                  const esAbonoSepare = (mov.tipo === 'abono' && esSepare) || mov.subtipo === 'abono_inicial_separe';
                  const esEntregaSepare = mov.tipo === 'entrega_separe';

                  return (
                  <div key={mov.id} className="p-4 md:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2 md:space-y-3">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      mov.tipo === 'devolucion' ? 'bg-amber-500' :
                      esEntregaSepare ? 'bg-purple-600' :
                      esSepare ? 'bg-violet-600' :
                      mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')
                    }`}></div>
                    
                    <div className="pl-1 md:pl-2">
                      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-1.5 pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                        <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg shrink-0 inline-flex items-center gap-1 ${
                          mov.tipo === 'devolucion' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
                          esEntregaSepare ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                          esSepare ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' :
                          mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 
                          (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')
                        }`}>
                          {mov.tipo === 'devolucion' ? (
                            <>
                              <RotateCcw size={11} className="shrink-0" />
                              <span>DEVOLUCIÓN</span>
                            </>
                          ) : esEntregaSepare ? (
                            '📦 SEPARE ENTREGADO'
                          ) : esSepare ? (
                            mov.subtipo === 'abono_inicial_separe' ? '🔖 SEPARE INICIAL' :
                            (mov.subtipo === 'apertura_separe_sin_abono' || mov.monto === 0 ? '🔖 NUEVO SEPARE' : '🔖 ABONO SEPARE')
                          ) : mov.tipo === 'abono' ? (
                            'ABONO CUENTA'
                          ) : (
                            mov.tipo
                          )}
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] md:text-[11px] font-bold uppercase">
                          {mov.registradoPor && (
                            <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap inline-flex items-center gap-1">
                              <User size={10} className="text-slate-400" />
                              <span>{mov.registradoPor}</span>
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
                                {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} font-black mr-1 md:mr-1.5`}>{d.cantidad}x</strong>}
                                {d.descripcion}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">${d.valor.toLocaleString('es-CO')}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{mov.descripcion}</p>
                      )}
                      
                      <div className="flex justify-between items-center pt-2 mt-1 md:mt-0 md:pt-3 border-t border-slate-200 dark:border-slate-700 md:border-slate-100 dark:md:border-slate-800 font-black">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Total:</span>
                        <div className="flex items-center gap-2">
                          {(mov.tipo === 'venta' || mov.tipo === 'fiado') && mov.detalles && mov.detalles.length > 0 && (datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.hacerDevoluciones) && (
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
                            onClick={() => abrirTicketDeMovimiento(mov)}
                            title="Imprimir Factura"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <span className={`text-base md:text-xl font-black ${
                            mov.tipo === 'devolucion' || mov.tipo === 'egreso' ? 'text-amber-600 dark:text-amber-400' :
                            esEntregaSepare ? 'text-purple-600 dark:text-purple-400' :
                            esSepare ? 'text-violet-600 dark:text-violet-400' :
                            mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')
                          }`}>
                            {esEntregaSepare ? 'Entregado' : (mov.subtipo === 'apertura_separe_sin_abono' || (mov.monto === 0 && esSepare) ? 'Reservado ($0)' : `${mov.tipo === 'fiado' || mov.tipo === 'egreso' || mov.tipo === 'devolucion' ? '-' : '+'}${Math.round(mov.monto || 0).toLocaleString('es-CO')}`)}
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
            
          </div>
        </div>,
        document.body
      )}

      {/* MODAL INFORMATIVO / ACCIÓN "VENTA DE MOSTRADOR" */}
      {modalMostrador && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[800] animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800/60">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Store size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Consumidor Final</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Venta directa a Consumidor Final (Mostrador). No genera deudas ni saldos pendientes con ningún cliente.
            </p>

            <div className="flex flex-col gap-2.5">
              {movimientoMostrador && (movimientoMostrador.tipo === 'venta' || movimientoMostrador.tipo === 'fiado') && movimientoMostrador.detalles && movimientoMostrador.detalles.length > 0 && puedeHacerDevolucion && (
                <button 
                  type="button"
                  onClick={() => {
                    const v = movimientoMostrador;
                    setModalMostrador(false);
                    setModalDevolucion({ isOpen: true, venta: v });
                  }} 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <RotateCcw size={16} /> Hacer Devolución
                </button>
              )}

              {movimientoMostrador && (
                <button 
                  type="button"
                  onClick={() => {
                    const v = movimientoMostrador;
                    setModalMostrador(false);
                    abrirTicketDeMovimiento(v);
                  }} 
                  className="w-full bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold py-3 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 border border-blue-200 dark:border-blue-800/50 cursor-pointer"
                >
                  <Printer size={16} /> Ver Factura
                </button>
              )}

              <button 
                type="button"
                onClick={() => {
                  setModalMostrador(false);
                  setMovimientoMostrador(null);
                }} 
                className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors text-sm border dark:border-slate-800/60 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUSCRIPCIÓN */}
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
      />

      {/* MODAL DE DEVOLUCION */}
      {modalDevolucion.isOpen && modalDevolucion.venta && (
        <ModalProcesarDevolucion
          isOpen={modalDevolucion.isOpen}
          onClose={() => setModalDevolucion({ isOpen: false, venta: null })}
          ventaOrigen={modalDevolucion.venta}
          onSuccess={() => {
            if (cuentaPrincipalId) cargarDatosHistorial(cuentaPrincipalId);
          }}
        />
      )}

      {/* MODAL DE MODIFICAR / ELIMINAR CLIENTE */}
      <ModalGestionCliente
        isOpen={modalGestionCliente.visible}
        modo={modalGestionCliente.modo}
        cliente={modalGestionCliente.cliente}
        onClose={() => setModalGestionCliente({ visible: false, modo: 'editar', cliente: null })}
        onSuccess={handleGestionClienteSuccess}
      />

      {/* MODAL DETALLE DE INGRESO DE INVENTARIO */}
      {movimientoInventarioDetalle && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setMovimientoInventarioDetalle(null); }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[900] animate-in zoom-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-left border border-slate-100 dark:border-slate-800/60 relative"
          >
            <button 
              onClick={() => setMovimientoInventarioDetalle(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs shrink-0">
                <Package size={26} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                  <Package size={11} /> Entrada de Mercancía
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5 truncate">
                  Detalle de Recepción
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {/* Tarjeta de Producto y Unidades */}
              <div className="p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200/70 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Producto Ingresado
                </span>
                <p className="font-black text-slate-900 dark:text-white text-lg leading-snug">
                  {movimientoInventarioDetalle.nombreProducto || 'Producto sin nombre'}
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-black text-xs px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    +{movimientoInventarioDetalle.cantidadAgregada || 1} unidades añadidas
                  </span>
                  {movimientoInventarioDetalle.monto > 0 && (
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      Costo: ${movimientoInventarioDetalle.monto.toLocaleString('es-CO')}
                    </span>
                  )}
                </div>
              </div>

              {/* Registro y Auditoría */}
              <div className="p-3.5 bg-sky-50/50 dark:bg-sky-950/20 rounded-2xl border border-sky-100 dark:border-sky-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                {movimientoInventarioDetalle.registradoPor && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold">Inventariado por:</span>
                    <span className="font-black text-sky-700 dark:text-sky-300 inline-flex items-center gap-1">
                      <User size={12} className="text-sky-600" />
                      <span>{movimientoInventarioDetalle.registradoPor}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Fecha y Hora:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    <span>
                      {movimientoInventarioDetalle.fecha?.toDate ? movimientoInventarioDetalle.fecha.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (movimientoInventarioDetalle.fecha instanceof Date ? movimientoInventarioDetalle.fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Hoy')}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setMovimientoInventarioDetalle(null)}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black rounded-xl text-sm transition cursor-pointer text-center"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}