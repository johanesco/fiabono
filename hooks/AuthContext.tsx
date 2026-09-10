"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useRouter, usePathname } from "next/navigation";
import { DatosSesionContext, UsuarioBD } from "../types";
import toast from "react-hot-toast";

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
        if (data.rol === 'cajero' && data.activo === false) throw new Error("Inactivo");

        // Validación dinámica en tiempo real de Horarios de Actividad (si fueron configurados)
        if (data.rol === 'cajero' && Array.isArray(data.horariosActividad) && data.horariosActividad.length > 0) {
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
              throw new Error("FueraDeHorario");
            }
          }
        }

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
            planActual = 'gratis';
            await updateDoc(doc(db, "usuarios", idParaConsultar), { plan: 'gratis' });
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
          correoNegocio: adminData.email || user.email || "",
          logoNegocio: adminData.logoNegocio || null,
          nitNegocio: adminData.nitNegocio || "",
          direccionNegocio: adminData.direccionNegocio || "",
          mensajePieTicket: adminData.mensajePieTicket || "",
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
          esTerminalMultivendedor: esPro && (permisos?.terminalMultivendedor === true || esAdmin),
          puedeSepare: esPro && (permisos?.planSepare !== false),
          tipoUsuario: data.rol === 'cajero' ? 'colaborador' : 'principal',
          planActual,
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
  }, [router, pathname]);

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      setDatosSesion(null);
      router.push('/');
    } catch (e) {
      console.error('Error al cerrar sesión', e);
    }
  };

  return (
    <AuthContext.Provider value={{ datosSesion, cargando, setDatosSesion, cerrarSesion }}>
      {children}
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