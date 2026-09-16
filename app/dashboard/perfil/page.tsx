"use client";
import { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, doc, updateDoc, where, setDoc, deleteDoc } from "firebase/firestore";
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import { db, auth } from "../../../firebase";
import { storage } from "../../../firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { UserCog, LogOut, Sun, Monitor, Moon, Edit2, Mail, ShieldAlert, Shield, CheckCircle2, AlertCircle, Star, Lock, UserPlus, ChevronUp, ChevronDown, ChevronRight, AlertTriangle, Trash2, Info, X, Clock, Upload, Image as ImageIcon, Building2, MapPin, Receipt, PhoneCall, Camera, Smartphone, ArrowUpFromLine, MoreHorizontal, Download, Crown, Store, Sparkles, Bookmark, KeyRound, Eye, EyeOff, CreditCard, Package, Users, Banknote, Tag } from 'lucide-react';
import ModalHorarios from '@/components/ModalHorarios';
import { useAuth } from "../../../hooks/AuthContext";
import ModalSuscripcion from "@/components/ModalSuscripcion";
import ModalAjustarImagen from "@/components/ModalAjustarImagen";
import { PermisosColaborador } from "@/types";
import { generarSlugNegocio, limpiarUsuarioColaborador } from "@/utils/slug";
import toast from "react-hot-toast";

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
  const [logoNegocio, setLogoNegocio] = useState<string | null>(datosSesion?.logoNegocio || null);
  const [nitNegocio, setNitNegocio] = useState(datosSesion?.nitNegocio || "");
  const [direccionNegocio, setDireccionNegocio] = useState(datosSesion?.direccionNegocio || "");
  const [mensajePieTicket, setMensajePieTicket] = useState(datosSesion?.mensajePieTicket || "");
  const [habilitarIva, setHabilitarIva] = useState(datosSesion?.habilitarIva || false);
  const [porcentajeIva, setPorcentajeIva] = useState<number>(datosSesion?.porcentajeIva || 19);
  const [moduloSepareActivo, setModuloSepareActivo] = useState(datosSesion?.moduloSepareActivo !== false);
  const correoNegocio = datosSesion?.correoNegocio || "";
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagenParaAjustar, setImagenParaAjustar] = useState<string | null>(null);
  const [modalAjustarOpen, setModalAjustarOpen] = useState(false);
  const [procesandoLogo, setProcesandoLogo] = useState(false);

  const [mostrarPerfilNegocio, setMostrarPerfilNegocio] = useState(false);
  const [modoEdicionPerfil, setModoEdicionPerfil] = useState(false);
  const [editNombreUsuario, setEditNombreUsuario] = useState(nombreUsuario);
  const [slugNegocioActual, setSlugNegocioActual] = useState(datosSesion?.slugNegocio || generarSlugNegocio(datosSesion?.nombreNegocio || ""));
  const [slugNegocioEdicion, setSlugNegocioEdicion] = useState(datosSesion?.slugNegocio || generarSlugNegocio(datosSesion?.nombreNegocio || ""));
  const [guardandoSlug, setGuardandoSlug] = useState(false);
  const [errorSlug, setErrorSlug] = useState("");
  
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
  const [formColaborador, setFormColaborador] = useState<{ nombre: string; usuarioAcceso: string; password: string; confirmPassword: string; permisos: PermisosColaborador }>({
    nombre: "",
    usuarioAcceso: "",
    password: "",
    confirmPassword: "",
    permisos: {
      verCelulares: false,
      verDirectorio: false,
      verCartera: false,
      verReportes: false,
      ventaDirecta: false,
      abonar: false,
      editarInventario: false, ingresoInventario: false,
      terminalMultivendedor: false,
      modificarPrecios: false,
      aplicarDescuentos: false,
      planSepare: false,
      hacerDevoluciones: false,
      enviarWhatsApp: false
    }
  });
  const [errorFormColaborador, setErrorFormColaborador] = useState({ usuarioAcceso: "", general: "" });
  const [creandoColaborador, setCreandoColaborador] = useState(false);


  const [modalAvisoColaborador, setModalAvisoColaborador] = useState<{ visible: boolean, titulo: string, mensaje: string, icono: 'exito'|'error'|'info' }>({ visible: false, titulo: "", mensaje: "", icono: 'exito' });
  const [modalCancelarPro, setModalCancelarPro] = useState(false);
  const [passCancelarPro, setPassCancelarPro] = useState("");
  const [errorCancelarPro, setErrorCancelarPro] = useState("");
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [modalHorariosOpen, setModalHorariosOpen] = useState(false);
  const [colabParaHorarios, setColabParaHorarios] = useState<any | null>(null);
  const [modalSuscripcionOpen, setModalSuscripcionOpen] = useState(false);
  const [planInicialSuscripcion, setPlanInicialSuscripcion] = useState<'comercio' | 'pro'>('comercio');
  const [appInstalada, setAppInstalada] = useState(false);
  const [modalInstalarApp, setModalInstalarApp] = useState(false);

  // Estados para Eliminación de Cuenta y Datos (Ley 1581 / Habeas Data)
  const [modalEliminarCuenta, setModalEliminarCuenta] = useState(false);
  const [modalConfirmacionFinalEliminar, setModalConfirmacionFinalEliminar] = useState(false);
  const [textoConfirmacionEliminar, setTextoConfirmacionEliminar] = useState("");
  const [eliminandoCuenta, setEliminandoCuenta] = useState(false);
  const [errorEliminarCuenta, setErrorEliminarCuenta] = useState("");

  // Estados para Restablecimiento de Contraseña de Colaborador (por Admin)
  const [modalResetPass, setModalResetPass] = useState<{ visible: boolean; colaborador: any | null }>({ visible: false, colaborador: null });
  const [nuevaPassReset, setNuevaPassReset] = useState("");
  const [confirmarPassReset, setConfirmarPassReset] = useState("");
  const [resettingPass, setResettingPass] = useState(false);
  const [errorResetPass, setErrorResetPass] = useState("");

  // Estados para Cambio de Contraseña Propia (por Colaborador)
  const [passColabPropia, setPassColabPropia] = useState({ nueva: "", confirmar: "", error: "" });
  const [guardandoPassColab, setGuardandoPassColab] = useState(false);

  // Estados para visibilidad de contraseñas (ojito)
  const [verPassColab, setVerPassColab] = useState(false);
  const [verConfirmPassColab, setVerConfirmPassColab] = useState(false);
  const [verPassReset, setVerPassReset] = useState(false);
  const [verConfirmPassReset, setVerConfirmPassReset] = useState(false);
  const [verPassColabPropia, setVerPassColabPropia] = useState(false);
  const [verConfirmColabPropia, setVerConfirmColabPropia] = useState(false);
  const [verPassAdminActual, setVerPassAdminActual] = useState(false);
  const [verPassAdminNueva, setVerPassAdminNueva] = useState(false);
  const [verPassAdminConfirmar, setVerPassAdminConfirmar] = useState(false);
  const [verPassCancelarPro, setVerPassCancelarPro] = useState(false);

  // Estados para Eliminar Colaborador
  const [modalEliminarColaborador, setModalEliminarColaborador] = useState<{ visible: boolean; colaborador: any | null }>({ visible: false, colaborador: null });
  const [eliminandoColab, setEliminandoColab] = useState(false);

  // Estados para Terminal de Caja Mostrador (Plan PRO)
  const [cajaMostrador, setCajaMostrador] = useState<any | null>(null);
  const [modalActivarCajaOpen, setModalActivarCajaOpen] = useState(false);
  const [passCajaInicial, setPassCajaInicial] = useState("");
  const [confirmarPassCajaInicial, setConfirmarPassCajaInicial] = useState("");
  const [verPassCajaInicial, setVerPassCajaInicial] = useState(false);
  const [verConfirmPassCajaInicial, setVerConfirmPassCajaInicial] = useState(false);
  const [errorPassCaja, setErrorPassCaja] = useState("");
  const [guardandoCaja, setGuardandoCaja] = useState(false);

  const [modalCambiarClaveCajaOpen, setModalCambiarClaveCajaOpen] = useState(false);
  const [nuevaClaveCaja, setNuevaClaveCaja] = useState("");
  const [confirmarClaveCaja, setConfirmarClaveCaja] = useState("");
  const [verNuevaClaveCaja, setVerNuevaClaveCaja] = useState(false);
  const [verConfirmarClaveCaja, setVerConfirmarClaveCaja] = useState(false);
  const [errorCambiarClaveCaja, setErrorCambiarClaveCaja] = useState("");
  const [guardandoClaveCaja, setGuardandoClaveCaja] = useState(false);

  const [modalEliminarCajaOpen, setModalEliminarCajaOpen] = useState(false);
  const [eliminandoCaja, setEliminandoCaja] = useState(false);

  const [modalPermisosCajaOpen, setModalPermisosCajaOpen] = useState(false);
  const [permisosCajaEdicion, setPermisosCajaEdicion] = useState<PermisosColaborador>({
    ventaDirecta: false,
    abonar: false,
    terminalMultivendedor: true,
    planSepare: false,
    verCelulares: false,
    verCartera: false,
    verDirectorio: false,
    verReportes: false,
    editarInventario: false,
    ingresoInventario: false,
    modificarPrecios: false,
    aplicarDescuentos: false,
    enviarWhatsApp: true
  });
  const [guardandoPermisosCaja, setGuardandoPermisosCaja] = useState(false);

  useEffect(() => {
    const verificarInstalada = () => {
      if (typeof window === "undefined") return;
      try {
        const instalada =
          window.matchMedia("(display-mode: standalone)").matches ||
          window.matchMedia("(display-mode: fullscreen)").matches ||
          window.matchMedia("(display-mode: minimal-ui)").matches ||
          (window.navigator as any).standalone === true ||
          document.referrer.includes("android-app://") ||
          localStorage.getItem("fiabono-app-installed") === "1";
        setAppInstalada(instalada);
      } catch (e) {}
    };

    verificarInstalada();
    window.addEventListener("appinstalled", verificarInstalada);
    return () => window.removeEventListener("appinstalled", verificarInstalada);
  }, []);

  useEffect(() => {
    if (datosSesion) {
      setNombreUsuario(datosSesion.nombreUsuario || "");
      setNombreNegocio(datosSesion.nombreNegocio || "");
      setTelefonoNegocio(datosSesion.telefonoNegocio || "");
      setLogoNegocio(datosSesion.logoNegocio || null);
      setNitNegocio(datosSesion.nitNegocio || "");
      setDireccionNegocio(datosSesion.direccionNegocio || "");
      setMensajePieTicket(datosSesion.mensajePieTicket || "");
      setHabilitarIva(datosSesion.habilitarIva || false);
      setPorcentajeIva(datosSesion.porcentajeIva || 19);
      setModuloSepareActivo(datosSesion.moduloSepareActivo !== false);
      const slugVal = datosSesion.slugNegocio || generarSlugNegocio(datosSesion.nombreNegocio || "");
      setSlugNegocioActual(slugVal);
      setSlugNegocioEdicion(slugVal);
    }
  }, [datosSesion]);

  useEffect(() => {
    // Sincronización robusta de tema
    const temaGuardado = (localStorage.getItem('temaFiabono') || localStorage.getItem('tema')) as any;
    if (temaGuardado) {
      setTemaApariencia(temaGuardado);
      if (temaGuardado === 'oscura') document.documentElement.classList.add('dark');
      else if (temaGuardado === 'clara') document.documentElement.classList.remove('dark');
    } else if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      setTemaApariencia('oscura');
    }
    setTemaCargado(true); 
    
    if (adminId && !esCajero) {
      cargarListaColaboradores(adminId!);
    }
  }, [adminId, esCajero]);

  useEffect(() => {
    if (!temaCargado) return; 
    localStorage.setItem('temaFiabono', temaApariencia);
    localStorage.setItem('tema', temaApariencia);
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
      let caja: any = null;
      snap.forEach(doc => {
        const d: any = { id: doc.id, ...doc.data() };
        if (d.esCajaMostrador === true) {
          caja = d;
        } else {
          lista.push(d);
        }
      });
      setColaboradoresRegistrados(lista);
      setCajaMostrador(caja);
    } catch(e) {}
  };

  const abrirUpsell = (titulo: string, mensaje: string) => {
    setModalSuscripcion({ visible: true, titulo, mensaje });
  };

  const procesarSubidaLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).");
      return;
    }

    setProcesandoLogo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawSrc = event.target?.result as string;
      if (rawSrc) {
        setImagenParaAjustar(rawSrc);
        setModalAjustarOpen(true);
      }
      setProcesandoLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      setProcesandoLogo(false);
      toast.error("Error al leer el archivo de imagen.");
    };
    reader.readAsDataURL(file);
  };

  const aplicarLogoRecortado = async (logoBase64: string) => {
    setLogoNegocio(logoBase64);
    setImagenParaAjustar(null);
    if (usuarioAuth) {
      try {
        const logoBlob = await fetch(logoBase64).then(response => response.blob());
        const logoRef = ref(storage, `logos/${usuarioAuth.uid}`);
        await uploadBytes(logoRef, logoBlob, { contentType: logoBlob.type || 'image/png' });
        const logoUrl = await getDownloadURL(logoRef);
        await updateDoc(doc(db, "usuarios", usuarioAuth.uid), { logoNegocio: logoBase64, logoUrl });
        setDatosSesion((prev: any) => ({
          ...prev, 
          logoNegocio: logoBase64
        }));
        toast.success("¡Logo actualizado y guardado con éxito!");
      } catch (error) {
        toast.error("Logo ajustado. Recuerda hacer clic en 'Guardar Cambios'.");
      }
    }
  };

  const guardarDatosPerfil = async () => {
    if (!usuarioAuth) return;
    setErrorSlug("");
    const nuevoSlugLimpio = limpiarUsuarioColaborador(slugNegocioEdicion || generarSlugNegocio(nombreNegocio));
    if (!nuevoSlugLimpio || nuevoSlugLimpio.length < 2) {
      setErrorSlug("El identificador del negocio debe tener al menos 2 caracteres.");
      toast.error("El identificador del negocio debe tener al menos 2 caracteres.");
      return;
    }

    try {
      let slugFinal = slugNegocioActual;

      // Si el usuario cambió el identificador del negocio, sincronizar colaboradores en el backend
      if (nuevoSlugLimpio !== slugNegocioActual) {
        setGuardandoSlug(true);
        const token = await usuarioAuth.getIdToken();
        const resSlug = await fetch("/api/negocio/actualizar-slug", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ nuevoSlug: nuevoSlugLimpio })
        });

        const dataSlug = await resSlug.json();
        setGuardandoSlug(false);

        if (!resSlug.ok) {
          setErrorSlug(dataSlug.error || "No se pudo actualizar el identificador.");
          toast.error(dataSlug.error || "No se pudo actualizar el identificador.");
          return;
        }

        slugFinal = dataSlug.nuevoSlug;
        setSlugNegocioActual(slugFinal);
        cargarListaColaboradores(adminId || usuarioAuth.uid);
        if (dataSlug.colaboradoresActualizados?.length > 0) {
          toast.success(`¡${dataSlug.colaboradoresActualizados.length} colaborador(es) sincronizados con el código '${slugFinal}'!`, { duration: 6000 });
        }
      }

      await updateDoc(doc(db, "usuarios", usuarioAuth.uid), { 
        nombreNegocio, 
        telefonoNegocio, 
        nitNegocio,
        direccionNegocio,
        mensajePieTicket,
        logoNegocio: logoNegocio || null,
        nombreUsuario: editNombreUsuario,
        habilitarIva,
        porcentajeIva: Number(porcentajeIva) || 19,
        moduloSepareActivo,
        slugNegocio: slugFinal
      });
      setNombreUsuario(editNombreUsuario);
      setDatosSesion((prev: any) => ({
        ...prev, 
        nombreNegocio, 
        telefonoNegocio, 
        nitNegocio, 
        direccionNegocio, 
        mensajePieTicket, 
        logoNegocio: logoNegocio || null, 
        nombreUsuario: editNombreUsuario, 
        habilitarIva, 
        porcentajeIva: Number(porcentajeIva) || 19,
        moduloSepareActivo,
        slugNegocio: slugFinal
      }));
      setMensajePerfil({ texto: "Datos del negocio actualizados correctamente.", tipo: "exito" });
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
    
    // Si intenta ACTIVAR / HABILITAR al colaborador:
    if (nuevoEstado === true) {
      const esGratis = planActual === 'gratis' || planActual === 'basico';
      const esComercio = planActual === 'comercio';
      const esPro = planActual === 'pro';

      if (esGratis) {
        setPlanInicialSuscripcion('comercio');
        setModalSuscripcionOpen(true);
        toast.error("El Plan Gratuito no permite colaboradores activos. Mejora al Plan Comercio para habilitar a tu colaborador.");
        return;
      }

      const activos = colaboradoresRegistrados.filter(c => c.id !== colaborador.id && (c.activo === true || c.activo === undefined)).length;

      if (esComercio && activos >= 1) {
        setPlanInicialSuscripcion('pro');
        setModalSuscripcionOpen(true);
        toast.error("Tu Plan Comercio solo permite 1 colaborador activo a la vez. Apaga al colaborador actual o mejora al Plan PRO Almacén para tener hasta 4.");
        return;
      }

      if (esPro && activos >= 4) {
        setModalAvisoColaborador({
          visible: true,
          titulo: "Límite Alcanzado",
          mensaje: "Tu Plan PRO Almacén permite un máximo de 4 colaboradores activos simultáneamente. Apaga a uno de los activos si deseas habilitar a este usuario.",
          icono: 'error'
        });
        return;
      }
    }
    
    setColaboradoresRegistrados(prev => prev.map(c => c.id === colaborador.id ? { ...c, activo: nuevoEstado } : c));
    try { 
      await updateDoc(doc(db, "usuarios", colaborador.id), { activo: nuevoEstado }); 
      toast.success(nuevoEstado ? "Colaborador habilitado correctamente" : "Colaborador deshabilitado");
    } 
    catch (error) { 
      cargarListaColaboradores(adminId!); 
    }
  };

  const slugNegocio = slugNegocioActual || generarSlugNegocio(nombreNegocio || datosSesion?.nombreNegocio || "");

  const ejecutarResetPassColaborador = async () => {
    if (!modalResetPass.colaborador) return;
    if (!nuevaPassReset || nuevaPassReset.length < 6) {
      setErrorResetPass("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaPassReset !== confirmarPassReset) {
      setErrorResetPass("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }
    setResettingPass(true);
    setErrorResetPass("");
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("No se pudo obtener el token de sesión. Por favor recarga.");

      const res = await fetch("/api/colaboradores/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          colaboradorId: modalResetPass.colaborador.id,
          nuevaPassword: nuevaPassReset
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al actualizar la contraseña.");
      }

      toast.success(`¡Contraseña restablecida con éxito para ${modalResetPass.colaborador.nombreUsuario}!`, { duration: 5000 });
      setModalResetPass({ visible: false, colaborador: null });
      setNuevaPassReset("");
      setConfirmarPassReset("");
    } catch (err: any) {
      setErrorResetPass(err?.message || "Error al actualizar la contraseña.");
    } finally {
      setResettingPass(false);
    }
  };

  const ejecutarEliminarColaborador = async () => {
    if (!modalEliminarColaborador.colaborador) return;
    setEliminandoColab(true);
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("Sesión no válida. Por favor recarga la página.");

      const res = await fetch("/api/colaboradores/eliminar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          colaboradorId: modalEliminarColaborador.colaborador.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar el colaborador.");
      }

      toast.success(data.mensaje || "Colaborador eliminado definitivamente.", { duration: 4000 });
      setModalEliminarColaborador({ visible: false, colaborador: null });
      cargarListaColaboradores(adminId || usuarioAuth?.uid!);
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error al eliminar.");
    } finally {
      setEliminandoColab(false);
    }
  };

  const toggleEstadoCajaMostrador = async () => {
    if (!cajaMostrador) return;
    const nuevoEstado = !(cajaMostrador.activo !== false);
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("Sesión no válida");
      const res = await fetch("/api/caja-mostrador", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ accion: "toggle_activo", activo: nuevoEstado })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar estado.");
      setCajaMostrador((prev: any) => prev ? { ...prev, activo: nuevoEstado } : null);
      toast.success(data.mensaje || "Estado actualizado.");
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar estado.");
    }
  };

  const ejecutarActivarCajaMostrador = async () => {
    setErrorPassCaja("");
    if (!passCajaInicial || passCajaInicial.length < 6) {
      setErrorPassCaja("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (passCajaInicial !== confirmarPassCajaInicial) {
      setErrorPassCaja("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    setGuardandoCaja(true);
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("Sesión no válida. Recarga la página.");

      const res = await fetch("/api/caja-mostrador", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ accion: "activar", password: passCajaInicial })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al activar la Caja Mostrador.");

      toast.success(data.mensaje || "¡Terminal de Caja Mostrador activada!");
      setModalActivarCajaOpen(false);
      setPassCajaInicial("");
      setConfirmarPassCajaInicial("");
      cargarListaColaboradores(adminId || usuarioAuth?.uid!);
    } catch (err: any) {
      setErrorPassCaja(err?.message || "Ocurrió un error al activar.");
    } finally {
      setGuardandoCaja(false);
    }
  };

  const ejecutarCambiarClaveCaja = async () => {
    setErrorCambiarClaveCaja("");
    if (!nuevaClaveCaja || nuevaClaveCaja.length < 6) {
      setErrorCambiarClaveCaja("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (nuevaClaveCaja !== confirmarClaveCaja) {
      setErrorCambiarClaveCaja("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    setGuardandoClaveCaja(true);
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("Sesión no válida. Recarga la página.");

      const res = await fetch("/api/caja-mostrador", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ accion: "cambiar_password", nuevaPassword: nuevaClaveCaja })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar la contraseña.");

      toast.success(data.mensaje || "Contraseña de Caja Mostrador actualizada.");
      setModalCambiarClaveCajaOpen(false);
      setNuevaClaveCaja("");
      setConfirmarClaveCaja("");
    } catch (err: any) {
      setErrorCambiarClaveCaja(err?.message || "Ocurrió un error.");
    } finally {
      setGuardandoClaveCaja(false);
    }
  };

  const ejecutarEliminarCaja = async () => {
    setEliminandoCaja(true);
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("Sesión no válida. Recarga la página.");

      const res = await fetch("/api/caja-mostrador", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar la Caja Mostrador.");

      toast.success(data.mensaje || "Terminal de Caja eliminada.");
      setModalEliminarCajaOpen(false);
      setCajaMostrador(null);
      cargarListaColaboradores(adminId || usuarioAuth?.uid!);
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error al eliminar.");
    } finally {
      setEliminandoCaja(false);
    }
  };

  const ejecutarActualizarPermisosCaja = async () => {
    setGuardandoPermisosCaja(true);
    try {
      const token = await usuarioAuth?.getIdToken();
      if (!token) throw new Error("Sesión no válida. Recarga la página.");

      const res = await fetch("/api/caja-mostrador", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ accion: "actualizar_permisos", permisos: permisosCajaEdicion })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar los permisos.");

      toast.success(data.mensaje || "Permisos actualizados con éxito.");
      setCajaMostrador((prev: any) => prev ? { ...prev, permisos: data.permisos || permisosCajaEdicion } : null);
      setModalPermisosCajaOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error al guardar permisos.");
    } finally {
      setGuardandoPermisosCaja(false);
    }
  };

  const cambiarPasswordColaboradorPropia = async () => {
    if (!usuarioAuth) return;
    setPassColabPropia(p => ({ ...p, error: "" }));

    if (!passColabPropia.nueva || passColabPropia.nueva.length < 6) {
      setPassColabPropia(p => ({ ...p, error: "La nueva contraseña debe tener al menos 6 caracteres." }));
      return;
    }
    if (passColabPropia.nueva !== passColabPropia.confirmar) {
      setPassColabPropia(p => ({ ...p, error: "Las contraseñas no coinciden." }));
      return;
    }

    setGuardandoPassColab(true);
    try {
      await updatePassword(usuarioAuth, passColabPropia.nueva);
      toast.success("¡Tu contraseña ha sido actualizada con éxito!");
      setPassColabPropia({ nueva: "", confirmar: "", error: "" });
    } catch (err: any) {
      console.error("Error al actualizar contraseña:", err);
      if (err.code === 'auth/requires-recent-login') {
        setPassColabPropia(p => ({ 
          ...p, 
          error: "Por seguridad de tu cuenta, debes cerrar sesión y volver a ingresar antes de cambiar la contraseña." 
        }));
      } else {
        setPassColabPropia(p => ({ 
          ...p, 
          error: err?.message || "Ocurrió un error al actualizar la contraseña." 
        }));
      }
    } finally {
      setGuardandoPassColab(false);
    }
  };

  const guardarColaborador = async () => {
    setErrorFormColaborador({ usuarioAcceso: "", general: "" });
    if(!formColaborador.nombre.trim()) return setErrorFormColaborador(p => ({...p, general: "El nombre es obligatorio."}));
    
    const esGratis = planActual === 'gratis' || planActual === 'basico';
    const esComercio = planActual === 'comercio';
    const esPro = planActual === 'pro';

    if (!colaboradorEnEdicion) {
      if(!formColaborador.usuarioAcceso.trim() || !formColaborador.password.trim() || !formColaborador.confirmPassword.trim()) {
        return setErrorFormColaborador(p => ({...p, general: "Llena todos los campos."}));
      }
      if(formColaborador.password.length < 6) return setErrorFormColaborador(p => ({...p, general: "La contraseña debe tener mínimo 6 caracteres."}));
      if(formColaborador.password !== formColaborador.confirmPassword) return setErrorFormColaborador(p => ({...p, general: "Las contraseñas no coinciden."}));

      if (esGratis) {
        setModoCrearColaborador(false);
        setPlanInicialSuscripcion('comercio');
        setModalSuscripcionOpen(true);
        toast.error("El Plan Gratis no incluye colaboradores. Mejora al Plan Comercio para agregar a tu primer colaborador.");
        return;
      }

      const activosActuales = colaboradoresRegistrados.filter(c => c.activo === true || c.activo === undefined).length;

      if (esComercio && activosActuales >= 1) {
        setModoCrearColaborador(false);
        setPlanInicialSuscripcion('pro');
        setModalSuscripcionOpen(true);
        toast.error("Tu Plan Comercio ya tiene 1 colaborador activo. Mejora al Plan PRO Almacén para tener hasta 4, o desactiva el actual y crea el nuevo.");
        return;
      }
      if (esPro && activosActuales >= 4) {
        return setModalAvisoColaborador({ 
          visible: true, 
          titulo: "Límite Alcanzado", 
          mensaje: "Tu Plan PRO Almacén permite un máximo de 4 colaboradores activos. Desactiva uno antes de crear otro.", 
          icono: 'error' 
        });
      }
    }

    // Asegurar que si no es PRO, los permisos exclusivos no queden guardados
    const permisosSanitizados: PermisosColaborador = {
      ...formColaborador.permisos,
      terminalMultivendedor: false,
      planSepare: esPro ? (formColaborador.permisos.planSepare ?? false) : false
    };

    setCreandoColaborador(true);
    try {
      if (colaboradorEnEdicion) {
        await updateDoc(doc(db, "usuarios", colaboradorEnEdicion.id), {
          nombreUsuario: formColaborador.nombre.trim(),
          permisos: permisosSanitizados
        });
        setModalAvisoColaborador({ visible: true, titulo: "Colaborador Actualizado", mensaje: `Los datos de ${formColaborador.nombre} se han actualizado correctamente.`, icono: 'exito' });
      } else {
        const usuarioLimpio = limpiarUsuarioColaborador(formColaborador.usuarioAcceso);
        if (!usuarioLimpio) {
          setErrorFormColaborador(p => ({ ...p, usuarioAcceso: "Ingresa un usuario válido (letras y números)." }));
          setCreandoColaborador(false);
          return;
        }

        const identificadorUsuario = `${usuarioLimpio}-${slugNegocio}`;
        const correoGenerado = `${identificadorUsuario}@fiabono.caja`;
        const secondaryApp = getApps().find(app => app.name === "SecondaryAuthApp") || initializeApp(auth.app.options, "SecondaryAuthApp");
        const secondaryAuthObj = getAuth(secondaryApp);
        
        const cred = await createUserWithEmailAndPassword(secondaryAuthObj, correoGenerado, formColaborador.password);
        
        await setDoc(doc(db, "usuarios", cred.user.uid), { 
          nombreUsuario: formColaborador.nombre.trim(),
          baseUsuario: usuarioLimpio,
          usuarioAcceso: identificadorUsuario,
          email: correoGenerado,
          rol: "cajero",
          adminId: adminId,
          permisos: permisosSanitizados,
          activo: true,
          fechaCreacion: new Date()
        });
        await secondaryAuthObj.signOut();
        setModalAvisoColaborador({ 
          visible: true, 
          titulo: "¡Colaborador Creado!", 
          mensaje: `El colaborador fue creado exitosamente.\n\n👤 Usuario para entrar:\n${identificadorUsuario}\n\n🔑 Contraseña: la que acabas de asignarle.\n\nTu colaborador no necesita correo, solo debe escribir ese usuario y clave en la pantalla de inicio.`, 
          icono: 'exito' 
        });
      }
      setFormColaborador({ nombre:"", usuarioAcceso:"", password:"", confirmPassword: "", permisos: { verCelulares: false, verDirectorio: false, verCartera: false, verReportes: false, ventaDirecta: false, abonar: false, editarInventario: false, ingresoInventario: false, terminalMultivendedor: false, modificarPrecios: false, aplicarDescuentos: false, planSepare: false, hacerDevoluciones: false, enviarWhatsApp: false } });
      setModoCrearColaborador(false); setColaboradorEnEdicion(null);
      cargarListaColaboradores(adminId!);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        const u = limpiarUsuarioColaborador(formColaborador.usuarioAcceso);
        setErrorFormColaborador(p => ({...p, usuarioAcceso: `El usuario '${u}-${slugNegocio}' ya está en uso. Intenta con '${u}2'.`}));
      } else {
        setErrorFormColaborador(p => ({...p, general: "Ocurrió un error al guardar. Intenta de nuevo."}));
      }
    }
    setCreandoColaborador(false);
  };


  const cancelarSuscripcion = async () => {
    if(!passCancelarPro) return setErrorCancelarPro("Ingresa tu contraseña para confirmar.");
    try {
      const cred = EmailAuthProvider.credential(usuarioAuth!.email!, passCancelarPro);
      await reauthenticateWithCredential(usuarioAuth!, cred);
      
      await updateDoc(doc(db, "usuarios", usuarioAuth!.uid), { plan: 'gratis', planVence: null, cicloPlan: 'mensual' });
      const qC = query(collection(db, "usuarios"), where("adminId", "==", usuarioAuth!.uid), where("rol", "==", "cajero"));
      const snap = await getDocs(qC);
      const batchPromesas: any[] = [];
      snap.forEach((documento) => { batchPromesas.push(updateDoc(doc(db, "usuarios", documento.id), { activo: false })); });
      await Promise.all(batchPromesas);

      setDatosSesion((prev:any) => ({...prev, planActual: 'gratis', esGratis: true, esPro: false, esComercio: false, diasPro: null}));
      setModalCancelarPro(false); setPassCancelarPro(""); setErrorCancelarPro("");
      cargarListaColaboradores(usuarioAuth!.uid);
      setModalAvisoColaborador({ visible: true, titulo: "Suscripción Cancelada", mensaje: "Has vuelto al Plan Gratuito con éxito.\n\nTodos tus datos, clientes e inventario se conservan intactos. Las nuevas creaciones respetarán los límites del plan gratuito.", icono: 'info' });
    } catch (error) { setErrorCancelarPro("Contraseña incorrecta. Intenta de nuevo."); }
  };

  // Función para ejecutar la eliminación permanente de la cuenta y datos
  const ejecutarEliminacionCuenta = async () => {
    if (textoConfirmacionEliminar.trim() !== "ELIMINAR DEFINITIVAMENTE") {
      setErrorEliminarCuenta("Debes escribir exactamente la frase de confirmación.");
      return;
    }

    if (!usuarioAuth?.uid) {
      setErrorEliminarCuenta("No se detectó una sesión activa válida.");
      return;
    }

    setEliminandoCuenta(true);
    setErrorEliminarCuenta("");

    try {
      const uidAdmin = usuarioAuth.uid;

      // 1. Colecciones a purgar que pertenezcan a este usuario/negocio
      const coleccionesAPurgar = [
        "productos",
        "clientes",
        "movimientos",
        "separes",
        "ordenes_pendientes",
      ];

      for (const colName of coleccionesAPurgar) {
        try {
          const q = query(collection(db, colName), where("usuarioId", "==", uidAdmin));
          const snap = await getDocs(q);
          const deletes = snap.docs.map((d) => deleteDoc(doc(db, colName, d.id)));
          await Promise.all(deletes);
        } catch (err) {
          console.error(`Error purgando colección ${colName}:`, err);
        }
      }

      // 2. Eliminar colaboradores subordinados (cajeros vinculados)
      try {
        const qColabs = query(collection(db, "usuarios"), where("adminId", "==", uidAdmin));
        const snapColabs = await getDocs(qColabs);
        const colabDeletes = snapColabs.docs.map((d) => deleteDoc(doc(db, "usuarios", d.id)));
        await Promise.all(colabDeletes);
      } catch (err) {
        console.error("Error purgando colaboradores:", err);
      }

      // 3. Eliminar documento del usuario admin en Firestore
      try {
        await deleteDoc(doc(db, "usuarios", uidAdmin));
      } catch (err) {
        console.error("Error eliminando documento de usuario:", err);
      }

      // 4. Intentar eliminar usuario de Firebase Authentication
      try {
        await usuarioAuth.delete();
      } catch (authErr: any) {
        console.warn("No se pudo eliminar de Auth directamente (posible sesión antigua):", authErr);
        // Si requiere login reciente o falla, al menos los datos de Firestore ya fueron eliminados irreversiblemente
      }

      toast.success("Tu cuenta y todos tus datos han sido eliminados de forma definitiva.", { duration: 6000 });

      // 5. Cerrar sesión, limpiar storage local y redirigir
      await signOut(auth);
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
      }
    } catch (err: any) {
      console.error("Error en eliminación completa:", err);
      setErrorEliminarCuenta(err?.message || "Ocurrió un error al procesar la eliminación. Intenta nuevamente.");
      setEliminandoCuenta(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28 sm:pb-12">
      
      {/* Input de archivo global para subir logo en cualquier momento */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={procesarSubidaLogo} 
        accept="image/*" 
        className="hidden" 
      />

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

          {/* CAMBIO DE CONTRASEÑA PROPIA PARA COLABORADOR */}
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 mt-6 text-left">
            <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 mb-2 border-b border-slate-100 dark:border-slate-800/60 pb-4 flex items-center gap-2">
              <Lock size={20} className="text-blue-500" /> Cambiar mi Contraseña
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Puedes actualizar tu contraseña en cualquier momento para mantener la seguridad de tus accesos.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={verPassColabPropia ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={passColabPropia.nueva}
                    onChange={e => setPassColabPropia(p => ({ ...p, nueva: e.target.value, error: "" }))}
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerPassColabPropia(!verPassColabPropia)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verPassColabPropia ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={verConfirmColabPropia ? "text" : "password"}
                    placeholder="Repite tu nueva contraseña"
                    value={passColabPropia.confirmar}
                    onChange={e => setPassColabPropia(p => ({ ...p, confirmar: e.target.value, error: "" }))}
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerConfirmColabPropia(!verConfirmColabPropia)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verConfirmColabPropia ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {passColabPropia.error && (
                <p className="text-rose-500 text-xs font-bold bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-200 dark:border-rose-500/20">{passColabPropia.error}</p>
              )}
              <button
                type="button"
                onClick={cambiarPasswordColaboradorPropia}
                disabled={guardandoPassColab}
                className="mt-1 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm shadow-sm active:scale-98"
              >
                {guardandoPassColab ? (
                  <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Guardar Nueva Contraseña
                  </>
                )}
              </button>
            </div>
          </div>

          <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-5 sm:py-6 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-24 sm:mb-6 flex justify-center items-center gap-2 text-lg mt-8">
            <LogOut size={24} className="shrink-0" /> Cerrar Sesión
          </button>
        </div>
      ) : (
        <>
          {/* PERFIL ADMINISTRADOR */}
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 text-center relative overflow-hidden">
            
            {/* AVATAR / LOGO INTERACTIVO EN CABECERA */}
            <div 
              className="relative w-28 h-28 mx-auto mb-4 group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title="Haz clic para cambiar el logo del negocio"
            >
              {logoNegocio ? (
                <div className="w-28 h-28 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center p-2 shadow-lg border-2 border-blue-500/30 overflow-hidden shrink-0 group-hover:scale-105 group-hover:border-blue-500 transition-all">
                  <img src={logoNegocio} alt="Logo Negocio" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg shrink-0 group-hover:scale-105 transition-all">
                  {nombreNegocio.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Botón Flotante con Ícono de Cámara */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                title="Cambiar Logo o Foto"
                className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 active:scale-90 text-white p-2.5 rounded-full shadow-lg border-2 border-white dark:border-[#0f172a] transition-all flex items-center justify-center cursor-pointer"
              >
                <Camera size={16} />
              </button>
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white truncate">{nombreNegocio}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-4 truncate">{correoNegocio}</p>
            
            {/* ESTADO DE SUSCRIPCIÓN */}
            <div className="flex flex-col items-center justify-center gap-2.5 mt-4">
              {planActual === 'pro' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-xs uppercase tracking-widest border border-purple-200 dark:border-purple-500/20 shadow-sm">
                    <Crown size={14} className="text-amber-500 fill-current shrink-0"/> <span>Plan PRO Almacén Activo {diasPro !== null && `(${diasPro} días)`}</span>
                  </div>
                  <button onClick={() => setModalSuscripcionOpen(true)} className="text-xs font-bold text-slate-500 hover:text-purple-600 transition-colors underline underline-offset-4 cursor-pointer">
                    Gestionar o Renovar Plan
                  </button>
                </div>
              )}

              {planActual === 'comercio' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest border border-blue-200 dark:border-blue-500/20 shadow-sm">
                    <Store size={14} className="shrink-0"/> <span>Plan Comercio Activo {diasPro !== null && `(${diasPro} días)`}</span>
                  </div>
                  <button onClick={() => setModalSuscripcionOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs shadow-md hover:scale-105 transition-transform cursor-pointer">
                    <Crown size={13} className="text-amber-400" /> Mejorar a PRO Almacén
                  </button>
                </div>
              )}

              {(planActual === 'gratis' || planActual === 'basico' || !planActual) && (
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                    <span>Plan Gratuito</span>
                  </div>
                  <button onClick={() => setModalSuscripcionOpen(true)} className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest shadow-md hover:scale-105 transition-transform cursor-pointer">
                    <Sparkles size={14} className="shrink-0"/> Mejorar mi Plan
                  </button>
                </div>
              )}
            </div>
          </div>

          <ModalSuscripcion 
            isOpen={modalSuscripcionOpen} 
            onClose={() => setModalSuscripcionOpen(false)} 
            cuentaPrincipalId={usuarioAuth ? usuarioAuth.uid : (adminId || "")} 
            planInicial={planInicialSuscripcion}
          />

          {/* COLABORADORES */}
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <UserPlus size={20} className="shrink-0"/>
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    Colaboradores y Empleados
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {planActual === 'pro' 
                      ? `Plan PRO Almacén: ${colaboradoresRegistrados.filter(c => c.activo !== false).length} de 4 vendedores (+ 1 Caja Mostrador)` 
                      : (planActual === 'comercio' 
                        ? `Plan Comercio: ${colaboradoresRegistrados.filter(c => c.activo !== false).length} de 1 activo` 
                        : 'Plan Gratuito: 0 colaboradores incluidos')}
                  </p>
                </div>
              </div>
              {colaboradoresRegistrados.length > 0 && (
                <button onClick={() => setMostrarColaboradores(!mostrarColaboradores)} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg shrink-0 cursor-pointer">
                  {mostrarColaboradores ? 'Ocultar' : 'Ver todos'} {mostrarColaboradores ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
              )}
            </div>
            
            {/* ALERTA DE DOWNGRADE: SI ESTÁ EN PLAN GRATIS Y TIENE COLABORADORES */}
            {(planActual === 'gratis' || planActual === 'basico' || !planActual) && colaboradoresRegistrados.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-300 shadow-xs animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-200 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl shrink-0">
                    <ShieldAlert size={20} />
                  </div>
                  <p className="text-xs font-bold leading-relaxed">
                    Tienes <strong>{colaboradoresRegistrados.length} colaborador{colaboradoresRegistrados.length > 1 ? 'es' : ''}</strong> registrado{colaboradoresRegistrados.length > 1 ? 's' : ''}, pero tu negocio está en el <strong>Plan Gratuito</strong>. Sus accesos están bloqueados hasta que actives el Plan Comercio o PRO.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPlanInicialSuscripcion('comercio');
                    setModalSuscripcionOpen(true);
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Sparkles size={13} /> Reactivar Colaboradores
                </button>
              </div>
            )}

            {/* SECCIÓN EXCLUSIVA PLAN PRO: TERMINAL DE CAJA MOSTRADOR */}
            {planActual === 'pro' && !modoCrearColaborador && (
              <div className="mb-6 p-5 sm:p-6 bg-gradient-to-br from-indigo-50/90 via-blue-50/40 to-purple-50/30 dark:from-indigo-950/40 dark:via-[#020617] dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                      <Monitor size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          Terminal de Caja Mostrador
                        </h4>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          Multivendedor • Plan PRO
                        </span>
                        {cajaMostrador && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            cajaMostrador.activo !== false
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {cajaMostrador.activo !== false ? '🟢 Habilitada' : 'Pausada'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                        Punto de venta compartido para la tablet o PC fija de tu mostrador. No consume ninguno de tus 4 cupos de colaboradores.
                      </p>
                    </div>
                  </div>

                  {!cajaMostrador ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPassCajaInicial("");
                        setConfirmarPassCajaInicial("");
                        setErrorPassCaja("");
                        setModalActivarCajaOpen(true);
                      }}
                      className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                      <Sparkles size={16} />
                      Activar Caja Mostrador
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (cajaMostrador?.permisos) {
                            setPermisosCajaEdicion({
                              ventaDirecta: cajaMostrador.permisos.ventaDirecta || false,
                              abonar: cajaMostrador.permisos.abonar || false,
                              terminalMultivendedor: true,
                              planSepare: cajaMostrador.permisos.planSepare || false,
                              verCelulares: cajaMostrador.permisos.verCelulares || false,
                              verCartera: cajaMostrador.permisos.verCartera === true,
                              verDirectorio: cajaMostrador.permisos.verDirectorio === true,
                              verReportes: cajaMostrador.permisos.verReportes === true,
                              editarInventario: cajaMostrador.permisos.editarInventario || false,
                              ingresoInventario: cajaMostrador.permisos.ingresoInventario || false,
                              modificarPrecios: cajaMostrador.permisos.modificarPrecios || false,
                              aplicarDescuentos: cajaMostrador.permisos.aplicarDescuentos || false,
                                hacerDevoluciones: cajaMostrador.permisos.hacerDevoluciones || false,
                              enviarWhatsApp: cajaMostrador.permisos.enviarWhatsApp !== false
                            });
                          } else {
                            setPermisosCajaEdicion({
                              ventaDirecta: false,
                              abonar: false,
                              terminalMultivendedor: true,
                              planSepare: false,
                              verCelulares: false,
                              verCartera: false,
                              verDirectorio: false,
                              verReportes: false,
                              editarInventario: false,
                              ingresoInventario: false,
                              modificarPrecios: false,
                              aplicarDescuentos: false,
                              enviarWhatsApp: true
                            });
                          }
                          setModalPermisosCajaOpen(true);
                        }}
                        title="Configurar permisos de la caja mostrador"
                        className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      >
                        <Shield size={16} />
                        <span className="hidden sm:inline">Permisos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNuevaClaveCaja("");
                          setConfirmarClaveCaja("");
                          setErrorCambiarClaveCaja("");
                          setModalCambiarClaveCajaOpen(true);
                        }}
                        title="Cambiar clave de la caja"
                        className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      >
                        <KeyRound size={16} />
                        <span className="hidden sm:inline">Cambiar Clave</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalEliminarCajaOpen(true)}
                        title="Eliminar terminal"
                        className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-500 transition-colors shadow-xs cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {cajaMostrador && (
                  <>
                    <div className="mt-3.5 pt-3 border-t border-indigo-200/50 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">Usuario para ingresar en la tablet:</span>
                        <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-500/20 px-2.5 py-0.5 rounded-md">
                          {cajaMostrador.usuarioAcceso || `caja-${slugNegocio}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cajaMostrador.activo !== false}
                            onChange={toggleEstadoCajaMostrador}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                        </label>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {cajaMostrador.activo !== false ? 'Terminal En Línea' : 'Terminal Pausada'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-indigo-100/80 dark:border-indigo-950/50 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold">Permisos configurados:</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1 ${
                        cajaMostrador.permisos?.ventaDirecta 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      }`}>
                        {cajaMostrador.permisos?.ventaDirecta ? '✓ Venta Directa' : '⏳ Requiere Aprobación (Pedidos)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1 ${
                        cajaMostrador.permisos?.abonar 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {cajaMostrador.permisos?.abonar ? '✓ Abonos Permitidos' : '✕ Abonos Bloqueados'}
                      </span>
                      <span className="bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1">
                        ✓ Multivendedor
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {!modoCrearColaborador ? (
              <div className="flex flex-col gap-4">
                {colaboradoresRegistrados.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/60">No tienes colaboradores registrados.</p>
                ) : (
                  mostrarColaboradores && colaboradoresRegistrados.map((c: any, i: number) => {
                    const estaActivo = c.activo === true || c.activo === undefined;
                    const esGratis = planActual === 'gratis' || planActual === 'basico' || !planActual;

                    return (
                      <div key={i} className={`flex flex-col p-5 rounded-2xl border gap-3 animate-in fade-in slide-in-from-top-2 transition-all ${
                        esGratis 
                          ? 'bg-slate-50/70 dark:bg-[#020617]/50 border-slate-200/60 dark:border-slate-800/60 opacity-75' 
                          : estaActivo 
                            ? 'bg-slate-50 dark:bg-[#020617] border-slate-200 dark:border-slate-800' 
                            : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-70'
                      }`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{c.nombreUsuario}</p>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                esGratis 
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                  : estaActivo 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {esGratis ? 'Bloqueado (Plan Gratis)' : (estaActivo ? 'Activo' : 'Inactivo')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[11px] font-bold text-slate-400">Usuario:</span>
                              <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-md">
                                {c.usuarioAcceso || c.email?.split('@')[0]}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => { 
                              setColaboradorEnEdicion(c); 
                              setFormColaborador({
                                nombre: c.nombreUsuario, 
                                usuarioAcceso: c.usuarioAcceso || c.email?.split('@')[0], 
                                password: '', 
                                confirmPassword: '', 
                                permisos: {
                                  verCelulares: c.permisos?.verCelulares || false, 
                                  verDirectorio: c.permisos?.verDirectorio || false, 
                                  verCartera: c.permisos?.verCartera || false, 
                                  verReportes: c.permisos?.verReportes || false,
                                  ventaDirecta: c.permisos?.ventaDirecta || false,
                                  abonar: c.permisos?.abonar || false,
                                  editarInventario: c.permisos?.editarInventario || false,
                                  ingresoInventario: c.permisos?.ingresoInventario || false,
                                  terminalMultivendedor: c.permisos?.terminalMultivendedor || false,
                                  modificarPrecios: c.permisos?.modificarPrecios || false,
                                  aplicarDescuentos: c.permisos?.aplicarDescuentos || false,
                                  planSepare: c.permisos?.planSepare ?? false,
                                  enviarWhatsApp: c.permisos?.enviarWhatsApp === true
                                }
                              }); 
                              setModoCrearColaborador(true); 
                            }} title="Editar Permisos" className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer">
                              <Edit2 size={18} className="text-slate-500 shrink-0" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => { 
                                setNuevaPassReset(""); 
                                setConfirmarPassReset("");
                                setErrorResetPass(""); 
                                setModalResetPass({ visible: true, colaborador: c }); 
                              }} 
                              title="Restablecer Contraseña" 
                              className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-colors shadow-xs cursor-pointer"
                            >
                              <KeyRound size={18} className="shrink-0" />
                            </button>
                            <button onClick={() => { setColabParaHorarios(c); setModalHorariosOpen(true); }} title="Horarios" className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer">
                              <Clock size={18} className="text-slate-600" />
                            </button>
                            <button onClick={() => setModalEliminarColaborador({ visible: true, colaborador: c })} title="Eliminar Colaborador" className="bg-white dark:bg-[#0f172a] p-2.5 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors shadow-xs cursor-pointer">
                              <Trash2 size={18} className="text-rose-500 shrink-0" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={!esGratis && estaActivo} 
                              onChange={() => toggleEstadoColaborador(c)} 
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                          </label>
                          <span className={`text-sm font-bold ${!esGratis && estaActivo ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                            {!esGratis && estaActivo ? 'Acceso Habilitado' : 'Acceso Inactivo / Bloqueado'}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-1 border-t border-slate-200 dark:border-slate-800 pt-3">
                          {c.horariosActividad && c.horariosActividad.length > 0 ? (
                            <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-200/60 dark:border-blue-500/30">
                              <Clock size={11} className="text-blue-500 shrink-0" />
                              <span>
                                {c.horariosActividad[0]?.dias?.length === 7 
                                  ? 'Todos los días' 
                                  : (c.horariosActividad[0]?.dias?.length === 5 && !c.horariosActividad[0]?.dias?.includes('Sab') && !c.horariosActividad[0]?.dias?.includes('Dom'))
                                    ? 'Lun-Vie'
                                    : c.horariosActividad[0]?.dias?.join(', ')} 
                                {' '}({c.horariosActividad[0]?.inicio} - {c.horariosActividad[0]?.fin})
                                {c.horariosActividad.length > 1 ? ` +${c.horariosActividad.length - 1}` : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Clock size={11} className="text-slate-400 shrink-0" /> Sin límite de horario
                            </span>
                          )}
                          {c.permisos?.ventaDirecta ? <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md">Venta directa</span> : <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-bold px-2 py-0.5 rounded-md">Solo Órdenes</span>}
                          {c.permisos?.modificarPrecios ? <span className="text-[10px] bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400 font-bold px-2 py-0.5 rounded-md">Editar Precios</span> : null}
                          {c.permisos?.aplicarDescuentos ? <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 font-bold px-2 py-0.5 rounded-md">Descuentos</span> : null}
                          {c.permisos?.abonar ? <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md">Abonar</span> : null}
                          {c.permisos?.ingresoInventario ? <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-md">Ingresar</span> : null}
                          {c.permisos?.editarInventario ? <span className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400 font-bold px-2 py-0.5 rounded-md">Editar Inv.</span> : null}
                          {c.permisos?.planSepare ? <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 font-bold px-2 py-0.5 rounded-md">Separes</span> : null}
                          {c.permisos?.hacerDevoluciones ? <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-bold px-2 py-0.5 rounded-md">Devoluciones</span> : null}
                        </div>
                      </div>
                    );
                  })
                )}

                <button 
                  onClick={() => { 
                    const esGratis = planActual === 'gratis' || planActual === 'basico' || !planActual;
                    const esComercio = planActual === 'comercio';
                    const esPro = planActual === 'pro';

                    if (esGratis) {
                      setPlanInicialSuscripcion('comercio');
                      setModalSuscripcionOpen(true);
                      toast.error("El Plan Gratis no incluye colaboradores. Mejora al Plan Comercio para agregar a tu primer colaborador.");
                      return;
                    }
                    if (esComercio && colaboradoresRegistrados.length >= 1) {
                      setPlanInicialSuscripcion('pro');
                      setModalSuscripcionOpen(true);
                      toast.error("Tu Plan Comercio permite 1 colaborador. Mejora al Plan PRO Almacén para tener hasta 4 colaboradores.");
                      return;
                    }
                    if (esPro && colaboradoresRegistrados.length >= 4) {
                      setModalAvisoColaborador({ 
                        visible: true, 
                        titulo: "Límite Alcanzado", 
                        mensaje: "Tu Plan PRO Almacén permite un máximo de 4 colaboradores simultáneos para tu negocio.", 
                        icono: 'error' 
                      });
                      return;
                    }
                    setFormColaborador({
                      nombre: "", 
                      usuarioAcceso: "", 
                      password: "", 
                      confirmPassword: "", 
                      permisos: {
                        verCelulares: false, 
                        verDirectorio: false, 
                        verCartera: false, 
                        verReportes: false, 
                        ventaDirecta: false, 
                        abonar: false, 
                        editarInventario: false, ingresoInventario: false, 
                        terminalMultivendedor: false, 
                        modificarPrecios: false, 
                        aplicarDescuentos: false, 
                        planSepare: false
                      }
                    }); 
                    setColaboradorEnEdicion(null); 
                    setModoCrearColaborador(true); 
                  }} 
                  className="w-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold py-5 rounded-2xl border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors flex justify-center items-center gap-2 text-lg cursor-pointer"
                >
                  <UserPlus size={22} className="shrink-0"/> Agregar Colaborador
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-in fade-in">
                {!colaboradorEnEdicion && (
                  <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-relaxed flex items-start gap-2.5">
                      <Info size={20} className="shrink-0 text-blue-600 mt-0.5"/>
                      <span>
                        Solo ingresa el usuario de tu empleado (Ej: <strong>carlos</strong>). 
                        El sistema le asignará automáticamente el identificador de tu negocio: 
                        <strong className="text-blue-700 dark:text-blue-300 font-mono block mt-1">
                          {limpiarUsuarioColaborador(formColaborador.usuarioAcceso || 'carlos')}-{slugNegocio}
                        </strong>
                      </span>
                    </p>
                  </div>
                )}
                <input type="text" value={formColaborador.nombre} onChange={e => {setFormColaborador({...formColaborador, nombre: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} placeholder="Nombre de la persona (Ej: Carlos)" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" />
                
                {!colaboradorEnEdicion ? (
                  <>
                    <div>
                      <input 
                        type="text" 
                        value={formColaborador.usuarioAcceso} 
                        onChange={e => {setFormColaborador({...formColaborador, usuarioAcceso: e.target.value}); setErrorFormColaborador({...errorFormColaborador, usuarioAcceso:""})}} 
                        placeholder="Usuario de acceso (Ej: carlos o caja1)" 
                        className={`w-full p-4 bg-slate-50 dark:bg-[#020617] border rounded-xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${errorFormColaborador.usuarioAcceso ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500'}`} 
                      />
                      <div className="flex items-center gap-1.5 mt-2 ml-1 text-xs">
                        <span className="text-slate-500">Ingresará con el usuario:</span>
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-500/20 px-2 py-0.5 rounded-md">
                          {limpiarUsuarioColaborador(formColaborador.usuarioAcceso || 'usuario')}-{slugNegocio}
                        </span>
                      </div>
                      {errorFormColaborador.usuarioAcceso && <p className="text-rose-500 text-xs font-bold mt-1.5 ml-2">{errorFormColaborador.usuarioAcceso}</p>}
                    </div>
                    <div className="relative">
                      <input 
                        type={verPassColab ? "text" : "password"} 
                        value={formColaborador.password} 
                        onChange={e => {setFormColaborador({...formColaborador, password: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} 
                        placeholder="Contraseña (Mínimo 6 caracteres)" 
                        className="w-full p-4 pr-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setVerPassColab(!verPassColab)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                        {verPassColab ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <div className="relative">
                      <input 
                        type={verConfirmPassColab ? "text" : "password"} 
                        value={formColaborador.confirmPassword} 
                        onChange={e => {setFormColaborador({...formColaborador, confirmPassword: e.target.value}); setErrorFormColaborador({...errorFormColaborador, general:""})}} 
                        placeholder="Confirmar Contraseña" 
                        className="w-full p-4 pr-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-blue-500 font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400" 
                      />
                      <button 
                        type="button" 
                        onClick={() => setVerConfirmPassColab(!verConfirmPassColab)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                        {verConfirmPassColab ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-100 dark:bg-[#020617] p-5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Usuario de acceso:</p>
                    <p className="text-lg font-mono font-black text-slate-800 dark:text-slate-200 mb-3 break-all">
                      {colaboradorEnEdicion.usuarioAcceso || colaboradorEnEdicion.email?.split('@')[0]}
                    </p>
                    
                    <button 
                      type="button"
                      onClick={() => {
                        setNuevaPassReset("");
                        setConfirmarPassReset("");
                        setErrorResetPass("");
                        setModalResetPass({ visible: true, colaborador: colaboradorEnEdicion });
                      }} 
                      className="text-sm font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20 w-full mb-1 cursor-pointer flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                    >
                      <KeyRound size={16} className="shrink-0 text-amber-600" />
                      Restablecer Contraseña de este Colaborador
                    </button>
                    <p className="text-[10px] text-slate-400 text-center leading-tight mt-1.5">
                      Puedes cambiar la contraseña si el colaborador la olvidó, sin necesidad de eliminarlo.
                    </p>
                  </div>
                )}
                
                {errorFormColaborador.general && (
                  <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-base font-bold text-center border border-rose-200 dark:border-rose-500/20">
                    {errorFormColaborador.general}
                  </div>
                )}
                
                {/* Permisos */}
                <div className="flex flex-col gap-4 mt-2 mb-2 bg-slate-50 dark:bg-[#020617] p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-base font-black text-slate-800 dark:text-slate-200">Permisos del Colaborador:</p>
                    <p className="text-xs text-slate-400 mt-0.5">Controla qué acciones y secciones puede ejecutar este usuario.</p>
                  </div>

                  {/* BLOQUE 1: COBROS Y VENTAS */}
                  <div className="bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <CreditCard size={16} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Cobros y Ventas
                      </span>
                    </div>

                    {/* Venta Directa */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.ventaDirecta} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, ventaDirecta: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          Cierre Directo de Ventas y Fiados
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          {formColaborador.permisos.ventaDirecta 
                            ? "Cobro autónomo: Factura y finaliza ventas o fiados de una vez." 
                            : "Modo Toma-Pedidos: Solo envía órdenes pendientes para tu aprobación y cobro."}
                        </span>
                      </div>
                    </label>

                    {/* Abonar */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.abonar} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, abonar: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          Registrar Abonos a Deudas
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Permite recibir pagos y abonar dinero a cuentas por cobrar. (Si está desactivado, el botón no se mostrará).
                        </span>
                      </div>
                    </label>

                    {/* Plan Separe - EXCLUSIVO PRO */}
                    <div 
                      className={`p-2.5 rounded-xl border transition-all ${
                        planActual !== 'pro' 
                          ? 'bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 cursor-pointer' 
                          : 'bg-transparent border-transparent p-0'
                      }`}
                      onClick={() => {
                        if (planActual !== 'pro') {
                          setPlanInicialSuscripcion('pro');
                          setModalSuscripcionOpen(true);
                          toast.error("El Plan Separe es exclusivo del Plan PRO Almacén.");
                        }
                      }}
                    >
                      <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input 
                          type="checkbox" 
                          disabled={planActual !== 'pro'}
                          className="w-5 h-5 mt-0.5 accent-violet-600 shrink-0 cursor-pointer" 
                          checked={planActual === 'pro' && (formColaborador.permisos.planSepare ?? false)} 
                          onChange={e => {
                            if (planActual !== 'pro') return;
                            setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, planSepare: e.target.checked}});
                          }}
                        /> 
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">Plan Separe (Apartados)</span>
                            {planActual !== 'pro' && (
                              <span className="bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-500/30 inline-flex items-center gap-1">
                                <Crown size={11} className="fill-current" /> Solo PRO
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 block mt-0.5">Permite apartar mercancía de clientes y registrar abonos a planes separe.</span>
                        </div>
                      </label>
                    </div>

                    {/* Aplicar Descuentos Comerciales */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.aplicarDescuentos} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, aplicarDescuentos: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Aplicar Descuentos Comerciales</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite otorgar rebajas en porcentaje o monto fijo a las ventas.</span>
                      </div>
                    </label>
                  </div>

                  {/* BLOQUE 2: CATÁLOGO Y PRECIOS */}
                  <div className="bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <Package size={16} className="text-teal-600 dark:text-teal-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Catálogo y Precios
                      </span>
                    </div>

                    {/* Modificar Precios de Inventario */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.modificarPrecios} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, modificarPrecios: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Modificar Precios al Vender</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Si está desactivado, el colaborador no podrá alterar los precios de venta en inventario.</span>
                      </div>
                    </label>

                    {/* Editar Inventario */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.editarInventario} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, editarInventario: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Crear y Editar Productos</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite crear nuevos productos y ajustar existencias de stock.</span>
                      </div>
                    </label>
                  </div>

                  {/* BLOQUE 3: CLIENTES Y PRIVACIDAD */}
                  <div className="bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Clientes y Privacidad
                      </span>
                    </div>

                    {/* Clientes y Cartera */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.verCartera || false} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verCartera: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Acceso a Clientes y Cartera</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite ingresar al módulo de Clientes y Cartera, ver la cartera total fiada en la calle, semáforo de riesgo y cobranza.</span>
                      </div>
                    </label>

                    {/* Directorio en Inicio */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.verDirectorio} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verDirectorio: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Directorio de Clientes en Inicio</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite abrir la libreta de contactos en la pantalla de inicio para consultar fichas básicas o registrar nuevos clientes.</span>
                      </div>
                    </label>

                    {/* Celulares */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.verCelulares} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verCelulares: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Ver Números de Celular / Teléfono</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite visualizar los números completos de contacto de clientes.</span>
                      </div>
                    </label>

                    {/* Hacer Devoluciones */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-amber-500 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.hacerDevoluciones || false} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, hacerDevoluciones: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block text-amber-600 dark:text-amber-400">Procesar Devoluciones</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite reversar ventas y fiados, restando dinero de la caja (Nivel Alto).</span>
                      </div>
                    </label>

                    {/* Enviar WhatsApp */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.enviarWhatsApp ?? false} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, enviarWhatsApp: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Enviar Comprobantes por WhatsApp</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Si está desactivado, el botón de WhatsApp no aparecerá en su dispositivo para proteger su número personal y evitar que los clientes guarden su teléfono propio.</span>
                      </div>
                    </label>
                  </div>

                  {/* BLOQUE 4: SEGURIDAD FINANCIERA */}
                  <div className="bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <Shield size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Seguridad y Reportes
                      </span>
                    </div>

                    {/* Reportes */}
                    <label className="flex items-start gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 accent-blue-600 shrink-0 cursor-pointer" 
                        checked={formColaborador.permisos.verReportes} 
                        onChange={e => setFormColaborador({...formColaborador, permisos: {...formColaborador.permisos, verReportes: e.target.checked}})}
                      /> 
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">Ver Estadísticas de Dinero y Ganancias</span>
                        <span className="text-xs text-slate-400 block mt-0.5">Permite acceso a reportes financieros, totales diarios y utilidades.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button onClick={() => { setModoCrearColaborador(false); setColaboradorEnEdicion(null); setErrorFormColaborador({usuarioAcceso:"", general:""}); }} className="bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl text-lg cursor-pointer">Cancelar</button>
                  <button onClick={guardarColaborador} disabled={creandoColaborador} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95 text-lg truncate cursor-pointer">{creandoColaborador ? '...' : (colaboradorEnEdicion ? 'Actualizar' : 'Guardar')}</button>
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

          {/* SECCIÓN DEDICADA: SUSCRIPCIÓN Y PLAN */}
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800/60 pb-4">
              <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sparkles size={20} className="text-blue-500 shrink-0"/> Suscripción y Facturación
              </h3>
              <button 
                onClick={() => setModalSuscripcionOpen(true)} 
                className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm font-black flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
              >
                Cambiar Plan
              </button>
            </div>

            {/* Tarjeta Visual del Plan Activo */}
            <div className={`p-6 rounded-2xl border transition-all ${
              planActual === 'pro'
                ? 'border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/70 via-indigo-50/30 to-purple-50/70 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-purple-950/20'
                : planActual === 'comercio'
                  ? 'border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 via-sky-50/30 to-blue-50/70 dark:from-blue-950/20 dark:via-sky-950/10 dark:to-blue-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617]'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      planActual === 'pro'
                        ? 'bg-purple-600 text-white'
                        : planActual === 'comercio'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}>
                      {planActual === 'pro' ? 'Plan PRO Almacén' : (planActual === 'comercio' ? 'Plan Comercio' : 'Plan Gratuito')}
                    </span>
                    {diasPro !== null && (
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        • Quedan {diasPro} días
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {planActual === 'pro'
                      ? 'Control total de tu almacén: Separes, Etiquetas QR, Excel y 4 colaboradores.'
                      : (planActual === 'comercio'
                        ? 'Ideal para tu tienda: Clientes e inventario ilimitados, Factura y 1 colaborador.'
                        : 'Plan de inicio: Hasta 15 clientes, 30 productos y 40 ventas/mes.')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(planActual === 'pro' || planActual === 'comercio') && (
                    <button
                      onClick={() => setModalCancelarPro(true)}
                      className="px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      Cancelar Suscripción
                    </button>
                  )}
                  <button
                    onClick={() => setModalSuscripcionOpen(true)}
                    className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition-transform active:scale-95 cursor-pointer ${
                      planActual === 'pro'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {planActual === 'pro' ? 'Renovar Plan' : 'Subir de Plan'}
                  </button>
                </div>
              </div>

              {/* Matriz de capacidades activas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800">
                <div className="text-center p-2 rounded-xl bg-white/80 dark:bg-[#0f172a]/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Clientes</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white">
                    {planActual === 'gratis' || planActual === 'basico' ? 'Hasta 15' : 'Ilimitados'}
                  </span>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/80 dark:bg-[#0f172a]/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Inventario</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white">
                    {planActual === 'gratis' || planActual === 'basico' ? 'Hasta 30' : 'Ilimitado'}
                  </span>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/80 dark:bg-[#0f172a]/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Colaboradores</span>
                  <span className="text-xs font-black text-slate-800 dark:text-white">
                    {planActual === 'pro' ? 'Hasta 4' : (planActual === 'comercio' ? '1 Incluido' : '0')}
                  </span>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/80 dark:bg-[#0f172a]/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Plan Separe</span>
                  <span className={`text-xs font-black ${planActual === 'pro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {planActual === 'pro' ? 'Habilitado' : 'Solo PRO'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PERFIL DEL NEGOCIO Y MARCA (EXPANDIBLE / RECOGIDO POR DEFECTO) */}
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800/60 transition-all">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/60 pb-4 cursor-pointer select-none" onClick={() => setMostrarPerfilNegocio(!mostrarPerfilNegocio)}>
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-blue-500 shrink-0"/>
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">Perfil del Negocio y Marca</h3>
                  {!mostrarPerfilNegocio && (
                    <p className="text-xs text-slate-400 font-medium">{nombreNegocio || "Configura los datos de tu empresa"}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMostrarPerfilNegocio(!mostrarPerfilNegocio); }}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {mostrarPerfilNegocio ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
              </div>

              <ModalHorarios 
                isOpen={modalHorariosOpen} 
                onClose={() => { 
                  setModalHorariosOpen(false); 
                  setColabParaHorarios(null); 
                  cargarListaColaboradores(adminId!); 
                }} 
                usuarioId={colabParaHorarios ? colabParaHorarios.id : ""} 
                nombreColaborador={colabParaHorarios ? colabParaHorarios.nombreUsuario : "Colaborador"}
                horariosIniciales={colabParaHorarios ? (colabParaHorarios.horariosActividad || []) : []} 
              />
            </div>
            
            {mostrarPerfilNegocio && (
              <div className="pt-6 animate-in fade-in duration-200">
                {modoEdicionPerfil ? (
                  <div className="flex flex-col gap-5">
                    
                    {/* SUBIDA Y CONTROL DE LOGO */}
                    <div className="bg-slate-50 dark:bg-[#020617] p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {logoNegocio ? (
                          <img src={logoNegocio} alt="Logo Negocio" className="w-full h-full object-contain p-1.5" />
                        ) : (
                          <ImageIcon className="text-slate-400" size={32} />
                        )}
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <h4 className="font-black text-slate-800 dark:text-slate-200 text-sm">Logo o Identificador del Negocio</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Se mostrará en la cabecera de las facturas térmicas y en tu perfil.</p>
                        <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={procesandoLogo}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2 px-4 rounded-xl flex items-center gap-1.5 transition-transform active:scale-95 shadow-sm cursor-pointer"
                          >
                            <Upload size={14} /> {logoNegocio ? "Cambiar Logo" : "Subir Logo"}
                          </button>
                          {logoNegocio && (
                            <button
                              type="button"
                              onClick={() => setLogoNegocio(null)}
                              className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Nombre del Negocio</label>
                        <input type="text" value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} placeholder="Ej. Tienda Doña Juana" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">NIT / RUT / Cédula</label>
                        <input type="text" value={nitNegocio} onChange={(e) => setNitNegocio(e.target.value)} placeholder="Ej. 901.234.567-8" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Dirección del Establecimiento</label>
                        <input type="text" value={direccionNegocio} onChange={(e) => setDireccionNegocio(e.target.value)} placeholder="Ej. Cra 15 # 45-20, Centro" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400" />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">WhatsApp / Teléfono Comercial</label>
                        <input type="tel" value={telefonoNegocio} onChange={(e) => setTelefonoNegocio(e.target.value)} placeholder="Ej. 3001234567" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400" />
                      </div>

                      {/* IDENTIFICADOR / CÓDIGO DEL NEGOCIO PARA COLABORADORES */}
                      <div className="md:col-span-2 bg-blue-50/60 dark:bg-blue-950/20 p-4 sm:p-5 rounded-2xl border border-blue-200/70 dark:border-blue-900/40">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <label className="block text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300">
                            Identificador del Negocio (Código para Colaboradores)
                          </label>
                          <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20 px-2.5 py-0.5 rounded-md self-start sm:self-auto">
                            ej: carlos-{limpiarUsuarioColaborador(slugNegocioEdicion || 'negocio')}
                          </span>
                        </div>
                        <input 
                          type="text" 
                          value={slugNegocioEdicion} 
                          onChange={(e) => {
                            setSlugNegocioEdicion(limpiarUsuarioColaborador(e.target.value).slice(0, 20));
                            setErrorSlug("");
                          }} 
                          placeholder="Ej. camellas, ofe, tienda1" 
                          className={`w-full p-4 bg-white dark:bg-[#020617] border rounded-xl outline-none transition-all font-mono font-bold text-base text-slate-900 dark:text-white placeholder-slate-400 ${errorSlug ? 'border-rose-500' : 'border-blue-200 dark:border-blue-800/80 focus:border-blue-500'}`} 
                        />
                        {errorSlug ? (
                          <p className="text-xs font-bold text-rose-500 mt-1.5">{errorSlug}</p>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                            💡 Puedes cambiar este código cuando quieras. Al guardar, <strong>todos tus colaboradores se sincronizan automáticamente</strong> a este nuevo código sin perder su contraseña ni su historial de ventas.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Mensaje de Despedida en el Recibo (Opcional)</label>
                      <input type="text" value={mensajePieTicket} onChange={(e) => setMensajePieTicket(e.target.value)} placeholder="Ej. ¡Gracias por su compra! Vuelva pronto." className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400" />
                    </div>

                    {/* CONFIGURACIÓN DE IVA / IMPUESTOS */}
                    <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Receipt size={16} className="text-blue-600 dark:text-blue-400" /> Cobrar / Desglosar IVA en Ventas
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Actívalo si tu negocio es responsable de IVA para desglosarlo en tus facturas.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={habilitarIva} 
                            onChange={(e) => setHabilitarIva(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {habilitarIva && (
                        <div className="pt-3 border-t border-blue-100 dark:border-blue-900/30 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Tarifa de IVA:</span>
                          {[19, 5, 8].map((tasa) => (
                            <button
                              key={tasa}
                              type="button"
                              onClick={() => setPorcentajeIva(tasa)}
                              className={`px-3 py-1 text-xs font-black rounded-xl transition-all cursor-pointer ${
                                porcentajeIva === tasa
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {tasa}% {tasa === 8 ? '(Impoconsumo)' : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* INTERRUPTOR MÓDULO PLAN SEPARE */}
                    <div className="p-4 rounded-2xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Bookmark size={16} className="text-violet-600 dark:text-violet-400" /> Módulo Plan Separe (Apartados con Abonos)
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Muestra el acceso a Planes Separe en la pantalla de inicio y catálogos. Desactívalo si eres tienda de barrio y solo usas ventas y fiados.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            checked={moduloSepareActivo} 
                            onChange={(e) => setModuloSepareActivo(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Tu Nombre de Usuario</label>
                        <input type="text" value={editNombreUsuario} onChange={(e) => setEditNombreUsuario(e.target.value)} placeholder="Ej. Juan Pérez" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5"><Mail size={13}/> Correo Registrado (Solo lectura)</label>
                        <input type="email" value={correoNegocio} disabled className="w-full p-4 bg-slate-100 dark:bg-[#020617]/50 border border-slate-200 dark:border-slate-800/50 rounded-2xl text-slate-500 dark:text-slate-400 cursor-not-allowed font-medium text-base" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <button onClick={() => setModoEdicionPerfil(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl transition-colors border dark:border-slate-800/80 text-base cursor-pointer">Cancelar</button>
                      <button onClick={guardarDatosPerfil} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 text-base cursor-pointer">Guardar Cambios</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Building2 size={13} className="text-blue-500" /> Negocio</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{nombreNegocio}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Receipt size={13} className="text-blue-500" /> NIT / RUT</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{nitNegocio || "No registrado"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><MapPin size={13} className="text-blue-500" /> Dirección</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{direccionNegocio || "No registrada"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><PhoneCall size={13} className="text-blue-500" /> WhatsApp / Teléfono</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{telefonoNegocio || "No registrado"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><UserCog size={13} className="text-blue-500" /> Administrador</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{nombreUsuario}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Receipt size={13} className="text-blue-500" /> Impuestos / IVA</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-base truncate">
                          {habilitarIva ? `Activo (${porcentajeIva}%)` : "Precios finales (Sin IVA)"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Bookmark size={13} className="text-violet-500" /> Plan Separe</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-base truncate">
                          {moduloSepareActivo ? "Habilitado en Inicio" : "Oculto en Inicio"}
                        </p>
                      </div>
                      <div className="min-w-0 md:col-span-2 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Store size={14} className="text-blue-600 dark:text-blue-400" /> Código de tu Negocio para Colaboradores
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tus empleados ingresan escribiendo su usuario seguido de este código (ej: <strong>carlos-{slugNegocioActual}</strong>).</p>
                        </div>
                        <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-300 bg-white dark:bg-[#020617] px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 shadow-xs self-start sm:self-auto">
                          {slugNegocioActual}
                        </span>
                      </div>

                      <div className="min-w-0 md:col-span-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Receipt size={13} className="text-blue-500" /> Pie de Ticket</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 text-base truncate">{mensajePieTicket || "¡GRACIAS POR SU COMPRA!"}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button 
                        type="button"
                        onClick={() => { setEditNombreUsuario(nombreUsuario); setModoEdicionPerfil(true); }}
                        className="text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        <Edit2 size={14}/> Editar Datos del Negocio
                      </button>
                    </div>
                  </div>
                )}
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
            
            {(() => {
              const esCuentaGoogle = usuarioAuth?.providerData?.some(p => p.providerId === 'google.com');

              if (esCuentaGoogle) {
                return (
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-3">
                    <div className="bg-white p-3 rounded-full shadow-sm">
                      <svg width="24" height="24" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      </svg>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">
                      Tu cuenta está vinculada a <strong>Google</strong>. Por razones de seguridad, el cambio de contraseña debe realizarse directamente desde los ajustes de tu cuenta de Google.
                    </p>
                  </div>
                );
              }

              return !cambiandoPass ? (
                <button onClick={() => setCambiandoPass(true)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-5 text-lg rounded-2xl transition-colors border dark:border-slate-800/80">Cambiar Contraseña</button>
              ) : (
                <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Contraseña Actual</label>
                    <div className="relative">
                      <input 
                        type={verPassAdminActual ? "text" : "password"} 
                        value={passwordData.actual} 
                        onChange={(e) => { setPasswordData({...passwordData, actual: e.target.value}); setPassErrores({...passErrores, actual: ""}); }} 
                        placeholder="Tu contraseña actual" 
                        className={`w-full p-5 pr-14 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${passErrores.actual ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400'}`} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setVerPassAdminActual(!verPassAdminActual)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                        {verPassAdminActual ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {passErrores.actual && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.actual}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Nueva Contraseña</label>
                    <div className="relative">
                      <input 
                        type={verPassAdminNueva ? "text" : "password"} 
                        value={passwordData.nueva} 
                        onChange={(e) => { setPasswordData({...passwordData, nueva: e.target.value}); setPassErrores({...passErrores, nueva: ""}); }} 
                        placeholder="Mínimo 6 caracteres" 
                        className={`w-full p-5 pr-14 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${passErrores.nueva ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400'}`} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setVerPassAdminNueva(!verPassAdminNueva)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                        {verPassAdminNueva ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    {passErrores.nueva && <p className="text-rose-500 dark:text-rose-400 text-sm mt-2 font-bold flex items-center gap-1"><AlertCircle size={14}/>{passErrores.nueva}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Confirmar Nueva Contraseña</label>
                    <div className="relative">
                      <input 
                        type={verPassAdminConfirmar ? "text" : "password"} 
                        value={passwordData.confirmar} 
                        onChange={(e) => { setPasswordData({...passwordData, confirmar: e.target.value}); setPassErrores({...passErrores, confirmar: ""}); }} 
                        placeholder="Repite la nueva contraseña" 
                        className={`w-full p-5 pr-14 bg-slate-50 dark:bg-[#020617] border rounded-2xl outline-none transition-all font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 ${passErrores.confirmar ? 'border-rose-500 dark:border-rose-500 text-rose-600' : 'border-slate-200 dark:border-slate-800/80 focus:border-blue-500 dark:focus:border-blue-400'}`} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setVerPassAdminConfirmar(!verPassAdminConfirmar)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                      >
                        {verPassAdminConfirmar ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
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
              );
            })()}
          </div>

          {/* TARJETA DE ESTADO O INSTALACIÓN DE LA APP */}
          {appInstalada ? (
            <div className="bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-500/30 rounded-[2rem] p-5 sm:p-6 shadow-sm mt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-emerald-900 dark:text-emerald-300 text-base">Fiabono App Instalada</h4>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">Estás disfrutando de la experiencia nativa en pantalla completa.</p>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-[2rem] p-6 shadow-sm mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0 mx-auto sm:mx-0">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">Instalar Fiabono en este dispositivo</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Accede sin abrir el navegador (Celular o Computador)</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('abrir-prompt-instalacion'));
                  setModalInstalarApp(true);
                }} 
                className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Smartphone size={16} /> Ver cómo instalar
              </button>
            </div>
          )}

          <button onClick={() => signOut(auth)} className="w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold py-5 sm:py-6 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30 transition-colors mb-4 sm:mb-6 flex justify-center items-center gap-2 text-lg mt-6">
            <LogOut size={24} className="shrink-0" /> Cerrar Sesión
          </button>

          {/* ENLACE DISCRETO DE PRIVACIDAD / ELIMINACIÓN DE CUENTA (LEY 1581) */}
          <div className="text-center pb-8 sm:pb-4 pt-2">
            <button
              type="button"
              onClick={() => {
                setTextoConfirmacionEliminar("");
                setErrorEliminarCuenta("");
                setModalEliminarCuenta(true);
              }}
              className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer hover:underline opacity-80 hover:opacity-100"
            >
              <ShieldAlert size={13} className="shrink-0" />
              <span>Privacidad de datos y eliminación de cuenta</span>
            </button>
          </div>
        </>
      )}

      {/* MODAL GUÍA DE INSTALACIÓN PASO A PASO */}
      {modalInstalarApp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[350] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 relative max-h-[90dvh] overflow-y-auto pb-8 sm:pb-8">
            <button 
              onClick={() => setModalInstalarApp(false)} 
              className="absolute top-4 right-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-full p-2 transition-colors cursor-pointer"
            >
              <X size={20}/>
            </button>

            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Smartphone size={28} />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1">
              Instalar Fiabono App
            </h3>
            <p className="text-xs text-slate-500 text-center mb-6">
              Sigue estos sencillos pasos para tener Fiabono instalado:
            </p>

            <div className="space-y-4">
              
              {/* Sección PC / Escritorio */}
              <div className="p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                  <span>💻 En Computador (Chrome / Edge)</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                    <span>Haz clic en los <strong>3 puntos (Menú)</strong> arriba a la derecha del navegador.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                    <span>Ve a <strong>&quot;Guardar y compartir&quot;</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                    <span>Selecciona <strong>&quot;Instalar página como aplicación...&quot;</strong></span>
                  </div>
                </div>
              </div>

              {/* Sección iPhone / iOS */}
              <div className="p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                  <span>🍎 En iPhone / iPad (Safari)</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                    <span>Toca el botón <ArrowUpFromLine size={13} className="inline text-blue-500 relative -top-0.5" /> <strong>Compartir</strong> en la barra de Safari.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                    <span>Desliza hacia abajo y selecciona <strong>&quot;Añadir a pantalla de inicio&quot;</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                    <span>Toca <strong>Añadir</strong>.</span>
                  </div>
                </div>
              </div>

              {/* Sección Android */}
              <div className="p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                  <span>🤖 En Android / Chrome</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pl-1">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                    <span>Toca los <strong>tres puntos (⋮)</strong> en la esquina superior de Chrome.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                    <span>Selecciona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Añadir a pantalla principal&quot;</strong>.</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setModalInstalarApp(false)} 
              className="w-full mt-6 py-3.5 bg-slate-900 dark:bg-slate-700 hover:bg-black text-white font-black text-sm rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
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
            
            <div className="relative mb-2">
              <input 
                type={verPassCancelarPro ? "text" : "password"} 
                value={passCancelarPro} 
                onChange={e => {setPassCancelarPro(e.target.value); setErrorCancelarPro("")}} 
                placeholder="Ingresa tu contraseña actual" 
                className="w-full p-4 pr-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-xl outline-none focus:border-rose-500 text-slate-900 dark:text-white placeholder-slate-400 font-bold text-lg" 
              />
              <button 
                type="button" 
                onClick={() => setVerPassCancelarPro(!verPassCancelarPro)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              >
                {verPassCancelarPro ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
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

      {/* MODAL PARA RESTABLECER CONTRASEÑA DE COLABORADOR (POR ADMIN) */}
      {modalResetPass.visible && modalResetPass.colaborador && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[320] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              Restablecer Clave
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Asigna una nueva contraseña para <strong className="text-slate-800 dark:text-slate-200">{modalResetPass.colaborador.nombreUsuario}</strong> ({modalResetPass.colaborador.usuarioAcceso || modalResetPass.colaborador.email?.split('@')[0]})
            </p>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={verPassReset ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres (ej: 123456)"
                    value={nuevaPassReset}
                    onChange={e => { setNuevaPassReset(e.target.value); setErrorResetPass(""); }}
                    className="w-full p-4 pr-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerPassReset(!verPassReset)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verPassReset ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={verConfirmPassReset ? "text" : "password"}
                    placeholder="Repite la nueva contraseña"
                    value={confirmarPassReset}
                    onChange={e => { setConfirmarPassReset(e.target.value); setErrorResetPass(""); }}
                    className="w-full p-4 pr-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 font-bold text-base text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerConfirmPassReset(!verConfirmPassReset)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verConfirmPassReset ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {errorResetPass && (
                <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-200 dark:border-rose-500/20">
                  {errorResetPass}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalResetPass({ visible: false, colaborador: null }); setNuevaPassReset(""); setErrorResetPass(""); }}
                  disabled={resettingPass}
                  className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-colors border dark:border-slate-800/80 text-sm cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarResetPassColaborador}
                  disabled={resettingPass}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-1.5 shadow-md text-sm cursor-pointer disabled:opacity-50"
                >
                  {resettingPass ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE COLABORADOR */}
      {modalEliminarColaborador.visible && modalEliminarColaborador.colaborador && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[300] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-rose-200 dark:border-rose-900/60 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              ¿Eliminar Colaborador?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              ¿Estás seguro de que deseas eliminar la cuenta de <strong className="text-slate-900 dark:text-white">{modalEliminarColaborador.colaborador.nombreUsuario}</strong> ({modalEliminarColaborador.colaborador.usuarioAcceso || modalEliminarColaborador.colaborador.email?.split('@')[0]})?
              <br /><br />
              <span className="text-xs text-rose-500 dark:text-rose-400 font-semibold block">
                Esta acción revocará su acceso de inmediato y liberará su usuario.
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setModalEliminarColaborador({ visible: false, colaborador: null })} 
                disabled={eliminandoColab}
                className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-colors border dark:border-slate-800/80 text-sm cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={ejecutarEliminarColaborador} 
                disabled={eliminandoColab} 
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center shadow-md text-sm cursor-pointer disabled:opacity-50"
              >
                {eliminandoColab ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACTIVAR TERMINAL DE CAJA MOSTRADOR */}
      {modalActivarCajaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[320] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-indigo-100 dark:border-indigo-900/60 text-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Monitor size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              Activar Caja Mostrador
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Tu tablet o computador del mostrador ingresará con este usuario:
            </p>

            <div className="bg-indigo-50/80 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 p-3 rounded-xl mb-4 font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm">
              caja-{slugNegocio}
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Contraseña para la Tablet</label>
                <div className="relative">
                  <input 
                    type={verPassCajaInicial ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={passCajaInicial}
                    onChange={e => { setPassCajaInicial(e.target.value); setErrorPassCaja(""); }}
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerPassCajaInicial(!verPassCajaInicial)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verPassCajaInicial ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Confirmar Contraseña</label>
                <div className="relative">
                  <input 
                    type={verConfirmPassCajaInicial ? "text" : "password"}
                    placeholder="Repite la contraseña"
                    value={confirmarPassCajaInicial}
                    onChange={e => { setConfirmarPassCajaInicial(e.target.value); setErrorPassCaja(""); }}
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerConfirmPassCajaInicial(!verConfirmPassCajaInicial)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verConfirmPassCajaInicial ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {errorPassCaja && (
                <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-200 dark:border-rose-500/20">
                  {errorPassCaja}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalActivarCajaOpen(false); setPassCajaInicial(""); setConfirmarPassCajaInicial(""); setErrorPassCaja(""); }}
                  disabled={guardandoCaja}
                  className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-colors border dark:border-slate-800/80 text-sm cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarActivarCajaMostrador}
                  disabled={guardandoCaja}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-1.5 shadow-md text-sm cursor-pointer disabled:opacity-50"
                >
                  {guardandoCaja ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Activar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR CLAVE DE CAJA MOSTRADOR */}
      {modalCambiarClaveCajaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[320] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800/60 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              Cambiar Clave de Caja
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Asigna una nueva clave para la tablet de mostrador (<strong>caja-{slugNegocio}</strong>).
            </p>

            <div className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={verNuevaClaveCaja ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={nuevaClaveCaja}
                    onChange={e => { setNuevaClaveCaja(e.target.value); setErrorCambiarClaveCaja(""); }}
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerNuevaClaveCaja(!verNuevaClaveCaja)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verNuevaClaveCaja ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input 
                    type={verConfirmarClaveCaja ? "text" : "password"}
                    placeholder="Repite la contraseña"
                    value={confirmarClaveCaja}
                    onChange={e => { setConfirmarClaveCaja(e.target.value); setErrorCambiarClaveCaja(""); }}
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-amber-500 font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setVerConfirmarClaveCaja(!verConfirmarClaveCaja)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  >
                    {verConfirmarClaveCaja ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {errorCambiarClaveCaja && (
                <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-lg border border-rose-200 dark:border-rose-500/20">
                  {errorCambiarClaveCaja}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalCambiarClaveCajaOpen(false); setNuevaClaveCaja(""); setConfirmarClaveCaja(""); setErrorCambiarClaveCaja(""); }}
                  disabled={guardandoClaveCaja}
                  className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-colors border dark:border-slate-800/80 text-sm cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarCambiarClaveCaja}
                  disabled={guardandoClaveCaja}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-1.5 shadow-md text-sm cursor-pointer disabled:opacity-50"
                >
                  {guardandoClaveCaja ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Guardar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR CAJA MOSTRADOR */}
      {modalEliminarCajaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[320] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-rose-200 dark:border-rose-900/60 text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
              ¿Eliminar Caja Mostrador?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Esta acción eliminará el acceso de la tablet con usuario <strong className="text-slate-900 dark:text-white">caja-{slugNegocio}</strong>.
              <br /><br />
              <span className="text-xs text-slate-400 block">
                Podrás volver a activarla en cualquier momento desde esta pantalla.
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setModalEliminarCajaOpen(false)} 
                disabled={eliminandoCaja}
                className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-colors border dark:border-slate-800/80 text-sm cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={ejecutarEliminarCaja} 
                disabled={eliminandoCaja} 
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center shadow-md text-sm cursor-pointer disabled:opacity-50"
              >
                {eliminandoCaja ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN DE PERMISOS CAJA MOSTRADOR */}
      {modalPermisosCajaOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[320] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-7 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-indigo-100 dark:border-indigo-900/60 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Shield size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Permisos de Caja Mostrador
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Terminal compartida (<span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{cajaMostrador?.usuarioAcceso || `caja-${slugNegocioActual}`}</span>)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPermisosCajaOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Lista de permisos con scroll */}
            <div className="overflow-y-auto pr-1 py-4 space-y-4 custom-scrollbar text-left text-sm">
              
              {/* Alerta explicativa */}
              <div className="bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 p-3.5 rounded-2xl flex items-start gap-2.5">
                <Info size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                  Configura qué operaciones puede ejecutar la tablet o PC fija del mostrador. Esta terminal opera automáticamente como <strong>Punto de Venta Multivendedor</strong>.
                </p>
              </div>

              {/* BLOQUE 1: COBROS Y VENTAS */}
              <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                  <CreditCard size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Cobros y Ventas
                  </span>
                </div>

                {/* Modo de Operación (Venta Directa) con Card destacada */}
                <div className="p-3 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800/80">
                  <label className="flex items-start justify-between gap-3 cursor-pointer">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          Cierre Directo en Caja
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          permisosCajaEdicion.ventaDirecta
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}>
                          {permisosCajaEdicion.ventaDirecta ? '🟢 Cobro Inmediato' : '🟠 Modo Pedidos'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {permisosCajaEdicion.ventaDirecta 
                          ? "La terminal factura, cobra y entrega recibos directamente sin requerir aprobación." 
                          : "La terminal solo enviará ventas y fiados a tu panel de Órdenes para tu confirmación y cobro."}
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 mt-1 accent-indigo-600 shrink-0 cursor-pointer" 
                      checked={permisosCajaEdicion.ventaDirecta} 
                      onChange={e => setPermisosCajaEdicion(p => ({ ...p, ventaDirecta: e.target.checked }))}
                    />
                  </label>
                </div>

                {/* Registrar Abonos */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.abonar} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, abonar: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Registrar Abonos a Deudas
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite recibir pagos y abonar dinero a cuentas por cobrar desde la tablet.
                    </span>
                  </div>
                </label>

                {/* Plan Separe */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.planSepare} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, planSepare: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Gestionar Planes Separe (Apartados)
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite apartar productos y registrar cuotas o abonos de separe en la terminal.
                    </span>
                  </div>
                </label>

                {/* Aplicar Descuentos */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.aplicarDescuentos} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, aplicarDescuentos: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Aplicar Descuentos Comerciales
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite otorgar rebajas en porcentaje o monto fijo al momento de la venta.
                    </span>
                  </div>
                </label>
              </div>

              {/* BLOQUE 2: CATÁLOGO Y PRECIOS */}
              <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                  <Package size={16} className="text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Catálogo y Precios
                  </span>
                </div>

                {/* Modificar Precios */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.modificarPrecios} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, modificarPrecios: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Modificar Precios al Vender
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite cambiar el precio de venta unitario de los productos al facturar.
                    </span>
                  </div>
                </label>

                {/* Editar Inventario */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.editarInventario} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, editarInventario: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Crear y Editar Productos en Inventario
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite dar de alta nuevos productos o actualizar existencias desde la terminal.
                    </span>
                  </div>
                </label>
              </div>

              {/* BLOQUE 3: CLIENTES Y PRIVACIDAD */}
              <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                  <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Clientes y Privacidad
                  </span>
                </div>

                {/* Ver Clientes y Cartera */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.verCartera === true} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, verCartera: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Acceso al Módulo Clientes y Cartera
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite ingresar al módulo de Clientes y Cartera, ver cartera total en calle, dinero en riesgo y cobranza.
                    </span>
                  </div>
                </label>

                {/* Ver Directorio de Clientes en Inicio */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.verDirectorio === true} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, verDirectorio: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Directorio de Clientes en Inicio
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite abrir la libreta de contactos en la pantalla de inicio para consultar fichas o agregar nuevos clientes.
                    </span>
                  </div>
                </label>

                {/* Ver Celulares */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.verCelulares} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, verCelulares: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Ver Teléfonos y Celulares de Clientes
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite visualizar los teléfonos de los clientes para llamadas o WhatsApp.
                    </span>
                  </div>
                </label>

                  {/* Hacer Devoluciones */}
                  <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 mt-0.5 accent-amber-500 shrink-0 cursor-pointer" 
                      checked={permisosCajaEdicion.hacerDevoluciones || false} 
                      onChange={e => setPermisosCajaEdicion(p => ({ ...p, hacerDevoluciones: e.target.checked }))}
                    />
                    <div>
                      <span className="font-bold text-amber-600 dark:text-amber-400 block text-xs sm:text-sm">
                        Procesar Devoluciones (Restar Dinero)
                      </span>
                    </div>
                  </label>

                  {/* Enviar WhatsApp */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.enviarWhatsApp !== false} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, enviarWhatsApp: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Enviar Comprobantes por WhatsApp
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Permite enviar facturas y recibos de venta directamente a los clientes desde esta terminal.
                    </span>
                  </div>
                </label>
              </div>

              {/* BLOQUE 4: SEGURIDAD FINANCIERA */}
              <div className="bg-slate-50 dark:bg-[#020617] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
                  <Shield size={16} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Seguridad y Reportes
                  </span>
                </div>

                {/* Ver Reportes */}
                <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white dark:hover:bg-[#0f172a] cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 mt-0.5 accent-amber-600 shrink-0 cursor-pointer" 
                    checked={permisosCajaEdicion.verReportes === true} 
                    onChange={e => setPermisosCajaEdicion(p => ({ ...p, verReportes: e.target.checked }))}
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs sm:text-sm">
                      Ver Estadísticas y Ganancias
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Da acceso al panel de Reportes (dinero total, ventas, deudas globales). Usa esto solo si el cajero es de tu total confianza.
                    </span>
                  </div>
                </label>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
              <button
                type="button"
                onClick={() => setModalPermisosCajaOpen(false)}
                disabled={guardandoPermisosCaja}
                className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 dark:hover:bg-[#1e293b] text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl transition-colors border dark:border-slate-800/80 text-sm cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarActualizarPermisosCaja}
                disabled={guardandoPermisosCaja}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-1.5 shadow-md text-sm cursor-pointer disabled:opacity-50"
              >
                {guardandoPermisosCaja ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Guardar Permisos
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}


      {/* MODAL ELIMINAR CUENTA Y DATOS (LEY 1581 / HABEAS DATA) */}
      {modalEliminarCuenta && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[350] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-rose-200 dark:border-rose-900/60 relative max-h-[90dvh] overflow-y-auto">
            <button 
              onClick={() => {
                if (!eliminandoCuenta) {
                  setModalEliminarCuenta(false);
                  setTextoConfirmacionEliminar("");
                  setErrorEliminarCuenta("");
                }
              }} 
              disabled={eliminandoCuenta}
              className="absolute top-4 right-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-full p-2 transition-colors cursor-pointer disabled:opacity-40"
            >
              <X size={20}/>
            </button>

            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={36} />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 text-center">
              Eliminar Cuenta y Todos los Datos
            </h3>
            
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center mb-4 leading-relaxed">
              En ejercicio de tus derechos bajo la <strong>Ley 1581 de 2012 (Habeas Data)</strong>, puedes solicitar la supresión total e irreversible de tu cuenta y toda la información asociada a tu negocio.
            </p>

            <div className="space-y-3 mb-5">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200/80 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-rose-900 dark:text-rose-200">
                  <AlertCircle size={15} className="shrink-0" />
                  Se borrarán de forma inmediata y definitiva:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Todos tus productos e inventario.</li>
                  <li>Tus clientes, cuentas por cobrar y fiados.</li>
                  <li>Tus planes separe e historial de ventas.</li>
                  <li>Accesos y usuarios de tus colaboradores.</li>
                  <li>Tu perfil y cuenta de acceso.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong className="block mb-1">⚠️ Advertencia sobre futuros registros:</strong>
                Si en el futuro decides volver a registrarte con este mismo correo o cuenta de Google, ingresarás como un <strong>negocio completamente nuevo desde cero</strong>. No encontrarás absolutamente nada de tu información anterior, ya que el borrado de la base de datos es definitivo e irrecuperable.
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Para confirmar, escribe exactamente: <span className="font-mono text-rose-600 dark:text-rose-400 select-all font-black">ELIMINAR DEFINITIVAMENTE</span>
              </label>
              <input 
                type="text"
                value={textoConfirmacionEliminar}
                onChange={(e) => {
                  setTextoConfirmacionEliminar(e.target.value);
                  if (errorEliminarCuenta) setErrorEliminarCuenta("");
                }}
                disabled={eliminandoCuenta}
                placeholder="ELIMINAR DEFINITIVAMENTE"
                className="w-full p-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500 font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400"
              />
              {errorEliminarCuenta && (
                <p className="text-rose-500 text-xs font-bold flex items-center gap-1">
                  <AlertCircle size={13} /> {errorEliminarCuenta}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => {
                  setModalEliminarCuenta(false);
                  setTextoConfirmacionEliminar("");
                  setErrorEliminarCuenta("");
                }}
                disabled={eliminandoCuenta}
                className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (textoConfirmacionEliminar.trim() === "ELIMINAR DEFINITIVAMENTE") {
                    setModalEliminarCuenta(false);
                    setModalConfirmacionFinalEliminar(true);
                  } else {
                    setErrorEliminarCuenta("Debes escribir exactamente la frase de confirmación.");
                  }
                }}
                disabled={textoConfirmacionEliminar.trim() !== "ELIMINAR DEFINITIVAMENTE"}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continuar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMACIÓN FINAL DE SEGURIDAD (ÚLTIMA OPORTUNIDAD) */}
      {modalConfirmacionFinalEliminar && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[400] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border-2 border-rose-500/80 relative text-center">
            <div className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/30 animate-pulse">
              <AlertTriangle size={32} />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">
              ¿Estás 100% seguro?
            </h3>

            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-3">
              Esta es tu última oportunidad para cancelar.
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Al presionar el botón rojo, <strong>se borrará de forma inmediata e irreversible toda la información de tu negocio</strong>. No hay vuelta atrás ni copias de seguridad recuperables.
            </p>

            <div className="space-y-3">
              <button 
                type="button"
                onClick={ejecutarEliminacionCuenta}
                disabled={eliminandoCuenta}
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {eliminandoCuenta ? (
                  <>Destruyendo datos permanentemente...</>
                ) : (
                  <><Trash2 size={16} /> Sí, borrar todo definitivamente</>
                )}
              </button>

              <button 
                type="button"
                onClick={() => {
                  if (!eliminandoCuenta) {
                    setModalConfirmacionFinalEliminar(false);
                    setTextoConfirmacionEliminar("");
                    setErrorEliminarCuenta("");
                  }
                }}
                disabled={eliminandoCuenta}
                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-2xl transition-colors cursor-pointer disabled:opacity-50"
              >
                No, conservar mi cuenta y datos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE Y ZOOM DE LOGO */}
      <ModalAjustarImagen
        isOpen={modalAjustarOpen}
        imagenSrc={imagenParaAjustar}
        onClose={() => {
          setModalAjustarOpen(false);
          setImagenParaAjustar(null);
        }}
        onAplicar={aplicarLogoRecortado}
      />
    </div>
  );
}