"use client";
import { useMemo, useState } from "react";
import { Award, ChevronDown, Crown, Info, Package, Target, TrendingUp, AlertTriangle, Layers } from "lucide-react";
import { ProductoStat, ResumenProductos } from "@/utils/analiticaProductos";

type Metrica = "unidades" | "ingresos" | "utilidad";

interface Props {
  resumen: ResumenProductos;
  periodoLabel: string;
}

const dinero = (n: number) => `${n < 0 ? "-" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CO")}`;
const pct = (n: number, d = 1) => `${n.toFixed(d).replace(".", ",")}%`;

const METRICAS: { id: Metrica; label: string; corto: string }[] = [
  { id: "unidades", label: "Más vendidos", corto: "Unidades" },
  { id: "ingresos", label: "Más facturado", corto: "Facturado" },
  { id: "utilidad", label: "Más rentable", corto: "Utilidad" },
];

const estiloRango = (i: number) =>
  i === 0 ? "bg-amber-500 text-white shadow-amber-500/30"
  : i === 1 ? "bg-slate-400 text-white"
  : i === 2 ? "bg-amber-700 text-white"
  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400";

export default function PanelProductosEstrella({ resumen, periodoLabel }: Props) {
  const [metrica, setMetrica] = useState<Metrica>("unidades");
  const [topN, setTopN] = useState<5 | 10>(5);
  const [expandido, setExpandido] = useState<string | null>(null);

  const valorDe = (p: ProductoStat): number =>
    metrica === "unidades" ? p.unidades : metrica === "ingresos" ? p.ingresos : p.utilidad ?? 0;

  const { ranking, totalMetrica, sinCostoExcluidos } = useMemo(() => {
    const base = resumen.productos.filter(p => (metrica === "utilidad" ? p.utilidad !== null : true));
    const lista = base.filter(p => valorDe(p) > 0).sort((a, b) => valorDe(b) - valorDe(a));
    return {
      ranking: lista,
      totalMetrica: lista.reduce((a, p) => a + valorDe(p), 0),
      sinCostoExcluidos: metrica === "utilidad" ? resumen.productos.length - base.length : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen, metrica]);

  const top = ranking.slice(0, topN);
  const maxValor = top.length > 0 ? valorDe(top[0]) : 0;

  // Principio de Pareto sobre facturación
  const pareto = useMemo(() => {
    const lista = resumen.productos.filter(p => p.ingresos > 0).sort((a, b) => b.ingresos - a.ingresos);
    const total = lista.reduce((a, p) => a + p.ingresos, 0);
    if (total <= 0) return null;
    let acc = 0;
    let n = 0;
    for (const p of lista) {
      acc += p.ingresos;
      n += 1;
      if (acc / total >= 0.8) break;
    }
    return { n, total: lista.length };
  }, [resumen]);

  const formatear = (v: number) => (metrica === "unidades" ? `${Math.round(v).toLocaleString("es-CO")} un.` : dinero(v));
  const lider = top[0];
  const liderShare = lider && totalMetrica > 0 ? (valorDe(lider) / totalMetrica) * 100 : 0;
  let acumulado = 0;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {[
          { icon: Package, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10", label: "Productos distintos vendidos", valor: resumen.productos.length.toLocaleString("es-CO") },
          { icon: Layers, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10", label: "Unidades vendidas (netas)", valor: Math.round(resumen.totalUnidades).toLocaleString("es-CO") },
          { icon: TrendingUp, color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10", label: "Facturado neto por producto", valor: dinero(resumen.totalIngresos) },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-[#0f172a] p-4 sm:p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-4 min-w-0">
            <div className={`p-3 rounded-2xl shrink-0 ${k.color}`}><k.icon size={24} /></div>
            <div className="min-w-0">
              <span className="text-[10px] xl:text-xs font-extrabold text-slate-400 uppercase tracking-widest block">{k.label}</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 break-words">{k.valor}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* PODIO */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0f172a] p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col gap-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Crown className="text-amber-500 shrink-0" size={24} /> Productos Estrella
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Ranking de productos ({periodoLabel}). Toca un producto para ver su detalle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-w-full">
                {METRICAS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMetrica(m.id); setExpandido(null); }}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      metrica === m.id
                        ? "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex bg-slate-100 dark:bg-[#020617] p-1.5 rounded-2xl">
                {([5, 10] as const).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTopN(n)}
                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                      topN === n ? "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {top.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm font-medium flex flex-col items-center gap-2">
              <Package size={32} className="opacity-50" />
              {metrica === "utilidad"
                ? "Aún no hay ventas con costo registrado en este periodo para calcular rentabilidad."
                : `No hay ventas de productos registradas en el periodo seleccionado (${periodoLabel}).`}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {top.map((p, i) => {
                const v = valorDe(p);
                const share = totalMetrica > 0 ? (v / totalMetrica) * 100 : 0;
                acumulado += share;
                const abierto = expandido === p.clave;
                const totalCanal = p.ingresosContado + p.ingresosFiado + p.ingresosSepare;
                const pc = (x: number) => (totalCanal > 0 ? (x / totalCanal) * 100 : 0);

                return (
                  <div
                    key={p.clave}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      abierto
                        ? "border-emerald-500/50 bg-slate-50 dark:bg-[#020617]"
                        : "border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-[#020617]/60 hover:border-emerald-500/40"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={abierto}
                      onClick={() => setExpandido(abierto ? null : p.clave)}
                      className="w-full flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-4 text-left cursor-pointer"
                    >
                      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-sm sm:text-base shadow-sm shrink-0 ${estiloRango(i)}`}>
                        #{i + 1}
                      </div>

                      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                        {p.imagen ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen} alt={p.nombre} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-black text-slate-400">{p.nombre.trim().substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base break-words leading-tight">{p.nombre}</p>
                        <span className="inline-block mt-1 text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded-md break-words">
                          {p.categoria}
                        </span>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-emerald-400 to-emerald-500"}`}
                            style={{ width: `${Math.max(3, maxValor > 0 ? (v / maxValor) * 100 : 0)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatear(v)}</p>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold">{pct(share)} del total</p>
                        <p className="text-[10px] text-slate-400 hidden sm:block">Acum. {pct(Math.min(100, acumulado))}</p>
                      </div>
                      <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
                    </button>

                    {abierto && (
                      <div className="px-3 sm:px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {[
                            { l: "Unidades", v: `${Math.round(p.unidades).toLocaleString("es-CO")} un.` },
                            { l: "Facturado", v: dinero(p.ingresos) },
                            { l: "Costo", v: p.ingresosConCosto > 0 ? dinero(p.costo) : "Sin costo" },
                            { l: "Utilidad", v: p.utilidad !== null ? dinero(p.utilidad) : "—" },
                          ].map(d => (
                            <div key={d.l} className="bg-white dark:bg-[#0f172a] rounded-xl p-2.5 border border-slate-100 dark:border-slate-800/60 min-w-0">
                              <p className="text-[10px] font-extrabold uppercase text-slate-400">{d.l}</p>
                              <p className="text-sm font-black text-slate-900 dark:text-white break-words">{d.v}</p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
                            <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Margen de ganancia</p>
                            {p.margen !== null ? (
                              <p className={`text-lg font-black ${p.margen >= 30 ? "text-emerald-600 dark:text-emerald-400" : p.margen >= 15 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {pct(p.margen)}
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-slate-400">Registra el costo de compra en Inventario para ver el margen.</p>
                            )}
                          </div>

                          <div className="bg-white dark:bg-[#0f172a] rounded-xl p-3 border border-slate-100 dark:border-slate-800/60">
                            <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Cómo se vendió (dinero)</p>
                            {totalCanal > 0 ? (
                              <>
                                <div className="flex h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                                  <div className="bg-emerald-500" style={{ width: `${pc(p.ingresosContado)}%` }} />
                                  <div className="bg-amber-500" style={{ width: `${pc(p.ingresosFiado)}%` }} />
                                  <div className="bg-violet-500" style={{ width: `${pc(p.ingresosSepare)}%` }} />
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                  <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Contado {pct(pc(p.ingresosContado), 0)}</span>
                                  <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Fiado {pct(pc(p.ingresosFiado), 0)}</span>
                                  {p.ingresosSepare > 0 && (
                                    <span><span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1" />Separe {pct(pc(p.ingresosSepare), 0)}</span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs font-bold text-slate-400">Sin datos</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {ranking.length > topN && (
                <p className="text-center text-[11px] text-slate-400 font-medium pt-1">
                  Mostrando {topN} de {ranking.length} productos. Cambia a Top 10 para ver más.
                </p>
              )}
            </div>
          )}

          {metrica === "utilidad" && sinCostoExcluidos > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              {sinCostoExcluidos} {sinCostoExcluidos === 1 ? "producto no entra" : "productos no entran"} en este ranking por no tener costo de compra registrado.
            </div>
          )}
        </div>

        {/* PANEL LATERAL DE INSIGHTS */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-[2rem] shadow-xl">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
              <Award size={14} /> Líder del periodo
            </span>
            {lider ? (
              <>
                <p className="text-lg font-black mt-2 break-words leading-tight">{lider.nombre}</p>
                <p className="text-xs text-slate-300 mt-1">
                  Aporta el <strong className="text-white">{pct(liderShare)}</strong> de {METRICAS.find(m => m.id === metrica)?.corto.toLowerCase()} ({formatear(valorDe(lider))}).
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-300 mt-2">Sin datos suficientes en este periodo.</p>
            )}
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 shadow-sm">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Target size={14} className="text-emerald-500" /> Concentración (Pareto 80/20)
            </span>
            {pareto ? (
              <>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  {pareto.n} de {pareto.total} {pareto.total === 1 ? "producto genera" : "productos generan"} el 80% de tu facturación.
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${(pareto.n / pareto.total) * 100}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
                  Esos son los que nunca deben faltarte en stock. {pareto.n / pareto.total <= 0.3 ? "Tu venta está concentrada: cuida a tus estrellas." : "Tu venta está bien repartida entre varios productos."}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-400 mt-2">Sin ventas en el periodo.</p>
            )}
          </div>

          <div className={`p-5 sm:p-6 rounded-[2rem] border shadow-sm ${resumen.coberturaCosto >= 90 ? "bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/60" : "bg-amber-50 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20"}`}>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Info size={14} className="text-indigo-500" /> Calidad del dato de costo
            </span>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-2">{pct(resumen.coberturaCosto, 0)} de tu facturación tiene costo registrado.</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              {resumen.coberturaCosto >= 90
                ? "Los márgenes mostrados son confiables."
                : "La utilidad y el margen se calculan solo sobre esas ventas. Registra el costo de compra en Inventario para mayor precisión."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
