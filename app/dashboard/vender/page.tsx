"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, ShoppingCart, CheckCircle2, ChevronRight, X, AlertCircle, UserCog, Plus, Minus, ArrowLeft, MessageCircle, Banknote, Package, QrCode } from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function VenderPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando módulo de ventas...</div>}>
      <VenderContenido />
    </Suspense>
  );
}

function VenderContenido() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreUsuario = datosSesion?.nombreUsuario;
  const nombreNegocio = datosSesion?.nombreNegocio;

  const [clientes, setClientes] = useState<any[]>([]);
  const [inventario, setInventario] = useState<any[]>([]);
  const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string; cantidad: number }[]>([{ descripcion: "", valor: "", cantidad: 1 }]);
  const [pagoCliente, setPagoCliente] = useState(""); 
  
  const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
  const [busquedaRegistro, setBusquedaRegistro] = useState("");
  const [mostrarResultadosBuscador, setMostrarResultadosBuscador] = useState(false);
  
  const [modalConfirmarFiado, setModalConfirmarFiado] = useState(false);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, montoTotal: number, devuelta?: number, fiadoAdicional?: number } | null>(null);
  
  const [modalEscanner, setModalEscanner] = useState(false);
  // Estado para el mensaje flotante dentro del escáner
  const [mensajeScaneo, setMensajeScaneo] = useState<{ texto: string; tipo: 'exito' | 'error' } | null>(null);

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  const [busquedaProductoIndex, setBusquedaProductoIndex] = useState<number | null>(null);

  const scrollArticulosRef = useRef<HTMLDivElement>(null);
  const finalListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarDatosGlobales(cuentaPrincipalId);
      cargarInventario(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  // EFECTO PARA CONTROLAR EL ESCÁNER QR
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (modalEscanner) {
      const timer = setTimeout(() => {
        scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 15, qrbox: { width: 240, height: 240 } },
          false
        );

        scanner.render(
          (decodedText) => {
            manejarProductoScaneado(decodedText);
          },
          (error) => {
            // Ignorar errores while scanning
          }
        );
      }, 200);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(error => console.error("Error al limpiar el escáner", error));
        }
      };
    }
  }, [modalEscanner, inventario, filasRegistro]);

  const cargarDatosGlobales = async (uid: string) => {
    try {
      const qC = query(collection(db, "clientes"), where("usuarioId", "==", uid));
      const snapC = await getDocs(qC);
      const listaC: any[] = [];
      snapC.forEach((doc) => listaC.push({ id: doc.id, ...doc.data() }));
      listaC.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaC);

      const clienteParamId = searchParams.get('clienteId');
      if (clienteParamId) {
        const clienteEncontrado = listaC.find(c => c.id === clienteParamId);
        if (clienteEncontrado) setClienteTransaccion(clienteEncontrado);
      }
    } catch (error) { console.error(error); }
  };

  const cargarInventario = async (uid: string) => {
    try {
      const qI = query(collection(db, "inventario"), where("usuarioId", "==", uid));
      const snapI = await getDocs(qI);
      const listaI: any[] = [];
      snapI.forEach((doc) => listaI.push({ id: doc.id, ...doc.data() }));
      setInventario(listaI);
    } catch (error) { console.error(error); }
  };

  // FUNCIONES DE AUDIO Y VIBRO-FEEDBACK
  const reproducirSonidoExito = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime); // Frecuencia de beep agudo
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Navegadores que bloquean audio nativo sin interacción previa
    }
  };

  const dispararFeedback = (tipo: 'exito' | 'error', texto: string) => {
    setMensajeScaneo({ texto, tipo });
    if (tipo === 'exito') {
      reproducirSonidoExito();
      if (navigator.vibrate) navigator.vibrate(100); // Vibración corta de éxito
    } else {
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // Doble vibración corta de error
    }

    // Ocultar el aviso flotante después de 2.5 segundos para seguir escaneando
    setTimeout(() => {
      setMensajeScaneo(null);
    }, 2500);
  };

  const manejarProductoScaneado = (skuScaneado: string) => {
    const skuLimpio = skuScaneado.trim().toLowerCase();
    const productoEncontrado = inventario.find(
      p => (p.sku && p.sku.toLowerCase() === skuLimpio) || p.id === skuScaneado
    );

    if (!productoEncontrado) {
      dispararFeedback('error', `❌ Código "${skuScaneado}" no registrado`);
      return;
    }

    const nuevasFilas = [...filasRegistro];
    const indexExistente = nuevasFilas.findIndex(
      f => f.descripcion.toLowerCase() === productoEncontrado.nombre.toLowerCase()
    );

    if (indexExistente !== -1) {
      const fila = nuevasFilas[indexExistente];
      const cantEnOtras = nuevasFilas.reduce((acc, f, i) => i !== indexExistente && f.descripcion.toLowerCase() === productoEncontrado.nombre.toLowerCase() ? acc + f.cantidad : acc, 0);
      const stockDisp = productoEncontrado.stock - cantEnOtras;

      if (fila.cantidad + 1 > stockDisp) {
        dispararFeedback('error', `⚠️ Límite alcanzado (${productoEncontrado.nombre})`);
        return;
      }

      fila.cantidad += 1;
      dispararFeedback('exito', `✓ +1 ${productoEncontrado.nombre} (${fila.cantidad})`);
    } else {
      const indexVacio = nuevasFilas.findIndex(f => f.descripcion.trim() === "" && parseFloat(f.valor || "0") === 0);

      if (productoEncontrado.stock <= 0) {
        dispararFeedback('error', `❌ Agotado: ${productoEncontrado.nombre}`);
        return;
      }

      if (indexVacio !== -1) {
        nuevasFilas[indexVacio] = {
          descripcion: productoEncontrado.nombre,
          valor: productoEncontrado.precioVenta.toString(),
          cantidad: 1
        };
      } else {
        nuevasFilas.push({
          descripcion: productoEncontrado.nombre,
          valor: productoEncontrado.precioVenta.toString(),
          cantidad: 1
        });
      }
      dispararFeedback('exito', `✓ Añadido: ${productoEncontrado.nombre}`);
    }

    setFilasRegistro(nuevasFilas);
  };

  const guardarClienteNuevo = async () => {
    if (!nombreNuevo.trim()) return alert("El nombre del cliente es obligatorio.");
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), { nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0, usuarioId: cuentaPrincipalId, fecha_creacion: new Date() });
      const nuevoObj = { id: docRef.id, nombre: nombreNuevo.trim(), celular: celularNuevo.trim(), deudaTotal: 0 };
      setModalNuevoCliente(false); setNombreNuevo(""); setCelularNuevo(""); setBusquedaRegistro("");
      await cargarDatosGlobales(cuentaPrincipalId!);
      setClienteTransaccion(nuevoObj); 
      setMostrarResultadosBuscador(false);
    } catch (error) { alert("Error al guardar cliente."); } finally { setGuardandoCliente(false); }
  };

  const formatearMonedaInput = (valor: string) => {
    if (!valor) return "";
    const numeroStr = valor.replace(/\D/g, ''); 
    if (!numeroStr) return "";
    return parseInt(numeroStr, 10).toLocaleString('es-CO');
  };

  const agregarFila = () => {
    setFilasRegistro([...filasRegistro, { descripcion: "", valor: "", cantidad: 1 }]);
    setTimeout(() => {
      finalListaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const actualizarFila = (index: number, campo: 'descripcion' | 'valor', valorNuevo: string) => {
    const nuevasFilas = [...filasRegistro]; 
    if (campo === 'valor') { nuevasFilas[index][campo] = valorNuevo.replace(/\D/g, '') as never; } 
    else { nuevasFilas[index][campo] = valorNuevo as never; }
    setFilasRegistro(nuevasFilas);
  };

  const actualizarCantidadFila = (index: number, delta: number) => {
    const nuevasFilas = [...filasRegistro];
    const filaActual = nuevasFilas[index];
    const nuevaCant = filaActual.cantidad + delta;
    
    if (nuevaCant < 1) return;

    if (filaActual.descripcion.trim() !== "") {
      const productoEnInventario = inventario.find(p => p.nombre.toLowerCase() === filaActual.descripcion.toLowerCase());
      
      if (productoEnInventario) {
        const cantidadEnOtrasFilas = nuevasFilas.reduce((acc, f, i) => {
          if (i !== index && f.descripcion.toLowerCase() === filaActual.descripcion.toLowerCase()) {
            return acc + f.cantidad;
          }
          return acc;
        }, 0);

        const stockTotalPermitido = productoEnInventario.stock - cantidadEnOtrasFilas;

        if (nuevaCant > stockTotalPermitido) {
          toast.error(`¡Límite alcanzado! Solo hay ${stockTotalPermitido} unidades disponibles.`);
          return;
        }
      }
    }

    nuevasFilas[index].cantidad = nuevaCant;
    setFilasRegistro(nuevasFilas);
  };

  const eliminarFila = (index: number) => { if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index)); };

  const totalFilasRegistro = filasRegistro.reduce((acc, fila) => { 
    const val = parseFloat(fila.valor || "0"); 
    return acc + (isNaN(val) ? 0 : val * fila.cantidad); 
  }, 0);

  const procesarRegistro = () => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) return alert("Ingresa al menos un monto válido en los artículos.");

    for (const fila of filasValidas) {
      const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
      if (item) {
        const totalRequerido = filasRegistro
          .filter(f => f.descripcion.toLowerCase() === fila.descripcion.toLowerCase())
          .reduce((sum, f) => sum + f.cantidad, 0);

        if (totalRequerido > item.stock) {
          toast.error(`Stock superado para "${fila.descripcion}". Stock real: ${item.stock}`);
          return;
        }
      }
    }

    const pagadoRaw = pagoCliente.replace(/\D/g, '');
    const pagadoNum = pagadoRaw === "" ? 0 : parseFloat(pagadoRaw);
    const faltante = totalFilasRegistro - pagadoNum;

    if (faltante > 0) {
        setModalConfirmarFiado(true);
        return;
    }
    ejecutarVentaFinal();
  };

  const ejecutarVentaFinal = async () => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    
    for (const fila of filasValidas) {
        const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
        if (item && item.stock < fila.cantidad) {
            toast.error(`¡Sin stock suficiente! Solo quedan ${item.stock} unidades de ${item.nombre}.`);
            return;
        }
    }

    const pagadoRaw = pagoCliente.replace(/\D/g, '');
    const pagadoNum = pagadoRaw === "" ? 0 : parseFloat(pagadoRaw);
    const faltante = totalFilasRegistro - pagadoNum;
    const fiarFaltante = faltante > 0;

    try {
      let montoAcumulado = 0; 
      let detallesParaComprobante: any[] = []; 
      let resumenNombres: string[] = [];
      
      for (const fila of filasValidas) {
        const valUnitario = parseFloat(fila.valor);
        const subtotalFila = valUnitario * fila.cantidad;
        montoAcumulado += subtotalFila;
        let descFinal = fila.descripcion.trim() || "Artículo registrado";
        detallesParaComprobante.push({ descripcion: descFinal, valor: subtotalFila, cantidad: fila.cantidad, valorUnitario: valUnitario }); 
        if (fila.cantidad > 1) { resumenNombres.push(`${fila.cantidad}x ${descFinal}`); } 
        else { resumenNombres.push(descFinal); }
      }
      const descripcionUnificada = resumenNombres.join(", ");

      const montoVentaReal = pagadoNum >= montoAcumulado ? montoAcumulado : pagadoNum;
      let clienteFinalActualizado = clienteTransaccion;

      if (montoVentaReal > 0) {
          await addDoc(collection(db, "movimientos"), {
              clienteId: clienteTransaccion ? clienteTransaccion.id : 'mostrador',
              usuarioId: cuentaPrincipalId, tipo: 'venta', monto: montoVentaReal,
              descripcion: descripcionUnificada + (fiarFaltante ? ` (Pago parcial de $${montoAcumulado.toLocaleString('es-CO')})` : ''),
              detalles: detallesParaComprobante, fecha: new Date(), registradoPor: nombreUsuario
          });
      }

      for (const fila of filasValidas) {
          const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
          if (item) {
              const refProducto = doc(db, "inventario", item.id);
              await updateDoc(refProducto, { stock: item.stock - fila.cantidad });
          }
      }

      if (fiarFaltante && clienteTransaccion) {
          const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + faltante;
          await addDoc(collection(db, "movimientos"), {
              clienteId: clienteTransaccion.id, usuarioId: cuentaPrincipalId, tipo: 'fiado', monto: faltante,
              descripcion: `Saldo pendiente de venta: ${descripcionUnificada}`, detalles: [], saldoResultante: nuevoSaldoTotal, fecha: new Date(), registradoPor: nombreUsuario
          });
          const refCliente = doc(db, "clientes", clienteTransaccion.id);
          await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });
          clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };
      }

      setModalExito({ 
          visible: true, 
          cliente: clienteFinalActualizado || { nombre: "Cliente Mostrador", celular: "" }, 
          montoTotal: montoAcumulado,
          devuelta: pagadoNum > montoAcumulado ? pagadoNum - montoAcumulado : 0, 
          fiadoAdicional: faltante > 0 ? faltante : 0
      });
      
    } catch (error) { 
        console.error(error);
        toast.error("Error al procesar la venta."); 
    }
  };

  const abrirWhatsApp = (cliente: any) => {
    const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
    let detalleTexto = "";
    filasValidas.forEach(f => {
      const unitario = parseFloat(f.valor);
      const subtotal = unitario * f.cantidad;
      const desc = f.descripcion.trim() || "Articulo";
      detalleTexto += `- ${f.cantidad}x ${desc} ($${unitario.toLocaleString('es-CO')} c/u) = $${subtotal.toLocaleString('es-CO')}\n`;
    });

    const nombreDestino = cliente.id === "mostrador" || !cliente.nombre ? "Cliente" : cliente.nombre;
    const pagadoRaw = pagoCliente.replace(/\D/g, '');
    const pagadoNum = pagadoRaw === "" ? 0 : parseFloat(pagadoRaw);
    const faltante = totalFilasRegistro - pagadoNum;
    const devuelta = pagadoNum > totalFilasRegistro ? pagadoNum - totalFilasRegistro : 0;
    
    let infoExtra = "";
    if (faltante > 0) {
       infoExtra = `\n- Abonaste: $${pagadoNum.toLocaleString('es-CO')}\n- Quedo pendiente: $${faltante.toLocaleString('es-CO')}`;
    } else if (devuelta > 0) {
       infoExtra = `\n- Entregaste: $${pagadoNum.toLocaleString('es-CO')}\n- Devuelta: $${devuelta.toLocaleString('es-CO')}`;
    } else {
       infoExtra = `\n- Pago completo`;
    }

    const texto = `Hola *${nombreDestino}*.\n\nAqui tienes el comprobante de tu compra en *${nombreNegocio || 'nuestra tienda'}*:\n\nDETALLE:\n${detalleTexto}\nTOTAL VENTA: $${totalFilasRegistro.toLocaleString('es-CO')}${infoExtra}\n\n¡Gracias por preferirnos! Te esperamos pronto.`;
    
    const celularLimpio = cliente.celular ? cliente.celular.replace(/\D/g, '') : '';
    const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    
    window.open(url, '_blank');
  };

  const clientesFiltradosRegistro = clientes.filter(c => 
    (c.nombre || "").toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
    (c.celular || "").toString().includes(busquedaRegistro)
  );

  return (
    <div className="flex flex-col w-full h-full pb-24 md:pb-0 bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
      
      <div className="bg-emerald-600 dark:bg-emerald-700 p-4 md:p-6 text-white flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-colors backdrop-blur-sm">
            <ArrowLeft size={22} />
          </button>
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-2">
            <ShoppingCart size={24}/> Registrar Venta
          </h2>
        </div>
        <button 
          onClick={() => setModalEscanner(true)} 
          className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition-transform active:scale-95"
        >
          <QrCode size={18}/> Escanear QR
        </button>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 relative overflow-y-auto lg:overflow-hidden">
        
        <div className="lg:flex-1 flex flex-col relative bg-slate-50/50 dark:bg-[#0f172a] lg:overflow-hidden shrink-0">
          
          <div ref={scrollArticulosRef} className="flex-1 lg:overflow-y-auto p-4 sm:p-6 lg:p-8 pb-2 lg:pb-8">
            <div className="max-w-4xl mx-auto space-y-4">
              <h4 className="font-bold text-slate-400 uppercase text-[11px] md:text-xs tracking-wider mb-2">Artículos o Conceptos</h4>
              
              <div className="space-y-4">
                {filasRegistro.map((fila, index) => {
                  const productosFiltradosInventario = inventario.filter(p => 
                    p.nombre?.toLowerCase().includes((fila.descripcion || "").toLowerCase()) ||
                    p.sku?.toLowerCase().includes((fila.descripcion || "").toLowerCase())
                  );

                  return (
                    <div key={index} className="flex flex-col md:flex-row gap-3 md:gap-4 p-4 md:p-5 bg-white dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-sm transition-colors hover:border-emerald-300">
                      
                      {filasRegistro.length > 1 && (
                        <button onClick={() => eliminarFila(index)} className="absolute -top-2.5 -right-2.5 bg-rose-100 text-rose-600 rounded-full p-1.5 shadow-sm hover:scale-110 transition-transform z-10">
                          <X size={14}/>
                        </button>
                      )}
                      
                      <div className="flex-1 min-w-0 relative">
                        <label className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap truncate flex items-center gap-1">
                          <Package size={12}/> Descripción o SKU
                        </label>
                        <input 
                          type="text" 
                          value={fila.descripcion} 
                          onChange={(e) => {
                            actualizarFila(index, 'descripcion', e.target.value);
                            setBusquedaProductoIndex(index);
                          }} 
                          onFocus={() => setBusquedaProductoIndex(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && busquedaProductoIndex === index && productosFiltradosInventario.length > 0) {
                              e.preventDefault();
                              const p = productosFiltradosInventario[0];

                              const cantEnOtras = filasRegistro.reduce((acc, f, i) => i !== index && f.descripcion.toLowerCase() === p.nombre.toLowerCase() ? acc + f.cantidad : acc, 0);
                              const stockDisp = p.stock - cantEnOtras;

                              if (stockDisp <= 0) {
                                toast.error(`¡Sin stock! Ya no quedan unidades disponibles de ${p.nombre}.`);
                                return;
                              }

                              const nuevas = [...filasRegistro];
                              nuevas[index].descripcion = p.nombre;
                              nuevas[index].valor = p.precioVenta.toString();
                              nuevas[index].cantidad = 1;
                              setFilasRegistro(nuevas);
                              setBusquedaProductoIndex(null);
                            }
                          }}
                          placeholder="Escribe nombre o SKU..." 
                          className="w-full p-3 md:p-4 h-[50px] md:h-[56px] bg-slate-50 dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-base md:text-lg min-w-0 shadow-sm focus:border-emerald-500 transition-colors" 
                        />

                        {busquedaProductoIndex === index && fila.descripcion.trim().length > 0 && productosFiltradosInventario.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                            {productosFiltradosInventario.map(p => {
                              const cantEnOtras = filasRegistro.reduce((acc, f, i) => i !== index && f.descripcion.toLowerCase() === p.nombre.toLowerCase() ? acc + f.cantidad : acc, 0);
                              const stockDisp = p.stock - cantEnOtras;

                              return (
                                <div 
                                  key={p.id} 
                                  onClick={() => {
                                    if (stockDisp <= 0) {
                                      toast.error(`¡Sin stock! No hay más unidades disponibles de ${p.nombre}.`);
                                      return;
                                    }
                                    const nuevas = [...filasRegistro];
                                    nuevas[index].descripcion = p.nombre;
                                    nuevas[index].valor = p.precioVenta.toString();
                                    nuevas[index].cantidad = Math.min(1, stockDisp);
                                    setFilasRegistro(nuevas);
                                    setBusquedaProductoIndex(null);
                                  }}
                                  className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-sm"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{p.nombre}</span>
                                    {stockDisp <= 5 && stockDisp > 0 && (
                                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full mt-1 inline-block">
                                        ⚠️ Pocas unidades: {stockDisp} restantes
                                      </span>
                                    )}
                                    {stockDisp > 5 && (
                                      <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">
                                        SKU: {p.sku || 'N/A'} | Disponibles: {stockDisp}
                                      </span>
                                    )}
                                    {stockDisp <= 0 && (
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full mt-1 inline-block">
                                        ❌ Agotado
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-black text-emerald-600 dark:text-emerald-400">${p.precioVenta.toLocaleString('es-CO')}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-row gap-3 md:gap-4 w-full md:w-[280px] shrink-0">
                        <div className="w-[100px] md:w-[120px] shrink-0">
                          <label className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">Cant.</label>
                          <div className="flex items-center bg-slate-50 dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden shrink-0 h-[50px] md:h-[56px]">
                            <button onClick={() => actualizarCantidadFila(index, -1)} className="px-3 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Minus size={16}/></button>
                            <span className="flex-1 text-center font-black text-lg md:text-xl">{fila.cantidad}</span>
                            <button onClick={() => actualizarCantidadFila(index, 1)} className="px-3 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Plus size={16}/></button>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <label className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">Precio Unit.</label>
                          <div className="relative w-full h-[50px] md:h-[56px] shadow-sm rounded-xl">
                            <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg md:text-xl">$</span>
                            <input type="text" inputMode="numeric" value={formatearMonedaInput(fila.valor)} onChange={(e) => actualizarFila(index, 'valor', e.target.value)} placeholder="0" className="w-full pl-8 md:pl-10 pr-3 py-3 h-full bg-slate-50 dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-black text-lg md:text-xl min-w-0 focus:border-emerald-500 transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button onClick={agregarFila} className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 px-5 py-3 md:py-4 rounded-xl transition-colors flex items-center justify-center sm:justify-start gap-2 text-sm shadow-sm w-full sm:w-auto">
                  <Plus size={18}/> Añadir otro artículo
                </button>
                <div ref={finalListaRef} className="h-2"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[340px] xl:w-[380px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 lg:overflow-y-auto">
          
          <div className="p-4 lg:p-6 pt-2 lg:pt-6 flex flex-col gap-4 flex-1 min-h-0">
            
            <div className="flex flex-col bg-white dark:bg-[#0f172a] p-4 lg:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCog size={14}/> Cliente (Opcional)
                </label>
              </div>
              
              {clienteTransaccion ? (
                <div className="py-3 px-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 flex justify-between items-center shadow-sm">
                  <span className="font-black text-slate-900 dark:text-emerald-300 text-sm lg:text-base truncate mr-2">{clienteTransaccion.nombre}</span>
                  <button onClick={() => setClienteTransaccion(null)} className="text-rose-500 shrink-0 hover:bg-rose-100 p-1 rounded-full"><X size={18}/></button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" value={busquedaRegistro} onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }} onFocus={() => setMostrarResultadosBuscador(true)} placeholder="Buscar / Crear..." className="w-full pl-9 pr-2 py-3 lg:py-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 transition-colors shadow-sm" />
                  
                  {mostrarResultadosBuscador && busquedaRegistro.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="max-h-48 overflow-y-auto">
                        {clientesFiltradosRegistro.map(c => (
                          <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setMostrarResultadosBuscador(false); }} className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between text-sm">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span><ChevronRight size={16} className="text-slate-400"/>
                          </div>
                        ))}
                        {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                          <button onClick={() => { setNombreNuevo(busquedaRegistro); setModalNuevoCliente(true); setMostrarResultadosBuscador(false); }} className="w-full text-left p-3 bg-emerald-50 text-emerald-700 text-sm font-bold">
                            + Crear "{busquedaRegistro}"
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col bg-white dark:bg-[#0f172a] p-4 lg:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Banknote size={14}/> Dinero entregado
              </label>
              <div className="relative rounded-xl shadow-sm mb-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-lg lg:text-xl">$</span>
                <input type="text" inputMode="numeric" value={pagoCliente} onChange={(e) => setPagoCliente(formatearMonedaInput(e.target.value))} placeholder="Monto..." className="w-full pl-8 pr-2 py-3 lg:py-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-black text-xl lg:text-2xl min-w-0 focus:border-emerald-500 transition-colors" />
              </div>
              <button onClick={() => setPagoCliente(totalFilasRegistro.toLocaleString('es-CO'))} className="text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg transition-colors text-center w-full">
                Pago exacto (${totalFilasRegistro.toLocaleString('es-CO')})
              </button>
            </div>

            {pagoCliente && parseFloat(pagoCliente.replace(/\D/g, '')) >= totalFilasRegistro && totalFilasRegistro > 0 && (
              <div className="p-4 lg:p-5 bg-emerald-100 text-emerald-700 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-200 shadow-sm">
                <span className="text-[10px] lg:text-xs uppercase font-bold tracking-wider">Devuelta:</span>
                <span className="text-xl lg:text-2xl font-black">${(parseFloat(pagoCliente.replace(/\D/g, '')) - totalFilasRegistro).toLocaleString('es-CO')}</span>
              </div>
            )}
            {pagoCliente !== "" && parseFloat(pagoCliente.replace(/\D/g, '')) < totalFilasRegistro && totalFilasRegistro > 0 && (
              <div className="p-4 lg:p-5 bg-rose-100 text-rose-700 rounded-xl flex justify-between items-center animate-in zoom-in-95 duration-200 shadow-sm">
                <span className="text-[10px] lg:text-xs uppercase font-bold tracking-wider">Saldo a Fiar:</span>
                <span className="text-xl lg:text-2xl font-black">${(totalFilasRegistro - parseFloat(pagoCliente.replace(/\D/g, ''))).toLocaleString('es-CO')}</span>
              </div>
            )}
          </div>

          <div className="hidden lg:block bg-slate-900 dark:bg-black p-6 shrink-0 lg:rounded-tl-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-30 mt-auto">
            <div className="flex justify-between items-end mb-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total a Cobrar</span>
              <span className="text-5xl font-black text-white leading-none">${totalFilasRegistro.toLocaleString('es-CO')}</span>
            </div>
            <button onClick={procesarRegistro} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-2xl py-5 rounded-2xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2">
              Vender <CheckCircle2 size={24}/>
            </button>
          </div>

        </div>
      </div>

      <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800 p-4 shadow-2xl z-40 flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase">Total</span>
          <span className="text-xl font-black text-slate-900 dark:text-white">${totalFilasRegistro.toLocaleString('es-CO')}</span>
        </div>
        <button onClick={procesarRegistro} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-lg">
          Vender <CheckCircle2 size={20} />
        </button>
      </div>

      {/* MODAL DEL ESCÁNER DE CÁMARA QR CON AVISO FLOTANTE DE ÉXITO */}
      {modalEscanner && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center relative overflow-hidden">
            
            {/* NOTIFICACIÓN FLOTANTE DENTRO DE LA CÁMARA */}
            {mensajeScaneo && (
              <div className={`absolute top-4 left-4 right-4 z-50 p-4 rounded-2xl text-white font-black text-center shadow-2xl animate-in slide-in-from-top duration-300 flex items-center justify-center gap-2 ${mensajeScaneo.tipo === 'exito' ? 'bg-emerald-600 text-lg' : 'bg-rose-600'}`}>
                {mensajeScaneo.texto}
              </div>
            )}

            <div className="flex justify-between items-center w-full mb-4">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode size={24}/> Escáner Continuo
              </h3>
              <button 
                onClick={() => setModalEscanner(false)} 
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-full transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 text-center">
              Apunta de forma continua. Cada vez que escanees un producto se sumará a la venta automáticamente.
            </p>

            <style jsx global>{`
              #reader {
                width: 100% !important;
                border: none !important;
                background: transparent !important;
              }
              #reader__dashboard_section_csr button, #html5-qrcode-button-camera-permission, #html5-qrcode-button-camera-start {
                background: #059669 !important;
                color: white !important;
                font-weight: bold !important;
                padding: 10px 20px !important;
                border-radius: 12px !important;
                border: none !important;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              #reader select {
                padding: 8px !important;
                border-radius: 8px !important;
                border: 1px solid #cbd5e1 !important;
                margin-bottom: 10px !important;
                background: white !important;
                color: #0f172a !important;
                font-weight: bold !important;
                width: 100% !important;
              }
              #reader video {
                width: 100% !important;
                height: auto !important;
                border-radius: 16px !important;
                object-fit: cover !important;
              }
            `}</style>

            <div id="reader" className="w-full overflow-hidden rounded-2xl bg-slate-900 p-2"></div>

            <button 
              onClick={() => setModalEscanner(false)} 
              className="mt-6 w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-2xl text-base transition-colors"
            >
              Terminar y Cerrar
            </button>
          </div>
        </div>
      )}

      {modalConfirmarFiado && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[900] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-center border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertCircle size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Pago Incompleto</h3>
            
            <div className="text-slate-600 mb-6 text-sm sm:text-base bg-slate-50 p-4 rounded-2xl">
              <div className="flex justify-between mb-1"><span>Total venta:</span> <strong className="text-slate-900">${totalFilasRegistro.toLocaleString('es-CO')}</strong></div>
              <div className="flex justify-between mb-1"><span>Dinero recibido:</span> <strong className="text-slate-900">${(parseFloat(pagoCliente.replace(/\D/g, '')) || 0).toLocaleString('es-CO')}</strong></div>
              <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                <span className="font-bold text-rose-500">Saldo pendiente:</span> 
                <strong className="text-rose-500 text-lg">${(totalFilasRegistro - (parseFloat(pagoCliente.replace(/\D/g, '')) || 0)).toLocaleString('es-CO')}</strong>
              </div>
            </div>

            {!clienteTransaccion ? (
              <>
                <p className="text-sm font-bold text-rose-500 mb-3">⚠️ Para poder fiar el resto debes asociar un cliente:</p>
                <div className="relative mb-6 text-left">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input type="text" value={busquedaRegistro} onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }} placeholder="Buscar cliente..." className="w-full p-4 pl-12 bg-white border rounded-2xl font-bold outline-none focus:border-amber-500 shadow-sm" />
                  {busquedaRegistro.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-2xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                      {clientesFiltradosRegistro.map(c => (
                        <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); }} className="p-4 border-b hover:bg-slate-50 cursor-pointer flex justify-between">
                          <span className="font-bold text-slate-800">{c.nombre}</span><ChevronRight size={18} className="text-slate-400"/>
                        </div>
                      ))}
                      {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                        <button onClick={() => { setNombreNuevo(busquedaRegistro); setModalNuevoCliente(true); }} className="w-full text-left p-4 bg-amber-50 text-amber-700 font-bold">
                          + Crear "{busquedaRegistro}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setModalConfirmarFiado(false)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl text-lg transition-colors">
                  Atrás
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-700 mb-6">
                  ¿Confirmas que vas a fiar <strong className="text-rose-500">${(totalFilasRegistro - (parseFloat(pagoCliente.replace(/\D/g, '')) || 0)).toLocaleString('es-CO')}</strong> a <strong className="text-emerald-600">{clienteTransaccion.nombre}</strong>?
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => { setModalConfirmarFiado(false); ejecutarVentaFinal(); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl text-lg shadow-lg flex justify-center items-center gap-2">
                    Confirmar Venta y Fiado <CheckCircle2 size={20}/>
                  </button>
                  <button onClick={() => setModalConfirmarFiado(false)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl text-lg transition-colors">
                    Corregir pago
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-2"><UserCog size={28}/> Crear Cliente</h3>
            <div className="flex flex-col gap-4 mb-8">
              <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:border-emerald-500 font-bold text-lg" />
              <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:border-emerald-500 font-bold text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl text-lg">Cancelar</button>
              <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">Guardar <CheckCircle2 size={20}/></button>
            </div>
          </div>
        </div>
      )}

      {modalExito && modalExito.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950] animate-in zoom-in duration-300">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 size={50} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">¡Venta Exitosa!</h2>
            
            <div className="mb-8 text-slate-500 text-base flex flex-col gap-2">
              <p>Total de compra: <strong className="text-slate-800">${modalExito.montoTotal.toLocaleString('es-CO')}</strong>.</p>
              {(modalExito.devuelta || 0) > 0 && <p className="text-emerald-600 font-bold bg-emerald-50 p-2 rounded-lg mt-2">Entregar devuelta: ${modalExito.devuelta?.toLocaleString('es-CO')}</p>}
              {(modalExito.fiadoAdicional || 0) > 0 && <p className="text-rose-600 font-bold bg-rose-50 p-2 rounded-lg mt-2">Saldo fiado a {modalExito.cliente.nombre}: ${modalExito.fiadoAdicional?.toLocaleString('es-CO')}</p>}
            </div>
            
            {modalExito.cliente?.celular && modalExito.cliente.celular.trim() !== "" && datosSesion?.rol !== 'cajero' && (
              <button onClick={() => abrirWhatsApp(modalExito.cliente)} className="w-full mb-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">
                <MessageCircle size={24} /> Enviar Comprobante
              </button>
            )}
            
            <button onClick={() => { setModalExito(null); router.push('/dashboard/inicio'); }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl text-lg">
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}