"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, ShoppingBag, Banknote, Users, CheckCircle2, ChevronRight, X, MessageCircle, UserCog, ShoppingCart, Star, Clock, Store, Printer, Edit3, Trash2, Receipt, Bookmark } from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "../../../hooks/AuthContext";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import ModalGestionCliente from "@/components/ModalGestionCliente";

export default function InicioPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.esAdmin ?? (datosSesion?.rol !== 'cajero');
  const planActual = datosSesion?.planActual;
  const nombreNegocio = datosSesion?.nombreNegocio;
  const puedeVerDirectorio = datosSesion?.rol !== 'cajero' || datosSesion?.permisos?.verDirectorio === true;
  const puedeAbonar: boolean = datosSesion?.puedeAbonar ?? true;
  const puedeSepare: boolean = datosSesion?.puedeSepare ?? true;

  const [clientes, setClientes] = useState<any[]>([]);
  const [todosMovimientos, setTodosMovimientos] = useState<any[]>([]);
  const [ordenesPendientes, setOrdenesPendientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaDirectorio, setBusquedaDirectorio] = useState("");
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientosCliente, setMovimientosCliente] = useState<any[]>([]);
  const [separesCliente, setSeparesCliente] = useState<any[]>([]);

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
      logoNegocio: datosSesion?.logoNegocio || null,
      nitNegocio: datosSesion?.nitNegocio || '',
      direccionNegocio: datosSesion?.direccionNegocio || '',
      mensajePieTicket: datosSesion?.mensajePieTicket || '',
      nombreCliente: cliente?.nombre || 'Cliente',
      celularCliente: cliente?.celular || '',
      registradoPor: mov.registradoPor || '',
      fecha: mov.fecha,
      tipo: mov.tipo,
      detalles: mov.detalles && mov.detalles.length > 0 ? mov.detalles : undefined,
      descripcionGeneral: mov.descripcion,
      montoTotal: mov.monto,
      saldoNuevo: mov.saldoResultante !== undefined ? mov.saldoResultante : cliente?.deudaTotal,
      idTransaccion: mov.id,
      metodoPago: mov.metodoPago || (mov.tipo === 'fiado' ? 'fiado' : 'efectivo'),
      referenciaPago: mov.referenciaPago,
      subtotal: mov.subtotal,
      valorIva: mov.valorIva,
      porcentajeIva: mov.porcentajeIva
    };

    setModalTicketFactura({ visible: true, datos: datosTicket });
  };

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarDatosGlobales(cuentaPrincipalId);

      if (esAdmin) {
        const qOrd = query(
          collection(db, "ordenes_pendientes"),
          where("usuarioId", "==", cuentaPrincipalId),
          where("estado", "==", "pendiente")
        );
        const unsub = onSnapshot(qOrd, (snap) => {
          const lista: any[] = [];
          snap.forEach(d => lista.push({ id: d.id, ...d.data() }));
          lista.sort((a, b) => {
            const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime();
            const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime();
            return timeB - timeA;
          });
          setOrdenesPendientes(lista);
        });
        return () => unsub();
      }
    }
  }, [cuentaPrincipalId, esAdmin]);

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
      listaM.sort((a, b) => {
        const tA = a.fecha?.toMillis ? a.fecha.toMillis() : (a.fecha ? new Date(a.fecha).getTime() : 0);
        const tB = b.fecha?.toMillis ? b.fecha.toMillis() : (b.fecha ? new Date(b.fecha).getTime() : 0);
        return tB - tA;
      });
      setTodosMovimientos(listaM);
    } catch (error) { console.error(error); }
  };

  const cargarMovimientosClienteDirecto = async (clienteId: string) => {
    try {
      const qM = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
      const snapM = await getDocs(qM);
      const lista: any[] = [];
      snapM.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => (b.fecha?.toMillis ? b.fecha.toMillis() : 0) - (a.fecha?.toMillis ? a.fecha.toMillis() : 0));
      setMovimientosCliente(lista);
    } catch (e) {
      console.error("Error cargando movimientos del cliente:", e);
    }

    try {
      const qS = query(collection(db, "separes"), where("clienteId", "==", clienteId));
      const snapS = await getDocs(qS);
      const listaS: any[] = [];
      snapS.forEach(doc => listaS.push({ id: doc.id, ...doc.data() }));
      listaS.sort((a, b) => (b.fechaCreacion?.toMillis ? b.fechaCreacion.toMillis() : 0) - (a.fechaCreacion?.toMillis ? a.fechaCreacion.toMillis() : 0));
      setSeparesCliente(listaS);
    } catch (e) {
      console.error("Error cargando separes del cliente:", e);
    }
  };

  const abrirUpsell = (titulo: string, mensaje: string) => { setModalSuscripcion({ visible: true, titulo, mensaje }); };

  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    const esGratis = datosSesion?.esGratis ?? (planActual === 'gratis' || planActual === 'basico');
    if (esGratis && clientes.length >= 15) {
      setModalNuevoCliente(false);
      setTimeout(() => { 
        abrirUpsell("Límite de Clientes Alcanzado", "En el plan Gratis puedes registrar hasta 15 clientes. Mejora a nuestro Plan Comercio o PRO para clientes ilimitados."); 
      }, 100);
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
      <div className="flex flex-col gap-6 sm:gap-8 md:gap-3 lg:gap-4 xl:gap-4 px-4 sm:px-6 lg:px-8 pt-4 md:pt-2 h-full w-full max-w-[1600px] mx-auto">
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
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] md:text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1.5 max-w-full">
                <Store size={14} className="shrink-0 text-blue-600 dark:text-blue-400"/> <span>{nombreNegocio || 'Mi Negocio'}</span>
              </span>
              <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] md:text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md shrink-0">
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

        {/* BANNER MINIMALISTA DE NOTIFICACIÓN DE ÓRDENES PENDIENTES */}
        {esAdmin && ordenesPendientes.length > 0 && (
          <div 
            onClick={() => router.push('/dashboard/ordenes')}
            className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-400/40 dark:border-amber-500/30 rounded-2xl p-2.5 sm:p-3 shadow-sm flex items-center justify-between gap-2.5 transition-all cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Receipt size={16} />
              </div>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                  {ordenesPendientes.length} {ordenesPendientes.length === 1 ? 'orden pendiente' : 'órdenes pendientes'}
                </span>
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                  Revisar
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold text-xs shrink-0 group-hover:translate-x-0.5 transition-transform">
              <span className="hidden sm:inline">Ver órdenes</span>
              <ChevronRight size={15} />
            </div>
          </div>
        )}

        {/* BOTONES PRINCIPALES: Vender full width, Fiar, Abonar y Separe adaptativos abajo */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Botón VENDER (Todo el ancho) */}
          <button
            onClick={() => router.push('/dashboard/vender')}
            className="w-full bg-gradient-to-br from-emerald-500 to-green-700 hover:from-emerald-600 hover:to-green-800 text-white font-black text-2xl sm:text-3xl lg:text-4xl py-6 sm:py-8 lg:py-10 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border border-emerald-400/30 dark:border-emerald-500/20 cursor-pointer"
          >
            <ShoppingCart className="mb-2 opacity-90 shrink-0 w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14" />
            VENDER
          </button>

          {/* Fila inferior adaptativa */}
          {(() => {
            const botonesSecundarios = [
              {
                id: 'fiar',
                nombre: 'FIAR',
                icono: ShoppingBag,
                ruta: '/dashboard/fiar',
                gradiente: 'from-rose-500 to-red-700 hover:from-rose-600 hover:to-red-800 border-rose-400/30 dark:border-rose-500/20'
              },
              ...(puedeAbonar ? [{
                id: 'abonar',
                nombre: 'ABONAR',
                icono: Banknote,
                ruta: '/dashboard/abonar',
                gradiente: 'from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 hover:from-blue-600 hover:to-blue-700 border-blue-400/30 dark:border-blue-500/20'
              }] : []),
              {
                nombre: 'SEPARE',
                icono: Bookmark,
                ruta: '/dashboard/separes',
                gradiente: 'from-violet-600 to-purple-800 hover:from-violet-700 hover:to-purple-900 border-violet-400/30 dark:border-violet-500/20'
            ];
            const gridColsClass = botonesSecundarios.length === 3 
              ? 'grid grid-cols-3 gap-2 sm:gap-4 lg:gap-5'
              : botonesSecundarios.length === 2
                ? 'grid grid-cols-2 gap-3 sm:gap-5'
                : 'grid grid-cols-1 gap-4 sm:gap-5';

            return (
              <div className={gridColsClass}>
                {botonesSecundarios.map((btn) => {
                  const Icono = btn.icono;
                  return (
                    <button
                      key={btn.id}
                      onClick={() => {
                        if (btn.esProOnly) {
                          abrirUpsell(
                            "Plan Separe Exclusivo PRO Almacén",
                            "Aparta mercancía de clientes, gestiona abonos parciales y recibe alertas automáticas de vencimiento con el Plan PRO Almacén."
                          );
                          return;
                        }
                        router.push(btn.ruta);
                      }}
                      className={`w-full bg-gradient-to-br ${btn.gradiente} text-white font-black text-sm xs:text-base sm:text-2xl lg:text-3xl py-4 sm:py-7 lg:py-8 rounded-2xl sm:rounded-3xl shadow-lg flex flex-col items-center justify-center transition-transform transform active:scale-95 border cursor-pointer relative`}
                    >
                      {btn.esProOnly && (
                        <span className="absolute top-2 right-2 bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                          👑 PRO
                        </span>
                      )}
                      <Icono className="mb-1 sm:mb-2 opacity-90 shrink-0 w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10" />
                      {btn.nombre}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* BOTÓN DIRECTORIO DE CLIENTES (MINIMALISTA Y LIMPIO) */}
        {puedeVerDirectorio && (
          <button 
            onClick={() => setVerTodosClientes(true)}
            className="w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 hover:border-blue-400/50 py-2.5 px-3.5 sm:px-4 rounded-2xl shadow-sm flex items-center justify-between transition-all group cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <Users size={16} />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">Directorio de Clientes</h3>
            </div>
            <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-bold text-xs">
              <span className="hidden sm:inline text-[11px]">Abrir</span>
              <ChevronRight size={15} />
            </div>
          </button>
        )}

      </div>

      {/* --- MODAL DIRECTORIO DE CLIENTES CON PANTALLA DIVIDIDA (IDÉNTICO A HISTORIAL / FOTO 1) --- */}
      {(verTodosClientes || clienteActivo) && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 z-[500] overflow-hidden">
          <div className="bg-white dark:bg-[#0f172a] rounded-t-[2.5rem] md:rounded-[2.5rem] w-full h-[96vh] md:h-[90vh] md:max-w-7xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-100 dark:border-slate-800/60 animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300">
            
            {/* PANEL IZQUIERDO: DIRECTORIO (SOLO ESCRITORIO O SI NO HAY CLIENTE EN MÓVIL) */}
            <div className={`w-full md:w-5/12 flex flex-col border-r border-slate-100 dark:border-slate-800 h-full bg-slate-50/50 dark:bg-[#020617]/50 ${clienteActivo ? 'hidden md:flex' : 'flex'}`}>
              <div className="bg-blue-600 dark:bg-blue-900 p-6 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
                  <Users size={26}/> Directorio de Clientes
                </h2>
                <button 
                  onClick={() => {
                    setVerTodosClientes(false);
                    setClienteActivo(null);
                  }} 
                  className="text-blue-200 hover:text-white transition-colors bg-blue-700/50 p-2 rounded-full cursor-pointer"
                >
                  <X size={24}/>
                </button>
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
                          setClienteActivo(directorioFiltrado[0]);
                          cargarMovimientosClienteDirecto(directorioFiltrado[0].id);
                        }
                      }
                    }}
                    placeholder="Buscar nombre o celular en el directorio..."
                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 dark:text-white text-base font-medium"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {directorioFiltrado.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      setClienteActivo(c);
                      cargarMovimientosClienteDirecto(c.id);
                    }} 
                    className={`p-4 rounded-2xl border cursor-pointer flex justify-between items-center transition-all ${clienteActivo?.id === c.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 dark:border-blue-500/50 shadow-sm' : 'bg-white dark:bg-[#0f172a] border-slate-100 dark:border-slate-800/80 hover:border-blue-300'}`}
                  >
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
                {directorioFiltrado.length === 0 && (
                  <div className="p-8 text-center text-slate-400">
                    <p>No se encontraron clientes.</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button onClick={() => { setNombreNuevo(""); setModalNuevoCliente(true); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-colors flex justify-center items-center gap-2 text-base cursor-pointer">
                  <UserCog size={20} /> Nuevo Cliente
                </button>
              </div>
            </div>

            {/* PANEL DERECHO: PERFIL E HISTORIAL DEL CLIENTE */}
            {clienteActivo ? (
              <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0f172a] overflow-hidden">
                
                {/* HEADER ESCRITORIO */}
                <div className="hidden md:flex p-6 bg-slate-900 text-white justify-between items-center shrink-0">
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
                          className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                          title="Eliminar Cliente"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
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

                {/* HEADER MÓVIL */}
                <div className="md:hidden p-4 sm:p-5 flex justify-between items-center bg-slate-50 dark:bg-[#020617] shrink-0 border-b border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => setClienteActivo(null)} 
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"
                  >
                    ← Volver a lista
                  </button>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 text-base">Perfil de Cliente</h3>
                  <button 
                    onClick={() => {
                      setVerTodosClientes(false);
                      setClienteActivo(null);
                    }} 
                    className="bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-300 rounded-full p-2 font-bold shadow-sm"
                  >
                    <X size={18}/>
                  </button>
                </div>

                <div className="md:hidden px-6 py-5 bg-slate-50 dark:bg-[#020617] text-center shrink-0 flex flex-col items-center border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-center gap-2 mb-1 max-w-full min-w-0 px-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">{clienteActivo.nombre}</h2>
                    {datosSesion?.rol !== 'cajero' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'editar', cliente: clienteActivo })}
                          title="Modificar Cliente"
                          className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalGestionCliente({ visible: true, modo: 'eliminar', cliente: clienteActivo })}
                          title="Eliminar Cliente"
                          className="p-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 shadow-sm border border-slate-200 dark:border-slate-700"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-500 font-medium text-sm mb-3">{clienteActivo.celular || "Sin número registrado"}</p>
                  
                  {(() => {
                    const saldoSeparesActivos = separesCliente
                      .filter(s => s.estado === 'activo')
                      .reduce((acc, s) => acc + (s.saldoPendiente || 0), 0);

                    const totalCompromiso = (clienteActivo.deudaTotal || 0) + saldoSeparesActivos;

                    return (
                      <div className="flex flex-col items-center justify-center bg-white dark:bg-[#0f172a] w-full py-3 px-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-2">
                        <p className={`text-xs font-bold uppercase tracking-widest mb-1 px-2 py-0.5 rounded ${(clienteActivo.deudaTotal || 0) < 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'}`}>
                          {(clienteActivo.deudaTotal || 0) < 0 ? ' Saldo a favor' : (totalCompromiso === 0 ? 'CUENTA AL DÍA' : (saldoSeparesActivos > 0 ? 'SALDO TOTAL PENDIENTE' : 'SALDO PENDIENTE'))}
                        </p>
                        <p className={`text-3xl sm:text-4xl font-black tracking-tighter ${totalCompromiso === 0 ? 'text-slate-300' : ((clienteActivo.deudaTotal || 0) < 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                          ${Math.abs(totalCompromiso).toLocaleString('es-CO')}
                        </p>

                        {saldoSeparesActivos > 0 && (
                          <div className="grid grid-cols-2 gap-2 w-full pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-bold">
                            <div className="bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl text-left border border-rose-100 dark:border-rose-900/40">
                              <span className="text-rose-600 block text-[9px] uppercase font-black">Deuda Fiados:</span>
                              <span className="text-rose-700 dark:text-rose-300 font-black">${(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}</span>
                            </div>
                            <div className="bg-violet-50 dark:bg-violet-950/30 p-2 rounded-xl text-left border border-violet-100 dark:border-violet-900/40">
                              <span className="text-violet-600 block text-[9px] uppercase font-black">Saldo Separes:</span>
                              <span className="text-violet-700 dark:text-violet-300 font-black">${saldoSeparesActivos.toLocaleString('es-CO')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* BOTONES DE ACCIÓN: VENDER, FIAR, ABONAR Y WHATSAPP */}
                <div className="p-4 md:p-6 bg-slate-50 dark:bg-[#020617] border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 shrink-0">
                  <div className="flex gap-2 sm:gap-3">
                    <button onClick={() => router.push(`/dashboard/vender?clienteId=${clienteActivo.id}`)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm transition-all active:scale-95 cursor-pointer">Vender</button>
                    <button onClick={() => router.push(`/dashboard/fiar?clienteId=${clienteActivo.id}`)} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm transition-all active:scale-95 cursor-pointer">Fiar</button>
                    <button onClick={() => router.push(`/dashboard/abonar?clienteId=${clienteActivo.id}`)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm transition-all active:scale-95 cursor-pointer">Abonar</button>
                    {puedeSepare && (
                      <button onClick={() => router.push(`/dashboard/separe?clienteId=${clienteActivo.id}`)} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-xs md:text-sm uppercase shadow-sm transition-all active:scale-95 cursor-pointer">Separe</button>
                    )}
                  </div>

                  {clienteActivo.celular && (
                    <button onClick={() => abrirWhatsApp(generarTextoComprobante('estado', clienteActivo), clienteActivo.celular)} className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#1ebd5a] dark:text-[#25D366] font-bold py-2.5 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm border border-[#25D366]/20 cursor-pointer">
                      <MessageCircle size={18} /> Enviar estado por WhatsApp
                    </button>
                  )}
                </div>

                {/* HISTORIAL INTERNO DEL PERFIL */}
                <div className="bg-white dark:bg-[#0f172a] p-4 md:p-6 pb-10 flex-1 overflow-y-auto space-y-4">
                  {/* SECCIÓN DE PLANES SEPARE DEL CLIENTE (SOLO SI TIENE ACTIVOS ANCLADOS) */}
                  {(() => {
                    const separesActivosCliente = separesCliente.filter(s => s.estado === 'activo');
                    if (separesActivosCliente.length === 0) return null;

                    return (
                      <div className="space-y-2.5 pb-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-violet-600 dark:text-violet-400 uppercase text-xs tracking-wider flex items-center gap-1.5">
                            <Bookmark size={15} /> Planes Separe Activos ({separesActivosCliente.length})
                          </h4>
                          <button
                            onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(clienteActivo.nombre)}`)}
                            className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5"
                          >
                            Ver en separes <ChevronRight size={13} />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {separesActivosCliente.map((sep) => {
                            const porcentaje = sep.total > 0 ? Math.min(100, Math.round(((sep.montoPagado || 0) / sep.total) * 100)) : 0;

                            return (
                              <div 
                                key={sep.id} 
                                onClick={() => router.push(`/dashboard/separes?tab=activos&busqueda=${encodeURIComponent(clienteActivo.nombre)}`)}
                                className="p-3.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-all space-y-2"
                              >
                                <div className="flex justify-between items-center text-xs min-w-0 gap-2">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                                    {sep.items?.map((it: any) => `${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}`).join(', ') || 'Productos separados'}
                                  </span>
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 shrink-0">
                                    Activo
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        porcentaje >= 100 
                                          ? 'bg-emerald-500' 
                                          : porcentaje >= 50 
                                            ? 'bg-violet-600' 
                                            : 'bg-amber-500'
                                      }`} 
                                      style={{ width: `${porcentaje}%` }} 
                                    />
                                  </div>
                                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                    <span>Pagado: ${(sep.montoPagado || 0).toLocaleString('es-CO')} ({porcentaje}%)</span>
                                    <span className="text-violet-700 dark:text-violet-300 font-black">Saldo: ${(sep.saldoPendiente || 0).toLocaleString('es-CO')}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <h4 className="font-bold text-slate-400 uppercase text-xs tracking-wider flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <Clock size={16}/> Historial de Movimientos
                  </h4>
                  {movimientosCliente.map(mov => {
                    const esDevolucionSepare = mov.categoria === 'devolucion_separe' || (mov.tipo === 'egreso' && (mov.concepto || '').toLowerCase().includes('separe'));
                    const esEgreso = mov.tipo === 'egreso';

                    return (
                      <div key={mov.id} className="p-4 md:p-5 bg-slate-50 dark:bg-[#020617] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden space-y-2 md:space-y-3">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          esDevolucionSepare ? 'bg-amber-500' : (esEgreso ? 'bg-orange-500' : (mov.tipo === 'fiado' ? 'bg-rose-500' : (mov.tipo === 'venta' ? 'bg-emerald-500' : 'bg-blue-500')))
                        }`}></div>
                        
                        <div className="pl-1 md:pl-2">
                          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-1.5 pb-1 md:pb-2 md:border-b md:border-slate-100 dark:border-slate-800/80">
                            <span className={`text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 md:px-3 md:py-1 rounded-md md:rounded-lg shrink-0 ${
                              esDevolucionSepare
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                : (esEgreso
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300'
                                  : (mov.tipo === 'fiado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : (mov.tipo === 'venta' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300')))
                            }`}>
                              {esDevolucionSepare ? 'DEVOLUCIÓN SEPARE' : (esEgreso ? 'EGRESO' : mov.tipo)}
                            </span>
                            
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
                                <div key={idx} className="flex justify-between items-center text-xs md:text-sm min-w-0 gap-2">
                                  <span className="text-slate-600 dark:text-slate-300 font-medium truncate flex-1 min-w-0">
                                    {d.cantidad > 1 && <strong className={`${mov.tipo === 'venta' ? 'text-emerald-500' : (mov.tipo === 'abono' ? 'text-blue-500' : 'text-rose-500')} font-black mr-1 md:mr-1.5`}>{d.cantidad}x</strong>}
                                    {d.descripcion}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-slate-100 shrink-0">${d.valor.toLocaleString('es-CO')}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{mov.descripcion || mov.concepto}</p>
                          )}
                          
                          <div className="flex justify-between items-center pt-2 mt-1 md:mt-0 md:pt-3 border-t border-slate-200 dark:border-slate-700 md:border-slate-100 dark:md:border-slate-800 font-black">
                            <span className="text-xs text-slate-400 uppercase tracking-wider">
                              {esDevolucionSepare || esEgreso ? 'Devuelto:' : 'Total:'}
                            </span>
                            <div className="flex items-center gap-2">
                              {mov.tipo !== 'egreso' && (
                                <button
                                  type="button"
                                  onClick={() => abrirTicketDeMovimiento(mov, clienteActivo)}
                                  title="Imprimir Factura / Ticket"
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors cursor-pointer"
                                >
                                  <Printer size={14} />
                                </button>
                              )}
                              <span className={`text-base md:text-xl ${
                                esDevolucionSepare || esEgreso ? 'text-amber-600 dark:text-amber-400' : (mov.tipo === 'fiado' ? 'text-rose-500' : (mov.tipo === 'venta' ? 'text-emerald-500' : 'text-blue-500'))
                              }`}>
                                {mov.tipo === 'fiado' ? '-' : (esDevolucionSepare || esEgreso ? '-' : '+')}${mov.monto.toLocaleString('es-CO')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {movimientosCliente.length === 0 && <p className="text-center text-slate-400 py-10">Sin transacciones registradas.</p>}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 flex-col items-center justify-center p-12 text-center text-slate-400">
                <Users size={48} className="text-slate-300 dark:text-slate-700 mb-4 stroke-1" />
                <p className="text-base font-bold text-slate-600 dark:text-slate-300 mb-1">Selecciona un cliente</p>
                <p className="text-xs text-slate-400">Haz clic en cualquier cliente de la lista para ver su perfil e historial de movimientos.</p>
              </div>
            )}
            
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