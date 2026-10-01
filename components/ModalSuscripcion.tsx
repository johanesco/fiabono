"use client";
import { useState, useEffect } from "react";
import { X, Sparkles, ShieldCheck, Ticket, CheckCircle2, Store, Crown, MessageCircle, Lock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { customConfirm } from "@/utils/customConfirm";
import { doc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "@/hooks/AuthContext";
import { contactarFiabonoWhatsApp } from "@/utils/whatsapp";

interface ModalSuscripcionProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaPrincipalId: string;
  planInicial?: 'comercio' | 'pro';
}

export default function ModalSuscripcion({ isOpen, onClose, cuentaPrincipalId, planInicial = 'comercio' }: ModalSuscripcionProps) {
  const [planSeleccionado, setPlanSeleccionado] = useState<'comercio' | 'pro'>(planInicial);
  const [ciclo, setCiclo] = useState<'mensual' | 'trimestral' | 'anual'>('mensual');
  const [mostrarCanjeBono, setMostrarCanjeBono] = useState(false);
  const [codigoBono, setCodigoBono] = useState("");
  const [cargando, setCargando] = useState(false);
  const [activandoPrueba, setActivandoPrueba] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { datosSesion } = useAuth();

  const esGratis = datosSesion?.esGratis || datosSesion?.planActual === 'gratis' || datosSesion?.planActual === 'basico';
  const pruebaGratisUsada = datosSesion?.pruebaGratisUsada === true;
  const puedeActivarPruebaGratis = !pruebaGratisUsada && Boolean(esGratis);

  const activarPruebaGratisDirecta = async (tipo: 'comercio' | 'pro') => {
    setActivandoPrueba(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.error("Debes tener una sesión activa.");
        setActivandoPrueba(false);
        return;
      }

      const res = await fetch('/api/suscripcion/activar-prueba', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          plan: tipo
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo activar la prueba.");
      }

      toast.success(`¡Prueba de 14 días de ${tipo === 'pro' ? 'Plan PRO Almacén' : 'Plan Comercio'} activada con éxito!`, { duration: 6000 });
      handleClose();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Error al activar periodo de prueba.");
      setError(err.message);
    } finally {
      setActivandoPrueba(false);
    }
  };

  // CORRECCIÓN A-3: Sincronizar planSeleccionado cuando el modal abre o cambia planInicial.
  // El modal siempre está montado (no se destruye), entonces useState(planInicial) solo se
  // ejecuta en el primer render. Sin este efecto, abrir con diferente planInicial era ignorado.
  useEffect(() => {
    if (isOpen) {
      setPlanSeleccionado(planInicial);
    }
  }, [planInicial, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setCodigoBono("");
    setError(null);
    setMostrarCanjeBono(false);
    onClose();
  };



  const reactivarRenovacion = async () => {
    if (!cuentaPrincipalId) return;
    setCargando(true);
    try {
      await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
        proximoPlan: null
      });
      toast.success("Renovación reactivada con éxito. Tu plan se mantendrá normalmente.");
      handleClose();
      window.location.reload();
    } catch (e) {
      toast.error("Error al reactivar la suscripción.");
    } finally {
      setCargando(false);
    }
  };

  const volverAPlanGratuito = async () => {
    if (!cuentaPrincipalId) return;
    setCargando(true);
    try {
      const diasRestantes = datosSesion?.diasRestantesPlan ?? 0;

      // Si el usuario aún tiene días pagados, diferir el downgrade al vencimiento para no quitarle días pagados
      if (diasRestantes > 0) {
        await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
          proximoPlan: 'gratis'
        });

        toast.success(`Cancelación programada con éxito. Disfrutarás de tu plan actual durante los ${diasRestantes} días restantes.`, { duration: 6000 });
        handleClose();
        window.location.reload();
        return;
      }

      // Si ya expiró o no tiene días restantes, aplicar downgrade inmediato
      await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
        plan: 'gratis',
        planVence: null,
        proximoPlan: null,
        cicloPlan: 'mensual'
      });

      // Desactivar colaboradores en plan gratuito (límite 0)
      const qColabs = query(
        collection(db, "usuarios"),
        where("adminId", "==", cuentaPrincipalId),
        where("rol", "==", "cajero")
      );
      const snapColabs = await getDocs(qColabs);
      const desactivaciones = snapColabs.docs.map(d =>
        updateDoc(doc(db, "usuarios", d.id), { activo: false })
      );
      await Promise.all(desactivaciones);

      if (datosSesion?.esPro) {
        toast("Tus Planes Separe previos se conservan en Modo Liquidación para abonar y entregar.", { duration: 7000 });
      }
      toast.success("Has cambiado al Plan Gratuito con éxito. Todos tus datos se conservan intactos.");
      handleClose();
      window.location.reload();
    } catch (e) {
      toast.error("Error al procesar la cancelación.");
    } finally {
      setCargando(false);
    }
  };

  const abrirSoportePagoWhatsApp = (tipo: 'comercio' | 'pro') => {
    const nombrePlan = tipo === 'pro' ? 'Plan PRO Almacén' : 'Plan Comercio';
    
    let tiempoTexto = '1 Mes';
    if (ciclo === 'trimestral') tiempoTexto = '3 Meses';
    if (ciclo === 'anual') tiempoTexto = '1 Año';

    const nombreUsuario = datosSesion?.nombreUsuario?.trim() || auth.currentUser?.displayName?.trim() || '';
    const nombreNegocio = datosSesion?.nombreNegocio?.trim() || '';
    const correo = datosSesion?.correoNegocio?.trim() || auth.currentUser?.email?.trim() || '';

    const tipoAccion = datosSesion?.esComercio && tipo === 'pro'
      ? 'mejorar'
      : (datosSesion?.esPro || (datosSesion?.esComercio && tipo === 'comercio'))
      ? 'renovar'
      : 'activar';

    contactarFiabonoWhatsApp({
      nombreUsuario,
      nombreNegocio,
      correoNegocio: correo,
      plan: nombrePlan,
      tiempoTexto,
      tipoAccion,
    });
  };

  const manejarAplicarBono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoBono.trim()) {
      setError("Por favor ingresa un código de bono.");
      return;
    }

    setError(null);
    setCargando(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setError("Debes tener una sesión activa para canjear un código.");
        setCargando(false);
        return;
      }

      const res = await fetch('/api/canjear-cupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          codigo: codigoBono.trim().toUpperCase(),
          usuarioId: cuentaPrincipalId
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ocurrió un error al canjear el cupón.");
        return;
      }

      const nombrePlanLabel = data.plan === 'pro' ? 'Plan PRO Almacén' : 'Plan Comercio';
      if (datosSesion?.esPro && data.plan !== 'pro') {
        toast("Has pasado a Plan Comercio. Tus Planes Separe previos se conservan activos en Modo Liquidación para que puedas abonar y entregarlos.", {
          duration: 7000
        });
      }
      toast.success(`¡Felicitaciones! Tu ${nombrePlanLabel} ha sido activado por ${data.dias} días.`, { duration: 5000 });
      handleClose();
      window.location.reload();
    } catch (error) {
      setError("Ocurrió un error al procesar el bono. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl sm:rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[94dvh] sm:max-h-[90vh] overflow-y-auto pb-6 sm:pb-0">
        
        <button 
          onClick={handleClose} 
          className="absolute top-5 right-5 bg-slate-100 dark:bg-[#020617] text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full p-2.5 transition-colors cursor-pointer z-10"
        >
          <X size={20}/>
        </button>

        <div className="p-6 pb-12 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-wider mb-2">
              <Sparkles size={14} /> Elige tu Plan de Crecimiento
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Lleva tu negocio al siguiente nivel
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Desbloquea clientes e inventario ilimitados, colaboradores y herramientas profesionales.
            </p>

            {/* Banner de Precios */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider mt-4 border border-emerald-200/60 dark:border-emerald-500/20">
              <Sparkles size={13} className="fill-current" /> Tarifas de lanzamiento próximamente disponibles
            </div>
          </div>

          {/* Tarjetas de Selección de Plan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* PLAN COMERCIO */}
            <div 
              onClick={() => setPlanSeleccionado('comercio')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                planSeleccionado === 'comercio'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617] hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase flex items-center gap-1">
                    <Store size={14} /> Comercio
                  </span>
                  {planSeleccionado === 'comercio' && <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="my-1">
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    Próximamente
                  </p>
                  {puedeActivarPruebaGratis ? (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">14 días de prueba gratis</span>
                  ) : datosSesion?.planActual === 'comercio' ? (
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Tu Plan Actual {datosSesion?.diasRestantesPlan !== null ? `(${datosSesion?.diasRestantesPlan}d)` : ''}</span>
                  ) : datosSesion?.planActual === 'pro' ? (
                    <span className="text-[11px] font-bold text-slate-400">Plan Básico</span>
                  ) : (
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Suscripción Oficial</span>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Clientes e Inv. ILIMITADOS</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> 1 Usuario Colaborador con permisos</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Factura Imprimible (58/80mm)</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Alertas de Stock Bajo y Agotados</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> Reportes de Caja Neta y Cartera</li>
                </ul>
              </div>
            </div>

            {/* PLAN PRO ALMACÉN */}
            <div 
              onClick={() => setPlanSeleccionado('pro')}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                planSeleccionado === 'pro'
                  ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617] hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1">
                    <Crown size={14} className="text-amber-500" /> PRO Almacén
                  </span>
                  {planSeleccionado === 'pro' && <CheckCircle2 size={16} className="text-purple-600 dark:text-purple-400" />}
                </div>
                <div className="my-1">
                  <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    Próximamente
                  </p>
                  {puedeActivarPruebaGratis ? (
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">14 días de prueba gratis</span>
                  ) : datosSesion?.planActual === 'pro' ? (
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Tu Plan Actual {datosSesion?.diasRestantesPlan !== null ? `(${datosSesion?.diasRestantesPlan}d)` : ''}</span>
                  ) : datosSesion?.planActual === 'comercio' ? (
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Mejorar a PRO</span>
                  ) : (
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Suscripción Oficial</span>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-purple-500 shrink-0" /> Módulo PLAN SEPARE Completo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-purple-500 shrink-0" /> 4 Usuarios Colaboradores</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-purple-500 shrink-0" /> Modo Terminal Multivendedor</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-purple-500 shrink-0" /> Etiquetas Adhesivas QR para prendas</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-purple-500 shrink-0" /> Carga Masiva en Excel</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botones de Acción — FLUJO SEGURO */}
          <div className="flex flex-col gap-2.5">
            {puedeActivarPruebaGratis ? (
              <>
                {/* BOTÓN 1-CLIC: Activación inmediata de prueba gratis */}
                <button
                  type="button"
                  disabled={activandoPrueba}
                  onClick={() => activarPruebaGratisDirecta(planSeleccionado)}
                  className={`w-full py-4 rounded-2xl font-black text-base text-white shadow-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    planSeleccionado === 'pro'
                      ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-800 shadow-purple-600/30'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 shadow-blue-600/30'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {activandoPrueba ? (
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={18} className="animate-pulse" />
                    )}
                    {activandoPrueba ? 'Activando tu prueba...' : `Activar 14 Días de Prueba Gratis (${planSeleccionado === 'pro' ? 'PRO Almacén' : 'Comercio'})`}
                  </span>
                </button>

                {/* Nota informativa de prueba gratis */}
                <div className="flex items-center justify-center gap-2 text-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  <span>Sin tarjeta de crédito • Acceso inmediato por 14 días</span>
                </div>

                {/* Opción secundaria WhatsApp para coordinar pago anticipado */}
                <button
                  type="button"
                  onClick={() => abrirSoportePagoWhatsApp(planSeleccionado)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <MessageCircle size={13} /> ¿Deseas adquirir la suscripción mensual o anual directamente? Escríbenos por WhatsApp
                </button>
              </>
            ) : (
              <>
                {/* Banner informativo según la situación del negocio */}
                {esGratis && pruebaGratisUsada && (
                  <div className="bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-left space-y-1">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                      <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                      <span>Periodo de prueba completado</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Tu negocio ya disfrutó previamente de los 14 días de prueba gratis. Para reactivar clientes e inventario ilimitados, colaboradores y funciones avanzadas, adquiere tu suscripción oficial por WhatsApp o canjea un código promocional.
                    </p>
                  </div>
                )}

                {datosSesion?.esComercio && (
                  <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl p-4 text-left space-y-1">
                    <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-bold text-xs">
                      <Store size={16} className="text-blue-600 shrink-0" />
                      <span>Plan Comercio Activo {datosSesion?.diasRestantesPlan !== null ? `(${datosSesion?.diasRestantesPlan} días restantes)` : ''}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {planSeleccionado === 'pro'
                        ? 'Pasa a PRO Almacén para desbloquear el módulo de Plan Separe, etiquetas QR adhesivas y hasta 4 colaboradores.'
                        : 'Puedes renovar o extender tu suscripción actual de Comercio directamente por WhatsApp.'}
                    </p>
                  </div>
                )}

                {datosSesion?.esPro && (
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl p-4 text-left space-y-1">
                    <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold text-xs">
                      <Crown size={16} className="text-purple-600 shrink-0" />
                      <span>Plan PRO Almacén Activo {datosSesion?.diasRestantesPlan !== null ? `(${datosSesion?.diasRestantesPlan} días restantes)` : ''}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Cuentas con todas las funciones profesionales activas. Puedes renovar tu suscripción anticipadamente por WhatsApp.
                    </p>
                  </div>
                )}

                {/* BOTÓN PRINCIPAL: WhatsApp para coordinar el pago / suscripción */}
                <button
                  type="button"
                  onClick={() => abrirSoportePagoWhatsApp(planSeleccionado)}
                  className={`w-full py-4 rounded-2xl font-black text-base text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
                    planSeleccionado === 'pro'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 shadow-purple-600/30'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 shadow-blue-600/30'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <MessageCircle size={18} />
                    {datosSesion?.esComercio && planSeleccionado === 'pro'
                      ? 'Mejorar a PRO Almacén por WhatsApp'
                      : datosSesion?.esPro || (datosSesion?.esComercio && planSeleccionado === 'comercio')
                      ? `Renovar ${planSeleccionado === 'pro' ? 'PRO Almacén' : 'Comercio'} por WhatsApp`
                      : `Adquirir ${planSeleccionado === 'pro' ? 'PRO Almacén' : 'Comercio'} por WhatsApp`}
                  </span>
                </button>

                {/* Nota informativa del proceso de activación */}
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  <Lock size={14} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Escríbenos por WhatsApp, te enviamos los medios de pago (Bancolombia, Nequi o Llave) y en minutos activamos tu cuenta. Sin tarjeta de crédito requerida.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Sección de Canje de Bono Promocional */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            {!mostrarCanjeBono ? (
              <button
                type="button"
                onClick={() => setMostrarCanjeBono(true)}
                className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center gap-1 mx-auto"
              >
                <Ticket size={14} /> ¿Tienes un código promocional o bono? Canjéalo aquí
              </button>
            ) : (
              <form onSubmit={manejarAplicarBono} className="flex flex-col gap-2.5 animate-in fade-in duration-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. PRO2026"
                    value={codigoBono}
                    onChange={e => { setCodigoBono(e.target.value); setError(null); }}
                    className="flex-1 p-3 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 text-xs font-bold uppercase text-center text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={cargando}
                    className="px-4 py-3 bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs rounded-xl hover:bg-black transition-colors cursor-pointer"
                  >
                    Canjear
                  </button>
                </div>
                {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}
              </form>
            )}
          </div>

          <div className="mt-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium">
              <ShieldCheck size={14} className="text-emerald-500" /> Activación segura e inmediata en tu cuenta
            </div>

            {(!datosSesion || datosSesion.planActual !== 'gratis' && datosSesion.planActual !== 'basico') && (
              <div className="pt-1">
                {datosSesion?.proximoPlan === 'gratis' ? (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-center space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 font-bold">
                      <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                      <span>Tienes una cancelación programada. Tu plan actual se mantendrá activo durante tus {datosSesion?.diasRestantesPlan ?? 0} días restantes y luego pasará a Gratuito.</span>
                    </div>
                    <button
                      type="button"
                      disabled={cargando}
                      onClick={reactivarRenovacion}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      Reactivar Renovación de mi Plan
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={cargando}
                    onClick={async () => {
                      const dias = datosSesion?.diasRestantesPlan ?? 0;
                      const mensaje = dias > 0
                        ? `¿Deseas programar la cancelación de tu plan?\n\nSeguirás disfrutando de todos tus beneficios durante los ${dias} días restantes. Al vencer, tu cuenta pasará automáticamente al Plan Gratuito sin cobros adicionales.\n\nTodos tus datos se conservan intactos.`
                        : "¿Deseas volver al Plan Gratuito ($0)?\n\nTodos tus datos, clientes e historial se conservarán intactos.";

                      const confirmado = await customConfirm(
                        mensaje,
                        {
                          titulo: dias > 0 ? "Programar cancelación" : "Cancelar suscripción",
                          textoConfirmar: dias > 0 ? "Programar paso a Gratis" : "Volver a Plan Gratis",
                          textoCancelar: "Mantener mi Plan",
                          tipo: "peligro"
                        }
                      );
                      if (confirmado) {
                        volverAPlanGratuito();
                      }
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors underline cursor-pointer"
                  >
                    {datosSesion?.diasRestantesPlan && datosSesion.diasRestantesPlan > 0
                      ? "Cancelar suscripción (pasar a Gratuito al vencer)"
                      : "Cancelar suscripción y volver al Plan Gratuito ($0)"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}