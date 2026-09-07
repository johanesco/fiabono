"use client";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "@/hooks/AuthContext";
import { X, Info, CheckCircle2, AlertTriangle, AlertOctagon } from "lucide-react";

export default function GlobalAnnouncements() {
  const { datosSesion } = useAuth();
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Cargar del localStorage los que ya cerró
    const guardados = localStorage.getItem('fiabono_anuncios_cerrados');
    if (guardados) {
      try {
        setCerrados(JSON.parse(guardados));
      } catch (e) {}
    }

    if (!datosSesion) return;

    // Escuchar anuncios activos
    const q = query(collection(db, "anuncios"), where("activo", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filtrar los que aplican a este usuario
      const correo = datosSesion.correoNegocio?.toLowerCase() || '';
      const filtrados = lista.filter((a: any) => {
        if (a.emailObjetivo) {
          return a.emailObjetivo.toLowerCase() === correo;
        }
        return true; // Es global
      });

      setAnuncios(filtrados);
    });

    return () => unsub();
  }, [datosSesion]);

  const cerrarAnuncio = (id: string) => {
    const nuevosCerrados = { ...cerrados, [id]: true };
    setCerrados(nuevosCerrados);
    localStorage.setItem('fiabono_anuncios_cerrados', JSON.stringify(nuevosCerrados));
  };

  if (!datosSesion || anuncios.length === 0) return null;

  // Filtrar los que no ha cerrado (o los que son persistentes)
  const anunciosVisibles = anuncios.filter(a => !a.cerrable || !cerrados[a.id]);

  if (anunciosVisibles.length === 0) return null;

  return (
    <div className="flex flex-col w-full z-[8000] relative">
      {anunciosVisibles.map(a => {
        
        let bgColor = "bg-blue-600 text-white";
        let Icon = Info;
        
        if (a.tipo === 'success') {
          bgColor = "bg-emerald-600 text-white";
          Icon = CheckCircle2;
        } else if (a.tipo === 'warning') {
          bgColor = "bg-amber-500 text-white";
          Icon = AlertTriangle;
        } else if (a.tipo === 'error') {
          bgColor = "bg-rose-600 text-white";
          Icon = AlertOctagon;
        }

        return (
          <div key={a.id} className={`w-full ${bgColor} px-4 py-3 flex items-start sm:items-center justify-between gap-3 shadow-md relative overflow-hidden animate-in slide-in-from-top-2`}>
            
            {/* Decals para que se vea más pro */}
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none scale-150 transform translate-x-4 -translate-y-4">
               <Icon size={120} />
            </div>

            <div className="flex items-start sm:items-center gap-3 relative z-10 flex-1">
              <div className="bg-white/20 p-2 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <h4 className="font-black text-[13px] sm:text-sm tracking-wide">{a.titulo}</h4>
                <p className="text-[11px] sm:text-xs font-medium opacity-90 leading-tight mt-0.5 max-w-3xl">{a.mensaje}</p>
              </div>
            </div>

            {a.cerrable && (
              <button 
                onClick={() => cerrarAnuncio(a.id)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0 relative z-10"
                title="Cerrar Anuncio"
              >
                <X size={18} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
