"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { API_DB } from "../../../servicios/db";

export default function SeedPromoPage() {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const codigo = "PRO2026";
      const resultado = await API_DB.crearCodigoPromocional(codigo, { activo: true, descuento: '1mes', creadoEn: new Date() });
      if (resultado.ok) {
        toast.success(`Código ${codigo} creado correctamente.`);
        setCreated(true);
      } else {
        toast.error("No se pudo crear el código promocional.");
      }
    } catch (e) {
      toast.error("Error inesperado al crear el código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white dark:bg-[#0f172a] p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800">
        <h1 className="text-2xl font-black mb-4">Seed: Código PROM</h1>
        <p className="text-sm text-slate-500 mb-6">Este botón crea un código de prueba <strong>PRO2026</strong> en la colección <em>codigos_promocionales</em>. Abre esta página estando autenticado como administrador.</p>
        <button
          onClick={handleCreate}
          disabled={loading || created}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Creando...' : (created ? 'Código creado' : 'Crear PRO2026')}
        </button>
        <p className="text-xs text-slate-400 mt-4">Después de crear el código, ve a Reportes y canjéalo desde el modal.</p>
      </div>
    </div>
  );
}
