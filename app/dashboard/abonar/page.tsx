"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, CheckCircle2, ChevronRight, X, AlertCircle, UserCog, ArrowLeft, MessageCircle, Banknote } from 'lucide-react';
import { useAuth } from "../../../hooks/AuthContext";

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
  const [busquedaRegistro, setBusquedaRegistro] = useState("");
  const [mostrarResultadosBuscador, setMostrarResultadosBuscador] = useState(false);
  
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, montoTotal: number } | null>(null);
  
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  useEffect(() => {
    if (cuentaPrincipalId) cargarDatosGlobales(cuentaPrincipalId);
  }, [cuentaPrincipalId]);

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

    try {
      const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) - abonoReal;
      
      await addDoc(collection(db, "movimientos"), {
          clienteId: clienteTransaccion.id, 
          usuarioId: cuentaPrincipalId, 
          tipo: 'abono', 
          monto: abonoReal,
          descripcion: "Abono a cuenta", 
          detalles: [], 
          saldoResultante: nuevoSaldoTotal, 
          fecha: new Date(), 
          registradoPor: nombreUsuario
      });

      const refCliente = doc(db, "clientes", clienteTransaccion.id);
      await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
      
      const clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };

      setModalExito({ 
          visible: true, 
          cliente: clienteFinalActualizado, 
          montoTotal: abonoReal 
      });
      
    } catch (error) { alert("Error al procesar el abono."); }
  };

  const abrirWhatsApp = (cliente: any) => {
    const abonoMonto = parseFloat(montoAbono.replace(/\D/g, '')) || 0;
    const saldoFormat = cliente.deudaTotal < 0 
      ? `A Favor: $${Math.abs(cliente.deudaTotal).toLocaleString('es-CO')}` 
      : `$${cliente.deudaTotal.toLocaleString('es-CO')}`;

    // MENSAJE LIMPIO SIN EMOJIS COMPLEJOS PARA EVITAR EL ""
    const texto = `Hola *${cliente.nombre}*\n\nHemos registrado tu abono exitosamente en *${nombreNegocio || 'nuestra tienda'}*.\n\n*RESUMEN DEL PAGO:*\n- Abono recibido: $${abonoMonto.toLocaleString('es-CO')}\n- Tu nuevo saldo pendiente: ${saldoFormat}\n\n¡Muchas gracias por tu pago y confianza!`;
    
    const celularLimpio = cliente.celular ? cliente.celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    }
  };

  const clientesFiltradosRegistro = clientes.filter(c => 
    c.nombre?.toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
    c.celular?.includes(busquedaRegistro)
  );

  const abonoNum = parseFloat(montoAbono.replace(/\D/g, '')) || 0;
  const deudaAnterior = clienteTransaccion?.deudaTotal || 0;
  const nuevoSaldoVisual = deudaAnterior - abonoNum;

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
      
      {/* HEADER SUPERIOR */}
      <div className="bg-blue-600 dark:bg-blue-800 p-4 md:p-6 text-white flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-colors backdrop-blur-sm">
            <ArrowLeft size={22} />
          </button>
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-2">
            <Banknote size={24}/> Registrar Abono
          </h2>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 relative overflow-y-auto lg:overflow-hidden">
        
        {/* PANEL IZQUIERDO: SELECCIÓN DE CLIENTE Y MONTO */}
        <div className="lg:flex-1 flex flex-col relative bg-slate-50/50 dark:bg-[#0f172a] lg:overflow-hidden shrink-0">
          <div className="flex-1 lg:overflow-y-auto p-4 sm:p-6 lg:p-8 pb-2">
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* BUSCADOR DE CLIENTE (Obligatorio) */}
              <div className={`flex flex-col bg-white dark:bg-[#020617] p-5 lg:p-6 rounded-3xl border shadow-sm relative transition-colors ${!clienteTransaccion ? 'border-blue-200 dark:border-blue-900 bg-blue-50/30' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCog size={16}/> Paso 1: Seleccionar Cliente
                  </label>
                </div>
                
                {clienteTransaccion ? (
                  <div className="py-4 px-5 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 flex justify-between items-center shadow-sm">
                    <div className="flex flex-col min-w-0 mr-2">
                      <span className="font-black text-slate-900 dark:text-blue-300 text-lg lg:text-xl truncate">{clienteTransaccion.nombre}</span>
                      <span className={`text-sm font-bold uppercase tracking-wider mt-1 ${clienteTransaccion.deudaTotal > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {clienteTransaccion.deudaTotal > 0 ? 'Deuda actual:' : 'Saldo a favor:'} ${Math.abs(clienteTransaccion.deudaTotal).toLocaleString('es-CO')}
                      </span>
                    </div>
                    <button onClick={() => {setClienteTransaccion(null); setMontoAbono("");}} className="text-rose-500 shrink-0 hover:bg-rose-100 p-2 rounded-full"><X size={20}/></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                    <input type="text" value={busquedaRegistro} onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }} onFocus={() => setMostrarResultadosBuscador(true)} placeholder="Buscar por nombre o número..." className="w-full pl-12 pr-4 py-4 lg:py-5 bg-white dark:bg-[#0f172a] border border-blue-200 dark:border-blue-800 rounded-2xl text-lg font-bold outline-none focus:border-blue-500 transition-colors shadow-sm" />
                    
                    {mostrarResultadosBuscador && busquedaRegistro.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          {clientesFiltradosRegistro.map(c => (
                            <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setMostrarResultadosBuscador(false); }} className="p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-base">
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.nombre}</span>
                                {c.celular && <span className="text-xs text-slate-400">{c.celular}</span>}
                              </div>
                              <ChevronRight size={18} className="text-slate-400"/>
                            </div>
                          ))}
                          {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                            <button onClick={() => prepararNuevoCliente(busquedaRegistro)} className="w-full text-left p-4 bg-blue-50 text-blue-700 text-base font-bold">
                              + Crear cliente "{busquedaRegistro}"
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* INPUT MONTO ABONO */}
              {clienteTransaccion && (
                <div className="flex flex-col bg-white dark:bg-[#020617] p-5 lg:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm animate-in slide-in-from-top-4 duration-300">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Banknote size={16}/> Paso 2: ¿Cuánto va a abonar?
                  </label>
                  <div className="relative shadow-sm rounded-2xl mb-3">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 font-bold text-2xl lg:text-3xl">$</span>
                    <input type="text" inputMode="numeric" value={montoAbono} onChange={(e) => setMontoAbono(formatearMonedaInput(e.target.value))} placeholder="Monto del abono..." className="w-full pl-12 pr-4 py-4 lg:py-6 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-2xl lg:text-4xl min-w-0 focus:border-blue-500 transition-colors" />
                  </div>
                  
                  {/* Botones Rápidos */}
                  <div className="flex gap-2">
                    {clienteTransaccion.deudaTotal > 0 && (
                      <button onClick={() => setMontoAbono(clienteTransaccion.deudaTotal.toLocaleString('es-CO'))} className="flex-1 text-[11px] lg:text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 py-3 rounded-xl transition-colors">
                        Saldar deuda completa
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANEL DERECHO/MEDIO: RESUMEN DE ABONO */}
        <div className="w-full lg:w-[400px] xl:w-[450px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 lg:overflow-y-auto">
          
          <div className="p-4 lg:p-6 pt-2 lg:pt-6 flex flex-col gap-4 flex-1 min-h-0">
            {clienteTransaccion && abonoNum > 0 ? (
              <div className="bg-white dark:bg-[#0f172a] p-5 rounded-3xl border border-slate-100 shadow-sm animate-in zoom-in-95">
                <h4 className="font-bold text-slate-400 uppercase text-[11px] tracking-wider mb-4 border-b pb-2">Resumen de la operación</h4>
                
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-500 font-medium">Deuda Anterior:</span>
                  <span className="font-bold text-slate-800">${deudaAnterior.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-slate-500 font-medium">Monto Abonado:</span>
                  <span className="font-bold text-blue-600">- ${abonoNum.toLocaleString('es-CO')}</span>
                </div>
                
                <div className={`flex justify-between items-center mt-4 pt-3 border-t ${nuevoSaldoVisual < 0 ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <span className={`font-bold uppercase tracking-wider text-xs ${nuevoSaldoVisual <= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {nuevoSaldoVisual < 0 ? 'Nuevo Saldo a Favor:' : (nuevoSaldoVisual === 0 ? 'Cuenta Saldada' : 'Nuevo Saldo Pendiente:')}
                  </span>
                  <span className={`text-2xl font-black ${nuevoSaldoVisual <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ${Math.abs(nuevoSaldoVisual).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-50 p-10 text-center">
                <Banknote size={60} className="mb-4" />
                <p className="font-bold">Selecciona un cliente e ingresa el monto para ver el resumen.</p>
              </div>
            )}
          </div>

          <div className="hidden lg:block bg-slate-900 dark:bg-black p-6 shrink-0 lg:rounded-tl-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-30 mt-auto">
            <div className="flex justify-between items-end mb-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total a Abonar</span>
              <span className="text-5xl font-black text-blue-400 leading-none">${abonoNum.toLocaleString('es-CO')}</span>
            </div>
            <button onClick={procesarAbono} disabled={!clienteTransaccion || abonoNum <= 0} className={`w-full font-black text-2xl py-5 rounded-2xl shadow-lg flex justify-center items-center gap-2 transition-all ${(!clienteTransaccion || abonoNum <= 0) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'}`}>
              Confirmar Abono <CheckCircle2 size={24}/>
            </button>
          </div>

        </div>
      </div>

      <div className="lg:hidden shrink-0 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800 px-4 py-3 sm:py-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-40 flex justify-between items-center gap-4">
        <div className="flex flex-col min-w-0 shrink">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total a Abonar</span>
          <span className="text-2xl font-black text-blue-600 truncate max-w-[150px] leading-none">${abonoNum.toLocaleString('es-CO')}</span>
        </div>
        <button onClick={procesarAbono} disabled={!clienteTransaccion || abonoNum <= 0} className={`flex-1 rounded-[1rem] py-3.5 px-2 font-black text-lg flex justify-center items-center gap-2 shadow-md transition-all whitespace-nowrap ${(!clienteTransaccion || abonoNum <= 0) ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white active:scale-[0.98]'}`}>
          Abonar <CheckCircle2 size={20}/>
        </button>
      </div>

      <div className="h-24 lg:hidden w-full bg-slate-50 dark:bg-[#020617] shrink-0"></div>

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
    </div>
  );
}