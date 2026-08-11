"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, doc, updateDoc, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, ShoppingBag, CheckCircle2, ChevronRight, X, AlertCircle, UserCog, Plus, Minus, ArrowLeft, MessageCircle, Package } from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";

export default function FiarPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando módulo de fiados...</div>}>
            <FiarContenido />
        </Suspense>
    );
}

function FiarContenido() {
    const { datosSesion } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
    const nombreUsuario = datosSesion?.nombreUsuario;
    const nombreNegocio = datosSesion?.nombreNegocio;

    const [clientes, setClientes] = useState<any[]>([]);
    const [inventario, setInventario] = useState<any[]>([]);
    const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string; cantidad: number }[]>([{ descripcion: "", valor: "", cantidad: 1 }]);

    const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
    const [busquedaRegistro, setBusquedaRegistro] = useState("");
    const [mostrarResultadosBuscador, setMostrarResultadosBuscador] = useState(false);
    const [busquedaProductoIndex, setBusquedaProductoIndex] = useState<number | null>(null);

    const [modalFaltaCliente, setModalFaltaCliente] = useState(false);
    const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
    const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, montoTotal: number } | null>(null);

    const [nombreNuevo, setNombreNuevo] = useState("");
    const [celularNuevo, setCelularNuevo] = useState("");
    const [guardandoCliente, setGuardandoCliente] = useState(false);

    const finalListaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (cuentaPrincipalId) {
            cargarDatosGlobales(cuentaPrincipalId);
            cargarInventario(cuentaPrincipalId);
        }
    }, [cuentaPrincipalId]);

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
            setModalFaltaCliente(false);
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

        if (!clienteTransaccion) {
            setModalFaltaCliente(true);
            return;
        }

        ejecutarFiadoFinal();
    };

    const ejecutarFiadoFinal = async () => {
        const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
        const faltante = totalFilasRegistro;

        try {
            let detallesParaComprobante: any[] = [];
            let resumenNombres: string[] = [];

            for (const fila of filasValidas) {
                const valUnitario = parseFloat(fila.valor);
                const subtotalFila = valUnitario * fila.cantidad;
                let descFinal = fila.descripcion.trim() || "Artículo registrado";
                detallesParaComprobante.push({ descripcion: descFinal, valor: subtotalFila, cantidad: fila.cantidad, valorUnitario: valUnitario });
                if (fila.cantidad > 1) { resumenNombres.push(`${fila.cantidad}x ${descFinal}`); }
                else { resumenNombres.push(descFinal); }
            }
            const descripcionUnificada = resumenNombres.join(", ");
            const nuevoSaldoTotal = (clienteTransaccion.deudaTotal || 0) + faltante;

            await addDoc(collection(db, "movimientos"), {
                clienteId: clienteTransaccion.id,
                usuarioId: cuentaPrincipalId,
                tipo: 'fiado',
                monto: faltante,
                descripcion: descripcionUnificada,
                detalles: detallesParaComprobante,
                saldoResultante: nuevoSaldoTotal,
                fecha: new Date(),
                registradoPor: nombreUsuario
            });

            for (const fila of filasValidas) {
                const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
                if (item) {
                    await updateDoc(doc(db, "inventario", item.id), { stock: item.stock - fila.cantidad });
                }
            }

            const refCliente = doc(db, "clientes", clienteTransaccion.id);
            await updateDoc(refCliente, { deudaTotal: nuevoSaldoTotal });

            const clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: nuevoSaldoTotal };

            setModalExito({
                visible: true,
                cliente: clienteFinalActualizado,
                montoTotal: faltante
            });

        } catch (error) { toast.error("Error al procesar el fiado."); }
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

        const saldoFormat = `$${Math.abs(cliente.deudaTotal || 0).toLocaleString('es-CO')}`;
        const texto = `Hola *${cliente.nombre}*.\n\nHemos registrado un nuevo credito a tu cuenta en *${nombreNegocio || 'nuestra tienda'}*:\n\nDETALLE:\n${detalleTexto}\n- TOTAL FIADO: $${totalFilasRegistro.toLocaleString('es-CO')}\n- TU NUEVO SALDO PENDIENTE: ${saldoFormat}\n\n¡Gracias por tu confianza!`;

        const celularLimpio = cliente.celular ? cliente.celular.replace(/\D/g, '') : '';
        const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;

        window.open(url, '_blank');
    };

    const clientesFiltradosRegistro = clientes.filter(c =>
        (c.nombre || "").toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
        (c.celular || "").toString().includes(busquedaRegistro)
    );

    return (
        <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">

            <div className="bg-rose-600 dark:bg-rose-700 p-4 md:p-6 text-white flex justify-between items-center shrink-0 z-30 shadow-sm">
                <div className="flex items-center gap-3 md:gap-4">
                    <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-colors backdrop-blur-sm">
                        <ArrowLeft size={22} />
                    </button>
                    <h2 className="text-xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-2">
                        <ShoppingBag size={24} /> Registrar Fiado
                    </h2>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 min-h-0 relative overflow-y-auto lg:overflow-hidden">

                <div className="lg:flex-1 flex flex-col relative bg-slate-50/50 dark:bg-[#0f172a] lg:overflow-hidden shrink-0">

                    <div className="flex-1 lg:overflow-y-auto p-4 sm:p-6 lg:p-8 pb-2 lg:pb-8">
                        <div className="max-w-4xl mx-auto space-y-4">
                            <h4 className="font-bold text-slate-400 uppercase text-[11px] md:text-xs tracking-wider mb-2">Artículos a Fiar</h4>

                            <div className="space-y-4">
                                {filasRegistro.map((fila, index) => {
                                    const productosFiltradosInventario = inventario.filter(p => 
                                        p.nombre?.toLowerCase().includes((fila.descripcion || "").toLowerCase()) ||
                                        p.sku?.toLowerCase().includes((fila.descripcion || "").toLowerCase())
                                    );

                                    return (
                                        <div key={index} className="flex flex-col md:flex-row gap-3 md:gap-4 p-4 md:p-5 bg-white dark:bg-[#020617] rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-sm transition-colors hover:border-rose-300">

                                            {filasRegistro.length > 1 && (
                                                <button onClick={() => eliminarFila(index)} className="absolute -top-2.5 -right-2.5 bg-rose-100 text-rose-600 rounded-full p-1.5 shadow-sm hover:scale-110 transition-transform z-10">
                                                    <X size={14} />
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
                                                    className="w-full p-3 md:p-4 h-[50px] md:h-[56px] bg-slate-50 dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-base md:text-lg min-w-0 shadow-sm focus:border-rose-500 transition-colors" 
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
                                                                    className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-sm"
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
                                                                    <span className="font-black text-rose-600 dark:text-rose-400">${p.precioVenta.toLocaleString('es-CO')}</span>
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
                                                        <button onClick={() => actualizarCantidadFila(index, -1)} className="px-3 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Minus size={16} /></button>
                                                        <span className="flex-1 text-center font-black text-lg md:text-xl">{fila.cantidad}</span>
                                                        <button onClick={() => actualizarCantidadFila(index, 1)} className="px-3 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Plus size={16} /></button>
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <label className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">Precio Unit.</label>
                                                    <div className="relative w-full h-[50px] md:h-[56px] shadow-sm rounded-xl">
                                                        <span className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg md:text-xl">$</span>
                                                        <input type="text" inputMode="numeric" value={formatearMonedaInput(fila.valor)} onChange={(e) => actualizarFila(index, 'valor', e.target.value)} placeholder="0" className="w-full pl-8 md:pl-10 pr-3 py-3 h-full bg-slate-50 dark:bg-[#0f172a] border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-black text-lg md:text-xl min-w-0 focus:border-rose-500 transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <button onClick={agregarFila} className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 px-5 py-3 md:py-4 rounded-xl transition-colors flex items-center justify-center sm:justify-start gap-2 text-sm shadow-sm w-full sm:w-auto">
                                    <Plus size={18} /> Añadir otro artículo
                                </button>
                                <div ref={finalListaRef} className="h-2"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-[340px] xl:w-[380px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 lg:overflow-y-auto">

                    <div className="p-4 lg:p-6 pt-2 lg:pt-6 flex flex-col gap-4 flex-1 min-h-0">

                        <div className={`flex flex-col bg-white dark:bg-[#0f172a] p-4 lg:p-5 rounded-2xl border shadow-sm relative transition-colors ${!clienteTransaccion ? 'border-rose-200 dark:border-rose-900 bg-rose-50/30' : 'border-slate-100 dark:border-slate-800'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <UserCog size={14} /> Cliente <span className="text-rose-500 font-black">*Obligatorio</span>
                                </label>
                            </div>

                            {clienteTransaccion ? (
                                <div className="py-3 px-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col min-w-0 mr-2">
                                        <span className="font-black text-slate-900 dark:text-emerald-300 text-sm lg:text-base truncate">{clienteTransaccion.nombre}</span>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Deuda actual: ${clienteTransaccion.deudaTotal.toLocaleString('es-CO')}</span>
                                    </div>
                                    <button onClick={() => setClienteTransaccion(null)} className="text-rose-500 shrink-0 hover:bg-rose-100 p-1 rounded-full"><X size={18} /></button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" size={16} />
                                    <input type="text" value={busquedaRegistro} onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }} onFocus={() => setMostrarResultadosBuscador(true)} placeholder="Buscar / Crear cliente..." className="w-full pl-9 pr-2 py-3 lg:py-4 bg-white dark:bg-[#020617] border border-rose-200 dark:border-rose-800 rounded-xl text-sm font-bold outline-none focus:border-rose-500 transition-colors shadow-sm" />

                                    {mostrarResultadosBuscador && busquedaRegistro.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <div className="max-h-48 overflow-y-auto">
                                                {clientesFiltradosRegistro.map(c => (
                                                    <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setMostrarResultadosBuscador(false); }} className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between text-sm">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span><ChevronRight size={16} className="text-slate-400" />
                                                    </div>
                                                ))}
                                                {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                                                    <button onClick={() => { setNombreNuevo(busquedaRegistro); setModalNuevoCliente(true); setMostrarResultadosBuscador(false); }} className="w-full text-left p-3 bg-rose-50 text-rose-700 text-sm font-bold">
                                                        + Crear "{busquedaRegistro}"
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-rose-100 text-rose-700 rounded-xl flex items-start gap-3 mt-auto">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed">
                                Todo el monto registrado será asignado como deuda a la cuenta del cliente seleccionado.
                            </p>
                        </div>

                    </div>

                    <div className="hidden lg:block bg-slate-900 dark:bg-black p-6 shrink-0 lg:rounded-tl-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-30 mt-auto">
                        <div className="flex justify-between items-end mb-4">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Monto a Fiar</span>
                            <span className="text-5xl font-black text-rose-400 leading-none">${totalFilasRegistro.toLocaleString('es-CO')}</span>
                        </div>
                        <button onClick={procesarRegistro} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-2xl py-5 rounded-2xl shadow-lg transition-transform active:scale-95 flex justify-center items-center gap-2">
                            Fiar <CheckCircle2 size={24} />
                        </button>
                    </div>

                </div>
            </div>

            <div className="lg:hidden shrink-0 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800 px-4 py-3 sm:py-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-40 flex justify-between items-center gap-4">
                <div className="flex flex-col min-w-0 shrink">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto a Fiar</span>
                    <span className="text-2xl font-black text-rose-500 truncate max-w-[150px] leading-none">${totalFilasRegistro.toLocaleString('es-CO')}</span>
                </div>
                <button onClick={procesarRegistro} className="flex-1 bg-rose-600 active:bg-rose-700 text-white rounded-[1rem] py-3.5 px-2 font-black text-lg flex justify-center items-center gap-2 shadow-md transition-transform transform active:scale-[0.98] whitespace-nowrap">
                    Fiar <CheckCircle2 size={20} />
                </button>
            </div>

            <div className="h-24 lg:hidden w-full bg-slate-50 dark:bg-[#020617] shrink-0"></div>

            {modalFaltaCliente && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[900] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-center border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <AlertCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Falta Cliente</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm sm:text-base leading-relaxed">
                            Estás a punto de fiar <strong>${totalFilasRegistro.toLocaleString('es-CO')}</strong>, pero no has seleccionado a quién.<br /><br />Busca un cliente o crea uno nuevo para continuar.
                        </p>

                        <div className="relative mb-6 text-left">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input type="text" value={busquedaRegistro} onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }} placeholder="Buscar o crear cliente..." className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:border-rose-500 shadow-sm" />

                            {busquedaRegistro.length > 0 && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                                    {clientesFiltradosRegistro.map(c => (
                                        <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setModalFaltaCliente(false); }} className="p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span><ChevronRight size={18} className="text-slate-400" />
                                        </div>
                                    ))}
                                    {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                                        <button onClick={() => {
                                            const soloNumeros = busquedaRegistro.replace(/\D/g, '');
                                            if (soloNumeros.length >= 7) {
                                                setCelularNuevo(busquedaRegistro);
                                                setNombreNuevo("");
                                            } else {
                                                setNombreNuevo(busquedaRegistro);
                                                setCelularNuevo("");
                                            }
                                            setModalNuevoCliente(true);
                                            setMostrarResultadosBuscador(false);
                                        }} className="w-full text-left p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold">
                                            + Crear "{busquedaRegistro}"
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <button onClick={() => setModalFaltaCliente(false)} className="w-full bg-slate-100 dark:bg-[#020617] hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-2xl text-lg transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {modalNuevoCliente && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950]">
                    <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                        <h3 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-2"><UserCog size={28} /> Crear Cliente</h3>
                        <div className="flex flex-col gap-4 mb-8">
                            <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:border-rose-500 font-bold text-lg" />
                            <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="WhatsApp (Opcional)" className="w-full p-5 bg-slate-50 border rounded-2xl outline-none focus:border-rose-500 font-bold text-lg" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setModalNuevoCliente(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl text-lg">Cancelar</button>
                            <button onClick={guardarClienteNuevo} disabled={guardandoCliente} className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">Guardar <CheckCircle2 size={20} /></button>
                        </div>
                    </div>
                </div>
            )}

            {modalExito && modalExito.visible && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950] animate-in zoom-in duration-300">
                    <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl text-center border border-slate-100">
                        <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <CheckCircle2 size={50} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-2">¡Fiado Registrado!</h2>

                        <div className="mb-8 text-slate-500 text-base flex flex-col gap-2">
                            <p>Saldo cargado a: <strong className="text-slate-800">{modalExito.cliente.nombre}</strong></p>
                            <p className="text-rose-600 font-bold bg-rose-50 p-3 rounded-xl mt-2 text-xl">Monto: ${modalExito.montoTotal.toLocaleString('es-CO')}</p>
                            <p className="text-sm mt-2">Nueva deuda total: <strong>${modalExito.cliente.deudaTotal.toLocaleString('es-CO')}</strong></p>
                        </div>

                        {modalExito.cliente.celular && modalExito.cliente.celular.trim() !== "" && datosSesion?.rol !== 'cajero' && (
                            <button onClick={() => abrirWhatsApp(modalExito.cliente)} className="w-full mb-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg">
                                <MessageCircle size={24} /> Notificar por WhatsApp
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