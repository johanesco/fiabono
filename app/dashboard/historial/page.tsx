"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, X, Clock, MessageCircle, Star, Users, Store, Printer, Edit3, Trash2, Bookmark, ChevronRight, Package, ArrowRight, User } from 'lucide-react';
import toast from "react-hot-toast";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";
import TablaHistorial from "../../../components/TablaHistorial";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalGestionCliente from "@/components/ModalGestionCliente";

export default function HistorialPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { datosSesion } = useAuth();
  const router = useRouter();
  
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;
  const puedeSepare = datosSesion?.puedeSepare;
  const esAdmin = datosSesion?.rol !== 'cajero';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroTiempoHistorial, setFiltroTiempoHistorial] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState<'todos' | 'venta' | 'abono' | 'fiado' | 'ingreso_inventario'>('todos');
  const [filtroVendedorHistorial, setFiltroVendedorHistorial] = useState<string>('todos');
  
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

  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<Movimiento[]>([]);
  const [separesCliente, setSeparesCliente] = useState<any[]>([]);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");

  const scrollHistorialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarDatosHistorial(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  const cargarDatosHistorial = async (uid: string) => {
    try {
      const listaC = await API_DB.obtenerClientes(uid);
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);
      
      const resPaginada = await API_DB.obtenerMovimientosPaginados(uid, 30);
      setTodosMovimientos(resPaginada.movimientos);
      setUltimoDocSnapshot(resPaginada.ultimoDoc);
      setHayMasMovimientos(resPaginada.hayMas);
      
      if (clienteActivo) {
         try {
           const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteActivo.id));
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
      const res = await API_DB.obtenerMovimientosPaginados(cuentaPrincipalId, 30, ultimoDocSnapshot);
      setTodosMovimientos(prev => [...prev, ...res.movimientos]);
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
    const nombreCli = mov.clienteId === 'mostrador' ? 'Venta de Mostrador' : (clienteEncontrado?.nombre || 'Cliente');
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
      porcentajeIva: mov.porcentajeIva
    };

    setModalTicketFactura({ visible: true, datos: datosTicket });
  };

  const getNombreCliente = (id?: string, tipo?: string) => {
    if (tipo === 'ingreso_inventario') return 'Entrada de Mercancía';
    if (!id) return 'Entrada de Stock';
    if (id === 'mostrador') return 'Venta de Mostrador';
    return clientes.find(c => c.id === id)?.nombre || "Cliente Eliminado";
  };

  const abrirHistorialCliente = async (clienteId?: string) => {
    if (!clienteId) return;
    if (clienteId === 'mostrador') {
      setModalMostrador(true);
      return;
    }
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      setClienteActivo(cliente);
      try {
        const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
        const snapM = await getDocs(qM);
        const movs: any[] = [];
        snapM.forEach(doc => movs.push({ id: doc.id, ...doc.data() }));
        movs.sort((a, b) => {
          const tA = (a.fecha as any)?.toMillis ? (a.fecha as any).toMillis() : (a.fecha ? new Date(a.fecha as any).getTime() : 0);
          const tB = (b.fecha as any)?.toMillis ? (b.fecha as any).toMillis() : (b.fecha ? new Date(b.fecha as any).getTime() : 0);
          return tB - tA;
        });
        setMovimientosCliente(movs);
      } catch (e) {
        console.error("Error cargando historial de movimientos del cliente:", e);
      }

      // Cargar separes asociados a este cliente
      try {
        const qS = query(collection(db, "separes"), where("clienteId", "==", clienteId));
        const snapS = await getDocs(qS);
        const listaS: any[] = [];
        snapS.forEach(doc => listaS.push({ id: doc.id, ...doc.data() }));
        listaS.sort((a, b) => ((b.fechaCreacion as any)?.toMillis ? (b.fechaCreacion as any).toMillis() : 0) - ((a.fechaCreacion as any)?.toMillis ? (a.fechaCreacion as any).toMillis() : 0));
        setSeparesCliente(listaS);
      } catch (e) {
        console.error("Error cargando separes del cliente en historial:", e);
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
    const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;
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

      if ((cliente.deudaTotal || 0) === 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Tu cuenta se encuentra al día.

Gracias por seguir con nosotros.

*¡Que tengas un gran día!*`;
      } else if ((cliente.deudaTotal || 0) < 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente tienes un saldo a favor de: *${saldoFormat}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      }
    } else if (tipo === 'comprobante') {
      const nombreDestino = cliente.id === 'mostrador' || !cliente.nombre ? 'Cliente' : cliente.nombre;
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

    return normalizarMensajeWhatsApp(texto);
  };

  const abrirWhatsApp = (texto: string, celular?: string) => {
    const mensajeLimpio = normalizarMensajeWhatsApp(texto);
    const celularLimpio = celular ? celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(mensajeLimpio)}` : `https://wa.me/?text=${encodeURIComponent(mensajeLimpio)}`;

    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  const directorioFiltrado = clientes.filter(c => 
    (c.nombre || "").toLowerCase().includes(busquedaDirectorio.toLowerCase()) ||
    (c.celular || "").toString().includes(busquedaDirectorio)
  );

  const hoyDate = new Date();
  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1; 
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum);

  // Permiso para gestionar y consultar ingresos de inventario
  const puedeGestionarInventario = esAdmin || Boolean(datosSesion?.permisos?.editarInventario || datosSesion?.permisos?.ingresoInventario);

  // Lista de vendedores únicos presentes en los movimientos
  const listaVendedores = Array.from(
    new Set(
      todosMovimientos
        .map(m => m.registradoPor || (m as any).vendedor)
        .filter((v): v is string => Boolean(v && typeof v === 'string' && v.trim().length > 0))
    )
  ).sort((a, b) => a.localeCompare(b));

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
      : (clienteMov?.nombre || (mov.clienteId === 'mostrador' ? 'Venta de Mostrador' : 'Cliente Eliminado'));
    const celularCliente = clienteMov?.celular || '';
    const vendedorMov = (mov.registradoPor || (mov as any).vendedor || '').toString();
    
    const matchBusqueda = 
      nombreCliente.toLowerCase().includes(busquedaHistorial.toLowerCase()) ||
      celularCliente.toString().includes(busquedaHistorial) ||
      vendedorMov.toLowerCase().includes(busquedaHistorial.toLowerCase()) ||
      Boolean(mov.nombreProducto && mov.nombreProducto.toLowerCase().includes(busquedaHistorial.toLowerCase())) ||
      Boolean(mov.descripcion && mov.descripcion.toLowerCase().includes(busquedaHistorial.toLowerCase()));

    if (busquedaHistorial && !matchBusqueda) return false;
    if (filtroTipoHistorial !== 'todos' && mov.tipo !== filtroTipoHistorial) return false;

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
              placeholder="Buscar por cliente, celular, vendedor o producto..." 
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
              <div className="absolute right-2.5 pointer-events-none text-slate-400 text-[10px]">
                ▼
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
          {(puedeGestionarInventario ? ['todos', 'venta', 'abono', 'fiado', 'ingreso_inventario'] : ['todos', 'venta', 'abono', 'fiado']).map((tipo) => (
            <button 
              key={tipo} 
              onClick={() => setFiltroTipoHistorial(tipo as any)} 
              className={`flex-1 md:flex-initial text-[11px] sm:text-xs font-black py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                filtroTipoHistorial === tipo 
                  ? (tipo === 'ingreso_inventario' ? 'bg-sky-600 text-white shadow-xs' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs') 
                  : 'bg-white dark:bg-[#020617] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80'
              }`}
            >
              {tipo === 'ingreso_inventario' ? '📦 INVENTARIO' : tipo.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      <div className="p-3 overflow-y-auto scroll-smooth flex-1" ref={scrollHistorialRef}>
        
        {/* VISTA MÓVIL */}
        <div className="md:hidden">
          {historialFiltrado.map((mov) => {
            const esIngresoInv = mov.tipo === 'ingreso_inventario';

            return (
              <div 
                key={mov.id} 
                onClick={() => {
                  if (esIngresoInv) {
                    setMovimientoInventarioDetalle(mov);
                    return;
                  }
                  abrirHistorialCliente(mov.clienteId);
                }} 
                className="p-5 mx-2 my-3 rounded-2xl flex flex-col gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/60 shadow-sm relative cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors active:scale-[0.98]"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  esIngresoInv ? 'bg-sky-500' :
                  mov.tipo === 'fiado' ? 'bg-rose-500' : 
                  (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')
                }`}></div>
                <div className="flex justify-between items-start gap-3 pl-2">
                  <div className="flex flex-col min-w-0 flex-1">
                    {esIngresoInv ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 text-[10px] font-black shrink-0">
                          📦 INVENTARIO
                        </span>
                        <p className="font-bold text-base text-slate-900 dark:text-slate-200 truncate">
                          {mov.nombreProducto || 'Recepción de Mercancía'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-lg text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId, mov.tipo)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                      </>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-2 text-[10px] font-bold uppercase">
                      {mov.registradoPor && (
                        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          👤 {esIngresoInv ? `Inventariado: ${mov.registradoPor}` : mov.registradoPor}
                        </span>
                      )}
                      {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                      <span className="text-slate-400 whitespace-nowrap">
                        {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-2">
                      {!esIngresoInv && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirTicketDeMovimiento(mov);
                          }}
                          title="Imprimir Factura / Ticket"
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          <Printer size={15} />
                        </button>
                      )}
                      {esIngresoInv ? (
                        <span className="font-black text-sm text-sky-600 dark:text-sky-400 px-2 py-1 bg-sky-50 dark:bg-sky-950/40 rounded-xl">
                          +{mov.cantidadAgregada || 1} un.
                        </span>
                      ) : (
                        <p className={`font-black text-xl text-right ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                          {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      esIngresoInv ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' :
                      mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 
                      (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')
                    }`}>
                      {esIngresoInv ? '+STOCK' : mov.tipo}
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
          onRowClick={abrirHistorialCliente}
          onMovimientoClick={(mov) => {
            if (mov.tipo === 'ingreso_inventario') {
              setMovimientoInventarioDetalle(mov);
            } else {
              abrirHistorialCliente(mov.clienteId);
            }
          }}
          onImprimir={abrirTicketDeMovimiento}
        />

        {hayMasMovimientos && (
          <div className="p-6 text-center">
            <button
              type="button"
              onClick={cargarMasMovimientos}
              disabled={cargandoMas}
              className="px-6 py-3.5 bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 font-black rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all text-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              {cargandoMas ? "Cargando más movimientos..." : "Cargar más movimientos ⟳"}
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
                    placeholder="Buscar nombre o celular en el directorio..."
                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {directorioFiltrado.map(c => (
                  <div key={c.id} onClick={() => abrirHistorialCliente(c.id)} className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${clienteActivo?.id === c.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/50 shadow-sm' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/80 hover:border-blue-300'}`}>
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{c.nombre}</p>
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
                    <h3 className="text-2xl font-black">{clienteActivo.nombre}</h3>
                    <p className="text-slate-400 text-sm">{clienteActivo.celular || "Sin celular registrado"}</p>
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

              {/* BARRA DE ACCIONES RÁPIDAS Y WHATSAPP (SOLO ESCRITORIO) */}
              <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} 
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                  >
                    Vender
                  </button>
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} 
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                  >
                    Fiar
                  </button>
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} 
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                  >
                    Abonar
                  </button>
                  {puedeSepare && (
                    <button 
                      type="button"
                      onClick={() => router.push(`/dashboard/separe?clienteId=${clienteActivo.id}`)} 
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Separe
                    </button>
                  )}
                </div>

                {clienteActivo.celular && datosSesion?.rol !== 'cajero' && (
                  <button 
                    type="button"
                    onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} 
                    className="py-2 px-3.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl border border-[#25D366]/40 transition active:scale-98 cursor-pointer flex items-center gap-2 text-xs shadow-xs"
                  >
                    <MessageCircle size={16} className="text-[#25D366] fill-[#25D366]/30" />
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
                    👤 CLIENTE
                  </span>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h2 className="text-[26px] sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-words">
                      {clienteActivo.nombre}
                    </h2>
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
                    {clienteActivo.celular ? `📱 ${clienteActivo.celular}` : "Sin celular registrado"}
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
                  {puedeSepare && (
                    <button 
                      onClick={() => router.push(`/dashboard/separe?clienteId=${clienteActivo.id}`)} 
                      className="flex-1 py-2 px-2 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl text-xs uppercase shadow-xs transition active:scale-95 cursor-pointer text-center"
                    >
                      Separe
                    </button>
                  )}
                </div>

                {/* Fila 4: Botón de WhatsApp con texto visible y claro */}
                {clienteActivo.celular && datosSesion?.rol !== 'cajero' && (
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

                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Clock size={16}/> Historial Completo</h4>
                {movimientosCliente.map(mov => (
                  <div key={mov.id} className="p-4 md:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2 md:space-y-3">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
                    
                    <div className="pl-1 md:pl-2">
                      <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-1.5 pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                        <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg shrink-0 ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')}`}>{mov.tipo}</span>
                        
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] md:text-[11px] font-bold uppercase">
                          {mov.registradoPor && (
                            <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              👤 {mov.registradoPor}
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
                          <button
                            type="button"
                            onClick={() => abrirTicketDeMovimiento(mov)}
                            title="Imprimir Factura / Ticket"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <span className={`text-base md:text-xl ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                            {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {movimientosCliente.length === 0 && <p className="text-center text-slate-400 py-10">Sin transacciones registradas.</p>}
              </div>
            </div>
            
          </div>
        </div>,
        document.body
      )}

      {/* MODAL INFORMATIVO "VENTA DE MOSTRADOR" */}
      {modalMostrador && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[800] animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800/60">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Store size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Venta de Mostrador</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              Este registro corresponde a una venta directa al público. <br/><br/>No está asociada a la cuenta de ningún cliente en específico, por lo que no genera deudas ni historial de perfil.
            </p>
            <button onClick={() => setModalMostrador(false)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-black py-4 rounded-2xl transition-colors text-lg border dark:border-slate-800/60">
              Entendido
            </button>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[900] animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-left border border-slate-100 dark:border-slate-800/60 relative">
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
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md inline-block">
                  📦 Entrada de Mercancía
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
                    <span className="font-black text-sky-700 dark:text-sky-300">👤 {movimientoInventarioDetalle.registradoPor}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Fecha y Hora:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    📅 {movimientoInventarioDetalle.fecha?.toDate ? movimientoInventarioDetalle.fecha.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (movimientoInventarioDetalle.fecha instanceof Date ? movimientoInventarioDetalle.fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Hoy')}
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