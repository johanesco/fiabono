"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, CheckCircle2, ChevronRight, X, AlertCircle, UserCog, ArrowLeft, MessageCircle, Banknote, Printer, Smartphone, CreditCard, Zap } from 'lucide-react';
import { useAuth } from "../../../hooks/AuthContext";
import { API_DB } from "../../../servicios/db";
import TicketFacturaModal from "@/components/TicketFacturaModal";

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

  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
  
  const [montoAbono, setMontoAbono] = useState(""); 
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'datafono' | 'credito_externo'>('efectivo');
  const [subMetodoPago, setSubMetodoPago] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [busquedaRegistro, setBusquedaRegistro] = useState("");
  const [mostrarResultadosBuscador, setMostrarResultadosBuscador] = useState(false);
  
  const [separesCliente, setSeparesCliente] = useState<any[]>([]);
  const [destinoAbono, setDestinoAbono] = useState<'fiado' | 'separe'>('fiado');
  const [separeSeleccionado, setSepareSeleccionado] = useState<any | null>(null);

  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, montoTotal: number, ticketDatos?: any, esSepare?: boolean, saldoRestanteSepare?: number } | null>(null);
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: any | null }>({ visible: false, datos: null });
  
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
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
    if (cuentaPrincipalId) cargarDatosGlobales(cuentaPrincipalId);
  }, [cuentaPrincipalId]);

  // Cargar separes activos del cliente seleccionado
  useEffect(() => {
    if (!clienteTransaccion?.id || !cuentaPrincipalId) {
      setSeparesCliente([]);
      setDestinoAbono('fiado');
      setSepareSeleccionado(null);
      return;
    }

    const qS = query(
      collection(db, "separes"),
      where("usuarioId", "==", cuentaPrincipalId),
      where("clienteId", "==", clienteTransaccion.id),
      where("estado", "==", "activo")
    );

    getDocs(qS).then(snap => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSeparesCliente(list);

      if (list.length > 0 && (clienteTransaccion.deudaTotal || 0) <= 0) {
        setDestinoAbono('separe');
        setSepareSeleccionado(list[0]);
      } else {
        setDestinoAbono('fiado');
        setSepareSeleccionado(list[0] || null);
      }
    }).catch(console.error);
  }, [clienteTransaccion?.id, cuentaPrincipalId]);

  const cargarDatosGlobales = async (uid: string) => {
    try {
      const qC = query(collection(db, "clientes"), where("usuarioId", "==", uid));
      const snapC = await getDocs(qC);
      const listaC: any[] = [];
      snapC.forEach((doc) => listaC.push({ id: doc.id, ...doc.data() }));
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);

      const clienteParamId = searchParams.get('clienteId');
      if (clienteParamId) {
        const clienteEncontrado = listaC.find(c => c.id === clienteParamId);
        if (clienteEncontrado) setClienteTransaccion(clienteEncontrado);
      }
    } catch (error) { console.error(error); }
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
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), { nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: cuentaPrincipalId, fecha_creacion: new Date() });
      const nuevoObj = { id: docRef.id, nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0 };
      setModalNuevoCliente(false); setNombreNuevo(""); setCelularNuevo(""); setBusquedaRegistro("");
      await cargarDatosGlobales(cuentaPrincipalId!);
      setClienteTransaccion(nuevoObj); 
    } catch (error) { alert("Error al guardar cliente."); } finally { setGuardandoCliente(false); }
  };

  const formatearMonedaInput = (valor: string) => {
    if (!valor) return "";
    const numeroStr = valor.replace(/\D/g, ''); 
    if (!numeroStr) return "";
    return parseInt(numeroStr, 10).toLocaleString('es-CO');
  };

  const procesarAbono = async () => {
    const pagoRaw = montoAbono.replace(/\D/g, '');
    const abonoReal = pagoRaw === "" ? 0 : parseFloat(pagoRaw);

    if (!clienteTransaccion) return alert("Debes seleccionar un cliente para registrar un abono.");
    if (abonoReal <= 0) return alert("Ingresa un monto mayor a $0 para abonar.");

    const refPagoCompleta = [subMetodoPago, referenciaPago.trim()].filter(Boolean).join(' — ');
    const labelsMetodos: Record<string, string> = {
      efectivo: 'Efectivo',
      transferencia: subMetodoPago ? `Transf. (${subMetodoPago})` : 'Transferencia',
      datafono: 'Datáfono',
      credito_externo: subMetodoPago ? `Crédito (${subMetodoPago})` : 'Crédito Externo'
    };
    const metodoPagoLabel = labelsMetodos[metodoPago] || 'Efectivo';

    try {
      // 1. SI ES ABONO A PLAN SEPARE
      if (destinoAbono === 'separe' && separeSeleccionado) {
        if (abonoReal > (separeSeleccionado.saldoPendiente || 0)) {
          return alert(`El abono no puede superar el saldo pendiente del separe ($${(separeSeleccionado.saldoPendiente || 0).toLocaleString('es-CO')}).`);
        }

        const nuevoAbono: any = {
          id: `abono_${Date.now()}`,
          monto: abonoReal,
          metodoPago: metodoPago,
          fecha: new Date(),
          registradoPor: nombreUsuario || "Vendedor"
        };
        if (subMetodoPago.trim()) nuevoAbono.subMetodoPago = subMetodoPago.trim();
        if (referenciaPago.trim()) nuevoAbono.referenciaPago = referenciaPago.trim();

        const abonosActuales = separeSeleccionado.abonos || [];
        const nuevoMontoPagado = (separeSeleccionado.montoPagado || 0) + abonoReal;
        const nuevoSaldoPendiente = Math.max(0, (separeSeleccionado.total || 0) - nuevoMontoPagado);

        const separeRef = doc(db, "separes", separeSeleccionado.id);
        await updateDoc(separeRef, {
          abonos: [...abonosActuales, nuevoAbono],
          montoPagado: nuevoMontoPagado,
          saldoPendiente: nuevoSaldoPendiente
        });

        // Registrar en movimientos
        await addDoc(collection(db, "movimientos"), {
          clienteId: clienteTransaccion.id,
          usuarioId: cuentaPrincipalId,
          tipo: 'abono',
          monto: abonoReal,
          descripcion: `Abono a Plan Separe (${metodoPagoLabel}) - ${clienteTransaccion.nombre}`,
          fecha: new Date(),
          registradoPor: nombreUsuario,
          metodoPago: metodoPago,
          referenciaPago: refPagoCompleta || undefined,
          idSepareOrigen: separeSeleccionado.id
        });

        reproducirSonidoExito();

        const ticketDatos = {
          nombreNegocio: nombreNegocio || "Mi Negocio",
          telefonoNegocio: datosSesion?.telefonoNegocio || "",
          correoNegocio: datosSesion?.correoNegocio || "",
          logoNegocio: datosSesion?.logoNegocio || null,
          nitNegocio: datosSesion?.nitNegocio || "",
          direccionNegocio: datosSesion?.direccionNegocio || "",
          mensajePieTicket: datosSesion?.mensajePieTicket || "Comprobante de Abono Plan Separe.",
          nombreCliente: clienteTransaccion.nombre,
          celularCliente: clienteTransaccion.celular || "",
          registradoPor: nombreUsuario || "",
          fecha: new Date(),
          tipo: 'abono' as const,
          detalles: (separeSeleccionado.items || []).map((it: any) => ({
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            valor: (Number(it.valor) || 0) * it.cantidad,
            valorUnitario: Number(it.valor) || 0
          })),
          descripcionGeneral: `Abono a Plan Separe: $${abonoReal.toLocaleString('es-CO')} | Saldo restante: $${nuevoSaldoPendiente.toLocaleString('es-CO')}`,
          montoTotal: abonoReal,
          pagoRecibido: abonoReal,
          saldoNuevo: nuevoSaldoPendiente,
          idTransaccion: separeSeleccionado.id,
          metodoPago: metodoPago,
          referenciaPago: refPagoCompleta
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
      }

      // 2. SI ES ABONO A DEUDA GENERAL DE FIADOS
      const resAbono = await API_DB.registrarMovimientoConTransaccion(
        {
          clienteId: clienteTransaccion.id,
          usuarioId: cuentaPrincipalId,
          tipo: 'abono',
          monto: abonoReal,
          descripcion: `Abono a cuenta (${metodoPagoLabel})`,
          fecha: new Date(),
          registradoPor: nombreUsuario,
          metodoPago: metodoPago,
          referenciaPago: refPagoCompleta,
          detalles: []
        },
        {
          ajustarSaldoCliente: true,
          cambioDeuda: -abonoReal
        }
      );

      reproducirSonidoExito();

      const saldoFinal = resAbono.nuevoSaldoCliente !== undefined ? resAbono.nuevoSaldoCliente : ((clienteTransaccion.deudaTotal || 0) - abonoReal);
      const clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: saldoFinal };

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
        registradoPor: nombreUsuario || "",
        fecha: new Date(),
        tipo: 'abono' as const,
        detalles: [],
        descripcionGeneral: "Abono a cuenta",
        montoTotal: abonoReal,
        pagoRecibido: abonoReal,
        saldoNuevo: saldoFinal,
        idTransaccion: resAbono.movimientoId,
        metodoPago: metodoPago,
        referenciaPago: refPagoCompleta
      };

      setModalExito({ 
        visible: true, 
        cliente: clienteFinalActualizado,
        montoTotal: abonoReal,
        ticketDatos,
        esSepare: false
      });
      
    } catch (error) { 
      console.error(error);
      alert("Error al procesar el abono."); 
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
    const abonoMonto = parseFloat(montoAbono.replace(/\D/g, '')) || 0;

    let texto = "";
    if (modalExito?.esSepare) {
      texto = `¡Hola, *${cliente.nombre}*! Gracias por tu abono en *${nombreNegocio || 'nuestra tienda'}*.

===================
*ABONO A PLAN SEPARE*
===================

• Abono recibido: *$${abonoMonto.toLocaleString('es-CO')}*
• Método: *${metodoPago.toUpperCase()}${subMetodoPago ? ` (${subMetodoPago})` : ''}*
• Saldo restante: *$${(modalExito.saldoRestanteSepare || 0).toLocaleString('es-CO')}*

Gracias por tu pago y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;
    } else {
      const saldoFormat = cliente.deudaTotal < 0 
        ? `$${Math.abs(cliente.deudaTotal).toLocaleString('es-CO')} a favor` 
        : `$${cliente.deudaTotal.toLocaleString('es-CO')}`;

      texto = `¡Hola, *${cliente.nombre}*! Gracias por tu abono en *${nombreNegocio || 'nuestra tienda'}*.

===================
*COMPROBANTE DE ABONO*
===================

• Abono recibido: *$${abonoMonto.toLocaleString('es-CO')}*
• Método: *${metodoPago.toUpperCase()}${subMetodoPago ? ` (${subMetodoPago})` : ''}*
• Saldo actual en cuenta: *${saldoFormat}*

Gracias por tu abono y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;
    }

    const mensajeLimpio = normalizarMensajeWhatsApp(texto);
    const celularLimpio = cliente.celular ? cliente.celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(mensajeLimpio)}` : `https://wa.me/?text=${encodeURIComponent(mensajeLimpio)}`;
    
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const clientesFiltradosRegistro = clientes.filter(c => 
    c.nombre?.toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
    c.celular?.includes(busquedaRegistro)
  );

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
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm cursor-pointer active:scale-95 shrink-0">
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-base sm:text-xl font-black uppercase tracking-wide flex items-center gap-2 truncate">
            <Banknote size={20} className="shrink-0"/> <span className="truncate">Registrar Abono</span>
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
                      <span className="font-black text-slate-900 dark:text-blue-300 text-sm sm:text-base truncate">{clienteTransaccion.nombre}</span>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${clienteTransaccion.deudaTotal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {clienteTransaccion.deudaTotal > 0 ? 'Deuda actual:' : 'Saldo a favor:'} ${Math.abs(clienteTransaccion.deudaTotal).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <button onClick={() => {setClienteTransaccion(null); setMontoAbono(""); setSeparesCliente([]);}} className="text-rose-500 shrink-0 hover:bg-rose-100 p-1 rounded-full cursor-pointer"><X size={16}/></button>
                  </div>
                ) : (
                  <div className="relative">
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
                          }
                        }
                      }}
                      placeholder="Buscar por nombre o celular..."
                      className="w-full pl-9 pr-3 py-2 sm:py-2.5 bg-white dark:bg-[#0f172a] border border-blue-200 dark:border-blue-800 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-blue-500 transition-colors shadow-sm text-slate-900 dark:!text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                    />
                    
                    {mostrarResultadosBuscador && busquedaRegistro.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          {clientesFiltradosRegistro.map(c => (
                            <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setMostrarResultadosBuscador(false); }} className="p-2.5 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs sm:text-sm">
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.nombre}</span>
                                {c.celular && <span className="text-[10px] text-slate-400">{c.celular}</span>}
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

              {/* SELECTOR DE DESTINO SI EL CLIENTE TIENE PLANES SEPARE */}
              {clienteTransaccion && separesCliente.length > 0 && (
                <div className="flex flex-col bg-white dark:bg-[#020617] p-3 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2 animate-in slide-in-from-top-3 duration-200">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    ¿A qué deseas aplicar este abono?
                  </label>
                  
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
              {clienteTransaccion && (
                <div className="flex flex-col bg-white dark:bg-[#020617] p-3 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in slide-in-from-top-4 duration-300">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Banknote size={14}/> Paso 2: ¿Cuánto va a abonar?
                  </label>
                  
                  <div className="relative mb-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-black text-xl sm:text-2xl">$</span>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={montoAbono} 
                      onChange={(e) => setMontoAbono(formatearMonedaInput(e.target.value))} 
                      placeholder="0" 
                      className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-xl sm:text-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-500 transition-colors shadow-inner" 
                    />
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

                    <div className="grid grid-cols-4 gap-1.5 mb-1.5">
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
                    </div>

                    {/* Sub-selector Transferencia */}
                    {metodoPago === 'transferencia' && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-150 mb-2">
                        <label className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block mb-1">¿Por qué plataforma?</label>
                        <div className="flex flex-wrap gap-1.5">
                          {['Nequi', 'Daviplata', 'PSE', 'Bancolombia', 'Otro'].map(op => (
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

                    {/* Campo referencia */}
                    {metodoPago !== 'efectivo' && (
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
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO/MEDIO: RESUMEN DE ABONO */}
        <div className="w-full lg:w-[380px] xl:w-[420px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 lg:min-h-0 lg:overflow-hidden">
          
          <div className="p-3 lg:p-4 space-y-3 flex-1 min-h-0 lg:overflow-y-auto">
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
            <button onClick={procesarAbono} disabled={!clienteTransaccion || abonoNum <= 0} className={`w-full font-black text-lg py-3.5 rounded-2xl shadow-lg flex justify-center items-center gap-2 transition-all ${(!clienteTransaccion || abonoNum <= 0) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}>
              <span>Confirmar Abono</span> <CheckCircle2 size={20}/>
            </button>
          </div>

        </div>
      </div>

      {/* BARRA FLOTANTE MÓVIL SUSPENDIDA */}
      <div className="lg:hidden fixed bottom-[76px] sm:bottom-[84px] left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)] z-40 flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0 shrink pl-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total a Abonar</span>
          <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 truncate max-w-[140px] leading-none">${abonoNum.toLocaleString('es-CO')}</span>
        </div>
        <button onClick={procesarAbono} disabled={!clienteTransaccion || abonoNum <= 0} className={`flex-1 rounded-xl sm:rounded-2xl py-3 sm:py-3.5 px-4 font-black text-base sm:text-lg flex justify-center items-center gap-2 shadow-lg transition-all whitespace-nowrap ${(!clienteTransaccion || abonoNum <= 0) ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}>
          <span>Abonar</span> <CheckCircle2 size={18}/>
        </button>
      </div>


      {/* MODAL NUEVO CLIENTE (Con detección de Teléfono) */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-2"><UserCog size={28}/> Crear Cliente</h3>
            <div className="flex flex-col gap-4 mb-8">
              <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:border-blue-500 font-bold text-lg" />
              <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:border-blue-500 font-bold text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl text-lg">Cancelar</button>
              <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">Guardar <CheckCircle2 size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {modalExito && modalExito.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950] animate-in zoom-in duration-300">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100">
            <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 size={50} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">¡Abono Exitoso!</h2>
            
            <div className="mb-8 text-slate-500 text-base flex flex-col gap-2">
              <p>Se registró el pago de <strong className="text-slate-800">{modalExito.cliente.nombre}</strong></p>
              <p className="text-blue-600 font-bold bg-blue-50 p-3 rounded-xl mt-2 text-xl">Monto abonado: ${modalExito.montoTotal.toLocaleString('es-CO')}</p>
              <p className="text-sm mt-2">Nuevo saldo: <strong>${Math.abs(modalExito.cliente.deudaTotal).toLocaleString('es-CO')}</strong> {(modalExito.cliente.deudaTotal < 0) && "(A favor)"}</p>
            </div>
            
            {modalExito.ticketDatos && (
              <button
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExito.ticketDatos })}
                className="w-full mb-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg transition-transform active:scale-95"
              >
                <Printer size={22} /> Imprimir Factura / Ticket
              </button>
            )}

            {modalExito.cliente.celular && modalExito.cliente.celular.trim() !== "" && datosSesion?.rol !== 'cajero' && (
              <button onClick={() => abrirWhatsApp(modalExito.cliente)} className="w-full mb-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">
                <MessageCircle size={24} /> Enviar Comprobante
              </button>
            )}
            
            <button onClick={() => { setModalExito(null); router.push('/dashboard/inicio'); }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl text-lg">
              Volver al inicio
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN DE TICKET TÉRMICO */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />
    </div>
  );
}