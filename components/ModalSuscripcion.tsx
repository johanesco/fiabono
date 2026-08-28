"use client";
import { useState } from "react";
import { X, Sparkles, ShieldCheck, Ticket, CheckCircle2, Store, Crown, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { API_DB } from "../servicios/db";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

interface ModalSuscripcionProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaPrincipalId: string;
  planInicial?: 'comercio' | 'pro';
}

export default function ModalSuscripcion({ isOpen, onClose, cuentaPrincipalId, planInicial = 'comercio' }: ModalSuscripcionProps) {
  const [planSeleccionado, setPlanSeleccionado] = useState<'comercio' | 'pro'>(planInicial);
  const [ciclo, setCiclo] = useState<'mensual' | 'anual'>('mensual');
  const [mostrarCanjeBono, setMostrarCanjeBono] = useState(false);
  const [codigoBono, setCodigoBono] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setCodigoBono("");
    setError(null);
    setMostrarCanjeBono(false);
    onClose();
  };

  const activarPlanDirecto = async (tipo: 'comercio' | 'pro') => {
    if (!cuentaPrincipalId) return;
    setCargando(true);
    try {
      const fechaVencimiento = new Date();
      if (ciclo === 'anual') {
        fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);
      } else {
        fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
      }

      await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
        plan: tipo,
        planVence: fechaVencimiento,
        cicloPlan: ciclo
      });

      toast.success(`¡Excelente! Plan ${tipo === 'pro' ? 'PRO Almacén' : 'Comercio'} activado correctamente 🚀`);
      handleClose();
      window.location.reload();
    } catch (e) {
      toast.error("Error al actualizar el plan.");
    } finally {
      setCargando(false);
    }
  };

  const abrirSoportePagoWhatsApp = (tipo: 'comercio' | 'pro') => {
    const nombrePlan = tipo === 'pro' ? 'Plan PRO Almacén ($44.900/mes)' : 'Plan Comercio ($19.900/mes)';
    const cicloTexto = ciclo === 'anual' ? 'Anual' : 'Mensual';
    const texto = `Hola equipo Fiabono 👋 Quiero activar mi suscripción al *${nombrePlan}* en ciclo *${cicloTexto}*. Mi ID de negocio es: ${cuentaPrincipalId}.`;
    const url = `https://wa.me/573001234567?text=${encodeURIComponent(texto)}`;
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
      const resultado = await API_DB.verificarCodigoPromocional(codigoBono.trim().toUpperCase());

      if (resultado.valido) {
        const nuevaFechaVencimiento = new Date();
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 30);

        await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
          plan: "pro",
          planVence: nuevaFechaVencimiento,
          cicloPlan: "mensual"
        });

        toast.success("¡Felicidades! Tu Plan PRO ha sido activado por 1 mes 🚀");
        handleClose();
        window.location.reload();
      } else {
        if ((resultado as any).reason === 'not_found') {
          setError("El código ingresado no existe.");
        } else if ((resultado as any).reason === 'inactive') {
          setError("El código ingresado no es válido o ya fue usado.");
        } else {
          setError("El código ingresado no es válido o ya expiró.");
        }
      }
    } catch (error) {
      setError("Ocurrió un error al procesar el bono.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
        
        <button 
          onClick={handleClose} 
          className="absolute top-5 right-5 bg-slate-100 dark:bg-[#020617] text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full p-2.5 transition-colors cursor-pointer z-10"
        >
          <X size={20}/>
        </button>

        <div className="p-6 sm:p-8">
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

            {/* Selector de Ciclo */}
            <div className="inline-flex items-center bg-slate-100 dark:bg-[#020617] p-1 rounded-xl mt-4 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCiclo('mensual')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  ciclo === 'mensual' ? 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setCiclo('anual')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                  ciclo === 'anual' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                <span>Anual</span>
                <span className="text-[10px] bg-emerald-400 text-slate-900 px-1 rounded font-black">Ahorra 2 meses</span>
              </button>
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
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {ciclo === 'anual' ? '$199.000' : '$19.900'} <span className="text-xs font-normal text-slate-500">COP/{ciclo === 'anual' ? 'año' : 'mes'}</span>
                </p>
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
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {ciclo === 'anual' ? '$449.000' : '$44.900'} <span className="text-xs font-normal text-slate-500">COP/{ciclo === 'anual' ? 'año' : 'mes'}</span>
                </p>
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

          {/* Botones de Acción */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={cargando}
              onClick={() => activarPlanDirecto(planSeleccionado)}
              className={`w-full py-4 rounded-2xl font-black text-base text-white shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-50 ${
                planSeleccionado === 'pro'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 shadow-purple-600/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 shadow-blue-600/30'
              }`}
            >
              {cargando ? "Activando..." : `Activar ${planSeleccionado === 'pro' ? 'PRO Almacén' : 'Comercio'} Ahora`}
            </button>

            <button
              type="button"
              onClick={() => abrirSoportePagoWhatsApp(planSeleccionado)}
              className="w-full py-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-500/20"
            >
              <MessageCircle size={15} /> Pagar o solicitar activación por WhatsApp
            </button>
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

          <div className="mt-4 text-center flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-500" /> Activación segura e inmediata en tu cuenta
          </div>
        </div>
      </div>
    </div>
  );
}