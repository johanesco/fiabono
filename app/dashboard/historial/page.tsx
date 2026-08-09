"use client";
import { useState, useEffect, useRef } from "react";
import { Search, Filter, Lock, ShoppingBag, ShoppingCart, Banknote } from 'lucide-react';
import toast from "react-hot-toast";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";
import TablaHistorial from "../../../components/TablaHistorial"; // Importamos la tabla

export default function HistorialPage() {
  const { datosSesion } = useAuth();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroTiempoHistorial, setFiltroTiempoHistorial] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState<'todos' | 'venta' | 'abono' | 'fiado'>('todos');
  const [modalSuscripcion, setModalSuscripcion] = useState(false);

  const scrollHistorialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarDatosHistorial(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  const cargarDatosHistorial = async (uid: string) => {
    try {
      const listaC = await API_DB.obtenerClientes(uid);
      setClientes(listaC);
      const listaM = await API_DB.obtenerMovimientos(uid);
      setTodosMovimientos(listaM);
    } catch (error) { 
      toast.error("Error al cargar el historial.");
    }
  };

  const getNombreCliente = (id: string) => {
    if (id === 'mostrador') return 'Venta de Mostrador';
    return clientes.find(c => c.id === id)?.nombre || "Cliente Eliminado";
  };

  const hoyDate = new Date();
  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1; 
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum);

  const historialFiltrado = todosMovimientos.filter(mov => {
    const filtroForzado = (!puedeVerReportes || planActual === 'basico') ? 'hoy' : filtroTiempoHistorial;

    const nombreMatch = getNombreCliente(mov.clienteId).toLowerCase().includes(busquedaHistorial.toLowerCase());
    if (busquedaHistorial && !nombreMatch) return false;
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
          <input type="text" value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} placeholder="Buscar nombre en historial..." 
            className="w-full p-5 pl-14 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 text-lg transition-all shadow-sm dark:text-slate-200" />
        </div>
        
        <div className="flex flex-col gap-3">
          {puedeVerReportes && (
            <div className="flex bg-slate-200/50 dark:bg-[#020617] p-1.5 rounded-xl">
              {['hoy', 'semana', 'mes', 'todos'].map((filtro) => (
                <button key={filtro} 
                  onClick={() => {
                    if (planActual === 'basico' && filtro !== 'hoy') setModalSuscripcion(true);
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
        
        {/* VISTA MÓVIL: TARJETAS (Venta = Verde, Abono = Azul, Fiado = Rojo) */}
        <div className="md:hidden">
          {historialFiltrado.map((mov) => (
            <div key={mov.id} className="p-5 mx-2 my-3 rounded-2xl flex flex-col gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/60 shadow-sm relative">
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
              <div className="flex justify-between items-start gap-3 pl-2">
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-bold text-lg text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId)}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                </div>
                <p className={`font-black text-xl text-right ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                  {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* VISTA ESCRITORIO: TABLA PRO */}
        <TablaHistorial movimientos={historialFiltrado} getNombreCliente={getNombreCliente} />

        {historialFiltrado.length === 0 && (
          <div className="p-10 text-center text-slate-400">No hay registros para mostrar.</div>
        )}
      </div>
    </div>
  );
}