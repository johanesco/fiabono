"use client";
import { useState, useEffect } from "react";
import { 
  collection, addDoc, getDocs, query, doc, updateDoc, where, setDoc, getDoc, deleteDoc 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword 
} from "firebase/auth";
import { db, auth } from "../firebase";
import { 
  Search, Home as HomeIcon, PieChart, Clock, UserCog, 
  ShoppingBag, Banknote, Users, CheckCircle2, ChevronRight, 
  X, MessageCircle, ArrowDownRight, ArrowUpRight, LogOut, CalendarDays,
  Trash2, Edit2, Share2, AlertCircle
} from 'lucide-react';

export default function Home() {
  // --- AUTENTICACIÓN Y PERFIL ---
  const [usuario, setUsuario] = useState<any>(null);
  const [nombreNegocio, setNombreNegocio] = useState<string>("Cargando...");
  const [telefonoNegocio, setTelefonoNegocio] = useState<string>("");
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [modoAuth, setModoAuth] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inputNegocio, setInputNegocio] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [mensajePerfil, setMensajePerfil] = useState({ texto: "", tipo: "" });

  // --- ARQUITECTURA ---
  const [vistaActiva, setVistaActiva] = useState<'principal' | 'estadisticas' | 'historial' | 'perfil'>('principal');

  // --- DATOS GLOBALES ---
  const [clientes, setClientes] = useState<any[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth());

  const [busquedaHistorial, setBusquedaHistorial] = useState("");
  const [filtroTiempoHistorial, setFiltroTiempoHistorial] = useState<'hoy' | 'semana' | 'mes' | 'todos'>('hoy');

  // --- PERFIL DE CLIENTE Y FLUJOS ---
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<any[]>([]);
  const [modoEdicionCliente, setModoEdicionCliente] = useState(false);
  const [editNombreCliente, setEditNombreCliente] = useState("");
  const [editCelularCliente, setEditCelularCliente] = useState("");

  const [modalRegistro, setModalRegistro] = useState(false);
  const [accionRegistro, setAccionRegistro] = useState<'fiado' | 'abono' | null>(null);
  const [pasoRegistro, setPasoRegistro] = useState<1 | 2>(1);
  const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
  const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string }[]>([{ descripcion: "", valor: "" }]);
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, accion: any, detalles: any[], montoTotal: number } | null>(null);
  
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [verTodosClientes, setVerTodosClientes] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // --- INICIALIZACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
          setNombreNegocio(userDoc.data().nombreNegocio || "Mi Negocio");
          setTelefonoNegocio(userDoc.data().telefonoNegocio || "");
        } else {
          setNombreNegocio("Mi Negocio");
        }
        await cargarDatosGlobales(user.uid);
      } else {
        setUsuario(null);
        setClientes([]);
        setTodosMovimientos([]);
      }
      setCargandoAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const manejarAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modoAuth === 'registro') {
        if (!inputNegocio.trim()) return alert("El nombre del negocio es obligatorio");
        const credencial = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "usuarios", credencial.user.uid), { 
          nombreNegocio: inputNegocio.trim(), email: email, telefonoNegocio: ""
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) { alert("Error de autenticación: Verifica tus datos."); }
  };

  // --- FUNCIONES DEL PERFIL ---
  const guardarDatosPerfil = async () => {
    if (!usuario) return;
    try {
      await updateDoc(doc(db, "usuarios", usuario.uid), { 
        nombreNegocio: nombreNegocio, 
        telefonoNegocio: telefonoNegocio 
      });
      setMensajePerfil({ texto: "Datos actualizados correctamente", tipo: "exito" });
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 3000);
    } catch (error) { 
      setMensajePerfil({ texto: "Error al guardar los datos", tipo: "error" }); 
    }
  };

  const cambiarPassword = async () => {
    if (!usuario || nuevaPassword.length < 6) return setMensajePerfil({ texto: "Mínimo 6 caracteres", tipo: "error" });
    try {
      await updatePassword(usuario, nuevaPassword);
      setMensajePerfil({ texto: "Contraseña actualizada", tipo: "exito" });
      setNuevaPassword("");
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 3000);
    } catch (error: any) { 
      setMensajePerfil({ texto: "Error de seguridad. Cierra sesión y vuelve a entrar.", tipo: "error" }); 
    }
  };

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

  const abrirPerfilDesdePanel = async (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      setClienteActivo(cliente);
      setModoEdicionCliente(false);
      await cargarMovimientosClienteDirecto(clienteId);
    }
  };

  // --- CRUD CLIENTES ---
  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), { 
        nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: usuario.uid, fecha_creacion: new Date() 
      });
      const nuevoObj = { id: docRef.id, nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0 };
      setModalNuevoCliente(false); setNombreNuevo(""); setCelularNuevo("");
      await cargarDatosGlobales(usuario.uid);
      if (modalRegistro && pasoRegistro === 1) { setClienteTransaccion(nuevoObj); setPasoRegistro(2); }
    } catch (error) { alert("Error al guardar cliente."); } finally { setGuardandoCliente(false); }
  };

  const actualizarCliente = async () => {
    if (!editNombreCliente.trim()) return alert("El nombre no puede estar vacío");
    try {
      await updateDoc(doc(db, "clientes", clienteActivo.id), { nombre: editNombreCliente.trim(), celular: editCelularCliente.trim() });
      setClienteActivo({ ...clienteActivo, nombre: editNombreCliente.trim(), celular: editCelularCliente.trim() });
      setModoEdicionCliente(false);
      await cargarDatosGlobales(usuario.uid);
    } catch (error) { alert("Error al actualizar cliente."); }
  };

  const eliminarCliente = async () => {
    const confirmacion = window.confirm(`¿Estás seguro de eliminar a ${clienteActivo.nombre}? Se borrará de tu directorio.`);
    if (confirmacion) {
      try {
        await deleteDoc(doc(db, "clientes", clienteActivo.id));
        setClienteActivo(null);
        await cargarDatosGlobales(usuario.uid);
      } catch (error) { alert("Error al eliminar cliente."); }
    }
  };

  // --- LÓGICA DE REGISTRO ---
  const agregarFila = () => setFilasRegistro([...filasRegistro, { descripcion: "", valor: "" }]);
  const actualizarFila = (index: number, campo: 'descripcion' | 'valor', valor: string) => {
    const nuevasFilas = [...filasRegistro]; nuevasFilas[index][campo] = valor; setFilasRegistro(nuevasFilas);
  };
  const eliminarFila = (index: number) => { if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index)); };
  const totalFilas = filasRegistro.reduce((acc, fila) => { const val = parseFloat(fila.valor); return acc + (isNaN(val) ? 0 : val); }, 0);

  const procesarRegistro = async () => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) return alert("Ingresa al menos un monto válido.");
    try {
      let montoAcumulado = 0; let detallesParaComprobante: {descripcion: string, valor: number}[] = []; let resumenNombres: string[] = [];
      for (const fila of filasValidas) {
        const val = parseFloat(fila.valor); montoAcumulado += val;
        let descFinal = fila.descripcion.trim() || (accionRegistro === 'abono' ? "Abono a cuenta" : "Artículo fiado");
        detallesParaComprobante.push({ descripcion: descFinal, valor: val }); resumenNombres.push(descFinal);
      }
      const descripcionUnificada = resumenNombres.join(", ");
      const ajuste = accionRegistro === 'fiado' ? montoAcumulado : -montoAcumulado;
      const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + ajuste;

      await addDoc(collection(db, "movimientos"), {
        clienteId: clienteTransaccion.id, usuarioId: usuario.uid, tipo: accionRegistro,
        monto: montoAcumulado, descripcion: descripcionUnificada, detalles: detallesParaComprobante,
        saldoResultante: nuevoSaldoTotal, fecha: new Date()
      });

      const refCliente = doc(db, "clientes", clienteTransaccion.id);
      await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
      const clienteActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };
      
      // Feedback Háptico Nativo (Vibración)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);

      setModalExito({ visible: true, cliente: clienteActualizado, accion: accionRegistro, detalles: detallesParaComprobante, montoTotal: montoAcumulado });
      setModalRegistro(false); setFilasRegistro([{ descripcion: "", valor: "" }]); setClienteTransaccion(null);
      await cargarDatosGlobales(usuario.uid);
      if (clienteActivo && clienteActivo.id === clienteTransaccion.id) {
        setClienteActivo(clienteActualizado); await cargarMovimientosClienteDirecto(clienteTransaccion.id); 
      }
    } catch (error) { alert("Error al procesar el registro."); }
  };

  // --- TEXTOS COMPROBANTES Y COMPARTIR ---
  const generarTextoComprobante = (tipo: 'estado' | 'comprobante', cliente: any, accion?: 'fiado' | 'abono' | null, detallesArray?: {descripcion: string, valor: number}[], totalMov?: number) => {
    let texto = "";
    const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;

    if (tipo === 'estado') {
      texto = `¡Hola *${cliente.nombre}*! 👋 Somos *${nombreNegocio}*.\n\n`;
      texto += `📊 *ESTADO DE TU CUENTA*\n`;
      if (cliente.deudaTotal === 0) texto += `Tu cuenta está totalmente al día ($0). ¡Gracias por tu confianza! ✨`;
      else if ((cliente.deudaTotal || 0) < 0) texto += `Tienes un *saldo a favor* de: *${saldoFormat}*. 🛍️`;
      else texto += `Tu saldo pendiente actual es de: *${saldoFormat}*.`;
    } 
    else if (tipo === 'comprobante') {
      texto = `¡Hola *${cliente.nombre}*! 👋\nRegistramos un nuevo *${accion}* en *${nombreNegocio}*.\n\n`;
      if (detallesArray && detallesArray.length > 0) {
        texto += `🧾 *DETALLE DEL REGISTRO*\n`;
        detallesArray.forEach(d => { texto += `▪ ${d.descripcion}: $${d.valor.toLocaleString('es-CO')}\n`; });
        texto += `\n*Total de la operación:* $${totalMov?.toLocaleString('es-CO')}\n\n`;
      }
      texto += `📊 *NUEVO ESTADO DE CUENTA*\n`;
      if (cliente.deudaTotal === 0) texto += `Con esto, tu cuenta ha quedado saldada ($0). ¡Muchas gracias! ✨`;
      else if ((cliente.deudaTotal || 0) < 0) texto += `Tu nuevo saldo a favor es de: *${saldoFormat}*.`;
      else texto += `Tu nuevo saldo pendiente es de: *${saldoFormat}*.`;
    }
    return texto;
  };

  const abrirWhatsApp = (texto: string, celular?: string) => {
    const celularLimpio = celular ? celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://api.whatsapp.com/send?phone=57${celularLimpio}&text=${encodeURIComponent(texto)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  const compartirNativo = async (texto: string) => {
    if (navigator.share) {
      try { await navigator.share({ title: `Comprobante ${nombreNegocio}`, text: texto }); } 
      catch (error) { console.log('Error compartiendo', error); }
    } else {
      alert("Tu navegador no soporta la opción de compartir. Usa el botón de WhatsApp.");
    }
  };

  // --- HELPERS (FECHAS, SALUDOS) ---
  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const hoyDate = new Date();
  const diaSemanaNombre = hoyDate.toLocaleDateString('es-CO', { weekday: 'long' });
  const diaSemanaCapitalizado = diaSemanaNombre.charAt(0).toUpperCase() + diaSemanaNombre.slice(1);
  const diaActualNum = hoyDate.getDay() === 0 ? 6 : hoyDate.getDay() - 1; 
  const inicioSemanaDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate() - diaActualNum);
  const finSemanaDate = new Date(inicioSemanaDate.getFullYear(), inicioSemanaDate.getMonth(), inicioSemanaDate.getDate() + 6);
  const formatCorto = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const textoRangoSemana = `${formatCorto(inicioSemanaDate)} - ${formatCorto(finSemanaDate)}`;

  const calcularMetricas = () => {
    let deudaTotal = 0, clientesConCredito = 0, totalClientes = clientes.length;
    clientes.forEach(c => { if ((c.deudaTotal || 0) > 0) { deudaTotal += c.deudaTotal; clientesConCredito++; } });
    
    const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
    const inicioSemana = inicioSemanaDate.getTime();
    const inicioMesFiltro = new Date(hoyDate.getFullYear(), mesSeleccionado, 1).getTime();
    const finMesFiltro = new Date(hoyDate.getFullYear(), mesSeleccionado + 1, 0, 23, 59, 59).getTime();

    let abonosHoy = 0, fiadosHoy = 0, abonosSemana = 0, fiadosSemana = 0, abonosMes = 0, fiadosMes = 0;

    todosMovimientos.forEach(m => {
      const ms = m.fecha?.toMillis() || 0;
      if (ms >= inicioHoy) { m.tipo === 'abono' ? abonosHoy += m.monto : fiadosHoy += m.monto; }
      if (ms >= inicioSemana) { m.tipo === 'abono' ? abonosSemana += m.monto : fiadosSemana += m.monto; }
      if (ms >= inicioMesFiltro && ms <= finMesFiltro) { m.tipo === 'abono' ? abonosMes += m.monto : fiadosMes += m.monto; }
    });
    return { deudaTotal, clientesConCredito, totalClientes, abonosHoy, fiadosHoy, abonosSemana, fiadosSemana, abonosMes, fiadosMes };
  };

  const metricas = calcularMetricas();
  const getNombreCliente = (id: string) => clientes.find(c => c.id === id)?.nombre || "Cliente Eliminado";
  const clientesFiltrados = clientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()));
  const directorioFiltrado = clientes.filter(c => c.nombre?.toLowerCase().includes(busquedaDirectorio.toLowerCase()));

  const historialFiltrado = todosMovimientos.filter(mov => {
    const cliente = clientes.find(c => c.id === mov.clienteId);
    const nombreMatch = cliente ? cliente.nombre.toLowerCase().includes(busquedaHistorial.toLowerCase()) : false;
    if (busquedaHistorial && !nombreMatch) return false;

    const ms = mov.fecha?.toMillis() || 0;
    const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
    const inicioSemana = inicioSemanaDate.getTime();
    const inicioMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1).getTime();

    if (filtroTiempoHistorial === 'hoy') return ms >= inicioHoy;
    if (filtroTiempoHistorial === 'semana') return ms >= inicioSemana;
    if (filtroTiempoHistorial === 'mes') return ms >= inicioMes;
    return true; 
  });

  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // ============================================================================
  // RENDERIZADO
  // ============================================================================

  if (cargandoAuth) return <div className="flex h-screen items-center justify-center font-bold text-slate-500 bg-slate-50 dark:bg-slate-950">Cargando...</div>;
  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-500">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800 transition-all">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight mb-2">Fiabono.</h1>
            <p className="text-slate-500 dark:text-slate-400">Software inteligente de cartera</p>
          </div>
          <form onSubmit={manejarAuth} className="flex flex-col gap-4">
            {modoAuth === 'registro' && ( <input type="text" placeholder="Nombre de tu negocio" value={inputNegocio} onChange={e => setInputNegocio(e.target.value)} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" required /> )}
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" required />
            <button type="submit" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 mt-4">
              {modoAuth === 'login' ? 'Ingresar al sistema' : 'Crear Cuenta'}
            </button>
          </form>
          <button onClick={() => setModoAuth(modoAuth === 'login' ? 'registro' : 'login')} className="w-full text-center mt-6 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
            {modoAuth === 'login' ? '¿No tienes cuenta? Registra tu negocio' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <main className="flex flex-col relative max-w-4xl mx-auto min-h-screen pb-28">
        
        {/* HEADER SUPERIOR */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-5 shadow-sm dark:shadow-none border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center z-10 sticky top-0 transition-colors duration-500">
          <h1 className="text-lg font-black text-indigo-600 dark:text-indigo-400 tracking-wide mb-1">Fiabono.</h1>
          {vistaActiva === 'principal' && ( <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{obtenerSaludo()}, <span className="font-bold text-slate-900 dark:text-white">{nombreNegocio}</span></p> )}
          {vistaActiva === 'estadisticas' && <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Reportes y Estadísticas</p>}
          {vistaActiva === 'historial' && <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Registro de Movimientos</p>}
          {vistaActiva === 'perfil' && <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Configuración de cuenta</p>}
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-4 sm:p-6 flex-1">
          
          {/* VISTA 1: INICIO Y OPERACIONES */}
          {vistaActiva === 'principal' && (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="relative z-20">
                <div className="relative shadow-sm rounded-[2rem]">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente registrado..." 
                    className="w-full text-lg p-5 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] focus:border-indigo-500 dark:focus:border-indigo-500 outline-none shadow-sm dark:shadow-none transition-all placeholder:text-slate-400" />
                </div>
                
                {busqueda.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl mt-2 shadow-2xl max-h-72 overflow-y-auto z-30 p-2">
                    {clientesFiltrados.length > 0 ? (
                      clientesFiltrados.map((c) => (
                        <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setBusqueda(""); }} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl cursor-pointer flex justify-between items-center transition-colors">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span>
                          <span className={`text-sm font-black tracking-tight ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : (c.deudaTotal < 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                            {c.deudaTotal === 0 ? '$0 (Al día)' : (c.deudaTotal < 0 ? `A favor: $${Math.abs(c.deudaTotal).toLocaleString('es-CO')}` : `Deuda: $${c.deudaTotal.toLocaleString('es-CO')}`)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-500">
                        <p className="mb-4">"{busqueda}" no está en tu directorio.</p>
                        <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2 mx-auto">
                          <UserCog size={16} /> Crear como Cliente Nuevo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="grid grid-cols-2 gap-4 sm:gap-6">
                <button onClick={() => { setAccionRegistro('fiado'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} 
                  className="bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-2xl sm:text-3xl py-14 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-rose-400/30">
                  <ShoppingBag size={44} className="mb-3 opacity-90" />
                  FIAR
                </button>
                <button onClick={() => { setAccionRegistro('abono'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} 
                  className="bg-gradient-to-br from-emerald-400 to-green-600 hover:from-emerald-500 hover:to-green-700 text-white font-black text-2xl sm:text-3xl py-14 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30">
                  <Banknote size={44} className="mb-3 opacity-90" />
                  ABONAR
                </button>
              </section>

              <button onClick={() => setVerTodosClientes(true)} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-900 dark:text-indigo-400 font-bold text-lg py-5 rounded-[2rem] shadow-sm transition-colors border border-slate-200 dark:border-slate-800 flex justify-center items-center gap-3">
                <Users size={24} /> Directorio de clientes
              </button>
            </div>
          )}

          {/* VISTA 2: ESTADÍSTICAS */}
          {vistaActiva === 'estadisticas' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute -right-10 -top-10 opacity-20 blur-2xl w-64 h-64 bg-indigo-500 rounded-full pointer-events-none"></div>
                <p className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> Cartera Activa en la calle</p>
                <p className="text-5xl sm:text-6xl font-black mb-6 tracking-tighter">${metricas.deudaTotal.toLocaleString('es-CO')}</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5">
                    <UserCog size={16} /> <p className="font-medium text-sm">Con saldo: <span className="font-bold text-white">{metricas.clientesConCredito}</span></p>
                  </div>
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5">
                    <Users size={16} /> <p className="font-medium text-sm">Total: <span className="font-bold text-white">{metricas.totalClientes} clientes</span></p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12}/> Hoy, {diaSemanaCapitalizado}</p>
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Ingresó</p>
                    <p className="font-black text-xl text-slate-800 dark:text-slate-100">${metricas.abonosHoy.toLocaleString('es-CO')}</p>
                    <p className="text-[10px] font-bold text-rose-500 uppercase mt-2">Salió (Fiado)</p>
                    <p className="font-black text-xl text-slate-800 dark:text-slate-100">${metricas.fiadosHoy.toLocaleString('es-CO')}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CalendarDays size={12}/> Esta Semana</p>
                  <p className="text-[9px] text-slate-400 mb-2 truncate">({textoRangoSemana})</p>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Ingresó</p>
                    <p className="font-black text-xl text-slate-800 dark:text-slate-100">${metricas.abonosSemana.toLocaleString('es-CO')}</p>
                    <p className="text-[10px] font-bold text-rose-500 uppercase mt-2">Salió (Fiado)</p>
                    <p className="font-black text-xl text-slate-800 dark:text-slate-100">${metricas.fiadosSemana.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">Desempeño Mensual</h3>
                  <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(Number(e.target.value))} className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white font-bold p-2 px-3 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm">
                    {nombresMeses.map((mes, index) => ( <option key={index} value={index}>{mes}</option> ))}
                  </select>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50">
                    <div className="flex items-center gap-3"><ArrowDownRight className="text-emerald-500" size={24} /><p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Total Abonos</p></div>
                    <p className="font-black text-xl text-emerald-600 dark:text-emerald-500">${metricas.abonosMes.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/50">
                    <div className="flex items-center gap-3"><ArrowUpRight className="text-rose-500" size={24} /><p className="text-sm font-bold text-rose-700 dark:text-rose-400">Total Fiado</p></div>
                    <p className="font-black text-xl text-rose-600 dark:text-rose-500">${metricas.fiadosMes.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: HISTORIAL INTELIGENTE */}
          {vistaActiva === 'historial' && (
            <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden min-h-[70vh]">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 sticky top-0 z-10">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} placeholder="Buscar nombre en historial..." 
                    className="w-full p-3.5 pl-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all shadow-sm" />
                </div>
                <div className="flex bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-xl">
                  {['hoy', 'semana', 'mes', 'todos'].map((filtro) => (
                    <button key={filtro} onClick={() => setFiltroTiempoHistorial(filtro as any)}
                      className={`flex-1 text-xs font-bold py-2 rounded-lg capitalize transition-all ${filtroTiempoHistorial === filtro ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                      {filtro}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-2 overflow-y-auto">
                {historialFiltrado.map((mov) => (
                  <div key={mov.id} onClick={() => abrirPerfilDesdePanel(mov.clienteId)} className="p-4 mx-2 my-2 rounded-2xl flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all">
                    <div className="truncate pr-4 flex items-center gap-3">
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                        {mov.tipo === 'fiado' ? <ShoppingBag size={18} /> : <Banknote size={18} />}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                    <p className={`font-black whitespace-nowrap text-lg ${mov.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                    </p>
                  </div>
                ))}
                {historialFiltrado.length === 0 && (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Search size={32} className="opacity-20 mb-2"/>
                    <p className="text-sm font-medium">No hay registros para mostrar.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 4: PERFIL */}
          {vistaActiva === 'perfil' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 text-center relative">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full mx-auto flex items-center justify-center text-white text-4xl font-black mb-4 shadow-lg">
                  {nombreNegocio.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{nombreNegocio}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{usuario?.email}</p>
              </div>
              {mensajePerfil.texto && (
                <div className={`p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 ${mensajePerfil.tipo === 'exito' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'}`}>
                  {mensajePerfil.tipo === 'exito' && <CheckCircle2 size={18} />} {mensajePerfil.texto}
                </div>
              )}
              <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-2"><UserCog size={20}/> Información del Negocio</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nombre del Negocio</label>
                    <input type="text" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Teléfono de Contacto (WhatsApp)</label>
                    <input type="tel" value={telefonoNegocio} onChange={(e) => setTelefonoNegocio(e.target.value)} placeholder="Ej. 3001234567" className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                  </div>
                  <button onClick={guardarDatosPerfil} className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-md transition-transform transform active:scale-95">Guardar Cambios</button>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center gap-2"><Clock size={20}/> Seguridad</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nueva Contraseña</label>
                    <input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                  </div>
                  <button onClick={cambiarPassword} className="mt-2 w-full bg-slate-800 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-colors">Actualizar Contraseña</button>
                </div>
              </div>
              <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold py-5 rounded-[2rem] border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition-colors mb-4 flex justify-center items-center gap-2">
                <LogOut size={20} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN INFERIOR */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 pb-safe transition-colors duration-500">
          <div className="max-w-4xl mx-auto flex px-2">
            <button onClick={() => setVistaActiva('principal')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'principal' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <HomeIcon size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Inicio</span>
            </button>
            <button onClick={() => setVistaActiva('estadisticas')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'estadisticas' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <PieChart size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Reportes</span>
            </button>
            <button onClick={() => setVistaActiva('historial')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'historial' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <Clock size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Historial</span>
            </button>
            <button onClick={() => setVistaActiva('perfil')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'perfil' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <UserCog size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Perfil</span>
            </button>
          </div>
        </nav>

        {/* MODAL ÉXITO */}
        {modalExito && modalExito.visible && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in zoom-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800 relative">
              <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle2 size={50} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Registro Exitoso!</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Se guardó el {modalExito.accion} de <strong className="text-slate-800 dark:text-slate-200">${modalExito.montoTotal.toLocaleString('es-CO')}</strong> en la cuenta de {modalExito.cliente.nombre}.</p>
              
              <div className="flex gap-2 mb-3">
                <button onClick={() => abrirWhatsApp(generarTextoComprobante('comprobante', modalExito.cliente, modalExito.accion, modalExito.detalles, modalExito.montoTotal), modalExito.cliente.celular)} className="flex-1 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center gap-2">
                  <MessageCircle size={20} /> WhatsApp
                </button>
                <button onClick={() => compartirNativo(generarTextoComprobante('comprobante', modalExito.cliente, modalExito.accion, modalExito.detalles, modalExito.montoTotal))} className="bg-slate-800 dark:bg-slate-800 hover:bg-black text-white font-bold px-5 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center">
                  <Share2 size={20} />
                </button>
              </div>
              
              <button onClick={() => setModalExito(null)} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors">
                Cerrar y continuar
              </button>
            </div>
          </div>
        )}

        {/* PERFIL DEL CLIENTE E HISTORIAL */}
        {clienteActivo && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50 transition-opacity">
            <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] sm:max-h-[85vh] mb-[4.5rem] sm:mb-0 border border-slate-100 dark:border-slate-800">
              
              {/* Header Sticky */}
              <div className="p-5 pb-3 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 rounded-t-[2.5rem] z-10 shrink-0">
                <div className="flex gap-2">
                  <button onClick={() => { setModoEdicionCliente(!modoEdicionCliente); setEditNombreCliente(clienteActivo.nombre); setEditCelularCliente(clienteActivo.celular || ""); }} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Edit2 size={20}/></button>
                  <button onClick={eliminarCliente} className="bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 rounded-full p-3 font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"><Trash2 size={20}/></button>
                </div>
                <button onClick={() => setClienteActivo(null)} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X size={20}/></button>
              </div>
              
              <div className="p-6 pt-0 text-center shrink-0">
                {modoEdicionCliente ? (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 animate-in fade-in zoom-in-95 duration-200">
                    <input type="text" value={editNombreCliente} onChange={(e) => setEditNombreCliente(e.target.value)} placeholder="Nombre del cliente" className="w-full p-3 mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold dark:text-white" />
                    <input type="tel" value={editCelularCliente} onChange={(e) => setEditCelularCliente(e.target.value)} placeholder="Celular (opcional)" className="w-full p-3 mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold dark:text-white" />
                    <button onClick={actualizarCliente} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors">Guardar Cambios</button>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{clienteActivo.nombre}</h2>
                    {clienteActivo.celular ? <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">{clienteActivo.celular}</p> : <p className="text-amber-500 dark:text-amber-400 text-xs font-bold mb-4 flex items-center justify-center gap-1"><AlertCircle size={14}/> Sin WhatsApp</p>}
                    <p className="text-slate-400 dark:text-slate-500 font-bold mb-2 tracking-widest text-xs uppercase">{clienteActivo.deudaTotal === 0 ? 'CUENTA AL DÍA' : ((clienteActivo.deudaTotal || 0) < 0 ? 'SALDO A FAVOR' : 'SALDO PENDIENTE')}</p>
                    <p className={`text-6xl font-black tracking-tighter ${clienteActivo.deudaTotal === 0 ? 'text-slate-300 dark:text-slate-700' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-white')}`}>${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={() => { setAccionRegistro('fiado'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-bold py-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 transition-colors flex justify-center items-center gap-2 shadow-sm"><ShoppingBag size={18}/> Fiar</button>
                  <button onClick={() => { setAccionRegistro('abono'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold py-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 transition-colors flex justify-center items-center gap-2 shadow-sm"><Banknote size={18}/> Abonar</button>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="flex-1 bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-colors shadow-md border border-transparent dark:border-slate-700 flex justify-center items-center gap-2">
                    <MessageCircle size={20} /> Estado de Cuenta
                  </button>
                  <button onClick={() => compartirNativo(generarTextoComprobante('estado', clienteActivo))} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold px-5 rounded-2xl transition-colors shadow-md flex justify-center items-center">
                    <Share2 size={20} />
                  </button>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-6 flex-1 overflow-y-auto rounded-b-[2.5rem] border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-400 dark:text-slate-500 uppercase text-xs tracking-wider mb-5 pl-2 flex items-center gap-2"><Clock size={14}/> Historial de Registros</h3>
                <div className="flex flex-col gap-4">
                  {movimientosCliente.length === 0 ? <p className="text-slate-400 text-center text-sm py-4">No hay historial.</p> : (
                    movimientosCliente.map(mov => (
                      <div key={mov.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                        <div className="pl-2">
                          {mov.detalles && mov.detalles.length > 0 ? (
                            <div className="flex flex-col gap-2.5">
                              {mov.detalles.map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center">
                                  <p className="font-medium text-slate-700 dark:text-slate-300 text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>{d.descripcion}</p>
                                  <p className="font-bold text-sm text-slate-600 dark:text-slate-400">${d.valor.toLocaleString('es-CO')}</p>
                                </div>
                              ))}
                              <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Total {mov.tipo}</p>
                                <p className={`font-black text-2xl ${mov.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'}`}>{mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center mb-1">
                              <p className="font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                              <p className={`font-black text-2xl ${mov.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'}`}>{mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}</p>
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                            <p className="text-xs text-slate-400 font-medium tracking-wide">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                            {mov.saldoResultante !== undefined && mov.saldoResultante <= 0 && mov.tipo === 'abono' && (
                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm ${mov.saldoResultante < 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'}`}>
                                {mov.saldoResultante < 0 ? 'Generó saldo a favor' : 'Cuenta Saldada'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL FORMULARIO FIADO/ABONO */}
        {modalRegistro && (
          <div className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] border border-slate-100 dark:border-slate-800">
              <div className={`p-5 text-white flex justify-between items-center rounded-t-[2.5rem] shrink-0 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`}>
                <h2 className="text-xl font-black uppercase tracking-wide flex items-center gap-2">
                  {accionRegistro === 'fiado' ? <ShoppingBag size={24}/> : <Banknote size={24}/>} 
                  {accionRegistro === 'fiado' ? 'Registrar Fiado' : 'Registrar Abono'}
                </h2>
                <button onClick={() => setModalRegistro(false)} className="text-white hover:text-white/70 bg-white/10 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><X size={20}/></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                {pasoRegistro === 1 && (
                  <div>
                    <p className="font-bold text-slate-600 dark:text-slate-300 mb-4">¿A qué cliente se le aplicará?</p>
                    <div className="relative mb-4">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente..." className="w-full p-4 pl-11 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                    </div>
                    <div className="flex flex-col gap-2 pr-1">
                      {clientesFiltrados.map(c => (
                        <div key={c.id} onClick={() => { setClienteTransaccion(c); setPasoRegistro(2); setBusqueda(""); }} className="p-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer flex justify-between items-center transition-colors">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><ChevronRight size={16} className="text-slate-300"/> {c.nombre}</span>
                        </div>
                      ))}
                      {clientesFiltrados.length === 0 && <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-2"><UserCog size={18}/> Crear "{busqueda}" como nuevo</button>}
                    </div>
                  </div>
                )}
                {pasoRegistro === 2 && clienteTransaccion && (
                  <div className="flex flex-col gap-5">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Cliente:</span>
                      <span className="font-black text-slate-900 dark:text-white">{clienteTransaccion.nombre}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {filasRegistro.map((fila, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input type="text" value={fila.descripcion} onChange={(e) => actualizarFila(index, 'descripcion', e.target.value)} placeholder={accionRegistro === 'fiado' ? "Ej. Producto" : "Ej. Efectivo"} className="flex-[2] p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white w-full min-w-0 transition-all" />
                          <input type="number" value={fila.valor} onChange={(e) => actualizarFila(index, 'valor', e.target.value)} placeholder="$ Valor" className="flex-1 p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-bold text-slate-900 dark:text-white w-full min-w-0 transition-all" />
                          {filasRegistro.length > 1 && <button onClick={() => eliminarFila(index)} className="text-rose-400 hover:text-rose-600 font-black p-3 transition-colors bg-rose-50 dark:bg-rose-900/20 rounded-xl"><X size={20}/></button>}
                        </div>
                      ))}
                      <button onClick={agregarFila} className="mt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-5 py-3 rounded-xl self-start transition-colors flex items-center gap-1">+ Añadir otra fila</button>
                    </div>
                    <div className="flex justify-between items-center p-5 bg-slate-900 dark:bg-black text-white rounded-2xl mt-2 shadow-inner border border-slate-800">
                      <span className="font-medium text-slate-300">Total a registrar:</span>
                      <span className={`text-4xl font-black tracking-tight ${accionRegistro === 'fiado' ? 'text-rose-400' : 'text-emerald-400'}`}>${totalFilas.toLocaleString('es-CO')}</span>
                    </div>
                    <button onClick={procesarRegistro} className={`w-full text-white font-black text-xl py-5 rounded-2xl shadow-lg mt-2 transition-transform transform active:scale-95 flex justify-center items-center gap-2 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'}`}>
                      Confirmar Registro <CheckCircle2 size={24}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DIRECTORIO MODAL */}
        {verTodosClientes && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto pt-10">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden relative mb-24 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh]">
              <div className="bg-indigo-600 dark:bg-indigo-900 p-6 flex justify-between items-center shrink-0 sticky top-0 z-10">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2"><Users size={24}/> Directorio</h2>
                <button onClick={() => setVerTodosClientes(false)} className="text-indigo-200 hover:text-white transition-colors bg-indigo-700/50 dark:bg-indigo-800/50 p-2 rounded-full"><X size={24}/></button>
              </div>
              <div className="p-4 bg-white dark:bg-slate-950 shrink-0 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)} placeholder="Buscar en el directorio..." className="w-full p-4 pl-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all shadow-sm" />
                </div>
              </div>
              <div className="p-4 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex-1">
                {directorioFiltrado.map(c => (
                  <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setVerTodosClientes(false); }} className="p-5 my-3 mx-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md flex justify-between items-center transition-all">
                    <div>
                      <p className="font-bold text-lg text-slate-900 dark:text-slate-100">{c.nombre}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{c.celular}</p>
                    </div>
                    <div className="text-right">
                      {c.deudaTotal !== 0 && <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{(c.deudaTotal || 0) < 0 ? 'A FAVOR' : 'DEUDA'}</p>}
                      <p className={`font-black text-2xl tracking-tighter ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : ((c.deudaTotal || 0) < 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                        {c.deudaTotal === 0 ? '$0 (Al día)' : `$${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}`}
                      </p>
                    </div>
                  </div>
                ))}
                {directorioFiltrado.length === 0 && (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Search size={32} className="opacity-20 mb-2"/>
                    <p>No se encontraron clientes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NUEVO CLIENTE MODAL */}
        {modalNuevoCliente && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[90]">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2"><UserCog size={24}/> Registrar Cliente</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">💡 Tip: Si no pones número, podrás usar el botón de <Share2 size={12} className="inline"/> Compartir.</p>
              
              <div className="flex flex-col gap-4 mb-8">
                <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all font-bold" />
                <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="Celular (Opcional)" className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors">Cancelar</button>
                <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 transition-colors flex justify-center items-center gap-2">Guardar <CheckCircle2 size={18}/></button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}