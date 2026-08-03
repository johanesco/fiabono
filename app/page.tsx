"use client";
import { useState, useEffect, useRef } from "react";
import { 
  collection, addDoc, getDocs, query, doc, updateDoc, where, setDoc, getDoc, deleteDoc 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateEmail
} from "firebase/auth";
import { db, auth } from "../firebase";
import { 
  Search, Home as HomeIcon, PieChart, Clock, UserCog, 
  ShoppingBag, Banknote, Users, CheckCircle2, ChevronRight, 
  X, MessageCircle, ArrowDownRight, ArrowUpRight, LogOut, CalendarDays,
  Trash2, Edit2, AlertCircle, Sun, Moon, Monitor, Plus, Minus, Filter, ShieldAlert, Mail
} from 'lucide-react';

export default function Home() {
  // --- AUTENTICACIÓN Y PERFIL ---
  const [usuario, setUsuario] = useState<any>(null);
  const [nombreNegocio, setNombreNegocio] = useState<string>("Cargando...");
  const [telefonoNegocio, setTelefonoNegocio] = useState<string>("");
  const [correoNegocio, setCorreoNegocio] = useState<string>("");
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [modoAuth, setModoAuth] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inputNegocio, setInputNegocio] = useState("");
  
  // Seguridad y Contraseña
  const [modoEdicionPerfil, setModoEdicionPerfil] = useState(false);
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [passwordData, setPasswordData] = useState({ actual: "", nueva: "", confirmar: "" });
  const [passErrores, setPassErrores] = useState({ actual: "", nueva: "", confirmar: "", general: "" });
  const [mensajePerfil, setMensajePerfil] = useState({ texto: "", tipo: "" });

  // Apariencia
  const [temaApariencia, setTemaApariencia] = useState<'clara' | 'oscura' | 'auto'>('auto');

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
  const [filtroTipoHistorial, setFiltroTipoHistorial] = useState<'todos' | 'abono' | 'fiado'>('todos');

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
  const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string; cantidad: number }[]>([{ descripcion: "", valor: "", cantidad: 1 }]);
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, accion: any, detalles: any[], montoTotal: number } | null>(null);
  
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [verTodosClientes, setVerTodosClientes] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // --- SISTEMA DE SEGURIDAD PARA ACCIONES DESTRUCTIVAS ---
  const [modalSeguridad, setModalSeguridad] = useState<{ visible: boolean, accion: 'eliminar_cliente' | 'editar_cliente' | null }>({ visible: false, accion: null });
  const [passSeguridad, setPassSeguridad] = useState("");
  const [errorSeguridad, setErrorSeguridad] = useState("");
  const [cargandoSeguridad, setCargandoSeguridad] = useState(false);

  // --- AUTO-SCROLL REF ---
  const finalListaRef = useRef<HTMLDivElement>(null);

  // Efecto para auto-scroll cuando se añaden filas
  useEffect(() => {
    if (modalRegistro && pasoRegistro === 2 && finalListaRef.current) {
      setTimeout(() => {
        finalListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [filasRegistro.length, pasoRegistro, modalRegistro]);

  // --- TEMA (LIGHT/DARK/AUTO) ---
  useEffect(() => {
    const aplicarTema = () => {
      if (temaApariencia === 'oscura') {
        document.documentElement.classList.add('dark');
      } else if (temaApariencia === 'clara') {
        document.documentElement.classList.remove('dark');
      } else {
        const hora = new Date().getHours();
        if (hora >= 6 && hora < 18) {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      }
    };
    aplicarTema();
  }, [temaApariencia]);

  // --- INICIALIZACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuario(user);
        setCorreoNegocio(user.email || "");
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

  const cargarDatosGlobales = async (uid: string) => {
    try {
      const qC = query(collection(db, "clientes"), where("usuarioId", "==", uid));
      const snapC = await getDocs(qC);
      const listaC: any[] = [];
      snapC.forEach((doc) => pushClienteSeguro(listaC, doc));
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);

      const qM = query(collection(db, "movimientos"), where("usuarioId", "==", uid));
      const snapM = await getDocs(qM);
      const listaM: any[] = [];
      snapM.forEach((doc) => pushMovimientoSeguro(listaM, doc));
      listaM.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
      setTodosMovimientos(listaM);
    } catch (error) { console.error(error); }
  };

  const pushClienteSeguro = (lista: any[], doc: any) => lista.push({ id: doc.id, ...doc.data() });
  const pushMovimientoSeguro = (lista: any[], doc: any) => lista.push({ id: doc.id, ...doc.data() });

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

  // --- FUNCIONES DEL PERFIL ---
  const guardarDatosPerfil = async () => {
    if (!usuario) return;
    try {
      await updateDoc(doc(db, "usuarios", usuario.uid), { nombreNegocio, telefonoNegocio });
      setMensajePerfil({ texto: "Datos actualizados correctamente.", tipo: "exito" });
      setModoEdicionPerfil(false);
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 3000);
    } catch (error) { setMensajePerfil({ texto: "Error al guardar los datos.", tipo: "error" }); }
  };

  const procesarCambioPassword = async () => {
    setPassErrores({ actual: "", nueva: "", confirmar: "", general: "" });
    setMensajePerfil({ texto: "", tipo: "" });

    let hayError = false;
    let nuevosErrores = { actual: "", nueva: "", confirmar: "", general: "" };

    if (!passwordData.actual) { nuevosErrores.actual = "Ingresa tu contraseña actual"; hayError = true; }
    
    if (!passwordData.nueva) { nuevosErrores.nueva = "Ingresa una nueva contraseña"; hayError = true; }
    else if (passwordData.nueva.length < 6) { nuevosErrores.nueva = "La contraseña debe tener mínimo 6 caracteres"; hayError = true; }
    
    if (passwordData.nueva !== passwordData.confirmar) { nuevosErrores.confirmar = "Las contraseñas no coinciden"; hayError = true; }

    if (hayError) {
      setPassErrores(nuevosErrores);
      return;
    }
    
    try {
      const cred = EmailAuthProvider.credential(usuario.email, passwordData.actual);
      await reauthenticateWithCredential(usuario, cred);
      await updatePassword(usuario, passwordData.nueva);
      
      setMensajePerfil({ texto: "¡Contraseña actualizada con éxito!", tipo: "exito" });
      setCambiandoPass(false);
      setPasswordData({ actual: "", nueva: "", confirmar: "" });
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 4000);
    } catch (error: any) { 
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setPassErrores(prev => ({ ...prev, actual: "Contraseña incorrecta. Verifícala e intenta de nuevo." }));
      } else if (error.code === 'auth/too-many-requests') {
        setPassErrores(prev => ({ ...prev, general: "Demasiados intentos. Por favor, intenta más tarde." }));
      } else {
        setPassErrores(prev => ({ ...prev, general: "Ocurrió un error inesperado al cambiar la contraseña." }));
      }
    }
  };

  // --- SEGURIDAD: VERIFICAR PASSWORD PARA EDITAR/ELIMINAR ---
  const verificarSeguridadYEjecutar = async () => {
    if (!passSeguridad) return setErrorSeguridad("Ingresa tu contraseña para continuar.");
    setCargandoSeguridad(true);
    setErrorSeguridad("");

    try {
      const cred = EmailAuthProvider.credential(usuario.email, passSeguridad);
      await reauthenticateWithCredential(usuario, cred);
      
      setCargandoSeguridad(false);
      setPassSeguridad("");
      
      if (modalSeguridad.accion === 'eliminar_cliente') {
        setModalSeguridad({ visible: false, accion: null });
        ejecutarEliminacionCliente();
      } else if (modalSeguridad.accion === 'editar_cliente') {
        setModalSeguridad({ visible: false, accion: null });
        setModoEdicionCliente(true);
        setEditNombreCliente(clienteActivo.nombre);
        setEditCelularCliente(clienteActivo.celular || "");
      }
    } catch (error: any) {
      setCargandoSeguridad(false);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setErrorSeguridad("Contraseña incorrecta. Intenta de nuevo.");
      } else {
        setErrorSeguridad("Error de conexión. Intenta más tarde.");
      }
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
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    } catch (error) { alert("Error al actualizar cliente."); }
  };

  const ejecutarEliminacionCliente = async () => {
    try {
      await deleteDoc(doc(db, "clientes", clienteActivo.id));
      setClienteActivo(null);
      await cargarDatosGlobales(usuario.uid);
    } catch (error) { alert("Error al eliminar cliente."); }
  };

  // --- LÓGICA DE REGISTRO (CON CANTIDADES Y SCROLL) ---
  const agregarFila = () => {
    setFilasRegistro([...filasRegistro, { descripcion: "", valor: "", cantidad: 1 }]);
  };
  const actualizarFila = (index: number, campo: 'descripcion' | 'valor', valor: string) => {
    const nuevasFilas = [...filasRegistro]; nuevasFilas[index][campo] = valor as never; setFilasRegistro(nuevasFilas);
  };
  const actualizarCantidadFila = (index: number, delta: number) => {
    const nuevasFilas = [...filasRegistro];
    const nuevaCant = nuevasFilas[index].cantidad + delta;
    if (nuevaCant >= 1) { nuevasFilas[index].cantidad = nuevaCant; setFilasRegistro(nuevasFilas); }
  };
  const eliminarFila = (index: number) => { if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index)); };
  
  const totalFilas = filasRegistro.reduce((acc, fila) => { 
    const val = parseFloat(fila.valor); 
    const multiplicador = accionRegistro === 'fiado' ? fila.cantidad : 1;
    return acc + (isNaN(val) ? 0 : val * multiplicador); 
  }, 0);

  const procesarRegistro = async () => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) return alert("Ingresa al menos un monto válido.");
    try {
      let montoAcumulado = 0; 
      let detallesParaComprobante: {descripcion: string, valor: number, cantidad: number, valorUnitario: number}[] = []; 
      let resumenNombres: string[] = [];
      
      for (const fila of filasValidas) {
        const valUnitario = parseFloat(fila.valor);
        const cantidad = accionRegistro === 'fiado' ? fila.cantidad : 1;
        const subtotalFila = valUnitario * cantidad;
        montoAcumulado += subtotalFila;
        
        let descFinal = fila.descripcion.trim() || (accionRegistro === 'abono' ? "Abono a cuenta" : "Artículo fiado");
        
        detallesParaComprobante.push({ 
          descripcion: descFinal, 
          valor: subtotalFila, 
          cantidad: cantidad, 
          valorUnitario: valUnitario 
        }); 
        
        if (accionRegistro === 'fiado' && cantidad > 1) {
          resumenNombres.push(`${cantidad}x ${descFinal}`);
        } else {
          resumenNombres.push(descFinal);
        }
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
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);

      setModalExito({ visible: true, cliente: clienteActualizado, accion: accionRegistro, detalles: detallesParaComprobante, montoTotal: montoAcumulado });
      setModalRegistro(false); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteTransaccion(null);
      await cargarDatosGlobales(usuario.uid);
      if (clienteActivo && clienteActivo.id === clienteTransaccion.id) {
        setClienteActivo(clienteActualizado); await cargarMovimientosClienteDirecto(clienteTransaccion.id); 
      }
    } catch (error) { alert("Error al procesar el registro."); }
  };

  // --- TEXTOS WHATSAPP ---
  const generarTextoComprobante = (tipo: 'estado' | 'comprobante', cliente: any, accion?: 'fiado' | 'abono' | null, detallesArray?: any[], totalMov?: number) => {
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
        detallesArray.forEach(d => { 
          if (d.cantidad && d.cantidad > 1) {
            texto += `▪ ${d.cantidad}x ${d.descripcion} a $${d.valorUnitario?.toLocaleString('es-CO')} c/u: $${d.valor.toLocaleString('es-CO')}\n`;
          } else {
            texto += `▪ ${d.descripcion}: $${d.valor.toLocaleString('es-CO')}\n`;
          }
        });
        texto += `\n*Total de la operación:* $${totalMov?.toLocaleString('es-CO')}\n\n`;
      }
      texto += `📊 *NUEVO ESTADO DE CUENTA*\n`;
      if (cliente.deudaTotal === 0) texto += `Con esto, tu cuenta ha quedado al día ($0). ¡Muchas gracias! ✨`;
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
    if (filtroTipoHistorial !== 'todos' && mov.tipo !== filtroTipoHistorial) return false;

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

  if (cargandoAuth) return <div className="flex h-screen items-center justify-center font-bold text-slate-500 bg-slate-50 dark:bg-[#020617]">Cargando...</div>;
  if (!usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#020617] p-4 transition-colors duration-500">
        <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800/60 transition-all">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight mb-2">Fiabono.com</h1>
            <p className="text-slate-500 dark:text-slate-400">Software inteligente de cartera</p>
          </div>
          <form onSubmit={manejarAuth} className="flex flex-col gap-4">
            {modoAuth === 'registro' && ( <input type="text" placeholder="Nombre de tu negocio" value={inputNegocio} onChange={e => setInputNegocio(e.target.value)} className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-slate-200 transition-all" required /> )}
            <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-slate-200 transition-all" required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-500 dark:text-slate-200 transition-all" required />
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
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-200 transition-colors duration-500">
      <main className="flex flex-col relative max-w-4xl mx-auto min-h-screen pb-28">
        
        {/* HEADER SUPERIOR (Z-INDEX 50 SOLUCIONADO) */}
        <header className="bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl px-6 py-5 shadow-sm dark:shadow-none border-b border-slate-200/50 dark:border-slate-800/60 flex flex-col justify-center z-50 sticky top-0 transition-colors duration-500">
          <h1 className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight mb-1">Fiabono.com</h1>
          {vistaActiva === 'principal' && ( <p className="text-slate-500 dark:text-slate-400 font-medium text-base">{obtenerSaludo()}, <span className="font-black text-slate-900 dark:text-white text-2xl ml-1">{nombreNegocio}</span></p> )}
          {vistaActiva === 'estadisticas' && <p className="text-slate-500 dark:text-slate-400 font-medium text-base">Reportes y Estadísticas</p>}
          {vistaActiva === 'historial' && <p className="text-slate-500 dark:text-slate-400 font-medium text-base">Registro de Movimientos</p>}
          {vistaActiva === 'perfil' && <p className="text-slate-500 dark:text-slate-400 font-medium text-base">Configuración de cuenta</p>}
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
                    className="w-full text-lg p-5 pl-14 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/60 rounded-[2rem] focus:border-indigo-500 dark:focus:border-indigo-400 outline-none shadow-sm dark:shadow-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                </div>
                
                {busqueda.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/80 rounded-3xl mt-2 shadow-2xl max-h-72 overflow-y-auto z-30 p-2">
                    {clientesFiltrados.length > 0 ? (
                      clientesFiltrados.map((c) => (
                        <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setBusqueda(""); }} className="p-4 hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-2xl cursor-pointer flex justify-between items-center transition-colors">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span>
                          <span className={`text-sm font-black tracking-tight ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : (c.deudaTotal < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}`}>
                            {c.deudaTotal === 0 ? '$0 (Al día)' : (c.deudaTotal < 0 ? `A favor: $${Math.abs(c.deudaTotal).toLocaleString('es-CO')}` : `Deuda: $${c.deudaTotal.toLocaleString('es-CO')}`)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-slate-500 dark:text-slate-400">
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
                <button onClick={() => { setAccionRegistro('fiado'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} 
                  className="bg-gradient-to-br from-rose-500 to-red-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-red-700 text-white font-black text-2xl sm:text-3xl py-14 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-rose-400/30 dark:border-rose-500/20">
                  <ShoppingBag size={44} className="mb-3 opacity-90" />
                  FIAR
                </button>
                <button onClick={() => { setAccionRegistro('abono'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} 
                  className="bg-gradient-to-br from-emerald-400 to-green-600 dark:from-emerald-600 dark:to-emerald-800 hover:from-emerald-500 hover:to-green-700 text-white font-black text-2xl sm:text-3xl py-14 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30 dark:border-emerald-500/20">
                  <Banknote size={44} className="mb-3 opacity-90" />
                  ABONAR
                </button>
              </section>

              <button onClick={() => setVerTodosClientes(true)} className="bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-[#1e293b] text-indigo-900 dark:text-indigo-400 font-bold text-lg py-5 rounded-[2rem] shadow-sm transition-colors border border-slate-200 dark:border-slate-800/60 flex justify-center items-center gap-3">
                <Users size={24} /> Directorio de clientes
              </button>
            </div>
          )}

          {/* VISTA 2: ESTADÍSTICAS */}
          {vistaActiva === 'estadisticas' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-black rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute -right-10 -top-10 opacity-20 blur-2xl w-64 h-64 bg-indigo-500 rounded-full pointer-events-none"></div>
                <p className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> Cartera Activa (En la calle)</p>
                <p className="text-6xl sm:text-7xl font-black mb-8 tracking-tighter">${metricas.deudaTotal.toLocaleString('es-CO')}</p>
                <div className="flex gap-3 flex-wrap">
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/5">
                    <UserCog size={18} /> <p className="font-medium text-sm">Con saldo: <span className="font-bold text-white text-base">{metricas.clientesConCredito}</span></p>
                  </div>
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/5">
                    <Users size={18} /> <p className="font-medium text-sm">Total: <span className="font-bold text-white text-base">{metricas.totalClientes} clientes</span></p>
                  </div>
                </div>
              </div>

              {/* Bloque: Resumen de Hoy */}
              <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                  <Clock className="text-indigo-500" size={24}/> Hoy, {diaSemanaCapitalizado}
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400"><ArrowDownRight size={24}/></div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-tight">Dinero que Entró</p>
                        <p className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80">Abonos recibidos</p>
                      </div>
                    </div>
                    <p className="font-black text-2xl text-emerald-600 dark:text-emerald-400">${metricas.abonosHoy.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-rose-100 dark:bg-rose-500/20 p-2.5 rounded-xl text-rose-600 dark:text-rose-400"><ArrowUpRight size={24}/></div>
                      <div>
                        <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-tight">Dinero que Salió</p>
                        <p className="text-sm font-medium text-rose-600/80 dark:text-rose-400/80">Fiados entregados</p>
                      </div>
                    </div>
                    <p className="font-black text-2xl text-rose-600 dark:text-rose-400">${metricas.fiadosHoy.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>

              {/* Bloque: Esta Semana */}
              <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                <div className="mb-5">
                  <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <CalendarDays className="text-indigo-500" size={24}/> Esta Semana
                  </h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-8 mt-1">{textoRangoSemana}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400"><ArrowDownRight size={24}/></div>
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-lg">Total Entró</p>
                    </div>
                    <p className="font-black text-2xl text-emerald-600 dark:text-emerald-400">${metricas.abonosSemana.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-rose-100 dark:bg-rose-500/20 p-2.5 rounded-xl text-rose-600 dark:text-rose-400"><ArrowUpRight size={24}/></div>
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-lg">Total Salió</p>
                    </div>
                    <p className="font-black text-2xl text-rose-600 dark:text-rose-400">${metricas.fiadosSemana.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>

              {/* Bloque: Desempeño Mensual */}
              <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60 mb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                  <h3 className="font-black text-xl text-slate-800 dark:text-slate-100">Desempeño Mensual</h3>
                  <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(Number(e.target.value))} className="bg-slate-50 dark:bg-[#020617] text-slate-800 dark:text-slate-200 font-bold p-3 px-4 rounded-xl outline-none border border-slate-200 dark:border-slate-800 text-base shadow-sm">
                    {nombresMeses.map((mes, index) => ( <option key={index} value={index}>{mes}</option> ))}
                  </select>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-lg">Abonos en el mes</p>
                    </div>
                    <p className="font-black text-2xl text-emerald-600 dark:text-emerald-400">${metricas.abonosMes.toLocaleString('es-CO')}</p>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-rose-50 dark:bg-rose-500/10 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-lg">Fiados en el mes</p>
                    </div>
                    <p className="font-black text-2xl text-rose-600 dark:text-rose-400">${metricas.fiadosMes.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: HISTORIAL INTELIGENTE */}
          {vistaActiva === 'historial' && (
            <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden min-h-[70vh]">
              <div className="bg-slate-50 dark:bg-[#0f172a] p-5 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-4 sticky top-0 z-10">
                
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} placeholder="Buscar nombre en historial..." 
                    className="w-full p-3.5 pl-11 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all shadow-sm dark:text-slate-200" />
                </div>
                
                {/* DOBLE FILTRO */}
                <div className="flex flex-col gap-2">
                  <div className="flex bg-slate-200/50 dark:bg-[#020617] p-1 rounded-xl">
                    {['hoy', 'semana', 'mes', 'todos'].map((filtro) => (
                      <button key={filtro} onClick={() => setFiltroTiempoHistorial(filtro as any)}
                        className={`flex-1 text-xs font-bold py-2 rounded-lg capitalize transition-all ${filtroTiempoHistorial === filtro ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                        {filtro}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 w-full mt-1">
                    <button onClick={() => setFiltroTipoHistorial('todos')} className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${filtroTipoHistorial === 'todos' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}>Todos</button>
                    <button onClick={() => setFiltroTipoHistorial('abono')} className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${filtroTipoHistorial === 'abono' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-500/30' : 'bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}><Filter size={10} className="inline mr-1"/>Abonos</button>
                    <button onClick={() => setFiltroTipoHistorial('fiado')} className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${filtroTipoHistorial === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 shadow-sm border border-rose-200 dark:border-rose-500/30' : 'bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}><Filter size={10} className="inline mr-1"/>Fiados</button>
                  </div>
                </div>

              </div>
              <div className="p-2 overflow-y-auto">
                {historialFiltrado.map((mov) => (
                  <div key={mov.id} onClick={() => abrirPerfilDesdePanel(mov.clienteId)} className="p-4 mx-2 my-2 rounded-2xl flex justify-between items-center bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/60 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all">
                    <div className="flex pr-4 items-center gap-3">
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                        {mov.tipo === 'fiado' ? <ShoppingBag size={18} /> : <Banknote size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-200 whitespace-normal break-words">{getNombreCliente(mov.clienteId)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-normal break-words mt-0.5">{mov.descripcion}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                    <p className={`font-black whitespace-nowrap text-lg shrink-0 ${mov.tipo === 'fiado' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
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

          {/* VISTA 4: PERFIL (MODO LECTURA Y EDICIÓN PROTEGIDA) */}
          {vistaActiva === 'perfil' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 text-center relative">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full mx-auto flex items-center justify-center text-white text-4xl font-black mb-4 shadow-lg">
                  {nombreNegocio.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{nombreNegocio}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{correoNegocio}</p>
              </div>

              {/* Tema de Apariencia */}
              <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4 flex items-center gap-2">Apariencia</h3>
                <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
                  <button onClick={() => setTemaApariencia('clara')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'clara' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Sun size={20}/> Clara</button>
                  <button onClick={() => setTemaApariencia('auto')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'auto' ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Monitor size={20}/> Auto</button>
                  <button onClick={() => setTemaApariencia('oscura')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'oscura' ? 'bg-slate-700 dark:bg-[#1e293b] text-white dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'}`}><Moon size={20}/> Oscura</button>
                </div>
              </div>

              {/* Información del Negocio */}
              <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserCog size={20}/> Perfil del Negocio</h3>
                  {!modoEdicionPerfil && (
                    <button onClick={() => setModoEdicionPerfil(true)} className="text-indigo-600 dark:text-indigo-400 text-sm font-bold flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg"><Edit2 size={14}/> Modificar</button>
                  )}
                </div>
                
                {modoEdicionPerfil ? (
                  <div className="flex flex-col gap-4 animate-in fade-in">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nombre del Negocio</label>
                      <input type="text" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all font-bold" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">WhatsApp de Contacto</label>
                      <input type="tel" value={telefonoNegocio} onChange={(e) => setTelefonoNegocio(e.target.value)} placeholder="Ej. 3001234567" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all font-bold" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2"><Mail size={14}/> Correo Registrado (Solo lectura)</label>
                      <input type="email" value={correoNegocio} disabled className="w-full p-4 bg-slate-100 dark:bg-[#020617]/50 border border-slate-200 dark:border-slate-800/50 rounded-2xl text-slate-400 dark:text-slate-500 cursor-not-allowed font-medium" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button onClick={() => setModoEdicionPerfil(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80">Cancelar</button>
                      <button onClick={guardarDatosPerfil} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95">Guardar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{nombreNegocio}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">WhatsApp</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-lg">{telefonoNegocio || "No registrado"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Correo Electrónico</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{correoNegocio}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Seguridad */}
              <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><ShieldAlert size={20}/> Seguridad</h3>
                </div>
                
                {mensajePerfil.texto && (
                  <div className={`p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 mb-6 ${mensajePerfil.tipo === 'exito' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
                    {mensajePerfil.tipo === 'exito' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />} {mensajePerfil.texto}
                  </div>
                )}
                
                {!cambiandoPass ? (
                  <button onClick={() => setCambiandoPass(true)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80">Cambiar Contraseña</button>
                ) : (
                  <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Contraseña Actual</label>
                      <input type="password" value={passwordData.actual} onChange={(e) => { setPasswordData({...passwordData, actual: e.target.value}); setPassErrores({...passErrores, actual: ""}); }} placeholder="Tu contraseña actual" className={`w-full p-4 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold ${passErrores.actual ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white'}`} />
                      {passErrores.actual && <p className="text-rose-500 dark:text-rose-400 text-xs mt-2 font-bold flex items-center gap-1"><AlertCircle size={12}/>{passErrores.actual}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nueva Contraseña</label>
                      <input type="password" value={passwordData.nueva} onChange={(e) => { setPasswordData({...passwordData, nueva: e.target.value}); setPassErrores({...passErrores, nueva: ""}); }} placeholder="Mínimo 6 caracteres" className={`w-full p-4 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold ${passErrores.nueva ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white'}`} />
                      {passErrores.nueva && <p className="text-rose-500 dark:text-rose-400 text-xs mt-2 font-bold flex items-center gap-1"><AlertCircle size={12}/>{passErrores.nueva}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Confirmar Nueva Contraseña</label>
                      <input type="password" value={passwordData.confirmar} onChange={(e) => { setPasswordData({...passwordData, confirmar: e.target.value}); setPassErrores({...passErrores, confirmar: ""}); }} placeholder="Repite la nueva contraseña" className={`w-full p-4 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold ${passErrores.confirmar ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white'}`} />
                      {passErrores.confirmar && <p className="text-rose-500 dark:text-rose-400 text-xs mt-2 font-bold flex items-center gap-1"><AlertCircle size={12}/>{passErrores.confirmar}</p>}
                    </div>
                    
                    {passErrores.general && (
                      <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-sm font-bold text-center border border-rose-200 dark:border-rose-500/20">
                        {passErrores.general}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button onClick={() => { setCambiandoPass(false); setPasswordData({actual:"", nueva:"", confirmar:""}); setPassErrores({actual:"", nueva:"", confirmar:"", general:""}); }} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80">Cancelar</button>
                      <button onClick={procesarCambioPassword} className="bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition-colors shadow-md">Actualizar</button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-5 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-4 flex justify-center items-center gap-2">
                <LogOut size={20} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>

        {/* NAVEGACIÓN INFERIOR */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/60 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 pb-safe transition-colors duration-500">
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
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[70] animate-in zoom-in duration-300 overflow-y-auto">
            <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800/60 relative my-auto">
              <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle2 size={50} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Registro Exitoso!</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Se guardó el {modalExito.accion} de <strong className="text-slate-800 dark:text-slate-200">${modalExito.montoTotal.toLocaleString('es-CO')}</strong> en la cuenta de {modalExito.cliente.nombre}.</p>
              
              {modalExito.cliente.celular ? (
                <button onClick={() => abrirWhatsApp(generarTextoComprobante('comprobante', modalExito.cliente, modalExito.accion, modalExito.detalles, modalExito.montoTotal), modalExito.cliente.celular)} className="w-full mb-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center gap-2">
                  <MessageCircle size={20} /> Enviar recibo por WhatsApp
                </button>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 rounded-2xl mb-4 flex flex-col items-center justify-center gap-2 border border-amber-100 dark:border-amber-500/20">
                  <AlertCircle size={24} />
                  <span className="font-bold text-sm">Sin WhatsApp registrado</span>
                </div>
              )}
              
              <button onClick={() => setModalExito(null)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80">
                Cerrar y continuar
              </button>
            </div>
          </div>
        )}

        {/* MODAL SEGURIDAD (EDITAR/ELIMINAR) */}
        {modalSeguridad.visible && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 text-center">Acción Protegida</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">Por seguridad, ingresa tu contraseña para {modalSeguridad.accion === 'eliminar_cliente' ? 'eliminar' : 'editar'} este cliente.</p>
              
              <input type="password" value={passSeguridad} onChange={e => setPassSeguridad(e.target.value)} placeholder="Tu contraseña actual" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white mb-2 transition-all font-bold" />
              {errorSeguridad && <p className="text-rose-500 dark:text-rose-400 text-xs font-bold text-center mb-4 flex items-center justify-center gap-1"><AlertCircle size={12}/>{errorSeguridad}</p>}
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={() => {setModalSeguridad({visible: false, accion: null}); setPassSeguridad(""); setErrorSeguridad("");}} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-colors border dark:border-slate-800/80">Cancelar</button>
                <button onClick={verificarSeguridadYEjecutar} disabled={cargandoSeguridad} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center shadow-md">{cargandoSeguridad ? '...' : 'Confirmar'}</button>
              </div>
            </div>
          </div>
        )}

        {/* PERFIL DEL CLIENTE E HISTORIAL */}
        {clienteActivo && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center pt-6 sm:p-4 z-50 transition-opacity">
            <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] sm:max-h-[85vh] mb-[4.5rem] sm:mb-0 border border-slate-100 dark:border-slate-800/60 mx-2 sm:mx-0">
              
              <div className="p-5 pb-3 flex justify-between items-center sticky top-0 bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] z-10 shrink-0">
                <div className="flex gap-2">
                  <button onClick={() => { 
                    if(!modoEdicionCliente) { setModalSeguridad({ visible: true, accion: 'editar_cliente' }); } 
                    else { setModoEdicionCliente(false); }
                  }} className="bg-slate-100 dark:bg-[#020617] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors border dark:border-slate-800/80"><Edit2 size={20}/></button>
                  <button onClick={() => setModalSeguridad({ visible: true, accion: 'eliminar_cliente' })} className="bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-full p-3 font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-transparent dark:border-rose-500/20"><Trash2 size={20}/></button>
                </div>
                <button onClick={() => setClienteActivo(null)} className="bg-slate-100 dark:bg-[#020617] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors border dark:border-slate-800/80"><X size={20}/></button>
              </div>
              
              <div className="p-6 pt-0 text-center shrink-0">
                {modoEdicionCliente ? (
                  <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 mb-4 animate-in fade-in zoom-in-95 duration-200">
                    <input type="text" value={editNombreCliente} onChange={(e) => setEditNombreCliente(e.target.value)} placeholder="Nombre del cliente" className="w-full p-3 mb-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold dark:text-white" />
                    <input type="tel" value={editCelularCliente} onChange={(e) => setEditCelularCliente(e.target.value)} placeholder="Celular (opcional)" className="w-full p-3 mb-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold dark:text-white" />
                    <button onClick={actualizarCliente} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors">Guardar Cambios</button>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight whitespace-normal break-words">{clienteActivo.nombre}</h2>
                    {clienteActivo.celular ? <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">{clienteActivo.celular}</p> : null}
                    <p className="text-slate-400 dark:text-slate-500 font-bold mb-2 tracking-widest text-xs uppercase">{clienteActivo.deudaTotal === 0 ? 'CUENTA AL DÍA' : ((clienteActivo.deudaTotal || 0) < 0 ? 'SALDO A FAVOR' : 'SALDO PENDIENTE')}</p>
                    <p className={`text-5xl font-black tracking-tighter mb-4 ${clienteActivo.deudaTotal === 0 ? 'text-slate-300 dark:text-slate-600' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-800 dark:text-white')}`}>${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button onClick={() => { setAccionRegistro('fiado'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-bold py-4 rounded-2xl border border-rose-200 dark:border-rose-500/20 transition-colors flex justify-center items-center gap-2 shadow-sm"><ShoppingBag size={18}/> Fiar</button>
                  <button onClick={() => { setAccionRegistro('abono'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-bold py-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 transition-colors flex justify-center items-center gap-2 shadow-sm"><Banknote size={18}/> Abonar</button>
                </div>
                
                {!modoEdicionCliente && (
                  clienteActivo.celular ? (
                    <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-slate-900 dark:bg-[#020617] hover:bg-black dark:hover:bg-[#1e293b] text-white font-bold py-4 rounded-2xl transition-colors shadow-md border border-transparent dark:border-slate-800/80 flex justify-center items-center gap-2">
                      <MessageCircle size={20} /> Enviar estado por WhatsApp
                    </button>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 rounded-2xl flex items-center justify-between border border-amber-100 dark:border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={18} />
                        <span className="font-bold text-sm">Sin WhatsApp registrado</span>
                      </div>
                      <button onClick={() => { setModalSeguridad({ visible: true, accion: 'editar_cliente' }); }} className="bg-white dark:bg-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm transition-transform active:scale-95 border border-amber-200 dark:border-amber-500/30">
                        Agregar número
                      </button>
                    </div>
                  )
                )}
              </div>
              
              <div className="bg-slate-50 dark:bg-[#020617] p-6 flex-1 overflow-y-auto rounded-b-[2.5rem] border-t border-slate-100 dark:border-slate-800/80">
                <h3 className="font-bold text-slate-400 dark:text-slate-500 uppercase text-xs tracking-wider mb-5 pl-2 flex items-center gap-2"><Clock size={14}/> Historial de Registros</h3>
                <div className="flex flex-col gap-4">
                  {movimientosCliente.length === 0 ? <p className="text-slate-400 text-center text-sm py-4">No hay historial.</p> : (
                    movimientosCliente.map(mov => (
                      <div key={mov.id} className="bg-white dark:bg-[#0f172a] p-5 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                        <div className="pl-2">
                          {mov.detalles && mov.detalles.length > 0 ? (
                            <div className="flex flex-col gap-2.5">
                              {mov.detalles.map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center">
                                  <p className="font-medium text-slate-700 dark:text-slate-300 text-sm flex items-start gap-2 whitespace-normal break-words flex-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 mt-1.5"></span>
                                    <span>
                                      {d.cantidad && d.cantidad > 1 ? <span className="font-black mr-1 text-indigo-500 dark:text-indigo-400">{d.cantidad}x</span> : null}
                                      {d.descripcion}
                                      {d.cantidad && d.cantidad > 1 ? <span className="text-xs text-slate-400 dark:text-slate-500 block mt-0.5">(${(d.valorUnitario || d.valor/d.cantidad).toLocaleString('es-CO')} c/u)</span> : null}
                                    </span>
                                  </p>
                                  <p className="font-bold text-sm text-slate-600 dark:text-slate-400 shrink-0 ml-3">${d.valor.toLocaleString('es-CO')}</p>
                                </div>
                              ))}
                              <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Total {mov.tipo}</p>
                                <p className={`font-black text-2xl ${mov.tipo === 'fiado' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center mb-1">
                              <p className="font-bold text-slate-800 dark:text-slate-200 whitespace-normal break-words flex-1">{mov.descripcion}</p>
                              <p className={`font-black text-2xl shrink-0 ml-3 ${mov.tipo === 'fiado' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}</p>
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">
                            <p className="text-xs text-slate-400 font-medium tracking-wide">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                            {mov.saldoResultante !== undefined && mov.saldoResultante <= 0 && mov.tipo === 'abono' && (
                              <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm ${mov.saldoResultante < 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
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
          <div className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[80] animate-in zoom-in-95 duration-200 px-2 sm:px-4">
            <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] border border-slate-100 dark:border-slate-800/60 overflow-hidden">
              
              <div className={`p-5 text-white flex justify-between items-center shrink-0 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-800' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800'}`}>
                <h2 className="text-xl font-black uppercase tracking-wide flex items-center gap-2">
                  {accionRegistro === 'fiado' ? <ShoppingBag size={24}/> : <Banknote size={24}/>} 
                  {accionRegistro === 'fiado' ? 'Registrar Fiado' : 'Registrar Abono'}
                </h2>
                <button onClick={() => setModalRegistro(false)} className="text-white hover:text-white/70 bg-white/10 rounded-full w-10 h-10 flex items-center justify-center transition-colors"><X size={20}/></button>
              </div>
              
              <div className="flex flex-col flex-1 overflow-hidden relative">
                {pasoRegistro === 1 && (
                  <div className="p-4 sm:p-6 overflow-y-auto h-full bg-white dark:bg-[#0f172a]">
                    <p className="font-bold text-slate-600 dark:text-slate-300 mb-4">¿A qué cliente se le aplicará?</p>
                    <div className="relative mb-4">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente..." className="w-full p-4 pl-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all" />
                    </div>
                    <div className="flex flex-col gap-2 pb-10">
                      {clientesFiltrados.map(c => (
                        <div key={c.id} onClick={() => { setClienteTransaccion(c); setPasoRegistro(2); setBusqueda(""); }} className="p-4 bg-white dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500 cursor-pointer flex justify-between items-center transition-colors">
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><ChevronRight size={16} className="text-slate-500"/> {c.nombre}</span>
                        </div>
                      ))}
                      {clientesFiltrados.length === 0 && <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="w-full bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors flex justify-center items-center gap-2 border dark:border-slate-800/80"><UserCog size={18}/> Crear "{busqueda}" como nuevo</button>}
                    </div>
                  </div>
                )}

                {pasoRegistro === 2 && clienteTransaccion && (
                  <>
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-[#0f172a]">
                      <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex justify-between items-center mb-5">
                        <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Cliente:</span>
                        <span className="font-black text-slate-900 dark:text-white whitespace-normal break-words text-right ml-4">{clienteTransaccion.nombre}</span>
                      </div>
                      <div className="flex flex-col gap-3 pb-4">
                        {filasRegistro.map((fila, index) => (
                          <div key={index} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm relative">
                            {filasRegistro.length > 1 && (
                              <button onClick={() => eliminarFila(index)} className="absolute -top-2 -right-2 bg-rose-100 dark:bg-rose-900/80 text-rose-500 dark:text-rose-300 rounded-full p-1 shadow-sm"><X size={16}/></button>
                            )}
                            <input type="text" value={fila.descripcion} onChange={(e) => actualizarFila(index, 'descripcion', e.target.value)} placeholder={accionRegistro === 'fiado' ? "Descripción del artículo" : "Descripción del abono"} className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all text-sm font-bold" />
                            <div className="flex gap-2 items-center w-full">
                              {accionRegistro === 'fiado' && (
                                <div className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shrink-0 h-[46px]">
                                  <button onClick={() => actualizarCantidadFila(index, -1)} className="px-2.5 sm:px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-colors text-slate-500"><Minus size={16}/></button>
                                  <span className="w-6 sm:w-8 text-center font-black text-slate-800 dark:text-white text-sm">{fila.cantidad}</span>
                                  <button onClick={() => actualizarCantidadFila(index, 1)} className="px-2.5 sm:px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-colors text-slate-500"><Plus size={16}/></button>
                                </div>
                              )}
                              {accionRegistro === 'fiado' && <span className="text-slate-400 font-bold shrink-0 text-sm">x</span>}
                              
                              <div className="relative flex-1 min-w-0">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                                <input type="number" value={fila.valor} onChange={(e) => actualizarFila(index, 'valor', e.target.value)} placeholder={accionRegistro === 'fiado' ? "Unitario" : "Valor"} className="w-full pl-7 pr-3 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 font-black text-slate-900 dark:text-white transition-all h-[46px] min-w-0" />
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        <div ref={finalListaRef} className="h-1"></div>
                        
                        <button onClick={agregarFila} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-5 py-3 rounded-xl self-start transition-colors flex items-center gap-1 border dark:border-indigo-500/20"><Plus size={16}/> Añadir fila</button>
                      </div>
                    </div>
                    
                    <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800/60 shrink-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                      <div className="flex justify-between items-center p-4 bg-slate-900 dark:bg-black text-white rounded-2xl mb-3 shadow-inner border border-slate-800">
                        <span className="font-medium text-slate-300">Total a registrar:</span>
                        <span className={`text-3xl font-black tracking-tight ${accionRegistro === 'fiado' ? 'text-rose-400' : 'text-emerald-400'}`}>${totalFilas.toLocaleString('es-CO')}</span>
                      </div>
                      <button onClick={procesarRegistro} className={`w-full text-white font-black text-xl py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center gap-2 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-rose-700' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 hover:from-emerald-600 hover:to-emerald-700'}`}>
                        {accionRegistro === 'fiado' ? 'Confirmar Fiado' : 'Confirmar Abono'} <CheckCircle2 size={24}/>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DIRECTORIO MODAL */}
        {verTodosClientes && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 pt-10 z-50 overflow-y-auto">
            <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden relative mb-24 border border-slate-100 dark:border-slate-800/60 flex flex-col max-h-[85vh]">
              <div className="bg-indigo-600 dark:bg-indigo-900 p-6 flex justify-between items-center shrink-0 sticky top-0 z-10">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2"><Users size={24}/> Directorio</h2>
                <button onClick={() => setVerTodosClientes(false)} className="text-indigo-200 hover:text-white transition-colors bg-indigo-700/50 dark:bg-indigo-800/50 p-2 rounded-full"><X size={24}/></button>
              </div>
              <div className="p-4 bg-white dark:bg-[#020617] shrink-0 border-b border-slate-100 dark:border-slate-800/80">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)} placeholder="Buscar en el directorio..." className="w-full p-4 pl-11 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/60 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all shadow-sm" />
                </div>
              </div>
              <div className="p-4 overflow-y-auto bg-slate-50 dark:bg-[#020617] flex-1">
                {directorioFiltrado.map(c => (
                  <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setVerTodosClientes(false); }} className="p-5 my-3 mx-1 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md flex justify-between items-center transition-all">
                    <div className="flex-1 pr-3">
                      <p className="font-bold text-lg text-slate-900 dark:text-slate-100 whitespace-normal break-words">{c.nombre}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{c.celular}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.deudaTotal !== 0 && <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{(c.deudaTotal || 0) < 0 ? 'A FAVOR' : 'DEUDA'}</p>}
                      <p className={`font-black text-2xl tracking-tighter ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : ((c.deudaTotal || 0) < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}`}>
                        {c.deudaTotal === 0 ? '$0 (Al día)' : `$${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}`}
                      </p>
                    </div>
                  </div>
                ))}
                
                {directorioFiltrado.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Search size={32} className="opacity-20 mb-2"/>
                    <p>No se encontraron clientes.</p>
                    {busquedaDirectorio && (
                      <button onClick={() => { setNombreNuevo(busquedaDirectorio); setModalNuevoCliente(true); setVerTodosClientes(false); }} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl text-sm transition-colors flex items-center justify-center gap-2 mx-auto">
                        <UserCog size={16} /> Crear como Cliente Nuevo
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={() => { setNombreNuevo(""); setModalNuevoCliente(true); setVerTodosClientes(false); }} className="w-full mt-4 bg-transparent border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold py-4 rounded-2xl transition-colors flex justify-center items-center gap-2">
                    <UserCog size={18} /> + Crear nuevo cliente
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NUEVO CLIENTE MODAL */}
        {modalNuevoCliente && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[90]">
            <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/60 animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><UserCog size={24}/> Registrar Cliente</h3>
              
              <div className="flex flex-col gap-4 mb-8">
                <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all font-bold" />
                <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-indigo-500 dark:focus:border-indigo-400 dark:text-white transition-all font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80">Cancelar</button>
                <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 transition-colors flex justify-center items-center gap-2">Guardar <CheckCircle2 size={18}/></button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}