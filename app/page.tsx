"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LandingPage from "../components/LandingPage";
import { useAuth } from "../hooks/AuthContext";
import { IsotipoFiabono } from "@/components/LogoFiabono";

export default function Home() {
  const router = useRouter();
  const { datosSesion, cargando } = useAuth();

  useEffect(() => {
    if (!cargando && datosSesion) router.replace('/dashboard/inicio');
  }, [cargando, datosSesion, router]);

  // Mientras se valida la sesión, o si ya hay sesión y estamos redirigiendo al panel,
  // mostramos un splash limpio. Así la landing NUNCA aparece de reojo a un usuario con sesión activa.
  if (cargando || datosSesion) {
    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-[#020617] flex flex-col items-center justify-center gap-5 text-slate-800 dark:text-white transition-colors duration-200">
        <div className="animate-pulse">
          <IsotipoFiabono size={64} />
        </div>
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wide">
          {datosSesion ? 'Entrando a tu negocio...' : 'Abriendo Fiabono...'}
        </p>
      </div>
    );
  }

  // Si no hay sesión, mostramos la experiencia de bienvenida / landing
  return <LandingPage />;
}
