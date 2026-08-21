"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../firebase";
import { API_DB } from "../servicios/db";
import { Cliente } from "../types";
import toast from "react-hot-toast";
import { 
  Lock, 
  User, 
  Phone, 
  Trash2, 
  Edit3, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  KeyRound, 
  Unlock,
  AlertOctagon,
  Banknote,
  ArrowRight
} from "lucide-react";

interface ModalGestionClienteProps {
  isOpen: boolean;
  modo: 'editar' | 'eliminar';
  cliente: Cliente | null;
  onClose: () => void;
  onSuccess: (clienteActualizado?: Cliente, fueEliminado?: boolean) => void;
}

export default function ModalGestionCliente({
  isOpen,
  modo,
  cliente,
  onClose,
  onSuccess
}: ModalGestionClienteProps) {
  const router = useRouter();
  const [pasoEdicion, setPasoEdicion] = useState<'autenticar' | 'formulario'>('autenticar');
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");
  const [textoConfirmacion, setTextoConfirmacion] = useState("");
  const [checkboxResponsabilidad, setCheckboxResponsabilidad] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");

  useEffect(() => {
    if (cliente && isOpen) {
      setNombre(cliente.nombre || "");
      setCelular(cliente.celular || "");
      setPassword("");
      setTextoConfirmacion("");
      setCheckboxResponsabilidad(false);
      setErrorPassword("");
      setPasoEdicion('autenticar');
    }
  }, [cliente, isOpen, modo]);

  if (!isOpen || !cliente) return null;

  const deuda = cliente.deudaTotal || 0;
  const tieneDeuda = deuda > 0;

  // 1. Manejar autenticación para desbloquear la edición
  const handleDesbloquearEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword("");

    if (!password.trim()) {
      setErrorPassword("Ingresa tu contraseña de administrador.");
      return;
    }

    setProcesando(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("No hay una sesión activa de administrador.");
      }

      const credenciales = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credenciales);

      // Contraseña correcta -> desbloqueamos el formulario
      setPasoEdicion('formulario');
      setPassword("");
      toast.success("Edición desbloqueada.");
    } catch (error: any) {
      console.error("Error al autenticar:", error);
      if (
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/invalid-login-credentials'
      ) {
        setErrorPassword("Contraseña incorrecta. Acción no autorizada.");
      } else {
        toast.error("Error al validar contraseña. Intenta nuevamente.");
      }
    } finally {
      setProcesando(false);
    }
  };

  // 2. Guardar los cambios editados del cliente
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.error("El nombre del cliente no puede estar vacío.");
      return;
    }

    setProcesando(true);
    try {
      const datosActualizados: Partial<Cliente> = {
        nombre: nombre.trim(),
        celular: celular.trim()
      };

      await API_DB.actualizarCliente(cliente.id, datosActualizados);
      toast.success("Cliente actualizado exitosamente.");
      
      const clienteFinal: Cliente = {
        ...cliente,
        ...datosActualizados
      };
      onSuccess(clienteFinal, false);
      onClose();
    } catch (error) {
      console.error("Error al actualizar cliente:", error);
      toast.error("Error al guardar cambios del cliente.");
    } finally {
      setProcesando(false);
    }
  };

  // 3. Manejar eliminación con confirmación de seguridad en 3 capas
  const handleEliminarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPassword("");

    if (tieneDeuda) {
      if (textoConfirmacion.trim().toUpperCase() !== 'ELIMINAR') {
        toast.error("Debes escribir la palabra ELIMINAR para confirmar.");
        return;
      }
      if (!checkboxResponsabilidad) {
        toast.error("Debes marcar la casilla de confirmación de saldo.");
        return;
      }
    }

    if (!password.trim()) {
      setErrorPassword("Ingresa tu contraseña de administrador para confirmar.");
      return;
    }

    setProcesando(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("No hay una sesión activa de administrador.");
      }

      const credenciales = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credenciales);

      await API_DB.eliminarCliente(cliente.id);
      toast.success("Cliente eliminado exitosamente.");
      onSuccess(undefined, true);
      onClose();
    } catch (error: any) {
      console.error("Error al eliminar cliente:", error);
      if (
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/invalid-login-credentials'
      ) {
        setErrorPassword("Contraseña incorrecta. Acción no autorizada.");
      } else {
        toast.error("Error al procesar la solicitud. Intenta nuevamente.");
      }
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* ENCABEZADO */}
        <div className={`p-5 sm:p-6 flex justify-between items-center text-white shrink-0 ${
          modo === 'editar' 
            ? (pasoEdicion === 'autenticar' ? 'bg-amber-600 dark:bg-amber-700' : 'bg-blue-600 dark:bg-blue-700')
            : 'bg-rose-600 dark:bg-rose-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              {modo === 'editar' ? (
                pasoEdicion === 'autenticar' ? <KeyRound size={24} /> : <Edit3 size={24} />
              ) : (
                <AlertOctagon size={24} />
              )}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight">
                {modo === 'editar' 
                  ? (pasoEdicion === 'autenticar' ? "Desbloquear Edición" : "Modificar Cliente")
                  : (tieneDeuda ? "¡Advertencia de Seguridad!" : "Eliminar Cliente")}
              </h3>
              <p className="text-xs text-white/80 font-medium">
                {modo === 'editar' && pasoEdicion === 'autenticar' 
                  ? "Paso 1: Seguridad de Administrador"
                  : modo === 'editar' 
                  ? "Paso 2: Edita los datos" 
                  : (tieneDeuda ? "Cliente con deuda activa" : "Requiere clave de administrador")}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={procesando}
            className="p-2 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* CASO 1: MODO EDITAR - PASO 1 (SOLICITAR CONTRASEÑA PRIMERO) */}
        {modo === 'editar' && pasoEdicion === 'autenticar' && (
          <form onSubmit={handleDesbloquearEdicion} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-start gap-3">
              <Lock className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-slate-700 dark:text-slate-300">
                <p className="font-bold text-amber-800 dark:text-amber-300">Autorización requerida</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ingresa tu contraseña de administrador para habilitar la edición de <strong>{cliente.nombre}</strong>.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock size={14} className="text-amber-500" /> Contraseña de Administrador
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorPassword) setErrorPassword("");
                }}
                placeholder="Ingresa tu contraseña"
                required
                autoFocus
                className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-amber-500 dark:text-white font-medium text-base transition-colors"
              />
              {errorPassword && (
                <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={12} /> {errorPassword}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={procesando}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesando}
                className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 flex justify-center items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {procesando ? "Validando..." : <>Desbloquear <Unlock size={18} /></>}
              </button>
            </div>
          </form>
        )}

        {/* CASO 2: MODO EDITAR - PASO 2 (CAMPOS HABILITADOS PARA MODIFICAR) */}
        {modo === 'editar' && pasoEdicion === 'formulario' && (
          <form onSubmit={handleGuardarEdicion} className="p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User size={14} /> Nombre del Cliente
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                required
                autoFocus
                className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-base transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone size={14} /> WhatsApp / Celular
              </label>
              <input
                type="tel"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="Número de celular (opcional)"
                className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-medium text-base transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={procesando}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesando}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {procesando ? "Guardando..." : <>Guardar Cambios <CheckCircle2 size={18} /></>}
              </button>
            </div>
          </form>
        )}

        {/* CASO 3: MODO ELIMINAR (FLUJO DE SEGURIDAD BLINDADO EN 3 CAPAS PARA DEUDAS) */}
        {modo === 'eliminar' && (
          <form onSubmit={handleEliminarCliente} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            
            {/* CAPA 1: IMPACTO FINANCIERO */}
            {tieneDeuda ? (
              <div className="space-y-3">
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 rounded-2xl text-center space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-rose-500 text-white rounded-full inline-block">
                    ⚠️ Riesgo Financiero Alto
                  </span>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Estás a punto de eliminar a <strong className="text-slate-900 dark:text-white">{cliente.nombre}</strong> con saldo pendiente:
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                    ${deuda.toLocaleString('es-CO')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Al borrarlo, esta deuda se eliminará del balance de cuentas por cobrar y no podrás registrar más abonos.
                  </p>
                </div>

                {/* OPCIÓN DE ESCAPE RECOMENDADA: SALDAR DEUDA PRIMERO */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/dashboard/abonar?clienteId=${cliente.id}`);
                  }}
                  className="w-full p-3 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Banknote size={16} /> Registrar Abono / Saldar primero <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" size={22} />
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  <p className="font-bold text-rose-700 dark:text-rose-300">¿Deseas eliminar a {cliente.nombre}?</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {deuda < 0 
                      ? `Atención: Tiene un saldo a favor de $${Math.abs(deuda).toLocaleString('es-CO')}.`
                      : "El cliente se encuentra al día ($0 de deuda)."}
                  </p>
                </div>
              </div>
            )}

            {/* CAPA 2: DOBLE CONFIRMACIÓN ESCRITA Y CHECKBOX (SOLO SI TIENE DEUDA) */}
            {tieneDeuda && (
              <div className="p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Escribe la palabra <span className="text-rose-600 font-mono font-black">ELIMINAR</span> para confirmar:
                  </label>
                  <input
                    type="text"
                    value={textoConfirmacion}
                    onChange={(e) => setTextoConfirmacion(e.target.value)}
                    placeholder="ELIMINAR"
                    className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-rose-500 font-mono font-black text-sm text-center uppercase tracking-widest text-slate-900 dark:text-white"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={checkboxResponsabilidad}
                    onChange={(e) => setCheckboxResponsabilidad(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-tight">
                    Entiendo que la deuda de ${deuda.toLocaleString('es-CO')} quedará anulada y asumo la responsabilidad.
                  </span>
                </label>
              </div>
            )}

            {/* CAPA 3: VALIDACIÓN DE CONTRASEÑA DE ADMINISTRADOR */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Lock size={14} className="text-rose-500" /> Contraseña de Administrador
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorPassword) setErrorPassword("");
                }}
                placeholder="Ingresa tu contraseña"
                required
                className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-rose-500 dark:text-white font-medium text-base transition-colors"
              />
              {errorPassword && (
                <p className="text-xs text-rose-500 font-bold mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={12} /> {errorPassword}
                </p>
              )}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={procesando}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  procesando || 
                  (tieneDeuda && (textoConfirmacion.trim().toUpperCase() !== 'ELIMINAR' || !checkboxResponsabilidad)) ||
                  !password.trim()
                }
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 flex justify-center items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                {procesando ? "Validando..." : <>Confirmar Eliminación <Trash2 size={18} /></>}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
