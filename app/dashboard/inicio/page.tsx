"use client";
import { useState, useEffect, useRef } from "react";
import { collection, addDoc, getDocs, query, doc, updateDoc, where, deleteDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth } from "../../../firebase";
import { Search, ShoppingBag, Banknote, Users, CheckCircle2, ChevronRight, X, MessageCircle, AlertCircle, UserCog, ShoppingCart, Plus, Minus, EyeOff, Edit2, Trash2, Lock, Star, ShieldAlert, Clock, ArrowLeft } from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "../../../hooks/AuthContext";

export default function InicioPage() {
  const { datosSesion } = useAuth();
  
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const nombreUsuario = datosSesion?.nombreUsuario;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerDirectorio = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verDirectorio === true;
  const puedeVerCelulares = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verCelulares === true;

  const [clientes, setClientes] = useState<any[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<any[]>([]);
  
  const [modalRegistro, setModalRegistro] = useState(false);
  const [accionRegistro, setAccionRegistro] = useState<'fiado' | 'abono' | 'venta' | null>(null);
  const [pasoRegistro, setPasoRegistro] = useState<1 | 2>(1);
  const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
  const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string; cantidad: number }[]>([{ descripcion: "", valor: "", cantidad: 1 }]);
  const [pagoCliente, setPagoCliente] = useState(""); 
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, accion: any, detalles: any[], montoTotal: number, devuelta?: number, fiadoAdicional?: number } | null>(null);
  
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [verTodosClientes, setVerTodosClientes] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });

  const [modoEdicionCliente, setModoEdicionCliente] = useState(false);
  const [editNombreCliente, setEditNombreCliente] = useState("");
  const [editCelularCliente, setEditCelularCliente] = useState("");
  const [modalSeguridad, setModalSeguridad] = useState<{ visible: boolean, accion: 'eliminar_cliente' | 'editar_cliente' | null }>({ visible: false, accion: null });
  const [passSeguridad, setPassSeguridad] = useState("");
  const [errorSeguridad, setErrorSeguridad] = useState("");
  const [cargandoSeguridad, setCargandoSeguridad] = useState(false);

  const finalListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cuentaPrincipalId) cargarDatosGlobales(cuentaPrincipalId);
  }, [cuentaPrincipalId]);

  useEffect(() => {
    if (modalRegistro && pasoRegistro === 2 && finalListaRef.current) {
      setTimeout(() => finalListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [filasRegistro.length, pasoRegistro, modalRegistro]);

  const cargarDatosGlobales = async (uid: string) => {
    try {
      const qC = query(collection(db, "clientes"), where("usuarioId", "==", uid));
      const snapC = await getDocs(qC);
      const listaC: any[] = [];
      snapC.forEach((doc) => listaC.push({ id: doc.id, ...doc.data() }));
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);

      const qM = query(collection(db, "movimientos"), where("usuarioId", "==", uid));
      const snapM = await getDocs(qM);
      const listaM: any[] = [];
      snapM.forEach((doc) => listaM.push({ id: doc.id, ...doc.data() }));
      listaM.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
      setTodosMovimientos(listaM);
    } catch (error) { console.error(error); }
  };

  const cargarMovimientosClienteDirecto = async (clienteId: string) => {
    const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
    const snapM = await getDocs(qM);
    const lista: any[] = [];
    snapM.forEach(doc => lista.push({id: doc.id, ...doc.data()}));
    lista.sort((a,b) => b.fecha.toMillis() - a.fecha.toMillis());
    setMovimientosCliente(lista);
  };

  const abrirUpsell = (titulo: string, mensaje: string) => { setModalSuscripcion({ visible: true, titulo, mensaje }); };

  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    if (planActual === 'basico' && clientes.length >= 10) {
      setModalNuevoCliente(false);
      setTimeout(() => { abrirUpsell("Límite de Clientes Alcanzado", "En el plan básico se permite un máximo de 10 clientes.\n\nMejora a nuestro plan PRO para clientes ilimitados."); }, 100);
      return;
    }
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), { nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: cuentaPrincipalId, fecha_creacion: new Date() });
      const nuevoObj = { id: docRef.id, nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0 };
      setModalNuevoCliente(false); setNombreNuevo(""); setCelularNuevo("");
      await cargarDatosGlobales(cuentaPrincipalId);
      if (modalRegistro && pasoRegistro === 1) { setClienteTransaccion(nuevoObj); setPasoRegistro(2); }
    } catch (error) { alert("Error al guardar cliente."); } finally { setGuardandoCliente(false); }
  };

  const totalFilasRegistro = filasRegistro.reduce((acc, fila) => { 
    const val = parseFloat(fila.valor || "0"); 
    const multiplicador = (accionRegistro === 'fiado' || accionRegistro === 'venta') ? fila.cantidad : 1;
    return acc + (isNaN(val) ? 0 : val * multiplicador); 
  }, 0);

  const procesarRegistro = async () => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) return alert("Ingresa al menos un monto válido.");

    const h = new Date();
    const movsHoy = todosMovimientos.filter(m => {
      const d = m.fecha?.toDate(); 
      if(!d) return false;
      return d.getDate() === h.getDate() && d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
    }).length;

    if (planActual === 'basico' && movsHoy >= 10) {
      setModalRegistro(false);
      setTimeout(() => { abrirUpsell("Límite de Movimientos", "Has alcanzado tu límite de 10 transacciones diarias en el plan básico. Activa el plan PRO para transacciones ilimitadas."); }, 100);
      return;
    }

    try {
      let montoAcumulado = 0; 
      let detallesParaComprobante: {descripcion: string, valor: number, cantidad: number, valorUnitario: number}[] = []; 
      let resumenNombres: string[] = [];
      
      for (const fila of filasValidas) {
        const valUnitario = parseFloat(fila.valor);
        const cantidad = (accionRegistro === 'fiado' || accionRegistro === 'venta') ? fila.cantidad : 1;
        const subtotalFila = valUnitario * cantidad;
        montoAcumulado += subtotalFila;
        let descFinal = fila.descripcion.trim() || (accionRegistro === 'abono' ? "Abono a cuenta" : "Artículo registrado");
        detallesParaComprobante.push({ descripcion: descFinal, valor: subtotalFila, cantidad: cantidad, valorUnitario: valUnitario }); 
        if ((accionRegistro === 'fiado' || accionRegistro === 'venta') && cantidad > 1) { resumenNombres.push(`${cantidad}x ${descFinal}`); } 
        else { resumenNombres.push(descFinal); }
      }
      const descripcionUnificada = resumenNombres.join(", ");

      if (accionRegistro === 'venta') {
          const pagadoRaw = pagoCliente.replace(/\D/g, '');
          const pagadoNum = pagadoRaw === "" ? 0 : parseFloat(pagadoRaw);

          if (pagadoNum === 0 && !clienteTransaccion) {
              return alert("⚠️ Para registrar una venta sin recibir dinero (o por valor $0), debes seleccionar o crear un cliente al cual asignarle la deuda total como fiado.");
          }

          const faltante = montoAcumulado - pagadoNum;
          const fiarFaltante = faltante > 0;

          if (fiarFaltante && !clienteTransaccion) {
              return alert("⚠️ El pago ingresado es menor al total y no hay un cliente seleccionado. Selecciona o crea un cliente para poder fiarle el excedente.");
          }

          const montoVentaReal = pagadoNum >= montoAcumulado ? montoAcumulado : pagadoNum;
          let clienteFinalActualizado = null;

          if (montoVentaReal > 0) {
              await addDoc(collection(db, "movimientos"), {
                  clienteId: clienteTransaccion ? clienteTransaccion.id : 'mostrador',
                  usuarioId: cuentaPrincipalId, tipo: 'venta', monto: montoVentaReal,
                  descripcion: descripcionUnificada + (fiarFaltante ? ` (Pago parcial de $${montoAcumulado.toLocaleString('es-CO')})` : ''),
                  detalles: detallesParaComprobante, fecha: new Date(), registradoPor: nombreUsuario
              });
          }

          if (fiarFaltante && clienteTransaccion) {
              const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + faltante;
              await addDoc(collection(db, "movimientos"), {
                  clienteId: clienteTransaccion.id, usuarioId: cuentaPrincipalId, tipo: 'fiado', monto: faltante,
                  descripcion: `Saldo pendiente de venta: ${descripcionUnificada}`, detalles: [], saldoResultante: nuevoSaldoTotal, fecha: new Date(), registradoPor: nombreUsuario
              });
              const refCliente = doc(db, "clientes", clienteTransaccion.id);
              await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
              clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };
          }

          setModalExito({ 
              visible: true, cliente: clienteFinalActualizado || { nombre: "Cliente Mostrador", celular: "" }, 
              accion: 'venta', detalles: detallesParaComprobante, montoTotal: montoAcumulado,
              devuelta: pagadoNum > montoAcumulado ? pagadoNum - montoAcumulado : 0, fiadoAdicional: faltante > 0 ? faltante : 0
          });
          setModalRegistro(false); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteTransaccion(null); setPagoCliente("");
          await cargarDatosGlobales(cuentaPrincipalId);
          if (clienteActivo && clienteFinalActualizado && clienteActivo.id === clienteFinalActualizado.id) {
              setClienteActivo(clienteFinalActualizado); await cargarMovimientosClienteDirecto(clienteFinalActualizado.id); 
          }
          return;
      }

      const ajuste = accionRegistro === 'fiado' ? montoAcumulado : -montoAcumulado;
      const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + ajuste;

      await addDoc(collection(db, "movimientos"), {
        clienteId: clienteTransaccion.id, usuarioId: cuentaPrincipalId, tipo: accionRegistro, monto: montoAcumulado, 
        descripcion: descripcionUnificada, detalles: detallesParaComprobante, saldoResultante: nuevoSaldoTotal, fecha: new Date(), registradoPor: nombreUsuario
      });

      const refCliente = doc(db, "clientes", clienteTransaccion.id);
      await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
      const clienteActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setModalExito({ visible: true, cliente: clienteActualizado, accion: accionRegistro, detalles: detallesParaComprobante, montoTotal: montoAcumulado });
      setModalRegistro(false); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteTransaccion(null); setPagoCliente("");
      await cargarDatosGlobales(cuentaPrincipalId);
      if (clienteActivo && clienteActivo.id === clienteTransaccion.id) {
        setClienteActivo(clienteActualizado); await cargarMovimientosClienteDirecto(clienteTransaccion.id); 
      }
    } catch (error) { alert("Error al procesar el registro."); }
  };

  const verificarSeguridadYEjecutar = async () => {
    if (!passSeguridad) return setErrorSeguridad("Ingresa tu contraseña de Administrador para confirmar.");
    setCargandoSeguridad(true); setErrorSeguridad("");
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser?.email || "", passSeguridad);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      setCargandoSeguridad(false); setPassSeguridad("");
      if (modalSeguridad.accion === 'eliminar_cliente') {
        setModalSeguridad({ visible: false, accion: null });
        await deleteDoc(doc(db, "clientes", clienteActivo.id)); setClienteActivo(null); await cargarDatosGlobales(cuentaPrincipalId);
      } else if (modalSeguridad.accion === 'editar_cliente') {
        setModalSeguridad({ visible: false, accion: null }); setModoEdicionCliente(true);
        setEditNombreCliente(clienteActivo.nombre); setEditCelularCliente(clienteActivo.celular || "");
      } 
    } catch (error: any) { setCargandoSeguridad(false); setErrorSeguridad("Contraseña incorrecta. Intenta de nuevo."); }
  };

  const actualizarCliente = async () => {
    if (!editNombreCliente.trim()) return alert("El nombre no puede estar vacío");
    try {
      await updateDoc(doc(db, "clientes", clienteActivo.id), { nombre: editNombreCliente.trim(), celular: editCelularCliente.trim() });
      setClienteActivo({ ...clienteActivo, nombre: editNombreCliente.trim(), celular: editCelularCliente.trim() });
      setModoEdicionCliente(false); await cargarDatosGlobales(cuentaPrincipalId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    } catch (error) { alert("Error al actualizar cliente."); }
  };

  const formatearMonedaInput = (valor: string) => {
    if (!valor) return "";
    const numeroStr = valor.replace(/\D/g, ''); 
    if (!numeroStr) return "";
    return parseInt(numeroStr, 10).toLocaleString('es-CO');
  };

  const agregarFila = () => setFilasRegistro([...filasRegistro, { descripcion: "", valor: "", cantidad: 1 }]);
  const actualizarFila = (index: number, campo: 'descripcion' | 'valor', valorNuevo: string) => {
    const nuevasFilas = [...filasRegistro]; 
    if (campo === 'valor') { nuevasFilas[index][campo] = valorNuevo.replace(/\D/g, '') as never; } 
    else { nuevasFilas[index][campo] = valorNuevo as never; }
    setFilasRegistro(nuevasFilas);
  };
  const actualizarCantidadFila = (index: number, delta: number) => {
    const nuevasFilas = [...filasRegistro];
    const nuevaCant = nuevasFilas[index].cantidad + delta;
    if (nuevaCant >= 1) { nuevasFilas[index].cantidad = nuevaCant; setFilasRegistro(nuevasFilas); }
  };
  const eliminarFila = (index: number) => { if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index)); };

  const generarTextoComprobante = (tipo: 'estado' | 'comprobante', cliente: any, accion?: 'fiado' | 'abono' | 'venta' | null, detallesArray?: any[], totalMov?: number) => {
    let texto = "";
    const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;

    if (tipo === 'estado') {
      texto = `¡Hola *${cliente.nombre}*! 👋 Somos *${nombreNegocio}*.\n\n📊 *ESTADO DE TU CUENTA*\n`;
      if (cliente.deudaTotal === 0) texto += `Tu cuenta está totalmente al día ($0). ¡Gracias por tu confianza! ✨`;
      else if ((cliente.deudaTotal || 0) < 0) texto += `Tienes un *saldo a favor* de: *${saldoFormat}*. 🛍️`;
      else texto += `Tu saldo pendiente actual es de: *${saldoFormat}*.`;
    } 
    else if (tipo === 'comprobante') {
      texto = `¡Hola${cliente.id !== 'mostrador' ? ` *${cliente.nombre}*` : ''}! 👋\nRegistramos un nuevo movimiento en *${nombreNegocio}*.\n\n`;
      if (detallesArray && detallesArray.length > 0) {
        texto += `🧾 *DETALLE DEL REGISTRO*\n`;
        detallesArray.forEach(d => { 
          if (d.cantidad && d.cantidad > 1) texto += `▪ ${d.cantidad}x ${d.descripcion} a $${d.valorUnitario?.toLocaleString('es-CO')} c/u: $${d.valor.toLocaleString('es-CO')}\n`;
          else texto += `▪ ${d.descripcion}: $${d.valor.toLocaleString('es-CO')}\n`;
        });
        texto += `\n*Total de la operación:* $${totalMov?.toLocaleString('es-CO')}\n\n`;
      }
      if (cliente.id !== 'mostrador') {
        texto += `📊 *ESTADO DE CUENTA*\n`;
        if (cliente.deudaTotal === 0) texto += `Con esto, tu cuenta ha quedado al día ($0). ¡Muchas gracias! ✨`;
        else if ((cliente.deudaTotal || 0) < 0) texto += `Tu nuevo saldo a favor es de: *${saldoFormat}*.`;
        else texto += `Tu saldo pendiente actual es de: *${saldoFormat}*.`;
      } else { texto += `¡Gracias por tu compra! ✨`; }
    }
    return texto;
  };

  const abrirWhatsApp = (texto: string, celular?: string) => {
    const celularLimpio = celular ? celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.location.href = url;
  };

  const clientesFiltrados = clientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()));
  const directorioFiltrado = clientes.filter(c => c.nombre?.toLowerCase().includes(busquedaDirectorio.toLowerCase()));

  return (
    <>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className="relative z-20">
          <div className="relative shadow-sm rounded-[2rem]">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={28} />
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente registrado..." 
              className="w-full text-lg sm:text-xl p-5 sm:p-6 pl-14 sm:pl-16 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/60 rounded-[2rem] focus:border-blue-500 dark:focus:border-blue-400 outline-none shadow-sm dark:shadow-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium" />
          </div>
          
          {busqueda.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/80 rounded-3xl mt-2 shadow-2xl max-h-[60vh] overflow-y-auto z-40 p-3">
              {clientesFiltrados.length > 0 ? (
                clientesFiltrados.map((c) => (
                  <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setBusqueda(""); }} className="p-5 hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-2xl cursor-pointer flex justify-between items-center transition-colors mb-2 gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate min-w-0 flex-1">{c.nombre}</span>
                    <span className={`text-base font-black tracking-tight shrink-0 whitespace-nowrap ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : (c.deudaTotal < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}`}>
                      {c.deudaTotal === 0 ? '$0 (Al día)' : (c.deudaTotal < 0 ? `A favor: $${Math.abs(c.deudaTotal).toLocaleString('es-CO')}` : `Deuda: $${c.deudaTotal.toLocaleString('es-CO')}`)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="mb-6 text-xl">"{busqueda}" no está en tu directorio.</p>
                  <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2 mx-auto shadow-md">
                    <UserCog size={24} /> Crear Cliente
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* MÓDULOS PRINCIPALES */}
        <section className="flex flex-col gap-4 sm:gap-6">
          <button onClick={() => { setAccionRegistro('venta'); setPasoRegistro(2); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setPagoCliente(""); setModalRegistro(true); }} 
            className="w-full bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-600 hover:to-green-800 text-white font-black text-2xl sm:text-4xl py-12 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30 dark:border-emerald-500/20">
            <ShoppingCart size={48} className="mb-3 opacity-90 shrink-0" />
            VENDER
          </button>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <button onClick={() => { setAccionRegistro('fiado'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setPagoCliente(""); setModalRegistro(true); }} 
              className="bg-gradient-to-br from-rose-500 to-red-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-red-700 text-white font-black text-2xl sm:text-3xl py-10 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-rose-400/30 dark:border-rose-500/20">
              <ShoppingBag size={40} className="mb-3 opacity-90 shrink-0" />
              FIAR
            </button>
            <button onClick={() => { setAccionRegistro('abono'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setPagoCliente(""); setModalRegistro(true); }} 
              className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-black text-2xl sm:text-3xl py-10 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-blue-400/30 dark:border-blue-500/20">
              <Banknote size={40} className="mb-3 opacity-90 shrink-0" />
              ABONAR
            </button>
          </div>
        </section>

        {puedeVerDirectorio && (
          <button onClick={() => setVerTodosClientes(true)} className="bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-[#1e293b] text-blue-900 dark:text-blue-400 font-bold text-xl py-6 rounded-[2rem] shadow-sm transition-colors border border-slate-200 dark:border-slate-800/60 flex justify-center items-center gap-3 relative z-10">
            <Users size={28} className="shrink-0" /> Directorio de clientes
          </button>
        )}
      </div>

      {/* --- INICIO DE MODALES & VISTAS EXTENDIDAS DE ESCRITORIO --- */}

      {/* DIRECTORIO MODAL */}
      {verTodosClientes && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-0 md:p-6 z-[200] overflow-hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-none md:rounded-[2.5rem] w-full h-full md:h-[90vh] md:max-w-7xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row">
            
            <div className="w-full md:w-5/12 flex flex-col border-r border-slate-100 dark:border-slate-800 h-full bg-slate-50/50 dark:bg-[#020617]/50">
              <div className="bg-blue-600 dark:bg-blue-900 p-6 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2"><Users size={26}/> Directorio de Clientes</h2>
                <button onClick={() => setVerTodosClientes(false)} className="text-blue-200 hover:text-white transition-colors bg-blue-700/50 p-2 rounded-full"><X size={24}/></button>
              </div>
              
              <div className="p-4 bg-white dark:bg-[#0f172a] shrink-0 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input type="text" value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)} placeholder="Buscar en el directorio..." className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium" />
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {directorioFiltrado.map(c => (
                  <div key={c.id} onClick={() => { 
                    setClienteActivo(c); 
                    cargarMovimientosClienteDirecto(c.id); 
                    if (window.innerWidth < 768) { setVerTodosClientes(false); }
                  }} className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${clienteActivo?.id === c.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/50 shadow-sm' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/80 hover:border-blue-300'}`}>
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

              <div className="p-4 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button onClick={() => { setNombreNuevo(""); setModalNuevoCliente(true); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-colors flex justify-center items-center gap-2 text-base">
                  <UserCog size={20} /> Nuevo Cliente
                </button>
              </div>
            </div>

            {/* Panel Derecho de Escritorio (Perfil Completo al lado) */}
            <div className="hidden md:flex flex-1 flex-col h-full bg-white dark:bg-[#0f172a] overflow-hidden">
              {clienteActivo ? (
                <div className="flex flex-col h-full">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
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

                  <div className="p-4 bg-slate-50 dark:bg-[#020617] border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0">
                    <div className="flex gap-3">
                      <button onClick={() => { setAccionRegistro('venta'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm uppercase shadow-sm">
                        + Vender
                      </button>
                      <button onClick={() => { setAccionRegistro('fiado'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl text-sm uppercase shadow-sm">
                        + Fiar
                      </button>
                      <button onClick={() => { setAccionRegistro('abono'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-sm uppercase shadow-sm">
                        + Abonar
                      </button>
                    </div>

                    {clienteActivo.celular && datosSesion?.rol !== 'cajero' && (
                      <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] dark:text-[#25D366] font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm border border-[#25D366]/20">
                        <MessageCircle size={18} /> Enviar estado por WhatsApp
                      </button>
                    )}
                  </div>

                  {/* Historial en Escritorio con barras de colores */}
                  <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 dark:bg-[#020617]/50">
                    <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Historial Detallado de Operaciones</h4>
                    {movimientosCliente.map(mov => (
                      <div key={mov.id} className="p-5 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-3">
                        {/* Barra Lateral Color */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
                        
                        <div className="pl-2">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                            <span className={`text-xs font-black uppercase px-3 py-1 rounded-lg ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')}`}>
                              {mov.tipo}
                            </span>
                            <span className="text-xs font-medium text-slate-400">{mov.fecha?.toDate().toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                          </div>

                          {mov.detalles && mov.detalles.length > 0 ? (
                            <div className="space-y-2 py-1">
                              {mov.detalles.map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                                    {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} font-black mr-1.5`}>{d.cantidad}x</strong>}
                                    {d.descripcion}
                                    {d.cantidad > 1 && <span className="text-xs text-slate-400 ml-1">(${d.valorUnitario?.toLocaleString('es-CO')} c/u)</span>}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100">${d.valor.toLocaleString('es-CO')}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                          )}

                          <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800 font-black">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Total de la operación</span>
                            <span className={`text-xl ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-600' : 'text-blue-500')}`}>
                              {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {movimientosCliente.length === 0 && (
                      <div className="text-center text-slate-400 py-20">Este cliente no registra historial.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <Users size={64} className="opacity-20 mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Selecciona un cliente</h3>
                  <p className="text-sm mt-1 max-w-sm">Haz clic en cualquier cliente de la lista de la izquierda para ver su perfil completo y su historial detallado.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* PERFIL DEL CLIENTE EN MÓVIL (Con z-index 500 y colores consistentes) */}
      {clienteActivo && !verTodosClientes && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[500] md:hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-xl shadow-2xl relative flex flex-col h-[90vh] sm:h-[85vh] overflow-hidden border border-slate-100 dark:border-slate-800/60">
            
            <div className="p-4 sm:p-5 flex justify-between items-center bg-slate-50 dark:bg-[#020617] shrink-0 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg">Perfil de Cliente</h3>
              <button onClick={() => setClienteActivo(null)} className="bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 shadow-sm"><X size={20}/></button>
            </div>

            <div className="px-6 py-5 bg-slate-50 dark:bg-[#020617] text-center shrink-0 flex flex-col items-center border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">{clienteActivo.nombre}</h2>
              <p className="text-slate-500 font-medium text-base mb-4">{clienteActivo.celular || "Sin número registrado"}</p>
              
              <div className="flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] w-full py-4 px-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-4">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 px-2 py-0.5 rounded ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'}`}>
                  {(clienteActivo.deudaTotal || 0) < 0 ? '✨ Saldo a favor' : (clienteActivo.deudaTotal === 0 ? 'CUENTA AL DÍA' : 'SALDO PENDIENTE')}
                </p>
                <p className={`text-4xl sm:text-5xl font-black tracking-tighter ${clienteActivo.deudaTotal === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500' : 'text-rose-500')}`}>${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full mb-3">
                <button onClick={() => { setAccionRegistro('venta'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteActivo(null); setModalRegistro(true); }} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-sm text-xs uppercase">Vender</button>
                <button onClick={() => { setAccionRegistro('fiado'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteActivo(null); setModalRegistro(true); }} className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl shadow-sm text-xs uppercase">Fiar</button>
                <button onClick={() => { setAccionRegistro('abono'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteActivo(null); setModalRegistro(true); }} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-sm text-xs uppercase">Abonar</button>
              </div>

              {clienteActivo.celular && datosSesion?.rol !== 'cajero' && (
                <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] dark:text-[#25D366] font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm border border-[#25D366]/20">
                  <MessageCircle size={18} /> Enviar estado por WhatsApp
                </button>
              )}
            </div>
            
            {/* Historial en Móvil con barras de colores */}
            <div className="bg-white dark:bg-[#0f172a] p-6 flex-1 overflow-y-auto space-y-3">
              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3">Historial Reciente</h4>
              {movimientosCliente.map(mov => (
                <div key={mov.id} className="p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
                  
                  <div className="pl-1">
                    <div className="flex justify-between items-center pb-1">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}`}>{mov.tipo}</span>
                      <span className="text-[10px] text-slate-400">{mov.fecha?.toDate().toLocaleDateString('es-CO')}</span>
                    </div>
                    {mov.detalles && mov.detalles.length > 0 ? (
                      <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                        {mov.detalles.map((d: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-300">
                              {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} mr-1`}>{d.cantidad}x</strong>}
                              {d.descripcion}
                            </span>
                            <span className="font-bold">${d.valor.toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                    )}
                    <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 text-xs font-black">
                      <span className="text-slate-400 uppercase">Total:</span>
                      <span className={mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}>
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
      )}

      {/* NUEVO CLIENTE MODAL */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[210]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/60 animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><UserCog size={28}/> Registrar Cliente</h3>
            <div className="flex flex-col gap-4 mb-8">
              <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-lg" />
              <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl text-lg">Cancelar</button>
              <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">Guardar <CheckCircle2 size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA EXPANDIDA EN ESCRITORIO PARA MÓDULOS (VENDER, FIAR, ABONAR) */}
      {modalRegistro && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-0 md:p-6 z-[250] overflow-hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-none md:rounded-[2.5rem] w-full h-full md:h-[90vh] md:max-w-5xl shadow-2xl flex flex-col border border-slate-100 dark:border-slate-800/60 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className={`p-6 text-white flex justify-between items-center shrink-0 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-700' : (accionRegistro === 'venta' ? 'bg-gradient-to-r from-emerald-500 to-green-700' : 'bg-gradient-to-r from-blue-500 to-blue-700')}`}>
              <h2 className="text-3xl font-black uppercase tracking-wide flex items-center gap-3">
                {accionRegistro === 'fiado' && <ShoppingBag size={32}/>} 
                {accionRegistro === 'abono' && <Banknote size={32}/>}
                {accionRegistro === 'venta' && <ShoppingCart size={32}/>}
                Registrar {accionRegistro}
              </h2>
              <button onClick={() => setModalRegistro(false)} className="text-white hover:text-white/70 bg-white/10 rounded-full w-12 h-12 flex items-center justify-center transition-colors"><X size={28}/></button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              
              <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col justify-between bg-white dark:bg-[#0f172a]">
                <div className="space-y-6">
                  {pasoRegistro === 1 && accionRegistro !== 'venta' && (
                    <div>
                      <p className="font-black text-slate-800 dark:text-slate-100 mb-4 text-xl">Selecciona o busca el cliente:</p>
                      <div className="relative mb-4">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
                        <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribe el nombre del cliente..." className="w-full p-4 pl-14 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 text-lg font-medium" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                        {clientesFiltrados.map(c => (
                          <div key={c.id} onClick={() => { setClienteTransaccion(c); setPasoRegistro(2); setBusqueda(""); }} className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500 cursor-pointer flex justify-between items-center transition-all">
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-base">{c.nombre}</span>
                            <ChevronRight size={18} className="text-slate-400"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(pasoRegistro === 2 || accionRegistro === 'venta') && (
                    <div>
                      {accionRegistro !== 'venta' && clienteTransaccion && (
                        <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-200 dark:border-blue-500/20 flex justify-between items-center mb-6">
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Cliente Destino:</span>
                          <span className="font-black text-blue-900 dark:text-white text-xl">{clienteTransaccion.nombre}</span>
                        </div>
                      )}

                      <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3">Artículos o Conceptos</h4>
                      <div className="space-y-4">
                        {filasRegistro.map((fila, index) => (
                          <div key={index} className="flex flex-col md:flex-row gap-3 p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-sm">
                            {filasRegistro.length > 1 && (
                              <button onClick={() => eliminarFila(index)} className="absolute -top-3 -right-3 bg-rose-100 text-rose-500 rounded-full p-1.5 shadow-md"><X size={16}/></button>
                            )}
                            <input type="text" value={fila.descripcion} onChange={(e) => actualizarFila(index, 'descripcion', e.target.value)} placeholder="Ej. Producto o servicio A" className="flex-1 p-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-base min-w-0" />
                            
                            {(accionRegistro === 'fiado' || accionRegistro === 'venta') && (
                              <div className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shrink-0 h-[56px] w-[120px]">
                                <button onClick={() => actualizarCantidadFila(index, -1)} className="px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b]"><Minus size={18}/></button>
                                <span className="flex-1 text-center font-black text-lg">{fila.cantidad}</span>
                                <button onClick={() => actualizarCantidadFila(index, 1)} className="px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b]"><Plus size={18}/></button>
                              </div>
                            )}

                            <div className="relative w-full md:w-56 shrink-0 min-w-0">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">$</span>
                              <input type="text" inputMode="numeric" value={formatearMonedaInput(fila.valor)} onChange={(e) => actualizarFila(index, 'valor', e.target.value)} placeholder="Valor" className="w-full pl-9 pr-3 py-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-lg md:text-xl h-[56px] box-border min-w-0" />
                            </div>
                          </div>
                        ))}

                        <button onClick={agregarFila} className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 px-5 py-3 rounded-xl transition-colors flex items-center gap-2 text-sm"><Plus size={18}/> Añadir otra fila</button>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={finalListaRef}></div>
              </div>

              <div className="w-full md:w-5/12 bg-slate-50 dark:bg-[#020617] p-6 md:p-8 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 flex flex-col justify-between shrink-0">
                <div className="space-y-6">
                  <h3 className="font-black text-xl text-slate-900 dark:text-white">Resumen de Operación</h3>
                  
                  {accionRegistro === 'venta' && (
                    <div>
                      <label className="font-bold text-slate-600 dark:text-slate-400 text-sm block mb-2">Dinero entregado por el cliente</label>
                      <div className="relative min-w-0">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
                        <input type="text" inputMode="numeric" value={pagoCliente} onChange={(e) => setPagoCliente(formatearMonedaInput(e.target.value))} placeholder="Monto recibido" className="w-full pl-9 pr-3 py-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-xl md:text-2xl box-border min-w-0" />
                      </div>

                      {pagoCliente && parseFloat(pagoCliente.replace(/\D/g, '')) >= totalFilasRegistro && totalFilasRegistro > 0 && (
                        <div className="mt-4 p-4 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl text-center">
                          <p className="text-xs uppercase font-bold tracking-wider">Devuelta</p>
                          <p className="text-3xl font-black">${(parseFloat(pagoCliente.replace(/\D/g, '')) - totalFilasRegistro).toLocaleString('es-CO')}</p>
                        </div>
                      )}

                      <div className="mt-4">
                        <p className="text-xs font-bold text-slate-500 mb-2">Asociar Cliente (Opcional si paga completo)</p>
                        {clienteTransaccion ? (
                          <div className="p-3 bg-white dark:bg-[#0f172a] rounded-xl border flex justify-between items-center">
                            <span className="font-bold">{clienteTransaccion.nombre}</span>
                            <button onClick={() => setClienteTransaccion(null)} className="text-rose-500"><X size={18}/></button>
                          </div>
                        ) : (
                          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente..." className="w-full p-3 bg-white dark:bg-[#0f172a] border rounded-xl text-sm font-bold" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-6 bg-slate-900 dark:bg-black text-white rounded-3xl shadow-xl">
                    <p className="text-sm text-slate-400 font-medium">Total a Pagar</p>
                    <p className="text-4xl md:text-5xl font-black mt-1 break-words">${totalFilasRegistro.toLocaleString('es-CO')}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <button onClick={procesarRegistro} className={`w-full text-white font-black text-xl py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 flex justify-center items-center gap-3 ${accionRegistro === 'fiado' ? 'bg-rose-600 hover:bg-rose-700' : (accionRegistro === 'venta' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700')}`}>
                    Confirmar Operación <CheckCircle2 size={26}/>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL ÉXITO REGISTROS */}
      {modalExito && modalExito.visible && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800/60">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 size={50} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Registro Exitoso!</h2>
            {modalExito.accion === 'venta' ? (
              <div className="mb-8 text-slate-500 dark:text-slate-400 text-base flex flex-col gap-2">
                <p>Venta por <strong className="text-slate-800 dark:text-slate-200">${modalExito.montoTotal.toLocaleString('es-CO')}</strong> completada.</p>
                {(modalExito.devuelta || 0) > 0 && <p className="text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg">Devuelta: ${modalExito.devuelta?.toLocaleString('es-CO')}</p>}
                {(modalExito.fiadoAdicional || 0) > 0 && <p className="text-rose-600 font-bold bg-rose-50 p-2 rounded-lg">Fiado a {modalExito.cliente.nombre}: ${modalExito.fiadoAdicional?.toLocaleString('es-CO')}</p>}
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-base mb-8">Se guardó el {modalExito.accion} de <strong className="text-slate-800 dark:text-slate-200">${modalExito.montoTotal.toLocaleString('es-CO')}</strong>.</p>
            )}
            
            {modalExito.cliente.celular && datosSesion?.rol !== 'cajero' && (
              <button onClick={() => abrirWhatsApp(generarTextoComprobante('comprobante', modalExito.cliente, modalExito.accion, modalExito.detalles, modalExito.montoTotal), modalExito.cliente.celular)} className="w-full mb-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">
                <MessageCircle size={24} /> Notificar por WhatsApp
              </button>
            )}
            
            <button onClick={() => setModalExito(null)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl text-lg">
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* MODAL SUSCRIPCIÓN UPSELL */}
      {modalSuscripcion.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center">
            <Star size={40} className="text-blue-600 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalSuscripcion.titulo}</h3>
            <p className="text-base text-slate-500 mb-6">{modalSuscripcion.mensaje}</p>
            <button onClick={() => setModalSuscripcion({ visible: false, titulo: "", mensaje: "" })} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl">Entendido</button>
          </div>
        </div>
      )}

    </>
  );
}