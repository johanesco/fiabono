"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { API_DB } from "../servicios/db";
import { X, Clock } from 'lucide-react';

interface Horario { dias: string[]; inicio: string; fin: string; activoAuto?: boolean }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuarioId: string;
  horariosIniciales?: Horario[];
}

const DIAS = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];

export default function ModalHorarios({ isOpen, onClose, usuarioId, horariosIniciales = [] }: Props) {
  const [horarios, setHorarios] = useState<Horario[]>(horariosIniciales || []);
  const [seleccionDias, setSeleccionDias] = useState<string[]>([]);
  const [inicio, setInicio] = useState("09:00");
  const [fin, setFin] = useState("17:00");
  const [activoAuto, setActivoAuto] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHorarios(horariosIniciales || []);
      setSeleccionDias([]);
      setInicio('09:00');
      setFin('17:00');
      setActivoAuto(true);
    }
  }, [isOpen, horariosIniciales]);

  if (!isOpen) return null;

  const toggleDia = (d: string) => {
    setSeleccionDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const agregarHorario = () => {
    if (seleccionDias.length === 0) return toast.error('Selecciona al menos un día');
    if (inicio >= fin) return toast.error('La hora de inicio debe ser menor que la de fin');
    const nuevo: Horario = { dias: seleccionDias, inicio, fin, activoAuto };
    setHorarios(prev => [...prev, nuevo]);
    // reset
    setSeleccionDias([]); setInicio('09:00'); setFin('17:00'); setActivoAuto(true);
  };

  const guardar = async () => {
    setLoading(true);
    try {
      const res = await API_DB.actualizarHorariosColaborador(usuarioId, horarios);
      if (res.ok) {
        toast.success('Horarios guardados correctamente');
        setHorarios(horarios);
        onClose();
      } else {
        toast.error('Error al guardar horarios');
      }
    } catch (e) {
      toast.error('Error inesperado');
    } finally { setLoading(false); }
  };

  const eliminarHorario = (idx: number) => setHorarios(prev => prev.filter((_,i) => i!==idx));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-6 w-full max-w-2xl shadow-xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 dark:bg-[#020617]"><X size={18}/></button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-600 text-white rounded-lg flex items-center justify-center"><Clock size={20}/></div>
          <h3 className="text-xl font-black">Horarios de Actividad Automática</h3>
        </div>

        <div className="mb-4">
          <p className="text-sm text-slate-500">Define uno o varios horarios para que este colaborador se active automáticamente.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-xl">
            <p className="font-bold mb-2">Días</p>
            <div className="flex flex-wrap gap-2">
              {DIAS.map(d => (
                <button key={d} onClick={() => toggleDia(d)} className={`px-3 py-2 rounded-md border ${seleccionDias.includes(d) ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-700'}`}>
                  {d}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-sm text-slate-500">Inicio</label>
              <input type="time" value={inicio} onChange={e => setInicio(e.target.value)} className="w-full p-2 mt-1 border rounded-md bg-slate-50" />
            </div>
            <div className="mt-3">
              <label className="block text-sm text-slate-500">Fin</label>
              <input type="time" value={fin} onChange={e => setFin(e.target.value)} className="w-full p-2 mt-1 border rounded-md bg-slate-50" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input type="checkbox" checked={activoAuto} onChange={e => setActivoAuto(e.target.checked)} /> <span className="text-sm">Activar automáticamente</span>
            </div>
            <button onClick={agregarHorario} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md">Agregar horario</button>
          </div>

          <div className="p-4 border rounded-xl">
            <p className="font-bold mb-2">Horarios actuales</p>
            {horarios.length === 0 ? (
              <p className="text-sm text-slate-500">No hay horarios definidos.</p>
            ) : (
              <div className="space-y-3">
                {horarios.map((h, idx) => (
                  <div key={idx} className="p-3 border rounded-md flex justify-between items-center">
                    <div>
                      <div className="text-sm font-bold">{h.dias.join(', ')}</div>
                      <div className="text-xs text-slate-500">{h.inicio} - {h.fin} {h.activoAuto ? '(Auto)' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => eliminarHorario(idx)} className="text-rose-500 text-sm font-bold">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-md border">Cancelar</button>
          <button onClick={guardar} disabled={loading} className="bg-emerald-600 text-white px-4 py-2 rounded-md">{loading ? 'Guardando...' : 'Guardar horarios'}</button>
        </div>

      </div>
    </div>
  );
}
