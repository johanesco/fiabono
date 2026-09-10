"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, updateDoc, doc, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { customConfirm } from "@/utils/customConfirm";
import { Crown, Search, Edit2, ShieldAlert, CheckCircle2, Ticket, X, Calendar, Plus, Trash2, Power, Users, Phone, MessageCircle } from 'lucide-react';

export default function MasterPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  
  const [cargando, setCargando] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [bonos, setBonos] = useState<any[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  
  const [busqueda, setBusqueda] = useState("");
  const [tabActiva, setTabActiva] = useState<'usuarios' | 'bonos' | 'anuncios'>('usuarios');

  // Modal para crear anuncio
  const [modalAnuncio, setModalAnuncio] = useState(false);
  const [formAnuncio, setFormAnuncio] = useState({ 
    titulo: "", mensaje: "", tipo: "info", emailObjetivo: "", cerrable: true 
  });

  // Modal para forzar plan
  const [modalPlan, setModalPlan] = useState<{ visible: boolean; usuario: any }>({ visible: false, usuario: null });
  const [formPlan, setFormPlan] = useState<{ plan: 'gratis'|'comercio'|'pro'; dias: number }>({ plan: 'comercio', dias: 30 });

  // Modal para ver cajeros
  const [modalCajeros, setModalCajeros] = useState<{ visible: boolean; cajeros: any[]; cargando: boolean; nombreAdmin: string }>({ visible: false, cajeros: [], cargando: false, nombreAdmin: '' });

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
      
      // 3. Cargar Anuncios
      const snapAnuncios = await getDocs(collection(db, "anuncios"));
      const listaAnuncios = snapAnuncios.docs.map(d => ({ id: d.id, ...d.data() }));
      setAnuncios(listaAnuncios);

    } catch (e) {
      console.error(e);
      toast.error("Error al cargar datos maestros.");
    } finally {
      setCargando(false);
    }
  };

  const verCajeros = async (adminId: string, nombreAdmin: string) => {
    setModalCajeros({ visible: true, cajeros: [], cargando: true, nombreAdmin });
    try {
      const qCajeros = query(collection(db, "usuarios"), where("adminId", "==", adminId), where("rol", "==", "cajero"));
      const snap = await getDocs(qCajeros);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setModalCajeros({ visible: true, cajeros: lista, cargando: false, nombreAdmin });
    } catch (e) {
      toast.error("Error al cargar cajeros.");
      setModalCajeros(prev => ({ ...prev, cargando: false }));
    }
  };

  const guardarCambioPlan = async () => {
    if (!modalPlan.usuario) return;
    const nombreNeg = modalPlan.usuario.nombreNegocio || modalPlan.usuario.nombreUsuario || 'este negocio';
    const detalleAccion = formPlan.plan === 'gratis' 
      ? `¿Confirmas bajar a ${nombreNeg} al PLAN GRATIS? (Se desactivarán los cajeros registrados)`
      : `¿Confirmas asignar el plan ${formPlan.plan.toUpperCase()} por ${formPlan.dias} días a ${nombreNeg}?`;

    const confirmado = await customConfirm(detalleAccion);
    if (!confirmado) return;

    try {
      if (formPlan.plan === 'gratis') {
        await updateDoc(doc(db, "usuarios", modalPlan.usuario.id), {
          plan: 'gratis',
          planVence: null,
          cicloPlan: 'mensual'
        });
        // Desactivar cajeros si baja a gratis
        const qCajeros = query(
          collection(db, "usuarios"),
          where("adminId", "==", modalPlan.usuario.id),
          where("rol", "==", "cajero")
        );
        const snapC = await getDocs(qCajeros);
        const batchDesact = snapC.docs.map(d =>
          updateDoc(doc(db, "usuarios", d.id), { activo: false })
        );
        await Promise.all(batchDesact);
      } else {
        let baseDate = new Date();
        if (modalPlan.usuario?.planVence) {
          const timeVence = modalPlan.usuario.planVence.toDate 
            ? modalPlan.usuario.planVence.toDate().getTime() 
            : new Date(modalPlan.usuario.planVence).getTime();
          // Si aún tiene días activos futuros, sumamos a partir de esa fecha
          if (timeVence > baseDate.getTime()) {
            baseDate = new Date(timeVence);
          }
        }
        const nuevaFecha = new Date(baseDate);
        nuevaFecha.setDate(nuevaFecha.getDate() + Number(formPlan.dias || 30));

        await updateDoc(doc(db, "usuarios", modalPlan.usuario.id), {
          plan: formPlan.plan,
          planVence: nuevaFecha,
          cicloPlan: formPlan.dias >= 365 ? 'anual' : 'mensual'
        });
      }
      
      toast.success("Plan asignado exitosamente");
      setModalPlan({ visible: false, usuario: null });
      cargarDatos();
    } catch (e) {
      console.error(e);
      toast.error("Error al cambiar plan.");
    }
  };

  const crearBono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBono.codigo.trim()) return;
    
    const confirmado = await customConfirm(
      `¿Confirmas crear el código promocional "${formBono.codigo.trim().toUpperCase()}" con ${formBono.diasOtorgados} días de plan ${formBono.planOtorgado.toUpperCase()}?`
    );
    if (!confirmado) return;

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
    if (await customConfirm(`¿Seguro que deseas ELIMINAR permanentemente el código "${id}"?`)) {
      await deleteDoc(doc(db, "codigos_promocionales", id));
      cargarDatos();
    }
  };

  const alternarBono = async (id: string, estadoActual: boolean) => {
    const accion = estadoActual ? 'DESACTIVAR' : 'ACTIVAR';
    if (await customConfirm(`¿Confirmas ${accion} el código promocional "${id}"?`)) {
      await updateDoc(doc(db, "codigos_promocionales", id), { activo: !estadoActual });
      cargarDatos();
    }
  };

  const crearAnuncio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAnuncio.titulo.trim() || !formAnuncio.mensaje.trim()) return;

    const confirmado = await customConfirm(
      `¿Confirmas publicar el anuncio "${formAnuncio.titulo.trim()}" para ${formAnuncio.emailObjetivo ? formAnuncio.emailObjetivo : 'TODOS los usuarios'}?`
    );
    if (!confirmado) return;

    try {
      const nuevoRef = doc(collection(db, "anuncios"));
      await setDoc(nuevoRef, {
        titulo: formAnuncio.titulo.trim(),
        mensaje: formAnuncio.mensaje.trim(),
        tipo: formAnuncio.tipo,
        emailObjetivo: formAnuncio.emailObjetivo.trim().toLowerCase(),
        cerrable: formAnuncio.cerrable,
        activo: true,
        fechaCreacion: new Date()
      });
      toast.success("Anuncio creado exitosamente");
      setModalAnuncio(false);
      setFormAnuncio({ titulo: "", mensaje: "", tipo: "info", emailObjetivo: "", cerrable: true });
      cargarDatos();
    } catch (e) {
      toast.error("Error al crear anuncio.");
    }
  };

  const eliminarAnuncio = async (id: string) => {
    if (await customConfirm("¿Seguro que deseas eliminar este anuncio permanentemente?")) {
      await deleteDoc(doc(db, "anuncios", id));
      cargarDatos();
    }
  };

  const alternarAnuncio = async (id: string, estadoActual: boolean) => {
    const accion = estadoActual ? 'DESACTIVAR' : 'ACTIVAR';
    if (await customConfirm(`¿Confirmas ${accion} este anuncio?`)) {
      await updateDoc(doc(db, "anuncios", id), { activo: !estadoActual });
      cargarDatos();
    }
  };

  const getWhatsAppUrl = (u: any) => {
    const rawTel = u.telefonoNegocio || u.celular;
    if (!rawTel) return null;
    const digitos = rawTel.toString().replace(/\D/g, '');
    if (!digitos) return null;
    const telLimpio = digitos.startsWith('57') && digitos.length > 10 ? digitos : `57${digitos}`;
    const nombre = u.nombreNegocio || u.nombreUsuario || 'Comerciante';
    const texto = `Hola ${nombre}, te escribe Johan del equipo de Fiabono 👋 Esperamos que todo marche excelente con tu negocio. Te contacto para saludarte, saber cómo te ha parecido la plataforma y verificar si tienes alguna duda o necesitas apoyo con tu cuenta o funciones. ¡Quedamos muy atentos!`;
    return `https://wa.me/${telLimpio}?text=${encodeURIComponent(texto)}`;
  };

  const calcularEstadoPlan = (u: any) => {
    if (u.plan === 'gratis' || !u.planVence) return { label: 'Gratis', color: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' };
    const timeVence = u.planVence.toDate ? u.planVence.toDate().getTime() : new Date(u.planVence).getTime();
    const daysLeft = Math.ceil((timeVence - new Date().getTime()) / (1000 * 3600 * 24));
    
    if (daysLeft < -2) return { label: 'Vencido', color: 'bg-rose-100 text-rose-700' };
    if (daysLeft <= 0) return { label: 'En Gracia', color: 'bg-amber-100 text-amber-700' };
    return { label: `Activo (${daysLeft}d)`, color: 'bg-emerald-100 text-emerald-700' };
  };

  if (cargando || !datosSesion || datosSesion.correoNegocio !== 'johanescobar1@gmail.com') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#020617] p-4 sm:p-8">
      <div className="max-w-6xl mx-auto pb-20">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Crown className="text-amber-500" size={30} /> Panel Maestro
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Control total de Usuarios y Monetización.</p>
          </div>
          <div className="flex w-full sm:w-auto bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl gap-1">
            <button onClick={() => setTabActiva('usuarios')} className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all ${tabActiva === 'usuarios' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Usuarios ({usuarios.length})</button>
            <button onClick={() => setTabActiva('bonos')} className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all ${tabActiva === 'bonos' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Códigos ({bonos.length})</button>
            <button onClick={() => setTabActiva('anuncios')} className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-xs sm:text-sm font-black rounded-xl transition-all ${tabActiva === 'anuncios' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Anuncios</button>
          </div>
        </div>

        {/* TAB: USUARIOS */}
        {tabActiva === 'usuarios' && (
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" placeholder="Buscar por negocio, correo o teléfono..." 
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl outline-none font-medium text-slate-900 dark:text-white border border-transparent focus:border-amber-500 transition-colors text-sm"
                />
              </div>
            </div>
            
            {/* VISTA MÓVIL EN TARJETAS (PANTALLAS PEQUEÑAS) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {usuarios.filter(u => 
                (u.nombreNegocio?.toLowerCase().includes(busqueda.toLowerCase()) || 
                u.email?.toLowerCase().includes(busqueda.toLowerCase()) || 
                u.telefonoNegocio?.includes(busqueda))
              ).map(u => {
                const estado = calcularEstadoPlan(u);
                const isPro = u.plan === 'pro';

                return (
                  <div key={u.id} className="p-4 space-y-3">
                    {/* Cabecera de la tarjeta móvil */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-black text-slate-900 dark:text-white text-base leading-snug break-words">
                          {u.nombreNegocio || "Negocio sin nombre"}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          👤 {u.nombreUsuario || 'Sin usuario'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${isPro ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' : (u.plan==='comercio' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}`}>
                          {u.plan || 'gratis'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${estado.color}`}>
                          {estado.label}
                        </span>
                      </div>
                    </div>

                    {/* Datos de contacto */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 text-xs space-y-1">
                      <p className="text-slate-600 dark:text-slate-300 truncate">
                        ✉️ {u.email || 'Sin correo'}
                      </p>
                      {(u.telefonoNegocio || u.celular) && (
                        <p className="text-slate-600 dark:text-slate-300">
                          📱 {u.telefonoNegocio || u.celular}
                        </p>
                      )}
                    </div>

                    {/* Botones de acción táctiles para móvil */}
                    <div className="flex items-center gap-2 pt-1">
                      {getWhatsAppUrl(u) && (
                        <a
                          href={getWhatsAppUrl(u)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border border-[#25D366]/30 transition active:scale-98 shrink-0"
                          title="Escribir por WhatsApp"
                        >
                          <MessageCircle size={15} className="text-[#25D366] fill-[#25D366]/30" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      <button 
                        onClick={() => verCajeros(u.id, u.nombreNegocio || u.nombreUsuario)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
                      >
                        <Users size={14} />
                        <span>Cajeros</span>
                      </button>
                      <button 
                        onClick={() => setModalPlan({ visible: true, usuario: u })}
                        className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-98 cursor-pointer"
                      >
                        <Edit2 size={14} />
                        <span>Gestionar Plan</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {usuarios.filter(u => 
                (u.nombreNegocio?.toLowerCase().includes(busqueda.toLowerCase()) || 
                u.email?.toLowerCase().includes(busqueda.toLowerCase()) || 
                u.telefonoNegocio?.includes(busqueda))
              ).length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No se encontraron negocios registrados.
                </div>
              )}
            </div>

            {/* VISTA ESCRITORIO (TABLA CLÁSICA) */}
            <div className="hidden md:block overflow-x-auto">
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
                          <p className="text-xs text-slate-500 font-medium">{u.telefonoNegocio || u.celular}</p>
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
                          <div className="flex justify-end gap-2">
                            {getWhatsAppUrl(u) && (
                              <a
                                href={getWhatsAppUrl(u)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] rounded-xl transition-colors font-bold text-xs inline-flex items-center gap-1.5 border border-[#25D366]/30 cursor-pointer"
                                title="Escribir por WhatsApp"
                              >
                                <MessageCircle size={14} className="text-[#25D366] fill-[#25D366]/30" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                            <button 
                              onClick={() => verCajeros(u.id, u.nombreNegocio || u.nombreUsuario)}
                              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl transition-colors font-bold text-xs cursor-pointer"
                            >
                              Cajeros
                            </button>
                            <button 
                              onClick={() => setModalPlan({ visible: true, usuario: u })}
                              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-xl transition-colors inline-flex items-center gap-1.5 font-bold text-xs cursor-pointer"
                            >
                              <Edit2 size={14} /> Plan
                            </button>
                          </div>
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

        {/* TAB: ANUNCIOS */}
        {tabActiva === 'anuncios' && (
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black flex items-center gap-2 dark:text-white">📢 Anuncios Globales</h2>
                <p className="text-sm text-slate-500">Muestra mensajes importantes a todos o a negocios específicos.</p>
              </div>
              <button onClick={() => setModalAnuncio(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-indigo-500/30">
                <Plus size={18} /> Crear Anuncio
              </button>
            </div>

            <div className="space-y-4">
              {anuncios.map(a => (
                <div key={a.id} className={`p-5 rounded-2xl border-2 relative transition-colors flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${a.activo ? 'border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${a.tipo === 'warning' ? 'bg-amber-100 text-amber-700' : a.tipo === 'error' ? 'bg-rose-100 text-rose-700' : a.tipo === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {a.tipo}
                      </span>
                      {a.emailObjetivo ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-200">Personal: {a.emailObjetivo}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-200 text-slate-700">Global</span>
                      )}
                      {a.cerrable ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200">Cerrable</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-100 text-rose-600 border border-rose-200">Persistente</span>
                      )}
                    </div>
                    <h3 className="font-black text-lg dark:text-white">{a.titulo}</h3>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">{a.mensaje}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => alternarAnuncio(a.id, a.activo)} className={`p-2 rounded-xl transition-colors ${a.activo ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                      <Power size={18} />
                    </button>
                    <button onClick={() => eliminarAnuncio(a.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {anuncios.length === 0 && (
                <div className="p-10 text-center text-slate-500 font-bold border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl">
                  No hay anuncios creados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL VER CAJEROS */}
        {modalCajeros.visible && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black dark:text-white">Colaboradores</h3>
                  <p className="text-xs text-slate-500 font-medium">De: {modalCajeros.nombreAdmin}</p>
                </div>
                <button onClick={() => setModalCajeros({visible: false, cajeros: [], cargando: false, nombreAdmin: ''})} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><X size={18}/></button>
              </div>

              {modalCajeros.cargando ? (
                <div className="p-10 text-center text-slate-500 font-bold">Cargando...</div>
              ) : modalCajeros.cajeros.length === 0 ? (
                <div className="p-10 text-center text-slate-500 font-bold border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  No tiene colaboradores registrados.
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {modalCajeros.cajeros.map(c => (
                    <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{c.nombreUsuario}</p>
                        <p className="text-xs text-slate-500">{c.email}</p>
                        {c.permisos?.abonar && <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] font-black uppercase rounded-full">Puede Abonar</span>}
                      </div>
                      <div className="text-right">
                        {c.activo === false ? (
                          <span className="px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 text-[10px] font-black uppercase rounded-lg">Inactivo</span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg">Activo</span>
                        )}
                      </div>
                    </div>
                  ))}
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

        {/* MODAL CREAR ANUNCIO */}
        {modalAnuncio && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black dark:text-white">Nuevo Anuncio</h3>
                <button onClick={() => setModalAnuncio(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><X size={18}/></button>
              </div>
              
              <input type="text" placeholder="Título (Ej: ¡Nueva Función!)" className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3 font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formAnuncio.titulo} onChange={e => setFormAnuncio({...formAnuncio, titulo: e.target.value})} />
              <textarea placeholder="Mensaje descriptivo..." className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3 font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]" value={formAnuncio.mensaje} onChange={e => setFormAnuncio({...formAnuncio, mensaje: e.target.value})} />
              
              <select className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-3 font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formAnuncio.tipo} onChange={e => setFormAnuncio({...formAnuncio, tipo: e.target.value})}>
                <option value="info">ℹ️ Informativo (Azul)</option>
                <option value="success">✅ Éxito / Novedad (Verde)</option>
                <option value="warning">⚠️ Advertencia (Amarillo)</option>
                <option value="error">🚨 Crítico (Rojo)</option>
              </select>

              <div className="mb-4">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5 ml-1">Correo Específico (Opcional)</label>
                <input type="email" placeholder="Para un solo usuario..." className="w-full p-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formAnuncio.emailObjetivo} onChange={e => setFormAnuncio({...formAnuncio, emailObjetivo: e.target.value})} />
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1 font-medium">Si lo dejas vacío, será Global para todos.</p>
              </div>

              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-0.5">
                    <input type="checkbox" checked={formAnuncio.cerrable} onChange={e => setFormAnuncio({...formAnuncio, cerrable: e.target.checked})} className="w-5 h-5 accent-indigo-600 rounded" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Se puede cerrar (Descartable)</p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 leading-tight">Si se desmarca, el anuncio se mostrará de forma persistente e inamovible.</p>
                  </div>
                </label>
              </div>

              <button onClick={crearAnuncio} className="w-full py-4 font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-lg shadow-indigo-500/30">
                Publicar Anuncio
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
