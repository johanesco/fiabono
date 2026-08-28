"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, doc, updateDoc, where, increment } from "firebase/firestore";
import { db } from "../../../firebase";
import { Search, ShoppingBag, CheckCircle2, ChevronRight, X, AlertCircle, UserCog, Plus, Minus, ArrowLeft, MessageCircle, Package, QrCode, Volume2, Printer, ChevronDown, ChevronUp, Tag, Receipt, Pause, FolderOpen, User, Trash2 } from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";
import { API_DB } from "../../../servicios/db";
import TicketFacturaModal from "@/components/TicketFacturaModal";

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
    const esAdmin = datosSesion?.tipoUsuario === 'principal';
    const puedeVentaDirecta: boolean = datosSesion?.puedeVentaDirecta ?? true;
    const puedeModificarPrecios = esAdmin;
    const puedeAplicarDescuentos = esAdmin;

    const [vendedorActivo, setVendedorActivo] = useState(nombreUsuario || "Vendedor");
    const [listaVendedores, setListaVendedores] = useState<string[]>([]);
    const [modalNuevoVendedor, setModalNuevoVendedor] = useState(false);
    const [nombreNuevoVendedor, setNombreNuevoVendedor] = useState("");

    // Estructura de Pestañas Multi-Fiado en Vivo
    interface PestanaFiado {
        id: string;
        nombre: string;
        vendedor: string;
        filas: { descripcion: string; valor: string; cantidad: number }[];
        cliente: any | null;
        mostrarDescuento: boolean;
        tipoDescuento: 'porcentaje' | 'fijo';
        valorDescuento: string;
    }

    const [pestanas, setPestanas] = useState<PestanaFiado[]>([
        {
            id: '1',
            nombre: 'Fiado #1',
            vendedor: nombreUsuario || 'Vendedor',
            filas: [{ descripcion: "", valor: "", cantidad: 1 }],
            cliente: null,
            mostrarDescuento: false,
            tipoDescuento: 'porcentaje',
            valorDescuento: ""
        }
    ]);
    const [pestanaActivaId, setPestanaActivaId] = useState<string>('1');

    const [clientes, setClientes] = useState<any[]>([]);
    const [inventario, setInventario] = useState<any[]>([]);
    const [filasRegistro, setFilasRegistro] = useState<{ descripcion: string; valor: string; cantidad: number }[]>([{ descripcion: "", valor: "", cantidad: 1 }]);

    // Estados para Descuento Comercial en Fiados
    const [mostrarDescuento, setMostrarDescuento] = useState(false);
    const [tipoDescuento, setTipoDescuento] = useState<'porcentaje' | 'fijo'>('porcentaje');
    const [valorDescuento, setValorDescuento] = useState<string>('');

    const [clienteTransaccion, setClienteTransaccion] = useState<any | null>(null);
    const [busquedaRegistro, setBusquedaRegistro] = useState("");
    const [mostrarResultadosBuscador, setMostrarResultadosBuscador] = useState(false);
    const [busquedaProductoIndex, setBusquedaProductoIndex] = useState<number | null>(null);

    const [modalFaltaCliente, setModalFaltaCliente] = useState(false);
    const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
    const [modalExito, setModalExito] = useState<{ visible: boolean, cliente: any, montoTotal: number, ticketDatos?: any } | null>(null);
    const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: any | null }>({ visible: false, datos: null });

    const esTerminalMultivendedor: boolean = datosSesion?.esTerminalMultivendedor ?? false;

    // Clave de almacenamiento dinámico por usuario/vendedor para fiados
    const getStorageKey = (vendedor: string) => {
        const vLimpio = (vendedor || nombreUsuario || "vendedor").toLowerCase().replace(/\s+/g, '_');
        return `fiabono_draft_fiados_${cuentaPrincipalId || 'local'}_${vLimpio}`;
    };

    const persistirPestanas = (nuevasPestanas: PestanaFiado[], vendedor: string = vendedorActivo) => {
        try {
            const key = getStorageKey(vendedor);
            localStorage.setItem(key, JSON.stringify(nuevasPestanas));
        } catch (e) {}
    };

    // Cargar pestañas iniciales desde LocalStorage para el vendedor activo (con soporte robusto de precarga desde inventario)
    useEffect(() => {
        if (!vendedorActivo) return;
        try {
            // 1. Revisar si hay productos precargados desde inventario
            const precarga = sessionStorage.getItem('fiabono_productos_precargados');
            let itemsPrecargados: any[] | null = null;
            if (precarga) {
                try {
                    const parsedPrecarga = JSON.parse(precarga);
                    if (Array.isArray(parsedPrecarga) && parsedPrecarga.length > 0) {
                        itemsPrecargados = parsedPrecarga;
                    }
                } catch (e) {}
                sessionStorage.removeItem('fiabono_productos_precargados');
            }

            const origen = sessionStorage.getItem('fiabono_origen_despacho');
            if (origen) {
                setOrigenRuta(origen);
                sessionStorage.removeItem('fiabono_origen_despacho');
            }

            const key = getStorageKey(vendedorActivo);
            const dataGuardada = localStorage.getItem(key);
            let listaPestanas: PestanaFiado[] = [];

            if (dataGuardada) {
                try {
                    const parsed = JSON.parse(dataGuardada);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        listaPestanas = parsed;
                    }
                } catch (e) {}
            }

            if (listaPestanas.length === 0) {
                listaPestanas = [{
                    id: '1',
                    nombre: 'Fiado #1',
                    vendedor: vendedorActivo,
                    filas: [{ descripcion: "", valor: "", cantidad: 1 }],
                    cliente: null,
                    mostrarDescuento: false,
                    tipoDescuento: 'porcentaje',
                    valorDescuento: ''
                }];
            }

            if (itemsPrecargados && itemsPrecargados.length > 0) {
                const pestanaInicial: PestanaFiado = {
                    ...listaPestanas[0],
                    filas: itemsPrecargados
                };
                const actualizadas = [pestanaInicial, ...listaPestanas.slice(1)];
                setPestanas(actualizadas);
                setPestanaActivaId(pestanaInicial.id);
                cargarDatosDePestana(pestanaInicial);
                persistirPestanas(actualizadas, vendedorActivo);
                toast.success(`${itemsPrecargados.length} producto(s) cargado(s) desde inventario`);
            } else {
                setPestanas(listaPestanas);
                setPestanaActivaId(listaPestanas[0].id);
                cargarDatosDePestana(listaPestanas[0]);
            }
        } catch (e) {
            console.error("Error al cargar borrador de fiados:", e);
        }
    }, [vendedorActivo, cuentaPrincipalId]);

    // Sincronizar en tiempo real cada cambio del formulario al estado de pestañas y localStorage
    useEffect(() => {
        setPestanas(prev => {
            const actualizadas = prev.map(p => {
                if (p.id === pestanaActivaId) {
                    return {
                        ...p,
                        vendedor: vendedorActivo,
                        filas: filasRegistro,
                        cliente: clienteTransaccion,
                        mostrarDescuento: mostrarDescuento,
                        tipoDescuento: tipoDescuento,
                        valorDescuento: valorDescuento,
                        nombre: p.nombre.startsWith('Fiado #') && clienteTransaccion?.nombre ? clienteTransaccion.nombre : p.nombre
                    };
                }
                return p;
            });
            persistirPestanas(actualizadas, vendedorActivo);
            return actualizadas;
        });
    }, [
        filasRegistro,
        clienteTransaccion,
        mostrarDescuento,
        tipoDescuento,
        valorDescuento,
        vendedorActivo,
        pestanaActivaId
    ]);

    // Sincronizar estado actual a la pestaña activa antes de cambiar
    const guardarEstadoEnPestanaActiva = (idActual: string = pestanaActivaId) => {
        setPestanas(prev => {
            const actualizadas = prev.map(p => {
                if (p.id === idActual) {
                    return {
                        ...p,
                        vendedor: vendedorActivo,
                        filas: filasRegistro,
                        cliente: clienteTransaccion,
                        mostrarDescuento: mostrarDescuento,
                        tipoDescuento: tipoDescuento,
                        valorDescuento: valorDescuento,
                        nombre: p.nombre.startsWith('Fiado #') && clienteTransaccion?.nombre ? clienteTransaccion.nombre : p.nombre
                    };
                }
                return p;
            });
            persistirPestanas(actualizadas, vendedorActivo);
            return actualizadas;
        });
    };

    // Cargar datos de una pestaña en el formulario
    const cargarDatosDePestana = (p: PestanaFiado) => {
        setVendedorActivo(p.vendedor || nombreUsuario || "Vendedor");
        setFilasRegistro(p.filas?.length > 0 ? p.filas : [{ descripcion: "", valor: "", cantidad: 1 }]);
        setClienteTransaccion(p.cliente || null);
        setMostrarDescuento(p.mostrarDescuento || false);
        setTipoDescuento(p.tipoDescuento || 'porcentaje');
        setValorDescuento(p.valorDescuento || "");
    };

    // Cambiar de pestaña
    const cambiarPestana = (idDestino: string) => {
        if (idDestino === pestanaActivaId) return;
        guardarEstadoEnPestanaActiva(pestanaActivaId);
        const destino = pestanas.find(p => p.id === idDestino);
        if (destino) {
            cargarDatosDePestana(destino);
            setPestanaActivaId(idDestino);
        }
    };

    // Cambiar vendedor con aislamiento de pestañas
    const cambiarVendedor = (nuevoVendedor: string) => {
        if (nuevoVendedor === vendedorActivo) return;

        // 1. Guardar estado actual del vendedor que sale
        const pestanasActualizadas = pestanas.map(p => {
            if (p.id === pestanaActivaId) {
                return {
                    ...p,
                    vendedor: vendedorActivo,
                    filas: filasRegistro,
                    cliente: clienteTransaccion,
                    mostrarDescuento: mostrarDescuento,
                    tipoDescuento: tipoDescuento,
                    valorDescuento: valorDescuento,
                    nombre: p.nombre.startsWith('Fiado #') && clienteTransaccion?.nombre ? clienteTransaccion.nombre : p.nombre
                };
            }
            return p;
        });
        persistirPestanas(pestanasActualizadas, vendedorActivo);

        // 2. Cambiar a nuevo vendedor
        setVendedorActivo(nuevoVendedor);

        // 3. Cargar datos del nuevo vendedor
        try {
            const key = getStorageKey(nuevoVendedor);
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setPestanas(parsed);
                    setPestanaActivaId(parsed[0].id);
                    cargarDatosDePestana(parsed[0]);
                    return;
                }
            }
        } catch (e) {}

        // Si no tiene datos previos, inicializar 1 pestaña
        const inicial: PestanaFiado = {
            id: '1',
            nombre: 'Fiado #1',
            vendedor: nuevoVendedor,
            filas: [{ descripcion: "", valor: "", cantidad: 1 }],
            cliente: null,
            mostrarDescuento: false,
            tipoDescuento: 'porcentaje',
            valorDescuento: ""
        };
        setPestanas([inicial]);
        setPestanaActivaId('1');
        cargarDatosDePestana(inicial);
        persistirPestanas([inicial], nuevoVendedor);
    };

    // Crear nueva pestaña
    const crearNuevaPestana = (nombreOpcional?: string) => {
        guardarEstadoEnPestanaActiva(pestanaActivaId);
        const nuevoId = Date.now().toString();
        const nueva: PestanaFiado = {
            id: nuevoId,
            nombre: nombreOpcional || `Fiado #${pestanas.length + 1}`,
            vendedor: vendedorActivo || nombreUsuario || "Vendedor",
            filas: [{ descripcion: "", valor: "", cantidad: 1 }],
            cliente: null,
            mostrarDescuento: false,
            tipoDescuento: 'porcentaje',
            valorDescuento: ""
        };
        const nuevas = [...pestanas, nueva];
        setPestanas(nuevas);
        persistirPestanas(nuevas, vendedorActivo);
        cargarDatosDePestana(nueva);
        setPestanaActivaId(nuevoId);
    };

    // Cerrar pestaña (o limpiar si es la única)
    const cerrarPestana = (idACerrar: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (pestanas.length <= 1) {
            const reiniciada: PestanaFiado = {
                id: '1',
                nombre: 'Fiado #1',
                vendedor: vendedorActivo || nombreUsuario || "Vendedor",
                filas: [{ descripcion: "", valor: "", cantidad: 1 }],
                cliente: null,
                mostrarDescuento: false,
                tipoDescuento: 'porcentaje',
                valorDescuento: ""
            };
            setPestanas([reiniciada]);
            persistirPestanas([reiniciada], vendedorActivo);
            setPestanaActivaId('1');
            cargarDatosDePestana(reiniciada);
            toast.success("Fiado limpiado con éxito", { icon: '🧹' });
            return;
        }

        const restantes = pestanas.filter(p => p.id !== idACerrar);
        setPestanas(restantes);
        persistirPestanas(restantes, vendedorActivo);

        if (pestanaActivaId === idACerrar) {
            const siguiente = restantes[0];
            setPestanaActivaId(siguiente.id);
            cargarDatosDePestana(siguiente);
        }
    };

    // Agregar vendedor rápido / colaborador
    const registrarVendedorRapido = () => {
        const nombreLimpio = nombreNuevoVendedor.trim();
        if (!nombreLimpio) return;
        if (!listaVendedores.includes(nombreLimpio)) {
            const actualizados = [...listaVendedores, nombreLimpio];
            setListaVendedores(actualizados);
            try {
                localStorage.setItem(`fiabono_vendedores_${cuentaPrincipalId || 'local'}`, JSON.stringify(actualizados));
            } catch (e) {}
        }
        cambiarVendedor(nombreLimpio);
        setNombreNuevoVendedor("");
        setModalNuevoVendedor(false);
        toast.success(`Vendedor "${nombreLimpio}" seleccionado`);
    };

    // Cargar colaboradores registrados en Firebase y locales
    useEffect(() => {
        if (!cuentaPrincipalId) return;

        const cargarVendedores = async () => {
            try {
                const nombres: string[] = [];
                if (nombreUsuario) nombres.push(nombreUsuario);

                // 1. Consultar colaboradores creados en Perfil (adminId == cuentaPrincipalId)
                try {
                    const qAdmin = query(collection(db, "usuarios"), where("adminId", "==", cuentaPrincipalId));
                    const snapAdmin = await getDocs(qAdmin);
                    snapAdmin.forEach(d => {
                        const u = d.data();
                        const nom = u.nombreUsuario || u.nombre || u.nombreColaborador;
                        if (nom && !nombres.includes(nom)) {
                            nombres.push(nom);
                        }
                    });
                } catch (e) {}

                // 2. Consultar usuarios donde cuentaPrincipalId == cuentaPrincipalId
                try {
                    const qUsers = query(collection(db, "usuarios"), where("cuentaPrincipalId", "==", cuentaPrincipalId));
                    const snapU = await getDocs(qUsers);
                    snapU.forEach(d => {
                        const u = d.data();
                        const nom = u.nombreUsuario || u.nombre || u.nombreColaborador;
                        if (nom && !nombres.includes(nom)) {
                            nombres.push(nom);
                        }
                    });
                } catch (e) {}

                // 3. Vendedores guardados en localStorage
                const guardadosLocales = localStorage.getItem(`fiabono_vendedores_${cuentaPrincipalId || 'local'}`) || localStorage.getItem('fiabono_vendedores_rapidos');
                if (guardadosLocales) {
                    try {
                        const parseados: string[] = JSON.parse(guardadosLocales);
                        if (Array.isArray(parseados)) {
                            parseados.forEach(n => {
                                if (n && !nombres.includes(n)) nombres.push(n);
                            });
                        }
                    } catch (e) {}
                }

                setListaVendedores(nombres.length > 0 ? nombres : [nombreUsuario || "Vendedor"]);
            } catch (e) {
                console.error("Error al cargar vendedores:", e);
            }
        };

        cargarVendedores();
    }, [cuentaPrincipalId, nombreUsuario]);

    // Estados y Referencias del Escáner Rápido POS
    const [modalEscanner, setModalEscanner] = useState(false);
    const [mensajeScaneo, setMensajeScaneo] = useState<{ texto: string; tipo: 'exito' | 'error' } | null>(null);
    const [camaraIniciada, setCamaraIniciada] = useState(false);
    const [errorCamara, setErrorCamara] = useState<string | null>(null);
    const [flashExito, setFlashExito] = useState(false);
    const [ultimoProductoEscaneado, setUltimoProductoEscaneado] = useState<{ nombre: string; precio: number; cantidad: number } | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const ultimoScanRef = useRef<{ sku: string; timestamp: number } | null>(null);

    const [nombreNuevo, setNombreNuevo] = useState("");
    const [celularNuevo, setCelularNuevo] = useState("");
    const [guardandoCliente, setGuardandoCliente] = useState(false);
    const [origenRuta, setOrigenRuta] = useState<string>('/dashboard/inicio');

    const scrollArticulosRef = useRef<HTMLDivElement>(null);
    const finalListaRef = useRef<HTMLDivElement>(null);
    const contenedorScrollRef = useRef<HTMLDivElement>(null);
    const inputsDescripcionRef = useRef<(HTMLInputElement | null)[]>([]);
    const [posicionScroll, setPosicionScroll] = useState<'arriba' | 'medio' | 'abajo'>('arriba');
    const [puedeHacerScroll, setPuedeHacerScroll] = useState(false);

    useEffect(() => {
        if (cuentaPrincipalId) {
            cargarDatosGlobales(cuentaPrincipalId);
            cargarInventario(cuentaPrincipalId);
        }
    }, [cuentaPrincipalId]);



    // Inicialización y limpieza del escáner con cámara directa
    useEffect(() => {
        if (!modalEscanner) return;

        let mounted = true;
        const scannerId = "reader-fiar";

        const iniciarCamara = async () => {
            try {
                const html5Qr = new Html5Qrcode(scannerId);
                html5QrCodeRef.current = html5Qr;

                await html5Qr.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const edge = Math.min(viewfinderWidth, viewfinderHeight);
                            const size = Math.floor(edge * 0.75);
                            return { width: size, height: size };
                        },
                        aspectRatio: 1.0
                    },
                    (decodedText) => {
                        if (mounted) {
                            manejarProductoScaneado(decodedText);
                        }
                    },
                    () => {}
                );

                if (mounted) {
                    setCamaraIniciada(true);
                }
            } catch (err: any) {
                console.error("Error al iniciar cámara:", err);
                if (mounted) {
                    setErrorCamara(
                        err?.message || "No se pudo acceder a la cámara trasera. Por favor verifica los permisos en tu navegador."
                    );
                }
            }
        };

        const timer = setTimeout(iniciarCamara, 150);

        return () => {
            mounted = false;
            clearTimeout(timer);
            if (html5QrCodeRef.current) {
                if (html5QrCodeRef.current.isScanning) {
                    html5QrCodeRef.current.stop().then(() => {
                        html5QrCodeRef.current?.clear();
                    }).catch(e => console.error("Error al detener cámara:", e));
                } else {
                    try { html5QrCodeRef.current.clear(); } catch (e) {}
                }
            }
        };
    }, [modalEscanner]);

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

    const abrirEscanner = () => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
        } catch (e) {}
        setMensajeScaneo(null);
        setErrorCamara(null);
        setCamaraIniciada(false);
        setModalEscanner(true);
    };

    const reproducirSonidoExito = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) { }
    };

    const reproducirSonidoNoEncontrado = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') ctx.resume();

            // Pulso 1: Tono medio descendente
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(360, ctx.currentTime);
            osc1.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.1);
            gain1.gain.setValueAtTime(0.3, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.1);

            // Pulso 2: Tono grave descendente
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
            osc2.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.26);
            gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.26);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.12);
            osc2.stop(ctx.currentTime + 0.26);
        } catch (e) {}
    };

    const dispararFeedback = (tipo: 'exito' | 'error', texto: string) => {
        setMensajeScaneo({ texto, tipo });
        if (tipo === 'exito') {
            reproducirSonidoExito();
            if (navigator.vibrate) navigator.vibrate(100);
        } else {
            reproducirSonidoNoEncontrado();
            if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
        }

        setTimeout(() => {
            setMensajeScaneo(null);
        }, 2000);
    };

    const manejarProductoScaneado = (skuScaneado: string) => {
        const ahora = Date.now();
        const skuLimpio = skuScaneado.trim().toLowerCase();

        // 1. COOLDOWN INTELIGENTE (Evita duplicados en ráfaga durante 1.8 segundos para el mismo SKU)
        if (
            ultimoScanRef.current &&
            ultimoScanRef.current.sku === skuLimpio &&
            ahora - ultimoScanRef.current.timestamp < 1800
        ) {
            return;
        }

        const productoEncontrado = inventario.find(
            p => (p.sku && p.sku.toLowerCase() === skuLimpio) || p.id === skuScaneado
        );

        if (!productoEncontrado) {
            ultimoScanRef.current = { sku: skuLimpio, timestamp: ahora };
            dispararFeedback('error', `❌ Código "${skuScaneado}" no registrado`);
            return;
        }

        ultimoScanRef.current = { sku: skuLimpio, timestamp: ahora };

        // 2. FLASH VISUAL VERDE
        setFlashExito(true);
        setTimeout(() => setFlashExito(false), 250);

        // 3. ACTUALIZAR LISTA DE ARTÍCULOS
        setFilasRegistro((prevFilas) => {
            const nuevasFilas = [...prevFilas];
            const indexExistente = nuevasFilas.findIndex(
                f => f.descripcion.toLowerCase() === productoEncontrado.nombre.toLowerCase()
            );

            let cantResultante = 1;

            if (indexExistente !== -1) {
                const fila = nuevasFilas[indexExistente];
                const cantEnOtras = nuevasFilas.reduce((acc, f, i) => i !== indexExistente && f.descripcion.toLowerCase() === productoEncontrado.nombre.toLowerCase() ? acc + f.cantidad : acc, 0);
                const stockDisp = (productoEncontrado.stock || 0) - cantEnOtras;

                if (productoEncontrado.tipoProducto !== 'servicio' && productoEncontrado.inventariable !== false && fila.cantidad + 1 > stockDisp) {
                    dispararFeedback('error', `⚠️ Límite de stock: ${productoEncontrado.nombre}`);
                    return prevFilas;
                }

                fila.cantidad += 1;
                cantResultante = fila.cantidad;
                dispararFeedback('exito', `✓ +1 ${productoEncontrado.nombre} (Total: ${fila.cantidad})`);
            } else {
                const indexVacio = nuevasFilas.findIndex(f => f.descripcion.trim() === "" && (parseFloat(f.valor || "0") === 0 || f.valor === ""));

                if (productoEncontrado.tipoProducto !== 'servicio' && productoEncontrado.inventariable !== false && (productoEncontrado.stock || 0) <= 0) {
                    dispararFeedback('error', `❌ Agotado: ${productoEncontrado.nombre}`);
                    return prevFilas;
                }

                if (indexVacio !== -1) {
                    nuevasFilas[indexVacio] = {
                        descripcion: productoEncontrado.nombre,
                        valor: (productoEncontrado.precioVenta || 0).toString(),
                        cantidad: 1
                    };
                } else {
                    nuevasFilas.push({
                        descripcion: productoEncontrado.nombre,
                        valor: (productoEncontrado.precioVenta || 0).toString(),
                        cantidad: 1
                    });
                }
                cantResultante = 1;
                dispararFeedback('exito', `✓ Añadido al fiado: ${productoEncontrado.nombre}`);
            }

            setUltimoProductoEscaneado({
                nombre: productoEncontrado.nombre,
                precio: Number(productoEncontrado.precioVenta) || 0,
                cantidad: cantResultante
            });

            return nuevasFilas;
        });
    };

    // Ordenamiento inteligente de sugerencias de inventario (Prioridad: Inicia con > Palabra inicia con > Contiene)
    const ordenarProductosSugeridos = (lista: any[], queryText: string) => {
        const q = queryText.trim().toLowerCase();
        if (!q) return [];
        return lista.filter(p => {
            const n = (p.nombre || "").toLowerCase();
            const s = (p.sku || "").toLowerCase();
            const c = (p.codigo || "").toLowerCase();
            return n.includes(q) || s.includes(q) || c.includes(q);
        }).sort((a, b) => {
            const aName = (a.nombre || "").toLowerCase();
            const bName = (b.nombre || "").toLowerCase();
            const aStarts = aName.startsWith(q);
            const bStarts = bName.startsWith(q);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            const aWordStarts = aName.split(/\s+/).some((w: string) => w.startsWith(q));
            const bWordStarts = bName.split(/\s+/).some((w: string) => w.startsWith(q));
            if (aWordStarts && !bWordStarts) return -1;
            if (!aWordStarts && bWordStarts) return 1;
            return aName.localeCompare(bName);
        }).slice(0, 8);
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
        setFilasRegistro(prev => {
            const nuevoIndex = prev.length;
            const nueva = [...prev, { descripcion: "", valor: "", cantidad: 1 }];
            setBusquedaProductoIndex(nuevoIndex);
            setTimeout(() => {
                inputsDescripcionRef.current[nuevoIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                inputsDescripcionRef.current[nuevoIndex]?.focus();
                if (scrollArticulosRef.current) {
                    scrollArticulosRef.current.scrollTo({ top: scrollArticulosRef.current.scrollHeight, behavior: 'smooth' });
                }
            }, 80);
            return nueva;
        });
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
            const descLim = filaActual.descripcion.toLowerCase().trim();
            const productoEnInventario = inventario.find(p => 
                p.nombre.toLowerCase().trim() === descLim ||
                (p.sku && p.sku.toLowerCase().trim() === descLim) ||
                (p.codigo && p.codigo.toLowerCase().trim() === descLim)
            );
            const esInventariable = productoEnInventario && productoEnInventario.tipoProducto !== 'servicio' && productoEnInventario.inventariable !== false;

            if (esInventariable) {
                const cantidadEnOtrasFilas = nuevasFilas.reduce((acc, f, i) => {
                    const fDesc = f.descripcion.toLowerCase().trim();
                    if (i !== index && (
                        fDesc === productoEnInventario.nombre.toLowerCase().trim() ||
                        (productoEnInventario.sku && fDesc === productoEnInventario.sku.toLowerCase().trim())
                    )) {
                        return acc + f.cantidad;
                    }
                    return acc;
                }, 0);

                const stockTotalPermitido = (productoEnInventario.stock || 0) - cantidadEnOtrasFilas;

                if (nuevaCant > stockTotalPermitido) {
                    const totalYaEnLista = cantidadEnOtrasFilas + filaActual.cantidad;
                    if (totalYaEnLista >= (productoEnInventario.stock || 0)) {
                        toast.error(`⚠️ Ya tienes todas las unidades disponibles de "${productoEnInventario.nombre}" en tu lista (${productoEnInventario.stock || 0} en total).`, { position: 'bottom-center', icon: '🚫' });
                    } else {
                        toast.error(`⚠️ Solo puedes agregar ${Math.max(0, stockTotalPermitido - filaActual.cantidad)} unidad(es) más de "${productoEnInventario.nombre}".`, { position: 'bottom-center', icon: '🚫' });
                    }
                    return;
                }
            }
        }

        nuevasFilas[index].cantidad = nuevaCant;
        setFilasRegistro(nuevasFilas);
    };

    const eliminarFila = (index: number) => { if (filasRegistro.length > 1) setFilasRegistro(filasRegistro.filter((_, i) => i !== index)); };

    const subtotalBruto = filasRegistro.reduce((acc, fila) => {
        const val = parseFloat(fila.valor || "0");
        return acc + (isNaN(val) ? 0 : val * fila.cantidad);
    }, 0);

    const calcularMontoDescuento = () => {
        if (!mostrarDescuento || !valorDescuento) return 0;
        const num = parseFloat(valorDescuento.replace(/\D/g, '')) || 0;
        if (num <= 0) return 0;
        if (tipoDescuento === 'porcentaje') {
            const pct = Math.min(100, num);
            return Math.round(subtotalBruto * (pct / 100));
        } else {
            return Math.min(subtotalBruto, num);
        }
    };

    const montoDescuentoTotal = calcularMontoDescuento();
    const totalFilasRegistro = Math.max(0, subtotalBruto - montoDescuentoTotal);

    // Guardar orden pendiente de fiado (colaboradores sin permiso de venta directa)
    const enviarOrden = async () => {
        const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
        if (filasValidas.length === 0) return toast.error("Ingresa al menos un artículo con valor.");
        if (!cuentaPrincipalId) return;

        // Validar stock antes de enviar orden de fiado
        for (const fila of filasValidas) {
            const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
            const esInventariable = item && item.tipoProducto !== 'servicio' && item.inventariable !== false;
            if (esInventariable) {
                const totalRequerido = filasValidas
                    .filter(f => f.descripcion.toLowerCase() === fila.descripcion.toLowerCase())
                    .reduce((sum, f) => sum + f.cantidad, 0);

                if (totalRequerido > (item.stock || 0)) {
                    toast.error(`¡Stock insuficiente! Para "${item.nombre}" solicitas ${totalRequerido} pero solo quedan ${item.stock || 0} disponibles.`);
                    return;
                }
            }
        }

        try {
            await addDoc(collection(db, "ordenes_pendientes"), {
                tipo: 'fiado',
                estado: 'pendiente',
                usuarioId: cuentaPrincipalId,
                creadoPor: datosSesion?.uid || '',
                nombreColaborador: vendedorActivo || nombreUsuario || 'Colaborador',
                clienteId: clienteTransaccion.id,
                clienteNombre: clienteTransaccion.nombre,
                clienteCelular: clienteTransaccion.celular || '',
                items: filasValidas.map(f => ({ descripcion: f.descripcion, valor: f.valor, cantidad: f.cantidad })),
                totalBruto: subtotalBruto,
                descuentoTipo: mostrarDescuento && montoDescuentoTotal > 0 ? tipoDescuento : null,
                descuentoValor: mostrarDescuento && montoDescuentoTotal > 0 ? Number(valorDescuento.replace(/\D/g, '')) : null,
                montoDescuento: montoDescuentoTotal,
                total: totalFilasRegistro,
                metodoPago: 'fiado',
                pagoCliente: 0,
                fecha: new Date(),
                fechaProcesado: null,
                aprobadoPor: null,
                motivoRechazo: null,
            });
            toast.success("¡Orden de fiado enviada! El administrador la revisará para confirmarla.", { duration: 4000, icon: '📋' });
            // Resetear formulario
            setFilasRegistro([{ descripcion: "", valor: "", cantidad: 1 }]);
            setClienteTransaccion(null);
            setBusquedaRegistro("");
            setMostrarDescuento(false);
            setValorDescuento('');
        } catch (e) {
            toast.error("Error al enviar la orden. Intenta de nuevo.");
        }
    };

    const procesarRegistro = () => {
        if (!puedeVentaDirecta) {
            enviarOrden();
            return;
        }

        const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
        if (filasValidas.length === 0) return alert("Ingresa al menos un monto válido en los artículos.");

        for (const fila of filasValidas) {
            const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
            const esInventariable = item && item.tipoProducto !== 'servicio' && item.inventariable !== false;
            if (esInventariable) {
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

        for (const fila of filasValidas) {
            const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
            const esInventariable = item && item.tipoProducto !== 'servicio' && item.inventariable !== false;
            if (esInventariable) {
                const totalRequerido = filasValidas
                    .filter(f => f.descripcion.toLowerCase() === fila.descripcion.toLowerCase())
                    .reduce((sum, f) => sum + f.cantidad, 0);

                if (totalRequerido > (item.stock || 0)) {
                    toast.error(`¡Sin stock suficiente! Para "${item.nombre}" solicitas ${totalRequerido} pero solo quedan ${item.stock || 0} disponibles.`);
                    return;
                }
            }
        }

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

            // Transacción atómica: fiar y actualizar deuda del cliente
            const resFiado = await API_DB.registrarMovimientoConTransaccion(
                {
                    clienteId: clienteTransaccion.id,
                    usuarioId: cuentaPrincipalId,
                    tipo: 'fiado',
                    monto: faltante,
                    descripcion: descripcionUnificada + (montoDescuentoTotal > 0 ? ` [Dto: -$${montoDescuentoTotal.toLocaleString('es-CO')}]` : ''),
                    detalles: detallesParaComprobante,
                    fecha: new Date(),
                    registradoPor: nombreUsuario,
                    metodoPago: 'fiado',
                    descuentoTipo: mostrarDescuento && montoDescuentoTotal > 0 ? tipoDescuento : null,
                    descuentoValor: mostrarDescuento && montoDescuentoTotal > 0 ? (tipoDescuento === 'porcentaje' ? Number(valorDescuento) : montoDescuentoTotal) : undefined,
                    montoDescuento: montoDescuentoTotal > 0 ? montoDescuentoTotal : undefined
                },
                {
                    ajustarSaldoCliente: true,
                    cambioDeuda: faltante
                }
            );

            // Descontar inventario consolidado por ID de forma atómica
            const cantidadesPorProducto: Record<string, number> = {};
            for (const fila of filasValidas) {
                const item = inventario.find(p => p.nombre.toLowerCase() === fila.descripcion.toLowerCase());
                const esInventariable = item && item.tipoProducto !== 'servicio' && item.inventariable !== false;
                if (esInventariable && item.id) {
                    cantidadesPorProducto[item.id] = (cantidadesPorProducto[item.id] || 0) + fila.cantidad;
                }
            }

            for (const [pId, cant] of Object.entries(cantidadesPorProducto)) {
                await updateDoc(doc(db, "inventario", pId), {
                    stock: increment(-cant)
                });
            }

            const saldoFinal = resFiado.nuevoSaldoCliente !== undefined ? resFiado.nuevoSaldoCliente : ((clienteTransaccion.deudaTotal || 0) + faltante);
            const clienteFinalActualizado = { ...clienteTransaccion, deudaTotal: saldoFinal };

            const ticketDatos = {
                nombreNegocio: nombreNegocio || "Mi Negocio",
                telefonoNegocio: datosSesion?.telefonoNegocio || "",
                correoNegocio: datosSesion?.correoNegocio || "",
                logoNegocio: datosSesion?.logoNegocio || null,
                nitNegocio: datosSesion?.nitNegocio || "",
                direccionNegocio: datosSesion?.direccionNegocio || "",
                mensajePieTicket: datosSesion?.mensajePieTicket || "",
                nombreCliente: clienteTransaccion.nombre,
                celularCliente: clienteTransaccion.celular || "",
                registradoPor: nombreUsuario || "",
                fecha: new Date(),
                tipo: 'fiado' as const,
                detalles: detallesParaComprobante,
                descripcionGeneral: descripcionUnificada,
                montoTotal: faltante,
                montoBruto: subtotalBruto,
                descuentoTipo: mostrarDescuento && montoDescuentoTotal > 0 ? tipoDescuento : undefined,
                descuentoValor: mostrarDescuento && montoDescuentoTotal > 0 ? (tipoDescuento === 'porcentaje' ? Number(valorDescuento) : montoDescuentoTotal) : undefined,
                montoDescuento: montoDescuentoTotal > 0 ? montoDescuentoTotal : undefined,
                saldoNuevo: saldoFinal,
                idTransaccion: resFiado.movimientoId,
                metodoPago: 'fiado' as const
            };

            setModalExito({
                visible: true,
                cliente: clienteFinalActualizado,
                montoTotal: faltante,
                ticketDatos
            });

        } catch (error) { 
            console.error(error);
            toast.error("Error al procesar el fiado."); 
        }
    };

    const normalizarMensajeWhatsApp = (texto: string) => {
        return texto
          .replace(/\uFFFD/g, '')
          .replace(/\n{4,}/g, '\n\n\n')
          .replace(/\r\n/g, '\n')
          .trim();
    };

    const abrirWhatsApp = (cliente: any) => {
        const filasValidas = filasRegistro.filter(f => parseFloat(f.valor) > 0);
        let detalleTexto = "";
        filasValidas.forEach(f => {
            const unitario = parseFloat(f.valor);
            const subtotal = unitario * f.cantidad;
            const desc = f.descripcion.trim() || "Articulo";
            detalleTexto += `• ${f.cantidad}x ${desc}\n  Precio unitario: *$${unitario.toLocaleString('es-CO')}*\n  Total: *$${subtotal.toLocaleString('es-CO')}*\n\n`;
        });

        if (montoDescuentoTotal > 0) {
            detalleTexto += `*Subtotal:* $${subtotalBruto.toLocaleString('es-CO')}\n*Descuento (${tipoDescuento === 'porcentaje' ? `${valorDescuento}%` : `$${Number(valorDescuento).toLocaleString('es-CO')}`}):* -$${montoDescuentoTotal.toLocaleString('es-CO')}\n*TOTAL DE ESTE FIADO: $${totalFilasRegistro.toLocaleString('es-CO')}*\n\n`;
        }

        const saldoEsteFiado = totalFilasRegistro;
        const saldoCreditoTotal = Number.isFinite(Number(cliente.deudaTotal)) ? Number(cliente.deudaTotal) : saldoEsteFiado;
        const texto = `¡Hola, *${cliente.nombre}*! Gracias por tu confianza en *${nombreNegocio || 'nuestra tienda'}*.

===================
*DETALLE DEL CRÉDITO*
===================

${detalleTexto}
*TOTAL DE ESTE FIADO: $${saldoEsteFiado.toLocaleString('es-CO')}*
*Saldo de crédito Total: $${saldoCreditoTotal.toLocaleString('es-CO')}*

Gracias por confiar en nosotros.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;
        const mensajeLimpio = normalizarMensajeWhatsApp(texto);

        const celularLimpio = cliente.celular ? cliente.celular.replace(/\D/g, '') : '';
        const url = celularLimpio ? `https://wa.me/57${celularLimpio}?text=${encodeURIComponent(mensajeLimpio)}` : `https://wa.me/?text=${encodeURIComponent(mensajeLimpio)}`;

        window.open(url, '_blank');
    };

    const handleScrollContenedor = () => {
        const el = contenedorScrollRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        const tieneScroll = scrollHeight > clientHeight + 20;
        setPuedeHacerScroll(tieneScroll);

        if (scrollTop < 40) {
            setPosicionScroll('arriba');
        } else if (scrollTop + clientHeight >= scrollHeight - 60) {
            setPosicionScroll('abajo');
        } else {
            setPosicionScroll('medio');
        }
    };

    const deslizarAbajo = () => {
        contenedorScrollRef.current?.scrollTo({
            top: contenedorScrollRef.current.scrollHeight,
            behavior: 'smooth'
        });
    };

    const deslizarArriba = () => {
        contenedorScrollRef.current?.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        handleScrollContenedor();
        const handleResize = () => handleScrollContenedor();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [filasRegistro]);

    const clientesFiltradosRegistro = clientes.filter(c =>
        (c.nombre || "").toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
        (c.celular || "").toString().includes(busquedaRegistro)
    );

    return (
        <div className="flex flex-col w-full h-full bg-white dark:bg-[#0f172a] md:rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl min-h-0 animate-in fade-in duration-300 relative">

            {/* CABECERA */}
            <div className="bg-rose-600 dark:bg-rose-700 p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm gap-2">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <button 
                        type="button"
                        onClick={() => {
                            if (origenRuta && origenRuta !== '/dashboard/fiar') router.push(origenRuta);
                            else router.push('/dashboard/inicio');
                        }} 
                        className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm cursor-pointer active:scale-95 shrink-0"
                        title="Volver"
                    >
                        <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                    </button>
                    <h2 className="text-base sm:text-xl font-black uppercase tracking-wide flex items-center gap-2 truncate">
                        <ShoppingBag size={20} className="shrink-0" /> 
                        <span className="truncate">Fiar</span>
                    </h2>
                </div>

                {/* ACCIONES SUPERIORES: SELECTOR DE VENDEDOR + ESCÁNER */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Selector de Vendedor Responsable */}
                    {esTerminalMultivendedor ? (
                        <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-1.5 border border-white/20">
                            <User size={14} className="text-white/80 mr-1.5 shrink-0" />
                            <select
                                value={vendedorActivo}
                                onChange={(e) => {
                                    if (e.target.value === '__nuevo__') {
                                        setModalNuevoVendedor(true);
                                    } else {
                                        cambiarVendedor(e.target.value);
                                    }
                                }}
                                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-1"
                            >
                                {listaVendedores.map((v) => (
                                    <option key={v} value={v} className="bg-slate-900 text-white">
                                        {v}
                                    </option>
                                ))}
                                {esAdmin && (
                                    <option value="__nuevo__" className="bg-slate-900 text-amber-300 font-bold">
                                        + Agregar otro vendedor...
                                    </option>
                                )}
                            </select>
                        </div>
                    ) : (
                        <div className="hidden sm:flex items-center bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-1.5 border border-white/20 text-white text-xs font-bold gap-1.5">
                            <User size={13} className="text-white/80" />
                            <span>{vendedorActivo}</span>
                        </div>
                    )}

                    {/* Escanear QR */}
                    <button
                        onClick={abrirEscanner}
                        className="bg-white text-rose-700 hover:bg-rose-50 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer shrink-0"
                        title="Escanear Código QR"
                    >
                        <QrCode size={15} className="shrink-0" /> 
                        <span>Escanear QR</span>
                    </button>
                </div>
            </div>

            {/* BARRA DE PESTAÑAS MULTI-FIADO POS */}
            <div className="bg-rose-700/90 dark:bg-slate-900 px-3 py-2 border-b border-rose-800/40 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 z-20">
                {pestanas.map((p, index) => {
                    const activa = p.id === pestanaActivaId;
                    const subtotalPestana = (activa ? filasRegistro : p.filas).reduce((acc, f) => acc + ((parseFloat(f.valor) || 0) * f.cantidad), 0);

                    return (
                        <div
                            key={p.id}
                            onClick={() => cambiarPestana(p.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0 text-xs font-bold select-none ${
                                activa
                                    ? 'bg-white text-slate-900 shadow-md font-black'
                                    : 'bg-rose-800/50 hover:bg-rose-800 text-white/90 border border-white/10'
                            }`}
                        >
                            <ShoppingBag size={13} className={activa ? 'text-rose-600' : 'text-white/70'} />
                            <span className="truncate max-w-[120px]">
                                {p.nombre}
                            </span>

                            {subtotalPestana > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${activa ? 'bg-rose-100 text-rose-800' : 'bg-white/20 text-white'}`}>
                                    ${subtotalPestana.toLocaleString('es-CO')}
                                </span>
                            )}

                            {/* Botón Cerrar o Limpiar Pestaña */}
                            <button
                                type="button"
                                onClick={(e) => cerrarPestana(p.id, e)}
                                className={`p-0.5 rounded-full hover:bg-rose-100 hover:text-rose-600 transition-colors ${activa ? 'text-slate-400' : 'text-white/60'}`}
                                title={pestanas.length > 1 ? "Cerrar este fiado" : "Limpiar este fiado"}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    );
                })}

                {/* Botón + Nuevo Fiado */}
                <button
                    type="button"
                    onClick={() => crearNuevaPestana()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-800 hover:bg-rose-900 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shrink-0 border border-white/20 shadow-sm"
                    title="Abrir otro fiado simultáneo"
                >
                    <Plus size={14} />
                    <span>Nuevo Fiado</span>
                </button>
            </div>

            {/* CUERPO PRINCIPAL (Scroll continuo en móvil, 2 columnas en Desktop) */}
            <div 
                ref={contenedorScrollRef}
                onScroll={handleScrollContenedor}
                className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-40 lg:pb-0 relative"
            >

                {/* COLUMNA IZQUIERDA: ARTÍCULOS A FIAR */}
                <div className="flex-1 flex flex-col bg-slate-50/60 dark:bg-[#020617]/50 lg:min-h-0 lg:overflow-hidden shrink-0">

                    <div ref={scrollArticulosRef} className="p-3 sm:p-5 lg:p-6 xl:p-8 space-y-3 sm:space-y-4 lg:flex-1 lg:overflow-y-auto min-h-0">
                        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
                            <h4 className="font-bold text-slate-400 uppercase text-[10px] md:text-xs tracking-wider">Artículos a Fiar</h4>

                            <div className="space-y-3">
                                {filasRegistro.map((fila, index) => {
                                    const productosFiltradosInventario = ordenarProductosSugeridos(inventario, fila.descripcion);

                                    return (
                                        <div key={index} className={`flex flex-col sm:flex-row gap-2.5 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-sm transition-colors hover:border-rose-300 ${busquedaProductoIndex === index ? 'z-40' : 'z-10'}`}>

                                            {filasRegistro.length > 1 && (
                                                <button onClick={() => eliminarFila(index)} className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 rounded-full p-1 shadow-sm hover:scale-110 transition-transform z-10">
                                                    <X size={13} />
                                                </button>
                                            )}

                                            <div className="flex-1 min-w-0 relative">
                                                <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap truncate flex items-center gap-1">
                                                    <Package size={11} /> Descripción o SKU
                                                </label>
                                                <input
                                                    ref={(el) => { inputsDescripcionRef.current[index] = el; }}
                                                    type="text"
                                                    value={fila.descripcion}
                                                    onChange={(e) => {
                                                        actualizarFila(index, 'descripcion', e.target.value);
                                                        setBusquedaProductoIndex(index);
                                                    }}
                                                    onFocus={() => {
                                                        setBusquedaProductoIndex(index);
                                                        inputsDescripcionRef.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            if (busquedaProductoIndex === index && productosFiltradosInventario.length > 0) {
                                                                 e.preventDefault();
                                                                 const p = productosFiltradosInventario[0];

                                                                 const cantEnOtras = filasRegistro.reduce((acc, f, i) => i !== index && f.descripcion.toLowerCase() === p.nombre.toLowerCase() ? acc + f.cantidad : acc, 0);
                                                                 const stockDisp = (p.stock || 0) - cantEnOtras;

                                                                 if (p.tipoProducto !== 'servicio' && p.inventariable !== false && stockDisp <= 0) {
                                                                     toast.error("Sin stock disponible de " + p.nombre);
                                                                     return;
                                                                 }

                                                                 const nuevas = [...filasRegistro];
                                                                 nuevas[index].descripcion = p.nombre;
                                                                 nuevas[index].valor = p.precioVenta.toString();
                                                                 nuevas[index].cantidad = 1;
                                                                 setFilasRegistro(nuevas);
                                                                 setBusquedaProductoIndex(null);
                                                                 setTimeout(() => {
                                                                     agregarFila();
                                                                 }, 100);
                                                            } else if (fila.descripcion.trim().length > 0) {
                                                                 e.preventDefault();
                                                                 agregarFila();
                                                            }
                                                        }
                                                    }}
                                                    placeholder="Escribe nombre o SKU..."
                                                    className="w-full px-3 py-2 h-[42px] sm:h-[46px] md:h-[50px] bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-xs sm:text-sm md:text-base min-w-0 shadow-sm focus:border-rose-500 transition-colors text-slate-900 dark:!text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:text-xs sm:placeholder:text-sm placeholder:font-normal"
                                                />

                                                {busquedaProductoIndex === index && fila.descripcion.trim().length > 0 && productosFiltradosInventario.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 backdrop-blur-md">
                                                        {productosFiltradosInventario.map(p => {
                                                            const esInv = p.tipoProducto !== 'servicio' && p.inventariable !== false;
                                                            const cantEnOtras = filasRegistro.reduce((acc, f, i) => i !== index && f.descripcion.toLowerCase().trim() === p.nombre.toLowerCase().trim() ? acc + f.cantidad : acc, 0);
                                                            const stockDisp = (p.stock || 0) - cantEnOtras;
                                                            const estaAgotado = esInv && stockDisp <= 0;

                                                            return (
                                                                <div
                                                                    key={p.id}
                                                                    onClick={() => {
                                                                        if (estaAgotado) {
                                                                            toast.error(`⚠️ "${p.nombre}" no tiene existencias disponibles.`, { position: 'bottom-center', icon: '🚫' });
                                                                            return;
                                                                        }
                                                                        const nuevas = [...filasRegistro];
                                                                        nuevas[index].descripcion = p.nombre;
                                                                        nuevas[index].valor = p.precioVenta.toString();
                                                                        nuevas[index].cantidad = esInv ? Math.min(1, stockDisp) : 1;
                                                                        setFilasRegistro(nuevas);
                                                                        setBusquedaProductoIndex(null);
                                                                        setTimeout(() => {
                                                                            agregarFila();
                                                                        }, 100);
                                                                    }}
                                                                    className={`p-3 transition-all flex justify-between items-center text-xs sm:text-sm ${
                                                                        estaAgotado 
                                                                            ? 'bg-rose-50/50 dark:bg-rose-950/20 opacity-60 cursor-not-allowed hover:bg-rose-100/60 border-l-4 border-rose-500' 
                                                                            : 'hover:bg-rose-50/80 dark:hover:bg-slate-800/80 cursor-pointer active:scale-[0.99]'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 pr-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-bold block truncate ${estaAgotado ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                                                                                {p.nombre}
                                                                            </span>
                                                                            {p.sku && (
                                                                                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                                                                                    {p.sku}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                                            {!esInv ? (
                                                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                                    🛠️ Servicio / Ilimitado
                                                                                </span>
                                                                            ) : estaAgotado ? (
                                                                                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                                    🚫 Agotado ({cantEnOtras > 0 ? `${cantEnOtras} en tu lista` : '0 disponibles'})
                                                                                </span>
                                                                            ) : stockDisp <= 5 ? (
                                                                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                                    ⚡ ¡Solo quedan {stockDisp}!
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                                                                    ✓ {stockDisp} disponibles
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className={`font-black shrink-0 ${estaAgotado ? 'text-slate-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                        ${p.precioVenta.toLocaleString('es-CO')}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-row gap-2 sm:gap-3 w-full sm:w-[240px] md:w-[270px] shrink-0">
                                                <div className="w-[90px] sm:w-[100px] md:w-[115px] shrink-0">
                                                    <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">Cant.</label>
                                                    <div className="flex items-center bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shrink-0 h-[42px] sm:h-[46px] md:h-[50px]">
                                                        <button onClick={() => actualizarCantidadFila(index, -1)} className="px-2 sm:px-2.5 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Minus size={14} /></button>
                                                        <span className="flex-1 text-center font-black text-sm sm:text-base md:text-lg text-slate-900 dark:!text-white">{fila.cantidad}</span>
                                                        <button onClick={() => actualizarCantidadFila(index, 1)} className="px-2 sm:px-2.5 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"><Plus size={14} /></button>
                                                    </div>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">Precio Unit.</label>
                                                    {(() => {
                                                        const itemInventarioRegistrado = inventario.find(p => p.nombre.trim().toLowerCase() === fila.descripcion.trim().toLowerCase());
                                                        const precioBloqueado = !puedeModificarPrecios && !!itemInventarioRegistrado;

                                                        return (
                                                            <div className="relative w-full h-[42px] sm:h-[46px] md:h-[50px] shadow-sm rounded-xl">
                                                                <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm sm:text-base">$</span>
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={formatearMonedaInput(fila.valor)}
                                                                    onChange={(e) => actualizarFila(index, 'valor', e.target.value)}
                                                                    disabled={precioBloqueado}
                                                                    title={precioBloqueado ? "Precio fijado por inventario (no editable)" : ""}
                                                                    placeholder="0"
                                                                    className={`w-full h-full pl-6 sm:pl-7 pr-2.5 border rounded-xl outline-none font-black text-sm sm:text-base md:text-lg text-right text-slate-900 dark:!text-white focus:border-rose-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal ${precioBloqueado ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-[#020617] border-slate-200 dark:border-slate-800'}`}
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* BOTONES INFERIORES: AÑADIR ARTÍCULO + APLICAR DESCUENTO */}
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={agregarFila}
                                        className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-3.5 py-2 sm:py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-sm cursor-pointer active:scale-95"
                                    >
                                        <Plus size={15} /> Añadir artículo
                                    </button>

                                    {!mostrarDescuento && puedeAplicarDescuentos && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMostrarDescuento(true);
                                                setValorDescuento('');
                                            }}
                                            className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 px-3.5 py-2 sm:py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
                                        >
                                            <Tag size={14} className="text-rose-500" />
                                            <span>+ Aplicar Descuento</span>
                                        </button>
                                    )}
                                </div>

                                {/* TARJETA DE DESCUENTO EN COLUMNA IZQUIERDA */}
                                {mostrarDescuento && puedeAplicarDescuentos && (
                                    <div className="mt-2 bg-slate-50 dark:bg-[#020617] p-2.5 sm:p-3 rounded-2xl border border-rose-300 dark:border-rose-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                                                <Tag size={12} /> Descuento:
                                            </span>
                                            <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => { setTipoDescuento('porcentaje'); setValorDescuento(''); }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${tipoDescuento === 'porcentaje' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500'}`}
                                                >
                                                    %
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setTipoDescuento('fijo'); setValorDescuento(''); }}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${tipoDescuento === 'fijo' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500'}`}
                                                >
                                                    $
                                                </button>
                                            </div>

                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={tipoDescuento === 'porcentaje' ? valorDescuento : formatearMonedaInput(valorDescuento)}
                                                onChange={(e) => {
                                                    const raw = e.target.value.replace(/\D/g, '');
                                                    if (tipoDescuento === 'porcentaje') {
                                                        setValorDescuento(raw ? String(Math.min(100, Number(raw))) : '');
                                                    } else {
                                                        setValorDescuento(raw);
                                                    }
                                                }}
                                                placeholder={tipoDescuento === 'porcentaje' ? 'Ej: 5' : '$0'}
                                                className="w-20 px-2 py-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-black text-xs text-center focus:border-rose-500 text-slate-900 dark:!text-white"
                                            />

                                            {tipoDescuento === 'porcentaje' && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {[5, 10, 15, 20].map((pct) => (
                                                        <button
                                                            key={pct}
                                                            type="button"
                                                            onClick={() => setValorDescuento(String(pct))}
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                                                valorDescuento === String(pct)
                                                                    ? 'bg-rose-600 text-white border-rose-600 font-black'
                                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            {pct}%
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                                            {montoDescuentoTotal > 0 && (
                                                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/60 px-2 py-0.5 rounded-md whitespace-nowrap">
                                                    Rebaja: -${montoDescuentoTotal.toLocaleString('es-CO')}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setMostrarDescuento(false); setValorDescuento(''); }}
                                                className="text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors whitespace-nowrap cursor-pointer"
                                            >
                                                <X size={12} /> Quitar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div ref={finalListaRef} className="h-2"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA: CLIENTE + FORMA DE PAGO + TOTAL FIJO */}
                <div className="w-full lg:w-[360px] xl:w-[380px] bg-white dark:bg-[#0f172a] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 lg:min-h-0 lg:overflow-hidden">

                    <div className="p-3 lg:p-3.5 flex flex-col gap-2.5 lg:flex-1 lg:overflow-y-auto">

                        {/* CLIENTE (OBLIGATORIO) */}
                        <div className={`flex flex-col bg-slate-50 dark:bg-[#020617] p-2.5 rounded-xl border transition-colors ${!clienteTransaccion ? 'border-rose-300 dark:border-rose-800/80 bg-rose-50/20' : 'border-slate-200 dark:border-slate-800/80'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <UserCog size={11} /> Cliente (Obligatorio)
                                </label>
                            </div>

                            {clienteTransaccion ? (
                                <div className="py-1.5 px-2.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-800/50 flex justify-between items-center shadow-sm">
                                    <div className="flex flex-col min-w-0 mr-2">
                                        <span className="font-black text-slate-900 dark:text-rose-300 text-xs truncate">{clienteTransaccion.nombre}</span>
                                        <span className="text-[10px] text-rose-600 font-bold block">Deuda actual: ${clienteTransaccion.deudaTotal?.toLocaleString('es-CO') || 0}</span>
                                    </div>
                                    <button onClick={() => setClienteTransaccion(null)} className="text-rose-500 shrink-0 hover:bg-rose-100 p-0.5 rounded-full"><X size={13} /></button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rose-400" size={13} />
                                    <input
                                        type="text"
                                        value={busquedaRegistro}
                                        onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }}
                                        onFocus={() => setMostrarResultadosBuscador(true)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (clientesFiltradosRegistro.length > 0) {
                                                    setClienteTransaccion(clientesFiltradosRegistro[0]);
                                                    setBusquedaRegistro("");
                                                    setMostrarResultadosBuscador(false);
                                                }
                                            }
                                        }}
                                        placeholder="Buscar / Crear cliente..."
                                        className="w-full pl-8 pr-2 py-1.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none focus:border-rose-500 transition-colors text-slate-900 dark:!text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:text-xs placeholder:font-normal"
                                    />

                                    {mostrarResultadosBuscador && busquedaRegistro.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <div className="max-h-40 overflow-y-auto">
                                                {clientesFiltradosRegistro.map(c => (
                                                    <div key={c.id} onClick={() => { setClienteTransaccion(c); setBusquedaRegistro(""); setMostrarResultadosBuscador(false); }} className="p-2.5 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between text-xs">
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</span><ChevronRight size={14} className="text-slate-400" />
                                                    </div>
                                                ))}
                                                {!clientesFiltradosRegistro.some(c => c.nombre.toLowerCase() === busquedaRegistro.toLowerCase()) && (
                                                    <button onClick={() => { setNombreNuevo(busquedaRegistro); setModalNuevoCliente(true); setMostrarResultadosBuscador(false); }} className="w-full text-left p-2.5 bg-rose-50 text-rose-700 text-xs font-bold">
                                                        + Crear "{busquedaRegistro}"
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 rounded-xl flex items-start gap-2">
                            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                            <p className="text-[11px] font-medium leading-relaxed">
                                El monto será asignado como deuda pendiente a la cuenta del cliente seleccionado.
                            </p>
                        </div>

                    </div>

                    {/* FOOTER FIJO EN LA PARTE INFERIOR DE LA COLUMNA DERECHA (DESKTOP) */}
                    <div className="hidden lg:flex flex-col bg-slate-900 dark:bg-black text-white px-4 py-3.5 shrink-0 border-t border-slate-800 z-30">
                        {montoDescuentoTotal > 0 && (
                            <div className="text-[10px] text-slate-400 mb-2 space-y-0.5 border-b border-slate-800 pb-2">
                                <div className="flex justify-between">
                                    <span>Subtotal bruto:</span>
                                    <span className="font-bold text-slate-300">${subtotalBruto.toLocaleString('es-CO')}</span>
                                </div>
                                <div className="flex justify-between text-rose-400">
                                    <span>Descuento ({tipoDescuento === 'porcentaje' ? `${valorDescuento}%` : 'Monto fijo'}):</span>
                                    <span className="font-bold">-${montoDescuentoTotal.toLocaleString('es-CO')}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-baseline mb-2.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monto a Fiar</span>
                            <span className="text-3xl xl:text-4xl font-black text-rose-400 leading-none">${totalFilasRegistro.toLocaleString('es-CO')}</span>
                        </div>
                        <button onClick={procesarRegistro} className={`w-full ${puedeVentaDirecta ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'} active:scale-95 text-white font-black text-base py-3 rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all cursor-pointer`}>
                            <span>{puedeVentaDirecta ? 'Fiar' : 'Enviar Orden'}</span> {puedeVentaDirecta ? <CheckCircle2 size={18} /> : <Receipt size={18} />}
                        </button>
                    </div>

                </div>
            </div>

            {/* BARRA FLOTANTE MÓVIL SUSPENDIDA */}
            <div className="lg:hidden fixed bottom-[76px] sm:bottom-[84px] left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)] z-40 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0 shrink pl-1">
                    {montoDescuentoTotal > 0 && (
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight space-y-0.5 mb-0.5">
                            <div>Subtotal: <span className="font-semibold text-slate-700 dark:text-slate-300">${subtotalBruto.toLocaleString('es-CO')}</span></div>
                            <div className="text-rose-600 dark:text-rose-400 font-bold">Dto ({tipoDescuento === 'porcentaje' ? `${valorDescuento}%` : 'fijo'}): -${montoDescuentoTotal.toLocaleString('es-CO')}</div>
                        </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto a Fiar</span>
                        <span className="text-xl sm:text-2xl font-black text-rose-500 truncate max-w-[140px] leading-none">${totalFilasRegistro.toLocaleString('es-CO')}</span>
                    </div>
                </div>
                <button onClick={procesarRegistro} className={`flex-1 ${puedeVentaDirecta ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600'} active:scale-95 text-white font-black py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center gap-2 text-base sm:text-lg transition-transform`}>
                    <span>{puedeVentaDirecta ? 'Fiar' : 'Enviar Orden'}</span> {puedeVentaDirecta ? <CheckCircle2 size={18} /> : <Receipt size={18} />}
                </button>
            </div>

            {/* MODAL DEL ESCÁNER ULTRA RÁPIDO POS */}
            {modalEscanner && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] text-white p-4 sm:p-6 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-800 flex flex-col items-center relative overflow-hidden">

                        {/* Mensaje flotante de feedback */}
                        {mensajeScaneo && (
                            <div className={`absolute top-4 left-4 right-4 z-50 p-3.5 rounded-2xl text-white font-black text-center shadow-2xl animate-in slide-in-from-top duration-200 flex items-center justify-center gap-2 ${
                                mensajeScaneo.tipo === 'exito' ? 'bg-rose-600 text-sm sm:text-base' : 'bg-slate-800 text-xs sm:text-sm text-rose-300'
                            }`}>
                                {mensajeScaneo.texto}
                            </div>
                        )}

                        {/* Cabecera del Modal */}
                        <div className="flex justify-between items-center w-full mb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                                    <QrCode size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
                                        Escáner Rápido (Fiados)
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        Apunta a los códigos QR para fiar
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setModalEscanner(false)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-full transition-colors active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Visor de Cámara con Marco POS y Línea Láser */}
                        <div className="w-full relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-800 shadow-inner">

                            {/* Elemento de video HTML5 */}
                            <div id="reader-fiar" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>

                            {/* Destello de éxito al escanear */}
                            {flashExito && (
                                <div className="absolute inset-0 bg-rose-500/40 pointer-events-none z-30 animate-in fade-in duration-100"></div>
                            )}

                            {/* Guías de encuadre */}
                            {!errorCamara && (
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                                    <div className="w-[72%] h-[72%] border-2 border-dashed border-rose-400/70 rounded-2xl relative flex items-center justify-center">
                                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-rose-400 rounded-tl-md"></div>
                                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-rose-400 rounded-tr-md"></div>
                                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-rose-400 rounded-bl-md"></div>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-rose-400 rounded-br-md"></div>

                                        {/* Línea Láser Animada con barrido vertical continuo */}
                                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_12px_#fb7185] animate-laser-sweep"></div>
                                    </div>
                                </div>
                            )}

                            {/* Estado de carga */}
                            {!camaraIniciada && !errorCamara && (
                                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2.5 z-10 p-4">
                                    <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-bold text-slate-400">Iniciando cámara trasera...</span>
                                </div>
                            )}

                            {/* Estado de error si no hay permisos */}
                            {errorCamara && (
                                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 z-10 p-6 text-center">
                                    <AlertCircle size={32} className="text-rose-500" />
                                    <p className="text-xs text-rose-300 font-bold leading-relaxed">{errorCamara}</p>
                                </div>
                            )}
                        </div>

                        {/* Resumen del último producto escaneado y total en vivo */}
                        <div className="w-full mt-3 space-y-2">
                            {ultimoProductoEscaneado ? (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between animate-in zoom-in-95 duration-150">
                                    <div className="min-w-0 flex-1">
                                        <span className="text-[10px] uppercase font-black tracking-wider text-rose-400 block">Último Agregado</span>
                                        <h5 className="font-black text-white text-xs truncate">{ultimoProductoEscaneado.nombre}</h5>
                                        <span className="text-[11px] text-slate-400 font-bold">${ultimoProductoEscaneado.precio.toLocaleString('es-CO')} c/u</span>
                                    </div>
                                    <div className="bg-rose-500 text-white font-black px-2.5 py-1 rounded-xl text-xs shrink-0 ml-2">
                                        x{ultimoProductoEscaneado.cantidad}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                                    <span className="text-[11px] text-slate-400 font-medium">Pasa los códigos frente al recuadro</span>
                                </div>
                            )}

                            {/* Botón para cerrar y volver al carrito de fiado */}
                            <button
                                onClick={() => setModalEscanner(false)}
                                className="w-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-rose-900/20"
                            >
                                <span>Listo ({filasRegistro.filter(f => f.descripcion.trim()).length} artículos • ${totalFilasRegistro.toLocaleString('es-CO')})</span>
                                <CheckCircle2 size={16} />
                            </button>
                        </div>

                    </div>
                </div>
            )}

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
                            <input 
                                type="text" 
                                value={busquedaRegistro} 
                                onChange={(e) => { setBusquedaRegistro(e.target.value); setMostrarResultadosBuscador(true); }} 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (clientesFiltradosRegistro.length > 0) {
                                            setClienteTransaccion(clientesFiltradosRegistro[0]);
                                            setBusquedaRegistro("");
                                            setMostrarResultadosBuscador(false);
                                            setModalFaltaCliente(false);
                                        }
                                    }
                                }}
                                placeholder="Buscar o crear cliente..." 
                                className="w-full p-4 pl-12 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:border-rose-500 shadow-sm" 
                            />

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

                        {modalExito.ticketDatos && (
                            <button
                                onClick={() => setModalTicketFactura({ visible: true, datos: modalExito.ticketDatos })}
                                className="w-full mb-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-lg transition-transform active:scale-95"
                            >
                                <Printer size={22} /> Imprimir Factura / Ticket
                            </button>
                        )}

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

            {/* MODAL PARA AGREGAR NUEVO VENDEDOR RÁPIDO */}
            {modalNuevoVendedor && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <User size={28} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1">
                            Agregar Vendedor
                        </h3>
                        <p className="text-xs text-slate-500 text-center mb-4">
                            Ingresa el nombre de quien atenderá ventas en esta estación.
                        </p>

                        <input
                            type="text"
                            value={nombreNuevoVendedor}
                            onChange={(e) => setNombreNuevoVendedor(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrarVendedorRapido(); } }}
                            placeholder="Ej: Laura Turno Tarde, Andrés..."
                            className="w-full p-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-rose-500 text-slate-900 dark:text-white mb-5"
                            autoFocus
                        />

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => { setModalNuevoVendedor(false); setNombreNuevoVendedor(""); }}
                                className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={registrarVendedorRapido}
                                className="py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                            >
                                <CheckCircle2 size={16} /> Guardar y Asignar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE IMPRESIÓN DE TICKET TÉRMICO */}
            <TicketFacturaModal
                isOpen={modalTicketFactura.visible}
                onClose={() => setModalTicketFactura({ visible: false, datos: null })}
                datos={modalTicketFactura.datos}
            />
        </div>
    );
}