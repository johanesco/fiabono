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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Si inició sesión con éxito, lo mandamos al panel seguro
        router.push('/dashboard/inicio');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Si no hay sesión, mostramos la Landing Page que aislamos
  return <LandingPage />;
}