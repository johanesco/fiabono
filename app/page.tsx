"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { 
  collection, addDoc, getDocs, query, doc, updateDoc, where, setDoc, getDoc, deleteDoc 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, getAuth
} from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import { db, auth } from "../firebase";
import { 
  Search, Home as HomeIcon, PieChart, Clock, UserCog, 
  ShoppingBag, Banknote, Users, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, Info,
  X, MessageCircle, ArrowDownRight, ArrowUpRight, LogOut, CalendarDays,
  Trash2, Edit2, AlertCircle, Sun, Moon, Monitor, Plus, Minus, Filter, ShieldAlert, Mail,
  Lock, Star, Sparkles, TimerReset, BookX, PenTool, Store, Wallet, Shirt, BarChart3, UserPlus, BadgeCheck, EyeOff
} from 'lucide-react';

export default function Home() {
  // --- ESTADOS DE SESIÓN Y ROLES ---
  const [usuarioAuth, setUsuarioAuth] = useState<any>(null);
  const [datosUsuario, setDatosUsuario] = useState<any>(null); 
  const [cuentaPrincipalId, setCuentaPrincipalId] = useState<string>(""); 
  
  const [nombreUsuario, setNombreUsuario] = useState<string>("Usuario");
  const [nombreNegocio, setNombreNegocio] = useState<string>("Cargando...");
  const [telefonoNegocio, setTelefonoNegocio] = useState<string>("");
  const [correoNegocio, setCorreoNegocio] = useState<string>("");
  
  const [planActual, setPlanActual] = useState<'basico' | 'pro'>('basico');
  const [diasPro, setDiasPro] = useState<number | null>(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  
  // Modales de Landing Page y Auth Errores
  const [modalLandingInfo, setModalLandingInfo] = useState<{ visible: boolean, tipo: 'login' | 'registro' | null }>({ visible: false, tipo: null });
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", nombreUsuario: "", negocio: "" });
  const [authErrores, setAuthErrores] = useState({ email: "", password: "", confirmPassword: "", general: "" });
  
  // Seguridad y Contraseña Mejorada Perfil
  const [modoEdicionPerfil, setModoEdicionPerfil] = useState(false);
  const [editNombreUsuario, setEditNombreUsuario] = useState("");
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [passwordData, setPasswordData] = useState({ actual: "", nueva: "", confirmar: "" });
  const [passErrores, setPassErrores] = useState({ actual: "", nueva: "", confirmar: "", general: "" });
  const [mensajePerfil, setMensajePerfil] = useState({ texto: "", tipo: "" });

  // Creación y Edición de Colaboradores
  const [mostrarColaboradores, setMostrarColaboradores] = useState(false);
  const [modoCrearColaborador, setModoCrearColaborador] = useState(false);
  const [colaboradorEnEdicion, setColaboradorEnEdicion] = useState<any | null>(null);
  const [formColaborador, setFormColaborador] = useState({ 
    nombre: "", usuarioAcceso: "", password: "", confirmPassword: "",
    permisos: { verCelulares: false, verDirectorio: false, verReportes: false }
  });
  const [errorFormColaborador, setErrorFormColaborador] = useState({ usuarioAcceso: "", general: "" });
  const [colaboradoresRegistrados, setColaboradoresRegistrados] = useState<any[]>([]);
  const [creandoColaborador, setCreandoColaborador] = useState(false);
  const [colaboradorAEliminar, setColaboradorAEliminar] = useState<any | null>(null);
  const [modalAvisoColaborador, setModalAvisoColaborador] = useState<{ visible: boolean, titulo: string, mensaje: string, icono: 'exito'|'error'|'info' }>({ visible: false, titulo: "", mensaje: "", icono: 'exito' });
  const [modalCancelarPro, setModalCancelarPro] = useState(false);
  const [passCancelarPro, setPassCancelarPro] = useState("");
  const [errorCancelarPro, setErrorCancelarPro] = useState("");

  // Suscripción Inteligente (Upsell)
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [exitoPromo, setExitoPromo] = useState(false);
  const [avisoExpiracion, setAvisoExpiracion] = useState(false);
  const [codigoPromo, setCodigoPromo] = useState("");
  const [errorPromo, setErrorPromo] = useState("");
  const [cargandoPromo, setCargandoPromo] = useState(false);

  // Apariencia
  const [temaApariencia, setTemaApariencia] = useState<'clara' | 'oscura' | 'auto'>('clara');

  // --- ARQUITECTURA APP ---
  const [vistaActiva, setVistaActiva] = useState<'principal' | 'estadisticas' | 'historial' | 'perfil'>('principal');

  // --- DATOS GLOBALES ---
  const [clientes, setClientes] = useState<any[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(new Date().getMonth());
  const [tipoGrafico, setTipoGrafico] = useState<'semana' | 'mes' | 'año'>('semana');
  const [filtroVistaGrafico, setFiltroVistaGrafico] = useState<'todos' | 'abonos' | 'fiados'>('todos');

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

  // --- SISTEMA DE SEGURIDAD ---
  const [modalSeguridad, setModalSeguridad] = useState<{ visible: boolean, accion: 'eliminar_cliente' | 'editar_cliente' | 'eliminar_colaborador' | null }>({ visible: false, accion: null });
  const [passSeguridad, setPassSeguridad] = useState("");
  const [errorSeguridad, setErrorSeguridad] = useState("");
  const [cargandoSeguridad, setCargandoSeguridad] = useState(false);

  // --- REFERENCIAS (REFS) ---
  const finalListaRef = useRef<HTMLDivElement>(null);
  const scrollHistorialRef = useRef<HTMLDivElement>(null);
  const historialScrollPos = useRef(0);

  // --- PERMISOS ACTUALES ---
  const puedeVerReportes = datosUsuario?.rol !== 'cajero' || datosUsuario?.permisos?.verReportes === true;
  const puedeVerDirectorio = datosUsuario?.rol !== 'cajero' || datosUsuario?.permisos?.verDirectorio === true;
  const puedeVerCelulares = datosUsuario?.rol !== 'cajero' || datosUsuario?.permisos?.verCelulares === true;

  // --- EFECTOS BASE ---
  useEffect(() => {
    if (!usuarioAuth) window.scrollTo(0, 0);
  }, [usuarioAuth]);

  useEffect(() => {
    if (modalRegistro && pasoRegistro === 2 && finalListaRef.current) {
      setTimeout(() => finalListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [filasRegistro.length, pasoRegistro, modalRegistro]);

  useEffect(() => {
    if (vistaActiva === 'historial' && scrollHistorialRef.current) {
      scrollHistorialRef.current.scrollTop = historialScrollPos.current;
    } else if (vistaActiva !== 'historial') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [vistaActiva]);

  useEffect(() => {
    if (vistaActiva === 'historial' && scrollHistorialRef.current) {
      scrollHistorialRef.current.scrollTop = 0;
      historialScrollPos.current = 0;
    }
  }, [filtroTiempoHistorial, filtroTipoHistorial, busquedaHistorial]);

  useEffect(() => {
    const temaGuardado = localStorage.getItem('temaFiabono') as any;
    if (temaGuardado) setTemaApariencia(temaGuardado);
    else setTemaApariencia('clara');
  }, []);

  useEffect(() => {
    localStorage.setItem('temaFiabono', temaApariencia);
    const aplicarTema = () => {
      if (temaApariencia === 'oscura') document.documentElement.classList.add('dark');
      else if (temaApariencia === 'clara') document.documentElement.classList.remove('dark');
      else {
        const hora = new Date().getHours();
        if (hora >= 6 && hora < 18) document.documentElement.classList.remove('dark');
        else document.documentElement.classList.add('dark');
      }
    };
    aplicarTema();
  }, [temaApariencia]);

  // --- INICIALIZACIÓN DE SESIÓN (ROLES E INTEGRIDAD) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (!userDoc.exists()) {
          await signOut(auth);
          setUsuarioAuth(null);
          setDatosUsuario(null);
          setClientes([]);
          setTodosMovimientos([]);
          setCargandoAuth(false);
          setAuthErrores(p => ({...p, general: "Tu acceso ha sido revocado o eliminado por el administrador."}));
          setModalLandingInfo({ visible: true, tipo: 'login' });
          return;
        }

        const data = userDoc.data();
        
        if (data.rol === 'cajero' && data.activo === false) {
          await signOut(auth);
          setUsuarioAuth(null);
          setDatosUsuario(null);
          setClientes([]);
          setTodosMovimientos([]);
          setCargandoAuth(false);
          setAuthErrores(p => ({...p, general: "Tu cuenta de colaborador ha sido desactivada temporalmente por el administrador."}));
          setModalLandingInfo({ visible: true, tipo: 'login' });
          return;
        }

        setUsuarioAuth(user);
        setDatosUsuario(data);
        
        let idParaConsultar = user.uid; 
        
        if (data.rol === 'cajero') {
          idParaConsultar = data.adminId; 
          const adminDoc = await getDoc(doc(db, "usuarios", idParaConsultar));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            setNombreNegocio(adminData.nombreNegocio);
            setPlanActual(adminData.plan || 'basico');
          }
          setNombreUsuario(data.nombreUsuario);
          setCorreoNegocio(user.email || "");
        } else {
          setNombreUsuario(data.nombreUsuario || "Usuario");
          setNombreNegocio(data.nombreNegocio || "Mi Negocio");
          setTelefonoNegocio(data.telefonoNegocio || "");
          setCorreoNegocio(user.email || "");
          
          let miPlan = data.plan || "basico";
          if (miPlan === 'pro' && data.planVence) {
            const timeRemaining = data.planVence.toDate().getTime() - new Date().getTime();
            const daysLeft = Math.ceil(timeRemaining / (1000 * 3600 * 24));
            if (daysLeft <= 0) {
              miPlan = 'basico'; setDiasPro(null);
              await updateDoc(doc(db, "usuarios", user.uid), { plan: 'basico' });
            } else {
              setDiasPro(daysLeft);
              if (daysLeft <= 5) setAvisoExpiracion(true); 
            }
          }
          setPlanActual(miPlan);
          cargarListaColaboradores(user.uid);
        }
        
        setCuentaPrincipalId(idParaConsultar);
        await cargarDatosGlobales(idParaConsultar);
        setVistaActiva('principal');

      } else {
        setUsuarioAuth(null);
        setDatosUsuario(null);
        setClientes([]);
        setTodosMovimientos([]);
      }
      setCargandoAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const cargarListaColaboradores = async (adminUid: string) => {
    try {
      const qC = query(collection(db, "usuarios"), where("adminId", "==", adminUid), where("rol", "==", "cajero"));
      const snap = await getDocs(qC);
      const lista: any[] = [];
      snap.forEach(doc => lista.push({id: doc.id, ...doc.data()}));
      setColaboradoresRegistrados(lista);
    } catch(e) {}
  };

  const toggleEstadoColaborador = async (colaborador: any) => {
    const estaActivo = colaborador.activo === true || colaborador.activo === undefined;
    const nuevoEstado = !estaActivo;
    
    if (nuevoEstado === true && planActual === 'basico') {
        const activos = colaboradoresRegistrados.filter(c => c.activo === true || c.activo === undefined).length;
        if (activos >= 1) {
            abrirUpsell("Límite de Colaboradores", "En el plan básico solo puedes tener 1 colaborador ACTIVO a la vez. Apaga al actual para encender a otro, o pásate a PRO.");
            return;
        }
    }
    
    // Actualización optimista para evitar bugs de clicks rápidos
    setColaboradoresRegistrados(prev => prev.map(c => c.id === colaborador.id ? { ...c, activo: nuevoEstado } : c));

    try {
      await updateDoc(doc(db, "usuarios", colaborador.id), { activo: nuevoEstado });
    } catch (error) {
      cargarListaColaboradores(usuarioAuth.uid);
      console.error("Error al cambiar estado");
    }
  };

  const guardarColaborador = async () => {
    setErrorFormColaborador({ usuarioAcceso: "", general: "" });
    if(!formColaborador.nombre.trim()) return setErrorFormColaborador(p => ({...p, general: "El nombre es obligatorio."}));
    
    if (!colaboradorEnEdicion) {
      if(!formColaborador.usuarioAcceso.trim() || !formColaborador.password.trim() || !formColaborador.confirmPassword.trim()) {
        return setErrorFormColaborador(p => ({...p, general: "Llena todos los campos."}));
      }
      if(formColaborador.password.length < 6) return setErrorFormColaborador(p => ({...p, general: "La contraseña debe tener mínimo 6 caracteres."}));
      if(formColaborador.password !== formColaborador.confirmPassword) return setErrorFormColaborador(p => ({...p, general: "Las contraseñas no coinciden."}));
      
      if (planActual === 'basico' && colaboradoresRegistrados.length >= 1) {
        setModoCrearColaborador(false);
        abrirUpsell("Colaboradores Ilimitados", "El plan básico te permite tener 1 colaborador de prueba. Pásate a PRO para añadir colaboradores ilimitados y controlar todos sus permisos.");
        return;
      }

      if(planActual === 'pro' && colaboradoresRegistrados.length >= 4) {
        return setModalAvisoColaborador({ visible: true, titulo: "Límite Alcanzado", mensaje: "Tu plan PRO permite un máximo de 4 colaboradores simultáneos para tu negocio.", icono: 'error' });
      }
    }

    setCreandoColaborador(true);

    try {
      if (colaboradorEnEdicion) {
        await updateDoc(doc(db, "usuarios", colaboradorEnEdicion.id), {
          nombreUsuario: formColaborador.nombre.trim(),
          permisos: formColaborador.permisos
        });
        setModalAvisoColaborador({ visible: true, titulo: "Colaborador Actualizado", mensaje: `Los datos de ${formColaborador.nombre} se han actualizado correctamente.`, icono: 'exito' });
      } else {
        const correoGenerado = `${formColaborador.usuarioAcceso.replace(/\s/g, '').toLowerCase()}@fiabono.caja`;
        const secondaryApp = getApps().find(app => app.name === "SecondaryAuthApp") || initializeApp(auth.app.options, "SecondaryAuthApp");
        const secondaryAuthObj = getAuth(secondaryApp);
        
        const cred = await createUserWithEmailAndPassword(secondaryAuthObj, correoGenerado, formColaborador.password);
        
        await setDoc(doc(db, "usuarios", cred.user.uid), { 
          nombreUsuario: formColaborador.nombre.trim(),
          email: correoGenerado,
          rol: "cajero",
          adminId: usuarioAuth.uid,
          permisos: formColaborador.permisos,
          activo: true 
        });
        await secondaryAuthObj.signOut();
        setModalAvisoColaborador({ visible: true, titulo: "¡Acceso Creado!", mensaje: `El colaborador fue creado exitosamente.\n\nUsuario para entrar: \n${correoGenerado}`, icono: 'exito' });
      }

      setFormColaborador({ nombre:"", usuarioAcceso:"", password:"", confirmPassword: "", permisos: { verCelulares: false, verDirectorio: false, verReportes: false } });
      setModoCrearColaborador(false);
      setColaboradorEnEdicion(null);
      cargarListaColaboradores(usuarioAuth.uid);

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrorFormColaborador(p => ({...p, usuarioAcceso: "Este usuario ya existe. Intenta agregarle un número (Ej: colab2)."}));
      } else {
        setErrorFormColaborador(p => ({...p, general: "Ocurrió un error al guardar. Intenta de nuevo."}));
      }
    }
    setCreandoColaborador(false);
  };

  const cancelarSuscripcion = async () => {
    if(!passCancelarPro) return setErrorCancelarPro("Ingresa tu contraseña para confirmar.");
    try {
      const cred = EmailAuthProvider.credential(usuarioAuth.email, passCancelarPro);
      await reauthenticateWithCredential(usuarioAuth, cred);
      
      await updateDoc(doc(db, "usuarios", usuarioAuth.uid), {
        plan: 'basico',
        planVence: null
      });

      const qC = query(collection(db, "usuarios"), where("adminId", "==", usuarioAuth.uid), where("rol", "==", "cajero"));
      const snap = await getDocs(qC);
      const batchPromesas: any[] = [];
      snap.forEach((documento) => {
          batchPromesas.push(updateDoc(doc(db, "usuarios", documento.id), { activo: false }));
      });
      await Promise.all(batchPromesas);

      setPlanActual('basico');
      setDiasPro(null);
      setModalCancelarPro(false);
      setPassCancelarPro("");
      setErrorCancelarPro("");
      cargarListaColaboradores(usuarioAuth.uid);
      setModalAvisoColaborador({ visible: true, titulo: "Suscripción Cancelada", mensaje: "Has vuelto al Plan Básico.\n\nTus colaboradores han sido apagados temporalmente, pero puedes encender a UNO para que siga activo.", icono: 'info' });
    } catch (error) {
      setErrorCancelarPro("Contraseña incorrecta. Intenta de nuevo.");
    }
  };

  const manejarAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrores({ email: "", password: "", confirmPassword: "", general: "" });
    let hayError = false;

    let loginEmail = authForm.email.trim();
    if (modalLandingInfo.tipo === 'login' && loginEmail && !loginEmail.includes('@')) {
      loginEmail = `${loginEmail.toLowerCase()}@fiabono.caja`;
    }

    if (modalLandingInfo.tipo === 'registro') {
      if (!authForm.nombreUsuario.trim()) { setAuthErrores(p => ({...p, general: "Tu nombre es obligatorio"})); hayError = true; }
      if (!authForm.negocio.trim()) { setAuthErrores(p => ({...p, general: "El nombre del negocio es obligatorio"})); hayError = true; }
      if (authForm.password.length < 6) { setAuthErrores(p => ({...p, password: "Mínimo 6 caracteres"})); hayError = true; }
      if (authForm.password !== authForm.confirmPassword) { setAuthErrores(p => ({...p, confirmPassword: "Las contraseñas no coinciden"})); hayError = true; }
      if (hayError) return;

      try {
        const credencial = await createUserWithEmailAndPassword(auth, loginEmail, authForm.password);
        await setDoc(doc(db, "usuarios", credencial.user.uid), { 
          nombreUsuario: authForm.nombreUsuario.trim(),
          nombreNegocio: authForm.negocio.trim(), 
          email: loginEmail, 
          telefonoNegocio: "",
          rol: "admin",
          plan: "basico",
          planVence: null
        });
        setModalLandingInfo({ visible: false, tipo: null });
        setVistaActiva('principal');
      } catch (error: any) { 
        if (error.code === 'auth/email-already-in-use') setAuthErrores(p => ({...p, email: "Este correo ya está registrado."}));
        else if (error.code === 'auth/invalid-email') setAuthErrores(p => ({...p, email: "El formato del correo no es válido."}));
        else setAuthErrores(p => ({...p, general: "Ocurrió un error. Intenta de nuevo."}));
      }
    } else {
      if (!loginEmail || !authForm.password) { setAuthErrores(p => ({...p, general: "Llena todos los campos"})); return; }
      try {
        await signInWithEmailAndPassword(auth, loginEmail, authForm.password);
        setModalLandingInfo({ visible: false, tipo: null });
        setVistaActiva('principal');
      } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          setAuthErrores(p => ({...p, general: "El correo o la contraseña son incorrectos."}));
        } else {
          setAuthErrores(p => ({...p, general: "Error al iniciar sesión. Verifica tus datos."}));
        }
      }
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

  const canjearPromo = async () => {
    setErrorPromo("");
    if(!codigoPromo.trim()) return setErrorPromo("Ingresa un código promocional.");
    setCargandoPromo(true);
    
    if (codigoPromo.trim().toUpperCase() === "FIABONO26") {
      try {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30); 
        await updateDoc(doc(db, "usuarios", usuarioAuth.uid), { plan: "pro", planVence: expires });
        
        setExitoPromo(true);
        setPlanActual("pro");
        setDiasPro(30);
        setAvisoExpiracion(false);
        setCodigoPromo("");
        
        setTimeout(() => {
          setExitoPromo(false);
          setModalSuscripcion({ visible: false, titulo: "", mensaje: "" });
        }, 3500);

      } catch(e) { setErrorPromo("Error al procesar. Intenta más tarde."); }
    } else {
      setErrorPromo("El código ingresado no es válido.");
    }
    setCargandoPromo(false);
  };

  const abrirUpsell = (titulo: string, mensaje: string) => {
    setModalSuscripcion({ visible: true, titulo, mensaje });
  };

  const guardarDatosPerfil = async () => {
    if (!usuarioAuth) return;
    try {
      await updateDoc(doc(db, "usuarios", usuarioAuth.uid), { 
        nombreNegocio, 
        telefonoNegocio, 
        nombreUsuario: editNombreUsuario 
      });
      setNombreUsuario(editNombreUsuario);
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
    else if (passwordData.nueva.length < 6) { nuevosErrores.nueva = "Mínimo 6 caracteres"; hayError = true; }
    if (passwordData.nueva !== passwordData.confirmar) { nuevosErrores.confirmar = "Las contraseñas no coinciden"; hayError = true; }

    if (hayError) { setPassErrores(nuevosErrores); return; }
    
    try {
      const cred = EmailAuthProvider.credential(usuarioAuth.email, passwordData.actual);
      await reauthenticateWithCredential(usuarioAuth, cred);
      await updatePassword(usuarioAuth, passwordData.nueva);
      
      setMensajePerfil({ texto: "¡Contraseña actualizada con éxito!", tipo: "exito" });
      setCambiandoPass(false);
      setPasswordData({ actual: "", nueva: "", confirmar: "" });
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 4000);
    } catch (error: any) { 
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setPassErrores(prev => ({ ...prev, actual: "Contraseña incorrecta." }));
      } else {
        setPassErrores(prev => ({ ...prev, general: "Ocurrió un error inesperado." }));
      }
    }
  };

  const verificarSeguridadYEjecutar = async () => {
    if (!passSeguridad) return setErrorSeguridad("Ingresa tu contraseña de Administrador para confirmar.");
    setCargandoSeguridad(true); setErrorSeguridad("");

    try {
      const cred = EmailAuthProvider.credential(usuarioAuth.email, passSeguridad);
      await reauthenticateWithCredential(usuarioAuth, cred);
      
      setCargandoSeguridad(false); setPassSeguridad("");
      
      if (modalSeguridad.accion === 'eliminar_cliente') {
        setModalSeguridad({ visible: false, accion: null });
        ejecutarEliminacionCliente();
      } else if (modalSeguridad.accion === 'editar_cliente') {
        setModalSeguridad({ visible: false, accion: null });
        setModoEdicionCliente(true);
        setEditNombreCliente(clienteActivo.nombre);
        setEditCelularCliente(clienteActivo.celular || "");
      } else if (modalSeguridad.accion === 'eliminar_colaborador') {
        setModalSeguridad({ visible: false, accion: null });
        await deleteDoc(doc(db, "usuarios", colaboradorAEliminar.id));
        setColaboradorAEliminar(null);
        cargarListaColaboradores(usuarioAuth.uid);
        setModalAvisoColaborador({ visible: true, titulo: "Colaborador Eliminado", mensaje: "El acceso de este colaborador ha sido revocado y su cuenta borrada permanentemente del sistema.", icono: 'info' });
      }
    } catch (error: any) {
      setCargandoSeguridad(false);
      setErrorSeguridad("Contraseña incorrecta. Intenta de nuevo.");
    }
  };

  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    
    if (planActual === 'basico' && clientes.length >= 10) {
      setModalNuevoCliente(false);
      setTimeout(() => {
        abrirUpsell("Límite de Clientes Alcanzado", "En el plan básico se permite un máximo de 10 clientes.\n\nPara agregar el cliente número 11 y seguir creciendo de forma ilimitada, mejora a nuestro plan PRO.");
      }, 100);
      return;
    }

    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), { 
        nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: cuentaPrincipalId, fecha_creacion: new Date() 
      });
      const nuevoObj = { id: docRef.id, nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0 };
      setModalNuevoCliente(false); setNombreNuevo(""); setCelularNuevo("");
      await cargarDatosGlobales(cuentaPrincipalId);
      if (modalRegistro && pasoRegistro === 1) { setClienteTransaccion(nuevoObj); setPasoRegistro(2); }
    } catch (error) { alert("Error al guardar cliente."); } finally { setGuardandoCliente(false); }
  };

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
      setTimeout(() => {
         abrirUpsell("Límite de Movimientos", "Has alcanzado tu límite de 10 apuntes diarios en el plan básico. Activa el plan PRO para registrar fiados y abonos ilimitados todo el día.");
      }, 100);
      return;
    }

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
        
        detallesParaComprobante.push({ descripcion: descFinal, valor: subtotalFila, cantidad: cantidad, valorUnitario: valUnitario }); 
        if (accionRegistro === 'fiado' && cantidad > 1) { resumenNombres.push(`${cantidad}x ${descFinal}`); } 
        else { resumenNombres.push(descFinal); }
      }
      const descripcionUnificada = resumenNombres.join(", ");
      const ajuste = accionRegistro === 'fiado' ? montoAcumulado : -montoAcumulado;
      const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + ajuste;

      await addDoc(collection(db, "movimientos"), {
        clienteId: clienteTransaccion.id, 
        usuarioId: cuentaPrincipalId, 
        tipo: accionRegistro,
        monto: montoAcumulado, 
        descripcion: descripcionUnificada, 
        detalles: detallesParaComprobante,
        saldoResultante: nuevoSaldoTotal, 
        fecha: new Date(),
        registradoPor: nombreUsuario
      });

      const refCliente = doc(db, "clientes", clienteTransaccion.id);
      await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
      const clienteActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);

      setModalExito({ visible: true, cliente: clienteActualizado, accion: accionRegistro, detalles: detallesParaComprobante, montoTotal: montoAcumulado });
      setModalRegistro(false); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setClienteTransaccion(null);
      await cargarDatosGlobales(cuentaPrincipalId);
      if (clienteActivo && clienteActivo.id === clienteTransaccion.id) {
        setClienteActivo(clienteActualizado); await cargarMovimientosClienteDirecto(clienteTransaccion.id); 
      }
    } catch (error) { alert("Error al procesar el registro."); }
  };

  const actualizarCliente = async () => {
    if (!editNombreCliente.trim()) return alert("El nombre no puede estar vacío");
    try {
      await updateDoc(doc(db, "clientes", clienteActivo.id), { nombre: editNombreCliente.trim(), celular: editCelularCliente.trim() });
      setClienteActivo({ ...clienteActivo, nombre: editNombreCliente.trim(), celular: editCelularCliente.trim() });
      setModoEdicionCliente(false);
      await cargarDatosGlobales(cuentaPrincipalId);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    } catch (error) { alert("Error al actualizar cliente."); }
  };

  const ejecutarEliminacionCliente = async () => {
    try {
      await deleteDoc(doc(db, "clientes", clienteActivo.id));
      setClienteActivo(null);
      await cargarDatosGlobales(cuentaPrincipalId);
    } catch (error) { alert("Error al eliminar cliente."); }
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
    if (campo === 'valor') {
      const numeroLimpio = valorNuevo.replace(/\D/g, '');
      nuevasFilas[index][campo] = numeroLimpio as never;
    } else {
      nuevasFilas[index][campo] = valorNuevo as never;
    }
    setFilasRegistro(nuevasFilas);
  };

  const actualizarCantidadFila = (index: number, delta: number) => {
    const nuevasFilas = [...filasRegistro];
    const nuevaCant = nuevasFilas[index].cantidad + delta;
    if (nuevaCant >= 1) { nuevasFilas[index].cantidad = nuevaCant; setFilasRegistro(nuevasFilas); }
  };
  const eliminarFila = (index: number) => { if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index)); };

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
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.location.href = url;
  };

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

  // --- MATEMÁTICAS Y CONTEOS (REPORTES) ---
  const calcularMetricas = () => {
    let deudaTotal = 0, clientesConCredito = 0, totalClientes = clientes.length;
    clientes.forEach(c => { if ((c.deudaTotal || 0) > 0) { deudaTotal += c.deudaTotal; clientesConCredito++; } });
    
    const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
    const inicioSemana = inicioSemanaDate.getTime();
    const inicioMesFiltro = new Date(hoyDate.getFullYear(), mesSeleccionado, 1).getTime();
    const finMesFiltro = new Date(hoyDate.getFullYear(), mesSeleccionado + 1, 0, 23, 59, 59).getTime();

    let abonosHoy = 0, fiadosHoy = 0, abonosSemana = 0, fiadosSemana = 0, abonosMes = 0, fiadosMes = 0;
    let abonosHoyCount = 0, fiadosHoyCount = 0, abonosSemanaCount = 0, fiadosSemanaCount = 0, abonosMesCount = 0, fiadosMesCount = 0;

    todosMovimientos.forEach(m => {
      const ms = m.fecha?.toMillis() || 0;
      if (ms >= inicioHoy) { 
        if (m.tipo === 'abono') { abonosHoy += m.monto; abonosHoyCount++; } 
        else { fiadosHoy += m.monto; fiadosHoyCount++; }
      }
      if (ms >= inicioSemana) { 
        if (m.tipo === 'abono') { abonosSemana += m.monto; abonosSemanaCount++; } 
        else { fiadosSemana += m.monto; fiadosSemanaCount++; }
      }
      if (ms >= inicioMesFiltro && ms <= finMesFiltro) { 
        if (m.tipo === 'abono') { abonosMes += m.monto; abonosMesCount++; } 
        else { fiadosMes += m.monto; fiadosMesCount++; }
      }
    });
    return { 
      deudaTotal, clientesConCredito, totalClientes, 
      abonosHoy, fiadosHoy, abonosSemana, fiadosSemana, abonosMes, fiadosMes,
      abonosHoyCount, fiadosHoyCount, abonosSemanaCount, fiadosSemanaCount, abonosMesCount, fiadosMesCount
    };
  };

  const metricas = calcularMetricas();
  const getNombreCliente = (id: string) => clientes.find(c => c.id === id)?.nombre || "Cliente Eliminado";
  const clientesFiltrados = clientes.filter(c => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()));
  const directorioFiltrado = clientes.filter(c => c.nombre?.toLowerCase().includes(busquedaDirectorio.toLowerCase()));

  const historialFiltrado = todosMovimientos.filter(mov => {
    const filtroForzado = (!puedeVerReportes || planActual === 'basico') ? 'hoy' : filtroTiempoHistorial;

    const cliente = clientes.find(c => c.id === mov.clienteId);
    const nombreMatch = cliente ? cliente.nombre.toLowerCase().includes(busquedaHistorial.toLowerCase()) : false;
    if (busquedaHistorial && !nombreMatch) return false;
    if (filtroTipoHistorial !== 'todos' && mov.tipo !== filtroTipoHistorial) return false;

    const ms = mov.fecha?.toMillis() || 0;
    const inicioHoy = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), hoyDate.getDate()).getTime();
    const inicioSemana = inicioSemanaDate.getTime();
    const inicioMes = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1).getTime();

    if (filtroForzado === 'hoy') return ms >= inicioHoy;
    if (filtroForzado === 'semana') return ms >= inicioSemana;
    if (filtroForzado === 'mes') return ms >= inicioMes;
    return true; 
  });

  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const renderGrafico = () => {
    let datosGrafico = [];
    let maxValor = 0;
    const hoyDateRef = new Date();

    if (tipoGrafico === 'semana') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoyDateRef);
        d.setDate(d.getDate() - i);
        d.setHours(0,0,0,0);
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        let abonos = 0; let fiados = 0;
        todosMovimientos.forEach(m => {
          const mDate = m.fecha?.toDate();
          if (mDate && mDate >= d && mDate < nextD) {
            if (filtroVistaGrafico === 'todos' || filtroVistaGrafico === 'abonos') {
              if (m.tipo === 'abono') abonos += m.monto;
            }
            if (filtroVistaGrafico === 'todos' || filtroVistaGrafico === 'fiados') {
              if (m.tipo === 'fiado') fiados += m.monto;
            }
          }
        });
        const total = abonos + fiados;
        if (total > maxValor) maxValor = total;
        datosGrafico.push({ etiqueta: d.toLocaleDateString('es-CO', { weekday: 'short' }).charAt(0).toUpperCase(), abonos, fiados });
      }
    } else if (tipoGrafico === 'mes') {
      for (let i = 3; i >= 0; i--) {
        const dEnd = new Date(hoyDateRef);
        dEnd.setDate(dEnd.getDate() - (i * 7));
        const dStart = new Date(dEnd);
        dStart.setDate(dStart.getDate() - 7);
        
        let abonos = 0; let fiados = 0;
        todosMovimientos.forEach(m => {
          const mDate = m.fecha?.toDate();
          if (mDate && mDate >= dStart && mDate < dEnd) {
            if (filtroVistaGrafico === 'todos' || filtroVistaGrafico === 'abonos') {
              if (m.tipo === 'abono') abonos += m.monto;
            }
            if (filtroVistaGrafico === 'todos' || filtroVistaGrafico === 'fiados') {
              if (m.tipo === 'fiado') fiados += m.monto;
            }
          }
        });
        const total = abonos + fiados;
        if (total > maxValor) maxValor = total;
        
        let etiquetaMes = `${dStart.getDate()} ${nombresMeses[dStart.getMonth()].substring(0,3)}`;
        datosGrafico.push({ etiqueta: etiquetaMes, abonos, fiados });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const dStart = new Date(hoyDateRef.getFullYear(), hoyDateRef.getMonth() - i, 1);
        const dEnd = new Date(hoyDateRef.getFullYear(), hoyDateRef.getMonth() - i + 1, 1);
        
        let abonos = 0; let fiados = 0;
        todosMovimientos.forEach(m => {
          const mDate = m.fecha?.toDate();
          if (mDate && mDate >= dStart && mDate < dEnd) {
            if (filtroVistaGrafico === 'todos' || filtroVistaGrafico === 'abonos') {
              if (m.tipo === 'abono') abonos += m.monto;
            }
            if (filtroVistaGrafico === 'todos' || filtroVistaGrafico === 'fiados') {
              if (m.tipo === 'fiado') fiados += m.monto;
            }
          }
        });
        const total = abonos + fiados;
        if (total > maxValor) maxValor = total;
        datosGrafico.push({ etiqueta: dStart.toLocaleDateString('es-CO', { month: 'short' }).charAt(0).toUpperCase(), abonos, fiados });
      }
    }

    return (
      <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60 mt-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2"><BarChart3 className="text-blue-500" size={24}/> Rendimiento</h3>
          <div className="flex bg-slate-100 dark:bg-[#020617] p-1 rounded-xl shrink-0">
            <button onClick={() => setTipoGrafico('semana')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${tipoGrafico === 'semana' ? 'bg-white dark:bg-[#1e293b] text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Semana</button>
            <button onClick={() => setTipoGrafico('mes')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${tipoGrafico === 'mes' ? 'bg-white dark:bg-[#1e293b] text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Mes</button>
            <button onClick={() => setTipoGrafico('año')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${tipoGrafico === 'año' ? 'bg-white dark:bg-[#1e293b] text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>6 Meses</button>
          </div>
        </div>

        <div className="flex gap-2 w-full mb-4">
          <button onClick={() => setFiltroVistaGrafico('todos')} className={`flex-1 text-[10px] sm:text-xs font-bold py-2 rounded-lg transition-all ${filtroVistaGrafico === 'todos' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm' : 'bg-slate-50 dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}>Todos</button>
          <button onClick={() => setFiltroVistaGrafico('abonos')} className={`flex-1 text-[10px] sm:text-xs font-bold py-2 rounded-lg transition-all ${filtroVistaGrafico === 'abonos' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}>Abonos</button>
          <button onClick={() => setFiltroVistaGrafico('fiados')} className={`flex-1 text-[10px] sm:text-xs font-bold py-2 rounded-lg transition-all ${filtroVistaGrafico === 'fiados' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 shadow-sm border border-rose-200 dark:border-rose-500/30' : 'bg-slate-50 dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}>Fiados</button>
        </div>
        
        <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 relative pt-4">
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
            <div className="border-t border-dashed border-slate-200 dark:border-slate-800/80 w-full opacity-50"></div>
            <div className="border-t border-dashed border-slate-200 dark:border-slate-800/80 w-full opacity-50"></div>
            <div className="border-t border-solid border-slate-200 dark:border-slate-800/80 w-full"></div>
          </div>

          {datosGrafico.map((dia, idx) => {
            const hAbono = maxValor === 0 ? 0 : (dia.abonos / maxValor) * 100;
            const hFiado = maxValor === 0 ? 0 : (dia.fiados / maxValor) * 100;
            
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 z-10 h-full justify-end group">
                <div className="w-full flex justify-center gap-0.5 sm:gap-1.5 items-end h-[calc(100%-24px)] relative">
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-3 py-1.5 rounded-lg pointer-events-none whitespace-nowrap shadow-xl z-20">
                    +{dia.abonos/1000}k / -{dia.fiados/1000}k
                  </div>

                  {filtroVistaGrafico !== 'fiados' && <div className="w-1/2 max-w-[20px] bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all duration-500" style={{ height: `${hAbono}%`, minHeight: dia.abonos > 0 ? '4px' : '0' }}></div>}
                  {filtroVistaGrafico !== 'abonos' && <div className="w-1/2 max-w-[20px] bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-md transition-all duration-500" style={{ height: `${hFiado}%`, minHeight: dia.fiados > 0 ? '4px' : '0' }}></div>}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-full">{dia.etiqueta}</span>
              </div>
            );
          })}
        </div>
        
        <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          {filtroVistaGrafico !== 'fiados' && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span><span className="text-xs font-bold text-slate-600 dark:text-slate-300">Abonos</span></div>}
          {filtroVistaGrafico !== 'abonos' && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span><span className="text-xs font-bold text-slate-600 dark:text-slate-300">Fiados</span></div>}
        </div>
      </div>
    );
  };

  const totalFilasRegistro = filasRegistro.reduce((acc, fila) => { 
    const val = parseFloat(fila.valor || "0"); 
    const multiplicador = accionRegistro === 'fiado' ? fila.cantidad : 1;
    return acc + (isNaN(val) ? 0 : val * multiplicador); 
  }, 0);

  // ============================================================================
  // RENDERIZADO APP (USUARIO LOGUEADO Y LANDING PAGE JUNTOS EN LA RAIZ)
  // ============================================================================

  if (cargandoAuth) return <div className="flex h-screen items-center justify-center font-bold text-slate-500 bg-slate-50 dark:bg-[#020617]">Cargando...</div>;
  
  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-200 transition-colors duration-500 overflow-x-hidden">
      
      {!usuarioAuth ? (
        <>
          <header className="sticky top-0 left-0 right-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/60 z-40 pt-[max(env(safe-area-inset-top),1rem)] pb-4 px-6 flex justify-between items-center transition-colors duration-500">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
                <CheckCircle2 size={20} className="text-white"/>
              </div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Fiabono<span className="text-emerald-500">.com</span></h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <button onClick={() => setModalLandingInfo({ visible: true, tipo: 'login' })} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-3 py-2">Ingresar</button>
              <button onClick={() => setModalLandingInfo({ visible: true, tipo: 'registro' })} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-4 sm:px-5 rounded-full shadow-lg shadow-blue-600/20 transition-transform transform active:scale-95">Comenzar</button>
            </div>
          </header>

          <section className="pt-24 pb-24 px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-widest mb-8 border border-blue-100 dark:border-blue-500/20">
              <Star size={14} className="fill-current" /> La app de los negocios locales
            </div>
            <h2 className="text-5xl sm:text-7xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 leading-[1.15]">
              El fin del <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">cuaderno de papel.</span><br/> Cobra sin sentir pena.
            </h2>
            <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
              La aplicación súper fácil diseñada para dueños de negocio. Anota lo que fías, registra los abonos y envía un comprobante de notificación al WhatsApp en un solo toque.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button onClick={() => setModalLandingInfo({ visible: true, tipo: 'registro' })} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-black py-4 px-8 rounded-2xl shadow-xl transition-transform transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                Crear mi cuenta gratis <ChevronRight size={24}/>
              </button>
            </div>
          </section>

          <section className="py-24 bg-slate-100/50 dark:bg-[#020617] border-y border-slate-200/50 dark:border-slate-800/50">
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">¿Por qué el cuaderno te hace perder plata?</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Si te pasa alguna de estas cuatro cosas, necesitas Fiabono urgente.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                  <BookX size={36} className="text-rose-500 mb-6" />
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-3">Se pierde o se daña</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Si el cuaderno se moja, se pierde o alguien arranca una hoja, perdiste tu dinero porque no hay cómo comprobar la deuda.</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                  <PenTool size={36} className="text-rose-500 mb-6" />
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-3">Tachones y enredos</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Anotar abonos encima de otra nota hace que cobres mal. Las cuentas enredadas generan discusiones y te hacen perder clientes.</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                  <MessageCircle size={36} className="text-rose-500 mb-6" />
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-3">Cobrar da pena</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Llamar a un vecino para cobrar es incómodo. Con Fiabono, en un toque el sistema envía un amable comprobante de notificación al WhatsApp por ti.</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-blue-500/30">
                  <ShieldAlert size={36} className="text-blue-500 mb-6" />
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mb-3">Empleados sin control</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">El "Modo Colaborador" permite que tus empleados anoten ventas sin que vean cuánta plata ganas y ocultando los números de tus clientes para que no te los roben.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="py-24 bg-white dark:bg-[#0f172a]">
            <div className="max-w-4xl mx-auto px-6">
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-16 text-center">Fiabono en la vida real</h3>
              
              <div className="flex flex-col gap-8">
                <div className="flex flex-col sm:flex-row items-center gap-8 bg-slate-50 dark:bg-[#020617] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                  <div className="w-16 h-16 shrink-0 bg-blue-100 dark:bg-blue-500/20 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Store size={32}/>
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Escenario 1: Fiar el mercado</h4>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                      Don Pedro se lleva $50.000 en víveres. Abres la app, tocas <strong>"Fiar"</strong>, anotas "Mercado" y listo. Con un solo toque le envías un comprobante de notificación al WhatsApp indicando cuánto dinero le queda restando.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-8 bg-slate-50 dark:bg-[#020617] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors">
                  <div className="w-16 h-16 shrink-0 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Wallet size={32}/>
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Escenario 2: El abono de quincena</h4>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                      María pasa por tu negocio y te abona $20.000 a su deuda vieja. Tocas <strong>"Abonar"</strong>, ingresas el valor y guardas. En un toque le envías a María su comprobante actualizado por WhatsApp. Cuentas claras, amistades largas.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-8 bg-slate-50 dark:bg-[#020617] p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors">
                  <div className="w-16 h-16 shrink-0 bg-rose-100 dark:bg-rose-500/20 text-rose-600 rounded-2xl flex items-center justify-center">
                    <Shirt size={32}/>
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Escenario 3: El almacén de ropa</h4>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                      Sofía aparta una blusa de $60.000 y te deja $20.000. Registras a Sofía, anotas el fiado de 60 mil y de inmediato su abono de 20 mil. Le envías su comprobante al WhatsApp y ambas saben que solo debe $40.000. Cero papelitos perdidos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="py-24 px-6 max-w-4xl mx-auto text-center border-t border-slate-100 dark:border-slate-800/50">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">Elige cómo quieres organizar tu negocio</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-12 max-w-lg mx-auto text-lg">Comienza gratis para probarlo. Cuando te des cuenta del tiempo y dinero que ahorras, pásate a PRO.</p>
            
            <div className="grid sm:grid-cols-2 gap-8 text-left">
              <div className="bg-white dark:bg-[#0f172a] p-8 sm:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
                <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Plan Básico</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 h-10">Perfecto para negocios pequeños que apenas empiezan.</p>
                <p className="text-5xl font-black text-slate-900 dark:text-white mb-8">$0 <span className="text-base text-slate-400 font-medium">/mes</span></p>
                <ul className="flex flex-col gap-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-base font-bold text-slate-700 dark:text-slate-300"><CheckCircle2 size={24} className="text-emerald-500 shrink-0"/> 1 Colaborador de prueba</li>
                  <li className="flex items-start gap-3 text-base font-bold text-slate-700 dark:text-slate-300"><CheckCircle2 size={24} className="text-emerald-500 shrink-0"/> Registro de lo que fías o te abonan hoy</li>
                  <li className="flex items-center gap-3 text-base font-bold text-slate-700 dark:text-slate-300"><CheckCircle2 size={24} className="text-emerald-500 shrink-0"/> Hasta 10 clientes en tu agenda</li>
                  <li className="flex items-center gap-3 text-base font-bold text-slate-700 dark:text-slate-300"><CheckCircle2 size={24} className="text-emerald-500 shrink-0"/> 10 apuntes diarios</li>
                </ul>
                <button onClick={() => setModalLandingInfo({ visible: true, tipo: 'registro' })} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-900 dark:text-white font-black py-5 text-lg rounded-2xl transition-colors border dark:border-slate-800/80">Crear mi cuenta gratis</button>
              </div>
              
              <div className="bg-blue-600 dark:bg-blue-700 p-8 sm:p-10 rounded-[2.5rem] border border-blue-500 flex flex-col shadow-2xl shadow-blue-600/20 relative overflow-hidden text-white transform sm:-translate-y-4">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl">El que todos usan</div>
                <h4 className="text-2xl font-black mb-2 text-white">Plan PRO</h4>
                <p className="text-blue-200 text-sm mb-6 h-10">Crece sin límites y protege la información de tu negocio.</p>
                <p className="text-5xl font-black mb-8 text-white">$19.900 <span className="text-base text-blue-200 font-medium">COP /mes</span></p>
                <ul className="flex flex-col gap-4 mb-8 flex-1">
                  <li className="flex items-start gap-3 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-300 shrink-0"/> <span className="leading-tight">Colaboradores ilimitados con control de permisos</span></li>
                  <li className="flex items-center gap-3 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-300 shrink-0"/> Clientes infinitos</li>
                  <li className="flex items-center gap-3 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-300 shrink-0"/> Apuntes ilimitados en el día</li>
                  <li className="flex items-start gap-3 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-300 shrink-0"/> Gráficas visuales de tu caja</li>
                  <li className="flex items-start gap-3 text-base font-bold"><CheckCircle2 size={24} className="text-emerald-300 shrink-0"/> Historial completo de meses pasados</li>
                </ul>
                <button onClick={() => setModalLandingInfo({ visible: true, tipo: 'registro' })} className="w-full bg-white text-blue-600 hover:bg-slate-50 font-black py-5 text-lg rounded-2xl shadow-lg transition-transform transform active:scale-95">Digitalizar mis cuentas</button>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <header className="sticky top-0 left-0 right-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/60 z-[140] pt-[max(env(safe-area-inset-top),1.5rem)] pb-4 px-6 flex flex-col justify-center transition-colors duration-500">
            <div className="flex justify-between items-center max-w-4xl mx-auto w-full mb-2">
              <h1 className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-500 tracking-tight">Fiabono<span className="text-emerald-500">.com</span></h1>
              {planActual === 'pro' && <span className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">PRO</span>}
            </div>
            
            <div className="max-w-4xl mx-auto w-full flex justify-between items-end">
              <div className="flex flex-col min-w-0 pr-4">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">{nombreNegocio}</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                  {datosUsuario?.rol === 'cajero' && <BadgeCheck size={14} className="text-blue-500 shrink-0"/>}
                  <span className="truncate">{obtenerSaludo()}, {nombreUsuario.split(' ')[0]}</span>
                </p>
              </div>
              
              <div className="text-right shrink-0">
                  {vistaActiva === 'estadisticas' && <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">Reportes</p>}
                  {vistaActiva === 'historial' && <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">Historial</p>}
                  {vistaActiva === 'perfil' && <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">Ajustes</p>}
              </div>
            </div>
          </header>

          <main className="flex flex-col relative max-w-4xl mx-auto min-h-screen pb-28 pt-6 p-4 sm:p-6">
            {vistaActiva === 'principal' && (
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
                          <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl text-lg transition-colors flex items-center justify-center gap-2 mx-auto shadow-md">
                            <UserCog size={24} /> Crear Cliente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-2 gap-4 sm:gap-6">
                  <button onClick={() => { setAccionRegistro('fiado'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} 
                    className="bg-gradient-to-br from-rose-500 to-red-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-red-700 text-white font-black text-2xl sm:text-4xl py-16 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-rose-400/30 dark:border-rose-500/20">
                    <ShoppingBag size={52} className="mb-4 opacity-90 shrink-0" />
                    FIAR
                  </button>
                  <button onClick={() => { setAccionRegistro('abono'); setPasoRegistro(1); setClienteTransaccion(null); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} 
                    className="bg-gradient-to-br from-emerald-400 to-green-600 dark:from-emerald-600 dark:to-emerald-800 hover:from-emerald-50 hover:to-green-700 text-white font-black text-2xl sm:text-4xl py-16 rounded-[2rem] shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30 dark:border-emerald-500/20">
                    <Banknote size={52} className="mb-4 opacity-90 shrink-0" />
                    ABONAR
                  </button>
                </section>

                {puedeVerDirectorio && (
                  <button onClick={() => setVerTodosClientes(true)} className="bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-[#1e293b] text-blue-900 dark:text-blue-400 font-bold text-xl py-6 rounded-[2rem] shadow-sm transition-colors border border-slate-200 dark:border-slate-800/60 flex justify-center items-center gap-3 relative z-10">
                    <Users size={28} className="shrink-0" /> Directorio de clientes
                  </button>
                )}
              </div>
            )}

            {vistaActiva === 'estadisticas' && puedeVerReportes && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-black rounded-[2rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800 flex flex-col gap-2">
                  <div className="absolute -right-10 -top-10 opacity-20 blur-2xl w-40 h-40 bg-blue-500 rounded-full pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col gap-1">
                    <p className="text-blue-200 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span> Cartera Activa en la calle
                    </p>
                    <p className="text-5xl sm:text-6xl font-black tracking-tighter truncate">${metricas.deudaTotal.toLocaleString('es-CO')}</p>
                    
                    <div className="flex gap-4 mt-2 pt-4 border-t border-slate-700/50">
                      <div className="flex flex-col min-w-0">
                        <p className="text-xl sm:text-2xl font-black text-white truncate">{metricas.totalClientes}</p>
                        <p className="text-[10px] text-blue-200 uppercase tracking-widest font-bold truncate">Total Clientes</p>
                      </div>
                      <div className="w-px bg-slate-700/50"></div>
                      <div className="flex flex-col min-w-0">
                        <p className="text-xl sm:text-2xl font-black text-emerald-400 truncate">{metricas.clientesConCredito}</p>
                        <p className="text-[10px] text-blue-200 uppercase tracking-widest font-bold truncate">Con Deuda</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative rounded-[2.5rem] overflow-hidden flex flex-col gap-6">
                  <div className={`flex flex-col gap-6 ${planActual === 'basico' ? 'blur-[8px] opacity-40 pointer-events-none select-none' : ''}`}>
                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <Clock className="text-blue-500 shrink-0" size={28}/> Hoy, {diaSemanaCapitalizado}
                      </h3>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 p-5 sm:p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl border border-emerald-100 dark:border-emerald-500/20">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0"><ArrowDownRight size={20}/></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-none truncate">Total Abonos</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0">{metricas.abonosHoyCount}</p>
                          </div>
                          <p className="font-black text-3xl sm:text-4xl text-emerald-600 dark:text-emerald-400 truncate mt-1">${metricas.abonosHoy.toLocaleString('es-CO')}</p>
                        </div>
                        
                        <div className="flex flex-col gap-2 p-5 sm:p-6 bg-rose-50 dark:bg-rose-500/10 rounded-3xl border border-rose-100 dark:border-rose-500/20">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="bg-rose-100 dark:bg-rose-500/20 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 shrink-0"><ArrowUpRight size={20}/></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-none truncate">Total Fiados</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-rose-600/80 dark:text-rose-400/80 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-1 rounded-lg shrink-0">{metricas.fiadosHoyCount}</p>
                          </div>
                          <p className="font-black text-3xl sm:text-4xl text-rose-600 dark:text-rose-400 truncate mt-1">${metricas.fiadosHoy.toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <div className="mb-6">
                        <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <CalendarDays className="text-blue-500 shrink-0" size={28}/> Esta Semana
                        </h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-9 mt-1 truncate">{textoRangoSemana}</p>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 p-5 sm:p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl border border-emerald-100 dark:border-emerald-500/20">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0"><ArrowDownRight size={20}/></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-none truncate">Total Abonos</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0">{metricas.abonosSemanaCount}</p>
                          </div>
                          <p className="font-black text-3xl sm:text-4xl text-emerald-600 dark:text-emerald-400 truncate mt-1">${metricas.abonosSemana.toLocaleString('es-CO')}</p>
                        </div>
                        
                        <div className="flex flex-col gap-2 p-5 sm:p-6 bg-rose-50 dark:bg-rose-500/10 rounded-3xl border border-rose-100 dark:border-rose-500/20">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="bg-rose-100 dark:bg-rose-500/20 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 shrink-0"><ArrowUpRight size={20}/></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-none truncate">Total Fiados</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-rose-600/80 dark:text-rose-400/80 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-1 rounded-lg shrink-0">{metricas.fiadosSemanaCount}</p>
                          </div>
                          <p className="font-black text-3xl sm:text-4xl text-rose-600 dark:text-rose-400 truncate mt-1">${metricas.fiadosSemana.toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                        <h3 className="font-black text-2xl text-slate-800 dark:text-slate-100">Desempeño Mensual</h3>
                        <div className="bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
                          <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(Number(e.target.value))} className="bg-transparent text-slate-800 dark:text-slate-200 font-bold px-3 py-1 w-full outline-none text-lg cursor-pointer">
                            {nombresMeses.map((mes, index) => ( <option key={index} value={index} className="bg-white dark:bg-[#0f172a]">{mes}</option> ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2 p-5 sm:p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl border border-emerald-100 dark:border-emerald-500/20">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0"><ArrowDownRight size={20}/></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-none truncate">Total Abonos</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg shrink-0">{metricas.abonosMesCount}</p>
                          </div>
                          <p className="font-black text-3xl sm:text-4xl text-emerald-600 dark:text-emerald-400 truncate mt-1">${metricas.abonosMes.toLocaleString('es-CO')}</p>
                        </div>
                        
                        <div className="flex flex-col gap-2 p-5 sm:p-6 bg-rose-50 dark:bg-rose-500/10 rounded-3xl border border-rose-100 dark:border-rose-500/20">
                          <div className="flex items-center justify-between min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="bg-rose-100 dark:bg-rose-500/20 p-2.5 rounded-xl text-rose-600 dark:text-rose-400 shrink-0"><ArrowUpRight size={20}/></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300 text-lg leading-none truncate">Total Fiados</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-rose-600/80 dark:text-rose-400/80 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-1 rounded-lg shrink-0">{metricas.fiadosMesCount}</p>
                          </div>
                          <p className="font-black text-3xl sm:text-4xl text-rose-600 dark:text-rose-400 truncate mt-1">${metricas.fiadosMes.toLocaleString('es-CO')}</p>
                        </div>
                      </div>
                    </div>

                    {renderGrafico()}

                  </div>

                  {planActual === 'basico' && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 dark:bg-[#020617]/60 backdrop-blur-[2px]">
                      <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-center max-w-md border border-slate-100 dark:border-slate-800/80 mx-4">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6">
                          <Lock size={40} />
                        </div>
                        <h4 className="text-3xl font-black text-slate-900 dark:text-white mb-4">Desbloquea los Reportes</h4>
                        <p className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-8">Pásate a Pro para ver tus gráficas de caja, reportes semanales y el estado financiero completo de tu negocio.</p>
                        <button onClick={() => abrirUpsell("Desbloquea tus Reportes", "Conoce exactamente cómo se mueve tu dinero y analiza tu crecimiento sin restricciones.")} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xl py-5 rounded-2xl shadow-lg transition-transform transform active:scale-95">Mejorar a Pro</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VISTA HISTORIAL */}
            {vistaActiva === 'historial' && (
              <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 overflow-hidden h-[75vh]">
                <div className="bg-slate-50 dark:bg-[#0f172a] p-6 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-5 sticky top-0 z-10 shrink-0">
                  
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                    <input type="text" value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} placeholder="Buscar nombre en historial..." 
                      className="w-full p-5 pl-14 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 text-lg transition-all shadow-sm dark:text-slate-200" />
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {puedeVerReportes && (
                      <div className="flex bg-slate-200/50 dark:bg-[#020617] p-1.5 rounded-xl">
                        {['hoy', 'semana', 'mes', 'todos'].map((filtro) => (
                          <button key={filtro} 
                            onClick={() => {
                              if (planActual === 'basico' && filtro !== 'hoy') {
                                abrirUpsell("Historial Avanzado", "El plan básico solo permite ver los registros de hoy. Activa Pro para buscar en todo tu historial de meses o semanas pasadas.");
                              } else {
                                setFiltroTiempoHistorial(filtro as any);
                              }
                            }}
                            className={`flex-1 text-sm font-bold py-3 rounded-lg capitalize transition-all ${filtroTiempoHistorial === filtro ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            {filtro} {planActual === 'basico' && filtro !== 'hoy' && <Lock size={12} className="inline mb-0.5 ml-0.5 opacity-50 shrink-0"/>}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 w-full mt-1">
                      <button onClick={() => setFiltroTipoHistorial('todos')} className={`flex-1 text-sm font-bold py-3 rounded-xl transition-all ${filtroTipoHistorial === 'todos' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm' : 'bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}>Todos</button>
                      <button onClick={() => setFiltroTipoHistorial('abono')} className={`flex-1 text-sm font-bold py-3 rounded-xl transition-all ${filtroTipoHistorial === 'abono' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-500/30' : 'bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}><Filter size={14} className="inline mr-1 shrink-0"/>Abonos</button>
                      <button onClick={() => setFiltroTipoHistorial('fiado')} className={`flex-1 text-sm font-bold py-3 rounded-xl transition-all ${filtroTipoHistorial === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 shadow-sm border border-rose-200 dark:border-rose-500/30' : 'bg-white dark:bg-[#020617] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80'}`}><Filter size={14} className="inline mr-1 shrink-0"/>Fiados</button>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="p-3 overflow-y-auto scroll-smooth flex-1" 
                  ref={scrollHistorialRef}
                  onScroll={(e) => { historialScrollPos.current = e.currentTarget.scrollTop; }}
                >
                  {historialFiltrado.map((mov) => (
                    <div key={mov.id} onClick={() => abrirPerfilDesdePanel(mov.clienteId)} className="p-5 mx-2 my-3 rounded-2xl flex flex-col gap-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/60 shadow-sm cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                      
                      <div className="flex justify-between items-start gap-3 pl-2">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                            {mov.tipo === 'fiado' ? <ShoppingBag size={20} /> : <Banknote size={20} />}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <p className="font-bold text-lg text-slate-900 dark:text-slate-200 truncate">{getNombreCliente(mov.clienteId)}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{mov.descripcion}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-end pl-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                        <div className="flex flex-col gap-1 min-w-0">
                          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                          {mov.registradoPor && <p className="text-[10px] bg-slate-100 dark:bg-[#1e293b] text-slate-500 px-2 py-0.5 rounded-md font-bold self-start truncate max-w-[120px]">Colab: {mov.registradoPor}</p>}
                        </div>
                        <p className={`font-black text-xl sm:text-2xl shrink-0 truncate max-w-[40%] text-right ${mov.tipo === 'fiado' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                          {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {historialFiltrado.length === 0 && (
                    <div className="p-10 text-center flex flex-col items-center justify-center gap-4 text-slate-400 h-full">
                      <Search size={48} className="opacity-20 mb-2"/>
                      <p className="text-xl font-medium">No hay registros para mostrar.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VISTA PERFIL */}
            {vistaActiva === 'perfil' && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {datosUsuario?.rol === 'cajero' ? (
                  <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
                     <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto flex items-center justify-center text-slate-600 dark:text-slate-300 text-4xl font-black mb-6 shadow-inner shrink-0">
                      <UserCog size={40}/>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 truncate">{nombreUsuario}</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mb-6 truncate">Colaborador en {nombreNegocio}</p>
                    
                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 mt-6 text-left">
                      <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4 flex items-center gap-2">Apariencia</h3>
                      <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
                        <button onClick={() => setTemaApariencia('clara')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'clara' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Sun size={20} className="shrink-0"/> Clara</button>
                        <button onClick={() => setTemaApariencia('auto')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'auto' ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Monitor size={20} className="shrink-0"/> Auto</button>
                        <button onClick={() => setTemaApariencia('oscura')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'oscura' ? 'bg-slate-700 dark:bg-[#1e293b] text-white dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'}`}><Moon size={20} className="shrink-0"/> Oscura</button>
                      </div>
                    </div>

                    <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-6 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-4 flex justify-center items-center gap-2 text-lg mt-8">
                      <LogOut size={24} className="shrink-0" /> Cerrar Sesión
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full mx-auto flex items-center justify-center text-white text-4xl font-black mb-4 shadow-lg shrink-0">
                        {nombreNegocio.charAt(0).toUpperCase()}
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white truncate">{nombreNegocio}</h2>
                      <p className="text-slate-500 dark:text-slate-400 font-medium mb-4 truncate">{correoNegocio}</p>
                      
                      {planActual === 'pro' ? (
                        <div className="flex flex-col items-center justify-center gap-3 mt-4">
                          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest border border-emerald-100 dark:border-emerald-500/20">
                            <Star size={14} className="fill-current shrink-0"/> <span className="truncate">Plan Pro Activo {diasPro !== null && `(${diasPro} días)`}</span>
                          </div>
                          <button onClick={() => setModalCancelarPro(true)} className="text-xs font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 transition-colors underline decoration-rose-300 underline-offset-4">
                            Cancelar suscripción Pro
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => abrirUpsell("Mejora tu plan hoy", "Disfruta de clientes y registros ilimitados, además de historial completo.")} className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest shadow-md hover:scale-105 transition-transform mt-4">
                          <Lock size={14} className="shrink-0"/> Subir a Pro
                        </button>
                      )}
                    </div>

                    {/* Colaboradores */}
                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                        <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserPlus size={20} className="text-blue-500 shrink-0"/> Colaboradores</h3>
                        {colaboradoresRegistrados.length > 0 && (
                          <button onClick={() => setMostrarColaboradores(!mostrarColaboradores)} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg shrink-0">
                            {mostrarColaboradores ? 'Ocultar' : 'Ver todos'} {mostrarColaboradores ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                          </button>
                        )}
                      </div>
                      
                      {!modoCrearColaborador ? (
                        <div className="flex flex-col gap-4">
                          {colaboradoresRegistrados.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-100 dark:border-slate-800/60">No tienes colaboradores registrados.</p>
                          ) : (
                            mostrarColaboradores && colaboradoresRegistrados.map((c: any, i: number) => (
                              <div key={i} className="flex flex-col p-5 bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-100 dark:border-slate-800/60 gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{c.nombreUsuario}</p>
                                    <p className="text-sm text-slate-500 truncate">{c.email}</p>
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => { 
                                      setColaboradorEnEdicion(c); 
                                      setFormColaborador({nombre: c.nombreUsuario, usuarioAcceso: c.email.split('@')[0], password: '', confirmPassword: '', permisos: c.permisos || {verCelulares: false, verDirectorio: false, verReportes: false}}); 
                                      setModoCrearColaborador(true); 
                                    }} className="bg-white dark:bg-[#0f172a] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
                                      <Edit2 size={20} className="text-slate-500 shrink-0" />
                                    </button>
                                    <button onClick={() => { setColaboradorAEliminar(c); setModalSeguridad({visible: true, accion: 'eliminar_colaborador'}); }} className="bg-white dark:bg-[#0f172a] p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors shadow-sm">
                                      <Trash2 size={20} className="text-rose-500 shrink-0" />
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                                   <label className="flex items-center gap-2 cursor-pointer relative">
                                     <input type="checkbox" className="sr-only peer" checked={c.activo !== false} onChange={() => toggleEstadoColaborador(c)}/>
                                     <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                                     <span className="text-xs font-bold text-slate-500">{c.activo !== false ? 'Activo' : 'Apagado'}</span>
                                   </label>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mt-1 border-t border-slate-200 dark:border-slate-800 pt-3">
                                  {c.permisos?.verCelulares ? <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold px-2 py-1 rounded-md">Celulares</span> : null}
                                  {c.permisos?.verDirectorio ? <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 font-bold px-2 py-1 rounded-md">Directorio</span> : null}
                                  {c.permisos?.verReportes ? <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 font-bold px-2 py-1 rounded-md">Reportes</span> : null}
                                  {!c.permisos?.verCelulares && !c.permisos?.verDirectorio && !c.permisos?.verReportes ? <span className="text-[10px] bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold px-2 py-1 rounded-md">Modo Ciego Total</span> : null}
                                </div>
                              </div>
                            ))
                          )}

                          <button onClick={() => {
                            if (planActual === 'basico' && colaboradoresRegistrados.length >= 1) {
                              abrirUpsell("Colaboradores Ilimitados", "El plan básico te permite tener 1 colaborador de prueba. Pásate a PRO para añadir colaboradores ilimitados y controlar todos sus permisos.");
                            } else {
                              setColaboradorEnEdicion(null);
                              setFormColaborador({ nombre:"", usuarioAcceso:"", password:"", confirmPassword: "", permisos: { verCelulares: false, verDirectorio: false, verReportes: false } });
                              setErrorFormColaborador({ usuarioAcceso: "", general: "" });
                              setModoCrearColaborador(true);
                              setMostrarColaboradores(true);
                            }
                          }} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-blue-600 dark:text-blue-400 font-bold py-4 rounded-xl transition-colors border dark:border-slate-800/80 mt-2 flex items-center justify-center gap-2 text-lg">
                            <UserPlus size={20} className="shrink-0" /> Añadir Colaborador {planActual === 'basico' && colaboradoresRegistrados.length >= 1 && <Lock size={16} className="opacity-50 shrink-0"/>}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 animate-in fade-in">
                          {!colaboradorEnEdicion && (
                            <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-relaxed flex gap-2">
                                <Info size={20} className="shrink-0"/>
                                <span>Para crear un colaborador solo ingresa un usuario (Ej: <strong>caja1</strong>). El sistema le agregará el dominio de forma automática.</span>
                              </p>
                            </div>
                          )}
                          <input type="text" value={formColaborador.nombre} onChange={e => {setFormColaborador({...formColaborador, nombre: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Nombre de la persona (Ej: Carlos)" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg" />
                          
                          {!colaboradorEnEdicion ? (
                            <>
                              <div>
                                <input type="text" value={formColaborador.usuarioAcceso} onChange={e => {setFormColaborador({...formColaborador, usuarioAcceso: e.target.value}); setErrorFormColaborador({...errorFormColaborador, usuarioAcceso:""})}} placeholder="Usuario de acceso (Ej: caja1)" className={`w-full p-4 bg-slate-50 dark:bg-[#020617] border rounded-xl outline-none transition-all font-bold text-lg ${errorFormColaborador.usuarioAcceso ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500'}`} />
                                <p className="text-xs text-slate-400 mt-1.5 ml-2">Quedará como: @fiabono.caja</p>
                                {errorFormColaborador.usuarioAcceso && <p className="text-rose-500 text-xs font-bold mt-1.5 ml-2">{errorFormColaborador.usuarioAcceso}</p>}
                              </div>
                              <input type="password" value={formColaborador.password} onChange={e => {setFormColaborador({...formColaborador, password: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Contraseña (Mínimo 6)" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg" />
                              <input type="password" value={formColaborador.confirmPassword} onChange={e => {setFormColaborador({...formColaborador, confirmPassword: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Confirmar Contraseña" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg" />
                            </>
                          ) : (
                            <div className="bg-slate-100 dark:bg-[#020617] p-5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Usuario de acceso:</p>
                              <p className="text-lg font-black text-slate-800 dark:text-slate-200 mb-4 break-all">{formColaborador.usuarioAcceso}@fiabono.caja</p>
                              
                              <button onClick={() => setModalAvisoColaborador({ visible: true, titulo: "Cambio de Contraseña", mensaje: "Por restricciones de seguridad sin un servidor centralizado, no es posible cambiar la contraseña de otro usuario directamente.\n\nPara asignar una nueva clave, por favor cancela esta edición, elimina este colaborador y vuelve a crearlo con la contraseña nueva.", icono: 'info' })} className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/20 w-full mb-2">
                                ¿Olvidó su contraseña?
                              </button>
                              <p className="text-[10px] text-slate-400 text-center leading-tight">Por seguridad, el usuario y contraseña no pueden modificarse aquí.</p>
                            </div>
                          )}
                          
                          {errorFormColaborador.general && (
                            <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-base font-bold text-center border border-rose-200 dark:border-rose-500/20">
                              {errorFormColaborador.general}
                            </div>
                          )}
                          
                          {/* Permisos */}
                          <div className="flex flex-col gap-4 mt-2 mb-2 bg-slate-50 dark:bg-[#020617] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                             <p className="text-base font-black text-slate-800 dark:text-slate-200 mb-1">Permisos Especiales:</p>
                             <label className="flex items-center gap-3 text-base font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" className="w-6 h-6 accent-blue-600 shrink-0" checked={formColaborador.permisos.verCelulares} onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verCelulares: e.target.checked}})}/> 
                               <span className="truncate">Ver números de celular</span>
                             </label>
                             <label className="flex items-center gap-3 text-base font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" className="w-6 h-6 accent-blue-600 shrink-0" checked={formColaborador.permisos.verDirectorio} onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verDirectorio: e.target.checked}})}/> 
                               <span className="truncate">Abrir Directorio completo</span>
                             </label>
                             <label className="flex items-center gap-3 text-base font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                               <input type="checkbox" className="w-6 h-6 accent-blue-600 shrink-0" checked={formColaborador.permisos.verReportes} onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verReportes: e.target.checked}})}/> 
                               <span className="truncate">Ver Estadísticas de dinero</span>
                             </label>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <button onClick={() => { setModoCrearColaborador(false); setColaboradorEnEdicion(null); setErrorFormColaborador({usuarioAcceso:"", general:""}); }} className="bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl text-lg">Cancelar</button>
                            <button onClick={guardarColaborador} disabled={creandoColaborador} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95 text-lg truncate">{creandoColaborador ? '...' : (colaboradorEnEdicion ? 'Actualizar' : 'Guardar')}</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4 flex items-center gap-2">Apariencia</h3>
                      <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
                        <button onClick={() => setTemaApariencia('clara')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'clara' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Sun size={20} className="shrink-0"/> Clara</button>
                        <button onClick={() => setTemaApariencia('auto')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'auto' ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Monitor size={20} className="shrink-0"/> Auto</button>
                        <button onClick={() => setTemaApariencia('oscura')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'oscura' ? 'bg-slate-700 dark:bg-[#1e293b] text-white dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'}`}><Moon size={20} className="shrink-0"/> Oscura</button>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                        <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserCog size={20} className="shrink-0"/> Perfil del Negocio</h3>
                        {!modoEdicionPerfil && (
                          <button onClick={() => { setEditNombreUsuario(nombreUsuario); setModoEdicionPerfil(true); }} className="text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg shrink-0"><Edit2 size={14}/> Modificar</button>
                        )}
                      </div>
                      
                      {modoEdicionPerfil ? (
                        <div className="flex flex-col gap-4 animate-in fade-in">
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Tu Nombre</label>
                            <input type="text" value={editNombreUsuario} onChange={(e) => setEditNombreUsuario(e.target.value)} placeholder="Ej. Juan Pérez" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nombre del Negocio</label>
                            <input type="text" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">WhatsApp de Contacto</label>
                            <input type="tel" value={telefonoNegocio} onChange={(e) => setTelefonoNegocio(e.target.value)} placeholder="Ej. 3001234567" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2"><Mail size={14}/> Correo Registrado (Solo lectura)</label>
                            <input type="email" value={correoNegocio} disabled className="w-full p-5 bg-slate-100 dark:bg-[#020617]/50 border border-slate-200 dark:border-slate-800/50 rounded-2xl text-slate-400 dark:text-slate-500 cursor-not-allowed font-medium text-lg" />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <button onClick={() => setModoEdicionPerfil(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-5 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
                            <button onClick={guardarDatosPerfil} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-lg transition-transform transform active:scale-95 text-lg">Guardar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-6">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tu Nombre</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate">{nombreUsuario}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Negocio</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate">{nombreNegocio}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">WhatsApp</p>
                            <p className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate">{telefonoNegocio || "No registrado"}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
                      <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
                        <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><ShieldAlert size={20} className="shrink-0"/> Seguridad</h3>
                      </div>
                      
                      {mensajePerfil.texto && (
                        <div className={`p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 mb-6 ${mensajePerfil.tipo === 'exito' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
                          {mensajePerfil.tipo === 'exito' ? <CheckCircle2 size={18} className="shrink-0"/> : <AlertCircle size={18} className="shrink-0"/>} {mensajePerfil.texto}
                        </div>
                      )}
                      
                      {!cambiandoPass ? (
                        <button onClick={() => setCambiandoPass(true)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-5 text-lg rounded-2xl transition-colors border dark:border-slate-800/80">Cambiar Contraseña</button>
                      ) : (
                        <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Contraseña Actual</label>
                            <input type="password" value={passwordData.actual} onChange={(e) => { setPasswordData({...passwordData, actual: e.target.value}); setPassErrores({...passErrores, actual: ""}); }} placeholder="Tu contraseña actual" className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg ${passErrores.actual ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400 dark:text-white'}`} />
                            {passErrores.actual && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.actual}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nueva Contraseña</label>
                            <input type="password" value={passwordData.nueva} onChange={(e) => { setPasswordData({...passwordData, nueva: e.target.value}); setPassErrores({...passErrores, nueva: ""}); }} placeholder="Mínimo 6 caracteres" className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg ${passErrores.nueva ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400 dark:text-white'}`} />
                            {passErrores.nueva && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.nueva}</p>}
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Confirmar Nueva Contraseña</label>
                            <input type="password" value={passwordData.confirmar} onChange={(e) => { setPasswordData({...passwordData, confirmar: e.target.value}); setPassErrores({...passErrores, confirmar: ""}); }} placeholder="Repite la nueva contraseña" className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg ${passErrores.confirmar ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400 dark:text-white'}`} />
                            {passErrores.confirmar && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.confirmar}</p>}
                          </div>
                          
                          {passErrores.general && (
                            <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-base font-bold text-center border border-rose-200 dark:border-rose-500/20">
                              {passErrores.general}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <button onClick={() => { setCambiandoPass(false); setPasswordData({actual:"", nueva:"", confirmar:""}); setPassErrores({actual:"", nueva:"", confirmar:"", general:""}); }} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 font-bold py-5 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
                            <button onClick={procesarCambioPassword} className="bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-bold py-5 rounded-2xl transition-colors shadow-md text-lg">Actualizar</button>
                          </div>
                        </div>
                      )}
                    </div>

                    <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-6 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-4 flex justify-center items-center gap-2 text-lg mt-8">
                      <LogOut size={24} className="shrink-0" /> Cerrar Sesión
                    </button>
                  </>
                )}
              </div>
            )}
          </main>

          {/* =========================================================================
              MENÚ INFERIOR (NAVIGATION BAR)
          ========================================================================= */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/60 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100] pb-safe transition-colors duration-500">
            <div className="max-w-4xl mx-auto flex px-2">
              <button onClick={() => setVistaActiva('principal')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'principal' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <HomeIcon size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Inicio</span>
              </button>
              
              {puedeVerReportes && (
                <button onClick={() => setVistaActiva('estadisticas')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'estadisticas' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                  <PieChart size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Reportes</span>
                </button>
              )}
              
              <button onClick={() => setVistaActiva('historial')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'historial' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <Clock size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Historial</span>
              </button>
              <button onClick={() => setVistaActiva('perfil')} className={`flex-1 py-4 flex flex-col items-center gap-1.5 transition-colors ${vistaActiva === 'perfil' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <UserCog size={24} /> <span className="text-[10px] font-black uppercase tracking-widest mt-1">Perfil</span>
              </button>
            </div>
          </nav>
        </>
      )}

      {/* =========================================================================
          TODOS LOS MODALES FLOTANTES EN LA RAÍZ DEL DOM (Z-INDEX 200+)
          ESTO EVITA BUGS DE CLIPPING EN SAFARI E IOS
      ========================================================================= */}

      {/* MODAL CANCELAR PRO */}
      {modalCancelarPro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner mt-4">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¿Cancelar Plan PRO?</h2>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-base mb-6">Perderás acceso inmediato a tus reportes y el límite de clientes y colaboradores volverá al plan básico.</p>
            
            <input type="password" value={passCancelarPro} onChange={e => {setPassCancelarPro(e.target.value); setErrorCancelarPro("")}} placeholder="Ingresa tu contraseña actual" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-rose-500 dark:text-white mb-2 font-bold text-lg" />
            {errorCancelarPro && <p className="text-rose-500 text-sm font-bold mb-4">{errorCancelarPro}</p>}

            <div className="flex gap-4 mt-2">
              <button onClick={() => {setModalCancelarPro(false); setPassCancelarPro(""); setErrorCancelarPro("");}} className="flex-1 bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 text-lg rounded-2xl transition-colors border dark:border-slate-800/80">Volver</button>
              <button onClick={cancelarSuscripcion} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 text-lg rounded-2xl shadow-lg transition-transform active:scale-95">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUSCRIPCIÓN UPSELL */}
      {modalSuscripcion.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in-95 duration-200">
          <div className={`bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border ${exitoPromo ? 'border-emerald-500' : 'border-slate-100 dark:border-slate-800/60'} text-center relative overflow-hidden transition-colors duration-500`}>
            
            {!exitoPromo && <button onClick={() => setModalSuscripcion({ visible: false, titulo: "", mensaje: "" })} className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors z-10"><X size={24}/></button>}
            
            {exitoPromo ? (
              <div className="flex flex-col items-center justify-center py-6 animate-in zoom-in">
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <CheckCircle2 size={50} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">¡Plan PRO Activado!</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Disfruta de Fiabono sin límites por 30 días.</p>
              </div>
            ) : (
              <>
                <div className="absolute top-0 left-0 right-0 bg-blue-600 h-28"></div>
                <div className="relative z-10 mt-8 mb-6">
                  <div className="w-20 h-20 bg-white dark:bg-[#020617] rounded-2xl flex items-center justify-center shadow-xl mx-auto border-4 border-white dark:border-[#0f172a]">
                    <Star size={40} className="text-emerald-500 fill-current" />
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalSuscripcion.titulo || "Desbloquea Fiabono PRO"}</h3>
                <p className="text-base font-medium text-slate-500 dark:text-slate-400 mb-6 whitespace-pre-line">{modalSuscripcion.mensaje || "Tu plan básico ha alcanzado su límite."}</p>
                
                <div className="bg-slate-50 dark:bg-[#020617] p-5 rounded-2xl text-left mb-6 border border-slate-100 dark:border-slate-800/80">
                  <p className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-base">Beneficios Pro:</p>
                  <ul className="flex flex-col gap-3">
                    <li className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400"><CheckCircle2 size={16} className="text-blue-500 shrink-0"/> Clientes Ilimitados</li>
                    <li className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400"><CheckCircle2 size={16} className="text-blue-500 shrink-0"/> Registros Ilimitados diarios</li>
                    <li className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400"><CheckCircle2 size={16} className="text-blue-500 shrink-0"/> Colaboradores Ilimitados</li>
                    <li className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400"><CheckCircle2 size={16} className="text-blue-500 shrink-0"/> Reportes visuales completos</li>
                  </ul>
                </div>

                <div>
                  <input type="text" value={codigoPromo} onChange={e => setCodigoPromo(e.target.value.toUpperCase())} placeholder="Código Promocional" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white mb-2 transition-all font-black text-lg text-center tracking-widest uppercase" />
                  {errorPromo && <p className="text-rose-500 dark:text-rose-400 text-sm font-bold text-center mb-4 flex items-center justify-center gap-1"><AlertCircle size={14}/>{errorPromo}</p>}
                  
                  <button onClick={canjearPromo} disabled={cargandoPromo} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg transition-transform transform active:scale-95 disabled:opacity-50 text-lg">
                    {cargandoPromo ? '...' : 'Canjear y Activar Pro'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DIRECTORIO MODAL DE CLIENTES */}
      {verTodosClientes && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 pt-10 z-[200] overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden relative mb-24 border border-slate-100 dark:border-slate-800/60 flex flex-col max-h-[85vh]">
            <div className="bg-blue-600 dark:bg-blue-900 p-6 sm:p-8 flex justify-between items-center shrink-0 sticky top-0 z-10">
              <h2 className="text-3xl font-black text-white tracking-wide flex items-center gap-2"><Users size={28}/> Directorio</h2>
              <button onClick={() => setVerTodosClientes(false)} className="text-blue-200 hover:text-white transition-colors bg-blue-700/50 dark:bg-blue-800/50 p-2 rounded-full"><X size={28}/></button>
            </div>
            <div className="p-5 sm:p-6 bg-white dark:bg-[#020617] shrink-0 border-b border-slate-100 dark:border-slate-800/80">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input type="text" value={busquedaDirectorio} onChange={(e) => setBusquedaDirectorio(e.target.value)} placeholder="Buscar en el directorio..." className="w-full p-5 pl-14 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/60 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all shadow-sm text-lg" />
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50 dark:bg-[#020617] flex-1">
              {directorioFiltrado.map(c => (
                <div key={c.id} onClick={() => { setClienteActivo(c); cargarMovimientosClienteDirecto(c.id); setVerTodosClientes(false); }} className="p-5 sm:p-6 my-3 mx-1 bg-white dark:bg-[#0f172a] rounded-[1.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm cursor-pointer hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md flex justify-between items-center transition-all gap-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100 truncate">{c.nombre}</p>
                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 truncate">{c.celular || "Sin celular"}</p>
                  </div>
                  <div className="text-right shrink-0 max-w-[50%]">
                    {c.deudaTotal !== 0 && <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{(c.deudaTotal || 0) < 0 ? 'A FAVOR' : 'DEUDA'}</p>}
                    <p className={`font-black text-xl sm:text-3xl tracking-tighter truncate ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : ((c.deudaTotal || 0) < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}`}>
                      {c.deudaTotal === 0 ? '$0' : `$${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}`}
                    </p>
                  </div>
                </div>
              ))}
              
              {directorioFiltrado.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Search size={40} className="opacity-20 mb-2"/>
                  <p className="text-lg">No se encontraron clientes.</p>
                  {busquedaDirectorio && (
                    <button onClick={() => { setNombreNuevo(busquedaDirectorio); setModalNuevoCliente(true); setVerTodosClientes(false); }} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl text-base transition-colors flex items-center justify-center gap-2 mx-auto shadow-md">
                      <UserCog size={20} /> Crear Cliente
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => { setNombreNuevo(""); setModalNuevoCliente(true); setVerTodosClientes(false); }} className="w-full mt-6 bg-transparent border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold py-5 rounded-2xl transition-colors flex justify-center items-center gap-2 text-lg">
                  <UserCog size={20} /> + Crear nuevo cliente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NUEVO CLIENTE MODAL */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[210]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/60 animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><UserCog size={28}/> Registrar Cliente</h3>
            
            <div className="flex flex-col gap-4 mb-8">
              <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" />
              <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
              <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg disabled:opacity-50 transition-colors flex justify-center items-center gap-2 text-lg">Guardar <CheckCircle2 size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AVISOS COLABORADOR */}
      {modalAvisoColaborador.visible && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800/60 relative">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ${modalAvisoColaborador.icono === 'exito' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400' : (modalAvisoColaborador.icono === 'error' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400')}`}>
              {modalAvisoColaborador.icono === 'exito' && <CheckCircle2 size={50} />}
              {modalAvisoColaborador.icono === 'error' && <AlertCircle size={50} />}
              {modalAvisoColaborador.icono === 'info' && <Info size={50} />}
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalAvisoColaborador.titulo}</h2>
            <p className="text-slate-600 dark:text-slate-400 text-base mb-8 font-medium leading-relaxed whitespace-pre-line">{modalAvisoColaborador.mensaje}</p>
            
            <button onClick={() => setModalAvisoColaborador({ visible: false, titulo: "", mensaje: "", icono: 'exito' })} className={`w-full text-white font-black py-5 rounded-2xl transition-colors shadow-lg text-lg ${modalAvisoColaborador.icono === 'exito' ? 'bg-emerald-500 hover:bg-emerald-600' : (modalAvisoColaborador.icono === 'error' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600')}`}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL ÉXITO REGISTROS */}
      {modalExito && modalExito.visible && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[300] animate-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800/60 relative my-auto">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 size={50} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Registro Exitoso!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-base mb-8">Se guardó el {modalExito.accion} de <strong className="text-slate-800 dark:text-slate-200">${modalExito.montoTotal.toLocaleString('es-CO')}</strong> en la cuenta de {modalExito.cliente.nombre}.</p>
            
            {modalExito.cliente.celular && datosUsuario?.rol !== 'cajero' ? (
              <button onClick={() => abrirWhatsApp(generarTextoComprobante('comprobante', modalExito.cliente, modalExito.accion, modalExito.detalles, modalExito.montoTotal), modalExito.cliente.celular)} className="w-full mb-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-5 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center gap-2 text-lg">
                <MessageCircle size={24} /> Notificar por WhatsApp
              </button>
            ) : (
              datosUsuario?.rol !== 'cajero' && (
                <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 p-5 rounded-2xl mb-4 flex flex-col items-center justify-center gap-2 border border-amber-100 dark:border-amber-500/20">
                  <AlertCircle size={28} />
                  <span className="font-bold text-base">Sin WhatsApp registrado</span>
                </div>
              )
            )}
            
            <button onClick={() => setModalExito(null)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 font-bold py-5 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg">
              Cerrar y continuar
            </button>
          </div>
        </div>
      )}

      {/* MODAL SEGURIDAD (EDITAR/ELIMINAR) */}
      {modalSeguridad.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center">Acción Protegida</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 text-center mb-8">Por seguridad, ingresa tu contraseña de Administrador para {modalSeguridad.accion === 'eliminar_cliente' ? 'eliminar este cliente.' : (modalSeguridad.accion === 'eliminar_colaborador' ? 'borrar este acceso de colaborador.' : 'editar este cliente.')}</p>
            
            <input type="password" value={passSeguridad} onChange={e => setPassSeguridad(e.target.value)} placeholder="Tu contraseña actual" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white mb-2 transition-all font-bold text-lg" />
            {errorSeguridad && <p className="text-rose-500 dark:text-rose-400 text-sm font-bold text-center mb-4 flex items-center justify-center gap-1"><AlertCircle size={14}/>{errorSeguridad}</p>}
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => {setModalSeguridad({visible: false, accion: null}); setPassSeguridad(""); setErrorSeguridad("");}} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
              <button onClick={verificarSeguridadYEjecutar} disabled={cargandoSeguridad} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors flex justify-center items-center shadow-md text-lg">{cargandoSeguridad ? '...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* PERFIL DEL CLIENTE E HISTORIAL */}
      {clienteActivo && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center pt-6 sm:p-4 z-[150] transition-opacity">
          <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg shadow-2xl relative flex flex-col h-[90vh] sm:h-[85vh] mb-[4.5rem] sm:mb-0 border border-slate-100 dark:border-slate-800/60 mx-2 sm:mx-0 overflow-hidden">
            
            <div className="p-4 sm:p-5 flex justify-between items-start bg-slate-50 dark:bg-[#020617] rounded-t-[2.5rem] shrink-0">
              <div className="flex gap-2 shrink-0">
                {datosUsuario?.rol !== 'cajero' && (
                  <>
                    <button onClick={() => { 
                      if(!modoEdicionCliente) { setModalSeguridad({ visible: true, accion: 'editar_cliente' }); } 
                      else { setModoEdicionCliente(false); }
                    }} className="bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors border border-slate-200 dark:border-slate-800/80 shadow-sm"><Edit2 size={20}/></button>
                    <button onClick={() => setModalSeguridad({ visible: true, accion: 'eliminar_cliente' })} className="bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-full p-3 font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-transparent dark:border-rose-500/20 shadow-sm"><Trash2 size={20}/></button>
                  </>
                )}
              </div>
              <button onClick={() => setClienteActivo(null)} className="bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors border border-slate-200 dark:border-slate-800/80 ml-1 shadow-sm"><X size={20}/></button>
            </div>

            {modoEdicionCliente ? (
              <div className="p-6 bg-slate-50 dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800/80 shrink-0">
                <input type="text" value={editNombreCliente} onChange={(e) => setEditNombreCliente(e.target.value)} placeholder="Nombre del cliente" className="w-full p-4 mb-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-base font-bold dark:text-white" />
                <input type="tel" value={editCelularCliente} onChange={(e) => setEditCelularCliente(e.target.value)} placeholder="Celular (opcional)" className="w-full p-4 mb-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-base font-bold dark:text-white" />
                <div className="flex gap-2">
                  <button onClick={() => setModoEdicionCliente(false)} className="flex-1 bg-slate-200 dark:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-2.5 rounded-xl text-base">Cancelar</button>
                  <button onClick={actualizarCliente} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-base transition-colors">Guardar</button>
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4 bg-slate-50 dark:bg-[#020617] text-center shrink-0 flex flex-col items-center border-b border-slate-200 dark:border-slate-800/80">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1 truncate w-full">{clienteActivo.nombre}</h2>
                
                {!puedeVerCelulares ? (
                   <p className="text-slate-400 dark:text-slate-500 text-sm font-bold flex items-center justify-center gap-1 mt-0.5"><EyeOff size={16}/> Celular protegido</p>
                ) : (
                  clienteActivo.celular ? <p className="text-slate-500 dark:text-slate-400 font-medium text-base">{clienteActivo.celular}</p> : <p className="text-amber-500 dark:text-amber-400 text-sm font-bold flex items-center justify-center gap-1 mt-0.5"><AlertCircle size={16}/> Sin WhatsApp</p>
                )}
                
                <div className="mt-4 flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] w-full py-3 px-2 rounded-[1.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{clienteActivo.deudaTotal === 0 ? 'CUENTA AL DÍA' : ((clienteActivo.deudaTotal || 0) < 0 ? 'SALDO A FAVOR' : 'SALDO PENDIENTE')}</p>
                  <p className={`text-4xl sm:text-5xl font-black tracking-tighter leading-none break-words w-full ${clienteActivo.deudaTotal === 0 ? 'text-slate-300 dark:text-slate-600' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}`}>${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</p>
                </div>

                <div className="flex gap-4 w-full mt-4">
                  <button onClick={() => { setAccionRegistro('fiado'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="flex-1 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-bold py-3 rounded-2xl border border-rose-200 dark:border-rose-500/20 transition-colors flex justify-center items-center gap-2 shadow-sm text-base"><ShoppingBag size={18}/> Fiar</button>
                  <button onClick={() => { setAccionRegistro('abono'); setClienteTransaccion(clienteActivo); setPasoRegistro(2); setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]); setModalRegistro(true); }} className="flex-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-bold py-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 transition-colors flex justify-center items-center gap-2 shadow-sm text-base"><Banknote size={18}/> Abonar</button>
                </div>
              </div>
            )}

            {!modoEdicionCliente && clienteActivo.celular && datosUsuario?.rol !== 'cajero' && (
              <div className="px-5 py-3 bg-white dark:bg-[#0f172a] shrink-0 border-b border-slate-100 dark:border-slate-800/60 z-10">
                 <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-[#25D366]/10 dark:bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] dark:text-[#25D366] font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 text-base border border-[#25D366]/20">
                  <MessageCircle size={20} /> Enviar estado por WhatsApp
                </button>
              </div>
            )}
            
            <div className="bg-white dark:bg-[#0f172a] p-5 flex-1 min-h-[50vh] overflow-y-auto rounded-b-[2.5rem]">
              <h3 className="font-bold text-slate-400 dark:text-slate-500 uppercase text-xs tracking-wider mb-4 pl-1 flex items-center gap-2"><Clock size={16}/> Historial de Registros</h3>
              <div className="flex flex-col gap-4 pb-8">
                {movimientosCliente.length === 0 ? <p className="text-slate-400 text-center text-base py-6">No hay historial para este cliente.</p> : (
                  movimientosCliente.map(mov => (
                    <div key={mov.id} className="bg-slate-50 dark:bg-[#020617] p-5 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                      <div className="pl-2">
                        {mov.detalles && mov.detalles.length > 0 ? (
                          <div className="flex flex-col gap-3">
                            {mov.detalles.map((d: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center gap-2">
                                <p className="font-medium text-slate-700 dark:text-slate-300 text-base flex items-start gap-2 min-w-0 flex-1">
                                  <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 mt-2"></span>
                                  <span className="truncate">
                                    {d.cantidad && d.cantidad > 1 ? <span className="font-black mr-1 text-blue-500 dark:text-blue-400">{d.cantidad}x</span> : null}
                                    {d.descripcion}
                                    {d.cantidad && d.cantidad > 1 ? <span className="text-sm text-slate-500 block mt-0.5">(${(d.valorUnitario || d.valor/d.cantidad).toLocaleString('es-CO')} c/u)</span> : null}
                                  </span>
                                </p>
                                <p className="font-bold text-base text-slate-600 dark:text-slate-400 shrink-0 text-right">${d.valor.toLocaleString('es-CO')}</p>
                              </div>
                            ))}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-slate-200 dark:border-slate-700 gap-2">
                              <p className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 shrink-0">Total {mov.tipo}</p>
                              <p className={`font-black text-xl sm:text-2xl break-words text-right ${mov.tipo === 'fiado' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center gap-2">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate flex-1 text-base">{mov.descripcion}</p>
                            <p className={`font-black text-xl sm:text-2xl shrink-0 break-words text-right ${mov.tipo === 'fiado' ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}</p>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/50">
                          <div className="flex flex-col gap-1 min-w-0">
                            <p className="text-xs text-slate-400 font-medium tracking-wide truncate">{mov.fecha?.toDate().toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</p>
                            {mov.registradoPor && <p className="text-[10px] bg-slate-200 dark:bg-[#1e293b] text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold self-start truncate max-w-[120px]">Colab: {mov.registradoPor}</p>}
                          </div>
                          {mov.saldoResultante !== undefined && mov.saldoResultante <= 0 && mov.tipo === 'abono' && (
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm shrink-0 ${mov.saldoResultante < 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                              {mov.saldoResultante < 0 ? 'Saldo a favor' : 'Saldada'}
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
        <div className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[250] animate-in zoom-in-95 duration-200 px-2 sm:px-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] border border-slate-100 dark:border-slate-800/60 overflow-hidden">
            
            <div className={`p-6 text-white flex justify-between items-center shrink-0 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-800' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800'}`}>
              <h2 className="text-2xl font-black uppercase tracking-wide flex items-center gap-2">
                {accionRegistro === 'fiado' ? <ShoppingBag size={28}/> : <Banknote size={28}/>} 
                {accionRegistro === 'fiado' ? 'Registrar Fiado' : 'Registrar Abono'}
              </h2>
              <button onClick={() => setModalRegistro(false)} className="text-white hover:text-white/70 bg-white/10 rounded-full w-12 h-12 flex items-center justify-center transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden relative">
              {pasoRegistro === 1 && (
                <div className="p-5 sm:p-8 overflow-y-auto h-full bg-white dark:bg-[#0f172a]">
                  <p className="font-bold text-slate-600 dark:text-slate-300 mb-5 text-lg">¿A qué cliente se le aplicará?</p>
                  <div className="relative mb-6">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente..." className="w-full p-5 pl-14 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all text-lg" />
                  </div>
                  <div className="flex flex-col gap-3 pb-10">
                    {clientesFiltrados.map(c => (
                      <div key={c.id} onClick={() => { setClienteTransaccion(c); setPasoRegistro(2); setBusqueda(""); }} className="p-5 bg-white dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 rounded-2xl hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer flex justify-between items-center transition-colors">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-lg flex items-center gap-2"><ChevronRight size={20} className="text-slate-500"/> {c.nombre}</span>
                      </div>
                    ))}
                    {clientesFiltrados.length === 0 && <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="w-full bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-300 font-bold py-5 rounded-2xl hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors flex justify-center items-center gap-2 border dark:border-slate-800/80 text-lg"><UserCog size={20}/> Crear "{busqueda}" como nuevo</button>}
                  </div>
                </div>
              )}

              {pasoRegistro === 2 && clienteTransaccion && (
                <>
                  <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-[#0f172a]">
                    <div className="bg-slate-50 dark:bg-[#020617] p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex justify-between items-center mb-5">
                      <span className="text-base text-slate-500 dark:text-slate-400 shrink-0">Cliente:</span>
                      <span className="font-black text-slate-900 dark:text-white whitespace-normal break-words text-right ml-4 text-xl">{clienteTransaccion.nombre}</span>
                    </div>
                    <div className="flex flex-col gap-4 pb-4">
                      {filasRegistro.map((fila, index) => (
                        <div key={index} className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm relative">
                          {filasRegistro.length > 1 && (
                            <button onClick={() => eliminarFila(index)} className="absolute -top-3 -right-3 bg-rose-100 dark:bg-rose-900/80 text-rose-500 dark:text-rose-300 rounded-full p-2 shadow-md"><X size={18}/></button>
                          )}
                          <input type="text" value={fila.descripcion} onChange={(e) => actualizarFila(index, 'descripcion', e.target.value)} placeholder={accionRegistro === 'fiado' ? "Descripción del artículo" : "Descripción del abono"} className="w-full p-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all text-base font-bold" />
                          <div className="flex gap-2 sm:gap-3 items-center w-full">
                            {accionRegistro === 'fiado' && (
                              <div className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shrink-0 h-[56px] w-[110px]">
                                <button onClick={() => actualizarCantidadFila(index, -1)} className="px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-colors text-slate-500"><Minus size={20}/></button>
                                <span className="flex-1 text-center font-black text-slate-800 dark:text-white text-lg">{fila.cantidad}</span>
                                <button onClick={() => actualizarCantidadFila(index, 1)} className="px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-colors text-slate-500"><Plus size={20}/></button>
                              </div>
                            )}
                            {accionRegistro === 'fiado' && <span className="text-slate-400 font-bold shrink-0 text-base">x</span>}
                            
                            <div className="relative flex-1 min-w-0">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
                              <input 
                                type="text" 
                                inputMode="numeric"
                                value={formatearMonedaInput(fila.valor)} 
                                onChange={(e) => actualizarFila(index, 'valor', e.target.value)} 
                                placeholder={accionRegistro === 'fiado' ? "Valor Uni." : "Valor"} 
                                className="w-full pl-9 pr-4 py-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-black text-slate-900 dark:text-white transition-all h-[56px] min-w-0 text-xl" 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div ref={finalListaRef} className="h-1"></div>
                      
                      <button onClick={agregarFila} className="text-base font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-6 py-4 rounded-xl self-start transition-colors flex items-center gap-2 border dark:border-blue-500/20"><Plus size={20}/> Añadir fila</button>
                    </div>
                  </div>
                  
                  <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800/60 shrink-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                    <div className="flex justify-between items-center gap-2 p-4 bg-slate-900 dark:bg-black text-white rounded-2xl mb-4 shadow-inner border border-slate-800">
                      <span className="font-medium text-slate-300 text-lg shrink-0">Total a registrar:</span>
                      <span className={`text-3xl sm:text-4xl font-black tracking-tight break-words text-right ${accionRegistro === 'fiado' ? 'text-rose-400' : 'text-emerald-400'}`}>${totalFilasRegistro.toLocaleString('es-CO')}</span>
                    </div>
                    <button onClick={procesarRegistro} className={`w-full text-white font-black text-2xl py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center gap-2 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-rose-700' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 hover:from-emerald-600 hover:to-emerald-700'}`}>
                      {accionRegistro === 'fiado' ? 'Confirmar Fiado' : 'Confirmar Abono'} <CheckCircle2 size={28}/>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}