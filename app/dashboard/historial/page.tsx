"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, X, Clock, MessageCircle, Star, Users, Store } from 'lucide-react';
import toast from "react-hot-toast";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";
import TablaHistorial from "../../../components/TablaHistorial";

export default function HistorialPage() {
  const { datosSesion } = useAuth();
  const router = useRouter(); // Agregado para la navegación
  
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroTiempoHistorial, setFiltroTiempoHistorial] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState<'todos' | 'venta' | 'abono' | 'fiado'>('todos');
  
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [modalMostrador, setModalMostrador] = useState(false);

  const [clienteActivo, setClienteActivo] = useState<Cliente | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<Movimiento[]>([]);
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
      
      const listaM = await API_DB.obtenerMovimientos(uid);
      setTodosMovimientos(listaM);
      
      if (clienteActivo) {
         const movs = listaM.filter(m => m.clienteId === clienteActivo.id).sort((a, b) => {
           const tA = a.fecha?.toMillis() || 0;
           const tB = b.fecha?.toMillis() || 0;
           return tB - tA;
         });
         setMovimientosCliente(movs);
         
         const clienteActualizado = listaC.find(c => c.id === clienteActivo.id);
         if(clienteActualizado) setClienteActivo(clienteActualizado);
      }
    } catch (error) { 
      toast.error("Error al cargar el historial.");
    }
  };

  const getNombreCliente = (id: string) => {
    if (id === 'mostrador') return 'Venta de Mostrador';
    return clientes.find(c => c.id === id)?.nombre || "Cliente Eliminado";
  };

  const abrirHistorialCliente = (clienteId: string) => {
    if (clienteId === 'mostrador') {
      setModalMostrador(true);
      return;
    }
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      setClienteActivo(cliente);
      const movs = todosMovimientos.filter(m => m.clienteId === clienteId).sort((a, b) => {
        const tA = a.fecha?.toMillis() || 0;
        const tB = b.fecha?.toMillis() || 0;
        return tB - tA;
      });
      setMovimientosCliente(movs);
    } else {
      toast.error("El perfil del cliente ya no existe.");
    }
  };

  const generarTextoComprobante = (tipo: 'estado' | 'comprobante', cliente: any, accion?: 'fiado' | 'abono' | 'venta' | null, detallesArray?: any[], totalMov?: number) => {
    let texto = "";
    const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;

    if (tipo === 'estado') {
      texto = `¡Hola *${cliente.nombre}*! 👋 Somos *${nombreNegocio || 'tu tienda'}*.\n\n📊 *ESTADO DE TU CUENTA*\n`;
      if (cliente.deudaTotal === 0) texto += `Tu cuenta está totalmente al día ($0). ¡Gracias por tu confianza! ✨`;
      else if ((cliente.deudaTotal || 0) < 0) texto += `Tienes un *saldo a favor* de: *${saldoFormat}*. 🛍️`;
      else texto += `Tu saldo pendiente actual es de: *${saldoFormat}*.`;
    } 
    return texto;
  };

  const abrirWhatsApp = (texto: string, celular?: string) => {
    const celularLimpio = celular ? celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.location.href = url;
  };

  const directorioFiltrado = clientes.filter(c => 
    (c.nombre || "").toLowerCase().includes(busquedaDirectorio.toLowerCase()) ||
    (c.celular || "").toString().includes(busquedaDirectorio)
  );

  const hoyDate = new Date();
  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1; 
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum);

  const historialFiltrado = todosMovimientos.filter(mov => {
    const filtroForzado = (!puedeVerReportes || planActual === 'basico') ? 'hoy' : filtroTiempoHistorial;
    
    const clienteMov = clientes.find(c => c.id === mov.clienteId);
    const nombreCliente = clienteMov?.nombre || (mov.clienteId === 'mostrador' ? 'Venta de Mostrador' : 'Cliente Eliminado');
    const celularCliente = clienteMov?.celular || '';
    
    const matchBusqueda = 
      nombreCliente.toLowerCase().includes(busquedaHistorial.toLowerCase()) ||
      celularCliente.toString().includes(busquedaHistorial);

    if (busquedaHistorial && !matchBusqueda) return false;
    if (filtroTipoHistorial !== 'todos' && mov.tipo !== filtroTipoHistorial) return false;

    const ms = mov.fecha?.toMillis() || 0;
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
      <div className="bg-slate-50 dark:bg-[#0f172a] p-6 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-5 sticky top-0 z-10 shrink-0">
        
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
          <input type="text" value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} placeholder="Buscar nombre o celular en historial..." 
            className="w-full p-5 pl-14 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 text-lg transition-all shadow-sm dark:text-slate-200" />
        </div>
        
        <div className="flex flex-col gap-3">
          {puedeVerReportes && (
            <div className="flex bg-slate-200/50 dark:bg-[#020617] p-1.5 rounded-xl">
              {['hoy', 'semana', 'mes', 'todos'].map((filtro) => (
                <button key={filtro} 
                  onClick={() => {
                    if (planActual === 'basico' && filtro !== 'hoy') setModalSuscripcion({ visible: true, titulo: "Función PRO", mensaje: "Los filtros históricos avanzados están disponibles en el plan PRO." });
                    else setFiltroTiempoHistorial(filtro as any);
                  }}
                  className={`flex-1 text-sm font-bold py-3 rounded-lg capitalize transition-all ${filtroTiempoHistorial === filtro ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                  {filtro}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 w-full mt-1">
            {['todos', 'venta', 'abono', 'fiado'].map((tipo) => (
              <button key={tipo} onClick={() => setFiltroTipoHistorial(tipo as any)} className={`flex-1 text-xs sm:text-sm font-bold py-3 rounded-xl transition-all ${filtroTipoHistorial === tipo ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-[#020617] text-slate-500 border border-slate-200 dark:border-slate-800/80'}`}>
                {tipo.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-3 overflow-y-auto scroll-smooth flex-1" ref={scrollHistorialRef}>
        
        {/* VISTA MÓVIL */}
        <div className="md:hidden">
          {historialFiltrado.map((mov) => (
            <div 
              key={mov.id} 
              onClick={() => abrirHistorialCliente(mov.clienteId)} 
              className="p-5 mx-2 my-3 rounded-2xl flex flex-col gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/60 shadow-sm relative cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors active:scale-[0.98]"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
              <div className="flex justify-between items-start gap-3 pl-2">
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-bold text-lg text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                  
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-2 text-[10px] font-bold uppercase">
                    {mov.registradoPor && (
                      <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        👤 {mov.registradoPor}
                      </span>
                    )}
                    {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                    <span className="text-slate-400 whitespace-nowrap">
                      {mov.fecha?.toDate().toLocaleDateString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className={`font-black text-xl text-right ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                    {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                  </p>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}`}>{mov.tipo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* VISTA ESCRITORIO */}
        <TablaHistorial 
          movimientos={historialFiltrado} 
          getNombreCliente={getNombreCliente} 
          onRowClick={abrirHistorialCliente} 
        />

        {historialFiltrado.length === 0 && (
          <div className="p-10 text-center text-slate-400">No hay registros para mostrar.</div>
        )}
      </div>

      {/* MODAL DEL PERFIL DEL CLIENTE CLICKEADO (ESCRITORIO DIVIDIDO) */}
      {clienteActivo && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 z-[500] overflow-hidden">
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
                  <input type="text" value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)} placeholder="Buscar nombre o celular en el directorio..." className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium" />
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
                <div>
                  <h3 className="text-2xl font-black">{clienteActivo.nombre}</h3>
                  <p className="text-slate-400 text-sm">{clienteActivo.celular || "Sin celular registrado"}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1 inline-block ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}>
                    {(clienteActivo.deudaTotal || 0) < 0 ? '✨ Saldo a favor' : 'Saldo Actual'}
                  </span>
                  <span className={`text-3xl font-black block ${clienteActivo.deudaTotal === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                    ${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* HEADER MÓVIL */}
              <div className="md:hidden p-4 sm:p-5 flex justify-between items-center bg-slate-50 dark:bg-[#020617] shrink-0 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg">Perfil de Cliente</h3>
                <button onClick={() => setClienteActivo(null)} className="bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-[#1e293b] shadow-sm transition-colors"><X size={20}/></button>
              </div>

              <div className="md:hidden px-6 py-5 bg-slate-50 dark:bg-[#020617] text-center shrink-0 flex flex-col items-center border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{clienteActivo.nombre}</h2>
                <p className="text-slate-500 font-medium text-base mb-4">{clienteActivo.celular || "Sin número registrado"}</p>
                
                <div className="flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] w-full py-4 px-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-4">
                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 px-2 py-0.5 rounded ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'}`}>
                    {(clienteActivo.deudaTotal || 0) < 0 ? '✨ Saldo a favor' : (clienteActivo.deudaTotal === 0 ? 'CUENTA AL DÍA' : 'SALDO PENDIENTE')}
                  </p>
                  <p className={`text-4xl sm:text-5xl font-black tracking-tighter ${clienteActivo.deudaTotal === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500' : 'text-rose-500')}`}>${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</p>
                </div>
              </div>

              {/* BOTONES ACCIÓN CON ENRUTADOR CORRECTO */}
              <div className="p-4 md:p-6 bg-slate-50 dark:bg-[#020617] border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0">
                <div className="flex gap-3">
                  <button onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm">Vender</button>
                  <button onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm">Fiar</button>
                  <button onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm">Abonar</button>
                </div>

                {clienteActivo.celular && datosSesion?.rol !== 'cajero' && (
                  <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] dark:text-[#25D366] font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm border border-[#25D366]/20">
                    <MessageCircle size={18} /> Enviar estado por WhatsApp
                  </button>
                )}
              </div>

              {/* HISTORIAL INTERNO DEL PERFIL */}
              <div className="bg-white dark:bg-[#0f172a] p-6 pb-10 flex-1 overflow-y-auto space-y-3 md:space-y-4">
                <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Clock size={16}/> Historial Completo</h4>
                {movimientosCliente.map(mov => (
                  <div key={mov.id} className="p-4 md:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2 md:space-y-3">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
                    
                    <div className="pl-1 md:pl-2">
                      <div className="flex justify-between items-center pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                        <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')}`}>{mov.tipo}</span>
                        
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] md:text-[11px] font-bold uppercase">
                          {mov.registradoPor && (
                            <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              👤 {mov.registradoPor}
                            </span>
                          )}
                          {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                          <span className="text-slate-400 whitespace-nowrap">
                            {mov.fecha?.toDate().toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                      
                      {mov.detalles && mov.detalles.length > 0 ? (
                        <div className="space-y-1 md:space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700 md:border-none">
                          {mov.detalles.map((d: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs md:text-sm">
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} font-black mr-1 md:mr-1.5`}>{d.cantidad}x</strong>}
                                {d.descripcion}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">${d.valor.toLocaleString('es-CO')}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                      )}
                      
                      <div className="flex justify-between items-center pt-2 mt-1 md:mt-0 md:pt-3 border-t border-slate-200 dark:border-slate-700 md:border-slate-100 dark:md:border-slate-800 font-black">
                        <span className="text-xs text-slate-400 uppercase tracking-wider">Total:</span>
                        <span className={`text-base md:text-xl ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                          {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {movimientosCliente.length === 0 && <p className="text-center text-slate-400 py-10">Sin transacciones registradas.</p>}
              </div>
            </div>
            
          </div>
        </div>
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

    </div>
  );
}