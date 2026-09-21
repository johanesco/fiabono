"use client";
import React from "react";
import Image from "next/image";
import { DetalleFacturaItem, DatosFacturaProps } from "./TicketFacturaModal";

interface VistaTicketCardProps {
  datos: DatosFacturaProps;
  ticketRef?: React.RefObject<HTMLDivElement | null>;
}

/* ─── Separador inteligente de secciones ─────────────────────────────────── */
function SeccionDivider({
  label,
  tipo = "normal",
}: {
  label?: string;
  tipo?: "fuerte" | "normal" | "suave";
}) {
  if (label) {
    return (
      <div className="flex items-center gap-1.5 my-2 px-0.5">
        <div
          className={`flex-1 ${
            tipo === "fuerte"
              ? "border-t-[1.5px] border-slate-900"
              : "border-t border-slate-700"
          }`}
        />
        <span className="text-[8.5px] font-black uppercase tracking-[0.16em] text-slate-900 px-1 shrink-0">
          {label}
        </span>
        <div
          className={`flex-1 ${
            tipo === "fuerte"
              ? "border-t-[1.5px] border-slate-900"
              : "border-t border-slate-700"
          }`}
        />
      </div>
    );
  }
  if (tipo === "fuerte")
    return <div className="border-t-[1.5px] border-slate-900 my-2 mx-0.5" />;
  if (tipo === "suave")
    return (
      <div className="border-t border-dashed border-slate-400 my-1.5 mx-0.5" />
    );
  return <div className="border-t border-slate-600 my-1.5 mx-0.5" />;
}

/* ─── Fila de metadato (etiqueta: valor) ─────────────────────────────────── */
function FilaMeta({
  label,
  valor,
  negrita = false,
  colorValor,
}: {
  label: string;
  valor: React.ReactNode;
  negrita?: boolean;
  colorValor?: string;
}) {
  return (
    <div className="flex justify-between items-baseline gap-1 py-[1px]">
      <span className="text-[10.5px] font-bold text-slate-900 shrink-0">
        {label}
      </span>
      <span
        className={`text-[11px] text-right font-mono ${
          negrita ? "font-black" : "font-bold"
        } ${colorValor ?? "text-slate-900"}`}
      >
        {valor}
      </span>
    </div>
  );
}

/* ─── Componente principal ────────────────────────────────────────────────── */
export default function VistaTicketCard({ datos, ticketRef }: VistaTicketCardProps) {
  /* Formateo de fecha / hora */
  const formatearFecha = (f: any) => {
    if (!f)
      return new Date().toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    if (f.toDate && typeof f.toDate === "function")
      return f
        .toDate()
        .toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
    if (f instanceof Date)
      return f.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    return new Date().toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatearHora = (f: any) => {
    if (!f)
      return new Date().toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    if (f.toDate && typeof f.toDate === "function")
      return f
        .toDate()
        .toLocaleTimeString("es-CO", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
    if (f instanceof Date)
      return f.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    return new Date().toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTituloTipo = () => {
    if (datos.tipo === "venta") return "COMPROBANTE DE VENTA";
    if (datos.tipo === "fiado") return "COMPROBANTE DE FIADO";
    if (datos.tipo === "abono") return "COMPROBANTE DE ABONO";
    if (datos.tipo === "separe") return "PLAN SEPARE";
    if (datos.tipo === "abono_separe") return "ABONO A PLAN SEPARE";
    if (datos.tipo === "entrega_separe") return "ENTREGA DE PLAN SEPARE";
    if (datos.tipo === "egreso") return "EGRESO";
    if (datos.tipo === "devolucion") return "DEVOLUCIÓN";
    return "COMPROBANTE DE CAJA";
  };

  /* Método de pago formateado */
  const getMetodoPago = () => {
    let subMetodo = datos.subMetodoPago || "";
    let refLimpia = datos.referenciaPago || "";
    if (refLimpia.includes(" — ")) {
      const partes = refLimpia.split(" — ");
      if (!subMetodo && partes[0]) subMetodo = partes[0].trim();
      refLimpia = partes.slice(1).join(" — ").trim();
    } else if (refLimpia) {
      const bancosConocidos = [
        "nequi","daviplata","bancolombia","pse","addi","sistecrédito","sistecredito","krediya",
      ];
      if (bancosConocidos.includes(refLimpia.toLowerCase().trim())) {
        if (!subMetodo) subMetodo = refLimpia.trim();
        refLimpia = "";
      }
    }
    let etiqueta = "";
    if (datos.metodoPago === "transferencia")
      etiqueta = subMetodo ? `Transferencia (${subMetodo})` : "Transferencia";
    else if (datos.metodoPago === "datafono") etiqueta = "Datáfono / Tarjeta";
    else if (datos.metodoPago === "credito_externo")
      etiqueta = subMetodo ? `Crédito (${subMetodo})` : "Crédito Externo";
    else if (datos.metodoPago === "efectivo") etiqueta = "Efectivo";
    else if (datos.metodoPago === "fiado") etiqueta = "Crédito Directo (Fiado)";
    else etiqueta = String(datos.metodoPago ?? "");
    return { etiqueta, ref: refLimpia };
  };

  const metodoPago = datos.metodoPago ? getMetodoPago() : null;

  /* Ítems de la factura: Estructura ultra limpia de alta legibilidad */
  const renderItems = () => {
    if (datos.detalles && datos.detalles.length > 0) {
      return datos.detalles.map((item: DetalleFacturaItem, idx: number) => {
        const cant = item.cantidad || 1;
        const vUnit =
          item.valorUnitario ||
          (cant > 0 ? (item.valor || 0) / cant : item.valor || 0);
        const vTotal = item.valor || cant * vUnit;
        return (
          <div
            key={idx}
            className="flex justify-between items-start gap-1 py-1 border-b border-dashed border-slate-300 last:border-none"
          >
            <div className="flex-1 min-w-0 pr-1">
              <p className="font-extrabold text-slate-900 text-[11.5px] leading-snug">
                {cant}× {item.descripcion || "Artículo"}
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-900 font-mono shrink-0 pt-px text-right">
              ${vUnit.toLocaleString("es-CO")}
            </span>
            <span className="text-[11.5px] font-black text-slate-900 font-mono shrink-0 pt-px min-w-[56px] text-right">
              ${vTotal.toLocaleString("es-CO")}
            </span>
          </div>
        );
      });
    }

    /* Descripción general como fallback */
    const desc = (datos.descripcionGeneral || "").trim();
    const prefijoMatch = desc.match(
      /^(Saldo pendiente de venta|Saldo pendiente|Venta de|Venta|Fiado de|Fiado):\s*(.+)$/i
    );
    const prefijoTexto = prefijoMatch ? prefijoMatch[1] : null;
    const cuerpoItems = prefijoMatch ? prefijoMatch[2] : desc;
    const partes =
      cuerpoItems.includes(",")
        ? cuerpoItems.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    if (partes.length > 1) {
      return (
        <div className="space-y-1">
          {prefijoTexto && (
            <p className="text-[9.5px] font-bold text-slate-900 uppercase tracking-wider pb-0.5">
              {prefijoTexto}:
            </p>
          )}
          {partes.map((p, idx) => {
            const matchCant = p.match(/^(\d+)[xX]\s*(.+)$/);
            const cant = matchCant ? parseInt(matchCant[1], 10) : 1;
            const nombreArt = matchCant ? matchCant[2].trim() : p;
            return (
              <div
                key={idx}
                className="flex justify-between items-start text-[11.5px] leading-tight border-b border-dashed border-slate-300 last:border-none py-1"
              >
                <p className="font-bold text-slate-900 flex-1">
                  {cant}× {nombreArt}
                </p>
                <span className="text-slate-900 font-mono font-bold text-[10.5px] shrink-0">
                  —
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center text-[11.5px] py-1">
        <span className="font-bold text-slate-900 flex-1 pr-1">
          {datos.descripcionGeneral ||
            (datos.tipo === "abono"
              ? "Abono a cuenta"
              : datos.tipo === "fiado"
              ? "Fiado de mercancía"
              : "Venta directa")}
        </span>
        <span className="font-black text-slate-900 font-mono shrink-0">
          ${(datos.montoTotal || 0).toLocaleString("es-CO")}
        </span>
      </div>
    );
  };

  return (
    <div
      id="seccion-ticket-impresion"
      ref={ticketRef}
      style={{ overflowAnchor: "none" }}
      className="w-full max-w-[340px] h-fit bg-white text-slate-900 rounded-2xl shadow-md border border-slate-200 font-mono flex flex-col shrink-0 mx-auto my-0 overflow-hidden"
    >
      {/* ══════════════════════════════════════════════════════
          ENCABEZADO — NEGOCIO (Alta resolución)
          ══════════════════════════════════════════════════════ */}
      <div className="bg-white px-4 pt-5 pb-2 flex flex-col items-center text-center gap-1">
        {/* LOGO — Nitidez máxima */}
        {datos.logoNegocio && (
          <div className="flex justify-center mb-1.5">
            <img
              src={datos.logoNegocio}
              alt="Logo Negocio"
              crossOrigin="anonymous"
              loading="eager"
              decoding="sync"
              className="h-20 max-w-[180px] w-auto object-contain filter grayscale contrast-[2.0] brightness-[0.8]"
            />
          </div>
        )}

        {/* Nombre del negocio — Más grande y destacado */}
        <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider text-slate-900 leading-tight">
          {datos.nombreNegocio || "MI NEGOCIO"}
        </h1>

        {/* Info de contacto: 100% negro puro, sin grises tenue */}
        <div className="flex flex-col items-center gap-0.5 text-[10.5px] text-slate-900 font-bold">
          {datos.nitNegocio && (
            <span>NIT / RUT: {datos.nitNegocio}</span>
          )}
          {datos.direccionNegocio && <span>{datos.direccionNegocio}</span>}
          {datos.telefonoNegocio && (
            <span>Tel / WhatsApp: {datos.telefonoNegocio}</span>
          )}
          {datos.correoNegocio && <span>{datos.correoNegocio}</span>}
        </div>
      </div>

      {/* ── TIPO DE COMPROBANTE ───────────────────────────────── */}
      <div className="mx-3 mb-1">
        <SeccionDivider tipo="fuerte" />
        <div className="flex justify-center">
          <div className="border-[1.5px] border-slate-900 rounded px-3 py-0.5 inline-flex items-center">
            <span className="text-[9.5px] font-black uppercase tracking-[0.16em] text-slate-900">
              {getTituloTipo()}
            </span>
          </div>
        </div>
        <SeccionDivider tipo="fuerte" />
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN: DATOS DE LA TRANSACCIÓN
          ══════════════════════════════════════════════════════ */}
      <div className="px-4 pb-1 space-y-0.5">
        <SeccionDivider label="Información" />
        <FilaMeta label="Fecha:" valor={formatearFecha(datos.fecha)} />
        <FilaMeta label="Hora:" valor={formatearHora(datos.fecha)} />
        <SeccionDivider tipo="suave" />
        <FilaMeta
          label="Cliente:"
          valor={datos.nombreCliente || "Venta de Mostrador"}
          negrita
        />
        {datos.celularCliente && (
          <FilaMeta label="Tel. cliente:" valor={datos.celularCliente} />
        )}
        {datos.registradoPor && (
          <FilaMeta label="Atendido por:" valor={datos.registradoPor} />
        )}
        {datos.idTransaccion && (
          <FilaMeta
            label="Ticket #:"
            valor={datos.idTransaccion.slice(0, 8).toUpperCase()}
          />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN: ARTÍCULOS / DETALLE
          ══════════════════════════════════════════════════════ */}
      <div className="px-4 pb-1">
        <SeccionDivider label="Detalle" tipo="fuerte" />

        {/* Cabecera de la tabla de ítems */}
        {datos.detalles && datos.detalles.length > 0 && (
          <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-900 pb-1 border-b-[1.5px] border-slate-900 mb-0.5">
            <span className="flex-1">Cant / Producto</span>
            <span className="shrink-0 w-[56px] text-right">V. Unit</span>
            <span className="shrink-0 w-[60px] text-right">Total</span>
          </div>
        )}

        <div className="pt-0.5">{renderItems()}</div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECCIÓN: TOTALES Y PAGO
          ══════════════════════════════════════════════════════ */}
      <div className="px-4 pb-2">
        <SeccionDivider label="Resumen de pago" tipo="fuerte" />

        <div className="space-y-0.5">
          {/* Descuento */}
          {datos.montoDescuento !== undefined && datos.montoDescuento > 0 && (
            <>
              {datos.montoBruto && (
                <FilaMeta
                  label="Subtotal bruto:"
                  valor={`$${datos.montoBruto.toLocaleString("es-CO")}`}
                />
              )}
              <FilaMeta
                label={`Descuento${datos.descuentoTipo === "porcentaje" ? ` (${datos.descuentoValor}%)` : ""}:`}
                valor={`-$${datos.montoDescuento.toLocaleString("es-CO")}`}
              />
              <SeccionDivider tipo="suave" />
            </>
          )}

          {/* IVA */}
          {datos.subtotal !== undefined &&
            datos.valorIva !== undefined &&
            datos.valorIva > 0 && (
              <>
                <FilaMeta
                  label="Base gravable:"
                  valor={`$${datos.subtotal.toLocaleString("es-CO")}`}
                />
                <FilaMeta
                  label={`IVA (${datos.porcentajeIva || 19}%):`}
                  valor={`$${datos.valorIva.toLocaleString("es-CO")}`}
                />
                <SeccionDivider tipo="suave" />
              </>
            )}

          {/* TOTAL / TOTAL VENTA — destacado con recuadro negro sólido */}
          <div className="flex justify-between items-center bg-slate-900 text-white rounded-lg px-3 py-2 mt-1.5 mb-1">
            <span className="text-[12px] font-black uppercase tracking-wider">
              {datos.saldoFavorAplicado !== undefined && datos.saldoFavorAplicado > 0 ? "TOTAL VENTA" : "TOTAL"}
            </span>
            <span className="text-base font-black font-mono">
              ${(datos.montoTotal || 0).toLocaleString("es-CO")}
            </span>
          </div>

          {/* Saldo a favor aplicado */}
          {datos.saldoFavorAplicado !== undefined && datos.saldoFavorAplicado > 0 && (
            <>
              <FilaMeta
                label="Saldo a favor aplicado:"
                valor={`-$${datos.saldoFavorAplicado.toLocaleString("es-CO")}`}
                colorValor="text-slate-900 font-bold"
              />
              <div className="flex justify-between items-baseline gap-1 py-1 border-t border-b border-dashed border-slate-900 my-0.5">
                <span className="text-[11px] font-black uppercase text-slate-900 shrink-0">
                  Total a pagar en caja:
                </span>
                <span className="text-[12.5px] text-right font-mono font-black text-slate-900">
                  ${Math.max(0, (datos.montoTotal || 0) - datos.saldoFavorAplicado).toLocaleString("es-CO")}
                </span>
              </div>
              <SeccionDivider tipo="suave" />
            </>
          )}

          {/* Método de pago */}
          {metodoPago && (
            <>
              <SeccionDivider tipo="suave" />
              <FilaMeta
                label="Forma de pago:"
                valor={metodoPago.etiqueta.toUpperCase()}
                negrita
              />
              {metodoPago.ref && (
                <FilaMeta
                  label="Ref. / Aprobación:"
                  valor={
                    metodoPago.ref.startsWith("#")
                      ? metodoPago.ref
                      : `#${metodoPago.ref}`
                  }
                />
              )}
            </>
          )}

          {/* Recibido / Cambio */}
          {datos.pagoRecibido !== undefined && (
            <FilaMeta
              label="Monto recibido:"
              valor={`$${datos.pagoRecibido.toLocaleString("es-CO")}`}
            />
          )}
          {datos.devuelta !== undefined && datos.devuelta > 0 && (
            <FilaMeta
              label="Cambio / Devuelta:"
              valor={`$${datos.devuelta.toLocaleString("es-CO")}`}
              negrita
              colorValor="text-slate-900 font-black"
            />
          )}

          {/* Saldo en cuenta inteligente:
              - Si es venta directa y saldo es 0: NO mostrar (el cliente pagó de contado y no debe nada, no se satura el ticket).
              - Si tiene deuda pendiente (> 0) o saldo a favor (< 0): SIEMPRE mostrar.
              - Si la operación fue un Abono o Fiado: SIEMPRE mostrar para dar constancia de la cuenta. */}
          {datos.saldoNuevo !== undefined &&
            datos.nombreCliente !== "Venta de Mostrador" &&
            (datos.saldoNuevo !== 0 || datos.tipo === 'abono' || datos.tipo === 'abono_separe' || datos.tipo === 'fiado') && (
              <>
                <SeccionDivider tipo="suave" />
                <FilaMeta
                  label="Saldo en cuenta:"
                  valor={
                    datos.saldoNuevo === 0
                      ? "$0 — Al día ✓"
                      : datos.saldoNuevo < 0
                      ? `A favor: $${Math.abs(datos.saldoNuevo).toLocaleString("es-CO")}`
                      : `Pendiente: $${datos.saldoNuevo.toLocaleString("es-CO")}`
                  }
                  negrita
                  colorValor="text-slate-900 font-black"
                />
              </>
            )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PIE DEL TICKET — Nitidez negra 100%
          ══════════════════════════════════════════════════════ */}
      <div className="px-4 pb-4 pt-1 text-center">
        <SeccionDivider tipo="fuerte" />

        <p className="font-black text-slate-900 uppercase text-[10.5px] tracking-wide mt-2">
          {datos.mensajePieTicket || "¡GRACIAS POR SU COMPRA!"}
        </p>
        <p className="text-[9px] font-bold text-slate-900 mt-0.5">
          Conserve este comprobante para cualquier aclaración.
        </p>

        {/* Sello Fiabono */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <div className="w-4 h-4 rounded bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
            <Image
              src="/logo-verde-linea-blanca-grande.png"
              alt="Fiabono"
              width={16}
              height={16}
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[8.5px] text-slate-900 font-black tracking-tight">
            Emitido con Fiabono POS • fiabono.com
          </p>
        </div>
      </div>
    </div>
  );
}
