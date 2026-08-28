"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, doc, updateDoc, deleteDoc, where, addDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase";
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
  QrCode, 
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
  MoreVertical,
  Bookmark,
  Crown,
  Lock
} from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import ModalUpsellSuscripcion from "@/components/ModalUpsellSuscripcion";

type ColumnaOrden = 'categoria' | 'nombre' | 'sku' | 'stock' | 'precioVenta';
type DireccionOrden = 'asc' | 'desc';
type FiltroStock = 'todos' | 'en_stock' | 'stock_bajo' | 'sin_stock' | 'servicios';
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
  const [filtrosStock, setFiltrosStock] = useState<('en_stock' | 'stock_bajo' | 'sin_stock' | 'servicios')[]>([]);
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

  // Estados del Formulario de Producto
  const [nombre, setNombre] = useState("");
  const [sku, setSku] = useState("");
  const [stock, setStock] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
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
  const [errores, setErrores] = useState({ nombre: '', categoria: '', stock: '', precio: '' });
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([
    'General', 'Varios', 'Servicios', 'Ropa hombre', 'Ropa dama', 'Ropa interior', 'Hogar', 'Joyería',
    'Calzado', 'Ropa infantil', 'Bolsos', 'Deporte', 'Juguetería', 'Tecnología', 'Gorras y accesorios',
    'Tienda del Peluquero', 'Bebe accesorios', 'Bienestar', 'Buzos', 'Cacharro', 'Colegial'
  ]);

  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarInventario(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  const cargarInventario = async (uid: string) => {
    try {
      setCargando(true);
      const q = query(collection(db, "inventario"), where("usuarioId", "==", uid));
      const snap = await getDocs(q);
      const lista: any[] = [];
      snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setInventario(lista);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar inventario.");
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
      acc + (p.inventariable !== false && p.tipoProducto !== 'servicio' ? (Number(p.stock) || 0) : 0), 0
    );
    const valorTotal = inventario.reduce((acc, p) => 
      acc + ((Number(p.stock) || 0) * (Number(p.precioVenta) || 0)), 0
    );
    const totalServicios = inventario.filter(p => p.tipoProducto === 'servicio' || p.inventariable === false).length;
    const stockBajo = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) > 0 && Number(p.stock) <= 5).length;
    const sinStock = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) <= 0).length;
    const enStock = inventario.filter(p => (p.inventariable !== false && p.tipoProducto !== 'servicio') && Number(p.stock) > 0).length;

    return {
      totalProductos,
      unidadesFisicasTotales,
      valorTotal,
      totalServicios,
      stockBajo,
      sinStock,
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

  // Helper para validar si un producto se puede vender/fiar (servicios o con stock > 0)
  const tieneStockDisponible = (prod: any) => {
    if (prod.tipoProducto === 'servicio' || prod.inventariable === false) return true;
    return Number(prod.stock || 0) > 0;
  };

  // Despacho directo a Venta, Fiado o Separe
  const despacharAVenta = (productos: any[]) => {
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Los productos seleccionados no tienen stock disponible.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(p.precioVenta || 0),
      cantidad: 1,
      idProducto: p.id
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    sessionStorage.setItem('fiabono_origen_despacho', '/dashboard/inventario');
    router.push('/dashboard/vender');
  };

  const despacharAFiar = (productos: any[]) => {
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Los productos seleccionados no tienen stock disponible.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(p.precioVenta || 0),
      cantidad: 1,
      idProducto: p.id
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    sessionStorage.setItem('fiabono_origen_despacho', '/dashboard/inventario');
    router.push('/dashboard/fiar');
  };

  const despacharASepare = (productos: any[]) => {
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Los productos seleccionados no tienen stock disponible.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(p.precioVenta || 0),
      cantidad: 1,
      idProducto: p.id
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    sessionStorage.setItem('fiabono_origen_despacho', '/dashboard/inventario');
    router.push('/dashboard/separe');
  };

  const toggleSeleccionProducto = (prod: any) => {
    if (!tieneStockDisponible(prod)) {
      toast.error(`"${prod.nombre}" está agotado y no se puede seleccionar para venta, fiado o separe.`);
      return;
    }
    setProductosSeleccionados(prev => 
      prev.includes(prod.id) ? prev.filter(item => item !== prod.id) : [...prev, prod.id]
    );
  };

  // Funciones de Multi-Selección de Filtros
  const toggleFiltroStock = (tipo: 'en_stock' | 'stock_bajo' | 'sin_stock' | 'servicios') => {
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

    // 1. Filtro por texto de búsqueda (nombre, sku, categoría)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      resultado = resultado.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        normalizarCategoria(p.categoria).toLowerCase().includes(q)
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
          if (filtro === 'sin_stock') return !esServicio && cant <= 0;
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
    if (productosDisponiblesVisibles.length === 0) {
      toast.error("No hay productos con stock disponible en esta vista.");
      return;
    }
    const todosDisponiblesSeleccionados = productosDisponiblesVisibles.every(p => productosSeleccionados.includes(p.id));
    if (todosDisponiblesSeleccionados) {
      setProductosSeleccionados([]);
    } else {
      setProductosSeleccionados(productosDisponiblesVisibles.map(p => p.id));
      toast.success(`${productosDisponiblesVisibles.length} productos con stock seleccionados`);
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
    const erroresNuevos = {
      nombre: '',
      categoria: '',
      stock: '',
      precio: ''
    };

    const esInventariable = tipoProducto === 'producto' && inventariable;

    if (!nombre.trim()) erroresNuevos.nombre = 'El nombre del producto es obligatorio.';
    if (!categoria.trim()) erroresNuevos.categoria = 'Selecciona o agrega una categoría.';
    else if (!categoriasDisponibles.some(item => item.toLowerCase() === categoria.trim().toLowerCase())) {
      erroresNuevos.categoria = 'Agrega esta categoría antes de continuar.';
    }
    if (esInventariable && stock.trim() === '') erroresNuevos.stock = 'El stock es obligatorio para productos físicos.';
    if (!precioVenta) erroresNuevos.precio = 'El precio de venta es obligatorio.';

    setErrores(erroresNuevos);

    if (erroresNuevos.nombre || erroresNuevos.categoria || erroresNuevos.stock || erroresNuevos.precio) {
      return;
    }

    const productoTmp = {
      id: Date.now().toString(),
      nombre: nombre.trim(),
      sku: (sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase(),
      stock: esInventariable ? Math.max(0, Number(stock) || 0) : 0,
      precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
      tipoProducto,
      categoria: categoria.trim() || 'General',
      inventariable: esInventariable,
      enCarga: true,
    };

    setProductosEnCarga(prev => [...prev, productoTmp]);
    setNombre('');
    setSku('');
    setStock('');
    setPrecioVenta('');
    setCategoria('');
    setErrores({ nombre: '', categoria: '', stock: '', precio: '' });
    toast.success('Producto agregado a la carga rápida');
  };

  const crearProductoDesdeFormulario = () => {
    const skuLimpio = sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const esInventariable = tipoProducto === 'producto' && inventariable;
    return {
      usuarioId: cuentaPrincipalId,
      nombre: nombre.trim(),
      sku: skuLimpio,
      stock: esInventariable ? Math.max(0, Number(stock) || 0) : 0,
      precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
      tipoProducto,
      categoria: (categoria.trim() || 'General'),
      inventariable: esInventariable,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };
  };

  const guardarProductosEnCarga = async (productos: any[] = productosEnCarga) => {
    if (!productos.length) return 0;

    const productosAguardar = productos.map((prod) => ({
      usuarioId: cuentaPrincipalId,
      nombre: prod.nombre,
      sku: prod.sku,
      stock: prod.inventariable !== false && prod.tipoProducto !== 'servicio' ? (Number(prod.stock) || 0) : 0,
      precioVenta: Number(prod.precioVenta) || 0,
      tipoProducto: prod.tipoProducto || 'producto',
      categoria: prod.categoria || 'General',
      inventariable: prod.inventariable !== false && prod.tipoProducto !== 'servicio',
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    }));

    const batchInsert = productosAguardar.map((producto) => addDoc(collection(db, "inventario"), producto));
    await Promise.all(batchInsert);
    setProductosEnCarga([]);
    return productosAguardar.length;
  };

  const guardarProducto = async () => {
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
      if (!categoria.trim()) erroresNuevos.categoria = 'Selecciona o agrega una categoría.';
      else if (!categoriasDisponibles.some(item => item.toLowerCase() === categoria.trim().toLowerCase())) {
        erroresNuevos.categoria = 'Agrega esta categoría antes de continuar.';
      }
      if (esInventariable && stock.trim() === '') erroresNuevos.stock = 'El stock es obligatorio para productos físicos.';
      if (!precioVenta) erroresNuevos.precio = 'El precio de venta es obligatorio.';

      // Si hay errores en el formulario y no hay productos en cola, o si el usuario escribió un nombre y tiene errores:
      if (erroresNuevos.nombre || erroresNuevos.categoria || erroresNuevos.stock || erroresNuevos.precio) {
        if (!hayProductosEnCola || nombre.trim()) {
          setErrores(erroresNuevos);
          return;
        }
      }
    }

    setGuardando(true);
    try {
      if (editandoId) {
        const esInventariable = tipoProducto === 'producto' && inventariable;
        const docRef = doc(db, "inventario", editandoId);
        await updateDoc(docRef, {
          nombre: nombre.trim(),
          sku: sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          stock: esInventariable ? Math.max(0, Number(stock) || 0) : 0,
          precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
          tipoProducto,
          categoria: categoria.trim() || 'General',
          inventariable: esInventariable,
          fechaActualizacion: new Date()
        });
        toast.success("Producto actualizado con éxito.");
      } else {
        const totalGuardados = await guardarProductosEnCarga();
        let totalExtra = 0;
        
        // Si el usuario además completó válidamente el formulario superior, lo guardamos también
        if (nombre.trim() && precioVenta) {
          const docRef = await addDoc(collection(db, "inventario"), crearProductoDesdeFormulario());
          if (docRef.id) totalExtra = 1;
        }

        const totalFinal = totalGuardados + totalExtra;
        if (totalFinal > 1) {
          toast.success(`¡Se guardaron ${totalFinal} productos en el catálogo! 🎉`);
        } else if (totalFinal === 1) {
          toast.success("Producto creado con éxito.");
        }
      }

      setModalProducto(false);
      limpiarFormulario();
      if (cuentaPrincipalId) cargarInventario(cuentaPrincipalId);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar en el inventario.");
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarEliminacionProducto = async () => {
    if (!productoAEliminar) return;
    try {
      setEliminandoProducto(true);
      await deleteDoc(doc(db, "inventario", productoAEliminar.id));
      setProductosSeleccionados(prev => prev.filter(id => id !== productoAEliminar.id));
      toast.success(`"${productoAEliminar.nombre}" eliminado del catálogo.`);
      setProductoAEliminar(null);
      if (cuentaPrincipalId) cargarInventario(cuentaPrincipalId);
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar el producto.");
    } finally {
      setEliminandoProducto(false);
    }
  };

  const abrirEdicion = (prod: any) => {
    setEditandoId(prod.id);
    setNombre(prod.nombre);
    setSku(prod.sku || "");
    setStock(prod.stock?.toString() || "0");
    setPrecioVenta(prod.precioVenta?.toString() || "");
    setTipoProducto(prod.tipoProducto === 'servicio' ? 'servicio' : 'producto');
    setCategoria(prod.categoria || 'General');
    setInventariable(prod.inventariable !== false);
    setModalProducto(true);
  };

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre("");
    setSku("");
    setStock("");
    setPrecioVenta("");
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

        // Si es IMPRESIÓN DIRECTA, usamos HTML con @page size en mm para que el driver de la impresora térmica llene el 100% de la etiqueta
        if (modoAccion === 'imprimir') {
          const ventanaImpresion = window.open('', '_blank', 'width=450,height=600');
          if (!ventanaImpresion) {
            toast.dismiss(toastId);
            return toast.error("Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes (popups) para Fiabono.");
          }

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

            const svgElement = document.getElementById(`qr-svg-${prod.id}`);
            let qrSvgHtml = svgElement ? svgElement.outerHTML : '';

            for (let i = 0; i < cantidadImprimir; i++) {
              const esHorizontal = anchoMM >= 50 && altoMM <= 28;

              if (esHorizontal) {
                htmlEtiquetas += `
                  <div class="sticker sticker-horizontal">
                    <div class="qr-col">${qrSvgHtml}</div>
                    <div class="text-col">
                      ${opcionNegocio && datosSesion?.nombreNegocio ? `<div class="negocio">${String(datosSesion.nombreNegocio).toUpperCase()}</div>` : ''}
                      ${opcionNombre ? `<div class="nombre">${prod.nombre}</div>` : ''}
                      ${opcionSku ? `<div class="sku">${formatearTextoSKU(prod.sku)}</div>` : ''}
                      ${opcionPrecio ? `<div class="precio">$${(prod.precioVenta || 0).toLocaleString('es-CO')}</div>` : ''}
                    </div>
                  </div>
                `;
              } else {
                htmlEtiquetas += `
                  <div class="sticker sticker-vertical">
                    <div class="info-top">
                      ${opcionNegocio && datosSesion?.nombreNegocio ? `<div class="negocio">${String(datosSesion.nombreNegocio).toUpperCase()}</div>` : ''}
                      ${opcionNombre ? `<div class="nombre">${prod.nombre}</div>` : ''}
                      ${opcionSku ? `<div class="sku">${formatearTextoSKU(prod.sku)}</div>` : ''}
                    </div>
                    <div class="qr-container">${qrSvgHtml}</div>
                    <div class="info-bottom">
                      ${opcionPrecio ? `<div class="precio">$${(prod.precioVenta || 0).toLocaleString('es-CO')}</div>` : ''}
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
              <title>Imprimir Etiquetas QR - Fiabono</title>
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
                }
                html, body {
                  margin: 0;
                  padding: 0;
                  background: #ffffff;
                  color: #000000;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                }
                .sticker {
                  width: ${anchoMM}mm;
                  height: ${altoMM}mm;
                  max-width: ${anchoMM}mm;
                  max-height: ${altoMM}mm;
                  padding: 1.2mm 1.5mm;
                  box-sizing: border-box;
                  page-break-after: always;
                  break-after: page;
                  page-break-inside: avoid;
                  overflow: hidden;
                  display: flex;
                  background: #ffffff;
                }
                .sticker-vertical {
                  flex-direction: column;
                  align-items: center;
                  justify-content: space-between;
                  text-align: center;
                }
                .sticker-horizontal {
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  gap: 1.5mm;
                  text-align: left;
                }
                .info-top {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: flex-start;
                  width: 100%;
                  gap: 0.4mm;
                  line-height: 1.1;
                }
                .negocio {
                  font-size: ${anchoMM <= 32 ? '5.5px' : '6.5px'};
                  font-weight: 700;
                  color: #444444;
                  text-transform: uppercase;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                  line-height: 1;
                }
                .nombre {
                  font-size: ${anchoMM <= 32 ? '7px' : (anchoMM <= 42 ? '8.5px' : '9.5px')};
                  font-weight: 900;
                  color: #000000;
                  line-height: 1.1;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                }
                .sku {
                  font-size: ${anchoMM <= 32 ? '5.5px' : '6.5px'};
                  font-family: monospace;
                  font-weight: bold;
                  color: #222222;
                  line-height: 1;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  max-width: 100%;
                }
                .info-bottom {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 100%;
                }
                .precio {
                  font-size: ${anchoMM <= 32 ? '8px' : (anchoMM <= 42 ? '9.5px' : '11px')};
                  font-weight: 900;
                  color: #000000;
                  line-height: 1;
                }
                .qr-container {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex: 1;
                  width: 100%;
                  min-height: 0;
                  padding: 0.5mm 0;
                }
                .qr-container svg {
                  height: 100%;
                  width: auto;
                  max-width: 100%;
                  max-height: 100%;
                  object-fit: contain;
                  display: block;
                  margin: 0 auto;
                }
                .qr-col {
                  width: 38%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .qr-col svg {
                  width: 100%;
                  height: auto;
                  max-height: ${altoMM - 2}mm;
                }
                .text-col {
                  width: 62%;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  gap: 0.5mm;
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

        // Si es DESCARGAR PDF:
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

          for (let i = 0; i < cantidadImprimir; i++) {
            if (!esPrimeraPagina) {
              docPdf.addPage([anchoMM, altoMM], anchoMM >= altoMM ? 'landscape' : 'portrait');
            }
            esPrimeraPagina = false;

            const esFormatoHorizontalAlargado = anchoMM >= 50 && altoMM <= 28;

            if (esFormatoHorizontalAlargado) {
              const qrTamano = Math.min(altoMM - 3, 20);
              const qrX = 1.5;
              const qrY = (altoMM - qrTamano) / 2;

              if (qrDataUrl) {
                docPdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrTamano, qrTamano);
              }

              const textoX = qrX + qrTamano + 2;
              const textoAnchoMax = anchoMM - textoX - 1.5;
              let curY = 4;

              if (opcionNegocio && datosSesion?.nombreNegocio) {
                docPdf.setFontSize(5.5);
                docPdf.setFont("helvetica", "normal");
                docPdf.setTextColor(90, 90, 90);
                docPdf.text(String(datosSesion.nombreNegocio).toUpperCase().substring(0, 18), textoX, curY);
                curY += 2.8;
                docPdf.setTextColor(0, 0, 0);
              }

              if (opcionNombre) {
                docPdf.setFontSize(6.5);
                docPdf.setFont("helvetica", "bold");
                const lineasNombre = docPdf.splitTextToSize(prod.nombre, textoAnchoMax);
                docPdf.text(lineasNombre.slice(0, 2), textoX, curY);
                curY += (Math.min(lineasNombre.length, 2) * 2.8);
              }

              if (opcionSku) {
                docPdf.setFontSize(5.5);
                docPdf.setFont("helvetica", "normal");
                docPdf.text(formatearTextoSKU(prod.sku), textoX, curY);
                curY += 2.8;
              }

              if (opcionPrecio) {
                docPdf.setFontSize(7.5);
                docPdf.setFont("helvetica", "bold");
                docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, textoX, Math.min(curY + 0.5, altoMM - 2));
              }

            } else {
              let curY = altoMM <= 25 ? 2.2 : 3.0;
              const centerX = anchoMM / 2;

              if (opcionNegocio && datosSesion?.nombreNegocio && altoMM >= 25) {
                docPdf.setFontSize(anchoMM <= 32 ? 4.8 : 5.8);
                docPdf.setFont("helvetica", "normal");
                docPdf.setTextColor(90, 90, 90);
                docPdf.text(String(datosSesion.nombreNegocio).toUpperCase(), centerX, curY, { align: 'center' });
                curY += (anchoMM <= 32 ? 2.2 : 2.6);
                docPdf.setTextColor(0, 0, 0);
              }

              if (opcionNombre) {
                const fuenteNombre = anchoMM <= 32 ? 5.5 : (anchoMM <= 42 ? 6.8 : 8.0);
                docPdf.setFontSize(fuenteNombre);
                docPdf.setFont("helvetica", "bold");
                const maxChars = anchoMM <= 32 ? 14 : (anchoMM <= 42 ? 20 : 28);
                const nombreCorto = prod.nombre.length > maxChars ? prod.nombre.substring(0, maxChars - 2) + '...' : prod.nombre;
                docPdf.text(nombreCorto, centerX, curY, { align: 'center' });
                curY += (anchoMM <= 32 ? 2.4 : 2.9);
              }

              if (opcionSku && altoMM >= 24) {
                docPdf.setFontSize(anchoMM <= 32 ? 4.5 : 5.2);
                docPdf.setFont("helvetica", "normal");
                docPdf.text(formatearTextoSKU(prod.sku), centerX, curY, { align: 'center' });
                curY += (anchoMM <= 32 ? 2.0 : 2.5);
              }

              const espacioRestanteY = altoMM - curY - (opcionPrecio ? (altoMM <= 25 ? 3.5 : 4.5) : 1);
              const qrTamano = Math.min(espacioRestanteY, anchoMM - 4, altoMM <= 25 ? 12 : 18);
              const qrX = (anchoMM - qrTamano) / 2;

              if (qrDataUrl && qrTamano > 8) {
                docPdf.addImage(qrDataUrl, 'PNG', qrX, curY + 0.5, qrTamano, qrTamano);
                curY += qrTamano + (altoMM <= 25 ? 1 : 1.5);
              }

              if (opcionPrecio) {
                const fuentePrecio = anchoMM <= 32 ? 6.5 : (anchoMM <= 42 ? 8 : 9.5);
                docPdf.setFontSize(fuentePrecio);
                docPdf.setFont("helvetica", "bold");
                docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, centerX, Math.min(curY + 1.5, altoMM - 1.5), { align: 'center' });
              }
            }
          }
        }

        docPdf.save(`Etiquetas_Termica_${anchoMM}x${altoMM}mm_${Date.now()}.pdf`);
        toast.dismiss(toastId);
        toast.success(`¡PDF térmico descargado con éxito (${totalEtiquetasCalculadas} stickers en rollo)!`);

      } else {
        // =========================================================================
        // MODO 2: HOJA CARTA / A4 MULTI-ETIQUETA (IMPRESORA DE OFICINA)
        // =========================================================================
        const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        
        let anchoEtiqueta = 58;
        let altoEtiqueta = 48;
        let margenX = 8;
        let margenY = 8;
        let colsPorFila = 3;
        let qrSize = 22;
        let startX = 14;
        let startY = 16;
        let maxPageY = 262;

        if (tamanoEtiqueta === 'compacto') {
          anchoEtiqueta = 44;
          altoEtiqueta = 34;
          margenX = 5;
          margenY = 6;
          colsPorFila = 4;
          qrSize = 16;
          startX = 12;
          startY = 16;
          maxPageY = 265;
        } else if (tamanoEtiqueta === 'grande') {
          anchoEtiqueta = 90;
          altoEtiqueta = 56;
          margenX = 10;
          margenY = 10;
          colsPorFila = 2;
          qrSize = 28;
          startX = 13;
          startY = 16;
          maxPageY = 258;
        }

        let x = startX;
        let y = startY;
        let contadorCol = 0;

        docPdf.setFont("helvetica", "bold");
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
                canvas.width = 180;
                canvas.height = 180;
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

          for (let i = 0; i < cantidadImprimir; i++) {
            if (y + altoEtiqueta > maxPageY) {
              docPdf.addPage();
              x = startX;
              y = startY;
              contadorCol = 0;
            }

            // Borde guía suave
            docPdf.setDrawColor(210, 210, 210);
            docPdf.setLineWidth(0.2);
            docPdf.rect(x, y, anchoEtiqueta, altoEtiqueta);

            let cursorY = y + (tamanoEtiqueta === 'compacto' ? 4 : 5.5);

            if (opcionNegocio && datosSesion?.nombreNegocio) {
              docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 5.5 : 6.5);
              docPdf.setFont("helvetica", "normal");
              docPdf.setTextColor(110, 110, 110);
              docPdf.text(String(datosSesion.nombreNegocio).toUpperCase(), x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
              cursorY += (tamanoEtiqueta === 'compacto' ? 2.5 : 3.5);
              docPdf.setTextColor(0, 0, 0);
            }

            if (opcionCategoria) {
              docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 5.5 : 6.5);
              docPdf.setFont("helvetica", "normal");
              docPdf.setTextColor(110, 110, 110);
              const catTexto = normalizarCategoria(prod.categoria).toUpperCase();
              docPdf.text(catTexto, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
              cursorY += (tamanoEtiqueta === 'compacto' ? 2.8 : 3.5);
              docPdf.setTextColor(0, 0, 0);
            }

            if (opcionNombre) {
              docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 7 : (tamanoEtiqueta === 'grande' ? 10.5 : 8.5));
              docPdf.setFont("helvetica", "bold");
              const maxChars = tamanoEtiqueta === 'compacto' ? 20 : (tamanoEtiqueta === 'grande' ? 36 : 24);
              const nombreCorto = prod.nombre.length > maxChars ? prod.nombre.substring(0, maxChars - 2) + '...' : prod.nombre;
              docPdf.text(nombreCorto, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
              cursorY += (tamanoEtiqueta === 'compacto' ? 3.5 : 4.5);
            }

            if (opcionSku) {
              docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 6 : (tamanoEtiqueta === 'grande' ? 8.5 : 7.5));
              docPdf.setFont("helvetica", "normal");
              docPdf.text(formatearTextoSKU(prod.sku), x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
              cursorY += (tamanoEtiqueta === 'compacto' ? 3.5 : 4);
            }

            if (opcionPrecio) {
              docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 7 : (tamanoEtiqueta === 'grande' ? 9.5 : 8.5));
              docPdf.setFont("helvetica", "bold");
              docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
              cursorY += (tamanoEtiqueta === 'compacto' ? 1.5 : 2);
            }

            if (qrDataUrl) {
              const qrX = x + (anchoEtiqueta - qrSize) / 2;
              docPdf.addImage(qrDataUrl, 'PNG', qrX, cursorY + 1, qrSize, qrSize);
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
        const totalNum = stockNum * precioNum;

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

        // Detectar índice del encabezado (busca fila con 'nombre' o 'tipo')
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, data.length); i++) {
          const rowText = (data[i] || []).join(' ').toLowerCase();
          if (rowText.includes('nombre') || rowText.includes('tipo') || rowText.includes('sku')) {
            headerRowIndex = i;
            break;
          }
        }

        const productosParseados: any[] = [];
        
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          // Extraer columnas principales (A a G)
          const tipoRaw = String(row[0] || 'Producto').trim();
          const esServicio = tipoRaw.toLowerCase().includes('servicio');
          const categoriaVal = String(row[1] || 'General').trim() || 'General';
          const skuVal = String(row[2] || '').trim();
          const nombreVal = String(row[3] || '').trim();
          const invRaw = String(row[4] || (esServicio ? 'No' : 'Si')).trim().toLowerCase();
          const inventariableVal = esServicio ? false : (!invRaw.startsWith('n') && invRaw !== '0');
          const precioVal = Math.max(0, Number(row[5]) || 0);
          const stockVal = esServicio || !inventariableVal ? 0 : Math.max(0, Number(row[6]) || 0);

          // Si no tiene nombre se ignora
          if (!nombreVal) continue;

          // Búsqueda inteligente de duplicados por SKU o por Nombre exacto
          const prodExistente = inventario.find(item => {
            const matchSku = skuVal && item.sku && String(item.sku).trim().toLowerCase() === skuVal.toLowerCase();
            const matchNombre = item.nombre && String(item.nombre).trim().toLowerCase() === nombreVal.toLowerCase();
            return matchSku || matchNombre;
          });

          productosParseados.push({
            tipoProducto: esServicio ? 'servicio' : 'producto',
            categoria: categoriaVal,
            sku: skuVal || (prodExistente?.sku || ''),
            nombre: nombreVal,
            inventariable: inventariableVal,
            precioVenta: precioVal,
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
            const stockFinal = modoActualizacionStock === 'sumar'
              ? (Number(prod.stockAnterior) || 0) + (Number(prod.stock) || 0)
              : (Number(prod.stock) || 0);

            batch.update(docRef, {
              nombre: prod.nombre,
              categoria: prod.categoria,
              tipoProducto: prod.tipoProducto,
              inventariable: prod.inventariable,
              stock: prod.tipoProducto === 'servicio' || !prod.inventariable ? 0 : stockFinal,
              precioVenta: prod.precioVenta,
              fechaModificacion: new Date()
            });
          } else {
            creados++;
            const docRef = doc(collection(db, "inventario"));
            batch.set(docRef, {
              usuarioId: cuentaPrincipalId,
              nombre: prod.nombre,
              categoria: prod.categoria,
              sku: prod.sku || docRef.id.slice(0, 8).toUpperCase(),
              tipoProducto: prod.tipoProducto,
              inventariable: prod.inventariable,
              stock: prod.tipoProducto === 'servicio' || !prod.inventariable ? 0 : prod.stock,
              precioVenta: prod.precioVenta,
              fechaCreacion: new Date()
            });
          }
        });

        await batch.commit();
      }

      const mensaje = actualizados > 0 
        ? `🎉 ¡${creados} creados y ${actualizados} actualizados con éxito!`
        : `🎉 ¡${creados} productos importados con éxito a tu inventario!`;
      
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
    setCategoria(valor);
    setErrores(prev => ({ ...prev, categoria: '' }));
    setCategoriaFoco(false);
    mostrarMensajeCategoria('success', 'Categoría agregada', `La categoría "${valor}" quedó disponible para usar.`);
  };

  const quitarProductoEnCarga = (id: string) => {
    setProductosEnCarga((prev) => prev.filter((item) => item.id !== id));
  };

  const guardarEdicionCategoria = () => {
    const valor = nombreCategoriaEditada.trim();
    if (!valor || valor === 'General') return;

    const listaActualizada = categoriasDisponibles.map(item => item === categoriaEditando ? valor : item);
    const nuevaLista = [...new Set(listaActualizada)].sort((a, b) => a.localeCompare(b, 'es'));

    setCategoriasDisponibles(nuevaLista);
    setCategoria(valor);
    setCategoriaEditando(null);
    setNombreCategoriaEditada('');
    setErrores(prev => ({ ...prev, categoria: '' }));
    mostrarMensajeCategoria('success', 'Categoría actualizada', `La categoría cambió a "${valor}" y ya aparece en el campo.`);
  };

  const eliminarCategoria = (valor: string) => {
    const nuevaLista = categoriasDisponibles.filter(item => item !== valor);
    setCategoriasDisponibles(nuevaLista);
    if (categoria === valor) setCategoria('');
    setCategoriaEditando(null);
    setNombreCategoriaEditada('');
    mostrarMensajeCategoria('danger', 'Categoría eliminada', `Se quitó "${valor}" de la lista disponible.`);
  };

  // Renderizado de Badge de Stock
  const renderStockBadge = (prod: any, modo: 'normal' | 'movil' = 'normal') => {
    const cant = Number(prod.stock || 0);
    const esServicio = prod.tipoProducto === 'servicio' || prod.inventariable === false;

    if (esServicio) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-bold border border-indigo-200 dark:border-indigo-800 shrink-0`}>
          🛠️ {modo === 'movil' ? 'Servicio' : 'Servicio / Ilimitado'}
        </span>
      );
    }

    if (cant <= 0) {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 ${modo === 'movil' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} font-black border border-rose-200 dark:border-rose-800 shrink-0 animate-pulse`}>
          <XCircle size={modo === 'movil' ? 11 : 13} className="shrink-0" /> {modo === 'movil' ? 'Sin stock' : 'Sin Stock (0)'}
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
      
      {/* HEADER ULTRA RESPONSIVE */}
      <div className="bg-emerald-600 dark:bg-emerald-700 p-3 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-2xl font-black uppercase tracking-wide flex items-center gap-1.5 whitespace-nowrap">
              <Package size={20} className="shrink-0"/> 
              <span className="sm:hidden">Inventario</span>
              <span className="hidden sm:inline">Inventario General</span>
            </h2>
            <p className="text-[11px] text-white/80 font-medium hidden lg:block truncate">
              {esAdmin ? "Control de stock, precios y catálogo de productos" : "Consulta de catálogo, precios y disponibilidad"}
            </p>
          </div>
        </div>

        {/* Acciones de Cabecera */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {esAdmin && (
            <>
              {/* En Pantallas Medianas/Grandes (md:): Botones directos */}
              <div className="hidden md:flex items-center gap-1.5">
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
                  className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer"
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
                  className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer"
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
                  className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm cursor-pointer"
                  title="Imprimir o exportar etiquetas con códigos QR"
                >
                  <Printer size={15}/> <span>Etiquetas QR</span>
                  {!datosSesion?.esPro && <Crown size={12} className="text-amber-300 ml-0.5" />}
                </button>
              </div>

              {/* En Móvil (< md): Menú Desplegable de Herramientas */}
              <div className="relative md:hidden">
                <button 
                  type="button"
                  onClick={() => setMenuHerramientasMovil(!menuHerramientasMovil)}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-xl font-bold text-xs flex items-center justify-center transition-colors backdrop-blur-sm shadow-sm text-white active:scale-95 cursor-pointer"
                  title="Herramientas de inventario (Excel, Importar, QRs)"
                >
                  <MoreVertical size={18}/>
                </button>

                {menuHerramientasMovil && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in zoom-in-95 duration-150">
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
                            mensaje: "Importa cientos de productos con stock y precios en segundos desde un archivo Excel con el Plan PRO Almacén.",
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
                        <span>Etiquetas QR Adhesivas</span>
                      </div>
                      {!datosSesion?.esPro && <Crown size={12} className="text-amber-500" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Botón Principal: Agregar Productos */}
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
                className="bg-white text-emerald-700 hover:bg-emerald-50 px-2.5 sm:px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1 shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                title="Agregar nuevos productos o servicios al inventario"
              >
                <Plus size={16}/> <span>Agregar<span className="hidden sm:inline"> Productos</span></span>
              </button>
            </>
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

          {/* BARRA DE BÚSQUEDA Y SELECTOR DE VISTA COMPACTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
                placeholder="Buscar por nombre, SKU o categoría..." 
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
              <button
                onClick={() => toggleFiltroStock('servicios')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  filtrosStock.includes('servicios')
                    ? 'bg-indigo-600 text-white shadow-sm font-black ring-2 ring-indigo-500/30'
                    : 'bg-white dark:bg-[#0f172a] text-indigo-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                }`}
              >
                <span>🛠️</span> Servicios ({metricas.totalServicios})
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
                    <span>{f === 'en_stock' ? 'Con stock' : f === 'stock_bajo' ? 'Stock bajo' : f === 'sin_stock' ? 'Sin stock' : 'Servicios'}</span>
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
              <QRCodeSVG key={prod.id} id={`qr-svg-${prod.id}`} value={prod.sku || prod.id} size={128} />
            ))}
          </div>

          {/* VISTA 1: LISTADO DE PRODUCTOS (DUAL: TARJETAS EN MÓVIL / TABLA COMPACTA EN LAPTOP/DESKTOP) */}
          {vistaActual === 'lista' && (
            <div className="space-y-3">
              
              {/* --- A. VISTA TARJETAS MÓVILES (< sm) : COMPACTAS DE ALTA DENSIDAD (2 FILAS) --- */}
              <div className="block sm:hidden space-y-2">
                {inventarioProcesado.map(prod => {
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
                      {/* Fila 1: Checkbox + Nombre + SKU + Precio */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button 
                            type="button" 
                            disabled={!disponible}
                            onClick={() => toggleSeleccionProducto(prod)}
                            className={`transition-colors shrink-0 ${!disponible ? 'opacity-30 cursor-not-allowed text-slate-300' : 'text-slate-400'}`}
                          >
                            {estaSeleccionado ? (
                              <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                          <div className="min-w-0 flex-1 flex items-baseline gap-1.5 truncate">
                            <h4 className="font-black text-slate-900 dark:text-white text-sm truncate leading-tight">
                              {prod.nombre}
                            </h4>
                            {prod.sku && (
                              <span className="text-[10px] text-slate-400 font-mono shrink-0 hidden xs:inline">
                                {prod.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
                          ${(prod.precioVenta || 0).toLocaleString('es-CO')}
                        </span>
                      </div>

                      {/* Fila 2: Zona de Etiquetas (Unidades + Categoría) a la izquierda | Acciones a la derecha */}
                      <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                        {/* Zona de Etiquetas: Unidades y Categoría juntas al lado */}
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {renderStockBadge(prod, 'movil')}
                          <span className="inline-flex rounded-md bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-bold border border-blue-100 dark:border-blue-900/40 truncate max-w-[85px] shrink-0">
                            {normalizarCategoria(prod.categoria)}
                          </span>
                        </div>

                        {/* Botones de Acción Compactos */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => despacharAVenta([prod])} 
                            disabled={!disponible}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black transition-all ${
                              !disponible 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50' 
                                : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white active:scale-95 shadow-sm'
                            }`}
                          >
                            <ShoppingCart size={12} /> <span>Vender</span>
                          </button>
                          <button 
                            onClick={() => despacharAFiar([prod])} 
                            disabled={!disponible}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black transition-all ${
                              !disponible 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50' 
                                : 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white active:scale-95 shadow-sm'
                            }`}
                          >
                            <Receipt size={12} /> <span>Fiar</span>
                          </button>

                          {esAdmin && (
                            <div className="flex items-center ml-0.5">
                              <button 
                                onClick={() => abrirEdicion(prod)} 
                                className="p-1 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-md transition-colors"
                                title="Editar"
                              >
                                <Edit3 size={13}/>
                              </button>
                              <button 
                                onClick={() => setProductoAEliminar(prod)} 
                                className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-md transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          )}
                        </div>
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
                    {inventario.length === 0 && esAdmin && (
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
                            {productosSeleccionados.length > 0 && productosSeleccionados.length === inventarioProcesado.length ? (
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
                      {inventarioProcesado.map(prod => {
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
                                disabled={!disponible}
                                onClick={() => toggleSeleccionProducto(prod)}
                                className={`transition-colors inline-flex items-center justify-center ${
                                  !disponible 
                                    ? 'cursor-not-allowed opacity-30 text-slate-300 dark:text-slate-700' 
                                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                                title={disponible ? (estaSeleccionado ? "Deseleccionar" : "Seleccionar para venta o fiado") : "Producto agotado (Sin stock)"}
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

                            {/* Nombre del Producto */}
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 dark:text-white block max-w-[220px] truncate">{prod.nombre}</span>
                              {prod.tipoProducto === 'servicio' && (
                                <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Servicio</span>
                              )}
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
                            <td className="py-2.5 px-3 whitespace-nowrap font-black text-sm text-emerald-600 dark:text-emerald-400">
                              ${(prod.precioVenta || 0).toLocaleString('es-CO')}
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

                                {esAdmin && (
                                  <>
                                    <button 
                                      onClick={() => abrirEdicion(prod)} 
                                      title="Editar producto"
                                      className="p-1 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 rounded-lg transition-colors ml-0.5"
                                    >
                                      <Edit3 size={14}/>
                                    </button>
                                    <button 
                                      onClick={() => setProductoAEliminar(prod)} 
                                      title="Eliminar producto"
                                      className="p-1 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={14}/>
                                    </button>
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
                            {inventario.length === 0 && esAdmin ? (
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

            </div>
          )}

          {/* BARRA FLOTANTE DE DESPACHO MASIVO (FLOTA SOBRE EL BOTTOMNAV EN MÓVIL) */}
          {productosSeleccionados.length > 0 && (
            <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[110] max-w-2xl w-[94%] sm:w-auto bg-slate-900/95 dark:bg-[#020617]/95 backdrop-blur-md text-white p-2.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 animate-in slide-in-from-bottom-5 duration-300">
              <div className="flex items-center justify-between w-full sm:w-auto gap-2 text-xs sm:text-sm">
                <span className="bg-emerald-500 text-slate-950 font-black px-2.5 py-1 rounded-full text-[11px] sm:text-xs shrink-0">
                  {productosSeleccionados.length} seleccionados
                </span>
                <span className="font-bold text-slate-200 truncate">
                  Total: <strong className="text-emerald-400 font-black">${montoTotalSeleccionado.toLocaleString('es-CO')}</strong>
                </span>
                <button
                  onClick={() => setProductosSeleccionados([])}
                  className="sm:hidden p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
                  title="Cancelar selección"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => despacharAVenta(productosSeleccionadosObj)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <ShoppingCart size={14} /> <span>Vender ({productosSeleccionados.length})</span>
                </button>
                <button
                  onClick={() => despacharAFiar(productosSeleccionadosObj)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-500 text-white font-black px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <Receipt size={14} /> <span>Fiar ({productosSeleccionados.length})</span>
                </button>
                <button
                  onClick={() => despacharASepare(productosSeleccionadosObj)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-500 text-white font-black px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <Bookmark size={14} /> <span>Separar ({productosSeleccionados.length})</span>
                </button>
                <button
                  onClick={() => setProductosSeleccionados([])}
                  className="hidden sm:inline-flex p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors shrink-0"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200">
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
                      1️⃣ Edita Precios o Stock
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Abre el archivo en tu computador y cambia los valores de tus productos existentes.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 block mb-1">
                      2️⃣ Agrega Nuevos
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Escribe nuevos artículos en las filas vacías al final de la tabla usando las listas desplegables.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400 block mb-1">
                      3️⃣ Sube en "Importar"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200">
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
                          1️⃣ Hoja "Inventario"
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Escribe cada producto o servicio a partir de la fila 2 en adelante.
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 block mb-1">
                          2️⃣ Listas Desplegables
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Selecciona <strong>Producto / Servicio</strong> y si es inventariable <strong>Sí / No</strong> con la flechita.
                        </p>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-black text-purple-600 dark:text-purple-400 block mb-1">
                          3️⃣ Hoja "Datos"
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
                      <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[11px]">
                        🟢 {productosAImportar.filter(p => p.accion === 'crear').length} Nuevos
                      </span>
                      {productosAImportar.filter(p => p.accion === 'actualizar').length > 0 && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full text-[11px]">
                          🔵 {productosAImportar.filter(p => p.accion === 'actualizar').length} Existentes a actualizar
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
                                  🔵 Actualizará
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                  🟢 Nuevo
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

      {/* MODAL CONFIGURAR EXPORTACIÓN QR INTELIGENTE Y TÉRMICA */}
      {esAdmin && modalExportarQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[92dvh]">
            
            {/* Header del Modal */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Exportar Etiquetas QR
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Compatible con impresoras térmicas de rollo (Jaltech, Digital POS, Zebra) y hojas de oficina
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
              
              {/* PASO 1: Tipo de Impresora */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Printer size={14} className="text-emerald-500" /> 1. ¿En qué tipo de impresora vas a imprimir?
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
                        🏷️ Impresora Térmica (Rollo)
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
                        📄 Hoja Carta / A4 (Oficina)
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
                  <Maximize2 size={14} className="text-emerald-500" /> 2. Tamaño del rollo / etiqueta
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
                          <span className="font-black text-xs text-slate-900 dark:text-white">⚙️ Personalizado</span>
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
                  <Package size={14} className="text-emerald-500" /> 3. ¿Qué productos deseas etiquetar?
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
                        📅 Creados hoy
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
                        🗓️ Últimos 7 días
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
                        📆 Desde fecha específica
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
                  <Layers size={14} className="text-emerald-500" /> 4. Cantidad de etiquetas por producto
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
                      📦 Según Stock
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
                      🏷️ 1 por Producto
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
                      🔢 Cantidad Fija
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
                      ✨ Selectivo Pro
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
                          📦 Todos a stock
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
                          🏷️ Todos a 1
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
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag size={14} className="text-emerald-500" /> 5. Datos impresos en el sticker
                </label>
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

                </div>
              </div>

              {/* VISTA PREVIA EN VIVO (LIVE PREVIEW) */}
              <div className="p-4 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Vista Previa del Sticker
                </span>
                
                {/* Contenedor simulado del sticker */}
                <div className="bg-white text-slate-900 p-3 rounded-xl shadow-md border border-slate-300 flex flex-col items-center text-center max-w-[220px] w-full">
                  {opcionNegocio && (
                    <span className="text-[9px] font-medium text-slate-500 uppercase leading-tight truncate max-w-full">
                      {datosSesion?.nombreNegocio || "MI NEGOCIO"}
                    </span>
                  )}
                  {opcionNombre && (
                    <span className="text-[11px] font-black leading-snug line-clamp-1">
                      {productosParaExportarQR[0]?.nombre || "Camiseta Básica Pro"}
                    </span>
                  )}
                  {opcionSku && (
                    <span className="text-[9px] text-slate-500 font-mono leading-none my-0.5">
                      {formatearTextoSKU(productosParaExportarQR[0]?.sku || "CAM-001")}
                    </span>
                  )}
                  <div className="my-1.5 p-1 bg-white border border-slate-200 rounded-lg">
                    <QrCode size={46} className="text-slate-900" />
                  </div>
                  {opcionPrecio && (
                    <span className="text-xs font-black text-slate-900 leading-none">
                      ${(productosParaExportarQR[0]?.precioVenta || 45000).toLocaleString('es-CO')}
                    </span>
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

      {/* MODAL CREAR / EDITAR PRODUCTO (BLINDADO PARA MÓVIL Y ESCRITORIO) */}
      {esAdmin && modalProducto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[950]">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl sm:rounded-[2.5rem] w-full max-w-5xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[94dvh] sm:max-h-[90dvh] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Encabezado Fijo del Modal */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 sm:py-4 dark:border-slate-800 dark:bg-slate-900/60 shrink-0 z-10">
              <h3 className="text-base sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 truncate">
                <Package size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0" /> {editandoId ? 'Editar Producto' : 'Agregar Productos'}
              </h3>
              <button
                type="button"
                onClick={() => setModalProducto(false)}
                className="rounded-xl sm:rounded-full bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0"
              >
                Cerrar
              </button>
            </div>

            {/* Cuerpo con Scroll Fluido */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre del Producto</label>
                      <input type="text" value={nombre} onChange={(e) => { setNombre(e.target.value); setErrores(prev => ({ ...prev, nombre: '' })); }} placeholder="Ej. Camisa Polo" className="w-full p-3 sm:p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-sm sm:text-base focus:border-emerald-500 text-slate-900 dark:text-white" />
                      {errores.nombre && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.nombre}</p>}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">SKU / Código</label>
                      <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. CAM-001" className="w-full p-3 sm:p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-sm sm:text-base focus:border-emerald-500 text-slate-900 dark:text-white" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Categoría</label>
                    <div className="relative">
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-200/50 transition-all focus-within:border-emerald-500 focus-within:shadow-lg focus-within:shadow-emerald-500/10 dark:border-slate-700 dark:bg-[#020617] dark:shadow-slate-950/30">
                        <input
                          value={categoria}
                          onFocus={() => setCategoriaFoco(true)}
                          onBlur={() => setTimeout(() => setCategoriaFoco(false), 140)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (categoriasFiltradas.length > 0) {
                                const siguiente = categoriasFiltradas[0];
                                setCategoria(siguiente);
                                setCategoriaFoco(false);
                                setErrores(prev => ({ ...prev, categoria: '' }));
                              } else if (categoriaTexto.trim()) {
                                agregarCategoria();
                              }
                            }
                          }}
                          onChange={(e) => {
                            setCategoria(e.target.value);
                            setErrores(prev => ({ ...prev, categoria: '' }));
                            setCategoriaFoco(true);
                          }}
                          placeholder="Escribe o busca una categoría"
                          className="w-full bg-transparent px-3 py-2 sm:py-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setCategoriaFoco((prev) => !prev)}
                          className="flex h-9 sm:h-10 w-9 sm:w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shrink-0"
                          aria-label="Mostrar categorías"
                        >
                          ▾
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Administrar categorías</span>
                        <button
                          type="button"
                          onClick={() => setGestionCategoriasHabilitada((prev) => !prev)}
                          className={`relative flex h-6 w-12 items-center rounded-full transition ${gestionCategoriasHabilitada ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                          aria-label="Habilitar administración de categorías"
                        >
                          <span className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition ${gestionCategoriasHabilitada ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {mensajeCategoria && (
                        <div className={`mt-2 rounded-2xl border px-3 py-2 text-left ${
                          mensajeCategoria.tipo === 'danger'
                            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                        }`}>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em]">{mensajeCategoria.titulo}</p>
                          <p className="mt-1 text-xs font-medium">{mensajeCategoria.detalle}</p>
                        </div>
                      )}

                      {menuCategoriasVisible && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:border-slate-700 dark:bg-[#0f172a] dark:shadow-slate-950/60 dark:scrollbar-thumb-slate-700">
                          {categoriasFiltradas.map((item) => (
                            <div key={item} className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800">
                              <button
                                type="button"
                                disabled={Boolean(categoriaEditando && categoriaEditando !== item)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setCategoria(item);
                                  setCategoriaFoco(false);
                                  setErrores(prev => ({ ...prev, categoria: '' }));
                                }}
                                className={`flex-1 text-left text-sm font-medium text-slate-700 transition dark:text-slate-200 ${Boolean(categoriaEditando && categoriaEditando !== item) ? 'cursor-not-allowed opacity-40' : ''}`}
                              >
                                {item}
                              </button>

                              {gestionCategoriasHabilitada && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={Boolean(categoriaEditando && categoriaEditando !== item)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setCategoriaEditando(item);
                                      setNombreCategoriaEditada(item);
                                    }}
                                    className={`rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 transition hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 ${Boolean(categoriaEditando && categoriaEditando !== item) ? 'cursor-not-allowed opacity-40' : ''}`}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={Boolean(categoriaEditando && categoriaEditando !== item)}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => eliminarCategoria(item)}
                                    className={`rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20 ${Boolean(categoriaEditando && categoriaEditando !== item) ? 'cursor-not-allowed opacity-40' : ''}`}
                                  >
                                    Borrar
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {gestionCategoriasHabilitada && categoriaEditando && (
                            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Editar categoría</label>
                              <input
                                value={nombreCategoriaEditada}
                                onChange={(e) => setNombreCategoriaEditada(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-[#020617] dark:text-slate-100"
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={guardarEdicionCategoria}
                                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white"
                                >
                                  Guardar
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setCategoriaEditando(null);
                                    setNombreCategoriaEditada('');
                                  }}
                                  className="flex-1 rounded-xl bg-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            disabled={Boolean(categoriaEditando)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={agregarCategoria}
                            className={`mt-1 flex w-full items-center justify-center rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15 ${Boolean(categoriaEditando) ? 'cursor-not-allowed opacity-40' : ''}`}
                          >
                            Nueva categoría
                          </button>
                        </div>
                      )}
                    </div>
                    {errores.categoria && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.categoria}</p>}
                  </div>

                  {productosEnCarga.length > 0 && (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5 sm:p-4 dark:border-sky-500/20 dark:bg-sky-500/5">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">Productos en esta carga</h4>
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">{productosEnCarga.length}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-sky-300 scrollbar-track-transparent dark:scrollbar-thumb-sky-700">
                        <div className="space-y-2">
                          {productosEnCarga.map((prod) => (
                            <div key={prod.id} className="flex items-start justify-between gap-3 rounded-xl border border-sky-100 bg-white px-3 py-2 dark:border-sky-500/10 dark:bg-slate-900/70">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">{prod.nombre}</p>
                                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{prod.sku || 'SIN SKU'} • {prod.categoria || 'General'}</p>
                                <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-300">
                                  <span>Stock: {prod.stock}</span>
                                  <span>•</span>
                                  <span>Precio: ${Number(prod.precioVenta || 0).toLocaleString('es-CO')}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => quitarProductoEnCarga(prod.id)}
                                className="mt-0.5 rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo</label>
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
                          className="w-full p-3 sm:p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-sm sm:text-base focus:border-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="producto">Producto</option>
                          <option value="servicio">Servicio</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">¿Inventariable?</label>
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
                          className="w-full p-3 sm:p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-sm sm:text-base focus:border-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="si">Sí (Maneja Stock)</option>
                          <option value="no">No (Ilimitado / Servicio)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {tipoProducto === 'producto' && inventariable ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Stock Disponible</label>
                        <input 
                          type="number" 
                          min="0" 
                          value={stock} 
                          onChange={(e) => { 
                            const valor = Number(e.target.value); 
                            setStock(String(Math.max(0, valor))); 
                            setErrores(prev => ({ ...prev, stock: '' })); 
                          }} 
                          placeholder="0" 
                          className="w-full p-3 sm:p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-base sm:text-lg focus:border-emerald-500 text-slate-900 dark:text-white" 
                        />
                        {errores.stock && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.stock}</p>}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20 p-3.5 sm:p-4 flex flex-col justify-center">
                        <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Stock</label>
                        <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-black text-sm sm:text-base">
                          <span>🛠️ Ilimitado</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">No requiere control de unidades</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Venta</label>
                      <input 
                        type="text" 
                        inputMode="numeric" 
                        value={formatearMonedaInput(precioVenta)} 
                        onChange={(e) => { 
                          setPrecioVenta(e.target.value.replace(/\D/g, '')); 
                          setErrores(prev => ({ ...prev, precio: '' })); 
                        }} 
                        placeholder="0" 
                        className="w-full p-3 sm:p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-base sm:text-lg focus:border-emerald-500 text-slate-900 dark:text-white" 
                      />
                      {errores.precio && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.precio}</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 sm:p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300 mb-2">Vista previa</h4>
                    <div className="space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex items-center justify-between"><span>Tipo</span><strong>{tipoProducto === 'servicio' ? 'Servicio' : 'Producto'}</strong></div>
                      <div className="flex items-center justify-between"><span>Categoría</span><strong>{categoria || 'Sin categoría'}</strong></div>
                      <div className="flex items-center justify-between"><span>Stock</span><strong>{stock || '0'}</strong></div>
                      <div className="flex items-center justify-between"><span>Precio</span><strong>${formatearMonedaInput(precioVenta) || '0'}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie de Página Fijo con Botones de Acción Accesibles en Móvil */}
            <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-4 dark:border-slate-800 dark:bg-[#0f172a] shrink-0 z-10 shadow-lg">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <button 
                  onClick={() => setModalProducto(false)} 
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm transition-colors order-3 sm:order-1"
                >
                  Cancelar
                </button>
                <button 
                  onClick={agregarProductoALaCarga} 
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-md text-xs sm:text-sm order-2 active:scale-95 transition-all"
                >
                  Agregar otro producto
                </button>
                <button 
                  onClick={guardarProducto} 
                  disabled={guardando} 
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-600/25 flex justify-center items-center gap-1.5 text-xs sm:text-sm order-1 sm:order-3 active:scale-95 transition-all"
                >
                  Guardar <CheckCircle2 size={16}/>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE PRODUCTO */}
      {esAdmin && productoAEliminar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[960] animate-in fade-in duration-200">
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