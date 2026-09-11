"use client";
import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from "firebase/auth";
import { doc, getDoc, getDocFromServer, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { 
  CheckCircle2, ChevronRight, Star, BookX, PenTool, 
  MessageCircle, ShieldAlert, Store, Wallet, Shirt, Lock, 
  AlertCircle, X, Eye, EyeOff, Sparkles, Crown, Printer, 
  QrCode, FileSpreadsheet, Users, ArrowRight, Zap, 
  Smartphone, ShieldCheck, HelpCircle, ChevronDown, ChevronUp,
  Receipt, ShoppingBag, BarChart3, Clock, TrendingUp,
  Flame, BadgePercent, Check, ArrowUpRight, Calculator,
  Sparkle, Shield, PartyPopper, Briefcase, Building2, Phone, Bookmark, Menu,
  Tag, Gift, Banknote, CreditCard, ShoppingCart, User, Mail
} from 'lucide-react';
import LogoFiabono, { IsotipoFiabono } from "@/components/LogoFiabono";

export default function LandingPage() {
  const [modalLandingInfo, setModalLandingInfo] = useState<{ visible: boolean, tipo: 'login' | 'registro' | null }>({ visible: false, tipo: null });
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", nombreUsuario: "", negocio: "" });
  const [authErrores, setAuthErrores] = useState({ email: "", password: "", confirmPassword: "", general: "" });
  const [cicloFacturacion, setCicloFacturacion] = useState<'mensual' | 'anual'>('mensual');
  const [planSeleccionadoRegistro, setPlanSeleccionadoRegistro] = useState<'gratis' | 'comercio' | 'pro'>('gratis');
  
  // Visibilidad de contraseñas
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaTerminosGoogle, setAceptaTerminosGoogle] = useState(false);

  // Menú móvil abierto/cerrado
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  // Estados para Onboarding Elegante de Google
  const [googleUserPendiente, setGoogleUserPendiente] = useState<{ uid: string; email: string; nombre: string; foto?: string } | null>(null);
  const [modalGoogleOnboarding, setModalGoogleOnboarding] = useState(false);
  const [pasoGoogleOnboarding, setPasoGoogleOnboarding] = useState<1 | 2>(1);
  const [formGoogleOnboarding, setFormGoogleOnboarding] = useState({
    nombreUsuario: "",
    nombreNegocio: "",
    tipoNegocio: "Moda y Calzado",
    telefonoNegocio: "",
    moduloSepare: true,
    plan: 'comercio' as 'gratis' | 'comercio' | 'pro'
  });
  const [guardandoGoogleOnboarding, setGuardandoGoogleOnboarding] = useState(false);
  const [errorGoogleOnboarding, setErrorGoogleOnboarding] = useState("");

  // Tab de Mockup Interactivo
  const [tabMockup, setTabMockup] = useState<'pos' | 'whatsapp' | 'factura' | 'separe' | 'caja'>('pos');

  // Tab de Nichos de Mercado
  const [tabNicho, setTabNicho] = useState<'tienda' | 'moda' | 'ferreteria' | 'belleza'>('moda');

  // Calculadora Interactiva de Pérdidas y Tiempo
  const [ventasDia, setVentasDia] = useState<number>(40);
  const [dineroFiado, setDineroFiado] = useState<number>(3000000);
  const [horasCuentas, setHorasCuentas] = useState<number>(6);

  // Acordeón de FAQ
  const [faqAbierto, setFaqAbierto] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setFaqAbierto(faqAbierto === index ? null : index);
  };

  // Modal para Términos y Privacidad
  const [modalLegal, setModalLegal] = useState<{ visible: boolean; titulo: string; tipo: 'terminos' | 'privacidad' | null }>({ visible: false, titulo: "", tipo: null });

  // Estados para Código de Suscripción / Promocional
  const [codigoInput, setCodigoInput] = useState("");
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");
  const [exitoCodigo, setExitoCodigo] = useState("");
  const [codigoAplicado, setCodigoAplicado] = useState<{
    codigo: string;
    planOtorgado: 'gratis' | 'comercio' | 'pro';
    diasOtorgados: number;
    unSoloUso: boolean;
  } | null>(null);

  const validarCodigo = async (codigoParam?: string, emailParaValidar?: string) => {
    const cod = (codigoParam || codigoInput).trim().toUpperCase();
    setErrorCodigo("");
    setExitoCodigo("");

    if (!cod) {
      setErrorCodigo("Por favor escribe un código.");
      return;
    }

    setValidandoCodigo(true);
    try {
      const snap = await getDoc(doc(db, "codigos_promocionales", cod));
      if (!snap.exists()) {
        setErrorCodigo("El código ingresado no existe o no es válido.");
        setCodigoAplicado(null);
        return;
      }

      const data = snap.data();
      if (!data.activo) {
        setErrorCodigo("Este código ya fue utilizado o no se encuentra activo.");
        setCodigoAplicado(null);
        return;
      }

      const emailCheck = emailParaValidar || authForm.email || (googleUserPendiente?.email ?? "");
      if (data.emailObjetivo && data.emailObjetivo.trim() !== "") {
        if (!emailCheck || data.emailObjetivo.trim().toLowerCase() !== emailCheck.trim().toLowerCase()) {
          setErrorCodigo(`Este código es exclusivo para la cuenta ${data.emailObjetivo}`);
          setCodigoAplicado(null);
          return;
        }
      }

      const planOtorgado: 'gratis' | 'comercio' | 'pro' = data.planOtorgado || 'pro';
      const diasOtorgados = typeof data.diasOtorgados === 'number' ? data.diasOtorgados : 30;
      const unSoloUso = data.unSoloUso !== false;

      setCodigoAplicado({
        codigo: cod,
        planOtorgado,
        diasOtorgados,
        unSoloUso
      });
      setPlanSeleccionadoRegistro(planOtorgado);
      setFormGoogleOnboarding(prev => ({ ...prev, plan: planOtorgado }));
      setExitoCodigo(`¡Código activado! Te otorga Plan ${planOtorgado.toUpperCase()} por ${diasOtorgados} días.`);
    } catch (err) {
      console.error("Error al validar código promocional:", err);
      setErrorCodigo("Error al verificar el código. Intenta de nuevo.");
      setCodigoAplicado(null);
    } finally {
      setValidandoCodigo(false);
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
      if (!aceptaTerminos) { setAuthErrores(p => ({...p, general: "Debes aceptar los Términos del Servicio y la Política de Privacidad para crear tu cuenta."})); hayError = true; }
      if (hayError) return;

      try {
        const credencial = await createUserWithEmailAndPassword(auth, loginEmail, authForm.password);
        
        let planFinal = codigoAplicado ? codigoAplicado.planOtorgado : planSeleccionadoRegistro;
        let diasOtorgados = codigoAplicado ? codigoAplicado.diasOtorgados : (planFinal !== 'gratis' ? 14 : null);
        let fechaVence: Date | null = null;
        if (diasOtorgados) {
          const d = new Date();
          d.setDate(d.getDate() + diasOtorgados);
          fechaVence = d;
        }

        await setDoc(doc(db, "usuarios", credencial.user.uid), { 
          nombreUsuario: authForm.nombreUsuario.trim(),
          nombreNegocio: authForm.negocio.trim(), 
          email: loginEmail, 
          telefonoNegocio: "",
          rol: "admin",
          plan: planFinal,
          planVence: fechaVence,
          cicloPlan: cicloFacturacion,
          terminosAceptados: true,
          fechaAceptacionTerminos: new Date(),
          fechaRegistro: new Date(),
          ...(codigoAplicado ? { codigoPromocionalUsado: codigoAplicado.codigo } : {})
        });

        if (codigoAplicado && codigoAplicado.unSoloUso) {
          try {
            await updateDoc(doc(db, "codigos_promocionales", codigoAplicado.codigo), {
              activo: false,
              usadoPor: credencial.user.uid,
              fechaUso: new Date()
            });
          } catch (e) {
            console.error("Error al desactivar código promocional:", e);
          }
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('fiabono_mostrar_tour', 'true');
        }
        cerrarModal();
      } catch (error: any) { 
        if (error.code === 'auth/email-already-in-use') setAuthErrores(p => ({...p, email: "Este correo ya está registrado."}));
        else if (error.code === 'auth/invalid-email') setAuthErrores(p => ({...p, email: "El formato del correo no es válido."}));
        else setAuthErrores(p => ({...p, general: "Ocurrió un error. Intenta de nuevo."}));
      }
    } else {
      if (!loginEmail || !authForm.password) { setAuthErrores(p => ({...p, general: "Llena todos los campos"})); return; }
      try {
        await signInWithEmailAndPassword(auth, loginEmail, authForm.password);
        cerrarModal();
      } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          setAuthErrores(p => ({...p, general: "El correo o la contraseña son incorrectos."}));
        } else {
          setAuthErrores(p => ({...p, general: "Error al iniciar sesión. Verifica tus datos."}));
        }
      }
    }
  };

  const procesarUsuarioGoogle = async (user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => {
    const userDocRef = doc(db, "usuarios", user.uid);
    let userDocSnap;
    try {
      let ultimoError: unknown;
      for (let intento = 0; intento < 3; intento += 1) {
        try {
          userDocSnap = await getDocFromServer(userDocRef);
          break;
        } catch (error) {
          ultimoError = error;
          if (intento < 2) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (!userDocSnap) throw ultimoError;
    } catch (error: any) {
      console.error("Google autenticó al usuario, pero Firestore no respondió:", error);
      setAuthErrores(p => ({
        ...p,
        general: `Google autenticó tu cuenta, pero no se pudo consultar tu perfil en Fiabono (${error.message || error.code || 'Error de base de datos'}). Intenta de nuevo en unos minutos.`
      }));
      return;
    }

    if (!userDocSnap.exists()) {
      const nombreSugerido = user.displayName || "";

      setGoogleUserPendiente({
        uid: user.uid,
        email: user.email || "",
        nombre: nombreSugerido,
        foto: user.photoURL || undefined
      });

      setFormGoogleOnboarding({
        nombreUsuario: nombreSugerido,
        nombreNegocio: "",
        tipoNegocio: "Moda y Calzado",
        telefonoNegocio: "",
        moduloSepare: true,
        plan: codigoAplicado ? codigoAplicado.planOtorgado : (planSeleccionadoRegistro || 'comercio')
      });
      setPasoGoogleOnboarding(1);
      setErrorGoogleOnboarding("");
      cerrarModal();
      setModalGoogleOnboarding(true);
    } else {
      cerrarModal();
    }
  };

  React.useEffect(() => {
    let cancelado = false;

    getRedirectResult(auth).then(resultado => {
      if (!cancelado && resultado?.user) {
        procesarUsuarioGoogle(resultado.user);
      }
    }).catch((error: any) => {
      if (cancelado) return;
      console.error("Error al recuperar autenticación de Google:", error);
      setAuthErrores(p => ({ ...p, general: `No se pudo acceder con Google (${error.code || error.message || 'Error'}). Intenta de nuevo o ingresa con correo.` }));
    });

    return () => { cancelado = true; };
  }, []);

  const iniciarConGoogle = async () => {
    setAuthErrores({ email: "", password: "", confirmPassword: "", general: "" });
    setCargandoGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const esMovilOTablet = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (esMovilOTablet) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const resultado = await signInWithPopup(auth, provider);
      await procesarUsuarioGoogle(resultado.user);
    } catch (error: any) {
      console.error("Error al autenticar con Google:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // Ventana cerrada voluntariamente por el usuario
        return;
      } else if (error.code === 'auth/unauthorized-domain') {
        const dominio = typeof window !== 'undefined' ? window.location.hostname : 'este dominio';
        setAuthErrores(p => ({ 
          ...p, 
          general: `El dominio "${dominio}" no está autorizado en Firebase. Agrégalo en la consola de Firebase: Authentication > Configuración > Dominios autorizados.` 
        }));
      } else if (error.code === 'auth/popup-blocked') {
        setAuthErrores(p => ({ 
          ...p, 
          general: "El navegador bloqueó la ventana emergente de Google. Habilita las ventanas emergentes o inicia sesión con correo y contraseña." 
        }));
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthErrores(p => ({ ...p, general: "El inicio con Google debe ser habilitado en la consola de Firebase (Authentication > Sign-in method)." }));
      } else {
        setAuthErrores(p => ({ ...p, general: `No se pudo acceder con Google (${error.code || error.message || 'Error'}). Intenta de nuevo o ingresa con correo.` }));
      }
    } finally {
      setCargandoGoogle(false);
    }
  };

  const completarOnboardingGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUserPendiente) return;
    setErrorGoogleOnboarding("");

    if (!formGoogleOnboarding.nombreNegocio.trim()) {
      setErrorGoogleOnboarding("Por favor ingresa el nombre de tu negocio.");
      return;
    }

    if (!formGoogleOnboarding.telefonoNegocio.trim()) {
      setErrorGoogleOnboarding("El número de WhatsApp es obligatorio para activar el envío de comprobantes y recordatorios.");
      return;
    }

    if (!aceptaTerminosGoogle) {
      setErrorGoogleOnboarding("Debes aceptar los Términos del Servicio y la Política de Privacidad para crear tu tienda.");
      return;
    }

    setGuardandoGoogleOnboarding(true);
    try {
      let planFinal = codigoAplicado ? codigoAplicado.planOtorgado : formGoogleOnboarding.plan;
      let diasOtorgados = codigoAplicado ? codigoAplicado.diasOtorgados : (planFinal !== 'gratis' ? 14 : null);
      let fechaVence: Date | null = null;
      if (diasOtorgados) {
        const d = new Date();
        d.setDate(d.getDate() + diasOtorgados);
        fechaVence = d;
      }

      const userDocRef = doc(db, "usuarios", googleUserPendiente.uid);
      await setDoc(userDocRef, {
        nombreUsuario: formGoogleOnboarding.nombreUsuario.trim() || (googleUserPendiente.nombre || "Comerciante"),
        nombreNegocio: formGoogleOnboarding.nombreNegocio.trim(),
        tipoNegocio: formGoogleOnboarding.tipoNegocio,
        moduloSepareActivo: formGoogleOnboarding.moduloSepare,
        email: googleUserPendiente.email,
        telefonoNegocio: formGoogleOnboarding.telefonoNegocio.trim(),
        rol: "admin",
        plan: planFinal,
        planVence: fechaVence,
        cicloPlan: cicloFacturacion,
        creadoCon: "google",
        terminosAceptados: true,
        fechaAceptacionTerminos: new Date(),
        fechaRegistro: new Date(),
        ...(codigoAplicado ? { codigoPromocionalUsado: codigoAplicado.codigo } : {})
      });

      if (codigoAplicado && codigoAplicado.unSoloUso) {
        try {
          await updateDoc(doc(db, "codigos_promocionales", codigoAplicado.codigo), {
            activo: false,
            usadoPor: googleUserPendiente.uid,
            fechaUso: new Date()
          });
        } catch (e) {
          console.error("Error al desactivar código promocional en Google:", e);
        }
      }

      setModalGoogleOnboarding(false);
      setGoogleUserPendiente(null);
      // Marcamos para que el dashboard de inicio le muestre el tour de bienvenida al llegar
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_mostrar_tour', 'true');
      }
      // Redirigir de inmediato al dashboard
      window.location.href = "/dashboard/inicio";
    } catch (err: any) {
      console.error("Error guardando negocio Google:", err);
      setErrorGoogleOnboarding("Ocurrió un error al crear tu negocio. Intenta nuevamente.");
    } finally {
      setGuardandoGoogleOnboarding(false);
    }
  };

  const cancelarGoogleOnboarding = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
    setModalGoogleOnboarding(false);
    setGoogleUserPendiente(null);
    setErrorGoogleOnboarding("");
  };

  const cerrarModal = () => {
    setModalLandingInfo({ visible: false, tipo: null });
    setMostrarPassword(false);
    setMostrarConfirmPassword(false);
  };

  const abrirRegistroConPlan = (plan: 'gratis' | 'comercio' | 'pro') => {
    setPlanSeleccionadoRegistro(plan);
    setModalLandingInfo({ visible: true, tipo: 'registro' });
  };

  // Cálculos dinámicos de ahorro para el usuario
  const dineroRecuperadoMes = Math.round(dineroFiado * 0.08 + (ventasDia * 30 * 250));
  const horasAhorradasMes = Math.round(horasCuentas * 4);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* 1. TOP ANNOUNCEMENT BANNER */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white text-[11px] sm:text-xs font-black py-2 px-4 text-center flex items-center justify-center gap-2">
        <span>🇨🇴 El software POS colombiano para tiendas de barrio, almacenes de ropa y negocios</span>
        <span className="hidden sm:inline-block bg-white/20 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">14 días de prueba gratis</span>
      </div>

      {/* 2. HEADER NAVEGACIÓN GLASSOVERLAY */}
      <header className="sticky top-0 bg-white/85 dark:bg-[#0f172a]/85 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 z-[500] px-3 sm:px-8 py-2.5 sm:py-3.5 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => { setMenuMovilAbierto(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <LogoFiabono size={34} showText={true} showBadge={true} />
          </div>
          
          <nav className="hidden md:flex items-center gap-7 text-xs lg:text-sm font-bold text-slate-600 dark:text-slate-300">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Inicio</button>
            <button onClick={() => document.getElementById('comparativa')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Cuaderno vs POS</button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Funciones</button>
            <button onClick={() => document.getElementById('calculadora')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Calculadora</button>
            <button onClick={() => document.getElementById('nichos')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Tu Negocio</button>
            <button onClick={() => document.getElementById('planes')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Planes</button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer">Preguntas</button>
          </nav>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <button 
              type="button" 
              onClick={() => { setMenuMovilAbierto(false); setModalLandingInfo({ visible: true, tipo: 'login' }); }} 
              className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer"
            >
              <span className="hidden sm:inline">Iniciar Sesión</span>
              <span className="sm:hidden">Ingresar</span>
            </button>
            <button 
              type="button" 
              onClick={() => { setMenuMovilAbierto(false); abrirRegistroConPlan('gratis'); }} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-black py-1.5 sm:py-2.5 px-2.5 sm:px-5 rounded-xl shadow-md shadow-emerald-600/25 transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <span className="hidden sm:inline">Empezar Gratis</span>
              <span className="sm:hidden">Registro</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              className="md:hidden p-1.5 sm:p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Abrir menú"
            >
              {menuMovilAbierto ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* MENÚ MÓVIL DESPLEGABLE */}
        {menuMovilAbierto && (
          <div className="md:hidden border-t border-slate-200/80 dark:border-slate-800/80 mt-3 pt-3 pb-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {[
              { label: 'Inicio', target: 'top' },
              { label: 'Cuaderno vs POS', target: 'comparativa' },
              { label: 'Funciones Reales', target: 'features' },
              { label: 'Calculadora de Ahorro', target: 'calculadora' },
              { label: 'Casos por Tipo de Negocio', target: 'nichos' },
              { label: 'Planes y Precios', target: 'planes' },
              { label: 'Preguntas Frecuentes', target: 'faq' },
            ].map((item) => (
              <button
                key={item.target}
                onClick={() => {
                  setMenuMovilAbierto(false);
                  if (item.target === 'top') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => { setMenuMovilAbierto(false); setModalLandingInfo({ visible: true, tipo: 'login' }); }}
                className="w-full text-center py-2.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
              >
                Iniciar Sesión
              </button>
              <button
                onClick={() => { setMenuMovilAbierto(false); abrirRegistroConPlan('gratis'); }}
                className="w-full text-center py-2.5 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
              >
                Crear Cuenta Gratis
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION DE ALTO IMPACTO EMOCIONAL */}
      <section className="pt-14 sm:pt-20 pb-16 px-4 sm:px-6 max-w-7xl mx-auto relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/15 to-blue-500/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge superior SEO */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-widest mb-6 border border-emerald-200/60 dark:border-emerald-500/20 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Store size={14} className="text-emerald-600" /> Software POS para Tiendas, Tiendas de Barrio & Almacenes
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1] sm:leading-[1.06]">
            Deja de perder plata en cuadernos y cuentas <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500">embolatadas</span>.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-6 font-medium leading-relaxed">
            El sistema POS colombiano más fácil para <strong>tiendas de barrio, minimarkets y almacenes de ropa</strong>. Vende rápido, controla el cupo de fiado por WhatsApp y aparta mercancía con <strong>Plan Separe con foto</strong> sin enredos.
          </p>

          {/* Chips Interactivos de Nicho en el Hero (Quick Discovery) */}
          <div className="w-full max-w-3xl mx-auto mb-8">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              Ideal para tu tipo de negocio:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: '🏪 Tiendas de Barrio', id: 'tienda' },
                { label: '👗 Almacenes de Ropa & Calzado', id: 'moda' },
                { label: '🔩 Ferreterías & Papelerías', id: 'ferreteria' },
                { label: '💄 Cosméticos & Catálogo', id: 'belleza' },
                { label: '🎁 Misceláneas & Variedades', id: 'tienda' }
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTabNicho(chip.id as any);
                    document.getElementById('nichos')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-white dark:bg-[#0f172a] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition-all shadow-sm cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('gratis')} 
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-base sm:text-lg font-black py-4 px-8 rounded-2xl shadow-xl shadow-emerald-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🚀 Crear mi Cuenta Gratis</span>
              <ArrowRight size={20}/>
            </button>
            <button 
              type="button" 
              onClick={() => document.getElementById('comparativa')?.scrollIntoView({behavior: 'smooth'})} 
              className="w-full sm:w-auto bg-white dark:bg-[#0f172a] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white text-base sm:text-lg font-bold py-4 px-7 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              Ver cómo funciona vs Cuaderno
            </button>
          </div>

          {/* Trust Bar Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-200/50">
              <CheckCircle2 size={15} className="text-emerald-500" /> Sin tarjeta de crédito
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Smartphone size={15} className="text-emerald-600" /> Web + App móvil ligera (sin gastar memoria)
            </div>
            <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full border border-purple-200/50">
              <ShieldCheck size={15} className="text-purple-500" /> Cuentas seguras en la nube
            </div>
          </div>
        </div>

        {/* 4. MOCKUP INTERACTIVO MULTIVISTA (100% FIEL A LA APLICACIÓN REAL) */}
        <div className="mt-14 max-w-5xl mx-auto bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-7 shadow-2xl relative overflow-hidden">
          
          {/* Selector de Pestañas de Vista Previa (Sin cortes de scroll) */}
          <div className="flex flex-wrap items-center justify-center gap-2 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            {[
              { id: 'pos', nombre: 'Punto de Venta POS', icono: ShoppingBag },
              { id: 'whatsapp', nombre: 'Recibo WhatsApp con Link', icono: MessageCircle },
              { id: 'factura', nombre: 'Tirilla Térmica con Logo', icono: Printer },
              { id: 'separe', nombre: 'Ficha Plan Separe', icono: Shirt },
              { id: 'caja', nombre: 'Caja & Reportes Reales', icono: BarChart3 },
            ].map(tab => {
              const Icon = tab.icono;
              const activo = tabMockup === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabMockup(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                    activo 
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-500/20' 
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.nombre}</span>
                </button>
              );
            })}
          </div>

          {/* 1. VISTA PUNTO DE VENTA (IDÉNTICO A APP REAL /dashboard/vender) */}
          {tabMockup === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-7 bg-white dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden text-left">
                {/* Cabecera real de Fiabono Vender */}
                <div className="bg-emerald-600 text-white p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2 font-black">
                    <ShoppingCart size={16}/>
                    <span className="uppercase tracking-wider">VENDER</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-bold">
                    <User size={12}/>
                    <span>Vendedor: Administrador</span>
                  </div>
                </div>

                {/* Barra de Pestañas Multi-venta */}
                <div className="bg-emerald-700/80 px-3 py-1.5 flex gap-2 text-xs border-b border-emerald-800/40">
                  <div className="bg-white text-slate-900 px-3 py-1 rounded-lg font-black text-[11px] flex items-center gap-1.5 shadow-sm">
                    <ShoppingCart size={12} className="text-emerald-600"/>
                    <span>Venta #1</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1 py-0.2 rounded font-black">$110.000</span>
                  </div>
                  <div className="bg-emerald-800/50 text-white/80 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                    + Nueva Venta
                  </div>
                </div>

                {/* Filas de la Venta */}
                <div className="p-3.5 space-y-2.5 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-white truncate">Vestido Lino Estampado</p>
                      <p className="text-[10px] text-emerald-600 font-bold">✓ 1 unidad x $65.000</p>
                    </div>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-sm">$65.000</span>
                  </div>

                  <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-white truncate">Sandalias Plataforma #37</p>
                      <p className="text-[10px] text-emerald-600 font-bold">✓ 1 unidad x $45.000</p>
                    </div>
                    <span className="font-mono font-black text-slate-900 dark:text-white text-sm">$45.000</span>
                  </div>

                  {/* Selector real de forma de pago de Fiabono */}
                  <div className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Forma de Pago</span>
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-black text-center">
                      <div className="bg-emerald-600 text-white py-1.5 rounded-lg flex flex-col items-center gap-0.5 shadow-xs">
                        <Banknote size={12}/> Efectivo
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border border-slate-200 dark:border-slate-700">
                        <Smartphone size={12}/> Transf.
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border border-slate-200 dark:border-slate-700">
                        <CreditCard size={12}/> Datáfono
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 py-1.5 rounded-lg flex flex-col items-center gap-0.5 border border-slate-200 dark:border-slate-700">
                        <Zap size={12}/> Crédito
                      </div>
                    </div>

                    {/* Dinero recibido + botón Exacto de Fiabono */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold">$ Dinero recibido:</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white">120.000</span>
                      </div>
                      <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] px-2 py-1.5 rounded-lg">
                        Devuelta: $10.000
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer real con botón Vender */}
                <div className="bg-slate-900 text-white p-3 flex items-center justify-between border-t border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total a Cobrar</span>
                    <span className="text-xl font-black text-white">$110.000</span>
                  </div>
                  <div className="bg-emerald-500 text-white font-black text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg">
                    <span>Vender</span>
                    <CheckCircle2 size={16}/>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-3 text-left">
                <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">Flujo de mostrador rápido</span>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Así de simple cobras en tu mostrador</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Buscas productos por nombre o escaneas con la cámara del celular. Eliges si pagan en <strong>Efectivo, Transferencia (Nequi/Daviplata) o Datáfono</strong>, anotas cuánto te dieron y el sistema calcula la devuelta en tiempo real.
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  ✓ Si el cliente no paga completo, el sistema convierte automáticamente el saldo en fiado a su cuenta.
                </div>
              </div>
            </div>
          )}

          {/* 2. VISTA WHATSAPP REAL (CON BURBUJA DE CHAT, HORA Y LINK DIGITAL) */}
          {tabMockup === 'whatsapp' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-7 flex justify-center">
                {/* Marco de Teléfono WhatsApp */}
                <div className="w-full max-w-sm bg-[#EFEAE2] dark:bg-[#0b141a] rounded-[2rem] border-4 border-slate-800 shadow-2xl overflow-hidden text-left font-sans">
                  {/* Barra superior de WhatsApp */}
                  <div className="bg-[#075E54] text-white p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-xs text-white">
                        M
                      </div>
                      <div>
                        <p className="font-bold text-xs leading-tight">Moda & Estilo Boutique</p>
                        <p className="text-[10px] text-emerald-200">en línea</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">WhatsApp</span>
                  </div>

                  {/* Área del Chat con Burbuja de Comprobante */}
                  <div className="p-3.5 space-y-3 min-h-[290px] flex flex-col justify-end text-xs">
                    <div className="bg-white dark:bg-[#1f2c34] text-slate-800 dark:text-slate-100 p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-200/60 dark:border-transparent space-y-1.5 text-[11px] leading-relaxed max-w-[95%]">
                      <p className="font-bold text-[#075E54] dark:text-emerald-400">
                        ¡Hola, *Camila Torres*! Gracias por tu compra en *Moda & Estilo Boutique*.
                      </p>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-1 text-[10px] space-y-0.5 text-slate-600 dark:text-slate-300">
                        <p className="font-black text-slate-800 dark:text-white uppercase">🛒 COMPROBANTE DE VENTA #0142</p>
                        <p>• 1x Vestido Lino Estampado — $65.000</p>
                        <p>• 1x Sandalias Plataforma #37 — $45.000</p>
                        <p className="font-bold text-slate-900 dark:text-white pt-0.5 border-t border-dashed border-slate-200 dark:border-slate-700">
                          *TOTAL PAGADO:* $110.000 (Efectivo)
                        </p>
                      </div>

                      {/* Tarjeta con el Link Real de Fiabono */}
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-[#111b21] rounded-xl border border-slate-200 dark:border-slate-700/80">
                        <p className="text-[10px] font-bold text-slate-500">Ver o descargar comprobante digital:</p>
                        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 underline break-all block">
                          fiabono.com/t/mov_8a7f92
                        </span>
                        <p className="text-[9px] text-slate-400 mt-0.5">Factura digital 24/7 verificada</p>
                      </div>

                      <div className="flex justify-end items-center gap-1 text-[9px] text-slate-400 pt-0.5">
                        <span>10:42 AM</span>
                        <span className="text-blue-500 font-bold">✓✓</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-3 text-left">
                <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">El recibo que tus clientes aman</span>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Envío directo al WhatsApp de tu cliente</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Al terminar una venta o abonar una deuda, tocas <strong>"Enviar a WhatsApp"</strong> y se abre el chat de tu cliente con el recibo listo. Incluye el enlace digital seguro donde tu cliente puede descargar la factura en foto en cualquier momento.
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  📱 Funciona tanto para ventas de contado como para comprobantes de fiados y abonos.
                </div>
              </div>
            </div>
          )}

          {/* 3. VISTA TIRILLA TÉRMICA REAL CON LOGO Y DATOS */}
          {tabMockup === 'factura' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-7 flex justify-center">
                <div className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-300 shadow-xl font-mono text-[11px] space-y-2 w-full max-w-xs text-left">
                  {/* Encabezado con Logo y Datos */}
                  <div className="text-center pb-2 border-b border-dashed border-slate-300">
                    <div className="w-10 h-10 mx-auto bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm mb-1">
                      M&E
                    </div>
                    <p className="font-black text-xs tracking-wider">MODA & ESTILO BOUTIQUE</p>
                    <p className="text-[10px] text-slate-500">NIT: 901.345.678-1</p>
                    <p className="text-[9px] text-slate-500">Cra 15 # 45-20 • Tel: 312 456 7890</p>
                    <div className="mt-1.5 pt-1 border-t border-slate-200 flex justify-between text-[10px] font-bold">
                      <span>FACTURA: #0142</span>
                      <span>18/08/2026</span>
                    </div>
                    <p className="text-[10px] text-left text-slate-600">Cliente: Camila Torres</p>
                  </div>

                  {/* Items */}
                  <div className="space-y-1 py-1 text-[10px]">
                    <div className="flex justify-between">
                      <span>1x Vestido Lino M</span>
                      <span className="font-bold">$65.000</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1x Sandalias #37</span>
                      <span className="font-bold">$45.000</span>
                    </div>
                  </div>

                  {/* Totales */}
                  <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5 text-[10px]">
                    <div className="flex justify-between font-black text-xs">
                      <span>TOTAL A PAGAR:</span>
                      <span>$110.000</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[9px]">
                      <span>Medio de Pago:</span>
                      <span>Efectivo ($120.000)</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[9px]">
                      <span>Devuelta:</span>
                      <span>$10.000</span>
                    </div>
                  </div>

                  {/* Pie de ticket y QR */}
                  <div className="pt-2 border-t border-dashed border-slate-300 text-center space-y-1">
                    <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[9px] font-bold text-slate-600">
                      <QrCode size={11}/> Escanea para verificar factura
                    </div>
                    <p className="text-[9px] text-slate-400">¡Gracias por apoyar el comercio local!</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-3 text-left">
                <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">Impresión física profesional</span>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Factura térmica lista para cualquier impresora</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Compatible con impresoras portátiles Bluetooth (para facturar desde el celular) o impresoras USB en tu computador. Muestra tu <strong>logo, NIT, teléfono, dirección y desglose exacto</strong>.
                </p>
                <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-500/20">
                  🧾 Dale a tu negocio la presencia formal y organizada que tus clientes respetan.
                </div>
              </div>
            </div>
          )}

          {/* 4. VISTA FICHA REAL DE PLAN SEPARE */}
          {tabMockup === 'separe' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-7 bg-white dark:bg-[#0f172a] p-4 rounded-2xl border-2 border-purple-500/40 shadow-xl space-y-3 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <span className="text-xs font-black uppercase text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Crown size={12} className="text-amber-500 fill-current"/> Módulo Plan Separe
                  </span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-200">
                    📅 Plazo: Vence en 8 días
                  </span>
                </div>

                <div className="flex gap-3 items-center">
                  <div className="w-16 h-16 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 shrink-0 font-bold text-xs">
                    👗 Foto
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-black text-slate-900 dark:text-white text-sm truncate">Jean Levantacola Azul Talla 8</p>
                    <p className="text-slate-500">Cliente: Camila Torres • Cel: 310 987 6543</p>
                  </div>
                </div>

                {/* Barra de Progreso de Abonos */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Progreso del Separe (65% pagado):</span>
                    <span className="text-emerald-600 font-black">$65.000 / $100.000</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-emerald-500 h-full w-[65%] rounded-full"></div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">SALDO PENDIENTE:</span>
                    <span className="font-black text-rose-600 text-base">$35.000</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-purple-600 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm">
                      + Abonar
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg">
                      Ver Historial
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-3 text-left">
                <span className="text-xs font-black uppercase text-purple-600 tracking-wider">Cero prendas perdidas</span>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Aparta prendas con fotos y fechas límite</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Le tomas foto al vestido o calzado apartado, registras el abono inicial y fijas la fecha de vencimiento. Si el plazo vence, el sistema te avisa para recordar el cobro por WhatsApp o liberar la prenda para venderla a otro cliente.
                </p>
                <div className="bg-purple-50 dark:bg-purple-500/10 p-3 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-500/20">
                  👗 Aumenta la rotación de mercancía en quincenas y temporadas sin enredos en cuadernos.
                </div>
              </div>
            </div>
          )}

          {/* 5. VISTA CIERRE DE CAJA Y REPORTES (IDÉNTICA A /dashboard/reportes) */}
          {tabMockup === 'caja' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-200">
              <div className="lg:col-span-7 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl space-y-3 text-left border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-black tracking-wider uppercase text-slate-200">RESUMEN DE CAJA (HOY)</span>
                  </div>
                  <div className="flex gap-1 text-[10px] font-bold">
                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded">Hoy</span>
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Semana</span>
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Mes</span>
                  </div>
                </div>

                {/* 4 Tarjetas exactas de Fiabono Reportes */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Dinero Neto en Caja</span>
                    <span className="text-lg font-black text-emerald-400">$645.000</span>
                  </div>
                  <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Ventas de Contado</span>
                    <span className="text-lg font-black text-white">$520.000</span>
                  </div>
                  <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Abonos Recibidos</span>
                    <span className="text-lg font-black text-blue-400">$125.000</span>
                  </div>
                  <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block">Total Fiados del Día</span>
                    <span className="text-lg font-black text-amber-400">$180.000</span>
                  </div>
                </div>

                {/* Desglose de Dinero Físico vs Bancos */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dinero a comprobar en cierre:</span>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1.5"><Banknote size={13} className="text-emerald-400"/> Efectivo físico en cajón:</span>
                    <span className="font-mono font-black text-white">$385.000</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1.5"><Smartphone size={13} className="text-blue-400"/> Transferencias (Nequi / Daviplata):</span>
                    <span className="font-mono font-black text-white">$260.000</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-3 text-left">
                <span className="text-xs font-black uppercase text-emerald-600 tracking-wider">Control financiero sin descuadres</span>
                <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Cierra caja sabiendo qué tienes en el cajón</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  El sistema separa automáticamente las ventas de contado, los abonos y los fiados. Sabes exactamente <strong>cuánto dinero en efectivo debes contar físicamente</strong> y cuánto dinero tienes en tus cuentas bancarias.
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  📊 Reportes claros por día, semana o mes para tomar decisiones con números reales.
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* 5. COMPARATIVA DE CHOQUE: CUADERNO VS FIABONO POS */}
      <section id="comparativa" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-wider mb-3">
            <BookX size={14} /> El costo oculto del papel
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            ¿Por qué seguir con el cuaderno te hace perder plata?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          {/* Tarjeta 1: El Cuaderno Tradicional */}
          <div className="bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/40 p-6 sm:p-8 rounded-[2.5rem] flex flex-col justify-between text-left space-y-5">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 flex items-center justify-center">
                  <BookX size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">El Cuaderno Tradicional</h3>
                  <p className="text-xs text-rose-600 font-bold">Lleno de riesgos y pérdidas invisibles</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black shrink-0">✕</span>
                  <span><strong>Discusiones con clientes:</strong> El cliente asegura que ya pagó y no hay comprobante para demostrar la deuda.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black shrink-0">✕</span>
                  <span><strong>Pérdida total si se moja o se extravía:</strong> Si el cuaderno se pierde, se quema o se daña, tu dinero desaparece.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black shrink-0">✕</span>
                  <span><strong>Cierres de caja agotadores:</strong> Horas sumando con calculadora donde casi nunca cuadra la plata de la caja.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-500 font-black shrink-0">✕</span>
                  <span><strong>Prendas apartadas que se pudren:</strong> No hay cómo recordar qué mercancía está en separe ni cuándo vence el plazo.</span>
                </li>
              </ul>
            </div>
            <div className="p-3 bg-rose-100/70 dark:bg-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold text-center">
              ⚠️ Cada fiado olvidado o cuenta mal anotada en el cuaderno es plata que no vuelve a tu bolsillo.
            </div>
          </div>

          {/* Tarjeta 2: Fiabono POS */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-800/60 p-6 sm:p-8 rounded-[2.5rem] flex flex-col justify-between text-left space-y-5 shadow-lg shadow-emerald-500/5">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Con Fiabono POS</h3>
                  <p className="text-xs text-emerald-600 font-bold">Control total, cobranza puntual y tranquilidad</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Comprobante directo a WhatsApp:</strong> Cada venta, abono o fiado genera un recibo digital claro y formal en 1 toque.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Respaldo 100% en la Nube:</strong> Si cambias o pierdes el celular, abres sesión en cualquier otro equipo y todo está intacto.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Cierre de caja en 2 segundos:</strong> Sabes cuánto entró en efectivo, transferencias y qué quedó fiado en la calle.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Alertas de vencimiento de Separes:</strong> Fotos de las prendas, fechas límite y recordatorios para cobrar a tiempo.</span>
                </li>
              </ul>
            </div>
            <div className="p-3 bg-emerald-100/70 dark:bg-emerald-900/40 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold text-center">
              ✨ Cuentas claras, amistades largas y cero dinero embolatado.
            </div>
          </div>

        </div>
      </section>

      {/* 6. CALCULADORA INTERACTIVA DE RETORNO Y AHORRO EN $ COP */}
      <section id="calculadora" className="py-20 px-4 sm:px-6 max-w-5xl mx-auto scroll-mt-20">
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 sm:p-12 rounded-[3rem] shadow-2xl border border-blue-500/20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 font-black text-xs uppercase tracking-wider mb-3 border border-blue-400/30">
              <Calculator size={14} /> Calculadora de Ahorro Real
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              ¿Cuánto dinero y tiempo estás perdiendo al mes?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2">
              Mueve los controles según el movimiento de tu negocio y calcula cuánto recuperas con Fiabono.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Sliders de Entrada */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold mb-2">
                  <span>Ventas y transacciones al día:</span>
                  <span className="text-blue-400 font-black">{ventasDia} ventas/día</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="150" 
                  step="5" 
                  value={ventasDia} 
                  onChange={e => setVentasDia(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold mb-2">
                  <span>Dinero promedio fiado en la calle:</span>
                  <span className="text-emerald-400 font-black">${dineroFiado.toLocaleString('es-CO')} COP</span>
                </div>
                <input 
                  type="range" 
                  min="500000" 
                  max="15000000" 
                  step="250000" 
                  value={dineroFiado} 
                  onChange={e => setDineroFiado(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs sm:text-sm font-bold mb-2">
                  <span>Horas semanales gastadas haciendo cuentas a mano:</span>
                  <span className="text-purple-400 font-black">{horasCuentas} horas/sem</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  step="1" 
                  value={horasCuentas} 
                  onChange={e => setHorasCuentas(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>

            {/* Resultado del Ahorro */}
            <div className="lg:col-span-5 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/15 space-y-4 text-center">
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Tu Beneficio Estimado</span>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-emerald-300">
                  +${dineroRecuperadoMes.toLocaleString('es-CO')} COP
                </p>
                <p className="text-xs text-slate-300 mt-1">Dinero recuperado al mes por cobros oportunos</p>
              </div>

              <div className="pt-3 border-t border-white/10">
                <p className="text-2xl font-black text-blue-300">
                  {horasAhorradasMes} horas al mes
                </p>
                <p className="text-xs text-slate-300 mt-1">Ahorradas en sumas y cuadres (equivale a 3 días libres)</p>
              </div>

              <button 
                type="button" 
                onClick={() => abrirRegistroConPlan('gratis')} 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-xl transition-transform active:scale-95 text-xs sm:text-sm cursor-pointer shadow-lg shadow-emerald-500/25"
              >
                Comenzar a Ahorrar Gratis
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 7. CASOS DE USO POR NICHO DE MERCADO */}
      <section id="nichos" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider mb-3">
            <Store size={14} /> Solución a tu medida
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Hecho a la medida de tu tipo de negocio
          </h2>
        </div>

        {/* Selector de Nichos */}
        <div className="flex justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar px-2">
          {[
            { id: 'tienda', nombre: '🏪 Tiendas & Minimarkets' },
            { id: 'moda', nombre: '👗 Almacenes de Ropa & Calzado' },
            { id: 'ferreteria', nombre: '🔩 Papelerías & Ferreterías' },
            { id: 'belleza', nombre: '💄 Cosméticos & Catálogo' }
          ].map(n => (
            <button
              key={n.id}
              onClick={() => setTabNicho(n.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer ${
                tabNicho === n.id 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                  : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              {n.nombre}
            </button>
          ))}
        </div>

        {/* Tarjeta de Contenido de Nicho */}
        <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-md text-left">
          {tabNicho === 'tienda' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-blue-600 uppercase tracking-wider">Tiendas de Barrio & Minimarkets</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Ventas rápidas en hora pico y control de cupo de fiado</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  El vecino pide el mercado de la semana. Registras la venta en 2 segundos y el sistema verifica si el cliente tiene cupo disponible. Al final de la tarde, sabes cuánto dinero en efectivo debes tener en el cajón.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Cupo de fiado por cliente</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Historial de compras y deudas</span>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 space-y-2">
                <p className="font-black text-sm text-blue-900 dark:text-blue-200">En tu día a día:</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Al despachar registras si el cliente pagó de contado o si se añade a su saldo fiado. El vecino recibe su extracto por WhatsApp y al final del día obtienes un cuadre de caja transparente sin discusiones ni cuentas embolatadas.
                </p>
                <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 pt-1">✓ Registro de métodos de pago para control interno de caja</p>
              </div>
            </div>
          )}

          {tabNicho === 'moda' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-purple-600 uppercase tracking-wider">Almacenes de Ropa, Calzado & Boutiques</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Módulo Plan Separe con fotos de prendas y fechas límite</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Tus clientas apartan vestidos o zapatos para quincena. Tomas foto a la prenda con tu celular, fijas la fecha de vencimiento y registras abonos parciales. Si el plazo vence, el sistema te avisa para cobrar o liberar el artículo.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Fotos de prendas apartadas</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Alertas automáticas de vencimiento</span>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 p-6 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                <p className="font-black text-sm text-purple-900 dark:text-purple-200">En tu día a día:</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Cero reclamos de "¿cuál fue la prenda que aparté?". Cada abono genera un comprobante inmediato por WhatsApp que muestra el saldo restante y la fecha límite, manteniendo el inventario reservado seguro.
                </p>
                <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 pt-1">✓ Control de mercancía apartada y rotación oportuna</p>
              </div>
            </div>
          )}

          {tabNicho === 'ferreteria' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">Papelerías, Ferreterías & Misceláneas</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Etiquetas adhesivas con Código QR y precios</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Miles de productos pequeños con precios cambiantes. Generas e imprimes planchas térmicas con el QR, Nombre y Precio para etiquetar estantes y cobrar en 1 segundo con la cámara del celular o lector de barras.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Planchas de etiquetas QR</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Carga masiva en Excel</span>
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 space-y-2">
                <p className="font-black text-sm text-indigo-900 dark:text-indigo-200">En tu día a día:</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Tus colaboradores escanean con la cámara y facturan sin equivocarse en los precios ni consultar cuadernos viejos. El stock se descuenta en vivo para saber cuándo reponer a proveedores.
                </p>
                <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 pt-1">✓ Agilidad total en mostrador y control de inventario</p>
              </div>
            </div>
          )}

          {tabNicho === 'belleza' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-rose-600 uppercase tracking-wider">Cosméticos, Belleza & Venta por Catálogo</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Cobro profesional a clientas de campañas y quincenas</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Maneja la lista de clientas por campaña o pedidos. Envía estados de cuenta claros por WhatsApp en quincena y registra abonos parciales sin enredos ni cuentas manuales.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Recordatorios de quincena</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Historial de compras por clienta</span>
                </div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 p-6 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 space-y-2">
                <p className="font-black text-sm text-rose-900 dark:text-rose-200">En tu día a día:</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Cobrar ya no da pena. El comprobante de Fiabono se ve formal y claro en el WhatsApp de tu clienta, indicando cuánto abonó y qué saldo tiene pendiente para sus fechas de pago.
                </p>
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 pt-1">✓ Cobranza puntual sin desgastes ni malentendidos</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 8. GRID DE FUNCIONALIDADES REALES DE FIABONO (REEMPLAZO HONESTO Y PROFESIONAL) */}
      <section id="features" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider mb-3">
            <Sparkles size={14} /> Lo que realmente hace Fiabono
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Todo lo que necesitas para operar tu negocio sin enredos
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-3 max-w-2xl mx-auto font-medium">
            Herramientas reales construidas especialmente para tiendas, almacenes y comercios en Colombia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          
          {/* Columna 1: Ventas, Fiados y Cobros */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <ShoppingBag size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Ventas, Fiados y Cobros</h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Vende y fía en 1 toque</strong> con control de cupo por cliente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Historial completo:</strong> ventas, fiados y abonos registrados por cliente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Estados de cuenta por WhatsApp:</strong> cobra deudas formalmente con un toque.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Abonos parciales:</strong> actualiza saldos al instante sin recalcular en cuaderno.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <span><strong>Registro del medio de pago:</strong> anota efectivo, transferencia o datáfono para tu control.</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-blue-600 dark:text-blue-400">
              ✓ Carrito multi-venta en paralelo
            </div>
          </div>

          {/* Columna 2: Inventario y Catálogo */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <QrCode size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Inventario y Catálogo</h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Catálogo completo:</strong> administra productos físicos y servicios.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Alertas de stock:</strong> aviso de productos agotados o por debajo del mínimo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Etiquetas adhesivas QR:</strong> genera e imprime para rollos térmicos o PDF carta.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Carga masiva en Excel:</strong> sube o descarga todo tu catálogo en segundos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Escaneo con cámara:</strong> cobra con el lector de barras o código QR desde el móvil.</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              ✓ Stock actualizado en tiempo real con cada venta
            </div>
          </div>

          {/* Columna 3: Plan Separe y Apartados */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <Bookmark size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Plan Separe con Fotos</h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Fotos de la mercancía:</strong> toma foto a la prenda apartada para evitar confusiones.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Fecha límite pactada:</strong> plazo claro de vencimiento acordado con el cliente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Alertas de vencimiento:</strong> sabe cuándo cobrar o cuándo liberar el artículo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Progreso visual:</strong> barra de porcentaje pagado vs. saldo pendiente.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-purple-600 shrink-0 mt-0.5" />
                  <span><strong>Liquidación segura:</strong> entrega formal cuando el saldo llega a $0.</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-purple-600 dark:text-purple-400">
              ✓ Ideal para boutiques y almacenes
            </div>
          </div>

          {/* Columna 4: Control, Reportes y Seguridad */}
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Control y Reportes</h3>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Resumen diario y mensual:</strong> cuánto vendiste, cuánto fiaste y cuánto recaudaste.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Plata en la calle:</strong> reporte exacto de tu cartera total pendiente por cobrar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Cierre de caja automático:</strong> desglosado por efectivo vs. transferencias.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Colaboradores con permisos:</strong> crea cajeros con horarios y vistas restringidas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>100% en la Nube:</strong> nunca pierdes información, así cambies o extravíes el celular.</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              ✓ Cuentas claras todos los días
            </div>
          </div>

        </div>
      </section>

      {/* 9. SECCIÓN DE PLANES Y PRECIOS SAAS */}
      <section id="planes" className="py-24 px-4 sm:px-6 max-w-7xl mx-auto text-center border-t border-slate-200/60 dark:border-slate-800/60 scroll-mt-20">
        <div className="max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest mb-3 border border-emerald-200/60 dark:border-emerald-500/20">
            <Sparkles size={14} className="fill-current" /> Planes transparentes y accesibles
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Elige el plan ideal para tu negocio
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium text-base sm:text-lg">
            Comienza gratis hoy. Pásate a Comercio o PRO cuando tu negocio lo necesite con 14 días de prueba completa.
          </p>
        </div>

        {/* Banner Informativo de Planes */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-black tracking-wide shadow-xs">
            <Sparkles size={16} className="text-amber-500 fill-current shrink-0" />
            <span>Planes asequibles para Colombia • Tarifas oficiales próximamente disponibles • ¡Prueba 14 días gratis sin tarjeta!</span>
          </div>
        </div>

        {/* BARRA PROMO CODE VISIBLE Y SIEMPRE DISPONIBLE */}
        <div className="max-w-2xl mx-auto mb-12 bg-white dark:bg-[#0f172a] p-4 sm:p-5 rounded-3xl border-2 border-dashed border-blue-400/60 dark:border-blue-500/40 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                <Tag size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  ¿Tienes un código de suscripción o descuento?
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ingrésalo aquí para registrarte con meses o beneficios especiales.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <input
                type="text"
                placeholder="Ej. PRO2026"
                value={codigoInput}
                onChange={(e) => {
                  setCodigoInput(e.target.value);
                  setErrorCodigo("");
                  setExitoCodigo("");
                }}
                className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider outline-none focus:border-blue-500 w-full sm:w-36 text-center"
              />
              <button
                type="button"
                onClick={() => validarCodigo()}
                disabled={validandoCodigo || !codigoInput.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 px-4 rounded-xl transition-transform active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {validandoCodigo ? "..." : "Canjear"}
              </button>
            </div>
          </div>

          {errorCodigo && (
            <div className="mt-3 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle size={14} /> {errorCodigo}
            </div>
          )}

          {exitoCodigo && codigoAplicado && (
            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{exitoCodigo}</span>
              </div>
              <button
                type="button"
                onClick={() => abrirRegistroConPlan(codigoAplicado.planOtorgado)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2 px-3.5 rounded-xl shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
              >
                Registrarme con este Beneficio
              </button>
            </div>
          )}
        </div>
        
        {/* Grid de 3 Planes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left items-stretch max-w-6xl mx-auto">
          
          {/* 1. PLAN GRATIS */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm hover:shadow-lg transition-shadow">
            <div className="mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                Plan Gratuito
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3 mb-1">Para Iniciar</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 h-8">Ideal para quienes venden desde casa o están empezando.</p>
            
            <div className="mb-6">
              <span className="text-4xl font-black text-slate-900 dark:text-white">$0</span>
              <span className="text-xs text-slate-500 font-bold ml-1">/ para siempre</span>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> 1 Usuario Administrador</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Hasta 15 clientes registrados</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Hasta 30 productos en catálogo</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Hasta 40 ventas, fiados y abonos al mes</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Comprobantes y extractos por WhatsApp</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Control de existencias en tiempo real</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Logo de tu negocio en tu perfil</li>
            </ul>

            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('gratis')} 
              className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-black py-3.5 rounded-2xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 text-sm text-center"
            >
              Comenzar Gratis
            </button>
          </div>
          
          {/* 2. PLAN COMERCIO */}
          <div className="bg-emerald-600 dark:bg-emerald-700 p-8 rounded-[2.5rem] border-2 border-emerald-400 flex flex-col shadow-2xl shadow-emerald-600/30 relative text-white transform lg:-translate-y-3">
            <div className="absolute top-0 right-0 bg-white text-emerald-800 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl shadow-sm">
              Más Popular
            </div>
            <div className="mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-100 bg-emerald-700/60 px-3 py-1 rounded-full">
                Plan Comercio
              </span>
            </div>
            <h3 className="text-2xl font-black mb-1 text-white mt-3">Para Tiendas y Negocios</h3>
            <p className="text-emerald-100 text-xs mb-6 h-8">La solución para negocios de mostrador con alto volumen diario.</p>
            
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white">
                  Precio Próximamente
                </span>
              </div>
              <span className="text-xs text-emerald-100 font-bold block mt-1">Tarifa mensual asequible • 14 días de prueba completa sin costo</span>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1 text-xs font-bold text-white">
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> Clientes e Inventario ILIMITADOS</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> Ventas, fiados y abonos ILIMITADOS</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> 1 Usuario Colaborador con horarios y permisos</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> Factura imprimible para cualquier impresora térmica</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> Logo y datos de tu negocio en facturas</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> Reportes de Caja Neta, Deudas y Cartera Activa</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-200 shrink-0"/> Alertas de Stock Bajo y Productos Agotados</li>
              <li className="flex items-center gap-2.5 opacity-60">
                <X size={16} className="text-white/60 shrink-0"/>
                <span className="text-white/70">Plan Separe con Fotos (solo en PRO)</span>
              </li>
            </ul>

            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('comercio')} 
              className="w-full bg-white text-emerald-700 hover:bg-emerald-50 font-black py-3.5 rounded-2xl shadow-lg transition-transform active:scale-95 cursor-pointer text-sm text-center"
            >
              Comenzar Prueba Gratis (14 Días)
            </button>
          </div>

          {/* 3. PLAN PRO ALMACÉN */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border-2 border-purple-500/40 flex flex-col shadow-sm hover:shadow-lg transition-shadow relative">
            <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
              Control Total
            </div>
            <div className="mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-700 bg-purple-100 dark:bg-purple-500/20 px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                <Crown size={13} className="text-amber-500 fill-current"/> PRO Almacén
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3 mb-1">Para Almacenes y Equipos</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 h-8">Módulo Separe, etiquetas QR y hasta 4 colaboradores.</p>
            
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Precio Próximamente
                </span>
              </div>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-bold block mt-1">Tarifa mensual asequible • 14 días de prueba completa sin costo</span>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Todo lo del Plan Comercio ILIMITADO</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Módulo PLAN SEPARE Completo con Fotos y Alertas</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Generador de Etiquetas Adhesivas con Código QR</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Hasta 4 Usuarios Colaboradores con permisos</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Modo Terminal Multivendedor en mostrador</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Importar y Exportar masivo de catálogo en Excel</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Logo y membrete del negocio en facturas</li>
            </ul>

            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('pro')} 
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-purple-600/20 transition-transform active:scale-95 cursor-pointer text-sm text-center"
            >
              Comenzar Prueba Gratis (14 Días)
            </button>
          </div>

        </div>

        {/* TABLA COMPARATIVA DETALLADA DE PLANES */}
        <div className="mt-16 max-w-5xl mx-auto bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-10 shadow-lg text-left">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full">
              Comparativa Completa
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
              Compara cada función lado a lado
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Transparencia total. Sin costos ocultos ni letras pequeñas.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-black">Funcionalidad</th>
                  <th className="py-3 px-4 font-black text-center">Plan Gratis</th>
                  <th className="py-3 px-4 font-black text-center text-emerald-600 dark:text-emerald-400">Comercio</th>
                  <th className="py-3 px-4 font-black text-center text-purple-600 dark:text-purple-400">PRO Almacén</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Clientes registrados en base de datos</td>
                  <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400">Hasta 15</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600">ILIMITADOS</td>
                  <td className="py-3.5 px-4 text-center font-bold text-purple-600">ILIMITADOS</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Productos en inventario / catálogo</td>
                  <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400">Hasta 30</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600">ILIMITADOS</td>
                  <td className="py-3.5 px-4 text-center font-bold text-purple-600">ILIMITADOS</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Ventas, fiados y abonos registrados</td>
                  <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400">40 al mes</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600">ILIMITADOS</td>
                  <td className="py-3.5 px-4 text-center font-bold text-purple-600">ILIMITADOS</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Comprobantes por WhatsApp (Ventas, Fiados y Abonos)</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Factura imprimible en impresora térmica</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Logo del negocio en recibos y facturas</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ En Perfil</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Factura y Perfil</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Factura y Perfil</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Usuarios Colaboradores (Cajeros / Vendedores)</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">0 (Solo Admin)</td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-100">1 Colaborador</td>
                  <td className="py-3.5 px-4 text-center font-bold text-purple-600">Hasta 4 Colaboradores</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Control de horarios y permisos de colaborador</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Reportes de Caja del Día, Utilidad y Cartera</td>
                  <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400">Básico</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Completo</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Completo</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Módulo PLAN SEPARE con Fotos y Alertas</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-purple-600 font-bold">✓ Exclusivo PRO</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Generador de Planchas de Etiquetas QR</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-purple-600 font-bold">✓ Exclusivo PRO</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Modo Terminal Multivendedor en mostrador</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-purple-600 font-bold">✓ Exclusivo PRO</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Carga y descarga masiva en Excel</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-purple-600 font-bold">✓ Exclusivo PRO</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">Aprobación de ventas de cajeros (Órdenes Pendientes)</td>
                  <td className="py-3.5 px-4 text-center text-slate-300 dark:text-slate-600">—</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                  <td className="py-3.5 px-4 text-center text-emerald-500 font-bold">✓ Incluido</td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* GLOSARIO EDUCATIVO DE CONCEPTOS CLAVE */}
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-left">
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                <Users size={16} className="text-blue-500" />
                <span>¿Qué es un Colaborador?</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Es una cuenta de acceso para tu cajero o empleado. Puede registrar ventas o fiados desde su propio celular o el del mostrador, <strong>sin ver tus ganancias totales ni modificar precios</strong> si tú no se lo permites.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                <Store size={16} className="text-purple-500" />
                <span>¿Qué es Terminal Multivendedor?</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Ideal para almacenes donde varios asesores atienden al tiempo. Permite que cada vendedor marque quién atendió la venta o separe en la misma caja, facilitando el control de comisiones y auditoría.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                <BarChart3 size={16} className="text-emerald-500" />
                <span>Reportes de Caja y Cartera</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Cierra la caja en 2 segundos sabiendo con exactitud cuánto dinero en efectivo debes tener en el cajón, cuánto entró por transferencias y cuánto dinero está pendiente por cobrar en la calle.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 10. SECCIÓN DE PREGUNTAS FRECUENTES (FAQ DESTRUCTOR DE OBJECIONES) */}
      <section id="faq" className="py-24 px-4 sm:px-6 max-w-4xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider mb-3">
            <HelpCircle size={14} /> Resolvemos todas tus dudas
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Preguntas Frecuentes
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "¿Es muy difícil de usar si no sé mucho de computadores o tecnología?",
              a: "Es más fácil que usar WhatsApp. Si sabes enviar un mensaje y tomar una foto con tu teléfono, sabes usar Fiabono. No necesitas cursos, manuales complicados ni conocimientos de contabilidad."
            },
            {
              q: "¿Puedo usarlo desde mi celular y mi computador al mismo tiempo?",
              a: "Sí, 100%. Fiabono funciona en la nube en tiempo real. Puedes abrirlo en tu teléfono Android o iPhone, tablet o computador portátil. Todos tus datos se sincronizan al instante."
            },
            {
              q: "¿Qué pasa si se me daña, me roban o cambio de celular?",
              a: "Toda tu información está respaldada y encriptada en la nube en servidores de alta seguridad de Google. Solo tomas otro celular o computador, ingresas con tu correo y contraseña, y encuentras todos tus clientes, inventario y cuentas por cobrar intactos."
            },
            {
              q: "¿Mis empleados o cajeros pueden ver cuánto dinero gano en total?",
              a: "No. En el Modo Colaborador tú decides qué permisos otorgarles. Puedes ocultarles las estadísticas de caja, el historial total y los números de teléfono de tus clientes para máxima privacidad y seguridad de tu negocio."
            },
            {
              q: "¿Qué tipo de impresora necesito para las facturas y etiquetas QR?",
              a: "Fiabono es compatible con cualquier impresora térmica estándar de 58mm o 80mm (Bluetooth, USB o Wi-Fi). También puedes generar los comprobantes para enviarlos directamente por WhatsApp sin necesidad de tener impresora física."
            },
            {
              q: "¿Cómo funciona el Módulo de Plan Separe en el Plan PRO?",
              a: "Te permite registrar prendas o productos apartados con foto, definir una fecha límite de pago, recibir abonos parciales y emitir comprobantes actualizados con alertas de vencimiento para evitar que la mercancía se quede estancada."
            },
            {
              q: "¿Necesito resolución de la DIAN o trámites tributarios para empezar a usar Fiabono?",
              a: "No. Puedes comenzar a usar Fiabono de inmediato para el control interno de tus ventas, fiados, abonos e inventario sin requerir resoluciones ni trámites complejos. Más adelante, si las exigencias de tu negocio lo requieren, el sistema podrá incorporar módulos de facturación electrónica sin que pierdas tu información."
            },
            {
              q: "¿Tengo que descargar una aplicación pesada de la Play Store o App Store?",
              a: "No tienes que saturar la memoria de tu celular. Fiabono funciona directamente desde cualquier navegador web (Chrome, Safari) y te permite instalarlo como una aplicación (PWA) en tu pantalla de inicio con 1 solo toque. Es ultraligero, rápido y se actualiza automáticamente sin descargas de cientos de megabytes."
            },
            {
              q: "¿Puedo probar el sistema antes de pagar un solo peso?",
              a: "Sí, totalmente. Puedes registrarte y usar el Plan Gratuito para siempre. Si deseas probar las herramientas avanzadas de Comercio o PRO, disfrutas de 14 días de prueba completa sin necesidad de ingresar tarjeta de crédito."
            },
            {
              q: "¿Cómo me contacto con el equipo de soporte si tengo dudas o necesito ayuda?",
              a: "Nuestro equipo de atención está disponible para ayudarte. Puedes escribirnos directamente al correo oficial de soporte y atención: fiabono.app@gmail.com para resolver cualquier inquietud sobre tu cuenta, planes o configuración."
            }
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden transition-all"
            >
              <button 
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left font-black text-slate-900 dark:text-white flex items-center justify-between gap-4 cursor-pointer text-sm sm:text-base"
              >
                <span>{item.q}</span>
                {faqAbierto === idx ? <ChevronUp size={18} className="shrink-0 text-blue-600"/> : <ChevronDown size={18} className="shrink-0 text-slate-400"/>}
              </button>
              {faqAbierto === idx && (
                <div className="px-5 pb-5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3 animate-in fade-in duration-200">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 11. CTA FINAL DE ALTA CONVERSIÓN */}
      <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-900 text-white p-8 sm:p-14 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Organiza tu negocio hoy mismo en menos de 2 minutos.
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base font-medium">
              Crea tu cuenta gratuita sin tarjeta de crédito y toma el control total de tus ventas, cobranzas y clientes.
            </p>
            <div className="pt-4 flex justify-center">
              <button 
                type="button" 
                onClick={() => abrirRegistroConPlan('gratis')}
                className="bg-white text-emerald-700 hover:bg-emerald-50 text-base sm:text-lg font-black py-4 px-8 rounded-2xl shadow-xl transition-transform active:scale-95 cursor-pointer"
              >
                Comenzar Gratis Ahora
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 12. FOOTER ELEGANTE Y SELLOS DE SEGURIDAD */}
      <footer className="py-12 pb-24 md:pb-12 px-6 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Sellos de Confianza y Seguridad Cloud */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pb-6 border-b border-slate-200/40 dark:border-slate-800/40 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" /> Servidores Google Cloud
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={13} className="text-blue-500" /> Encriptación SSL 256-bit
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-purple-500" /> Respaldo Automático 24/7
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" /> Protección de Datos (Ley 1581)
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <LogoFiabono size={26} showText={true} showBadge={false} />
              <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-1">Hecho en Colombia 🇨🇴</span>
            </div>

            {/* Enlaces de Contacto y Legales */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 text-slate-500 dark:text-slate-400 font-bold text-[11px]">
              <a 
                href="mailto:fiabono.app@gmail.com" 
                className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title="Escríbenos a soporte y atención oficial"
              >
                <Mail size={13} className="text-emerald-500 shrink-0" />
                <span>Contacto: <strong className="underline underline-offset-2">fiabono.app@gmail.com</strong></span>
              </a>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <button 
                type="button" 
                onClick={() => setModalLegal({ 
                  visible: true, 
                  titulo: "Términos y Condiciones del Servicio", 
                  tipo: 'terminos' 
                })} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Términos del Servicio
              </button>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <button 
                type="button" 
                onClick={() => setModalLegal({ 
                  visible: true, 
                  titulo: "Política de Tratamiento de Datos Personales", 
                  tipo: 'privacidad' 
                })} 
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Política de Privacidad
              </button>
            </div>

            <p>© {new Date().getFullYear()} Fiabono. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* 13. FLOATING MOBILE STICKY BAR PARA MÁXIMA CONVERSIÓN */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-3 z-[400] flex items-center justify-between gap-3 shadow-lg">
        <div>
          <p className="text-xs font-black text-slate-900 dark:text-white">Prueba Fiabono Gratis</p>
          <p className="text-[10px] text-emerald-600 font-bold">Sin tarjeta de crédito</p>
        </div>
        <button
          type="button"
          onClick={() => abrirRegistroConPlan('gratis')}
          className="bg-emerald-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
        >
          Crear Cuenta
        </button>
      </div>

      {/* 14. MODAL DE LOGIN / REGISTRO */}
      {modalLandingInfo.visible && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
            <button 
              type="button"
              onClick={cerrarModal} 
              className="absolute top-6 right-6 bg-slate-100 dark:bg-[#020617] text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full p-2 transition-colors cursor-pointer"
            >
              <X size={20}/>
            </button>
            
            <div className="text-center mb-6 pt-2">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-4 text-white">
                {modalLandingInfo.tipo === 'login' ? <Lock size={28} /> : <Sparkles size={28} />}
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                {modalLandingInfo.tipo === 'login' ? 'Bienvenido a Fiabono' : 'Crea tu Cuenta'}
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {modalLandingInfo.tipo === 'login' 
                  ? 'Ingresa tus credenciales de administrador o colaborador' 
                  : (planSeleccionadoRegistro === 'pro' 
                    ? 'Activando Plan PRO Almacén (14 días de prueba)' 
                    : (planSeleccionadoRegistro === 'comercio' 
                      ? 'Activando Plan Comercio (14 días de prueba)' 
                      : 'Comenzando con Plan Gratuito'))}
              </p>
            </div>

            {authErrores.general && (
              <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3.5 rounded-xl text-xs font-bold text-center border border-rose-200 dark:border-rose-500/20 mb-4">
                {authErrores.general}
              </div>
            )}

            {/* BOTÓN CONTINUAR CON GOOGLE (1 CLIC) */}
            <button
              type="button"
              onClick={iniciarConGoogle}
              disabled={cargandoGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 font-black py-3.5 px-4 rounded-2xl shadow-xs transition-all active:scale-98 disabled:opacity-50 cursor-pointer mb-3"
            >
              {cargandoGoogle ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              )}
              <span className="text-xs sm:text-sm">
                {modalLandingInfo.tipo === 'login' ? 'Iniciar sesión con Google' : 'Continuar con Google'}
              </span>
            </button>

            {/* DIVISOR */}
            <div className="flex items-center gap-3 my-2 mb-4">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                o con correo / usuario
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <form onSubmit={manejarAuth} className="flex flex-col gap-3.5">
              {modalLandingInfo.tipo === 'registro' && ( 
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Tu Nombre</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Juan Pérez" 
                      value={authForm.nombreUsuario} 
                      onChange={e => {setAuthForm({...authForm, nombreUsuario: e.target.value}); setAuthErrores({...authErrores, general: ""})}} 
                      className="w-full p-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm" 
                    /> 
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Nombre de tu Negocio</label>
                    <input 
                      type="text" 
                      placeholder="Ej. Tienda Los Álamos" 
                      value={authForm.negocio} 
                      onChange={e => {setAuthForm({...authForm, negocio: e.target.value}); setAuthErrores({...authErrores, general: ""})}} 
                      className="w-full p-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm" 
                    /> 
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  {modalLandingInfo.tipo === 'login' ? "Correo o Usuario Colaborador" : "Correo Electrónico"}
                </label>
                <input 
                  type="text" 
                  placeholder={modalLandingInfo.tipo === 'login' ? "tunegocio@correo.com o cajero1" : "tunegocio@correo.com"} 
                  value={authForm.email} 
                  onChange={e => {setAuthForm({...authForm, email: e.target.value}); setAuthErrores({...authErrores, email: ""})}} 
                  className={`w-full p-3.5 bg-slate-50 dark:bg-[#020617] border ${authErrores.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm`} 
                />
                {authErrores.email && <p className="text-rose-500 text-xs font-bold mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{authErrores.email}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Contraseña</label>
                <div className="relative">
                  <input 
                    type={mostrarPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={authForm.password} 
                    onChange={e => {setAuthForm({...authForm, password: e.target.value}); setAuthErrores({...authErrores, password: ""})}} 
                    className={`w-full p-3.5 pr-10 bg-slate-50 dark:bg-[#020617] border ${authErrores.password ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setMostrarPassword(!mostrarPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none cursor-pointer"
                  >
                    {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {authErrores.password && <p className="text-rose-500 text-xs font-bold mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{authErrores.password}</p>}
              </div>

              {modalLandingInfo.tipo === 'registro' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Confirmar Contraseña</label>
                  <div className="relative">
                    <input 
                      type={mostrarConfirmPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      value={authForm.confirmPassword} 
                      onChange={e => {setAuthForm({...authForm, confirmPassword: e.target.value}); setAuthErrores({...authErrores, confirmPassword: ""})}} 
                      className={`w-full p-3.5 pr-10 bg-slate-50 dark:bg-[#020617] border ${authErrores.confirmPassword ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800'} rounded-xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm`} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setMostrarConfirmPassword(!mostrarConfirmPassword)} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 focus:outline-none cursor-pointer"
                    >
                      {mostrarConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {authErrores.confirmPassword && <p className="text-rose-500 text-xs font-bold mt-1 ml-1 flex items-center gap-1"><AlertCircle size={12}/>{authErrores.confirmPassword}</p>}
                </div>
              )}

              {/* Código Promocional / Suscripción en Registro tradicional */}
              {modalLandingInfo.tipo === 'registro' && (
                <div className="p-3.5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Tag size={13} className="text-blue-600 dark:text-blue-400"/> ¿Tienes un código promocional?
                    </label>
                    {codigoAplicado && (
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        {codigoAplicado.codigo} ✓
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="Ej. PRO2026 (opcional)" 
                      value={codigoInput} 
                      onChange={e => {
                        setCodigoInput(e.target.value);
                        setErrorCodigo("");
                        setExitoCodigo("");
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => validarCodigo(undefined, authForm.email)}
                      disabled={validandoCodigo || !codigoInput.trim()}
                      className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-2.5 px-3 rounded-xl disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {validandoCodigo ? "..." : "Aplicar"}
                    </button>
                  </div>
                  {errorCodigo && <p className="text-rose-500 text-[11px] font-bold flex items-center gap-1"><AlertCircle size={12}/>{errorCodigo}</p>}
                  {exitoCodigo && <p className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1"><CheckCircle2 size={12}/>{exitoCodigo}</p>}
                </div>
              )}

              {modalLandingInfo.tipo === 'registro' && (
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 text-left">
                  <input
                    type="checkbox"
                    id="acepta_terminos_check"
                    checked={aceptaTerminos}
                    onChange={e => {
                      setAceptaTerminos(e.target.checked);
                      if (authErrores.general) setAuthErrores(p => ({ ...p, general: "" }));
                    }}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0 accent-blue-600"
                  />
                  <label htmlFor="acepta_terminos_check" className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug cursor-pointer font-medium">
                    He leído y acepto los{" "}
                    <button
                      type="button"
                      onClick={() => setModalLegal({ visible: true, titulo: "Términos y Condiciones del Servicio", tipo: 'terminos' })}
                      className="text-blue-600 dark:text-blue-400 font-black underline hover:opacity-80"
                    >
                      Términos del Servicio
                    </button>{" "}
                    y la{" "}
                    <button
                      type="button"
                      onClick={() => setModalLegal({ visible: true, titulo: "Política de Tratamiento de Datos Personales", tipo: 'privacidad' })}
                      className="text-blue-600 dark:text-blue-400 font-black underline hover:opacity-80"
                    >
                      Política de Privacidad
                    </button>{" "}
                    (Ley 1581 de Habeas Data).
                  </label>
                </div>
              )}

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-base py-4 rounded-xl shadow-lg shadow-blue-600/25 transition-transform transform active:scale-95 mt-2 cursor-pointer"
              >
                {modalLandingInfo.tipo === 'login' ? 'Iniciar Sesión' : 'Crear mi Cuenta'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                type="button" 
                onClick={() => {
                  setModalLandingInfo({ visible: true, tipo: modalLandingInfo.tipo === 'login' ? 'registro' : 'login' }); 
                  setAuthErrores({email:"",password:"",confirmPassword:"",general:""}); 
                  setAuthForm({email:"",password:"",confirmPassword:"",nombreUsuario:"",negocio:""});
                  setMostrarPassword(false);
                  setMostrarConfirmPassword(false);
                }} 
                className="text-xs font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                {modalLandingInfo.tipo === 'login' ? '¿No tienes cuenta? Regístrate gratis' : '¿Ya tienes cuenta? Inicia sesión aquí'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 15. MODAL DE ONBOARDING ELEGANTE PARA NUEVAS CUENTAS DE GOOGLE            */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 15. MODAL DE ONBOARDING ELEGANTE PARA NUEVAS CUENTAS DE GOOGLE            */}
      {/* ========================================================================= */}
      {modalGoogleOnboarding && googleUserPendiente && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0b1329] border border-slate-200/80 dark:border-slate-800 w-full max-w-xl rounded-[2.5rem] p-5 sm:p-9 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Botón Salir / Cancelar */}
            <button 
              type="button"
              onClick={cancelarGoogleOnboarding}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Cancelar y salir"
            >
              <X size={20}/>
            </button>

            {/* Cabecera con identidad Google y Stepper */}
            <div className="text-center mb-6 pt-1">
              <div className="relative inline-block mb-3">
                {googleUserPendiente.foto ? (
                  <img 
                    src={googleUserPendiente.foto} 
                    alt="Foto de perfil" 
                    className="w-16 h-16 rounded-full border-2 border-blue-500 shadow-md object-cover mx-auto ring-4 ring-blue-500/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mx-auto ring-4 ring-blue-500/20">
                    {googleUserPendiente.nombre ? googleUserPendiente.nombre.charAt(0).toUpperCase() : 'G'}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-1 shadow-md border border-slate-200 dark:border-slate-700">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <CheckCircle2 size={12}/> {googleUserPendiente.email}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">
                {pasoGoogleOnboarding === 1 ? 'Configura tu Negocio 🏪' : 'Elige tu Plan de Inicio 🚀'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {pasoGoogleOnboarding === 1 
                  ? 'Personaliza los datos de tu tienda para que tus comprobantes y reportes queden listos.'
                  : 'Prueba todas las funciones avanzadas por 14 días sin costo ni tarjeta de crédito.'}
              </p>

              {/* Indicador visual de 2 Pasos */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setPasoGoogleOnboarding(1)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${pasoGoogleOnboarding === 1 ? 'w-10 bg-blue-600' : 'w-4 bg-slate-200 dark:bg-slate-700'}`}
                  title="Paso 1: Datos del Negocio"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (formGoogleOnboarding.nombreNegocio.trim() && formGoogleOnboarding.telefonoNegocio.trim()) {
                      setPasoGoogleOnboarding(2);
                      setErrorGoogleOnboarding("");
                    } else {
                      setErrorGoogleOnboarding("Por favor completa el nombre del negocio y tu WhatsApp antes de continuar.");
                    }
                  }}
                  className={`h-2 rounded-full transition-all cursor-pointer ${pasoGoogleOnboarding === 2 ? 'w-10 bg-blue-600' : 'w-4 bg-slate-200 dark:bg-slate-700'}`}
                  title="Paso 2: Selección de Plan"
                />
              </div>
            </div>

            {errorGoogleOnboarding && (
              <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3.5 rounded-2xl text-xs font-bold text-center border border-rose-200 dark:border-rose-500/20 mb-4 flex items-center justify-center gap-2 animate-in fade-in">
                <AlertCircle size={15}/> {errorGoogleOnboarding}
              </div>
            )}

            <form onSubmit={completarOnboardingGoogle} className="space-y-4">
              {/* ===================== PASO 1: DATOS DEL COMERCIO ===================== */}
              {pasoGoogleOnboarding === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Nombre de la persona */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Tu Nombre Completo
                    </label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej. Johan Escobar" 
                      value={formGoogleOnboarding.nombreUsuario} 
                      onChange={e => {
                        setFormGoogleOnboarding({...formGoogleOnboarding, nombreUsuario: e.target.value});
                        setErrorGoogleOnboarding("");
                      }} 
                      className="w-full p-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm transition-all focus:ring-2 focus:ring-blue-500/20" 
                    />
                  </div>

                  {/* Nombre del Negocio */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Nombre de tu Negocio / Tienda <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Store size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej. Minimarket Central, Boutique Glamour..." 
                        value={formGoogleOnboarding.nombreNegocio} 
                        onChange={e => {
                          setFormGoogleOnboarding({...formGoogleOnboarding, nombreNegocio: e.target.value});
                          setErrorGoogleOnboarding("");
                        }} 
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm transition-all focus:ring-2 focus:ring-blue-500/20" 
                      />
                    </div>
                  </div>

                  {/* Tipo / Categoría del Negocio */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Tipo de Negocio
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "Moda y Calzado", icon: Shirt, label: "Moda / Ropa", usaSepare: true },
                        { id: "Tienda de Barrio / Minimarket", icon: ShoppingBag, label: "Tienda / Mini", usaSepare: false },
                        { id: "Cosméticos y Belleza", icon: Sparkles, label: "Belleza", usaSepare: true },
                        { id: "Ferretería / Papelería / Otro", icon: Briefcase, label: "Otro Comercio", usaSepare: false },
                      ].map(t => {
                        const Icono = t.icon;
                        const activo = formGoogleOnboarding.tipoNegocio === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setFormGoogleOnboarding({
                              ...formGoogleOnboarding, 
                              tipoNegocio: t.id,
                              moduloSepare: t.usaSepare
                            })}
                            className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                              activo 
                                ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-sm' 
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            <Icono size={16} className={activo ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}/>
                            <span className="text-[11px] leading-tight">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pregunta Explícita de Plan Separe */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800/90">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Bookmark size={14} className="text-violet-600 dark:text-violet-400"/>
                        ¿Deseas activar el Plan Separe?
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formGoogleOnboarding.moduloSepare ? 'Activo en Inicio' : 'Oculto en Inicio'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormGoogleOnboarding({...formGoogleOnboarding, moduloSepare: true})}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                          formGoogleOnboarding.moduloSepare
                            ? 'border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        ✓ Sí, apartar con abonos
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormGoogleOnboarding({...formGoogleOnboarding, moduloSepare: false})}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                          !formGoogleOnboarding.moduloSepare
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        ✕ No, solo ventas y fiados
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                      Podrás cambiar esto en cualquier momento desde tu Perfil.
                    </p>
                  </div>

                  {/* Teléfono / WhatsApp OBLIGATORIO */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        WhatsApp del Negocio <span className="text-rose-500">* (Obligatorio)</span>
                      </label>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <MessageCircle size={12}/> Para envío de comprobantes
                      </span>
                    </div>
                    <div className="relative">
                      <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                      <input 
                        type="tel" 
                        required
                        placeholder="Ej. 312 345 6789 ó +57 312 345 6789" 
                        value={formGoogleOnboarding.telefonoNegocio} 
                        onChange={e => {
                          setFormGoogleOnboarding({...formGoogleOnboarding, telefonoNegocio: e.target.value});
                          setErrorGoogleOnboarding("");
                        }} 
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm transition-all focus:ring-2 focus:ring-blue-500/20" 
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Tus clientes recibirán sus recibos de abonos y ventas a través de este canal.
                    </p>
                  </div>

                  {/* Botón Siguiente */}
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!formGoogleOnboarding.nombreNegocio.trim()) {
                        setErrorGoogleOnboarding("Por favor ingresa el nombre de tu negocio.");
                        return;
                      }
                      if (!formGoogleOnboarding.telefonoNegocio.trim()) {
                        setErrorGoogleOnboarding("El número de WhatsApp es obligatorio para activar el envío de comprobantes y recordatorios.");
                        return;
                      }
                      setErrorGoogleOnboarding("");
                      setPasoGoogleOnboarding(2);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm py-4 rounded-2xl shadow-lg shadow-blue-600/25 transition-all transform active:scale-95 cursor-pointer mt-3"
                  >
                    <span>Continuar al siguiente paso</span>
                    <ArrowRight size={18}/>
                  </button>
                </div>
              )}

              {/* ===================== PASO 2: SELECCIÓN DE PLAN ===================== */}
              {pasoGoogleOnboarding === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles size={20}/>
                    </div>
                    <div>
                      <div className="text-xs font-black text-blue-950 dark:text-blue-200">
                        {formGoogleOnboarding.nombreNegocio}
                      </div>
                      <div className="text-[11px] text-blue-700 dark:text-blue-300">
                        {formGoogleOnboarding.tipoNegocio} • WhatsApp: {formGoogleOnboarding.telefonoNegocio}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Selecciona tu Plan de Inicio
                    </label>
                  </div>

                  {/* Canjear Código en Google Onboarding */}
                  <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <Tag size={13} className="text-blue-600 dark:text-blue-400"/>
                        ¿Tienes un código de suscripción o descuento?
                      </span>
                      {codigoAplicado && (
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md">
                          {codigoAplicado.codigo} ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Ej. PRO2026"
                        value={codigoInput}
                        onChange={e => {
                          setCodigoInput(e.target.value);
                          setErrorCodigo("");
                          setExitoCodigo("");
                        }}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500 dark:text-white flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => validarCodigo(undefined, googleUserPendiente.email)}
                        disabled={validandoCodigo || !codigoInput.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 px-3.5 rounded-xl disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {validandoCodigo ? "..." : "Aplicar"}
                      </button>
                    </div>
                    {errorCodigo && <p className="text-rose-500 text-[11px] font-bold flex items-center gap-1"><AlertCircle size={12}/>{errorCodigo}</p>}
                    {exitoCodigo && <p className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1"><CheckCircle2 size={12}/>{exitoCodigo}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Plan Comercio */}
                    <button
                      type="button"
                      onClick={() => setFormGoogleOnboarding({...formGoogleOnboarding, plan: 'comercio'})}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                        formGoogleOnboarding.plan === 'comercio'
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white inline-block mb-1.5">
                          14 Días Gratis
                        </span>
                        <div className="font-black text-sm text-slate-900 dark:text-white">Plan Comercio</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Comprobantes WhatsApp, ventas y 1 caja.
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-3 flex items-center gap-1">
                        <Check size={12}/> Recomendado
                      </div>
                    </button>

                    {/* Plan PRO */}
                    <button
                      type="button"
                      onClick={() => setFormGoogleOnboarding({...formGoogleOnboarding, plan: 'pro'})}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                        formGoogleOnboarding.plan === 'pro'
                          ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100 shadow-md ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white inline-block mb-1.5">
                          14 Días Gratis
                        </span>
                        <div className="font-black text-sm text-slate-900 dark:text-white">Plan PRO</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Plan Separe con fotos, hasta 4 cajeros y reportes top.
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mt-3 flex items-center gap-1">
                        <Crown size={12}/> Más Completo
                      </div>
                    </button>

                    {/* Plan Gratuito */}
                    <button
                      type="button"
                      onClick={() => setFormGoogleOnboarding({...formGoogleOnboarding, plan: 'gratis'})}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                        formGoogleOnboarding.plan === 'gratis'
                          ? 'border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 inline-block mb-1.5">
                          Sin costo
                        </span>
                        <div className="font-black text-sm text-slate-900 dark:text-white">Plan Básico</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Registro de cuentas y fiados esenciales.
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-3">
                        Siempre gratis
                      </div>
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-left">
                    <input
                      type="checkbox"
                      id="acepta_terminos_google_check"
                      checked={aceptaTerminosGoogle}
                      onChange={e => {
                        setAceptaTerminosGoogle(e.target.checked);
                        if (errorGoogleOnboarding) setErrorGoogleOnboarding("");
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer shrink-0 accent-blue-600"
                    />
                    <label htmlFor="acepta_terminos_google_check" className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug cursor-pointer font-medium">
                      Declaro que he leído y acepto los{" "}
                      <a href="/terminos" target="_blank" className="text-blue-600 dark:text-blue-400 font-black underline">
                        Términos del Servicio
                      </a>{" "}
                      y la{" "}
                      <a href="/privacidad" target="_blank" className="text-blue-600 dark:text-blue-400 font-black underline">
                        Política de Privacidad
                      </a>{" "}
                      (Ley 1581 de Habeas Data).
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPasoGoogleOnboarding(1)}
                      className="px-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Atrás
                    </button>

                    <button 
                      type="submit" 
                      disabled={guardandoGoogleOnboarding}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-black text-sm py-4 rounded-2xl shadow-xl shadow-blue-600/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {guardandoGoogleOnboarding ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>Creando tu tienda...</span>
                        </>
                      ) : (
                        <>
                          <PartyPopper size={18}/>
                          <span>Crear mi Negocio y Comenzar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={cancelarGoogleOnboarding}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Cancelar e iniciar con otra cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 16. MODAL LEGAL INFORMATIVO (TÉRMINOS Y PRIVACIDAD) */}
      {modalLegal.visible && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[85vh] overflow-y-auto text-left">
            <button 
              type="button"
              onClick={() => setModalLegal({ visible: false, titulo: "", tipo: null })} 
              className="absolute top-6 right-6 bg-slate-100 dark:bg-[#020617] text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full p-2 transition-colors cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {modalLegal.titulo}
              </h3>
            </div>

            {modalLegal.tipo === 'terminos' ? (
              <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">1. Objeto del Servicio</h4>
                  <p>Fiabono es una plataforma de software como servicio (SaaS) orientada al registro, control interno y administración de ventas, fiados, abonos, planes separe e inventarios para comercios independientes.</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">2. Propiedad de la Información</h4>
                  <p>Toda la información registrada (catálogo de productos, clientes, montos de transacciones y saldos deudores) es propiedad única y exclusiva del titular de la cuenta.</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">3. Cuentas y Accesos</h4>
                  <p>El administrador es responsable de la custodia de sus credenciales y de los permisos otorgados a sus usuarios colaboradores.</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">4. Sin Ataduras ni Permanencia y Soporte</h4>
                  <p>No existen contratos de permanencia mínima obligatoria. Puedes gestionar tu suscripción en cualquier momento. Para soporte y consultas: <strong className="text-emerald-600 dark:text-emerald-400">fiabono.app@gmail.com</strong>.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">1. Compromiso de Habeas Data (Ley 1581 de 2012)</h4>
                  <p>Fiabono garantiza el estricto cumplimiento de la legislación colombiana sobre protección y tratamiento de datos personales. Canal de atención: <strong className="text-emerald-600 dark:text-emerald-400">fiabono.app@gmail.com</strong>.</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">2. Finalidad del Tratamiento</h4>
                  <p>Los datos solicitados se emplean exclusivamente para la operatividad de la plataforma (generación de comprobantes digitales, respaldo seguro en la nube y autenticación de accesos).</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">3. Confidencialidad y No Comercialización</h4>
                  <p>Fiabono jamás vende, cede ni comercializa información de clientes, deudas ni registros contables con terceras entidades o centrales de riesgo.</p>
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white mb-1">4. Seguridad Técnica</h4>
                  <p>Toda la comunicación está protegida mediante cifrado SSL/TLS de 256 bits y alojada en centros de datos de alta disponibilidad y seguridad de Google Cloud.</p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <a
                href={modalLegal.tipo === 'terminos' ? '/terminos' : '/privacidad'}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Ver documento completo</span>
                <ArrowRight size={12} />
              </a>

              <button
                type="button"
                onClick={() => setModalLegal({ visible: false, titulo: "", tipo: null })}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              >
                Entendido y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}