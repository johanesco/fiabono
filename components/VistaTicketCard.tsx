"use client";
import React from "react";
import { DetalleFacturaItem, DatosFacturaProps } from "./TicketFacturaModal";

interface VistaTicketCardProps {
  datos: DatosFacturaProps;
  ticketRef?: React.RefObject<HTMLDivElement | null>;
}

export default function VistaTicketCard({ datos, ticketRef }: VistaTicketCardProps) {
  const formatearFecha = (f: any) => {
    if (!f) return new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (f.toDate && typeof f.toDate === 'function') {
      return f.toDate().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (f instanceof Date) {
      return f.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatearHora = (f: any) => {
    if (!f) return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (f.toDate && typeof f.toDate === 'function') {
      return f.toDate().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (f instanceof Date) {
      return f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getTituloTipo = () => {
    if (datos.tipo === 'venta') return 'COMPROBANTE DE VENTA';
    if (datos.tipo === 'fiado') return 'COMPROBANTE DE FIADO';
    if (datos.tipo === 'abono') return 'COMPROBANTE DE ABONO';
    if (datos.tipo === 'separe') return 'COMPROBANTE DE PLAN SEPARE';
    if (datos.tipo === 'abono_separe') return 'ABONO A PLAN SEPARE';
    if (datos.tipo === 'entrega_separe') return 'ENTREGA DE PLAN SEPARE';
    if (datos.tipo === 'egreso') return 'COMPROBANTE DE EGRESO / DEVOLUCIÓN';
    return 'COMPROBANTE DE CAJA';
  };

  return (
    <div
      id="seccion-ticket-impresion"
      ref={ticketRef}
      style={{ overflowAnchor: 'none' }}
      className="w-full max-w-[340px] h-fit bg-white text-slate-900 p-2.5 sm:p-4 rounded-2xl shadow-md border border-slate-200 font-mono text-xs flex flex-col shrink-0 mx-auto my-0"
    >
      {/* ENCABEZADO NEGOCIO */}
      <div className="text-center pb-1 border-b border-dashed border-slate-300">
        {/* LOGO DEL NEGOCIO (SI ESTÁ CONFIGURADO) */}
        {datos.logoNegocio && (
          <div className="flex justify-center mb-1 h-9 overflow-hidden">
            <img 
              src={datos.logoNegocio} 
              alt="Logo Negocio" 
              crossOrigin="anonymous"
              loading="eager"
              decoding="sync"
              className="h-9 max-w-[105px] object-contain filter grayscale contrast-125"
            />
          </div>
        )}
        
        <h2 className="text-xs sm:text-base font-black uppercase tracking-wider text-slate-900 leading-tight">
          {datos.nombreNegocio || "MI NEGOCIO"}
        </h2>
        
        {datos.nitNegocio && (
          <p className="text-[10px] font-bold text-slate-700 mt-0.5">
            NIT / RUT: {datos.nitNegocio}
          </p>
        )}
        
        {datos.direccionNegocio && (
          <p className="text-[9.5px] text-slate-600 font-medium mt-0.5">
            {datos.direccionNegocio}
          </p>
        )}
        
        {datos.telefonoNegocio && (
          <p className="text-[9.5px] text-slate-600 font-medium">
            Tel / WhatsApp: {datos.telefonoNegocio}
          </p>
        )}
        
        {datos.correoNegocio && (
          <p className="text-[8.5px] text-slate-500 font-medium">
            {datos.correoNegocio}
          </p>
        )}

        <div className="mt-1 inline-block bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-widest border border-slate-300">
          {getTituloTipo()}
        </div>
      </div>

      {/* METADATOS DE LA FACTURA */}
      <div className="py-1.5 border-b border-dashed border-slate-300 space-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span className="text-slate-500 font-bold">Fecha:</span>
          <span className="font-bold text-slate-900">{formatearFecha(datos.fecha)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-bold">Hora:</span>
          <span className="font-bold text-slate-900">{formatearHora(datos.fecha)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 font-bold">Cliente:</span>
          <span className="font-black text-slate-900 truncate max-w-[180px] text-right">
            {datos.nombreCliente || "Venta de Mostrador"}
          </span>
        </div>
        {datos.celularCliente && (
          <div className="flex justify-between">
            <span className="text-slate-500 font-bold">Tel. Cliente:</span>
            <span className="font-bold text-slate-900">{datos.celularCliente}</span>
          </div>
        )}
        {datos.registradoPor && (
          <div className="flex justify-between">
            <span className="text-slate-500 font-bold">Atendido por:</span>
            <span className="font-bold text-slate-900 truncate max-w-[160px] text-right">
              {datos.registradoPor}
            </span>
          </div>
        )}
        {datos.idTransaccion && (
          <div className="flex justify-between">
            <span className="text-slate-500 font-bold">Ticket #:</span>
            <span className="font-mono text-[9px] text-slate-700">
              {datos.idTransaccion.slice(0, 8).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* LISTA DE ARTÍCULOS O DESCRIPCIÓN */}
      <div className="py-1.5 border-b border-dashed border-slate-300">
        <div className="flex justify-between font-black text-[9.5px] sm:text-[10px] text-slate-800 pb-0.5 border-b border-slate-200">
          <span className="w-1/2">CANT / PRODUCTO</span>
          <span className="w-1/4 text-right">VR. UNIT</span>
          <span className="w-1/4 text-right">TOTAL</span>
        </div>

        <div className="space-y-1.5 pt-2">
          {datos.detalles && datos.detalles.length > 0 ? (
            datos.detalles.map((item: DetalleFacturaItem, idx: number) => {
              const cant = item.cantidad || 1;
              const vUnit = item.valorUnitario || (cant > 0 ? (item.valor || 0) / cant : item.valor || 0);
              const vTotal = item.valor || (cant * vUnit);

              return (
                <div key={idx} className="flex justify-between items-start text-[11px] leading-tight py-0.5">
                  <div className="w-1/2 pr-1">
                    <p className="font-bold text-slate-900">{cant}x {item.descripcion || "Artículo"}</p>
                  </div>
                  <span className="w-1/4 text-right text-slate-600 font-mono text-[10.5px]">
                    ${vUnit.toLocaleString('es-CO')}
                  </span>
                  <span className="w-1/4 text-right font-black text-slate-900 font-mono text-[11px] shrink-0">
                    ${vTotal.toLocaleString('es-CO')}
                  </span>
                </div>
              );
            })
          ) : (() => {
            const desc = (datos.descripcionGeneral || '').trim();
            const prefijoMatch = desc.match(/^(Saldo pendiente de venta|Saldo pendiente|Venta de|Venta|Fiado de|Fiado):\s*(.+)$/i);
            const prefijoTexto = prefijoMatch ? prefijoMatch[1] : null;
            const cuerpoItems = prefijoMatch ? prefijoMatch[2] : desc;
            const partes = cuerpoItems.includes(',') ? cuerpoItems.split(',').map(s => s.trim()).filter(Boolean) : [];

            if (partes.length > 1) {
              return (
                <div className="space-y-1.5">
                  {prefijoTexto && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-0.5">
                      {prefijoTexto}:
                    </p>
                  )}
                  {partes.map((p, idx) => {
                    const matchCant = p.match(/^(\d+)[xX]\s*(.+)$/);
                    const cant = matchCant ? parseInt(matchCant[1], 10) : 1;
                    const nombreArt = matchCant ? matchCant[2].trim() : p;
                    return (
                      <div key={idx} className="flex justify-between items-start text-[11px] leading-tight border-b border-dashed border-slate-100 last:border-none py-0.5">
                        <div className="w-1/2 pr-1">
                          <p className="font-bold text-slate-900">{cant}x {nombreArt}</p>
                        </div>
                        <span className="w-1/4 text-right text-slate-400 font-mono text-[10px]">-</span>
                        <span className="w-1/4 text-right text-slate-400 font-mono text-[10px]">-</span>
                      </div>
                    );
                  })}
                </div>
              );
            }

            return (
              <div className="flex justify-between items-center text-[11px]">
                <span className="w-3/4 font-bold text-slate-800">
                  {datos.descripcionGeneral || (datos.tipo === 'abono' ? 'Abono a cuenta' : (datos.tipo === 'fiado' ? 'Fiado de mercancía' : 'Venta directa'))}
                </span>
                <span className="w-1/4 text-right font-black text-slate-900 font-mono">
                  ${(datos.montoTotal || 0).toLocaleString('es-CO')}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* TOTALES Y PAGOS */}
      <div className="py-1.5 border-b border-dashed border-slate-300 space-y-0.5 text-[10px]">
        {/* Desglose de Descuento si aplica */}
        {datos.montoDescuento !== undefined && datos.montoDescuento > 0 && (
          <>
            {datos.montoBruto && (
              <div className="flex justify-between items-center text-slate-600">
                <span>Subtotal Bruto:</span>
                <span className="font-bold">${datos.montoBruto.toLocaleString('es-CO')}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-900 font-bold">
              <span>Descuento {datos.descuentoTipo === 'porcentaje' ? `(${datos.descuentoValor}%)` : ''}:</span>
              <span>-${datos.montoDescuento.toLocaleString('es-CO')}</span>
            </div>
          </>
        )}

        {/* Desglose de IVA si aplica */}
        {datos.subtotal !== undefined && datos.valorIva !== undefined && datos.valorIva > 0 && (
          <>
            <div className="flex justify-between items-center text-slate-600">
              <span>Base gravable:</span>
              <span className="font-bold">${datos.subtotal.toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>IVA ({datos.porcentajeIva || 19}%):</span>
              <span className="font-bold">${datos.valorIva.toLocaleString('es-CO')}</span>
            </div>
          </>
        )}

        <div className="flex justify-between items-center text-xs sm:text-sm font-black pt-0.5">
          <span className="uppercase text-slate-900">TOTAL:</span>
          <span className="text-sm sm:text-base text-slate-900">
            ${(datos.montoTotal || 0).toLocaleString('es-CO')}
          </span>
        </div>

        {/* MÉTODO DE PAGO Y REFERENCIA DINÁMICA */}
        {datos.metodoPago && (() => {
          let subMetodo = datos.subMetodoPago || '';
          let refLimpia = datos.referenciaPago || '';

          // Si en referenciaPago viene un string compuesto como "Bancolombia — 12345" o solo "Bancolombia"
          if (refLimpia.includes(' — ')) {
            const partes = refLimpia.split(' — ');
            if (!subMetodo && partes[0]) subMetodo = partes[0].trim();
            refLimpia = partes.slice(1).join(' — ').trim();
          } else if (refLimpia) {
            // Si coincide exactamente con alguna plataforma conocida
            const bancosConocidos = ['nequi', 'daviplata', 'bancolombia', 'pse', 'addi', 'sistecrédito', 'sistecredito', 'krediya'];
            if (bancosConocidos.includes(refLimpia.toLowerCase().trim())) {
              if (!subMetodo) subMetodo = refLimpia.trim();
              refLimpia = '';
            }
          }

          let etiquetaMetodo = '';
          if (datos.metodoPago === 'transferencia') {
            etiquetaMetodo = subMetodo ? `Transferencia (${subMetodo})` : 'Transferencia';
          } else if (datos.metodoPago === 'datafono') {
            etiquetaMetodo = 'Datáfono / Tarjeta';
          } else if (datos.metodoPago === 'credito_externo') {
            etiquetaMetodo = subMetodo ? `Crédito (${subMetodo})` : 'Crédito Externo';
          } else if (datos.metodoPago === 'efectivo') {
            etiquetaMetodo = 'Efectivo';
          } else if (datos.metodoPago === 'fiado') {
            etiquetaMetodo = 'Crédito Directo (Fiado)';
          } else {
            etiquetaMetodo = String(datos.metodoPago);
          }

          return (
            <>
              <div className="flex justify-between items-center text-slate-700 pt-0.5">
                <span className="font-bold">Forma de Pago:</span>
                <span className="font-black uppercase text-slate-900">
                  {etiquetaMetodo}
                </span>
              </div>

              {refLimpia && (
                <div className="flex justify-between items-center text-slate-600 text-[9px]">
                  <span className="font-medium">Ref. / Aprobación:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {refLimpia.startsWith('#') ? refLimpia : `#${refLimpia}`}
                  </span>
                </div>
              )}
            </>
          );
        })()}

        {datos.pagoRecibido !== undefined && (
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-bold">Monto Recibido:</span>
            <span className="font-bold">${datos.pagoRecibido.toLocaleString('es-CO')}</span>
          </div>
        )}

        {datos.devuelta !== undefined && datos.devuelta > 0 && (
          <div className="flex justify-between items-center text-slate-700">
            <span className="font-bold">Cambio / Devuelta:</span>
            <span className="font-black text-emerald-600">${datos.devuelta.toLocaleString('es-CO')}</span>
          </div>
        )}

        {/* ESTADO DE CUENTA RESULTANTE (SI CORRESPONDE A CLIENTE REGISTRADO) */}
        {datos.saldoNuevo !== undefined && datos.nombreCliente !== "Venta de Mostrador" && (
          <div className="mt-0.5 pt-0.5 border-t border-slate-100">
            <div className="flex justify-between items-center font-bold">
              <span className="text-slate-600">Saldo en Cuenta:</span>
              <span className={`font-black ${
                datos.saldoNuevo === 0
                  ? 'text-slate-500'
                  : (datos.saldoNuevo < 0 ? 'text-emerald-600' : 'text-rose-600')
              }`}>
                {datos.saldoNuevo === 0
                  ? '$0 (Al día)'
                  : (datos.saldoNuevo < 0
                      ? `A favor: $${Math.abs(datos.saldoNuevo).toLocaleString('es-CO')}`
                      : `Pendiente: $${datos.saldoNuevo.toLocaleString('es-CO')}`
                    )
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* PIE DEL TICKET */}
      <div className="pt-1.5 text-center text-[9px] text-slate-500 space-y-0.5">
        <p className="font-black text-slate-800 uppercase">
          {datos.mensajePieTicket || "¡GRACIAS POR SU COMPRA!"}
        </p>
        <p className="text-[8px] text-slate-600">Conserve este comprobante para cualquier aclaración.</p>
        <p className="text-[7.5px] text-slate-400 font-sans mt-0.5">Generado por Fiabono.com</p>
      </div>
    </div>
  );
}
