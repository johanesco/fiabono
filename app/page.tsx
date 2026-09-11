"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "../components/LandingPage";
import { useAuth } from "../hooks/AuthContext";

export default function Home() {
  const router = useRouter();
  const { datosSesion, cargando } = useAuth();

  useEffect(() => {
    if (!cargando && datosSesion) router.replace('/dashboard/inicio');
  }, [cargando, datosSesion, router]);

  // Si no hay sesión, mostramos la Landing Page que aislamos
  return <LandingPage />;
}