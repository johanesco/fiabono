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

  // Si está validando la sesión existente, mostramos un splash nativo limpio para evitar parpadeos de la landing
  if (cargando) {
    return (
      <div className="min-h-screen w-full bg-[#020617] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <span className="text-2xl font-black">F</span>
        </div>
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 tracking-wide">Abriendo Fiabono...</p>
      </div>
    );
  }

  // Si no hay sesión, mostramos la experiencia de bienvenida / landing
  return <LandingPage />;
}
