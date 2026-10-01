"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  collection, getDocs, query, where, updateDoc, doc, setDoc, deleteDoc, Timestamp, getCountFromServer 
} from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { customConfirm } from "@/utils/customConfirm";
import { 
  Crown, Search, Edit2, ShieldAlert, CheckCircle2, Ticket, X, Calendar, Plus, 
  Trash2, Power, Users, Phone, MessageCircle, TrendingUp, DollarSign, 
  AlertTriangle, Sparkles, FileText, Activity, RefreshCw, Send, 
  Store, Clock, ExternalLink, Check, UserCheck, Eye, ShieldCheck, ChevronRight,
  Sun, Moon, CreditCard, KeyRound, Smartphone, Building, User, Mail, Hash, UserX
} from 'lucide-react';

interface TelemetriaNegocio {
  productos: number;
  clientes: number;
  movimientos: number;
  auditado: boolean;
  cargando?: boolean;
}

interface MediosPagoMaster {
  nequi: string;
  llave: string;
  bancolombia: string;
  titular: string;
}

export default function MasterPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  
  // MODO CLARO / OSCURO OPCIONAL (Persistente en localStorage)
  const [modoOscuro, setModoOscuro] = useState(true);

  const [cargando, setCargando] = useState(true);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [bonos, setBonos] = useState<any[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  
  const [busqueda, setBusqueda] = useState("");
  const [tabActiva, setTabActiva] = useState<'usuarios' | 'bonos' | 'anuncios'>('usuarios');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'porVencer' | 'pro' | 'comercio' | 'gratis' | 'prueba' | 'vencidos' | 'recientes' | 'inactivos' | 'suspendidos'>('todos');

  // MEDIOS DE PAGO CONFIGURABLES (Nequi, Llave, Bancolombia)
  const [mediosPago, setMediosPago] = useState<MediosPagoMaster>({
    nequi: "3128018444",
    llave: "",
    bancolombia: "",
    titular: "Johan Escobar"
  });
  const [modalConfigPagos, setModalConfigPagos] = useState(false);
  const [guardandoMediosPago, setGuardandoMediosPago] = useState(false);

  // Telemetría en demanda para optimizar cuota de Firestore
  const [telemetriaMap, setTelemetriaMap] = useState<Record<string, TelemetriaNegocio>>({});

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

  // Modal CRM WhatsApp contextual
  const [modalWhatsApp, setModalWhatsApp] = useState<{
    visible: boolean;
    usuario: any | null;
    tipoPlantilla: 'bienvenida' | 'preventivo' | 'vencido' | 'pago' | 'inactivo' | 'personalizado';
    mensajeFinal: string;
  }>({
    visible: false,
    usuario: null,
    tipoPlantilla: 'bienvenida',
    mensajeFinal: ''
  });

  // Modal Notas Master
  const [modalNota, setModalNota] = useState<{ visible: boolean; usuario: any | null; texto: string; guardando: boolean }>({
    visible: false,
    usuario: null,
    texto: "",
    guardando: false
  });

  // Modal Restablecer Contraseña (Master)
  const [modalResetPass, setModalResetPass] = useState<{
    visible: boolean;
    usuario: any | null;
    linkGenerado: string;
    generando: boolean;
    enviandoCorreo: boolean;
    copiado: boolean;
    error: string | null;
    correoEnviado: boolean;
  }>({
    visible: false,
    usuario: null,
    linkGenerado: "",
    generando: false,
    enviandoCorreo: false,
    copiado: false,
    error: null,
    correoEnviado: false,
  });

  // Modal Eliminar Negocio Definitivamente (Purga en cascada)
  const [modalEliminar, setModalEliminar] = useState<{
    visible: boolean;
    usuario: any | null;
    confirmacionTexto: string;
    eliminando: boolean;
    error: string | null;
  }>({
    visible: false,
    usuario: null,
    confirmacionTexto: "",
    eliminando: false,
    error: null,
  });

  // Cargar preferencia de tema y medios de pago guardados al montar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const temaGuardado = localStorage.getItem('fiabono_master_tema');
      if (temaGuardado) {
        setModoOscuro(temaGuardado === 'dark');
      }

      const pagosGuardados = localStorage.getItem('fiabono_master_medios_pago');
      if (pagosGuardados) {
        try {
          const parsed = JSON.parse(pagosGuardados);
          setMediosPago(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    }
  }, []);

  const toggleTema = () => {
    const nuevo = !modoOscuro;
    setModoOscuro(nuevo);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fiabono_master_tema', nuevo ? 'dark' : 'light');
    }
  };

  useEffect(() => {
    // PROTECCIÓN ULTRA ESTRICTA: Solo el email de login real johanescobar1@gmail.com
    const emailLogin = auth.currentUser?.email?.toLowerCase().trim();
    const esMasterValido = (emailLogin === 'johanescobar1@gmail.com' || datosSesion?.datosUsuarioOriginales?.email?.toLowerCase().trim() === 'johanescobar1@gmail.com') && 
      datosSesion?.rol !== 'cajero' && 
      (datosSesion?.tipoUsuario === 'principal' || datosSesion?.tipoUsuario === undefined);

    if (datosSesion && !esMasterValido) {
      toast.error("Acceso restringido al Administrador General.");
      router.replace('/dashboard/inicio');
      return;
    }

    if (esMasterValido) {
      const sesionAny = datosSesion as any;
      if (sesionAny?.mediosPagoMaster) {
        setMediosPago(prev => ({ ...prev, ...sesionAny.mediosPagoMaster }));
      }
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

  // Guardar Medios de Pago
  const guardarMediosPago = async () => {
    setGuardandoMediosPago(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fiabono_master_medios_pago', JSON.stringify(mediosPago));
      }

      if (auth.currentUser?.uid) {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
          mediosPagoMaster: mediosPago
        });
      }

      toast.success("Medios de pago actualizados exitosamente.");
      setModalConfigPagos(false);

      if (modalWhatsApp.visible && modalWhatsApp.usuario && modalWhatsApp.tipoPlantilla === 'pago') {
        const nuevoTexto = construirMensajePago(
          modalWhatsApp.usuario.nombreNegocio || modalWhatsApp.usuario.nombreUsuario || 'tu negocio',
          modalWhatsApp.usuario.nombreUsuario || 'Comerciante',
          mediosPago
        );
        setModalWhatsApp(prev => ({ ...prev, mensajeFinal: nuevoTexto }));
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar medios de pago.");
    } finally {
      setGuardandoMediosPago(false);
    }
  };

  // Construir mensaje de pago filtrando estrictamente los métodos vacíos (SIN EMOJIS)
  const construirMensajePago = (negocio: string, nombre: string, medios: MediosPagoMaster): string => {
    const lineasPago: string[] = [];

    if (medios.nequi && medios.nequi.trim()) {
      lineasPago.push(`*Nequi:* ${medios.nequi.trim()}`);
    }
    if (medios.llave && medios.llave.trim()) {
      lineasPago.push(`*Llave:* ${medios.llave.trim()}`);
    }
    if (medios.bancolombia && medios.bancolombia.trim()) {
      lineasPago.push(`*Bancolombia:* ${medios.bancolombia.trim()}`);
    }

    if (lineasPago.length === 0) {
      return "";
    }

    const titularStr = medios.titular && medios.titular.trim() ? `\n*Titular:* ${medios.titular.trim()}` : "";
    return `Hola ${nombre}, aqui tienes los canales oficiales de Fiabono para renovar tu suscripcion en ${negocio}:\n\n${lineasPago.join('\n')}${titularStr}\n\nPor favor nos envias el comprobante por este medio para activarte de inmediato.`;
  };

  const tieneMediosDePagoValidos = useMemo(() => {
    return Boolean(mediosPago.nequi.trim() || mediosPago.llave.trim() || mediosPago.bancolombia.trim());
  }, [mediosPago]);

  const calcularDiasRestantes = (u: any): number => {
    if (u.plan === 'gratis' || !u.planVence) return -999;
    const timeVence = u.planVence?.toDate ? u.planVence.toDate().getTime() : new Date(u.planVence).getTime();
    if (isNaN(timeVence)) return -999;
    return Math.ceil((timeVence - new Date().getTime()) / (1000 * 3600 * 24));
  };

  // CALCULAR DÍAS DE INACTIVIDAD (Sin inicio de sesión o sin actividad en > 30 días)
  const calcularInactividad = (u: any) => {
    const ahora = new Date().getTime();
    const fechaRef = u.ultimoAcceso?.toDate ? u.ultimoAcceso.toDate().getTime() :
                    (u.ultimoAcceso ? new Date(u.ultimoAcceso).getTime() : 
                    (u.fechaRegistro?.toDate ? u.fechaRegistro.toDate().getTime() :
                    (u.createdAt?.toDate ? u.createdAt.toDate().getTime() : null)));

    if (!fechaRef) {
      return { esInactivo30d: true, dias: 999, texto: "Sin registro de acceso" };
    }

    const dias = Math.floor((ahora - fechaRef) / (1000 * 3600 * 24));
    return {
      esInactivo30d: dias >= 30,
      dias,
      texto: dias === 0 ? "Hoy" : (dias === 1 ? "Ayer" : `Hace ${dias} dias`)
    };
  };

  const calcularEstadoPlan = (u: any) => {
    if (u.plan === 'gratis' || !u.planVence) {
      return { 
        label: 'Gratis', 
        color: modoOscuro 
          ? 'bg-slate-800 text-slate-300 border border-slate-700' 
          : 'bg-slate-100 text-slate-700 border border-slate-200', 
        dias: -999 
      };
    }
    const daysLeft = calcularDiasRestantes(u);
    
    if (daysLeft < -2) {
      return { 
        label: 'Vencido', 
        color: modoOscuro 
          ? 'bg-rose-950/40 text-rose-400 border border-rose-800/60' 
          : 'bg-rose-50 text-rose-700 border border-rose-200', 
        dias: daysLeft 
      };
    }
    if (daysLeft <= 0) {
      return { 
        label: 'En Gracia', 
        color: modoOscuro 
          ? 'bg-amber-950/40 text-amber-400 border border-amber-700/60' 
          : 'bg-amber-50 text-amber-700 border border-amber-300', 
        dias: daysLeft 
      };
    }
    if (daysLeft <= 7) {
      return { 
        label: `Por Vencer (${daysLeft}d)`, 
        color: modoOscuro 
          ? 'bg-amber-950/60 text-amber-300 border border-amber-600 font-black animate-pulse' 
          : 'bg-amber-100 text-amber-900 border border-amber-400 font-black animate-pulse', 
        dias: daysLeft 
      };
    }
    return { 
      label: `Activo (${daysLeft}d)`, 
      color: modoOscuro 
        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60' 
        : 'bg-emerald-50 text-emerald-700 border border-emerald-200', 
      dias: daysLeft 
    };
  };

  const metricas = useMemo(() => {
    const total = usuarios.length;
    let activosPro = 0;
    let activosComercio = 0;
    let planesGratis = 0;
    let porVencer7d = 0;
    let enPrueba = 0;
    let vencidos = 0;
    let recientes7d = 0;
    let inactivos30d = 0;
    let suspendidos = 0;

    const ahora = new Date().getTime();
    const sieteDiasAtras = ahora - (7 * 24 * 3600 * 1000);

    usuarios.forEach(u => {
      const dias = calcularDiasRestantes(u);
      const esActivo = u.plan !== 'gratis' && dias > 0;
      const esGratis = u.plan === 'gratis' || !u.plan;

      if (u.activo === false || u.suspendido === true) {
        suspendidos++;
      }

      if (esGratis) {
        planesGratis++;
      }

      if (esActivo) {
        if (u.plan === 'pro') activosPro++;
        if (u.plan === 'comercio') activosComercio++;
        if (dias <= 7) porVencer7d++;
        if (dias <= 14 && (u.pruebaGratisUsada || !u.cicloPlan || u.cicloPlan === 'mensual')) {
          enPrueba++;
        }
      } else if (!esGratis) {
        // Estuvo en plan pago pero ya se venció
        vencidos++;
      }

      // Conteo de usuarios inactivos más de 30 días
      const infoInac = calcularInactividad(u);
      if (infoInac.esInactivo30d) {
        inactivos30d++;
      }

      const fechaCrea = u.fechaRegistro?.toDate ? u.fechaRegistro.toDate().getTime() : 
                        (u.createdAt?.toDate ? u.createdAt.toDate().getTime() : null);
      if (fechaCrea && fechaCrea >= sieteDiasAtras) {
        recientes7d++;
      }
    });

    const mrr = (activosComercio * 30000) + (activosPro * 50000);

    return {
      total,
      activosPro,
      activosComercio,
      totalActivos: activosPro + activosComercio,
      planesGratis,
      porVencer7d,
      enPrueba,
      vencidos,
      recientes7d,
      inactivos30d,
      suspendidos,
      mrr
    };
  }, [usuarios]);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const coincideBusqueda = !busqueda.trim() || 
        (u.nombreNegocio?.toLowerCase().includes(busqueda.toLowerCase()) || 
         u.nombreUsuario?.toLowerCase().includes(busqueda.toLowerCase()) || 
         u.email?.toLowerCase().includes(busqueda.toLowerCase()) || 
         u.telefonoNegocio?.includes(busqueda) ||
         u.celular?.includes(busqueda));

      if (!coincideBusqueda) return false;

      const dias = calcularDiasRestantes(u);
      const esActivo = u.plan !== 'gratis' && dias > 0;
      const esGratis = u.plan === 'gratis' || !u.plan;

      if (filtroEstado === 'todos') return true;
      if (filtroEstado === 'gratis') return esGratis;
      if (filtroEstado === 'suspendidos') return u.activo === false || u.suspendido === true;
      if (filtroEstado === 'porVencer') return esActivo && dias <= 7;
      if (filtroEstado === 'pro') return esActivo && u.plan === 'pro';
      if (filtroEstado === 'comercio') return esActivo && u.plan === 'comercio';
      if (filtroEstado === 'prueba') return esActivo && dias <= 14;
      if (filtroEstado === 'vencidos') return !esActivo && !esGratis;
      if (filtroEstado === 'inactivos') {
        const info = calcularInactividad(u);
        return info.esInactivo30d;
      }
      if (filtroEstado === 'recientes') {
        const ahora = new Date().getTime();
        const fechaCrea = u.fechaRegistro?.toDate ? u.fechaRegistro.toDate().getTime() : 
                          (u.createdAt?.toDate ? u.createdAt.toDate().getTime() : null);
        return fechaCrea && fechaCrea >= (ahora - 7 * 24 * 3600 * 1000);
      }
      return true;
    });
  }, [usuarios, busqueda, filtroEstado]);

  const auditarActividadTienda = async (usuarioId: string) => {
    setTelemetriaMap(prev => ({
      ...prev,
      [usuarioId]: { productos: 0, clientes: 0, movimientos: 0, auditado: false, cargando: true }
    }));

    try {
      const [snapInv, snapCli, snapMov] = await Promise.all([
        getCountFromServer(query(collection(db, "inventario"), where("usuarioId", "==", usuarioId))),
        getCountFromServer(query(collection(db, "clientes"), where("usuarioId", "==", usuarioId))),
        getCountFromServer(query(collection(db, "movimientos"), where("usuarioId", "==", usuarioId)))
      ]);

      const productos = snapInv.data().count;
      const clientes = snapCli.data().count;
      const movimientos = snapMov.data().count;

      setTelemetriaMap(prev => ({
        ...prev,
        [usuarioId]: {
          productos,
          clientes,
          movimientos,
          auditado: true,
          cargando: false
        }
      }));
      toast.success("Actividad auditada en tiempo real.");
    } catch (err) {
      console.error("Error al auditar tienda:", err);
      toast.error("No se pudo auditar la actividad de la tienda.");
      setTelemetriaMap(prev => ({
        ...prev,
        [usuarioId]: { productos: 0, clientes: 0, movimientos: 0, auditado: false, cargando: false }
      }));
    }
  };

  // EXTENSIÓN CON APROBACIÓN DE SEGURIDAD EXPLICITA (SIN EMOJIS)
  const autorizarExtensionSegura = async (u: any, diasAdicionales: number, planForzado?: 'comercio' | 'pro') => {
    const planFinal = planForzado || (u.plan === 'gratis' ? 'comercio' : (u.plan || 'comercio'));
    const nombreNeg = u.nombreNegocio || u.nombreUsuario || 'este negocio';
    const emailNeg = u.email || 'sin correo';

    let baseDate = new Date();
    if (u.planVence) {
      const timeVence = u.planVence.toDate ? u.planVence.toDate().getTime() : new Date(u.planVence).getTime();
      if (timeVence > baseDate.getTime()) {
        baseDate = new Date(timeVence);
      }
    }
    const nuevaFecha = new Date(baseDate);
    nuevaFecha.setDate(nuevaFecha.getDate() + Number(diasAdicionales));

    const fechaFormateada = nuevaFecha.toLocaleDateString('es-CO', { 
      day: '2-digit', month: 'long', year: 'numeric' 
    });

    const aprobado = await customConfirm(
      `[CONFIRMACION REQUERIDA DEL MASTER]\n\n` +
      `¿Confirmas otorgar +${diasAdicionales} DIAS a:\n\n` +
      `Negocio: "${nombreNeg}"\n` +
      `Correo: ${emailNeg}\n` +
      `Plan Asignado: ${planFinal.toUpperCase()}\n` +
      `Nueva Fecha de Vencimiento: ${fechaFormateada}\n\n` +
      `Presiona Confirmar para autorizar la extension en el sistema.`
    );

    if (!aprobado) {
      toast("Accion cancelada. No se modificaron dias.");
      return;
    }

    try {
      await updateDoc(doc(db, "usuarios", u.id), {
        plan: planFinal,
        planVence: nuevaFecha,
        cicloPlan: diasAdicionales >= 365 ? 'anual' : 'mensual'
      });
      toast.success(`+${diasAdicionales} dias acreditados exitosamente a ${nombreNeg}.`);
      cargarDatos();
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar la suscripcion.");
    }
  };

  const guardarCambioPlan = async () => {
    if (!modalPlan.usuario) return;
    const u = modalPlan.usuario;
    const nombreNeg = u.nombreNegocio || u.nombreUsuario || 'este negocio';
    
    if (formPlan.plan === 'gratis') {
      const confirmado = await customConfirm(
        `[ATENCION]: ¿Confirmas bajar a "${nombreNeg}" al PLAN GRATUITO?\n\n` +
        `- Se suspenderan sus colaboradores registrados.\n` +
        `- No tendra acceso a funciones PRO ni Comercio.`
      );
      if (!confirmado) return;

      try {
        await updateDoc(doc(db, "usuarios", u.id), {
          plan: 'gratis',
          planVence: null,
          cicloPlan: 'mensual'
        });

        const qCajeros = query(
          collection(db, "usuarios"),
          where("adminId", "==", u.id),
          where("rol", "==", "cajero")
        );
        const snapC = await getDocs(qCajeros);
        const batchDesact = snapC.docs.map(d =>
          updateDoc(doc(db, "usuarios", d.id), { activo: false })
        );
        await Promise.all(batchDesact);

        toast.success("Negocio pasado a plan gratuito.");
        setModalPlan({ visible: false, usuario: null });
        cargarDatos();
      } catch (e) {
        console.error(e);
        toast.error("Error al revocar plan.");
      }
    } else {
      await autorizarExtensionSegura(u, formPlan.dias, formPlan.plan);
      setModalPlan({ visible: false, usuario: null });
    }
  };

  const guardarNotaMaster = async () => {
    if (!modalNota.usuario) return;
    setModalNota(prev => ({ ...prev, guardando: true }));
    try {
      await updateDoc(doc(db, "usuarios", modalNota.usuario.id), {
        notasMaster: modalNota.texto.trim()
      });
      toast.success("Nota interna guardada.");
      setUsuarios(prev => prev.map(u => u.id === modalNota.usuario.id ? { ...u, notasMaster: modalNota.texto.trim() } : u));
      setModalNota({ visible: false, usuario: null, texto: "", guardando: false });
    } catch (e) {
      toast.error("Error al guardar nota.");
      setModalNota(prev => ({ ...prev, guardando: false }));
    }
  };

  // WhatsApp Contextual (SIN EMOJIS)
  const abrirModalWhatsApp = (u: any) => {
    const rawTel = u.telefonoNegocio || u.celular;
    if (!rawTel) {
      toast.error("Este negocio no tiene numero de telefono registrado.");
      return;
    }

    const nombre = u.nombreNegocio || u.nombreUsuario || 'Comerciante';
    const dias = calcularDiasRestantes(u);
    const planNombre = u.plan === 'pro' ? 'PRO Almacen' : (u.plan === 'comercio' ? 'Comercio' : 'Fiabono');
    const infoInac = calcularInactividad(u);

    let plantillaInicial: 'bienvenida' | 'preventivo' | 'vencido' | 'pago' | 'inactivo' | 'personalizado' = 'bienvenida';
    let textoInicial = "";

    if (infoInac.esInactivo30d) {
      plantillaInicial = 'inactivo';
      textoInicial = `Hola ${nombre}, te escribe Johan del equipo de Fiabono. Notamos que hace mas de un mes no ingresas a administrar tu cuenta en Fiabono. Te contacto para saber como ha estado tu negocio y si necesitas orientacion para organizar tus productos o tus cuentas por cobrar. Quedo muy atento si necesitas apoyo.`;
    } else if (dias > 0 && dias <= 7) {
      plantillaInicial = 'preventivo';
      textoInicial = `Hola ${nombre}, te escribe Johan del equipo de Fiabono. Te contacto para recordarte que a tu plan ${planNombre} le quedan ${dias} dias de acceso. Te comparto nuestros canales de renovacion para que tu negocio continue sin interrupciones con tus cajeros y reportes activos. Quedo atento.`;
    } else if (dias <= 0 && u.plan !== 'gratis') {
      plantillaInicial = 'vencido';
      textoInicial = `Hola ${nombre}, te escribe Johan de Fiabono. Notamos que tu acceso al plan ${planNombre} finalizo. Si deseas renovar hoy, te podemos obsequiar dias adicionales para que continues administrando tus ventas y abonos. ¿Deseas que te comparta los datos de pago?`;
    } else {
      plantillaInicial = 'bienvenida';
      textoInicial = `Hola ${nombre}, te escribe Johan del equipo de Fiabono. Vi que registraste tu negocio en nuestra plataforma. Te doy una cordial bienvenida. ¿Como te ha parecido la aplicacion? ¿Tienes alguna duda configurando tus productos o tu primer credito?`;
    }

    setModalWhatsApp({
      visible: true,
      usuario: u,
      tipoPlantilla: plantillaInicial,
      mensajeFinal: textoInicial
    });
  };

  const cambiarPlantillaWhatsApp = (tipo: 'bienvenida' | 'preventivo' | 'vencido' | 'pago' | 'inactivo' | 'personalizado') => {
    if (!modalWhatsApp.usuario) return;
    const u = modalWhatsApp.usuario;
    const nombre = u.nombreNegocio || u.nombreUsuario || 'Comerciante';
    const dias = Math.max(1, calcularDiasRestantes(u));
    const planNombre = u.plan === 'pro' ? 'PRO Almacen' : (u.plan === 'comercio' ? 'Comercio' : 'Fiabono');

    let nuevoTexto = "";
    if (tipo === 'bienvenida') {
      nuevoTexto = `Hola ${nombre}, te escribe Johan del equipo de Fiabono. Vi que registraste tu negocio en nuestra plataforma. Te doy una cordial bienvenida. ¿Como te ha parecido la aplicacion? ¿Tienes alguna duda configurando tus productos o tu primer credito?`;
    } else if (tipo === 'preventivo') {
      nuevoTexto = `Hola ${nombre}, te escribe Johan del equipo de Fiabono. Te contacto para recordarte que a tu plan ${planNombre} le quedan ${dias} dias de acceso. Te comparto nuestros canales de renovacion para que continues sin interrupciones con tus colaboradores y reportes. Quedo atento.`;
    } else if (tipo === 'vencido') {
      nuevoTexto = `Hola ${nombre}, te escribe Johan de Fiabono. Notamos que tu acceso en ${nombre} finalizo. Si deseas renovar hoy, te podemos obsequiar dias adicionales para que sigas facturando y controlando tus abonos. ¿Te comparto las opciones de pago?`;
    } else if (tipo === 'inactivo') {
      nuevoTexto = `Hola ${nombre}, te escribe Johan del equipo de Fiabono. Notamos que hace mas de un mes no ingresas a administrar tu cuenta en Fiabono. Te contacto para saber como ha estado tu negocio y si necesitas orientacion para organizar tus productos o tus cuentas por cobrar. Quedo muy atento si necesitas apoyo.`;
    } else if (tipo === 'pago') {
      nuevoTexto = construirMensajePago(u.nombreNegocio || nombre, nombre, mediosPago);
    } else {
      nuevoTexto = modalWhatsApp.mensajeFinal;
    }

    setModalWhatsApp(prev => ({
      ...prev,
      tipoPlantilla: tipo,
      mensajeFinal: nuevoTexto
    }));
  };

  const enviarWhatsAppFinal = () => {
    if (!modalWhatsApp.usuario) return;
    
    if (modalWhatsApp.tipoPlantilla === 'pago' && !tieneMediosDePagoValidos) {
      toast.error("Debes configurar al menos una opcion de pago (Nequi, Llave o Bancolombia) antes de enviar.");
      return;
    }

    const rawTel = modalWhatsApp.usuario.telefonoNegocio || modalWhatsApp.usuario.celular;
    const digitos = rawTel.toString().replace(/\D/g, '');
    const telLimpio = digitos.startsWith('57') && digitos.length > 10 ? digitos : `57${digitos}`;
    const url = `https://wa.me/${telLimpio}?text=${encodeURIComponent(modalWhatsApp.mensajeFinal)}`;
    window.open(url, '_blank');
    setModalWhatsApp(prev => ({ ...prev, visible: false }));
  };

  const abrirModalResetPass = (u: any) => {
    setModalResetPass({
      visible: true,
      usuario: u,
      linkGenerado: "",
      generando: false,
      enviandoCorreo: false,
      copiado: false,
      error: null,
      correoEnviado: false,
    });
  };

  const generarEnlaceReset = async () => {
    if (!modalResetPass.usuario?.email) return;
    setModalResetPass(prev => ({ ...prev, generando: true, error: null }));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Debes tener una sesión activa como Master.");

      const res = await fetch('/api/master/generar-link-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ email: modalResetPass.usuario.email })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo generar el enlace de recuperación.");
      }

      setModalResetPass(prev => ({
        ...prev,
        linkGenerado: data.link,
        generando: false
      }));
      toast.success("Enlace oficial de recuperación generado con éxito.");
    } catch (err: any) {
      setModalResetPass(prev => ({
        ...prev,
        error: err.message,
        generando: false
      }));
      toast.error(err.message || "Error al generar enlace.");
    }
  };

  const copiarEnlaceReset = () => {
    if (!modalResetPass.linkGenerado) return;
    navigator.clipboard.writeText(modalResetPass.linkGenerado);
    setModalResetPass(prev => ({ ...prev, copiado: true }));
    toast.success("Enlace copiado al portapapeles.");
    setTimeout(() => {
      setModalResetPass(prev => ({ ...prev, copiado: false }));
    }, 3000);
  };

  const enviarResetWhatsApp = () => {
    const u = modalResetPass.usuario;
    if (!u || !modalResetPass.linkGenerado) return;
    const rawTel = (u.telefonoNegocio || u.celular || "").toString().replace(/\D/g, '');
    const telLimpio = rawTel.startsWith('57') && rawTel.length > 10 ? rawTel : (rawTel ? `57${rawTel}` : '');
    const nombre = u.nombreNegocio || u.nombreUsuario || "Comerciante";
    const texto = `Hola ${nombre}, aquí tienes tu enlace oficial de Fiabono para restablecer tu contraseña:\n\n${modalResetPass.linkGenerado}\n\nAl hacer clic podrás ingresar tu nueva contraseña de forma segura e iniciar sesión de inmediato.`;

    const url = telLimpio ? `https://wa.me/${telLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  const enviarCorreoResetDirecto = async () => {
    if (!modalResetPass.usuario?.email) return;
    setModalResetPass(prev => ({ ...prev, enviandoCorreo: true, error: null }));
    try {
      try {
        const actionCodeSettings = {
          url: typeof window !== 'undefined' ? `${window.location.origin}/restablecer-clave` : 'https://fiabono.com/restablecer-clave',
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(auth, modalResetPass.usuario.email, actionCodeSettings);
      } catch (actionErr: any) {
        if (actionErr.code === 'auth/unauthorized-continue-uri') {
          await sendPasswordResetEmail(auth, modalResetPass.usuario.email);
        } else {
          throw actionErr;
        }
      }
      setModalResetPass(prev => ({ ...prev, enviandoCorreo: false, correoEnviado: true }));
      toast.success(`Correo oficial enviado a ${modalResetPass.usuario.email}`);
    } catch (err: any) {
      setModalResetPass(prev => ({ ...prev, enviandoCorreo: false, error: err.message }));
      toast.error(err.message || "Error al enviar correo de recuperación.");
    }
  };

  const crearBono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBono.codigo.trim()) return;
    
    const confirmado = await customConfirm(
      `¿Confirmas crear el codigo promocional "${formBono.codigo.trim().toUpperCase()}" con ${formBono.diasOtorgados} dias de plan ${formBono.planOtorgado.toUpperCase()}?`
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
      toast.success("Bono creado exitosamente.");
      setModalBono(false);
      setFormBono({ codigo: "", planOtorgado: "pro", diasOtorgados: 30, emailObjetivo: "", unSoloUso: true });
      cargarDatos();
    } catch (e) {
      toast.error("Error al crear bono.");
    }
  };

  const eliminarBono = async (id: string) => {
    if (await customConfirm(`¿Seguro que deseas ELIMINAR permanentemente el codigo "${id}"?`)) {
      await deleteDoc(doc(db, "codigos_promocionales", id));
      cargarDatos();
    }
  };

  const alternarBono = async (id: string, estadoActual: boolean) => {
    const accion = estadoActual ? 'DESACTIVAR' : 'ACTIVAR';
    if (await customConfirm(`¿Confirmas ${accion} el codigo promocional "${id}"?`)) {
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
      toast.success("Anuncio creado exitosamente.");
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

  const verCajeros = async (adminId: string, nombreAdmin: string) => {
    setModalCajeros({ visible: true, cajeros: [], cargando: true, nombreAdmin });
    try {
      const qCajeros = query(collection(db, "usuarios"), where("adminId", "==", adminId), where("rol", "==", "cajero"));
      const snap = await getDocs(qCajeros);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setModalCajeros({ visible: true, cajeros: lista, cargando: false, nombreAdmin });
    } catch (e) {
      toast.error("Error al cargar colaboradores.");
      setModalCajeros(prev => ({ ...prev, cargando: false }));
    }
  };

  // GESTION SEGURA: Suspender o Reactivar acceso a un negocio
  const toggleSuspensionNegocio = async (usuario: any) => {
    const estaSuspendido = usuario.activo === false || usuario.suspendido === true;
    const nombre = usuario.nombreNegocio || usuario.nombreUsuario || usuario.email || 'este negocio';

    const confirmado = await customConfirm(
      estaSuspendido
        ? `¿Deseas reactivar el acceso para "${nombre}"? El propietario y sus colaboradores podrán volver a ingresar a Fiabono.`
        : `¿Deseas suspender a "${nombre}"? Ni el dueño ni sus colaboradores podrán ingresar hasta que reactives la cuenta. Sus datos contables se conservarán intactos.`
    );

    if (!confirmado) return;

    try {
      const nuevoEstadoActivo = estaSuspendido;
      await updateDoc(doc(db, "usuarios", usuario.id), {
        activo: nuevoEstadoActivo,
        suspendido: !nuevoEstadoActivo,
        fechaSuspension: nuevoEstadoActivo ? null : Timestamp.now()
      });

      setUsuarios(prev => prev.map(u => {
        if (u.id === usuario.id) {
          return {
            ...u,
            activo: nuevoEstadoActivo,
            suspendido: !nuevoEstadoActivo,
            fechaSuspension: nuevoEstadoActivo ? null : new Date()
          };
        }
        return u;
      }));

      toast.success(estaSuspendido ? 'Cuenta reactivada exitosamente.' : 'Cuenta suspendida correctamente.');
    } catch (err: any) {
      console.error('Error al actualizar suspension de negocio:', err);
      toast.error(err.message || 'No se pudo cambiar el estado de la cuenta.');
    }
  };

  // PURGA DEFINITIVA: Abrir modal de confirmación estricta
  const abrirModalEliminar = (usuario: any) => {
    setModalEliminar({
      visible: true,
      usuario,
      confirmacionTexto: '',
      eliminando: false,
      error: null
    });
  };

  // PURGA DEFINITIVA: Ejecutar eliminación en cascada vía API
  const ejecutarEliminacionDefinitiva = async () => {
    if (!modalEliminar.usuario) return;
    const { usuario, confirmacionTexto } = modalEliminar;

    const textoEsperado = 'ELIMINAR';
    if (confirmacionTexto.trim().toUpperCase() !== textoEsperado) {
      setModalEliminar(prev => ({ ...prev, error: `Debes escribir exactamente la palabra ${textoEsperado} para confirmar.` }));
      return;
    }

    setModalEliminar(prev => ({ ...prev, eliminando: true, error: null }));

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No hay sesion activa de SuperAdmin.");
      const token = await currentUser.getIdToken(true);

      const res = await fetch('/api/master/eliminar-negocio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ usuarioId: usuario.id })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la eliminacion en cascada.');
      }

      toast.success(`Negocio "${usuario.nombreNegocio || usuario.nombreUsuario || usuario.email}" eliminado definitivamente.`);
      setUsuarios(prev => prev.filter(u => u.id !== usuario.id));
      setModalEliminar({ visible: false, usuario: null, confirmacionTexto: '', eliminando: false, error: null });
    } catch (err: any) {
      console.error('Error al eliminar negocio definitivamente:', err);
      setModalEliminar(prev => ({ ...prev, eliminando: false, error: err.message || 'Error al eliminar el negocio.' }));
      toast.error(err.message || 'Error al eliminar el negocio.');
    }
  };

  if (cargando || !datosSesion || datosSesion.correoNegocio !== 'johanescobar1@gmail.com') {
    return (
      <div className={`flex items-center justify-center min-h-[70vh] ${modoOscuro ? 'bg-[#070b14] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          <p className="text-xs font-bold text-slate-400">Verificando credenciales maestras...</p>
        </div>
      </div>
    );
  }

  const theme = {
    bgPage: modoOscuro ? 'bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-800',
    card: modoOscuro ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs',
    cardSubtle: modoOscuro ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200',
    border: modoOscuro ? 'border-slate-800' : 'border-slate-200',
    textMuted: modoOscuro ? 'text-slate-400' : 'text-slate-500',
    textMain: modoOscuro ? 'text-white' : 'text-slate-900',
    input: modoOscuro ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white',
    modalBg: modoOscuro ? 'bg-[#0b1329] border-slate-800' : 'bg-white border-slate-200 shadow-2xl',
  };

  return (
    <div className={`flex-1 overflow-y-auto ${theme.bgPage} p-4 sm:p-8 min-h-screen transition-colors duration-200`}>
      <div className="max-w-7xl mx-auto pb-24 space-y-6">
        
        {/* CABECERA EJECUTIVA */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b ${theme.border} pb-6`}>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-sm">
                <Crown size={28} className="fill-amber-500/20 text-amber-500" />
              </div>
              <div>
                <h1 className={`text-2xl sm:text-3xl font-black ${theme.textMain} tracking-tight flex items-center gap-2`}>
                  Panel Maestro
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    SaaS Founder
                  </span>
                </h1>
                <p className={`text-xs sm:text-sm ${theme.textMuted} font-medium`}>
                  Control de cuentas, cobros, cupones y actividad de tiendas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* TOGGLE MODO CLARO / OSCURO (OPCIONAL) */}
            <button
              onClick={toggleTema}
              title={modoOscuro ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              className={`p-2.5 rounded-2xl border transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                modoOscuro 
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-amber-400' 
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs'
              }`}
            >
              {modoOscuro ? <Sun size={17} /> : <Moon size={17} />}
              <span className="hidden sm:inline">{modoOscuro ? 'Claro' : 'Oscuro'}</span>
            </button>

            {/* BOTÓN CONFIGURAR MEDIOS DE PAGO */}
            <button
              onClick={() => setModalConfigPagos(true)}
              className={`px-3 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                tieneMediosDePagoValidos
                  ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-600/25'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25 animate-pulse'
              }`}
              title="Configurar cuentas de cobro (Nequi, Llave, Bancolombia)"
            >
              <CreditCard size={15} />
              <span>Opciones de Pago</span>
              {!tieneMediosDePagoValidos && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
            </button>

            {/* BOTÓN REFRESCAR */}
            <button 
              onClick={cargarDatos}
              title="Refrescar datos"
              className={`p-2.5 rounded-2xl border transition active:scale-95 cursor-pointer ${
                modoOscuro 
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
              }`}
            >
              <RefreshCw size={16} />
            </button>

            {/* TABS PRINCIPALES */}
            <div className={`flex w-full sm:w-auto p-1.5 rounded-2xl border ${theme.border} ${modoOscuro ? 'bg-slate-900/90' : 'bg-slate-100'} gap-1`}>
              <button 
                onClick={() => setTabActiva('usuarios')} 
                className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                  tabActiva === 'usuarios' 
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
                    : `${theme.textMuted} hover:${theme.textMain}`
                }`}
              >
                Tiendas ({usuarios.length})
              </button>
              <button 
                onClick={() => setTabActiva('bonos')} 
                className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                  tabActiva === 'bonos' 
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
                    : `${theme.textMuted} hover:${theme.textMain}`
                }`}
              >
                Codigos ({bonos.length})
              </button>
              <button 
                onClick={() => setTabActiva('anuncios')} 
                className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                  tabActiva === 'anuncios' 
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black' 
                    : `${theme.textMuted} hover:${theme.textMain}`
                }`}
              >
                Anuncios ({anuncios.length})
              </button>
            </div>
          </div>
        </div>

        {/* TARJETAS KPIS EJECUTIVOS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* MRR Estimado */}
          <div className={`p-4 rounded-3xl border shadow-sm ${
            modoOscuro 
              ? 'bg-gradient-to-br from-slate-900/90 to-purple-950/30 border-purple-500/20' 
              : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
          }`}>
            <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">MRR Proyectado</span>
              <DollarSign size={16} className="shrink-0" />
            </div>
            <p className={`text-lg sm:text-2xl font-black ${theme.textMain} tabular-nums truncate`}>
              ${metricas.mrr.toLocaleString('es-CO')}
            </p>
            <p className="text-[10px] text-purple-700 dark:text-purple-300 font-medium mt-1 truncate">
              {metricas.activosPro} PRO - {metricas.activosComercio} Comercio
            </p>
          </div>

          {/* Tiendas Registradas */}
          <div className={`p-4 rounded-3xl border shadow-sm ${theme.card}`}>
            <div className={`flex items-center justify-between ${theme.textMuted} mb-2`}>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">Total Tiendas</span>
              <Store size={16} className="shrink-0" />
            </div>
            <p className={`text-lg sm:text-2xl font-black ${theme.textMain} tabular-nums`}>{metricas.total}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 truncate">
              +{metricas.recientes7d} nuevos (7d)
            </p>
          </div>

          {/* Suscripciones Pagas */}
          <div className={`p-4 rounded-3xl border shadow-sm ${
            modoOscuro ? 'bg-slate-900/80 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">Planes Pagos</span>
              <UserCheck size={16} className="shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{metricas.totalActivos}</p>
            <p className={`text-[10px] ${theme.textMuted} font-medium mt-1 truncate`}>
              PRO + Comercio
            </p>
          </div>

          {/* Planes Gratuitos */}
          <div className={`p-4 rounded-3xl border shadow-sm ${
            modoOscuro ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-100 border-slate-300'
          }`}>
            <div className={`flex items-center justify-between ${theme.textMuted} mb-2`}>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">Plan Gratuito</span>
              <Building size={16} className="shrink-0" />
            </div>
            <p className={`text-lg sm:text-2xl font-black ${theme.textMain} tabular-nums`}>{metricas.planesGratis}</p>
            <p className={`text-[10px] ${theme.textMuted} font-medium mt-1 truncate`}>
              Sin plan de pago
            </p>
          </div>

          {/* Por Vencer (Alerta Crítica) */}
          <div className={`p-4 rounded-3xl border shadow-sm transition-all ${
            metricas.porVencer7d > 0 
              ? (modoOscuro ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-900')
              : theme.card
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">Por Vencer (&lt;=7d)</span>
              <AlertTriangle size={16} className={`shrink-0 ${metricas.porVencer7d > 0 ? 'text-amber-500 animate-bounce' : ''}`} />
            </div>
            <p className="text-lg sm:text-2xl font-black text-amber-500 tabular-nums">{metricas.porVencer7d}</p>
            <p className="text-[10px] font-medium mt-1 opacity-80 truncate">
              Alerta de renovacion
            </p>
          </div>

          {/* Inactivos (+30d sin uso) */}
          <div className={`p-4 rounded-3xl border shadow-sm ${
            modoOscuro ? 'bg-slate-900/80 border-rose-500/20' : 'bg-rose-50/50 border-rose-200'
          }`}>
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">Inactivos (+30d)</span>
              <UserX size={16} className="shrink-0" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{metricas.inactivos30d}</p>
            <p className={`text-[10px] ${theme.textMuted} font-medium mt-1 truncate`}>
              Sin entrar hace 1 mes
            </p>
          </div>
        </div>

        {/* TAB 1: USUARIOS / TIENDAS */}
        {tabActiva === 'usuarios' && (
          <div className="space-y-4">
            
            {/* BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS */}
            <div className={`${theme.card} rounded-3xl p-4 border space-y-3`}>
              <div className="relative">
                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textMuted}`} size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre de negocio, usuario, correo, telefono o ID..." 
                  value={busqueda} 
                  onChange={e => setBusqueda(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 rounded-2xl outline-none font-medium text-sm border transition-colors ${theme.input}`}
                />
                {busqueda && (
                  <button 
                    onClick={() => setBusqueda("")}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 ${theme.textMuted} hover:${theme.textMain} cursor-pointer`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* CHIPS DE FILTRO DE SEGMENTACIÓN (CON SWIPE HORIZONTAL FLUIDO EN MÓVIL Y TABLET) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none sm:flex-wrap text-xs">
                <button
                  onClick={() => setFiltroEstado('todos')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'todos' 
                      ? 'bg-amber-500 text-slate-950 shadow-xs' 
                      : (modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  }`}
                >
                  Todos ({usuarios.length})
                </button>
                <button
                  onClick={() => setFiltroEstado('gratis')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'gratis' 
                      ? 'bg-slate-700 text-white shadow-xs font-black' 
                      : (modoOscuro ? 'bg-slate-800/80 text-slate-300 border border-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300')
                  }`}
                >
                  Plan Gratuito ({metricas.planesGratis})
                </button>
                <button
                  onClick={() => setFiltroEstado('inactivos')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'inactivos' 
                      ? 'bg-rose-600 text-white shadow-xs font-black' 
                      : (modoOscuro ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100')
                  }`}
                >
                  <UserX size={13} />
                  Inactivos (+30d) ({metricas.inactivos30d})
                </button>
                <button
                  onClick={() => setFiltroEstado('suspendidos')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'suspendidos' 
                      ? 'bg-rose-500 text-white shadow-xs font-black' 
                      : (modoOscuro ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100')
                  }`}
                >
                  <ShieldAlert size={13} />
                  Suspendidos ({metricas.suspendidos})
                </button>
                <button
                  onClick={() => setFiltroEstado('porVencer')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'porVencer' 
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs' 
                      : (modoOscuro ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100')
                  }`}
                >
                  <AlertTriangle size={13} />
                  Por Vencer (&lt;=7d) ({metricas.porVencer7d})
                </button>
                <button
                  onClick={() => setFiltroEstado('pro')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'pro' 
                      ? 'bg-purple-600 text-white shadow-xs' 
                      : (modoOscuro ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100')
                  }`}
                >
                  <Crown size={12} className="text-amber-400" />
                  Plan PRO ({metricas.activosPro})
                </button>
                <button
                  onClick={() => setFiltroEstado('comercio')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'comercio' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : (modoOscuro ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100')
                  }`}
                >
                  <Store size={12} />
                  Plan Comercio ({metricas.activosComercio})
                </button>
                <button
                  onClick={() => setFiltroEstado('prueba')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'prueba' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : (modoOscuro ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100')
                  }`}
                >
                  En Prueba ({metricas.enPrueba})
                </button>
                <button
                  onClick={() => setFiltroEstado('vencidos')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'vencidos' 
                      ? 'bg-rose-600 text-white shadow-xs' 
                      : (modoOscuro ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100')
                  }`}
                >
                  Vencidos ({metricas.vencidos})
                </button>
                <button
                  onClick={() => setFiltroEstado('recientes')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 whitespace-nowrap active:scale-95 cursor-pointer ${
                    filtroEstado === 'recientes' 
                      ? (modoOscuro ? 'bg-slate-200 text-slate-900 shadow-xs' : 'bg-slate-800 text-white shadow-xs') 
                      : (modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                  }`}
                >
                  Nuevos (7d) ({metricas.recientes7d})
                </button>
              </div>
            </div>

            {/* LISTADO DE TIENDAS */}
            <div className="space-y-3">
              {usuariosFiltrados.map(u => {
                const estado = calcularEstadoPlan(u);
                const infoInac = calcularInactividad(u);
                const isPro = u.plan === 'pro';
                const isComercio = u.plan === 'comercio';
                const tele = telemetriaMap[u.id];

                return (
                  <div 
                    key={u.id} 
                    className={`${theme.card} rounded-3xl p-4 sm:p-6 border transition-all shadow-sm space-y-4 hover:border-slate-700/60`}
                  >
                    {/* Fila Principal */}
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                      
                      {/* Información de la Tienda */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${
                          isPro 
                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30' 
                            : isComercio 
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' 
                            : (modoOscuro ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                        }`}>
                          <Store size={22} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 className={`font-black ${theme.textMain} text-base sm:text-lg tracking-tight truncate`}>
                              {u.nombreNegocio || "Negocio sin nombre"}
                            </h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isPro 
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30' 
                                : isComercio 
                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30' 
                                : (modoOscuro ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200')
                            }`}>
                              {u.plan || 'gratis'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${estado.color}`}>
                              {estado.label}
                            </span>
                            
                            {/* BADGE DE SUSPENSIÓN */}
                            {(u.activo === false || u.suspendido === true) && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 flex items-center gap-1">
                                <ShieldAlert size={11} /> Suspendido
                              </span>
                            )}

                            {/* BADGE DE INACTIVIDAD */}
                            {infoInac.esInactivo30d && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                <UserX size={11} /> Inactivo (+30d)
                              </span>
                            )}

                            {u.moduloSepare && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30">
                                Plan Separe
                              </span>
                            )}
                          </div>

                          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs ${theme.textMuted} mt-1.5`}>
                            <span className="flex items-center gap-1">
                              <User size={12} className="shrink-0" /> <strong className={`${theme.textMain} truncate`}>{u.nombreUsuario || 'Sin usuario'}</strong>
                            </span>
                            <span className="flex items-center gap-1 break-all">
                              <Mail size={12} className="shrink-0" /> {u.email}
                            </span>
                            {(u.telefonoNegocio || u.celular) && (
                              <span className="flex items-center gap-1 font-mono font-bold whitespace-nowrap">
                                <Phone size={12} className="shrink-0" /> {u.telefonoNegocio || u.celular}
                              </span>
                            )}
                            <span className="flex items-center gap-1 font-medium whitespace-nowrap">
                              <Clock size={11} className="shrink-0" /> Ultimo acceso: <strong className={infoInac.esInactivo30d ? "text-rose-600 dark:text-rose-400 font-bold" : theme.textMain}>{infoInac.texto}</strong>
                            </span>
                            <span className="text-[10px] opacity-70 font-mono whitespace-nowrap">
                              ID: {u.id.slice(0, 8)}...
                            </span>
                          </div>

                          {/* Previsualización de Nota Master si existe */}
                          {u.notasMaster && (
                            <div className="mt-2.5 text-xs bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-2.5 rounded-xl flex items-center gap-2">
                              <FileText size={14} className="shrink-0 text-amber-500" />
                              <p className="truncate"><strong>Nota Johan:</strong> {u.notasMaster}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botonera de Acciones Rápidas */}
                      <div className={`grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 ${theme.border} w-full lg:w-auto`}>
                        {/* WhatsApp CRM */}
                        {(u.telefonoNegocio || u.celular) && (
                          <button
                            onClick={() => abrirModalWhatsApp(u)}
                            className="col-span-2 sm:col-span-1 px-3.5 py-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] dark:text-[#25D366] font-black rounded-xl text-xs flex items-center justify-center gap-1.5 border border-[#25D366]/30 transition active:scale-95 cursor-pointer shadow-xs"
                            title="Abrir WhatsApp con plantillas"
                          >
                            <MessageCircle size={15} />
                            <span>WhatsApp CRM</span>
                          </button>
                        )}

                        {/* Botón Gestionar Plan Completo */}
                        <button 
                          onClick={() => setModalPlan({ visible: true, usuario: u })}
                          className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
                        >
                          <Edit2 size={14} />
                          <span>Plan</span>
                        </button>

                        {/* Botón Notas Master */}
                        <button
                          onClick={() => setModalNota({ visible: true, usuario: u, texto: u.notasMaster || "", guardando: false })}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            u.notasMaster 
                              ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40' 
                              : (modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')
                          }`}
                          title="Nota privada del Master"
                        >
                          <FileText size={14} />
                          <span>{u.notasMaster ? 'Ver Nota' : 'Nota'}</span>
                        </button>

                        {/* Botón Ver Colaboradores */}
                        <button 
                          onClick={() => verCajeros(u.id, u.nombreNegocio || u.nombreUsuario)}
                          className={`px-3 py-2.5 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Users size={14} />
                          <span>Cajeros</span>
                        </button>

                        {/* Botón Restablecer Clave (Solo si tiene email) */}
                        {u.email && u.email.includes('@') && !u.email.endsWith('@fiabono.internal') && (
                          <button
                            onClick={() => abrirModalResetPass(u)}
                            className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                              modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Restablecer clave o generar enlace oficial"
                          >
                            <KeyRound size={14} />
                            <span>Clave</span>
                          </button>
                        )}

                        {/* Botón Suspender / Reactivar Cuenta */}
                        <button
                          onClick={() => toggleSuspensionNegocio(u)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            u.activo === false || u.suspendido === true
                              ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : (modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700')
                          }`}
                          title={u.activo === false || u.suspendido === true ? 'Reactivar acceso a la cuenta' : 'Suspender acceso a la cuenta'}
                        >
                          <Power size={14} className={u.activo === false || u.suspendido === true ? 'text-amber-500' : 'text-slate-400'} />
                          <span>{u.activo === false || u.suspendido === true ? 'Reactivar' : 'Suspender'}</span>
                        </button>

                        {/* Botón Eliminar Definitivamente (Purga en cascada) */}
                        <button
                          onClick={() => abrirModalEliminar(u)}
                          className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          title="Eliminacion definitiva y purga en cascada"
                        >
                          <Trash2 size={14} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </div>

                    {/* Barra Inferior: Telemetría de Actividad + Extensiones Seguras con Aprobación */}
                    <div className={`pt-3 border-t ${theme.border} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs`}>
                      
                      {/* Telemetría / Salud */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {tele?.auditado ? (
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] ${theme.cardSubtle}`}>
                            <span className={`w-2 h-2 rounded-full ${
                              tele.movimientos > 0 ? 'bg-emerald-500' : (tele.productos > 0 ? 'bg-amber-500' : 'bg-rose-500')
                            }`}></span>
                            <span className={theme.textMuted}>Estado:</span>
                            <span className={`font-bold ${theme.textMain}`}>
                              {tele.movimientos > 0 ? 'Activo' : (tele.productos > 0 ? 'En Configuracion' : 'Inactivo')}
                            </span>
                            <span className="opacity-40">|</span>
                            <span><strong>{tele.productos}</strong> productos</span>
                            <span><strong>{tele.clientes}</strong> clientes</span>
                            <span><strong>{tele.movimientos}</strong> movimientos</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => auditarActividadTienda(u.id)}
                            disabled={tele?.cargando}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 border transition cursor-pointer active:scale-95 ${
                              modoOscuro 
                                ? 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                            }`}
                          >
                            <Activity size={13} className={tele?.cargando ? 'animate-spin text-amber-500' : ''} />
                            <span>{tele?.cargando ? 'Consultando...' : 'Auditar Actividad'}</span>
                          </button>
                        )}
                      </div>

                      {/* Botones de Extensión Rápida SEGURA (Exigen confirmación previa) */}
                      <div className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
                        <span className={`text-[10px] uppercase font-bold ${theme.textMuted} mr-1`}>Extension Segura:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => autorizarExtensionSegura(u, 15)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition active:scale-95 cursor-pointer ${
                              modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                            }`}
                            title="Anade 15 dias previa confirmacion"
                          >
                            +15d
                          </button>
                          <button
                            onClick={() => autorizarExtensionSegura(u, 30)}
                            className="px-2.5 py-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 rounded-lg text-[11px] font-black border border-purple-500/30 transition active:scale-95 cursor-pointer"
                            title="Anade 30 dias previa confirmacion"
                          >
                            +30d
                          </button>
                          <button
                            onClick={() => autorizarExtensionSegura(u, 365)}
                            className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-black border border-amber-500/30 transition active:scale-95 cursor-pointer"
                            title="Anade 1 ano previa confirmacion"
                          >
                            +1 Ano
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}

              {usuariosFiltrados.length === 0 && (
                <div className={`p-12 text-center font-bold rounded-3xl border ${theme.card}`}>
                  No se encontraron negocios con los filtros aplicados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BONOS */}
        {tabActiva === 'bonos' && (
          <div className={`${theme.card} rounded-3xl border p-6 sm:p-8 space-y-6`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className={`text-2xl font-black flex items-center gap-2 ${theme.textMain}`}>
                  <Ticket className="text-blue-500" /> Codigos Promocionales
                </h2>
                <p className={`text-sm ${theme.textMuted}`}>
                  Crea y administra los codigos promocionales de tus usuarios.
                </p>
              </div>
              <button 
                onClick={() => setModalBono(true)} 
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl flex items-center gap-2 transition active:scale-95 shadow-lg shadow-blue-600/20 cursor-pointer text-sm"
              >
                <Plus size={18} /> Crear Codigo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bonos.map(b => (
                <div 
                  key={b.id} 
                  className={`p-6 rounded-3xl border-2 relative transition-all flex flex-col justify-between ${
                    b.activo 
                      ? (modoOscuro ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-300 bg-emerald-50/60')
                      : (modoOscuro ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50')
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`font-black text-xl font-mono tracking-wider ${theme.textMain}`}>
                          {b.id}
                        </h3>
                        <span className={`inline-block mt-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          b.planOtorgado === 'pro' 
                            ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300' 
                            : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                        }`}>
                          Plan {b.planOtorgado || 'pro'} - {b.diasOtorgados || 30} dias
                        </span>
                      </div>
                      <button 
                        onClick={() => alternarBono(b.id, b.activo)} 
                        title={b.activo ? "Desactivar codigo" : "Activar codigo"}
                        className={`p-2 rounded-xl transition cursor-pointer ${
                          b.activo 
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                            : (modoOscuro ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-200 text-slate-600')
                        }`}
                      >
                        <Power size={16} />
                      </button>
                    </div>

                    <div className={`space-y-2 text-xs font-medium ${theme.textMuted}`}>
                      {b.emailObjetivo && (
                        <div className={`p-2 rounded-xl border ${theme.cardSubtle}`}>
                          <p className="text-[10px] uppercase font-bold opacity-60 mb-0.5">Exclusivo para:</p>
                          <p className="text-blue-600 dark:text-blue-400 font-bold truncate">{b.emailObjetivo}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 text-[11px] font-bold pt-1">
                        {b.unSoloUso !== false ? (
                          <><ShieldAlert size={14} className="text-amber-500" /> <span className="text-amber-600 dark:text-amber-400">UN SOLO USO</span></>
                        ) : (
                          <><CheckCircle2 size={14} className="text-emerald-500" /> <span className="text-emerald-600 dark:text-emerald-400">MULTIUSO PERMANENTE</span></>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`pt-4 mt-4 border-t ${theme.border} flex items-center justify-end`}>
                    <button 
                      onClick={() => eliminarBono(b.id)} 
                      title="Eliminar permanentemente"
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {bonos.length === 0 && (
                <div className={`col-span-full p-12 text-center font-bold border-2 border-dashed ${theme.border} rounded-3xl ${theme.textMuted}`}>
                  No hay codigos promocionales creados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ANUNCIOS */}
        {tabActiva === 'anuncios' && (
          <div className={`${theme.card} rounded-3xl border p-6 sm:p-8 space-y-6`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className={`text-2xl font-black flex items-center gap-2 ${theme.textMain}`}>
                  Anuncios Globales y Personales
                </h2>
                <p className={`text-sm ${theme.textMuted}`}>
                  Muestra avisos de mantenimiento, nuevas funciones o alertas directas en el panel de los comerciantes.
                </p>
              </div>
              <button 
                onClick={() => setModalAnuncio(true)} 
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center gap-2 transition active:scale-95 shadow-lg shadow-indigo-600/20 cursor-pointer text-sm"
              >
                <Plus size={18} /> Crear Anuncio
              </button>
            </div>

            <div className="space-y-4">
              {anuncios.map(a => (
                <div 
                  key={a.id} 
                  className={`p-5 rounded-2xl border-2 relative transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${
                    a.activo 
                      ? (modoOscuro ? 'border-indigo-500/30 bg-indigo-950/20' : 'border-indigo-300 bg-indigo-50/60')
                      : (modoOscuro ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50')
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        a.tipo === 'warning' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 
                        a.tipo === 'error' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : 
                        a.tipo === 'success' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 
                        'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      }`}>
                        {a.tipo}
                      </span>
                      {a.emailObjetivo ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                          Personal: {a.emailObjetivo}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${modoOscuro ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                          Global
                        </span>
                      )}
                      {a.cerrable ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${modoOscuro ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                          Cerrable
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                          Persistente
                        </span>
                      )}
                    </div>
                    <h3 className={`font-black text-lg ${theme.textMain}`}>{a.titulo}</h3>
                    <p className={`text-sm font-medium ${theme.textMuted} mt-1`}>{a.mensaje}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => alternarAnuncio(a.id, a.activo)} 
                      title={a.activo ? "Desactivar anuncio" : "Activar anuncio"}
                      className={`p-2.5 rounded-xl transition cursor-pointer ${
                        a.activo 
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                          : (modoOscuro ? 'bg-slate-800 text-slate-500 hover:text-white' : 'bg-slate-200 text-slate-600')
                      }`}
                    >
                      <Power size={16} />
                    </button>
                    <button 
                      onClick={() => eliminarAnuncio(a.id)} 
                      title="Eliminar permanentemente"
                      className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {anuncios.length === 0 && (
                <div className={`p-12 text-center font-bold border-2 border-dashed ${theme.border} rounded-3xl ${theme.textMuted}`}>
                  No hay anuncios creados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL CONFIGURACIÓN DE MEDIOS DE PAGO */}
        {modalConfigPagos && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-md border space-y-4 sm:space-y-5 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-black ${theme.textMain} flex items-center gap-2`}>
                    <CreditCard className="text-blue-500" size={22} />
                    Opciones de Pago
                  </h3>
                  <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                    Configura tus cuentas oficiales. Solo se enviaran las que tengan datos; las vacias se omiten.
                  </p>
                </div>
                <button 
                  onClick={() => setModalConfigPagos(false)} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* NEQUI */}
                <div>
                  <label className="flex items-center gap-1.5 font-black uppercase text-[11px] text-purple-600 dark:text-purple-400 mb-1.5">
                    <Smartphone size={14} /> 1. Numero Nequi
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: 3128018444 (Deja vacio si no tienes)" 
                    value={mediosPago.nequi} 
                    onChange={e => setMediosPago({ ...mediosPago, nequi: e.target.value })}
                    className={`w-full p-3.5 rounded-2xl border font-bold ${theme.input} outline-none`}
                  />
                </div>

                {/* LLAVE */}
                <div>
                  <label className="flex items-center gap-1.5 font-black uppercase text-[11px] text-amber-600 dark:text-amber-400 mb-1.5">
                    <KeyRound size={14} /> 2. Llave (Transfiya / Daviplata / Bre-B)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: 3128018444 o Cedula (Deja vacio si no tienes)" 
                    value={mediosPago.llave} 
                    onChange={e => setMediosPago({ ...mediosPago, llave: e.target.value })}
                    className={`w-full p-3.5 rounded-2xl border font-bold ${theme.input} outline-none`}
                  />
                </div>

                {/* BANCOLOMBIA */}
                <div>
                  <label className="flex items-center gap-1.5 font-black uppercase text-[11px] text-blue-600 dark:text-blue-400 mb-1.5">
                    <Building size={14} /> 3. Cuenta Bancolombia
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: Ahorros 123-456789-00 (Deja vacio si no tienes)" 
                    value={mediosPago.bancolombia} 
                    onChange={e => setMediosPago({ ...mediosPago, bancolombia: e.target.value })}
                    className={`w-full p-3.5 rounded-2xl border font-bold ${theme.input} outline-none`}
                  />
                </div>

                {/* TITULAR */}
                <div>
                  <label className={`block font-black uppercase text-[11px] ${theme.textMuted} mb-1.5`}>
                    Nombre del Titular de las Cuentas
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej: Johan Escobar" 
                    value={mediosPago.titular} 
                    onChange={e => setMediosPago({ ...mediosPago, titular: e.target.value })}
                    className={`w-full p-3.5 rounded-2xl border font-bold ${theme.input} outline-none`}
                  />
                </div>
              </div>

              {/* Mensaje Informativo de Validación */}
              <div className={`p-3 rounded-2xl text-[11px] border ${
                tieneMediosDePagoValidos
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
              }`}>
                {tieneMediosDePagoValidos ? (
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span>Se incluiran unicamente las cuentas que tengan numero asignado.</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-rose-500 shrink-0" />
                    <span>Debes ingresar al menos una cuenta (Nequi, Llave o Bancolombia) para poder enviar mensajes de cobro.</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setModalConfigPagos(false)}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-xs ${modoOscuro ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarMediosPago}
                  disabled={guardandoMediosPago}
                  className="flex-[2] py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs sm:text-sm transition active:scale-98 cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {guardandoMediosPago ? 'Guardando...' : 'Guardar Opciones'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CRM WHATSAPP CONTEXTUAL */}
        {modalWhatsApp.visible && modalWhatsApp.usuario && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-lg border space-y-4 sm:space-y-5 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-black ${theme.textMain} flex items-center gap-2`}>
                    <MessageCircle className="text-[#25D366]" size={22} />
                    WhatsApp CRM
                  </h3>
                  <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                    Negocio: <strong className={theme.textMain}>{modalWhatsApp.usuario.nombreNegocio || modalWhatsApp.usuario.nombreUsuario}</strong>
                    {" - "}
                    Telefono: {modalWhatsApp.usuario.telefonoNegocio || modalWhatsApp.usuario.celular}
                  </p>
                </div>
                <button 
                  onClick={() => setModalWhatsApp(prev => ({ ...prev, visible: false }))} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Selector de Plantillas (INCLUYE INACTIVO +30D) */}
              <div>
                <label className={`block text-[10px] font-black uppercase ${theme.textMuted} mb-2 tracking-wider`}>
                  Seleccionar Plantilla
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <button
                    onClick={() => cambiarPlantillaWhatsApp('bienvenida')}
                    className={`p-2.5 rounded-xl font-bold text-left transition cursor-pointer ${
                      modalWhatsApp.tipoPlantilla === 'bienvenida' 
                        ? 'bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] border border-[#25D366]/40' 
                        : (modoOscuro ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200')
                    }`}
                  >
                    Bienvenida
                  </button>
                  <button
                    onClick={() => cambiarPlantillaWhatsApp('preventivo')}
                    className={`p-2.5 rounded-xl font-bold text-left transition cursor-pointer ${
                      modalWhatsApp.tipoPlantilla === 'preventivo' 
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40' 
                        : (modoOscuro ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200')
                    }`}
                  >
                    Vence Pronto
                  </button>
                  <button
                    onClick={() => cambiarPlantillaWhatsApp('vencido')}
                    className={`p-2.5 rounded-xl font-bold text-left transition cursor-pointer ${
                      modalWhatsApp.tipoPlantilla === 'vencido' 
                        ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40' 
                        : (modoOscuro ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200')
                    }`}
                  >
                    Plan Vencido
                  </button>
                  <button
                    onClick={() => cambiarPlantillaWhatsApp('inactivo')}
                    className={`p-2.5 rounded-xl font-bold text-left transition cursor-pointer ${
                      modalWhatsApp.tipoPlantilla === 'inactivo' 
                        ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40' 
                        : (modoOscuro ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200')
                    }`}
                  >
                    Inactivo (+30d)
                  </button>
                  <button
                    onClick={() => cambiarPlantillaWhatsApp('pago')}
                    className={`col-span-2 sm:col-span-2 p-2.5 rounded-xl font-bold text-left transition cursor-pointer ${
                      modalWhatsApp.tipoPlantilla === 'pago' 
                        ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40' 
                        : (modoOscuro ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200')
                    }`}
                  >
                    Cuentas de Cobro (Nequi / Bancolombia)
                  </button>
                </div>
              </div>

              {/* Si es Plantilla de Pago, mostrar resumen de métodos activos y botón para editar */}
              {modalWhatsApp.tipoPlantilla === 'pago' && (
                <div className={`p-3.5 rounded-2xl border ${theme.cardSubtle} space-y-2`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black uppercase text-blue-600 dark:text-blue-400">
                      Cuentas que se enviaran:
                    </span>
                    <button
                      onClick={() => setModalConfigPagos(true)}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={11} /> Editar Cuentas
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {mediosPago.nequi.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold">
                        Nequi: {mediosPago.nequi}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-400 line-through">
                        Nequi (Vacio)
                      </span>
                    )}

                    {mediosPago.llave.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                        Llave: {mediosPago.llave}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-400 line-through">
                        Llave (Vacia)
                      </span>
                    )}

                    {mediosPago.bancolombia.trim() ? (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold">
                        Bancolombia: {mediosPago.bancolombia}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-400 line-through">
                        Bancolombia (Vacio)
                      </span>
                    )}
                  </div>

                  {!tieneMediosDePagoValidos && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
                      <span>Todas tus opciones de pago estan vacias. No se puede enviar el mensaje.</span>
                      <button
                        onClick={() => setModalConfigPagos(true)}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black cursor-pointer shrink-0"
                      >
                        Llenar Ahora
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mensaje Editable */}
              <div>
                <label className={`block text-[10px] font-black uppercase ${theme.textMuted} mb-1.5 tracking-wider`}>
                  Mensaje a enviar (Puedes editarlo antes de abrir WhatsApp)
                </label>
                <textarea
                  rows={5}
                  value={modalWhatsApp.mensajeFinal}
                  onChange={e => setModalWhatsApp(prev => ({ ...prev, mensajeFinal: e.target.value, tipoPlantilla: 'personalizado' }))}
                  className={`w-full p-4 rounded-2xl border text-xs sm:text-sm font-medium outline-none transition ${theme.input} focus:border-[#25D366]`}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setModalWhatsApp(prev => ({ ...prev, visible: false }))}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-xs transition cursor-pointer ${
                    modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarWhatsAppFinal}
                  disabled={modalWhatsApp.tipoPlantilla === 'pago' && !tieneMediosDePagoValidos}
                  className={`flex-[2] py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition active:scale-98 shadow-md cursor-pointer ${
                    modalWhatsApp.tipoPlantilla === 'pago' && !tieneMediosDePagoValidos
                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-[#25D366] hover:bg-[#20ba59] text-slate-950 shadow-[#25D366]/20'
                  }`}
                >
                  <Send size={16} />
                  <span>Abrir en WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL NOTAS MASTER (NOTAS PRIVADAS DE JOHAN) */}
        {modalNota.visible && modalNota.usuario && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-md border space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-black ${theme.textMain} flex items-center gap-2`}>
                    <FileText className="text-amber-500" size={20} />
                    Nota Interna del Master
                  </h3>
                  <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                    Negocio: <strong className={theme.textMain}>{modalNota.usuario.nombreNegocio || modalNota.usuario.nombreUsuario}</strong>
                  </p>
                </div>
                <button 
                  onClick={() => setModalNota({ visible: false, usuario: null, texto: "", guardando: false })} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                Esta nota es estrictamente privada y solo la puedes ver tu desde este panel (ej: "Pago Nequi comprobante 8392", "Pidio prorroga").
              </p>

              <textarea
                rows={4}
                placeholder="Escribe tus apuntes privados sobre este cliente..."
                value={modalNota.texto}
                onChange={e => setModalNota(prev => ({ ...prev, texto: e.target.value }))}
                className={`w-full p-4 rounded-2xl border text-xs sm:text-sm font-medium outline-none transition ${theme.input} focus:border-amber-500`}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setModalNota({ visible: false, usuario: null, texto: "", guardando: false })}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-xs cursor-pointer ${modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarNotaMaster}
                  disabled={modalNota.guardando}
                  className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition active:scale-98 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {modalNota.guardando ? 'Guardando...' : 'Guardar Nota'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL VER CAJEROS / COLABORADORES */}
        {modalCajeros.visible && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-md border space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-xl font-black ${theme.textMain}`}>Colaboradores Activos</h3>
                  <p className={`text-xs ${theme.textMuted} font-medium`}>De: {modalCajeros.nombreAdmin}</p>
                </div>
                <button 
                  onClick={() => setModalCajeros({ visible: false, cajeros: [], cargando: false, nombreAdmin: '' })} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              {modalCajeros.cargando ? (
                <div className={`p-8 text-center ${theme.textMuted} font-bold flex items-center justify-center gap-2`}>
                  <RefreshCw className="animate-spin text-amber-500" size={18} />
                  <span>Consultando colaboradores...</span>
                </div>
              ) : modalCajeros.cajeros.length === 0 ? (
                <div className={`p-8 text-center ${theme.textMuted} font-bold border-2 border-dashed ${theme.border} rounded-3xl`}>
                  No tiene colaboradores registrados.
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {modalCajeros.cajeros.map(c => (
                    <div key={c.id} className={`p-4 rounded-2xl border flex justify-between items-center ${theme.cardSubtle}`}>
                      <div>
                        <p className={`font-bold ${theme.textMain} text-sm`}>{c.nombreUsuario}</p>
                        <p className={`text-xs ${theme.textMuted}`}>{c.email}</p>
                        {c.permisos?.abonar && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-full">
                            Puede Abonar
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {c.activo === false ? (
                          <span className="px-2 py-1 bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[10px] font-black uppercase rounded-lg">
                            Inactivo
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase rounded-lg">
                            Activo
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL GESTIONAR / FORZAR PLAN */}
        {modalPlan.visible && modalPlan.usuario && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-sm border space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-xl font-black ${theme.textMain}`}>Gestionar Plan</h3>
                <button 
                  onClick={() => setModalPlan({ visible: false, usuario: null })} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className={`p-4 rounded-2xl border ${theme.cardSubtle}`}>
                <p className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-wider mb-1`}>Negocio</p>
                <p className={`font-black ${theme.textMain} truncate text-base`}>{modalPlan.usuario.nombreNegocio || modalPlan.usuario.nombreUsuario}</p>
                <p className={`text-xs ${theme.textMuted} truncate mt-0.5`}>{modalPlan.usuario.email}</p>
              </div>
              
              <div>
                <label className={`block text-xs font-black uppercase ${theme.textMuted} mb-2`}>Plan a Asignar</label>
                <select 
                  className={`w-full p-3.5 rounded-2xl font-bold border outline-none ${theme.input} focus:border-amber-500`} 
                  value={formPlan.plan} 
                  onChange={e => setFormPlan({ ...formPlan, plan: e.target.value as any })}
                >
                  <option value="gratis">Gratis (Revocar acceso)</option>
                  <option value="comercio">Comercio</option>
                  <option value="pro">PRO Almacen</option>
                </select>
              </div>

              {formPlan.plan !== 'gratis' && (
                <div>
                  <label className={`block text-xs font-black uppercase ${theme.textMuted} mb-2`}>Dias a Sumar (Extension)</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button 
                      type="button" 
                      onClick={() => setFormPlan(p => ({ ...p, dias: 15 }))} 
                      className={`p-2 rounded-xl text-xs font-black border ${formPlan.dias === 15 ? 'bg-amber-500 text-slate-950 border-amber-500' : `${theme.cardSubtle} ${theme.textMain}`}`}
                    >
                      15 dias
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormPlan(p => ({ ...p, dias: 30 }))} 
                      className={`p-2 rounded-xl text-xs font-black border ${formPlan.dias === 30 ? 'bg-amber-500 text-slate-950 border-amber-500' : `${theme.cardSubtle} ${theme.textMain}`}`}
                    >
                      30 dias
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormPlan(p => ({ ...p, dias: 365 }))} 
                      className={`p-2 rounded-xl text-xs font-black border ${formPlan.dias === 365 ? 'bg-amber-500 text-slate-950 border-amber-500' : `${theme.cardSubtle} ${theme.textMain}`}`}
                    >
                      1 ano
                    </button>
                  </div>
                  <input 
                    type="number" 
                    className={`w-full p-3.5 rounded-2xl font-bold border outline-none ${theme.input} focus:border-amber-500`} 
                    value={formPlan.dias} 
                    onChange={e => setFormPlan({ ...formPlan, dias: Number(e.target.value) })} 
                  />
                </div>
              )}

              <button 
                onClick={guardarCambioPlan} 
                className="w-full py-4 font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-2xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Confirmar y Aplicar
              </button>
            </div>
          </div>
        )}

        {/* MODAL CREAR BONO */}
        {modalBono && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-sm border space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-xl font-black ${theme.textMain}`}>Nuevo Codigo Promocional</h3>
                <button 
                  onClick={() => setModalBono(false)} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>
              
              <input 
                type="text" 
                placeholder="CODIGO (Ej: PRO2026)" 
                className={`w-full p-4 rounded-2xl font-mono font-black uppercase text-lg text-center tracking-widest outline-none border ${theme.input} focus:border-blue-500`} 
                value={formBono.codigo} 
                onChange={e => setFormBono({ ...formBono, codigo: e.target.value.replace(/\s+/g, '') })} 
              />
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] font-black uppercase ${theme.textMuted} mb-1.5 ml-1`}>Plan</label>
                  <select 
                    className={`w-full p-3 rounded-xl font-bold uppercase text-xs border outline-none ${theme.input} focus:border-blue-500`} 
                    value={formBono.planOtorgado} 
                    onChange={e => setFormBono({ ...formBono, planOtorgado: e.target.value })}
                  >
                    <option value="comercio">Comercio</option>
                    <option value="pro">PRO Almacen</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-black uppercase ${theme.textMuted} mb-1.5 ml-1`}>Tiempo</label>
                  <select 
                    className={`w-full p-3 rounded-xl font-bold text-xs border outline-none ${theme.input} focus:border-blue-500`} 
                    value={formBono.diasOtorgados} 
                    onChange={e => setFormBono({ ...formBono, diasOtorgados: Number(e.target.value) })}
                  >
                    <option value={15}>15 Dias</option>
                    <option value={30}>1 Mes (30d)</option>
                    <option value={60}>2 Meses (60d)</option>
                    <option value={90}>3 Meses (90d)</option>
                    <option value={365}>1 Ano (365d)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase ${theme.textMuted} mb-1.5 ml-1`}>Correo Restringido (Opcional)</label>
                <input 
                  type="email" 
                  placeholder="cliente@correo.com" 
                  className={`w-full p-3.5 rounded-2xl font-medium border outline-none text-xs ${theme.input} focus:border-blue-500`} 
                  value={formBono.emailObjetivo} 
                  onChange={e => setFormBono({ ...formBono, emailObjetivo: e.target.value })} 
                />
                <p className="text-[10px] opacity-60 mt-1 ml-1">Si lo dejas vacio, cualquier persona podra usarlo.</p>
              </div>

              <div className={`p-4 rounded-2xl border ${theme.cardSubtle}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-0.5">
                    <input 
                      type="checkbox" 
                      checked={formBono.unSoloUso} 
                      onChange={e => setFormBono({ ...formBono, unSoloUso: e.target.checked })} 
                      className="w-5 h-5 accent-blue-600 rounded" 
                    />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${theme.textMain}`}>Codigo de Un Solo Uso</p>
                    <p className={`text-[11px] ${theme.textMuted} mt-0.5 leading-tight`}>
                      Se desactiva automaticamente tras el primer canje exitoso.
                    </p>
                  </div>
                </label>
              </div>

              <button 
                onClick={crearBono} 
                className="w-full py-4 font-black bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
              >
                Crear Codigo
              </button>
            </div>
          </div>
        )}

        {/* MODAL CREAR ANUNCIO */}
        {modalAnuncio && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-sm border space-y-3.5 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-center">
                <h3 className={`text-xl font-black ${theme.textMain}`}>Nuevo Anuncio</h3>
                <button 
                  onClick={() => setModalAnuncio(false)} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>
              
              <input 
                type="text" 
                placeholder="Titulo del anuncio..." 
                className={`w-full p-3.5 rounded-2xl font-bold border outline-none text-sm ${theme.input} focus:border-indigo-500`} 
                value={formAnuncio.titulo} 
                onChange={e => setFormAnuncio({ ...formAnuncio, titulo: e.target.value })} 
              />
              <textarea 
                placeholder="Mensaje descriptivo..." 
                rows={3}
                className={`w-full p-3.5 rounded-2xl font-medium border outline-none text-xs ${theme.input} focus:border-indigo-500`} 
                value={formAnuncio.mensaje} 
                onChange={e => setFormAnuncio({ ...formAnuncio, mensaje: e.target.value })} 
              />
              
              <select 
                className={`w-full p-3 rounded-2xl font-bold text-xs border outline-none ${theme.input} focus:border-indigo-500`} 
                value={formAnuncio.tipo} 
                onChange={e => setFormAnuncio({ ...formAnuncio, tipo: e.target.value })}
              >
                <option value="info">Informativo (Azul)</option>
                <option value="success">Novedad (Verde)</option>
                <option value="warning">Advertencia (Amarillo)</option>
                <option value="error">Critico (Rojo)</option>
              </select>

              <div>
                <label className={`block text-[10px] font-black uppercase ${theme.textMuted} mb-1 ml-1`}>Para usuario especifico (Opcional)</label>
                <input 
                  type="email" 
                  placeholder="cliente@correo.com" 
                  className={`w-full p-3 rounded-2xl font-medium border outline-none text-xs ${theme.input} focus:border-indigo-500`} 
                  value={formAnuncio.emailObjetivo} 
                  onChange={e => setFormAnuncio({ ...formAnuncio, emailObjetivo: e.target.value })} 
                />
              </div>

              <div className={`p-3 rounded-2xl border ${theme.cardSubtle}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formAnuncio.cerrable} 
                    onChange={e => setFormAnuncio({ ...formAnuncio, cerrable: e.target.checked })} 
                    className="w-4 h-4 accent-indigo-600 rounded mt-0.5" 
                  />
                  <div>
                    <p className={`font-bold text-xs ${theme.textMain}`}>Descartable por el usuario</p>
                    <p className={`text-[10px] ${theme.textMuted} leading-tight`}>Si se desmarca, se mantendra fijo en pantalla.</p>
                  </div>
                </label>
              </div>

              <button 
                onClick={crearAnuncio} 
                className="w-full py-3.5 font-black bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                Publicar Anuncio
              </button>
            </div>
          </div>
        )}

        {/* MODAL MASTER: RESTABLECER CONTRASEÑA O GENERAR ENLACE OFICIAL */}
        {modalResetPass.visible && modalResetPass.usuario && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-lg border space-y-4 sm:space-y-5 shadow-2xl relative max-h-[90dvh] overflow-y-auto overscroll-contain`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-black ${theme.textMain} flex items-center gap-2`}>
                    <KeyRound className="text-amber-500" size={22} />
                    Restablecer Contraseña
                  </h3>
                  <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                    Herramienta de soporte y recuperación para clientes
                  </p>
                </div>
                <button 
                  onClick={() => setModalResetPass(prev => ({ ...prev, visible: false, usuario: null, linkGenerado: "" }))} 
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Ficha rápida del Comerciante */}
              <div className={`p-4 rounded-2xl border ${theme.cardSubtle} space-y-2 text-xs`}>
                <div className="flex justify-between items-center">
                  <span className={theme.textMuted}>Comercio:</span>
                  <span className={`font-black ${theme.textMain}`}>{modalResetPass.usuario.nombreNegocio || modalResetPass.usuario.nombreUsuario}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={theme.textMuted}>Correo registrado:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{modalResetPass.usuario.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={theme.textMuted}>Telefono WhatsApp:</span>
                  <span className={`font-bold ${theme.textMain}`}>
                    {modalResetPass.usuario.telefonoNegocio || modalResetPass.usuario.celular || "No registrado"}
                  </span>
                </div>
              </div>

              {modalResetPass.error && (
                <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs font-bold text-center border border-rose-200 dark:border-rose-500/20">
                  {modalResetPass.error}
                </div>
              )}

              {/* OPCION 1: GENERAR ENLACE DIRECTO (IDEAL PARA WHATSAPP) */}
              <div className={`p-4 rounded-2xl border space-y-3 ${modoOscuro ? 'bg-amber-950/20 border-amber-500/30' : 'bg-amber-50/60 border-amber-200'}`}>
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${modoOscuro ? 'text-amber-300' : 'text-amber-900'}`}>
                    <Sparkles size={14} className="text-amber-500" /> Opcion 1: Enlace directo para WhatsApp o Chat
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Genera el enlace oficial seguro de Firebase. Si al comerciante no le llega el correo o esta en spam, puedes enviarselo directamente.
                  </p>
                </div>

                {!modalResetPass.linkGenerado ? (
                  <button
                    onClick={generarEnlaceReset}
                    disabled={modalResetPass.generando}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {modalResetPass.generando ? (
                      <div className="w-4 h-4 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                    ) : (
                      <KeyRound size={15} />
                    )}
                    <span>{modalResetPass.generando ? "Generando enlace..." : "Generar Enlace Oficial de Recuperacion"}</span>
                  </button>
                ) : (
                  <div className="space-y-2.5 animate-in fade-in duration-200">
                    <input
                      type="text"
                      readOnly
                      value={modalResetPass.linkGenerado}
                      className={`w-full p-2.5 rounded-xl border text-[11px] font-mono select-all outline-none ${theme.input}`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={copiarEnlaceReset}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                          modalResetPass.copiado
                            ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                            : (modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-800')
                        }`}
                      >
                        {modalResetPass.copiado ? <Check size={14} /> : <FileText size={14} />}
                        <span>{modalResetPass.copiado ? "Enlace Copiado!" : "Copiar Enlace"}</span>
                      </button>

                      {(modalResetPass.usuario.telefonoNegocio || modalResetPass.usuario.celular) && (
                        <button
                          onClick={enviarResetWhatsApp}
                          className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20ba59] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-[#25D366]/20 cursor-pointer"
                        >
                          <MessageCircle size={15} />
                          <span>Enviar por WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* OPCION 2: ENVIAR CORREO DIRECTO A SU BANDEJA */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${theme.cardSubtle}`}>
                <div>
                  <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${theme.textMain}`}>
                    <Mail size={14} className="text-blue-500" /> Opcion 2: Correo a su Bandeja de Entrada
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Dispara automaticamente el correo oficial de restablecimiento a la direccion registrada en su cuenta.
                  </p>
                </div>

                <button
                  onClick={enviarCorreoResetDirecto}
                  disabled={modalResetPass.enviandoCorreo || modalResetPass.correoEnviado}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition active:scale-98 cursor-pointer disabled:opacity-50 ${
                    modalResetPass.correoEnviado
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : (modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300')
                  }`}
                >
                  {modalResetPass.enviandoCorreo ? (
                    <div className="w-4 h-4 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
                  ) : modalResetPass.correoEnviado ? (
                    <Check size={14} className="text-emerald-500" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>
                    {modalResetPass.enviandoCorreo 
                      ? "Enviando correo..." 
                      : modalResetPass.correoEnviado 
                      ? "Correo enviado a su bandeja!" 
                      : "Enviar Correo de Restablecimiento"}
                  </span>
                </button>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setModalResetPass(prev => ({ ...prev, visible: false, usuario: null, linkGenerado: "" }))}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ELIMINAR NEGOCIO DEFINITIVAMENTE (PURGA EN CASCADA) */}
        {modalEliminar.visible && modalEliminar.usuario && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in">
            <div className={`${theme.modalBg} rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 w-full max-w-lg border border-rose-500/30 space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl`}>
              <div className="flex justify-between items-center pb-2 border-b border-rose-500/20">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-500">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400">
                      Eliminar Negocio Definitivamente
                    </h3>
                    <p className={`text-xs ${theme.textMuted}`}>Purga irreversible de todos los datos</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalEliminar({ visible: false, usuario: null, confirmacionTexto: '', eliminando: false, error: null })}
                  className={`p-2 rounded-full cursor-pointer ${modoOscuro ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Informacion del negocio */}
              <div className={`p-3.5 rounded-2xl border ${theme.cardSubtle} text-xs space-y-1`}>
                <p className={`font-bold ${theme.textMain} text-sm`}>
                  {modalEliminar.usuario.nombreNegocio || "Negocio sin nombre"}
                </p>
                <p className={theme.textMuted}>
                  <strong>Titular:</strong> {modalEliminar.usuario.nombreUsuario || "No especificado"}
                </p>
                <p className={`${theme.textMuted} break-all`}>
                  <strong>Correo:</strong> {modalEliminar.usuario.email || "No registrado"}
                </p>
              </div>

              {/* Alerta de destrucción en cascada */}
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert size={15} />
                  Esta operacion no se puede deshacer y eliminara permanentemente:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] opacity-90">
                  <li>La cuenta de Firebase Authentication (correo y contrasena).</li>
                  <li>Todos los colaboradores y cajeros registrados en este comercio.</li>
                  <li>Todo su inventario y catalogo de productos.</li>
                  <li>Todos los clientes, deudas registradas y saldos a favor.</li>
                  <li>Todos los movimientos de caja, ventas, separes y facturas.</li>
                </ul>
              </div>

              {/* Input de confirmación estricta */}
              <div className="space-y-2 pt-1">
                <label className={`block text-xs font-bold ${theme.textMain}`}>
                  Para autorizar la eliminacion definitiva, escribe exactamente la palabra <span className="font-mono text-rose-600 dark:text-rose-400 font-black">ELIMINAR</span>:
                </label>
                <input
                  type="text"
                  value={modalEliminar.confirmacionTexto}
                  onChange={(e) => setModalEliminar(prev => ({ ...prev, confirmacionTexto: e.target.value, error: null }))}
                  placeholder="Escribe ELIMINAR"
                  autoFocus
                  className={`w-full p-3 rounded-xl border text-sm font-black outline-none tracking-wider uppercase transition ${theme.input} focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20`}
                />
                {modalEliminar.error && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {modalEliminar.error}
                  </p>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalEliminar({ visible: false, usuario: null, confirmacionTexto: '', eliminando: false, error: null })}
                  disabled={modalEliminar.eliminando}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${
                    modoOscuro ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarEliminacionDefinitiva}
                  disabled={modalEliminar.confirmacionTexto.trim().toUpperCase() !== 'ELIMINAR' || modalEliminar.eliminando}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/30 disabled:text-rose-300 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-rose-600/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  {modalEliminar.eliminando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Purgando datos...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>Confirmar Purga Definitiva</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
