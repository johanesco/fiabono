"use client";
import { useState, useEffect, useMemo } from "react";
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
  Info,
  X,
  CreditCard,
  Smartphone,
  Layers,
  Zap,
  Lock,
  Percent,
  ShieldAlert
} from 'lucide-react';
import toast from "react-hot-toast";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useRouter } from "next/navigation";

import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import { Cliente, Movimiento } from "../../../types";
import ModalSuscripcion from "@/components/ModalSuscripcion";
import ModalExportarReporte from "@/components/ModalExportarReporte";
import { FileDown } from "lucide-react";

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
  const esAdmin = datosSesion?.rol === 'admin' || !datosSesion?.rol;
  const puedeVerReportes = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verReportes === true;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<Movimiento[]>([]);
  const [separes, setSepares] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);

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
  const [modalExportarOpen, setModalExportarOpen] = useState(false);
  const [planInicialSuscripcion, setPlanInicialSuscripcion] = useState<'comercio' | 'pro'>('pro');
  // Estado del Live Data Inspector — ítem de gráfica actualmente inspeccionado
  const [itemInspeccionado, setItemInspeccionado] = useState<any | null>(null);

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

    // 4. Listener en tiempo real de inventario (para costo y margen de ganancia)
    const qI = query(collection(db, "inventario"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubInv = onSnapshot(qI, (snap) => {
      const lista: any[] = [];
      snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
      setInventario(lista);
    });

    return () => {
      unsubClientes();
      unsubMovs();
      unsubSepares();
      unsubInv();
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
        etiquetaCaja: `Caja Neta (${mesActualNombre})`,
        rangoDescriptivo: `Lo que va de ${mesActualNombre} ${hoyDate.getFullYear()}`,
        badgePeriodo: `${mesActualNombre} ${hoyDate.getFullYear()}`
      };
    }
    if (filtro === 'ano') {
      return {
        etiquetaVentas: `Ventas del ${hoyDate.getFullYear()}`,
        etiquetaFiados: `Fiados del ${hoyDate.getFullYear()}`,
        etiquetaAbonos: `Abonos del ${hoyDate.getFullYear()}`,
        etiquetaCaja: `Caja Neta (${hoyDate.getFullYear()})`,
        rangoDescriptivo: `Lo que va del año ${hoyDate.getFullYear()}`,
        badgePeriodo: `Año ${hoyDate.getFullYear()}`
      };
    }
    return {
      etiquetaVentas: "Ventas Totales",
      etiquetaFiados: "Fiados Totales",
      etiquetaAbonos: "Abonos Totales",
      etiquetaCaja: "Caja Neta (Histórico)",
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

  // Desglose estratégico de ingresos por Métodos de Pago (Ventas de contado + Abonos recibidos)
  const movsIngresos = [...movsVentas, ...movsAbonos];
  const totalEfectivo = movsIngresos
    .filter(m => !m.metodoPago || m.metodoPago === 'efectivo')
    .reduce((acc, m) => acc + (m.monto || 0), 0) - totalEgresos;
  const totalTransferencia = movsIngresos
    .filter(m => m.metodoPago === 'transferencia')
    .reduce((acc, m) => acc + (m.monto || 0), 0);
  const totalDatafono = movsIngresos
    .filter(m => m.metodoPago === 'datafono')
    .reduce((acc, m) => acc + (m.monto || 0), 0);
  const totalCreditoExterno = movsIngresos
    .filter(m => m.metodoPago === 'credito_externo')
    .reduce((acc, m) => acc + (m.monto || 0), 0);

  // Tasa de recuperación de crédito / Salud de cartera (Abonos vs Fiados)
  const ratioRecaudo = totalFiados > 0 ? Math.min(100, Math.round((totalAbonos / totalFiados) * 100)) : 100;

  // Métricas del Plan Separe
  const separesActivos = separes.filter(s => s.estado === 'activo');
  const totalEnSeparesActivos = separesActivos.reduce((a, s) => a + (s.total || 0), 0);
  const abonosEnSeparesActivos = separesActivos.reduce((a, s) => a + (s.montoPagado || 0), 0);
  const saldoPendienteSepares = separesActivos.reduce((a, s) => a + (s.saldoPendiente || 0), 0);

  // Mapa de inventario para cálculo rápido de costos
  const mapaCostosInventario = useMemo(() => {
    const mapa = new Map<string, number>();
    inventario.forEach(p => {
      const costo = Number(p.costoCompra) || 0;
      if (p.id) mapa.set(p.id, costo);
      if (p.nombre) mapa.set(p.nombre.trim().toLowerCase(), costo);
    });
    return mapa;
  }, [inventario]);

  // Cálculo de Costo de Mercancía Vendida (COGS) y Utilidad Bruta Estimada
  const { costoTotalMercanciaVendida, utilidadBrutaEstimada, margenGananciaEstimado, productosConCostoCount } = useMemo(() => {
    let costoTotal = 0;
    let itemsVendidosConCosto = 0;

    movsVentas.forEach(mov => {
      if (Array.isArray(mov.detalles) && mov.detalles.length > 0) {
        mov.detalles.forEach((det: any) => {
          const cantidad = Number(det.cantidad) || 1;
          let costoUnit = Number(det.costoUnitario) || 0;

          if (!costoUnit) {
            if (det.productoId && mapaCostosInventario.has(det.productoId)) {
              costoUnit = mapaCostosInventario.get(det.productoId) || 0;
            } else if (det.descripcion && mapaCostosInventario.has(det.descripcion.trim().toLowerCase())) {
              costoUnit = mapaCostosInventario.get(det.descripcion.trim().toLowerCase()) || 0;
            }
          }

          if (costoUnit > 0) {
            costoTotal += costoUnit * cantidad;
            itemsVendidosConCosto += cantidad;
          }
        });
      }
    });

    const utilidad = Math.max(0, totalVentas - costoTotal);
    const margen = totalVentas > 0 && costoTotal > 0 
      ? Math.round((utilidad / totalVentas) * 100) 
      : (totalVentas > 0 && costoTotal === 0 ? 100 : 0);

    return {
      costoTotalMercanciaVendida: costoTotal,
      utilidadBrutaEstimada: utilidad,
      margenGananciaEstimado: margen,
      productosConCostoCount: itemsVendidosConCosto
    };
  }, [movsVentas, mapaCostosInventario, totalVentas]);

  // Análisis de Cartera y Riesgo de Clientes para el Radar
  const analisisCarteraRiesgo = useMemo(() => {
    const ahoraMs = Date.now();
    let carteraRiesgo = 0;
    let clientesRiesgoCount = 0;

    clientes.forEach((c) => {
      const deuda = c.deudaTotal || 0;
      if (deuda > 0) {
        // Buscar el último abono de este cliente en el historial general
        const abonos = todosMovimientos.filter(
          (m) => m.tipo === 'abono' && (m.clienteId === c.id || (m.clienteNombre && m.clienteNombre.trim().toLowerCase() === c.nombre.trim().toLowerCase()))
        );

        let ultimoAbonoMs = 0;
        abonos.forEach((ab) => {
          const t = ab.fecha?.seconds ? ab.fecha.seconds * 1000 : (ab.fecha?.toDate ? ab.fecha.toDate().getTime() : new Date(ab.fecha).getTime() || 0);
          if (t > ultimoAbonoMs) ultimoAbonoMs = t;
        });

        const diasSinAbono = ultimoAbonoMs > 0 ? Math.floor((ahoraMs - ultimoAbonoMs) / (1000 * 60 * 60 * 24)) : 40;

        if (diasSinAbono > 30) {
          carteraRiesgo += deuda;
          clientesRiesgoCount += 1;
        }
      }
    });

    const carteraSana = Math.max(0, carteraActiva - carteraRiesgo);
    const tasaRecaudo = totalFiados > 0 ? Math.min(100, Math.round((totalAbonos / totalFiados) * 100)) : 100;

    let semaforoRecaudo: 'sano' | 'observacion' | 'alerta' = 'sano';
    let mensajeSemaforo = 'Recaudo saludable: los abonos cobrados respaldan los créditos otorgados.';

    if (totalFiados > 0 && totalAbonos < totalFiados * 0.3) {
      semaforoRecaudo = 'alerta';
      mensajeSemaforo = 'Alerta de cartera: Los fiados otorgados superan ampliamente los abonos recibidos. Prioriza el cobro.';
    } else if (totalFiados > 0 && totalAbonos < totalFiados * 0.7) {
      semaforoRecaudo = 'observacion';
      mensajeSemaforo = 'Recaudo en observación: Abonos por debajo del total de fiados concedidos este periodo.';
    }

    return {
      carteraRiesgo,
      clientesRiesgoCount,
      carteraSana,
      tasaRecaudo,
      semaforoRecaudo,
      mensajeSemaforo
    };
  }, [clientes, todosMovimientos, carteraActiva, totalFiados, totalAbonos]);

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

        {/* Tarjetas de Resumen Nítidas (Métricas reales del negocio) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-amber-500"></div>
            <div>
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Cartera en la Calle</span>
              <p className="text-3xl sm:text-4xl font-black text-amber-500 mt-2">
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
                  <span className="text-3xl font-black text-rose-500">{clientesConCredito}</span>
                  <p className="text-[11px] text-rose-400 font-bold uppercase">Con Crédito</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-3xl shrink-0"><Users size={36} /></div>
          </div>
        </div>

        {/* 4 Métricas Clave Nítidas (Ventas de Hoy, Fiados de Hoy, Abonos de Hoy, Caja Neta) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-100 opacity-90">{metaPeriodo.etiquetaVentas}</span>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0"><ShoppingCart size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4">
              ${totalVentas.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-rose-100 opacity-90">{metaPeriodo.etiquetaFiados}</span>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0"><ShoppingBag size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4">
              ${totalFiados.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-blue-100 opacity-90">{metaPeriodo.etiquetaAbonos}</span>
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0"><Banknote size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4">
              ${totalAbonos.toLocaleString('es-CO')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2rem] shadow-lg flex flex-col justify-between text-white border border-slate-700">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 opacity-90">{metaPeriodo.etiquetaCaja}</span>
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-2xl shrink-0"><TrendingUp size={20} /></div>
            </div>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-4 text-emerald-400">
              ${ingresosCaja.toLocaleString('es-CO')}
            </p>
          </div>
        </div>

        {/* BLOQUE EXCLUSIVO: DESGLOSE POR MÉTODOS DE PAGO (ABREBOCAS DIFUMINADO) */}
        <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-[2rem] sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-5 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0 shadow-xs">
                <Banknote size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Desglose de Métodos de Pago</span>
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30 flex items-center gap-1 shadow-2xs">
                    <Crown size={11} className="fill-current" /> Vista Previa PRO
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribución exacta de Efectivo en gaveta vs Bancos (Nequi, Daviplata, Datáfono).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setPlanInicialSuscripcion('pro'); setModalSuscripcionOpen(true); }}
              className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
            >
              <Crown size={12} className="text-amber-500" /> Desbloquear Arqueo
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px] transition-all hover:border-emerald-500/30">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <Banknote size={15} className="text-emerald-500 shrink-0" /> Efectivo
                </span>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">Gaveta</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white filter blur-xs select-none mt-2 tracking-tight">
                ${Math.max(0, totalEfectivo).toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Billetes y monedas físicas</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px] transition-all hover:border-blue-500/30">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <Smartphone size={15} className="text-blue-500 shrink-0" /> Transferencias
                </span>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">Digital</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white filter blur-xs select-none mt-2 tracking-tight">
                ${totalTransferencia.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Nequi, Daviplata, Bancos</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px] transition-all hover:border-purple-500/30">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <CreditCard size={15} className="text-purple-500 shrink-0" /> Datáfono
                </span>
                <span className="text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.5 rounded">POS</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white filter blur-xs select-none mt-2 tracking-tight">
                ${totalDatafono.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Tarjetas Débito / Crédito</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px] transition-all hover:border-amber-500/30">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <Zap size={15} className="text-amber-500 shrink-0" /> Crédito Ext.
                </span>
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded">Fintech</span>
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white filter blur-xs select-none mt-2 tracking-tight">
                ${totalCreditoExterno.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">SisteCrédito, Addi, etc.</span>
            </div>
          </div>
        </div>

        {/* BLOQUE UTILIDAD Y RENTABILIDAD (ABREBOCAS DIFUMINADO) */}
        <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-[2rem] sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0 shadow-xs">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Utilidad Bruta y Margen Real</span>
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30 flex items-center gap-1 shadow-2xs">
                    <Crown size={11} className="fill-current" /> PRO
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cálculo equivalente a la información diligenciada en tu Inventario (lo que te costó adquirir cada producto vs. el precio en que lo vendes).
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1.5 rounded-xl filter blur-xs select-none shrink-0">
              Margen Estimado: {margenGananciaEstimado}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px]">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Ganancia Bruta Estimada</span>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 filter blur-xs select-none mt-2">
                ${utilidadBrutaEstimada.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Ventas del periodo menos costos</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px]">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Costo de Mercancía</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white filter blur-xs select-none mt-2">
                ${costoTotalMercanciaVendida.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Inversión en inventario vendido</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between min-h-[110px]">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Salud de Margen</span>
              <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 filter blur-xs select-none mt-2">
                {margenGananciaEstimado}% Margen Neto
              </p>
              <span className="text-[10px] text-slate-400 font-medium mt-1">Rentabilidad sobre cada venta</span>
            </div>
          </div>
        </div>

        {/* BLOQUE GRÁFICA DE COMPORTAMIENTO FINANCIERO (ABREBOCAS DIFUMINADO) */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-6 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <BarChart3 className="text-emerald-500" size={22} />
                <span>Comportamiento Financiero y Gráficas</span>
                <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30 flex items-center gap-1 shadow-2xs">
                  <Crown size={11} className="fill-current" /> PRO
                </span>
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Evolución diaria y mensual de ventas de contado vs fiados y recaudos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setPlanInicialSuscripcion('pro'); setModalSuscripcionOpen(true); }}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 active:scale-95"
            >
              <Crown size={14} /> Desbloquear Gráfica Interactiva
            </button>
          </div>

          {/* Gráfica de Barras Simulada con Altura y Proporción Visible */}
          <div className="w-full bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 flex flex-col justify-end gap-3 min-h-[200px]">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Ventas</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Fiados</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Abonos</span>
            </div>
            <div className="w-full h-36 flex items-end justify-between gap-1.5 sm:gap-3 filter blur-xs select-none opacity-85">
              {[45, 65, 30, 85, 95, 55, 75, 40, 90, 60, 80, 100].map((val, idx) => (
                <div key={idx} className="flex-1 flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                  <div className="w-full bg-emerald-500 rounded-t-sm sm:rounded-t-md" style={{ height: `${val}%` }}></div>
                  <div className="w-full bg-rose-500 rounded-t-sm sm:rounded-t-md" style={{ height: `${val * 0.4}%` }}></div>
                  <div className="w-full bg-blue-500 rounded-t-sm sm:rounded-t-md" style={{ height: `${val * 0.6}%` }}></div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1 pt-1 border-t border-slate-200 dark:border-slate-800">
              <span>Ene</span><span>Feb</span><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span>
              <span>Jul</span><span>Ago</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dic</span>
            </div>
          </div>
        </div>

        {/* BLOQUE RENDIMIENTO DE COLABORADORES (ABREBOCAS DIFUMINADO) */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0 shadow-xs">
                <Award size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                  <span>Rendimiento de Colaboradores</span>
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/30 flex items-center gap-1 shadow-2xs">
                    <Crown size={11} className="fill-current" /> PRO
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conoce quién es tu mejor vendedor, comisiones generadas y promedio por venta.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setPlanInicialSuscripcion('pro'); setModalSuscripcionOpen(true); }}
              className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 px-3.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
            >
              <Crown size={12} className="text-amber-500" /> Ver Ranking
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black flex items-center justify-center text-base shadow-sm shrink-0">#1</div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm truncate">Vendedor Estrella</p>
                <p className="text-xs text-emerald-600 font-black filter blur-xs select-none mt-0.5">$3.450.000 • 28 ventas</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 text-white font-black flex items-center justify-center text-base shadow-sm shrink-0">#2</div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm truncate">Cajero Principal</p>
                <p className="text-xs text-emerald-600 font-black filter blur-xs select-none mt-0.5">$2.100.000 • 19 ventas</p>
              </div>
            </div>
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 text-white font-black flex items-center justify-center text-base shadow-sm shrink-0">#3</div>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm truncate">Asesor de Mostrador</p>
                <p className="text-xs text-emerald-600 font-black filter blur-xs select-none mt-0.5">$1.580.000 • 12 ventas</p>
              </div>
            </div>
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

        {/* SELECTOR DE PERIODO GENERAL (HOY / SEMANA / MES / AÑO / TODOS) Y BOTÓN EXPORTAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0 z-10">
          <div className="flex bg-black/50 backdrop-blur-md p-1.5 rounded-2xl w-full sm:w-auto border border-white/15 overflow-x-auto">
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
                className={`flex-1 sm:flex-initial px-3.5 sm:px-4 text-xs font-black py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  filtroGeneral === f.id 
                    ? 'bg-white text-slate-900 shadow-lg scale-105' 
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* BOTÓN EXPORTAR REPORTE (CON BADGE PRO) */}
          <button
            type="button"
            onClick={() => setModalExportarOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs tracking-wide shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer group shrink-0"
          >
            <div className="p-1 rounded-lg bg-slate-950/10 group-hover:scale-110 transition-transform">
              <FileDown size={16} className="stroke-[2.5]" />
            </div>
            <span>Exportar</span>
            <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
              PRO
            </span>
          </button>
        </div>
      </div>

      {/* BLOQUE 1: CARTERA EN LA CALLE & SALUD DE COBRO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Tarjeta Cartera */}
        <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-amber-500"></div>
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-widest block truncate">Cartera en la Calle</span>
            <p className="text-2xl sm:text-3xl font-black text-amber-500 mt-1 truncate">${carteraActiva.toLocaleString('es-CO')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">Deuda total de tus clientes.</p>
          </div>
          <div className="p-3 sm:p-3.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-2xl shrink-0"><Wallet size={28} className="sm:w-[30px] sm:h-[30px]" /></div>
        </div>

        {/* Tarjeta Clientes */}
        <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-slate-800 dark:bg-slate-500"></div>
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-widest block truncate">Directorio de Clientes</span>
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
          <div className="p-3 sm:p-3.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl shrink-0"><Users size={28} className="sm:w-[30px] sm:h-[30px]" /></div>
        </div>

        {/* Tarjeta Eficiencia de Cobro */}
        <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-emerald-500"></div>
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-widest block truncate">Salud de Cartera</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{ratioRecaudo}%</span>
              <span className="text-[11px] font-bold text-slate-400">tasa recaudo</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">Abonos recibidos vs créditos.</p>
          </div>
          <div className="p-3 sm:p-3.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-2xl shrink-0"><Activity size={28} className="sm:w-[30px] sm:h-[30px]" /></div>
        </div>
      </div>

      {/* BLOQUE 2: MÉTRICAS FINANCIERAS DINÁMICAS (HOY / SEMANA / MES / AÑO / HISTÓRICO) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Ventas */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-100 opacity-90 truncate">
                {metaPeriodo.etiquetaVentas}
              </span>
              <span className="inline-block bg-white/25 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/10">
                {countVentas} {countVentas === 1 ? 'venta' : 'ventas'}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shrink-0"><ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
          </div>
          <p className="text-xl sm:text-3xl font-black tracking-tight mt-2 sm:mt-3 truncate">${totalVentas.toLocaleString('es-CO')}</p>
        </div>

        {/* Fiados */}
        <div className="bg-gradient-to-br from-rose-500 to-red-600 p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-rose-100 opacity-90 truncate">
                {metaPeriodo.etiquetaFiados}
              </span>
              <span className="inline-block bg-white/25 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/10">
                {countFiados} {countFiados === 1 ? 'fiado' : 'fiados'}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shrink-0"><ShoppingBag size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
          </div>
          <p className="text-xl sm:text-3xl font-black tracking-tight mt-2 sm:mt-3 truncate">${totalFiados.toLocaleString('es-CO')}</p>
        </div>

        {/* Abonos */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] shadow-lg flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-100 opacity-90 truncate">
                {metaPeriodo.etiquetaAbonos}
              </span>
              <span className="inline-block bg-white/25 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/10">
                {countAbonos} {countAbonos === 1 ? 'abono' : 'abonos'}
              </span>
            </div>
            <div className="p-2 sm:p-2.5 bg-white/20 backdrop-blur-sm rounded-xl shrink-0"><Banknote size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
          </div>
          <p className="text-xl sm:text-3xl font-black tracking-tight mt-2 sm:mt-3 truncate">${totalAbonos.toLocaleString('es-CO')}</p>
        </div>

        {/* Dinero Neto en Caja */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] shadow-lg flex flex-col justify-between text-white border border-slate-700 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-slate-300 opacity-90 truncate">
                {metaPeriodo.etiquetaCaja}
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="inline-block bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold w-max shadow-sm border border-white/5 text-slate-300">
                  {countIngresos} ing.
                </span>
                {totalEgresos > 0 && (
                  <span className="inline-block bg-rose-500/25 text-rose-300 border border-rose-500/30 px-1 py-0.5 rounded-md text-[9px] font-bold truncate">
                    -${totalEgresos.toLocaleString('es-CO')}
                  </span>
                )}
              </div>
            </div>
            <div className="p-2 sm:p-2.5 bg-white/10 backdrop-blur-sm rounded-xl shrink-0"><TrendingUp size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
          </div>
          <p className="text-xl sm:text-3xl font-black tracking-tight mt-2 sm:mt-3 text-emerald-400 truncate">${ingresosCaja.toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* BLOQUE EXCLUSIVO: DESGLOSE POR MÉTODOS DE PAGO (CUADRE DE CAJA) */}
      <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-6 rounded-[2rem] sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              <Banknote size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                Desglose de Métodos de Pago
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-normal">({metaPeriodo.badgePeriodo})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Distribución del dinero ingresado a caja para tu arqueo y cuadre físico vs cuentas bancarias.
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
            Total en Caja: ${ingresosCaja.toLocaleString('es-CO')}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Efectivo */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate min-w-0">
                <Banknote size={13} className="text-emerald-500 shrink-0" /> <span className="truncate">Efectivo</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                {ingresosCaja > 0 ? Math.round((Math.max(0, totalEfectivo) / ingresosCaja) * 100) : 0}%
              </span>
            </div>
            <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              ${Math.max(0, totalEfectivo).toLocaleString('es-CO')}
            </p>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1 font-medium truncate">Billetes en gaveta</span>
          </div>

          {/* 2. Transferencias */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate min-w-0">
                <Smartphone size={13} className="text-blue-500 shrink-0" /> <span className="truncate">Transferencias</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
                {ingresosCaja > 0 ? Math.round((totalTransferencia / ingresosCaja) * 100) : 0}%
              </span>
            </div>
            <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              ${totalTransferencia.toLocaleString('es-CO')}
            </p>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1 font-medium truncate">Nequi / Daviplata</span>
          </div>

          {/* 3. Datáfono */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate min-w-0">
                <CreditCard size={13} className="text-purple-500 shrink-0" /> <span className="truncate">Datáfono</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 shrink-0">
                {ingresosCaja > 0 ? Math.round((totalDatafono / ingresosCaja) * 100) : 0}%
              </span>
            </div>
            <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              ${totalDatafono.toLocaleString('es-CO')}
            </p>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1 font-medium truncate">Tarjetas Débito/Crédito</span>
          </div>

          {/* 4. Crédito Externo */}
          <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate min-w-0">
                <Zap size={13} className="text-amber-500 shrink-0" /> <span className="truncate">Crédito Ext.</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                {ingresosCaja > 0 ? Math.round((totalCreditoExterno / ingresosCaja) * 100) : 0}%
              </span>
            </div>
            <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              ${totalCreditoExterno.toLocaleString('es-CO')}
            </p>
            <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1 font-medium truncate">Addi / SisteCrédito</span>
          </div>
        </div>
      </div>

      {/* BLOQUE EXCLUSIVO ADMINISTRADOR: RENTABILIDAD Y UTILIDAD ESTIMADA */}
      {esAdmin && (
        <div className="bg-white dark:bg-[#0f172a] p-4 sm:p-6 rounded-[2rem] sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
          {/* Cabecera de la sección */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    Utilidad Bruta y Margen de Rentabilidad
                  </h3>
                  <span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                    <Lock size={10} /> Solo Administrador
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cálculo equivalente a la información diligenciada en tu Inventario: lo que te costó cada producto al adquirirlo vs. el precio en que lo vendes ({metaPeriodo.badgePeriodo}).
                </p>
              </div>
            </div>

            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1 rounded-xl shrink-0 self-start sm:self-auto">
              Margen Promedio: {margenGananciaEstimado}%
            </span>
          </div>

          {/* Tarjetas de métricas de Utilidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* 1. Utilidad Bruta Estimada */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ganancia Bruta Estimada
                </span>
                <span className="text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  +{margenGananciaEstimado}%
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight truncate">
                ${utilidadBrutaEstimada.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 font-medium truncate">
                Ventas (${totalVentas.toLocaleString('es-CO')}) - Costo
              </span>
            </div>

            {/* 2. Costo de Mercancía Vendida (COGS) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Costo de Mercancía
                </span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  {productosConCostoCount} un. costeadas
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                ${costoTotalMercanciaVendida.toLocaleString('es-CO')}
              </p>
              <span className="text-[10px] text-slate-400 mt-1 font-medium truncate">
                Inversión en adquisición de lo vendido
              </span>
            </div>

            {/* 3. Retorno / Eficiencia Comercial */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Salud del Margen
                </span>
                <span className="text-[10px] sm:text-xs font-black text-indigo-600 dark:text-indigo-400">
                  {margenGananciaEstimado >= 35 ? '🔥 Óptimo' : margenGananciaEstimado > 0 ? '👍 Estable' : 'ℹ️ Sin costo'}
                </span>
              </div>
              <div className="mt-1 space-y-1.5">
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
                  <div 
                    className="bg-slate-400 dark:bg-slate-600 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, 100 - margenGananciaEstimado))}%` }} 
                    title="Costo de mercancía"
                  />
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, Math.max(0, margenGananciaEstimado))}%` }} 
                    title="Margen de ganancia"
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>Costo: {100 - margenGananciaEstimado}%</span>
                  <span className="text-emerald-600 dark:text-emerald-400">Ganancia: {margenGananciaEstimado}%</span>
                </div>
              </div>
            </div>
          </div>

          {costoTotalMercanciaVendida === 0 && totalVentas > 0 && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <span className="text-[11px] leading-relaxed">
                💡 <strong>Consejo:</strong> Aún no has registrado el costo de compra en algunos de tus productos en <em>Inventario</em>. Diligencia este campo para tener la utilidad exacta en tiempo real.
              </span>
              <button
                type="button"
                onClick={() => router.push('/dashboard/inventario')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] shrink-0 transition cursor-pointer shadow-sm"
              >
                Ir a Inventario →
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* BLOQUE HÍBRIDO: RADAR DE CARTERA & COMPORTAMIENTO DE CLIENTES */}
      <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] sm:rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0 shadow-xs">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Radar de Cartera & Riesgo de Clientes
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Inteligencia Crediticia
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Detección de deudas estancadas (+30 días sin abonar) y tasa de recaudo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/dashboard/clientes')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition cursor-pointer shadow-xs shrink-0"
          >
            <span>Gestionar Clientes & WhatsApp</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Tarjetas del Radar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* 1. Cartera Sana */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Cartera Activa / Sana
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              ${Math.round(analisisCarteraRiesgo.carteraSana).toLocaleString('es-CO')}
            </p>
            <span className="text-[10px] text-emerald-600/90 dark:text-emerald-400/90 font-medium">
              Clientes que abonan con frecuencia (últimos 30d)
            </span>
          </div>

          {/* 2. Cartera en Riesgo */}
          <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                🚨 Dinero en Riesgo
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                {analisisCarteraRiesgo.clientesRiesgoCount} morosos
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              ${Math.round(analisisCarteraRiesgo.carteraRiesgo).toLocaleString('es-CO')}
            </p>
            <span className="text-[10px] text-rose-600/90 dark:text-rose-400/90 font-medium">
              Más de 30 días sin registrar ningún abono
            </span>
          </div>

          {/* 3. Tasa de Recaudo vs Fiados del Periodo */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tasa de Recaudo ({metaPeriodo.badgePeriodo})
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                analisisCarteraRiesgo.semaforoRecaudo === 'alerta'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                  : analisisCarteraRiesgo.semaforoRecaudo === 'observacion'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              }`}>
                {analisisCarteraRiesgo.tasaRecaudo}%
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              ${totalAbonos.toLocaleString('es-CO')}
            </p>
            <span className="text-[10px] text-slate-400 font-medium">
              Cobrado vs ${totalFiados.toLocaleString('es-CO')} fiado
            </span>
          </div>
        </div>

        {/* Semáforo y Alerta de Cartera */}
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
          analisisCarteraRiesgo.semaforoRecaudo === 'alerta'
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
            : analisisCarteraRiesgo.semaforoRecaudo === 'observacion'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-base">
              {analisisCarteraRiesgo.semaforoRecaudo === 'alerta' ? '🚨' : analisisCarteraRiesgo.semaforoRecaudo === 'observacion' ? '⚠️' : '✅'}
            </span>
            <span className="font-semibold leading-tight">
              {analisisCarteraRiesgo.mensajeSemaforo}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/clientes')}
            className="text-[11px] font-black underline shrink-0 cursor-pointer"
          >
            Ver Deudores →
          </button>
        </div>
      </div>

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

        {/* PANEL DE DATOS SELECCIONADOS (ESTABLE Y MODERNO) */}
        <div className="w-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 dark:from-[#090d16] dark:via-[#0f172a] dark:to-[#1e1b4b] rounded-3xl border border-indigo-500/20 dark:border-indigo-500/30 p-4 sm:p-6 min-h-[140px] flex flex-col justify-center relative overflow-hidden transition-all shadow-xl backdrop-blur-md">
          {itemInspeccionado ? (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 relative z-10 animate-in fade-in duration-200">
              {/* Info del Día/Mes */}
              <div className="flex items-center gap-3 w-full md:w-auto border-b md:border-b-0 border-white/10 pb-3 md:pb-0">
                <div className="p-3 bg-indigo-500/25 rounded-2xl text-indigo-300 shrink-0 ring-1 ring-indigo-400/30">
                  <Calendar size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] sm:text-xs font-black text-indigo-300 uppercase tracking-widest truncate">
                      {itemInspeccionado.label}
                    </span>
                    {mejorDiaPeriodo && itemInspeccionado.ventas === mejorDiaPeriodo.ventas && itemInspeccionado.ventas > 0 && (
                      <span className="bg-amber-500/20 text-amber-300 text-[9px] font-black px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1 uppercase tracking-wider shrink-0">
                        <Crown size={10} className="fill-current" /> Récord
                      </span>
                    )}
                  </div>
                  <h4 className="text-base sm:text-xl font-black text-white capitalize leading-tight truncate">
                    {itemInspeccionado.fechaFormato || itemInspeccionado.label}
                  </h4>
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-2 sm:gap-6 w-full md:w-auto items-center">
                <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                  <span className="text-[10px] sm:text-xs uppercase font-black text-emerald-400 block mb-0.5">Ventas</span>
                  <span className="text-sm sm:text-lg font-black text-white block truncate">
                    ${Math.round(itemInspeccionado.ventas).toLocaleString('es-CO')}
                  </span>
                  {itemInspeccionado.countVentas !== undefined && (
                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block truncate">
                      {itemInspeccionado.countVentas} mov.
                    </span>
                  )}
                </div>

                <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                  <span className="text-[10px] sm:text-xs uppercase font-black text-rose-400 block mb-0.5">Fiados</span>
                  <span className="text-sm sm:text-lg font-black text-white block truncate">
                    ${Math.round(itemInspeccionado.fiados).toLocaleString('es-CO')}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block truncate">
                    Crédito
                  </span>
                </div>

                <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                  <span className="text-[10px] sm:text-xs uppercase font-black text-sky-400 block mb-0.5">Abonos</span>
                  <span className="text-sm sm:text-lg font-black text-white block truncate">
                    ${Math.round(itemInspeccionado.abonos).toLocaleString('es-CO')}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold block truncate">
                    Cobrado
                  </span>
                </div>
              </div>
              
              {/* Botón cerrar */}
              <button
                onClick={() => setItemInspeccionado(null)}
                className="absolute top-0 right-0 md:relative md:top-auto md:right-auto p-1.5 md:px-3.5 md:py-2 bg-white/10 hover:bg-white/20 rounded-xl text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Cerrar y volver a vista general"
              >
                <X size={16} />
                <span className="hidden md:inline">Cerrar</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-slate-400 h-full py-4 animate-in fade-in duration-200">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2 ring-1 ring-indigo-500/20">
                <BarChart3 size={20} />
              </div>
              <p className="text-sm sm:text-base font-black text-white">Resumen Interactivo</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">Toca o pasa el cursor sobre cualquier barra de la gráfica para inspeccionar sus ventas, fiados y abonos exactos.</p>
            </div>
          )}
        </div>

        {/* Visualización de Barras Responsive Táctil */}
        <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
          <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3 items-end h-64 sm:h-72 pt-10 pb-2 border-b border-slate-100 dark:border-slate-800 min-w-[520px]">
            {datosGrafica.map((item) => {
              const hVentas = Math.max((item.ventas / maxBarra) * 100, 3);
              const hFiados = Math.max((item.fiados / maxBarra) * 100, 3);
              const hAbonos = Math.max((item.abonos / maxBarra) * 100, 3);
              const esElMejorDia = mejorDiaPeriodo && item.ventas === mejorDiaPeriodo.ventas && item.ventas > 0;
              const estaSeleccionado = itemInspeccionado?.id === item.id;

              return (
                <div 
                  key={item.id || item.label} 
                  onClick={() => setItemInspeccionado(item)}
                  onMouseEnter={() => setItemInspeccionado(item)}
                  className={`flex flex-col items-center h-full justify-end relative min-w-[28px] sm:min-w-[36px] cursor-pointer p-1 rounded-2xl transition-all ${
                    estaSeleccionado 
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500 scale-105 shadow-md' 
                      : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {/* Corona de Mejor Día */}
                  {esElMejorDia && (
                    <div className="absolute -top-7 text-amber-500 animate-bounce flex items-center justify-center pointer-events-none">
                      <Crown size={16} className="fill-current drop-shadow-md text-amber-500" />
                    </div>
                  )}

                  <div className="flex items-end justify-center gap-0.5 sm:gap-1 w-full h-full p-0.5">
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

                  <span className={`text-[10px] font-bold mt-2 truncate w-full text-center ${
                    estaSeleccionado 
                      ? 'text-indigo-600 dark:text-indigo-400 font-black' 
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
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

      <ModalExportarReporte
        isOpen={modalExportarOpen}
        onClose={() => setModalExportarOpen(false)}
        esPro={Boolean(esPro)}
        onSolicitarPro={() => {
          setModalExportarOpen(false);
          setPlanInicialSuscripcion('pro');
          setModalSuscripcionOpen(true);
        }}
        negocioNombre={datosSesion?.nombreNegocio || "Mi Negocio"}
        negocioLogo={datosSesion?.logoNegocio}
        negocioDireccion={datosSesion?.direccionNegocio}
        negocioTelefono={datosSesion?.telefonoNegocio}
        negocioNit={datosSesion?.nitNegocio}
        todosMovimientos={todosMovimientos}
        clientes={clientes}
        separes={separes}
        inventario={inventario}
      />
    </div>
  );
}