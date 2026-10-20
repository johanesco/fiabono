"use client";
import { useMemo, useState } from "react";
import { ChevronDown, FolderTree, PieChart, TrendingUp, TrendingDown, Sparkles, AlertTriangle, Package } from "lucide-react";
import { agruparPorCategoria, CategoriaStat, ResumenProductos } from "@/utils/analiticaProductos";

type Metrica = "ingresos" | "unidades" | "utilidad" | "margen";

interface Props {
  resumen: ResumenProductos;
  periodoLabel: string;
}

const dinero = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CO")}`;
const pct = (n: number, d = 1) => `${n.toFixed(d).replace(".", ",")}%`;

const METRICAS: { id: Metrica; label: string }[] = [
  { id: "ingresos", label: "Facturado" },
  { id: "unidades", label: "Unidades" },
  { id: "utilidad", label: "Utilidad" },
  { id: "margen", label: "Margen %" },
];

const PALETA = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4"];
const COLOR_OTRAS = "#94a3b8";

const colorMargen = (m: number | null) =>
  m === null ? "text-slate-400" : m >= 30 ? "text-emerald-600 dark:text-emerald-400" : m >= 15 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

export default function PanelCategorias({ resumen, periodoLabel }: Props) {
  const [metrica, setMetrica] = useState<Metrica>("ingresos");
  const [expandido, setExpandido] = useState<string | null>(null);

  const categorias = useMemo(() => agruparPorCategoria(resumen.productos), [resumen]);

  const valorDe = (c: CategoriaStat): number | null =>
    metrica === "unidades" ? c.unidades
    : metrica === "ingresos" ? c.ingresos
    : metrica === "utilidad" ? c.utilidad
    : c.margen;

  const ranking = useMemo(() => {
    return categorias
      .filter(c => {
        const v = valorDe(c);
        return v !== null && (metrica === "margen" ? true : v > 0);
      })
      .sort((a, b) => (valorDe(b) as number) - (valorDe(a) as number));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias, metrica]);

  const sinDatoCosto = metrica === "utilidad" || metrica === "margen" ? categorias.filter(c => valorDe(c) === null).length : 0;
  const maxValor = ranking.length ? Math.max(...ranking.map(c => Math.abs(valorDe(c) as number)), 1) : 1;
  const totalMetrica = metrica === "margen" ? 0 : ranking.reduce((a, c) => a + (valorDe(c) as number), 0);

  const formatear = (v: number) =>
    metrica === "unidades" ? `${Math.round(v).toLocaleString("es-CO")} un.` : metrica === "margen" ? pct(v) : dinero(v);

  // Distribución por facturación (donut): top 5 + Otras
  const donut = useMemo(() => {
    const lista = categorias.filter(c => c.ingresos > 0).sort((a, b) => b.ingresos - a.ingresos);
    const total = lista.reduce((a, c) => a + c.ingresos, 0);
    if (total <= 0) return null;
    const top = lista.slice(0, 5);
    const resto = lista.slice(5).reduce((a, c) => a + c.ingresos, 0);
    const items = top.map((c, i) => ({ nombre: c.nombre, valor: c.ingresos, color: PALETA[i] }));
    if (resto > 0) items.push({ nombre: `Otras (${lista.length - 5})`, valor: resto, color: COLOR_OTRAS });
    let acc = 0;
    const tramos = items.map(it => {
      const ini = (acc / total) * 100;
      acc += it.valor;
      return `${it.color} ${ini}% ${(acc / total) * 100}%`;
    });
    return { items, total, gradiente: `conic-gradient(${tramos.join(", ")})` };
  }, [categorias]);

  // Insights
  const conMargen = categorias.filter(c => c.margen !== null && c.ingresosConCosto > 0);
  const masRentable = [...categorias].filter(c => c.utilidad !== null).sort((a, b) => (b.utilidad as number) - (a.utilidad as number))[0];
  const mejorMargen = [...conMargen].sort((a, b) => (b.margen as number) - (a.margen as number))[0];
  const peorMargen = conMargen.length > 1 ? [...conMargen].sort((a, b) => (a.margen as number) - (b.margen as number))[0] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
      {/* RANKING DE CATEGORÍAS */}
      <div className="lg:col-span-2 bg-white dark:bg-[#0f172a] p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FolderTree className="text-indigo-500 shrink-0" size={24} /> Rendimiento por Categoría
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Qué categorías venden y ganan más ({periodoLabel}). Toca una para ver su detalle.
            </p>
          </div>
          <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-w-full w-fit">
            {METRICAS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMetrica(m.id); setExpandido(null); }}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  metrica === m.id
                    ? "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm font-medium flex flex-col items-center gap-2">
            <Package size={32} className="opacity-50" />
            {metrica === "utilidad" || metrica === "margen"
              ? "Aún no hay ventas con costo registrado en este periodo para calcular rentabilidad."
              : `No hay ventas registradas en el periodo seleccionado (${periodoLabel}).`}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ranking.map((c, i) => {
              const v = valorDe(c) as number;
              const share = totalMetrica > 0 ? (v / totalMetrica) * 100 : 0;
              const abierto = expandido === c.clave;
              const totalCanal = c.ingresosContado + c.ingresosFiado + c.ingresosSepare;
              const pc = (x: number) => (totalCanal > 0 ? (x / totalCanal) * 100 : 0);

              return (
                <div
                  key={c.clave}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    abierto
                      ? "border-indigo-500/50 bg-slate-50 dark:bg-[#020617]"
                      : "border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-[#020617]/60 hover:border-indigo-500/40"
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={abierto}
                    onClick={() => setExpandido(abierto ? null : c.clave)}
                    className="w-full flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-4 text-left cursor-pointer"
                  >
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-sm sm:text-base shadow-sm shrink-0 ${
                      i === 0 ? "bg-indigo-600 text-white" : i === 1 ? "bg-indigo-400 text-white" : i === 2 ? "bg-indigo-300 text-indigo-950" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                      #{i + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base break-words leading-tight">{c.nombre}</p>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        {c.productosDistintos} {c.productosDistintos === 1 ? "producto" : "productos"} · {Math.round(c.unidades).toLocaleString("es-CO")} un.
                      </p>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600"
                          style={{ width: `${Math.max(3, (Math.abs(v) / maxValor) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-sm sm:text-lg font-black whitespace-nowrap ${metrica === "margen" ? colorMargen(v) : "text-indigo-600 dark:text-indigo-400"}`}>{formatear(v)}</p>
                      {metrica !== "margen" && (
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold">{pct(share)} del total</p>
                      )}
                    </div>
                    <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
                  </button>

                  {abierto && (
                    <div className="px-3 sm:px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-150 flex flex-col gap-2.5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { l: "Facturado", v: dinero(c.ingresos) },
                          { l: "Costo", v: c.ingresosConCosto > 0 ? dinero(c.costo) : "Sin costo" },
                          { l: "Utilidad", v: c.utilidad !== null ? dinero(c.utilidad) : "—" },
                          { l: "Margen", v: c.margen !== null ? pct(c.margen) : "—", cls: colorMargen(c.margen) },
                        ].map(d => (
                          <div key={d.l} className="bg-white dark:bg-[#0f172a] rounded-xl p-2.5 border border-slate-100 dark:border-slate-800/60 min-w-0">
                            <p className="text-[10px] font-extrabold uppercase text-slate-400">{d.l}</p>
                            <p className={`text-sm font-black break-words ${d.cls || "text-slate-900 dark:text-white"}`}>{d.v}</p>
                          </div>
                        ))}
                      </div>

                      <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
                        <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Cómo se vendió (dinero)</p>
                        {totalCanal > 0 ? (
                          <>
                            <div className="flex h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                              <div className="bg-emerald-500" style={{ width: `${pc(c.ingresosContado)}%` }} />
                              <div className="bg-amber-500" style={{ width: `${pc(c.ingresosFiado)}%` }} />
                              <div className="bg-violet-500" style={{ width: `${pc(c.ingresosSepare)}%` }} />
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Contado {dinero(c.ingresosContado)} ({pct(pc(c.ingresosContado), 0)})</span>
                              <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Fiado {dinero(c.ingresosFiado)} ({pct(pc(c.ingresosFiado), 0)})</span>
                              {c.ingresosSepare > 0 && (
                                <span><span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1" />Separe {dinero(c.ingresosSepare)} ({pct(pc(c.ingresosSepare), 0)})</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs font-bold text-slate-400">Sin datos</p>
                        )}
                      </div>

                      <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
                        <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-2">Productos que más aportan</p>
                        <div className="flex flex-col gap-2">
                          {c.productos.slice(0, 5).map(p => (
                            <div key={p.clave} className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                {p.imagen ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imagen} alt={p.nombre} loading="lazy" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] font-black text-slate-400">{p.nombre.trim().substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 break-words min-w-0 flex-1 leading-tight">{p.nombre}</p>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white">{dinero(p.ingresos)}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{Math.round(p.unidades).toLocaleString("es-CO")} un.</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {sinDatoCosto > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {sinDatoCosto} {sinDatoCosto === 1 ? "categoría no entra" : "categorías no entran"} en este ranking por no tener costo de compra registrado.
          </div>
        )}
      </div>

      {/* PANEL LATERAL */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <PieChart size={14} className="text-indigo-500" /> Distribución de la facturación
          </span>
          {donut ? (
            <div className="mt-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-5">
              <div className="relative w-36 h-36 shrink-0 rounded-full shadow-inner" style={{ background: donut.gradiente }}>
                <div className="absolute inset-[22px] rounded-full bg-white dark:bg-[#0f172a] flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400">Total</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{dinero(donut.total)}</span>
                </div>
              </div>
              <ul className="flex flex-col gap-1.5 w-full min-w-0">
                {donut.items.map(it => (
                  <li key={it.nombre} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: it.color }} />
                    <span className="break-words min-w-0 flex-1">{it.nombre}</span>
                    <span className="shrink-0 text-slate-900 dark:text-white">{pct((it.valor / donut.total) * 100, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">Sin ventas en el periodo.</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-[2rem] shadow-xl flex flex-col gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
              <Sparkles size={14} /> Más rentable (en dinero)
            </span>
            {masRentable ? (
              <p className="text-sm mt-1.5"><strong className="font-black break-words">{masRentable.nombre}</strong> deja <strong className="text-emerald-300">{dinero(masRentable.utilidad as number)}</strong> de utilidad.</p>
            ) : (
              <p className="text-xs text-slate-300 mt-1.5">Sin costos registrados aún.</p>
            )}
          </div>
          {mejorMargen && (
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                <TrendingUp size={14} /> Mejor margen
              </span>
              <p className="text-sm mt-1.5"><strong className="font-black break-words">{mejorMargen.nombre}</strong> con <strong className="text-amber-300">{pct(mejorMargen.margen as number)}</strong>.</p>
            </div>
          )}
          {peorMargen && peorMargen.clave !== mejorMargen?.clave && (
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-300 flex items-center gap-1.5">
                <TrendingDown size={14} /> Margen a revisar
              </span>
              <p className="text-sm mt-1.5"><strong className="font-black break-words">{peorMargen.nombre}</strong> solo deja <strong className="text-rose-300">{pct(peorMargen.margen as number)}</strong>. Revisa precio o costo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
