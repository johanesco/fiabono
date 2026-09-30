"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, Store, ShoppingBag, CreditCard, Bookmark, 
  Receipt, ArrowRight, ArrowLeft, CheckCircle2, X,
  Smartphone, BarChart3, ChevronRight, Zap, Tag, Check
} from 'lucide-react';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { RUBROS_NEGOCIOS, RubroNegocio } from "@/constants/rubrosCategorias";
import toast from "react-hot-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nombreUsuario: string;
  nombreNegocio: string;
  cuentaPrincipalId?: string;
  plan?: string;
  onGuardarCategorias?: (rubroId: string, categorias: string[]) => void;
}

export default function ModalTourBienvenida({
  isOpen,
  onClose,
  nombreUsuario,
  nombreNegocio,
  cuentaPrincipalId,
  plan = "comercio",
  onGuardarCategorias
}: Props) {
  const [paso, setPaso] = useState(1);
  const [rubrosSeleccionadosIds, setRubrosSeleccionadosIds] = useState<string[]>([]);
  const [guardandoRubro, setGuardandoRubro] = useState(false);
  const router = useRouter();

  const rubrosActuales: RubroNegocio[] = 
    RUBROS_NEGOCIOS.filter(r => rubrosSeleccionadosIds.includes(r.id));
  const categoriasCombinadas: string[] = 
    Array.from(new Set(rubrosActuales.flatMap(r => r.categorias)));

  useEffect(() => {
    if (isOpen) {
      setPaso(1);
      try {
        const guardado = localStorage.getItem('fiabono_rubros_negocio');
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRubrosSeleccionadosIds(parsed);
            return;
          }
        }
        const guardadoSimple = localStorage.getItem('fiabono_rubro_negocio');
        if (guardadoSimple && RUBROS_NEGOCIOS.some(r => r.id === guardadoSimple)) {
          setRubrosSeleccionadosIds([guardadoSimple]);
          return;
        }
      } catch (e) {}
      setRubrosSeleccionadosIds([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const alternarRubro = (id: string) => {
    setRubrosSeleccionadosIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const guardarConfiguracionRubros = async () => {
    if (rubrosSeleccionadosIds.length === 0) return;
    try {
      const rubroPrincipal = rubrosSeleccionadosIds[0] || 'moda_ropa';
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_rubro_negocio', rubroPrincipal);
        localStorage.setItem('fiabono_rubros_negocio', JSON.stringify(rubrosSeleccionadosIds));
        localStorage.setItem(`fiabono_categorias_${cuentaPrincipalId || 'local'}`, JSON.stringify(categoriasCombinadas));
      }

      if (cuentaPrincipalId) {
        setGuardandoRubro(true);
        await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
          rubroNegocio: rubroPrincipal,
          rubrosNegocio: rubrosSeleccionadosIds,
          categoriasPersonalizadas: categoriasCombinadas,
          fechaConfiguracionRubro: new Date()
        });
      }

      if (onGuardarCategorias) {
        onGuardarCategorias(rubroPrincipal, categoriasCombinadas);
      }
    } catch (e) {
      console.warn("No se pudo guardar rubro en Firestore (se mantiene local):", e);
    } finally {
      setGuardandoRubro(false);
    }
  };

  const totalPasos = 4;

  const irSiguiente = async () => {
    if (paso === 1) {
      if (rubrosSeleccionadosIds.length === 0) {
        toast.error("Por favor selecciona al menos un tipo de negocio para continuar.");
        return;
      }
      await guardarConfiguracionRubros();
    }
    if (paso < totalPasos) {
      setPaso(paso + 1);
    } else {
      finalizarTour();
    }
  };

  const irAnterior = () => {
    if (paso > 1) {
      setPaso(paso - 1);
    }
  };

  const cerrarTour = async () => {
    try {
      if (paso === 1) {
        await guardarConfiguracionRubros();
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_tour_completado', 'true');
      }
    } catch (e) {}
    onClose();
  };

  const finalizarTour = async () => {
    try {
      await guardarConfiguracionRubros();
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_tour_completado', 'true');
      }
      toast.success("¡Tu punto de venta está listo!", { icon: "🚀" });
    } catch (e) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b1329] border border-slate-200/80 dark:border-slate-800 w-full max-w-2xl rounded-[2.5rem] p-5 sm:p-8 shadow-2xl relative max-h-[94vh] overflow-y-auto flex flex-col justify-between">
        
        {/* Botón Salir */}
        <button 
          type="button"
          onClick={cerrarTour}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer z-10"
          title="Cerrar tour"
        >
          <X size={20}/>
        </button>

        {/* CONTENIDO SEGÚN EL PASO */}
        <div>
          {/* PASO 1: MULTI-SELECTOR DE RUBROS Y CATEGORÍAS */}
          {paso === 1 && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center pt-1 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-2 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full text-white text-[9px] font-black bg-gradient-to-r from-blue-600 to-indigo-600">
                    Paso 1 de {totalPasos}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    Personaliza tu Negocio
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-1">
                  ¿Qué vendes en tu negocio? 🛍️
                </h2>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                  Selecciona <strong className="text-blue-600 dark:text-blue-400 font-bold">uno o varios rubros</strong> para preparar tus categorías iniciales:
                </p>
              </div>

              {/* Cuadrícula de Rubros Multiseleccionables */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mb-3.5">
                {RUBROS_NEGOCIOS.map((rubro) => {
                  const estaSeleccionado = rubrosSeleccionadosIds.includes(rubro.id);
                  return (
                    <button
                      key={rubro.id}
                      type="button"
                      onClick={() => alternarRubro(rubro.id)}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer active:scale-95 ${
                        estaSeleccionado
                          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {estaSeleccionado ? (
                        <span className="absolute top-2 right-2 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] shadow-xs">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="absolute top-2 right-2 w-4 h-4 border border-slate-300 dark:border-slate-700 rounded-full" />
                      )}
                      <span className="text-xl sm:text-2xl mb-1 block">{rubro.icono}</span>
                      <div>
                        <h4 className={`text-xs font-black leading-tight ${estaSeleccionado ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-white'}`}>
                          {rubro.nombre}
                        </h4>
                        <p className="text-[9.5px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                          {rubro.descripcion}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Vista Previa de Categorías Combinadas */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800/80 mb-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Tag size={13} className="text-blue-600 dark:text-blue-400" />
                    Categorías que crearemos ({rubrosSeleccionadosIds.length} rubro{rubrosSeleccionadosIds.length > 1 ? 's' : ''}):
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {categoriasCombinadas.length} sugeridas
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar pt-0.5">
                  {categoriasCombinadas.length === 0 ? (
                    <div className="w-full py-4 text-center text-xs font-bold text-slate-400">
                      Selecciona uno o más rubros arriba para ver tus categorías sugeridas.
                    </div>
                  ) : (
                    categoriasCombinadas.map((cat, idx) => (
                      <span 
                        key={idx}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs animate-in zoom-in-95 duration-150"
                      >
                        {cat}
                      </span>
                    ))
                  )}
                </div>

                {/* Nota Amigable y Tranquilizadora */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-start gap-2">
                  <span className="text-sm shrink-0">💡</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    <strong className="text-slate-700 dark:text-slate-300">Tranquilo:</strong> Si te falta alguna categoría o deseas cambiarlas, podrás editarlas, renombrarlas o agregar nuevas cuando quieras desde el módulo de <strong className="text-blue-600 dark:text-blue-400">Inventario</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: VENTAS RÁPIDAS Y COBRO */}
          {paso === 2 && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center pt-1 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-3 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full text-white text-[9px] font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
                    Paso 2 de {totalPasos}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    Tu Punto de Venta
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                  ¡Bienvenido a Fiabono, ${nombreUsuario || 'Comerciante'}! 🎉
                </h2>

                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                  Tu negocio "${nombreNegocio || 'Mi Comercio'}" ya está listo en el sistema.
                </p>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Fiabono está diseñado para que cobres más rápido, tengas tu inventario al día y nunca más pierdas dinero en cuentas en papel.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  {
                    icono: Zap,
                    color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
                    titulo: "Ventas Rápidas en 3 Segundos",
                    detalle: "Registra cobros con lector de código de barras, fotos o texto libre."
                  },
                  {
                    icono: Smartphone,
                    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
                    titulo: "Tickets por WhatsApp",
                    detalle: "Envía recibos digitales y comprobantes térmicos con 1 clic."
                  },
                  {
                    icono: BarChart3,
                    color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
                    titulo: "Caja y Balance Diario",
                    detalle: "Controla entradas en efectivo, transferencias y ganancias al instante."
                  }
                ].map((t, idx) => {
                  const Icono = t.icono;
                  return (
                    <div 
                      key={idx}
                      className="flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/70 dark:border-slate-800/80"
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${t.color}`}>
                        <Icono size={20}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white mb-0.5">
                          {t.titulo}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {t.detalle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASO 3: FIADOS Y CARTERA */}
          {paso === 3 && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center pt-1 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-3 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full text-white text-[9px] font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
                    Paso 3 de {totalPasos}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    El Secreto del Negocio
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                  Fiados y Cartera Organizada 📒
                </h2>

                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  Dile adiós definitivo al cuaderno de hojas perdidas y tachones.
                </p>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Cada cliente tiene su historial digital individual con saldo en tiempo real, abonos parciales y recordatorios por WhatsApp.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  {
                    icono: Store,
                    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
                    titulo: "Directorio de Clientes",
                    detalle: "Búscalos por nombre o celular en la pantalla principal."
                  },
                  {
                    icono: CreditCard,
                    color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
                    titulo: "Abonar en Segundos",
                    detalle: "Registra abonos en efectivo, transferencias o datáfono."
                  },
                  {
                    icono: Receipt,
                    color: "text-purple-500 bg-purple-50 dark:bg-purple-500/10",
                    titulo: "Recordatorio Automático",
                    detalle: "Mensajes cordiales y profesionales de cobro sin pena."
                  }
                ].map((t, idx) => {
                  const Icono = t.icono;
                  return (
                    <div 
                      key={idx}
                      className="flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/70 dark:border-slate-800/80"
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${t.color}`}>
                        <Icono size={20}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white mb-0.5">
                          {t.titulo}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {t.detalle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PASO 4: PLAN SEPARE Y MODULOS PRO */}
          {paso === 4 && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center pt-1 mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-3 shadow-xs">
                  <span className="px-2 py-0.5 rounded-full text-white text-[9px] font-black bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600">
                    Paso 4 de {totalPasos}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    Exclusivo Fiabono
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                  Plan Separe y Módulos Pro 📦
                </h2>

                <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-1">
                  Multiplica tus ventas permitiendo apartar mercancía con abonos.
                </p>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  El Plan Separe con fotos de artículos y fecha límite te permite vender prendas y productos de alto valor asegurando el recaudo.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  {
                    icono: Bookmark,
                    color: "text-purple-500 bg-purple-50 dark:bg-purple-500/10",
                    titulo: "Apartados con Foto",
                    detalle: "Sube foto de la prenda o producto apartado por el cliente."
                  },
                  {
                    icono: ShoppingBag,
                    color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10",
                    titulo: "Inventario con Stock",
                    detalle: "Categorías automáticas, alertas de poco stock y códigos de barras."
                  },
                  {
                    icono: Sparkles,
                    color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
                    titulo: "14 Días de Prueba Activos",
                    detalle: "Disfruta de todas las características sin límites."
                  }
                ].map((t, idx) => {
                  const Icono = t.icono;
                  return (
                    <div 
                      key={idx}
                      className="flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/70 dark:border-slate-800/80"
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${t.color}`}>
                        <Icono size={20}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white mb-0.5">
                          {t.titulo}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {t.detalle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* PIE: STEPPER Y BOTONES */}
        <div className="pt-2">
          {/* Stepper Dots */}
          <div className="flex items-center justify-center gap-2 mb-3.5">
            {Array.from({ length: totalPasos }).map((_, idx) => {
              const numPaso = idx + 1;
              return (
                <button
                  key={numPaso}
                  type="button"
                  onClick={() => setPaso(numPaso)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    paso === numPaso 
                      ? 'w-9 bg-blue-600 shadow-sm' 
                      : 'w-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
                  }`}
                  title={`Ir al paso ${numPaso}`}
                />
              );
            })}
          </div>

          {/* Botones de Navegación del Tour */}
          <div className="flex items-center gap-2.5">
            {paso > 1 && (
              <button
                type="button"
                onClick={irAnterior}
                className="px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={16}/>
                <span className="hidden xs:inline">Atrás</span>
              </button>
            )}

            {paso < totalPasos ? (
              <button
                type="button"
                onClick={irSiguiente}
                disabled={guardandoRubro || (paso === 1 && rubrosSeleccionadosIds.length === 0)}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-blue-600/25 transition-all transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Siguiente</span>
                <ArrowRight size={18}/>
              </button>
            ) : (
              <button
                type="button"
                onClick={finalizarTour}
                disabled={guardandoRubro}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all transform active:scale-95 cursor-pointer"
              >
                <Sparkles size={18}/>
                <span>¡Comenzar a Usar Fiabono!</span>
              </button>
            )}
          </div>

          {/* Botón Saltear */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={cerrarTour}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              Saltar tour y comenzar a vender
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
