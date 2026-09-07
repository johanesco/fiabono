"use client";
import { useState, useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { 
  X, CheckCircle2, Zap, Package, Plus, RefreshCw, Sparkles, 
  ChevronDown, ListCheck, Keyboard, QrCode, Trash2, Minus, 
  Edit2, ArrowLeft 
} from "lucide-react";
import toast from "react-hot-toast";

export interface ItemCargaInventario {
  id: string;
  esExistente?: boolean;
  productoId?: string;
  nombre: string;
  sku: string;
  stock: number;
  stockActual?: number;
  precioVenta: number;
  tipoProducto?: 'producto' | 'servicio';
  categoria?: string;
  inventariable?: boolean;
}

interface EscanerInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuentaPrincipalId: string;
  nombreUsuario?: string;
  categoriasDisponibles?: string[];
  inventario?: any[];
  productosEnCarga: ItemCargaInventario[];
  onAgregarOActualizarProducto: (producto: ItemCargaInventario) => void;
  onRemoverProducto: (id: string) => void;
  onModificarCantidad?: (id: string, delta: number) => void;
  onVolverAlFormulario: (codigoPrecargado?: string) => void;
}

export default function EscanerInventarioModal({ 
  isOpen, 
  onClose, 
  cuentaPrincipalId, 
  nombreUsuario: _nombreUsuario,
  categoriasDisponibles = ['General', 'Varios', 'Alimentos', 'Bebidas', 'Ropa', 'Calzado', 'Tecnología'],
  inventario = [],
  productosEnCarga = [],
  onAgregarOActualizarProducto,
  onRemoverProducto,
  onModificarCantidad,
  onVolverAlFormulario
}: EscanerInventarioModalProps) {
  const [modoContinuo, setModoContinuo] = useState(true);
  const [errorCamara, setErrorCamara] = useState("");
  const [camaraIniciada, setCamaraIniciada] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [flashExito, setFlashExito] = useState(false);

  // Para modo lote (manual)
  const [productoEncontrado, setProductoEncontrado] = useState<any | null>(null);
  const [cantidadManual, setCantidadManual] = useState<string>("1");

  // Entrada manual o pistola lectora USB
  const [codigoManualInput, setCodigoManualInput] = useState("");

  // Para cuando se escanea un código que NO existe (Formulario Exprés en PRIMER PLANO)
  const [codigoNoRegistrado, setCodigoNoRegistrado] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [nuevoStock, setNuevoStock] = useState("1");
  const [nuevaCategoria, setNuevaCategoria] = useState("General");
  const [mostrarDropdownCategorias, setMostrarDropdownCategorias] = useState(false);
  
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const procesandoRef = useRef(false);
  const ultimoCodigoEscaneadoRef = useRef<{codigo: string, tiempo: number} | null>(null);

  const totalProductos = productosEnCarga.length;
  const totalUnidades = productosEnCarga.reduce((acc, it) => acc + (Number(it.stock) || 0), 0);

  // Liberar físicamente la cámara
  const detenerCamaraCompleta = async () => {
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop().catch(() => {});
        }
        try {
          html5QrCodeRef.current.clear();
        } catch (e) {}
        html5QrCodeRef.current = null;
      }
    } catch (e) {}

    try {
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach((video: HTMLVideoElement) => {
        if (video && video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (e) {}
          });
          video.srcObject = null;
        }
      });
    } catch (e) {}
  };

  const iniciarCamara = async (scannerId: string, mounted: boolean) => {
    setErrorCamara("");
    setCamaraIniciada(false);

    await detenerCamaraCompleta();

    try {
      const el = document.getElementById(scannerId);
      if (!el) return;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF
      ];

      const html5Qr = new Html5Qrcode(scannerId, {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      html5QrCodeRef.current = html5Qr;

      const esMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const camaraInicial: any = esMobile ? { facingMode: "environment" } : { facingMode: "user" };

      const qrConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(edge * 0.72);
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: camaraInicial.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: "continuous"
        }
      };

      const onScanSuccess = (decodedText: string) => {
        if (mounted && !procesandoRef.current) {
          manejarCodigoEscaneado(decodedText);
        }
      };

      try {
        await html5Qr.start(camaraInicial, qrConfig, onScanSuccess, () => {});
      } catch (errPrimario) {
        await html5Qr.start({ facingMode: esMobile ? "user" : "environment" }, qrConfig, onScanSuccess, () => {});
      }

      if (mounted) {
        setCamaraIniciada(true);
      }
    } catch (err: any) {
      console.error("Error al iniciar cámara:", err);
      if (mounted) {
        setErrorCamara(
          "No se pudo acceder a la cámara. Por favor asegúrate de permitir los permisos de cámara en tu navegador."
        );
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const scannerId = "qr-reader-inbound";
    iniciarCamara(scannerId, mounted);

    return () => {
      mounted = false;
      detenerCamaraCompleta();
    };
  }, [isOpen]);

  const handleCerrarYVolverAlFormulario = async (codigoOpcional?: string) => {
    await detenerCamaraCompleta();
    onClose();
    if (onVolverAlFormulario) {
      onVolverAlFormulario(codigoOpcional);
    }
  };

  const reproducirSonidoExito = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const reproducirSonidoAlerta = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(350, ctx.currentTime); 
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  };

  const dispararFlash = () => {
    setFlashExito(true);
    setTimeout(() => setFlashExito(false), 200);
  };

  // BUSCADOR INTELIGENTE
  const buscarProductoInteligente = async (codigoBuscado: string) => {
    const cod = codigoBuscado.trim();
    const codLower = cod.toLowerCase();
    const codSinPrefijo = codLower.replace(/^(sku|ref|cod)[-_ ]*/i, '');
    const codSoloDigitos = cod.replace(/\D/g, '');

    // 1. Buscar en memoria local de inventario
    if (inventario && inventario.length > 0) {
      let match = inventario.find(p => 
        (p.codigoBarras && p.codigoBarras.trim().toLowerCase() === codLower) ||
        (p.sku && p.sku.trim().toLowerCase() === codLower) ||
        p.id === cod
      );
      if (match) return match;

      match = inventario.find(p => {
        const skuSinPref = (p.sku || '').toLowerCase().replace(/^(sku|ref|cod)[-_ ]*/i, '');
        const barSinPref = (p.codigoBarras || '').toLowerCase().replace(/^(sku|ref|cod)[-_ ]*/i, '');
        return (skuSinPref && skuSinPref === codSinPrefijo) || (barSinPref && barSinPref === codSinPrefijo);
      });
      if (match) return match;

      if (codSoloDigitos.length >= 3) {
        match = inventario.find(p => {
          const skuDig = (p.sku || '').replace(/\D/g, '');
          const barDig = (p.codigoBarras || '').replace(/\D/g, '');
          return (skuDig && skuDig === codSoloDigitos) || (barDig && barDig === codSoloDigitos);
        });
        if (match) return match;
      }
    }

    // 2. Fallback a Firestore
    const variantes = [cod, `SKU-${cod}`, `SKU${cod}`, cod.toUpperCase(), codSinPrefijo];
    for (const v of variantes) {
      if (!v) continue;
      let q = query(
        collection(db, "inventario"),
        where("usuarioId", "==", cuentaPrincipalId),
        where("codigoBarras", "==", v)
      );
      let snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        return { id: snap.docs[0].id, ...d };
      }

      q = query(
        collection(db, "inventario"),
        where("usuarioId", "==", cuentaPrincipalId),
        where("sku", "==", v)
      );
      snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0].data();
        return { id: snap.docs[0].id, ...d };
      }
    }

    return null;
  };

  // SUMAR PRODUCTO EXISTENTE AL FORMULARIO
  const agregarProductoExistenteAlFormulario = (prodData: any, cantidad: number) => {
    const item: ItemCargaInventario = {
      id: `carga_${prodData.id}`,
      esExistente: true,
      productoId: prodData.id,
      nombre: prodData.nombre,
      sku: prodData.sku || prodData.codigoBarras || '',
      stock: cantidad,
      stockActual: Number(prodData.stock) || 0,
      precioVenta: Number(prodData.precioVenta) || 0,
      tipoProducto: prodData.tipoProducto || 'producto',
      categoria: prodData.categoria || 'General',
      inventariable: prodData.inventariable !== false
    };

    onAgregarOActualizarProducto(item);
    dispararFlash();
    reproducirSonidoExito();
    toast.success(`Sumado al formulario: +${cantidad} a "${prodData.nombre}"`, { icon: '📦' });
  };

  const manejarCodigoEscaneado = async (codigo: string) => {
    const ahora = Date.now();
    const codigoLimpio = codigo.trim();
    if (!codigoLimpio) return;

    if (
      ultimoCodigoEscaneadoRef.current &&
      ultimoCodigoEscaneadoRef.current.codigo.toLowerCase() === codigoLimpio.toLowerCase() &&
      ahora - ultimoCodigoEscaneadoRef.current.tiempo < 1800
    ) {
      return;
    }
    
    ultimoCodigoEscaneadoRef.current = { codigo: codigoLimpio, tiempo: ahora };
    
    if ((!modoContinuo && productoEncontrado) || codigoNoRegistrado) return;

    procesandoRef.current = true;
    setProcesando(true);

    try {
      const prodData = await buscarProductoInteligente(codigoLimpio);

      if (!prodData) {
        reproducirSonidoAlerta();
        setCodigoNoRegistrado(codigoLimpio);
        setNuevoNombre("");
        setNuevoPrecio("");
        setNuevoStock("1");
        setNuevaCategoria("General");
        return;
      }

      if (modoContinuo) {
        agregarProductoExistenteAlFormulario(prodData, 1);
        procesandoRef.current = false;
        setProcesando(false);
      } else {
        reproducirSonidoExito();
        setProductoEncontrado(prodData);
        setCantidadManual("1");
      }

    } catch (error) {
      console.error("Error al buscar producto:", error);
      toast.error("Error al procesar el código.");
      procesandoRef.current = false;
      setProcesando(false);
    }
  };

  const confirmarCantidadManual = () => {
    if (!productoEncontrado) return;
    const cant = parseInt(cantidadManual);
    if (isNaN(cant) || cant <= 0) {
      toast.error("Ingresa una cantidad válida.");
      return;
    }
    
    agregarProductoExistenteAlFormulario(productoEncontrado, cant);
    setProductoEncontrado(null);
    setCantidadManual("1");
    setProcesando(false);
    procesandoRef.current = false;
  };

  const cancelarLote = () => {
    setProductoEncontrado(null);
    setCantidadManual("1");
    setProcesando(false);
    procesandoRef.current = false;
  };

  const agregarNuevoProductoAlFormulario = () => {
    if (!codigoNoRegistrado) return;
    if (!nuevoNombre.trim()) {
      toast.error("El nombre del producto es obligatorio.");
      return;
    }
    const precioLimpio = Number(nuevoPrecio.replace(/\D/g, '')) || 0;
    if (precioLimpio <= 0) {
      toast.error("Ingresa un precio de venta mayor a $0.");
      return;
    }
    const cantInicial = parseInt(nuevoStock) || 1;

    const nuevoItem: ItemCargaInventario = {
      id: `carga_nuevo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      esExistente: false,
      nombre: nuevoNombre.trim(),
      sku: codigoNoRegistrado,
      stock: Math.max(1, cantInicial),
      stockActual: 0,
      precioVenta: precioLimpio,
      categoria: nuevaCategoria.trim() || 'General',
      tipoProducto: 'producto',
      inventariable: true
    };

    onAgregarOActualizarProducto(nuevoItem);

    dispararFlash();
    reproducirSonidoExito();
    toast.success(`¡"${nuevoNombre.trim()}" sumado al formulario (+${cantInicial} un.)!`, { 
      icon: '✨', 
      duration: 3500 
    });

    setNuevoNombre("");
    setNuevoPrecio("");
    setNuevoStock("1");
    setNuevaCategoria("General");
    setMostrarDropdownCategorias(false);
    setCodigoNoRegistrado(null);
    procesandoRef.current = false;
    setProcesando(false);
  };

  const cancelarCodigoNoRegistrado = () => {
    setCodigoNoRegistrado(null);
    setMostrarDropdownCategorias(false);
    setProcesando(false);
    procesandoRef.current = false;
  };

  const categoriasFiltradas = categoriasDisponibles.filter(cat => 
    cat.toLowerCase().includes((nuevaCategoria || '').toLowerCase().trim())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[999] animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#0f172a] text-white p-3.5 sm:p-5 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-800 flex flex-col items-center relative my-auto max-h-[96dvh] overflow-y-auto scrollbar-none">
        
        {/* Cabecera del Modal */}
        <div className="flex justify-between items-center w-full mb-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <QrCode size={20}/>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-wide flex items-center gap-1.5">
                Escanear para el Formulario
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Todo lo que escanees entra directo al formulario
              </p>
            </div>
          </div>

          <button 
            onClick={() => handleCerrarYVolverAlFormulario()} 
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-full transition-colors active:scale-95 cursor-pointer"
            title="Volver al formulario"
          >
            <X size={18}/>
          </button>
        </div>

        {/* Selector de Modo (Continuo vs Lote) */}
        <div className="w-full shrink-0 mb-2">
          <div className="bg-slate-900/90 rounded-2xl p-1.5 flex gap-1.5 border border-slate-800">
            <button 
              onClick={() => { setModoContinuo(true); cancelarLote(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                modoContinuo ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Zap size={14}/> Continuo (+1 al formulario)
            </button>
            <button 
              onClick={() => setModoContinuo(false)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !modoContinuo ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Edit2 size={14}/> Lote (Preguntar cantidad)
            </button>
          </div>
        </div>

        {/* VISOR DE CÁMARA CUADRADO CON BARRIDO LÁSER */}
        <div className="w-full max-w-[260px] sm:max-w-[280px] relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-800 shadow-inner shrink-0">
          
          <div id="qr-reader-inbound" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>

          {flashExito && (
            <div className="absolute inset-0 bg-emerald-500/40 pointer-events-none z-30 animate-in fade-in duration-100"></div>
          )}

          {!errorCamara && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
              <div className="w-[72%] h-[72%] border-2 border-dashed border-emerald-400/70 rounded-2xl relative flex items-center justify-center">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-md"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-md"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-md"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-md"></div>
                
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-laser-sweep"></div>
              </div>
            </div>
          )}

          {!camaraIniciada && !errorCamara && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2.5 z-10 p-4">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-400">Iniciando cámara...</span>
            </div>
          )}

          {errorCamara && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-slate-950 space-y-2 z-10">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <X size={22} />
              </div>
              <p className="text-white text-xs font-bold max-w-xs">{errorCamara}</p>
              <button
                onClick={() => iniciarCamara("qr-reader-inbound", true)}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <RefreshCw size={13} /> Reintentar Conexión
              </button>
            </div>
          )}

          {/* OVERLAY: MODO LOTE */}
          {productoEncontrado && (
            <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md p-4 flex flex-col justify-between z-30 animate-in fade-in text-left">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-sm truncate">{productoEncontrado.nombre}</h3>
                    <p className="text-slate-400 text-xs">Stock actual en BD: <strong className="text-indigo-400">{productoEncontrado.stock || 0}</strong></p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">¿Cuántas unidades sumar al formulario?</label>
                  <input 
                    type="number" 
                    min="1"
                    value={cantidadManual}
                    onChange={(e) => setCantidadManual(e.target.value)}
                    className="input-dark w-full bg-[#020617] border-2 border-indigo-500 outline-none p-2.5 rounded-xl text-xl font-black text-center text-white transition-colors"
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={cancelarLote}
                  disabled={procesando}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarCantidadManual}
                  disabled={procesando}
                  className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-xs"
                >
                  {procesando ? 'Sumando...' : '➕ Sumar al Formulario'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ENTRADA MANUAL O PISTOLA LECTORA USB */}
        <div className="w-full shrink-0 mt-2">
          <div className="flex items-center justify-between mb-1 px-1">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Keyboard size={13} className="text-emerald-400" /> Ingreso manual o pistola lectora
            </label>
            <span className="text-[10px] text-slate-400">Escribe y presiona Enter</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={codigoManualInput}
                onChange={e => setCodigoManualInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && codigoManualInput.trim()) {
                    e.preventDefault();
                    manejarCodigoEscaneado(codigoManualInput.trim());
                    setCodigoManualInput('');
                  }
                }}
                placeholder="Escribe código (ej: 4921 ó 7701...)"
                className="input-dark w-full px-3.5 py-2.5 bg-slate-800 border-2 border-slate-700 focus:border-emerald-400 focus:bg-slate-900 rounded-xl text-sm font-mono font-bold text-emerald-300 placeholder:text-slate-400 outline-none transition-all shadow-inner"
                style={{ color: '#34d399', WebkitTextFillColor: '#34d399' }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (codigoManualInput.trim()) {
                  manejarCodigoEscaneado(codigoManualInput.trim());
                  setCodigoManualInput('');
                }
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Plus size={14} className="stroke-[3]" /> Sumar
            </button>
          </div>
        </div>

        {/* LISTA EN VIVO DE PRODUCTOS EN EL FORMULARIO */}
        <div className="w-full mt-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 text-left shrink-0">
          <div className="flex items-center justify-between mb-1.5 border-b border-slate-800 pb-1.5">
            <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
              <ListCheck size={14} className="text-emerald-400" />
              En el Formulario ({totalProductos} productos)
            </span>
            <span className="text-xs text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {totalUnidades} unidades en lista
            </span>
          </div>

          {productosEnCarga.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic text-center py-2">
              Apunta al código. Cada producto escaneado se sumará automáticamente a la lista del formulario.
            </p>
          ) : (
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {productosEnCarga.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-white text-xs truncate max-w-[150px] sm:max-w-[180px]">{item.nombre}</p>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        item.esExistente ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {item.esExistente ? 'Existente' : 'Nuevo'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {item.sku || 'SIN SKU'} • ${Number(item.precioVenta || 0).toLocaleString('es-CO')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => onModificarCantidad?.(item.id, -1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Restar una unidad"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="font-mono font-black text-emerald-400 text-xs px-2">
                        +{item.stock}
                      </span>
                      <button
                        type="button"
                        onClick={() => onModificarCantidad?.(item.id, 1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Sumar una unidad"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoverProducto(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Quitar del formulario"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTÓN PRINCIPAL: VOLVER AL FORMULARIO */}
        <div className="w-full mt-2.5 mb-1 shrink-0">
          <button
            type="button"
            onClick={() => handleCerrarYVolverAlFormulario()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95 transition-all"
          >
            <ArrowLeft size={16} /> Volver al Formulario ({totalProductos} productos en lista)
          </button>
        </div>

      </div>

      {/* MODAL EN PRIMER PLANO: REGISTRAR PRODUCTO NUEVO */}
      {codigoNoRegistrado && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[1050] animate-in zoom-in-95 duration-200">
          <div className="bg-[#0f172a] text-white p-5 sm:p-6 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-700 flex flex-col text-left space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
                  <Sparkles size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">Producto No Registrado</span>
                  <h3 className="font-black text-white text-base sm:text-lg">Sumar al Formulario</h3>
                </div>
              </div>
              <button 
                onClick={cancelarCodigoNoRegistrado}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              El código <strong className="font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">{codigoNoRegistrado}</strong> no existe en tu catálogo. Completa los datos básicos para sumarlo a la lista de tu formulario:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">Nombre del Producto *</label>
                <input 
                  type="text" 
                  value={nuevoNombre} 
                  onChange={e => setNuevoNombre(e.target.value)} 
                  placeholder="Ej. Desodorante Rexona Clinical" 
                  className="input-dark w-full p-3 bg-slate-900 border-2 border-slate-700 focus:border-emerald-400 rounded-xl text-sm font-bold text-white outline-none"
                  style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                  autoFocus 
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Precio Venta ($) *</label>
                  <input 
                    type="text" 
                    value={nuevoPrecio ? `$${nuevoPrecio.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : ''} 
                    onChange={e => setNuevoPrecio(e.target.value.replace(/\D/g, ''))} 
                    placeholder="$0" 
                    className="input-dark w-full p-3 bg-slate-900 border-2 border-slate-700 focus:border-emerald-400 rounded-xl text-sm font-black text-emerald-400 outline-none" 
                    style={{ color: '#34d399', WebkitTextFillColor: '#34d399' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Cantidad que llegó *</label>
                  <input 
                    type="number" 
                    min="1"
                    value={nuevoStock} 
                    onChange={e => setNuevoStock(e.target.value)} 
                    className="input-dark w-full p-3 bg-slate-900 border-2 border-slate-700 focus:border-emerald-400 rounded-xl text-sm font-black text-white outline-none text-center" 
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                  />
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 block">Categoría</label>
                  <span className="text-[10px] text-slate-400">Selecciona o escribe una nueva</span>
                </div>

                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={nuevaCategoria} 
                    onFocus={() => setMostrarDropdownCategorias(true)}
                    onChange={e => {
                      setNuevaCategoria(e.target.value);
                      setMostrarDropdownCategorias(true);
                    }} 
                    placeholder="Buscar o crear categoría..." 
                    className="input-dark w-full p-3 bg-slate-900 border-2 border-slate-700 focus:border-emerald-400 rounded-xl text-xs sm:text-sm font-bold text-white outline-none pr-8" 
                    style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarDropdownCategorias(prev => !prev)}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-white"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {mostrarDropdownCategorias && (
                  <div className="absolute left-0 right-0 top-full mt-1 max-h-36 bg-[#020617] border-2 border-slate-700 rounded-xl shadow-2xl overflow-y-auto z-50 p-1 space-y-0.5">
                    {categoriasFiltradas.map((cat, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setNuevaCategoria(cat);
                          setMostrarDropdownCategorias(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold rounded-lg hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>{cat}</span>
                        {cat === nuevaCategoria && <CheckCircle2 size={13} className="text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 mt-1.5">
                  {categoriasDisponibles.slice(0, 4).map((catRapida, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNuevaCategoria(catRapida);
                        setMostrarDropdownCategorias(false);
                      }}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        nuevaCategoria === catRapida 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' 
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {catRapida}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={agregarNuevoProductoAlFormulario}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Plus size={16} /> ⚡ Sumar al Formulario y Seguir Escaneando
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelarCodigoNoRegistrado}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleCerrarYVolverAlFormulario(codigoNoRegistrado)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  Llenar en Formulario Completo →
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
