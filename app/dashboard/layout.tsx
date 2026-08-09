"use client";
import { useState } from "react";
import { AuthProvider, useAuth } from "../../hooks/AuthContext";
import Sidebar from "../../components/Sidebar";
import BottomNav from "../../components/BottomNav";

function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const { datosSesion, cargando } = useAuth();
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  if (cargando) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500 bg-slate-50 dark:bg-[#020617]">Cargando...</div>;
  }

  if (!datosSesion) return null; 

  const puedeVerReportes = datosSesion.rol !== 'cajero' || datosSesion.permisos?.verReportes === true;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#020617] relative">
      
      {/* 1. Barra lateral fija (Solo PC) */}
      <Sidebar 
        sidebarAbierto={sidebarAbierto} 
        setSidebarAbierto={setSidebarAbierto} 
        puedeVerReportes={puedeVerReportes} 
        nombreNegocio={datosSesion.nombreNegocio} 
      />

      {/* 2. Contenedor principal de la derecha */}
      <main className="flex-1 overflow-y-auto pb-28 md:pb-12 p-4 sm:p-8 flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
           {children}
        </div>
      </main>

      {/* 3. Menú inferior móvil */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNav puedeVerReportes={puedeVerReportes} />
      </div>

    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardWrapper>{children}</DashboardWrapper>
    </AuthProvider>
  );
}