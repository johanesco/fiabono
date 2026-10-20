"use client";
import { useMemo, useState } from "react";
import { Crown, FolderTree } from "lucide-react";
import { Movimiento } from "@/types";
import { calcularRendimientoProductos } from "@/utils/analiticaProductos";
import PanelProductosEstrella from "./PanelProductosEstrella";
import PanelCategorias from "./PanelCategorias";

interface Props {
  movimientos: Movimiento[];
  todosMovimientos: Movimiento[];
  inventario: any[];
  periodoLabel: string;
}

/** Calcula el rendimiento una sola vez y lo comparte entre Productos y Categorías. */
export default function VistaProductos({ movimientos, todosMovimientos, inventario, periodoLabel }: Props) {
  const [sub, setSub] = useState<"productos" | "categorias">("productos");

  const resumen = useMemo(
    () => calcularRendimientoProductos(movimientos, todosMovimientos, inventario),
    [movimientos, todosMovimientos, inventario]
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex shrink-0 bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl w-full sm:w-fit border border-slate-200/60 dark:border-slate-800/60">
        {([
          { id: "productos", label: "Productos estrella", icon: Crown },
          { id: "categorias", label: "Categorías", icon: FolderTree },
        ] as const).map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => setSub(v.id)}
            className={`flex-1 sm:flex-initial shrink-0 px-4 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-2 ${
              sub === v.id
                ? "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <v.icon size={14} /> {v.label}
          </button>
        ))}
      </div>

      {sub === "productos" ? (
        <PanelProductosEstrella resumen={resumen} periodoLabel={periodoLabel} />
      ) : (
        <PanelCategorias resumen={resumen} periodoLabel={periodoLabel} />
      )}
    </div>
  );
}
