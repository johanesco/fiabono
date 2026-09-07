"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, updateDoc, doc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { Crown, Search, Edit2, ShieldAlert, CheckCircle2, Ticket, X, Calendar, Plus, Trash2, Power } from 'lucide-react';

export default function MasterPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  
  const [cargando, setCargando] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [bonos, setBonos] = useState<any[]>([]);
  
  const [busqueda, setBusqueda] = useState("");
  const [tabActiva, setTabActiva] = useState<'usuarios' | 'bonos'>('usuarios');

  // Modal para forzar plan
  const [modalPlan, setModalPlan] = useState<{ visible: boolean; usuario: any }>({ visible: false, usuario: null });
  const [formPlan, setFormPlan] = useState<{ plan: 'gratis'|'comercio'|'pro'; dias: number }>({ plan: 'comercio', dias: 30 });

  // Modal para crear bono
  const [modalBono, setModalBono] = useState(false);
  const [formBono, setFormBono] = useState({ 
    codigo: "", planOtorgado: "pro", diasOtorgados: 30, emailObjetivo: "", unSoloUso: true 
  });

  useEffect(() => {
    // PROTECCIÓN ESTRICTA
    if (datosSesion && datosSesion.correoNegocio !== 'johanescobar1@gmail.com') {
      router.replace('/dashboard/inicio');
      return;
    }

    if (datosSesion?.correoNegocio === 'johanescobar1@gmail.com') {
      cargarDatos();
    }
  }, [datosSesion, router]);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // 1. Cargar Usuarios (Solo cuentas principales)
      const qUsers = query(collection(db, "usuarios"), where("rol", "==", "admin"));
      const snapUsers = await getDocs(qUsers);
      const listaUsers = snapUsers.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Ordenar por fecha de vencimiento (los que vencen pronto primero)
      listaUsers.sort((a: any, b: any) => {
        const timeA = a.planVence?.toDate ? a.planVence.toDate().getTime() : (a.planVence ? new Date(a.planVence).getTime() : 0);
        const timeB = b.planVence?.toDate ? b.planVence.toDate().getTime() : (b.planVence ? new Date(b.planVence).getTime() : 0);
        return timeA - timeB;
      });
      setUsuarios(listaUsers);

      // 2. Cargar Bonos
      const snapBonos = await getDocs(collection(db, "codigos_promocionales"));
      const listaBonos = snapBonos.docs.map(d => ({ id: d.id, ...d.data() }));
      setBonos(listaBonos);

    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos maestros.");
    } finally {
      setCargando(false);
    }
  };

  const guardarCambioPlan = async () => {
    if (!modalPlan.usuario) return;
    try {
      const nuevaFecha = new Date();
      nuevaFecha.setDate(nuevaFecha.getDate() + formPlan.dias);
      
      await updateDoc(doc(db, "usuarios", modalPlan.usuario.id), {
        plan: formPlan.plan,
        planVence: nuevaFecha,
        cicloPlan: formPlan.dias >= 365 ? 'anual' : 'mensual'
      });
      
      toast.success("Plan forzado exitosamente");
      setModalPlan({ visible: false, usuario: null });
      cargarDatos();
    } catch (e) {
      toast.error("Error al cambiar plan.");
    }
  };

  const crearBono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBono.codigo.trim()) return;
    
    try {
      await setDoc(doc(db, "codigos_promocionales", formBono.codigo.trim().toUpperCase()), {
        activo: true,
        planOtorgado: formBono.planOtorgado,
        diasOtorgados: Number(formBono.diasOtorgados),
        emailObjetivo: formBono.emailObjetivo.trim().toLowerCase(),
        unSoloUso: formBono.unSoloUso,
        fechaCreacion: new Date()
      });
      toast.success("Bono creado exitosamente");
      setModalBono(false);
      setFormBono({ codigo: "", planOtorgado: "pro", diasOtorgados: 30, emailObjetivo: "", unSoloUso: true });
      cargarDatos();
    } catch (e) {
      toast.error("Error al crear bono.");
    }
  };

  const eliminarBono = async (id: string) => {
    if (confirm("¿Seguro que deseas eliminar este código?")) {
      await deleteDoc(doc(db, "codigos_promocionales", id));
      cargarDatos();
    }
  };

  const alternarBono = async (id: string, estadoActual: boolean) => {
    await updateDoc(doc(db, "codigos_promocionales", id), { activo: !estadoActual });
    cargarDatos();
  };

  const calcularEstadoPlan = (u: any) => {
    if (u.plan === 'gratis' || !u.planVence) return { label: 'Gratis', color: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' };
    const timeVence = u.planVence.toDate ? u.planVence.toDate().getTime() : new Date(u.planVence).getTime();
    const daysLeft = Math.ceil((timeVence - new Date().getTime()) / (1000 * 3600 * 24));
    
    if (daysLeft < -2) return { label: 'Vencido', color: 'bg-rose-100 text-rose-700' };
    if (daysLeft <= 0) return { label: 'En Gracia', color: 'bg-amber-100 text-amber-700' };
    return { label: `Activo (${daysLeft}d)`, color: 'bg-emerald-100 text-emerald-700' };
  };

  if (cargando) return <div className="p-10 text-center font-bold">Cargando God Mode...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#020617] p-4 sm:p-8">
      <div className="max-w-6xl mx-auto pb-20">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Crown className="text-amber-500" size={32} /> Panel Maestro
            </h1>
            <p className="text-slate-500 font-medium">Control total de Inquilinos y Monetización.</p>
          </div>
          <div className="flex gap-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl">
            <button onClick={() => setTabActiva('usuarios')} className={`px-4 py-2 font-bold rounded-xl transition-all ${tabActiva === 'usuarios' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Inquilinos ({usuarios.length})</button>
            <button onClick={() => setTabActiva('bonos')} className={`px-4 py-2 font-bold rounded-xl transition-all ${tabActiva === 'bonos' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Códigos ({bonos.length})</button>
          </div>
        </div>

        {/* TAB: USUARIOS */}
        {tabActiva === 'usuarios' && (
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" placeholder="Buscar por nombre, correo o celular..." 
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none font-medium text-slate-900 dark:text-white border border-transparent focus:border-amber-500 transition-colors"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4">Negocio</th>
                    <th className="p-4">Contacto</th>
                    <th className="p-4">Plan Actual</th>
                    <th className="p-4">Estado / Vence</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usuarios.filter(u => 
                    (u.nombreNegocio?.toLowerCase().includes(busqueda.toLowerCase()) || 
                    u.email?.toLowerCase().includes(busqueda.toLowerCase()) || 
                    u.telefonoNegocio?.includes(busqueda))
                  ).map(u => {
                    const estado = calcularEstadoPlan(u);
                    const isPro = u.plan === 'pro';
                    return (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <p className="font-black text-slate-900 dark:text-white text-base">{u.nombreNegocio || "Sin Nombre"}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.id}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-slate-700 dark:text-slate-300">{u.nombreUsuario}</p>
                          <p className="text-xs text-slate-500 font-medium">{u.email}</p>
                          <p className="text-xs text-slate-500 font-medium">{u.telefonoNegocio}</p>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isPro ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' : (u.plan==='comercio' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}`}>
                            {u.plan || 'gratis'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-lg text-[11px] font-black ${estado.color}`}>
                            {estado.label}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => setModalPlan({ visible: true, usuario: u })}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl transition-colors inline-flex items-center gap-1.5 font-bold text-xs"
                          >
                            <Edit2 size={14} /> Forzar Plan
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: BONOS */}
        {tabActiva === 'bonos' && (
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white"><Ticket className="text-blue-500"/> Códigos Activos</h2>
                <p className="text-sm text-slate-500">Crea códigos para que tus usuarios renueven ellos mismos.</p>
              </div>
              <button onClick={() => setModalBono(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-500/30">
                <Plus size={18} /> Crear Código
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bonos.map(b => (
                <div key={b.id} className={`p-6 rounded-3xl border-2 relative transition-colors ${b.activo ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-xl font-mono tracking-wider dark:text-white">{b.id}</h3>
                    <button onClick={() => alternarBono(b.id, b.activo)} className={`p-2 rounded-xl transition-colors ${b.activo ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      <Power size={16} />
                    </button>
                  </div>
                  <div className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <p className="flex justify-between"><span>Plan Otorgado:</span> <span className={`uppercase font-black ${b.planOtorgado==='pro'?'text-purple-600 dark:text-purple-400':'text-blue-600 dark:text-blue-400'}`}>{b.planOtorgado || 'pro'}</span></p>
                    <p className="flex justify-between"><span>Días Otorgados:</span> <span className="font-black text-slate-900 dark:text-white">{b.diasOtorgados || 30}</span></p>
                    {b.emailObjetivo && (
                      <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50">
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Asignado exclusivamente a:</p>
                        <p className="text-blue-600 dark:text-blue-400 font-bold truncate">{b.emailObjetivo}</p>
                      </div>
                    )}
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-1.5 text-[11px] font-bold">
                      {b.unSoloUso !== false ? (
                        <><ShieldAlert size={14} className="text-amber-500" /> <span className="text-amber-600 dark:text-amber-400">SE QUEMA TRAS USO</span></>
                      ) : (
                        <><CheckCircle2 size={14} className="text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400">MULTIUSO PERMANENTE</span></>
                      )}
                    </div>
                  </div>
                  <button onClick={() => eliminarBono(b.id)} className="absolute bottom-6 right-6 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {bonos.length === 0 && (
                <div className="col-span-full p-10 text-center text-slate-500 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                  No hay códigos promocionales creados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL FORZAR PLAN */}
        {modalPlan.visible && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black dark:text-white">Forzar Plan</h3>
                <button onClick={() => setModalPlan({visible: false, usuario: null})} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><X size={18}/></button>
              </div>
              
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Negocio / Correo</p>
                <p className="font-black text-slate-900 dark:text-white truncate">{modalPlan.usuario.nombreNegocio}</p>
                <p className="text-sm font-medium text-slate-500 truncate">{modalPlan.usuario.email}</p>
              </div>
              
              <label className="block text-xs font-black uppercase text-slate-500 mb-2">Plan a Otorgar</label>
              <select className="w-full p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={formPlan.plan} onChange={e => setFormPlan({...formPlan, plan: e.target.value as any})}>
                <option value="gratis">Gratis (Revocar acceso)</option>
                <option value="comercio">Comercio</option>
                <option value="pro">PRO Almacén</option>
              </select>

              <label className="block text-xs font-black uppercase text-slate-500 mb-2">Días de vigencia (Sumar a Hoy)</label>
              <input type="number" className="w-full p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500" value={formPlan.dias} onChange={e => setFormPlan({...formPlan, dias: Number(e.target.value)})} />

              <button onClick={guardarCambioPlan} className="w-full py-4 font-black bg-amber-500 hover:bg-amber-600 text-white rounded-2xl transition-all shadow-lg shadow-amber-500/30">
                Guardar y Activar
              </button>
            </div>
          </div>
        )}

        {/* MODAL CREAR BONO */}
        {modalBono && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black dark:text-white">Nuevo Código</h3>
                <button onClick={() => setModalBono(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><X size={18}/></button>
              </div>
              
              <input type="text" placeholder="CÓDIGO (Ej: PROMO_30)" className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4 font-mono font-black uppercase text-lg text-slate-900 dark:text-white text-center tracking-widest outline-none focus:ring-2 focus:ring-blue-500" value={formBono.codigo} onChange={e => setFormBono({...formBono, codigo: e.target.value.replace(/\s+/g, '')})} />
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Plan</label>
                  <select className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold uppercase text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={formBono.planOtorgado} onChange={e => setFormBono({...formBono, planOtorgado: e.target.value})}>
                    <option value="comercio">Comercio</option>
                    <option value="pro">PRO Almacén</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Tiempo</label>
                  <select className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={formBono.diasOtorgados} onChange={e => setFormBono({...formBono, diasOtorgados: Number(e.target.value)})}>
                    <option value={30}>1 Mes (30d)</option>
                    <option value={90}>3 Meses (90d)</option>
                    <option value={365}>1 Año (365d)</option>
                    <option value={15}>Prueba (15d)</option>
                    <option value={1}>1 Día</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Correo Restringido (Opcional)</label>
                <input type="email" placeholder="cliente@correo.com" className="w-full p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" value={formBono.emailObjetivo} onChange={e => setFormBono({...formBono, emailObjetivo: e.target.value})} />
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1 font-medium">Si lo dejas vacío, cualquier persona podrá usarlo.</p>
              </div>

              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-0.5">
                    <input type="checkbox" checked={formBono.unSoloUso} onChange={e => setFormBono({...formBono, unSoloUso: e.target.checked})} className="w-5 h-5 accent-blue-600 rounded" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Código de Un Solo Uso</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-tight">Al marcarse, el código se inactiva automáticamente después de que alguien lo canjee con éxito.</p>
                  </div>
                </label>
              </div>

              <button onClick={crearBono} className="w-full py-4 font-black bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/30">
                Crear Código
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
