"use client";
import { Search, ShoppingBag, Banknote, ShoppingCart, X, ChevronRight, UserCog, Minus, Plus, CheckCircle2 } from 'lucide-react';
import { Cliente, DetalleMovimiento } from '../../types';

interface ModalRegistroProps {
  visible: boolean;
  cerrarModal: () => void;
  accionRegistro: 'fiado' | 'abono' | 'venta' | null;
  pasoRegistro: 1 | 2;
  setPasoRegistro: (paso: 1 | 2) => void;
  busqueda: string;
  setBusqueda: (val: string) => void;
  clientesFiltrados: Cliente[];
  setNombreNuevo: (nombre: string) => void;
  abrirModalNuevoCliente: () => void;
  clienteTransaccion: Cliente | null;
  setClienteTransaccion: (cliente: Cliente | null) => void;
  filasRegistro: DetalleMovimiento[];
  eliminarFila: (index: number) => void;
  actualizarFila: (index: number, campo: 'descripcion' | 'valor', valorNuevo: string) => void;
  actualizarCantidadFila: (index: number, delta: number) => void;
  formatearMonedaInput: (valor: number) => string;
  agregarFila: () => void;
  finalListaRef: any;
  pagoCliente: string;
  setPagoCliente: (pago: string) => void;
  totalFilasRegistro: number;
  procesarRegistro: () => void;
}

export default function ModalRegistro({
  visible, cerrarModal, accionRegistro, pasoRegistro, setPasoRegistro,
  busqueda, setBusqueda, clientesFiltrados, setNombreNuevo, abrirModalNuevoCliente,
  clienteTransaccion, setClienteTransaccion, filasRegistro, eliminarFila,
  actualizarFila, actualizarCantidadFila, formatearMonedaInput, agregarFila,
  finalListaRef, pagoCliente, setPagoCliente, totalFilasRegistro, procesarRegistro
}: ModalRegistroProps) {

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 z-[250] animate-in zoom-in-95 duration-200 px-2 sm:px-4">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] border border-slate-100 dark:border-slate-800/60 overflow-hidden">
        
        {/* ENCABEZADO DINÁMICO */}
        <div className={`p-6 text-white flex justify-between items-center shrink-0 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-800' : (accionRegistro === 'venta' ? 'bg-gradient-to-r from-indigo-500 to-blue-600 dark:from-indigo-600 dark:to-blue-800' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800')}`}>
          <h2 className="text-2xl font-black uppercase tracking-wide flex items-center gap-2">
            {accionRegistro === 'fiado' && <ShoppingBag size={28}/>} 
            {accionRegistro === 'abono' && <Banknote size={28}/>}
            {accionRegistro === 'venta' && <ShoppingCart size={28}/>}
            {accionRegistro === 'fiado' ? 'Registrar Fiado' : (accionRegistro === 'venta' ? 'Registrar Venta' : 'Registrar Abono')}
          </h2>
          <button onClick={cerrarModal} className="text-white hover:text-white/70 bg-white/10 rounded-full w-12 h-12 flex items-center justify-center transition-colors"><X size={24}/></button>
        </div>
        
        <div className="flex flex-col flex-1 overflow-hidden relative">
          
          {/* PASO 1: SELECCIONAR CLIENTE (Oculto en Ventas) */}
          {pasoRegistro === 1 && accionRegistro !== 'venta' && (
            <div className="p-5 sm:p-8 overflow-y-auto h-full bg-white dark:bg-[#0f172a]">
              <p className="font-bold text-slate-600 dark:text-slate-300 mb-5 text-lg">¿A qué cliente se le aplicará?</p>
              <div className="relative mb-6">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente..." className="w-full p-5 pl-14 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all text-lg" />
              </div>
              <div className="flex flex-col gap-3 pb-10">
                {clientesFiltrados.map(c => (
                  <div key={c.id} onClick={() => { setClienteTransaccion(c); setPasoRegistro(2); setBusqueda(""); }} className="p-5 bg-white dark:bg-[#020617] border border-slate-100 dark:border-slate-800/80 rounded-2xl hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer flex justify-between items-center transition-colors">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-lg flex items-center gap-2"><ChevronRight size={20} className="text-slate-500"/> {c.nombre}</span>
                  </div>
                ))}
                {clientesFiltrados.length === 0 && (
                  <button onClick={() => { setNombreNuevo(busqueda); abrirModalNuevoCliente(); setBusqueda(""); }} className="w-full bg-slate-100 dark:bg-[#020617] text-slate-700 dark:text-slate-300 font-bold py-5 rounded-2xl hover:bg-slate-200 dark:hover:bg-[#1e293b] transition-colors flex justify-center items-center gap-2 border dark:border-slate-800/80 text-lg">
                    <UserCog size={20}/> Crear &quot;{busqueda}&quot; como nuevo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PASO 2: AGREGAR ARTÍCULOS/ABONOS Y PAGOS */}
          {pasoRegistro === 2 && (accionRegistro === 'venta' || clienteTransaccion) && (
            <>
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-[#0f172a]">
                
                {accionRegistro !== 'venta' && clienteTransaccion && (
                  <div className="bg-slate-50 dark:bg-[#020617] p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex justify-between items-center mb-5">
                    <span className="text-base text-slate-500 dark:text-slate-400 shrink-0">Cliente:</span>
                    <span className="font-black text-slate-900 dark:text-white whitespace-normal break-words text-right ml-4 text-xl">{clienteTransaccion.nombre}</span>
                  </div>
                )}

                {/* LISTA DE FILAS */}
                <div className="flex flex-col gap-4 pb-4">
                  {filasRegistro.map((fila, index) => (
                    <div key={index} className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm relative">
                      {filasRegistro.length > 1 && (
                        <button onClick={() => eliminarFila(index)} className="absolute -top-3 -right-3 bg-rose-100 dark:bg-rose-900/80 text-rose-500 dark:text-rose-300 rounded-full p-2 shadow-md"><X size={18}/></button>
                      )}
                      <input type="text" value={fila.descripcion} onChange={(e) => actualizarFila(index, 'descripcion', e.target.value)} placeholder={accionRegistro === 'fiado' || accionRegistro === 'venta' ? "Descripción del artículo" : "Descripción del abono"} className="w-full p-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 dark:text-white transition-all text-base font-bold" />
                      <div className="flex gap-2 sm:gap-3 items-center w-full">
                        {(accionRegistro === 'fiado' || accionRegistro === 'venta') && (
                          <div className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shrink-0 h-[56px] w-[110px]">
                            <button onClick={() => actualizarCantidadFila(index, -1)} className="px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-colors text-slate-500"><Minus size={20}/></button>
                            <span className="flex-1 text-center font-black text-slate-800 dark:text-white text-lg">{fila.cantidad}</span>
                            <button onClick={() => actualizarCantidadFila(index, 1)} className="px-3 h-full hover:bg-slate-100 dark:hover:bg-[#1e293b] transition-colors text-slate-500"><Plus size={20}/></button>
                          </div>
                        )}
                        {(accionRegistro === 'fiado' || accionRegistro === 'venta') && <span className="text-slate-400 font-bold shrink-0 text-base">x</span>}
                        
                        <div className="relative flex-1 min-w-0">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xl">$</span>
                          <input 
                            type="text" 
                            inputMode="numeric"
                            value={formatearMonedaInput(fila.valor)} 
                            onChange={(e) => actualizarFila(index, 'valor', e.target.value)} 
                            placeholder={accionRegistro === 'fiado' || accionRegistro === 'venta' ? "Valor Uni." : "Valor"} 
                            className="w-full pl-9 pr-4 py-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 font-black text-slate-900 dark:text-white transition-all h-[56px] min-w-0 text-xl" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div ref={finalListaRef} className="h-1"></div>
                  
                  <button onClick={agregarFila} className="text-base font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 px-6 py-4 rounded-xl self-start transition-colors flex items-center gap-2 border dark:border-blue-500/20"><Plus size={20}/> Añadir fila</button>
                </div>

                {/* MÓDULO DE VENTAS ESPECIAL */}
                {accionRegistro === 'venta' && (
                  <div className="mt-2 mb-4 bg-slate-50 dark:bg-[#020617] p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
                    <p className="font-bold text-slate-700 dark:text-slate-300 mb-3 text-lg">¿Con cuánto pagó el cliente?</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-2xl">$</span>
                      <input 
                         type="text" 
                         inputMode="numeric"
                         value={pagoCliente} 
                         onChange={(e) => setPagoCliente(e.target.value)} 
                         placeholder="Ej. 50000"
                         className="w-full pl-10 pr-4 py-4 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 font-black text-2xl text-slate-900 dark:text-white transition-all"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 ml-1">Deja vacío si pagó exacto</p>
                    
                    {pagoCliente && parseFloat(pagoCliente.replace(/\D/g, '')) >= totalFilasRegistro && totalFilasRegistro > 0 && (
                      <div className="mt-5 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 flex flex-col items-center animate-in zoom-in duration-300">
                        <p className="text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-widest text-xs mb-1">Devuelta a entregar</p>
                        <p className="text-emerald-600 dark:text-emerald-400 font-black text-4xl">${(parseFloat(pagoCliente.replace(/\D/g, '')) - totalFilasRegistro).toLocaleString('es-CO')}</p>
                      </div>
                    )}
                    
                    {pagoCliente && parseFloat(pagoCliente.replace(/\D/g, '')) < totalFilasRegistro && (
                      <div className="mt-5 mb-5 flex flex-col items-center animate-in zoom-in duration-300">
                        <p className="text-rose-700 dark:text-rose-400 font-bold uppercase tracking-widest text-xs mb-1">Dinero Faltante (Se fiará)</p>
                        <p className="text-rose-600 dark:text-rose-400 font-black text-4xl">${(totalFilasRegistro - parseFloat(pagoCliente.replace(/\D/g, ''))).toLocaleString('es-CO')}</p>
                      </div>
                    )}

                    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                          Cliente <span className="text-slate-400 font-normal">(Opcional si paga completo)</span>
                        </p>
                        {clienteTransaccion ? (
                           <div className="p-4 bg-white dark:bg-[#0f172a] rounded-xl border border-indigo-300 dark:border-indigo-500/40 flex justify-between items-center shadow-sm">
                             <span className="font-bold text-slate-800 dark:text-white text-lg">{clienteTransaccion.nombre}</span>
                             <button onClick={() => setClienteTransaccion(null)} className="text-rose-500 bg-rose-50 p-2 rounded-full"><X size={20}/></button>
                           </div>
                        ) : (
                           <div className="relative">
                             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                             <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente en tu directorio..." className="w-full p-4 pl-12 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-base font-bold shadow-sm" />
                             {busqueda.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 mt-2 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-2">
                                   {clientesFiltrados.map(c => (
                                     <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusqueda(""); }} className="p-4 hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-lg cursor-pointer text-slate-800 dark:text-slate-200 font-bold mb-1">{c.nombre}</div>
                                   ))}
                                   {clientesFiltrados.length === 0 && (
                                    <button onClick={() => { setNombreNuevo(busqueda); abrirModalNuevoCliente(); setBusqueda(""); }} className="w-full p-4 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-bold flex items-center justify-center gap-2">
                                      <UserCog size={18}/> Crear &quot;{busqueda}&quot;
                                    </button>
                                   )}
                                </div>
                             )}
                           </div>
                        )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-md p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800/60 shrink-0 z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                <div className="flex justify-between items-center gap-2 p-4 bg-slate-900 dark:bg-black text-white rounded-2xl mb-4 shadow-inner border border-slate-800">
                  <span className="font-medium text-slate-300 text-lg shrink-0">Total a registrar:</span>
                  <span className={`text-3xl sm:text-4xl font-black tracking-tight break-words text-right ${accionRegistro === 'fiado' ? 'text-rose-400' : (accionRegistro === 'venta' ? 'text-blue-400' : 'text-emerald-400')}`}>${totalFilasRegistro.toLocaleString('es-CO')}</span>
                </div>
                <button onClick={procesarRegistro} className={`w-full text-white font-black text-2xl py-4 rounded-2xl shadow-lg transition-transform transform active:scale-95 flex justify-center items-center gap-2 ${accionRegistro === 'fiado' ? 'bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-rose-700' : (accionRegistro === 'venta' ? 'bg-gradient-to-r from-indigo-500 to-blue-600 dark:from-indigo-600 dark:to-blue-800 hover:from-indigo-600 hover:to-blue-700' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-800 hover:from-emerald-600 hover:to-emerald-700')}`}>
                  {accionRegistro === 'fiado' ? 'Confirmar Fiado' : (accionRegistro === 'venta' ? 'Confirmar Venta' : 'Confirmar Abono')} <CheckCircle2 size={28}/>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}