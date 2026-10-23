// components/caja/VistaCierresCaja.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Calendar, Clock, CheckCircle2, AlertTriangle, 
  Search, RefreshCw, Send, Printer, User, ArrowUpRight, 
  ArrowDownRight, Smartphone, Eye, X, HelpCircle, FileText
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/hooks/AuthContext';
import { CierreCaja } from '@/types';
import { generarTextoWhatsAppCierre } from '@/utils/cierreCaja';
import { abrirEnlaceWhatsApp } from '@/utils/whatsapp';

interface VistaCierresCajaProps {
  cuentaPrincipalId?: string;
  filtroTiempo?: 'hoy' | 'ayer' | 'semana' | 'mes' | 'ano' | 'todos';
  mostrarMetricasGlobales?: boolean;
}

export default function VistaCierresCaja({
  cuentaPrincipalId,
  filtroTiempo = 'todos',
  mostrarMetricasGlobales = false
}: VistaCierresCajaProps) {
  const { datosSesion } = useAuth();
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const telefonoAdmin = datosSesion?.telefonoAdmin || "";

  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cierreSeleccionado, setCierreSeleccionado] = useState<CierreCaja | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipoRegistro, setFiltroTipoRegistro] = useState<'todos' | 'cierre' | 'arqueo_parcial'>('todos');

  const cargarCierres = async () => {
    if (!cuentaPrincipalId) return;
    setCargando(true);
    try {
      // Consulta con límite para máxima velocidad
      const q = query(
        collection(db, "cierres_caja"),
        where("usuarioId", "==", cuentaPrincipalId)
      );
      const snap = await getDocs(q);
      const lista: CierreCaja[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CierreCaja));

      // Regla de privacidad: Colaborador solo ve sus propios registros; Admin ve todos
      const esAdmin = datosSesion?.rol !== 'cajero' && datosSesion?.tipoUsuario !== 'colaborador';
      const miUid = datosSesion?.uid || '';
      const miNombre = (datosSesion?.nombreUsuario || '').trim().toLowerCase();

      const listaFiltradaPorRol = esAdmin
        ? lista
        : lista.filter(c => {
            const porUid = c.cerradoPorUid && c.cerradoPorUid === miUid;
            const porNom = c.cerradoPorNombre && c.cerradoPorNombre.trim().toLowerCase() === miNombre;
            return porUid || porNom;
          });

      // Ordenar en memoria
      listaFiltradaPorRol.sort((a, b) => {
        const tA = a.fechaCierre?.toMillis ? a.fechaCierre.toMillis() : (a.fechaCierre?.seconds ? a.fechaCierre.seconds * 1000 : (a.fechaCierre ? new Date(a.fechaCierre).getTime() : 0));
        const tB = b.fechaCierre?.toMillis ? b.fechaCierre.toMillis() : (b.fechaCierre?.seconds ? b.fechaCierre.seconds * 1000 : (b.fechaCierre ? new Date(b.fechaCierre).getTime() : 0));
        return tB - tA;
      });

      setCierres(listaFiltradaPorRol);
    } catch (error) {
      console.error("Error al cargar cierres de caja:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCierres();
  }, [cuentaPrincipalId]);

  // Filtrado por tiempo, tipo de registro y texto
  const cierresFiltrados = useMemo(() => {
    const ahora = new Date();
    return cierres.filter(c => {
      // Filtro de tipo de registro (cierre definitivo vs arqueo parcial)
      if (filtroTipoRegistro !== 'todos') {
        const tipoReg = c.tipoRegistro || 'cierre';
        if (tipoReg !== filtroTipoRegistro) return false;
      }

      // Filtro de texto por cajero o ID
      if (busqueda.trim()) {
        const queryNorm = busqueda.toLowerCase().trim();
        const coincideCajero = c.cerradoPorNombre?.toLowerCase().includes(queryNorm);
        const coincideId = c.id?.toLowerCase().includes(queryNorm);
        const coincideNotas = c.notas?.toLowerCase().includes(queryNorm);
        if (!coincideCajero && !coincideId && !coincideNotas) return false;
      }

      if (filtroTiempo === 'todos') return true;

      const fCierre = c.fechaCierre?.toDate ? c.fechaCierre.toDate() : new Date(c.fechaCierre);
      if (filtroTiempo === 'hoy') {
        return (
          fCierre.getDate() === ahora.getDate() &&
          fCierre.getMonth() === ahora.getMonth() &&
          fCierre.getFullYear() === ahora.getFullYear()
        );
      }
      if (filtroTiempo === 'ayer') {
        const ayer = new Date(ahora);
        ayer.setDate(ahora.getDate() - 1);
        return (
          fCierre.getDate() === ayer.getDate() &&
          fCierre.getMonth() === ayer.getMonth() &&
          fCierre.getFullYear() === ayer.getFullYear()
        );
      }
      if (filtroTiempo === 'semana') {
        const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
        return fCierre >= hace7Dias;
      }
      if (filtroTiempo === 'mes') {
        return (
          fCierre.getMonth() === ahora.getMonth() &&
          fCierre.getFullYear() === ahora.getFullYear()
        );
      }
      if (filtroTiempo === 'ano') {
        return fCierre.getFullYear() === ahora.getFullYear();
      }
      return true;
    });
  }, [cierres, filtroTiempo, filtroTipoRegistro, busqueda]);

  // Métricas acumuladas para vista de reporte
  const metricasGlobales = useMemo(() => {
    let totalEfectivoAuditado = 0;
    let totalDigitalAuditado = 0;
    let totalRecaudado = 0;
    let sumaDiferencias = 0;
    let conteoCuadreExacto = 0;
    let conteoSobrante = 0;
    let conteoFaltante = 0;

    for (const c of cierresFiltrados) {
      totalEfectivoAuditado += Number(c.totalEfectivoReal) || 0;
      totalDigitalAuditado += Number(c.totalVentasDigitales) || 0;
      totalRecaudado += Number(c.totalRecaudadoGeneral) || 0;
      sumaDiferencias += Number(c.diferencia) || 0;

      if (c.tipoDiferencia === 'exacto') conteoCuadreExacto++;
      else if (c.tipoDiferencia === 'sobrante') conteoSobrante++;
      else if (c.tipoDiferencia === 'faltante') conteoFaltante++;
    }

    return {
      totalCierres: cierresFiltrados.length,
      totalEfectivoAuditado,
      totalDigitalAuditado,
      totalRecaudado,
      sumaDiferencias,
      conteoCuadreExacto,
      conteoSobrante,
      conteoFaltante
    };
  }, [cierresFiltrados]);

  return (
    <div className="space-y-4">
      
      {/* MÉTRICAS GLOBALES (SI SE SOLICITAN, EJ: EN REPORTES O AUDITORÍA) */}
      {mostrarMetricasGlobales && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Cierres Auditados
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {metricasGlobales.totalCierres}
              </span>
              <span className="text-xs text-slate-400">turnos</span>
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
              {metricasGlobales.conteoCuadreExacto} exactos ({metricasGlobales.totalCierres > 0 ? Math.round((metricasGlobales.conteoCuadreExacto / metricasGlobales.totalCierres) * 100) : 0}%)
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Efectivo Físico Auditado
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ${metricasGlobales.totalEfectivoAuditado.toLocaleString('es-CO')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Contado en gavetas
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Recaudo Digital Auditado
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              ${metricasGlobales.totalDigitalAuditado.toLocaleString('es-CO')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Vouchers y Bancos
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Diferencia Neta Acumulada
            </span>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${
              metricasGlobales.sumaDiferencias === 0
                ? 'text-slate-900 dark:text-white'
                : metricasGlobales.sumaDiferencias > 0
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}>
              {metricasGlobales.sumaDiferencias > 0 ? '+' : ''}${metricasGlobales.sumaDiferencias.toLocaleString('es-CO')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {metricasGlobales.conteoFaltante} faltantes · {metricasGlobales.conteoSobrante} sobrantes
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑAS DE FILTRO: CIERRES DEFINITIVOS VS ARQUEOS PARCIALES */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#090d16] rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setFiltroTipoRegistro('todos')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filtroTipoRegistro === 'todos'
              ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Todos ({cierres.length})
        </button>
        <button
          type="button"
          onClick={() => setFiltroTipoRegistro('cierre')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filtroTipoRegistro === 'cierre'
              ? 'bg-white dark:bg-[#1e293b] text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Cierres Definitivos
        </button>
        <button
          type="button"
          onClick={() => setFiltroTipoRegistro('arqueo_parcial')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filtroTipoRegistro === 'arqueo_parcial'
              ? 'bg-white dark:bg-[#1e293b] text-amber-600 dark:text-amber-400 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Arqueos Parciales
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA Y REFRESH */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cajero, notas o ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-xs"
          />
        </div>
        <button
          type="button"
          onClick={cargarCierres}
          disabled={cargando}
          className="p-2.5 bg-white dark:bg-[#0f172a] hover:bg-slate-100 dark:hover:bg-[#1e293b] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          title="Actualizar cierres"
        >
          <RefreshCw size={15} className={cargando ? "animate-spin text-indigo-500" : ""} />
        </button>
      </div>

      {/* LISTA DE CIERRES */}
      {cargando ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw size={24} className="animate-spin text-indigo-500" />
          <p className="text-xs font-medium">Cargando registros de cierres...</p>
        </div>
      ) : cierresFiltrados.length === 0 ? (
        <div className="py-12 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-slate-800/80 p-6 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Calculator size={22} />
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            No se encontraron registros
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {busqueda 
              ? `No hay registros que coincidan con "${busqueda}".`
              : "Aún no se han registrado cierres ni arqueos en este periodo. Puedes realizarlos desde el panel de Inicio."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cierresFiltrados.map((cierre) => {
            const fechaCierre = cierre.fechaCierre?.toDate ? cierre.fechaCierre.toDate() : new Date(cierre.fechaCierre);
            const fechaCierreTxt = fechaCierre.toLocaleString('es-CO', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true
            });

            const esArqueoParcial = cierre.tipoRegistro === 'arqueo_parcial';
            const esApertura = cierre.tipoRegistro === 'apertura';

            return (
              <div
                key={cierre.id}
                className="bg-white dark:bg-[#0f172a] rounded-2xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-600/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* IZQUIERDA: ICONO + METADATOS BÁSICOS */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    esArqueoParcial
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : esApertura
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {esArqueoParcial ? <Clock size={17} /> : <Calculator size={17} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {fechaCierreTxt}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        esArqueoParcial
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : esApertura
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                      }`}>
                        {esArqueoParcial ? 'Arqueo Parcial' : (esApertura ? 'Apertura' : 'Cierre')}
                      </span>

                      {/* BADGE DE ESTADO DE CUADRE */}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        cierre.tipoDiferencia === 'exacto'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : cierre.tipoDiferencia === 'sobrante'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                            : cierre.tipoDiferencia === 'pendiente'
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {cierre.tipoDiferencia === 'exacto' ? (
                          <>
                            <CheckCircle2 size={11} /> Cuadre Exacto
                          </>
                        ) : cierre.tipoDiferencia === 'sobrante' ? (
                          <>
                            <AlertTriangle size={11} /> Sobrante +${Math.abs(cierre.diferencia).toLocaleString('es-CO')}
                          </>
                        ) : cierre.tipoDiferencia === 'pendiente' ? (
                          <>
                            <HelpCircle size={11} /> Pendiente conteo
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={11} /> Faltante -${Math.abs(cierre.diferencia).toLocaleString('es-CO')}
                          </>
                        )}
                      </span>
                    </div>

                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      Cajero: <strong className="text-slate-700 dark:text-slate-200">{cierre.cerradoPorNombre}</strong>
                      {cierre.notas && (
                        <span className="italic text-slate-400 ml-1.5">— "{cierre.notas}"</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* DERECHA: TOTAL EN GAVETA + BOTONES DISCRETOS */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[9.5px] font-bold uppercase text-slate-400 block leading-none">
                      {esApertura ? 'Base Inicial' : 'En Gaveta'}
                    </span>
                    <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                      ${(esApertura ? (cierre.baseInicial || 0) : (cierre.totalEfectivoReal || 0)).toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const fechaTxt = fechaCierre.toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        });
                        const texto = generarTextoWhatsAppCierre({
                          negocioNombre: nombreNegocio,
                          cierre,
                          fechaTexto: fechaTxt
                        });
                        abrirEnlaceWhatsApp(telefonoAdmin || "", texto);
                      }}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                      title="Enviar comprobante a WhatsApp"
                    >
                      <Send size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setCierreSeleccionado(cierre)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Ver detalle completo"
                    >
                      <Eye size={13} />
                      <span className="hidden sm:inline">Detalle</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA INSPECCIONAR CIERRE O ARQUEO */}
      <ModalDetalleCierre
        cierre={cierreSeleccionado}
        isOpen={Boolean(cierreSeleccionado)}
        onClose={() => setCierreSeleccionado(null)}
      />

    </div>
  );
}

export interface ModalDetalleCierreProps {
  cierre: CierreCaja | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ModalDetalleCierre({ cierre, isOpen, onClose }: ModalDetalleCierreProps) {
  const { datosSesion } = useAuth();
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const telefonoAdmin = datosSesion?.telefonoAdmin || datosSesion?.telefonoNegocio || "";

  if (!isOpen || !cierre) return null;

  const fCierre = cierre.fechaCierre?.toDate ? cierre.fechaCierre.toDate() : new Date(cierre.fechaCierre);
  const fApertura = cierre.fechaApertura?.toDate ? cierre.fechaApertura.toDate() : (cierre.fechaApertura ? new Date(cierre.fechaApertura) : null);

  const esArqueo = cierre.tipoRegistro === 'arqueo_parcial';
  const esApertura = cierre.tipoRegistro === 'apertura';

  const enviarWhatsApp = () => {
    const fechaTxt = fCierre.toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    const texto = generarTextoWhatsAppCierre({
      negocioNombre: nombreNegocio,
      cierre,
      fechaTexto: fechaTxt
    });
    abrirEnlaceWhatsApp(telefonoAdmin || "", texto);
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-md p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4">
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              esArqueo 
                ? 'bg-amber-500/10 text-amber-500' 
                : (esApertura ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500')
            }`}>
              {esArqueo ? <Clock size={16} /> : <Calculator size={16} />}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {esArqueo 
                  ? 'Detalle de Arqueo Parcial' 
                  : (esApertura ? 'Detalle de Apertura de Caja' : 'Auditoría de Cierre de Caja')}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                ID: {cierre.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Resumen */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Cajero(a):</span>
            <span className="font-bold">{cierre.cerradoPorNombre}</span>
          </div>
          {fApertura && (
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Apertura:</span>
              <span className="font-bold">{fApertura.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">{esArqueo ? 'Hora del Arqueo:' : (esApertura ? 'Hora de Apertura:' : 'Hora de Cierre:')}</span>
            <span className="font-bold">{fCierre.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500">Base Inicial:</span>
            <span className="font-bold">${(cierre.baseInicial || 0).toLocaleString('es-CO')}</span>
          </div>

          {!esApertura && (
            <>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Efectivo Esperado:</span>
                <span className="font-bold">${(cierre.totalEfectivoEsperado || 0).toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Efectivo Real Contado:</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">
                  ${(cierre.totalEfectivoReal || 0).toLocaleString('es-CO')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Estado de Gaveta:</span>
                <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                  cierre.tipoDiferencia === 'exacto'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : cierre.tipoDiferencia === 'sobrante'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                }`}>
                  {cierre.tipoDiferencia === 'exacto'
                    ? 'Cuadre Exacto'
                    : (cierre.tipoDiferencia === 'sobrante'
                      ? `Sobrante: +$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}`
                      : `Faltante: -$${Math.abs(cierre.diferencia).toLocaleString('es-CO')}`)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Recaudo Digital (Bancos):</span>
                <span className="font-bold">${(cierre.totalVentasDigitales || 0).toLocaleString('es-CO')}</span>
              </div>
              {cierre.totalVentasDigitales > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Auditoría Digital:</span>
                  <span className={`font-bold text-[11px] ${
                    cierre.vouchersPendientesCount && cierre.vouchersPendientesCount > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {cierre.vouchersPendientesCount && cierre.vouchersPendientesCount > 0
                      ? `⚠️ ${cierre.vouchersPendientesCount} comprobantes pendientes`
                      : '✅ 100% Verificado'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {cierre.notas && (
          <div className="bg-slate-50 dark:bg-[#020617] p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Observaciones:</span>
            <p className="text-slate-700 dark:text-slate-300 italic mt-0.5">"{cierre.notas}"</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={enviarWhatsApp}
            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Send size={13} />
            <span>Enviar a WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 dark:bg-[#1e293b] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
