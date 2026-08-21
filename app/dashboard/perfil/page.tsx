"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, query, doc, updateDoc, where, setDoc, deleteDoc } from "firebase/firestore";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import { db, auth } from "../../../firebase";
import { UserCog, LogOut, Sun, Monitor, Moon, Edit2, Mail, ShieldAlert, CheckCircle2, AlertCircle, Star, Lock, UserPlus, ChevronUp, ChevronDown, Trash2, Info, X, Clock } from 'lucide-react';
import ModalHorarios from '@/components/ModalHorarios';
import { useAuth } from "../../../hooks/AuthContext";
import ModalSuscripcion from "@/components/ModalSuscripcion";

export default function PerfilPage() {
  const { datosSesion, setDatosSesion } = useAuth();
  
  const usuarioAuth = auth.currentUser;
  const planActual = datosSesion?.planActual || 'basico';
  const diasPro = datosSesion?.diasPro;
  const esCajero = datosSesion?.rol === 'cajero';
  const adminId = datosSesion?.cuentaPrincipalId;

  const [nombreUsuario, setNombreUsuario] = useState(datosSesion?.nombreUsuario || "");
  const [nombreNegocio, setNombreNegocio] = useState(datosSesion?.nombreNegocio || "");
  const [telefonoNegocio, setTelefonoNegocio] = useState(datosSesion?.telefonoNegocio || "");
  const correoNegocio = datosSesion?.correoNegocio || "";
  
  const [modoEdicionPerfil, setModoEdicionPerfil] = useState(false);
  const [editNombreUsuario, setEditNombreUsuario] = useState(nombreUsuario);
  
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [passwordData, setPasswordData] = useState({ actual: "", nueva: "", confirmar: "" });
  const [passErrores, setPassErrores] = useState({ actual: "", nueva: "", confirmar: "", general: "" });
  const [mensajePerfil, setMensajePerfil] = useState({ texto: "", tipo: "" });

  const [temaApariencia, setTemaApariencia] = useState<'clara' | 'oscura' | 'auto'>('clara');
  const [temaCargado, setTemaCargado] = useState(false);

  const [mostrarColaboradores, setMostrarColaboradores] = useState(false);
  const [modoCrearColaborador, setModoCrearColaborador] = useState(false);
  const [colaboradorEnEdicion, setColaboradorEnEdicion] = useState<any | null>(null);
  const [colaboradoresRegistrados, setColaboradoresRegistrados] = useState<any[]>([]);
  const [formColaborador, setFormColaborador] = useState({ 
    nombre: "", usuarioAcceso: "", password: "", confirmPassword: "",
    permisos: { verCelulares: false, verDirectorio: false, verReportes: false }
  });
  const [errorFormColaborador, setErrorFormColaborador] = useState({ usuarioAcceso: "", general: "" });
  const [creandoColaborador, setCreandoColaborador] = useState(false);

  const [modalSeguridad, setModalSeguridad] = useState<{ visible: boolean, accion: 'eliminar_colaborador' | null }>({ visible: false, accion: null });
  const [passSeguridad, setPassSeguridad] = useState("");
  const [errorSeguridad, setErrorSeguridad] = useState("");
  const [cargandoSeguridad, setCargandoSeguridad] = useState(false);
  const [colaboradorAEliminar, setColaboradorAEliminar] = useState<any | null>(null);

  const [modalAvisoColaborador, setModalAvisoColaborador] = useState<{ visible: boolean, titulo: string, mensaje: string, icono: 'exito'|'error'|'info' }>({ visible: false, titulo: "", mensaje: "", icono: 'exito' });
  const [modalCancelarPro, setModalCancelarPro] = useState(false);
  const [passCancelarPro, setPassCancelarPro] = useState("");
  const [errorCancelarPro, setErrorCancelarPro] = useState("");
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [modalHorariosOpen, setModalHorariosOpen] = useState(false);
  const [colabParaHorarios, setColabParaHorarios] = useState<any | null>(null);
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState(false);

  useEffect(() => {
    const temaGuardado = localStorage.getItem('temaFiabono') as any;
    if (temaGuardado) setTemaApariencia(temaGuardado);
    setTemaCargado(true); 
    
    if (adminId && !esCajero) {
      cargarListaColaboradores(adminId);
    }
  }, [adminId, esCajero]);

  useEffect(() => {
    if (!temaCargado) return; 
    localStorage.setItem('temaFiabono', temaApariencia);
    const aplicarTema = () => {
      if (temaApariencia === 'oscura') document.documentElement.classList.add('dark');
      else if (temaApariencia === 'clara') document.documentElement.classList.remove('dark');
      else {
        const hora = new Date().getHours();
        if (hora >= 6 && hora < 18) document.documentElement.classList.remove('dark');
        else document.documentElement.classList.add('dark');
      }
    };
    aplicarTema();
  }, [temaApariencia, temaCargado]);

  const cargarListaColaboradores = async (uid: string) => {
    try {
      const qC = query(collection(db, "usuarios"), where("adminId", "==", uid), where("rol", "==", "cajero"));
      const snap = await getDocs(qC);
      const lista: any[] = [];
      snap.forEach(doc => lista.push({id: doc.id, ...doc.data()}));
      setColaboradoresRegistrados(lista);
    } catch(e) {}
  };

  const abrirUpsell = (titulo: string, mensaje: string) => {
    setModalSuscripcion({ visible: true, titulo, mensaje });
  };

  const guardarDatosPerfil = async () => {
    if (!usuarioAuth) return;
    try {
      await updateDoc(doc(db, "usuarios", usuarioAuth.uid), { 
        nombreNegocio, 
        telefonoNegocio, 
        nombreUsuario: editNombreUsuario 
      });
      setNombreUsuario(editNombreUsuario);
      setDatosSesion((prev: any) => ({...prev, nombreNegocio, telefonoNegocio, nombreUsuario: editNombreUsuario}));
      setMensajePerfil({ texto: "Datos actualizados correctamente.", tipo: "exito" });
      setModoEdicionPerfil(false);
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 3000);
    } catch (error) { 
      setMensajePerfil({ texto: "Error al guardar los datos.", tipo: "error" }); 
    }
  };

  const procesarCambioPassword = async () => {
    setPassErrores({ actual: "", nueva: "", confirmar: "", general: "" });
    setMensajePerfil({ texto: "", tipo: "" });

    let hayError = false;
    let nuevosErrores = { actual: "", nueva: "", confirmar: "", general: "" };

    if (!passwordData.actual) { nuevosErrores.actual = "Ingresa tu contraseña actual"; hayError = true; }
    if (!passwordData.nueva) { nuevosErrores.nueva = "Ingresa una nueva contraseña"; hayError = true; }
    else if (passwordData.nueva.length < 6) { nuevosErrores.nueva = "Mínimo 6 caracteres"; hayError = true; }
    if (passwordData.nueva !== passwordData.confirmar) { nuevosErrores.confirmar = "Las contraseñas no coinciden"; hayError = true; }

    if (hayError) { setPassErrores(nuevosErrores); return; }
    
    try {
      const cred = EmailAuthProvider.credential(usuarioAuth!.email!, passwordData.actual);
      await reauthenticateWithCredential(usuarioAuth!, cred);
      await updatePassword(usuarioAuth!, passwordData.nueva);
      
      setMensajePerfil({ texto: "¡Contraseña actualizada con éxito!", tipo: "exito" });
      setCambiandoPass(false);
      setPasswordData({ actual: "", nueva: "", confirmar: "" });
      setTimeout(() => setMensajePerfil({ texto: "", tipo: "" }), 4000);
    } catch (error: any) { 
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        setPassErrores(prev => ({ ...prev, actual: "Contraseña incorrecta." }));
      } else {
        setPassErrores(prev => ({ ...prev, general: "Ocurrió un error inesperado." }));
      }
    }
  };

  const toggleEstadoColaborador = async (colaborador: any) => {
    const estaActivo = colaborador.activo === true || colaborador.activo === undefined;
    const nuevoEstado = !estaActivo;
    
    if (nuevoEstado === true && planActual === 'basico') {
        const activos = colaboradoresRegistrados.filter(c => c.activo === true || c.activo === undefined).length;
        if (activos >= 1) {
            abrirUpsell("Límite de Colaboradores", "En el plan básico solo puedes tener 1 colaborador ACTIVO a la vez. Apaga al actual para encender a otro, o pásate a PRO.");
            return;
        }
    }
    
    setColaboradoresRegistrados(prev => prev.map(c => c.id === colaborador.id ? { ...c, activo: nuevoEstado } : c));
    try { await updateDoc(doc(db, "usuarios", colaborador.id), { activo: nuevoEstado }); } 
    catch (error) { cargarListaColaboradores(adminId); }
  };

  const guardarColaborador = async () => {
    setErrorFormColaborador({ usuarioAcceso: "", general: "" });
    if(!formColaborador.nombre.trim()) return setErrorFormColaborador(p => ({...p, general: "El nombre es obligatorio."}));
    
    if (!colaboradorEnEdicion) {
      if(!formColaborador.usuarioAcceso.trim() || !formColaborador.password.trim() || !formColaborador.confirmPassword.trim()) {
        return setErrorFormColaborador(p => ({...p, general: "Llena todos los campos."}));
      }
      if(formColaborador.password.length < 6) return setErrorFormColaborador(p => ({...p, general: "La contraseña debe tener mínimo 6 caracteres."}));
      if(formColaborador.password !== formColaborador.confirmPassword) return setErrorFormColaborador(p => ({...p, general: "Las contraseñas no coinciden."}));
      
      if (planActual === 'basico' && colaboradoresRegistrados.length >= 1) {
        setModoCrearColaborador(false);
        abrirUpsell("Colaboradores Ilimitados", "El plan básico te permite tener 1 colaborador de prueba. Pásate a PRO para añadir colaboradores ilimitados y controlar todos sus permisos.");
        return;
      }
      if(planActual === 'pro' && colaboradoresRegistrados.length >= 4) {
        return setModalAvisoColaborador({ visible: true, titulo: "Límite Alcanzado", mensaje: "Tu plan PRO permite un máximo de 4 colaboradores simultáneos para tu negocio.", icono: 'error' });
      }
    }

    setCreandoColaborador(true);
    try {
      if (colaboradorEnEdicion) {
        await updateDoc(doc(db, "usuarios", colaboradorEnEdicion.id), {
          nombreUsuario: formColaborador.nombre.trim(),
          permisos: formColaborador.permisos
        });
        setModalAvisoColaborador({ visible: true, titulo: "Colaborador Actualizado", mensaje: `Los datos de ${formColaborador.nombre} se han actualizado correctamente.`, icono: 'exito' });
      } else {
        const correoGenerado = `${formColaborador.usuarioAcceso.replace(/\s/g, '').toLowerCase()}@fiabono.caja`;
        const secondaryApp = getApps().find(app => app.name === "SecondaryAuthApp") || initializeApp(auth.app.options, "SecondaryAuthApp");
        const secondaryAuthObj = getAuth(secondaryApp);
        
        const cred = await createUserWithEmailAndPassword(secondaryAuthObj, correoGenerado, formColaborador.password);
        
        await setDoc(doc(db, "usuarios", cred.user.uid), { 
          nombreUsuario: formColaborador.nombre.trim(), email: correoGenerado, rol: "cajero",
          adminId: adminId, permisos: formColaborador.permisos, activo: true
        });
        await secondaryAuthObj.signOut();
        setModalAvisoColaborador({ visible: true, titulo: "¡Acceso Creado!", mensaje: `El colaborador fue creado exitosamente.\n\nUsuario para entrar: \n${correoGenerado}`, icono: 'exito' });
      }
      setFormColaborador({ nombre:"", usuarioAcceso:"", password:"", confirmPassword: "", permisos: { verCelulares: false, verDirectorio: false, verReportes: false } });
      setModoCrearColaborador(false); setColaboradorEnEdicion(null);
      cargarListaColaboradores(adminId);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') setErrorFormColaborador(p => ({...p, usuarioAcceso: "Este usuario ya existe. Intenta agregarle un número (Ej: colab2)."}));
      else setErrorFormColaborador(p => ({...p, general: "Ocurrió un error al guardar. Intenta de nuevo."}));
    }
    setCreandoColaborador(false);
  };

  const verificarSeguridadYEjecutar = async () => {
    if (!passSeguridad) return setErrorSeguridad("Ingresa tu contraseña de Administrador para confirmar.");
    setCargandoSeguridad(true); setErrorSeguridad("");
    try {
      const cred = EmailAuthProvider.credential(usuarioAuth!.email!, passSeguridad);
      await reauthenticateWithCredential(usuarioAuth!, cred);
      setCargandoSeguridad(false); setPassSeguridad("");
      if (modalSeguridad.accion === 'eliminar_colaborador') {
        setModalSeguridad({ visible: false, accion: null });
        await deleteDoc(doc(db, "usuarios", colaboradorAEliminar.id));
        setColaboradorAEliminar(null); cargarListaColaboradores(adminId);
        setModalAvisoColaborador({ visible: true, titulo: "Colaborador Eliminado", mensaje: "El acceso de este colaborador ha sido revocado y su cuenta borrada permanentemente del sistema.", icono: 'info' });
      }
    } catch (error: any) { setCargandoSeguridad(false); setErrorSeguridad("Contraseña incorrecta. Intenta de nuevo."); }
  };

  const cancelarSuscripcion = async () => {
    if(!passCancelarPro) return setErrorCancelarPro("Ingresa tu contraseña para confirmar.");
    try {
      const cred = EmailAuthProvider.credential(usuarioAuth!.email!, passCancelarPro);
      await reauthenticateWithCredential(usuarioAuth!, cred);
      
      await updateDoc(doc(db, "usuarios", usuarioAuth!.uid), { plan: 'basico', planVence: null });
      const qC = query(collection(db, "usuarios"), where("adminId", "==", usuarioAuth!.uid), where("rol", "==", "cajero"));
      const snap = await getDocs(qC);
      const batchPromesas: any[] = [];
      snap.forEach((documento) => { batchPromesas.push(updateDoc(doc(db, "usuarios", documento.id), { activo: false })); });
      await Promise.all(batchPromesas);

      setDatosSesion((prev:any) => ({...prev, planActual: 'basico', diasPro: null}));
      setModalCancelarPro(false); setPassCancelarPro(""); setErrorCancelarPro("");
      cargarListaColaboradores(usuarioAuth!.uid);
      setModalAvisoColaborador({ visible: true, titulo: "Suscripción Cancelada", mensaje: "Has vuelto al Plan Básico.\n\nTus colaboradores han sido apagados temporalmente, pero puedes encender a UNO para que siga activo.", icono: 'info' });
    } catch (error) { setErrorCancelarPro("Contraseña incorrecta. Intenta de nuevo."); }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {esCajero ? (
        <div className="bg-white dark:bg-[#0f172a] p-10 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
           <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto flex items-center justify-center text-slate-600 dark:text-slate-300 text-4xl font-black mb-6 shadow-inner shrink-0">
            <UserCog size={40}/>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 truncate">{nombreUsuario}</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg mb-6 truncate">Colaborador en {nombreNegocio}</p>
          
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 mt-6 text-left">
            <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4 flex items-center gap-2">Apariencia</h3>
            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
              <button onClick={() => setTemaApariencia('clara')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'clara' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Sun size={20} className="shrink-0"/> Clara</button>
              <button onClick={() => setTemaApariencia('auto')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'auto' ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Monitor size={20} className="shrink-0"/> Auto</button>
              <button onClick={() => setTemaApariencia('oscura')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'oscura' ? 'bg-slate-700 dark:bg-[#1e293b] text-white dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'}`}><Moon size={20} className="shrink-0"/> Oscura</button>
            </div>
          </div>

          <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-6 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-4 flex justify-center items-center gap-2 text-lg mt-8">
            <LogOut size={24} className="shrink-0" /> Cerrar Sesión
          </button>
        </div>
      ) : (
        <>
          {/* PERFIL ADMINISTRADOR */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full mx-auto flex items-center justify-center text-white text-4xl font-black mb-4 shadow-lg shrink-0">
              {nombreNegocio.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white truncate">{nombreNegocio}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-4 truncate">{correoNegocio}</p>
            
            {planActual === 'pro' ? (
              <div className="flex flex-col items-center justify-center gap-3 mt-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-widest border border-emerald-100 dark:border-emerald-500/20">
                  <Star size={14} className="fill-current shrink-0"/> <span className="truncate">Plan Pro Activo {diasPro !== null && `(${diasPro} días)`}</span>
                </div>
                <button onClick={() => setModalCancelarPro(true)} className="text-xs font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 transition-colors underline decoration-rose-300 underline-offset-4">
                  Cancelar suscripción Pro
                </button>
              </div>
            ) : (
              <button onClick={() => setModalSuscripcionOpen(true)} className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-widest shadow-md hover:scale-105 transition-transform mt-4">
                <Lock size={14} className="shrink-0"/> Subir a Pro
              </button>
            )}
          </div>

          <ModalSuscripcion isOpen={modalSuscripcionOpen} onClose={() => setModalSuscripcionOpen(false)} cuentaPrincipalId={usuarioAuth ? usuarioAuth.uid : (adminId || "")} />

          {/* COLABORADORES */}
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserPlus size={20} className="text-blue-500 shrink-0"/> Colaboradores</h3>
              {colaboradoresRegistrados.length > 0 && (
                <button onClick={() => setMostrarColaboradores(!mostrarColaboradores)} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg shrink-0">
                  {mostrarColaboradores ? 'Ocultar' : 'Ver todos'} {mostrarColaboradores ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
              )}
            </div>
            
            {!modoCrearColaborador ? (
              <div className="flex flex-col gap-4">
                {colaboradoresRegistrados.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4 bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-100 dark:border-slate-800/60">No tienes colaboradores registrados.</p>
                ) : (
                  mostrarColaboradores && colaboradoresRegistrados.map((c: any, i: number) => (
                    <div key={i} className="flex flex-col p-5 bg-slate-50 dark:bg-[#020617] rounded-xl border border-slate-100 dark:border-slate-800/60 gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{c.nombreUsuario}</p>
                          <p className="text-sm text-slate-500 truncate">{c.email}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => { 
                            setColaboradorEnEdicion(c); 
                            setFormColaborador({nombre: c.nombreUsuario, usuarioAcceso: c.email.split('@')[0], password: '', confirmPassword: '', permisos: c.permisos || {verCelulares: false, verDirectorio: false, verReportes: false}}); 
                            setModoCrearColaborador(true); 
                          }} className="bg-white dark:bg-[#0f172a] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
                            <Edit2 size={20} className="text-slate-500 shrink-0" />
                          </button>
                          <button onClick={() => { setColabParaHorarios(c); setModalHorariosOpen(true); }} title="Horarios" className="bg-white dark:bg-[#0f172a] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm">
                            <Clock size={18} className="text-slate-600" />
                          </button>
                          <button onClick={() => { setColaboradorAEliminar(c); setModalSeguridad({visible: true, accion: 'eliminar_colaborador'}); }} className="bg-white dark:bg-[#0f172a] p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors shadow-sm">
                            <Trash2 size={20} className="text-rose-500 shrink-0" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                         <label className="flex items-center gap-2 cursor-pointer relative">
                           <input type="checkbox" className="sr-only peer" checked={c.activo !== false} onChange={() => toggleEstadoColaborador(c)}/>
                           <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                           <span className="text-xs font-bold text-slate-500">{c.activo !== false ? 'Activo' : 'Apagado'}</span>
                         </label>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-1 border-t border-slate-200 dark:border-slate-800 pt-3">
                        {c.permisos?.verCelulares ? <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold px-2 py-1 rounded-md">Celulares</span> : null}
                        {c.permisos?.verDirectorio ? <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 font-bold px-2 py-1 rounded-md">Directorio</span> : null}
                        {c.permisos?.verReportes ? <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 font-bold px-2 py-1 rounded-md">Reportes</span> : null}
                        {!c.permisos?.verCelulares && !c.permisos?.verDirectorio && !c.permisos?.verReportes ? <span className="text-[10px] bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold px-2 py-1 rounded-md">Modo Ciego Total</span> : null}
                      </div>
                    </div>
                  ))
                )}

                <button onClick={() => {
                  if (planActual === 'basico' && colaboradoresRegistrados.length >= 1) {
                    abrirUpsell("Colaboradores Ilimitados", "El plan básico te permite tener 1 colaborador de prueba. Pásate a PRO para añadir colaboradores ilimitados y controlar todos sus permisos.");
                  } else {
                    setColaboradorEnEdicion(null);
                    setFormColaborador({ nombre:"", usuarioAcceso:"", password:"", confirmPassword: "", permisos: { verCelulares: false, verDirectorio: false, verReportes: false } });
                    setErrorFormColaborador({ usuarioAcceso: "", general: "" });
                    setModoCrearColaborador(true);
                    setMostrarColaboradores(true);
                  }
                }} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-blue-600 dark:text-blue-400 font-bold py-4 rounded-xl transition-colors border dark:border-slate-800/80 mt-2 flex items-center justify-center gap-2 text-lg">
                  <UserPlus size={20} className="shrink-0" /> Añadir Colaborador {planActual === 'basico' && colaboradoresRegistrados.length >= 1 && <Lock size={16} className="opacity-50 shrink-0"/>}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-in fade-in">
                {!colaboradorEnEdicion && (
                  <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-relaxed flex gap-2">
                      <Info size={20} className="shrink-0"/>
                      <span>Para crear un colaborador solo ingresa un usuario (Ej: <strong>caja1</strong>). El sistema le agregará el dominio de forma automática.</span>
                    </p>
                  </div>
                )}
                <input type="text" value={formColaborador.nombre} onChange={e => {setFormColaborador({...formColaborador, nombre: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Nombre de la persona (Ej: Carlos)" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                
                {!colaboradorEnEdicion ? (
                  <>
                    <div>
                      <input type="text" value={formColaborador.usuarioAcceso} onChange={e => {setFormColaborador({...formColaborador, usuarioAcceso: e.target.value}); setErrorFormColaborador({...errorFormColaborador, usuarioAcceso:""})}} placeholder="Usuario de acceso (Ej: caja1)" className={`w-full p-4 bg-slate-50 dark:bg-[#020617] border rounded-xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${errorFormColaborador.usuarioAcceso ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500'}`} />
                      <p className="text-xs text-slate-400 mt-1.5 ml-2">Quedará como: @fiabono.caja</p>
                      {errorFormColaborador.usuarioAcceso && <p className="text-rose-500 text-xs font-bold mt-1.5 ml-2">{errorFormColaborador.usuarioAcceso}</p>}
                    </div>
                    <input type="password" value={formColaborador.password} onChange={e => {setFormColaborador({...formColaborador, password: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Contraseña (Mínimo 6)" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                    <input type="password" value={formColaborador.confirmPassword} onChange={e => {setFormColaborador({...formColaborador, confirmPassword: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Confirmar Contraseña" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                  </>
                ) : (
                  <div className="bg-slate-100 dark:bg-[#020617] p-5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Usuario de acceso:</p>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-200 mb-4 break-all">{formColaborador.usuarioAcceso}@fiabono.caja</p>
                    
                    <button onClick={() => setModalAvisoColaborador({ visible: true, titulo: "Cambio de Contraseña", mensaje: "Por restricciones de seguridad sin un servidor centralizado, no es posible cambiar la contraseña de otro usuario directamente.\n\nPara asignar una nueva clave, por favor cancela esta edición, elimina este colaborador y vuelve a crearlo con la contraseña nueva.", icono: 'info' })} className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-500/20 w-full mb-2">
                      ¿Olvidó su contraseña?
                    </button>
                    <p className="text-[10px] text-slate-400 text-center leading-tight">Por seguridad, el usuario y contraseña no pueden modificarse aquí.</p>
                  </div>
                )}
                
                {errorFormColaborador.general && (
                  <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-base font-bold text-center border border-rose-200 dark:border-rose-500/20">
                    {errorFormColaborador.general}
                  </div>
                )}
                
                {/* Permisos */}
                <div className="flex flex-col gap-4 mt-2 mb-2 bg-slate-50 dark:bg-[#020617] p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                   <p className="text-base font-black text-slate-800 dark:text-slate-200 mb-1">Permisos Especiales:</p>
                   <label className="flex items-center gap-3 text-base font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                     <input type="checkbox" className="w-6 h-6 accent-blue-600 shrink-0" checked={formColaborador.permisos.verCelulares} onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verCelulares: e.target.checked}})}/> 
                     <span className="truncate">Ver números de celular</span>
                   </label>
                   <label className="flex items-center gap-3 text-base font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                     <input type="checkbox" className="w-6 h-6 accent-blue-600 shrink-0" checked={formColaborador.permisos.verDirectorio} onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verDirectorio: e.target.checked}})}/> 
                     <span className="truncate">Abrir Directorio completo</span>
                   </label>
                   <label className="flex items-center gap-3 text-base font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                     <input type="checkbox" className="w-6 h-6 accent-blue-600 shrink-0" checked={formColaborador.permisos.verReportes} onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verReportes: e.target.checked}})}/> 
                     <span className="truncate">Ver Estadísticas de dinero</span>
                   </label>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button onClick={() => { setModoCrearColaborador(false); setColaboradorEnEdicion(null); setErrorFormColaborador({usuarioAcceso:"", general:""}); }} className="bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl text-lg">Cancelar</button>
                  <button onClick={guardarColaborador} disabled={creandoColaborador} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95 text-lg truncate">{creandoColaborador ? '...' : (colaboradorEnEdicion ? 'Actualizar' : 'Guardar')}</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
            <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4 flex items-center gap-2">Apariencia</h3>
            <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
              <button onClick={() => setTemaApariencia('clara')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'clara' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Sun size={20} className="shrink-0"/> Clara</button>
              <button onClick={() => setTemaApariencia('auto')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'auto' ? 'bg-white dark:bg-[#1e293b] text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Monitor size={20} className="shrink-0"/> Auto</button>
              <button onClick={() => setTemaApariencia('oscura')} className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all ${temaApariencia === 'oscura' ? 'bg-slate-700 dark:bg-[#1e293b] text-white dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-300'}`}><Moon size={20} className="shrink-0"/> Oscura</button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserCog size={20} className="shrink-0"/> Perfil del Negocio</h3>
              {!modoEdicionPerfil && (
                <button onClick={() => { setEditNombreUsuario(nombreUsuario); setModoEdicionPerfil(true); }} className="text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg shrink-0"><Edit2 size={14}/> Modificar</button>
              )}

              <ModalHorarios isOpen={modalHorariosOpen} onClose={() => { setModalHorariosOpen(false); setColabParaHorarios(null); cargarListaColaboradores(adminId); }} usuarioId={colabParaHorarios ? colabParaHorarios.id : ""} horariosIniciales={colabParaHorarios ? (colabParaHorarios.horariosActividad || []) : []} />
            </div>
            
            {modoEdicionPerfil ? (
              <div className="flex flex-col gap-4 animate-in fade-in">
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Tu Nombre</label>
                  <input type="text" value={editNombreUsuario} onChange={(e) => setEditNombreUsuario(e.target.value)} placeholder="Ej. Juan Pérez" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nombre del Negocio</label>
                  <input type="text" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">WhatsApp de Contacto</label>
                  <input type="tel" value={telefonoNegocio} onChange={(e) => setTelefonoNegocio(e.target.value)} placeholder="Ej. 3001234567" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2"><Mail size={14}/> Correo Registrado (Solo lectura)</label>
                  <input type="email" value={correoNegocio} disabled className="w-full p-5 bg-slate-100 dark:bg-[#020617]/50 border border-slate-200 dark:border-slate-800/50 rounded-2xl text-slate-500 dark:text-slate-400 cursor-not-allowed font-medium text-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button onClick={() => setModoEdicionPerfil(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-5 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
                  <button onClick={guardarDatosPerfil} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-lg transition-transform transform active:scale-95 text-lg">Guardar</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tu Nombre</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate">{nombreUsuario}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Negocio</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate">{nombreNegocio}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">WhatsApp</p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xl truncate">{telefonoNegocio || "No registrado"}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><ShieldAlert size={20} className="shrink-0"/> Seguridad</h3>
            </div>
            
            {mensajePerfil.texto && (
              <div className={`p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center gap-2 mb-6 ${mensajePerfil.tipo === 'exito' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
                {mensajePerfil.tipo === 'exito' ? <CheckCircle2 size={18} className="shrink-0"/> : <AlertCircle size={18} className="shrink-0"/>} {mensajePerfil.texto}
              </div>
            )}
            
            {!cambiandoPass ? (
              <button onClick={() => setCambiandoPass(true)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-5 text-lg rounded-2xl transition-colors border dark:border-slate-800/80">Cambiar Contraseña</button>
            ) : (
              <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Contraseña Actual</label>
                  <input type="password" value={passwordData.actual} onChange={(e) => { setPasswordData({...passwordData, actual: e.target.value}); setPassErrores({...passErrores, actual: ""}); }} placeholder="Tu contraseña actual" className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${passErrores.actual ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400'}`} />
                  {passErrores.actual && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.actual}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nueva Contraseña</label>
                  <input type="password" value={passwordData.nueva} onChange={(e) => { setPasswordData({...passwordData, nueva: e.target.value}); setPassErrores({...passErrores, nueva: ""}); }} placeholder="Mínimo 6 caracteres" className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${passErrores.nueva ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400'}`} />
                  {passErrores.nueva && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.nueva}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Confirmar Nueva Contraseña</label>
                  <input type="password" value={passwordData.confirmar} onChange={(e) => { setPasswordData({...passwordData, confirmar: e.target.value}); setPassErrores({...passErrores, confirmar: ""}); }} placeholder="Repite la nueva contraseña" className={`w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${passErrores.confirmar ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400'}`} />
                  {passErrores.confirmar && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.confirmar}</p>}
                </div>
                
                {passErrores.general && (
                  <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-base font-bold text-center border border-rose-200 dark:border-rose-500/20">
                    {passErrores.general}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button onClick={() => { setCambiandoPass(false); setPasswordData({actual:"", nueva:"", confirmar:""}); setPassErrores({actual:"", nueva:"", confirmar:"", general:""}); }} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 font-bold py-5 rounded-2xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
                  <button onClick={procesarCambioPassword} className="bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white font-bold py-5 rounded-2xl transition-colors shadow-md text-lg">Actualizar</button>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-6 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-4 flex justify-center items-center gap-2 text-lg mt-8">
            <LogOut size={24} className="shrink-0" /> Cerrar Sesión
          </button>
        </>
      )}

      {/* MODALES FLOTANTES */}
      {modalCancelarPro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner mt-4">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¿Cancelar Plan PRO?</h2>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-base mb-6">Perderás acceso inmediato a tus reportes y el límite de clientes y colaboradores volverá al plan básico.</p>
            
            <input type="password" value={passCancelarPro} onChange={e => {setPassCancelarPro(e.target.value); setErrorCancelarPro("")}} placeholder="Ingresa tu contraseña actual" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-rose-500 text-slate-900 dark:text-white placeholder-slate-400 mb-2 font-bold text-lg" />
            {errorCancelarPro && <p className="text-rose-500 text-sm font-bold mb-4">{errorCancelarPro}</p>}

            <div className="flex gap-4 mt-2">
              <button onClick={() => {setModalCancelarPro(false); setPassCancelarPro(""); setErrorCancelarPro("");}} className="flex-1 bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 text-lg rounded-2xl transition-colors border dark:border-slate-800/80">Volver</button>
              <button onClick={cancelarSuscripcion} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 text-lg rounded-2xl shadow-lg transition-transform active:scale-95">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalSuscripcion.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden transition-colors duration-500">
            <button onClick={() => setModalSuscripcion({ visible: false, titulo: "", mensaje: "" })} className="absolute top-4 right-4 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-500 rounded-full p-2 transition-colors z-10"><X size={24}/></button>
            <div className="absolute top-0 left-0 right-0 bg-blue-600 h-28"></div>
            <div className="relative z-10 mt-8 mb-6">
              <div className="w-20 h-20 bg-white dark:bg-[#020617] rounded-2xl flex items-center justify-center shadow-xl mx-auto border-4 border-white dark:border-[#0f172a]">
                <Star size={40} className="text-emerald-500 fill-current" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalSuscripcion.titulo || "Desbloquea Fiabono PRO"}</h3>
            <p className="text-base font-medium text-slate-500 dark:text-slate-400 mb-6 whitespace-pre-line">{modalSuscripcion.mensaje}</p>
            <button onClick={() => setModalSuscripcion({ visible: false, titulo: "", mensaje: "" })} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 text-lg">Entendido</button>
          </div>
        </div>
      )}

      {modalAvisoColaborador.visible && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800/60 relative">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ${modalAvisoColaborador.icono === 'exito' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400' : (modalAvisoColaborador.icono === 'error' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-500 dark:text-rose-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400')}`}>
              {modalAvisoColaborador.icono === 'exito' && <CheckCircle2 size={50} />}
              {modalAvisoColaborador.icono === 'error' && <AlertCircle size={50} />}
              {modalAvisoColaborador.icono === 'info' && <Info size={50} />}
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalAvisoColaborador.titulo}</h2>
            <p className="text-slate-600 dark:text-slate-400 text-base mb-8 font-medium leading-relaxed whitespace-pre-line">{modalAvisoColaborador.mensaje}</p>
            <button onClick={() => setModalAvisoColaborador({ visible: false, titulo: "", mensaje: "", icono: 'exito' })} className={`w-full text-white font-black py-5 rounded-2xl transition-colors shadow-lg text-lg ${modalAvisoColaborador.icono === 'exito' ? 'bg-emerald-500 hover:bg-emerald-600' : (modalAvisoColaborador.icono === 'error' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-500 hover:bg-blue-600')}`}>Entendido</button>
          </div>
        </div>
      )}

      {modalSeguridad.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldAlert size={40} /></div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center">Acción Protegida</h3>
            <p className="text-base text-slate-500 dark:text-slate-400 text-center mb-8">Por seguridad, ingresa tu contraseña para borrar este acceso de colaborador.</p>
            <input type="password" value={passSeguridad} onChange={e => setPassSeguridad(e.target.value)} placeholder="Tu contraseña actual" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 mb-2" />
            {errorSeguridad && <p className="text-rose-500 dark:text-rose-400 text-sm font-bold text-center mb-4 flex items-center justify-center gap-1"><AlertCircle size={14}/>{errorSeguridad}</p>}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={() => {setModalSeguridad({visible: false, accion: null}); setPassSeguridad(""); setErrorSeguridad("");}} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl transition-colors border dark:border-slate-800/80 text-lg">Cancelar</button>
              <button onClick={verificarSeguridadYEjecutar} disabled={cargandoSeguridad} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-colors flex justify-center items-center shadow-md text-lg">{cargandoSeguridad ? '...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}