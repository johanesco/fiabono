"use client";
import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  ShoppingBag, 
  ShoppingCart, 
  Banknote, 
  Users, 
  Activity, 
  Wallet, 
  Award, 
  BarChart3, 
  Calendar, 
  Crown, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  Bookmark, 
  ArrowUpRight,
  Info
} from 'lucide-react';
import toast from "react-hot-toast";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useRouter } from "next/navigation";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";
import ModalSuscripcion from "@/components/ModalSuscripcion";

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const NOMBRES_MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function ReportesPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esPro = datosSesion?.esPro;
  const esComercio = datosSesion?.esComercio;
  const esGratis = datosSesion?.esGratis;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  const [separes, setSepares] = useState<any[]>([]);

  // Filtros principales
  const [filtroGeneral, setFiltroGeneral] = useState<'hoy' | 'semana' | 'mes' | 'ano' | 'todos'>('hoy');
  const [filtroGrafica, setFiltroGrafica] = useState<'semana' | 'mes' | 'ano' | 'historico'>('semana');
  const [tipoHistorico, setTipoHistorico] = useState<'mes' | 'ano'>('mes');
  const [filtroColab, setFiltroColab] = useState<'hoy' | 'semana' | 'mes' | 'ano' | 'todos'>('hoy');
  const [criterioColaborador, setCriterioColaborador] = useState<'monto' | 'cantidad'>('monto');

  // Selectores históricos (Exclusivos Plan PRO)
  const hoyDate = new Date();
  const [anoHistorico, setAnoHistorico] = useState<number>(hoyDate.getFullYear() - 1);
  const [mesHistorico, setMesHistorico] = useState<number>(hoyDate.getMonth());

  const [cargando, setCargando] = useState(true);
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState(false);
  const [planInicialSuscripcion, setPlanInicialSuscripcion] = useState<'comercio' | 'pro'>('pro');

  useEffect(() => {
    if (!cuentaPrincipalId) return;

    // 1. Listener en tiempo real de clientes
    const qC = query(collection(db, "clientes"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubClientes = onSnapshot(qC, (snap) => {
      const lista: Cliente[] = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() } as Cliente));
      setClientes(lista);
    });

    // 2. Listener en tiempo real de todos los movimientos de la cuenta principal
    const qM = query(collection(db, "movimientos"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubMovs = onSnapshot(qM, (snap) => {
      const lista: Movimiento[] = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() } as Movimiento));
      lista.sort((a, b) => {
        const tA = (a.fecha as any)?.toMillis ? (a.fecha as any).toMillis() : (a.fecha ? new Date(a.fecha as any).getTime() : 0);
        const tB = (b.fecha as any)?.toMillis ? (b.fecha as any).toMillis() : (b.fecha ? new Date(b.fecha as any).getTime() : 0);
        return tB - tA;
      });
      setTodosMovimientos(lista);
      setCargando(false);
    }, (error) => {
      console.error("Error al escuchar movimientos en reportes:", error);
      setCargando(false);
    });

    // 3. Listener en tiempo real de separes
    const qS = query(collection(db, "separes"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubSepares = onSnapshot(qS, (snap) => {
      const lista: any[] = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
      setSepares(lista);
    });

    return () => {
      unsubClientes();
      unsubMovs();
      unsubSepares();
    };
  }, [cuentaPrincipalId]);

  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1;
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum, 0, 0, 0, 0);

  // Helper seguro para obtener un objeto Date sin fallar por tipos de Firestore / JSON
  const obtenerFechaJS = (fecha: any): Date => {
    if (!fecha) return new Date();
    if (typeof fecha.toDate === 'function') return fecha.toDate();
    if (fecha instanceof Date) return fecha;
    if (fecha?.seconds) return new Date(fecha.seconds * 1000);
    return new Date(fecha);
  };

  const filtrarPorTiempo = (movs: Movimiento[], tipoFiltro: 'hoy' | 'semana' | 'mes' | 'ano' | 'todos') => {
    return movs.filter(mov => {
      const fJS = obtenerFechaJS(mov.fecha);
      const ms = fJS.getTime();
      const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate(), 0, 0, 0, 0).getTime();
      const inicioSemana = inicioSemanaDate.getTime();
      const inicioMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1, 0, 0, 0, 0).getTime();
      const inicioAno = new Date(hoyDate.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();

      if (tipoFiltro === 'hoy' && ms < inicioHoy) return false;
      if (tipoFiltro === 'semana' && ms < inicioSemana) return false;
      if (tipoFiltro === 'mes' && ms < inicioMes) return false;
      if (tipoFiltro === 'ano' && ms < inicioAno) return false;
      return true;
    });
  };

  // Helper de textos y rangos dinámicos
  const obtenerMetadatosPeriodo = (filtro: 'hoy' | 'semana' | 'mes' | 'ano' | 'todos') => {
    if (filtro === 'hoy') {
      const fHoyStr = hoyDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return {
        etiquetaVentas: "Ventas de Hoy",
        etiquetaFiados: "Fiados de Hoy",
        etiquetaAbonos: "Abonos de Hoy",
        etiquetaCaja: "Dinero Neto en Caja (Hoy)",
        rangoDescriptivo: fHoyStr.charAt(0).toUpperCase() + fHoyStr.slice(1),
        badgePeriodo: "Hoy"
      };
    }
    if (filtro === 'semana') {
      const finSemanaDate = new Date(inicioSemanaDate);
      finSemanaDate.setDate(finSemanaDate.getDate() + 6);
      const fInicio = inicioSemanaDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      const fFin = finSemanaDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
      return {
        etiquetaVentas: "Ventas Esta Semana",
        etiquetaFiados: "Fiados Esta Semana",
        etiquetaAbonos: "Abonos Esta Semana",
        etiquetaCaja: "Dinero Neto en Caja (Semana)",
        rangoDescriptivo: `Semana del ${fInicio} al ${fFin}`,
        badgePeriodo: `Semana (Lun - Dom)`
      };
    }
    if (filtro === 'mes') {
      const mesActualNombre = NOMBRES_MESES[hoyDate.getMonth()];
      return {
        etiquetaVentas: `Ventas de ${mesActualNombre}`,
        etiquetaFiados: `Fiados de ${mesActualNombre}`,
        etiquetaAbonos: `Abonos de ${mesActualNombre}`,
        etiquetaCaja: `Dinero Neto en Caja (${mesActualNombre})`,
        rangoDescriptivo: `Lo que va de ${mesActualNombre} ${hoyDate.getFullYear()}`,
        badgePeriodo: `${mesActualNombre} ${hoyDate.getFullYear()}`
      };
    }
    if (filtro === 'ano') {
      return {
        etiquetaVentas: `Ventas del ${hoyDate.getFullYear()}`,
        etiquetaFiados: `Fiados del ${hoyDate.getFullYear()}`,
        etiquetaAbonos: `Abonos del ${hoyDate.getFullYear()}`,
        etiquetaCaja: `Dinero Neto en Caja (${hoyDate.getFullYear()})`,
        rangoDescriptivo: `Lo que va del año ${hoyDate.getFullYear()}`,
        badgePeriodo: `Año ${hoyDate.getFullYear()}`
      };
    }
    return {
      etiquetaVentas: "Ventas Totales (Histórico)",
      etiquetaFiados: "Fiados Totales (Histórico)",
      etiquetaAbonos: "Abonos Totales (Histórico)",
      etiquetaCaja: "Dinero Neto en Caja (Histórico)",
      rangoDescriptivo: "Histórico Total Acumulado",
      badgePeriodo: "Histórico Completo"
    };
  };

  const metaPeriodo = obtenerMetadatosPeriodo(filtroGeneral);
  const movimientosGenerales = filtrarPorTiempo(todosMovimientos, filtroGeneral);

  const carteraActiva = clientes.reduce((acc, c) => acc + (c.deudaTotal > 0 ? c.deudaTotal : 0), 0);
  const totalClientesRegistrados = clientes.length;
  const clientesConCredito = clientes.filter(c => c.deudaTotal > 0).length;

  const movsVentas = movimientosGenerales.filter(m => m.tipo === 'venta');
  const movsFiados = movimientosGenerales.filter(m => m.tipo === 'fiado');
  const movsAbonos = movimientosGenerales.filter(m => m.tipo === 'abono');
  const movsEgresos = movimientosGenerales.filter(m => m.tipo === 'egreso');

  const totalVentas = movsVentas.reduce((acc, m) => acc + (m.monto || 0), 0);
  const countVentas = movsVentas.length;

  const totalFiados = movsFiados.reduce((acc, m) => acc + (m.monto || 0), 0);
  const countFiados = movsFiados.length;

  const totalAbonos = movsAbonos.reduce((acc, m) => acc + (m.monto || 0), 0);
  const countAbonos = movsAbonos.length;

  const totalEgresos = movsEgresos.reduce((acc, m) => acc + (m.monto || 0), 0);

  // Dinero Neto en Caja: (Ventas Directas + Abonos) - Egresos/Devoluciones
  const ingresosCaja = Math.max(0, (totalVentas + totalAbonos) - totalEgresos);
  const countIngresos = countVentas + countAbonos;

  // Tasa de recuperación de crédito / Salud de cartera (Abonos vs Fiados)
  const ratioRecaudo = totalFiados > 0 ? Math.min(100, Math.round((totalAbonos / totalFiados) * 100)) : 100;

  // Métricas del Plan Separe
  const separesActivos = separes.filter(s => s.estado === 'activo');
  const totalEnSeparesActivos = separesActivos.reduce((a, s) => a + (s.total || 0), 0);
  const abonosEnSeparesActivos = separesActivos.reduce((a, s) => a + (s.montoPagado || 0), 0);
  const saldoPendienteSepares = separesActivos.reduce((a, s) => a + (s.saldoPendiente || 0), 0);

  // Generador de datos para Gráfica de Comportamiento Financiero
  const obtenerDatosGrafica = () => {
    if (filtroGrafica === 'semana') {
      const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const datos = dias.map((d, idx) => ({ 
        id: `dia-${idx}`,
        label: d, 
        shortLabel: d.substring(0, 3),
        ventas: 0, 
        fiados: 0, 
        abonos: 0, 
        countVentas: 0 
      }));
      const movsSemana = filtrarPorTiempo(todosMovimientos, 'semana');
      movsSemana.forEach(mov => {
        if (mov.fecha) {
          const d = obtenerFechaJS(mov.fecha);
          let jsDay = d.getDay();
          let idx = jsDay === 0 ? 6 : jsDay - 1;
          if (datos[idx]) {
            if (mov.tipo === 'venta') {
              datos[idx].ventas += (mov.monto || 0);
              datos[idx].countVentas += 1;
            }
            if (mov.tipo === 'fiado') datos[idx].fiados += (mov.monto || 0);
            if (mov.tipo === 'abono') datos[idx].abonos += (mov.monto || 0);
          }
        }
      });
      return datos;
    } else if (filtroGrafica === 'mes') {
      // DÍAS DEL MES EN CURSO (1 al 28/30/31)
      const numDiasMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0).getDate();
      const mesNombreCorto = NOMBRES_MESES_CORTO[hoyDate.getMonth()];
      const datos = Array.from({ length: numDiasMes }, (_, i) => {
        const diaNum = i + 1;
        const fechaObj = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), diaNum);
        const nombreDiaSemana = fechaObj.toLocaleDateString('es-CO', { weekday: 'short' });
        return {
          id: `mes-dia-${diaNum}`,
          label: `${nombreDiaSemana} ${diaNum} de ${NOMBRES_MESES[hoyDate.getMonth()]}`,
          shortLabel: `${diaNum}`,
          diaNum,
          nombreDiaSemana,
          ventas: 0,
          fiados: 0,
          abonos: 0,
          countVentas: 0
        };
      });

      const movsMes = filtrarPorTiempo(todosMovimientos, 'mes');
      movsMes.forEach(mov => {
        if (mov.fecha) {
          const d = obtenerFechaJS(mov.fecha);
          const idx = d.getDate() - 1;
          if (datos[idx]) {
            if (mov.tipo === 'venta') {
              datos[idx].ventas += (mov.monto || 0);
              datos[idx].countVentas += 1;
            }
            if (mov.tipo === 'fiado') datos[idx].fiados += (mov.monto || 0);
            if (mov.tipo === 'abono') datos[idx].abonos += (mov.monto || 0);
          }
        }
      });
      return datos;
    } else if (filtroGrafica === 'ano') {
      const datos = NOMBRES_MESES_CORTO.map((m, idx) => ({ 
        id: `ano-mes-${idx}`,
        label: NOMBRES_MESES[idx], 
        shortLabel: m,
        ventas: 0, 
        fiados: 0, 
        abonos: 0, 
        countVentas: 0 
      }));
      const movsAno = filtrarPorTiempo(todosMovimientos, 'ano');
      movsAno.forEach(mov => {
        if (mov.fecha) {
          const d = obtenerFechaJS(mov.fecha);
          let idx = d.getMonth();
          if (datos[idx]) {
            if (mov.tipo === 'venta') {
              datos[idx].ventas += (mov.monto || 0);
              datos[idx].countVentas += 1;
            }
            if (mov.tipo === 'fiado') datos[idx].fiados += (mov.monto || 0);
            if (mov.tipo === 'abono') datos[idx].abonos += (mov.monto || 0);
          }
        }
      });
      return datos;
    } else if (filtroGrafica === 'historico') {
      if (tipoHistorico === 'mes') {
        // DÍAS DEL MES HISTÓRICO SELECCIONADO
        const numDiasMes = new Date(anoHistorico, mesHistorico + 1, 0).getDate();
        const mesNombreCorto = NOMBRES_MESES_CORTO[mesHistorico];
        const datos = Array.from({ length: numDiasMes }, (_, i) => {
          const diaNum = i + 1;
          const fechaObj = new Date(anoHistorico, mesHistorico, diaNum);
          const nombreDiaSemana = fechaObj.toLocaleDateString('es-CO', { weekday: 'short' });
          return {
            id: `hist-mes-dia-${diaNum}`,
            label: `${nombreDiaSemana} ${diaNum} de ${NOMBRES_MESES[mesHistorico]} ${anoHistorico}`,
            shortLabel: `${diaNum}`,
            diaNum,
            nombreDiaSemana,
            ventas: 0,
            fiados: 0,
            abonos: 0,
            countVentas: 0
          };
        });

        todosMovimientos.forEach(mov => {
          if (mov.fecha) {
            const d = obtenerFechaJS(mov.fecha);
            if (d.getFullYear() === anoHistorico && d.getMonth() === mesHistorico) {
              const idx = d.getDate() - 1;
              if (datos[idx]) {
                if (mov.tipo === 'venta') {
                  datos[idx].ventas += (mov.monto || 0);
                  datos[idx].countVentas += 1;
                }
                if (mov.tipo === 'fiado') datos[idx].fiados += (mov.monto || 0);
                if (mov.tipo === 'abono') datos[idx].abonos += (mov.monto || 0);
              }
            }
          }
        });
        return datos;
      } else {
        // AÑO HISTÓRICO (12 MESES)
        const datos = NOMBRES_MESES_CORTO.map((m, idx) => ({ 
          id: `hist-ano-mes-${idx}`,
          label: `${NOMBRES_MESES[idx]} ${anoHistorico}`, 
          shortLabel: m,
          ventas: 0, 
          fiados: 0, 
          abonos: 0, 
          countVentas: 0 
        }));
        todosMovimientos.forEach(mov => {
          if (mov.fecha) {
            const d = obtenerFechaJS(mov.fecha);
            if (d.getFullYear() === anoHistorico) {
              let idx = d.getMonth();
              if (datos[idx]) {
                if (mov.tipo === 'venta') {
                  datos[idx].ventas += (mov.monto || 0);
                  datos[idx].countVentas += 1;
                }
                if (mov.tipo === 'fiado') datos[idx].fiados += (mov.monto || 0);
                if (mov.tipo === 'abono') datos[idx].abonos += (mov.monto || 0);
              }
            }
          }
        });
        return datos;
      }
    }
    return [];
  };

  const datosGrafica = obtenerDatosGrafica();
  const maxBarra = Math.max(...datosGrafica.map(d => Math.max(d.ventas, d.fiados, d.abonos)), 1);
  const totalGraficaVentas = datosGrafica.reduce((a, d) => a + d.ventas, 0);
  const totalGraficaFiados = datosGrafica.reduce((a, d) => a + d.fiados, 0);
  const totalGraficaAbonos = datosGrafica.reduce((a, d) => a + d.abonos, 0);

  // Mejor Día del Periodo (Peak Sales Day)
  const mejorDiaPeriodo = (() => {
    if (datosGrafica.length === 0) return null;
    let mejor = datosGrafica[0];
    for (const d of datosGrafica) {
      if (d.ventas > mejor.ventas) {
        mejor = d;
      }
    }
    return mejor.ventas > 0 ? mejor : null;
  })();

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

  // Años disponibles para selector histórico
  const anosDisponibles = [hoyDate.getFullYear(), hoyDate.getFullYear() - 1, hoyDate.getFullYear() - 2, hoyDate.getFullYear() - 3];

  // =========================================================================
  // SI ES PLAN GRATIS: MUESTRA EL FEATURE PAYWALL CON MONTOS DIFUMINADOS
  // =========================================================================
  if (!puedeVerReportes || (esGratis && !esPro && !esComercio)) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full max-w-7xl mx-auto w-full pb-16 relative">

        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-6 z-50">
          <div className="space-y-1 text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase tracking-wider border border-emerald-500/30">
              ✨ ¡Tus métricas reales ya están calculadas!
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight">
              Desbloquea el Panel de Reportes y Comportamiento Financiero
            </h3>
            <p className="text-slate-200 text-xs sm:text-sm">
              Accede a gráficas interactivas, balance de caja neta, rendimiento de personal e historial financiero mes a mes.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setPlanInicialSuscripcion('pro');
              setModalSuscripcionOpen(true);
            }}
            className="bg-white text-blue-900 hover:bg-slate-100 font-black text-sm sm:text-base py-3.5 px-7 rounded-2xl shadow-xl transition-transform transform active:scale-95 shrink-0 cursor-pointer flex items-center gap-2"
          >
            Actualizar al Plan PRO 🚀
          </button>
        </div>

        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Panel Ejecutivo</span>
              <span className="text-slate-300 text-xs flex items-center gap-1.5"><Calendar size={14} /> {metaPeriodo.rangoDescriptivo}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Reportes y Analíticas</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Supervisa el flujo de caja, el estado de créditos y el personal.</p>
          </div>
        </div>

        {/* Tarjetas de Resumen Difuminadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-amber-500"></div>
            <div>
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Cartera en la Calle</span>
              <p className="text-3xl sm:text-4xl font-black text-amber-500 mt-2 filter blur-md select-none bg-amber-500/10 px-2 rounded">
                ${carteraActiva.toLocaleString('es-CO')}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">Deuda total acumulada por tus clientes.</p>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-3xl shrink-0"><Wallet size={36} /></div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
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
                  <span className="text-3xl font-black text-rose-500 filter blur-sm select-none">{clientesConCredito}</span>
                  <p className="text-[11px] text-rose-400 font-bold uppercase">Con Crédito</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-3xl shrink-0"><Users size={36} /></div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100 opacity-90">{metaPeriodo.etiquetaVentas}</span>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0"><ShoppingCart size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4 filter blur-md select-none bg-black/10 px-2 rounded">
              ${totalVentas.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-rose-100 opacity-90">{metaPeriodo.etiquetaFiados}</span>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0"><ShoppingBag size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4 filter blur-md select-none bg-black/10 px-2 rounded">
              ${totalFiados.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-blue-100 opacity-90">{metaPeriodo.etiquetaAbonos}</span>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0"><Banknote size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4 filter blur-md select-none bg-black/10 px-2 rounded">
              ${totalAbonos.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white border border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 opacity-90">{metaPeriodo.etiquetaCaja}</span>
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl shrink-0"><TrendingUp size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4 text-emerald-400 filter blur-md select-none bg-white/10 px-2 rounded">
              ${ingresosCaja.toLocaleString('es-CO')}
            </p>
          </div>
        </div>

        <ModalSuscripcion 
          isOpen={modalSuscripcionOpen} 
          onClose={() => setModalSuscripcionOpen(false)} 
          cuentaPrincipalId={cuentaPrincipalId || ""} 
          planInicial={planInicialSuscripcion}
        />
      </div>
    );
  }

  // =========================================================================
  // VISTA DESBLOQUEADA (COMERCIO Y PRO)
  // =========================================================================
  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-in fade-in duration-500 h-full max-w-7xl mx-auto w-full p-3 sm:p-6 lg:p-8 pt-2 sm:pt-4 pb-28">
      
      {/* CABECERA PRINCIPAL CON SELECTOR DE PERIODO */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl text-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative">
        <div className="space-y-3 z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
              <Sparkles size={14} className="text-emerald-400" /> {esPro ? 'Plan PRO Almacén' : 'Plan Comercio'}
            </span>
            <span className="text-slate-200 text-xs font-bold flex items-center gap-1.5 bg-white/15 px-3.5 py-1 rounded-full backdrop-blur-md border border-white/15 shadow-sm">
              <Calendar size={14} className="text-blue-300" /> {metaPeriodo.rangoDescriptivo}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Reportes y Analíticas</h1>
          <p className="text-slate-300 text-xs sm:text-sm font-medium">Supervisa el flujo de caja, estado de cartera y rendimiento del negocio en tiempo real.</p>
        </div>

        {/* SELECTOR DE PERIODO GENERAL (HOY / SEMANA / MES / AÑO / TODOS) */}
        <div className="flex bg-black/50 backdrop-blur-md p-1.5 rounded-2xl w-full lg:w-auto border border-white/15 overflow-x-auto shrink-0 z-10">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Semana' },
            { id: 'mes', label: 'Mes' },
            { id: 'ano', label: 'Año' },
            { id: 'todos', label: 'Todos' }
          ].map((f) => (
            <button 
              key={f.id} 
              onClick={() => setFiltroGeneral(f.id as any)}
              className={`flex-1 lg:flex-initial px-4 sm:px-5 text-xs sm:text-sm font-black py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                filtroGeneral === f.id 
                  ? 'bg-white text-slate-900 shadow-lg scale-105' 
                  : 'text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* BLOQUE 1: CARTERA EN LA CALLE & SALUD DE COBRO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Tarjeta Cartera */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-amber-500"></div>
          <div>
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Cartera en la Calle</span>
            <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-1">${carteraActiva.toLocaleString('es-CO')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Deuda total de tus clientes.</p>
          </div>
          <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl shrink-0"><Wallet size={30} /></div>
        </div>

        {/* Tarjeta Clientes */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-slate-800 dark:bg-slate-500"></div>
          <div>
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Directorio de Clientes</span>
            <div className="flex items-baseline gap-4 mt-1">
              <div>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{totalClientesRegistrados}</span>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Registrados</p>
              </div>
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-rose-500">{clientesConCredito}</span>
                <p className="text-[10px] text-rose-400 font-bold uppercase">Con Deuda</p>
              </div>
            </div>
          </div>
          <div className="p-3.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl shrink-0"><Users size={30} /></div>
        </div>

        {/* Tarjeta Eficiencia de Cobro */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-emerald-500"></div>
          <div>
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Salud de Cartera</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{ratioRecaudo}%</span>
              <span className="text-[11px] font-bold text-slate-400">tasa recaudo</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Abonos recibidos vs crédito otorgado.</p>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl shrink-0"><Activity size={30} /></div>
        </div>
      </div>

      {/* BLOQUE 2: MÉTRICAS FINANCIERAS DINÁMICAS (HOY / SEMANA / MES / AÑO / HISTÓRICO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-5 sm:p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100 opacity-90">{metaPeriodo.etiquetaVentas}</span>
              <span className="inline-block bg-white/25 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/10">
                {countVentas} {countVentas === 1 ? 'venta' : 'ventas'}
              </span>
            </div>
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shrink-0"><ShoppingCart size={18} /></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight mt-3">${totalVentas.toLocaleString('es-CO')}</p>
        </div>

        {/* Fiados */}
        <div className="bg-gradient-to-br from-rose-500 to-red-600 p-5 sm:p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-widest text-rose-100 opacity-90">{metaPeriodo.etiquetaFiados}</span>
              <span className="inline-block bg-white/25 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/10">
                {countFiados} {countFiados === 1 ? 'fiado' : 'fiados'}
              </span>
            </div>
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shrink-0"><ShoppingBag size={18} /></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight mt-3">${totalFiados.toLocaleString('es-CO')}</p>
        </div>

        {/* Abonos */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-5 sm:p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-widest text-blue-100 opacity-90">{metaPeriodo.etiquetaAbonos}</span>
              <span className="inline-block bg-white/25 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/10">
                {countAbonos} {countAbonos === 1 ? 'abono' : 'abonos'}
              </span>
            </div>
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shrink-0"><Banknote size={18} /></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight mt-3">${totalAbonos.toLocaleString('es-CO')}</p>
        </div>

        {/* Dinero Neto en Caja */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 sm:p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white border border-slate-700 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 opacity-90">{metaPeriodo.etiquetaCaja}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-block bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/5 text-slate-300">
                  {countIngresos} ingresos
                </span>
                {totalEgresos > 0 && (
                  <span className="inline-block bg-rose-500/25 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                    -${totalEgresos.toLocaleString('es-CO')}
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-white/10 backdrop-blur-sm rounded-xl shrink-0"><TrendingUp size={18} /></div>
          </div>
          <p className="text-2xl sm:text-3xl font-black tracking-tight mt-3 text-emerald-400">${ingresosCaja.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* BLOQUE ADICIONAL EXCLUSIVO PRO: RESUMEN DE PLAN SEPARE */}
      {esPro && (
        <div className="p-5 sm:p-6 bg-gradient-to-br from-purple-50 via-indigo-50/40 to-white dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-[#0f172a] rounded-[2rem] sm:rounded-3xl border border-purple-200/80 dark:border-purple-800/60 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Bookmark size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-slate-900 dark:text-white text-base">
                  Resumen de Mercancía en Plan Separe
                </h4>
                <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {separesActivos.length} activos
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Mercancía apartada con anticipos recibidos y saldo pendiente de cobro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-purple-100 dark:border-purple-900/40">
            <div className="bg-white dark:bg-[#020617] p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40 text-center">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Separes</span>
              <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">${totalEnSeparesActivos.toLocaleString('es-CO')}</span>
            </div>
            <div className="bg-white dark:bg-[#020617] p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40 text-center">
              <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Abonos en Caja</span>
              <span className="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">${abonosEnSeparesActivos.toLocaleString('es-CO')}</span>
            </div>
            <div className="bg-white dark:bg-[#020617] p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40 text-center">
              <span className="text-[9px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Por Cobrar</span>
              <span className="font-black text-xs sm:text-sm text-purple-600 dark:text-purple-400">${saldoPendienteSepares.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
      )}

      {/* BLOQUE 3: COMPORTAMIENTO FINANCIERO & GRÁFICA INTERACTIVA CON HISTORIAL PRO */}
      <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-6">
        
        {/* Cabecera del Gráfico con Filtros y Selectores Históricos */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="text-emerald-500" size={24} /> Comportamiento Financiero
              </h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              {filtroGrafica === 'mes'
                ? 'Desglose detallado día a día de este mes.' 
                : filtroGrafica === 'historico' && tipoHistorico === 'mes'
                ? `Desglose día a día de ${NOMBRES_MESES[mesHistorico]} ${anoHistorico}.`
                : filtroGrafica === 'historico' && tipoHistorico === 'ano'
                ? `Desglose mes a mes del año ${anoHistorico}.`
                : 'Evolución comparativa entre Ventas de Contado, Créditos Fiados y Abonos Recaudados.'}
            </p>
          </div>

          {/* Selector de periodo para la gráfica */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl overflow-x-auto w-full sm:w-auto">
              {[
                { id: 'semana', label: 'Esta Semana' },
                { id: 'mes', label: 'Este Mes (Día a Día)' },
                { id: 'ano', label: 'Este Año' },
                { id: 'historico', label: '🗓️ Histórico', esProOnly: true }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => {
                    if (f.esProOnly && !esPro) {
                      setPlanInicialSuscripcion('pro');
                      setModalSuscripcionOpen(true);
                      return;
                    }
                    setFiltroGrafica(f.id as any);
                  }}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    filtroGrafica === f.id 
                      ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                >
                  <span>{f.label}</span>
                  {f.esProOnly && !esPro && <Crown size={12} className="text-amber-500 fill-current ml-0.5" />}
                </button>
              ))}
            </div>

            {/* Selectores cuando se activa el modo HISTÓRICO PRO */}
            {filtroGrafica === 'historico' && esPro && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl animate-in fade-in flex-wrap">
                {/* Switch Mes Pasado / Año Pasado */}
                <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-xl shadow-xs">
                  <button
                    type="button"
                    onClick={() => setTipoHistorico('mes')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      tipoHistorico === 'mes' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Por Mes (Día a Día)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoHistorico('ano')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      tipoHistorico === 'ano' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Por Año (Mes a Mes)
                  </button>
                </div>

                {tipoHistorico === 'mes' && (
                  <select
                    value={mesHistorico}
                    onChange={(e) => setMesHistorico(Number(e.target.value))}
                    className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white font-bold text-xs px-2.5 py-1.5 rounded-xl border-none outline-none cursor-pointer shadow-xs"
                  >
                    {NOMBRES_MESES.map((nombre, idx) => (
                      <option key={nombre} value={idx}>{nombre}</option>
                    ))}
                  </select>
                )}

                <select
                  value={anoHistorico}
                  onChange={(e) => setAnoHistorico(Number(e.target.value))}
                  className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white font-bold text-xs px-2.5 py-1.5 rounded-xl border-none outline-none cursor-pointer shadow-xs"
                >
                  {anosDisponibles.map((a) => (
                    <option key={a} value={a}>Año {a}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* TARJETA DESTACADA: MEJOR DÍA DEL MES (RÉCORD EN VENTAS) */}
        {mejorDiaPeriodo && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent dark:from-amber-500/15 dark:via-emerald-500/15 rounded-2xl border border-amber-400/40 dark:border-amber-400/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Crown size={20} className="fill-current" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  🌟 Día con Mejor Facturación del Periodo
                </span>
                <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {mejorDiaPeriodo.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 pl-13 sm:pl-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ventas Récord</span>
                <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                  ${mejorDiaPeriodo.ventas.toLocaleString('es-CO')}
                </span>
              </div>
              {mejorDiaPeriodo.countVentas > 0 && (
                <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Transacciones</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                    {mejorDiaPeriodo.countVentas} {mejorDiaPeriodo.countVentas === 1 ? 'venta' : 'ventas'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leyenda y Totales del Gráfico */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-5 flex-wrap">
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shadow-xs"></span> 
              <span>Ventas: <strong>${totalGraficaVentas.toLocaleString('es-CO')}</strong></span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-rose-500 shadow-xs"></span> 
              <span>Fiados: <strong>${totalGraficaFiados.toLocaleString('es-CO')}</strong></span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-blue-500 shadow-xs"></span> 
              <span>Abonos: <strong>${totalGraficaAbonos.toLocaleString('es-CO')}</strong></span>
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Desliza horizontalmente para ver todos los días y toca cada barra para detalles
          </span>
        </div>

        {/* Visualización de Barras Responsive */}
        <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <div className="grid grid-flow-col auto-cols-fr gap-2.5 sm:gap-3.5 items-end h-64 sm:h-72 pt-12 pb-2 border-b border-slate-100 dark:border-slate-800 min-w-[500px]">
            {datosGrafica.map((item) => {
              const hVentas = Math.max((item.ventas / maxBarra) * 100, 3);
              const hFiados = Math.max((item.fiados / maxBarra) * 100, 3);
              const hAbonos = Math.max((item.abonos / maxBarra) * 100, 3);
              const esElMejorDia = mejorDiaPeriodo && item.ventas === mejorDiaPeriodo.ventas && item.ventas > 0;

              return (
                <div key={item.id || item.label} className="flex flex-col items-center h-full justify-end group relative min-w-[28px] sm:min-w-[36px]">
                  
                  {/* Corona de Mejor Día */}
                  {esElMejorDia && (
                    <div className="absolute -top-7 text-amber-500 animate-bounce flex items-center justify-center pointer-events-none">
                      <Crown size={16} className="fill-current drop-shadow-md text-amber-500" />
                    </div>
                  )}

                  {/* Tooltip flotante enriquecido */}
                  <div className="absolute bottom-[105%] mb-2 bg-slate-900/95 dark:bg-slate-800/95 text-white text-[11px] p-2.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 whitespace-nowrap shadow-2xl backdrop-blur-md border border-white/10">
                    <p className="font-black border-b border-white/10 pb-1 mb-1 text-center flex items-center justify-center gap-1">
                      {esElMejorDia && <Crown size={12} className="text-amber-400 fill-current" />}
                      {item.label}
                    </p>
                    <p className="text-emerald-400 font-bold">Ventas: ${item.ventas.toLocaleString('es-CO')}</p>
                    <p className="text-rose-400 font-bold">Fiados: ${item.fiados.toLocaleString('es-CO')}</p>
                    <p className="text-blue-400 font-bold">Abonos: ${item.abonos.toLocaleString('es-CO')}</p>
                  </div>

                  {/* Barras de datos */}
                  <div className={`flex items-end justify-center gap-0.5 sm:gap-1 w-full h-full p-0.5 rounded-t-lg ${esElMejorDia ? 'bg-amber-400/15 ring-1 ring-amber-400/50' : ''}`}>
                    <div 
                      className="w-1.5 sm:w-2.5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 shadow-xs" 
                      style={{ height: `${hVentas}%` }}
                    ></div>
                    <div 
                      className="w-1.5 sm:w-2.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all duration-500 shadow-xs" 
                      style={{ height: `${hFiados}%` }}
                    ></div>
                    <div 
                      className="w-1.5 sm:w-2.5 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md transition-all duration-500 shadow-xs" 
                      style={{ height: `${hAbonos}%` }}
                    ></div>
                  </div>
                  
                  <span className={`text-[10px] sm:text-xs font-black mt-2 truncate max-w-full text-center ${esElMejorDia ? 'text-amber-500 font-black scale-110' : 'text-slate-500 dark:text-slate-400'}`}>
                    {item.shortLabel || item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BLOQUE 4: RENDIMIENTO DE COLABORADORES */}
      <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="text-amber-500" size={24} /> Rendimiento de Colaboradores
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Ranking de ventas generadas por el equipo de trabajo ({metaPeriodo.rangoDescriptivo}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl overflow-x-auto">
              {(['hoy', 'semana', 'mes', 'ano', 'todos'] as const).map(f => (
                <button 
                  key={f}
                  onClick={() => setFiltroColab(f)}
                  className={`px-3 py-1.5 text-xs font-black rounded-xl capitalize transition-all whitespace-nowrap cursor-pointer ${
                    filtroColab === f 
                      ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                >
                  {f === 'ano' ? 'Año' : f}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
              <button 
                onClick={() => setCriterioColaborador('monto')}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  criterioColaborador === 'monto' 
                    ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500'
                }`}
              >
                Por Monto ($)
              </button>
              <button 
                onClick={() => setCriterioColaborador('cantidad')}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  criterioColaborador === 'cantidad' 
                    ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500'
                }`}
              >
                Por Cantidad (#)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listaColaboradores.map((colab, index) => {
            const ticketPromedio = colab.cantidad > 0 ? Math.round(colab.monto / colab.cantidad) : 0;
            return (
              <div 
                key={colab.nombre} 
                className="p-5 bg-slate-50 dark:bg-[#020617] rounded-3xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-4 hover:border-emerald-500/50 transition-all shadow-xs"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm shrink-0 ${
                  index === 0 
                    ? 'bg-amber-500 text-white shadow-amber-500/20' 
                    : (index === 1 
                      ? 'bg-slate-400 text-white' 
                      : (index === 2 
                        ? 'bg-amber-700 text-white' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'))
                }`}>
                  #{index + 1}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-black text-slate-900 dark:text-slate-100 truncate text-base">{colab.nombre}</p>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {colab.cantidad} {colab.cantidad === 1 ? 'venta' : 'ventas'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline mt-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Ticket prom: ${ticketPromedio.toLocaleString('es-CO')}</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">${colab.monto.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {listaColaboradores.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400 text-sm font-medium">
              No hay ventas registradas por colaboradores en el periodo seleccionado ({metaPeriodo.rangoDescriptivo}).
            </div>
          )}
        </div>
      </div>

      <ModalSuscripcion 
        isOpen={modalSuscripcionOpen} 
        onClose={() => setModalSuscripcionOpen(false)} 
        cuentaPrincipalId={cuentaPrincipalId || ""} 
        planInicial={planInicialSuscripcion}
      />
    </div>
  );
}