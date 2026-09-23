"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useRouter, usePathname } from "next/navigation";
import { DatosSesionContext, UsuarioBD } from "../types";
import toast from "react-hot-toast";
import ModalAccesoColaborador, { BloqueoColaboradorInfo } from "@/components/ModalAccesoColaborador";

interface AuthContextType {
  datosSesion: DatosSesionContext | null;
  cargando: boolean;
  setDatosSesion: React.Dispatch<React.SetStateAction<DatosSesionContext | null>>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [datosSesion, setDatosSesion] = useState<DatosSesionContext | null>(null);
  const [cargando, setCargando] = useState(true);
  const [bloqueoColaborador, setBloqueoColaborador] = useState<BloqueoColaboradorInfo | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setDatosSesion(null);
        setCargando(false);
        // Si intenta entrar al dashboard sin sesión, lo patea a la landing
        if (pathname?.includes('/dashboard')) {
           router.push('/');
        }
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists()) {
          // Si estamos fuera del dashboard (ej. en la landing completando el registro con Google),
          // simplemente dejamos la sesión local limpia para que el onboarding fluya.
          setDatosSesion(null);
          setCargando(false);
          if (pathname?.includes('/dashboard')) {
            await signOut(auth);
            router.push('/');
          }
          return;
        }
        
        const data = userDoc.data();
        let idParaConsultar = user.uid;
        let adminData = data;

        if (data.rol === 'cajero') {
          idParaConsultar = data.adminId;
          const adminDoc = await getDoc(doc(db, "usuarios", idParaConsultar));
          if (adminDoc.exists()) {
            adminData = adminDoc.data();
          } else {
            throw new Error("NegocioNoExiste");
          }

          const telefonoAdmin = adminData.telefonoNegocio || adminData.celular || adminData.telefono || "";
          const nombreNegocio = adminData.nombreNegocio || adminData.nombre || "tu negocio";
          const nombreColaborador = data.nombre || data.nombreUsuario || data.displayName || "Colaborador";

          // 1. Verificación si el colaborador está deshabilitado / inactivo
          if (data.activo === false) {
            setBloqueoColaborador({
              motivo: 'inactivo',
              nombreColaborador,
              nombreNegocio,
              telefonoAdmin,
            });
            setCargando(false);
            setDatosSesion(null);
            return;
          }

          // 2. Verificación de Horarios de Actividad (si fueron configurados)
          if (Array.isArray(data.horariosActividad) && data.horariosActividad.length > 0) {
            const tieneHorariosValidos = data.horariosActividad.some((h: any) => h?.activoAuto !== false);
            if (tieneHorariosValidos) {
              const nombresDias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
              const ahora = new Date();
              const diaHoy = nombresDias[ahora.getDay()];
              const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

              const dentroDeHorario = data.horariosActividad.some((h: any) => {
                if (h?.activoAuto === false) return false;
                const dias = h.dias || [];
                if (!dias.includes(diaHoy)) return false;
                const inicio = h.inicio || '00:00';
                const fin = h.fin || '23:59';
                return inicio <= horaActual && horaActual < fin;
              });

              if (!dentroDeHorario && data.manualOverride !== true) {
                setBloqueoColaborador({
                  motivo: 'fuera_de_horario',
                  nombreColaborador,
                  nombreNegocio,
                  telefonoAdmin,
                  horarios: data.horariosActividad,
                });
                setCargando(false);
                setDatosSesion(null);
                return;
              }
            }
          }

          // Validar si el negocio está en plan gratuito (no permite colaboradores)
          let planAdmin = (adminData.plan || 'gratis').toLowerCase();
          if (planAdmin === 'basico') planAdmin = 'gratis';

          if ((planAdmin === 'pro' || planAdmin === 'comercio') && adminData.planVence) {
            const timeVence = adminData.planVence.toDate ? adminData.planVence.toDate().getTime() : new Date(adminData.planVence).getTime();
            const timeRemaining = timeVence - new Date().getTime();
            const daysLeft = Math.ceil(timeRemaining / (1000 * 3600 * 24));
            if (daysLeft <= 0) {
              planAdmin = 'gratis';
              // PARCHE P1-AUTH: Un colaborador NO debe intentar escribir en el
              // documento del admin (eso viola las reglas y arrojaba permission-denied).
              // El downgrade persistente lo hace el admin al iniciar sesión.
            }
          }

          // REGLA CRÍTICA DE NEGOCIO: Si el negocio está en Plan Gratis, el colaborador no puede acceder
          if (planAdmin === 'gratis') {
            throw new Error("PlanGratisSinColaboradores");
          }
        }

        // Si pasa todas las validaciones, despejamos cualquier bloqueo previo
        setBloqueoColaborador(null);

        // Validar expiración plan de la cuenta principal
        let planRaw = (adminData.plan || 'gratis').toLowerCase();
        if (planRaw === 'basico') planRaw = 'gratis';
        let planActual = planRaw; // 'gratis' | 'comercio' | 'pro'
        let diasRestantesPlan = null;
        let avisoExpiracion = false;

        if ((planActual === 'pro' || planActual === 'comercio') && adminData.planVence) {
          const timeVence = adminData.planVence.toDate ? adminData.planVence.toDate().getTime() : new Date(adminData.planVence).getTime();
          const timeRemaining = timeVence - new Date().getTime();
          const daysLeft = Math.ceil(timeRemaining / (1000 * 3600 * 24));
          
          // Si el plan venció hace MÁS de 2 días, forzar downgrade
          if (daysLeft < -2) {
            const nuevoPlan: 'gratis' | 'comercio' = (adminData.proximoPlan === 'comercio') ? 'comercio' : 'gratis';
            planActual = nuevoPlan;
            if (data.rol !== 'cajero') {
              await updateDoc(doc(db, "usuarios", idParaConsultar), { 
                plan: nuevoPlan, 
                planVence: null,
                proximoPlan: null
              });

              // Desactivar colaboradores según el nuevo plan
              if (nuevoPlan === 'gratis') {
                const qColabs = query(
                  collection(db, "usuarios"),
                  where("adminId", "==", idParaConsultar),
                  where("rol", "==", "cajero")
                );
                const snapColabs = await getDocs(qColabs);
                const desactivaciones = snapColabs.docs.map(d =>
                  updateDoc(doc(db, "usuarios", d.id), { activo: false })
                );
                await Promise.all(desactivaciones);
              } else if (nuevoPlan === 'comercio') {
                // En plan comercio solo se permite 1 colaborador activo
                const qColabs = query(
                  collection(db, "usuarios"),
                  where("adminId", "==", idParaConsultar),
                  where("rol", "==", "cajero"),
                  where("activo", "==", true)
                );
                const snapColabs = await getDocs(qColabs);
                if (snapColabs.docs.length > 1) {
                  const sobrantes = snapColabs.docs.slice(1);
                  await Promise.all(sobrantes.map(d => updateDoc(doc(db, "usuarios", d.id), { activo: false })));
                }
              }
            }
          } else {
            diasRestantesPlan = daysLeft;
            if (daysLeft <= 8) avisoExpiracion = true;
          }
        }

        const esAdmin = data.rol !== 'cajero';
        const permisos = data.permisos || null;
        const esGratis = planActual === 'gratis';
        const esComercio = planActual === 'comercio';
        const esPro = planActual === 'pro';
        const enPeriodoGracia = diasRestantesPlan !== null && diasRestantesPlan <= 0 && diasRestantesPlan >= -2;

        setDatosSesion({
          uid: user.uid,
          cuentaPrincipalId: idParaConsultar,
          nombreUsuario: data.nombreUsuario,
          nombreNegocio: adminData.nombreNegocio,
          telefonoNegocio: adminData.telefonoNegocio || "",
          telefonoAdmin: adminData.telefonoNegocio || adminData.celular || adminData.telefono || "",
          correoNegocio: adminData.email || user.email || "",
          logoNegocio: adminData.logoNegocio || null,
          nitNegocio: adminData.nitNegocio || "",
          direccionNegocio: adminData.direccionNegocio || "",
          mensajePieTicket: adminData.mensajePieTicket || "",
          mediosPago: adminData.mediosPago || {},
          habilitarIva: adminData.habilitarIva || false,
          porcentajeIva: typeof adminData.porcentajeIva === 'number' ? adminData.porcentajeIva : 19,
          rol: data.rol,
          permisos,
          // Helpers derivados de permisos y planes
          esAdmin,
          puedeVentaDirecta: esAdmin || permisos?.ventaDirecta === true,
          puedeAbonar: esAdmin || permisos?.abonar === true,
          puedeEditarInventario: esAdmin || permisos?.editarInventario === true,
          puedeModificarPrecios: esAdmin || permisos?.modificarPrecios === true,
          puedeAplicarDescuentos: esAdmin || permisos?.aplicarDescuentos === true,
          puedeEnviarWhatsApp: esAdmin || (data.esCajaMostrador === true ? permisos?.enviarWhatsApp !== false : permisos?.enviarWhatsApp === true),
          puedeVerCartera: esAdmin || permisos?.verCartera === true,
          puedeVerDirectorio: esAdmin || permisos?.verDirectorio === true,
          puedeVerReportes: esAdmin || permisos?.verReportes === true,
          esCajaMostrador: data.esCajaMostrador === true,
          esTerminalMultivendedor: esPro && (data.esCajaMostrador === true || permisos?.terminalMultivendedor === true || esAdmin),
          puedeSepare: esPro && (permisos?.planSepare !== false),
          tipoUsuario: data.rol === 'cajero' ? 'colaborador' : 'principal',
          planActual,
          proximoPlan: adminData.proximoPlan || null,
          esGratis,
          esComercio,
          esPro,
          puedeFacturaImprimible: !esGratis,
          puedeExcel: esPro,
          puedeEtiquetasQR: esPro,
          puedeLogoFactura: true,
          limiteColaboradores: esPro ? 4 : (esComercio ? 1 : 0),
          limiteClientes: esGratis ? 15 : Infinity,
          limiteProductos: esGratis ? 30 : Infinity,
          limiteTransaccionesMes: esGratis ? 40 : Infinity,
          diasPro: diasRestantesPlan,
          diasRestantesPlan,
          avisoExpiracion,
          enPeriodoGracia,
          tipoNegocio: adminData.tipoNegocio || "Comercio",
          moduloSepareActivo: adminData.moduloSepareActivo !== false,
          slugNegocio: adminData.slugNegocio || "",
          datosUsuarioOriginales: data as UsuarioBD
        });
      } catch (e: any) {
        console.error("Error validando sesión:", e);
        // Desloguear con mensaje explicativo si el acceso está revocado o bloqueado
        if (
          e.message === "No existe" || 
          e.message === "Inactivo" || 
          e.message === "NegocioNoExiste" || 
          e.message === "PlanGratisSinColaboradores" ||
          e.message === "FueraDeHorario" ||
          e.code === "permission-denied"
        ) {
          if (e.message === "PlanGratisSinColaboradores") {
            toast.error("El negocio se encuentra en Plan Gratuito. El administrador debe activar el Plan Comercio o PRO para permitir el acceso de colaboradores.", { duration: 6000 });
          } else if (e.message === "Inactivo") {
            toast.error("Tu cuenta de colaborador ha sido deshabilitada por el administrador.", { duration: 5000 });
          } else if (e.message === "FueraDeHorario") {
            toast.error("Tu acceso no está permitido fuera del horario laboral configurado.", { duration: 5000 });
          } else if (e.message === "NegocioNoExiste" || e.message === "No existe") {
            toast.error("Usuario o negocio no encontrado.", { duration: 4000 });
          } else if (e.code === "permission-denied") {
            toast.error("Tu acceso ha sido restringido o no tienes permisos en este negocio.", { duration: 5000 });
          }

          await signOut(auth);
          setDatosSesion(null);
          router.push('/');
        }
      }
      setCargando(false);
    });

    return () => unsubscribe();
  // OPT-07: El listener de onAuthStateChanged se monta UNA SOLA VEZ (deps=[]).
  // Esto evita re-suscripciones y lecturas extra de Firestore en cada navegación.
  // La lógica de redirección por pathname se maneja en un useEffect separado abajo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OPT-07: useEffect separado para proteger rutas sin relanzar el listener de Auth
  useEffect(() => {
    if (!cargando && !datosSesion && !bloqueoColaborador && pathname?.includes('/dashboard')) {
      router.push('/');
    }
  }, [pathname, cargando, datosSesion, bloqueoColaborador, router]);

  // Monitoreo en tiempo real cada 60s si un colaborador activo finaliza su turno laboral mientras trabaja
  useEffect(() => {
    if (!datosSesion || datosSesion.rol !== 'cajero') return;

    const verificarHorarioEnVivo = () => {
      const orig = datosSesion.datosUsuarioOriginales;
      if (!orig) return;

      if (orig.activo === false) {
        setBloqueoColaborador({
          motivo: 'inactivo',
          nombreColaborador: orig.nombre || orig.nombreUsuario || 'Colaborador',
          nombreNegocio: datosSesion.nombreNegocio || 'tu negocio',
          telefonoAdmin: datosSesion.telefonoAdmin || datosSesion.telefonoNegocio || '',
        });
        return;
      }

      if (Array.isArray(orig.horariosActividad) && orig.horariosActividad.length > 0) {
        const tieneHorariosValidos = orig.horariosActividad.some((h: any) => h?.activoAuto !== false);
        if (tieneHorariosValidos && orig.manualOverride !== true) {
          const nombresDias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
          const ahora = new Date();
          const diaHoy = nombresDias[ahora.getDay()];
          const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

          const dentroDeHorario = orig.horariosActividad.some((h: any) => {
            if (h?.activoAuto === false) return false;
            const dias = h.dias || [];
            if (!dias.includes(diaHoy)) return false;
            const inicio = h.inicio || '00:00';
            const fin = h.fin || '23:59';
            return inicio <= horaActual && horaActual < fin;
          });

          if (!dentroDeHorario) {
            setBloqueoColaborador({
              motivo: 'fuera_de_horario',
              nombreColaborador: orig.nombre || orig.nombreUsuario || 'Colaborador',
              nombreNegocio: datosSesion.nombreNegocio || 'tu negocio',
              telefonoAdmin: datosSesion.telefonoAdmin || datosSesion.telefonoNegocio || '',
              horarios: orig.horariosActividad,
            });
          }
        }
      }
    };

    const intervalId = setInterval(verificarHorarioEnVivo, 60000);
    return () => clearInterval(intervalId);
  }, [datosSesion]);

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      setDatosSesion(null);
      router.push('/');
    } catch (e) {
      console.error('Error al cerrar sesión', e);
    }
  };

  const handleCerrarSesionBloqueo = async () => {
    setBloqueoColaborador(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error al cerrar sesión de bloqueo:', e);
    }
    setDatosSesion(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ datosSesion, cargando, setDatosSesion, cerrarSesion }}>
      {children}
      <ModalAccesoColaborador
        info={bloqueoColaborador}
        onCerrarSesion={handleCerrarSesionBloqueo}
      />
    </AuthContext.Provider>
  );
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};