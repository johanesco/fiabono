"use client";
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { 
  CheckCircle2, ChevronRight, Star, BookX, PenTool, 
  MessageCircle, ShieldAlert, Store, Wallet, Shirt, Lock, AlertCircle, X, Eye, EyeOff, Sparkles, Crown 
} from 'lucide-react';

export default function LandingPage() {
  const [modalLandingInfo, setModalLandingInfo] = useState<{ visible: boolean, tipo: 'login' | 'registro' | null }>({ visible: false, tipo: null });
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", nombreUsuario: "", negocio: "" });
  const [authErrores, setAuthErrores] = useState({ email: "", password: "", confirmPassword: "", general: "" });
  const [cicloFacturacion, setCicloFacturacion] = useState<'mensual' | 'anual'>('mensual');
  const [planSeleccionadoRegistro, setPlanSeleccionadoRegistro] = useState<'gratis' | 'comercio' | 'pro'>('gratis');
  
  // Estados para controlar la visibilidad de las contraseñas
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);

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
        
        // Si eligió Comercio o PRO, otorgamos 14 días de prueba gratuita completa
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-200 font-sans transition-colors duration-500 overflow-x-hidden">
      
      {/* HEADER SIEMPRE VISIBLE */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/60 z-[500] px-6 py-4 flex justify-between items-center transition-all shadow-sm">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
            <CheckCircle2 size={20} className="text-white"/>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Fiabono<span className="text-emerald-500">.com</span></h1>
        </div>
        
        <nav className="hidden sm:flex items-center gap-8 text-sm font-bold text-slate-500 dark:text-slate-400">
          <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Inicio</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => document.getElementById('beneficios')?.scrollIntoView({behavior: 'smooth'})}>Beneficios</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={() => document.getElementById('planes')?.scrollIntoView({behavior: 'smooth'})}>Planes</span>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 relative">
          <button type="button" onClick={() => setModalLandingInfo({ visible: true, tipo: 'login' })} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-3 py-2">Ingresar</button>
          <button type="button" onClick={() => setModalLandingInfo({ visible: true, tipo: 'registro' })} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-4 sm:px-5 rounded-full shadow-lg shadow-blue-600/20 transition-transform transform active:scale-95">Registrarse</button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="pt-28 pb-10">
        <section className="pb-24 px-6 max-w-5xl mx-auto flex flex-col items-center text-center mt-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-widest mb-8 border border-blue-100 dark:border-blue-500/20">
            <Star size={14} className="fill-current" /> La app de los negocios locales
          </div>
          <h2 className="text-5xl sm:text-7xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 leading-[1.15]">
            El fin del <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-500">cuaderno de papel.</span><br/> Cobra sin sentir pena.
          </h2>
          <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
            La aplicación súper fácil diseñada para dueños de negocio. Anota lo que fías, registra las ventas y envía un comprobante de notificación al WhatsApp en un solo toque.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button type="button" onClick={() => setModalLandingInfo({ visible: true, tipo: 'registro' })} className="relative z-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-black py-4 px-8 rounded-2xl shadow-xl transition-transform transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
              Crear mi cuenta gratis <ChevronRight size={24}/>
            </button>
          </div>
        </section>

        <section id="beneficios" className="py-24 bg-slate-100/50 dark:bg-[#020617] border-y border-slate-200/50 dark:border-slate-800/50 scroll-mt-20">
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

        <section id="planes" className="py-24 px-6 max-w-6xl mx-auto text-center border-t border-slate-100 dark:border-slate-800/50 scroll-mt-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-widest mb-4 border border-emerald-100 dark:border-emerald-500/20">
            <Sparkles size={14} className="fill-current" /> Planes diseñados para crecer
          </div>
          <h3 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Elige el plan ideal para tu negocio</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-10 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
            Comienza gratis hoy mismo. Cuando tu negocio crezca, pásate a Comercio o PRO para desbloquear herramientas avanzadas.
          </p>

          {/* Switch Mensual / Anual */}
          <div className="flex items-center justify-center gap-3 mb-16">
            <span className={`text-sm font-bold transition-colors ${cicloFacturacion === 'mensual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>Mensual</span>
            <button
              type="button"
              onClick={() => setCicloFacturacion(prev => prev === 'mensual' ? 'anual' : 'mensual')}
              className="w-14 h-8 bg-blue-600 rounded-full p-1 transition-colors relative cursor-pointer focus:outline-none"
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-transform ${cicloFacturacion === 'anual' ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
            <span className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${cicloFacturacion === 'anual' ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              Anual <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase px-2 py-0.5 rounded-md">Ahorra 2 meses</span>
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left items-stretch">
            {/* 1. PLAN GRATIS */}
            <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Plan Gratis</h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 h-8">Para quienes inician o venden desde casa.</p>
              
              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white">$0</span>
                <span className="text-xs text-slate-500 font-bold ml-1">/ para siempre</span>
              </div>

              <ul className="flex flex-col gap-3.5 mb-8 flex-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> 1 Usuario Administrador</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Hasta 15 clientes registrados</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Hasta 30 productos en catálogo</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Hasta 40 ventas/abonos al mes</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Notificación por WhatsApp</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-500 shrink-0"/> Descuento automático de stock</li>
              </ul>
              <button 
                type="button" 
                onClick={() => { setPlanSeleccionadoRegistro('gratis'); setModalLandingInfo({ visible: true, tipo: 'registro' }); }} 
                className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-black py-4 rounded-2xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
              >
                Comenzar Gratis
              </button>
            </div>
            
            {/* 2. PLAN COMERCIO */}
            <div className="bg-blue-600 dark:bg-blue-700 p-8 rounded-[2.5rem] border-2 border-blue-400 flex flex-col shadow-2xl shadow-blue-600/20 relative text-white transform md:-translate-y-2">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-2xl">Más Popular</div>
              <h4 className="text-2xl font-black mb-1 text-white">Plan Comercio</h4>
              <p className="text-blue-100 text-xs mb-6 h-8">El estándar para tiendas, minimarkets y boutiques.</p>
              
              <div className="mb-6">
                <span className="text-4xl font-black text-white">{cicloFacturacion === 'anual' ? '$199.000' : '$19.900'}</span>
                <span className="text-xs text-blue-200 font-bold ml-1">COP {cicloFacturacion === 'anual' ? '/ año' : '/ mes'}</span>
              </div>

              <ul className="flex flex-col gap-3.5 mb-8 flex-1 text-sm font-bold text-white">
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> Clientes e Inventario ILIMITADOS</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> Ventas, fiados y abonos ILIMITADOS</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> 1 Usuario Colaborador con permisos</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> Módulo PLAN SEPARE completo</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> Factura Imprimible (58/80mm)</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> Alertas de stock bajo y valorización</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-emerald-300 shrink-0"/> Reportes de caja neta y cartera</li>
              </ul>
              <button 
                type="button" 
                onClick={() => { setPlanSeleccionadoRegistro('comercio'); setModalLandingInfo({ visible: true, tipo: 'registro' }); }} 
                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                Elegir Plan Comercio
              </button>
            </div>

            {/* 3. PLAN PRO ALMACÉN */}
            <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border-2 border-purple-500/50 flex flex-col shadow-sm hover:shadow-md transition-shadow relative">
              <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-2xl">Control Total</div>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                <Crown size={20} className="text-amber-500" /> PRO Almacén
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-6 h-8">Para almacenes con equipo de trabajo y alto flujo.</p>
              
              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900 dark:text-white">{cicloFacturacion === 'anual' ? '$449.000' : '$44.900'}</span>
                <span className="text-xs text-slate-500 font-bold ml-1">COP {cicloFacturacion === 'anual' ? '/ año' : '/ mes'}</span>
              </div>

              <ul className="flex flex-col gap-3.5 mb-8 flex-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> Todo lo del Plan Comercio</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> 4 Usuarios Colaboradores incluidos</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> Modo Terminal Multivendedor</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> Etiquetas Adhesivas QR para productos</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> Importar y Exportar masivo en Excel</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> Logo del Negocio en la Factura</li>
                <li className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-purple-600 dark:text-purple-400 shrink-0"/> Historial total e informes de turnos</li>
              </ul>
              <button 
                type="button" 
                onClick={() => { setPlanSeleccionadoRegistro('pro'); setModalLandingInfo({ visible: true, tipo: 'registro' }); }} 
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                Elegir PRO Almacén
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* MODAL DE LOGIN/REGISTRO EXCLUSIVO DE LA LANDING CON Z-INDEX MÁXIMO */}
      {modalLandingInfo.visible && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in zoom-in-95 duration-200">
          <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/80 relative max-h-[90vh] overflow-y-auto">
            <button onClick={cerrarModal} className="absolute top-6 right-6 bg-slate-100 dark:bg-[#020617] text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full p-2 transition-colors"><X size={24}/></button>
            
            <div className="text-center mb-8 pt-4">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-6">
                {modalLandingInfo.tipo === 'login' ? <Lock size={36} className="text-white"/> : <Star size={36} className="text-white"/>}
              </div>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{modalLandingInfo.tipo === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta gratis'}</h3>
              <p className="text-base font-medium text-slate-500 dark:text-slate-400">{modalLandingInfo.tipo === 'login' ? 'Ingresa tus datos para acceder a tu panel.' : 'Únete a los negocios organizados.'}</p>
            </div>

            {authErrores.general && (
              <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-base font-bold text-center border border-rose-200 dark:border-rose-500/20 mb-6">
                {authErrores.general}
              </div>
            )}

            <form onSubmit={manejarAuth} className="flex flex-col gap-5">
              {modalLandingInfo.tipo === 'registro' && ( 
                <>
                  <input type="text" placeholder="Tu Nombre (Ej. María)" value={authForm.nombreUsuario} onChange={e => {setAuthForm({...authForm, nombreUsuario: e.target.value}); setAuthErrores({...authErrores, general: ""})}} className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" /> 
                  <input type="text" placeholder="Nombre de tu negocio" value={authForm.negocio} onChange={e => {setAuthForm({...authForm, negocio: e.target.value}); setAuthErrores({...authErrores, general: ""})}} className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg" /> 
                </>
              )}
              
              <div>
                <input type="text" placeholder={modalLandingInfo.tipo === 'login' ? "Correo electrónico o Usuario" : "Correo electrónico"} value={authForm.email} onChange={e => {setAuthForm({...authForm, email: e.target.value}); setAuthErrores({...authErrores, email: ""})}} className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border ${authErrores.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800/80'} rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg`} />
                {authErrores.email && <p className="text-rose-500 text-sm font-bold mt-2 ml-2 flex items-center gap-1"><AlertCircle size={14}/>{authErrores.email}</p>}
              </div>

              <div>
                <div className="relative">
                  <input 
                    type={mostrarPassword ? "text" : "password"} 
                    placeholder="Contraseña" 
                    value={authForm.password} 
                    onChange={e => {setAuthForm({...authForm, password: e.target.value}); setAuthErrores({...authErrores, password: ""})}} 
                    className={`w-full p-5 pr-12 bg-slate-50 dark:bg-[#020617] border ${authErrores.password ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800/80'} rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg`} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setMostrarPassword(!mostrarPassword)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none"
                  >
                    {mostrarPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>
                {authErrores.password && <p className="text-rose-500 text-sm font-bold mt-2 ml-2 flex items-center gap-1"><AlertCircle size={14}/>{authErrores.password}</p>}
              </div>

              {modalLandingInfo.tipo === 'registro' && (
                <div>
                  <div className="relative">
                    <input 
                      type={mostrarConfirmPassword ? "text" : "password"} 
                      placeholder="Confirmar Contraseña" 
                      value={authForm.confirmPassword} 
                      onChange={e => {setAuthForm({...authForm, confirmPassword: e.target.value}); setAuthErrores({...authErrores, confirmPassword: ""})}} 
                      className={`w-full p-5 pr-12 bg-slate-50 dark:bg-[#020617] border ${authErrores.confirmPassword ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800/80'} rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all font-bold text-lg`} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setMostrarConfirmPassword(!mostrarConfirmPassword)} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none"
                    >
                      {mostrarConfirmPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                  {authErrores.confirmPassword && <p className="text-rose-500 text-sm font-bold mt-2 ml-2 flex items-center gap-1"><AlertCircle size={14}/>{authErrores.confirmPassword}</p>}
                </div>
              )}

              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xl py-5 rounded-2xl shadow-lg transition-transform transform active:scale-95 mt-2">
                {modalLandingInfo.tipo === 'login' ? 'Ingresar al sistema' : 'Crear Cuenta'}
              </button>
            </form>
            <div className="mt-8 text-center">
              <button 
                type="button" 
                onClick={() => {
                  setModalLandingInfo({ visible: true, tipo: modalLandingInfo.tipo === 'login' ? 'registro' : 'login' }); 
                  setAuthErrores({email:"",password:"",confirmPassword:"",general:""}); 
                  setAuthForm({email:"",password:"",confirmPassword:"",nombreUsuario:"",negocio:""});
                  setMostrarPassword(false);
                  setMostrarConfirmPassword(false);
                }} 
                className="text-base font-bold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {modalLandingInfo.tipo === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}