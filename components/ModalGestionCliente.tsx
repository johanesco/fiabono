"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../hooks/AuthContext";
import { API_DB } from "../servicios/db";
import { Cliente } from "../types";
import toast from "react-hot-toast";
import { notificar } from "@/utils/notificaciones";
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
  ArrowRight,
  ShieldCheck,
  Tag,
  Plus,
  CreditCard,
  Smile
} from "lucide-react";

interface ModalGestionClienteProps {
  isOpen: boolean;
  modo: 'editar' | 'eliminar';
  cliente: Cliente | null;
  clientesExistentes?: Cliente[];
  onClose: () => void;
  onSuccess: (clienteActualizado?: Cliente, fueEliminado?: boolean) => void;
}

export default function ModalGestionCliente({
  isOpen,
  modo,
  cliente,
  clientesExistentes = [],
  onClose,
  onSuccess
}: ModalGestionClienteProps) {
  const router = useRouter();
  const { datosSesion } = useAuth() || {};
  const [pasoEdicion, setPasoEdicion] = useState<'autenticar' | 'formulario'>('formulario');
  const [mostrarConfirmacionGuardar, setMostrarConfirmacionGuardar] = useState(false);
  const [duplicadoDocModal, setDuplicadoDocModal] = useState<Cliente | null>(null);
  const [duplicadoCelModal, setDuplicadoCelModal] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState("");
  const [apodo, setApodo] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<string>("CC");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [celular, setCelular] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [password, setPassword] = useState("");
  const [textoConfirmacion, setTextoConfirmacion] = useState("");
  const [checkboxResponsabilidad, setCheckboxResponsabilidad] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (cliente && isOpen) {
      setNombre(cliente.nombre || "");
      setApodo(cliente.apodo || "");
      setTipoDocumento(cliente.tipoDocumento || "CC");
      setNumeroDocumento(cliente.numeroDocumento || "");
      setCelular(cliente.celular || "");
      setDireccion(cliente.direccion || "");
      setNotas(cliente.notas || "");
      setEtiquetas(Array.isArray(cliente.etiquetas) ? [...cliente.etiquetas] : []);
      setNuevaEtiqueta("");
      setPassword("");
      setTextoConfirmacion("");
      setCheckboxResponsabilidad(false);
      setErrorPassword("");
      setMostrarConfirmacionGuardar(false);
      setPasoEdicion('formulario');
    }
  }, [cliente, isOpen, modo]);

  if (!isOpen || !cliente) return null;

  const currentUser = auth.currentUser;
  const esGoogleUser = currentUser?.providerData?.some(p => p.providerId === 'google.com') || false;
  const esAdmin = datosSesion?.esAdmin !== false;

  const deuda = cliente.deudaTotal || 0;
  const tieneDeuda = deuda > 0;

  const handleAgregarEtiqueta = (tagTexto?: string) => {
    const tag = (tagTexto ?? nuevaEtiqueta).trim();
    if (!tag) return;
    if (tag.length > 25) {
      toast.error("La categoría no debe superar 25 caracteres.");
      return;
    }
    const existe = etiquetas.some(e => e.toLowerCase() === tag.toLowerCase());
    if (existe) {
      toast.error(`La categoría "${tag}" ya está asignada.`);
      return;
    }
    setEtiquetas(prev => [...prev, tag]);
    setNuevaEtiqueta("");
  };

  const handleEliminarEtiqueta = (tagIndex: number) => {
    setEtiquetas(prev => prev.filter((_, idx) => idx !== tagIndex));
  };

  // 1. Manejar pre-guardado: abre el modal de confirmación
  const handlePreGuardar = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      toast.error("El nombre del cliente no puede estar vacío.");
      return;
    }

    // Validar si el número de documento ya pertenece a otro cliente (bloqueo estricto con ventana modal diseñada)
    const docLimpio = numeroDocumento.trim();
    if (docLimpio) {
      const duplicado = clientesExistentes.find(c => 
        c.id !== cliente.id && 
        c.numeroDocumento && 
        c.numeroDocumento.trim().toLowerCase() === docLimpio.toLowerCase()
      );
      if (duplicado) {
        setDuplicadoDocModal(duplicado);
        return;
      }
    }

    // Validar si el celular coincide con otro cliente (ventana modal interactiva que advierte y permite continuar)
    const celLimpio = celular.replace(/[^\d]/g, '');
    if (celLimpio && celLimpio.length >= 7) {
      const duplicadoCel = clientesExistentes.find(c => 
        c.id !== cliente.id && 
        c.celular && 
        c.celular.replace(/[^\d]/g, '') === celLimpio
      );
      if (duplicadoCel) {
        setDuplicadoCelModal(duplicadoCel);
        return;
      }
    }

    // Consolidar nuevaEtiqueta si el usuario no dio clic en "+"
    let tagsNuevasActual = [...etiquetas];
    if (nuevaEtiqueta.trim()) {
      nuevaEtiqueta.split(/[,;-]/).forEach(t => {
        const clean = t.trim();
        if (clean && !tagsNuevasActual.some(exist => exist.toLowerCase() === clean.toLowerCase())) {
          tagsNuevasActual.push(clean);
        }
      });
      setEtiquetas(tagsNuevasActual);
      setNuevaEtiqueta("");
    }

    const tagsOriginales = Array.isArray(cliente.etiquetas) ? [...cliente.etiquetas].sort() : [];
    const tagsNuevas = [...tagsNuevasActual].sort();
    const etiquetasCambiadas = JSON.stringify(tagsOriginales) !== JSON.stringify(tagsNuevas);

    const huboCambios = 
      nombre.trim() !== (cliente.nombre || "").trim() || 
      apodo.trim() !== (cliente.apodo || "").trim() ||
      (tipoDocumento || 'CC') !== (cliente.tipoDocumento || 'CC') ||
      numeroDocumento.trim() !== (cliente.numeroDocumento || '').trim() ||
      celular.trim() !== (cliente.celular || "").trim() ||
      direccion.trim() !== (cliente.direccion || "").trim() ||
      notas.trim() !== (cliente.notas || "").trim() ||
      etiquetasCambiadas;

    if (!huboCambios) {
      toast("No se detectaron cambios en el cliente.", { icon: "ℹ️" });
      onClose();
      return;
    }

    // Desplegar modal emergente de confirmación
    setMostrarConfirmacionGuardar(true);
  };

  // 2. Confirmación final aprobada por el usuario
  const handleEjecutarGuardar = async () => {
    setProcesando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión no válida.');

      const datosActualizados = {
        id: cliente.id,
        nombre: nombre.trim(),
        apodo: apodo.trim(),
        tipoDocumento: tipoDocumento || 'CC',
        numeroDocumento: numeroDocumento.trim(),
        celular: celular.trim(),
        direccion: direccion.trim(),
        notas: notas.trim(),
        etiquetas: etiquetas
      };

      const resp = await fetch('/api/clientes/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(datosActualizados)
      });

      const resJson = await resp.json();
      if (!resp.ok) {
        throw new Error(resJson.error || 'No se pudo actualizar el cliente.');
      }

      notificar.exito("Los datos del cliente se guardaron correctamente.", {
        titulo: "Cliente actualizado"
      });
      
      const clienteFinal: Cliente = {
        ...cliente,
        ...(resJson.cliente || datosActualizados)
      };
      setMostrarConfirmacionGuardar(false);
      onSuccess(clienteFinal, false);
      onClose();
    } catch (error: any) {
      console.error("Error al actualizar cliente:", error);
      notificar.error(error.message || "No se pudieron guardar los cambios en la cuenta del cliente.", {
        titulo: "Error al actualizar"
      });
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
        notificar.advertencia("Debes escribir la palabra ELIMINAR para continuar.", {
          titulo: "Confirmación requerida"
        });
        return;
      }
      if (!checkboxResponsabilidad) {
        notificar.advertencia("Debes marcar la casilla de confirmación de saldo.", {
          titulo: "Aceptación requerida"
        });
        return;
      }
    }

      if (!esGoogleUser) {
        if (!password.trim()) {
          setErrorPassword("Ingresa tu contraseña de administrador para confirmar.");
          return;
        }
      }

      setProcesando(true);
      try {
        if (!currentUser || !currentUser.email) {
          throw new Error("No hay una sesión activa de administrador.");
        }

        if (!esGoogleUser) {
          const credenciales = EmailAuthProvider.credential(currentUser.email, password);
          await reauthenticateWithCredential(currentUser, credenciales);
        }

        // PARCHE P0-FIN-02: El asiento contable de condonación/castigo de cartera
        // ya NO usa tipo='abono' ni metodoPago='efectivo' porque eso inflaba
        // el reporte de "Efectivo Recaudado" del día con dinero que nunca entró.
        // Ahora se registra como 'egreso' con metodoPago='ajuste_contable',
        // que los reportes de caja excluyen de las sumas de dinero físico.
        if (tieneDeuda && (cliente.deudaTotal || 0) > 0) {
          const token = await currentUser.getIdToken();
          const respuesta = await fetch('/api/movimientos/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              clienteId: cliente.id,
              tipo: 'egreso',
              monto: cliente.deudaTotal || 0,
              descripcion: `Castigo de cartera / Condonación por eliminación de cliente con deuda (${cliente.nombre})`,
              metodoPago: 'ajuste_contable'
            })
          });
          if (!respuesta.ok) throw new Error((await respuesta.json()).error || 'No se pudo registrar el ajuste.');
        } else if ((cliente.deudaTotal || 0) < 0) {
          // Si el cliente tenía Saldo a Favor, al eliminarlo el negocio se "queda" con ese dinero.
          // Se registra como un ingreso contable (Ajuste a favor de caja por saldo abandonado).
          const token = await currentUser.getIdToken();
          const respuesta = await fetch('/api/movimientos/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              clienteId: cliente.id,
              tipo: 'abono',
              monto: Math.abs(cliente.deudaTotal || 0),
              descripcion: `Ajuste a favor por saldo abandonado / Eliminación de cliente (${cliente.nombre})`,
              metodoPago: 'ajuste_contable'
            })
          });
          if (!respuesta.ok) throw new Error((await respuesta.json()).error || 'No se pudo registrar el ajuste.');
        }

        await API_DB.eliminarCliente(cliente.id, { omitirValidacionDeuda: true });
        notificar.exito(`El cliente "${cliente.nombre}" ha sido eliminado del sistema.`, {
          titulo: "Cliente eliminado",
          icono: <span>🗑️</span>
        });
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
        } else if (error.message) {
          toast.error(error.message);
        } else {
          toast.error("Error al procesar la solicitud. Intenta nuevamente.");
        }
      } finally {
        setProcesando(false);
      }
    };

    const modalJSX = (
      <div 
        onClick={(e) => { if (e.target === e.currentTarget && !procesando) onClose(); }}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[999999] animate-in fade-in duration-200 overflow-y-auto"
      >
        <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* ENCABEZADO */}
        <div className={`p-5 sm:p-6 flex justify-between items-center text-white shrink-0 ${
          modo === 'editar' ? 'bg-blue-600 dark:bg-blue-700' : 'bg-rose-600 dark:bg-rose-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              {modo === 'editar' ? <Edit3 size={24} /> : <AlertOctagon size={24} />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight">
                {modo === 'editar' ? "Modificar Cliente" : (tieneDeuda ? "¡Advertencia de Seguridad!" : "Eliminar Cliente")}
              </h3>
              <p className="text-xs text-white/80 font-medium">
                {modo === 'editar' 
                  ? "Actualiza los datos del cliente" 
                  : (tieneDeuda ? "Cliente con deuda activa" : "Requiere confirmación de administrador")}
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

        {/* CASO 1: MODO EDITAR (FORMULARIO LIMPIO CON PRE-GUARDADO) */}
        {modo === 'editar' && (
          <form onSubmit={handlePreGuardar} className="p-5 sm:p-6 space-y-4 animate-in fade-in duration-200 overflow-y-auto">
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
                <Smile size={14} className="text-amber-500" /> Apodo / Alias (Opcional)
              </label>
              <input
                type="text"
                value={apodo}
                onChange={(e) => setApodo(e.target.value)}
                placeholder="Ej: Cachaco, El Paisa, Doña Mary..."
                className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-medium text-base transition-colors"
              />
            </div>

            {/* DOCUMENTO (CC / NIT / CE) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-blue-500" /> Tipo Doc.
                </label>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value)}
                  className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold text-sm transition-colors cursor-pointer"
                >
                  <option value="CC">CC (Cédula)</option>
                  <option value="NIT">NIT</option>
                  <option value="CE">CE (Extranjería)</option>
                  <option value="PP">Pasaporte</option>
                  <option value="TI">TI</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Cédula / Documento (Opcional)
                </label>
                <input
                  type="text"
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                  placeholder="Ej: 1020304050"
                  className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-medium text-base transition-colors"
                />
              </div>
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

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Dirección</label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección del cliente (opcional)"
                className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-medium text-base transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Notas / Referencia (Opcional)</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Parentesco (Hermana de Juan), casa frente al parque, horario de cobro..."
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 dark:text-white font-medium text-xs sm:text-sm transition-colors resize-none"
              />
            </div>

            {/* CATEGORÍAS / ETIQUETAS PERSONALIZADAS */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag size={14} className="text-violet-500" /> Categorías / Etiquetas Personalizadas
              </label>

              {/* Lista de etiquetas actuales */}
              {etiquetas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-200 dark:border-slate-800">
                  {etiquetas.map((tag, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shadow-2xs"
                    >
                      <Tag size={11} className="shrink-0" />
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarEtiqueta(idx)}
                        className="hover:text-rose-500 transition cursor-pointer p-0.5 rounded-full"
                        title="Quitar categoría"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Input para agregar nueva etiqueta */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAgregarEtiqueta();
                    }
                  }}
                  placeholder="Ej: Mayorista, Vecino, Familia, Especial..."
                  maxLength={25}
                  className="flex-1 p-3 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-violet-500 dark:text-white font-medium text-xs transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleAgregarEtiqueta()}
                  disabled={!nuevaEtiqueta.trim()}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer shrink-0"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>

              {/* Sugerencias rápidas si no tiene etiquetas asignadas */}
              {etiquetas.length === 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold">Sugerencias:</span>
                  {['Mayorista', 'Vecino', 'Familia', 'Empleado', 'Especial'].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAgregarEtiqueta(sug)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 hover:bg-violet-50 dark:bg-slate-800 dark:hover:bg-violet-950/40 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-300 border border-slate-200/60 dark:border-slate-700 transition cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aviso sutil de cambio detectado */}
            {(
              nombre.trim() !== (cliente.nombre || "").trim() || 
              celular.trim() !== (cliente.celular || "").trim() || 
              direccion.trim() !== (cliente.direccion || "").trim() || 
              notas.trim() !== (cliente.notas || "").trim() ||
              JSON.stringify(Array.isArray(cliente.etiquetas) ? [...cliente.etiquetas].sort() : []) !== JSON.stringify([...etiquetas].sort())
            ) && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                <span>
                  Modificando datos de <strong>{cliente.nombre}</strong>. Se te solicitará confirmación al guardar.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={procesando}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-colors text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesando || !nombre.trim()}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 flex justify-center items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                Guardar <ArrowRight size={18} />
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

            {/* CAPA 3: VALIDACIÓN DE SEGURIDAD (CONTRASEÑA O VERIFICACIÓN GOOGLE) */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              {esGoogleUser ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2.5">
                  <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                    Confirmación de seguridad autorizada como administrador Google (<strong>{currentUser?.email}</strong>).
                  </p>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={procesando}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-colors text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  procesando || 
                  (tieneDeuda && (textoConfirmacion.trim().toUpperCase() !== 'ELIMINAR' || !checkboxResponsabilidad)) ||
                  (!esGoogleUser && !password.trim())
                }
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 flex justify-center items-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                {procesando ? "Validando..." : <>Confirmar Eliminación <Trash2 size={18} /></>}
              </button>
            </div>
          </form>
        )}

      </div>

      {/* POPUP MODAL EMERGENTE DE CONFIRMACIÓN AL GUARDAR */}
      {mostrarConfirmacionGuardar && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999999] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-100 dark:bg-blue-950/60 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  ¿Confirmar cambios?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Revisa los datos antes de actualizar
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Cliente</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 line-through truncate max-w-[120px]">{cliente.nombre}</span>
                  <ArrowRight size={14} className="text-blue-500 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white truncate">{nombre.trim()}</span>
                </div>
              </div>

              {(celular.trim() || cliente.celular) && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Teléfono / WhatsApp</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 line-through truncate max-w-[120px]">
                      {cliente.celular || "(Sin número)"}
                    </span>
                    <ArrowRight size={14} className="text-blue-500 shrink-0" />
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {celular.trim() || "(Sin número)"}
                    </span>
                  </div>
                </div>
              )}

              {JSON.stringify(Array.isArray(cliente.etiquetas) ? [...cliente.etiquetas].sort() : []) !== JSON.stringify([...etiquetas].sort()) && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Categorías / Etiquetas</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {etiquetas.length === 0 ? (
                      <span className="text-slate-400 italic text-[11px]">(Sin categorías)</span>
                    ) : (
                      etiquetas.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Esta modificación quedará registrada y visible en todas las órdenes, ventas y deudas asociadas.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setMostrarConfirmacionGuardar(false)}
                disabled={procesando}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleEjecutarGuardar}
                disabled={procesando}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                {procesando ? "Guardando..." : <>Sí, Guardar <CheckCircle2 size={16} /></>}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-MODAL: ALERTA DE CÉDULA / DOCUMENTO DUPLICADO (DISEÑO PREMIUM)
          ========================================================================= */}
      {duplicadoDocModal && (
        <div 
          onClick={() => setDuplicadoDocModal(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Cabecera con Icono Destacado */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs border border-amber-200/60 dark:border-amber-800/60">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1">
                  Documento ya registrado
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                  Esta identificación ya pertenece a otro cliente
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cada cliente debe contar con un número de documento único en tu negocio.
                </p>
              </div>
            </div>

            {/* Tarjeta de Comparación y Conflicto */}
            <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800/80 space-y-3.5">
              
              {/* Documento ingresado en conflicto */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Documento ingresado:
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-black text-xs tracking-wider border border-amber-500/20">
                  {tipoDocumento} {numeroDocumento.trim()}
                </span>
              </div>

              {/* Ficha del cliente que ya tiene esta cédula */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Asignado actualmente a:
                </span>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {duplicadoDocModal.nombre}
                    </p>
                    {duplicadoDocModal.apodo && (
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                        Alias: &ldquo;{duplicadoDocModal.apodo}&rdquo;
                      </p>
                    )}
                    {duplicadoDocModal.celular && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        📱 {duplicadoDocModal.celular}
                      </p>
                    )}
                  </div>
                  {(duplicadoDocModal.deudaTotal || 0) > 0 && (
                    <div className="text-right shrink-0">
                      <span className="text-[9px] uppercase font-bold text-rose-500 block">Deuda actual</span>
                      <span className="font-black text-xs text-rose-600 dark:text-rose-400">
                        ${(duplicadoDocModal.deudaTotal || 0).toLocaleString('es-CO')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cliente que estás editando */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Cliente que estás editando:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                  {cliente.nombre}
                </span>
              </div>

            </div>

            {/* Mensaje de recomendación */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Revisa si hubo una equivocación al escribir el documento, o busca en tu lista a <strong className="text-slate-700 dark:text-slate-300">&ldquo;{duplicadoDocModal.nombre}&rdquo;</strong> si se trata del mismo usuario.
            </p>

            {/* Botón de acción */}
            <button
              type="button"
              onClick={() => setDuplicadoDocModal(null)}
              className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-600/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Entendido, Corregir Documento</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-MODAL: ALERTA DE CELULAR DUPLICADO (DISEÑO PREMIUM CON OPCIÓN CONTINUAR)
          ========================================================================= */}
      {duplicadoCelModal && (
        <div 
          onClick={() => setDuplicadoCelModal(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Cabecera con Icono de Celular */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs border border-blue-200/60 dark:border-blue-800/60">
                <Phone size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider mb-1">
                  Celular compartido
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                  Este número de celular ya está registrado
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Puedes continuar si es una línea compartida o corregirlo si fue un error.
                </p>
              </div>
            </div>

            {/* Tarjeta de Comparación */}
            <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800/80 space-y-3.5">
              
              {/* Celular ingresado */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Celular ingresado:
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-black text-xs tracking-wider border border-blue-500/20">
                  📱 {celular.trim()}
                </span>
              </div>

              {/* Ficha del cliente que ya tiene este celular */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Asociado actualmente a:
                </span>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-xs text-slate-900 dark:text-white truncate">
                      {duplicadoCelModal.nombre}
                    </p>
                    {duplicadoCelModal.apodo && (
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                        Alias: &ldquo;{duplicadoCelModal.apodo}&rdquo;
                      </p>
                    )}
                    {duplicadoCelModal.numeroDocumento && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        Doc: {duplicadoCelModal.tipoDocumento || 'CC'} {duplicadoCelModal.numeroDocumento}
                      </p>
                    )}
                  </div>
                  {((duplicadoCelModal.deudaTotal || 0) > 0) && (
                    <div className="text-right shrink-0">
                      <span className="text-[9px] uppercase font-bold text-rose-500 block">Deuda actual</span>
                      <span className="font-black text-xs text-rose-600 dark:text-rose-400">
                        ${(duplicadoCelModal.deudaTotal || 0).toLocaleString('es-CO')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cliente que estás editando */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Cliente que estás editando:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                  {cliente.nombre}
                </span>
              </div>

            </div>

            {/* Mensaje de orientación */}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              Si ambos clientes son familiares o comparten el mismo teléfono, puedes continuar. Si fue una equivocación, puedes corregirlo ahora.
            </p>

            {/* Botones de acción: Corregir vs Continuar */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDuplicadoCelModal(null)}
                className="py-3 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-center"
              >
                Corregir Celular
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicadoCelModal(null);
                  setMostrarConfirmacionGuardar(true);
                }}
                className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 transition cursor-pointer text-center"
              >
                Continuar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (montado && typeof document !== "undefined") {
    return createPortal(modalJSX, document.body);
  }

  return modalJSX;
}
