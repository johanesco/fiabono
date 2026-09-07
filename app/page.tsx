"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import LandingPage from "../components/LandingPage";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Escuchamos si Firebase detecta una sesión activa
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Solo redirigir al dashboard si ya tiene negocio/cuenta creada en Firestore.
        // Si no tiene negocio aún, el usuario se queda en la landing completando el onboarding.
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("../firebase");
          const userDoc = await getDoc(doc(db, "usuarios", user.uid));
          if (userDoc.exists()) {
            router.push('/dashboard/inicio');
          }
        } catch (e) {
          // Si hay error de lectura, no forzar redirección
          console.error("Error verificando usuario:", e);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Si no hay sesión, mostramos la Landing Page que aislamos
  return <LandingPage />;
}