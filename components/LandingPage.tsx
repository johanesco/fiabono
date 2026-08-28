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
  Receipt, ShoppingBag, BarChart3, Clock
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
        
        // Si eligió Comercio o PRO, otorgamos 14 días de prueba completa
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      
      {/* 1. HEADER NAVEGACIÓN GLASSOVERLAY */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-2xl border-b border-slate-200/60 dark:border-slate-800/60 z-[500] px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Receipt size={20} className="text-white"/>
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Fiabono<span className="text-blue-600 dark:text-blue-400">.com</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600 dark:text-slate-300">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Inicio</button>
            <button onClick={() => document.getElementById('soluciones')?.scrollIntoView({behavior: 'smooth'})} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">Funciones</button>
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

      {/* 2. HERO SECTION CON EFECTO MODERNO Y MOCKUP INTERACTIVO */}
      <section className="pt-32 sm:pt-40 pb-20 px-4 sm:px-6 max-w-7xl mx-auto relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-gradient-to-tr from-blue-500/15 via-indigo-500/10 to-emerald-500/15 rounded-full blur-3xl pointer-events-none -z-10"></div>
        
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-black text-xs uppercase tracking-widest mb-6 border border-blue-200/60 dark:border-blue-500/20 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Zap size={14} className="fill-current text-amber-500" /> Sistema POS, Cartera y Plan Separe
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1] sm:leading-[1.08]">
            El software POS más fácil para <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500">vender, fiar y cobrar</span>.
          </h1>

          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            Dile adiós al cuaderno de fiados y a las cuentas enredadas. Controla tu inventario, imprime facturas y etiquetas con código QR, aparta mercancía con Plan Separe y envía notificaciones por WhatsApp en 1 toque.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <button 
              type="button" 
              onClick={() => abrirRegistroConPlan('gratis')} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-base sm:text-lg font-black py-4 px-8 rounded-2xl shadow-xl shadow-blue-600/30 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Crear cuenta gratis</span>
              <ArrowRight size={20}/>
            </button>
            <button 
              type="button" 
              onClick={() => document.getElementById('planes')?.scrollIntoView({behavior: 'smooth'})} 
              className="w-full sm:w-auto bg-white dark:bg-[#0f172a] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white text-base sm:text-lg font-bold py-4 px-7 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors shadow-sm cursor-pointer"
            >
              Ver Planes y Precios
            </button>
          </div>

          {/* Social Proof */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-500" /> Sin tarjeta de crédito
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-500" /> Celular, Tablet y Computador
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-500" /> 100% en la Nube
            </div>
          </div>
        </div>

        {/* MOCKUP INTERACTIVO DEL SISTEMA */}
        <div className="mt-14 sm:mt-16 max-w-5xl mx-auto bg-white/70 dark:bg-[#0f172a]/70 backdrop-blur-xl rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Panel Izquierdo: Cobro en Mostrador */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-mono font-bold text-slate-400 ml-2">fiabono.com/dashboard/vender</span>
                </div>
                <span className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-md">Venta Rápida</span>
              </div>

              <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>PRODUCTO</span>
                  <span>CANT / VALOR</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-sm">
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">Vestido Lino Estampado</p>
                      <p className="text-xs text-slate-400">SKU: VEST-09 • Talla M</p>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">$65.000</span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-sm">
                    <div>
                      <p className="font-black text-slate-800 dark:text-white">Sandalias Plataforma</p>
                      <p className="text-xs text-slate-400">SKU: ZAP-41 • #37</p>
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">$45.000</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Total a Cobrar:</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">$110.000</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-emerald-500 text-white rounded-xl text-center font-black text-xs flex items-center justify-center gap-1.5 shadow-sm">
                  <CheckCircle2 size={15}/> Venta Contado
                </div>
                <div className="p-3 bg-rose-500 text-white rounded-xl text-center font-black text-xs flex items-center justify-center gap-1.5 shadow-sm">
                  <ShoppingBag size={15}/> Fiar al Cliente
                </div>
              </div>
            </div>

            {/* Panel Derecho: Notificación de WhatsApp y Factura */}
            <div className="lg:col-span-5 space-y-3">
              {/* Burbuja WhatsApp */}
              <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg relative font-sans text-xs space-y-2">
                <div className="flex items-center gap-2 font-black border-b border-emerald-400/40 pb-2">
                  <MessageCircle size={16} /> Comprobante Digital por WhatsApp
                </div>
                <p className="text-emerald-50 text-[11px] leading-relaxed">
                  🛒 *VENTA REGISTRADA — Boutique Sofía*<br/>
                  ──────────────────<br/>
                  • Vestido Lino Estampado x1 $\rightarrow$ $65.000<br/>
                  • Sandalias Plataforma x1 $\rightarrow$ $45.000<br/>
                  ──────────────────<br/>
                  *Total:* $110.000 (Pagado en Efectivo)<br/>
                  ¡Gracias por su compra! 🙌
                </p>
              </div>

              {/* Ficha Factura Térmica */}
              <div className="bg-white text-slate-900 p-4 rounded-2xl border border-slate-200 shadow-md font-mono text-[10px] space-y-1">
                <div className="text-center pb-2 border-b border-dashed border-slate-300">
                  <p className="font-black text-xs">BOUTIQUE SOFÍA</p>
                  <p className="text-[9px] text-slate-500">NIT: 901.442.110-3 • Factura #0042</p>
                </div>
                <div className="flex justify-between font-bold pt-1">
                  <span>TOTAL PAGADO:</span>
                  <span className="font-black">$110.000</span>
                </div>
                <div className="pt-2 flex justify-center">
                  <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold">
                    <QrCode size={12}/> Impresión 58mm / 80mm
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. BENTO GRID DE BENEFICIOS Y TECNOLOGÍA */}
      <section id="soluciones" className="py-24 px-4 sm:px-6 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider mb-3">
            <Sparkles size={14} /> Todo lo que tu negocio necesita
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Diseñado para vender más rápido y sin estrés
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: WhatsApp */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <MessageCircle size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Comprobantes por WhatsApp</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Envía comprobantes de ventas, fiados, abonos y separes al WhatsApp de tus clientes en 1 toque. Cero papelitos y cuentas siempre claras.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-emerald-600 flex items-center gap-1">
              Incluido en todos los planes <CheckCircle2 size={14}/>
            </div>
          </div>

          {/* Card 2: Plan Separe */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] border-2 border-purple-500/30 shadow-sm flex flex-col justify-between hover:border-purple-500 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-purple-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl">Exclusivo PRO</div>
            <div>
              <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shirt size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Módulo Plan Separe</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Aparta prendas o mercancía, registra fotos de los artículos, recibe abonos parciales y monitorea las fechas límite con alertas de vencimiento.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-purple-600 flex items-center gap-1">
              Con alertas y fotos de prendas <Crown size={14}/>
            </div>
          </div>

          {/* Card 3: Etiquetas Adhesivas QR */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between hover:border-indigo-500/50 transition-colors group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <QrCode size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Etiquetas Adhesivas con QR</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Genera e imprime planchas térmicas con el Código QR, Nombre y Precio para etiquetar tus productos y cobrar en 1 segundo con la cámara.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-indigo-600 flex items-center gap-1">
              Formato térmico modificable <Crown size={14}/>
            </div>
          </div>

          {/* Card 4: Inventario Inteligente */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between hover:border-blue-500/50 transition-colors group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Store size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Inventario en Tiempo Real</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Descuento automático de stock en cada venta o fiado, alertas de productos por agotarse y cálculo exacto del dinero invertido en mercancía.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-blue-600 flex items-center gap-1">
              Sin descuadres de bodega <CheckCircle2 size={14}/>
            </div>
          </div>

          {/* Card 5: Facturación Térmica POS */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between hover:border-amber-500/50 transition-colors group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Printer size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Facturas Térmicas 58/80mm</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Imprime recibos y tickets profesionales en cualquier impresora Bluetooth, USB o de red, con el logo y los datos de tu empresa.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-amber-600 flex items-center gap-1">
              Compatible con impresoras POS <CheckCircle2 size={14}/>
            </div>
          </div>

          {/* Card 6: Colaboradores y Permisos */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] border border-slate-200/70 dark:border-slate-800/70 shadow-sm flex flex-col justify-between hover:border-sky-500/50 transition-colors group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Colaboradores Seguros</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Permite a tus empleados registrar ventas y atender mostrador sin que vean tus ganancias totales y ocultando los números de teléfono de clientes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs font-bold text-sky-600 flex items-center gap-1">
              Permisos personalizados <CheckCircle2 size={14}/>
            </div>
          </div>

        </div>
      </section>

      {/* 4. SECCIÓN DE PLANES Y PRECIOS SAAS */}
      <section id="planes" className="py-24 px-4 sm:px-6 max-w-7xl mx-auto text-center border-t border-slate-200/60 dark:border-slate-800/60 scroll-mt-20">
        <div className="max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest mb-3 border border-emerald-200/60 dark:border-emerald-500/20">
            <Sparkles size={14} className="fill-current" /> Planes diseñados para tu crecimiento
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
            Elige el plan ideal para tu negocio
          </h2>
          <p className="text-slate-600 dark:text-slate-400 font-medium text-base sm:text-lg">
            Empieza 100% gratis. Cuando necesites más capacidad, pasa a Comercio o PRO en cualquier momento.
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

      {/* 5. SECCIÓN DE PREGUNTAS FRECUENTES (FAQ ACORDEÓN) */}
      <section id="faq" className="py-24 px-4 sm:px-6 max-w-4xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider mb-3">
            <HelpCircle size={14} /> Resolvemos tus dudas
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Preguntas Frecuentes
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "¿Puedo usar Fiabono desde mi celular y mi computador al mismo tiempo?",
              a: "Sí, absolutamente. Fiabono funciona en la nube en tiempo real. Puedes abrirlo en tu teléfono Android o iPhone, tablet o computador portátil. Todos tus datos se sincronizan al instante."
            },
            {
              q: "¿Qué pasa si supero el límite del Plan Gratis?",
              a: "Tus datos nunca se pierden ni se bloquean. Podrás seguir viendo a tus clientes y vendiendo los productos registrados. Si deseas agregar más clientes o más productos, el sistema te invitará a pasar al Plan Comercio o PRO."
            },
            {
              q: "¿Qué tipo de impresora necesito para las facturas y etiquetas QR?",
              a: "Fiabono es compatible con cualquier impresora térmica estándar de 58mm o 80mm (Bluetooth, USB o Wi-Fi). También puedes generar los comprobantes para enviarlos directamente por WhatsApp sin necesidad de impresora física."
            },
            {
              q: "¿Cómo funciona el Módulo de Plan Separe en el Plan PRO?",
              a: "Te permite registrar prendas o productos apartados con foto, definir una fecha límite de pago, recibir abonos parciales y emitir comprobantes actualizados para que el cliente sepa exactamente cuánto saldo le resta."
            },
            {
              q: "¿Mis empleados pueden ver cuánto dinero gano en total?",
              a: "No. En el Modo Colaborador tú decides qué permisos otorgarles. Puedes ocultarles las estadísticas de caja, el historial total y los números de teléfono de tus clientes para máxima privacidad."
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

      {/* 6. CTA FINAL DE ALTA CONVERSIÓN */}
      <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white p-8 sm:p-14 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Organiza tu negocio hoy mismo en menos de 2 minutos.
            </h2>
            <p className="text-blue-100 text-sm sm:text-base font-medium">
              Crea tu cuenta gratuita sin tarjeta de crédito y toma el control total de tus ventas y cobranzas.
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

      {/* 7. FOOTER */}
      <footer className="py-12 px-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-[11px]">F</div>
            <span className="font-black text-slate-800 dark:text-white">Fiabono.com</span>
          </div>
          <p>© {new Date().getFullYear()} Fiabono. Todos los derechos reservados. Desarrollado para negocios en crecimiento.</p>
        </div>
      </footer>

      {/* 8. MODAL DE LOGIN / REGISTRO */}
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