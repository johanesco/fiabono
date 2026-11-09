"use client";
import BannerDatosLocales from "@/components/BannerDatosLocales";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { collection, getDocs, getDoc, query, doc, updateDoc, deleteDoc, where, addDoc, writeBatch, increment } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { RUBROS_NEGOCIOS, CATEGORIAS_POR_DEFECTO_GENERAL } from "@/constants/rubrosCategorias";
import { 
  Package, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  ArrowLeft, 
  FileText, 
  CheckCircle2, 
  LayoutList, 
  QrCode, Barcode, 
  ScanLine,
  Sliders,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  AlertTriangle,
  XCircle,
  DollarSign,
  Boxes,
  Layers,
  Sparkles,
  PackageX,
  PackageCheck,
  RefreshCw,
  X,
  ShoppingCart,
  Receipt,
  CheckSquare,
  Square,
  Calendar,
  Printer,
  Download,
  Maximize2,
  FileSpreadsheet,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  MoreVertical,
  Bookmark,
  Crown,
  Lock,
  ListCheck,
  Camera,
  SwitchCamera,
  Minus
} from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import EscanerInventarioModal from "@/components/EscanerInventarioModal";
import { obtenerLotesNormalizados, ajustarLotesEnEdicionManual, LoteCostoItem } from "@/utils/lotesInventario";
import { ItemTandaIngreso } from "@/types";
import { QRCodeSVG } from 'qrcode.react';
import { generarSvgCodigoBarras, generarDataUrlCodigoBarras } from '@/lib/codigoBarras';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import ModalUpsellSuscripcion from "@/components/ModalUpsellSuscripcion";
import { usePistolaLaser } from "@/hooks/usePistolaLaser";

type ColumnaOrden = 'categoria' | 'nombre' | 'sku' | 'stock' | 'precioVenta';
type DireccionOrden = 'asc' | 'desc';
type FiltroStock = 'todos' | 'en_stock' | 'stock_bajo' | 'sin_stock' | 'en_deficit' | 'servicios';
type OrigenExportacionQR = 'seleccionados' | 'fecha' | 'todos';
type FiltroFechaQR = 'hoy' | '7dias' | 'personalizado';
type TipoImpresoraQR = 'termica' | 'hoja';
type TamanoTermicoQR = '32x25' | '40x30' | '50x25' | '50x30' | '58x40' | '80x50' | 'personalizado';
type TamanoEtiquetaQR = 'compacto' | 'estandar' | 'grande';
type ModoCantidadQR = 'stock' | 'uno' | 'fijo' | 'selectivo';

export default function InventarioPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const esAdmin = datosSesion?.rol !== 'cajero';
  const puedeEditarInventario = esAdmin || datosSesion?.permisos?.editarInventario === true || datosSesion?.puedeEditarInventario === true;
  const puedeIngresarInventario = esAdmin || datosSesion?.permisos?.ingresoInventario === true;
  const moduloSepareActivo = datosSesion?.moduloSepareActivo !== false;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [inventario, setInventario] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [vistaActual, setVistaActual] = useState<'lista' | 'qr'>('lista');
  const [modalProducto, setModalProducto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Estados para Importación y Exportación a Excel
  const [modalImportarExcel, setModalImportarExcel] = useState(false);
  const [modalExportarExcel, setModalExportarExcel] = useState(false);
  const [productosAImportar, setProductosAImportar] = useState<any[]>([]);
  const [procesandoArchivoExcel, setProcesandoArchivoExcel] = useState(false);
  const [importandoAFirestore, setImportandoAFirestore] = useState(false);
  const [modoActualizacionStock, setModoActualizacionStock] = useState<'reemplazar' | 'sumar'>('reemplazar');

  // Modal de confirmación de eliminación de producto
  const [productoAEliminar, setProductoAEliminar] = useState<any | null>(null);
  const [eliminandoProducto, setEliminandoProducto] = useState(false);

  // Selección de productos para despacho a Venta / Fiado
  const [productosSeleccionados, setProductosSeleccionados] = useState<string[]>([]);

  // Estados de Ordenamiento y Filtrado con Multi-Selección
  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrden>('nombre');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');
  const [filtrosCategoria, setFiltrosCategoria] = useState<string[]>([]);
  const [filtrosStock, setFiltrosStock] = useState<('en_stock' | 'stock_bajo' | 'sin_stock' | 'en_deficit' | 'servicios')[]>([]);
  const [mostrarMetricas, setMostrarMetricas] = useState(false);
  const [menuHerramientasMovil, setMenuHerramientasMovil] = useState(false);
  const [modalUpsell, setModalUpsell] = useState<{ visible: boolean; titulo?: string; mensaje?: string; plan?: 'comercio' | 'pro' }>({
    visible: false,
    titulo: "",
    mensaje: "",
    plan: 'comercio'
  });

  // Referencias para scroll horizontal con flechas en filtros de stock y categorías
  const stockScrollRef = useRef<HTMLDivElement>(null);
  const categoriasScrollRef = useRef<HTMLDivElement>(null);

  const scrollContenedor = (ref: React.RefObject<HTMLDivElement | null>, direccion: 'left' | 'right') => {
    if (ref.current) {
      ref.current.scrollBy({
        left: direccion === 'left' ? -240 : 240,
        behavior: 'smooth'
      });
    }
  };

  // Estados para el modal de configuración de exportación QR inteligente y Térmica
  const [modalExportarQR, setModalExportarQR] = useState(false);
  const [modalEscanerInventario, setModalEscanerInventario] = useState(false);
  const [formatoCodigoEtiqueta, setFormatoCodigoEtiqueta] = useState<'barras' | 'qr'>('qr');
  const [tipoImpresoraQR, setTipoImpresoraQR] = useState<TipoImpresoraQR>('termica');
  const [tamanoTermicoQR, setTamanoTermicoQR] = useState<TamanoTermicoQR>('40x30');
  const [anchoPersonalizadoMM, setAnchoPersonalizadoMM] = useState<number>(50);
  const [altoPersonalizadoMM, setAltoPersonalizadoMM] = useState<number>(30);
  const [origenExportacion, setOrigenExportacion] = useState<OrigenExportacionQR>('todos');
  const [filtroFechaExportacion, setFiltroFechaExportacion] = useState<FiltroFechaQR>('hoy');
  const [fechaDesdePersonalizada, setFechaDesdePersonalizada] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modoCantidadQR, setModoCantidadQR] = useState<ModoCantidadQR>('stock');
  const [cantidadFijaQR, setCantidadFijaQR] = useState<number>(1);
  const [cantidadesSelectivasQR, setCantidadesSelectivasQR] = useState<Record<string, number>>({});
  const [busquedaModalSelectivoQR, setBusquedaModalSelectivoQR] = useState("");
  const [tamanoEtiqueta, setTamanoEtiqueta] = useState<TamanoEtiquetaQR>('estandar');
  const [opcionNombre, setOpcionNombre] = useState(true);
  const [opcionSku, setOpcionSku] = useState(true);
  const [opcionPrecio, setOpcionPrecio] = useState(true);
  const [opcionNegocio, setOpcionNegocio] = useState(true);
  const [opcionCategoria, setOpcionCategoria] = useState(false);
  const [opcionFechaIngreso, setOpcionFechaIngreso] = useState(false);
  const [opcionTopeRebaja, setOpcionTopeRebaja] = useState(false);
  const [modoTopeRebaja, setModoTopeRebaja] = useState<'pesos' | 'porcentaje'>('pesos');
  const [valorTopeRebaja, setValorTopeRebaja] = useState<string>('2.000');
  const [formatoTopeEtiqueta, setFormatoTopeEtiqueta] = useState<'clave_rebaja' | 'clave_minimo' | 'explicito'>('clave_rebaja');

  // Estados del Formulario de Producto
  const [nombre, setNombre] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [precioFiado, setPrecioFiado] = useState("");
  const [precioSepare, setPrecioSepare] = useState("");
  const [mostrarPreciosDiferenciados, setMostrarPreciosDiferenciados] = useState(false);
  const [costoCompra, setCostoCompra] = useState("");
  const [modoEdicionProducto, setModoEdicionProducto] = useState<'surtir' | 'editar'>('editar');
  const [cantidadSurtir, setCantidadSurtir] = useState("");
  const [proveedorEntrada, setProveedorEntrada] = useState("");
  const [lotesEnEdicion, setLotesEnEdicion] = useState<LoteCostoItem[]>([]);
  const [loteSeleccionadoIdx, setLoteSeleccionadoIdx] = useState<number>(0);
  
  // Estados para Fotos del Producto
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [modalCamaraEnVivo, setModalCamaraEnVivo] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [flashEfecto, setFlashEfecto] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [iniciandoCamara, setIniciandoCamara] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fotoLightbox, setFotoLightbox] = useState<string | null>(null);
  const [tipoProducto, setTipoProducto] = useState<'producto' | 'servicio'>('producto');
  const [categoria, setCategoria] = useState('');
  const [inventariable, setInventariable] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [categoriaFoco, setCategoriaFoco] = useState(false);
  const [gestionCategoriasHabilitada, setGestionCategoriasHabilitada] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<string | null>(null);
  const [nombreCategoriaEditada, setNombreCategoriaEditada] = useState('');
  const [mensajeCategoria, setMensajeCategoria] = useState<{ tipo: 'success' | 'danger' | 'info'; titulo: string; detalle: string } | null>(null);
  const [productosEnCarga, setProductosEnCarga] = useState<any[]>([]);
  const [modalConfirmarDescarteCarga, setModalConfirmarDescarteCarga] = useState(false);
  const [productoRecienGuardadoId, setProductoRecienGuardadoId] = useState<string | null>(null);
  const [busquedaModalInventario, setBusquedaModalInventario] = useState("");
  const [filtroStockModal, setFiltroStockModal] = useState<'todos' | 'en_stock' | 'bajo_stock' | 'sin_stock'>('todos');
  const [tabMovilModal, setTabMovilModal] = useState<'formulario' | 'lista'>('formulario');
  const [errores, setErrores] = useState({ nombre: '', categoria: '', stock: '', precio: '' });
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('fiabono_rubro_negocio');
        if (local) {
          const rubro = RUBROS_NEGOCIOS.find(r => r.id === local);
          if (rubro) return rubro.categorias;
        }
      } catch (e) {}
    }
    return CATEGORIAS_POR_DEFECTO_GENERAL;
  });

  const [modalGestionCategorias, setModalGestionCategorias] = useState(false);
  const [busquedaCategoriasModal, setBusquedaCategoriasModal] = useState('');
  const [nuevaCatModalInput, setNuevaCatModalInput] = useState('');
  const [categoriaEditandoModal, setCategoriaEditandoModal] = useState<string | null>(null);
  const [nuevoNombreCatModal, setNuevoNombreCatModal] = useState('');
  const [guardandoCatModal, setGuardandoCatModal] = useState(false);
  const [categoriaAEliminarConfirm, setCategoriaAEliminarConfirm] = useState<{ nombre: string; conteoProds: number } | null>(null);

  const [limiteRender, setLimiteRender] = useState(20);

  const persistirCategoriasEnFirestore = async (nuevasCategorias: string[]) => {
    try {
      if (typeof window !== 'undefined' && cuentaPrincipalId) {
        localStorage.setItem(`fiabono_categorias_${cuentaPrincipalId}`, JSON.stringify(nuevasCategorias));
      }
      if (cuentaPrincipalId) {
        await updateDoc(doc(db, "usuarios", cuentaPrincipalId), {
          categoriasPersonalizadas: nuevasCategorias
        });
      }
    } catch (err) {
      console.warn("No se pudo sincronizar categorías en Firestore:", err);
    }
  };

  // Recuperar borrador de productos en carga al iniciar sesión
  useEffect(() => {
    if (cuentaPrincipalId && typeof window !== 'undefined') {
      try {
        const guardado = sessionStorage.getItem(`fiabono_productos_en_carga_${cuentaPrincipalId}`);
        if (guardado) {
          const items = JSON.parse(guardado);
          if (Array.isArray(items) && items.length > 0) {
            setProductosEnCarga(items);
          }
        }
      } catch (e) {}
    }
  }, [cuentaPrincipalId]);

  // Respaldar en sessionStorage automáticamente al haber cambios en la lista
  useEffect(() => {
    if (cuentaPrincipalId && typeof window !== 'undefined') {
      try {
        if (productosEnCarga.length > 0) {
          sessionStorage.setItem(`fiabono_productos_en_carga_${cuentaPrincipalId}`, JSON.stringify(productosEnCarga));
        } else {
          sessionStorage.removeItem(`fiabono_productos_en_carga_${cuentaPrincipalId}`);
        }
      } catch (e) {}
    }
  }, [productosEnCarga, cuentaPrincipalId]);

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarInventario(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  useEffect(() => {
    setLimiteRender(20);
  }, [busqueda, filtrosCategoria, filtrosStock]);

  // Cierre táctil inmediato al tocar fuera del selector de categorías en móvil/tablet
  useEffect(() => {
    if (!categoriaFoco) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.selector-categoria-container')) {
        setCategoriaFoco(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [categoriaFoco]);

  // Manejo de teclado para Lightbox de Fotos (Escape)
  useEffect(() => {
    if (!fotoLightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFotoLightbox(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fotoLightbox]);

  const cargarInventario = async (uid?: string | null, reintento = 0) => {
    if (!uid) return;
    try {
      setCargando(true);

      // 1. Cargar configuración de categorías personalizadas o rubro del usuario
      let categoriasBase: string[] = [];
      try {
        const userDoc = await getDoc(doc(db, "usuarios", uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          if (Array.isArray(uData.categoriasPersonalizadas) && uData.categoriasPersonalizadas.length > 0) {
            categoriasBase = uData.categoriasPersonalizadas;
          } else if (uData.rubroNegocio) {
            const rubro = RUBROS_NEGOCIOS.find(r => r.id === uData.rubroNegocio);
            if (rubro) categoriasBase = rubro.categorias;
          }
        }
      } catch (e) {}

      if (categoriasBase.length === 0 && typeof window !== 'undefined') {
        const local = localStorage.getItem(`fiabono_categorias_${uid}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) categoriasBase = parsed;
          } catch(e) {}
        }
      }

      if (categoriasBase.length === 0) {
        categoriasBase = CATEGORIAS_POR_DEFECTO_GENERAL;
      }

      const q = query(collection(db, "inventario"), where("usuarioId", "==", uid));
      const snap = await getDocs(q);
      const lista: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.activo !== false) lista.push({ id: doc.id, ...data });
      });
      setInventario(lista);

      // Sincronizar categorías dinámicas presentes en el inventario real
      const categoriasPresentes = lista
        .map((p) => (p.categoria || '').trim())
        .filter(Boolean);

      setCategoriasDisponibles([...new Set([...categoriasBase, ...categoriasPresentes])].sort((a, b) =>
        a.localeCompare(b, 'es')
      ));
    } catch (error: any) {
      console.error("Error cargando inventario:", error);
      if (reintento === 0) {
        setTimeout(() => {
          if (uid) cargarInventario(uid, 1);
        }, 1000);
      } else {
        toast.error("No se pudo cargar el inventario. Por favor recarga la página.");
      }
    } finally {
      setCargando(false);
    }
  };

  const normalizarCategoria = (valor: string | undefined) => {
    const texto = (valor || 'General').trim();
    if (!texto) return 'General';
    const sinPrefijo = texto.replace(/^\d+\s+/, '');
    return sinPrefijo || 'General';
  };

  // Métricas calculadas del Inventario
  const metricas = useMemo(() => {
    const totalProductos = inventario.length;
    const unidadesFisicasTotales = inventario.reduce((acc, p) => 
      acc + (p.inventariable !== false && p.tipoProducto !== 'servicio' ? Math.max(0, Number(p.stock) || 0) : 0), 0
    );
    const valorTotal = inventario.reduce((acc, p) => 
      acc + (p.inventariable !== false && p.tipoProducto !== 'servicio' ? Math.max(0, Number(p.stock) || 0) * (Number(p.precioVenta) || 0) : 0), 0
    );
    const totalServicios = inventario.filter(p => p.tipoProducto === 'servicio' || p.inventariable === false).length;
    const stockBajo = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) > 0 && Number(p.stock) <= 5).length;
    const sinStock = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) === 0).length;
    const enDeficit = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) < 0).length;
    const enStock = inventario.filter(p => (p.inventariable !== false && p.tipoProducto !== 'servicio') && Number(p.stock) > 0).length;

    return {
      totalProductos,
      unidadesFisicasTotales,
      valorTotal,
      totalServicios,
      stockBajo,
      sinStock,
      enDeficit,
      enStock
    };
  }, [inventario]);

  // Lista de categorías únicas presentes en los productos
  const categoriasPresentes = useMemo(() => {
    const setCat = new Set<string>();
    inventario.forEach(p => {
      setCat.add(normalizarCategoria(p.categoria));
    });
    return Array.from(setCat).sort((a, b) => a.localeCompare(b, 'es'));
  }, [inventario]);

  // Lista filtrada en tiempo real para el catálogo dentro del modal expandido
  const productosFiltradosModal = useMemo(() => {
    return inventario.filter((prod) => {
      if (busquedaModalInventario.trim()) {
        const q = busquedaModalInventario.toLowerCase().trim();
        const coincideNombre = (prod.nombre || "").toLowerCase().includes(q);
        const coincideSku = (prod.sku || "").toLowerCase().includes(q);
        const coincideCat = (prod.categoria || "").toLowerCase().includes(q);
        if (!coincideNombre && !coincideSku && !coincideCat) return false;
      }
      if (filtroStockModal === 'en_stock') {
        return prod.tipoProducto === 'servicio' || (Number(prod.stock) > 0);
      }
      if (filtroStockModal === 'bajo_stock') {
        return prod.tipoProducto !== 'servicio' && prod.inventariable !== false && Number(prod.stock) > 0 && Number(prod.stock) <= 5;
      }
      if (filtroStockModal === 'sin_stock') {
        return prod.tipoProducto !== 'servicio' && prod.inventariable !== false && Number(prod.stock) <= 0;
      }
      return true;
    });
  }, [inventario, busquedaModalInventario, filtroStockModal]);

  // Helper para validar si un producto se puede vender/fiar (también permite despacho en déficit cuando se tiene físico en mano)
  const tieneStockDisponible = (_prod: any) => {
    return true;
  };

  // Despacho directo a Venta, Fiado o Separe
  const despacharAVenta = (productos: any[]) => {
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Selecciona al menos un producto para vender.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(Number(p.precioFiado) > 0 ? p.precioFiado : (p.precioVenta || 0)),
      cantidad: 1,
      idProducto: p.id,
      fotoUrl: p.imagen || p.imagenUrl || p.foto || p.fotoUrl || null
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    sessionStorage.setItem('fiabono_origen_despacho', '/dashboard/inventario');
    router.push('/dashboard/vender');
  };

  const despacharAFiar = (productos: any[]) => {
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Selecciona al menos un producto para fiar.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(Number(p.precioSepare) > 0 ? p.precioSepare : (p.precioVenta || 0)),
      cantidad: 1,
      idProducto: p.id,
      fotoUrl: p.imagen || p.imagenUrl || p.foto || p.fotoUrl || null
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    sessionStorage.setItem('fiabono_origen_despacho', '/dashboard/inventario');
    router.push('/dashboard/fiar');
  };

  const despacharASepare = (productos: any[]) => {
    if (!datosSesion?.esPro) {
      setModalUpsell({
        visible: true,
        titulo: "Plan Separe Exclusivo PRO Almacén",
        mensaje: "Aparta mercancía de tus clientes, recibe abonos parciales y gestiona fechas límite con el Plan PRO Almacén.",
        plan: 'pro'
      });
      return;
    }
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Selecciona al menos un producto para separar.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(p.precioVenta || 0),
      cantidad: 1,
      idProducto: p.id,
      fotoUrl: p.imagen || p.imagenUrl || p.foto || p.fotoUrl || null
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    sessionStorage.setItem('fiabono_origen_despacho', '/dashboard/inventario');
    router.push('/dashboard/separe');
  };

  const toggleSeleccionProducto = (prod: any) => {
    setProductosSeleccionados(prev => 
      prev.includes(prod.id) ? prev.filter(item => item !== prod.id) : [...prev, prod.id]
    );
  };

  // Funciones de Multi-Selección de Filtros
  const toggleFiltroStock = (tipo: 'en_stock' | 'stock_bajo' | 'sin_stock' | 'en_deficit' | 'servicios') => {
    setFiltrosStock(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };

  const limpiarFiltroStock = () => {
    setFiltrosStock([]);
  };

  const toggleFiltroCategoria = (cat: string) => {
    const catNorm = cat.toLowerCase();
    setFiltrosCategoria(prev => prev.includes(catNorm) ? prev.filter(c => c !== catNorm) : [...prev, catNorm]);
  };

  const limpiarFiltroCategoria = () => {
    setFiltrosCategoria([]);
  };

  const limpiarTodosLosFiltros = () => {
    setBusqueda("");
    setFiltrosStock([]);
    setFiltrosCategoria([]);
  };

  // Función para alternar el ordenamiento de columnas
  const handleSort = (col: ColumnaOrden) => {
    if (columnaOrden === col) {
      setDireccionOrden(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setColumnaOrden(col);
      setDireccionOrden('asc');
    }
  };

  // Pipeline de Filtrado y Ordenamiento Multi-Criterio
  const inventarioProcesado = useMemo(() => {
    let resultado = [...inventario];

    // 1. Filtro por texto de búsqueda (nombre, sku, código de barras, categoría) insensible a tildes
    if (busqueda.trim()) {
      const normalizar = (str: string) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const q = normalizar(busqueda.trim());
      resultado = resultado.filter(p =>
        normalizar(p.nombre || '').includes(q) ||
        normalizar(p.sku || '').includes(q) ||
        normalizar(p.codigoBarras || '').includes(q) ||
        normalizar(normalizarCategoria(p.categoria)).includes(q)
      );
    }

    // 2. Filtro por Categorías (Multi-selección OR)
    if (filtrosCategoria.length > 0) {
      resultado = resultado.filter(p => 
        filtrosCategoria.includes(normalizarCategoria(p.categoria).toLowerCase())
      );
    }

    // 3. Filtro por Estado de Stock / Tipo (Multi-selección OR)
    if (filtrosStock.length > 0) {
      resultado = resultado.filter(p => {
        const esServicio = p.tipoProducto === 'servicio' || p.inventariable === false;
        const cant = Number(p.stock) || 0;

        return filtrosStock.some(filtro => {
          if (filtro === 'servicios') return esServicio;
          if (filtro === 'en_stock') return !esServicio && cant > 0;
          if (filtro === 'stock_bajo') return !esServicio && cant > 0 && cant <= 5;
          if (filtro === 'sin_stock') return !esServicio && cant === 0;
          if (filtro === 'en_deficit') return !esServicio && cant < 0;
          return false;
        });
      });
    }

    // 4. Ordenamiento por Columna
    resultado.sort((a, b) => {
      let valorA: any = '';
      let valorB: any = '';

      switch (columnaOrden) {
        case 'categoria':
          valorA = normalizarCategoria(a.categoria).toLowerCase();
          valorB = normalizarCategoria(b.categoria).toLowerCase();
          return direccionOrden === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
        case 'nombre':
          valorA = (a.nombre || '').toLowerCase();
          valorB = (b.nombre || '').toLowerCase();
          return direccionOrden === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
        case 'sku':
          valorA = (a.sku || '').toLowerCase();
          valorB = (b.sku || '').toLowerCase();
          return direccionOrden === 'asc' ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
        case 'stock':
          valorA = Number(a.stock) || 0;
          valorB = Number(b.stock) || 0;
          return direccionOrden === 'asc' ? valorA - valorB : valorB - valorA;
        case 'precioVenta':
          valorA = Number(a.precioVenta) || 0;
          valorB = Number(b.precioVenta) || 0;
          return direccionOrden === 'asc' ? valorA - valorB : valorB - valorA;
        default:
          return 0;
      }
    });

    return resultado;
  }, [inventario, busqueda, filtrosCategoria, filtrosStock, columnaOrden, direccionOrden]);

  // Productos con stock disponibles visibles en la vista actual
  const productosDisponiblesVisibles = useMemo(() => {
    return inventarioProcesado.filter(tieneStockDisponible);
  }, [inventarioProcesado]);

  const toggleSeleccionarTodos = () => {
    if (inventarioProcesado.length === 0) {
      toast.error("No hay productos visibles en esta vista.");
      return;
    }
    const todosVisiblesSeleccionados = inventarioProcesado.every(p => productosSeleccionados.includes(p.id));
    if (todosVisiblesSeleccionados) {
      setProductosSeleccionados([]);
    } else {
      setProductosSeleccionados(inventarioProcesado.map(p => p.id));
      toast.success(`${inventarioProcesado.length} productos seleccionados`);
    }
  };

  // Objetos y monto total de los productos seleccionados para despacho
  const productosSeleccionadosObj = useMemo(() => {
    return inventario.filter(p => productosSeleccionados.includes(p.id));
  }, [inventario, productosSeleccionados]);

  const montoTotalSeleccionado = useMemo(() => {
    return productosSeleccionadosObj.reduce((acc, p) => acc + (Number(p.precioVenta) || 0), 0);
  }, [productosSeleccionadosObj]);

  // Lista calculada de productos para la exportación de etiquetas QR
  const productosParaExportarQR = useMemo(() => {
    if (origenExportacion === 'seleccionados') {
      return inventario.filter(p => productosSeleccionados.includes(p.id));
    }
    
    if (origenExportacion === 'fecha') {
      const ahora = new Date();
      let fechaLimite: Date;

      if (filtroFechaExportacion === 'hoy') {
        fechaLimite = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
      } else if (filtroFechaExportacion === '7dias') {
        fechaLimite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fechaLimite.setHours(0, 0, 0, 0);
      } else {
        // personalizado
        const partes = (fechaDesdePersonalizada || '').split('-').map(Number);
        if (partes.length === 3 && !isNaN(partes[0])) {
          fechaLimite = new Date(partes[0], partes[1] - 1, partes[2], 0, 0, 0);
        } else {
          fechaLimite = new Date(0);
        }
      }

      return inventario.filter(prod => {
        if (!prod.fechaCreacion) return true;
        const fechaProd = typeof prod.fechaCreacion.toDate === 'function' 
          ? prod.fechaCreacion.toDate() 
          : new Date(prod.fechaCreacion);
        return fechaProd >= fechaLimite;
      });
    }

    // 'todos': usa los productos filtrados actualmente en la tabla
    return inventarioProcesado;
  }, [origenExportacion, filtroFechaExportacion, fechaDesdePersonalizada, inventario, productosSeleccionados, inventarioProcesado]);

  // Cantidad total de etiquetas calculadas para el PDF
  const totalEtiquetasCalculadas = useMemo(() => {
    if (modoCantidadQR === 'uno') {
      return productosParaExportarQR.length;
    }
    if (modoCantidadQR === 'fijo') {
      return productosParaExportarQR.length * Math.max(1, cantidadFijaQR);
    }
    if (modoCantidadQR === 'selectivo') {
      return productosParaExportarQR.reduce((acc, p) => {
        const cant = cantidadesSelectivasQR[p.id] !== undefined 
          ? cantidadesSelectivasQR[p.id] 
          : (Number(p.stock) > 0 ? Number(p.stock) : 1);
        return acc + Math.max(0, cant);
      }, 0);
    }
    // modo 'stock'
    return productosParaExportarQR.reduce((acc, p) => {
      const cant = Number(p.stock) > 0 ? Number(p.stock) : 1;
      return acc + cant;
    }, 0);
  }, [productosParaExportarQR, modoCantidadQR, cantidadFijaQR, cantidadesSelectivasQR]);

  const actualizarCantidadSelectiva = (productoId: string, delta: number) => {
    setCantidadesSelectivasQR(prev => {
      const actual = prev[productoId] !== undefined 
        ? prev[productoId] 
        : (Number(inventario.find(p => p.id === productoId)?.stock) > 0 ? Number(inventario.find(p => p.id === productoId)?.stock) : 1);
      const nueva = Math.max(0, actual + delta);
      return { ...prev, [productoId]: nueva };
    });
  };

  const fijarCantidadSelectiva = (productoId: string, valor: number) => {
    setCantidadesSelectivasQR(prev => ({
      ...prev,
      [productoId]: Math.max(0, valor)
    }));
  };

  const agregarProductoALaCarga = () => {
    if (datosSesion?.esGratis && (inventario.length + productosEnCarga.length) >= 30) {
      setModalUpsell({
        visible: true,
        titulo: "Límite de 30 Productos Alcanzado",
        mensaje: "El Plan Gratuito te permite registrar hasta 30 productos en catálogo. Pásate al Plan Comercio para tener inventario ILIMITADO.",
        plan: 'comercio'
      });
      return;
    }

    const erroresNuevos = {
      nombre: '',
      categoria: '',
      stock: '',
      precio: ''
    };

    const esInventariable = tipoProducto === 'producto' && inventariable;

    if (!nombre.trim()) erroresNuevos.nombre = 'El nombre del producto es obligatorio.';
    const catFinalCarga = categoria.trim() || 'General';
    if (!categoriasDisponibles.some(item => item.toLowerCase() === catFinalCarga.toLowerCase())) {
      const nuevasCats = [...new Set([...categoriasDisponibles, catFinalCarga])];
      setCategoriasDisponibles(nuevasCats);
      void persistirCategoriasEnFirestore(nuevasCats);
    }
    if (esInventariable && stock.trim() === '') erroresNuevos.stock = 'El stock es obligatorio para productos físicos.';
    if (!precioVenta) erroresNuevos.precio = 'El precio de venta es obligatorio.';

    setErrores(erroresNuevos);

    if (erroresNuevos.nombre || erroresNuevos.categoria || erroresNuevos.stock || erroresNuevos.precio) {
      const primerError = erroresNuevos.nombre || erroresNuevos.precio || erroresNuevos.stock || erroresNuevos.categoria;
      toast.error(primerError);
      return;
    }

    const skuLimpio = sku.trim().toUpperCase();
    const skuNormalizado = skuLimpio.replace(/^(SKU|REF|COD)[-_ ]*/i, '');

    // Buscar si ya existe en catálogo
    const prodExistente = inventario.find(p => {
      const pSku = (p.sku || '').trim().toUpperCase();
      const pBar = (p.codigoBarras || '').trim().toUpperCase();
      const pSkuNorm = pSku.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
      const pBarNorm = pBar.replace(/^(SKU|REF|COD)[-_ ]*/i, '');

      return (
        (skuLimpio && (pSku === skuLimpio || pBar === skuLimpio)) ||
        (skuNormalizado && (pSkuNorm === skuNormalizado || pBarNorm === skuNormalizado)) ||
        (nombre.trim().toLowerCase() === p.nombre.trim().toLowerCase())
      );
    });

    const cantAgregada = esInventariable ? Math.max(1, Number(stock) || 1) : 0;

    if (prodExistente) {
      // Si el producto ya existe en inventario, se agrega como existente
      agregarOActualizarProductoEnCarga({
        id: `carga_${prodExistente.id}`,
        esExistente: true,
        productoId: prodExistente.id,
        nombre: prodExistente.nombre,
        sku: prodExistente.sku || prodExistente.codigoBarras || skuLimpio,
        stock: cantAgregada,
        precioVenta: Number(precioVenta.replace(/\D/g, '')) || prodExistente.precioVenta || 0,
        precioFiado: precioFiado.trim() ? (Number(precioFiado.replace(/\D/g, '')) || null) : (prodExistente.precioFiado || null),
        precioSepare: precioSepare.trim() ? (Number(precioSepare.replace(/\D/g, '')) || null) : (prodExistente.precioSepare || null),
        costoCompra: Number(costoCompra.replace(/\D/g, '')) || prodExistente.costoCompra || 0,
        tipoProducto: prodExistente.tipoProducto || tipoProducto,
        categoria: catFinalCarga || prodExistente.categoria || 'General',
        inventariable: prodExistente.inventariable !== false,
        imagen: imagenUrl || prodExistente.imagen || null,
        ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {}),
        enCarga: true,
      });
      toast.success(`"${prodExistente.nombre}" sumado a la cola (+${cantAgregada} un.) • Ver en pestaña "Cola"`, { duration: 3500 });
    } else {
      const productoTmp = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        esExistente: false,
        nombre: nombre.trim(),
        sku: (skuLimpio || `SKU-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase(),
        stock: esInventariable ? Math.max(0, Number(stock) || 0) : 0,
        precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
        precioFiado: precioFiado.trim() ? (Number(precioFiado.replace(/\D/g, '')) || null) : null,
        precioSepare: precioSepare.trim() ? (Number(precioSepare.replace(/\D/g, '')) || null) : null,
        costoCompra: Number(costoCompra.replace(/\D/g, '')) || 0,
        tipoProducto,
        categoria: catFinalCarga,
        inventariable: esInventariable,
        imagen: imagenUrl || null,
        ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {}),
        enCarga: true,
      };

      agregarOActualizarProductoEnCarga(productoTmp);
      toast.success(`"${nombre.trim()}" encolado (+${cantAgregada} un.) • Ver en pestaña "Cola"`, { duration: 3500 });
    }

    setNombre('');
    setSku('');
    setStock('');
    setPrecioVenta('');
    setPrecioFiado('');
    setPrecioSepare('');
    setMostrarPreciosDiferenciados(false);
    setCostoCompra('');
    setProveedorEntrada('');
    setCategoria('');
    setImagenUrl(null);
    setErrores({ nombre: '', categoria: '', stock: '', precio: '' });
  };

  const agregarOActualizarProductoEnCarga = (prod: any) => {
    if (prod.categoria && typeof prod.categoria === 'string') {
      const catLimpia = prod.categoria.trim();
      if (catLimpia && !categoriasDisponibles.some(item => item.toLowerCase() === catLimpia.toLowerCase())) {
        const nuevasCats = [...new Set([...categoriasDisponibles, catLimpia])];
        setCategoriasDisponibles(nuevasCats);
        void persistirCategoriasEnFirestore(nuevasCats);
      }
    }

    setProductosEnCarga(prev => {
      const skuProd = (prod.sku || '').trim().toLowerCase();
      const nombreProd = (prod.nombre || '').trim().toLowerCase();
      const index = prev.findIndex(p =>
        (prod.esExistente && prod.productoId && p.esExistente && p.productoId === prod.productoId) ||
        (p.id === prod.id) ||
        (skuProd && (p.sku || '').trim().toLowerCase() === skuProd) ||
        (!prod.esExistente && !p.esExistente && nombreProd && (p.nombre || '').trim().toLowerCase() === nombreProd)
      );
      if (index >= 0) {
        const copia = [...prev];
        copia[index] = {
          ...copia[index],
          stock: (Number(copia[index].stock) || 0) + (Number(prod.stock) || 1),
          precioVenta: Number(prod.precioVenta) > 0 ? Number(prod.precioVenta) : copia[index].precioVenta,
          precioFiado: prod.precioFiado !== undefined ? prod.precioFiado : copia[index].precioFiado,
          precioSepare: prod.precioSepare !== undefined ? prod.precioSepare : copia[index].precioSepare,
          costoCompra: Number(prod.costoCompra) > 0 ? Number(prod.costoCompra) : copia[index].costoCompra,
          categoria: prod.categoria || copia[index].categoria,
          imagen: prod.imagen || copia[index].imagen,
          proveedor: prod.proveedor || copia[index].proveedor,
        };
        return copia;
      }
      return [prod, ...prev];
    });
  };

  const modificarCantidadProductoEnCarga = (id: string, delta: number) => {
    setProductosEnCarga(prev => {
      return prev.map(p => {
        if (p.id === id) {
          const nuevaCant = Math.max(1, (Number(p.stock) || 0) + delta);
          return { ...p, stock: nuevaCant };
        }
        return p;
      });
    });
  };

  const quitarProductoEnCarga = (id: string) => {
    setProductosEnCarga(prev => prev.filter(p => p.id !== id));
  };

  const descartarCargaCompleta = () => {
    setProductosEnCarga([]);
    if (typeof window !== 'undefined' && cuentaPrincipalId) {
      sessionStorage.removeItem(`fiabono_productos_en_carga_${cuentaPrincipalId}`);
    }
    limpiarFormulario();
    setModalConfirmarDescarteCarga(false);
    setModalProducto(false);
    toast.success("Lista de productos descartada. El inventario se mantuvo intacto.");
  };

  const crearProductoDesdeFormulario = () => {
    const skuLimpio = (sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    const skuNormalizado = skuLimpio.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
    const esInventariable = tipoProducto === 'producto' && inventariable;
    const cantStock = esInventariable ? Math.max(0, Number(stock) || 0) : 0;

    // Verificar si ya existe en el inventario para sumar stock en lugar de duplicar el producto
    const prodExistente = inventario.find(p => {
      const pSku = (p.sku || '').trim().toUpperCase();
      const pBar = (p.codigoBarras || '').trim().toUpperCase();
      const pSkuNorm = pSku.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
      const pBarNorm = pBar.replace(/^(SKU|REF|COD)[-_ ]*/i, '');

      return (
        (sku.trim() && (pSku === skuLimpio || pBar === skuLimpio)) ||
        (sku.trim() && skuNormalizado && (pSkuNorm === skuNormalizado || pBarNorm === skuNormalizado)) ||
        (nombre.trim().toLowerCase() === (p.nombre || '').trim().toLowerCase())
      );
    });

    if (prodExistente) {
      return {
        id: `carga_${prodExistente.id}`,
        esExistente: true,
        productoId: prodExistente.id,
        nombre: prodExistente.nombre,
        sku: prodExistente.sku || prodExistente.codigoBarras || skuLimpio,
        stock: cantStock,
        precioVenta: Number(precioVenta.replace(/\D/g, '')) || prodExistente.precioVenta || 0,
        precioFiado: precioFiado.trim() ? (Number(precioFiado.replace(/\D/g, '')) || null) : (prodExistente.precioFiado || null),
        precioSepare: precioSepare.trim() ? (Number(precioSepare.replace(/\D/g, '')) || null) : (prodExistente.precioSepare || null),
        costoCompra: Number(costoCompra.replace(/\D/g, '')) || prodExistente.costoCompra || 0,
        tipoProducto: prodExistente.tipoProducto || tipoProducto,
        categoria: categoria.trim() || prodExistente.categoria || 'General',
        inventariable: prodExistente.inventariable !== false,
        imagen: imagenUrl || prodExistente.imagen || null,
        ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {}),
      };
    }

    return {
      usuarioId: cuentaPrincipalId,
      esExistente: false,
      nombre: nombre.trim(),
      sku: skuLimpio,
      codigoBarras: skuLimpio,
      stock: cantStock,
      precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
      precioFiado: precioFiado.trim() ? (Number(precioFiado.replace(/\D/g, '')) || null) : null,
      precioSepare: precioSepare.trim() ? (Number(precioSepare.replace(/\D/g, '')) || null) : null,
      costoCompra: Number(costoCompra.replace(/\D/g, '')) || 0,
      tipoProducto,
      categoria: (categoria.trim() || 'General'),
      inventariable: esInventariable,
      imagen: imagenUrl || null,
      ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {}),
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };
  };

  const guardarProductosEnCarga = async (productos: any[] = productosEnCarga) => {
    if (!productos.length) return 0;

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sesión inválida.');

    let totalProcesados = 0;
    const TAMANO_LOTE = 200;
    for (let i = 0; i < productos.length; i += TAMANO_LOTE) {
      const lote = productos.slice(i, i + TAMANO_LOTE);
      const respuesta = await fetch('/api/inventario/recibir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productos: lote })
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo registrar la recepción.');
      totalProcesados += Number(resultado.actualizados || 0) + Number(resultado.creados || 0);
    }

    setProductosEnCarga([]);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`fiabono_productos_en_carga_${cuentaPrincipalId}`);
    }
    return totalProcesados;
  };

  const guardarProducto = async (cerrarAlFinal: boolean = true) => {
    const hayProductosEnCola = !editandoId && productosEnCarga.length > 0;
    const formularioTieneDatos = Boolean(nombre.trim() || precioVenta || (tipoProducto === 'producto' && stock.trim() !== ''));

    // Si NO hay productos en cola O el usuario está editando O el formulario superior tiene algún dato ingresado, validamos el formulario
    if (!hayProductosEnCola || formularioTieneDatos) {
      const erroresNuevos = {
        nombre: '',
        categoria: '',
        stock: '',
        precio: ''
      };

      const esInventariable = tipoProducto === 'producto' && inventariable;

      if (!nombre.trim()) erroresNuevos.nombre = 'El nombre del producto es obligatorio.';
      if (!categoria.trim()) {
        setCategoria('General');
      } else if (!categoriasDisponibles.some(item => item.toLowerCase() === categoria.trim().toLowerCase())) {
        const nuevasCats = [...new Set([...categoriasDisponibles, categoria.trim()])];
        setCategoriasDisponibles(nuevasCats);
        void persistirCategoriasEnFirestore(nuevasCats);
      }
      if (esInventariable && stock.trim() === '') erroresNuevos.stock = 'El stock es obligatorio para productos físicos.';
      if (!precioVenta) erroresNuevos.precio = 'El precio de venta es obligatorio.';

      // Si hay errores en el formulario y no hay productos en cola, o si el usuario escribió un nombre y tiene errores:
      if (erroresNuevos.nombre || erroresNuevos.categoria || erroresNuevos.stock || erroresNuevos.precio) {
        if (!hayProductosEnCola || nombre.trim()) {
          setErrores(erroresNuevos);
          const primerError = erroresNuevos.nombre || erroresNuevos.precio || erroresNuevos.stock || erroresNuevos.categoria;
          toast.error(primerError);
          return;
        }
      }
    }

    // Validación de límite para Plan Gratuito (máximo 30 productos)
    if (!editandoId && datosSesion?.esGratis) {
      const productosNuevosTotales = productosEnCarga.filter(p => !p.esExistente).length + (nombre.trim() && precioVenta ? 1 : 0);
      if ((inventario.length + productosNuevosTotales) > 30) {
        setModalUpsell({
          visible: true,
          titulo: "Límite de 30 Productos Alcanzado",
          mensaje: `Tienes ${inventario.length} productos y estás intentando agregar ${productosNuevosTotales} más. El Plan Gratuito permite hasta 30 productos en catálogo. Pásate al Plan Comercio para tener inventario ILIMITADO.`,
          plan: 'comercio'
        });
        return;
      }
    }

    setGuardando(true);
    try {
      if (editandoId) {
        const esInventariable = tipoProducto === 'producto' && inventariable;
        const prodOriginal = inventario.find(p => p.id === editandoId);
        const stockBaseOriginal = Math.round(Number(prodOriginal?.stock) || 0);
        const cantSurtirNum = Math.round(Number(cantidadSurtir) || 0);
        if (esInventariable && modoEdicionProducto === 'surtir' && cantSurtirNum <= 0) {
          toast.error('Ingresa cuántas unidades nuevas vas a sumar (mayor a 0).');
          setGuardando(false);
          return;
        }
        const cantStock = esInventariable
          ? (modoEdicionProducto === 'surtir'
              ? stockBaseOriginal + cantSurtirNum
              : lotesEnEdicion.length > 1
                ? lotesEnEdicion.reduce((acc, l) => acc + Math.max(0, Math.round(Number(l.cantidad) || 0)), 0)
                : Math.round(Number(stock) || 0))
          : 0;
        const precioNum = Number(precioVenta.replace(/\D/g, '')) || 0;
        const precioFiadoNum = precioFiado.trim() ? (Number(precioFiado.replace(/\D/g, '')) || null) : null;
        const precioSepareNum = precioSepare.trim() ? (Number(precioSepare.replace(/\D/g, '')) || null) : null;
        const costoNum = Number(costoCompra.replace(/\D/g, '')) || 0;
        const nombreGuardar = nombre.trim();
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Sesión inválida.');
        const respuestaActualizacion = await fetch('/api/inventario/actualizar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            productoId: editandoId,
            nombre: nombreGuardar,
            sku: sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
            stock: cantStock,
            precioVenta: precioNum,
            precioFiado: precioFiadoNum,
            precioSepare: precioSepareNum,
            costoCompra: costoNum,
            tipoProducto,
            categoria: categoria.trim() || 'General',
            inventariable: esInventariable,
            imagen: imagenUrl || null,
            ...(modoEdicionProducto === 'editar' && lotesEnEdicion.length > 0 ? { lotesEditados: lotesEnEdicion } : {}),
            ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {})
          })
        });
        if (!respuestaActualizacion.ok) throw new Error((await respuestaActualizacion.json()).error || 'No se pudo actualizar el producto.');
        setProductoRecienGuardadoId(editandoId);
        toast.success(`"${nombreGuardar}" actualizado en la lista.`);
      } else {
        // Guardar todos los productos en la lista unificada
        const productosParaGuardar = [...productosEnCarga];
        if (nombre.trim() && precioVenta) {
          productosParaGuardar.push(crearProductoDesdeFormulario());
        }

        const nombreReferencia = nombre.trim() || productosParaGuardar[0]?.nombre || 'Producto';
        const totalFinal = await guardarProductosEnCarga(productosParaGuardar);
        if (totalFinal > 1) {
          toast.success(`¡Se guardaron ${totalFinal} productos en el inventario!`, { duration: 4000 });
        } else if (totalFinal === 1) {
          toast.success(`"${nombreReferencia}" guardado y visible en la lista.`);
        }
      }

      await cargarInventario(cuentaPrincipalId);
      limpiarFormulario();
      if (cerrarAlFinal) {
        setModalProducto(false);
      }
    } catch (error: any) {
      console.error("Error guardando producto:", error);
      toast.error(error?.message || "Error al guardar el producto. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarEliminacionProducto = async () => {
    if (!productoAEliminar) return;
    try {
      setEliminandoProducto(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Sesión inválida.');
      const respuestaArchivado = await fetch('/api/inventario/archivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productoId: productoAEliminar.id })
      });
      if (!respuestaArchivado.ok) throw new Error((await respuestaArchivado.json()).error || 'No se pudo archivar el producto.');
      setProductosSeleccionados(prev => prev.filter(id => id !== productoAEliminar.id));
      toast.success(`"${productoAEliminar.nombre}" archivado del catálogo.`);
      setProductoAEliminar(null);
      if (cuentaPrincipalId) cargarInventario(cuentaPrincipalId);
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar el producto.");
    } finally {
      setEliminandoProducto(false);
    }
  };

  const abrirEdicion = (prod: any, modoInicial: 'surtir' | 'editar' = 'editar') => {
    setModoEdicionProducto(modoInicial);
    setCantidadSurtir("");
    const lotesNorm = obtenerLotesNormalizados(prod);
    setLotesEnEdicion(lotesNorm);
    setLoteSeleccionadoIdx(0);
    setProveedorEntrada(modoInicial === 'editar' ? (lotesNorm[0]?.proveedor || prod.proveedor || "") : "");
    if (datosSesion?.esGratis && inventario.length > 30) {
      setModalUpsell({
        visible: true,
        titulo: "Catálogo Excedido (Modo Solo Venta)",
        mensaje: `Tienes ${inventario.length} productos registrados (el límite del Plan Gratuito es 30). Puedes seguir vendiendo y cobrando normalmente, pero para editar o reciclar referencias necesitas estar dentro del límite o pasarte al Plan Comercio.`,
        plan: 'comercio'
      });
      return;
    }
    setEditandoId(prod.id);
    setNombre(prod.nombre);
    setImagenUrl(prod.imagen || null);
    setSku(prod.sku || "");
    setStock(prod.stock?.toString() || "0");
    setPrecioVenta(prod.precioVenta?.toString() || "");
    setPrecioFiado(prod.precioFiado ? prod.precioFiado.toString() : "");
    setPrecioSepare(prod.precioSepare ? prod.precioSepare.toString() : "");
    setMostrarPreciosDiferenciados(Boolean(prod.precioFiado || prod.precioSepare));
    const costoInicial = modoInicial === 'editar' && lotesNorm.length > 0
      ? lotesNorm[0].costoUnitario
      : prod.costoCompra;
    setCostoCompra(costoInicial ? costoInicial.toString() : "");
    setTipoProducto(prod.tipoProducto === 'servicio' ? 'servicio' : 'producto');
    setCategoria(prod.categoria || 'General');
    setInventariable(prod.inventariable !== false);
    setModalProducto(true);
  };

  // Manejador inteligente 24/7 para pistola láser USB / Bluetooth en Inventario
  const manejarLecturaPistolaInventario = (codigoRaw: string) => {
    const codigoLimpio = (codigoRaw || '').trim();
    if (!codigoLimpio) return;

    const codigoUpper = codigoLimpio.toUpperCase();
    const codigoNorm = codigoUpper.replace(/^(SKU|REF|COD)[-_ ]*/i, '');

    const prodCoincidente = inventario.find((p) => {
      const pSku = (p.sku || '').trim().toUpperCase();
      const pBar = (p.codigoBarras || '').trim().toUpperCase();
      const pCod = (p.codigo || '').trim().toUpperCase();
      const pSkuNorm = pSku.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
      const pBarNorm = pBar.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
      return (
        pSku === codigoUpper ||
        pBar === codigoUpper ||
        pCod === codigoUpper ||
        p.id === codigoLimpio ||
        (codigoNorm && (pSkuNorm === codigoNorm || pBarNorm === codigoNorm))
      );
    });

    reproducirSonidoCamara();

    // Si en el modal ya había otro producto en modo 'surtir' con unidades (> 0) pendientes de encolar,
    // lo pasamos automáticamente a la Cola de Recepción antes de cargar el nuevo código escaneado.
    const autoEncolarSurtidoPrevioSiAplica = (nuevoProdId?: string) => {
      if (
        modalProducto &&
        editandoId &&
        modoEdicionProducto === 'surtir' &&
        editandoId !== nuevoProdId &&
        Number(cantidadSurtir) > 0
      ) {
        const prodPrevio = inventario.find((p) => p.id === editandoId);
        if (prodPrevio) {
          const cantPrev = Math.max(1, Number(cantidadSurtir) || 1);
          agregarOActualizarProductoEnCarga({
            id: `carga_${prodPrevio.id}`,
            esExistente: true,
            productoId: prodPrevio.id,
            nombre: prodPrevio.nombre,
            sku: prodPrevio.sku || prodPrevio.codigoBarras || sku.trim().toUpperCase(),
            stock: cantPrev,
            precioVenta: Number(precioVenta.replace(/\D/g, '')) || prodPrevio.precioVenta || 0,
            costoCompra: Number(costoCompra.replace(/\D/g, '')) || prodPrevio.costoCompra || 0,
            tipoProducto: prodPrevio.tipoProducto || tipoProducto,
            categoria: categoria.trim() || prodPrevio.categoria || 'General',
            inventariable: prodPrevio.inventariable !== false,
            imagen: imagenUrl || prodPrevio.imagen || null,
            ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {}),
            enCarga: true,
          });
        }
      }
    };

    if (prodCoincidente) {
      if (esAdmin || puedeEditarInventario) {
        // Si ya estábamos surtiendo este mismo producto en el modal, cada disparo suma +1 a la cantidad a surtir
        if (modalProducto && editandoId === prodCoincidente.id && modoEdicionProducto === 'surtir') {
          const nuevaCant = (Number(cantidadSurtir) || 0) + 1;
          setCantidadSurtir(String(nuevaCant));
          toast.success(`📦 +1 unidad a surtir en "${prodCoincidente.nombre}" (Total: +${nuevaCant} u.)`, { id: `scan-inv-${prodCoincidente.id}` });
        } else {
          autoEncolarSurtidoPrevioSiAplica(prodCoincidente.id);
          abrirEdicion(prodCoincidente, 'surtir');
          setCantidadSurtir('1');
          toast.success(`✓ "${prodCoincidente.nombre}" cargado para surtir (+1 u.)`, { icon: '📦', id: `scan-inv-${prodCoincidente.id}` });
        }
      } else {
        setBusqueda(codigoLimpio);
        toast.success(`✓ Encontrado: "${prodCoincidente.nombre}"`);
      }
    } else {
      if (esAdmin || puedeEditarInventario) {
        autoEncolarSurtidoPrevioSiAplica(undefined);
        limpiarFormulario();
        setSku(codigoUpper);
        setModalProducto(true);
        toast.success(`✨ Código nuevo "${codigoUpper}" listo para registrar`, { id: `scan-new-${codigoUpper}` });
      } else {
        setBusqueda(codigoLimpio);
        toast.error(`Código "${codigoUpper}" no registrado en inventario`);
      }
    }
  };

  usePistolaLaser({
    activo: !modalEscanerInventario && !modalExportarQR && !modalImportarExcel && !modalExportarExcel && !modalGestionCategorias && !productoAEliminar && !modalConfirmarDescarteCarga && !modalCamaraEnVivo && !fotoLightbox && !modalUpsell.visible,
    onScan: (codigo) => manejarLecturaPistolaInventario(codigo),
  });

  // ======== CÁMARA ========
  const reproducirSonidoCamara = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch(e){}
  };

  const abrirCamaraEnVivo = async (modo?: 'environment' | 'user' | unknown) => {
    const modoFinal: 'environment' | 'user' = (modo === 'user' || modo === 'environment') ? modo : facingMode;
    setModalCamaraEnVivo(true);
    setIniciandoCamara(true);
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: modoFinal }, width: { ideal: 1280 } }
        });
        setFacingMode(modoFinal);
        setMediaStream(stream);
      } catch (e) {
        console.error("Error al acceder a la cámara:", e);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          setMediaStream(fallbackStream);
        } catch (errFallback) {
          toast.error("No se pudo acceder a la cámara.");
          setModalCamaraEnVivo(false);
        }
      } finally {
        setIniciandoCamara(false);
      }
    } else {
      toast.error("Tu navegador no soporta la cámara en vivo.");
      setModalCamaraEnVivo(false);
      setIniciandoCamara(false);
    }
  };

  const alternarCamara = () => {
    const nuevoModo = facingMode === 'environment' ? 'user' : 'environment';
    abrirCamaraEnVivo(nuevoModo);
  };

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(e => console.log("Play error:", e));
    }
  }, [mediaStream, modalCamaraEnVivo]);

  const capturarFotoEnVivo = () => {
    if (!videoRef.current) return;
    reproducirSonidoCamara();
    setFlashEfecto(true);
    setTimeout(() => setFlashEfecto(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (facingMode === 'user') {
        // En selfie (frontal), volteamos horizontalmente para que guarde como se ve en el preview espejo
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setImagenUrl(dataUrl);
      toast.success("Foto del producto capturada 📸");
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setModalCamaraEnVivo(false);
  };

  const cerrarCamara = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setModalCamaraEnVivo(false);
  };

  const manejarSubidaArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagenUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  // ==========================

  const limpiarFormulario = () => {
    setEditandoId(null);
    setModoEdicionProducto('editar');
    setCantidadSurtir("");
    setProveedorEntrada("");
    setLotesEnEdicion([]);
    setLoteSeleccionadoIdx(0);
    setNombre("");
    setSku("");
    setStock("");
    setPrecioVenta("");
    setPrecioFiado("");
    setPrecioSepare("");
    setMostrarPreciosDiferenciados(false);
    setCostoCompra("");
    setImagenUrl(null);
    setTipoProducto('producto');
    setCategoria('');
    setInventariable(true);
    setCategoriaFoco(false);
    setCategoriaEditando(null);
    setNombreCategoriaEditada('');
    setMensajeCategoria(null);
    setErrores({ nombre: '', categoria: '', stock: '', precio: '' });
  };

  // Función auxiliar para evitar duplicar 'SKU:' si el código ya contiene 'SKU'
  const formatearTextoSKU = (skuRaw?: string) => {
    if (!skuRaw) return 'N/A';
    const skuLimpio = String(skuRaw).trim();
    if (/^sku[:\s\-_]/i.test(skuLimpio)) {
      return skuLimpio;
    }
    return `SKU: ${skuLimpio}`;
  };

  // Obtiene la fecha de ingreso más reciente del producto (desde su último lote o creación) en formato compacto DD/MM/AA
  const obtenerFechaIngresoEtiqueta = (prod?: any): string => {
    if (!prod) {
      const hoy = new Date();
      return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${String(hoy.getFullYear()).slice(-2)}`;
    }
    let fechaRef: Date | null = null;
    if (Array.isArray(prod.lotesCosto) && prod.lotesCosto.length > 0) {
      const ultimoLote = prod.lotesCosto[prod.lotesCosto.length - 1];
      if (ultimoLote?.fechaIngreso) {
        const d = new Date(ultimoLote.fechaIngreso);
        if (!isNaN(d.getTime())) fechaRef = d;
      }
    }
    if (!fechaRef) {
      const rawFecha = prod.ultimaRecepcionEn || prod.creadoEn || prod.fechaCreacion || prod.createdAt;
      if (rawFecha) {
        if (typeof rawFecha?.toDate === 'function') {
          fechaRef = rawFecha.toDate();
        } else if (typeof rawFecha?.seconds === 'number') {
          fechaRef = new Date(rawFecha.seconds * 1000);
        } else {
          const d = new Date(rawFecha);
          if (!isNaN(d.getTime())) fechaRef = d;
        }
      }
    }
    if (!fechaRef || isNaN(fechaRef.getTime())) fechaRef = new Date();
    const dia = String(fechaRef.getDate()).padStart(2, '0');
    const mes = String(fechaRef.getMonth() + 1).padStart(2, '0');
    const anio = String(fechaRef.getFullYear()).slice(-2);
    return `${dia}/${mes}/${anio}`;
  };

  // Calcula la rebaja máxima permitida y el precio mínimo protegiendo que NUNCA baje del costo del lote más caro
  const calcularDatosTopeRebaja = (prod?: any) => {
    const precio = Number(prod?.precioVenta) || 45000;
    const lotes = prod ? obtenerLotesNormalizados(prod) : [];
    const costoMaxLote = lotes.length > 0
      ? Math.max(...lotes.map(l => Number(l.costoUnitario) || 0))
      : (Number(prod?.costoCompra) || 0);

    const numInput = Number(String(valorTopeRebaja).replace(/\D/g, '')) || 0;
    const rebajaSolicitada = modoTopeRebaja === 'porcentaje'
      ? Math.round((precio * Math.min(100, numInput)) / 100)
      : numInput;

    // Blindaje: nunca permitir rebajar por debajo del costo de compra registrado
    const margenMaximoRebajable = costoMaxLote > 0 && precio > costoMaxLote
      ? Math.max(0, precio - costoMaxLote)
      : precio;

    const rebajaReal = Math.min(rebajaSolicitada, margenMaximoRebajable);
    const precioMinimo = Math.max(0, precio - rebajaReal);

    const formatearMilesClave = (valorPesos: number) => {
      if (valorPesos >= 1000) {
        return String(Number((valorPesos / 1000).toFixed(1)));
      }
      return String(valorPesos);
    };

    let textoEtiqueta = '';
    if (formatoTopeEtiqueta === 'clave_rebaja') {
      textoEtiqueta = `R-${formatearMilesClave(rebajaReal)}`;
    } else if (formatoTopeEtiqueta === 'clave_minimo') {
      textoEtiqueta = `M-${formatearMilesClave(precioMinimo)}`;
    } else {
      textoEtiqueta = `Mín:$${precioMinimo.toLocaleString('es-CO')}`;
    }

    return {
      precio,
      costoMaxLote,
      rebajaReal,
      precioMinimo,
      protegidoPorCosto: costoMaxLote > 0 && rebajaSolicitada > margenMaximoRebajable,
      textoEtiqueta
    };
  };

  // Construye la línea compacta combinada de Fecha de Ingreso + Tope de Rebaja para el sticker
  const obtenerLineaMetaEtiqueta = (prod?: any): string => {
    const partes: string[] = [];
    if (opcionFechaIngreso) {
      partes.push(`ING:${obtenerFechaIngresoEtiqueta(prod)}`);
    }
    if (opcionTopeRebaja) {
      const { textoEtiqueta } = calcularDatosTopeRebaja(prod);
      if (textoEtiqueta) partes.push(textoEtiqueta);
    }
    return partes.join(' • ');
  };

  // GENERAR PDF CON DISEÑO MULTI-TAMAÑO, IMPRESORA TÉRMICA (ROLLO) Y HOJA MULTI-ETIQUETA
  const generarPDFConQRs = async (modoAccion: 'imprimir' | 'descargar' = 'imprimir') => {
    if (productosParaExportarQR.length === 0) {
      if (origenExportacion === 'seleccionados') {
        return toast.error("No has seleccionado productos en la tabla. Marca las casillas de los productos que deseas etiquetar.");
      }
      if (origenExportacion === 'fecha') {
        return toast.error("No se encontraron productos registrados en el rango de fechas seleccionado.");
      }
      return toast.error("No hay productos para exportar.");
    }

    if (totalEtiquetasCalculadas <= 0) {
      return toast.error("La cantidad total de etiquetas a imprimir es 0. Ajusta las cantidades.");
    }

    const toastId = toast.loading(modoAccion === 'imprimir' ? "Preparando impresión directa de etiquetas..." : "Generando archivo PDF de etiquetas...");

    try {
      setModalExportarQR(false);

      if (tipoImpresoraQR === 'termica') {
        // =========================================================================
        // MODO 1: IMPRESORA TÉRMICA DE ETIQUETAS EN ROLLO (JALTECH, DIGITAL POS, ETC.)
        // CADA PÁGINA ES 1 STICKER CON DIMENSIONES EXACTAS EN MILÍMETROS
        // =========================================================================
        let anchoMM = 40;
        let altoMM = 30;

        if (tamanoTermicoQR === '32x25') { anchoMM = 32; altoMM = 25; }
        else if (tamanoTermicoQR === '40x30') { anchoMM = 40; altoMM = 30; }
        else if (tamanoTermicoQR === '50x25') { anchoMM = 50; altoMM = 25; }
        else if (tamanoTermicoQR === '50x30') { anchoMM = 50; altoMM = 30; }
        else if (tamanoTermicoQR === '58x40') { anchoMM = 58; altoMM = 40; }
        else if (tamanoTermicoQR === '80x50') { anchoMM = 80; altoMM = 50; }
        else if (tamanoTermicoQR === 'personalizado') {
          anchoMM = Math.max(20, Number(anchoPersonalizadoMM) || 40);
          altoMM = Math.max(15, Number(altoPersonalizadoMM) || 30);
        }

        // Si es IMPRESIÓN DIRECTA, usamos HTML con @page size en mm, diseño de esquinas sin cortar textos y 100% NEGRO PURO EN NEGRILLA
        if (modoAccion === 'imprimir') {
          const ventanaImpresion = window.open('', '_blank', 'width=480,height=640');
          if (!ventanaImpresion) {
            toast.dismiss(toastId);
            return toast.error("Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes (popups) para Fiabono.");
          }

          // Calibración óptica ISO para QR (lectura instantánea en cámara y pistola 2D sin robar espacio al texto)
          const qrLadoMM = anchoMM <= 32 ? 11.5 : (altoMM <= 25 ? 13 : (anchoMM <= 42 ? 14 : (anchoMM <= 52 ? 15 : 18)));
          // Calibración óptica para Código de Barras 1D (ancho completo para láser, altura optimizada)
          const barcodeAltoMM = altoMM <= 25 ? 7.2 : (altoMM <= 30 ? 9.0 : 11.5);

          let htmlEtiquetas = '';

          for (const prod of productosParaExportarQR) {
            let cantidadImprimir = 1;
            if (modoCantidadQR === 'stock') {
              cantidadImprimir = Number(prod.stock) > 0 ? Number(prod.stock) : 1;
            } else if (modoCantidadQR === 'uno') {
              cantidadImprimir = 1;
            } else if (modoCantidadQR === 'fijo') {
              cantidadImprimir = Math.max(1, cantidadFijaQR);
            } else if (modoCantidadQR === 'selectivo') {
              cantidadImprimir = cantidadesSelectivasQR[prod.id] !== undefined ? cantidadesSelectivasQR[prod.id] : (Number(prod.stock) > 0 ? Number(prod.stock) : 1);
            }

            if (cantidadImprimir <= 0) continue;

            const codigoValor = prod.sku || prod.codigoBarras || prod.id;
            let codigoSvgElement = '';
            if (formatoCodigoEtiqueta === 'barras') {
              codigoSvgElement = generarSvgCodigoBarras(codigoValor, { width: 1.7, height: 32, displayValue: false });
            } else {
              const svgElement = document.getElementById(`qr-svg-${prod.id}`);
              codigoSvgElement = svgElement ? svgElement.outerHTML : '';
            }

            const catLabel = normalizarCategoria(prod.categoria).toUpperCase();
            const nombreProd = String(prod.nombre || 'Producto').trim();
            const claseTamanoNombre = nombreProd.length > 42 ? 'nombre-xs' : (nombreProd.length > 24 ? 'nombre-sm' : 'nombre-lg');
            const textoFecha = opcionFechaIngreso ? `ING:${obtenerFechaIngresoEtiqueta(prod)}` : '';
            const textoTope = opcionTopeRebaja ? calcularDatosTopeRebaja(prod).textoEtiqueta : '';
            const tieneCabeceraEsquinas = (opcionNegocio && Boolean(datosSesion?.nombreNegocio)) || opcionCategoria;

            for (let i = 0; i < cantidadImprimir; i++) {
              if (formatoCodigoEtiqueta === 'qr') {
                // DISEÑO BOUTIQUE QR: Esquinas superiores (Negocio Izq / Categoría Der) + Nombre 100% completo + Abajo (QR Izq / Precio + SKU + Meta en Esquina Der)
                htmlEtiquetas += `
                  <div class="sticker">
                    ${tieneCabeceraEsquinas ? `
                      <div class="corner-header">
                        <span class="corner-top-left">${opcionNegocio && datosSesion?.nombreNegocio ? String(datosSesion.nombreNegocio).toUpperCase() : ''}</span>
                        <span class="corner-top-right">${opcionCategoria ? catLabel : ''}</span>
                      </div>
                    ` : ''}
                    ${opcionNombre ? `<div class="nombre-full ${claseTamanoNombre}">${nombreProd}</div>` : ''}
                    <div class="qr-split-body">
                      <div class="qr-box">${codigoSvgElement}</div>
                      <div class="qr-info-col">
                        ${opcionSku ? `<div class="sku-right">${formatearTextoSKU(prod.sku)}</div>` : ''}
                        ${opcionPrecio ? `<div class="precio-right">$${(prod.precioVenta || 0).toLocaleString('es-CO')}</div>` : ''}
                        ${(textoFecha || textoTope) ? `
                          <div class="meta-corner-right">
                            ${textoFecha ? `<span class="meta-ing">${textoFecha}</span>` : ''}
                            ${textoTope ? `<span class="meta-tope-badge">${textoTope}</span>` : ''}
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              } else {
                // DISEÑO BOUTIQUE CÓDIGO DE BARRAS 1D: Esquinas superiores + Nombre 100% completo + Barras Ancho Completo + Esquinas Inferiores (SKU/Meta Izq | Precio Der)
                htmlEtiquetas += `
                  <div class="sticker">
                    ${tieneCabeceraEsquinas ? `
                      <div class="corner-header">
                        <span class="corner-top-left">${opcionNegocio && datosSesion?.nombreNegocio ? String(datosSesion.nombreNegocio).toUpperCase() : ''}</span>
                        <span class="corner-top-right">${opcionCategoria ? catLabel : ''}</span>
                      </div>
                    ` : ''}
                    ${opcionNombre ? `<div class="nombre-full ${claseTamanoNombre}">${nombreProd}</div>` : ''}
                    <div class="barcode-full-row">${codigoSvgElement}</div>
                    <div class="barcode-footer-corners">
                      <div class="footer-left-col">
                        ${opcionSku ? `<div class="sku-left">${formatearTextoSKU(prod.sku)}</div>` : ''}
                        ${(textoFecha || textoTope) ? `
                          <div class="meta-corner-left">
                            ${textoFecha ? `<span class="meta-ing">${textoFecha}</span>` : ''}
                            ${textoTope ? `<span class="meta-tope-badge">${textoTope}</span>` : ''}
                          </div>
                        ` : ''}
                      </div>
                      ${opcionPrecio ? `<div class="precio-corner-right">$${(prod.precioVenta || 0).toLocaleString('es-CO')}</div>` : ''}
                    </div>
                  </div>
                `;
              }
            }
          }

          ventanaImpresion.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Imprimir Etiquetas - Fiabono</title>
              <meta charset="utf-8">
              <style>
                @page {
                  size: ${anchoMM}mm ${altoMM}mm;
                  margin: 0mm;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                  text-rendering: geometricPrecision;
                  -webkit-font-smoothing: none;
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  background: #ffffff;
                  color: #000000;
                  font-family: Arial, Helvetica, "Segoe UI", sans-serif;
                  font-weight: 900;
                }
                .sticker {
                  width: ${anchoMM}mm;
                  height: ${altoMM}mm;
                  max-width: ${anchoMM}mm;
                  max-height: ${altoMM}mm;
                  padding: ${altoMM <= 25 ? '0.9mm 1.2mm' : '1.2mm 1.5mm'};
                  box-sizing: border-box;
                  page-break-after: always;
                  break-after: page;
                  page-break-inside: avoid;
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  background: #ffffff;
                  color: #000000;
                }
                .corner-header {
                  display: flex;
                  align-items: baseline;
                  justify-content: space-between;
                  gap: 1.5mm;
                  width: 100%;
                  border-bottom: 0.3mm solid #000000;
                  padding-bottom: 0.3mm;
                  margin-bottom: 0.3mm;
                  line-height: 1.05;
                }
                .corner-top-left {
                  font-size: ${anchoMM <= 32 ? '5.8px' : (anchoMM <= 42 ? '6.8px' : '7.8px')};
                  font-weight: 900;
                  color: #000000;
                  text-transform: uppercase;
                  text-align: left;
                  word-break: break-word;
                }
                .corner-top-right {
                  font-size: ${anchoMM <= 32 ? '5.6px' : (anchoMM <= 42 ? '6.5px' : '7.5px')};
                  font-weight: 900;
                  color: #000000;
                  text-transform: uppercase;
                  text-align: right;
                  word-break: break-word;
                  margin-left: auto;
                }
                .nombre-full {
                  width: 100%;
                  font-weight: 900;
                  color: #000000;
                  text-align: left;
                  white-space: normal;
                  word-break: break-word;
                  line-height: 1.06;
                  margin: 0.2mm 0;
                }
                .nombre-lg {
                  font-size: ${anchoMM <= 32 ? '7.8px' : (anchoMM <= 42 ? '9.2px' : '10.8px')};
                }
                .nombre-sm {
                  font-size: ${anchoMM <= 32 ? '6.8px' : (anchoMM <= 42 ? '8.0px' : '9.4px')};
                }
                .nombre-xs {
                  font-size: ${anchoMM <= 32 ? '6.0px' : (anchoMM <= 42 ? '7.0px' : '8.2px')};
                }
                .qr-split-body {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  gap: 1.2mm;
                  width: 100%;
                  flex: 1;
                  min-height: 0;
                }
                .qr-box {
                  width: ${qrLadoMM}mm;
                  height: ${qrLadoMM}mm;
                  min-width: ${qrLadoMM}mm;
                  min-height: ${qrLadoMM}mm;
                  padding: 0.4mm;
                  background: #ffffff;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                }
                .qr-box svg {
                  width: 100%;
                  height: 100%;
                  display: block;
                }
                .qr-info-col {
                  flex: 1;
                  min-width: 0;
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                  align-items: flex-end;
                  justify-content: space-between;
                  text-align: right;
                  padding: 0.2mm 0;
                }
                .sku-right, .sku-left {
                  font-size: ${anchoMM <= 32 ? '6.6px' : (anchoMM <= 42 ? '7.6px' : '8.6px')};
                  font-weight: 900;
                  color: #000000;
                  line-height: 1.05;
                  word-break: break-all;
                }
                .precio-right {
                  font-size: ${anchoMM <= 32 ? '10px' : (anchoMM <= 42 ? '12px' : '14px')};
                  font-weight: 900;
                  color: #000000;
                  line-height: 1;
                  letter-spacing: -0.2px;
                  margin: 0.3mm 0;
                }
                .meta-corner-right {
                  display: flex;
                  flex-wrap: wrap;
                  align-items: center;
                  justify-content: flex-end;
                  gap: 0.8mm;
                  line-height: 1;
                }
                .meta-corner-left {
                  display: flex;
                  flex-wrap: wrap;
                  align-items: center;
                  justify-content: flex-start;
                  gap: 0.8mm;
                  line-height: 1;
                  margin-top: 0.35mm;
                }
                .meta-ing {
                  font-size: ${anchoMM <= 32 ? '6.4px' : (anchoMM <= 42 ? '7.4px' : '8.4px')};
                  font-weight: 900;
                  color: #000000;
                }
                .meta-tope-badge {
                  font-size: ${anchoMM <= 32 ? '6.8px' : (anchoMM <= 42 ? '7.8px' : '8.8px')};
                  font-weight: 900;
                  color: #000000;
                  border: 0.4mm solid #000000;
                  padding: 0.25mm 1mm;
                  border-radius: 0.9mm;
                  line-height: 1.05;
                }
                .barcode-full-row {
                  width: 100%;
                  height: ${barcodeAltoMM}mm;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 0 1mm;
                  overflow: hidden;
                }
                .barcode-full-row svg {
                  width: 100%;
                  height: 100%;
                  max-height: ${barcodeAltoMM}mm;
                  display: block;
                }
                .barcode-footer-corners {
                  display: flex;
                  flex-direction: row;
                  align-items: flex-end;
                  justify-content: space-between;
                  gap: 1mm;
                  width: 100%;
                  padding-top: 0.2mm;
                }
                .footer-left-col {
                  display: flex;
                  flex-direction: column;
                  align-items: flex-start;
                  text-align: left;
                  min-width: 0;
                }
                .precio-corner-right {
                  font-size: ${anchoMM <= 32 ? '9.2px' : (anchoMM <= 42 ? '11px' : '13px')};
                  font-weight: 900;
                  color: #000000;
                  line-height: 1;
                  text-align: right;
                  white-space: nowrap;
                  margin-left: auto;
                }
                @media screen {
                  body {
                    background: #f1f5f9;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                  }
                  .sticker {
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    border-radius: 4px;
                  }
                }
              </style>
            </head>
            <body>
              ${htmlEtiquetas}
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 250);
                };
              </script>
            </body>
            </html>
          `);

          ventanaImpresion.document.close();
          toast.dismiss(toastId);
          toast.success(`¡Diálogo de impresión térmica abierto (${totalEtiquetasCalculadas} stickers)!`);
          return;
        }

        // Si es DESCARGAR PDF TÉRMICO (DISEÑO DE ESQUINAS SIN CORTAR TEXTOS, 100% NEGRO PURO Y NEGRILLA):
        const docPdf = new jsPDF({
          orientation: anchoMM >= altoMM ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [anchoMM, altoMM]
        });

        let esPrimeraPagina = true;

        for (const prod of productosParaExportarQR) {
          let cantidadImprimir = 1;
          if (modoCantidadQR === 'stock') {
            cantidadImprimir = Number(prod.stock) > 0 ? Number(prod.stock) : 1;
          } else if (modoCantidadQR === 'uno') {
            cantidadImprimir = 1;
          } else if (modoCantidadQR === 'fijo') {
            cantidadImprimir = Math.max(1, cantidadFijaQR);
          } else if (modoCantidadQR === 'selectivo') {
            cantidadImprimir = cantidadesSelectivasQR[prod.id] !== undefined ? cantidadesSelectivasQR[prod.id] : (Number(prod.stock) > 0 ? Number(prod.stock) : 1);
          }

          if (cantidadImprimir <= 0) continue;

          const svgElement = document.getElementById(`qr-svg-${prod.id}`);
          let qrDataUrl = "";

          if (svgElement) {
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(svgBlob);
            
            await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 240;
                canvas.height = 240;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  qrDataUrl = canvas.toDataURL('image/png');
                }
                URL.revokeObjectURL(blobURL);
                resolve(true);
              };
              img.onerror = () => resolve(true);
              img.src = blobURL;
            });
          }

          const metaLineaPdf = obtenerLineaMetaEtiqueta(prod);
          const catTextoPdf = normalizarCategoria(prod.categoria).toUpperCase();
          const nombreCompletoPdf = String(prod.nombre || 'Producto').trim();

          for (let i = 0; i < cantidadImprimir; i++) {
            if (!esPrimeraPagina) {
              docPdf.addPage([anchoMM, altoMM], anchoMM >= altoMM ? 'landscape' : 'portrait');
            }
            esPrimeraPagina = false;

            const padX = 1.5;
            const anchoUtil = anchoMM - (padX * 2);
            let curY = altoMM <= 25 ? 2.5 : 3.0;

            docPdf.setTextColor(0, 0, 0);
            docPdf.setDrawColor(0, 0, 0);
            docPdf.setFont("helvetica", "bold");

            // 1. FILA ESQUINAS SUPERIORES: Negocio (Izquierda) | Categoría (Derecha) — Cero colisión y cero textos cortados
            const mostrarNeg = opcionNegocio && Boolean(datosSesion?.nombreNegocio);
            if (mostrarNeg || opcionCategoria) {
              const fontHeader = anchoMM <= 32 ? 5.2 : 6.0;
              docPdf.setFontSize(fontHeader);
              let lineasNeg: string[] = [];
              if (mostrarNeg) {
                const anchoMaxNeg = opcionCategoria ? anchoUtil * 0.62 : anchoUtil;
                lineasNeg = docPdf.splitTextToSize(String(datosSesion?.nombreNegocio).toUpperCase(), anchoMaxNeg).slice(0, 2);
                docPdf.text(lineasNeg, padX, curY, { align: 'left' });
              }
              if (opcionCategoria) {
                docPdf.text(catTextoPdf, anchoMM - padX, curY, { align: 'right' });
              }
              const extraLineasNeg = lineasNeg.length > 1 ? (lineasNeg.length - 1) * (fontHeader * 0.36) : 0;
              curY += extraLineasNeg + 0.8;
              docPdf.setLineWidth(0.2);
              docPdf.line(padX, curY, anchoMM - padX, curY);
              curY += (altoMM <= 25 ? 2.1 : 2.5);
            }

            // 2. NOMBRE DEL PRODUCTO COMPLETO (100% ancho, multilínea sin puntos suspensivos)
            if (opcionNombre) {
              let fontNombre = anchoMM <= 32 ? 6.8 : (anchoMM <= 42 ? 7.8 : 9.0);
              docPdf.setFontSize(fontNombre);
              let lineasNombre = docPdf.splitTextToSize(nombreCompletoPdf, anchoUtil);
              if (lineasNombre.length > 2) {
                fontNombre = Math.max(5.2, fontNombre - 1.3);
                docPdf.setFontSize(fontNombre);
                lineasNombre = docPdf.splitTextToSize(nombreCompletoPdf, anchoUtil);
              }
              const maxLineas = Math.min(lineasNombre.length, 3);
              docPdf.text(lineasNombre.slice(0, maxLineas), padX, curY);
              curY += (maxLineas * (fontNombre * 0.37)) + 0.5;
            }

            // 3. CUERPO INFERIOR: QR a la izquierda + Datos en esquina derecha, O Código de Barras 1D + Esquinas inferiores
            const espacioVerticalRestante = Math.max(8, altoMM - curY - 1.2);

            if (formatoCodigoEtiqueta === 'qr') {
              // Tamaño óptico ideal para QR (entre 11mm y 16mm)
              const qrLado = Math.min(espacioVerticalRestante, anchoMM * 0.42, anchoMM <= 32 ? 11.5 : (anchoMM <= 42 ? 13.8 : 16));
              const qrY = curY + Math.max(0, (espacioVerticalRestante - qrLado) / 2);
              if (qrDataUrl) {
                docPdf.addImage(qrDataUrl, 'PNG', padX, qrY, qrLado, qrLado);
              }

              const rightEdgeX = anchoMM - padX;
              let infoY = curY + 2.0;

              if (opcionSku) {
                docPdf.setFontSize(anchoMM <= 32 ? 5.6 : 6.5);
                docPdf.text(formatearTextoSKU(prod.sku), rightEdgeX, infoY, { align: 'right' });
                infoY += (anchoMM <= 32 ? 3.2 : 3.8);
              }

              if (opcionPrecio) {
                const fontPrecio = anchoMM <= 32 ? 8.5 : (anchoMM <= 42 ? 10.2 : 12.0);
                docPdf.setFontSize(fontPrecio);
                const yPrecio = Math.min(Math.max(infoY + 1.0, altoMM - (metaLineaPdf ? 4.2 : 2.0)), altoMM - (metaLineaPdf ? 4.0 : 1.6));
                docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, rightEdgeX, yPrecio, { align: 'right' });
              }

              if (metaLineaPdf) {
                docPdf.setFontSize(anchoMM <= 32 ? 5.4 : 6.2);
                docPdf.text(metaLineaPdf, rightEdgeX, altoMM - 1.3, { align: 'right' });
              }
            } else {
              // MODO CÓDIGO DE BARRAS 1D: Altura optimizada para láser + Esquinas inferiores
              const barcodeDataUrl = generarDataUrlCodigoBarras(prod.sku || prod.codigoBarras || prod.id, { width: 2, height: 35 });
              const altoPie = (opcionSku || metaLineaPdf || opcionPrecio) ? (altoMM <= 25 ? 4.2 : 5.2) : 1.0;
              const barcodeAlto = Math.min(Math.max(5.5, espacioVerticalRestante - altoPie), altoMM <= 25 ? 7.5 : 9.5);
              if (barcodeDataUrl) {
                docPdf.addImage(barcodeDataUrl, 'PNG', padX + 0.5, curY, anchoUtil - 1.0, barcodeAlto);
              }

              // Esquina Inferior Izquierda: SKU + ING/Tope
              let leftBottomY = altoMM - (metaLineaPdf && opcionSku ? 3.2 : 1.4);
              if (opcionSku) {
                docPdf.setFontSize(anchoMM <= 32 ? 5.4 : 6.2);
                docPdf.text(formatearTextoSKU(prod.sku), padX, leftBottomY, { align: 'left' });
                leftBottomY += 2.0;
              }
              if (metaLineaPdf) {
                docPdf.setFontSize(anchoMM <= 32 ? 5.2 : 5.8);
                docPdf.text(metaLineaPdf, padX, altoMM - 1.2, { align: 'left' });
              }

              // Esquina Inferior Derecha: Precio Grande
              if (opcionPrecio) {
                docPdf.setFontSize(anchoMM <= 32 ? 8.2 : (anchoMM <= 42 ? 9.8 : 11.5));
                docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, anchoMM - padX, altoMM - 1.3, { align: 'right' });
              }
            }
          }
        }

        docPdf.save(`Etiquetas_Termica_${anchoMM}x${altoMM}mm_${Date.now()}.pdf`);
        toast.dismiss(toastId);
        toast.success(`¡PDF térmico descargado con éxito (${totalEtiquetasCalculadas} stickers en rollo)!`);

      } else {
        // =========================================================================
        // MODO 2: HOJA CARTA / A4 MULTI-ETIQUETA (DISEÑO BOUTIQUE DE ESQUINAS SIN CORTAR TEXTOS)
        // =========================================================================
        const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        
        let anchoEtiqueta = 58;
        let altoEtiqueta = 48;
        let margenX = 8;
        let margenY = 8;
        let colsPorFila = 3;
        let qrSize = 18;
        let startX = 14;
        let startY = 16;
        let maxPageY = 262;

        if (tamanoEtiqueta === 'compacto') {
          anchoEtiqueta = 44;
          altoEtiqueta = 34;
          margenX = 5;
          margenY = 6;
          colsPorFila = 4;
          qrSize = 14.5;
          startX = 12;
          startY = 16;
          maxPageY = 265;
        } else if (tamanoEtiqueta === 'grande') {
          anchoEtiqueta = 90;
          altoEtiqueta = 56;
          margenX = 10;
          margenY = 10;
          colsPorFila = 2;
          qrSize = 22;
          startX = 13;
          startY = 16;
          maxPageY = 258;
        }

        let x = startX;
        let y = startY;
        let contadorCol = 0;

        docPdf.setFont("helvetica", "bold");
        docPdf.setTextColor(0, 0, 0);
        docPdf.setFontSize(11);
        docPdf.text(`Etiquetas QR - Hoja Carta (${productosParaExportarQR.length} referencias, ${totalEtiquetasCalculadas} etiquetas)`, startX, 10);

        for (const prod of productosParaExportarQR) {
          let cantidadImprimir = 1;
          if (modoCantidadQR === 'stock') {
            cantidadImprimir = Number(prod.stock) > 0 ? Number(prod.stock) : 1;
          } else if (modoCantidadQR === 'uno') {
            cantidadImprimir = 1;
          } else if (modoCantidadQR === 'fijo') {
            cantidadImprimir = Math.max(1, cantidadFijaQR);
          } else if (modoCantidadQR === 'selectivo') {
            cantidadImprimir = cantidadesSelectivasQR[prod.id] !== undefined ? cantidadesSelectivasQR[prod.id] : (Number(prod.stock) > 0 ? Number(prod.stock) : 1);
          }

          if (cantidadImprimir <= 0) continue;

          const svgElement = document.getElementById(`qr-svg-${prod.id}`);
          let qrDataUrl = "";

          if (svgElement) {
            const svgString = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(svgBlob);
            
            await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 200;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  qrDataUrl = canvas.toDataURL('image/png');
                }
                URL.revokeObjectURL(blobURL);
                resolve(true);
              };
              img.onerror = () => resolve(true);
              img.src = blobURL;
            });
          }

          const metaLineaHoja = obtenerLineaMetaEtiqueta(prod);
          const catTextoHoja = normalizarCategoria(prod.categoria).toUpperCase();
          const nombreCompletoHoja = String(prod.nombre || 'Producto').trim();

          for (let i = 0; i < cantidadImprimir; i++) {
            if (y + altoEtiqueta > maxPageY) {
              docPdf.addPage();
              x = startX;
              y = startY;
              contadorCol = 0;
            }

            // Borde guía firme
            docPdf.setDrawColor(160, 160, 160);
            docPdf.setLineWidth(0.25);
            docPdf.rect(x, y, anchoEtiqueta, altoEtiqueta);

            docPdf.setTextColor(0, 0, 0);
            docPdf.setFont("helvetica", "bold");

            const padInterno = tamanoEtiqueta === 'compacto' ? 2.2 : 3.0;
            const anchoUtilHoja = anchoEtiqueta - (padInterno * 2);
            let cursorY = y + (tamanoEtiqueta === 'compacto' ? 3.5 : 4.5);

            // 1. Esquinas Superiores: Negocio (Izq) | Categoría (Der) — Cero colisión y cero textos cortados
            const mostrarNegHoja = opcionNegocio && Boolean(datosSesion?.nombreNegocio);
            if (mostrarNegHoja || opcionCategoria) {
              const fontHeaderHoja = tamanoEtiqueta === 'compacto' ? 6.0 : (tamanoEtiqueta === 'grande' ? 8.0 : 7.0);
              docPdf.setFontSize(fontHeaderHoja);
              let lineasNegHoja: string[] = [];
              if (mostrarNegHoja) {
                const anchoMaxNegHoja = opcionCategoria ? anchoUtilHoja * 0.62 : anchoUtilHoja;
                lineasNegHoja = docPdf.splitTextToSize(String(datosSesion?.nombreNegocio).toUpperCase(), anchoMaxNegHoja).slice(0, 2);
                docPdf.text(lineasNegHoja, x + padInterno, cursorY, { align: 'left' });
              }
              if (opcionCategoria) {
                docPdf.text(catTextoHoja, x + anchoEtiqueta - padInterno, cursorY, { align: 'right' });
              }
              const extraNegHoja = lineasNegHoja.length > 1 ? (lineasNegHoja.length - 1) * (fontHeaderHoja * 0.36) : 0;
              cursorY += extraNegHoja + 1.0;
              docPdf.setDrawColor(0, 0, 0);
              docPdf.setLineWidth(0.2);
              docPdf.line(x + padInterno, cursorY, x + anchoEtiqueta - padInterno, cursorY);
              cursorY += (tamanoEtiqueta === 'compacto' ? 2.8 : 3.5);
            }

            // 2. Nombre del Producto Completo (100% ancho, sin puntos suspensivos)
            if (opcionNombre) {
              let fontNomHoja = tamanoEtiqueta === 'compacto' ? 7.8 : (tamanoEtiqueta === 'grande' ? 11.0 : 9.2);
              docPdf.setFontSize(fontNomHoja);
              let lineasNomHoja = docPdf.splitTextToSize(nombreCompletoHoja, anchoUtilHoja);
              if (lineasNomHoja.length > 2) {
                fontNomHoja = Math.max(6.2, fontNomHoja - 1.2);
                docPdf.setFontSize(fontNomHoja);
                lineasNomHoja = docPdf.splitTextToSize(nombreCompletoHoja, anchoUtilHoja);
              }
              const maxLin = Math.min(lineasNomHoja.length, 3);
              docPdf.text(lineasNomHoja.slice(0, maxLin), x + padInterno, cursorY);
              cursorY += (maxLin * (fontNomHoja * 0.38)) + 1.0;
            }

            // 3. Cuerpo Inferior en Esquinas
            const bottomY = y + altoEtiqueta - padInterno;
            const espacioVertHoja = Math.max(10, bottomY - cursorY);

            if (formatoCodigoEtiqueta === 'barras') {
              const barcodeDataUrl = generarDataUrlCodigoBarras(prod.sku || prod.codigoBarras || prod.id, { width: 2, height: 36 });
              const barHeight = Math.min(espacioVertHoja - 6, tamanoEtiqueta === 'compacto' ? 8.5 : 11.5);
              if (barcodeDataUrl && barHeight > 4) {
                docPdf.addImage(barcodeDataUrl, 'PNG', x + padInterno, cursorY, anchoUtilHoja, barHeight);
              }
              let yIzq = bottomY - (metaLineaHoja && opcionSku ? 3.2 : 0.5);
              if (opcionSku) {
                docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 6.2 : 7.5);
                docPdf.text(formatearTextoSKU(prod.sku), x + padInterno, yIzq, { align: 'left' });
              }
              if (metaLineaHoja) {
                docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 5.8 : 7.0);
                docPdf.text(metaLineaHoja, x + padInterno, bottomY, { align: 'left' });
              }
              if (opcionPrecio) {
                docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 9.0 : (tamanoEtiqueta === 'grande' ? 13.0 : 11.0));
                docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, x + anchoEtiqueta - padInterno, bottomY, { align: 'right' });
              }
            } else {
              const qrLadoHoja = Math.min(qrSize, espacioVertHoja);
              const qrYHoja = cursorY + Math.max(0, (espacioVertHoja - qrLadoHoja) / 2);
              if (qrDataUrl) {
                docPdf.addImage(qrDataUrl, 'PNG', x + padInterno, qrYHoja, qrLadoHoja, qrLadoHoja);
              }

              const xDerHoja = x + anchoEtiqueta - padInterno;
              let yDerCursor = cursorY + 2.5;
              if (opcionSku) {
                docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 6.5 : (tamanoEtiqueta === 'grande' ? 8.8 : 7.6));
                docPdf.text(formatearTextoSKU(prod.sku), xDerHoja, yDerCursor, { align: 'right' });
                yDerCursor += 4.2;
              }
              if (opcionPrecio) {
                docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 9.5 : (tamanoEtiqueta === 'grande' ? 14.0 : 11.5));
                const yPrecioHoja = Math.min(Math.max(yDerCursor + 1.5, bottomY - (metaLineaHoja ? 4.2 : 1.0)), bottomY - (metaLineaHoja ? 3.8 : 0.5));
                docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, xDerHoja, yPrecioHoja, { align: 'right' });
              }
              if (metaLineaHoja) {
                docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 6.0 : (tamanoEtiqueta === 'grande' ? 8.0 : 7.0));
                docPdf.text(metaLineaHoja, xDerHoja, bottomY, { align: 'right' });
              }
            }

            contadorCol++;
            if (contadorCol < colsPorFila) {
              x += anchoEtiqueta + margenX;
            } else {
              x = startX;
              y += altoEtiqueta + margenY;
              contadorCol = 0;
            }
          }
        }

        if (modoAccion === 'imprimir') {
          docPdf.autoPrint();
          const blobUrl = docPdf.output('bloburl');
          
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          iframe.src = String(blobUrl);
          document.body.appendChild(iframe);
          
          iframe.onload = () => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (e) {
              window.open(String(blobUrl), '_blank');
            }
          };

          toast.dismiss(toastId);
          toast.success(`¡Diálogo de impresión de hojas abierto (${totalEtiquetasCalculadas} etiquetas)!`);
        } else {
          docPdf.save(`Etiquetas_QR_Hoja_${tamanoEtiqueta}_${Date.now()}.pdf`);
          toast.dismiss(toastId);
          toast.success(`¡PDF generado con éxito con ${totalEtiquetasCalculadas} etiquetas!`);
        }
      }

    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error("Error al procesar las etiquetas.");
    }
  };

  // EXPORTAR INVENTARIO A EXCEL ESTILIZADO Y CORPORATIVO (.XLSX)
  const exportarInventarioAExcel = async () => {
    if (inventarioProcesado.length === 0) {
      return toast.error("No hay productos disponibles para exportar con los filtros actuales.");
    }

    const toastId = toast.loading("Generando Excel corporativo...");

    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Fiabono';
      wb.created = new Date();

      // --- HOJA 1: INVENTARIO ---
      const wsInv = wb.addWorksheet('Inventario', {
        properties: { tabColor: { argb: 'FF059669' } },
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      // Encabezados
      const headers = [
        'Tipo de Producto',
        'Categoría de Inventarios / Servicios',
        'Código del Producto / SKU',
        'Nombre del Producto / Servicio',
        '¿Inventariable?',
        'Precio de Venta ($)',
        'Stock Actual',
        'Valor Total en Stock ($)'
      ];

      const headerRow = wsInv.addRow(headers);
      headerRow.height = 30;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF059669' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF047857' } },
          bottom: { style: 'medium', color: { argb: 'FF047857' } },
          left: { style: 'thin', color: { argb: 'FF047857' } },
          right: { style: 'thin', color: { argb: 'FF047857' } }
        };
      });

      // Filas de productos con sombreado zebra y formato numérico
      inventarioProcesado.forEach((p, idx) => {
        const esServicio = p.tipoProducto === 'servicio' || p.inventariable === false;
        const stockNum = esServicio ? 0 : (Number(p.stock) || 0);
        const precioNum = Number(p.precioVenta) || 0;
        const totalNum = Math.max(0, stockNum) * precioNum;

        const row = wsInv.addRow([
          esServicio ? 'Servicio' : 'Producto',
          normalizarCategoria(p.categoria),
          p.sku || '',
          p.nombre || '',
          esServicio ? 'No' : 'Si',
          precioNum,
          esServicio ? 0 : stockNum,
          totalNum
        ]);

        row.height = 22;
        const isOdd = idx % 2 === 1;
        const rowBgColor = isOdd ? 'FFF8FAFC' : 'FFFFFFFF';

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBgColor }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          if (colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNumber === 6 || colNumber === 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '$#,##0';
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });

      // Filas adicionales vacías pre-formateadas para ingresar nuevos productos
      const startExtraRow = inventarioProcesado.length + 2;
      for (let r = startExtraRow; r < startExtraRow + 20; r++) {
        const extraRow = wsInv.addRow(['', '', '', '', '', '', '', '']);
        extraRow.height = 22;
        const isOdd = (r - 2) % 2 === 1;
        const rowBgColor = isOdd ? 'FFF8FAFC' : 'FFFFFFFF';

        extraRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBgColor }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNumber === 1 || colNumber === 3 || colNumber === 5 || colNumber === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (colNumber === 6 || colNumber === 8) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '$#,##0';
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      }

      // Tarjeta de Ejemplos de Referencia a la derecha (Columnas J a P)
      wsInv.mergeCells('J1:P1');
      const titleExample = wsInv.getCell('J1');
      titleExample.value = '💡 EJEMPLOS DE DILIGENCIAMIENTO (Guía de referencia)';
      titleExample.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      titleExample.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      titleExample.alignment = { horizontal: 'center', vertical: 'middle' };

      const exampleHeaders = [
        'Tipo de Producto',
        'Categoría de Inventarios / Servicios',
        'Código / SKU',
        'Nombre del Producto / Servicio',
        '¿Inventariable?',
        'Precio ($)',
        'Stock'
      ];

      const exHeaderRow = wsInv.getRow(2);
      exampleHeaders.forEach((hText, idx) => {
        const cell = exHeaderRow.getCell(10 + idx);
        cell.value = hText;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      const examplesData = [
        ['Producto', 'Ropa hombre', 'SKU-001', 'Blusa talla S azul', 'Si', 45000, 12],
        ['Producto', 'Hogar', 'SKU-002', 'Olla arrocera 1.5L', 'Si', 120000, 5],
        ['Servicio', 'Masaje', 'SERV-001', 'Masaje completo relajante', 'No', 80000, 0],
        ['Producto', 'Licores', 'SKU-003', '1 Litro Aguardiente Amarillo', 'Si', 55000, 24],
        ['Producto', 'Joyería', 'SKU-004', 'Cadena plata 925 45cm', 'Si', 95000, 8],
        ['Servicio', 'Perforación oreja', 'SERV-002', 'Perforación + arete titanio', 'No', 30000, 0],
      ];

      examplesData.forEach((exRow, rIdx) => {
        const row = wsInv.getRow(3 + rIdx);
        exRow.forEach((val, cIdx) => {
          const cell = row.getCell(10 + cIdx);
          cell.value = val;
          cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (cIdx === 0 || cIdx === 2 || cIdx === 4 || cIdx === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (cIdx === 5) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '$#,##0';
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });

      // Anchos de columna Hoja 1
      wsInv.getColumn(1).width = 22;
      wsInv.getColumn(2).width = 34;
      wsInv.getColumn(3).width = 24;
      wsInv.getColumn(4).width = 38;
      wsInv.getColumn(5).width = 18;
      wsInv.getColumn(6).width = 22;
      wsInv.getColumn(7).width = 16;
      wsInv.getColumn(8).width = 24;
      wsInv.getColumn(9).width = 5; // Separador
      wsInv.getColumn(10).width = 18;
      wsInv.getColumn(11).width = 26;
      wsInv.getColumn(12).width = 18;
      wsInv.getColumn(13).width = 30;
      wsInv.getColumn(14).width = 16;
      wsInv.getColumn(15).width = 16;
      wsInv.getColumn(16).width = 12;

      // --- HOJA 2: DATOS (LISTAS DESPLEGABLES) ---
      const wsDatos = wb.addWorksheet('Datos', {
        properties: { tabColor: { argb: 'FF3B82F6' } }
      });

      const datosHeaderRow = wsDatos.addRow([
        'Tipo de producto',
        'Categoría de Inventarios / Servicios',
        'Inventariable'
      ]);
      datosHeaderRow.height = 28;

      datosHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F172A' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF0F172A' } }
        };
      });

      const categoriasPresentesEnInventario = [...new Set(inventario.map(p => normalizarCategoria(p.categoria)))];
      const todasLasCategorias = [...new Set([...categoriasOrdenadas, ...categoriasPresentesEnInventario])].sort((a, b) => a.localeCompare(b, 'es'));
      const maxFilas = Math.max(2, todasLasCategorias.length);

      for (let i = 0; i < maxFilas; i++) {
        const row = wsDatos.addRow([
          i === 0 ? 'Producto' : (i === 1 ? 'Servicio' : ''),
          todasLasCategorias[i] || '',
          i === 0 ? 'Si' : (i === 1 ? 'No' : '')
        ]);
        row.height = 20;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNumber === 1 || colNumber === 3) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      }

      wsDatos.columns = [
        { width: 22 },
        { width: 34 },
        { width: 20 }
      ];

      // Listas desplegables (Data Validations) en Hoja Inventario
      const maxRowsValidation = Math.max(inventarioProcesado.length + 35, 100);
      for (let r = 2; r <= maxRowsValidation; r++) {
        wsInv.getCell(`A${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Datos!$A$2:$A$3'],
          showErrorMessage: true,
          errorTitle: 'Tipo no válido',
          error: 'Selecciona Producto o Servicio'
        };

        wsInv.getCell(`B${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`Datos!$B$2:$B$${todasLasCategorias.length + 10}`],
          showErrorMessage: true,
          errorTitle: 'Categoría no válida',
          error: 'Selecciona una categoría de la lista o agrégala en la hoja Datos'
        };

        wsInv.getCell(`E${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Datos!$C$2:$C$3'],
          showErrorMessage: true,
          errorTitle: 'Opción no válida',
          error: 'Selecciona Si o No'
        };
      }

      // Generar buffer y descargar
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const fechaHoy = new Date().toISOString().split('T')[0];
      anchor.download = `Inventario_Fiabono_${fechaHoy}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`¡Inventario exportado con diseño corporativo (${inventarioProcesado.length} productos)!`);
    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error("Ocurrió un error al exportar el inventario con estilo a Excel.");
    }
  };

  // PROCESAR ARCHIVO DE EXCEL SUBIDO PARA IMPORTACIÓN
  const procesarArchivoExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoArchivoExcel(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Busca hoja 'Inventario' o toma la primera
        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('inventario')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        
        if (!ws) {
          toast.error("No se encontró la hoja de Inventario en el archivo.");
          setProcesandoArchivoExcel(false);
          return;
        }

        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        
        if (data.length <= 1) {
          toast.error("El archivo está vacío o no contiene filas de productos para importar.");
          setProcesandoArchivoExcel(false);
          return;
        }

        // Detectar índice del encabezado y mapeo dinámico de columnas
        let headerRowIndex = 0;
        let colFiado = -1;
        let colSepare = -1;
        let colStock = 6;
        let colPrecio = 5;
        for (let i = 0; i < Math.min(5, data.length); i++) {
          const rowArr = data[i] || [];
          const rowText = rowArr.join(' ').toLowerCase();
          if (rowText.includes('nombre') || rowText.includes('tipo') || rowText.includes('sku')) {
            headerRowIndex = i;
            rowArr.forEach((col: any, cIdx: number) => {
              const colStr = String(col || '').toLowerCase();
              if (colStr.includes('fiado') || colStr.includes('crédito') || colStr.includes('credito')) colFiado = cIdx;
              else if (colStr.includes('separe')) colSepare = cIdx;
              else if (colStr.includes('stock') || colStr.includes('cant')) colStock = cIdx;
              else if (colStr.includes('precio') && !colStr.includes('total') && !colStr.includes('fiado') && !colStr.includes('separe')) colPrecio = cIdx;
            });
            break;
          }
        }

        const parsearNumeroExcel = (val: any): number => {
          if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
          if (val === null || val === undefined) return 0;
          const texto = String(val).trim();
          if (!texto) return 0;
          // Quitar símbolos de moneda y espacios; en Colombia los puntos o comas suelen ser separadores de miles
          const soloDigitos = texto.replace(/[^\d-]/g, '');
          const num = Number(soloDigitos);
          return Number.isFinite(num) ? Math.max(0, num) : 0;
        };

        const productosParseados: any[] = [];
        
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          // Extraer columnas principales (A a G)
          const tipoRaw = String(row[0] || 'Producto').trim();
          const esServicio = tipoRaw.toLowerCase().includes('servicio');
          const categoriaVal = normalizarCategoria(String(row[1] || 'General'));
          const skuVal = String(row[2] || '').trim().toUpperCase();
          const nombreVal = String(row[3] || '').trim();
          const invRaw = String(row[4] || (esServicio ? 'No' : 'Si')).trim().toLowerCase();
          const inventariableVal = esServicio ? false : (!invRaw.startsWith('n') && invRaw !== '0');
          // Si no tiene nombre se ignora
          if (!nombreVal) continue;

          // Búsqueda inteligente de duplicados por SKU o por Nombre exacto
          const prodExistente = inventario.find(item => {
            const matchSku = skuVal && item.sku && String(item.sku).trim().toLowerCase() === skuVal.toLowerCase();
            const matchBar = skuVal && item.codigoBarras && String(item.codigoBarras).trim().toLowerCase() === skuVal.toLowerCase();
            const matchNombre = item.nombre && String(item.nombre).trim().toLowerCase() === nombreVal.toLowerCase();
            return matchSku || matchBar || matchNombre;
          });

          const precioVal = parsearNumeroExcel(row[colPrecio !== -1 ? colPrecio : 5]);
          const precioFiadoVal = colFiado !== -1 ? parsearNumeroExcel(row[colFiado]) : (prodExistente?.precioFiado || null);
          const precioSepareVal = colSepare !== -1 ? parsearNumeroExcel(row[colSepare]) : (prodExistente?.precioSepare || null);
          const stockVal = esServicio || !inventariableVal ? 0 : parsearNumeroExcel(row[colStock !== -1 ? colStock : 6]);

          productosParseados.push({
            tipoProducto: esServicio ? 'servicio' : 'producto',
            categoria: categoriaVal,
            sku: skuVal || (prodExistente?.sku || ''),
            nombre: nombreVal,
            inventariable: inventariableVal,
            precioVenta: precioVal,
            precioFiado: precioFiadoVal && precioFiadoVal > 0 ? precioFiadoVal : null,
            precioSepare: precioSepareVal && precioSepareVal > 0 ? precioSepareVal : null,
            stock: stockVal,
            filaExcel: i + 1,
            accion: prodExistente ? 'actualizar' : 'crear',
            prodExistenteId: prodExistente?.id || null,
            stockAnterior: prodExistente ? (prodExistente.stock || 0) : 0,
            precioAnterior: prodExistente ? (prodExistente.precioVenta || 0) : 0
          });
        }

        if (productosParseados.length === 0) {
          toast.error("No se encontraron productos con nombre válido en la hoja de Inventario.");
          setProcesandoArchivoExcel(false);
          return;
        }

        setProductosAImportar(productosParseados);
        const nuevos = productosParseados.filter(p => p.accion === 'crear').length;
        const actualizados = productosParseados.filter(p => p.accion === 'actualizar').length;
        toast.success(`¡Detectados ${nuevos} productos nuevos y ${actualizados} para actualizar!`);
      } catch (err) {
        console.error(err);
        toast.error("Error al leer el archivo Excel. Verifica que sea un formato válido .xlsx o .csv");
      } finally {
        setProcesandoArchivoExcel(false);
        if (e.target) e.target.value = '';
      }
    };

    reader.onerror = () => {
      toast.error("Error al leer el archivo.");
      setProcesandoArchivoExcel(false);
    };

    reader.readAsBinaryString(file);
  };

  // GUARDAR PRODUCTOS IMPORTADOS EN FIRESTORE EN LOTES (BATCH)
  const guardarProductosImportados = async () => {
    if (!cuentaPrincipalId) {
      return toast.error("Error de sesión: No se encontró la cuenta principal.");
    }
    if (!datosSesion?.esPro) {
      toast.error("La importación masiva desde Excel es exclusiva del Plan PRO Almacén.");
      setModalUpsell({
        visible: true,
        titulo: "Carga Masiva en Excel (Plan PRO)",
        mensaje: "Importa cientos o miles de productos con stock y precios en segundos desde un archivo Excel con el Plan PRO Almacén.",
        plan: 'pro'
      });
      return;
    }
    if (productosAImportar.length === 0) {
      return toast.error("No hay productos cargados para importar.");
    }

    try {
      setImportandoAFirestore(true);
      const CHUNK_SIZE = 400;
      let creados = 0;
      let actualizados = 0;
      
      for (let i = 0; i < productosAImportar.length; i += CHUNK_SIZE) {
        const chunk = productosAImportar.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(prod => {
          if (prod.accion === 'actualizar' && prod.prodExistenteId) {
            actualizados++;
            const docRef = doc(db, "inventario", prod.prodExistenteId);
            const prodActualInv = inventario.find(it => it.id === prod.prodExistenteId);
            const stockFinal = modoActualizacionStock === 'sumar'
              ? (Number(prod.stockAnterior) || 0) + (Number(prod.stock) || 0)
              : (Number(prod.stock) || 0);
            const stockGuardar = prod.tipoProducto === 'servicio' || !prod.inventariable ? 0 : stockFinal;
            const lotesSync = prodActualInv && prod.tipoProducto !== 'servicio' && prod.inventariable
              ? ajustarLotesEnEdicionManual(prodActualInv, stockGuardar, Number(prodActualInv.costoCompra) || 0)
              : null;

            batch.update(docRef, {
              nombre: prod.nombre,
              categoria: normalizarCategoria(prod.categoria),
              tipoProducto: prod.tipoProducto,
              inventariable: prod.inventariable,
              stock: stockGuardar,
              ...(lotesSync ? { lotesCosto: lotesSync.lotesActualizados, costoCompra: lotesSync.costoCompraActivo } : {}),
              precioVenta: prod.precioVenta,
              ...(prod.precioFiado ? { precioFiado: prod.precioFiado } : {}),
              ...(prod.precioSepare ? { precioSepare: prod.precioSepare } : {}),
              fechaActualizacion: new Date()
            });
          } else {
            creados++;
            const docRef = doc(collection(db, "inventario"));
            const skuGenerado = (prod.sku || `SKU-${docRef.id.slice(0, 6).toUpperCase()}`).trim().toUpperCase();
            const stockGuardar = prod.tipoProducto === 'servicio' || !prod.inventariable ? 0 : prod.stock;
            batch.set(docRef, {
              usuarioId: cuentaPrincipalId,
              nombre: prod.nombre,
              categoria: normalizarCategoria(prod.categoria),
              sku: skuGenerado,
              codigoBarras: skuGenerado,
              tipoProducto: prod.tipoProducto,
              inventariable: prod.inventariable,
              stock: stockGuardar,
              precioVenta: prod.precioVenta,
              precioFiado: prod.precioFiado || null,
              precioSepare: prod.precioSepare || null,
              costoCompra: 0,
              lotesCosto: stockGuardar > 0 ? [{
                id: `lote_excel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                cantidad: stockGuardar,
                cantidadInicial: stockGuardar,
                costoUnitario: 0,
                fecha: new Date().toISOString()
              }] : [],
              activo: true,
              fechaCreacion: new Date(),
              fechaActualizacion: new Date()
            });
          }
        });

        await batch.commit();
      }

      // Sincronizar nuevas categorías importadas en Firestore
      const catsImportadas = productosAImportar.map(p => normalizarCategoria(p.categoria)).filter(Boolean);
      const nuevasCats = [...new Set([...categoriasDisponibles, ...catsImportadas])].sort((a, b) => a.localeCompare(b, 'es'));
      setCategoriasDisponibles(nuevasCats);
      void persistirCategoriasEnFirestore(nuevasCats);

      const mensaje = actualizados > 0 
        ? `¡${creados} creados y ${actualizados} actualizados con éxito!`
        : `¡${creados} productos importados con éxito a tu inventario!`;
      
      toast.success(mensaje);
      setModalImportarExcel(false);
      setProductosAImportar([]);
      await cargarInventario(cuentaPrincipalId);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar los productos en la base de datos.");
    } finally {
      setImportandoAFirestore(false);
    }
  };

  const categoriasSugeridas = [
    'General', 'Varios', 'Servicios', 'Ropa hombre', 'Ropa dama', 'Ropa interior', 'Hogar', 'Joyería',
    'Calzado', 'Ropa infantil', 'Bolsos', 'Deporte', 'Juguetería', 'Tecnología', 'Gorras y accesorios',
    'Tienda del Peluquero', 'Bebe accesorios', 'Bienestar', 'Buzos', 'Cacharro', 'Colegial'
  ];

  const categoriasOrdenadas = [...new Set([...categoriasSugeridas, ...categoriasDisponibles])].sort((a, b) => a.localeCompare(b, 'es'));

  const categoriaTexto = categoria.trim();
  const categoriaNormalizada = normalizarCategoria(categoria);
  const categoriasFiltradas = categoriaTexto === ''
    ? categoriasOrdenadas
    : categoriasOrdenadas.filter(item => item.toLowerCase().includes(categoriaTexto.toLowerCase()));
  const categoriaEnFiltro = categoriaTexto !== '' && categoriasOrdenadas.some(item => item.toLowerCase() === categoriaTexto.toLowerCase());
  const categoriaCustom = categoriaTexto !== '' && !categoriaEnFiltro;
  const mostrarAccionNuevaCategoria = categoriaTexto !== '' && (!categoriasFiltradas.some(item => item.toLowerCase() === categoriaTexto.toLowerCase()) || categoriaCustom);
  const menuCategoriasVisible = categoriaFoco && (categoriasFiltradas.length > 0 || mostrarAccionNuevaCategoria || categoriaTexto === '');

  const reproducirSonidoCategoria = (tipo: 'success' | 'danger' | 'info') => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = tipo === 'danger' ? 'square' : tipo === 'info' ? 'triangle' : 'sine';
      oscillator.frequency.value = tipo === 'danger' ? 180 : tipo === 'info' ? 440 : 720;
      gainNode.gain.value = 0.04;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch (error) {
      console.warn('No se pudo reproducir sonido para categorías:', error);
    }
  };

  const mostrarMensajeCategoria = (tipo: 'success' | 'danger' | 'info', titulo: string, detalle: string) => {
    setMensajeCategoria({ tipo, titulo, detalle });
    reproducirSonidoCategoria(tipo);
    toast.custom((t) => (
      <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl ${
        tipo === 'danger'
          ? 'border-rose-200 bg-white text-rose-700 shadow-rose-500/10 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300'
          : 'border-emerald-200 bg-white text-emerald-700 shadow-emerald-500/10 dark:border-emerald-900/60 dark:bg-slate-900 dark:text-emerald-300'
      }`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
          tipo === 'danger' ? 'bg-rose-100 dark:bg-rose-500/10' : 'bg-emerald-100 dark:bg-emerald-500/10'
        }`}>
          {tipo === 'danger' ? '×' : '✓'}
        </div>
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">{titulo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">{detalle}</p>
        </div>
      </div>
    ));

    window.setTimeout(() => {
      setMensajeCategoria(null);
    }, 2500);
  };

  const agregarCategoria = () => {
    const valor = (categoriaTexto || categoriaNormalizada).trim();
    if (!valor || valor === 'General') return;
    const nuevaLista = [...new Set([...categoriasDisponibles, valor])].sort((a, b) => a.localeCompare(b, 'es'));
    setCategoriasDisponibles(nuevaLista);
    persistirCategoriasEnFirestore(nuevaLista);
    setCategoria(valor);
    setErrores(prev => ({ ...prev, categoria: '' }));
    setCategoriaFoco(false);
    mostrarMensajeCategoria('success', 'Categoría agregada', `La categoría "${valor}" quedó disponible para usar.`);
  };

  const guardarEdicionCategoria = () => {
    const valor = nombreCategoriaEditada.trim();
    if (!valor || valor === 'General') return;

    const listaActualizada = categoriasDisponibles.map(item => item === categoriaEditando ? valor : item);
    const nuevaLista = [...new Set(listaActualizada)].sort((a, b) => a.localeCompare(b, 'es'));

    setCategoriasDisponibles(nuevaLista);
    persistirCategoriasEnFirestore(nuevaLista);
    setCategoria(valor);
    setCategoriaEditando(null);
    setNombreCategoriaEditada('');
    setErrores(prev => ({ ...prev, categoria: '' }));
    mostrarMensajeCategoria('success', 'Categoría actualizada', `La categoría cambió a "${valor}" y ya aparece en el campo.`);
  };

  const eliminarCategoria = (valor: string) => {
    const nuevaLista = categoriasDisponibles.filter(item => item !== valor);
    setCategoriasDisponibles(nuevaLista);
    persistirCategoriasEnFirestore(nuevaLista);
    if (categoria === valor) setCategoria('');
    setCategoriaEditando(null);
    setNombreCategoriaEditada('');
    mostrarMensajeCategoria('danger', 'Categoría eliminada', `Se quitó "${valor}" de la lista disponible.`);
  };

  const crearCategoriaDesdeModal = (nombreRaw: string) => {
    const val = normalizarCategoria(nombreRaw);
    if (!nombreRaw.trim()) {
      toast.error('Ingresa un nombre para la categoría.');
      return;
    }
    if (categoriasDisponibles.some(c => normalizarCategoria(c).toLowerCase() === val.toLowerCase())) {
      toast.error(`La categoría "${val}" ya existe.`);
      return;
    }
    const nuevaLista = [...new Set([...categoriasDisponibles, val])].sort((a, b) => a.localeCompare(b, 'es'));
    setCategoriasDisponibles(nuevaLista);
    persistirCategoriasEnFirestore(nuevaLista);
    setNuevaCatModalInput('');
    toast.success(`Categoría "${val}" creada`);
  };

  const renombrarCategoriaGlobal = async (catVieja: string, catNuevaRaw: string) => {
    const catNueva = normalizarCategoria(catNuevaRaw);
    const catViejaNorm = normalizarCategoria(catVieja).toLowerCase();
    if (!catNuevaRaw.trim() || catNueva.toLowerCase() === catViejaNorm) {
      setCategoriaEditandoModal(null);
      setNuevoNombreCatModal('');
      return;
    }

    try {
      setGuardandoCatModal(true);
      const prodsAfectados = inventario.filter(p => normalizarCategoria(p.categoria).toLowerCase() === catViejaNorm);
      if (prodsAfectados.length > 0) {
        const chunks = [];
        for (let i = 0; i < prodsAfectados.length; i += 450) {
          chunks.push(prodsAfectados.slice(i, i + 450));
        }
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(p => {
            batch.update(doc(db, "inventario", p.id), { categoria: catNueva });
          });
          await batch.commit();
        }

        setInventario(prev => prev.map(p => 
          normalizarCategoria(p.categoria).toLowerCase() === catViejaNorm
            ? { ...p, categoria: catNueva }
            : p
        ));
      }

      const filtrada = categoriasDisponibles.filter(c => normalizarCategoria(c).toLowerCase() !== catViejaNorm);
      const nuevaLista = [...new Set([...filtrada, catNueva])].sort((a, b) => a.localeCompare(b, 'es'));
      setCategoriasDisponibles(nuevaLista);
      persistirCategoriasEnFirestore(nuevaLista);

      if (normalizarCategoria(categoria).toLowerCase() === catViejaNorm) {
        setCategoria(catNueva);
      }
      setFiltrosCategoria(prev => prev.map(f => f === catViejaNorm ? catNueva.toLowerCase() : f));

      setCategoriaEditandoModal(null);
      setNuevoNombreCatModal('');
      toast.success(`Categoría renombrada a "${catNueva}" (${prodsAfectados.length} productos actualizados)`);
    } catch (err) {
      console.error("Error renombrando categoría:", err);
      toast.error("No se pudo renombrar la categoría.");
    } finally {
      setGuardandoCatModal(false);
    }
  };

  const solicitarEliminarCategoria = (catAEliminar: string) => {
    const catNorm = normalizarCategoria(catAEliminar).toLowerCase();
    if (catNorm === 'general') {
      toast.error("La categoría 'General' es la base del catálogo y no se puede eliminar.");
      return;
    }
    const conteo = inventario.filter(p => normalizarCategoria(p.categoria).toLowerCase() === catNorm).length;
    setCategoriaAEliminarConfirm({ nombre: catAEliminar, conteoProds: conteo });
  };

  const ejecutarEliminacionCategoria = async () => {
    if (!categoriaAEliminarConfirm) return;
    const catAEliminar = categoriaAEliminarConfirm.nombre;
    const catNorm = normalizarCategoria(catAEliminar).toLowerCase();
    const prodsAfectados = inventario.filter(p => normalizarCategoria(p.categoria).toLowerCase() === catNorm);

    try {
      setGuardandoCatModal(true);
      if (prodsAfectados.length > 0) {
        const chunks = [];
        for (let i = 0; i < prodsAfectados.length; i += 450) {
          chunks.push(prodsAfectados.slice(i, i + 450));
        }
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(p => {
            batch.update(doc(db, "inventario", p.id), { categoria: 'General' });
          });
          await batch.commit();
        }

        setInventario(prev => prev.map(p => 
          normalizarCategoria(p.categoria).toLowerCase() === catNorm
            ? { ...p, categoria: 'General' }
            : p
        ));
      }

      const nuevaLista = categoriasDisponibles.filter(c => normalizarCategoria(c).toLowerCase() !== catNorm);
      setCategoriasDisponibles(nuevaLista);
      persistirCategoriasEnFirestore(nuevaLista);
      if (normalizarCategoria(categoria).toLowerCase() === catNorm) {
        setCategoria('General');
      }
      setFiltrosCategoria(prev => prev.filter(f => f !== catNorm));
      toast.success(`Categoría "${catAEliminar}" eliminada`);
    } catch (err) {
      console.error("Error eliminando categoría:", err);
      toast.error("No se pudo eliminar la categoría.");
    } finally {
      setGuardandoCatModal(false);
      setCategoriaAEliminarConfirm(null);
    }
  };

  // Renderizado de Badge de Stock
  const renderStockBadge = (prod: any, modo: 'normal' | 'movil' = 'normal') => {
    const cant = Number(prod.stock || 0);
    const esServicio = prod.tipoProducto === 'servicio' || prod.inventariable === false;

    if (esServicio) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-bold border border-indigo-200 dark:border-indigo-800 shrink-0`}>
          <Sparkles size={modo === 'movil' ? 11 : 13} className="shrink-0" /> {modo === 'movil' ? 'Servicio' : 'Servicio / Ilimitado'}
        </span>
      );
    }

    if (cant < 0) {
      return (
        <span
          title="Vendido físicamente sin stock en sistema. Ingresa mercancía para nivelarlo automáticamente."
          className={`inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-black border border-orange-300 dark:border-orange-700 shrink-0 animate-pulse`}
        >
          <AlertTriangle size={modo === 'movil' ? 11 : 13} className="shrink-0" /> {modo === 'movil' ? `Déficit (${cant})` : `En Déficit (${cant})`}
        </span>
      );
    }

    if (cant === 0) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-bold border border-slate-200 dark:border-slate-700 shrink-0`}>
          <XCircle size={modo === 'movil' ? 11 : 13} className="shrink-0" /> {modo === 'movil' ? 'Sin stock (0)' : 'Sin Stock (0)'}
        </span>
      );
    }

    if (cant <= 5) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-black border border-amber-200 dark:border-amber-800 shrink-0`}>
          <AlertTriangle size={modo === 'movil' ? 11 : 13} className="shrink-0" /> {cant} {cant === 1 ? 'un.' : 'un.'}
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-bold border border-emerald-200 dark:border-emerald-800 shrink-0`}>
        <CheckCircle2 size={modo === 'movil' ? 11 : 13} className="shrink-0" /> {cant} {modo === 'movil' ? (cant === 1 ? 'un.' : 'un.') : (cant === 1 ? 'unidad' : 'unidades')}
      </span>
    );
  };

  // Indicador de flecha para columnas
  const renderSortIndicator = (col: ColumnaOrden) => {
    if (columnaOrden !== col) {
      return <ArrowUpDown size={14} className="text-slate-400 opacity-60" />;
    }
    return direccionOrden === 'asc' 
      ? <ArrowUp size={14} className="text-emerald-600 dark:text-emerald-400 font-black" />
      : <ArrowDown size={14} className="text-emerald-600 dark:text-emerald-400 font-black" />;
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
        <div className="p-2 sm:p-3 pb-0"><BannerDatosLocales modulo="productos e inventario" /></div>
      
      {/* HEADER ULTRA RESPONSIVE */}
      <div className="bg-emerald-600 dark:bg-emerald-700 p-3 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2 sm:mr-4">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl lg:text-2xl font-black uppercase tracking-wide flex items-center gap-1.5 truncate">
              <Package size={20} className="shrink-0"/> 
              <span className="sm:hidden truncate">Inventario</span>
              <span className="hidden sm:inline truncate">Inventario General</span>
            </h2>
            <p className="text-[11px] text-white/80 font-medium hidden lg:block truncate">
              {esAdmin || puedeEditarInventario || puedeIngresarInventario ? "Control de stock, precios y catálogo de productos" : "Consulta de catálogo, precios y disponibilidad"}
            </p>
          </div>
        </div>
        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {esAdmin && (
            <>
              {/* En Escritorio / Laptops (>= xl): Botones directos con labels */}
              <div className="hidden xl:flex items-center gap-1.5">
                <button 
                  onClick={() => setModalGestionCategorias(true)} 
                  className="bg-white/20 hover:bg-white/30 px-2.5 2xl:px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer whitespace-nowrap"
                  title="Administrar categorías del catálogo (crear, renombrar, eliminar)"
                >
                  <Tag size={15}/> <span>Categorías</span>
                </button>

                <button 
                  onClick={() => {
                    if (!datosSesion?.esPro) {
                      setModalUpsell({
                        visible: true,
                        titulo: "Exportación a Excel en Plan PRO",
                        mensaje: "Descarga reportes de inventario y catálogos en Excel ilimitadamente con el Plan PRO Almacén.",
                        plan: 'pro'
                      });
                      return;
                    }
                    setModalExportarExcel(true);
                  }} 
                  className="bg-white/20 hover:bg-white/30 px-2.5 2xl:px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer whitespace-nowrap"
                  title="Descargar inventario en archivo Excel .xlsx"
                >
                  <FileSpreadsheet size={15}/> <span>Exportar Excel</span>
                  {!datosSesion?.esPro && <Crown size={12} className="text-amber-300 ml-0.5" />}
                </button>

                <button 
                  onClick={() => {
                    if (!datosSesion?.esPro) {
                      setModalUpsell({
                        visible: true,
                        titulo: "Carga Masiva en Excel (Plan PRO)",
                        mensaje: "Importa cientos o miles de productos con stock y precios en segundos desde un archivo Excel con el Plan PRO Almacén.",
                        plan: 'pro'
                      });
                      return;
                    }
                    setProductosAImportar([]); 
                    setModalImportarExcel(true); 
                  }} 
                  className="bg-white/20 hover:bg-white/30 px-2.5 2xl:px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer whitespace-nowrap"
                  title="Cargar productos masivamente desde un archivo Excel"
                >
                  <Upload size={15}/> <span>Importar Excel</span>
                  {!datosSesion?.esPro && <Crown size={12} className="text-amber-300 ml-0.5" />}
                </button>

                <button 
                  onClick={() => {
                    if (!datosSesion?.esPro) {
                      setModalUpsell({
                        visible: true,
                        titulo: "Etiquetas Adhesivas QR para Productos",
                        mensaje: "Genera e imprime planchas térmicas con Código QR, Nombre y Precio para pegar en tus prendas o estanterías y cobrar en 1 segundo.",
                        plan: 'pro'
                      });
                      return;
                    }
                    setModalExportarQR(true);
                  }} 
                  className="bg-white/20 hover:bg-white/30 px-2.5 2xl:px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer whitespace-nowrap"
                  title="Imprimir o exportar etiquetas de productos (Código de Barras o QR)"
                >
                  <Printer size={15}/> <span>Etiquetas</span>
                  {!datosSesion?.esPro && <Crown size={12} className="text-amber-300 ml-0.5" />}
                </button>
              </div>

              {/* Menú Desplegable de Herramientas para pantallas < xl (móviles y tablets) */}
              <div className="relative xl:hidden">
                <button 
                  type="button"
                  onClick={() => setMenuHerramientasMovil(!menuHerramientasMovil)}
                  className="bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm text-white active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Herramientas de inventario (Categorías, Excel, Importar, QRs)"
                >
                  <SlidersHorizontal size={15}/>
                  <span className="hidden sm:inline">Herramientas</span>
                  <ChevronDown size={14} className={`hidden sm:inline transition-transform duration-200 ${menuHerramientasMovil ? 'rotate-180' : ''}`} />
                </button>

                {menuHerramientasMovil && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setMenuHerramientasMovil(false)} 
                    />
                    <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in zoom-in-95 duration-150">
                      <button
                        onClick={() => {
                          setMenuHerramientasMovil(false);
                          setModalGestionCategorias(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Tag size={16} className="text-violet-600 dark:text-violet-400"/>
                          <span>Administrar Categorías</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setMenuHerramientasMovil(false);
                          if (!datosSesion?.esPro) {
                            setModalUpsell({
                              visible: true,
                              titulo: "Exportación a Excel en Plan PRO",
                              mensaje: "Descarga reportes de inventario y catálogos en Excel ilimitadamente con el Plan PRO Almacén.",
                              plan: 'pro'
                            });
                            return;
                          }
                          setModalExportarExcel(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet size={16} className="text-emerald-600"/>
                          <span>Exportar a Excel</span>
                        </div>
                        {!datosSesion?.esPro && <Crown size={12} className="text-amber-500" />}
                      </button>

                      <button
                        onClick={() => {
                          setMenuHerramientasMovil(false);
                          if (!datosSesion?.esPro) {
                            setModalUpsell({
                              visible: true,
                              titulo: "Carga Masiva en Excel (Plan PRO)",
                              mensaje: "Importa cientos o miles de productos con stock y precios en segundos desde un archivo Excel con el Plan PRO Almacén.",
                              plan: 'pro'
                            });
                            return;
                          }
                          setProductosAImportar([]);
                          setModalImportarExcel(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Upload size={16} className="text-blue-600"/>
                          <span>Importar desde Excel</span>
                        </div>
                        {!datosSesion?.esPro && <Crown size={12} className="text-amber-500" />}
                      </button>

                      <button
                        onClick={() => {
                          setMenuHerramientasMovil(false);
                          if (!datosSesion?.esPro) {
                            setModalUpsell({
                              visible: true,
                              titulo: "Etiquetas Adhesivas QR para Productos",
                              mensaje: "Genera e imprime planchas térmicas con Código QR, Nombre y Precio para pegar en tus prendas o estanterías.",
                              plan: 'pro'
                            });
                            return;
                          }
                          setModalExportarQR(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Printer size={16} className="text-indigo-600"/>
                          <span>Imprimir Etiquetas</span>
                        </div>
                        {!datosSesion?.esPro && <Crown size={12} className="text-amber-500" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Botón Principal: Agregar Productos (Admin o Colaborador con permiso) */}
          {(esAdmin || puedeEditarInventario || puedeIngresarInventario) && (
            <button 
              onClick={() => {
                if (datosSesion?.esGratis && inventario.length >= 30) {
                  setModalUpsell({
                    visible: true,
                    titulo: "Límite de 30 Productos Alcanzado",
                    mensaje: "El plan Gratis te permite registrar hasta 30 productos en catálogo. Pásate al Plan Comercio para tener inventario ILIMITADO.",
                    plan: 'comercio'
                  });
                  return;
                }
                limpiarFormulario(); 
                setModalProducto(true); 
              }} 
              className="bg-white text-emerald-700 hover:bg-emerald-50 px-2.5 sm:px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1 shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer whitespace-nowrap"
              title="Agregar nuevos productos o servicios al inventario"
            >
              <Plus size={16}/> <span>Agregar<span className="hidden sm:inline"> Productos</span></span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL COMPACTO Y RESPONSIVE */}
      <div className="flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4">
          
          {/* SECCIÓN DE MÉTRICAS (COLAPSIBLE PARA GANAR ESPACIO EN LAPTOPS Y MÓVIL) */}
          {esAdmin && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Boxes size={13} className="text-emerald-500" /> Resumen de Inventario
                </span>
                <button 
                  type="button" 
                  onClick={() => setMostrarMetricas(!mostrarMetricas)}
                  className="text-[10px] sm:text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg cursor-pointer"
                  title="Ocultar o mostrar métricas para ganar espacio en pantalla"
                >
                  {mostrarMetricas ? 'Ocultar Resumen ▲' : 'Ver Resumen ▼'}
                </button>
              </div>

              {mostrarMetricas && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 animate-in fade-in duration-200">
                  
                  {/* Tarjeta 1: Total Referencias */}
                  <div 
                    onClick={limpiarTodosLosFiltros}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
                      filtrosStock.length === 0 && filtrosCategoria.length === 0 && !busqueda
                        ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/20'
                        : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                        Referencias
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {metricas.totalProductos}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          ({metricas.unidadesFisicasTotales} un.)
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                      <Boxes size={15} />
                    </div>
                  </div>

                  {/* Tarjeta 2: Valor del Inventario */}
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                        Valor Mercancía
                      </span>
                      <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate mt-0.5">
                        ${metricas.valorTotal.toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                      <DollarSign size={15} />
                    </div>
                  </div>

                  {/* Tarjeta 3: Stock Bajo */}
                  <div 
                    onClick={() => toggleFiltroStock('stock_bajo')}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
                      filtrosStock.includes('stock_bajo')
                        ? 'bg-amber-500/15 border-amber-500 dark:bg-amber-500/25 ring-2 ring-amber-500/20'
                        : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-amber-400'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
                        Stock Bajo (1-5)
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 tracking-tight">
                          {metricas.stockBajo}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          por agotar
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                      <AlertTriangle size={15} />
                    </div>
                  </div>

                  {/* Tarjeta 4: Sin Stock */}
                  <div 
                    onClick={() => toggleFiltroStock('sin_stock')}
                    className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
                      filtrosStock.includes('sin_stock')
                        ? 'bg-rose-500/15 border-rose-500 dark:bg-rose-500/25 ring-2 ring-rose-500/20'
                        : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-rose-400'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block truncate">
                        Sin Stock (0)
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight">
                          {metricas.sinStock}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          agotados
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                      <XCircle size={15} />
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* BANNER INFORMATIVO CUANDO HAY PRODUCTOS EN DÉFICit TEMPORAL (< 0) */}
          {metricas.enDeficit > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/70 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-xl shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-orange-900 dark:text-orange-200">
                    {metricas.enDeficit === 1
                      ? 'Tienes 1 producto vendido en déficit temporal (stock negativo)'
                      : `Tienes ${metricas.enDeficit} productos vendidos en déficit temporal (stock negativo)`}
                  </p>
                  <p className="text-[11px] font-medium text-orange-700 dark:text-orange-300/90">
                    Se vendieron físicamente cuando el sistema marcaba 0. Al registrar su factura de compra o ajustar su stock, se nivelarán automáticamente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!filtrosStock.includes('en_deficit')) {
                    setFiltrosStock(['en_deficit']);
                  } else {
                    limpiarFiltroStock();
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                  filtrosStock.includes('en_deficit')
                    ? 'bg-orange-700 text-white shadow-sm'
                    : 'bg-orange-600 hover:bg-orange-500 text-white shadow-sm'
                }`}
              >
                {filtrosStock.includes('en_deficit') ? 'Ver todos' : `Ver en déficit (${metricas.enDeficit})`}
              </button>
            </div>
          )}

          {/* BARRA DE BÚSQUEDA Y SELECTOR DE VISTA COMPACTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && busqueda.trim()) {
                    const qUpper = busqueda.trim().toUpperCase();
                    const qNorm = qUpper.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                    const matchExacto = inventario.find((p) => {
                      const pSku = (p.sku || '').trim().toUpperCase();
                      const pBar = (p.codigoBarras || '').trim().toUpperCase();
                      const pSkuNorm = pSku.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                      const pBarNorm = pBar.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                      return pSku === qUpper || pBar === qUpper || (qNorm && (pSkuNorm === qNorm || pBarNorm === qNorm));
                    });
                    if (matchExacto && (esAdmin || puedeEditarInventario)) {
                      e.preventDefault();
                      setBusqueda('');
                      manejarLecturaPistolaInventario(qUpper);
                    }
                  }
                }}
                placeholder="Buscar por nombre, SKU, categoría o disparar lector..." 
                className="w-full py-2.5 pl-10 pr-9 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500 shadow-sm transition-colors text-sm text-slate-900 dark:text-white" 
              />
              {busqueda && (
                <button 
                  onClick={() => setBusqueda("")} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* FILTROS POR ESTADO DE STOCK CON FLECHAS DE NAVEGACIÓN Y DESPLAZAMIENTO */}
          <div className="relative flex items-center gap-1 group">
            <button
              type="button"
              onClick={() => scrollContenedor(stockScrollRef, 'left')}
              className="hidden sm:flex items-center justify-center w-7 h-7 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-full shadow-sm text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-all active:scale-90 z-10"
              title="Desplazar filtros a la izquierda"
            >
              <ChevronLeft size={16} />
            </button>

            <div 
              ref={stockScrollRef} 
              className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
            >
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                <Layers size={13} /> Stock:
              </span>
              <button
                onClick={limpiarFiltroStock}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filtrosStock.length === 0
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-black'
                    : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                Todos ({inventario.length})
              </button>
              <button
                onClick={() => toggleFiltroStock('en_stock')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  filtrosStock.includes('en_stock')
                    ? 'bg-emerald-600 text-white shadow-sm font-black ring-2 ring-emerald-500/30'
                    : 'bg-white dark:bg-[#0f172a] text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                }`}
              >
                <CheckCircle2 size={13} /> Con Stock ({metricas.enStock})
              </button>
              <button
                onClick={() => toggleFiltroStock('stock_bajo')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  filtrosStock.includes('stock_bajo')
                    ? 'bg-amber-600 text-white shadow-sm font-black ring-2 ring-amber-500/30'
                    : 'bg-white dark:bg-[#0f172a] text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-800 hover:border-amber-400'
                }`}
              >
                <AlertTriangle size={13} /> Stock Bajo ({metricas.stockBajo})
              </button>
              <button
                onClick={() => toggleFiltroStock('sin_stock')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  filtrosStock.includes('sin_stock')
                    ? 'bg-rose-600 text-white shadow-sm font-black ring-2 ring-rose-500/30'
                    : 'bg-white dark:bg-[#0f172a] text-rose-700 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-400'
                }`}
              >
                <XCircle size={13} /> Sin Stock ({metricas.sinStock})
              </button>
              {(metricas.enDeficit > 0 || filtrosStock.includes('en_deficit')) && (
                <button
                  onClick={() => toggleFiltroStock('en_deficit')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    filtrosStock.includes('en_deficit')
                      ? 'bg-orange-600 text-white shadow-sm font-black ring-2 ring-orange-500/30'
                      : 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800 hover:border-orange-500'
                  }`}
                >
                  <AlertTriangle size={13} /> En Déficit ({metricas.enDeficit})
                </button>
              )}
              <button
                onClick={() => toggleFiltroStock('servicios')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  filtrosStock.includes('servicios')
                    ? 'bg-indigo-600 text-white shadow-sm font-black ring-2 ring-indigo-500/30'
                    : 'bg-white dark:bg-[#0f172a] text-indigo-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                }`}
              >
                <Sparkles size={13} /> Servicios ({metricas.totalServicios})
              </button>
            </div>

            <button
              type="button"
              onClick={() => scrollContenedor(stockScrollRef, 'right')}
              className="hidden sm:flex items-center justify-center w-7 h-7 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-full shadow-sm text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-all active:scale-90 z-10"
              title="Desplazar filtros a la derecha"
            >
              <ChevronRight size={16} />
            </button>
            {/* Sombra de desvanecimiento a la derecha para indicar scroll */}
            <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-slate-50 dark:from-[#020617] to-transparent pointer-events-none sm:hidden" />
          </div>

          {/* FILTROS POR ETIQUETAS / CATEGORÍAS CON FLECHAS DE NAVEGACIÓN */}
          {categoriasPresentes.length > 0 && (
            <div className="relative flex items-center gap-1 group">
              <button
                type="button"
                onClick={() => scrollContenedor(categoriasScrollRef, 'left')}
                className="hidden sm:flex items-center justify-center w-7 h-7 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-full shadow-sm text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-all active:scale-90 z-10"
                title="Desplazar categorías a la izquierda"
              >
                <ChevronLeft size={16} />
              </button>

              <div 
                ref={categoriasScrollRef} 
                className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth"
              >
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                  <Tag size={13} /> Categoría:
                </span>
                <button
                  onClick={limpiarFiltroCategoria}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    filtrosCategoria.length === 0
                      ? 'bg-blue-600 text-white shadow-sm font-black'
                      : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
                  }`}
                >
                  Todas ({categoriasPresentes.length})
                </button>
                {categoriasPresentes.map(cat => {
                  const count = inventario.filter(p => normalizarCategoria(p.categoria).toLowerCase() === cat.toLowerCase()).length;
                  const estaSeleccionada = filtrosCategoria.includes(cat.toLowerCase());
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleFiltroCategoria(cat)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                        estaSeleccionada
                          ? 'bg-blue-600 text-white shadow-sm font-black ring-2 ring-blue-500/30'
                          : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1 rounded-md font-mono ${estaSeleccionada ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollContenedor(categoriasScrollRef, 'right')}
                className="hidden sm:flex items-center justify-center w-7 h-7 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-full shadow-sm text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 transition-all active:scale-90 z-10"
                title="Desplazar categorías a la derecha"
              >
                <ChevronRight size={16} />
              </button>
              {/* Sombra de desvanecimiento para indicar scroll */}
              <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-slate-50 dark:from-[#020617] to-transparent pointer-events-none sm:hidden" />
            </div>
          )}

          {/* BARRA DE FILTROS ACTIVOS CON CHIPS REMOVIBLES (NUNCA SE CORTA) */}
          {(filtrosStock.length > 0 || filtrosCategoria.length > 0 || busqueda.trim()) && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3.5 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-black text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1 mr-1">
                  <Sliders size={12} /> Filtros ({filtrosStock.length + filtrosCategoria.length + (busqueda.trim() ? 1 : 0)}):
                </span>

                {/* Chip Búsqueda */}
                {busqueda.trim() && (
                  <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-[11px]">
                    <Search size={11} className="text-slate-400" />
                    <span>"{busqueda}"</span>
                    <button 
                      type="button" 
                      onClick={() => setBusqueda("")} 
                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-rose-500 transition-colors"
                      title="Quitar búsqueda"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}

                {/* Chips Filtros de Stock */}
                {filtrosStock.map(f => (
                  <span 
                    key={f} 
                    className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold text-[11px]"
                  >
                    <span>{f === 'en_stock' ? 'Con stock' : f === 'stock_bajo' ? 'Stock bajo' : f === 'sin_stock' ? 'Sin stock' : f === 'en_deficit' ? 'En déficit' : 'Servicios'}</span>
                    <button 
                      type="button" 
                      onClick={() => toggleFiltroStock(f)} 
                      className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 rounded-full text-emerald-500 hover:text-rose-500 transition-colors"
                      title="Quitar filtro de stock"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}

                {/* Chips Filtros de Categoría */}
                {filtrosCategoria.map(c => (
                  <span 
                    key={c} 
                    className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 font-bold capitalize text-[11px]"
                  >
                    <span>{c}</span>
                    <button 
                      type="button" 
                      onClick={() => toggleFiltroCategoria(c)} 
                      className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-900 rounded-full text-blue-500 hover:text-rose-500 transition-colors"
                      title="Quitar categoría"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Botón Restablecer todo */}
              <button
                type="button"
                onClick={limpiarTodosLosFiltros}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 ml-auto shrink-0"
              >
                <X size={12} /> Limpiar
              </button>
            </div>
          )}

          {/* QR OCULTOS PARA GENERAR EL PDF CORRECTAMENTE */}
          <div className="hidden">
            {inventario.map(prod => (
              <QRCodeSVG key={prod.id} id={`qr-svg-${prod.id}`} value={prod.sku || prod.codigoBarras || prod.id} size={128} />
            ))}
          </div>

          {/* VISTA 1: LISTADO DE PRODUCTOS (DUAL: TARJETAS EN MÓVIL / TABLA COMPACTA EN LAPTOP/DESKTOP) */}
          {vistaActual === 'lista' && (
            <div className="space-y-3">
              
              {/* --- A. VISTA TARJETAS MÓVILES (< sm) : REDISEÑADAS EN 3 FILAS SIN COLISIONES --- */}
              <div className="block sm:hidden space-y-2.5">
                {inventarioProcesado.slice(0, limiteRender).map(prod => {
                  const estaSeleccionado = productosSeleccionados.includes(prod.id);
                  const disponible = tieneStockDisponible(prod);
                  return (
                    <div 
                      key={prod.id} 
                      className={`p-3 bg-white dark:bg-[#0f172a] rounded-2xl border transition-all shadow-sm ${
                        estaSeleccionado 
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20' 
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {/* Fila 1: Checkbox + Foto + Nombre y SKU a la izquierda | Precio destacado a la derecha */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button 
                            type="button" 
                            onClick={() => toggleSeleccionProducto(prod)}
                            className="transition-colors shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {estaSeleccionado ? (
                              <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                          {prod.imagen && (
                            <img
                              src={prod.imagen}
                              alt={prod.nombre}
                              onClick={() => setFotoLightbox(prod.imagen)}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform shrink-0 shadow-xs"
                              title={`Ver foto de "${prod.nombre}"`}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-slate-900 dark:text-white text-sm truncate leading-tight">
                              {prod.nombre}
                            </h4>
                            {prod.sku && (
                              <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">
                                SKU: {prod.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 block">
                            ${(prod.precioVenta || 0).toLocaleString('es-CO')}
                          </span>
                          {(prod.precioFiado || prod.precioSepare) && (
                            <div className="flex flex-col items-end gap-0.5 mt-0.5">
                              {prod.precioFiado && (
                                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 rounded border border-amber-200 dark:border-amber-800">
                                  Fiado: ${Number(prod.precioFiado).toLocaleString('es-CO')}
                                </span>
                              )}
                              {prod.precioSepare && (
                                <span className="text-[9px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1 rounded border border-purple-200 dark:border-purple-800">
                                  Separe: ${Number(prod.precioSepare).toLocaleString('es-CO')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fila 2: Stock + Categoría a la izquierda | Acciones de Gestión (Editar / Eliminar) a la derecha */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                          {renderStockBadge(prod, 'movil')}
                          <span className="inline-flex rounded-md bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold border border-blue-100 dark:border-blue-900/40 truncate max-w-[130px] shrink-0">
                            {normalizarCategoria(prod.categoria)}
                          </span>
                        </div>

                        {(esAdmin || puedeEditarInventario) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => abrirEdicion(prod)} 
                              className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                              title="Editar producto"
                            >
                              <Edit3 size={14}/>
                            </button>
                            {esAdmin && (
                              <button 
                                onClick={() => setProductoAEliminar(prod)} 
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                                title="Eliminar producto"
                              >
                                <Trash2 size={14}/>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Fila 3: Botones táctiles de pulgar (Vender / Fiar / Separe) */}
                      <div className={`grid ${moduloSepareActivo ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5 mt-2.5`}>
                        <button 
                          onClick={() => despacharAVenta([prod])} 
                          disabled={!disponible}
                          className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                            !disponible 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50 dark:bg-slate-800 dark:text-slate-600' 
                              : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white active:scale-95 shadow-xs border border-emerald-200 dark:border-emerald-800/60'
                          }`}
                        >
                          <ShoppingCart size={13} /> <span>Vender</span>
                        </button>
                        <button 
                          onClick={() => despacharAFiar([prod])} 
                          disabled={!disponible}
                          className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                            !disponible 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50 dark:bg-slate-800 dark:text-slate-600' 
                              : 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white active:scale-95 shadow-xs border border-rose-200 dark:border-rose-800/60'
                          }`}
                        >
                          <Receipt size={13} /> <span>Fiar</span>
                        </button>
                        {moduloSepareActivo && (
                          <button 
                            onClick={() => despacharASepare([prod])} 
                            disabled={!disponible}
                            className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                              !disponible 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50 dark:bg-slate-800 dark:text-slate-600' 
                              : 'bg-violet-50 hover:bg-violet-600 text-violet-700 hover:text-white dark:bg-violet-950/40 dark:text-violet-400 dark:hover:bg-violet-600 dark:hover:text-white active:scale-95 shadow-xs border border-violet-200 dark:border-violet-800/60'
                            }`}
                          >
                            <Bookmark size={13} /> <span>Separe</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {inventarioProcesado.length === 0 && (
                  <div className="py-10 text-center text-slate-400 bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-sm">
                      {inventario.length === 0 ? "Tu inventario aún está vacío." : "No se encontraron productos con estos filtros."}
                    </p>
                    {inventario.length === 0 && (esAdmin || puedeEditarInventario || puedeIngresarInventario) && (
                      <button 
                        onClick={() => { limpiarFormulario(); setModalProducto(true); }}
                        className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                      >
                        <Plus size={15} /> Agregar Productos al Inventario
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* --- B. VISTA TABLA COMPACTA (LAPTOPS / DESKTOP sm:) : VISIBILIDAD DE 8-12 FILAS --- */}
              <div className="hidden sm:block bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617] text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider select-none">
                        
                        {/* Checkbox seleccionar todos */}
                        <th className="py-2.5 px-3 w-9 text-center">
                          <button 
                            type="button" 
                            onClick={toggleSeleccionarTodos}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors inline-flex items-center justify-center"
                            title="Seleccionar todos los productos visibles"
                          >
                            {inventarioProcesado.length > 0 && inventarioProcesado.every(p => productosSeleccionados.includes(p.id)) ? (
                              <CheckSquare size={17} className="text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square size={17} />
                            )}
                          </button>
                        </th>

                        {/* Columna Categoría */}
                        <th 
                          onClick={() => handleSort('categoria')}
                          className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Categoría</span>
                            {renderSortIndicator('categoria')}
                          </div>
                        </th>

                        {/* Columna Nombre */}
                        <th 
                          onClick={() => handleSort('nombre')}
                          className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Producto</span>
                            {renderSortIndicator('nombre')}
                          </div>
                        </th>

                        {/* Columna SKU / Código */}
                        <th 
                          onClick={() => handleSort('sku')}
                          className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>SKU / Código</span>
                            {renderSortIndicator('sku')}
                          </div>
                        </th>

                        {/* Columna Stock */}
                        <th 
                          onClick={() => handleSort('stock')}
                          className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Stock</span>
                            {renderSortIndicator('stock')}
                          </div>
                        </th>

                        {/* Columna Precio */}
                        <th 
                          onClick={() => handleSort('precioVenta')}
                          className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <span>Precio</span>
                            {renderSortIndicator('precioVenta')}
                          </div>
                        </th>

                        <th className="py-2.5 px-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm font-medium">
                      {inventarioProcesado.slice(0, limiteRender).map(prod => {
                        const estaSeleccionado = productosSeleccionados.includes(prod.id);
                        const disponible = tieneStockDisponible(prod);
                        return (
                          <tr 
                            key={prod.id} 
                            className={`transition-colors ${estaSeleccionado ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'}`}
                          >
                            
                            {/* Checkbox por fila */}
                            <td className="py-2.5 px-3 w-9 text-center">
                              <button 
                                type="button" 
                                onClick={() => toggleSeleccionProducto(prod)}
                                className="transition-colors inline-flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                title={estaSeleccionado ? "Deseleccionar" : "Seleccionar para despacho o etiquetas QR"}
                              >
                                {estaSeleccionado ? (
                                  <CheckSquare size={17} className="text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Square size={17} />
                                )}
                              </button>
                            </td>

                            {/* Categoría */}
                            <td className="py-2.5 px-3">
                              <span className="inline-flex rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-2.5 py-0.5 text-[11px] font-bold border border-blue-100 dark:border-blue-900/50 truncate max-w-[140px]">
                                {normalizarCategoria(prod.categoria)}
                              </span>
                            </td>

                            {/* Nombre del Producto con Miniatura de Foto */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2 max-w-[240px]">
                                {prod.imagen ? (
                                  <img
                                    src={prod.imagen}
                                    alt={prod.nombre}
                                    onClick={() => setFotoLightbox(prod.imagen)}
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-110 transition-transform shrink-0 shadow-xs"
                                    title={`Ver foto de "${prod.nombre}"`}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 flex items-center justify-center shrink-0 border border-dashed border-slate-200 dark:border-slate-700">
                                    <Package size={14} />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 truncate">
                                  <span className="font-bold text-slate-900 dark:text-white block truncate">{prod.nombre}</span>
                                  {prod.tipoProducto === 'servicio' && (
                                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Servicio</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* SKU */}
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                {prod.sku || 'SIN SKU'}
                              </span>
                            </td>

                            {/* Stock con Badge Inteligente */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {renderStockBadge(prod)}
                            </td>

                            {/* Precio */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 block">
                                ${(prod.precioVenta || 0).toLocaleString('es-CO')}
                              </span>
                              {(prod.precioFiado || prod.precioSepare) && (
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  {prod.precioFiado && (
                                    <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1 rounded border border-amber-200 dark:border-amber-800" title="Precio especial para fiar">
                                      Fiado: ${Number(prod.precioFiado).toLocaleString('es-CO')}
                                    </span>
                                  )}
                                  {prod.precioSepare && (
                                    <span className="text-[9px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1 rounded border border-purple-200 dark:border-purple-800" title="Precio especial para plan separe">
                                      Separe: ${Number(prod.precioSepare).toLocaleString('es-CO')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Acciones: Vender, Fiar, Separe, y si es Admin: Editar, Eliminar */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => despacharAVenta([prod])} 
                                  disabled={!disponible}
                                  title={disponible ? "Registrar venta con este producto" : "Producto agotado (Sin stock)"}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all shadow-sm ${
                                    !disponible 
                                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50' 
                                      : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white active:scale-95'
                                  }`}
                                >
                                  <ShoppingCart size={12} /> <span>Vender</span>
                                </button>
                                <button 
                                  onClick={() => despacharAFiar([prod])} 
                                  disabled={!disponible}
                                  title={disponible ? "Registrar fiado con este producto" : "Producto agotado (Sin stock)"}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all shadow-sm ${
                                    !disponible 
                                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50' 
                                      : 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white active:scale-95'
                                  }`}
                                >
                                  <Receipt size={12} /> <span>Fiar</span>
                                </button>
                                {moduloSepareActivo && (
                                  <button 
                                    onClick={() => despacharASepare([prod])} 
                                    disabled={!disponible}
                                    title={disponible ? "Registrar Plan Separe con este producto" : "Producto agotado (Sin stock)"}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all shadow-sm ${
                                      !disponible 
                                        ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50' 
                                        : 'bg-violet-50 hover:bg-violet-600 text-violet-700 hover:text-white dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-600 dark:hover:text-white active:scale-95'
                                    }`}
                                  >
                                    <Bookmark size={12} /> <span>Separe</span>
                                  </button>
                                )}

                                {(esAdmin || puedeEditarInventario) && (
                                  <>
                                    <button 
                                      onClick={() => abrirEdicion(prod)} 
                                      title="Editar producto"
                                      className="p-1 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 rounded-lg transition-colors ml-0.5"
                                    >
                                      <Edit3 size={14}/>
                                    </button>
                                    {esAdmin && (
                                      <button 
                                        onClick={() => setProductoAEliminar(prod)} 
                                        title="Eliminar producto"
                                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                                      >
                                        <Trash2 size={14}/>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}

                      {inventarioProcesado.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-400">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="font-bold text-sm">
                              {inventario.length === 0 ? "Tu inventario aún está vacío." : "No se encontraron productos con estos filtros."}
                            </p>
                            {inventario.length === 0 && (esAdmin || puedeEditarInventario || puedeIngresarInventario) ? (
                              <button 
                                onClick={() => { limpiarFormulario(); setModalProducto(true); }}
                                className="mt-3 inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                              >
                                <Plus size={15} /> Agregar Productos al Inventario
                              </button>
                            ) : (busqueda || filtrosCategoria.length > 0 || filtrosStock.length > 0) ? (
                              <button 
                                onClick={limpiarTodosLosFiltros}
                                className="mt-2 text-xs font-bold text-emerald-600 hover:underline"
                              >
                                Limpiar todos los filtros
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {limiteRender < inventarioProcesado.length && (
                <div className="mt-4 flex justify-center pb-6">
                  <button 
                    onClick={() => setLimiteRender(prev => prev + 20)}
                    className="px-6 py-3 bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm"
                  >
                    Cargar más productos...
                  </button>
                </div>
              )}

            </div>
          )}

          {/* BARRA FLOTANTE DE DESPACHO MASIVO Y ETIQUETAS (FLOTA SOBRE EL BOTTOMNAV EN MÓVIL) */}
          {productosSeleccionados.length > 0 && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[110] w-[95%] sm:w-auto max-w-4xl bg-slate-900/95 dark:bg-[#020617]/95 backdrop-blur-md text-white p-3 sm:px-5 sm:py-3 rounded-2xl md:rounded-full shadow-2xl border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 animate-in slide-in-from-bottom-5 duration-300">
              
              {/* Información de selección y total */}
              <div className="flex items-center justify-between w-full sm:w-auto gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500 text-slate-950 font-black px-2.5 py-1 rounded-full text-[11px] sm:text-xs shrink-0 shadow-sm">
                    {productosSeleccionados.length} {productosSeleccionados.length === 1 ? 'sel.' : 'sel.'}
                  </span>
                  <span className="font-bold text-slate-200 whitespace-nowrap text-xs sm:text-sm">
                    Total: <strong className="text-emerald-400 font-black">$${montoTotalSeleccionado.toLocaleString('es-CO')}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setProductosSeleccionados([])}
                  className="sm:hidden p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
                  title="Cancelar selección"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Botones de acción: Grid en móvil (2x2), fila continua en desktop */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button
                  onClick={() => despacharAVenta(productosSeleccionadosObj)}
                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 sm:px-3.5 py-2 sm:py-2 rounded-xl sm:rounded-full text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <ShoppingCart size={14} /> <span>Vender ({productosSeleccionadosObj.filter(tieneStockDisponible).length})</span>
                </button>
                <button
                  onClick={() => despacharAFiar(productosSeleccionadosObj)}
                  className="inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black px-3 sm:px-3.5 py-2 sm:py-2 rounded-xl sm:rounded-full text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <Receipt size={14} /> <span>Fiar ({productosSeleccionadosObj.filter(tieneStockDisponible).length})</span>
                </button>
                {moduloSepareActivo && (
                  <button
                    onClick={() => despacharASepare(productosSeleccionadosObj)}
                    className="inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white font-black px-3 sm:px-3.5 py-2 sm:py-2 rounded-xl sm:rounded-full text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Bookmark size={14} /> <span>Separar ({productosSeleccionadosObj.filter(tieneStockDisponible).length})</span>
                    {!datosSesion?.esPro && <Crown size={12} className="text-amber-300 ml-0.5" />}
                  </button>
                )}
                {esAdmin && (
                  <button
                    onClick={() => {
                      if (!datosSesion?.esPro) {
                        setModalUpsell({
                          visible: true,
                          titulo: "Etiquetas Adhesivas para Productos",
                          mensaje: "Genera e imprime etiquetas con Código de Barras o QR, Nombre y Precio para pegar en tus prendas o estanterías y cobrar en 1 segundo.",
                          plan: 'pro'
                        });
                        return;
                      }
                      setOrigenExportacion('seleccionados');
                      setModalExportarQR(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-3 sm:px-3.5 py-2 sm:py-2 rounded-xl sm:rounded-full text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Tag size={14} /> <span>Etiquetas ({productosSeleccionados.length})</span>
                  </button>
                )}
                <button
                  onClick={() => setProductosSeleccionados([])}
                  className="hidden sm:inline-flex p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors shrink-0 cursor-pointer ml-1"
                  title="Cancelar selección"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL INFORMATIVO Y CONFIRMACIÓN DE EXPORTACIÓN A EXCEL */}
      {esAdmin && modalExportarExcel && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setModalExportarExcel(false); }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
            
            {/* Header del Modal */}
            <div className="p-6 md:p-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Exportar Inventario a Excel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Descarga tu catálogo real con diseño corporativo y formato listo para editar
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalExportarExcel(false)} 
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 md:p-7 overflow-y-auto space-y-6 flex-1">
              
              {/* Tarjeta de Resumen de Exportación */}
              <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-[#0f172a] rounded-3xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                    Resumen del catálogo a descargar
                  </span>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {inventarioProcesado.length} productos / servicios
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Incluye <strong>{metricas.unidadesFisicasTotales} unidades en tienda</strong> con un valor total de <strong>${metricas.valorTotal.toLocaleString('es-CO')}</strong>.
                  </p>
                </div>
                <div className="p-3 bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0">
                  <Package size={28} />
                </div>
              </div>

              {/* ¿Para qué sirve este archivo? - Flujo Inteligente */}
              <div className="space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" /> ¿Cómo funciona el ciclo inteligente de actualización?
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block mb-1">
                      1. Edita Precios o Stock
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Abre el archivo en tu computador y cambia los valores de tus productos existentes.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 block mb-1">
                      2. Agrega Nuevos
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Escribe nuevos artículos en las filas vacías al final de la tabla usando las listas desplegables.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400 block mb-1">
                      3. Sube en "Importar"
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Fiabono sincronizará los viejos y creará los nuevos automáticamente sin duplicados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Características del archivo */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span>El archivo descargado incluye:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <li>Diseño corporativo esmeralda con tipografía Segoe UI y sombreado zebra.</li>
                  <li>Listas desplegables en <strong>Tipo de Producto</strong>, <strong>Categoría</strong> e <strong>Inventariable</strong>.</li>
                  <li>Tarjeta de ejemplos de referencia en las columnas laterales.</li>
                  <li>Hoja secundaria de <strong>Datos</strong> con tus categorías activas.</li>
                </ul>
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="p-5 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => setModalExportarExcel(false)} 
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold py-3 px-5 rounded-2xl text-sm border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Cancelar
              </button>

              <button 
                type="button"
                onClick={async () => {
                  setModalExportarExcel(false);
                  await exportarInventarioAExcel();
                }} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
              >
                <Download size={18} /> Descargar Archivo Excel (.xlsx)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL IMPORTAR INVENTARIO DESDE EXCEL */}
      {esAdmin && modalImportarExcel && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget && !importandoAFirestore) {
              setModalImportarExcel(false);
              setProductosAImportar([]);
            }
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90dvh]">
            
            {/* Header del Modal */}
            <div className="p-6 md:p-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Importar Inventario desde Excel
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Carga masivamente tu catálogo de productos y servicios usando la plantilla oficial
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setModalImportarExcel(false); setProductosAImportar([]); }} 
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 md:p-7 overflow-y-auto space-y-6 flex-1">
              
              {/* ETAPA 1: Si aún no se ha subido/procesado un archivo con productos */}
              {productosAImportar.length === 0 ? (
                <div className="space-y-6">
                  
                  {/* Dos Opciones Claras: Plantilla en Blanco vs Archivo Exportado para Actualizar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    
                    {/* Opción 1: Plantilla en Blanco */}
                    <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-[#0f172a] rounded-3xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-sm">
                            <Download size={18} />
                          </span>
                          <h4 className="font-black text-slate-900 dark:text-white text-sm">
                            Plantilla Oficial en Blanco
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Descarga este formato <strong>vacío sin productos previos</strong> si vas a ingresar tu catálogo desde cero por primera vez.
                        </p>
                      </div>

                      <a
                        href="/plantillas/Formato_Inventario_Fiabono.xlsx"
                        download="Formato_Inventario_Fiabono.xlsx"
                        className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 text-center"
                      >
                        <Download size={15} /> Descargar Plantilla Vacía (.xlsx)
                      </a>
                    </div>

                    {/* Opción 2: Actualizar Inventario Existente */}
                    <div className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-[#0f172a] rounded-3xl border border-blue-200/80 dark:border-blue-800/60 shadow-sm flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                            <RefreshCw size={18} />
                          </span>
                          <h4 className="font-black text-slate-900 dark:text-white text-sm">
                            ¿Deseas actualizar productos existentes?
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Usa el botón <strong>Exportar Excel</strong> en la barra superior. Ese archivo ya contiene tus productos reales con sus SKUs para que los modifiques y los vuelvas a subir aquí.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setModalImportarExcel(false);
                          setModalExportarExcel(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-blue-600/20 active:scale-95 text-center cursor-pointer"
                      >
                        <FileSpreadsheet size={15} /> Ver Exportar Inventario Actual
                      </button>
                    </div>

                  </div>

                  {/* Guía Rápida de Diligenciamiento en 3 Pasos */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-500" /> Instrucciones para diligenciar la plantilla:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block mb-1">
                          1. Hoja "Inventario"
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Escribe cada producto o servicio a partir de la fila 2 en adelante.
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 block mb-1">
                          2. Listas Desplegables
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Selecciona <strong>Producto / Servicio</strong> y si es inventariable <strong>Sí / No</strong> con la flechita.
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-black text-purple-600 dark:text-purple-400 block mb-1">
                          3. Hoja "Datos"
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Contiene las categorías. Puedes agregar nuevas categorías hacia abajo.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Zona de Subida de Archivo */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Upload size={14} className="text-emerald-500" /> Sube tu archivo completado:
                    </span>
                    
                    <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-900/30 hover:bg-emerald-50/20 group">
                      <input 
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={procesarArchivoExcel} 
                        className="hidden" 
                        disabled={procesandoArchivoExcel}
                      />
                      
                      <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        {procesandoArchivoExcel ? (
                          <RefreshCw size={28} className="animate-spin" />
                        ) : (
                          <Upload size={28} />
                        )}
                      </div>

                      <h4 className="font-black text-slate-900 dark:text-white text-base">
                        {procesandoArchivoExcel ? "Analizando archivo Excel..." : "Haz clic aquí para seleccionar tu archivo Excel"}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Formatos compatibles: .xlsx, .xls o .csv
                      </p>
                    </label>
                  </div>

                </div>
              ) : (
                /* ETAPA 2: Previsualización de los Productos detectados */
                <div className="space-y-4">
                  {/* Resumen de Detección */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                        Total en archivo: <strong>{productosAImportar.length}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {productosAImportar.filter(p => p.accion === 'crear').length} Nuevos
                      </span>
                      {productosAImportar.filter(p => p.accion === 'actualizar').length > 0 && (
                        <span className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {productosAImportar.filter(p => p.accion === 'actualizar').length} Existentes a actualizar
                        </span>
                      )}
                    </div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer underline">
                      Cambiar archivo
                      <input type="file" accept=".xlsx, .xls, .csv" onChange={procesarArchivoExcel} className="hidden" />
                    </label>
                  </div>

                  {/* Selector de Modo de Stock (solo si hay existentes a actualizar) */}
                  {productosAImportar.some(p => p.accion === 'actualizar') && (
                    <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-black text-blue-950 dark:text-blue-200 block text-xs">
                          ¿Cómo deseas actualizar el stock de los productos que ya existen?
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          Aplica para los productos que ya están registrados en tu tienda
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 bg-white/80 dark:bg-slate-900/80 p-1 rounded-xl border border-blue-200 dark:border-blue-800">
                        <button
                          type="button"
                          onClick={() => setModoActualizacionStock('reemplazar')}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            modoActualizacionStock === 'reemplazar'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Reemplazar stock
                        </button>
                        <button
                          type="button"
                          onClick={() => setModoActualizacionStock('sumar')}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            modoActualizacionStock === 'sumar'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Sumar al actual
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tabla de Previsualización con Scroll */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] sticky top-0">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Acción</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Categoría</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Nombre</th>
                          <th className="p-3 text-center">Inv.</th>
                          <th className="p-3 text-right">Precio</th>
                          <th className="p-3 text-center">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {productosAImportar.map((prod, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="p-3">
                              {prod.accion === 'actualizar' ? (
                                <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                  Actualizará
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                  Nuevo
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                prod.tipoProducto === 'servicio' 
                                  ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' 
                                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {prod.tipoProducto === 'servicio' ? 'Servicio' : 'Producto'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-300 capitalize">{prod.categoria}</td>
                            <td className="p-3 font-mono text-slate-500 text-[11px]">{prod.sku || '(Auto)'}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[180px] truncate">{prod.nombre}</td>
                            <td className="p-3 text-center">
                              {prod.inventariable ? 'Sí' : 'No'}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
                              ${(prod.precioVenta || 0).toLocaleString('es-CO')}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                              {prod.tipoProducto === 'servicio' || !prod.inventariable ? (
                                '—'
                              ) : prod.accion === 'actualizar' ? (
                                <span className="text-[11px]">
                                  {modoActualizacionStock === 'sumar' 
                                    ? `${prod.stockAnterior} + ${prod.stock} = ${(Number(prod.stockAnterior) || 0) + (Number(prod.stock) || 0)}`
                                    : `${prod.stock} (Era ${prod.stockAnterior})`}
                                </span>
                              ) : (
                                prod.stock
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Footer del Modal con Acciones */}
            <div className="p-5 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
              <button 
                type="button"
                onClick={() => { setModalImportarExcel(false); setProductosAImportar([]); }} 
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold py-3 px-5 rounded-2xl text-sm border border-slate-200 dark:border-slate-700 transition-colors"
                disabled={importandoAFirestore}
              >
                Cancelar
              </button>

              {productosAImportar.length > 0 && (
                <button 
                  type="button"
                  onClick={guardarProductosImportados} 
                  disabled={importandoAFirestore}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                >
                  {importandoAFirestore ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" /> Guardando en Inventario...
                    </>
                  ) : (
                    <>
                      <Upload size={17} /> Confirmar e Importar ({productosAImportar.length} productos)
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL ESCÁNER DE INVENTARIO CON CÁMARA (ALIMENTADOR DEL FORMULARIO) */}
      <EscanerInventarioModal 
        isOpen={modalEscanerInventario} 
        onClose={() => {
          setModalEscanerInventario(false);
          setModalProducto(true);
        }} 
        cuentaPrincipalId={cuentaPrincipalId || ""} 
        nombreUsuario={datosSesion?.nombreUsuario || "Usuario"} 
        esAdmin={esAdmin}
        categoriasDisponibles={categoriasDisponibles}
        inventario={inventario}
        productosEnCarga={productosEnCarga}
        onAgregarOActualizarProducto={agregarOActualizarProductoEnCarga}
        onRemoverProducto={quitarProductoEnCarga}
        onModificarCantidad={modificarCantidadProductoEnCarga}
        onVolverAlFormulario={(codigoPrecargado) => {
          setModalEscanerInventario(false);
          if (codigoPrecargado) {
            setSku(codigoPrecargado);
            toast.success(`Código "${codigoPrecargado}" cargado en el formulario.`);
          }
          setModalProducto(true);
        }}
      />
      {esAdmin && modalExportarQR && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setModalExportarQR(false); }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[92dvh]">
            
            {/* Header del Modal */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Exportar Etiquetas de Inventario
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Imprime en Códigos de Barras (1D) o QR (2D) para impresoras térmicas y de oficina
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalExportarQR(false)} 
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cuerpo del Modal con Scroll */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* PASO 0: Formato de Código (QR 2D Prioritario vs Barras 1D) */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <QrCode size={15} className="text-emerald-500" /> 1. ¿Qué tipo de código deseas generar?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Código QR 2D (Prioridad por defecto / Recomendado) */}
                  <div
                    onClick={() => setFormatoCodigoEtiqueta('qr')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      formatoCodigoEtiqueta === 'qr'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                      Recomendado
                    </span>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <QrCode size={18} className="text-emerald-600" /> Código QR (2D)
                      </span>
                      <CheckCircle2 size={16} className={formatoCodigoEtiqueta === 'qr' ? "text-emerald-600" : "text-slate-300"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Lectura instantánea con la cámara de cualquier celular y pistolas 2D.
                    </p>
                  </div>

                  {/* Código de Barras 1D */}
                  <div
                    onClick={() => setFormatoCodigoEtiqueta('barras')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      formatoCodigoEtiqueta === 'barras'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 bg-slate-700 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                      Pistolas Láser
                    </span>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Barcode size={18} className="text-blue-600" /> Código de Barras (1D)
                      </span>
                      <CheckCircle2 size={16} className={formatoCodigoEtiqueta === 'barras' ? "text-emerald-600" : "text-slate-300"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Para pistolas lectoras tradicionales de mostrador (raya roja).
                    </p>
                  </div>

                </div>
              </div>

              {/* PASO 1: Tipo de Impresora */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Printer size={14} className="text-emerald-500" /> 2. ¿En qué tipo de impresora vas a imprimir?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Impresora Térmica en Rollo */}
                  <div
                    onClick={() => setTipoImpresoraQR('termica')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      tipoImpresoraQR === 'termica'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                      Jaltech / POS
                    </span>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        Impresora Térmica (Rollo)
                      </span>
                      <CheckCircle2 size={16} className={tipoImpresoraQR === 'termica' ? "text-emerald-600" : "text-slate-300"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      1 sticker por página en milímetros exactos. Ideal para Jaltech POS, Digital POS, Zebra, Xprinter.
                    </p>
                  </div>

                  {/* Hoja de Oficina */}
                  <div
                    onClick={() => setTipoImpresoraQR('hoja')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      tipoImpresoraQR === 'hoja'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        Hoja Carta / A4 (Oficina)
                      </span>
                      <CheckCircle2 size={16} className={tipoImpresoraQR === 'hoja' ? "text-emerald-600" : "text-slate-300"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cuadrícula multi-etiqueta en hoja completa para impresoras de inyección o láser estándar.
                    </p>
                  </div>

                </div>
              </div>

              {/* PASO 2: Medidas y Tamaño */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Maximize2 size={14} className="text-emerald-500" /> 3. Tamaño del rollo / etiqueta
                </label>

                {tipoImpresoraQR === 'termica' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      
                      {/* 32x25 */}
                      <div
                        onClick={() => setTamanoTermicoQR('32x25')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          tamanoTermicoQR === '32x25'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">32 × 25 mm</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Miniatura / Artículos pequeños</p>
                      </div>

                      {/* 40x30 */}
                      <div
                        onClick={() => setTamanoTermicoQR('40x30')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer relative ${
                          tamanoTermicoQR === '40x30'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <span className="absolute -top-2 right-2 bg-emerald-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full">
                          Estándar
                        </span>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">40 × 30 mm</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Estándar comercio (Más usado)</p>
                      </div>

                      {/* 50x25 */}
                      <div
                        onClick={() => setTamanoTermicoQR('50x25')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          tamanoTermicoQR === '50x25'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">50 × 25 mm</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Alargada horizontal (QR al lado)</p>
                      </div>

                      {/* 50x30 */}
                      <div
                        onClick={() => setTamanoTermicoQR('50x30')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer relative ${
                          tamanoTermicoQR === '50x30'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <span className="absolute -top-2 right-2 bg-blue-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full">
                          Universal
                        </span>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">50 × 30 mm</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Universal (Ropa, calzado, cajas)</p>
                      </div>

                      {/* 58x40 */}
                      <div
                        onClick={() => setTamanoTermicoQR('58x40')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          tamanoTermicoQR === '58x40'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">58 × 40 mm</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Ancho completo POS 58mm</p>
                      </div>

                      {/* 80x50 */}
                      <div
                        onClick={() => setTamanoTermicoQR('80x50')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          tamanoTermicoQR === '80x50'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">80 × 50 mm</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Formato grande POS 80mm</p>
                      </div>

                      {/* Personalizado */}
                      <div
                        onClick={() => setTamanoTermicoQR('personalizado')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          tamanoTermicoQR === 'personalizado'
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-xs text-slate-900 dark:text-white">Personalizado</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Medida personalizada (mm)</p>
                      </div>

                    </div>

                    {tamanoTermicoQR === 'personalizado' && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 animate-in fade-in duration-200">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-slate-500 block mb-1">Ancho (mm):</label>
                          <input
                            type="number"
                            min={20}
                            max={100}
                            value={anchoPersonalizadoMM}
                            onChange={(e) => setAnchoPersonalizadoMM(Math.max(10, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-slate-500 block mb-1">Alto (mm):</label>
                          <input
                            type="number"
                            min={15}
                            max={120}
                            value={altoPersonalizadoMM}
                            onChange={(e) => setAltoPersonalizadoMM(Math.max(10, Number(e.target.value)))}
                            className="w-full px-3 py-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      onClick={() => setTamanoEtiqueta('compacto')}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        tamanoEtiqueta === 'compacto'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm text-slate-900 dark:text-white">Compacto</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold">4×3.4 cm</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">4 col / hoja (24 por página)</p>
                    </div>

                    <div
                      onClick={() => setTamanoEtiqueta('estandar')}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        tamanoEtiqueta === 'estandar'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm text-slate-900 dark:text-white">Estándar</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold">5.8×4.8 cm</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">3 col / hoja (15 por página)</p>
                    </div>

                    <div
                      onClick={() => setTamanoEtiqueta('grande')}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        tamanoEtiqueta === 'grande'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-sm text-slate-900 dark:text-white">Grande</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold">9×5.6 cm</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">2 col / hoja (8 por página)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* PASO 3: ¿Qué productos etiquetar? */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Package size={14} className="text-emerald-500" /> 4. ¿Qué productos deseas etiquetar?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Seleccionados en la tabla */}
                  <div
                    onClick={() => {
                      if (productosSeleccionados.length > 0) setOrigenExportacion('seleccionados');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      productosSeleccionados.length === 0 
                        ? 'opacity-40 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-900/30' 
                        : origenExportacion === 'seleccionados'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Seleccionados</span>
                      <CheckSquare size={16} className={origenExportacion === 'seleccionados' && productosSeleccionados.length > 0 ? "text-emerald-600" : "text-slate-400"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {productosSeleccionados.length > 0 
                        ? `${productosSeleccionados.length} productos marcados en tabla`
                        : "Ningún producto marcado"}
                    </p>
                  </div>

                  {/* Nuevos por fecha */}
                  <div
                    onClick={() => setOrigenExportacion('fecha')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      origenExportacion === 'fecha'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Por fecha</span>
                      <Calendar size={16} className={origenExportacion === 'fecha' ? "text-emerald-600" : "text-slate-400"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Nuevos o ingresados recientemente
                    </p>
                  </div>

                  {/* Todo el catálogo filtrado */}
                  <div
                    onClick={() => setOrigenExportacion('todos')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      origenExportacion === 'todos'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Catálogo actual</span>
                      <Boxes size={16} className={origenExportacion === 'todos' ? "text-emerald-600" : "text-slate-400"} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {inventarioProcesado.length} productos filtrados
                    </p>
                  </div>

                </div>

                {/* Sub-selector de fechas si eligió 'Por fecha' */}
                {origenExportacion === 'fecha' && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Selecciona el rango de registro:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setFiltroFechaExportacion('hoy')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          filtroFechaExportacion === 'hoy'
                            ? 'bg-emerald-600 text-white shadow-sm font-black'
                            : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        Creados hoy
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroFechaExportacion('7dias')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          filtroFechaExportacion === '7dias'
                            ? 'bg-emerald-600 text-white shadow-sm font-black'
                            : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        Últimos 7 días
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroFechaExportacion('personalizado')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          filtroFechaExportacion === 'personalizado'
                            ? 'bg-emerald-600 text-white shadow-sm font-black'
                            : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        Desde fecha específica
                      </button>
                    </div>

                    {filtroFechaExportacion === 'personalizado' && (
                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-xs font-bold text-slate-500">Ingresados desde:</label>
                        <input
                          type="date"
                          value={fechaDesdePersonalizada}
                          onChange={(e) => setFechaDesdePersonalizada(e.target.value)}
                          className="px-3 py-1.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PASO 4: Cantidad de etiquetas inteligente */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-500" /> 5. Cantidad de etiquetas por producto
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  
                  {/* Stock */}
                  <div
                    onClick={() => setModoCantidadQR('stock')}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      modoCantidadQR === 'stock'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-black text-xs text-slate-900 dark:text-white block mb-0.5">
                      Según Stock
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">1 por unidad disponible</p>
                  </div>

                  {/* 1 por referencia */}
                  <div
                    onClick={() => setModoCantidadQR('uno')}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      modoCantidadQR === 'uno'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-black text-xs text-slate-900 dark:text-white block mb-0.5">
                      1 por Producto
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Vitrinas o exhibidores</p>
                  </div>

                  {/* Cantidad Fija */}
                  <div
                    onClick={() => setModoCantidadQR('fijo')}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      modoCantidadQR === 'fijo'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-black text-xs text-slate-900 dark:text-white block mb-0.5">
                      Cantidad Fija
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Mismo número a todos</p>
                  </div>

                  {/* Selectivo Inteligente */}
                  <div
                    onClick={() => setModoCantidadQR('selectivo')}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer relative ${
                      modoCantidadQR === 'selectivo'
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="absolute -top-2 right-2 bg-emerald-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full">
                      Personalizado
                    </span>
                    <span className="font-black text-xs text-slate-900 dark:text-white block mb-0.5">
                      Selectivo Pro
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Elegir cantidad por producto</p>
                  </div>

                </div>

                {/* Sub-selector si eligió Fijo */}
                {modoCantidadQR === 'fijo' && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 animate-in fade-in duration-200">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Imprimir exactamente:</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCantidadFijaQR(Math.max(1, cantidadFijaQR - 1))}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-sm active:scale-90"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={cantidadFijaQR}
                        onChange={(e) => setCantidadFijaQR(Math.max(1, Number(e.target.value)))}
                        className="w-16 text-center py-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setCantidadFijaQR(cantidadFijaQR + 1)}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-sm active:scale-90"
                      >
                        +
                      </button>
                      <span className="text-xs text-slate-500 font-medium">etiquetas de cada producto</span>
                    </div>
                  </div>
                )}

                {/* Panel Selectivo Pro: Lista interactiva de productos con contadores */}
                {modoCantidadQR === 'selectivo' && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Ajusta la cantidad exacta para cada referencia:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mapa: Record<string, number> = {};
                            productosParaExportarQR.forEach(p => {
                              mapa[p.id] = Number(p.stock) > 0 ? Number(p.stock) : 1;
                            });
                            setCantidadesSelectivasQR(mapa);
                          }}
                          className="text-[10px] font-black bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 active:scale-95"
                        >
                          Todos a stock
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const mapa: Record<string, number> = {};
                            productosParaExportarQR.forEach(p => { mapa[p.id] = 1; });
                            setCantidadesSelectivasQR(mapa);
                          }}
                          className="text-[10px] font-black bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 active:scale-95"
                        >
                          Todos a 1
                        </button>
                      </div>
                    </div>

                    {/* Buscador dentro del selector */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto en la lista para cambiar cantidad..."
                        value={busquedaModalSelectivoQR}
                        onChange={(e) => setBusquedaModalSelectivoQR(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Lista scrollable de productos */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                      {productosParaExportarQR
                        .filter(p => !busquedaModalSelectivoQR || p.nombre?.toLowerCase().includes(busquedaModalSelectivoQR.toLowerCase()) || p.sku?.toLowerCase().includes(busquedaModalSelectivoQR.toLowerCase()))
                        .map(prod => {
                          const cantActual = cantidadesSelectivasQR[prod.id] !== undefined 
                            ? cantidadesSelectivasQR[prod.id] 
                            : (Number(prod.stock) > 0 ? Number(prod.stock) : 1);

                          return (
                            <div key={prod.id} className="pt-1.5 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {prod.nombre}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  SKU: {prod.sku || 'N/A'} • Stock: {prod.stock || 0} • ${(prod.precioVenta || 0).toLocaleString('es-CO')}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => actualizarCantidadSelectiva(prod.id, -1)}
                                  className="w-7 h-7 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-xs hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={500}
                                  value={cantActual}
                                  onChange={(e) => fijarCantidadSelectiva(prod.id, Number(e.target.value))}
                                  className={`w-12 text-center py-1 bg-white dark:bg-[#0f172a] border rounded-lg font-black text-xs ${
                                    cantActual > 0 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-400'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => actualizarCantidadSelectiva(prod.id, 1)}
                                  className="w-7 h-7 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-xs hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* PASO 5: Información a incluir en cada etiqueta */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Tag size={14} className="text-emerald-500" /> 6. Datos impresos en el sticker
                  </label>
                  <span className="text-[10px] font-black bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-0.5 rounded-full">
                    Impresión Nítida: 100% Negrilla + Negro Puro
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionNegocio} onChange={(e) => setOpcionNegocio(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Nombre Negocio</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionNombre} onChange={(e) => setOpcionNombre(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Nombre Producto</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionSku} onChange={(e) => setOpcionSku(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">SKU / Código</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionPrecio} onChange={(e) => setOpcionPrecio(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Precio de Venta</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionCategoria} onChange={(e) => setOpcionCategoria(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Categoría</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border select-none transition-colors ${opcionFechaIngreso ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'}`}>
                    <input type="checkbox" checked={opcionFechaIngreso} onChange={(e) => setOpcionFechaIngreso(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Fecha de Ingreso</span>
                  </label>

                  <label className={`flex items-center justify-between gap-2 p-2.5 rounded-xl cursor-pointer border select-none transition-colors col-span-2 sm:col-span-3 ${opcionTopeRebaja ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 ring-1 ring-amber-500/20' : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={opcionTopeRebaja} onChange={(e) => setOpcionTopeRebaja(e.target.checked)} className="w-4 h-4 accent-amber-600 rounded" />
                      <span className="font-black text-slate-900 dark:text-white text-xs">Tope de Rebaja para Vendedores (Clave Discreta o Explícito)</span>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
                      Nuevo
                    </span>
                  </label>

                </div>

                {/* Panel configurable de Tope de Rebaja con explicación de Clave Discreta */}
                {opcionTopeRebaja && (
                  <div className="p-3.5 sm:p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Selector $ vs % y Valor */}
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 block">
                          ¿Cuánto es el máximo a rebajar?
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="flex bg-white dark:bg-[#0f172a] p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setModoTopeRebaja('pesos');
                                if (Number(String(valorTopeRebaja).replace(/\D/g, '')) <= 100) {
                                  setValorTopeRebaja('2.000');
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${modoTopeRebaja === 'pesos' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                              $ Pesos
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModoTopeRebaja('porcentaje');
                                if (Number(String(valorTopeRebaja).replace(/\D/g, '')) > 100) {
                                  setValorTopeRebaja('10');
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${modoTopeRebaja === 'porcentaje' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                            >
                              % Porc.
                            </button>
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={valorTopeRebaja}
                            onChange={(e) => {
                              const limpio = e.target.value.replace(/\D/g, '');
                              if (modoTopeRebaja === 'porcentaje') {
                                const num = Math.min(90, Number(limpio || 0));
                                setValorTopeRebaja(limpio ? String(num) : '');
                              } else {
                                setValorTopeRebaja(formatearMonedaInput(limpio));
                              }
                            }}
                            placeholder={modoTopeRebaja === 'pesos' ? 'Ej. 3.000' : 'Ej. 10'}
                            className="w-full py-1.5 px-2.5 bg-white dark:bg-[#0f172a] border border-amber-300 dark:border-amber-700 rounded-xl font-black text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {/* Selector de Formato: Clave Discreta R-X vs Clave M-X vs Explícito */}
                      <div className="sm:col-span-7 space-y-1">
                        <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 block">
                          ¿Cómo mostrarlo en el sticker?
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setFormatoTopeEtiqueta('clave_rebaja')}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                              formatoTopeEtiqueta === 'clave_rebaja'
                                ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                            }`}
                          >
                            <span className="text-[11px] font-black text-slate-900 dark:text-white block">🔒 Clave R-X</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Ej: R-3 (Rebaja 3mil)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormatoTopeEtiqueta('clave_minimo')}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                              formatoTopeEtiqueta === 'clave_minimo'
                                ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                            }`}
                          >
                            <span className="text-[11px] font-black text-slate-900 dark:text-white block">🔒 Clave M-X</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Ej: M-22 (Mín 22mil)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormatoTopeEtiqueta('explicito')}
                            className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                              formatoTopeEtiqueta === 'explicito'
                                ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-amber-300'
                            }`}
                          >
                            <span className="text-[11px] font-black text-slate-900 dark:text-white block">👁️ Explícito</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">Mín: $22.000</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Explicación clara con ejemplo en vivo para que el usuario y sus vendedores entiendan la clave */}
                    {(() => {
                      const prodEjemplo = productosParaExportarQR[0] || { nombre: 'Camiseta Básica Pro', precioVenta: 25000, costoCompra: 15000 };
                      const calculo = calcularDatosTopeRebaja(prodEjemplo);
                      return (
                        <div className="p-2.5 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-amber-200/70 dark:border-amber-800/50 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                          {formatoTopeEtiqueta === 'clave_rebaja' && (
                            <p>
                              💡 <strong>¿Cómo lee tu vendedor la Clave <span className="font-mono font-black text-slate-900 dark:text-white px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">{calculo.textoEtiqueta}</span>?</strong>{' '}
                              La <strong>"R"</strong> significa <strong>Rebaja máxima en miles</strong>. En <em>"{prodEjemplo.nombre}"</em> (${calculo.precio.toLocaleString('es-CO')}), al ver <strong>{calculo.textoEtiqueta}</strong> tu vendedor sabe que puede rebajar hasta <strong>${calculo.rebajaReal.toLocaleString('es-CO')}</strong> (cobrando mínimo <strong>${calculo.precioMinimo.toLocaleString('es-CO')}</strong>), sin que el cliente sospeche que tiene descuento.
                            </p>
                          )}
                          {formatoTopeEtiqueta === 'clave_minimo' && (
                            <p>
                              💡 <strong>¿Cómo lee tu vendedor la Clave <span className="font-mono font-black text-slate-900 dark:text-white px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">{calculo.textoEtiqueta}</span>?</strong>{' '}
                              La <strong>"M"</strong> significa <strong>Precio Mínimo en miles</strong>. En <em>"{prodEjemplo.nombre}"</em> (${calculo.precio.toLocaleString('es-CO')}), al ver <strong>{calculo.textoEtiqueta}</strong> tu vendedor sabe que lo mínimo en que puede dejarlo es <strong>${calculo.precioMinimo.toLocaleString('es-CO')}</strong>, sin que el cliente lo descifre.
                            </p>
                          )}
                          {formatoTopeEtiqueta === 'explicito' && (
                            <p>
                              👁️ <strong>Modo Explícito (<span className="font-mono font-black text-slate-900 dark:text-white px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 rounded">{calculo.textoEtiqueta}</span>):</strong>{' '}
                              Se imprimirá el precio mínimo visible directamente en la etiqueta. Ideal si tus etiquetas van en catálogo interno o ventas mayoristas.
                            </p>
                          )}
                          {calculo.protegidoPorCosto && (
                            <p className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                              🛡️ Protección activa: El tope se ajustó automáticamente para nunca bajar del costo del lote más caro (${calculo.costoMaxLote.toLocaleString('es-CO')}).
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* VISTA PREVIA EN VIVO (LIVE PREVIEW) */}
              <div className="p-4 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Vista Previa del Sticker (Diseño Boutique de Esquinas • Cero Textos Cortados)
                </span>
                
                {/* Contenedor simulado del sticker en proporción real 4:3 (100% negro puro y negrilla) */}
                <div
                  style={{ width: '250px', maxWidth: '100%' }}
                  className="bg-white text-black p-3.5 rounded-xl shadow-md border-2 border-slate-300 flex flex-col justify-between gap-1.5 mx-auto"
                >
                  {/* Fila 1: Esquinas Superiores (Negocio Izq | Categoría Der) */}
                  {(opcionNegocio || opcionCategoria) && (
                    <div className="flex items-baseline justify-between gap-2 w-full border-b border-black pb-1">
                      <span className="text-[9.5px] font-black text-black uppercase leading-tight text-left break-words">
                        {opcionNegocio ? (datosSesion?.nombreNegocio || "MI NEGOCIO") : ""}
                      </span>
                      <span className="text-[9px] font-black text-black uppercase tracking-wider leading-tight text-right break-words ml-auto">
                        {opcionCategoria ? normalizarCategoria(productosParaExportarQR[0]?.categoria || "General") : ""}
                      </span>
                    </div>
                  )}

                  {/* Fila 2: Nombre del Producto Completo (100% ancho sin cortar) */}
                  {opcionNombre && (
                    <div className="text-xs font-black text-black leading-tight text-left break-words w-full">
                      {productosParaExportarQR[0]?.nombre || "Camisa Polo Manga Corta Gris"}
                    </div>
                  )}

                  {/* Fila 3: Cuerpo Inferior Asimétrico (QR Izq + Datos Der) o Barras Ancho Completo + Esquinas Inferiores */}
                  {formatoCodigoEtiqueta === 'qr' ? (
                    <div className="flex items-center justify-between gap-2.5 w-full pt-0.5">
                      <div className="p-1 bg-white border border-slate-200 rounded-lg shrink-0">
                        <QrCode size={52} className="text-black" />
                      </div>
                      <div className="flex-1 flex flex-col items-end justify-between text-right min-w-0 gap-1">
                        {opcionSku && (
                          <span className="text-[10px] font-black text-black leading-none break-all">
                            {formatearTextoSKU(productosParaExportarQR[0]?.sku || "SKU-7773")}
                          </span>
                        )}
                        {opcionPrecio && (
                          <span className="text-base font-black text-black leading-none tracking-tight my-0.5">
                            ${(productosParaExportarQR[0]?.precioVenta || 25000).toLocaleString('es-CO')}
                          </span>
                        )}
                        {(opcionFechaIngreso || opcionTopeRebaja) && (
                          <div className="flex flex-wrap items-center justify-end gap-1 leading-none">
                            {opcionFechaIngreso && (
                              <span className="text-[9.5px] font-black text-black">
                                ING:{obtenerFechaIngresoEtiqueta(productosParaExportarQR[0])}
                              </span>
                            )}
                            {opcionTopeRebaja && (
                              <span className="text-[9.5px] font-black text-black border border-black px-1 py-0.5 rounded">
                                {calcularDatosTopeRebaja(productosParaExportarQR[0]).textoEtiqueta}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col w-full gap-1 pt-0.5">
                      <div 
                        className="w-full flex items-center justify-center overflow-hidden" 
                        dangerouslySetInnerHTML={{ 
                          __html: generarSvgCodigoBarras(productosParaExportarQR[0]?.sku || "SKU-7773", { width: 1.5, height: 26, displayValue: false }) 
                        }} 
                      />
                      <div className="flex items-end justify-between gap-2 w-full pt-0.5">
                        <div className="flex flex-col items-start text-left min-w-0 gap-0.5">
                          {opcionSku && (
                            <span className="text-[9.5px] font-black text-black leading-none break-all">
                              {formatearTextoSKU(productosParaExportarQR[0]?.sku || "SKU-7773")}
                            </span>
                          )}
                          {(opcionFechaIngreso || opcionTopeRebaja) && (
                            <div className="flex flex-wrap items-center gap-1 leading-none">
                              {opcionFechaIngreso && (
                                <span className="text-[9px] font-black text-black">
                                  ING:{obtenerFechaIngresoEtiqueta(productosParaExportarQR[0])}
                                </span>
                              )}
                              {opcionTopeRebaja && (
                                <span className="text-[9px] font-black text-black border border-black px-1 py-0.5 rounded">
                                  {calcularDatosTopeRebaja(productosParaExportarQR[0]).textoEtiqueta}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {opcionPrecio && (
                          <span className="text-sm font-black text-black leading-none text-right shrink-0 ml-auto">
                            ${(productosParaExportarQR[0]?.precioVenta || 25000).toLocaleString('es-CO')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer con Resumen Dinámico y Botones */}
            <div className="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 dark:text-slate-300 w-full sm:w-auto text-center sm:text-left">
                <span className="font-medium text-slate-400 block text-[11px]">Resumen de exportación:</span>
                <strong>{productosParaExportarQR.length} referencias</strong> seleccionadas • <strong className="text-emerald-600 dark:text-emerald-400">{totalEtiquetasCalculadas} stickers en total</strong>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button 
                  type="button"
                  onClick={() => setModalExportarQR(false)} 
                  className="bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold py-2.5 sm:py-3 px-4 rounded-2xl text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => generarPDFConQRs('descargar')} 
                  disabled={productosParaExportarQR.length === 0 || totalEtiquetasCalculadas === 0}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold py-2.5 sm:py-3 px-4 rounded-2xl text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="Descargar archivo PDF en tu equipo"
                >
                  <Download size={15} /> <span>Descargar PDF</span>
                </button>
                <button 
                  type="button"
                  onClick={() => generarPDFConQRs('imprimir')} 
                  disabled={productosParaExportarQR.length === 0 || totalEtiquetasCalculadas === 0}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-2.5 sm:py-3 px-5 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all active:scale-95"
                >
                  <Printer size={16}/> <span>Imprimir Ahora ({totalEtiquetasCalculadas})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR PRODUCTO (BLINDADO PARA MÓVIL Y ESCRITORIO CON PORTAL) */}
      {(esAdmin || puedeEditarInventario) && modalProducto && mounted && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (productosEnCarga.length > 0) {
                setModalConfirmarDescarteCarga(true);
              } else {
                limpiarFormulario();
                setModalProducto(false);
              }
            }
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-[950] overflow-hidden"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-t-3xl sm:rounded-[2.5rem] w-full max-w-[98vw] 2xl:max-w-[1650px] h-[94dvh] sm:h-[92dvh] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            
            {/* Encabezado Fijo del Modal (Línea única compacta en móvil) */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 sm:px-6 py-2 sm:py-3.5 dark:border-slate-800 dark:bg-slate-900/60 shrink-0 z-10">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Package size={17} className="sm:w-[22px] sm:h-[22px]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                    {editandoId ? (modoEdicionProducto === 'surtir' ? 'Surtir Producto' : 'Editar Producto') : 'Inventario'}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                    {editandoId ? (modoEdicionProducto === 'surtir' ? 'Sumando nuevas unidades sin mezclar costos anteriores' : 'Modificando datos del producto') : `${inventario.length} referencias en catálogo`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                {/* Selector de pestañas para pantallas móviles */}
                <div className="flex lg:hidden bg-slate-200 dark:bg-slate-800 p-0.5 sm:p-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold justify-center">
                  <button
                    type="button"
                    onClick={() => setTabMovilModal('formulario')}
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg transition cursor-pointer text-center ${tabMovilModal === 'formulario' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Formulario
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabMovilModal('lista')}
                    className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${tabMovilModal === 'lista' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    Cola ({productosEnCarga.length})
                    {productosEnCarga.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                  </button>
                </div>

                {!editandoId && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalProducto(false);
                      setModalEscanerInventario(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-2.5 py-1 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 lg:bg-emerald-500/15 lg:hover:bg-emerald-500/25 lg:text-emerald-700 dark:lg:text-emerald-300 lg:border lg:border-emerald-500/30 text-white text-[11px] sm:text-xs font-black shadow-md lg:shadow-none shadow-emerald-600/25 transition active:scale-95 cursor-pointer shrink-0"
                    title="Abrir cámara web • Si usas pistola láser, dispara directo en cualquier momento sin hacer clic aquí"
                  >
                    <ScanLine size={14} /> <span className="lg:hidden">Escanear</span>
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    if (productosEnCarga.length > 0) {
                      setModalConfirmarDescarteCarga(true);
                    } else {
                      limpiarFormulario();
                      setModalProducto(false);
                    }
                  }}
                  className="p-1 sm:px-3.5 sm:py-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs sm:text-sm font-bold shrink-0 transition cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X size={16} className="sm:hidden" />
                  <span className="hidden sm:inline">Cerrar</span>
                </button>
              </div>
            </div>

            {/* Cuerpo del Modal: Doble Columna en Escritorio */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] xl:grid-cols-[1.2fr_0.8fr]">
              
              {/* COLUMNA IZQUIERDA: FORMULARIO DE INGRESO Y EDICIÓN COMPACTO SIN SCROLL */}
              <div className={`flex flex-col h-full overflow-y-auto lg:overflow-hidden p-2.5 sm:p-4 space-y-2 sm:space-y-2.5 ${tabMovilModal === 'formulario' ? 'flex' : 'hidden lg:flex'}`}>
                
                {/* Banner de Modo Edición Activo */}
                {/* Selector de Modo cuando se selecciona un producto existente: Surtir vs Editar */}
                {editandoId && (
                  <div className="p-2 bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-xs shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setModoEdicionProducto('surtir');
                          setProveedorEntrada('');
                          const prodOrig = inventario.find(p => p.id === editandoId);
                          if (prodOrig) {
                            setStock(String(prodOrig.stock ?? '0'));
                            setCostoCompra(prodOrig.costoCompra ? String(prodOrig.costoCompra) : '');
                          }
                        }}
                        className={`py-1.5 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer ${
                          modoEdicionProducto === 'surtir'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>📦 Surtir (+ Unidades)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModoEdicionProducto('editar');
                          const prodOrig = inventario.find(p => p.id === editandoId);
                          const lotesNorm = prodOrig ? obtenerLotesNormalizados(prodOrig) : [];
                          setLotesEnEdicion(lotesNorm);
                          setLoteSeleccionadoIdx(0);
                          if (lotesNorm.length > 0) {
                            setCostoCompra(lotesNorm[0].costoUnitario ? String(lotesNorm[0].costoUnitario) : '');
                            setProveedorEntrada(lotesNorm[0].proveedor || prodOrig?.proveedor || '');
                            setStock(String(lotesNorm.reduce((acc, l) => acc + l.cantidad, 0)));
                          }
                        }}
                        className={`py-1.5 px-3 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer ${
                          modoEdicionProducto === 'editar'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>✏️ Editar Producto</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={limpiarFormulario}
                      className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                {false && editandoId && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between gap-2 shadow-xs shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <Edit3 size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-amber-900 dark:text-amber-200 truncate">
                          Editando: "{nombre || 'Sin nombre'}"
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={limpiarFormulario}
                      className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Contenedor Unificado del Formulario (Grilla Compacta) */}
                <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 space-y-3 shadow-xs shrink-0">
                  
                  {/* Fila Foto + Fila 1 */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* AVATAR Y BOTON FOTO */}
                    <div className="flex sm:flex-col items-center gap-2 sm:w-[90px] shrink-0">
                      <div 
                        className="w-14 h-14 sm:w-full sm:h-[90px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white dark:bg-[#020617] overflow-hidden relative cursor-pointer hover:border-violet-400 transition-colors"
                        onClick={() => !imagenUrl && abrirCamaraEnVivo()}
                      >
                        {imagenUrl ? (
                          <img src={imagenUrl} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="text-slate-400" size={24} />
                        )}
                        
                        {imagenUrl && (
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setImagenUrl(null); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-rose-500 transition-colors cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-1 w-full">
                        <button 
                          type="button"
                          onClick={abrirCamaraEnVivo}
                          className="flex-1 py-1.5 px-2 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-bold border border-violet-100 hover:bg-violet-100 flex items-center justify-center gap-1 cursor-pointer"
                          title="Tomar foto"
                        >
                          <Camera size={12}/>
                        </button>
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-1.5 px-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
                          title="Subir archivo"
                        >
                          <Upload size={12}/>
                        </button>
                        <input type="file" ref={fileInputRef} onChange={manejarSubidaArchivo} accept="image/*" className="hidden" />
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* Fila 1: Nombre y Categoría */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
                    {/* Nombre del Producto */}
                    <div className="sm:col-span-7 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Nombre del Producto *
                        </label>
                      </div>
                      <input 
                        type="text" 
                        value={nombre} 
                        onChange={(e) => { setNombre(e.target.value); setErrores(prev => ({ ...prev, nombre: '' })); }} 
                        placeholder="Ej. Camisa Polo Manga Corta" 
                        className={`w-full py-2 px-3 bg-white dark:bg-[#020617] border rounded-xl outline-none font-bold text-xs sm:text-sm text-slate-900 dark:text-white transition-all shadow-xs ${errores.nombre ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} 
                      />
                      {errores.nombre && (
                        <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                          <AlertTriangle size={11} className="inline shrink-0" /> {errores.nombre}
                        </p>
                      )}
                      
                      {/* Detector compacto de similares */}
                      {!editandoId && nombre.trim().length >= 2 && (
                        (() => {
                          const coincidencias = inventario.filter(p => 
                            p.nombre.toLowerCase().includes(nombre.trim().toLowerCase())
                          ).slice(0, 2);

                          if (coincidencias.length === 0) return null;

                          return (
                            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 rounded-lg flex items-center justify-between gap-1.5 text-[11px] animate-in fade-in duration-150">
                              <span className="text-amber-800 dark:text-amber-300 font-bold truncate flex items-center gap-1">
                                <AlertTriangle size={11} className="inline shrink-0" /> Ya existe: "{coincidencias[0].nombre}" (${Number(coincidencias[0].precioVenta || 0).toLocaleString('es-CO')})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  abrirEdicion(coincidencias[0], 'surtir');
                                  toast.success(`Cargado "${coincidencias[0].nombre}"`);
                                }}
                                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded text-[10px] shrink-0 transition cursor-pointer"
                              >
                                Cargar
                              </button>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Categoría con Selector Rápido */}
                    <div className="sm:col-span-5 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Categoría
                        </label>
                        <button
                          type="button"
                          onClick={() => setModalGestionCategorias(true)}
                          className="text-[10px] sm:text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          title="Administrar categorías"
                        >
                          <Tag size={10} /> <span>Admin</span>
                        </button>
                      </div>
                      <div className="relative selector-categoria-container">
                        <div className={`flex items-center gap-1 rounded-xl border ${errores.categoria ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700 focus-within:border-emerald-500'} bg-white px-2.5 py-1.5 dark:bg-[#020617] shadow-xs`}>
                          <input
                            value={categoria}
                            onFocus={() => setCategoriaFoco(true)}
                            onBlur={() => setTimeout(() => setCategoriaFoco(false), 200)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (categoriasFiltradas.length > 0) {
                                  setCategoria(categoriasFiltradas[0]);
                                  setCategoriaFoco(false);
                                  setErrores(prev => ({ ...prev, categoria: '' }));
                                } else if (categoria.trim()) {
                                  agregarCategoria();
                                }
                              }
                            }}
                            onChange={(e) => {
                              setCategoria(e.target.value);
                              setErrores(prev => ({ ...prev, categoria: '' }));
                              setCategoriaFoco(true);
                            }}
                            placeholder="Categoría..."
                            className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400"
                          />
                          {categoria.trim() && !categoriasDisponibles.some(c => c.toLowerCase() === categoria.trim().toLowerCase()) && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={agregarCategoria}
                              className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                              title="Crear categoría"
                            >
                              <Plus size={11} /> <span>Crear</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setCategoriaFoco((prev) => !prev)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1 cursor-pointer shrink-0"
                            aria-label="Ver categorías"
                          >
                            ▾
                          </button>
                        </div>

                        {categoriaFoco && categoriasFiltradas.length > 0 && (
                          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-[#0f172a] scrollbar-thin">
                            {categoriasFiltradas.map((item) => (
                              <button
                                key={item}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setCategoria(item);
                                  setCategoriaFoco(false);
                                  setErrores(prev => ({ ...prev, categoria: '' }));
                                }}
                                className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-between cursor-pointer ${
                                  categoria.toLowerCase() === item.toLowerCase()
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span>{item}</span>
                                {categoria.toLowerCase() === item.toLowerCase() && (
                                  <CheckCircle2 size={13} className="text-emerald-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {errores.categoria && <p className="text-[10px] text-rose-500 font-bold">⚠️ {errores.categoria}</p>}
                    </div>
                  </div>

                  {/* Fila 2: Código / SKU y Tipo / Control de Stock */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
                    {/* Código SKU */}
                    <div className="sm:col-span-6 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Código de Producto / SKU
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const nuevoSku = `COD-${Math.floor(1000 + Math.random() * 9000)}`;
                              setSku(nuevoSku);
                              toast.success(`Código: ${nuevoSku}`, { icon: '✨' });
                            }}
                            className="text-[10px] sm:text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Sparkles size={10} /> Auto
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setModalProducto(false);
                              setModalEscanerInventario(true);
                            }}
                            className="lg:hidden text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <ScanLine size={10} /> Escanear
                          </button>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={sku} 
                        onChange={(e) => setSku(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && sku.trim()) {
                            const sUpper = sku.trim().toUpperCase();
                            const sNorm = sUpper.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                            const coincidenciaSku = inventario.find(p => {
                              const pSku = (p.sku || '').trim().toUpperCase();
                              const pBar = (p.codigoBarras || '').trim().toUpperCase();
                              const pSkuNorm = pSku.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                              const pBarNorm = pBar.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                              return pSku === sUpper || pBar === sUpper || (sNorm && (pSkuNorm === sNorm || pBarNorm === sNorm));
                            });
                            if (coincidenciaSku) {
                              e.preventDefault();
                              reproducirSonidoCamara();
                              abrirEdicion(coincidenciaSku, 'surtir');
                              setCantidadSurtir('1');
                              toast.success(`✓ "${coincidenciaSku.nombre}" cargado automáticamente para surtir (+1 u.)`, { icon: '📦' });
                            }
                          }
                        }}
                        placeholder="Código de barras o ref." 
                        className="w-full py-2 px-3 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold text-xs sm:text-sm focus:border-emerald-500 text-slate-900 dark:text-white transition-all shadow-xs" 
                      />

                      {/* Coincidencia inteligente por código */}
                      {!editandoId && sku.trim().length >= 2 && (
                        (() => {
                          const sNorm = sku.trim().toUpperCase().replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                          const coincidenciaSku = inventario.find(p => {
                            const pSku = (p.sku || '').trim().toUpperCase();
                            const pBar = (p.codigoBarras || '').trim().toUpperCase();
                            const pSkuNorm = pSku.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                            const pBarNorm = pBar.replace(/^(SKU|REF|COD)[-_ ]*/i, '');
                            return pSku === sku.trim().toUpperCase() || pBar === sku.trim().toUpperCase() || (sNorm && (pSkuNorm === sNorm || pBarNorm === sNorm));
                          });

                          if (!coincidenciaSku) return null;

                          return (
                            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 rounded-lg flex items-center justify-between gap-1.5 text-[11px] animate-in fade-in duration-150">
                              <span className="text-emerald-800 dark:text-emerald-300 font-bold truncate">
                                ✓ Registrado en: "{coincidenciaSku.nombre}"
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  abrirEdicion(coincidenciaSku, 'surtir');
                                  toast.success(`Cargado "${coincidenciaSku.nombre}"`, { icon: '✏️' });
                                }}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] shrink-0 cursor-pointer shadow-xs"
                              >
                                Cargar
                              </button>
                            </div>
                          );
                        })()
                      )}
                    </div>

                    {/* Tipo y Control de Stock en 2 columnas */}
                    <div className="sm:col-span-6 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Tipo
                        </label>
                        <select 
                          value={tipoProducto} 
                          onChange={(e) => {
                            const val = e.target.value as 'producto' | 'servicio';
                            setTipoProducto(val);
                            if (val === 'servicio') {
                              setInventariable(false);
                              setStock('0');
                              setErrores(prev => ({ ...prev, stock: '' }));
                            } else {
                              setInventariable(true);
                            }
                          }} 
                          className="w-full py-2 px-2 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs sm:text-sm focus:border-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="producto">Producto Físico</option>
                          <option value="servicio">Servicio</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          ¿Controla Stock?
                        </label>
                        <select 
                          value={inventariable ? 'si' : 'no'} 
                          onChange={(e) => {
                            const esInv = e.target.value === 'si';
                            setInventariable(esInv);
                            if (!esInv) {
                              setStock('0');
                              setErrores(prev => ({ ...prev, stock: '' }));
                            }
                          }} 
                          className="w-full py-2 px-2 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs sm:text-sm focus:border-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="si">Sí (Controlar)</option>
                          <option value="no">No (Ilimitado)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                    </div>{/* end flex-1 space-y-3 */}
                  </div>{/* end flex flex-col sm:flex-row (photo row) */}

                  {/* Fila 3: Precio Venta, Costo Compra, Stock y Proveedor (Ancho completo del formulario sin cortar texto y sin scroll) */}
                  <div className={`grid ${datosSesion?.esAdmin !== false ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2 sm:gap-2.5`}>
                    
                    {/* Precio Venta */}
                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight block whitespace-nowrap">
                        Precio Venta ($) *
                      </label>
                      <input 
                        type="text" 
                        inputMode="decimal" pattern="[0-9]*" 
                        value={formatearMonedaInput(precioVenta)} 
                        onChange={(e) => { 
                          setPrecioVenta(e.target.value.replace(/\D/g, '')); 
                          setErrores(prev => ({ ...prev, precio: '' })); 
                        }} 
                        placeholder="$0" 
                        className={`w-full py-2 px-3 bg-white dark:bg-[#020617] border rounded-xl outline-none font-black text-xs sm:text-sm text-slate-900 dark:text-white transition-colors ${errores.precio ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} 
                      />
                      {errores.precio && <p className="text-[9px] text-rose-500 font-bold leading-tight">⚠️ {errores.precio}</p>}
                    </div>

                    {/* Costo Compra (Solo Admin) */}
                    {datosSesion?.esAdmin !== false && (
                      <div className="space-y-1">
                        <label className="text-[10px] sm:text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-tight block whitespace-nowrap">
                          {editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 1
                            ? `Costo Lote ${loteSeleccionadoIdx + 1} ($)`
                            : 'Costo Compra ($)'}
                        </label>
                        <input 
                          type="text" 
                          inputMode="decimal" pattern="[0-9]*" 
                          value={formatearMonedaInput(costoCompra)} 
                          onChange={(e) => {
                            const limpio = e.target.value.replace(/\D/g, '');
                            setCostoCompra(limpio);
                            if (editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 0) {
                              const nuevoCosto = Number(limpio) || 0;
                              setLotesEnEdicion(prev => prev.map((l, idx) => idx === loteSeleccionadoIdx ? { ...l, costoUnitario: nuevoCosto } : l));
                            }
                          }} 
                          placeholder="$0 (opcional)" 
                          className="w-full py-2 px-3 bg-white dark:bg-[#020617] border border-indigo-200 dark:border-indigo-800 rounded-xl outline-none font-bold text-xs sm:text-sm text-slate-900 dark:text-white focus:border-indigo-500" 
                        />
                      </div>
                    )}

                    {/* Stock Inicial / Actual / Cantidad Lote */}
                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight block whitespace-nowrap">
                        {editandoId
                          ? (modoEdicionProducto === 'surtir'
                              ? `+ Sumar (Hay ${stock || 0} u.)`
                              : lotesEnEdicion.length > 1
                                ? `Cant. Lote ${loteSeleccionadoIdx + 1} (u.)`
                                : 'Stock Actual')
                          : 'Stock Inicial'}
                      </label>
                      {tipoProducto === 'producto' && inventariable && editandoId && modoEdicionProducto === 'surtir' ? (
                        <input
                          type="number"
                          min="1"
                          value={cantidadSurtir}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setCantidadSurtir(raw === '' ? '' : String(Math.max(0, Number(raw))));
                            setErrores(prev => ({ ...prev, stock: '' }));
                          }}
                          placeholder="+ Ej. 20"
                          className="w-full py-2 px-3 bg-emerald-50/60 dark:bg-emerald-950/30 border-2 border-emerald-500 rounded-xl outline-none font-black text-xs sm:text-sm text-emerald-900 dark:text-emerald-200"
                        />
                      ) : tipoProducto === 'producto' && inventariable && editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 1 ? (
                        <input
                          type="number"
                          min="0"
                          value={lotesEnEdicion[loteSeleccionadoIdx]?.cantidad ?? 0}
                          onChange={(e) => {
                            const nuevaCant = Math.max(0, Math.round(Number(e.target.value) || 0));
                            setLotesEnEdicion(prev => {
                              const actualizados = prev.map((l, idx) => idx === loteSeleccionadoIdx ? { ...l, cantidad: nuevaCant } : l);
                              const sumaTotal = actualizados.reduce((acc, l) => acc + l.cantidad, 0);
                              setStock(String(sumaTotal));
                              return actualizados;
                            });
                            setErrores(prev => ({ ...prev, stock: '' }));
                          }}
                          placeholder="0"
                          className="w-full py-2 px-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-400 dark:border-amber-700 rounded-xl outline-none font-black text-xs sm:text-sm text-slate-900 dark:text-white focus:border-amber-500"
                        />
                      ) : tipoProducto === 'producto' && inventariable ? (
                        <input 
                          type="number" 
                          min={editandoId ? undefined : "0"} 
                          value={stock} 
                          onChange={(e) => { 
                            const raw = e.target.value;
                            if (editandoId && (raw === '' || raw === '-')) {
                              setStock(raw);
                            } else {
                              const valor = Number(raw);
                              const nuevoStockStr = String(editandoId ? valor : Math.max(0, valor));
                              setStock(nuevoStockStr);
                              if (editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length === 1) {
                                setLotesEnEdicion(prev => prev.map((l, idx) => idx === 0 ? { ...l, cantidad: Math.max(0, Math.round(valor)) } : l));
                              }
                            }
                            setErrores(prev => ({ ...prev, stock: '' })); 
                          }} 
                          placeholder="0" 
                          className={`w-full py-2 px-3 bg-white dark:bg-[#020617] border rounded-xl outline-none font-black text-xs sm:text-sm text-slate-900 dark:text-white ${errores.stock ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'}`} 
                        />
                      ) : (
                        <div className="w-full py-2 px-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl text-center">
                          <span className="text-indigo-600 dark:text-indigo-300 font-bold text-[11px] sm:text-xs">Ilimitado</span>
                        </div>
                      )}
                      {errores.stock && <p className="text-[9px] text-rose-500 font-bold leading-tight">⚠️ {errores.stock}</p>}
                    </div>

                    {/* Proveedor (Opcional) — integrado con la misma estética de los demás campos y 0 scroll */}
                    <div className="space-y-1">
                      <label className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight block whitespace-nowrap">
                        {editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 1
                          ? `Proveedor Lote ${loteSeleccionadoIdx + 1}`
                          : 'Proveedor (Opcional)'}
                      </label>
                      <input
                        type="text"
                        value={proveedorEntrada}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProveedorEntrada(val);
                          if (editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 0) {
                            setLotesEnEdicion(prev => prev.map((l, idx) => idx === loteSeleccionadoIdx ? { ...l, proveedor: val.trim() || undefined } : l));
                          }
                        }}
                        placeholder="Ej. Fábrica / Distr."
                        className="w-full py-2 px-3 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-semibold text-xs sm:text-sm text-slate-900 dark:text-white focus:border-emerald-500 placeholder:text-slate-400"
                      />
                    </div>

                  </div>

                  {/* Selector / Desplegable Opcional: Precios Diferenciados (Fiado / Separe) */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setMostrarPreciosDiferenciados(!mostrarPreciosDiferenciados)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors py-1"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{mostrarPreciosDiferenciados ? "− Ocultar Precios Diferenciados" : "+ Precios Diferenciados (Fiado y Separe)"}</span>
                      {(precioFiado || precioSepare) && !mostrarPreciosDiferenciados && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          Activo
                        </span>
                      )}
                    </button>

                    {mostrarPreciosDiferenciados && (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
                        <div className="space-y-1">
                          <label className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight block whitespace-nowrap">
                            Precio Fiado / Crédito ($)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal" pattern="[0-9]*"
                            value={formatearMonedaInput(precioFiado)}
                            onChange={(e) => setPrecioFiado(e.target.value.replace(/\D/g, ""))}
                            placeholder={precioVenta ? ("Hereda $" + (Number(precioVenta.replace(/\D/g, "")) || 0).toLocaleString("es-CO")) : "$0 (opcional)"}
                            className="w-full py-1.5 px-3 bg-white dark:bg-[#020617] border border-amber-300 dark:border-amber-700 rounded-xl outline-none font-bold text-xs sm:text-sm text-slate-900 dark:text-white focus:border-amber-500 placeholder:text-slate-400"
                          />
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                            Aplica automáticamente al fiar este producto.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] sm:text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-tight block whitespace-nowrap">
                            Precio Plan Separe ($)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal" pattern="[0-9]*"
                            value={formatearMonedaInput(precioSepare)}
                            onChange={(e) => setPrecioSepare(e.target.value.replace(/\D/g, ""))}
                            placeholder={precioVenta ? ("Hereda $" + (Number(precioVenta.replace(/\D/g, "")) || 0).toLocaleString("es-CO")) : "$0 (opcional)"}
                            className="w-full py-1.5 px-3 bg-white dark:bg-[#020617] border border-purple-300 dark:border-purple-700 rounded-xl outline-none font-bold text-xs sm:text-sm text-slate-900 dark:text-white focus:border-purple-500 placeholder:text-slate-400"
                          />
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                            Aplica automáticamente al apartar en Plan Separe.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumen de ganancia estimada y detector inteligente de lotes / costos */}
                  {(() => {
                    if (datosSesion?.esAdmin === false) return null;
                    const precioNum = Number((precioVenta || '').replace(/\D/g, '')) || 0;
                    const costoNum = Number((costoCompra || '').replace(/\D/g, '')) || 0;
                    const stockNum = Number(stock) || 0;

                    const prodRef = editandoId
                      ? inventario.find(p => p.id === editandoId)
                      : (nombre.trim() || sku.trim())
                        ? inventario.find(p =>
                            (sku.trim() && (p.sku || '').trim().toUpperCase() === sku.trim().toUpperCase()) ||
                            (nombre.trim() && (p.nombre || '').trim().toLowerCase() === nombre.trim().toLowerCase())
                          )
                        : null;

                    const stockAnterior = prodRef ? Math.max(0, Number(prodRef.stock) || 0) : 0;
                    const costoAnterior = prodRef ? Number(prodRef.costoCompra) || 0 : 0;
                    const esEdicionConMultiLotes = Boolean(editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 1);
                    const unidadesNuevas = prodRef
                      ? (editandoId
                          ? (modoEdicionProducto === 'surtir'
                              ? Math.max(0, Number(cantidadSurtir) || 0)
                              : esEdicionConMultiLotes
                                ? 0
                                : stockNum - stockAnterior)
                          : stockNum)
                      : 0;

                    const lotesBase = (editandoId && modoEdicionProducto === 'editar' && lotesEnEdicion.length > 0)
                      ? lotesEnEdicion
                      : (prodRef ? obtenerLotesNormalizados(prodRef) : []);
                    const mostrarDesgloseLotes = Boolean(
                      prodRef &&
                      ((editandoId && modoEdicionProducto === 'surtir') ||
                        lotesBase.length > 1 ||
                        (stockAnterior > 0 && costoAnterior > 0 && costoNum > 0 && costoNum !== costoAnterior && unidadesNuevas > 0))
                    );

                    const soloCambioCostoSinSubirStock = Boolean(
                      prodRef &&
                      editandoId &&
                      lotesBase.length <= 1 &&
                      stockAnterior > 0 &&
                      costoAnterior > 0 &&
                      costoNum > 0 &&
                      costoNum !== costoAnterior &&
                      unidadesNuevas === 0
                    );

                    return (
                      <div className="space-y-2">
                        {precioNum > 0 && costoNum > 0 && !mostrarDesgloseLotes && (
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between">
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold">Ganancia estimada por unidad:</span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-black">
                              +${(precioNum - costoNum).toLocaleString('es-CO')}
                            </span>
                          </div>
                        )}

                        {mostrarDesgloseLotes && (() => {
                          const totalUnidadesMostradas = editandoId && modoEdicionProducto === 'editar'
                            ? lotesBase.reduce((acc, l) => acc + Math.max(0, Number(l.cantidad) || 0), 0)
                            : stockAnterior + Math.max(0, unidadesNuevas);
                          const puedeSeleccionarLote = Boolean(editandoId && modoEdicionProducto === 'editar' && lotesBase.length > 1);

                          return (
                            <div className="p-2 bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] space-y-1.5">
                              <div className="font-black text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                                <span>
                                  📦 {unidadesNuevas > 0
                                    ? (costoNum !== costoAnterior && costoNum > 0 && costoAnterior > 0 ? `Lotes separados sin mezclar (+${unidadesNuevas} u.)` : `Entrada de mercancía (+${unidadesNuevas} u.)`)
                                    : puedeSeleccionarLote
                                      ? `Lotes activos (${lotesBase.length}) — Toca un lote para editarlo`
                                      : `Lotes activos en inventario (${lotesBase.length} lotes)`}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 shrink-0">
                                  Total: {totalUnidadesMostradas} u.
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {lotesBase.map((lote, idxLote) => {
                                  const esSeleccionado = puedeSeleccionarLote && idxLote === loteSeleccionadoIdx;
                                  return (
                                    <button
                                      type="button"
                                      key={lote.id || idxLote}
                                      disabled={!puedeSeleccionarLote}
                                      onClick={() => {
                                        if (!puedeSeleccionarLote) return;
                                        setLoteSeleccionadoIdx(idxLote);
                                        setCostoCompra(lote.costoUnitario ? String(lote.costoUnitario) : '');
                                        setProveedorEntrada(lote.proveedor || '');
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-left flex items-center justify-between gap-1 transition ${
                                        esSeleccionado
                                          ? 'bg-amber-100/90 dark:bg-amber-900/60 border-2 border-amber-500 ring-2 ring-amber-500/20 shadow-xs cursor-pointer'
                                          : puedeSeleccionarLote
                                            ? 'bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-slate-800 hover:border-amber-400 cursor-pointer opacity-85 hover:opacity-100'
                                            : 'bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-800 cursor-default'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <span className={`text-[9px] font-bold uppercase block leading-tight break-words ${esSeleccionado ? 'text-amber-800 dark:text-amber-300' : 'text-slate-400'}`}>
                                          Lote {idxLote + 1}{lote.proveedor ? ` • ${lote.proveedor}` : ' (Actual)'}{esSeleccionado ? ' • ✏️ Editando' : ''}
                                        </span>
                                        <span className="font-black text-slate-800 dark:text-white text-[11px]">
                                          {lote.cantidad} u. × ${Number(lote.costoUnitario || 0).toLocaleString('es-CO')}
                                        </span>
                                      </div>
                                      {precioNum > 0 && (
                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                          +${(precioNum - Number(lote.costoUnitario || 0)).toLocaleString('es-CO')}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                                {unidadesNuevas > 0 && (
                                  <div className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between gap-1">
                                    <div className="min-w-0">
                                      <span className="text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400 block leading-tight break-words">
                                        Lote {lotesBase.length + 1}{proveedorEntrada.trim() ? ` • ${proveedorEntrada.trim()}` : ' (Nuevo)'}
                                      </span>
                                      <span className="font-black text-slate-800 dark:text-white text-[11px]">
                                        +{unidadesNuevas} u. × ${costoNum.toLocaleString('es-CO')}
                                      </span>
                                    </div>
                                    {precioNum > 0 && (
                                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                        +${(precioNum - costoNum).toLocaleString('es-CO')}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {soloCambioCostoSinSubirStock && (
                          <div className="p-2 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-[11px] text-indigo-800 dark:text-indigo-200">
                            💡 <strong>Cambio de costo base:</strong> Estás cambiando el costo de <strong>${costoAnterior.toLocaleString('es-CO')}</strong> a <strong>${costoNum.toLocaleString('es-CO')}</strong> sin sumar unidades nuevas. Si estás ingresando mercancía nueva, sube también el <strong>Stock Actual</strong> (de {stockAnterior} a {stockAnterior}+unidades) para que quede registrada la entrada en el Historial.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {false && datosSesion?.esAdmin !== false && precioVenta && costoCompra && Number(precioVenta.replace(/\D/g, '')) > 0 && Number(costoCompra.replace(/\D/g, '')) > 0 && (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-emerald-700 dark:text-emerald-300 font-bold">Ganancia estimada por unidad:</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-black">
                        +${(Number(precioVenta.replace(/\D/g, '')) - Number(costoCompra.replace(/\D/g, ''))).toLocaleString('es-CO')}
                      </span>
                    </div>
                  )}

                </div>{/* end form container */}

                {/* Botones de Acción integrados directamente con el formulario */}
                <div className="shrink-0 sticky bottom-0 bg-white dark:bg-[#0b1329] pt-1.5 pb-1 z-10 space-y-1.5">
                  {editandoId && modoEdicionProducto === 'editar' ? (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={limpiarFormulario}
                        className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => guardarProducto(false)}
                        disabled={guardando}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 text-xs sm:text-sm transition active:scale-95 cursor-pointer"
                      >
                        {guardando ? 'Guardando...' : <>✓ Guardar Cambios</>}
                      </button>
                    </div>
                  ) : editandoId && modoEdicionProducto === 'surtir' ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          const cantAdd = Math.round(Number(cantidadSurtir) || 0);
                          if (cantAdd <= 0) {
                            toast.error('Ingresa cuántas unidades nuevas vas a sumar.');
                            return;
                          }
                          const prodOrig = inventario.find(p => p.id === editandoId);
                          if (!prodOrig) return;
                          agregarOActualizarProductoEnCarga({
                            id: `carga_${prodOrig.id}`,
                            esExistente: true,
                            productoId: prodOrig.id,
                            nombre: nombre.trim() || prodOrig.nombre,
                            sku: sku.trim() || prodOrig.sku || prodOrig.codigoBarras || '',
                            stock: cantAdd,
                            precioVenta: Number((precioVenta || '').replace(/\D/g, '')) || prodOrig.precioVenta || 0,
                            costoCompra: Number((costoCompra || '').replace(/\D/g, '')) || prodOrig.costoCompra || 0,
                            tipoProducto: prodOrig.tipoProducto || tipoProducto,
                            categoria: categoria.trim() || prodOrig.categoria || 'General',
                            inventariable: prodOrig.inventariable !== false,
                            imagen: imagenUrl || prodOrig.imagen || null,
                            ...(proveedorEntrada.trim() ? { proveedor: proveedorEntrada.trim() } : {}),
                            enCarga: true,
                          });
                          toast.success(`"${prodOrig.nombre}" agregado a la lista (+${cantAdd} u.)`);
                          limpiarFormulario();
                        }}
                        disabled={guardando}
                        className="w-full py-2.5 sm:py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-black rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                        title="Agrega este surtido a la lista de la derecha para guardarlo en el inventario"
                      >
                        ➕ Agregar Surtido a la Lista (+{Number(cantidadSurtir) || 0} u.)
                      </button>

                      {productosEnCarga.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTabMovilModal('lista')}
                          className="lg:hidden w-full py-1.5 px-3 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold rounded-xl text-xs flex items-center justify-between transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <LayoutList size={13} className="text-sky-600 dark:text-sky-400" />
                            <span>{productosEnCarga.length} producto(s) en la cola</span>
                          </span>
                          <span className="text-[11px] underline font-black">Ver cola →</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={agregarProductoALaCarga}
                        disabled={guardando}
                        className="w-full py-2.5 sm:py-3 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-black rounded-xl shadow-md text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                        title="Encola este producto a la lista en vivo de la derecha y limpia los campos para seguir agregando"
                      >
                        ➕ Encolar y Seguir Agregando
                      </button>

                      {productosEnCarga.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTabMovilModal('lista')}
                          className="lg:hidden w-full py-1.5 px-3 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold rounded-xl text-xs flex items-center justify-between transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <LayoutList size={13} className="text-sky-600 dark:text-sky-400" />
                            <span>{productosEnCarga.length} producto(s) en la cola</span>
                          </span>
                          <span className="text-[11px] underline font-black">Ver cola →</span>
                        </button>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                    💡 <span className="font-semibold">Tip:</span> Al encolar, el producto se agrega a la lista de la derecha para que revises toda tu tanda antes de guardarla.
                  </p>
                </div>

              </div>

              {/* COLUMNA DERECHA: COLA DE CARGA EN VIVO (PRODUCTOS EN ESTA SESIÓN) */}
              <div className={`flex flex-col h-full overflow-hidden p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-900/40 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 ${tabMovilModal === 'lista' ? 'flex' : 'hidden lg:flex'}`}>
                
                {/* Cabecera de la Cola */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <LayoutList size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        Cola de Recepción / Carga
                        {productosEnCarga.length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {productosEnCarga.length} producto(s) encolados • {productosEnCarga.reduce((acc, it) => acc + (Number(it.stock) || 0), 0)} unidades en total
                      </p>
                    </div>
                  </div>

                  {productosEnCarga.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalConfirmarDescarteCarga(true)}
                      className="px-2 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Descartar todos los productos encolados"
                    >
                      <Trash2 size={12} />
                      <span className="hidden sm:inline">Descartar cola</span>
                    </button>
                  )}
                </div>

                {/* Lista Scrollable de la Cola de Carga */}
                <div className="flex-1 overflow-y-auto space-y-1.5 py-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                  {productosEnCarga.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                      <div className="w-14 h-14 rounded-3xl bg-slate-200/60 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 flex items-center justify-center shadow-inner">
                        <Package size={28} />
                      </div>
                      <div className="max-w-xs space-y-1">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                          Tu cola de carga está vacía
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Diligencia el formulario a la izquierda y presiona <strong className="text-sky-600 dark:text-sky-400">"Encolar y Seguir Agregando"</strong> o <strong className="text-emerald-600 dark:text-emerald-400">dispara tu pistola lectora / usa la cámara</strong>. Aquí irás viendo todo en tiempo real antes de guardarlo en tu inventario.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalProducto(false);
                          setModalEscanerInventario(true);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition cursor-pointer"
                        title="Abrir cámara web para escanear códigos"
                      >
                        <ScanLine size={14} /> <span className="lg:hidden">Abrir Escáner de Códigos</span><span className="hidden lg:inline">Usar Cámara Web</span>
                      </button>
                    </div>
                  ) : (
                    productosEnCarga.map((item, idx) => {
                      const cant = Number(item.stock) || 0;
                      const precio = Number(item.precioVenta) || 0;
                      const subtotal = cant * precio;

                      return (
                        <div
                          key={item.id}
                          className="px-3 py-2 rounded-xl bg-white dark:bg-[#0b1329] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-1.5 group"
                        >
                          {/* Fila 1: Nombre completo del producto y Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug break-words flex-1">
                              {item.nombre}
                            </span>
                            {item.esExistente ? (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">
                                +stock
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 shrink-0">
                                Nuevo
                              </span>
                            )}
                          </div>

                          {/* Fila 2: SKU / Precio unitario + Stepper + Subtotal + Papelera */}
                          <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-100 dark:border-slate-800/60">
                            {/* SKU y Precio unitario */}
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 min-w-0">
                              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                                {item.sku || 'SIN SKU'}
                              </span>
                              <span>•</span>
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                ${precio.toLocaleString('es-CO')} c/u
                              </span>
                            </div>

                            {/* Controles: Stepper + Subtotal + Papelera */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Stepper de Cantidad */}
                              <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                                <button
                                  type="button"
                                  onClick={() => modificarCantidadProductoEnCarga(item.id, -1)}
                                  className="w-5 h-5 rounded bg-white dark:bg-slate-700 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center transition shadow-xs cursor-pointer"
                                  title="Restar una unidad"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs text-slate-900 dark:text-white px-1.5 min-w-[22px] text-center">
                                  {cant}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => modificarCantidadProductoEnCarga(item.id, 1)}
                                  className="w-5 h-5 rounded bg-white dark:bg-slate-700 hover:bg-emerald-50 hover:text-emerald-600 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center justify-center transition shadow-xs cursor-pointer"
                                  title="Sumar una unidad"
                                >
                                  +
                                </button>
                              </div>

                              {/* Subtotal */}
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 min-w-[65px] text-right">
                                ${subtotal.toLocaleString('es-CO')}
                              </span>

                              {/* Botón Eliminar */}
                              <button
                                type="button"
                                onClick={() => quitarProductoEnCarga(item.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                                title="Remover de la cola"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Resumen Final de la Cola & Botón de Guardado */}
                {productosEnCarga.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 bg-white/50 dark:bg-slate-900/50 p-2 rounded-2xl">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-bold">
                        Referencias en cola:
                      </span>
                      <strong className="text-slate-900 dark:text-white font-black">
                        {productosEnCarga.length} refs
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-bold">
                        Total unidades a ingresar:
                      </span>
                      <strong className="text-sky-600 dark:text-sky-400 font-black">
                        {productosEnCarga.reduce((acc, it) => acc + (Number(it.stock) || 0), 0)} unidades
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-slate-700 dark:text-slate-300 font-black">
                        Valor total de la carga:
                      </span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                        ${productosEnCarga.reduce((acc, it) => acc + ((Number(it.stock) || 0) * (Number(it.precioVenta) || 0)), 0).toLocaleString('es-CO')}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => guardarProducto(true)}
                      disabled={guardando}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 transition active:scale-95 cursor-pointer"
                    >
                      {guardando ? 'Guardando en inventario...' : (
                        <>Guardar Todo en Inventario ({productosEnCarga.reduce((acc, it) => acc + (Number(it.stock) || 0), 0)} un.)</>
                      )}
                    </button>
                  </div>
                )}

              </div>

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE CONFIRMACIÓN PARA DESCARTAR CARGA DE PRODUCTOS (PORTAL CON Z-INDEX MÁXIMO) */}
      {modalConfirmarDescarteCarga && mounted && createPortal(
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[100050] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl w-full max-w-sm border border-rose-200 dark:border-rose-900/50 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">¿Descartar productos de la lista?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tienes <strong className="text-slate-900 dark:text-white">{productosEnCarga.length} producto(s)</strong> en la lista de carga. Si sales sin guardar, tu base de datos quedará <strong className="text-emerald-600 dark:text-emerald-400">100% intacta</strong>.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmarDescarteCarga(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                Seguir en formulario
              </button>
              <button
                type="button"
                onClick={descartarCargaCompleta}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 cursor-pointer transition-colors"
              >
                Sí, descartar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE PRODUCTO */}
      {esAdmin && productoAEliminar && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget && !eliminandoProducto) setProductoAEliminar(null); }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[960] animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={30} />
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                ¿Eliminar producto?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Esta acción no se puede deshacer y el producto será retirado de tu catálogo.
              </p>
            </div>

            {/* Ficha resumen del producto a eliminar */}
            <div className="bg-slate-50 dark:bg-[#020617] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mb-6 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Producto:</span>
                <strong className="text-slate-900 dark:text-white font-black truncate max-w-[200px]">
                  {productoAEliminar.nombre}
                </strong>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Categoría:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {normalizarCategoria(productoAEliminar.categoria)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Precio Venta:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  ${(productoAEliminar.precioVenta || 0).toLocaleString('es-CO')}
                </span>
              </div>

              {productoAEliminar.tipoProducto !== 'servicio' && productoAEliminar.inventariable !== false && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Stock actual:</span>
                  <span className={`font-black ${Number(productoAEliminar.stock) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {productoAEliminar.stock || 0} unidades
                  </span>
                </div>
              )}

              {productoAEliminar.tipoProducto !== 'servicio' && productoAEliminar.inventariable !== false && Number(productoAEliminar.stock) > 0 && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 font-medium mt-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>Aviso: El producto aún cuenta con {productoAEliminar.stock} unidades registradas en bodega.</span>
                </div>
              )}
            </div>

            {/* Botones de Acción */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={eliminandoProducto}
                onClick={() => setProductoAEliminar(null)}
                className="w-full py-3.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminandoProducto}
                onClick={ejecutarEliminacionProducto}
                className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-sm active:scale-95"
              >
                {eliminandoProducto ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEDICADO DE GESTIÓN DE CATEGORÍAS (Portal z-[1000] para quedar siempre al frente de todo) */}
      {modalGestionCategorias && mounted && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalGestionCategorias(false);
              setCategoriaEditandoModal(null);
              setNuevoNombreCatModal('');
            }
          }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Cabecera */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/25 shrink-0">
                  <Tag size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                    Administrar Categorías
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {categoriasDisponibles.length} categorías disponibles en tu catálogo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalGestionCategorias(false);
                  setCategoriaEditandoModal(null);
                  setNuevoNombreCatModal('');
                }}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition cursor-pointer shrink-0"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario Nueva Categoría */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
                Crear nueva categoría
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  crearCategoriaDesdeModal(nuevaCatModalInput);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={nuevaCatModalInput}
                  onChange={(e) => setNuevaCatModalInput(e.target.value)}
                  placeholder="Ej. Bebidas, Accesorios, Postres..."
                  className="flex-1 p-2.5 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:border-violet-500 shadow-xs"
                />
                <button
                  type="submit"
                  disabled={!nuevaCatModalInput.trim()}
                  className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-violet-600/20 transition cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus size={15} />
                  <span>Agregar</span>
                </button>
              </form>
            </div>

            {/* Buscador interno de categorías */}
            {categoriasDisponibles.length > 5 && (
              <div className="px-4 sm:px-5 pt-3 pb-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                  <Search size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={busquedaCategoriasModal}
                    onChange={(e) => setBusquedaCategoriasModal(e.target.value)}
                    placeholder="Filtrar categorías..."
                    className="w-full bg-transparent outline-none font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  {busquedaCategoriasModal && (
                    <button
                      type="button"
                      onClick={() => setBusquedaCategoriasModal('')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Listado Scrollable de Categorías */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {(() => {
                const listaFiltrada = categoriasDisponibles.filter((c) =>
                  c.toLowerCase().includes(busquedaCategoriasModal.toLowerCase().trim())
                );

                if (listaFiltrada.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-medium">
                      No se encontraron categorías que coincidan con "{busquedaCategoriasModal}".
                    </div>
                  );
                }

                return listaFiltrada.map((cat) => {
                  const conteoProds = inventario.filter(
                    (p) => normalizarCategoria(p.categoria) === normalizarCategoria(cat)
                  ).length;
                  const esGeneral = cat.toLowerCase() === 'general';
                  const estaEditando = categoriaEditandoModal === cat;

                  return (
                    <div
                      key={cat}
                      className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 transition hover:border-violet-300 dark:hover:border-violet-900"
                    >
                      {estaEditando ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={nuevoNombreCatModal}
                            onChange={(e) => setNuevoNombreCatModal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                renombrarCategoriaGlobal(cat, nuevoNombreCatModal);
                              }
                            }}
                            autoFocus
                            className="flex-1 p-1.5 bg-white dark:bg-[#020617] border border-violet-500 rounded-lg text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none"
                          />
                          <button
                            type="button"
                            disabled={guardandoCatModal || !nuevoNombreCatModal.trim()}
                            onClick={() => renombrarCategoriaGlobal(cat, nuevoNombreCatModal)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            disabled={guardandoCatModal}
                            onClick={() => {
                              setCategoriaEditandoModal(null);
                              setNuevoNombreCatModal('');
                            }}
                            className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs shrink-0 font-black">
                              <Tag size={13} className="text-violet-600 dark:text-violet-400" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                <span>{cat}</span>
                                {esGeneral && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Base
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {conteoProds} {conteoProds === 1 ? 'producto asignado' : 'productos asignados'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setCategoriaEditandoModal(cat);
                                setNuevoNombreCatModal(cat);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="Renombrar categoría (actualiza todos los productos)"
                            >
                              <Edit3 size={14} />
                            </button>
                            {!esGeneral && (
                              <button
                                type="button"
                                onClick={() => solicitarEliminarCategoria(cat)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                title="Eliminar categoría"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Pie de Modal */}
            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Al renombrar una categoría, se actualizan automáticamente sus productos.
              </span>
              <button
                type="button"
                onClick={() => {
                  setModalGestionCategorias(false);
                  setCategoriaEditandoModal(null);
                  setNuevoNombreCatModal('');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs transition cursor-pointer shrink-0"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE CONFIRMACIÓN PROPIO PARA ELIMINAR CATEGORÍA (CERO MENSAJES DEL SISTEMA) */}
      {categoriaAEliminarConfirm && mounted && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget && !guardandoCatModal) setCategoriaAEliminarConfirm(null); }}
          className="fixed inset-0 z-[1010] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-900/40 shadow-inner">
              <Trash2 size={30} />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              ¿Eliminar categoría "{categoriaAEliminarConfirm.nombre}"?
            </h3>

            {categoriaAEliminarConfirm.conteoProds > 0 ? (
              <div className="space-y-2 mb-6">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Esta categoría tiene <strong className="text-slate-900 dark:text-white">{categoriaAEliminarConfirm.conteoProds} producto(s) asignados</strong>.
                </p>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-medium text-left">
                  <strong>Protección de catálogo:</strong> Para no dejar productos huérfanos, todos se reasignarán automáticamente a la categoría base <strong>"General"</strong>.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                No hay productos asignados a esta categoría. Se eliminará del catálogo de categorías disponibles.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={guardandoCatModal}
                onClick={() => setCategoriaAEliminarConfirm(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardandoCatModal}
                onClick={ejecutarEliminacionCategoria}
                className="py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black rounded-2xl transition shadow-lg shadow-rose-600/25 cursor-pointer text-xs active:scale-95"
              >
                {guardandoCatModal ? "Eliminando..." : "Sí, Eliminar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE CÁMARA EN VIVO */}
      {modalCamaraEnVivo && mounted && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col">
            <div className="p-3.5 bg-slate-950/80 flex items-center justify-between border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Camera size={17} className="text-violet-400" />
                <span className="font-bold text-xs sm:text-sm">Foto del Producto</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                  {facingMode === 'environment' ? 'Trasera' : 'Frontal'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={alternarCamara}
                  disabled={iniciandoCamara}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition text-xs font-semibold cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Cambiar entre cámara trasera y frontal"
                >
                  <SwitchCamera size={15} className={`text-violet-400 ${iniciandoCamara ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Cambiar cámara</span>
                </button>
                <button
                  type="button"
                  onClick={cerrarCamara}
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-rose-500 rounded-full transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="relative bg-black w-full aspect-[4/3] flex items-center justify-center overflow-hidden">
              {flashEfecto && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-300" />}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              <div className="absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)] pointer-events-none" />
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center">
              <button
                type="button"
                onClick={capturarFotoEnVivo}
                disabled={iniciandoCamara}
                className="w-14 h-14 rounded-full bg-white border-4 border-violet-600 shadow-xl flex items-center justify-center text-violet-700 hover:scale-105 active:scale-90 transition-transform cursor-pointer disabled:opacity-50"
                title="Capturar Foto"
              >
                <Camera size={24} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL LIGHTBOX DE FOTO DE PRODUCTO */}
      {fotoLightbox && mounted && createPortal(
        <div 
          onClick={() => setFotoLightbox(null)}
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[1200] cursor-pointer animate-in fade-in duration-200 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-xl max-h-[85vh] flex flex-col items-center cursor-default gap-3"
          >
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-black/60 max-h-[75vh] flex items-center justify-center">
              <img 
                src={fotoLightbox} 
                alt="Foto de producto" 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl" 
              />
              <button
                type="button"
                onClick={() => setFotoLightbox(null)}
                className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer shadow-lg border border-white/20"
                title="Cerrar vista previa"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL UPSELL DE SUSCRIPCIÓN PARA EXCEL, QR O LÍMITES */}
      <ModalUpsellSuscripcion
        visible={modalUpsell.visible}
        titulo={modalUpsell.titulo}
        mensaje={modalUpsell.mensaje}
        planRecomendado={modalUpsell.plan}
        onClose={() => setModalUpsell({ visible: false, titulo: "", mensaje: "", plan: 'comercio' })}
      />
    </div>
  );
}

function formatearMonedaInput(valor: string) {
  if (!valor) return "";
  const numeroStr = valor.replace(/\D/g, '');
  if (!numeroStr) return "";
  return parseInt(numeroStr, 10).toLocaleString('es-CO');
}