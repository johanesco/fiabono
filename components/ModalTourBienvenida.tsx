"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, Store, ShoppingBag, CreditCard, Bookmark, 
  Receipt, ArrowRight, ArrowLeft, CheckCircle2, X,
  Smartphone, BarChart3, ChevronRight, Zap
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nombreUsuario: string;
  nombreNegocio: string;
  plan?: string;
}

export default function ModalTourBienvenida({
  isOpen,
  onClose,
  nombreUsuario,
  nombreNegocio,
  plan = "comercio"
}: Props) {
  const [paso, setPaso] = useState(1);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setPaso(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const pasos = [
    {
      numero: 1,
      tag: "Tu Punto de Venta",
      titulo: `¡Bienvenido a Fiabono, ${nombreUsuario || 'Comerciante'}! 🎉`,
      subtitulo: `Tu negocio "${nombreNegocio || 'Mi Comercio'}" ya está listo en el sistema.`,
      descripcion: "Fiabono está diseñado para que cobres más rápido, tengas tu inventario al día y nunca más pierdas dinero en cuentas en papel.",
      colorGradiente: "from-blue-600 via-indigo-600 to-purple-600",
      colorBadge: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      tarjetas: [
        {
          icono: Zap,
          color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
          titulo: "Ventas Rápidas",
          detalle: "Registra cobros en 3 segundos con o sin inventario."
        },
        {
          icono: Smartphone,
          color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
          titulo: "Tickets por WhatsApp",
          detalle: "Envía recibos digitales y recordatorios con 1 clic."
        },
        {
          icono: BarChart3,
          color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
          titulo: "Caja y Balance Diario",
          detalle: "Controla entradas, salidas y ganancias al instante."
        }
      ]
    },
    {
      numero: 2,
      tag: "El Secreto del Negocio",
      titulo: "Fiados y Cartera Organizada 📒",
      subtitulo: "Dile adiós definitivo al cuaderno de hojas perdidas y tachones.",
      descripcion: "Cada cliente tiene su historial digital individual con saldo en tiempo real, abonos parciales y comprobantes de pago inmediatos.",
      colorGradiente: "from-emerald-600 via-teal-600 to-cyan-600",
      colorBadge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      tarjetas: [
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
          detalle: "Mensajes cordiales y profesionales por WhatsApp."
        }
      ]
    },
    {
      numero: 3,
      tag: "Exclusivo Fiabono",
      titulo: "Plan Separe y Módulos Pro 📦",
      subtitulo: "Multiplica tus ventas permitiendo apartar mercancía con abonos.",
      descripcion: "El Plan Separe con fotos de productos y fecha límite te permite vender prendas y artículos de alto valor asegurando el pago paso a paso.",
      colorGradiente: "from-purple-600 via-violet-600 to-indigo-600",
      colorBadge: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-200 dark:border-purple-500/20",
      tarjetas: [
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
          detalle: "Categorías, alertas de poco stock y códigos de barras."
        },
        {
          icono: Sparkles,
          color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
          titulo: "14 Días de Prueba Activos",
          detalle: "Disfruta de todas las características sin límites."
        }
      ]
    }
  ];

  const infoPaso = pasos[paso - 1];

  const irSiguiente = () => {
    if (paso < pasos.length) {
      setPaso(paso + 1);
    } else {
      onClose();
    }
  };

  const irAnterior = () => {
    if (paso > 1) {
      setPaso(paso - 1);
    }
  };

  const cerrarTour = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_tour_completado', 'true');
      }
    } catch (e) {}
    onClose();
  };

  const finalizarTour = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_tour_completado', 'true');
      }
    } catch (e) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0b1329] border border-slate-200/80 dark:border-slate-800 w-full max-w-xl rounded-[2.5rem] p-6 sm:p-9 shadow-2xl relative max-h-[94vh] overflow-y-auto">
        
        {/* Botón Salir */}
        <button 
          type="button"
          onClick={cerrarTour}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Cerrar tour"
        >
          <X size={20}/>
        </button>

        {/* Encabezado del Paso */}
        <div className="text-center pt-1 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-3 shadow-xs">
            <span className={`px-2 py-0.5 rounded-full text-white text-[9px] font-black bg-gradient-to-r ${infoPaso.colorGradiente}`}>
              Paso {paso} de {pasos.length}
            </span>
            <span className="text-slate-700 dark:text-slate-300 font-bold">
              {infoPaso.tag}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
            {infoPaso.titulo}
          </h2>

          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
            {infoPaso.subtitulo}
          </p>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {infoPaso.descripcion}
          </p>
        </div>

        {/* Tarjetas de Features del Paso */}
        <div className="space-y-3 mb-6">
          {infoPaso.tarjetas.map((t, idx) => {
            const Icono = t.icono;
            return (
              <div 
                key={idx}
                className="flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/70 dark:border-slate-800/80 transition-all hover:border-slate-300 dark:hover:border-slate-700"
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

        {/* Stepper Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {pasos.map((p) => (
            <button
              key={p.numero}
              type="button"
              onClick={() => setPaso(p.numero)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                paso === p.numero 
                  ? 'w-9 bg-blue-600 shadow-sm' 
                  : 'w-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'
              }`}
              title={`Ir al paso ${p.numero}`}
            />
          ))}
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

          {paso < pasos.length ? (
            <button
              type="button"
              onClick={irSiguiente}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-blue-600/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <span>Siguiente</span>
              <ArrowRight size={18}/>
            </button>
          ) : (
            <button
              type="button"
              onClick={finalizarTour}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-emerald-600/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <Sparkles size={18}/>
              <span>¡Comenzar a Usar Fiabono!</span>
            </button>
          )}
        </div>

        {/* Botón Saltear */}
        <div className="text-center pt-3">
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
  );
}
