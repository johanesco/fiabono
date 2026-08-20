"use client";
import { useState } from "react";
import { X, Sparkles, ShieldCheck, Ticket } from "lucide-react";
import toast from "react-hot-toast";
import { API_DB } from "../servicios/db";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

interface ModalSuscripcionProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaPrincipalId: string;
}

export default function ModalSuscripcion({ isOpen, onClose, cuentaPrincipalId }: ModalSuscripcionProps) {
  const [codigoBono, setCodigoBono] = useState("");
  const [cargando, setCargando] = useState(false);

  if (!isOpen) return null;

  const manejarAplicarBono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoBono.trim()) {
      toast.error("Por favor ingresa un código de bono.");
      return;
    }

    setCargando(true);
    try {
      // 1. Verificamos el código usando la función que creamos en db.ts
      const resultado = await API_DB.verificarCodigoPromocional(codigoBono.trim().toUpperCase());

      if (resultado.valido) {
        // 2. Calculamos la fecha de vencimiento (30 días a partir de hoy)
        const nuevaFechaVencimiento = new Date();
        nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + 30);

        // 3. Actualizamos el plan del usuario en Firestore
        await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
          plan: "pro",
          planVence: nuevaFechaVencimiento
        });

        toast.success("¡Felicidades! Tu Plan PRO ha sido activado por 1 mes 🚀");
        onClose();
        window.location.reload(); // Recargamos para que la interfaz se actualice de inmediato
      } else {
        toast.error("El código ingresado no es válido o ya expiró.");
      }
    } catch (error) {
      toast.error("Ocurrió un error al procesar el bono.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 relative">
        
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 bg-slate-100 dark:bg-[#020617] text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full p-2 transition-colors cursor-pointer"
        >
          <X size={20}/>
        </button>

        <div className="text-center mb-6 pt-2">
          <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-4 text-white">
            <Sparkles size={30} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white">Activa tu Plan PRO</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ingresa tu código promocional para disfrutar de 1 mes sin límites.
          </p>
        </div>

        <form onSubmit={manejarAplicarBono} className="flex flex-col gap-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Ticket size={20} />
            </span>
            <input 
              type="text" 
              placeholder="Ej. PRO2026" 
              value={codigoBono} 
              onChange={e => setCodigoBono(e.target.value)}
              className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white font-bold uppercase tracking-wider text-center" 
            />
          </div>

          <button 
            type="submit" 
            disabled={cargando}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black text-base py-4 rounded-2xl shadow-lg shadow-blue-600/30 transition-transform transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {cargando ? "Validando bono..." : "Canjear y Activar PRO"}
          </button>
        </form>

        <div className="mt-6 text-center flex items-center justify-center gap-1 text-xs text-slate-400 font-medium">
          <ShieldCheck size={16} className="text-emerald-500" /> Garantía de seguridad en tu cuenta
        </div>
      </div>
    </div>
  );
}