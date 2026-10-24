// components/caja/ModalCierreCaja.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, CheckCircle2, AlertTriangle, Calculator, RefreshCw, 
  Send, Printer, ArrowDownRight, ArrowUpRight, Lock, 
  Coins, Smartphone, ChevronDown, ChevronUp, CreditCard,
  Check, CheckSquare, Square, Calendar, Edit3, HelpCircle,
  Clock, History, Sparkles, CheckCheck, Play
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/AuthContext';
import { Movimiento, CierreCaja } from '@/types';
import { 
  obtenerUltimoCierreCaja, 
  obtenerEstadoCaja,
  calcularMetricasCierre, 
  calcularDiferenciaCierre, 
  generarTextoWhatsAppCierre,
  normalizarMetodoPago,
  obtenerDetalleMedioPago
} from '@/utils/cierreCaja';
import { abrirEnlaceWhatsApp } from '@/utils/whatsapp';
import toast from 'react-hot-toast';

interface ModalCierreCajaProps {
  isOpen: boolean;
  onClose: () => void;
  onCierreExitoso?: (cierre: CierreCaja) => void;
}

const DENOMINACIONES_COP = [
  { valor: 100000, label: '$100.000' },
  { valor: 50000, label: '$50.000' },
  { valor: 20000, label: '$20.000' },
  { valor: 10000, label: '$10.000' },
  { valor: 5000, label: '$5.000' },
  { valor: 2000, label: '$2.000' },
  { valor: 1000, label: '$1.000' },
  { valor: 500, label: '$500' },
  { valor: 200, label: '$200' },
  { valor: 100, label: '$100' },
  { valor: 50, label: '$50' }
];

export default function ModalCierreCaja({ isOpen, onClose, onCierreExitoso }: ModalCierreCajaProps) {
  const { datosSesion } = useAuth();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreUsuario = datosSesion?.nombreUsuario || "Cajero";
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const telefonoAdmin = datosSesion?.telefonoAdmin || "";

  // Estados de carga y consulta
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [aperturaActual, setAperturaActual] = useState<CierreCaja | null>(null);
  const [ultimoCierre, setUltimoCierre] = useState<CierreCaja | null>(null);
  const [arqueosParciales, setArqueosParciales] = useState<CierreCaja[]>([]);
  const [movimientosPeriodo, setMovimientosPeriodo] = useState<Movimiento[]>([]);
  const [fechaInicioPeriodo, setFechaInicioPeriodo] = useState<Date>(new Date());

  // Formulario del cierre / apertura
  const [baseInicial, setBaseInicial] = useState<number>(0);
  const [baseInicialInput, setBaseInicialInput] = useState<string>("0");
  const [efectivoContado, setEfectivoContado] = useState<number>(0);
  const [efectivoContadoInput, setEfectivoContadoInput] = useState<string>("");
  const [notas, setNotas] = useState<string>("");

  // Modales secundarios
  const [mostrarModalDenominaciones, setMostrarModalDenominaciones] = useState(false);
  const [cantidadesDenominaciones, setCantidadesDenominaciones] = useState<Record<number, number>>({});
  const [mostrarModalDigitales, setMostrarModalDigitales] = useState(false);
  const [vouchersVerificados, setVouchersVerificados] = useState(false);
  const [transaccionesVerificadasIds, setTransaccionesVerificadasIds] = useState<Record<string, boolean>>({});
  const [mostrarModalHistorialArqueos, setMostrarModalHistorialArqueos] = useState(false);
  const [mostrarModalConfirmarCierre, setMostrarModalConfirmarCierre] = useState(false);
  const [errorEfectivoPendiente, setErrorEfectivoPendiente] = useState(false);
  const [registroRecienteWhatsApp, setRegistroRecienteWhatsApp] = useState<CierreCaja | null>(null);

  // Estados de guardado
  const [guardando, setGuardando] = useState(false);
  const [guardandoApertura, setGuardandoApertura] = useState(false);
  const [guardandoArqueoParcial, setGuardandoArqueoParcial] = useState(false);
  const [cierreGuardado, setCierreGuardado] = useState<CierreCaja | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar modal de cierre de caja con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (mostrarModalConfirmarCierre) setMostrarModalConfirmarCierre(false);
        else if (mostrarModalDenominaciones) setMostrarModalDenominaciones(false);
        else if (mostrarModalDigitales) setMostrarModalDigitales(false);
        else if (mostrarModalHistorialArqueos) setMostrarModalHistorialArqueos(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, mostrarModalConfirmarCierre, mostrarModalDenominaciones, mostrarModalDigitales, mostrarModalHistorialArqueos]);



  // Al abrir el modal, consultar estado de la caja y movimientos
  useEffect(() => {
    if (!isOpen || !cuentaPrincipalId) return;

    const inicializarDatos = async () => {
      setCargandoDatos(true);
      setCierreGuardado(null);
      setEfectivoContado(0);
      setEfectivoContadoInput("");
      setNotas("");
      setCantidadesDenominaciones({});
      setMostrarModalDenominaciones(false);
      setMostrarModalDigitales(false);
      setVouchersVerificados(false);
      setTransaccionesVerificadasIds({});
      setMostrarModalHistorialArqueos(false);
      setMostrarModalConfirmarCierre(false);
      setErrorEfectivoPendiente(false);
      setRegistroRecienteWhatsApp(null);

      try {
        // Carga resiliente: si el índice compuesto en Firestore no está activo, usa fallback sin orderBy
        const traerMovimientos = async () => {
          try {
            return await getDocs(query(
              collection(db, "movimientos"),
              where("usuarioId", "==", cuentaPrincipalId),
              orderBy("fecha", "desc"),
              limit(1000)
            ));
          } catch (errIndex: any) {
            console.warn("Consulta indexada de movimientos con orderBy no disponible, usando fallback:", errIndex?.message || errIndex);
            return await getDocs(query(
              collection(db, "movimientos"),
              where("usuarioId", "==", cuentaPrincipalId)
            ));
          }
        };

        const [estadoCaja, snapMovs] = await Promise.all([
          obtenerEstadoCaja(db, cuentaPrincipalId),
          traerMovimientos()
        ]);

        setCajaAbierta(estadoCaja.estaAbierta);
        setAperturaActual(estadoCaja.aperturaActual);
        setUltimoCierre(estadoCaja.ultimoCierre);
        setArqueosParciales(estadoCaja.arqueosParciales);

        if (estadoCaja.estaAbierta) {
          setBaseInicial(estadoCaja.baseInicial);
          setBaseInicialInput(estadoCaja.baseInicial > 0 ? estadoCaja.baseInicial.toLocaleString('es-CO') : "0");
          setFechaInicioPeriodo(estadoCaja.fechaInicioTurno);
        } else {
          setBaseInicial(0);
          setBaseInicialInput("");
          setFechaInicioPeriodo(estadoCaja.fechaInicioTurno);
        }

        const listaMovs: Movimiento[] = [];
        const timeInicio = estadoCaja.fechaInicioTurno.getTime();

        snapMovs.forEach(d => {
          const m = { id: d.id, ...d.data() } as Movimiento;
          const timeM = m.fecha?.toMillis 
            ? m.fecha.toMillis() 
            : (m.fecha?.seconds ? m.fecha.seconds * 1000 : (m.fecha ? new Date(m.fecha).getTime() : 0));
          
          if (timeM >= timeInicio) {
            listaMovs.push(m);
          }
        });

        // Ordenar cronológicamente
        listaMovs.sort((a, b) => {
          const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : (a.fecha?.seconds ? a.fecha.seconds * 1000 : 0);
          const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : (b.fecha?.seconds ? b.fecha.seconds * 1000 : 0);
          return timeA - timeB;
        });

        setMovimientosPeriodo(listaMovs);
      } catch (error) {
        console.error("Error al inicializar datos de caja:", error);
        toast.error("Error al cargar la información del turno.");
      } finally {
        setCargandoDatos(false);
      }
    };

    inicializarDatos();
  }, [isOpen, cuentaPrincipalId]);

  // Manejador del input de Base Inicial
  const handleBaseChange = (valorStr: string) => {
    const raw = valorStr.replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) : 0;
    setBaseInicial(num);
    setBaseInicialInput(num > 0 ? num.toLocaleString('es-CO') : "");
  };

  // Manejador del input de Efectivo Físico Contado
  const handleEfectivoChange = (valorStr: string) => {
    if (errorEfectivoPendiente) setErrorEfectivoPendiente(false);
    const raw = valorStr.replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) : 0;
    setEfectivoContado(num);
    setEfectivoContadoInput(num > 0 ? num.toLocaleString('es-CO') : (raw === "0" ? "0" : ""));
  };

  // Manejador de cambio en cantidades de denominaciones
  const handleCantidadDenominacionChange = (valorDenominacion: number, cantStr: string) => {
    if (errorEfectivoPendiente) setErrorEfectivoPendiente(false);
    const raw = cantStr.replace(/\D/g, "");
    const cant = raw ? parseInt(raw, 10) : 0;
    
    const nuevasCantidades = {
      ...cantidadesDenominaciones,
      [valorDenominacion]: cant
    };
    setCantidadesDenominaciones(nuevasCantidades);

    // Sumar el total de todas las denominaciones
    let sumaTotal = 0;
    Object.entries(nuevasCantidades).forEach(([val, c]) => {
      sumaTotal += Number(val) * (c || 0);
    });

    setEfectivoContado(sumaTotal);
    setEfectivoContadoInput(sumaTotal > 0 ? sumaTotal.toLocaleString('es-CO') : "");
  };

  // Cálculos matemáticos en tiempo real
  const metricas = useMemo(() => {
    return calcularMetricasCierre(movimientosPeriodo, baseInicial);
  }, [movimientosPeriodo, baseInicial]);

  // Lista de transacciones digitales para auditoría de comprobantes / vouchers
  const transaccionesDigitales = useMemo(() => {
    return movimientosPeriodo.filter((m) => {
      if (
        m.metodoPago === 'ajuste_contable' || 
        m.metodoPago === 'saldo_interno' || 
        m.metodoPago === 'saldo_a_favor' || 
        m.metodoPago === 'separe_liquidado' || 
        m.tipo === 'ingreso_inventario' || 
        m.tipo === 'entrega_separe' || 
        m.subtipo === 'apertura_separe_sin_abono' || 
        (m as any).anulado === true || 
        (Number(m.monto) || 0) <= 0
      ) return false;
      const metodoNorm = normalizarMetodoPago(m.metodoPago, m.subMetodoPago, m.descripcion);
      return metodoNorm !== 'efectivo' && (m.tipo === 'venta' || m.tipo === 'abono');
    });
  }, [movimientosPeriodo]);

  // Métricas de auditoría digital (cotejo de comprobantes y transferencias)
  const { totalDigitalesCount, auditadosCount, pendientesDigitalesCount, todosDigitalesAuditados } = useMemo(() => {
    const total = transaccionesDigitales.length;
    const auditados = transaccionesDigitales.filter(t => transaccionesVerificadasIds[t.id]).length;
    const pendientes = Math.max(0, total - auditados);
    return {
      totalDigitalesCount: total,
      auditadosCount: auditados,
      pendientesDigitalesCount: pendientes,
      todosDigitalesAuditados: total === 0 || (pendientes === 0 && vouchersVerificados)
    };
  }, [transaccionesDigitales, transaccionesVerificadasIds, vouchersVerificados]);

  // Resumen dinámico por canal digital detectado (Nequi, Davivienda, Daviplata, Bancolombia, etc.)
  const canalesAuditados = useMemo(() => {
    const mapa: Record<string, { canal: string; total: number; count: number; icono: string; badgeClase: string }> = {};
    for (const mov of transaccionesDigitales) {
      const detalle = obtenerDetalleMedioPago(mov);
      const canal = detalle.canal;
      if (!mapa[canal]) {
        mapa[canal] = {
          canal,
          total: 0,
          count: 0,
          icono: detalle.icono,
          badgeClase: detalle.badgeClase
        };
      }
      mapa[canal].total += Number(mov.monto || 0);
      mapa[canal].count += 1;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [transaccionesDigitales]);

  const toggleVerificado = (id: string) => {
    setTransaccionesVerificadasIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleMarcarTodosVerificados = () => {
    if (vouchersVerificados) {
      setVouchersVerificados(false);
      setTransaccionesVerificadasIds({});
    } else {
      setVouchersVerificados(true);
      const todos: Record<string, boolean> = {};
      transaccionesDigitales.forEach(m => {
        todos[m.id] = true;
      });
      setTransaccionesVerificadasIds(todos);
    }
  };

  // Saber si el cajero ha ingresado o interactuado con el conteo de efectivo
  const haIngresadoConteo = efectivoContadoInput.trim() !== "";

  const { diferencia, tipoDiferencia } = useMemo(() => {
    return calcularDiferenciaCierre(efectivoContado, metricas.totalEfectivoEsperado, haIngresadoConteo);
  }, [efectivoContado, metricas.totalEfectivoEsperado, haIngresadoConteo]);

  // 1. Guardar APERTURA DE CAJA (Iniciar turno y guardar base)
  const guardarAperturaCaja = async () => {
    if (!cuentaPrincipalId) return;

    setGuardandoApertura(true);
    try {
      const ahora = new Date();
      const nuevaApertura: Omit<CierreCaja, 'id'> = {
        usuarioId: cuentaPrincipalId,
        tipoRegistro: 'apertura',
        cerradoPorUid: datosSesion?.uid || "",
        cerradoPorNombre: nombreUsuario,
        fechaApertura: Timestamp.fromDate(ahora),
        fechaCierre: Timestamp.fromDate(ahora),
        baseInicial,
        ventasEfectivo: 0,
        abonosEfectivo: 0,
        egresosEfectivo: 0,
        devolucionesEfectivo: 0,
        totalEfectivoEsperado: baseInicial,
        totalEfectivoReal: baseInicial,
        diferencia: 0,
        tipoDiferencia: 'exacto',
        desgloseDigitales: { nequi: 0, daviplata: 0, datafono: 0, bancolombia: 0, transferencia: 0, otros: 0 },
        totalVentasDigitales: 0,
        totalRecaudadoGeneral: 0,
        totalTransacciones: 0,
        notas: notas.trim() || 'Apertura de turno',
        creadoEn: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "cierres_caja"), nuevaApertura);
      const aperturaCompleta: CierreCaja = {
        id: docRef.id,
        ...nuevaApertura
      };

      setCajaAbierta(true);
      setAperturaActual(aperturaCompleta);
      setFechaInicioPeriodo(ahora);
      setRegistroRecienteWhatsApp(aperturaCompleta);
      toast.success(`¡Caja abierta con base de $${baseInicial.toLocaleString('es-CO')}!`);
    } catch (error: any) {
      console.error("Error al abrir caja:", error);
      toast.error(error?.message || "Ocurrió un error al abrir la caja.");
    } finally {
      setGuardandoApertura(false);
    }
  };

  // 2. Guardar ARQUEO PARCIAL (Guardado de control intermedio sin cerrar caja)
  const guardarArqueoParcial = async () => {
    if (!cuentaPrincipalId) return;

    if (!haIngresadoConteo) {
      setErrorEfectivoPendiente(true);
      return;
    }

    setGuardandoArqueoParcial(true);
    try {
      const ahora = new Date();
      const nuevoArqueo: Omit<CierreCaja, 'id'> = {
        usuarioId: cuentaPrincipalId,
        tipoRegistro: 'arqueo_parcial',
        cerradoPorUid: datosSesion?.uid || "",
        cerradoPorNombre: nombreUsuario,
        fechaApertura: Timestamp.fromDate(fechaInicioPeriodo),
        fechaCierre: Timestamp.fromDate(ahora),
        baseInicial: metricas.baseInicial,
        ventasEfectivo: metricas.ventasEfectivo,
        abonosEfectivo: metricas.abonosEfectivo,
        egresosEfectivo: metricas.egresosEfectivo,
        devolucionesEfectivo: metricas.devolucionesEfectivo,
        totalEfectivoEsperado: metricas.totalEfectivoEsperado,
        totalEfectivoReal: efectivoContado,
        diferencia,
        tipoDiferencia: tipoDiferencia === 'pendiente' ? 'exacto' : tipoDiferencia,
        desgloseDigitales: metricas.desgloseDigitales,
        totalVentasDigitales: metricas.totalVentasDigitales,
        totalRecaudadoGeneral: metricas.totalRecaudadoGeneral,
        totalTransacciones: metricas.totalTransacciones,
        vouchersVerificados: todosDigitalesAuditados,
        vouchersAuditadosCount: auditadosCount,
        vouchersPendientesCount: pendientesDigitalesCount,
        estadoAuditoriaDigital: totalDigitalesCount === 0 ? 'sin_digitales' : (todosDigitalesAuditados ? 'completo' : 'pendiente'),
        notas: notas.trim(),
        desgloseDenominaciones: cantidadesDenominaciones,
        creadoEn: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "cierres_caja"), nuevoArqueo);
      const arqueoCompleto: CierreCaja = {
        id: docRef.id,
        ...nuevoArqueo
      };

      setArqueosParciales(prev => [arqueoCompleto, ...prev]);
      setRegistroRecienteWhatsApp(arqueoCompleto);
      toast.success("¡Arqueo parcial guardado! La caja sigue abierta.");
    } catch (error: any) {
      console.error("Error al guardar arqueo parcial:", error);
      toast.error("Ocurrió un error al registrar el arqueo parcial.");
    } finally {
      setGuardandoArqueoParcial(false);
    }
  };

  // 3. Solicitar y Guardar CIERRE DEFINITIVO (Finalizar turno)
  const solicitarCierreDefinitivo = () => {
    if (!haIngresadoConteo) {
      setErrorEfectivoPendiente(true);
      return;
    }
    setMostrarModalConfirmarCierre(true);
  };

  const ejecutarCierreDefinitivo = async () => {
    if (!cuentaPrincipalId) return;

    setGuardando(true);
    try {
      const ahora = new Date();
      const nuevoCierre: Omit<CierreCaja, 'id'> = {
        usuarioId: cuentaPrincipalId,
        tipoRegistro: 'cierre',
        cerradoPorUid: datosSesion?.uid || "",
        cerradoPorNombre: nombreUsuario,
        fechaApertura: Timestamp.fromDate(fechaInicioPeriodo),
        fechaCierre: Timestamp.fromDate(ahora),
        baseInicial: metricas.baseInicial,
        ventasEfectivo: metricas.ventasEfectivo,
        abonosEfectivo: metricas.abonosEfectivo,
        egresosEfectivo: metricas.egresosEfectivo,
        devolucionesEfectivo: metricas.devolucionesEfectivo,
        totalEfectivoEsperado: metricas.totalEfectivoEsperado,
        totalEfectivoReal: efectivoContado,
        diferencia,
        tipoDiferencia: tipoDiferencia === 'pendiente' ? 'exacto' : tipoDiferencia,
        desgloseDigitales: metricas.desgloseDigitales,
        totalVentasDigitales: metricas.totalVentasDigitales,
        totalRecaudadoGeneral: metricas.totalRecaudadoGeneral,
        totalTransacciones: metricas.totalTransacciones,
        vouchersVerificados: todosDigitalesAuditados,
        vouchersAuditadosCount: auditadosCount,
        vouchersPendientesCount: pendientesDigitalesCount,
        estadoAuditoriaDigital: totalDigitalesCount === 0 ? 'sin_digitales' : (todosDigitalesAuditados ? 'completo' : 'pendiente'),
        notas: notas.trim(),
        desgloseDenominaciones: cantidadesDenominaciones,
        creadoEn: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "cierres_caja"), nuevoCierre);
      const cierreCompleto: CierreCaja = {
        id: docRef.id,
        ...nuevoCierre
      };

      setCierreGuardado(cierreCompleto);
      setCajaAbierta(false);
      toast.success("¡Cierre de caja guardado con éxito!");
      if (onCierreExitoso) {
        onCierreExitoso(cierreCompleto);
      }
    } catch (error: any) {
      console.error("Error al guardar cierre de caja:", error);
      toast.error(error?.message || "Ocurrió un error al guardar el cierre.");
    } finally {
      setGuardando(false);
    }
  };

  // Compartir registro (Cierre, Apertura o Arqueo) por WhatsApp
  const compartirWhatsAppRegistro = (registro: CierreCaja | null) => {
    if (!registro) return;
    const fechaTxt = new Date().toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    const fInicio = registro.fechaApertura?.toDate ? registro.fechaApertura.toDate() : fechaInicioPeriodo;
    const fFin = registro.fechaCierre?.toDate ? registro.fechaCierre.toDate() : new Date();
    const rangoTxt = `${fInicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })} a ${fFin.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

    const texto = generarTextoWhatsAppCierre({
      negocioNombre: nombreNegocio,
      cierre: registro,
      fechaTexto: fechaTxt,
      rangoTexto: rangoTxt
    });

    const destino = telefonoAdmin || datosSesion?.telefonoNegocio || datosSesion?.datosUsuarioOriginales?.celular || "";
    abrirEnlaceWhatsApp(destino, texto);
  };

  // Imprimir ticket térmico
  const imprimirTicket = () => {
    if (!cierreGuardado) return;
    const ventanaimpresion = window.open('', '_blank', 'width=350,height=600');
    if (!ventanaimpresion) {
      toast.error("Por favor habilita las ventanas emergentes para imprimir.");
      return;
    }

    const fechaAperturaTxt = fechaInicioPeriodo.toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
    });
    const fechaCierreTxt = new Date().toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
    });

    let estadoCuadreTxt = "Cuadre Exacto ($0)";
    if (cierreGuardado.tipoDiferencia === 'sobrante') {
      estadoCuadreTxt = `Sobrante: +$${Math.abs(cierreGuardado.diferencia).toLocaleString('es-CO')}`;
    } else if (cierreGuardado.tipoDiferencia === 'faltante') {
      estadoCuadreTxt = `Faltante: -$${Math.abs(cierreGuardado.diferencia).toLocaleString('es-CO')}`;
    }

    ventanaimpresion.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cierre de Caja - ${nombreNegocio}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #000;
            background: #fff;
            padding: 12px;
            margin: 0;
            width: 100%;
            max-width: 320px;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .title { font-size: 15px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
          .subtitle { font-size: 11px; margin-bottom: 5px; }
          .highlight { font-size: 13px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="title">${nombreNegocio}</div>
          <div class="subtitle">CIERRE DE CAJA / ARQUEO DE TURNO</div>
          <div style="font-size: 10px;">ID: ${cierreGuardado.id || 'N/A'}</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Cajero:</span><span class="bold">${cierreGuardado.cerradoPorNombre}</span></div>
        <div class="row"><span>Apertura:</span><span>${fechaAperturaTxt}</span></div>
        <div class="row"><span>Cierre:</span><span>${fechaCierreTxt}</span></div>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">ARQUEO DE EFECTIVO:</div>
        <div class="row"><span>Base Inicial:</span><span>$${(cierreGuardado.baseInicial || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(+) Ventas Efectivo:</span><span>$${(cierreGuardado.ventasEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(+) Abonos Efectivo:</span><span>$${(cierreGuardado.abonosEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(-) Egresos / Gastos:</span><span>-$${(cierreGuardado.egresosEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="row"><span>(-) Devoluciones:</span><span>-$${(cierreGuardado.devolucionesEfectivo || 0).toLocaleString('es-CO')}</span></div>
        <div class="divider"></div>
        <div class="row highlight"><span>EFECTIVO ESPERADO:</span><span>$${cierreGuardado.totalEfectivoEsperado.toLocaleString('es-CO')}</span></div>
        <div class="row highlight"><span>EFECTIVO CONTADO:</span><span>$${cierreGuardado.totalEfectivoReal.toLocaleString('es-CO')}</span></div>
        <div class="row bold" style="margin-top: 4px;"><span>DIFERENCIA:</span><span>${estadoCuadreTxt}</span></div>
        
        ${cierreGuardado.totalVentasDigitales > 0 ? `
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 4px;">RECAUDO DIGITAL (BANCOS):</div>
          ${cierreGuardado.desgloseDigitales?.nequi ? `<div class="row"><span>Nequi:</span><span>$${cierreGuardado.desgloseDigitales.nequi.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierreGuardado.desgloseDigitales?.daviplata ? `<div class="row"><span>Daviplata:</span><span>$${cierreGuardado.desgloseDigitales.daviplata.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierreGuardado.desgloseDigitales?.datafono ? `<div class="row"><span>Datáfono / Tarjetas:</span><span>$${cierreGuardado.desgloseDigitales.datafono.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierreGuardado.desgloseDigitales?.bancolombia ? `<div class="row"><span>Bancolombia:</span><span>$${cierreGuardado.desgloseDigitales.bancolombia.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierreGuardado.desgloseDigitales?.transferencia ? `<div class="row"><span>Transferencias:</span><span>$${cierreGuardado.desgloseDigitales.transferencia.toLocaleString('es-CO')}</span></div>` : ''}
          ${cierreGuardado.desgloseDigitales?.otros ? `<div class="row"><span>Otros Digitales:</span><span>$${cierreGuardado.desgloseDigitales.otros.toLocaleString('es-CO')}</span></div>` : ''}
          <div class="row bold"><span>Total Digital:</span><span>$${cierreGuardado.totalVentasDigitales.toLocaleString('es-CO')}</span></div>
        ` : ''}

        <div class="divider"></div>
        <div class="row highlight"><span>TOTAL RECAUDADO:</span><span>$${cierreGuardado.totalRecaudadoGeneral.toLocaleString('es-CO')}</span></div>
        <div class="row"><span>Total Movimientos:</span><span>${cierreGuardado.totalTransacciones}</span></div>
        
        ${cierreGuardado.notas ? `
          <div class="divider"></div>
          <div style="font-size: 10px; word-break: break-word;">Notas: ${cierreGuardado.notas}</div>
        ` : ''}
        
        <div class="divider"></div>
        <div class="text-center" style="font-size: 10px; margin-top: 8px;">
          Fiabono - Sistema de Gestión Comercial
        </div>
      </body>
      </html>
    `);

    ventanaimpresion.document.close();
    ventanaimpresion.focus();
    setTimeout(() => {
      ventanaimpresion.print();
    }, 250);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto pb-safe">
      {/* CONTENEDOR MODAL: 2 columnas en desktop para evitar todo scroll */}
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-lg md:max-w-4xl max-h-[90dvh] md:max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 my-auto overflow-hidden">
        
        {/* CABECERA COMPACTA */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              cajaAbierta 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              <Calculator size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                Cierre de Caja y Arqueo
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-slate-300 truncate">
                  Cajero: <span className="font-bold text-amber-400">{nombreUsuario}</span>
                </p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border inline-flex items-center gap-1 shrink-0 whitespace-nowrap ${
                  cajaAbierta
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cajaAbierta ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {cajaAbierta ? 'Caja Abierta' : 'Sin Apertura'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-3 sm:p-5 pb-8 sm:pb-5 overflow-y-auto md:overflow-visible flex-1 text-slate-800 dark:text-slate-100">
          
          {cargandoDatos ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw size={26} className="animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Consultando estado de la caja y movimientos...</p>
            </div>
          ) : cierreGuardado ? (
            /* VISTA DE ÉXITO POST-CIERRE */
            <div className="py-6 max-w-md mx-auto flex flex-col items-center text-center space-y-3 animate-in fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-lg">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  ¡Cierre de Caja Finalizado!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  El turno ha sido auditado y registrado correctamente.
                </p>
              </div>

              {/* Tarjeta de Resumen Final */}
              <div className="w-full bg-slate-50 dark:bg-[#1e293b]/50 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-left space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Efectivo Esperado:</span>
                  <span className="font-bold">${cierreGuardado.totalEfectivoEsperado.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Efectivo Real Contado:</span>
                  <span className="font-bold">${cierreGuardado.totalEfectivoReal.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold">Estado de Caja:</span>
                  <span className={`font-black uppercase text-[11px] px-2 py-0.5 rounded-md ${
                    cierreGuardado.tipoDiferencia === 'exacto'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : cierreGuardado.tipoDiferencia === 'sobrante'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                  }`}>
                    {cierreGuardado.tipoDiferencia === 'exacto' 
                      ? 'Cuadre Exacto' 
                      : (cierreGuardado.tipoDiferencia === 'sobrante' 
                        ? `Sobrante: +$${Math.abs(cierreGuardado.diferencia).toLocaleString('es-CO')}` 
                        : `Faltante: -$${Math.abs(cierreGuardado.diferencia).toLocaleString('es-CO')}`)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold">Total Recaudado (Turno):</span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                    ${cierreGuardado.totalRecaudadoGeneral.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              {/* Botones de acción post-cierre */}
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => compartirWhatsAppRegistro(cierreGuardado)}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Send size={14} /> Enviar a WhatsApp
                </button>
                <button
                  type="button"
                  onClick={imprimirTicket}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                  <Printer size={14} /> Imprimir Ticket
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>
          ) : (
            /* FORMULARIO DE CIERRE: 2 COLUMNAS EN DESKTOP (SIN SCROLL) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 items-stretch">
              
              {/* COLUMNA IZQUIERDA: FLUJO Y MATEMÁTICA DEL TURNO */}
              <div className="space-y-3 flex flex-col justify-between">
                
                {/* Rango del Turno */}
                <div className="bg-slate-50 dark:bg-[#1e293b]/40 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${cajaAbierta ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        {cajaAbierta ? 'Turno en Curso:' : 'Nuevo Turno:'}
                      </span>
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {fechaInicioPeriodo.toLocaleString('es-CO', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Transacciones:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400">
                      {metricas.totalTransacciones} movs
                    </span>
                  </div>
                </div>

                {/* 1. Base Inicial (Con Apertura Persistente) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      1. Base Inicial de Caja (Menudo)
                    </label>
                    {cajaAbierta && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800/60">
                        ✓ Base Guardada
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={baseInicialInput}
                      onChange={(e) => handleBaseChange(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>

                  {/* Botón rápido para abrir caja si aún no está abierta */}
                  {!cajaAbierta && (
                    <div className="pt-0.5 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        Abre caja para guardar esta base durante el día
                      </span>
                      <button
                        type="button"
                        onClick={guardarAperturaCaja}
                        disabled={guardandoApertura}
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {guardandoApertura ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <Play size={10} className="fill-emerald-600 dark:fill-emerald-400" />
                        )}
                        Guardar y Abrir Caja
                      </button>
                    </div>
                  )}
                </div>

                {/* Flujo de Efectivo en Gaveta */}
                <div className="bg-slate-50 dark:bg-[#090d16] p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase pb-1 border-b border-slate-200/60 dark:border-slate-800">
                    <span>Flujo de Efectivo Físico</span>
                    <span>Monto</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>Base Inicial:</span>
                    <span className="font-bold">${metricas.baseInicial.toLocaleString('es-CO')}</span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1"><ArrowUpRight size={13} /> (+) Ventas en Efectivo:</span>
                    <span className="font-bold">${metricas.ventasEfectivo.toLocaleString('es-CO')}</span>
                  </div>

                  <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                    <span className="flex items-center gap-1"><ArrowUpRight size={13} /> (+) Abonos en Efectivo:</span>
                    <span className="font-bold">${metricas.abonosEfectivo.toLocaleString('es-CO')}</span>
                  </div>

                  {metricas.egresosEfectivo > 0 && (
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span className="flex items-center gap-1"><ArrowDownRight size={13} /> (-) Egresos / Gastos:</span>
                      <span className="font-bold">-${metricas.egresosEfectivo.toLocaleString('es-CO')}</span>
                    </div>
                  )}

                  {metricas.devolucionesEfectivo > 0 && (
                    <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
                      <span className="flex items-center gap-1"><ArrowDownRight size={13} /> (-) Devoluciones Efectivo:</span>
                      <span className="font-bold">-${metricas.devolucionesEfectivo.toLocaleString('es-CO')}</span>
                    </div>
                  )}

                  {/* Total Efectivo Esperado */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 block">
                        Efectivo Esperado
                      </span>
                      <span className="text-[10px] text-slate-400">Debe haber en gaveta</span>
                    </div>
                    <span className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
                      ${metricas.totalEfectivoEsperado.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>

                {/* Tarjeta de Recaudo Digital y Comprobantes (Bancos & Datáfono) - SIEMPRE VISIBLE */}
                <div className="bg-slate-50 dark:bg-[#090d16] p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                      <CreditCard size={14} className="text-indigo-500" />
                      <span>Recaudo Digital y Vouchers</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
                      Bancos & Tarjetas
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-[11px]">Total Recaudado en Bancos:</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      ${metricas.totalVentasDigitales.toLocaleString('es-CO')}
                    </span>
                  </div>

                  {metricas.totalVentasDigitales > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {(metricas.desgloseDigitales.nequi || 0) > 0 && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800/60">
                          🟣 Nequi: ${(metricas.desgloseDigitales.nequi || 0).toLocaleString('es-CO')}
                        </span>
                      )}
                      {(metricas.desgloseDigitales.daviplata || 0) > 0 && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                          🔴 Daviplata: ${(metricas.desgloseDigitales.daviplata || 0).toLocaleString('es-CO')}
                        </span>
                      )}
                      {(metricas.desgloseDigitales.bancolombia || 0) > 0 && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          🟡 Bancolombia: ${(metricas.desgloseDigitales.bancolombia || 0).toLocaleString('es-CO')}
                        </span>
                      )}
                      {(metricas.desgloseDigitales.datafono || 0) > 0 && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                          💳 Datáfono: ${(metricas.desgloseDigitales.datafono || 0).toLocaleString('es-CO')}
                        </span>
                      )}
                      {((metricas.desgloseDigitales.transferencia || 0) + (metricas.desgloseDigitales.otros || 0)) > 0 && (
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                          🏦 Otras transf: ${((metricas.desgloseDigitales.transferencia || 0) + (metricas.desgloseDigitales.otros || 0)).toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Estado de auditoría de vouchers */}
                  <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">
                      {vouchersVerificados ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Comprobantes cotejados
                        </span>
                      ) : metricas.totalVentasDigitales > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} /> {transaccionesDigitales.length} vouchers por cotejar
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Sin movimientos en este turno</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMostrarModalDigitales(true)}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer text-xs"
                    >
                      <CreditCard size={12} /> {metricas.totalVentasDigitales > 0 ? 'Auditar Vouchers' : 'Ver Canales'}
                    </button>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: CONTEO FÍSICO, CUADRE Y FINALIZACIÓN */}
              <div className="space-y-3 flex flex-col justify-between">
                
                {/* 2. Efectivo Real Contado */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      2. Efectivo Real Contado (Gaveta) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setMostrarModalDenominaciones(true)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Coins size={12} /> Desglosar billetes
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={efectivoContadoInput}
                      onChange={(e) => handleEfectivoChange(e.target.value)}
                      className={`w-full pl-8 pr-3 py-2 bg-white dark:bg-[#020617] border-2 rounded-xl font-black text-slate-900 dark:text-white text-lg sm:text-xl outline-none transition-all shadow-inner ${
                        errorEfectivoPendiente && !haIngresadoConteo
                          ? 'border-amber-500 focus:border-amber-600 ring-2 ring-amber-500/20'
                          : 'border-indigo-500/40 focus:border-indigo-600'
                      }`}
                    />
                  </div>

                  {/* Mensaje estético elegante si intenta guardar/cerrar sin contar efectivo */}
                  {errorEfectivoPendiente && !haIngresadoConteo && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                      <AlertTriangle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="font-medium text-[11px]">
                        Ingresa el efectivo contado en gaveta antes de cerrar o arquear el turno.
                      </span>
                    </div>
                  )}
                </div>

                {/* Banner de Estado de Cuadre */}
                <div className={`p-3 rounded-2xl border transition-all ${
                  tipoDiferencia === 'pendiente'
                    ? 'bg-slate-50 dark:bg-[#1e293b]/40 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    : tipoDiferencia === 'exacto'
                      ? (todosDigitalesAuditados
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-300')
                      : tipoDiferencia === 'sobrante'
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800/60 text-blue-800 dark:text-blue-300'
                        : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {tipoDiferencia === 'pendiente' ? (
                        <HelpCircle size={18} className="text-slate-400 shrink-0" />
                      ) : tipoDiferencia === 'exacto' ? (
                        todosDigitalesAuditados ? (
                          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        )
                      ) : (
                        <AlertTriangle size={18} className={tipoDiferencia === 'sobrante' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'} />
                      )}
                      <div>
                        <span className="font-black text-xs block">
                          {tipoDiferencia === 'pendiente'
                            ? 'Pendiente de conteo en gaveta'
                            : tipoDiferencia === 'exacto' 
                              ? (todosDigitalesAuditados 
                                  ? '¡Cuadre Total Exacto! (Efectivo y Digital)' 
                                  : `Efectivo Cuadrado · ${pendientesDigitalesCount} transferencias por validar`)
                              : (tipoDiferencia === 'sobrante' ? 'Sobrante en Gaveta' : 'Faltante en Gaveta')}
                        </span>
                        <span className="text-[10px] opacity-80 block">
                          {tipoDiferencia === 'pendiente'
                            ? 'Ingresa el efectivo contado para verificar el cuadre.'
                            : tipoDiferencia === 'exacto'
                              ? (todosDigitalesAuditados
                                  ? 'El efectivo físico y los comprobantes digitales coinciden plenamente.'
                                  : 'El efectivo coincide, pero faltan cotejar vouchers con la app bancaria.')
                              : (tipoDiferencia === 'sobrante'
                                ? 'Hay más efectivo del esperado en ventas.'
                                : 'Hay menos dinero del esperado.')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm sm:text-base font-black block">
                        {tipoDiferencia === 'pendiente'
                          ? '--'
                          : tipoDiferencia === 'exacto'
                            ? '$0'
                            : `${diferencia > 0 ? '+' : '-'}$${Math.abs(diferencia).toLocaleString('es-CO')}`}
                      </span>

                      {/* Botón rápido si recién inicia y el efectivo en gaveta es la misma base inicial */}
                      {tipoDiferencia === 'pendiente' && metricas.baseInicial > 0 && metricas.ventasEfectivo === 0 && (
                        <button
                          type="button"
                          onClick={() => handleEfectivoChange(metricas.baseInicial.toString())}
                          className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                        >
                          Tengo la base (${metricas.baseInicial.toLocaleString('es-CO')})
                        </button>
                      )}

                      {tipoDiferencia === 'exacto' && !todosDigitalesAuditados && (
                        <button
                          type="button"
                          onClick={() => setMostrarModalDigitales(true)}
                          className="text-[10px] text-amber-700 dark:text-amber-300 font-bold hover:underline cursor-pointer flex items-center gap-0.5 justify-end"
                        >
                          Auditar ahora
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banner de envío rápido a WhatsApp para Apertura o Arqueo Parcial recién guardado */}
                {registroRecienteWhatsApp && (
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <Check size={14} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 block truncate">
                          {registroRecienteWhatsApp.tipoRegistro === 'apertura' ? '¡Apertura Registrada!' : '¡Arqueo Parcial Registrado!'}
                        </span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">
                          ¿Deseas enviar el reporte al WhatsApp del negocio?
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => compartirWhatsAppRegistro(registroRecienteWhatsApp)}
                        className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Send size={11} /> WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegistroRecienteWhatsApp(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Descartar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Historial de Arqueos Parciales Realizados en este Turno */}
                {arqueosParciales.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarModalHistorialArqueos(true)}
                    className="w-full py-2 px-3 bg-amber-50/80 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-amber-600 dark:text-amber-400" />
                      <span>Arqueos Parciales del Turno ({arqueosParciales.length})</span>
                    </span>
                    <span className="text-[10px] underline">Ver cortes guardados</span>
                  </button>
                )}

                {/* Resumen Total Global (Efectivo + Digital) */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                      Total Recaudado en Turno
                    </span>
                    <span className="text-[10px] text-slate-400">Efectivo Real + Recaudo Digital</span>
                  </div>
                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm sm:text-base">
                    ${(efectivoContado + metricas.totalVentasDigitales - metricas.egresosEfectivo - metricas.devolucionesEfectivo).toLocaleString('es-CO')}
                  </span>
                </div>

                {/* Observaciones (Input Compacto) */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Observaciones (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Turno entregado sin novedad, pago de domicilios..."
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Botones de Acción: Arqueo Parcial vs Cierre Definitivo */}
                <div className="space-y-2 pt-1 pb-4 sm:pb-0">
                  {cajaAbierta ? (
                    <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={guardarArqueoParcial}
                        disabled={guardandoArqueoParcial || guardando}
                        className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border border-amber-300/80 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Guarda este conteo como registro de control sin cerrar la caja"
                      >
                        {guardandoArqueoParcial ? (
                          <RefreshCw size={14} className="animate-spin text-amber-600" />
                        ) : (
                          <>
                            <Clock size={15} /> Arqueo Parcial
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={solicitarCierreDefinitivo}
                        disabled={guardando || guardandoArqueoParcial}
                        className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {guardando ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <Lock size={15} /> Cerrar Turno
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-1.5 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      Cerrar Ventana (Seguir trabajando)
                    </button>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="py-2.5 px-3 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={guardarAperturaCaja}
                        disabled={guardandoApertura}
                        className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {guardandoApertura ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <>
                            <Play size={14} className="fill-white" /> Iniciar Turno
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* MODAL SECUNDARIO: DESGLOSE DE BILLETES Y MONEDAS */}
      {mostrarModalDenominaciones && (
        <div onClick={() => setMostrarModalDenominaciones(false)} className="fixed inset-0 z-[100000] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-sm p-4 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Contar Billetes y Monedas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalDenominaciones(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto p-1">
              {DENOMINACIONES_COP.map((d) => (
                <div key={d.valor} className="bg-slate-50 dark:bg-[#020617] p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 block truncate">{d.label}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] text-slate-400">Cant:</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={cantidadesDenominaciones[d.valor] || ""}
                      onChange={(e) => handleCantidadDenominacionChange(d.valor, e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Total contado:</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                ${efectivoContado.toLocaleString('es-CO')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMostrarModalDenominaciones(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Listo, aplicar total
            </button>
          </div>
        </div>
      )}

      {/* MODAL SECUNDARIO: AUDITORÍA DE VOUCHERS Y RECAUDO DIGITAL */}
      {mostrarModalDigitales && (
        <div onClick={() => setMostrarModalDigitales(false)} className="fixed inset-0 z-[100000] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-md p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-3.5">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Auditar Vouchers y Transferencias
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Coteja los recibos físicos del datáfono y comprobantes bancarios
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalDigitales(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Desglose dinámico por canal (Nequi, Davivienda, Daviplata, Bancolombia, Datáfono, etc.) */}
            {canalesAuditados.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800 text-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Turno 100% en Efectivo
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  No se registraron pagos digitales ni transferencias durante este período.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {canalesAuditados.map((item) => (
                  <div
                    key={item.canal}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-1.5 mb-1 min-w-0">
                      <span className="text-sm shrink-0">{item.icono}</span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                        {item.canal}
                      </span>
                    </div>
                    <div>
                      <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm block">
                        ${item.total.toLocaleString('es-CO')}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {item.count} {item.count === 1 ? 'voucher/comprobante' : 'comprobantes'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lista detallada de movimientos digitales */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  Movimientos Digitales ({transaccionesDigitales.length}):
                </span>
                {transaccionesDigitales.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleMarcarTodosVerificados}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {vouchersVerificados ? "Desmarcar todos" : "Marcar todos cotejados"}
                  </button>
                )}
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 p-1">
                {transaccionesDigitales.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    No hubo pagos digitales en este turno.
                  </div>
                ) : (
                  transaccionesDigitales.map((m) => {
                    const check = transaccionesVerificadasIds[m.id];
                    const horaTxt = m.fecha?.toDate 
                      ? m.fecha.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '';
                    const detalle = obtenerDetalleMedioPago(m);

                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleVerificado(m.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                          check 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
                            : 'bg-slate-50 dark:bg-[#020617] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <button type="button" className="shrink-0 text-indigo-600 dark:text-indigo-400">
                            {check ? <CheckSquare size={17} className="text-emerald-600" /> : <Square size={17} className="text-slate-400" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold truncate text-[11px] text-slate-900 dark:text-white">
                                {m.clienteNombre || m.descripcion || 'Venta mostrador'}
                              </span>
                              <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md border shrink-0 inline-flex items-center gap-1 ${detalle.badgeClase}`}>
                                <span>{detalle.icono}</span>
                                <span>{detalle.canal}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] opacity-75 mt-0.5 flex-wrap">
                              <span className="font-semibold uppercase text-slate-500 dark:text-slate-400">
                                {m.tipo === 'abono' ? 'Abono' : 'Venta'}
                              </span>
                              {horaTxt && <span>• {horaTxt}</span>}
                              {detalle.referencia && (
                                <span className="font-mono bg-white/80 dark:bg-slate-800/80 px-1 py-0.2 rounded text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                                  Ref: {detalle.referencia}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-xs sm:text-sm block text-slate-900 dark:text-white">
                            +${Number(m.monto || 0).toLocaleString('es-CO')}
                          </span>
                          <span className="text-[9px] font-bold block text-slate-400">
                            {check ? '✓ Cotejado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Total Digital:</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                ${metricas.totalVentasDigitales.toLocaleString('es-CO')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setVouchersVerificados(true);
                setMostrarModalDigitales(false);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Listo, Vouchers Cotejados
            </button>
          </div>
        </div>
      )}

      {/* MODAL SECUNDARIO: HISTORIAL DE ARQUEOS PARCIALES DEL TURNO ACTUAL */}
      {mostrarModalHistorialArqueos && (
        <div onClick={() => setMostrarModalHistorialArqueos(false)} className="fixed inset-0 z-[100000] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-md p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-3.5">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Arqueos Parciales del Turno
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Cortes de control guardados antes del cierre definitivo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalHistorialArqueos(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 p-1">
              {arqueosParciales.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No hay arqueos parciales registrados en este turno.
                </div>
              ) : (
                arqueosParciales.map((arq) => {
                  const f = arq.fechaCierre || arq.creadoEn;
                  const horaStr = f?.toDate 
                    ? f.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                    : '';

                  return (
                    <div
                      key={arq.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/90 dark:border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {horaStr ? `Corte a las ${horaStr}` : 'Arqueo Parcial'}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          arq.tipoDiferencia === 'exacto'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : arq.tipoDiferencia === 'sobrante'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {arq.tipoDiferencia === 'exacto'
                            ? 'Cuadre Exacto'
                            : (arq.tipoDiferencia === 'sobrante'
                              ? `Sobrante: +$${Math.abs(arq.diferencia).toLocaleString('es-CO')}`
                              : `Faltante: -$${Math.abs(arq.diferencia).toLocaleString('es-CO')}`)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <div>Esperado: <span className="font-bold text-slate-700 dark:text-slate-300">${(arq.totalEfectivoEsperado || 0).toLocaleString('es-CO')}</span></div>
                        <div>Contado: <span className="font-bold text-slate-700 dark:text-slate-300">${(arq.totalEfectivoReal || 0).toLocaleString('es-CO')}</span></div>
                      </div>

                      {arq.notas && (
                        <p className="text-[10px] text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0f172a] p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 italic">
                          "{arq.notas}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setMostrarModalHistorialArqueos(false)}
              className="w-full py-2 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cerrar Historial
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN ANTES DE FINALIZAR TURNO */}
      {mostrarModalConfirmarCierre && (
        <div onClick={() => setMostrarModalConfirmarCierre(false)} className="fixed inset-0 z-[100000] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-sm p-4 sm:p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Lock size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                  ¿Confirmar Cierre de Turno?
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Cajero: <span className="font-bold text-slate-700 dark:text-slate-300">{nombreUsuario}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#020617] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Efectivo esperado:</span>
                <span className="font-bold text-slate-900 dark:text-white">${metricas.totalEfectivoEsperado.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Efectivo contado:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">${efectivoContado.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-300">Diferencia gaveta:</span>
                <span className={`font-black text-[11px] px-2 py-0.5 rounded-md ${
                  tipoDiferencia === 'exacto'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : tipoDiferencia === 'sobrante'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                }`}>
                  {tipoDiferencia === 'exacto' ? 'Cuadre Exacto ($0)' : `${diferencia > 0 ? '+' : '-'}$${Math.abs(diferencia).toLocaleString('es-CO')}`}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Auditoría digital:</span>
                <span className={`font-bold ${todosDigitalesAuditados ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {totalDigitalesCount === 0 ? 'Sin movimientos digitales' : (todosDigitalesAuditados ? '✓ Comprobantes cotejados' : `⚠️ ${pendientesDigitalesCount} vouchers pendientes`)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMostrarModalConfirmarCierre(false)}
                className="py-2.5 px-3 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Volver a Revisar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={async () => {
                  setMostrarModalConfirmarCierre(false);
                  await ejecutarCierreDefinitivo();
                }}
                className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {guardando ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <CheckCircle2 size={14} /> Confirmar Cierre
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
