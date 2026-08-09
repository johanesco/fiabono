"use client";
import { useState, useEffect } from "react";
import { PieChart, TrendingUp, ShieldAlert, ShoppingBag, ShoppingCart, Banknote, Users, Activity, Wallet, UserCheck, Award, BarChart3, Calendar } from 'lucide-react';
import toast from "react-hot-toast";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";

export default function ReportesPage() {
  const { datosSesion } = useAuth();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  
  const [filtroGeneral, setFiltroGeneral] = useState<'hoy' | 'semana' | 'mes' | 'ano' | 'todos'>('hoy');
  const [filtroGrafica, setFiltroGrafica] = useState<'semana' | 'mes' | 'ano'>('semana');
  const [filtroColab, setFiltroColab] = useState<'hoy' | 'semana' | 'mes' | 'ano' | 'todos'>('hoy');
  const [criterioColaborador, setCriterioColaborador] = useState<'monto' | 'cantidad'>('monto');
  
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarDatosReportes(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  const cargarDatosReportes = async (uid: string) => {
    try {
      const listaC = await API_DB.obtenerClientes(uid);
      setClientes(listaC);
      const listaM = await API_DB.obtenerMovimientos(uid);
      setTodosMovimientos(listaM);
    } catch (error) {
      toast.error("Error al cargar los reportes.");
    } finally {
      setCargando(false);
    }
  };

  if (!puedeVerReportes || planActual === 'basico') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-6 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl">
        <ShieldAlert size={64} className="text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Acceso Restringido</h2>
        <p className="text-slate-500 mt-2 max-w-md">Tu plan actual (Básico) o permisos de cajero no permiten visualizar los reportes ejecutivos avanzados.</p>
      </div>
    );
  }

  const hoyDate = new Date();
  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1; 
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum);

  const filtrarPorTiempo = (movs: Movimiento[], tipoFiltro: 'hoy' | 'semana' | 'mes' | 'ano' | 'todos') => {
    return movs.filter(mov => {
      const ms = mov.fecha?.toMillis() || 0;
      const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
      const inicioSemana = inicioSemanaDate.getTime();
      const inicioMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1).getTime();
      const inicioAno = new Date(hoyDate.getFullYear(), 0, 1).getTime();

      if (tipoFiltro === 'hoy' && ms < inicioHoy) return false;
      if (tipoFiltro === 'semana' && ms < inicioSemana) return false;
      if (tipoFiltro === 'mes' && ms < inicioMes) return false;
      if (tipoFiltro === 'ano' && ms < inicioAno) return false;
      return true;
    });
  };

  const obtenerTextoRango = (filtro: 'hoy' | 'semana' | 'mes' | 'ano' | 'todos') => {
    if (filtro === 'hoy') {
      return hoyDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (filtro === 'semana') {
      const finSemanaDate = new Date(inicioSemanaDate);
      finSemanaDate.setDate(finSemanaDate.getDate() + 6);
      const fInicio = inicioSemanaDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      const fFin = finSemanaDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
      return `Del ${fInicio} al ${fFin}`;
    }
    if (filtro === 'mes') {
      return hoyDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    }
    if (filtro === 'ano') {
      return `Año ${hoyDate.getFullYear()}`;
    }
    return 'Histórico Completo';
  };

  const movimientosGenerales = filtrarPorTiempo(todosMovimientos, filtroGeneral);

  const carteraActiva = clientes.reduce((acc, c) => acc + (c.deudaTotal > 0 ? c.deudaTotal : 0), 0);
  const totalClientesRegistrados = clientes.length;
  const clientesConCredito = clientes.filter(c => c.deudaTotal > 0).length;

  const totalVentas = movimientosGenerales.filter(m => m.tipo === 'venta').reduce((acc, m) => acc + m.monto, 0);
  const totalFiados = movimientosGenerales.filter(m => m.tipo === 'fiado').reduce((acc, m) => acc + m.monto, 0);
  const totalAbonos = movimientosGenerales.filter(m => m.tipo === 'abono').reduce((acc, m) => acc + m.monto, 0);
  const ingresosCaja = totalVentas + totalAbonos;

  const obtenerDatosGrafica = () => {
    const movsGrafica = filtroGrafica === 'semana' 
      ? filtrarPorTiempo(todosMovimientos, 'semana') 
      : (filtroGrafica === 'mes' ? filtrarPorTiempo(todosMovimientos, 'mes') : filtrarPorTiempo(todosMovimientos, 'ano'));

    if (filtroGrafica === 'semana') {
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const datos = dias.map(d => ({ label: d, ventas: 0, fiados: 0, abonos: 0 }));
      movsGrafica.forEach(mov => {
        if (mov.fecha) {
          const d = mov.fecha.toDate();
          let jsDay = d.getDay();
          let idx = jsDay === 0 ? 6 : jsDay - 1;
          if (datos[idx]) {
            if (mov.tipo === 'venta') datos[idx].ventas += mov.monto;
            if (mov.tipo === 'fiado') datos[idx].fiados += mov.monto;
            if (mov.tipo === 'abono') datos[idx].abonos += mov.monto;
          }
        }
      });
      return datos;
    } else if (filtroGrafica === 'mes') {
      const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
      const datos = semanas.map(s => ({ label: s, ventas: 0, fiados: 0, abonos: 0 }));
      movsGrafica.forEach(mov => {
        if (mov.fecha) {
          const d = mov.fecha.toDate();
          const diaMes = d.getDate();
          let idx = Math.min(Math.floor((diaMes - 1) / 7), 3);
          if (datos[idx]) {
            if (mov.tipo === 'venta') datos[idx].ventas += mov.monto;
            if (mov.tipo === 'fiado') datos[idx].fiados += mov.monto;
            if (mov.tipo === 'abono') datos[idx].abonos += mov.monto;
          }
        }
      });
      return datos;
    } else {
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const datos = meses.map(m => ({ label: m, ventas: 0, fiados: 0, abonos: 0 }));
      movsGrafica.forEach(mov => {
        if (mov.fecha) {
          const d = mov.fecha.toDate();
          let idx = d.getMonth();
          if (datos[idx]) {
            if (mov.tipo === 'venta') datos[idx].ventas += mov.monto;
            if (mov.tipo === 'fiado') datos[idx].fiados += mov.monto;
            if (mov.tipo === 'abono') datos[idx].abonos += mov.monto;
          }
        }
      });
      return datos;
    }
  };

  const datosGrafica = obtenerDatosGrafica();
  const maxBarra = Math.max(...datosGrafica.map(d => Math.max(d.ventas, d.fiados, d.abonos)), 1);

  const movimientosColab = filtrarPorTiempo(todosMovimientos, filtroColab);
  const colaboradoresMap: { [key: string]: { nombre: string; monto: number; cantidad: number } } = {};
  
  movimientosColab.forEach(mov => {
    if (mov.registradoPor && mov.tipo === 'venta') {
      if (!colaboradoresMap[mov.registradoPor]) {
        colaboradoresMap[mov.registradoPor] = { nombre: mov.registradoPor, monto: 0, cantidad: 0 };
      }
      colaboradoresMap[mov.registradoPor].monto += mov.monto;
      colaboradoresMap[mov.registradoPor].cantidad += 1;
    }
  });

  const listaColaboradores = Object.values(colaboradoresMap).sort((a, b) => {
    return criterioColaborador === 'monto' ? b.monto - a.monto : b.cantidad - a.cantidad;
  });

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 h-full max-w-7xl mx-auto w-full pb-16">
      
      {/* CABECERA PRINCIPAL */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 rounded-[2.5rem] shadow-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Panel Ejecutivo</span>
            <span className="text-slate-300 text-xs flex items-center gap-1.5"><Calendar size={14}/> {obtenerTextoRango(filtroGeneral)}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Reportes y Analíticas</h1>
          <p className="text-slate-400 text-sm mt-1">Supervisa el flujo de caja, el estado de créditos y el personal.</p>
        </div>

        <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-2xl w-full md:w-auto border border-white/10 overflow-x-auto">
          {(['hoy', 'semana', 'mes', 'ano', 'todos'] as const).map((filtro) => (
            <button 
              key={filtro} 
              onClick={() => setFiltroGeneral(filtro)}
              className={`flex-1 md:flex-initial px-4 text-xs sm:text-sm font-bold py-2.5 rounded-xl capitalize transition-all whitespace-nowrap ${
                filtroGeneral === filtro 
                  ? 'bg-white text-slate-900 shadow-md scale-105' 
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {filtro === 'ano' ? 'Año' : filtro}
            </button>
          ))}
        </div>
      </div>

      {/* BLOQUE 1: CARTERA Y CLIENTES UNIFICADOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-amber-500"></div>
          <div>
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Cartera en la Calle</span>
            <p className="text-3xl sm:text-4xl font-black text-amber-500 mt-2">${carteraActiva.toLocaleString('es-CO')}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Deuda total acumulada por tus clientes.</p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-3xl shrink-0"><Wallet size={36}/></div>
        </div>

        <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-slate-800 dark:bg-slate-500"></div>
          <div>
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Directorio de Clientes</span>
            <div className="flex items-baseline gap-4 mt-2">
              <div>
                <span className="text-3xl font-black text-slate-900 dark:text-white">{totalClientesRegistrados}</span>
                <p className="text-[11px] text-slate-400 font-bold uppercase">Registrados</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
              <div>
                <span className="text-3xl font-black text-rose-500">{clientesConCredito}</span>
                <p className="text-[11px] text-rose-400 font-bold uppercase">Con Crédito</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-3xl shrink-0"><Users size={36}/></div>
        </div>

      </div>

      {/* BLOQUE 2: MÉTRICAS FINANCIERAS CON COLORES SÓLIDOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Ventas: Verde Sólido */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white transform transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-100 opacity-90">Total Ventas</span>
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl"><ShoppingCart size={20}/></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight">${totalVentas.toLocaleString('es-CO')}</p>
        </div>

        {/* Fiados: Rojo Sólido */}
        <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white transform transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-rose-100 opacity-90">Total Fiados</span>
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl"><ShoppingBag size={20}/></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight">${totalFiados.toLocaleString('es-CO')}</p>
        </div>

        {/* Abonos: Azul Sólido */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white transform transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-blue-100 opacity-90">Total Abonos</span>
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl"><Banknote size={20}/></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight">${totalAbonos.toLocaleString('es-CO')}</p>
        </div>

        {/* Ingresos de Caja: Oscuro Sólido (Resalta el dinero real que entró) */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white border border-slate-700 transform transition-transform hover:-translate-y-1">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 opacity-90">Ingresos (Ventas + Abonos)</span>
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl"><TrendingUp size={20}/></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-400">${ingresosCaja.toLocaleString('es-CO')}</p>
        </div>

      </div>

      {/* BLOQUE 3: GRÁFICO */}
      <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="text-slate-800 dark:text-slate-400" size={24} /> Comportamiento Financiero
            </h3>
            <p className="text-slate-500 text-xs mt-1">Evolución en el tiempo.</p>
          </div>

          <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-xl">
            {(['semana', 'mes', 'ano'] as const).map(f => (
              <button 
                key={f}
                onClick={() => setFiltroGrafica(f)}
                className={`px-4 py-2 text-xs font-bold rounded-lg uppercase transition-all ${filtroGrafica === f ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                {f === 'ano' ? 'Año' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-emerald-500 inline-block shadow-sm"></span> Ventas</span>
          <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-rose-500 inline-block shadow-sm"></span> Fiados</span>
          <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-blue-500 inline-block shadow-sm"></span> Abonos</span>
        </div>

        <div className="grid grid-cols-7 gap-3 items-end h-72 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          {datosGrafica.map((item) => {
            const hVentas = Math.max((item.ventas / maxBarra) * 100, 4);
            const hFiados = Math.max((item.fiados / maxBarra) * 100, 4);
            const hAbonos = Math.max((item.abonos / maxBarra) * 100, 4);

            return (
              <div key={item.label} className="flex flex-col items-center h-full justify-end group relative min-w-[35px]">
                <div className="absolute -top-16 bg-slate-900 text-white text-[11px] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap shadow-2xl">
                  <p className="font-bold border-b border-slate-700 pb-1 mb-1">{item.label}</p>
                  <p className="text-emerald-400 font-medium">Ventas: ${item.ventas.toLocaleString()}</p>
                  <p className="text-rose-400 font-medium">Fiados: ${item.fiados.toLocaleString()}</p>
                  <p className="text-blue-400 font-medium">Abonos: ${item.abonos.toLocaleString()}</p>
                </div>

                <div className="flex items-end justify-center gap-1.5 w-full h-full">
                  <div className="w-2.5 bg-emerald-500 rounded-t-md transition-all duration-500" style={{ height: `${hVentas}%` }}></div>
                  <div className="w-2.5 bg-rose-500 rounded-t-md transition-all duration-500" style={{ height: `${hFiados}%` }}></div>
                  <div className="w-2.5 bg-blue-500 rounded-t-md transition-all duration-500" style={{ height: `${hAbonos}%` }}></div>
                </div>
                <span className="text-xs font-bold text-slate-500 mt-3 truncate max-w-full">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOQUE 4: RENDIMIENTO DE COLABORADORES */}
      <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-6">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="text-amber-500" size={24} /> Rendimiento de Colaboradores
            </h3>
            <p className="text-slate-500 text-xs mt-1">Ranking de ventas por personal ({obtenerTextoRango(filtroColab)}).</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-xl overflow-x-auto">
              {(['hoy', 'semana', 'mes', 'ano', 'todos'] as const).map(f => (
                <button 
                  key={f}
                  onClick={() => setFiltroColab(f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-all whitespace-nowrap ${filtroColab === f ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                >
                  {f === 'ano' ? 'Año' : f}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-xl">
              <button 
                onClick={() => setCriterioColaborador('monto')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${criterioColaborador === 'monto' ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Por Monto ($)
              </button>
              <button 
                onClick={() => setCriterioColaborador('cantidad')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${criterioColaborador === 'cantidad' ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
              >
                Por Cantidad (#)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listaColaboradores.map((colab, index) => (
            <div key={colab.nombre} className="p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-4 hover:border-emerald-500/50 transition-all">
              {/* El primer lugar (#1) obtiene un estilo verde destacado por ser el mejor en ventas */}
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${index === 0 ? 'bg-emerald-500 text-white' : (index === 1 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400')}`}>
                #{index + 1}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-base">{colab.nombre}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-slate-500 font-medium">{colab.cantidad} ventas</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${colab.monto.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          ))}

          {listaColaboradores.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 text-sm">
              No hay registros de ventas por colaboradores para este filtro.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}