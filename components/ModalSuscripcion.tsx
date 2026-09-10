"use client";
import { useState, useEffect } from "react";
import { X, Sparkles, ShieldCheck, Ticket, CheckCircle2, Store, Crown, MessageCircle, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { customConfirm } from "@/utils/customConfirm";
import { doc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "@/hooks/AuthContext";

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
  const [error, setError] = useState<string | null>(null);
  const { datosSesion } = useAuth();

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



  const volverAPlanGratuito = async () => {
    if (!cuentaPrincipalId) return;
    setCargando(true);
    try {
      // 1. Bajar el plan a gratis
      await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
        plan: 'gratis',
        planVence: null,
        cicloPlan: 'mensual'
      });

      // CORRECCIÓN A-1: Desactivar todos los colaboradores al bajar de plan.
      // Sin esto, colaboradores creados en plan PRO/Comercio quedaban activos
      // en plan gratuito, evadiendo el límite de 0 colaboradores.
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

      toast.success("Has cambiado al Plan Gratuito con éxito. Todos tus datos se conservan intactos 🙌");
      handleClose();
      window.location.reload();
    } catch (e) {
      toast.error("Error al cambiar al Plan Gratuito.");
    } finally {
      setCargando(false);
    }
  };

  const abrirSoportePagoWhatsApp = (tipo: 'comercio' | 'pro') => {
    const nombrePlan = tipo === 'pro' ? 'Plan PRO Almacén' : 'Plan Comercio';
    
    let tiempoTexto = '1 Mes';
    if (ciclo === 'trimestral') tiempoTexto = '3 Meses';
    if (ciclo === 'anual') tiempoTexto = '1 Año';

    const texto = `Hola equipo Fiabono 👋 Quiero activar mi suscripción al *${nombrePlan}* por *${tiempoTexto}*. Mi correo de cuenta es: ${datosSesion?.correoNegocio || '____@____.com'}`;
    const url = `https://wa.me/573128018444?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
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
      toast.success(`¡Felicidades! Tu ${nombrePlanLabel} ha sido activado por ${data.dias} días 🚀`, { duration: 5000 });
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
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">14 días de prueba gratis</span>
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
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">14 días de prueba gratis</span>
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
            {/* BOTÓN PRINCIPAL: WhatsApp para coordinar el pago real */}
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
                Activar {planSeleccionado === 'pro' ? 'PRO Almacén' : 'Comercio'} por WhatsApp
              </span>
            </button>

            {/* Nota informativa del proceso de activación */}
            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
              <Lock size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Escríbenos por WhatsApp, te enviamos los datos de pago (PSE / Nequi / Transferencia) y en minutos activamos tu plan manualmente. Sin tarjeta de crédito requerida.
              </p>
            </div>
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
              <button
                type="button"
                disabled={cargando}
                onClick={async () => {
                  const confirmado = await customConfirm(
                    "¿Deseas cancelar tu suscripción y volver al Plan Gratuito ($0)?\n\nTodos tus datos, clientes e historial se conservarán intactos.",
                    {
                      titulo: "Cancelar suscripción",
                      textoConfirmar: "Volver a Plan Gratis",
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
                Cancelar suscripción y volver al Plan Gratuito ($0)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}