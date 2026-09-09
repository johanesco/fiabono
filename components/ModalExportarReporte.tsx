"use client";
import { useState, useMemo } from "react";
import { 
  X, 
  FileSpreadsheet, 
  FileText, 
  Sparkles, 
  Crown, 
  Calendar, 
  CheckCircle2, 
  Download, 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Layers, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  Filter,
  Lock
} from "lucide-react";
import toast from "react-hot-toast";
import { Movimiento, Cliente, Separe } from "@/types";
import { exportarReporteExcel, exportarReportePdf, DatosExportacionReporte } from "@/servicios/exportadorReportes";

interface ModalExportarReporteProps {
  isOpen: boolean;
  onClose: () => void;
  esPro: boolean;
  onSolicitarPro: () => void;
  negocioNombre: string;
  negocioLogo?: string | null;
  negocioDireccion?: string;
  negocioTelefono?: string;
  negocioNit?: string;
  todosMovimientos: Movimiento[];
  clientes: Cliente[];
  separes: Separe[];
  inventario: any[];
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function ModalExportarReporte({
  isOpen,
  onClose,
  esPro,
  onSolicitarPro,
  negocioNombre,
  negocioLogo,
  negocioDireccion,
  negocioTelefono,
  negocioNit,
  todosMovimientos,
  clientes,
  separes,
  inventario,
}: ModalExportarReporteProps) {
  const hoy = new Date();
  
  // Periodo seleccionado
  const [tipoPeriodo, setTipoPeriodo] = useState<'hoy' | 'semana' | 'mes_actual' | 'mes_especifico' | 'rango'>('mes_actual');
  
  // Para mes específico
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(hoy.getMonth());
  const [anoSeleccionado, setAnoSeleccionado] = useState<number>(hoy.getFullYear());
  
  // Para rango personalizado
  const [fechaDesde, setFechaDesde] = useState<string>(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    hoy.toISOString().split('T')[0]
  );

  const [descargando, setDescargando] = useState<'excel' | 'pdf' | null>(null);

  // Auxiliar para convertir Timestamp a Date
  const obtenerFechaJS = (fecha: any): Date => {
    if (!fecha) return new Date();
    if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
    if (fecha.seconds) return new Date(fecha.seconds * 1000);
    return new Date(fecha);
  };

  // Filtrado reactivo de movimientos y definición del rango
  const { movimientosFiltrados, etiquetaPeriodo, rangoFechasTexto } = useMemo(() => {
    let inicio = new Date();
    let fin = new Date();
    let etiqueta = "";
    let textoRango = "";

    if (tipoPeriodo === 'hoy') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
      etiqueta = `Hoy (${hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })})`;
      textoRango = hoy.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } else if (tipoPeriodo === 'semana') {
      const diaSemana = hoy.getDay();
      const diff = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), diff, 0, 0, 0, 0);
      fin = new Date(hoy.getFullYear(), hoy.getMonth(), diff + 6, 23, 59, 59, 999);
      etiqueta = "Esta Semana (Lun - Dom)";
      textoRango = `${inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (tipoPeriodo === 'mes_actual') {
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
      etiqueta = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
      textoRango = `01/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()} - ${fin.getDate()}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    } else if (tipoPeriodo === 'mes_especifico') {
      inicio = new Date(anoSeleccionado, mesSeleccionado, 1, 0, 0, 0, 0);
      fin = new Date(anoSeleccionado, mesSeleccionado + 1, 0, 23, 59, 59, 999);
      etiqueta = `${MESES[mesSeleccionado]} ${anoSeleccionado}`;
      textoRango = `01/${String(mesSeleccionado + 1).padStart(2, '0')}/${anoSeleccionado} - ${fin.getDate()}/${String(mesSeleccionado + 1).padStart(2, '0')}/${anoSeleccionado}`;
    } else if (tipoPeriodo === 'rango') {
      const pDesde = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const pHasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59.999') : new Date();
      inicio = pDesde;
      fin = pHasta;
      etiqueta = `Personalizado (${inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })})`;
      textoRango = `${inicio.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })} al ${fin.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }

    const tInicio = inicio.getTime();
    const tFin = fin.getTime();

    const filtrados = todosMovimientos.filter(m => {
      const f = obtenerFechaJS(m.fecha).getTime();
      return f >= tInicio && f <= tFin;
    });

    return {
      movimientosFiltrados: filtrados,
      etiquetaPeriodo: etiqueta,
      rangoFechasTexto: textoRango
    };
  }, [tipoPeriodo, mesSeleccionado, anoSeleccionado, fechaDesde, fechaHasta, todosMovimientos]);

  // Cálculos consolidados para el reporte
  const metricas = useMemo(() => {
    const ventas = movimientosFiltrados.filter(m => m.tipo === 'venta');
    const fiados = movimientosFiltrados.filter(m => m.tipo === 'fiado');
    const abonos = movimientosFiltrados.filter(m => m.tipo === 'abono');
    const egresos = movimientosFiltrados.filter(m => m.tipo === 'egreso');

    const totalVentas = ventas.reduce((acc, m) => acc + (m.monto || 0), 0);
    const totalFiados = fiados.reduce((acc, m) => acc + (m.monto || 0), 0);
    const totalAbonos = abonos.reduce((acc, m) => acc + (m.monto || 0), 0);
    const totalEgresos = egresos.reduce((acc, m) => acc + (m.monto || 0), 0);
    const cajaNeta = Math.max(0, (totalVentas + totalAbonos) - totalEgresos);

    // Métodos de pago
    const ingresos = [...ventas, ...abonos];
    const efectivo = ingresos
      .filter(m => !m.metodoPago || m.metodoPago === 'efectivo')
      .reduce((acc, m) => acc + (m.monto || 0), 0) - totalEgresos;
    const transferencia = ingresos
      .filter(m => m.metodoPago === 'transferencia')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
    const datafono = ingresos
      .filter(m => m.metodoPago === 'datafono')
      .reduce((acc, m) => acc + (m.monto || 0), 0);
    const creditoExterno = ingresos
      .filter(m => m.metodoPago === 'credito_externo')
      .reduce((acc, m) => acc + (m.monto || 0), 0);

    // Cartera
    const clientesConDeuda = clientes
      .filter(c => (c.deudaTotal || 0) > 0)
      .sort((a, b) => (b.deudaTotal || 0) - (a.deudaTotal || 0));
    const carteraActiva = clientesConDeuda.reduce((acc, c) => acc + (c.deudaTotal || 0), 0);

    // Separes
    const separesActivos = separes.filter(s => s.estado === 'activo');
    const totalEnSepareActivo = separesActivos.reduce((acc, s) => acc + (s.total || 0), 0);
    const saldoPendienteSepares = separesActivos.reduce((acc, s) => acc + (s.saldoPendiente || 0), 0);
    const abonosSeparesActivos = separesActivos.reduce((acc, s) => acc + (s.montoPagado || 0), 0);

    // Cálculo de utilidad y costos a partir de movimientos con detalle
    let costoTotalMercancia = 0;
    movimientosFiltrados.forEach(m => {
      if (m.tipo === 'venta' && Array.isArray(m.detalles)) {
        m.detalles.forEach((det: any) => {
          const prod = inventario.find((i: any) => i.nombre === det.descripcion || i.id === det.id);
          const costoUnit = prod?.precioCosto || 0;
          costoTotalMercancia += costoUnit * (det.cantidad || 1);
        });
      }
    });

    const utilidadBruta = Math.max(0, totalVentas - costoTotalMercancia);
    const margenPorcentaje = totalVentas > 0 ? Math.round((utilidadBruta / totalVentas) * 100) : 0;

    // Ranking de colaboradores en el periodo
    const colabMap: { [key: string]: { nombre: string; monto: number; cantidad: number } } = {};
    movimientosFiltrados.forEach(m => {
      if (m.registradoPor && (m.tipo === 'venta' || m.tipo === 'abono')) {
        if (!colabMap[m.registradoPor]) {
          colabMap[m.registradoPor] = { nombre: m.registradoPor, monto: 0, cantidad: 0 };
        }
        colabMap[m.registradoPor].monto += (m.monto || 0);
        colabMap[m.registradoPor].cantidad += 1;
      }
    });
    const colaboradoresRanking = Object.values(colabMap).sort((a, b) => b.monto - a.monto);

    // Ranking de productos más vendidos en el periodo
    const prodMap: { [key: string]: { nombre: string; cantidad: number; total: number } } = {};
    movimientosFiltrados.forEach(m => {
      if ((m.tipo === 'venta' || m.tipo === 'fiado') && Array.isArray(m.detalles)) {
        m.detalles.forEach((det: any) => {
          const key = det.descripcion || det.nombre || 'Producto';
          if (!prodMap[key]) {
            prodMap[key] = { nombre: key, cantidad: 0, total: 0 };
          }
          prodMap[key].cantidad += (det.cantidad || 1);
          prodMap[key].total += (det.valor || ((det.valorUnitario || 0) * (det.cantidad || 1)));
        });
      }
    });
    const productosEstrella = Object.values(prodMap).sort((a, b) => b.cantidad - a.cantidad);

    return {
      totalVentas,
      cantVentas: ventas.length,
      totalFiados,
      cantFiados: fiados.length,
      totalAbonos,
      cantAbonos: abonos.length,
      totalEgresos,
      cantEgresos: egresos.length,
      cajaNeta,
      desgloseMetodos: {
        efectivo: Math.max(0, efectivo),
        transferencia,
        datafono,
        creditoExterno
      },
      carteraActiva,
      clientesConDeuda,
      separesActivos,
      totalEnSepareActivo,
      saldoPendienteSepares,
      abonosSeparesActivos,
      costoTotalMercancia,
      utilidadBruta,
      margenPorcentaje,
      colaboradoresRanking,
      productosEstrella
    };
  }, [movimientosFiltrados, clientes, separes, inventario]);

  if (!isOpen) return null;

  const prepararDatosReporte = (): DatosExportacionReporte => {
    return {
      nombreNegocio: negocioNombre || 'Mi Negocio',
      logoNegocio: negocioLogo,
      direccionNegocio: negocioDireccion,
      telefonoNegocio: negocioTelefono,
      nitNegocio: negocioNit,
      rangoTexto: `${etiquetaPeriodo} (${rangoFechasTexto})`,
      fechaGeneracion: new Date(),
      totalVentas: metricas.totalVentas,
      countVentas: metricas.cantVentas,
      totalFiados: metricas.totalFiados,
      countFiados: metricas.cantFiados,
      totalAbonos: metricas.totalAbonos,
      countAbonos: metricas.cantAbonos,
      totalEgresos: metricas.totalEgresos,
      countEgresos: metricas.cantEgresos,
      ingresosCaja: metricas.cajaNeta,
      totalEfectivo: metricas.desgloseMetodos.efectivo,
      totalTransferencia: metricas.desgloseMetodos.transferencia,
      totalDatafono: metricas.desgloseMetodos.datafono,
      totalCreditoExterno: metricas.desgloseMetodos.creditoExterno,
      carteraTotal: metricas.carteraActiva,
      totalClientesConDeuda: metricas.clientesConDeuda.length,
      costoTotalMercancia: metricas.costoTotalMercancia,
      utilidadBruta: metricas.utilidadBruta,
      margenPorcentaje: metricas.margenPorcentaje,
      movimientos: movimientosFiltrados,
      clientesConDeuda: metricas.clientesConDeuda,
      separesActivos: metricas.separesActivos,
      totalSeparesActivos: metricas.totalEnSepareActivo,
      abonosSeparesActivos: metricas.abonosSeparesActivos,
      saldoSeparesActivos: metricas.saldoPendienteSepares,
      countSeparesActivos: metricas.separesActivos.length,
      colaboradoresRanking: metricas.colaboradoresRanking,
      productosEstrella: metricas.productosEstrella,
      nombreGenerador: 'Administrador'
    };
  };

  const descargarArchivoBlob = (blob: Blob, nombreArchivo: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ejecutarDescargaExcel = async () => {
    if (!esPro) {
      onSolicitarPro();
      return;
    }
    try {
      setDescargando('excel');
      const datos = prepararDatosReporte();
      const blob = await exportarReporteExcel(datos);
      const nombreSaneado = (negocioNombre || 'negocio').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fechaStr = hoy.toISOString().split('T')[0];
      descargarArchivoBlob(blob, `reporte_contable_${nombreSaneado}_${fechaStr}.xlsx`);
      toast.success("Excel Contable generado con éxito ✨");
    } catch (e: any) {
      console.error("Error al exportar Excel:", e);
      toast.error("No se pudo generar el archivo Excel.");
    } finally {
      setDescargando(null);
    }
  };

  const ejecutarDescargaPdf = async () => {
    if (!esPro) {
      onSolicitarPro();
      return;
    }
    try {
      setDescargando('pdf');
      const datos = prepararDatosReporte();
      const blob = await exportarReportePdf(datos);
      const nombreSaneado = (negocioNombre || 'negocio').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const fechaStr = hoy.toISOString().split('T')[0];
      descargarArchivoBlob(blob, `reporte_ejecutivo_${nombreSaneado}_${fechaStr}.pdf`);
      toast.success("Reporte PDF Ejecutivo generado con éxito ✨");
    } catch (e: any) {
      console.error("Error al exportar PDF:", e);
      toast.error("No se pudo generar el reporte PDF.");
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-[2.5rem] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Premium */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-white/10 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Crown size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">Exportar Reporte Financiero</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-amber-500 text-slate-950">
                  Plan PRO
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                PDF Ejecutivo de alta definición & Excel Contable multi-hoja
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all z-10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Banner si el usuario no es PRO */}
        {!esPro && (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-amber-500 shrink-0" />
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                La exportación contable en PDF y Excel es una herramienta exclusiva del <span className="font-bold">Plan PRO Almacén</span>.
              </p>
            </div>
            <button
              onClick={onSolicitarPro}
              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black tracking-wide flex items-center gap-1.5 transition-all shadow-sm"
            >
              Mejorar a PRO
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Contenido scrolleable */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Selector de Rango / Periodo */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Filter size={14} />
              1. Selecciona el Periodo del Reporte
            </label>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setTipoPeriodo('hoy')}
                className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-center border ${
                  tipoPeriodo === 'hoy'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => setTipoPeriodo('semana')}
                className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-center border ${
                  tipoPeriodo === 'semana'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                Esta Semana
              </button>

              <button
                type="button"
                onClick={() => setTipoPeriodo('mes_actual')}
                className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-center border ${
                  tipoPeriodo === 'mes_actual'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                Mes Actual
              </button>

              <button
                type="button"
                onClick={() => setTipoPeriodo('mes_especifico')}
                className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-center border ${
                  tipoPeriodo === 'mes_especifico'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                Mes Específico
              </button>

              <button
                type="button"
                onClick={() => setTipoPeriodo('rango')}
                className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-center border col-span-2 sm:col-span-1 ${
                  tipoPeriodo === 'rango'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                }`}
              >
                Rango Libre
              </button>
            </div>

            {/* Sub-selectores condicionales */}
            {tipoPeriodo === 'mes_especifico' && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Mes:</label>
                  <select
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    {MESES.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Año:</label>
                  <select
                    value={anoSeleccionado}
                    onChange={(e) => setAnoSeleccionado(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    {[hoy.getFullYear(), hoy.getFullYear() - 1, hoy.getFullYear() - 2, hoy.getFullYear() - 3].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {tipoPeriodo === 'rango' && (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Fecha Desde:</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Fecha Hasta:</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta de Previsualización Inteligente del Periodo */}
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Resumen del Archivo a Generar
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
                {etiquetaPeriodo}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ventas Contado</span>
                <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  ${metricas.totalVentas.toLocaleString('es-CO')}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">{metricas.cantVentas} ventas</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-amber-500 uppercase">Fiados Otorgados</span>
                <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  ${metricas.totalFiados.toLocaleString('es-CO')}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">{metricas.cantFiados} créditos</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-blue-500 uppercase">Abonos Recaudados</span>
                <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  ${metricas.totalAbonos.toLocaleString('es-CO')}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">{metricas.cantAbonos} recaudos</span>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Total en Caja</span>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                  ${metricas.cajaNeta.toLocaleString('es-CO')}
                </p>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">Contado + Abonos</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/50 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
              <div className="flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-500" />
                <span>{movimientosFiltrados.length} movimientos en este periodo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign size={13} className="text-amber-500" />
                <span>Cartera total actual: <b className="text-slate-700 dark:text-slate-200">${metricas.carteraActiva.toLocaleString('es-CO')}</b></span>
              </div>
            </div>
          </div>

          {/* Opciones de Descarga Dual: PDF vs Excel */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
              <Download size={14} />
              2. Selecciona el Formato de Exportación
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Botón Descargar PDF */}
              <button
                type="button"
                onClick={ejecutarDescargaPdf}
                disabled={descargando !== null}
                className="group p-4 rounded-3xl border-2 border-rose-200 dark:border-rose-900/40 bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/20 dark:to-[#0f172a] hover:border-rose-500 dark:hover:border-rose-500 transition-all text-left flex flex-col justify-between relative shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform">
                    <FileText size={24} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                    Ejecutivo
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    Reporte PDF Ejecutivo
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Diseño estético tamaño carta listo para imprimir o enviar a socios. Con membrete, desglose de métodos y cartera morosa.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-rose-100 dark:border-rose-900/30 flex items-center justify-between text-xs font-black text-rose-600 dark:text-rose-400">
                  <span>
                    {descargando === 'pdf' 
                      ? 'Generando PDF...' 
                      : !esPro 
                        ? 'Desbloquear con PRO' 
                        : 'Descargar PDF'}
                  </span>
                  {!esPro ? (
                    <div className="flex items-center gap-1 text-[11px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                      <Lock size={12} /> PRO
                    </div>
                  ) : (
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
              </button>

              {/* Botón Descargar Excel */}
              <button
                type="button"
                onClick={ejecutarDescargaExcel}
                disabled={descargando !== null}
                className="group p-4 rounded-3xl border-2 border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-[#0f172a] hover:border-emerald-500 dark:hover:border-emerald-500 transition-all text-left flex flex-col justify-between relative shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet size={24} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    Contable Multi-Hoja
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Libro Excel Contable (.xlsx)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    4 Hojas con formato profesional: Resumen Ejecutivo, Movimientos del Periodo, Cartera de Clientes y Planes Separe.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between text-xs font-black text-emerald-600 dark:text-emerald-400">
                  <span>
                    {descargando === 'excel' 
                      ? 'Generando Excel...' 
                      : !esPro 
                        ? 'Desbloquear con PRO' 
                        : 'Descargar Excel'}
                  </span>
                  {!esPro ? (
                    <div className="flex items-center gap-1 text-[11px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                      <Lock size={12} /> PRO
                    </div>
                  ) : (
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Garantías de Confidencialidad y Soporte */}
          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-800 flex items-center gap-3">
            <ShieldCheck size={20} className="text-indigo-500 shrink-0" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Los archivos se generan de manera local e instantánea con los datos sincronizados de tu negocio. Totalmente cifrados y compatibles con contadores públicos.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
