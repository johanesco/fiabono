"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { API_DB } from "../servicios/db";
import { X, Clock, Calendar, CheckCircle2, Trash2, Plus, Sparkles, AlertCircle, ShieldCheck } from 'lucide-react';

export interface HorarioItem {
  dias: string[];
  inicio: string;
  fin: string;
  activoAuto?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  usuarioId: string;
  nombreColaborador?: string;
  horariosIniciales?: HorarioItem[];
}

const DIAS_SEMANA = [
  { id: 'Lun', label: 'Lunes', corto: 'Lun' },
  { id: 'Mar', label: 'Martes', corto: 'Mar' },
  { id: 'Mie', label: 'Miércoles', corto: 'Mié' },
  { id: 'Jue', label: 'Jueves', corto: 'Jue' },
  { id: 'Vie', label: 'Viernes', corto: 'Vie' },
  { id: 'Sab', label: 'Sábado', corto: 'Sáb' },
  { id: 'Dom', label: 'Domingo', corto: 'Dom' },
];

export default function ModalHorarios({ 
  isOpen, 
  onClose, 
  usuarioId, 
  nombreColaborador = "Colaborador",
  horariosIniciales = [] 
}: Props) {
  const [restringirPorHorario, setRestringirPorHorario] = useState(false);
  const [horariosGuardados, setHorariosGuardados] = useState<HorarioItem[]>([]);
  
  // Inputs del turno en edición / creación
  const [seleccionDias, setSeleccionDias] = useState<string[]>(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']);
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("18:00");
  const [mostrarFormNuevoTurno, setMostrarFormNuevoTurno] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const tieneHorarios = Array.isArray(horariosIniciales) && horariosIniciales.length > 0;
      setRestringirPorHorario(tieneHorarios);
      setHorariosGuardados(tieneHorarios ? [...horariosIniciales] : []);
      setSeleccionDias(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']);
      setInicio('08:00');
      setFin('18:00');
      setMostrarFormNuevoTurno(!tieneHorarios);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDia = (diaId: string) => {
    setSeleccionDias(prev => 
      prev.includes(diaId) 
        ? prev.filter(d => d !== diaId) 
        : [...prev, diaId]
    );
  };

  const aplicarPreset = (dias: string[]) => {
    setSeleccionDias(dias);
  };

  const agregarTurnoALista = () => {
    if (seleccionDias.length === 0) {
      toast.error('Selecciona al menos un día para este horario');
      return false;
    }
    if (inicio >= fin) {
      toast.error('La hora de inicio debe ser anterior a la hora de fin');
      return false;
    }

    const nuevoTurno: HorarioItem = {
      dias: [...seleccionDias],
      inicio,
      fin,
      activoAuto: true
    };

    setHorariosGuardados(prev => [...prev, nuevoTurno]);
    setMostrarFormNuevoTurno(false);
    toast.success('Turno añadido a la lista');
    return true;
  };

  const eliminarTurno = (idx: number) => {
    setHorariosGuardados(prev => {
      const filtrados = prev.filter((_, i) => i !== idx);
      if (filtrados.length === 0) {
        setMostrarFormNuevoTurno(true);
      }
      return filtrados;
    });
  };

  const guardar = async () => {
    setLoading(true);
    try {
      let payloadHorarios: HorarioItem[] = [];

      // Si el switch está encendido, preparamos los horarios
      if (restringirPorHorario) {
        // Si hay turnos en la lista, usamos esos
        if (horariosGuardados.length > 0) {
          payloadHorarios = [...horariosGuardados];
        } 
        // Si no había agregado a la lista pero tiene días y horas configuradas en el form abierto:
        else if (seleccionDias.length > 0) {
          if (inicio >= fin) {
            toast.error('La hora de inicio debe ser anterior a la hora de fin');
            setLoading(false);
            return;
          }
          payloadHorarios = [{
            dias: [...seleccionDias],
            inicio,
            fin,
            activoAuto: true
          }];
        } else {
          toast.error('Debes seleccionar al menos un día o apagar la restricción de horario.');
          setLoading(false);
          return;
        }
      } else {
        // Restricción apagada: acceso libre sin límites
        payloadHorarios = [];
      }

      const res = await API_DB.actualizarHorariosColaborador(usuarioId, payloadHorarios);
      if (res.ok) {
        toast.success(
          restringirPorHorario 
            ? `Horario asignado con éxito a ${nombreColaborador}` 
            : `Restricción de horario desactivada para ${nombreColaborador}`
        );
        onClose();
      } else {
        toast.error('Ocurrió un error al guardar los horarios');
      }
    } catch (e) {
      toast.error('Error de conexión al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[92dvh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* CABECERA */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-[#020617]/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                Horario de Trabajo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Configurar turnos para: <strong className="text-blue-600 dark:text-blue-400">{nombreColaborador}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X size={18}/>
          </button>
        </div>

        {/* CONTENIDO CON SCROLL FLUIDO */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* INTERRUPTOR PRINCIPAL: ACTIVAR / DESACTIVAR RESTRICCIÓN */}
          <div 
            className="p-4 rounded-2xl bg-slate-50 dark:bg-[#020617] border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 cursor-pointer"
            onClick={() => setRestringirPorHorario(!restringirPorHorario)}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${restringirPorHorario ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Restringir Acceso por Horario
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {restringirPorHorario 
                    ? "Solo podrá entrar y registrar ventas dentro de las horas autorizadas."
                    : "Acceso libre: puede entrar a cualquier hora y cualquier día."}
                </p>
              </div>
            </div>

            <div className="relative inline-flex items-center shrink-0">
              <input 
                type="checkbox" 
                checked={restringirPorHorario} 
                readOnly
                className="sr-only" 
              />
              <div className={`w-11 h-6 rounded-full shadow-inner transition-colors ${restringirPorHorario ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <div className={`absolute top-[2px] left-[2px] bg-white border border-slate-300 rounded-full h-5 w-5 transition-transform ${restringirPorHorario ? 'translate-x-full border-transparent' : ''}`}></div>
              </div>
            </div>
          </div>

          {/* SI LA RESTRICCIÓN ESTÁ ACTIVADA */}
          {restringirPorHorario ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* LISTA DE TURNOS YA GUARDADOS */}
              {horariosGuardados.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      Turnos Asignados ({horariosGuardados.length})
                    </span>
                    {!mostrarFormNuevoTurno && (
                      <button
                        type="button"
                        onClick={() => setMostrarFormNuevoTurno(true)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Añadir otro turno
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {horariosGuardados.map((turno, idx) => (
                      <div 
                        key={idx} 
                        className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-black text-xs shadow-sm">
                            {turno.dias.length}d
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {turno.dias.length === 7 ? 'Todos los días' : turno.dias.join(', ')}
                            </p>
                            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                              {turno.inicio} hrs – {turno.fin} hrs
                            </p>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => eliminarTurno(idx)} 
                          className="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="Eliminar este turno"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FORMULARIO DE CREACIÓN DE TURNO */}
              {(mostrarFormNuevoTurno || horariosGuardados.length === 0) && (
                <div className="p-4 sm:p-5 rounded-2xl border-2 border-blue-500/20 bg-slate-50 dark:bg-[#020617] space-y-4">
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Calendar size={14} className="text-blue-500" />
                      {horariosGuardados.length > 0 ? "Nuevo Turno Adicional" : "Días Laborales"}
                    </span>
                    {horariosGuardados.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setMostrarFormNuevoTurno(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Cancelar turno
                      </button>
                    )}
                  </div>

                  {/* PRESETS RÁPIDOS DE 1 TOQUE */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => aplicarPreset(['Lun', 'Mar', 'Mie', 'Jue', 'Vie'])}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
                    >
                      Lun a Vie
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarPreset(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'])}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
                    >
                      Lun a Sáb
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarPreset(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'])}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
                    >
                      Toda la semana
                    </button>
                    <button
                      type="button"
                      onClick={() => aplicarPreset(['Sab', 'Dom'])}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-500 transition-colors cursor-pointer"
                    >
                      Fines de semana
                    </button>
                  </div>

                  {/* PILLS INTERACTIVAS POR DÍA */}
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {DIAS_SEMANA.map(dia => {
                      const activo = seleccionDias.includes(dia.id);
                      return (
                        <button
                          key={dia.id}
                          type="button"
                          onClick={() => toggleDia(dia.id)}
                          className={`py-2 sm:py-2.5 text-center rounded-xl text-xs font-black transition-all cursor-pointer ${
                            activo
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-102'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="block sm:hidden">{dia.corto}</span>
                          <span className="hidden sm:block">{dia.corto}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* RANGO DE HORARIOS (INICIO Y FIN) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Hora Inicio
                      </label>
                      <input 
                        type="time" 
                        value={inicio} 
                        onChange={e => setInicio(e.target.value)} 
                        className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 shadow-sm cursor-pointer" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Hora Fin
                      </label>
                      <input 
                        type="time" 
                        value={fin} 
                        onChange={e => setFin(e.target.value)} 
                        className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 shadow-sm cursor-pointer" 
                      />
                    </div>
                  </div>

                  {/* Botón de añadir a la lista si quiere múltiples turnos */}
                  {horariosGuardados.length > 0 && (
                    <button
                      type="button"
                      onClick={agregarTurnoALista}
                      className="w-full py-2.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={15} /> Confirmar este turno adicional
                    </button>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-black text-slate-900 dark:text-white text-sm">
                Acceso sin Restricciones
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                <strong>{nombreColaborador}</strong> podrá iniciar sesión a cualquier hora del día y cualquier día de la semana sin ser expulsado.
              </p>
            </div>
          )}

        </div>

        {/* PIE DE ACCIONES */}
        <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-[#020617]/50">
          <button 
            type="button"
            onClick={onClose} 
            className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button 
            type="button"
            onClick={guardar} 
            disabled={loading} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Guardando...</span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Guardar Horario</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
