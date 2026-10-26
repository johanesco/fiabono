"use client";
import { obtenerNombreCercano } from "@/utils/whatsapp";
import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, doc, updateDoc, where, arrayUnion, increment, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { Search, ShoppingBag, Receipt, CheckCircle2, ChevronRight, X, AlertCircle, UserCog, ArrowLeft, MessageCircle, Banknote, Printer, Smartphone, CreditCard, Zap, Wallet, Bookmark, Sparkles } from 'lucide-react';
import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import TicketFacturaModal from "@/components/TicketFacturaModal";
import ModalNuevoCliente from "@/components/ModalNuevoCliente";
import toast from 'react-hot-toast';
import { abrirEnlaceWhatsApp } from "@/utils/whatsapp";
import { agregarMediosPagoAlEstado } from "@/utils/mediosPago";

export default function AbonarPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando módulo de abonos...</div>}>
      <AbonarContenido />
    </Suspense>
  );
}

function AbonarContenido() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreUsuario = datosSesion?.nombreUsuario;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const esAdmin = datosSesion?.tipoUsuario === 'principal';
  const puedeEnviarWhatsApp = datosSesion?.puedeEnviarWhatsApp ?? true;

  const [clientes, setClientes] = useState<any[]>([]);
  const [separes, setSepares] = useState<any[]>([]);
  const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
  
  const [montoAbono, setMontoAbono] = useState("");
  const inputMontoRef = useRef<HTMLInputElement>(null); 
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'datafono' | 'credito_externo' | 'saldo_interno'>('efectivo');
  const [subMetodoPago, setSubMetodoPago] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [busquedaRegistro, setBusquedaRegistro] = useState("");
  const [mostrarResultadosBuscador, setMostrarResultadosBuscador] = useState(false);
  
  const [separesCliente, setSeparesCliente] = useState<any[]>([]);
  const [destinoAbono, setDestinoAbono] = useState<'fiado' | 'separe'>('fiado');
  const [separeSeleccionado, setSepareSeleccionado] = useState<any | null>(null);

  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const isSubmittingAbonoRef = useRef(false);
  const ultimoAbonoRef = useRef<{ clienteId: string; monto: number; timestamp: number } | null>(null);
  const [confirmacionDuplicado, setConfirmacionDuplicado] = useState<{
    isOpen: boolean;
    monto: number;
    clienteNombre: string;
    tiempoTranscurridoSegundos: number;
  } | null>(null);

  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, montoTotal: number, ticketDatos?: any, esSepare?: boolean, saldoRestanteSepare?: number } | null>(null);
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: any | null }>({ visible: false, datos: null });
  const [modalConfirmacionExceso, setModalConfirmacionExceso] = useState<{ visible: boolean; abonoReal: number } | null>(null);
  
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [nombresNuevo, setNombresNuevo] = useState("");
  const [apellidosNuevo, setApellidosNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [direccionNuevo, setDireccionNuevo] = useState("");
  const [notasNuevo, setNotasNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Sonido de éxito al registrar abono
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

  useEffect(() => {
    if (!cuentaPrincipalId) return;

    const qC = query(collection(db, "clientes"), where("usuarioId", "==", cuentaPrincipalId));
    const unsubC = onSnapshot(qC, (snapC) => {
      const listaC: any[] = [];
      snapC.forEach((doc) => listaC.push({ id: doc.id, ...doc.data() }));
      listaC.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      setClientes(listaC);

      const clienteParamId = searchParams.get('clienteId');
      if (clienteParamId) {
        const clienteEncontrado = listaC.find(c => c.id === clienteParamId);
        if (clienteEncontrado) setClienteTransaccion(clienteEncontrado);
      }
    }, console.error);

    const qS = query(
      collection(db, "separes"),
      where("usuarioId", "==", cuentaPrincipalId),
      where("estado", "==", "activo")
    );
    const unsubS = onSnapshot(qS, (snapS) => {
      const listaS: any[] = [];
      snapS.forEach((doc) => listaS.push({ id: doc.id, ...doc.data() }));
      setSepares(listaS);
    }, console.error);

    return () => {
      unsubC();
      unsubS();
    };
  }, [cuentaPrincipalId]);

  // Detector de clic o toque fuera para cerrar buscador de clientes
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.buscador-cliente-abonar-container')) {
        setMostrarResultadosBuscador(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Sincronizar clientes con totales calculados unificados (Fiado + Separes)
  const clientesConTotales = useMemo(() => {
    return clientes.map((c) => {
      const separesActivosCli = separes.filter(
        (s) =>
          s.estado === 'activo' &&
          (s.clienteId === c.id ||
            (s.clienteNombre && c.nombre && s.clienteNombre.trim().toLowerCase() === c.nombre.trim().toLowerCase()))
      );
      const saldoSeparesActivos = separesActivosCli.reduce((acc, s) => acc + (s.saldoPendiente || 0), 0);
      const deudaFiado = c.deudaTotal || 0;
      const tieneSaldoAFavor = deudaFiado < 0;
      const totalCompromiso = tieneSaldoAFavor ? deudaFiado : (deudaFiado + saldoSeparesActivos);

      return {
        ...c,
        deudaFiado,
        saldoSeparesActivos,
        tieneSeparesActivos: saldoSeparesActivos > 0,
        tieneSaldoAFavor,
        totalCompromiso
      };
    });
  }, [clientes, separes]);

  // Cargar separes activos del cliente seleccionado
  useEffect(() => {
    if (!clienteTransaccion || !cuentaPrincipalId) {
      setSeparesCliente([]);
      setDestinoAbono('fiado');
      setSepareSeleccionado(null);
      return;
    }

    const list = separes.filter(d => {
      return (clienteTransaccion.id && d.clienteId === clienteTransaccion.id) ||
        (clienteTransaccion.nombre && d.clienteNombre?.trim().toLowerCase() === clienteTransaccion.nombre.trim().toLowerCase());
    });
    setSeparesCliente(list);

    if (list.length > 0 && (clienteTransaccion.deudaTotal || 0) <= 0) {
      setDestinoAbono('separe');
      setSepareSeleccionado(list[0]);
    } else if (list.length > 0) {
      setSepareSeleccionado(list[0]);
    } else {
      setDestinoAbono('fiado');
      setSepareSeleccionado(null);
    }
  }, [clienteTransaccion, separes, cuentaPrincipalId]);

  const cargarDatosGlobales = async (uid: string) => {
    // Sincronizado reactivamente por onSnapshot
  };

  // Lógica Inteligente para detectar si es nombre o celular
  const prepararNuevoCliente = (textoBusqueda: string) => {
    const soloNumeros = textoBusqueda.replace(/\D/g, '');
    if (soloNumeros.length >= 7) {
      setCelularNuevo(textoBusqueda);
      setNombreNuevo("");
    } else {
      setNombreNuevo(textoBusqueda);
      setCelularNuevo("");
    }
    setModalNuevoCliente(true);
    setMostrarResultadosBuscador(false);
  };

  const guardarClienteNuevo = async () => {
    const nombreCalculado = apellidosNuevo.trim() ? (nombresNuevo.trim() + ' ' + apellidosNuevo.trim()) : (nombresNuevo.trim() || nombreNuevo.trim());
    if (!nombreCalculado) return toast.error("El nombre del cliente es obligatorio.");
    setGuardandoCliente(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const respuesta = await fetch('/api/clientes/crear', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ 
          nombre: nombreCalculado,
          nombres: nombresNuevo.trim(),
          apellidos: apellidosNuevo.trim(), 
          celular: celularNuevo.trim(),
          direccion: direccionNuevo.trim(),
          notas: notasNuevo.trim()
        }) 
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo crear el cliente.');
      const nuevoObj = resultado.cliente;
      setModalNuevoCliente(false); 
      setNombreNuevo(""); 
      setNombresNuevo(""); 
      setApellidosNuevo(""); 
      setCelularNuevo(""); 
      setDireccionNuevo("");
      setNotasNuevo("");
      setBusquedaRegistro("");
      await cargarDatosGlobales(cuentaPrincipalId!);
      setClienteTransaccion(nuevoObj); 
    } catch (error: any) { 
      toast.error(error?.message || "Error al guardar cliente."); 
    } finally { 
      setGuardandoCliente(false); 
    }
  };

  const formatearMonedaInput = (valor: string) => {
    if (!valor) return "";
    const numeroStr = valor.replace(/\D/g, ''); 
    if (!numeroStr) return "";
    return parseInt(numeroStr, 10).toLocaleString('es-CO');
  };

  const procesarAbono = async (eOrForzar?: React.MouseEvent | boolean) => {
    const forzarDuplicado = typeof eOrForzar === 'boolean' ? eOrForzar : false;
    const pagoRaw = montoAbono.replace(/\D/g, '');
    const abonoReal = pagoRaw === "" ? 0 : parseFloat(pagoRaw);

    if (!clienteTransaccion) { toast.error("Debes seleccionar un cliente para registrar un abono."); return; }
    if (abonoReal <= 0) { toast.error("Ingresa un monto mayor a $0 para abonar."); return; }

    // Prevenir abonos duplicados accidentales (mismo cliente y mismo monto en menos de 90 segundos)
    if (!forzarDuplicado && ultimoAbonoRef.current) {
      const tiempoSegundos = Math.round((Date.now() - ultimoAbonoRef.current.timestamp) / 1000);
      if (
        ultimoAbonoRef.current.clienteId === clienteTransaccion.id &&
        ultimoAbonoRef.current.monto === abonoReal &&
        tiempoSegundos < 90
      ) {
        setConfirmacionDuplicado({
          isOpen: true,
          monto: abonoReal,
          clienteNombre: clienteTransaccion.nombre,
          tiempoTranscurridoSegundos: Math.max(1, tiempoSegundos)
        });
        return;
      }
    }

    const refPagoCompleta = [subMetodoPago, referenciaPago.trim()].filter(Boolean).join(' — ');
    const labelsMetodos: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: subMetodoPago ? `Transf. (${subMetodoPago})` : 'Transferencia',
      datafono: 'Datáfono',
      credito_externo: subMetodoPago ? `Crédito (${subMetodoPago})` : 'Crédito Externo',
      saldo_interno: 'Saldo a Favor'
    };
    const metodoPagoLabel = labelsMetodos[metodoPago] || 'Efectivo';

    // 1. SI ES ABONO A PLAN SEPARE
    if (destinoAbono === 'separe' && separeSeleccionado) {
      if (abonoReal > (separeSeleccionado.saldoPendiente || 0)) {
        toast.error(`El abono no puede superar el saldo pendiente del separe ($${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')}).`, { duration: 4000 });
        return;
      }

      if (metodoPago === 'saldo_interno' && abonoReal > Math.abs(clienteTransaccion.deudaTotal || 0)) {
        toast.error(`El abono no puede superar el Saldo a Favor disponible ($${Math.abs(clienteTransaccion.deudaTotal || 0).toLocaleString('es-CO')}).`, { duration: 4000 });
        return;
      }

      if (isSubmittingAbonoRef.current) return;
      isSubmittingAbonoRef.current = true;
      setGuardandoAbono(true);

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Sesión inválida.');
        const respuestaAbonoSepare = await fetch('/api/separes/abonar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            separeId: separeSeleccionado.id,
            clienteId: clienteTransaccion.id,
            montoAbono: abonoReal,
            metodoPago,
            subMetodoPago: subMetodoPago?.trim(),
            referenciaPago: refPagoCompleta,
            detallesItems: (separeSeleccionado.items || []).map((it: any) => ({
              descripcion: it.descripcion || "Artículo",
              cantidad: it.cantidad || 1,
              valor: (Number(it.valor) || 0) * (it.cantidad || 1),
              valorUnitario: Number(it.valor) || 0
            }))
          })
        });
        const resAbonoSepare = await respuestaAbonoSepare.json();
        if (!respuestaAbonoSepare.ok) throw new Error(resAbonoSepare.error || 'No se pudo registrar el abono.');

        const nuevoSaldoPendiente = resAbonoSepare.nuevoSaldoPendiente;
        const nuevoMontoPagado = resAbonoSepare.nuevoMontoPagado;

        setSeparesCliente(prev => prev.map(s => s.id === separeSeleccionado.id ? {
          ...s,
          saldoPendiente: nuevoSaldoPendiente,
          montoPagado: nuevoMontoPagado
        } : s));

        if (metodoPago === 'saldo_interno') {
          setClienteTransaccion((prev: any) => prev ? {
            ...prev,
            deudaTotal: (prev.deudaTotal || 0) + abonoReal
          } : prev);
        }

        reproducirSonidoExito();

        ultimoAbonoRef.current = {
          clienteId: clienteTransaccion.id,
          monto: abonoReal,
          timestamp: Date.now()
        };

        const ticketDatos: any = {
          nombreNegocio: nombreNegocio || "Mi Negocio",
          telefonoNegocio: datosSesion?.telefonoNegocio || "",
          correoNegocio: datosSesion?.correoNegocio || "",
          logoNegocio: datosSesion?.logoNegocio || null,
          nitNegocio: datosSesion?.nitNegocio || "",
          direccionNegocio: datosSesion?.direccionNegocio || "",
          mensajePieTicket: datosSesion?.mensajePieTicket || "Comprobante de Abono Plan Separe.",
          nombreCliente: clienteTransaccion.nombre,
          celularCliente: clienteTransaccion.celular || "",
          registradoPor: nombreUsuario || "Vendedor",
          fecha: new Date(),
          tipo: 'abono_separe',
          detalles: (separeSeleccionado.items || []).map((it: any) => ({
            descripcion: it.descripcion || "Artículo",
            cantidad: it.cantidad || 1,
            valor: (Number(it.valor) || 0) * (it.cantidad || 1),
            valorUnitario: Number(it.valor) || 0
          })),
          descripcionGeneral: `Abono a Plan Separe: $${abonoReal.toLocaleString('es-CO')} | Saldo restante: $${nuevoSaldoPendiente.toLocaleString('es-CO')}`,
          montoTotal: abonoReal,
          pagoRecibido: abonoReal,
          saldoNuevo: nuevoSaldoPendiente,
          idTransaccion: resAbonoSepare.movimientoId,
          metodoPago: metodoPago,
          referenciaPago: refPagoCompleta || undefined
        };

        setModalExito({ 
          visible: true, 
          cliente: clienteTransaccion,
          montoTotal: abonoReal,
          ticketDatos,
          esSepare: true,
          saldoRestanteSepare: nuevoSaldoPendiente
        });
        return;
      } catch (error: any) {
        console.error(error);
        toast.error(error?.message || "Error al procesar el abono al separe.");
      } finally {
        isSubmittingAbonoRef.current = false;
        setGuardandoAbono(false);
      }
      return;
    }

    // 2. SI ES ABONO A DEUDA GENERAL DE FIADOS
    // Solo se evalúa exceso si el cliente tiene una deuda positiva real (> 0).
    // Si tiene deuda <= 0 (saldo a favor), el abono simplemente incrementa su saldo a favor.
    const deudaActual = clienteTransaccion.deudaTotal || 0;
    if (deudaActual > 0 && abonoReal > deudaActual) {
      setModalConfirmacionExceso({ visible: true, abonoReal });
      return;
    }
    
    await ejecutarAbonoCartera(abonoReal, abonoReal);
  };

  const ejecutarAbonoCartera = async (abonoAplicado: number, pagoCliente?: number) => {
    if (!clienteTransaccion) return;
    if (isSubmittingAbonoRef.current) return;
    isSubmittingAbonoRef.current = true;
    setGuardandoAbono(true);

    try {
      const refPagoCompleta = [subMetodoPago, referenciaPago.trim()].filter(Boolean).join(' — ');
      const labelsMetodos: Record<string, string> = {
        efectivo: 'Efectivo',
        transferencia: subMetodoPago ? `Transf. (${subMetodoPago})` : 'Transferencia',
        datafono: 'Datáfono',
        credito_externo: subMetodoPago ? `Crédito (${subMetodoPago})` : 'Crédito Externo'
      };
      const metodoPagoLabel = labelsMetodos[metodoPago] || 'Efectivo';

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error('Sesión inválida. Por favor, inicia sesión de nuevo.');
        return;
      }
      const respuesta = await fetch('/api/movimientos/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          clienteId: clienteTransaccion.id,
          tipo: 'abono',
          monto: abonoAplicado,
          descripcion: `Abono a cuenta (${metodoPagoLabel})`,
          metodoPago,
          referenciaPago: refPagoCompleta,
          esPublico: true
        })
      });
      const datosAbono = await respuesta.json();
      if (!respuesta.ok) {
        toast.error(datosAbono.error || 'No se pudo registrar el abono.');
        return;
      }

      reproducirSonidoExito();

      ultimoAbonoRef.current = {
        clienteId: clienteTransaccion.id,
        monto: abonoAplicado,
        timestamp: Date.now()
      };

      const saldoFinal = datosAbono.nuevoSaldo;
      const clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: saldoFinal };

      const devuelta = pagoCliente && pagoCliente > abonoAplicado ? pagoCliente - abonoAplicado : 0;

      const ticketDatos = {
        nombreNegocio: nombreNegocio || "Mi Negocio",
        telefonoNegocio: datosSesion?.telefonoNegocio || "",
        correoNegocio: datosSesion?.correoNegocio || "",
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || "",
        direccionNegocio: datosSesion?.direccionNegocio || "",
        mensajePieTicket: datosSesion?.mensajePieTicket || "",
        nombreCliente: clienteTransaccion.nombre,
        celularCliente: clienteTransaccion.celular || "",
        registradoPor: nombreUsuario || "Vendedor",
        fecha: new Date(),
        tipo: 'abono' as const,
        detalles: [],
        descripcionGeneral: "Abono a cuenta",
        montoTotal: abonoAplicado,
        pagoRecibido: pagoCliente || abonoAplicado,
        devuelta: devuelta > 0 ? devuelta : undefined,
        saldoNuevo: saldoFinal,
        idTransaccion: datosAbono.movimientoId,
        metodoPago: metodoPago,
        referenciaPago: refPagoCompleta
      };

      setModalExito({ 
        visible: true, 
        cliente: clienteFinalActualizado,
        montoTotal: abonoAplicado,
        ticketDatos,
        esSepare: false
      });
      
    } catch (error: any) { 
      console.error(error);
      toast.error(error?.message || "Error al guardar abono."); 
    } finally {
      isSubmittingAbonoRef.current = false;
      setGuardandoAbono(false);
    }
  };

  const normalizarMensajeWhatsApp = (texto: string) => {
    return texto
      .replace(/\uFFFD/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\r\n/g, '\n')
      .trim();
  };

  const abrirWhatsApp = (cliente: any) => {
    const abonoMonto = modalExito?.montoTotal || (parseFloat(montoAbono.replace(/\D/g, '')) || 0);
    const idTransaccion = modalExito?.ticketDatos?.idTransaccion;
    let enlaceTexto = "";
    if (idTransaccion && typeof window !== 'undefined') {
      enlaceTexto = `\n\n*Ver o descargar comprobante digital:*\n${window.location.origin}/t/${idTransaccion}`;
    }

    const cliNombre = cliente?.nombre || modalExito?.cliente?.nombre || "Cliente";

    let texto = "";
    if (modalExito?.esSepare) {
      texto = `¡Hola, *${cliNombre}*! Gracias por tu abono en *${nombreNegocio || 'nuestra tienda'}*.

===================
*ABONO A PLAN SEPARE*
===================

- Abono recibido: *$${abonoMonto.toLocaleString('es-CO')}*
- Metodo: *${metodoPago.toUpperCase()}${subMetodoPago ? ` (${subMetodoPago})` : ''}*
- Saldo restante: *$${(modalExito.saldoRestanteSepare || 0).toLocaleString('es-CO')}*${enlaceTexto}

Gracias por tu pago y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran dia!*`;
    } else {
      const deudaFinal = cliente?.deudaTotal ?? modalExito?.cliente?.deudaTotal ?? 0;
      const saldoFormat = deudaFinal < 0 
        ? `$${Math.abs(deudaFinal).toLocaleString('es-CO')} a favor` 
        : `$${deudaFinal.toLocaleString('es-CO')}`;

      texto = `¡Hola, *${cliNombre}*! Gracias por tu abono en *${nombreNegocio || 'nuestra tienda'}*.

===================
*COMPROBANTE DE ABONO*
===================

- Abono recibido: *$${abonoMonto.toLocaleString('es-CO')}*
- Metodo: *${metodoPago.toUpperCase()}${subMetodoPago ? ` (${subMetodoPago})` : ''}*
- Saldo actual en cuenta: *${saldoFormat}*${enlaceTexto}

Gracias por tu abono y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran dia!*`;
    }

    const celularLimpio = (cliente?.celular || modalExito?.cliente?.celular || '').toString().replace(/\D/g, '');
    const deudaActual = cliente?.deudaTotal ?? modalExito?.cliente?.deudaTotal ?? 0;
    abrirEnlaceWhatsApp(celularLimpio, agregarMediosPagoAlEstado(texto, datosSesion?.mediosPago, nombreNegocio || 'nuestra tienda', deudaActual));
  };

  const normalizarBusqueda = (texto: string) => {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const clientesFiltradosRegistro = clientesConTotales.filter(c => {
    const query = normalizarBusqueda(busquedaRegistro);
    if (!query) return false;
    const qTrim = busquedaRegistro.trim();
    return (
      normalizarBusqueda(c.nombre).includes(query) ||
      Boolean(c.apodo && normalizarBusqueda(c.apodo).includes(query)) ||
      Boolean(c.celular && c.celular.includes(qTrim)) ||
      Boolean(c.numeroDocumento && c.numeroDocumento.includes(qTrim)) ||
      Boolean(c.direccion && normalizarBusqueda(c.direccion).includes(query)) ||
      Boolean(c.notas && normalizarBusqueda(c.notas).includes(query)) ||
      Boolean((c.etiquetas || []).some((t: string) => normalizarBusqueda(t).includes(query)))
    );
  });

  const puedeAbonar: boolean = datosSesion?.puedeAbonar ?? true;

  const abonoNum = parseFloat(montoAbono.replace(/\D/g, '')) || 0;
  const saldoObjetivo = destinoAbono === 'separe' ? (separeSeleccionado?.saldoPendiente || 0) : (clienteTransaccion?.deudaTotal || 0);
  const nuevoSaldoVisual = saldoObjetivo - abonoNum;

  if (!puedeAbonar) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem]">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/20 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">Acceso Restringido</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm sm:text-base mb-6 leading-relaxed">
          Tu usuario no tiene permisos para registrar abonos directamente. Solicita al administrador que te otorgue este permiso desde los Ajustes.
        </p>
        <button
          onClick={() => router.push('/dashboard/inicio')}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold px-6 py-3.5 rounded-2xl hover:opacity-90 transition-all active:scale-95 text-sm"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
      
      {/* HEADER SUPERIOR */}
      {/* CABECERA */}
      <div className="bg-blue-600 dark:bg-blue-800 p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm cursor-pointer active:scale-95 shrink-0">
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-base sm:text-xl font-black uppercase tracking-wide flex items-center gap-2 whitespace-nowrap">
            <Banknote size={20} className="shrink-0"/> <span className="whitespace-nowrap">Registrar Abono</span>
          </h2>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 relative overflow-y-auto lg:overflow-hidden pb-40 lg:pb-0">
        
        {/* PANEL IZQUIERDO: SELECCIÓN DE CLIENTE Y MONTO */}
        <div className="lg:flex-1 flex flex-col relative bg-slate-50/50 dark:bg-[#0f172a] lg:overflow-hidden shrink-0">
          <div className="flex-1 lg:overflow-y-auto p-3 sm:p-4 lg:p-4 pb-2">
            <div className="max-w-2xl mx-auto space-y-2.5 sm:space-y-3">
              
              {/* BUSCADOR DE CLIENTE (Obligatorio) */}
              <div className={`flex flex-col bg-white dark:bg-[#020617] p-3 sm:p-3.5 rounded-2xl border shadow-sm relative transition-colors ${!clienteTransaccion ? 'border-blue-200 dark:border-blue-900 bg-blue-50/30' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCog size={14}/> Paso 1: Seleccionar Cliente
                  </label>
                </div>
                
                {clienteTransaccion ? (
                  <div className="py-2 px-3 sm:py-2.5 sm:px-3.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 flex justify-between items-center shadow-sm">
                    <div className="flex flex-col min-w-0 mr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 dark:text-blue-300 text-sm sm:text-base truncate flex items-center gap-1.5 flex-wrap">
                          <span>{clienteTransaccion.nombre}</span>
                          {clienteTransaccion.apodo && (
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                              "{clienteTransaccion.apodo}"
                            </span>
                          )}
                        </span>
                        {clienteTransaccion.notas && (
                          <span className="text-[10px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-md">
                            {clienteTransaccion.notas}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${clienteTransaccion.deudaTotal > 0 ? 'text-rose-500' : 'text-teal-600 dark:text-teal-400'}`}>
                        {clienteTransaccion.deudaTotal > 0 ? 'Deuda actual:' : 'Saldo a favor:'} ${Math.abs(clienteTransaccion.deudaTotal).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <button onClick={() => {setClienteTransaccion(null); setMontoAbono(""); setSeparesCliente([]);}} className="text-rose-500 shrink-0 hover:bg-rose-100 p-1 rounded-full cursor-pointer"><X size={16}/></button>
                  </div>
                ) : (
                  <div className="relative buscador-cliente-abonar-container">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                    <input
                      type="text"
                      value={busquedaRegistro}
                      onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }}
                      onFocus={() => setMostrarResultadosBuscador(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (clientesFiltradosRegistro.length > 0) {
                            setClienteTransaccion(clientesFiltradosRegistro[0]);
                            setBusquedaRegistro("");
                            setMostrarResultadosBuscador(false);
                          } else if (busquedaRegistro.trim()) {
                            prepararNuevoCliente(busquedaRegistro.trim());
                            setMostrarResultadosBuscador(false);
                          }
                        }
                      }}
                      placeholder="Buscar por nombre, celular, apodo o notas..."
                      className="w-full pl-9 pr-3 py-2 sm:py-2.5 bg-white dark:bg-[#0f172a] border border-blue-200 dark:border-blue-800 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-blue-500 transition-colors shadow-sm text-slate-900 dark:!text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                    />
                    
                    {mostrarResultadosBuscador && busquedaRegistro.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          {clientesFiltradosRegistro.map(c => (
                            <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setMostrarResultadosBuscador(false); }} className="p-2.5 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs sm:text-sm">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                                    <span>{c.nombre}</span>
                                    {c.apodo && (
                                      <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 px-1.5 py-0.2 rounded">
                                        "{c.apodo}"
                                      </span>
                                    )}
                                  </span>
                                  {c.notas && (
                                    <span className="text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 px-1.5 py-0.5 rounded-md">
                                      {c.notas}
                                    </span>
                                  )}
                                </div>
                                {c.celular && <span className="text-[10px] text-slate-400 block">{c.celular}</span>}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  <span className={`text-[10.5px] font-black ${c.totalCompromiso > 0 ? 'text-rose-500' : c.tieneSaldoAFavor ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>
                                    {c.tieneSaldoAFavor 
                                      ? `A favor $${Math.abs(c.totalCompromiso).toLocaleString('es-CO')}` 
                                      : c.totalCompromiso > 0 
                                        ? `Total $${c.totalCompromiso.toLocaleString('es-CO')}` 
                                        : 'Al día ($0)'}
                                  </span>
                                  {c.tieneSeparesActivos && (
                                    <span className="text-[9.5px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 px-1.5 py-0.2 rounded border border-violet-200 dark:border-violet-800/60">
                                      Fiado: ${c.deudaFiado.toLocaleString('es-CO')} • Separe: ${c.saldoSeparesActivos.toLocaleString('es-CO')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight size={14} className="text-slate-400"/>
                            </div>
                          ))}
                          {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                            <button onClick={() => prepararNuevoCliente(busquedaRegistro)} className="w-full text-left p-2.5 bg-blue-50 text-blue-700 text-xs sm:text-sm font-bold">
                              + Crear cliente "{busquedaRegistro}"
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CASO: CLIENTE SIN DEUDAS NI SEPARES */}
              {clienteTransaccion && (clienteTransaccion.deudaTotal || 0) <= 0 && separesCliente.length === 0 && (
                <div className="p-5 bg-white dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-center space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {clienteTransaccion.nombre} no tiene deudas pendientes
                    </h3>
                    {clienteTransaccion.deudaTotal < 0 ? (
                      <div className="mt-2.5 p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 inline-block text-left max-w-md">
                        <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
                          <Wallet size={16} className="text-teal-600 shrink-0" />
                          <span>Saldo a Favor Disponible: <strong>${Math.abs(clienteTransaccion.deudaTotal).toLocaleString('es-CO')}</strong></span>
                        </div>
                        <p className="text-[11px] text-teal-800/90 dark:text-teal-300/80 mt-1">
                          Este cliente no tiene fiados ni separes pendientes. Su saldo a favor está guardado para sus próximas compras o para devolución en efectivo si lo requiere.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Este cliente se encuentra totalmente al día ($0) y no registra ningún Plan Separe activo.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('fiabono_cliente_precargado', JSON.stringify(clienteTransaccion));
                        router.push(`/dashboard/vender?clienteId=${clienteTransaccion.id}`);
                      }}
                      className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingBag size={14} />
                      <span>Nueva Venta</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('fiabono_cliente_precargado', JSON.stringify(clienteTransaccion));
                        router.push(`/dashboard/fiar?clienteId=${clienteTransaccion.id}`);
                      }}
                      className="w-full sm:w-auto px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Receipt size={14} />
                      <span>Nuevo Fiado</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.setItem('fiabono_cliente_precargado', JSON.stringify(clienteTransaccion));
                        router.push(`/dashboard/separe?clienteId=${clienteTransaccion.id}`);
                      }}
                      className="w-full sm:w-auto px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Bookmark size={14} />
                      <span>Nuevo Separe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/dashboard/clientes')}
                      className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Directorio
                    </button>
                  </div>
                </div>
              )}

              {/* SELECTOR DE DESTINO SI EL CLIENTE TIENE PLANES SEPARE */}
              {clienteTransaccion && separesCliente.length > 0 && (
                <div className="flex flex-col bg-white dark:bg-[#020617] p-3 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2 animate-in slide-in-from-top-3 duration-200">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    ¿A qué deseas aplicar este abono?
                  </label>

                  {clienteTransaccion.deudaTotal > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDestinoAbono('fiado')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          destinoAbono === 'fiado'
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 shadow-sm ring-2 ring-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Deuda de Fiados</span>
                        <span className="text-xs sm:text-sm font-black">${(clienteTransaccion.deudaTotal || 0).toLocaleString('es-CO')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDestinoAbono('separe')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          destinoAbono === 'separe'
                            ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 text-violet-900 dark:text-violet-200 shadow-sm ring-2 ring-violet-500/20'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="block text-[9px] font-black uppercase text-violet-600 dark:text-violet-400">Plan Separe ({separesCliente.length})</span>
                        <span className="text-xs sm:text-sm font-black">${(separeSeleccionado?.saldoPendiente || 0).toLocaleString('es-CO')}</span>
                      </button>
                    </div>
                  ) : (
                    /* Si no debe fiados, NO mostrar "Deuda de Fiados negativo" */
                    <div className="space-y-2">
                      <div className="p-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/40 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                          <Bookmark size={14} className="text-violet-600" />
                          Plan Separe ({separesCliente.length})
                        </span>
                        <span className="text-xs sm:text-sm font-black text-violet-900 dark:text-violet-100">
                          Saldo: ${(separeSeleccionado?.saldoPendiente || 0).toLocaleString('es-CO')}
                        </span>
                      </div>

                      {/* Tarjeta inteligente de Saldo a Favor disponible */}
                      {clienteTransaccion.deudaTotal < 0 && (
                        <div className="p-3 bg-gradient-to-r from-teal-50 to-teal-100/40 dark:from-teal-950/40 dark:to-teal-900/20 border-2 border-teal-300 dark:border-teal-700/60 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                                <Wallet size={13} />
                              </div>
                              <div>
                                <span className="text-[10px] font-black uppercase text-teal-800 dark:text-teal-300 tracking-wider block">
                                  Saldo a Favor Disponible
                                </span>
                                <span className="text-xs sm:text-sm font-black text-teal-950 dark:text-teal-100">
                                  ${Math.abs(clienteTransaccion.deudaTotal).toLocaleString('es-CO')}
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-200/80 dark:bg-teal-800/60 text-teal-950 dark:text-teal-200">
                              Sin fiados pendientes
                            </span>
                          </div>

                          <p className="text-[11px] text-teal-900/85 dark:text-teal-200/90 leading-tight">
                            {clienteTransaccion.nombre} no tiene fiados. ¿Deseas abonar a este Separe con su saldo a favor?
                          </p>

                          <div className="flex flex-col sm:flex-row gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const maxAplicable = Math.min(Math.abs(clienteTransaccion.deudaTotal), separeSeleccionado?.saldoPendiente || 0);
                                setMontoAbono(maxAplicable.toLocaleString('es-CO'));
                                setMetodoPago('saldo_interno');
                                setSubMetodoPago('');
                              }}
                              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                metodoPago === 'saldo_interno' && (parseFloat(montoAbono.replace(/\D/g, '')) || 0) === Math.min(Math.abs(clienteTransaccion.deudaTotal), separeSeleccionado?.saldoPendiente || 0)
                                  ? 'bg-teal-600 text-white ring-2 ring-teal-400'
                                  : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-95'
                              }`}
                            >
                              <Sparkles size={13} />
                              <span>
                                {Math.abs(clienteTransaccion.deudaTotal) >= (separeSeleccionado?.saldoPendiente || 0)
                                  ? `Pagar TODO con saldo ($${(separeSeleccionado?.saldoPendiente || 0).toLocaleString('es-CO')})`
                                  : `Usar todo mi saldo ($${Math.abs(clienteTransaccion.deudaTotal).toLocaleString('es-CO')})`}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMetodoPago('saldo_interno');
                                setSubMetodoPago('');
                                setMontoAbono('');
                                if (inputMontoRef.current) inputMontoRef.current.focus();
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                                metodoPago === 'saldo_interno' && (parseFloat(montoAbono.replace(/\D/g, '')) || 0) < Math.min(Math.abs(clienteTransaccion.deudaTotal), separeSeleccionado?.saldoPendiente || 0)
                                  ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-900 dark:text-teal-100 border-teal-400 font-black'
                                  : 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700/60 hover:bg-teal-50'
                              }`}
                            >
                              <span>Usar Parcial</span>
                            </button>
                          </div>

                          {metodoPago === 'saldo_interno' && (
                            <div className="pt-1.5 border-t border-teal-200/80 dark:border-teal-800/60 flex items-center justify-between text-[11px] font-bold text-teal-900 dark:text-teal-200">
                              <span>Saldo a favor restante tras abono:</span>
                              <span className="font-black text-teal-700 dark:text-teal-400">
                                ${Math.max(0, Math.abs(clienteTransaccion.deudaTotal) - (parseFloat(montoAbono.replace(/\D/g, '')) || 0)).toLocaleString('es-CO')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {destinoAbono === 'separe' && separesCliente.length > 1 && (
                    <div className="space-y-1 pt-0.5">
                      <label className="text-[9px] font-bold text-slate-400">Seleccionar separe a abonar:</label>
                      <div className="flex flex-wrap gap-1">
                        {separesCliente.map((sep, idx) => (
                          <button
                            key={sep.id}
                            type="button"
                            onClick={() => setSepareSeleccionado(sep)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                              separeSeleccionado?.id === sep.id
                                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            Separe #{idx + 1} (${(sep.saldoPendiente || 0).toLocaleString('es-CO')})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {destinoAbono === 'separe' && separeSeleccionado && (
                    <div className="p-2 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg border border-violet-100 dark:border-violet-900/40 text-[10px] font-bold text-violet-800 dark:text-violet-300">
                      Artículos: {(separeSeleccionado.items || []).map((it: any) => it.descripcion).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* INPUT MONTO ABONO */}
              {clienteTransaccion && ((clienteTransaccion.deudaTotal || 0) > 0 || separesCliente.length > 0) && (
                <div className="flex flex-col bg-white dark:bg-[#020617] p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in slide-in-from-top-4 duration-300">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Banknote size={14}/> Paso 2: ¿Cuánto va a abonar?
                  </label>
                  
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-black text-xl sm:text-2xl">$</span>
                    <input 
                      ref={inputMontoRef}
                      type="text" 
                      inputMode="decimal" pattern="[0-9]*"
                      value={montoAbono} 
                      onChange={(e) => setMontoAbono(formatearMonedaInput(e.target.value))} 
                      placeholder="0" 
                      className="w-full pl-8 sm:pl-9 pr-10 py-2 sm:py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-xl sm:text-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 transition-colors shadow-inner" 
                    />
                    {montoAbono && (
                      <button
                        type="button"
                        onClick={() => setMontoAbono("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Borrar monto"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  {/* Botones de Billetes Rápidos */}
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[10000, 20000, 50000, 100000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const actual = parseFloat(montoAbono.replace(/\D/g, '')) || 0;
                          setMontoAbono((actual + val).toLocaleString('es-CO'));
                        }}
                        className="py-1.5 px-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold transition-all active:scale-95 cursor-pointer text-center"
                      >
                        +{val >= 1000 ? `${val / 1000}k` : val}
                      </button>
                    ))}
                  </div>

                  {/* Botones Rápidos */}
                  <div className="flex gap-2">
                    {destinoAbono === 'separe' ? (
                      (separeSeleccionado?.saldoPendiente || 0) > 0 && (
                        <button onClick={() => setMontoAbono((separeSeleccionado.saldoPendiente).toLocaleString('es-CO'))} className="flex-1 text-[11px] sm:text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 py-1.5 sm:py-2 rounded-lg transition-colors">
                          Pagar saldo completo separe (${(separeSeleccionado.saldoPendiente).toLocaleString('es-CO')})
                        </button>
                      )
                    ) : (
                      clienteTransaccion.deudaTotal > 0 && (
                        <button onClick={() => setMontoAbono(clienteTransaccion.deudaTotal.toLocaleString('es-CO'))} className="flex-1 text-[11px] sm:text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-1.5 sm:py-2 rounded-lg transition-colors">
                          Saldar deuda completa (${clienteTransaccion.deudaTotal.toLocaleString('es-CO')})
                        </button>
                      )
                    )}
                  </div>

                  {/* SELECTOR DE MÉTODO DE PAGO DEL ABONO */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Forma de Pago del Abono</label>

                    <div className={`grid ${destinoAbono === 'separe' && (clienteTransaccion.deudaTotal || 0) < 0 ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5 mb-1.5`}>
                      <button
                        type="button"
                        onClick={() => { setMetodoPago('efectivo'); setSubMetodoPago(''); }}
                        title="Efectivo"
                        className={`py-1.5 rounded-lg text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                          metodoPago === 'efectivo'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 border border-transparent'
                        }`}
                      >
                        <Banknote size={13} />
                        <span>Efectivo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setMetodoPago('transferencia'); setSubMetodoPago(''); }}
                        title="Transferencia / Pago en línea"
                        className={`py-2 rounded-lg text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                          metodoPago === 'transferencia'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 border border-transparent'
                        }`}
                      >
                        <Smartphone size={14} />
                        <span className="leading-tight text-center">Transf.</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setMetodoPago('datafono'); setSubMetodoPago(''); }}
                        title="Datáfono"
                        className={`py-2 rounded-lg text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                          metodoPago === 'datafono'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 border border-transparent'
                        }`}
                      >
                        <CreditCard size={14} />
                        <span>Datáfono</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setMetodoPago('credito_externo'); setSubMetodoPago(''); }}
                        title="Crédito Externo"
                        className={`py-2 rounded-lg text-[10px] font-black flex flex-col items-center gap-0.5 transition-all ${
                          metodoPago === 'credito_externo'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-purple-400 hover:text-purple-600 border border-transparent'
                        }`}
                      >
                        <Zap size={14} />
                        <span className="leading-tight text-center">Crédito</span>
                      </button>

                      {destinoAbono === 'separe' && (clienteTransaccion.deudaTotal || 0) < 0 && (
                        <button
                          type="button"
                          onClick={() => { setMetodoPago('saldo_interno'); setSubMetodoPago(''); }}
                          title={`Saldo a Favor (Disp: $${Math.abs(clienteTransaccion.deudaTotal || 0).toLocaleString('es-CO')})`}
                          className={`py-2 rounded-lg text-[10px] font-black flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                            metodoPago === 'saldo_interno'
                              ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-400'
                              : 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800/40 hover:bg-teal-100'
                          }`}
                        >
                          <Wallet size={14} />
                          <span className="leading-tight text-center">A Favor (${Math.round(Math.abs(clienteTransaccion.deudaTotal || 0) / 1000)}k)</span>
                        </button>
                      )}
                    </div>

                    {/* Sub-selector Transferencia */}
                    {metodoPago === 'transferencia' && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-150 mb-2">
                        <label className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block mb-1">¿Por qué plataforma?</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Nequi', 'Daviplata', 'Bancolombia', 'Davivienda', 'PSE', 'Otro'].map(op => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setSubMetodoPago(subMetodoPago === op ? '' : op)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                subMetodoPago === op
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-400'
                              }`}
                            >
                              {op}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-selector Crédito */}
                    {metodoPago === 'credito_externo' && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-150 mb-2">
                        <label className="text-[9px] font-bold text-purple-500 uppercase tracking-wider block mb-1">¿Qué plataforma de crédito?</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Addi', 'Sistecrédito', 'Krediya', 'Otro'].map(op => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setSubMetodoPago(subMetodoPago === op ? '' : op)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                subMetodoPago === op
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-purple-400'
                              }`}
                            >
                              {op}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campo referencia si no es efectivo ni saldo interno */}
                    {metodoPago !== 'efectivo' && metodoPago !== 'saldo_interno' && (
                      <div className="animate-in fade-in duration-150">
                        <input
                          type="text"
                          value={referenciaPago}
                          onChange={(e) => setReferenciaPago(e.target.value)}
                          placeholder={
                            metodoPago === 'transferencia'
                              ? `Ref. ${subMetodoPago || 'comprobante'} (Opcional)`
                              : metodoPago === 'datafono'
                              ? 'No. Voucher / 4 últimos dígitos (Opcional)'
                              : `Aprobación ${subMetodoPago || 'crédito'} (Opcional)`
                          }
                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-medium text-[11px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:text-xs placeholder:font-normal focus:border-blue-500 transition-colors"
                        />
                      </div>
                    )}
                    {metodoPago === 'saldo_interno' && (
                      <div className="p-2 bg-teal-50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 rounded-xl text-[11px] font-medium text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-teal-600 shrink-0" />
                        <span>El abono se descontará directamente del saldo a favor de {clienteTransaccion.nombre}.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO/MEDIO: RESUMEN DE ABONO */}
        <div className="w-full lg:w-[380px] xl:w-[420px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 lg:min-h-0 lg:overflow-hidden">
          
          <div className="p-3 pb-36 sm:pb-32 lg:pb-4 lg:p-4 space-y-3 flex-1 min-h-0 lg:overflow-y-auto">
            {clienteTransaccion && abonoNum > 0 ? (
              <div className="bg-white dark:bg-[#0f172a] p-4 sm:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                  Resumen de la operación {destinoAbono === 'separe' ? '(Plan Separe)' : '(Fiados)'}
                </h4>
                
                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-slate-500 font-medium">
                    {destinoAbono === 'separe' ? 'Saldo Separe Anterior:' : 'Deuda Anterior:'}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">${saldoObjetivo.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center mb-2 text-sm">
                  <span className="text-slate-500 font-medium">Monto Abonado:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">- ${abonoNum.toLocaleString('es-CO')}</span>
                </div>
                
                <div className={`flex justify-between items-center mt-3 pt-2.5 border-t ${nuevoSaldoVisual <= 0 ? 'border-emerald-200' : 'border-slate-200 dark:border-slate-700'}`}>
                  <span className={`font-bold uppercase tracking-wider text-xs ${nuevoSaldoVisual <= 0 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    {nuevoSaldoVisual < 0 ? 'Nuevo Saldo a Favor:' : (nuevoSaldoVisual === 0 ? (destinoAbono === 'separe' ? '¡Separe Totalmente Pagado!' : 'Cuenta Saldada') : 'Nuevo Saldo Pendiente:')}
                  </span>
                  <span className={`font-black text-lg sm:text-xl ${nuevoSaldoVisual <= 0 ? 'text-emerald-600' : (destinoAbono === 'separe' ? 'text-violet-600' : 'text-rose-600')}`}>
                    ${Math.abs(nuevoSaldoVisual).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 p-6 text-center">
                <Banknote size={48} className="mb-3" />
                <p className="font-bold text-xs sm:text-sm">Selecciona un cliente e ingresa el monto para ver el resumen.</p>
              </div>
            )}
          </div>

          <div className="hidden lg:block bg-slate-900 dark:bg-black p-5 shrink-0 lg:rounded-tl-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-30 mt-auto border-t border-slate-800">
            <div className="flex justify-between items-end mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Abonar</span>
              <span className="text-3xl xl:text-4xl font-black text-blue-400 leading-none">${abonoNum.toLocaleString('es-CO')}</span>
            </div>
            <button 
              onClick={procesarAbono} 
              disabled={guardandoAbono || !clienteTransaccion || abonoNum <= 0} 
              className={`w-full font-black text-lg py-3.5 rounded-2xl shadow-lg flex justify-center items-center gap-2 transition-all ${(guardandoAbono || !clienteTransaccion || abonoNum <= 0) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 cursor-pointer'}`}
            >
              <span>{guardandoAbono ? "Procesando Abono..." : "Confirmar Abono"}</span> <CheckCircle2 size={20}/>
            </button>
          </div>

        </div>
      </div>

      {/* BARRA INFERIOR DOCKED EN TABLETS VERTICALES (768px - 1023px) - EVITA ESPACIOS VACÍOS Y ANCLA AL BORDE INFERIOR */}
      <div className="hidden md:flex lg:hidden bg-slate-900 dark:bg-black text-white px-5 sm:px-6 py-3.5 shrink-0 border-t border-slate-800 z-30 items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Abonar</span>
            <span className="text-2xl sm:text-3xl font-black text-blue-400 leading-none">${abonoNum.toLocaleString('es-CO')}</span>
          </div>
          {clienteTransaccion && (
            <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg truncate max-w-[180px]">
              {clienteTransaccion.nombre}
            </span>
          )}
        </div>

        <button 
          onClick={procesarAbono} 
          disabled={guardandoAbono || !clienteTransaccion || abonoNum <= 0}
          className={`min-w-[190px] sm:min-w-[240px] bg-blue-600 hover:bg-blue-700 ${(guardandoAbono || !clienteTransaccion || abonoNum <= 0) ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 cursor-pointer'} text-white font-black text-base py-3 px-5 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all`}
        >
          <span>{guardandoAbono ? "Procesando..." : "Confirmar Abono"}</span> <CheckCircle2 size={19}/>
        </button>
      </div>

      {/* BARRA FLOTANTE MÓVIL SUSPENDIDA (SOLO PARA CELULARES PEQUEÑOS < 768px) */}
          <div className="md:hidden fixed bottom-floating-bar left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)] z-[110] flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0 shrink pl-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total a Abonar</span>
          <span className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 whitespace-nowrap overflow-visible leading-none min-w-0">${abonoNum.toLocaleString('es-CO')}</span>
        </div>
        <button 
          onClick={procesarAbono} 
          disabled={guardandoAbono || !clienteTransaccion || abonoNum <= 0} 
          className={`flex-1 rounded-xl sm:rounded-2xl py-3 sm:py-3.5 px-4 font-black text-base sm:text-lg flex justify-center items-center gap-2 shadow-lg transition-all whitespace-nowrap ${(guardandoAbono || !clienteTransaccion || abonoNum <= 0) ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}
        >
          <span>{guardandoAbono ? "Procesando..." : "Abonar"}</span> <CheckCircle2 size={18}/>
        </button>
      </div>


      {/* MODAL NUEVO CLIENTE UNIFICADO */}
      <ModalNuevoCliente
        isOpen={modalNuevoCliente}
        onClose={() => setModalNuevoCliente(false)}
        nombreInicial={nombreNuevo || busquedaRegistro}
        onClienteCreado={async (nuevoObj) => {
          setBusquedaRegistro("");
          await cargarDatosGlobales(cuentaPrincipalId!);
          setClienteTransaccion(nuevoObj);
          setNombreNuevo("");
          setNombresNuevo("");
          setApellidosNuevo("");
        }}
      />

      {modalExito && modalExito.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950] animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800">
            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 size={50} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Abono Exitoso!</h2>
            
            <div className="mb-8 text-slate-500 dark:text-slate-400 text-base flex flex-col gap-2">
              <p>Se registró el pago de <strong className="text-slate-800 dark:text-slate-200">{modalExito.cliente.nombre}</strong></p>
              <p className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl mt-2 text-xl border border-blue-100 dark:border-blue-500/20">Monto abonado: ${modalExito.montoTotal.toLocaleString('es-CO')}</p>
              {modalExito.ticketDatos?.devuelta && modalExito.ticketDatos.devuelta > 0 && (
                <p className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-lg border border-emerald-200 dark:border-emerald-500/20">Entregar devuelta / cambio: ${modalExito.ticketDatos.devuelta.toLocaleString('es-CO')}</p>
              )}
              {modalExito.esSepare ? (
                <p className="text-sm mt-2">
                  Saldo restante del Separe: <strong className={modalExito.saldoRestanteSepare === 0 ? "text-emerald-600" : "text-violet-600"}>
                    ${(modalExito.saldoRestanteSepare ?? 0).toLocaleString('es-CO')}
                  </strong>
                  {modalExito.saldoRestanteSepare === 0 && " (100% Pagado)"}
                </p>
              ) : (
                <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">
                  {modalExito.cliente.deudaTotal < 0 ? (
                    <>Nuevo saldo a favor: <strong className="text-teal-600 dark:text-teal-400">${Math.abs(modalExito.cliente.deudaTotal).toLocaleString('es-CO')}</strong></>
                  ) : modalExito.cliente.deudaTotal === 0 ? (
                    <>Cuenta al día: <strong className="text-slate-900 dark:text-white">$0</strong></>
                  ) : (
                    <>Nueva deuda total: <strong className="text-slate-900 dark:text-white">${modalExito.cliente.deudaTotal.toLocaleString('es-CO')}</strong></>
                  )}
                </p>
              )}
            </div>

            {modalExito.esSepare && modalExito.saldoRestanteSepare === 0 && (
              <button
                onClick={() => router.push('/dashboard/separes')}
                className="w-full mb-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-base transition-transform active:scale-95 cursor-pointer"
              >
                <CheckCircle2 size={20} /> Ir a Entregar Separe (100% Pagado)
              </button>
            )}
            
            {modalExito.ticketDatos && (
              <button
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExito.ticketDatos })}
                className="w-full mb-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg transition-transform active:scale-95"
              >
                <Printer size={22} /> Imprimir Factura
              </button>
            )}

            {modalExito.cliente.celular && modalExito.cliente.celular.trim() !== "" && puedeEnviarWhatsApp && (
              <button
                onClick={() => abrirWhatsApp(modalExito.cliente)}
                className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] font-bold py-4 rounded-2xl flex justify-center items-center gap-2 text-lg mb-3"
              >
                <MessageCircle size={22} /> Enviar Comprobante
              </button>
            )}

            <button onClick={() => { setModalExito(null); setMontoAbono(""); if(destinoAbono === 'separe') setSepareSeleccionado(null); }} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-2xl text-lg transition-colors cursor-pointer">Cerrar Ventana</button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE EXCESO DE ABONO */}
      {modalConfirmacionExceso?.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950] animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100 dark:border-slate-800">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 leading-tight">El pago supera <br/>la deuda</h2>
            
            <div className="mb-6 text-slate-500 dark:text-slate-400 text-sm flex flex-col gap-3">
              <p>Monto entregado: <strong>${modalConfirmacionExceso.abonoReal.toLocaleString('es-CO')}</strong></p>
              <p>Deuda actual: <strong>${(clienteTransaccion?.deudaTotal || 0).toLocaleString('es-CO')}</strong></p>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 rounded-xl text-emerald-800 dark:text-emerald-400 font-black">
                Cambio / Devuelta: ${(modalConfirmacionExceso.abonoReal - (clienteTransaccion?.deudaTotal || 0)).toLocaleString('es-CO')}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => {
                  ejecutarAbonoCartera(clienteTransaccion?.deudaTotal || 0, modalConfirmacionExceso.abonoReal);
                  setModalConfirmacionExceso(null);
                }} 
                disabled={guardandoAbono}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95"
              >
                {guardandoAbono ? "Procesando..." : "Dar cambio y saldar deuda"}
              </button>
              
              <button 
                onClick={() => {
                  ejecutarAbonoCartera(modalConfirmacionExceso.abonoReal, modalConfirmacionExceso.abonoReal);
                  setModalConfirmacionExceso(null);
                }} 
                disabled={guardandoAbono}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-2xl shadow-sm transition-transform active:scale-95 mt-1"
              >
                {guardandoAbono ? "Procesando..." : "No dar cambio (Dejar Saldo a Favor)"}
              </button>

              <button 
                onClick={() => setModalConfirmacionExceso(null)} 
                disabled={guardandoAbono}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl mt-1 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmacionDuplicado && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-amber-200 dark:border-amber-800 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle size={32} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full">
                ⚠️ Posible Abono Duplicado
              </span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-2">
                ¿Registrar abono idéntico?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Hace apenas <strong className="text-slate-800 dark:text-slate-200">{confirmacionDuplicado.tiempoTranscurridoSegundos} segundos</strong> registraste un abono por <strong className="text-blue-600 dark:text-blue-400">${confirmacionDuplicado.monto.toLocaleString('es-CO')}</strong> a nombre de <strong className="text-slate-800 dark:text-slate-200">{confirmacionDuplicado.clienteNombre}</strong>.
              </p>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
                Si fue un error o hiciste doble clic, puedes cancelar ahora sin afectar la cuenta.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmacionDuplicado(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmacionDuplicado(null);
                  procesarAbono(true);
                }}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition cursor-pointer shadow-sm active:scale-95"
              >
                Sí, registrar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}

      {modalTicketFactura.visible && modalTicketFactura.datos && (
        <TicketFacturaModal 
          isOpen={modalTicketFactura.visible} 
          onClose={() => setModalTicketFactura({ visible: false, datos: null })} 
          datos={modalTicketFactura.datos}
        />
      )}
    </div>
  );
}