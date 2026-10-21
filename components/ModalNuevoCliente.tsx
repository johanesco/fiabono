"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { auth } from "../firebase";
import { Cliente } from "../types";
import toast from "react-hot-toast";
import { 
  UserPlus, 
  X, 
  ChevronDown, 
  Smile, 
  DollarSign, 
  Tag, 
  Plus 
} from "lucide-react";

export interface ModalNuevoClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteCreado: (nuevoCliente: Cliente) => void;
  nombreInicial?: string;
  celularInicial?: string;
  permitirOpcionesAvanzadas?: boolean;
}

export default function ModalNuevoCliente({
  isOpen,
  onClose,
  onClienteCreado,
  nombreInicial = "",
  celularInicial = "",
  permitirOpcionesAvanzadas = true
}: ModalNuevoClienteProps) {
  const [mounted, setMounted] = useState(false);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [celular, setCelular] = useState("");
  const [direccion, setDireccion] = useState("");
  const [apodo, setApodo] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<string>("CC");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [notas, setNotas] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [inputEtiqueta, setInputEtiqueta] = useState("");
  const [mostrarMasOpciones, setMostrarMasOpciones] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prellenar cuando abre o cambia nombreInicial / celularInicial
  useEffect(() => {
    if (isOpen) {
      const limpioNombre = (nombreInicial || "").trim();
      if (limpioNombre) {
        const partes = limpioNombre.split(/\s+/);
        if (partes.length === 1) {
          setNombres(partes[0]);
          setApellidos("");
        } else {
          setNombres(partes[0]);
          setApellidos(partes.slice(1).join(" "));
        }
      } else {
        setNombres("");
        setApellidos("");
      }

      setCelular(celularInicial ? celularInicial.trim() : "");
      setDireccion("");
      setApodo("");
      setTipoDocumento("CC");
      setNumeroDocumento("");
      setSaldoInicial("");
      setNotas("");
      setEtiquetas([]);
      setInputEtiqueta("");
      setMostrarMasOpciones(false);
    }
  }, [isOpen, nombreInicial, celularInicial]);

  if (!mounted || !isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombresLimpio = nombres.trim();
    const apellidosLimpio = apellidos.trim();
    const nombreCalculado = apellidosLimpio ? `${nombresLimpio} ${apellidosLimpio}` : nombresLimpio;

    if (!nombresLimpio) {
      toast.error("El nombre del cliente es obligatorio.");
      return;
    }

    // Consolidar etiquetas pendientes en input
    const tagsParaGuardar = [...etiquetas];
    if (inputEtiqueta.trim()) {
      inputEtiqueta.split(/[,;-]/).forEach(t => {
        const clean = t.trim();
        if (clean && !tagsParaGuardar.some(exist => exist.toLowerCase() === clean.toLowerCase())) {
          tagsParaGuardar.push(clean);
        }
      });
    }

    try {
      setGuardando(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sesión inválida.");

      const respuesta = await fetch('/api/clientes/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nombre: nombreCalculado,
          nombres: nombresLimpio,
          apellidos: apellidosLimpio,
          apodo: apodo.trim(),
          tipoDocumento: tipoDocumento || 'CC',
          numeroDocumento: numeroDocumento.trim(),
          saldoInicial: saldoInicial.trim() ? Number(saldoInicial.replace(/[^\d]/g, '')) : 0,
          celular: celular.trim(),
          direccion: direccion.trim(),
          notas: notas.trim(),
          etiquetas: tagsParaGuardar
        })
      });

      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(resultado.error || "No se pudo registrar el cliente.");
      }

      const clienteCreado: Cliente = resultado.cliente || {
        id: resultado.id,
        nombre: nombreCalculado,
        nombres: nombresLimpio,
        apellidos: apellidosLimpio,
        apodo: apodo.trim(),
        tipoDocumento: tipoDocumento || 'CC',
        numeroDocumento: numeroDocumento.trim(),
        celular: celular.trim(),
        direccion: direccion.trim(),
        notas: notas.trim(),
        etiquetas: tagsParaGuardar,
        deudaTotal: saldoInicial.trim() ? Number(saldoInicial.replace(/[^\d]/g, '')) : 0,
        usuarioId: auth.currentUser?.uid || ""
      };

      toast.success(`Cliente ${nombreCalculado} registrado con éxito ✨`);
      onClienteCreado(clienteCreado);
      onClose();
    } catch (err: any) {
      console.error("Error al registrar cliente:", err);
      toast.error(err?.message || "Error al registrar cliente.");
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onClose(); }}
      className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0f172a] rounded-[2rem] max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Cabecera Pinned */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0f172a]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Registrar Nuevo Cliente
              </h3>
              <p className="text-xs text-slate-400">Guarda datos para fiados, separes y WhatsApp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario con cuerpo scrolleable y footer fijo */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 scrollbar-thin">
            {/* 1. NOMBRES Y APELLIDOS (ESENCIAL) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Nombres *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nombres}
                  onChange={(e) => setNombres(e.target.value)}
                  placeholder="Ej: Carlos"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Apellidos (Opcional)
                </label>
                <input
                  type="text"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="Ej: Mendoza"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 2. CONTACTO: CELULAR Y DIRECCIÓN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Celular (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="Ej: 3101234567"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Dirección o Referencia
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Carrera 5 # 12-30"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 3. BOTÓN ACORDEÓN: MÁS DATOS (NO SATURA EL SISTEMA) */}
            {permitirOpcionesAvanzadas && (
              <>
                <button
                  type="button"
                  onClick={() => setMostrarMasOpciones(prev => !prev)}
                  className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>{mostrarMasOpciones ? "Ocultar datos adicionales" : "+ Más datos (Apodo, Documento, Saldo, Etiquetas)"}</span>
                    {(apodo || numeroDocumento || saldoInicial || notas || etiquetas.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Tiene datos adicionales" />
                    )}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${mostrarMasOpciones ? 'rotate-180' : ''}`} />
                </button>

                {mostrarMasOpciones && (
                  <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                        <Smile size={13} className="text-amber-500" /> Apodo / Alias (Opcional)
                      </label>
                      <input
                        type="text"
                        value={apodo}
                        onChange={(e) => setApodo(e.target.value)}
                        placeholder="Ej: Cachaco, El Paisa, Doña Mary..."
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    {/* Documento (CC / NIT / CE) */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          Tipo Doc.
                        </label>
                        <select
                          value={tipoDocumento}
                          onChange={(e) => setTipoDocumento(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                        >
                          <option value="CC">CC</option>
                          <option value="NIT">NIT</option>
                          <option value="CE">CE</option>
                          <option value="PP">Pasaporte</option>
                          <option value="TI">TI</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                          Cédula / Documento (Opcional)
                        </label>
                        <input
                          type="text"
                          value={numeroDocumento}
                          onChange={(e) => setNumeroDocumento(e.target.value)}
                          placeholder="Ej: 1020304050"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Saldo Inicial Pendiente Opcional */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <DollarSign size={13} className="text-amber-500" /> Saldo Inicial Pendiente (Opcional)
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">Si ya te debía dinero</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                        <input
                          type="text"
                          value={saldoInicial ? Number(saldoInicial).toLocaleString('es-CO') : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\d]/g, '');
                            setSaldoInicial(val);
                          }}
                          placeholder="0"
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-sm font-bold text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        Notas / Referencias (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        placeholder="Ej: Parentesco (Hermana de Juan), casa azul frente al parque..."
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                      />
                    </div>

                    {/* Etiquetas */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                        <Tag size={13} className="text-violet-500" /> Etiquetas Personalizadas (Opcional)
                      </label>
                      {etiquetas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {etiquetas.map((t, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                              🏷️ {t}
                              <button
                                type="button"
                                onClick={() => setEtiquetas(prev => prev.filter((_, i) => i !== idx))}
                                className="hover:text-rose-500 p-0.5 cursor-pointer"
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputEtiqueta}
                          onChange={(e) => setInputEtiqueta(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              const val = inputEtiqueta.trim();
                              if (val) {
                                const partes = val.split(/[,;-]/).map(t => t.trim()).filter(Boolean);
                                setEtiquetas(prev => {
                                  const list = [...prev];
                                  partes.forEach(p => {
                                    if (!list.some(x => x.toLowerCase() === p.toLowerCase())) {
                                      list.push(p);
                                    }
                                  });
                                  return list;
                                });
                                setInputEtiqueta("");
                              }
                            }
                          }}
                          placeholder="Ej: Mayorista, Vecino, Familia..."
                          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = inputEtiqueta.trim();
                            if (val) {
                              const partes = val.split(/[,;-]/).map(t => t.trim()).filter(Boolean);
                              setEtiquetas(prev => {
                                const list = [...prev];
                                partes.forEach(p => {
                                  if (!list.some(x => x.toLowerCase() === p.toLowerCase())) {
                                    list.push(p);
                                  }
                                });
                                return list;
                              });
                              setInputEtiqueta("");
                            }
                          }}
                          disabled={!inputEtiqueta.trim()}
                          className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer shrink-0"
                        >
                          <Plus size={13} /> Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Fijo con Botones */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/80 dark:bg-[#020617]/80 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {guardando ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
