"use client";
import { useState, useEffect } from "react";
import { 
  collection, addDoc, getDocs, query, doc, updateDoc, increment, where, setDoc, getDoc 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut 
} from "firebase/auth";
import { db, auth } from "../firebase";

export default function Home() {
  // --- AUTENTICACIÓN ---
  const [usuario, setUsuario] = useState<any>(null);
  const [nombreNegocio, setNombreNegocio] = useState<string>("Cargando...");
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [modoAuth, setModoAuth] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inputNegocio, setInputNegocio] = useState("");

  // --- UI & TEMA ---
  const [vistaActiva, setVistaActiva] = useState<'principal' | 'panel'>('principal');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // --- DATOS GLOBALES ---
  const [clientes, setClientes] = useState<any[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [verTodosClientes, setVerTodosClientes] = useState(false);

  // --- PERFIL Y FLUJOS ---
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<any[]>([]);
  
  const [modalRegistro, setModalRegistro] = useState(false);
  const [accionRegistro, setAccionRegistro] = useState<'fiado' | 'abono' | null>(null);
  const [pasoRegistro, setPasoRegistro] = useState<1 | 2>(1);
  const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
  const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string }[]>([{ descripcion: "", valor: "" }]);

  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, accion: any, detalles: any[], montoTotal: number } | null>(null);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // --- INICIALIZACIÓN ---
  useEffect(() => {
    // Detectar preferencia de sistema para modo oscuro
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) setNombreNegocio(userDoc.data().nombreNegocio);
        else setNombreNegocio("Mi Negocio");
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
        await setDoc(doc(db, "usuarios", credencial.user.uid), { nombreNegocio: inputNegocio.trim(), email: email });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) { alert("Error de autenticación: " + error.message); }
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
      await cargarMovimientosClienteDirecto(clienteId);
    }
  };

  // --- LÓGICA DE FILAS ---
  const agregarFila = () => setFilasRegistro([...filasRegistro, { descripcion: "", valor: "" }]);
  const actualizarFila = (index: number, campo: 'descripcion' | 'valor', valor: string) => {
    const nuevasFilas = [...filasRegistro];
    nuevasFilas[index][campo] = valor;
    setFilasRegistro(nuevasFilas);
  };
  const eliminarFila = (index: number) => {
    if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index));
  };
  const totalFilas = filasRegistro.reduce((acc, fila) => {
    const val = parseFloat(fila.valor);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // --- LÓGICA DE WHATSAPP ---
  const generarEnlaceWhatsApp = (tipo: 'estado' | 'comprobante', cliente: any, accion?: 'fiado' | 'abono' | null, detallesArray?: {descripcion: string, valor: number}[], totalMov?: number) => {
    if (!cliente.celular) return null;
    const celularLimpio = cliente.celular.replace(/\D/g, '');
    let mensaje = "";
    const esSaldoAFavor = (cliente.deudaTotal || 0) < 0;
    const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;

    if (tipo === 'estado') {
      mensaje = `Hola *${cliente.nombre}*, te saludamos de *${nombreNegocio}*. 📄\n\nTe compartimos el estado actual de tu cuenta:\n\n`;
      if (cliente.deudaTotal === 0) mensaje += `Actualmente tu cuenta está al día (Saldo: $0).`;
      else if (esSaldoAFavor)       mensaje += `Presentas un *saldo a tu favor* de: *${saldoFormat}*.\n¡Gracias por tu confianza!`;
      else                          mensaje += `Presentas un saldo pendiente de: *${saldoFormat}*.\nQuedamos a tu entera disposición.`;
    } 
    else if (tipo === 'comprobante') {
      mensaje = `Hola *${cliente.nombre}*, te saludamos de *${nombreNegocio}*. 🧾\n\nAcabamos de registrar una nueva operación en tu cuenta:\n\n`;
      mensaje += `*Tipo de registro:* ${accion === 'fiado' ? 'Fiado (Nuevo Consumo)' : 'Abono (Pago Recibido)'}\n`;
      
      if (detallesArray && detallesArray.length > 0) {
        mensaje += `\n*Detalle:* \n`;
        detallesArray.forEach(d => { mensaje += `▪ ${d.descripcion}: $${d.valor.toLocaleString('es-CO')}\n`; });
        mensaje += `\n*Total de esta operación: $${totalMov?.toLocaleString('es-CO')}*\n\n`;
      }
      
      mensaje += `*Estado de cuenta actualizado:*\n`;
      if (cliente.deudaTotal === 0) mensaje += `Con esto, tu cuenta ha quedado saldada ($0). ¡Muchas gracias!`;
      else if (esSaldoAFavor)       mensaje += `Tu nuevo *saldo a favor* es de: *${saldoFormat}*.`;
      else                          mensaje += `Tu nuevo saldo pendiente es de: *${saldoFormat}*.`;
    }
    return `https://api.whatsapp.com/send?phone=57${celularLimpio}&text=${encodeURIComponent(mensaje)}`;
  };

  // --- PROCESAR REGISTRO ---
  const procesarRegistro = async () => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) return alert("Ingresa al menos un monto válido.");

    try {
      let montoAcumulado = 0;
      let detallesParaComprobante: {descripcion: string, valor: number}[] = [];
      let resumenNombres: string[] = [];

      for (const fila of filasValidas) {
        const val = parseFloat(fila.valor);
        montoAcumulado += val;
        let descFinal = fila.descripcion.trim() || (accionRegistro === 'abono' ? "Abono a cuenta" : "Artículo fiado");
        detallesParaComprobante.push({ descripcion: descFinal, valor: val });
        resumenNombres.push(descFinal);
      }

      const descripcionUnificada = resumenNombres.join(", ");
      const ajuste = accionRegistro === 'fiado' ? montoAcumulado : -montoAcumulado;
      const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + ajuste;

      await addDoc(collection(db, "movimientos"), {
        clienteId: clienteTransaccion.id,
        usuarioId: usuario.uid,
        tipo: accionRegistro,
        monto: montoAcumulado,
        descripcion: descripcionUnificada,
        detalles: detallesParaComprobante,
        saldoResultante: nuevoSaldoTotal,
        fecha: new Date()
      });

      const refCliente = doc(db, "clientes", clienteTransaccion.id);
      await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
      const clienteActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };
      
      setModalExito({ visible: true, cliente: clienteActualizado, accion: accionRegistro, detalles: detallesParaComprobante, montoTotal: montoAcumulado });

      setModalRegistro(false);
      setFilasRegistro([{ descripcion: "", valor: "" }]);
      setClienteTransaccion(null);
      await cargarDatosGlobales(usuario.uid);
      
      if (clienteActivo && clienteActivo.id === clienteTransaccion.id) {
        setClienteActivo(clienteActualizado);
        await cargarMovimientosClienteDirecto(clienteTransaccion.id); 
      }
    } catch (error) { alert("Error al procesar el registro."); }
  };

  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim() || !celularNuevo.trim()) return alert("Llena el nombre y el celular.");
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), { nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: usuario.uid, fecha_creacion: new Date() });
      const nuevoObj = { id: docRef.id, nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0 };
      setModalNuevoCliente(false);
      setNombreNuevo(""); setCelularNuevo("");
      await cargarDatosGlobales(usuario.uid);
      if (modalRegistro && pasoRegistro === 1) {
        setClienteTransaccion(nuevoObj);
        setPasoRegistro(2);
      }
    } catch (error) { alert("Error al guardar cliente."); } 
    finally { setGuardandoCliente(false); }
  };

  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  const calcularMetricas = () => {
    let deudaTotal = 0, clientesConCredito = 0;
    clientes.forEach(c => { if ((c.deudaTotal || 0) > 0) { deudaTotal += c.deudaTotal; clientesConCredito++; } });
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
    let abonosHoy = { cant: 0, total: 0 }, fiadosHoy = { cant: 0, total: 0 };
    let abonosMes = { cant: 0, total: 0 }, fiadosMes = { cant: 0, total: 0 };

    todosMovimientos.forEach(m => {
      const ms = m.fecha?.toMillis() || 0;
      if (ms >= inicioMes) {
        if (m.tipo === 'abono') { abonosMes.cant++; abonosMes.total += m.monto; }
        if (m.tipo === 'fiado') { fiadosMes.cant++; fiadosMes.total += m.monto; }
      }
      if (ms >= inicioHoy) {
        if (m.tipo === 'abono') { abonosHoy.cant++; abonosHoy.total += m.monto; }
        if (m.tipo === 'fiado') { fiadosHoy.cant++; fiadosHoy.total += m.monto; }
      }
    });
    return { deudaTotal, clientesConCredito, abonosHoy, fiadosHoy, abonosMes, fiadosMes };
  };

  const metricas = calcularMetricas();
  const getNombreCliente = (id: string) => clientes.find(c => c.id === id)?.nombre || "Desconocido";
  const clientesFiltrados = clientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  // ============================================================================
  // RENDERIZADO
  // ============================================================================

  if (cargandoAuth) return <div className="flex h-screen items-center justify-center font-bold text-slate-500 bg-slate-50 dark:bg-slate-950">Cargando...</div>;
  
  if (!usuario) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
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
      </div>
    );
  }

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      {/* CONTENEDOR MAESTRO PARA FONDO GLOBAL */}
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
        <main className="flex flex-col relative max-w-4xl mx-auto min-h-screen pb-24">
          
          {/* HEADER SUPERIOR CON GLASSMORPHISM Y BOTÓN DARK MODE */}
          <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-5 shadow-sm dark:shadow-none border-b border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10 sticky top-0 transition-colors duration-500">
            <div>
              <h1 className="text-lg font-black text-indigo-600 dark:text-indigo-400 tracking-wide mb-1">Fiabono.</h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {obtenerSaludo()}, <span className="text-xl font-black text-slate-900 dark:text-white block sm:inline">{nombreNegocio}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {/* Toggle Dark Mode */}
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button onClick={() => signOut(auth)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors">
                Cerrar Sesión
              </button>
            </div>
          </header>

          {/* CONTENIDO PRINCIPAL */}
          <div className="p-4 sm:p-6 flex-1">
            
            {/* VISTA 1: INICIO Y OPERACIONES */}
            {vistaActiva === 'principal' && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Buscador Moderno */}
                <section className="relative z-20">
                  <div className="relative shadow-sm rounded-[2rem]">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                    <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente registrado..." 
                      className="w-full text-lg p-5 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] focus:border-indigo-500 dark:focus:border-indigo-500 outline-none shadow-sm dark:shadow-none transition-all placeholder:text-slate-400" />
                  </div>
                  
                  {busqueda.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl mt-2 shadow-2xl max-h-72 overflow-y-auto z-30 p-2">
                      {clientesFiltrados.length > 0 ? (
                        clientesFiltrados.map((c) => (
                          <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setBusqueda(""); }} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl cursor-pointer flex justify-between items-center transition-colors">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span>
                            <span className={`font-black tracking-tight ${c.deudaTotal < 0 ? 'text-emerald-500' : (c.deudaTotal > 0 ? 'text-rose-500' : 'text-slate-400')}`}>
                              {c.deudaTotal < 0 ? 'A favor: ' : 'Deuda: '}${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-slate-500">
                          <p className="mb-4">No se encontró el cliente.</p>
                          <button onClick={() => setModalNuevoCliente(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl text-sm transition-colors">+ Crear Cliente Nuevo</button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* Botones de Acción (Gradients) */}
                <section className="grid grid-cols-2 gap-4 sm:gap-6">
                  <button onClick={() => { setAccionRegistro('fiado'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} 
                    className="bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-2xl sm:text-3xl py-14 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-rose-400/30">
                    <span className="text-4xl mb-2">🛍️</span>
                    FIAR
                  </button>
                  <button onClick={() => { setAccionRegistro('abono'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} 
                    className="bg-gradient-to-br from-emerald-400 to-green-600 hover:from-emerald-500 hover:to-green-700 text-white font-black text-2xl sm:text-3xl py-14 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30">
                    <span className="text-4xl mb-2">💵</span>
                    ABONAR
                  </button>
                </section>

                <button onClick={() => setVerTodosClientes(true)} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-indigo-900 dark:text-indigo-400 font-bold text-lg py-5 rounded-[2rem] shadow-sm transition-colors border border-slate-200 dark:border-slate-800 flex justify-center items-center gap-2">
                  <span>👥</span> Directorio Completo de Clientes
                </button>
              </div>
            )}

            {/* VISTA 2: PANEL E INFORMES */}
            {vistaActiva === 'panel' && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Tarjeta Global VIP */}
                <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                  <div className="absolute -right-10 -top-10 opacity-20 blur-2xl w-64 h-64 bg-indigo-500 rounded-full pointer-events-none"></div>
                  <p className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> Cartera Activa en la calle
                  </p>
                  <p className="text-5xl sm:text-6xl font-black mb-6 tracking-tighter">${metricas.deudaTotal.toLocaleString('es-CO')}</p>
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/5">
                    <span className="text-xl">👥</span>
                    <p className="font-medium text-sm">Clientes con saldo: <span className="font-bold text-white text-base">{metricas.clientesConCredito}</span></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* HOY */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-5">⏱️ Actividad de Hoy</h3>
                    <div className="flex flex-col gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl flex justify-between items-center border border-emerald-100 dark:border-emerald-900/50">
                        <div>
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Abonos Recibidos</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">{metricas.abonosHoy.cant} reg.</p>
                        </div>
                        <p className="font-black text-xl text-emerald-600 dark:text-emerald-400">${metricas.abonosHoy.total.toLocaleString('es-CO')}</p>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/30 p-4 rounded-2xl flex justify-between items-center border border-rose-100 dark:border-rose-900/50">
                        <div>
                          <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">Total Fiado</p>
                          <p className="text-xs text-rose-600 dark:text-rose-500 mt-1">{metricas.fiadosHoy.cant} reg.</p>
                        </div>
                        <p className="font-black text-xl text-rose-600 dark:text-rose-400">${metricas.fiadosHoy.total.toLocaleString('es-CO')}</p>
                      </div>
                    </div>
                  </div>

                  {/* MES */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-5">📅 Resumen del Mes</h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Abonos</p>
                          <p className="text-xs text-slate-400">{metricas.abonosMes.cant} registros</p>
                        </div>
                        <p className="font-black text-lg text-emerald-500">${metricas.abonosMes.total.toLocaleString('es-CO')}</p>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Fiado</p>
                          <p className="text-xs text-slate-400">{metricas.fiadosMes.cant} registros</p>
                        </div>
                        <p className="font-black text-lg text-rose-500">${metricas.fiadosMes.total.toLocaleString('es-CO')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-black text-slate-800 dark:text-slate-100">Últimos Registros Globales</h3>
                  </div>
                  <div className="p-3">
                    {todosMovimientos.slice(0, 10).map((mov, i) => (
                      <div key={mov.id} onClick={() => abrirPerfilDesdePanel(mov.clienteId)} className="p-4 mx-1 my-2 rounded-2xl flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all">
                        <div className="truncate pr-4">
                          <p className="font-bold text-sm text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                        <p className={`font-black whitespace-nowrap text-lg ${mov.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                        </p>
                      </div>
                    ))}
                    {todosMovimientos.length === 0 && <p className="p-8 text-center text-slate-400 text-sm">No hay actividad reciente.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BARRA DE NAVEGACIÓN INFERIOR (GLASSMORPHISM) */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-40 pb-safe transition-colors duration-500">
            <div className="max-w-4xl mx-auto flex px-2">
              <button onClick={() => setVistaActiva('principal')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'principal' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <span className="text-2xl">🏠</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Operaciones</span>
              </button>
              <button onClick={() => setVistaActiva('panel')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'panel' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <span className="text-2xl">📊</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Panel</span>
              </button>
            </div>
          </nav>

          {/* =========================================================================
              MODALES PROFESIONALES
              ========================================================================= */}
          
          {/* MODAL ÉXITO */}
          {modalExito && modalExito.visible && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[70] animate-in zoom-in duration-300">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800 relative">
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner">✓</div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Registro Exitoso!</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Se guardó el {modalExito.accion} de <strong className="text-slate-800 dark:text-slate-200">${modalExito.montoTotal.toLocaleString('es-CO')}</strong> en la cuenta de {modalExito.cliente.nombre}.</p>
                
                <a href={generarEnlaceWhatsApp('comprobante', modalExito.cliente, modalExito.accion, modalExito.detalles, modalExito.montoTotal) || "#"} target="_blank" onClick={() => setModalExito(null)} 
                   className="block w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 mb-3">
                  📲 Enviar Comprobante (WhatsApp)
                </a>
                <button onClick={() => setModalExito(null)} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors">
                  Cerrar y continuar
                </button>
              </div>
            </div>
          )}

          {/* PERFIL DEL CLIENTE E HISTORIAL DESGLOSADO */}
          {clienteActivo && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50 transition-opacity">
              <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] mb-[4.5rem] sm:mb-0 border border-slate-100 dark:border-slate-800">
                <div className="p-6 pb-2 flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{clienteActivo.nombre}</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{clienteActivo.celular}</p>
                  </div>
                  <button onClick={() => setClienteActivo(null)} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full p-2.5 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
                </div>
                
                <div className="p-6 text-center">
                  <p className="text-slate-400 dark:text-slate-500 font-bold mb-2 tracking-widest text-xs uppercase">{(clienteActivo.deudaTotal || 0) < 0 ? 'SALDO A FAVOR' : 'SALDO PENDIENTE'}</p>
                  <p className={`text-6xl font-black tracking-tighter ${(clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500' : (clienteActivo.deudaTotal > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-white')}`}>
                    ${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => { setAccionRegistro('fiado'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-bold py-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 transition-colors">Fiar Aquí</button>
                    <button onClick={() => { setAccionRegistro('abono'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "" }]); setModalRegistro(true); }} className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-bold py-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 transition-colors">Abonar Aquí</button>
                  </div>
                  <a href={generarEnlaceWhatsApp('estado', clienteActivo) || "#"} target="_blank" className="mt-3 block w-full bg-slate-900 dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-colors shadow-md border border-transparent dark:border-slate-700">
                    📲 Enviar Estado de Cuenta
                  </a>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-950 p-6 flex-1 overflow-y-auto rounded-b-[2.5rem] border-t border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-400 dark:text-slate-500 uppercase text-xs tracking-wider mb-5 pl-2">Historial de Registros</h3>
                  <div className="flex flex-col gap-4">
                    {movimientosCliente.length === 0 ? <p className="text-slate-400 text-center text-sm py-4">No hay historial.</p> : (
                      movimientosCliente.map(mov => (
                        <div key={mov.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                          {/* Franja decorativa lateral */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                          
                          <div className="pl-2">
                            {/* Desglose de ítems + SUMATORIA TOTAL */}
                            {mov.detalles && mov.detalles.length > 0 ? (
                              <div className="flex flex-col gap-2.5">
                                {mov.detalles.map((d: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center">
                                    <p className="font-medium text-slate-700 dark:text-slate-300 text-sm flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                      {d.descripcion}
                                    </p>
                                    <p className="font-bold text-sm text-slate-600 dark:text-slate-400">
                                      ${d.valor.toLocaleString('es-CO')}
                                    </p>
                                  </div>
                                ))}
                                {/* LÍNEA DE TOTAL DE FACTURA */}
                                <div className="flex justify-between items-center mt-2 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total {mov.tipo}</p>
                                  <p className={`font-black text-lg ${mov.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center mb-1">
                                <p className="font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                                <p className={`font-black text-lg ${mov.tipo === 'fiado' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                                </p>
                              </div>
                            )}

                            {/* Fecha e Insignias de Saldo */}
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
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800">
                <div className={`p-6 text-white flex justify-between items-center rounded-t-[2.5rem] ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`}>
                  <h2 className="text-xl font-black uppercase tracking-wide">{accionRegistro === 'fiado' ? 'Registrar Fiado' : 'Registrar Abono'}</h2>
                  <button onClick={() => setModalRegistro(false)} className="text-white hover:text-white/70 text-2xl font-bold bg-white/10 rounded-full w-10 h-10 flex items-center justify-center transition-colors">✕</button>
                </div>
                <div className="p-6 overflow-y-auto">
                  {pasoRegistro === 1 && (
                    <div>
                      <p className="font-bold text-slate-600 dark:text-slate-300 mb-4">¿A qué cliente se le aplicará?</p>
                      <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="🔍 Buscar cliente..." className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none mb-4 focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                      <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
                        {clientesFiltrados.map(c => (
                          <div key={c.id} onClick={() => { setClienteTransaccion(c); setPasoRegistro(2); setBusqueda(""); }} className="p-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer flex justify-between items-center transition-colors">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span>
                            <span className={`text-sm font-bold ${c.deudaTotal < 0 ? 'text-emerald-500' : (c.deudaTotal > 0 ? 'text-rose-500' : 'text-slate-400')}`}>${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                        {clientesFiltrados.length === 0 && <button onClick={() => setModalNuevoCliente(true)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">+ Crear Cliente Nuevo</button>}
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
                            {filasRegistro.length > 1 && <button onClick={() => eliminarFila(index)} className="text-rose-400 hover:text-rose-600 font-black p-2 text-2xl transition-colors">✕</button>}
                          </div>
                        ))}
                        <button onClick={agregarFila} className="mt-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-5 py-2.5 rounded-xl self-start transition-colors">+ Añadir otra fila</button>
                      </div>
                      <div className="flex justify-between items-center p-5 bg-slate-900 dark:bg-black text-white rounded-2xl mt-2 shadow-inner border border-slate-800">
                        <span className="font-medium text-slate-300">Total a registrar:</span>
                        <span className={`text-4xl font-black tracking-tight ${accionRegistro === 'fiado' ? 'text-rose-400' : 'text-emerald-400'}`}>${totalFilas.toLocaleString('es-CO')}</span>
                      </div>
                      <button onClick={procesarRegistro} className={`w-full text-white font-black text-xl py-5 rounded-2xl shadow-lg mt-2 transition-transform transform active:scale-95 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'}`}>
                        Confirmar Registro
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
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden relative mb-24 border border-slate-100 dark:border-slate-800">
                <div className="bg-indigo-600 dark:bg-indigo-900 p-6 flex justify-between items-center">
                  <h2 className="text-2xl font-black text-white tracking-wide">Directorio Completo</h2>
                  <button onClick={() => setVerTodosClientes(false)} className="text-indigo-200 hover:text-white text-3xl font-bold transition-colors">✕</button>
                </div>
                <div className="p-4 max-h-[70vh] overflow-y-auto bg-slate-50 dark:bg-slate-950">
                  {clientes.map(c => (
                    <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setVerTodosClientes(false); }} className="p-5 my-3 mx-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md flex justify-between items-center transition-all">
                      <div>
                        <p className="font-bold text-lg text-slate-900 dark:text-slate-100">{c.nombre}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{c.celular}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{(c.deudaTotal || 0) < 0 ? 'A FAVOR' : 'DEUDA'}</p>
                        <p className={`font-black text-2xl tracking-tighter ${(c.deudaTotal || 0) < 0 ? 'text-emerald-500' : (c.deudaTotal > 0 ? 'text-rose-500' : 'text-slate-400')}`}>${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* NUEVO CLIENTE MODAL */}
          {modalNuevoCliente && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[90]">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Registrar Cliente</h3>
                <div className="flex flex-col gap-4 mb-8">
                  <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                  <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="Celular (para WhatsApp)" className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-white transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors">Cancelar</button>
                  <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 transition-colors">Guardar</button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}