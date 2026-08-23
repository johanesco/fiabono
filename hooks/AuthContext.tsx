"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useRouter, usePathname } from "next/navigation";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [datosSesion, setDatosSesion] = useState<any>(null);
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
        if (!userDoc.exists()) throw new Error("No existe");
        
        const data = userDoc.data();
        if (data.rol === 'cajero' && data.activo === false) throw new Error("Inactivo");

        let idParaConsultar = user.uid;
        let adminData = data;

        if (data.rol === 'cajero') {
          idParaConsultar = data.adminId;
          const adminDoc = await getDoc(doc(db, "usuarios", idParaConsultar));
          if (adminDoc.exists()) adminData = adminDoc.data();
        }

        // Validar expiración plan
        let planActual = adminData.plan || 'basico';
        let diasPro = null;
        let avisoExpiracion = false;

        if (planActual === 'pro' && adminData.planVence) {
          const timeRemaining = adminData.planVence.toDate().getTime() - new Date().getTime();
          const daysLeft = Math.ceil(timeRemaining / (1000 * 3600 * 24));
          if (daysLeft <= 0) {
            planActual = 'basico';
            await updateDoc(doc(db, "usuarios", idParaConsultar), { plan: 'basico' });
          } else {
            diasPro = daysLeft;
            if (daysLeft <= 5) avisoExpiracion = true;
          }
        }

        const esAdmin = data.rol !== 'cajero';
        const permisos = data.permisos || null;
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
          // Helpers derivados de permisos para uso fácil en páginas
          esAdmin,
          puedeVentaDirecta: esAdmin || permisos?.ventaDirecta === true,
          puedeAbonar: esAdmin || permisos?.abonar === true,
          puedeEditarInventario: esAdmin || permisos?.editarInventario === true,
          puedeModificarPrecios: esAdmin || permisos?.modificarPrecios === true,
          puedeAplicarDescuentos: esAdmin || permisos?.aplicarDescuentos === true,
          esTerminalMultivendedor: permisos?.terminalMultivendedor === true,
          planActual,
          diasPro,
          avisoExpiracion,
          datosUsuarioOriginales: data
        });
      } catch (e) {
        await signOut(auth);
        router.push('/');
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

export const useAuth = () => useContext(AuthContext);