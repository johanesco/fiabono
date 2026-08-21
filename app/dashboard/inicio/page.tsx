"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, ShoppingBag, Banknote, Users, CheckCircle2, ChevronRight, X, MessageCircle, UserCog, ShoppingCart, Star, Clock, Store, Printer, Edit3, Trash2 } from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "../../../hooks/AuthContext";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalGestionCliente from "@/components/ModalGestionCliente";

export default function InicioPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const planActual = datosSesion?.planActual;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerDirectorio = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verDirectorio === true;

  const [clientes, setClientes] = useState<any[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<any[]>([]);

  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [verTodosClientes, setVerTodosClientes] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [modalSuscripcion, setModalSuscripcion] = useState({ visible: false, titulo: "", mensaje: "" });
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: DatosFacturaProps | null }>({ visible: false, datos: null });
  const [modalGestionCliente, setModalGestionCliente] = useState<{
    visible: boolean;
    modo: 'editar' | 'eliminar';
    cliente: any | null;
  }>({ visible: false, modo: 'editar', cliente: null });

  const handleGestionClienteSuccess = (clienteActualizado?: any, fueEliminado?: boolean) => {
    if (fueEliminado) {
      setClientes(prev => prev.filter(c => c.id !== clienteActivo?.id));
      setClienteActivo(null);
      setMovimientosCliente([]);
    } else if (clienteActualizado) {
      setClientes(prev => prev.map(c => c.id === clienteActualizado.id ? clienteActualizado : c).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setClienteActivo(clienteActualizado);
    }
  };

  const abrirTicketDeMovimiento = (mov: any, cliente: any) => {
    const datosTicket: DatosFacturaProps = {
      nombreNegocio: nombreNegocio || 'Mi Negocio',
      telefonoNegocio: datosSesion?.telefonoNegocio || '',
      correoNegocio: datosSesion?.correoNegocio || '',
      nombreCliente: cliente?.nombre || 'Cliente',
      celularCliente: cliente?.celular || '',
      registradoPor: mov.registradoPor || '',
      fecha: mov.fecha,
      tipo: mov.tipo,
      detalles: mov.detalles && mov.detalles.length > 0 ? mov.detalles : undefined,
      descripcionGeneral: mov.descripcion,
      montoTotal: mov.monto,
      saldoNuevo: mov.saldoResultante !== undefined ? mov.saldoResultante : cliente?.deudaTotal,
      idTransaccion: mov.id
    };

    setModalTicketFactura({ visible: true, datos: datosTicket });
  };

  useEffect(() => {
    if (cuentaPrincipalId) cargarDatosGlobales(cuentaPrincipalId);
  }, [cuentaPrincipalId]);

  const cargarDatosGlobales = async (uid: string) => {
    try {
      const qC = query(collection(db, "clientes"), where("usuarioId", "==", uid));
      const snapC = await getDocs(qC);
      const listaC: any[] = [];
      snapC.forEach((doc) => listaC.push({ id: doc.id, ...doc.data() }));
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);

      const qM = query(collection(db, "movimientos"), where("usuarioId", "==", uid));
      const snapM = await getDocs(qM);
      const listaM: any[] = [];
      snapM.forEach((doc) => listaM.push({ id: doc.id, ...doc.data() }));
      listaM.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
      setTodosMovimientos(listaM);
    } catch (error) { console.error(error); }
  };

  const cargarMovimientosClienteDirecto = async (clienteId: string) => {
    const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
    const snapM = await getDocs(qM);
    const lista: any[] = [];
    snapM.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
    lista.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
    setMovimientosCliente(lista);
  };

  const abrirUpsell = (titulo: string, mensaje: string) => { setModalSuscripcion({ visible: true, titulo, mensaje }); };

  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    if (planActual === 'basico' && clientes.length >= 10) {
      setModalNuevoCliente(false);
      setTimeout(() => { abrirUpsell("Límite de Clientes Alcanzado", "En el plan básico se permite un máximo de 10 clientes.\n\nMejora a nuestro plan PRO para clientes ilimitados."); }, 100);
      return;
    }
    setGuardandoCliente(true);
    try {
      await addDoc(collection(db, "clientes"), { nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: cuentaPrincipalId, fecha_creacion: new Date() });
      setModalNuevoCliente(false); setNombreNuevo(""); setCelularNuevo("");
      await cargarDatosGlobales(cuentaPrincipalId);
      toast.success("Cliente guardado con éxito");
    } catch (error) { alert("Error al guardar cliente."); } finally { setGuardandoCliente(false); }
  };

  const normalizarMensajeWhatsApp = (texto: string) => {
    return texto
      .replace(/\uFFFD/g, '')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\r\n/g, '\n')
      .trim();
  };

  const generarTextoComprobante = (tipo: 'estado' | 'comprobante' = 'estado', cliente: any = {}, accion?: 'fiado' | 'abono' | 'venta' | null, detallesArray?: any[], totalMov?: number) => {
    const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;
    const nombreCliente = cliente.nombre || 'Cliente';
    const nombreTienda = nombreNegocio || 'nuestra tienda';
    let texto = '';

    if (tipo === 'estado') {
      texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente presentas un saldo pendiente de: *${saldoFormat}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;

      if ((cliente.deudaTotal || 0) === 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Tu cuenta se encuentra al día.

Gracias por seguir con nosotros.

*¡Que tengas un gran día!*`;
      } else if ((cliente.deudaTotal || 0) < 0) {
        texto = `¡Hola, *${nombreCliente}*! Te saludamos de *${nombreTienda}*.

===================
*ESTADO DE CUENTA*
===================

• Actualmente tienes un saldo a favor de: *${saldoFormat}*

Quedamos pendientes para revisar detalles o responder cualquier duda.

*¡Que tengas un gran día!*`;
      }
    } else if (tipo === 'comprobante') {
      const nombreDestino = cliente.id === 'mostrador' || !cliente.nombre ? 'Cliente' : cliente.nombre;
      texto = `¡Hola, *${nombreDestino}*! Gracias por tu compra en *${nombreTienda}*.

===================
*COMPROBANTE DE COMPRA*
===================

`;

      if (detallesArray && detallesArray.length > 0) {
        detallesArray.forEach((d: any) => {
          const cantidad = d.cantidad || 1;
          const descripcion = d.descripcion || 'Producto';
          const valorUnitario = d.valorUnitario ?? d.valor ?? 0;
          const totalProducto = Number(cantidad) * Number(valorUnitario || 0);
          texto += `• ${cantidad}x ${descripcion}\n  Precio unitario: *$${Number(valorUnitario).toLocaleString('es-CO')}*\n  Total: *$${Number(totalProducto).toLocaleString('es-CO')}*\n\n`;
        });
        texto += `*TOTAL: $${(totalMov ?? 0).toLocaleString('es-CO')}*\n\nGracias por tu compra. Estamos atentos para cualquier consulta.\n\n*¡Te esperamos pronto!*`;
      }

      if (cliente.id !== 'mostrador') {
        if ((cliente.deudaTotal || 0) === 0) {
          texto += '\n\nTu cuenta queda al día. Gracias por tu confianza.';
        } else if ((cliente.deudaTotal || 0) < 0) {
          texto += `\n\nTu saldo a favor es de *${saldoFormat}*.`;
        } else {
          texto += `\n\nTu saldo pendiente actual es de *${saldoFormat}*.`;
        }
      }
    }

    return normalizarMensajeWhatsApp(texto);
  };

  const abrirWhatsApp = (texto: string, celular?: string) => {
    const mensajeLimpio = normalizarMensajeWhatsApp(texto);
    const celularLimpio = celular ? celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(mensajeLimpio)}` : `https://wa.me/?text=${encodeURIComponent(mensajeLimpio)}`;

    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1024) {
        window.open(url, '_blank');
      } else {
        window.location.href = url;
      }
    }
  };

  const clientesFiltrados = clientes.filter(c =>
    (c.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.celular || "").toString().includes(busqueda)
  );
  const directorioFiltrado = clientes.filter(c => 
    (c.nombre || "").toLowerCase().includes(busquedaDirectorio.toLowerCase()) ||
    (c.celular || "").toString().includes(busquedaDirectorio)
  );

  const getSaludo = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Buenos días";
    if (hora >= 12 && hora < 19) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <>
      {/* REDUCIMOS LOS GAPS PARA ESCRITORIO: md:gap-3 lg:gap-4 xl:gap-4. Móvil sigue intacto (gap-6 sm:gap-8) */}
      <div className="flex flex-col gap-6 sm:gap-8 md:gap-3 lg:gap-4 xl:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 sm:px-6 lg:px-8 pt-4 md:pt-2 h-full w-full max-w-[1600px] mx-auto">

        {/* ENCABEZADO DE BIENVENIDA */}
        <header className="flex flex-col gap-1 px-1 md:mb-1 lg:mb-2">
          {/* LOGO DE FIABONO (Solo visible en celular) */}
          <div className="md:hidden flex items-center mb-1">
            <span className="text-[22px] font-black tracking-tighter text-blue-600 dark:text-blue-500 flex items-center gap-1">
              Fiabono
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate tracking-tight">
              {getSaludo()}, <span className="text-blue-600 dark:text-blue-500">{datosSesion?.nombreUsuario?.split(' ')[0] || 'Usuario'}</span> 
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] md:text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1.5">
                <Store size={14}/> {nombreNegocio || 'Cargando...'}
              </span>
              <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] md:text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md">
                {datosSesion?.rol === 'cajero' ? 'Colaborador' : 'Administrador'}
              </span>
            </div>
          </div>
        </header>

        {/* BUSCADOR */}
        <section className="relative z-20">
          <div className="relative shadow-sm rounded-[2rem]">
            <Search className="absolute left-4 sm:left-5 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 sm:w-7 sm:h-7 md:w-5 md:h-5" />
            {/* Input más compacto en escritorio: md:p-3 lg:p-4 */}
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (clientesFiltrados.length > 0) {
                    const primerCliente = clientesFiltrados[0];
                    setClienteActivo(primerCliente);
                    cargarMovimientosClienteDirecto(primerCliente.id);
                    setBusqueda("");
                    setVerTodosClientes(true);
                  }
                }
              }}
              placeholder="Buscar cliente registrado..."
              className="w-full text-lg sm:text-xl md:text-base lg:text-lg p-5 sm:p-6 md:p-3 lg:p-4 pl-12 sm:pl-16 md:pl-12 lg:pl-12 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/60 rounded-[2rem] md:rounded-2xl lg:rounded-3xl focus:border-blue-500 dark:focus:border-blue-400 outline-none shadow-sm dark:shadow-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
            />
          </div>

          {busqueda.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800/80 rounded-3xl mt-2 shadow-2xl max-h-[60vh] overflow-y-auto z-40 p-3">
              {clientesFiltrados.length > 0 ? (
                clientesFiltrados.map((c) => (
                  <div key={c.id} onClick={() => { 
                    setClienteActivo(c); 
                    cargarMovimientosClienteDirecto(c.id); 
                    setBusqueda(""); 
                    setVerTodosClientes(true);
                  }} className="p-5 hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-2xl cursor-pointer flex justify-between items-center transition-colors mb-2 gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xl md:text-lg truncate min-w-0 flex-1">{c.nombre}</span>
                    <span className={`text-base md:text-sm font-black tracking-tight shrink-0 whitespace-nowrap ${c.deudaTotal === 0 ? 'text-slate-400 dark:text-slate-500' : (c.deudaTotal < 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400')}`}>
                      {c.deudaTotal === 0 ? '$0 (Al día)' : (c.deudaTotal < 0 ? `A favor: $${Math.abs(c.deudaTotal).toLocaleString('es-CO')}` : `Deuda: $${c.deudaTotal.toLocaleString('es-CO')}`)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="mb-6 text-xl md:text-lg">"{busqueda}" no está en tu directorio.</p>
                  <button onClick={() => { setNombreNuevo(busqueda); setModalNuevoCliente(true); setBusqueda(""); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 md:py-3 px-8 rounded-2xl text-lg md:text-base transition-colors flex items-center justify-center gap-2 mx-auto shadow-md">
                    <UserCog size={24} className="md:w-5 md:h-5" /> Crear Cliente
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* BOTONES PRINCIPALES: Altura dramáticamente reducida en Escritorio */}
        <section className="flex flex-col gap-4 sm:gap-6 md:gap-3 lg:gap-4">
          {/* Botón VENDER: py-12 (Móvil) vs md:py-5 lg:py-6 (Escritorio) */}
          <button onClick={() => router.push('/dashboard/vender')}
            className="w-full bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-600 hover:to-green-800 text-white font-black text-2xl sm:text-4xl md:text-2xl lg:text-3xl xl:text-4xl py-12 md:py-5 lg:py-6 xl:py-8 rounded-[2rem] md:rounded-2xl lg:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30 dark:border-emerald-500/20">
            <ShoppingCart className="mb-2 sm:mb-3 opacity-90 shrink-0 w-12 h-12 sm:w-16 sm:h-16 md:w-10 md:h-10 lg:w-12 lg:h-12" />
            VENDER
          </button>

          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-3 lg:gap-4">
            {/* Botones FIAR / ABONAR: py-10 (Móvil) vs md:py-4 lg:py-5 (Escritorio) */}
            <button onClick={() => router.push('/dashboard/fiar')}
              className="bg-gradient-to-br from-rose-500 to-red-600 dark:from-rose-600 dark:to-rose-800 hover:from-rose-600 hover:to-red-700 text-white font-black text-2xl sm:text-3xl md:text-xl lg:text-2xl xl:text-3xl py-10 md:py-4 lg:py-5 xl:py-6 rounded-[2rem] md:rounded-2xl lg:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-rose-400/30 dark:border-rose-500/20">
              <ShoppingBag className="mb-2 sm:mb-3 opacity-90 shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-8 md:h-8 lg:w-10 lg:h-10" />
              FIAR
            </button>
            <button onClick={() => router.push('/dashboard/abonar')}
              className="bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-black text-2xl sm:text-3xl md:text-xl lg:text-2xl xl:text-3xl py-10 md:py-4 lg:py-5 xl:py-6 rounded-[2rem] md:rounded-2xl lg:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-blue-400/30 dark:border-blue-500/20">
              <Banknote className="mb-2 sm:mb-3 opacity-90 shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-8 md:h-8 lg:w-10 lg:h-10" />
              ABONAR
            </button>
          </div>
        </section>

        {/* DIRECTORIO DE CLIENTES: py-6 (Móvil) vs md:py-3 lg:py-4 (Escritorio) */}
        {puedeVerDirectorio && (
          <button onClick={() => setVerTodosClientes(true)} className="bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-[#1e293b] text-blue-900 dark:text-blue-400 font-bold text-xl md:text-base lg:text-lg py-6 md:py-3 lg:py-4 xl:py-4 rounded-[2rem] md:rounded-2xl lg:rounded-3xl shadow-sm transition-colors border border-slate-200 dark:border-slate-800/60 flex justify-center items-center gap-3 relative z-10 mb-4 md:mb-0">
            <Users className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 md:w-5 md:h-5 lg:w-6 lg:h-6" /> Directorio de clientes
          </button>
        )}
      </div>

      {/* --- MODAL DIRECTORIO --- */}
      {verTodosClientes && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-0 md:p-6 z-[200] overflow-hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-none md:rounded-[2.5rem] w-full h-full md:h-[90vh] md:max-w-7xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row">

            <div className="w-full md:w-5/12 flex flex-col border-r border-slate-100 dark:border-slate-800 h-full bg-slate-50/50 dark:bg-[#020617]/50">
              <div className="bg-blue-600 dark:bg-blue-900 p-6 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2"><Users size={26} /> Directorio de Clientes</h2>
                <button onClick={() => setVerTodosClientes(false)} className="text-blue-200 hover:text-white transition-colors bg-blue-700/50 p-2 rounded-full"><X size={24} /></button>
              </div>

              <div className="p-4 bg-white dark:bg-[#0f172a] shrink-0 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    value={busquedaDirectorio}
                    onChange={(e) => setBusquedaDirectorio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (directorioFiltrado.length > 0) {
                          const primer = directorioFiltrado[0];
                          setClienteActivo(primer);
                          cargarMovimientosClienteDirecto(primer.id);
                        }
                      }
                    }}
                    placeholder="Buscar nombre o celular..."
                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {directorioFiltrado.map(c => (
                  <div key={c.id} onClick={() => {
                    setClienteActivo(c);
                    cargarMovimientosClienteDirecto(c.id);
                  }} className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${clienteActivo?.id === c.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/50 shadow-sm' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/80 hover:border-blue-300'}`}>
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">{c.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.celular || "Sin celular"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {(c.deudaTotal || 0) < 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-black px-1.5 py-0.5 rounded mr-1">A favor</span>}
                      <span className={`font-black text-lg tracking-tight ${c.deudaTotal === 0 ? 'text-slate-400' : ((c.deudaTotal || 0) < 0 ? 'text-emerald-500 dark:text-emerald-400 font-black' : 'text-rose-500')}`}>
                        {c.deudaTotal === 0 ? '$0' : `$${Math.abs(c.deudaTotal || 0).toLocaleString('es-CO')}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button onClick={() => { setNombreNuevo(""); setModalNuevoCliente(true); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-colors flex justify-center items-center gap-2 text-base">
                  <UserCog size={20} /> Nuevo Cliente
                </button>
              </div>
            </div>

            {/* PANEL DERECHO DE ESCRITORIO (Perfil de Cliente) */}
            <div className="hidden md:flex flex-1 flex-col h-full bg-white dark:bg-[#0f172a] overflow-hidden">
              {clienteActivo ? (
                <div className="flex flex-col h-full">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="text-2xl font-black">{clienteActivo.nombre}</h3>
                        <p className="text-slate-400 text-sm">{clienteActivo.celular || "Sin celular registrado"}</p>
                      </div>
                      {datosSesion?.rol !== 'cajero' && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            type="button"
                            onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                            title="Modificar Cliente"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/80 text-slate-300 hover:text-white transition-colors"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                            title="Eliminar Cliente"
                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1 inline-block ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}>
                        {(clienteActivo.deudaTotal || 0) < 0 ? ' Saldo a favor' : 'Saldo Actual'}
                      </span>
                      <span className={`text-3xl font-black block ${clienteActivo.deudaTotal === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                        ${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-[#020617] border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0">
                    <div className="flex gap-3">
                      <button onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-sm uppercase shadow-sm">+ Vender</button>
                      <button onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl text-sm uppercase shadow-sm">+ Fiar</button>
                      <button onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-sm uppercase shadow-sm">+ Abonar</button>
                    </div>
                    {clienteActivo.celular && datosSesion?.rol !== 'cajero' && (
                      <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] dark:text-[#25D366] font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm border border-[#25D366]/20">
                        <MessageCircle size={18} /> Enviar estado por WhatsApp
                      </button>
                    )}
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 dark:bg-[#020617]/50">
                    <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Clock size={16}/> Historial Detallado</h4>
                    {movimientosCliente.map(mov => (
                      <div key={mov.id} className="p-4 md:p-5 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2 md:space-y-3">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
                        <div className="pl-1 md:pl-2">
                          <div className="flex justify-between items-center pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                            <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')}`}>{mov.tipo}</span>
                            
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] md:text-[11px] font-bold uppercase">
                              {mov.registradoPor && (
                                <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  👤 {mov.registradoPor}
                                </span>
                              )}
                              {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                              <span className="text-slate-400 whitespace-nowrap">
                                {mov.fecha?.toDate().toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </div>
                          
                          {mov.detalles && mov.detalles.length > 0 ? (
                            <div className="space-y-1 md:space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700 md:border-none">
                              {mov.detalles.map((d: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-xs md:text-sm">
                                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} font-black mr-1 md:mr-1.5`}>{d.cantidad}x</strong>}
                                    {d.descripcion}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100">${d.valor.toLocaleString('es-CO')}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                          )}
                          
                          <div className="flex justify-between items-center pt-2 mt-1 md:mt-0 md:pt-3 border-t border-slate-200 dark:border-slate-700 md:border-slate-100 dark:md:border-slate-800 font-black">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">Total:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => abrirTicketDeMovimiento(mov, clienteActivo)}
                                title="Imprimir Factura / Ticket"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                              >
                                <Printer size={14} />
                              </button>
                              <span className={`text-base md:text-xl ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                                {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {movimientosCliente.length === 0 && <p className="text-center text-slate-400 py-10">Sin transacciones registradas.</p>}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <Users size={64} className="opacity-20 mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Selecciona un cliente</h3>
                  <p className="text-sm mt-1 max-w-sm">Haz clic en cualquier cliente de la lista para ver su historial.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- PERFIL DEL CLIENTE EN MÓVIL --- */}
      {clienteActivo && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-sm flex items-end justify-center p-0 z-[500] md:hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] w-full max-w-xl shadow-2xl relative flex flex-col h-[96vh] overflow-hidden border border-slate-100 dark:border-slate-800/60">
            <div className="p-4 flex justify-between items-center bg-slate-50 dark:bg-[#020617] shrink-0 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg">Perfil de Cliente</h3>
              <button onClick={() => setClienteActivo(null)} className="bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 rounded-full p-3 font-bold shadow-sm"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 bg-slate-50 dark:bg-[#020617] text-center shrink-0 flex flex-col items-center border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-center gap-2 mb-1">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">{clienteActivo.nombre}</h2>
                {datosSesion?.rol !== 'cajero' && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                      title="Modificar Cliente"
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                      title="Eliminar Cliente"
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 shadow-sm border border-slate-200 dark:border-slate-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-slate-500 font-medium text-base mb-4">{clienteActivo.celular || "Sin número registrado"}</p>
              <div className="flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] w-full py-4 px-3 rounded-2xl border shadow-sm mb-4">
                <p className={`text-xs font-bold uppercase tracking-widest mb-1 px-2 py-0.5 rounded ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'}`}>{(clienteActivo.deudaTotal || 0) < 0 ? ' Saldo a favor' : (clienteActivo.deudaTotal === 0 ? 'CUENTA AL DÍA' : 'SALDO PENDIENTE')}</p>
                <p className={`text-4xl sm:text-5xl font-black tracking-tighter ${clienteActivo.deudaTotal === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500' : 'text-rose-500')}`}>${Math.abs(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full mb-3">
                <button onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} className="bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-sm text-xs uppercase">Vender</button>
                <button onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} className="bg-rose-500 text-white font-bold py-3 rounded-xl shadow-sm text-xs uppercase">Fiar</button>
                <button onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} className="bg-blue-500 text-white font-bold py-3 rounded-xl shadow-sm text-xs uppercase">Abonar</button>
              </div>
            </div>
            
            <div className="bg-white dark:bg-[#0f172a] p-6 pb-10 flex-1 overflow-y-auto space-y-3">
              <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Clock size={16}/> Historial Reciente</h4>
              {movimientosCliente.map(mov => (
                <div key={mov.id} className="p-4 md:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2 md:space-y-3">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')}`}></div>
                  <div className="pl-1 md:pl-2">
                    <div className="flex justify-between items-center pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                      <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg ${mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')}`}>{mov.tipo}</span>
                      
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] md:text-[11px] font-bold uppercase">
                        {mov.registradoPor && (
                          <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            👤 {mov.registradoPor}
                          </span>
                        )}
                        {mov.registradoPor && <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap">•</span>}
                        <span className="text-slate-400 whitespace-nowrap">
                          {mov.fecha?.toDate ? mov.fecha.toDate().toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : (mov.fecha instanceof Date ? mov.fecha.toLocaleDateString('es-CO', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '')}
                        </span>
                      </div>
                    </div>
                    
                    {mov.detalles && mov.detalles.length > 0 ? (
                      <div className="space-y-1 md:space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700 md:border-none">
                        {mov.detalles.map((d: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs md:text-sm">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} font-black mr-1 md:mr-1.5`}>{d.cantidad}x</strong>}
                              {d.descripcion}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">${d.valor.toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200">{mov.descripcion}</p>
                    )}
                    
                    <div className="flex justify-between items-center pt-2 mt-1 md:mt-0 md:pt-3 border-t border-slate-200 dark:border-slate-700 md:border-slate-100 dark:md:border-slate-800 font-black">
                      <span className="text-xs text-slate-400 uppercase tracking-wider">Total:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => abrirTicketDeMovimiento(mov, clienteActivo)}
                          title="Imprimir Factura / Ticket"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
                        >
                          <Printer size={14} />
                        </button>
                        <span className={`text-base md:text-xl ${mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500')}`}>
                          {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALES PEQUEÑOS (NUEVO CLIENTE / SUSCRIPCIÓN) --- */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[210]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800/60 animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><UserCog size={28} /> Registrar Cliente</h3>
            <div className="flex flex-col gap-4 mb-8">
              <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl font-bold text-lg" />
              <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="w-full p-5 bg-slate-50 dark:bg-[#020617] border rounded-2xl font-bold text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl text-lg">Cancelar</button>
              <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">Guardar <CheckCircle2 size={20} /></button>
            </div>
          </div>
        </div>
      )}

      {modalSuscripcion.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[800]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center">
            <Star size={40} className="text-blue-600 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{modalSuscripcion.titulo}</h3>
            <p className="text-base text-slate-500 mb-6">{modalSuscripcion.mensaje}</p>
            <button onClick={() => setModalSuscripcion({ visible: false, titulo: "", mensaje: "" })} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl">Entendido</button>
          </div>
        </div>
      )}

      {/* MODAL DE IMPRESIÓN DE TICKET TÉRMICO */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />

      {/* MODAL DE MODIFICAR / ELIMINAR CLIENTE */}
      <ModalGestionCliente
        isOpen={modalGestionCliente.visible}
        modo={modalGestionCliente.modo}
        cliente={modalGestionCliente.cliente}
        onClose={() => setModalGestionCliente({ visible: false, modo: 'editar', cliente: null })}
        onSuccess={handleGestionClienteSuccess}
      />

    </>
  );
}