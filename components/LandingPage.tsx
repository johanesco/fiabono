"use client";
import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { 
  CheckCircle2, ChevronRight, Star, BookX, PenTool, 
  MessageCircle, ShieldAlert, Store, Wallet, Shirt, Lock, 
  AlertCircle, X, Eye, EyeOff, Sparkles, Crown, Printer, 
  QrCode, FileSpreadsheet, Users, ArrowRight, Zap, 
  Smartphone, ShieldCheck, HelpCircle, ChevronDown, ChevronUp,
  Receipt, ShoppingBag, BarChart3, Clock, TrendingUp,
  Flame, BadgePercent, Check, ArrowUpRight, Calculator,
  Sparkle, Shield
} from 'lucide-react';

export default function LandingPage() {
  const [modalLandingInfo, setModalLandingInfo] = useState<{ visible: boolean, tipo: 'login' | 'registro' | null }>({ visible: false, tipo: null });
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", nombreUsuario: "", negocio: "" });
  const [authErrores, setAuthErrores] = useState({ email: "", password: "", confirmPassword: "", general: "" });
  const [cicloFacturacion, setCicloFacturacion] = useState<'mensual' | 'anual'>('mensual');
  const [planSeleccionadoRegistro, setPlanSeleccionadoRegistro] = useState<'gratis' | 'comercio' | 'pro'>('gratis');
  
  // Visibilidad de contraseñas
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);

  // Tab de Mockup Interactivo
  const [tabMockup, setTabMockup] = useState<'pos' | 'whatsapp' | 'ticket' | 'separe'>('pos');

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
        
        let diasPrueba = planSeleccionadoRegistro !== 'gratis' ? 14 : null;
        let fechaVence = null;
        if (diasPrueba) {
          const d = new Date();
          d.setDate(d.getDate() + diasPrueba);
          fechaVence = d;
        }

        await setDoc(doc(db, "usuarios", credencial.user.uid), { 
          nombreUsuario: authForm.nombreUsuario.trim(),
          nombreNegocio: authForm.negocio.trim(), 
          email: loginEmail, 
          telefonoNegocio: "",
          rol: "admin",
          plan: planSeleccionadoRegistro,
          planVence: fechaVence,
          cicloPlan: cicloFacturacion
        });
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
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-[11px] sm:text-xs font-black py-2 px-4 text-center flex items-center justify-center gap-2">
        <span>🇨🇴 El Sistema POS preferido por más de 1.800 comercios y almacenes en Colombia</span>
        <span className="hidden sm:inline-block bg-white/20 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">14 días de prueba gratis</span>
      </div>

      {/* 2. HEADER NAVEGACIÓN GLASSOVERLAY */}
      <header className="sticky top-0 bg-white/85 dark:bg-[#0f172a]/85 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 z-[500] px-4 sm:px-8 py-3.5 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Receipt size={20} className="text-white"/>
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Fiabono<span className="text-blue-600 dark:text-blue-400">.com</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-7 text-xs lg:text-sm font-bold text-slate-600 dark:text-slate-300">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Inicio</button>
            <button onClick={() => document.getElementById('comparativa')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Cuaderno vs POS</button>
            <button onClick={() => document.getElementById('calculadora')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Calculadora</button>
            <button onClick={() => document.getElementById('nichos')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Tu Negocio</button>
            <button onClick={() => document.getElementById('planes')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Planes</button>
            <button onClick={() => document.getElementById('faq')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Preguntas</button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button 
              type="button" 
              onClick={() => setModalLandingInfo({ visible: true, tipo: 'login' })} 
              className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-3 py-2 cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('gratis')} 
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-black py-2.5 px-4 sm:px-5 rounded-xl shadow-md shadow-blue-600/25 transition-transform active:scale-95 cursor-pointer"
            >
              Empezar Gratis
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION DE ALTO IMPACTO EMOCIONAL */}
      <section className="pt-16 sm:pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-blue-500/20 via-indigo-500/15 to-emerald-500/20 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-widest mb-6 border border-rose-200/60 dark:border-rose-500/20 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Flame size={14} className="fill-current text-rose-500" /> El fin de las pérdidas y el desorden
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1] sm:leading-[1.06]">
            Deja de perder plata en cuadernos y cuentas <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500">embolatadas</span>.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            El sistema POS más rápido y fácil de Colombia para <strong>vender, fiar y cobrar por WhatsApp</strong>. Controla tu inventario, imprime facturas y etiquetas QR, y gestiona tu <strong>Plan Separe</strong> sin perder una sola prenda.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('gratis')} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-base sm:text-lg font-black py-4 px-8 rounded-2xl shadow-xl shadow-blue-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
            <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-full border border-blue-200/50">
              <Smartphone size={15} className="text-blue-500" /> Usa tu celular actual o PC
            </div>
            <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-full border border-purple-200/50">
              <ShieldCheck size={15} className="text-purple-500" /> Cuentas seguras en la nube
            </div>
          </div>
        </div>

        {/* 4. MOCKUP INTERACTIVO MULTIVISTA (4 PESTAÑAS) */}
        <div className="mt-14 max-w-5xl mx-auto bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Selector de Pestañas de Vista Previa */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar border-b border-slate-100 dark:border-slate-800">
            {[
              { id: 'pos', nombre: '1. Venta en Mostrador', icono: ShoppingBag },
              { id: 'whatsapp', nombre: '2. Recibo por WhatsApp', icono: MessageCircle },
              { id: 'ticket', nombre: '3. Factura Térmica QR', icono: Printer },
              { id: 'separe', nombre: '4. Ficha Plan Separe', icono: Shirt },
            ].map(tab => {
              const Icon = tab.icono;
              const activo = tabMockup === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTabMockup(tab.id as any)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    activo 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.nombre}</span>
                </button>
              );
            })}
          </div>

          {/* Contenido Dinámico de la Pestaña */}
          {tabMockup === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-7 space-y-4 bg-slate-50 dark:bg-[#020617] p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span className="text-xs font-bold text-slate-500">CANASTA DE VENTA ACTIVA</span>
                  <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-md">1 Toque</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-sm">
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">Vestido Lino Estampado</p>
                      <p className="text-xs text-slate-400">Talla M • Ref: VEST-09</p>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">$65.000</span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-sm">
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">Sandalias Plataforma</p>
                      <p className="text-xs text-slate-400">#37 • Ref: ZAP-41</p>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">$45.000</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Total a Pagar:</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">$110.000</span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-emerald-500 text-white rounded-xl text-center font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm">
                    <CheckCircle2 size={16}/> Cobrar Contado
                  </div>
                  <div className="p-3 bg-rose-500 text-white rounded-xl text-center font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm">
                    <ShoppingBag size={16}/> Fiar con Cupo
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 space-y-3 text-left">
                <h4 className="text-xl font-black text-slate-900 dark:text-white">Cobro sin filas ni retrasos</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Busca productos por nombre, código de barras o código QR. Elige si el cliente paga en efectivo, transferencia (Nequi/Daviplata) o si lo lleva fiado con un clic.
                </p>
                <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                  💡 Descuenta el stock automáticamente y actualiza la caja al instante.
                </div>
              </div>
            </div>
          )}

          {tabMockup === 'whatsapp' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-6 bg-emerald-600 text-white p-5 rounded-2xl shadow-xl font-sans text-xs space-y-3 text-left">
                <div className="flex items-center justify-between border-b border-emerald-400/40 pb-2 font-black">
                  <span className="flex items-center gap-1.5"><MessageCircle size={16}/> WhatsApp del Cliente</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Enviado en 1 toque</span>
                </div>
                <div className="bg-emerald-700/50 p-3.5 rounded-xl space-y-1.5 text-[11px] leading-relaxed">
                  <p className="font-bold text-emerald-200">🛒 *VENTA CONFIRMADA — Boutique Glamour*</p>
                  <p className="border-t border-emerald-500/40 pt-1">Cliente: *María Camila Gómez*</p>
                  <p>• Vestido Lino Estampado x1 $\rightarrow$ $65.000</p>
                  <p>• Sandalias Plataforma x1 $\rightarrow$ $45.000</p>
                  <p className="font-black text-sm pt-1 border-t border-emerald-500/40 text-emerald-100">*Total:* $110.000 (Pagado en Efectivo)</p>
                  <p className="text-[10px] text-emerald-300 pt-1">¡Gracias por su compra! 🙌</p>
                </div>
              </div>
              <div className="lg:col-span-6 space-y-3 text-left">
                <h4 className="text-xl font-black text-slate-900 dark:text-white">Cero papel, cero pena al cobrar</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  El cliente recibe el comprobante directamente en su WhatsApp. Si es un fiado o un abono, el mensaje detalla exactamente cuánto pagó y cuánto saldo le resta.
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  📱 Cuentas claras evitan discusiones y aceleran el pago de deudas.
                </div>
              </div>
            </div>
          )}

          {tabMockup === 'ticket' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-6 flex justify-center">
                <div className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-200 shadow-xl font-mono text-[11px] space-y-2 w-full max-w-sm text-left">
                  <div className="text-center pb-2 border-b border-dashed border-slate-300">
                    <p className="font-black text-sm tracking-wider">BOUTIQUE GLAMOUR</p>
                    <p className="text-[10px] text-slate-500">NIT: 901.554.210-4 • Factura #0089</p>
                    <p className="text-[9px] text-slate-400">Cra 15 # 45-20 • Cel: 312 456 7890</p>
                  </div>
                  <div className="space-y-1 py-1">
                    <div className="flex justify-between"><span>Vestido Lino M</span><span>$65.000</span></div>
                    <div className="flex justify-between"><span>Sandalias #37</span><span>$45.000</span></div>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-2 flex justify-between font-black text-sm">
                    <span>TOTAL:</span>
                    <span>$110.000</span>
                  </div>
                  <div className="pt-2 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded text-[10px] font-bold text-slate-600">
                      <QrCode size={13}/> Tirilla 58mm / 80mm
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 space-y-3 text-left">
                <h4 className="text-xl font-black text-slate-900 dark:text-white">Imprime en cualquier impresora térmica</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Compatible con impresoras Bluetooth de celular, USB para computador o Wi-Fi. Incluye el logo de tu negocio, NIT, dirección y mensaje de pie de factura.
                </p>
                <div className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-500/20">
                  🧾 Dale presencia formal y profesional a tu establecimiento.
                </div>
              </div>
            </div>
          )}

          {tabMockup === 'separe' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center animate-in fade-in duration-300">
              <div className="lg:col-span-6 bg-purple-900/10 dark:bg-purple-950/30 p-5 rounded-2xl border-2 border-purple-500/40 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 px-2.5 py-1 rounded-full">
                    👑 Módulo Separe PRO
                  </span>
                  <span className="text-xs font-bold text-rose-500">📅 Vence en 8 días</span>
                </div>
                <div className="bg-white dark:bg-[#0f172a] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <p className="font-black text-slate-900 dark:text-white text-sm">Cliente: Natalia Restrepo</p>
                  <p className="text-slate-500">Prenda: Jean Levantacola Talla 8 (Azul Oscuro)</p>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full w-[65%]"></div>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1">
                    <span className="text-emerald-600">Abonado: $65.000</span>
                    <span className="text-rose-500">Saldo: $35.000</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 space-y-3 text-left">
                <h4 className="text-xl font-black text-slate-900 dark:text-white">Aparta prendas con fotos y alertas</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Toma foto a la mercancía apartada, define fecha límite, registra abonos parciales y activa alertas antes de que se venza el plazo para liberar la prenda o avisar al cliente.
                </p>
                <div className="bg-purple-50 dark:bg-purple-500/10 p-3 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-500/20">
                  👗 Aumenta hasta un 35% la rotación de mercancía en temporadas altas.
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
              ⚠️ Un negocio pierde en promedio $300.000 COP al mes en deudas no cobradas.
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
                  <span><strong>Comprobante directo a WhatsApp:</strong> Cada abono o fiado genera un recibo digital claro y formal en 1 toque.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Respaldo 100% en la Nube:</strong> Si cambias o pierdes el celular, abres sesión en otro equipo y todo está intacto.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Cierre de caja automático en 2 segundos:</strong> Sabes cuánto entró en efectivo, Nequi, transferencias y qué está fiado.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-black shrink-0">✓</span>
                  <span><strong>Alertas de vencimiento de Separes:</strong> Fotos de las prendas, fechas límite y recordatorios para liberar mercancía.</span>
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
        <div className="flex justify-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
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
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Cuadre de caja Nequi/Efectivo</span>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-6 rounded-2xl border border-blue-200/60 dark:border-blue-900/40 space-y-2">
                <p className="font-black text-sm text-blue-900 dark:text-blue-200">Testimonio Real:</p>
                <p className="text-xs italic text-slate-600 dark:text-slate-300">
                  "Antes los vecinos me decían 'anóteme ahí' y luego se enredaban las cuentas. Ahora les llega su extracto por WhatsApp y pagan sin chistar."
                </p>
                <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 pt-1">— Don Gustavo Morales, Minimarket El Trébol (Bogotá)</p>
              </div>
            </div>
          )}

          {tabNicho === 'moda' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-purple-600 uppercase tracking-wider">Almacenes de Ropa, Calzado & Boutiques</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Módulo Plan Separe con fotos de prendas y fechas límite</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Tus clientas apartan vestidos o zapatos para quincena. Tomas foto a la prenda, fijas la fecha de vencimiento y registras abonos parciales. Si el plazo vence, el sistema te avisa para cobrar o liberar el artículo.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Fotos de prendas apartadas</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Alertas automáticas de vencimiento</span>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 p-6 rounded-2xl border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                <p className="font-black text-sm text-purple-900 dark:text-purple-200">Testimonio Real:</p>
                <p className="text-xs italic text-slate-600 dark:text-slate-300">
                  "El Plan Separe con foto me salvó el negocio. Se acabaron los reclamos de 'esa no era la blusa que yo aparté'. Mis clientas aman los comprobantes."
                </p>
                <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 pt-1">— Marcela Restrepo, Boutique Glamour (Medellín)</p>
              </div>
            </div>
          )}

          {tabNicho === 'ferreteria' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">Papelerías, Ferreterías & Misceláneas</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Etiquetas adhesivas con Código QR y precios</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Miles de productos pequeños con precios cambiantes. Generas e imprimes planchas térmicas con el QR, Nombre y Precio para etiquetar estantes y cobrar en 1 segundo con la cámara del celular.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Planchas de etiquetas QR</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Carga masiva en Excel</span>
                </div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 space-y-2">
                <p className="font-black text-sm text-indigo-900 dark:text-indigo-200">Testimonio Real:</p>
                <p className="text-xs italic text-slate-600 dark:text-slate-300">
                  "Etiqueté toda la tornillería y herramientas. Mis colaboradores ahora solo escanean con la cámara y facturan sin equivocarse en los precios."
                </p>
                <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 pt-1">— Julián Lozano, Ferretería La Central (Cali)</p>
              </div>
            </div>
          )}

          {tabNicho === 'belleza' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-in fade-in duration-300">
              <div className="space-y-4">
                <span className="text-xs font-black text-rose-600 uppercase tracking-wider">Cosméticos, Belleza & Venta por Catálogo</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Cobro profesional a clientas de campañas y quincenas</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Maneja la lista de clientas por campaña (Novaventa, Yanbal, Avon, etc.). Envía recordatorios de cobro personalizados en quincena y registra abonos parciales sin confusiones.
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Recordatorios de quincena</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">✓ Historial de compras por clienta</span>
                </div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/30 p-6 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 space-y-2">
                <p className="font-black text-sm text-rose-900 dark:text-rose-200">Testimonio Real:</p>
                <p className="text-xs italic text-slate-600 dark:text-slate-300">
                  "Cobrar me daba mucha pena. El extracto de Fiabono se ve tan formal que mis clientas me transfieren puntual los días 15 y 30."
                </p>
                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 pt-1">— Carmen Alicia Barrios, Distribuidora de Belleza (Barranquilla)</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 8. TESTIMONIOS Y PRUEBA SOCIAL POR CIUDADES */}
      <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider mb-3">
            <Star size={14} className="fill-current" /> Respaldado por comerciantes reales
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Comerciantes en toda Colombia que transformaron su negocio
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-1 text-amber-400 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} size={15} className="fill-current"/>)}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                "En diciembre el Plan Separe era un dolor de cabeza. Con Fiabono registré más de 80 prendas con foto y ninguna se me embolató. Recuperé todo el dinero a tiempo."
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="font-black text-sm text-slate-900 dark:text-white">Marcela Restrepo</p>
              <p className="text-xs text-slate-400">Marcela Boutique • Medellín</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-1 text-amber-400 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} size={15} className="fill-current"/>)}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                "Cerrar caja los domingos me tomaba 2 horas con calculadora. Ahora en 2 minutos sé exactamente cuánto entró en efectivo, Nequi y cuánto está fiado en el barrio."
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="font-black text-sm text-slate-900 dark:text-white">Don Gustavo Morales</p>
              <p className="text-xs text-slate-400">Minimarket El Trébol • Bogotá</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-1 text-amber-400 mb-3">
                {[...Array(5)].map((_, i) => <Star key={i} size={15} className="fill-current"/>)}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                "Mis empleados registran ventas sin poder ver mis ganancias totales. La privacidad y la facilidad para imprimir facturas térmicas es insuperable."
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <p className="font-black text-sm text-slate-900 dark:text-white">Julián Lozano</p>
              <p className="text-xs text-slate-400">Ferretería La Central • Cali</p>
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

        {/* Switch Mensual / Anual */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <span className={`text-sm font-bold transition-colors ${cicloFacturacion === 'mensual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Mensual</span>
          <button
            type="button"
            onClick={() => setCicloFacturacion(prev => prev === 'mensual' ? 'anual' : 'mensual')}
            className="w-14 h-8 bg-blue-600 rounded-full p-1 transition-colors relative cursor-pointer focus:outline-none"
          >
            <div className={`w-6 h-6 bg-white rounded-full transition-transform shadow-md ${cicloFacturacion === 'anual' ? 'translate-x-6' : 'translate-x-0'}`}></div>
          </button>
          <span className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${cicloFacturacion === 'anual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
            Anual <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase px-2 py-0.5 rounded-md">Ahorra 2 meses</span>
          </span>
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
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> 1 Usuario Administrador (0 Colaboradores)</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Hasta 15 clientes registrados</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Hasta 30 productos en catálogo</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Hasta 40 ventas, fiados y abonos/mes</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Notificación de comprobante por WhatsApp</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-500 shrink-0"/> Descuento automático de inventario</li>
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
          <div className="bg-blue-600 dark:bg-blue-700 p-8 rounded-[2.5rem] border-2 border-blue-400 flex flex-col shadow-2xl shadow-blue-600/30 relative text-white transform lg:-translate-y-3">
            <div className="absolute top-0 right-0 bg-emerald-400 text-slate-900 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
              Más Popular
            </div>
            <div className="mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-100 bg-blue-500/50 px-3 py-1 rounded-full">
                Plan Comercio
              </span>
            </div>
            <h3 className="text-2xl font-black mb-1 text-white mt-3">Para Tiendas y Negocios</h3>
            <p className="text-blue-100 text-xs mb-6 h-8">La solución para negocios con alto volumen y mostrador.</p>
            
            <div className="mb-6">
              <span className="text-4xl font-black text-white">
                {cicloFacturacion === 'anual' ? '$199.000' : '$19.900'}
              </span>
              <span className="text-xs text-blue-200 font-bold ml-1">COP {cicloFacturacion === 'anual' ? '/ año' : '/ mes'}</span>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1 text-xs font-bold text-white">
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-300 shrink-0"/> Clientes e Inventario ILIMITADOS</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-300 shrink-0"/> Ventas, fiados y abonos ILIMITADOS</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-300 shrink-0"/> 1 Usuario Colaborador con permisos</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-300 shrink-0"/> Factura Imprimible en tirilla (58/80mm)</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-300 shrink-0"/> Alertas de Stock Bajo y Agotados</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-emerald-300 shrink-0"/> Reportes de Caja Neta y Cartera Activa</li>
            </ul>

            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('comercio')} 
              className="w-full bg-white text-blue-600 hover:bg-blue-50 font-black py-3.5 rounded-2xl shadow-lg transition-transform active:scale-95 cursor-pointer text-sm text-center"
            >
              Elegir Plan Comercio (14 días gratis)
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
              <span className="text-4xl font-black text-slate-900 dark:text-white">
                {cicloFacturacion === 'anual' ? '$449.000' : '$44.900'}
              </span>
              <span className="text-xs text-slate-500 font-bold ml-1">COP {cicloFacturacion === 'anual' ? '/ año' : '/ mes'}</span>
            </div>

            <ul className="flex flex-col gap-3 mb-8 flex-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Módulo PLAN SEPARE Completo con Alertas</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Generador de Etiquetas Adhesivas con Código QR</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> 4 Usuarios Colaboradores incluidos</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Modo Terminal Multivendedor en mostrador</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Importar y Exportar masivo en Excel</li>
              <li className="flex items-center gap-2.5"><CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400 shrink-0"/> Logo de tu Negocio en Facturas Térmicas</li>
            </ul>

            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('pro')} 
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-purple-600/20 transition-transform active:scale-95 cursor-pointer text-sm text-center"
            >
              Elegir PRO Almacén (14 días gratis)
            </button>
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
              q: "¿Puedo probar el sistema antes de pagar un solo peso?",
              a: "Sí, totalmente. Puedes registrarte y usar el Plan Gratuito para siempre. Si deseas probar las herramientas avanzadas de Comercio o PRO, disfrutas de 14 días de prueba completa sin necesidad de ingresar tarjeta de crédito."
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
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white p-8 sm:p-14 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Organiza tu negocio hoy mismo en menos de 2 minutos.
            </h2>
            <p className="text-blue-100 text-sm sm:text-base font-medium">
              Crea tu cuenta gratuita sin tarjeta de crédito y toma el control total de tus ventas, cobranzas y clientes.
            </p>
            <div className="pt-4 flex justify-center">
              <button 
                type="button" 
                onClick={() => abrirRegistroConPlan('gratis')}
                className="bg-white text-blue-700 hover:bg-blue-50 text-base sm:text-lg font-black py-4 px-8 rounded-2xl shadow-xl transition-transform active:scale-95 cursor-pointer"
              >
                Comenzar Gratis Ahora
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 12. FOOTER */}
      <footer className="py-12 px-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-[11px]">F</div>
            <span className="font-black text-slate-800 dark:text-white">Fiabono.com</span>
          </div>
          <p>© {new Date().getFullYear()} Fiabono. Todos los derechos reservados. Desarrollado para negocios en crecimiento.</p>
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
          className="bg-blue-600 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-md shadow-blue-600/30 active:scale-95 cursor-pointer"
        >
          Crear Cuenta
        </button>
      </div>

      {/* 14. MODAL DE LOGIN / REGISTRO */}
      {modalLandingInfo.visible && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}