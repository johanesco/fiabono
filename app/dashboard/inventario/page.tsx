"use client";
import { useState, useEffect, useMemo } from "react";
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
  Upload
} from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

type ColumnaOrden = 'categoria' | 'nombre' | 'sku' | 'stock' | 'precioVenta';
type DireccionOrden = 'asc' | 'desc';
type FiltroStock = 'todos' | 'en_stock' | 'stock_bajo' | 'sin_stock' | 'servicios';
type OrigenExportacionQR = 'seleccionados' | 'fecha' | 'todos';
type FiltroFechaQR = 'hoy' | '7dias' | 'personalizado';
type TamanoEtiquetaQR = 'compacto' | 'estandar' | 'grande';
type ModoCantidadQR = 'stock' | 'uno';

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

  // Estados para el modal de configuración de exportación QR inteligente
  const [modalExportarQR, setModalExportarQR] = useState(false);
  const [origenExportacion, setOrigenExportacion] = useState<OrigenExportacionQR>('todos');
  const [filtroFechaExportacion, setFiltroFechaExportacion] = useState<FiltroFechaQR>('hoy');
  const [fechaDesdePersonalizada, setFechaDesdePersonalizada] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modoCantidadQR, setModoCantidadQR] = useState<ModoCantidadQR>('stock');
  const [tamanoEtiqueta, setTamanoEtiqueta] = useState<TamanoEtiquetaQR>('estandar');
  const [opcionNombre, setOpcionNombre] = useState(true);
  const [opcionSku, setOpcionSku] = useState(true);
  const [opcionPrecio, setOpcionPrecio] = useState(true);
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

  // Despacho directo a Venta o Fiado
  const despacharAVenta = (productos: any[]) => {
    const productosValidos = (productos || []).filter(tieneStockDisponible);
    if (productosValidos.length === 0) {
      toast.error("Los productos seleccionados no tienen stock disponible.");
      return;
    }
    const items = productosValidos.map(p => ({
      descripcion: p.nombre,
      valor: String(p.precioVenta || 0),
      cantidad: 1
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
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
      cantidad: 1
    }));
    sessionStorage.setItem('fiabono_productos_precargados', JSON.stringify(items));
    router.push('/dashboard/fiar');
  };

  const toggleSeleccionProducto = (prod: any) => {
    if (!tieneStockDisponible(prod)) {
      toast.error(`"${prod.nombre}" está agotado y no se puede seleccionar para venta o fiado.`);
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
    return productosParaExportarQR.reduce((acc, p) => {
      const cant = Number(p.stock) > 0 ? Number(p.stock) : 1;
      return acc + cant;
    }, 0);
  }, [productosParaExportarQR, modoCantidadQR]);

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

    setGuardando(true);
    try {
      if (editandoId) {
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
        toast.success("Producto actualizado.");
      } else {
        const totalGuardados = await guardarProductosEnCarga();
        if (nombre.trim()) {
          const docRef = await addDoc(collection(db, "inventario"), crearProductoDesdeFormulario());
          if (docRef.id) {
            toast.success(totalGuardados ? `Se guardaron ${totalGuardados + 1} productos.` : "Producto creado.");
          }
        }
      }

      setModalProducto(false);
      limpiarFormulario();
      if (cuentaPrincipalId) cargarInventario(cuentaPrincipalId);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar el producto.");
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

  // GENERAR PDF CON DISEÑO MULTI-TAMAÑO Y FILTRADO INTELIGENTE
  const generarPDFConQRs = async () => {
    if (productosParaExportarQR.length === 0) {
      if (origenExportacion === 'seleccionados') {
        return toast.error("No has seleccionado productos en la tabla. Marca las casillas de los productos que deseas etiquetar.");
      }
      if (origenExportacion === 'fecha') {
        return toast.error("No se encontraron productos registrados en el rango de fechas seleccionado.");
      }
      return toast.error("No hay productos para exportar.");
    }

    try {
      setModalExportarQR(false);
      const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      
      // Configuraciones según el tamaño de etiqueta elegido
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
        // 44 x 34 mm, 4 columnas por fila (ideal para joyas, accesorios y cosméticos)
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
        // 90 x 56 mm, 2 columnas por fila (ideal para cajas grandes, bultos y vitrinas)
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
      docPdf.text(`Etiquetas QR - Formato ${tamanoEtiqueta.toUpperCase()} (${productosParaExportarQR.length} referencias, ${totalEtiquetasCalculadas} etiquetas)`, startX, 10);

      for (const prod of productosParaExportarQR) {
        const cantidadImprimir = modoCantidadQR === 'stock' 
          ? (Number(prod.stock) > 0 ? Number(prod.stock) : 1)
          : 1;

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
              canvas.width = 160;
              canvas.height = 160;
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

          // Borde guía suave para corte de etiqueta
          docPdf.setDrawColor(210, 210, 210);
          docPdf.setLineWidth(0.2);
          docPdf.rect(x, y, anchoEtiqueta, altoEtiqueta);

          let cursorY = y + (tamanoEtiqueta === 'compacto' ? 4 : 5.5);

          if (opcionCategoria) {
            docPdf.setFontSize(tamanoEtiqueta === 'compacto' ? 5.5 : 7);
            docPdf.setFont("helvetica", "normal");
            docPdf.setTextColor(110, 110, 110);
            const catTexto = normalizarCategoria(prod.categoria).toUpperCase();
            docPdf.text(catTexto, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += (tamanoEtiqueta === 'compacto' ? 3 : 4);
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
            docPdf.text(`SKU: ${prod.sku || 'N/A'}`, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
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

      docPdf.save(`Etiquetas_QR_${tamanoEtiqueta}_${Date.now()}.pdf`);
      toast.success(`¡PDF generado con éxito con ${totalEtiquetasCalculadas} etiquetas!`);
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el PDF de etiquetas.");
    }
  };

  // EXPORTAR INVENTARIO A EXCEL (.XLSX)
  const exportarInventarioAExcel = () => {
    if (inventarioProcesado.length === 0) {
      return toast.error("No hay productos disponibles para exportar con los filtros actuales.");
    }

    try {
      const filas = inventarioProcesado.map(p => {
        const esServicio = p.tipoProducto === 'servicio' || p.inventariable === false;
        const stockNum = esServicio ? 0 : (Number(p.stock) || 0);
        const precioNum = Number(p.precioVenta) || 0;
        return {
          'Tipo de Producto': esServicio ? 'Servicio' : 'Producto',
          'Categoría de Inventarios / Servicios': normalizarCategoria(p.categoria),
          'Código del Producto / SKU': p.sku || '',
          'Nombre del Producto / Servicio': p.nombre || '',
          '¿Inventariable?': esServicio ? 'No' : 'Si',
          'Precio de Venta ($)': precioNum,
          'Stock Actual': stockNum,
          'Valor Total en Stock ($)': stockNum * precioNum
        };
      });

      const ws = XLSX.utils.json_to_sheet(filas);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 30 },
        { wch: 22 },
        { wch: 38 },
        { wch: 16 },
        { wch: 20 },
        { wch: 15 },
        { wch: 24 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
      
      const fechaHoy = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Inventario_Fiabono_${fechaHoy}.xlsx`);
      toast.success(`¡Inventario exportado con éxito (${filas.length} productos)!`);
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al exportar el inventario a Excel.");
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
  const renderStockBadge = (prod: any) => {
    const cant = Number(prod.stock || 0);
    const esServicio = prod.tipoProducto === 'servicio' || prod.inventariable === false;

    if (esServicio) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 px-2.5 py-1 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
          🛠️ Servicio / Ilimitado
        </span>
      );
    }

    if (cant <= 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 px-2.5 py-1 text-xs font-black border border-rose-200 dark:border-rose-800 animate-pulse">
          <XCircle size={13} className="shrink-0" /> Sin Stock (0)
        </span>
      );
    }

    if (cant <= 5) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2.5 py-1 text-xs font-black border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={13} className="shrink-0" /> Stock bajo ({cant})
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 px-2.5 py-1 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 size={13} className="shrink-0" /> {cant} {cant === 1 ? 'unidad' : 'unidades'}
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
    <div className="flex flex-col w-full h-full pb-24 md:pb-0 bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="bg-emerald-600 dark:bg-emerald-700 p-4 md:p-6 text-white flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-colors backdrop-blur-sm">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h2 className="text-xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-2">
              <Package size={26}/> Inventario General
            </h2>
            <p className="text-xs text-white/80 font-medium hidden sm:block">
              {esAdmin ? "Control de stock, precios y catálogo de productos" : "Consulta de catálogo, precios y disponibilidad"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {esAdmin && (
            <button 
              onClick={exportarInventarioAExcel} 
              className="bg-white/20 hover:bg-white/30 px-3 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm"
              title="Descargar inventario en archivo Excel .xlsx"
            >
              <FileSpreadsheet size={17}/> <span className="hidden sm:inline">Exportar Excel</span>
            </button>
          )}
          {esAdmin && (
            <button 
              onClick={() => { setProductosAImportar([]); setModalImportarExcel(true); }} 
              className="bg-white/20 hover:bg-white/30 px-3 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm"
              title="Cargar productos masivamente desde un archivo Excel"
            >
              <Upload size={17}/> <span className="hidden sm:inline">Importar Excel</span>
            </button>
          )}
          {esAdmin && (
            <button 
              onClick={() => setModalExportarQR(true)} 
              className="bg-white/20 hover:bg-white/30 px-3 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-colors backdrop-blur-sm shadow-sm"
              title="Imprimir o exportar etiquetas con códigos QR"
            >
              <Printer size={17}/> <span className="hidden sm:inline">Exportar QRs</span>
            </button>
          )}
          {esAdmin && (
            <button 
              onClick={() => { limpiarFormulario(); setModalProducto(true); }} 
              className="bg-white text-emerald-700 hover:bg-emerald-50 px-3.5 sm:px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-transform active:scale-95"
            >
              <Plus size={17}/> <span className="hidden xs:inline">Nuevo Producto</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5">
          
          {/* TARJETAS DE MÉTRICAS (ADMIN) O ALERTAS SUTILES DE STOCK (COLABORADOR) */}
          {esAdmin ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              
              {/* Tarjeta 1: Total Referencias */}
              <div 
                onClick={limpiarTodosLosFiltros}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
                  filtrosStock.length === 0 && filtrosCategoria.length === 0 && !busqueda
                    ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/20'
                    : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                    Referencias
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {metricas.totalProductos}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                      ({metricas.unidadesFisicasTotales} un.)
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                  <Boxes size={16} />
                </div>
              </div>

              {/* Tarjeta 2: Valor del Inventario */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                    Valor Mercancía
                  </span>
                  <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate mt-0.5">
                    ${metricas.valorTotal.toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                  <DollarSign size={16} />
                </div>
              </div>

              {/* Tarjeta 3: Stock Bajo */}
              <div 
                onClick={() => toggleFiltroStock('stock_bajo')}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
                  filtrosStock.includes('stock_bajo')
                    ? 'bg-amber-500/15 border-amber-500 dark:bg-amber-500/25 ring-2 ring-amber-500/20'
                    : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-amber-400'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block truncate">
                    Stock Bajo (1-5)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                      {metricas.stockBajo}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                      por agotar
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                  <AlertTriangle size={16} />
                </div>
              </div>

              {/* Tarjeta 4: Sin Stock */}
              <div 
                onClick={() => toggleFiltroStock('sin_stock')}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${
                  filtrosStock.includes('sin_stock')
                    ? 'bg-rose-500/15 border-rose-500 dark:bg-rose-500/25 ring-2 ring-rose-500/20'
                    : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-rose-400'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 block truncate">
                    Sin Stock (0)
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                      {metricas.sinStock}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                      agotados
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                  <XCircle size={16} />
                </div>
              </div>

            </div>
          ) : (
            /* VISTA COLABORADOR: ALERTAS SUTILES DE DISPONIBILIDAD */
            (metricas.stockBajo > 0 || metricas.sinStock > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 px-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Avisos de tienda:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {metricas.stockBajo > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleFiltroStock('stock_bajo')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        filtrosStock.includes('stock_bajo')
                          ? 'bg-amber-600 text-white shadow-sm font-black ring-2 ring-amber-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 hover:border-amber-400'
                      }`}
                    >
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>Stock Bajo ({metricas.stockBajo})</span>
                    </button>
                  )}
                  {metricas.sinStock > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleFiltroStock('sin_stock')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        filtrosStock.includes('sin_stock')
                          ? 'bg-rose-600 text-white shadow-sm font-black ring-2 ring-rose-500/30'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 hover:border-rose-400'
                      }`}
                    >
                      <XCircle size={13} className="shrink-0" />
                      <span>Agotados ({metricas.sinStock})</span>
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {/* BARRA DE BÚSQUEDA Y SELECTOR DE VISTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
                placeholder="Buscar por nombre, SKU o categoría..." 
                className="w-full p-4 pl-12 pr-10 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500 shadow-sm transition-colors text-base text-slate-900 dark:text-white" 
              />
              {busqueda && (
                <button 
                  onClick={() => setBusqueda("")} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Selector de Pestañas (Solo Admin puede ver vista QR) */}
            {esAdmin && (
              <div className="flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl shrink-0 w-full sm:w-auto justify-center">
                <button 
                  onClick={() => setVistaActual('lista')} 
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${vistaActual === 'lista' ? 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <LayoutList size={18} /> Tabla
                </button>
                <button 
                  onClick={() => setVistaActual('qr')} 
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${vistaActual === 'qr' ? 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <QrCode size={18} /> Códigos QR
                </button>
              </div>
            )}
          </div>

          {/* FILTROS POR ESTADO DE STOCK (PILLS MULTI-SELECCIÓN) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1 mr-1">
              <Layers size={14} /> Stock:
            </span>
            <button
              onClick={limpiarFiltroStock}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filtrosStock.length === 0
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-black'
                  : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
            >
              Todos ({inventario.length})
            </button>
            <button
              onClick={() => toggleFiltroStock('en_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                filtrosStock.includes('en_stock')
                  ? 'bg-emerald-600 text-white shadow-sm font-black ring-2 ring-emerald-500/30'
                  : 'bg-white dark:bg-[#0f172a] text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 hover:border-emerald-400'
              }`}
            >
              <CheckCircle2 size={13} /> Con Stock / Disponibles ({metricas.enStock})
            </button>
            <button
              onClick={() => toggleFiltroStock('stock_bajo')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                filtrosStock.includes('stock_bajo')
                  ? 'bg-amber-600 text-white shadow-sm font-black ring-2 ring-amber-500/30'
                  : 'bg-white dark:bg-[#0f172a] text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-800 hover:border-amber-400'
              }`}
            >
              <AlertTriangle size={13} /> Stock Bajo ({metricas.stockBajo})
            </button>
            <button
              onClick={() => toggleFiltroStock('sin_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                filtrosStock.includes('sin_stock')
                  ? 'bg-rose-600 text-white shadow-sm font-black ring-2 ring-rose-500/30'
                  : 'bg-white dark:bg-[#0f172a] text-rose-700 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:border-rose-400'
              }`}
            >
              <XCircle size={13} /> Sin Stock ({metricas.sinStock})
            </button>
            <button
              onClick={() => toggleFiltroStock('servicios')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                filtrosStock.includes('servicios')
                  ? 'bg-indigo-600 text-white shadow-sm font-black ring-2 ring-indigo-500/30'
                  : 'bg-white dark:bg-[#0f172a] text-indigo-700 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-400'
              }`}
            >
              <span>🛠️</span> Servicios / Ilimitados ({metricas.totalServicios})
            </button>
          </div>

          {/* FILTROS POR ETIQUETAS / CATEGORÍAS (PILLS MULTI-SELECCIÓN) */}
          {categoriasPresentes.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                <Tag size={14} /> Categoría:
              </span>
              <button
                onClick={limpiarFiltroCategoria}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  filtrosCategoria.length === 0
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
                }`}
              >
                Todas las categorías ({categoriasPresentes.length})
              </button>
              {categoriasPresentes.map(cat => {
                const count = inventario.filter(p => normalizarCategoria(p.categoria).toLowerCase() === cat.toLowerCase()).length;
                const estaSeleccionada = filtrosCategoria.includes(cat.toLowerCase());
                return (
                  <button
                    key={cat}
                    onClick={() => toggleFiltroCategoria(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      estaSeleccionada
                        ? 'bg-blue-600 text-white shadow-sm font-black ring-2 ring-blue-500/30'
                        : 'bg-white dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
                    }`}
                  >
                    {estaSeleccionada && <span>✓</span>}
                    <span>{cat}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full ${estaSeleccionada ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* BARRA DE FILTROS ACTIVOS CON CHIPS REMOVIBLES (NUNCA SE CORTA) */}
          {(filtrosStock.length > 0 || filtrosCategoria.length > 0 || busqueda.trim()) && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 px-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-slate-400 uppercase tracking-wider text-[11px] flex items-center gap-1 mr-1">
                  <Sliders size={13} /> Filtros activos ({filtrosStock.length + filtrosCategoria.length + (busqueda.trim() ? 1 : 0)}):
                </span>

                {/* Chip Búsqueda */}
                {busqueda.trim() && (
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                    <Search size={11} className="text-slate-400" />
                    <span>Texto: <em>"{busqueda}"</em></span>
                    <button 
                      type="button" 
                      onClick={() => setBusqueda("")} 
                      className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-rose-500 transition-colors"
                      title="Quitar búsqueda"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}

                {/* Chips Filtros de Stock */}
                {filtrosStock.map(f => (
                  <span 
                    key={f} 
                    className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 font-bold"
                  >
                    <span>Stock: {f === 'en_stock' ? 'Con stock' : f === 'stock_bajo' ? 'Stock bajo' : f === 'sin_stock' ? 'Sin stock' : 'Servicios'}</span>
                    <button 
                      type="button" 
                      onClick={() => toggleFiltroStock(f)} 
                      className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 rounded-full text-emerald-500 hover:text-rose-500 transition-colors"
                      title="Quitar filtro de stock"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}

                {/* Chips Filtros de Categoría */}
                {filtrosCategoria.map(c => (
                  <span 
                    key={c} 
                    className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800 font-bold capitalize"
                  >
                    <span>Cat: {c}</span>
                    <button 
                      type="button" 
                      onClick={() => toggleFiltroCategoria(c)} 
                      className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-900 rounded-full text-blue-500 hover:text-rose-500 transition-colors"
                      title="Quitar categoría"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Botón Restablecer todo */}
              <button
                type="button"
                onClick={limpiarTodosLosFiltros}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 ml-auto shrink-0"
              >
                <X size={13} /> Limpiar todos
              </button>
            </div>
          )}

          {/* QR OCULTOS PARA GENERAR EL PDF CORRECTAMENTE */}
          <div className="hidden">
            {inventario.map(prod => (
              <QRCodeSVG key={prod.id} id={`qr-svg-${prod.id}`} value={prod.sku || prod.id} size={128} />
            ))}
          </div>

          {/* VISTA 1: TABLA ORDENADA Y FILTRADA */}
          {vistaActual === 'lista' && (
            <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#020617] text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-wider select-none">
                      
                      {/* Checkbox seleccionar todos */}
                      <th className="p-4 w-10 text-center">
                        <button 
                          type="button" 
                          onClick={toggleSeleccionarTodos}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors inline-flex items-center justify-center"
                          title="Seleccionar todos los productos visibles"
                        >
                          {productosSeleccionados.length > 0 && productosSeleccionados.length === inventarioProcesado.length ? (
                            <CheckSquare size={19} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square size={19} />
                          )}
                        </button>
                      </th>

                      {/* Columna Categoría */}
                      <th 
                        onClick={() => handleSort('categoria')}
                        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Categoría</span>
                          {renderSortIndicator('categoria')}
                        </div>
                      </th>

                      {/* Columna Nombre */}
                      <th 
                        onClick={() => handleSort('nombre')}
                        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Producto</span>
                          {renderSortIndicator('nombre')}
                        </div>
                      </th>

                      {/* Columna SKU / Código */}
                      <th 
                        onClick={() => handleSort('sku')}
                        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>SKU / Código</span>
                          {renderSortIndicator('sku')}
                        </div>
                      </th>

                      {/* Columna Stock */}
                      <th 
                        onClick={() => handleSort('stock')}
                        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Stock</span>
                          {renderSortIndicator('stock')}
                        </div>
                      </th>

                      {/* Columna Precio */}
                      <th 
                        onClick={() => handleSort('precioVenta')}
                        className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Precio Venta</span>
                          {renderSortIndicator('precioVenta')}
                        </div>
                      </th>

                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm font-medium">
                    {inventarioProcesado.map(prod => {
                      const estaSeleccionado = productosSeleccionados.includes(prod.id);
                      const disponible = tieneStockDisponible(prod);
                      return (
                        <tr 
                          key={prod.id} 
                          className={`transition-colors ${estaSeleccionado ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'}`}
                        >
                          
                          {/* Checkbox por fila */}
                          <td className="p-4 w-10 text-center">
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
                                <CheckSquare size={19} className="text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Square size={19} />
                              )}
                            </button>
                          </td>

                          {/* Categoría */}
                          <td className="p-4">
                            <span className="inline-flex rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-3 py-1 text-[11px] font-bold border border-blue-100 dark:border-blue-900/50">
                              {normalizarCategoria(prod.categoria)}
                            </span>
                          </td>

                          {/* Nombre del Producto */}
                          <td className="p-4">
                            <span className="font-bold text-slate-900 dark:text-white block max-w-[240px] truncate">{prod.nombre}</span>
                            {prod.tipoProducto === 'servicio' && (
                              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block mt-0.5">Servicio</span>
                            )}
                          </td>

                          {/* SKU */}
                          <td className="p-4">
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                              {prod.sku || 'SIN SKU'}
                            </span>
                          </td>

                          {/* Stock con Badge Inteligente */}
                          <td className="p-4 whitespace-nowrap">
                            {renderStockBadge(prod)}
                          </td>

                          {/* Precio */}
                          <td className="p-4 whitespace-nowrap font-black text-base text-emerald-600 dark:text-emerald-400">
                            ${(prod.precioVenta || 0).toLocaleString('es-CO')}
                          </td>

                          {/* Acciones: Vender, Fiar, y si es Admin: Editar, Eliminar */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => despacharAVenta([prod])} 
                                disabled={!disponible}
                                title={disponible ? "Registrar venta con este producto" : "Producto agotado (Sin stock)"}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-sm ${
                                  !disponible 
                                    ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                    : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white active:scale-95'
                                }`}
                              >
                                <ShoppingCart size={13} /> <span className="hidden sm:inline">Vender</span>
                              </button>
                              <button 
                                onClick={() => despacharAFiar([prod])} 
                                disabled={!disponible}
                                title={disponible ? "Registrar fiado con este producto" : "Producto agotado (Sin stock)"}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shadow-sm ${
                                  !disponible 
                                    ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-50'
                                    : 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white active:scale-95'
                                }`}
                              >
                                <Receipt size={13} /> <span className="hidden sm:inline">Fiar</span>
                              </button>

                              {esAdmin && (
                                <>
                                  <button 
                                    onClick={() => abrirEdicion(prod)} 
                                    title="Editar producto"
                                    className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-400 hover:text-blue-600 rounded-xl transition-colors ml-1"
                                  >
                                    <Edit3 size={15}/>
                                  </button>
                                  <button 
                                    onClick={() => setProductoAEliminar(prod)} 
                                    title="Eliminar producto"
                                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                                  >
                                    <Trash2 size={15}/>
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
                        <td colSpan={7} className="py-14 text-center text-slate-400">
                          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                          <p className="font-bold text-base">No se encontraron productos con estos filtros.</p>
                          {(busqueda || filtrosCategoria.length > 0 || filtrosStock.length > 0) && (
                            <button 
                              onClick={limpiarTodosLosFiltros}
                              className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
                            >
                              Limpiar todos los filtros
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BARRA FLOTANTE DE DESPACHO MASIVO */}
          {productosSeleccionados.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] sm:w-auto bg-slate-900/95 dark:bg-[#020617]/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-3xl shadow-2xl border border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
              <div className="flex items-center gap-3 text-sm">
                <span className="bg-emerald-500 text-slate-950 font-black px-2.5 py-1 rounded-full text-xs">
                  {productosSeleccionados.length} seleccionados
                </span>
                <span className="font-bold text-slate-200">
                  Total: <strong className="text-emerald-400 font-black">${montoTotalSeleccionado.toLocaleString('es-CO')}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => despacharAVenta(productosSeleccionadosObj)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <ShoppingCart size={15} /> Vender ({productosSeleccionados.length})
                </button>
                <button
                  onClick={() => despacharAFiar(productosSeleccionadosObj)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  <Receipt size={15} /> Fiar ({productosSeleccionados.length})
                </button>
                <button
                  onClick={() => setProductosSeleccionados([])}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                  title="Cancelar selección"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* VISTA 2: TARJETAS CON CÓDIGOS QR */}
          {esAdmin && vistaActual === 'qr' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {inventarioProcesado.map(prod => (
                <div key={prod.id} className="bg-white dark:bg-[#0f172a] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center relative group hover:shadow-md transition-shadow">
                  
                  {esAdmin && (
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => abrirEdicion(prod)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><Edit3 size={14}/></button>
                      <button onClick={() => setProductoAEliminar(prod)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"><Trash2 size={14}/></button>
                    </div>
                  )}

                  <div className="w-28 h-28 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-3 shadow-inner">
                    <QRCodeSVG value={prod.sku || prod.id} size={96} />
                  </div>

                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full mb-1">
                    {normalizarCategoria(prod.categoria)}
                  </span>
                  <h4 className="font-black text-slate-900 dark:text-white text-base truncate w-full">{prod.nombre}</h4>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 mt-1">SKU: {prod.sku || 'N/A'}</span>
                  
                  <div className="flex justify-between items-center w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      {renderStockBadge(prod)}
                    </div>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">${(prod.precioVenta || 0).toLocaleString('es-CO')}</span>
                  </div>
                </div>
              ))}
              {inventarioProcesado.length === 0 && (
                <div className="col-span-full py-14 text-center text-slate-400 font-bold">
                  No se encontraron productos con estos filtros.
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* MODAL IMPORTAR INVENTARIO DESDE EXCEL */}
      {esAdmin && modalImportarExcel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            
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
                  
                  {/* Tarjeta de Descarga de Plantilla Oficial */}
                  <div className="p-5 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-[#0f172a] rounded-3xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md shrink-0">
                        <Download size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          ¿No tienes la plantilla oficial?
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          Descarga el formato Excel con listas desplegables y ejemplos para diligenciar.
                        </p>
                      </div>
                    </div>
                    <a
                      href="/plantillas/Formato_Inventario_Fiabono.xlsx"
                      download="Formato_Inventario_Fiabono.xlsx"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-3 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 active:scale-95 shrink-0"
                    >
                      <Download size={16} /> Descargar Formato (.xlsx)
                    </a>
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

      {/* MODAL CONFIGURAR EXPORTACIÓN QR INTELIGENTE */}
      {esAdmin && modalExportarQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[950] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header del Modal */}
            <div className="p-6 md:p-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                  <Printer size={24} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Exportar Etiquetas QR
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Personaliza el lote, tamaño y datos para imprimir tus adhesivos
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
            <div className="p-6 md:p-7 overflow-y-auto space-y-6 flex-1">
              
              {/* PASO 1: ¿Qué productos etiquetar? */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Package size={14} className="text-emerald-500" /> 1. ¿Qué productos deseas etiquetar?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Opción A: Seleccionados en la tabla */}
                  <div
                    onClick={() => {
                      if (productosSeleccionados.length > 0) setOrigenExportacion('seleccionados');
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      productosSeleccionados.length === 0 
                        ? 'opacity-40 border-slate-200 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-900/30' 
                        : origenExportacion === 'seleccionados'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
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

                  {/* Opción B: Nuevos por fecha */}
                  <div
                    onClick={() => setOrigenExportacion('fecha')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      origenExportacion === 'fecha'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
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

                  {/* Opción C: Todo el catálogo filtrado */}
                  <div
                    onClick={() => setOrigenExportacion('todos')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      origenExportacion === 'todos'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
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

              {/* PASO 2: Cantidad de copias */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers size={14} className="text-emerald-500" /> 2. Cantidad de etiquetas a generar
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setModoCantidadQR('stock')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      modoCantidadQR === 'stock'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="font-black text-sm text-slate-900 dark:text-white block mb-0.5">
                      📦 1 etiqueta por cada unidad de stock
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Si tienes 5 unidades en bodega, genera 5 adhesivos para pegarle a cada uno.
                    </p>
                  </div>

                  <div
                    onClick={() => setModoCantidadQR('uno')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      modoCantidadQR === 'uno'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="font-black text-sm text-slate-900 dark:text-white block mb-0.5">
                      🏷️ 1 etiqueta única por producto
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Solo genera 1 adhesivo por referencia. Ideal para vitrinas, perchas o exhibidores.
                    </p>
                  </div>
                </div>
              </div>

              {/* PASO 3: Tamaño de la etiqueta */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Maximize2 size={14} className="text-emerald-500" /> 3. Tamaño del adhesivo / papel
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Compacto */}
                  <div
                    onClick={() => setTamanoEtiqueta('compacto')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      tamanoEtiqueta === 'compacto'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Compacto</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-600 dark:text-slate-300">4x3.4 cm</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      4 col / hoja. Joyería, cosméticos, papelería y productos pequeños.
                    </p>
                  </div>

                  {/* Estándar */}
                  <div
                    onClick={() => setTamanoEtiqueta('estandar')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                      tamanoEtiqueta === 'estandar'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="absolute -top-2.5 right-3 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                      Recomendado
                    </span>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Estándar</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-600 dark:text-slate-300">5.8x4.8 cm</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      3 col / hoja. Ropa, calzado, cajas y uso general.
                    </p>
                  </div>

                  {/* Grande */}
                  <div
                    onClick={() => setTamanoEtiqueta('grande')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      tamanoEtiqueta === 'grande'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Grande</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-bold text-slate-600 dark:text-slate-300">9x5.6 cm</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      2 col / hoja. Bodega, bultos grandes y estanterías.
                    </p>
                  </div>

                </div>
              </div>

              {/* PASO 4: Datos a mostrar */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag size={14} className="text-emerald-500" /> 4. Información impresa en cada etiqueta
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  
                  <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionNombre} onChange={(e) => setOpcionNombre(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Nombre</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionSku} onChange={(e) => setOpcionSku(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">SKU / Código</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionPrecio} onChange={(e) => setOpcionPrecio(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Precio</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-800 select-none">
                    <input type="checkbox" checked={opcionCategoria} onChange={(e) => setOpcionCategoria(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Categoría</span>
                  </label>

                </div>
              </div>

            </div>

            {/* Footer con Resumen Dinámico y Botones */}
            <div className="p-5 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600 dark:text-slate-300 w-full sm:w-auto text-center sm:text-left">
                <span className="font-medium text-slate-400 block text-[11px]">Resumen de exportación:</span>
                <strong>{productosParaExportarQR.length} productos</strong> seleccionados • <strong className="text-emerald-600 dark:text-emerald-400">{totalEtiquetasCalculadas} etiquetas en total</strong>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  type="button"
                  onClick={() => setModalExportarQR(false)} 
                  className="flex-1 sm:flex-none bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold py-3 px-5 rounded-2xl text-sm border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={generarPDFConQRs} 
                  disabled={productosParaExportarQR.length === 0}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                >
                  <Download size={17}/> Descargar PDF ({totalEtiquetasCalculadas})
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR PRODUCTO */}
      {esAdmin && modalProducto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950]">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] w-full max-w-6xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Package size={24}/> {editandoId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={() => setModalProducto(false)}
                className="rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-6">
              <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre del Producto</label>
                      <input type="text" value={nombre} onChange={(e) => { setNombre(e.target.value); setErrores(prev => ({ ...prev, nombre: '' })); }} placeholder="Ej. Camisa Polo" className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500 text-slate-900 dark:text-white" />
                      {errores.nombre && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.nombre}</p>}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">SKU / Código</label>
                      <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. CAM-001" className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500 text-slate-900 dark:text-white" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
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
                          className="w-full bg-transparent px-3 py-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setCategoriaFoco((prev) => !prev)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          aria-label="Mostrar categorías"
                        >
                          ▾
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Administrar categorías (modificar o eliminar)</span>
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
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/5">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">Productos en esta carga</h4>
                        <span className="rounded-full bg-sky-600 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">{productosEnCarga.length}</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-sky-300 scrollbar-track-transparent dark:scrollbar-thumb-sky-700">
                        <div className="space-y-2">
                          {productosEnCarga.map((prod) => (
                            <div key={prod.id} className="flex items-start justify-between gap-3 rounded-xl border border-sky-100 bg-white px-3 py-2 dark:border-sky-500/10 dark:bg-slate-900/70">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{prod.nombre}</p>
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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid grid-cols-2 gap-4">
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
                          className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500 text-slate-900 dark:text-white"
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
                          className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="si">Sí (Maneja Stock)</option>
                          <option value="no">No (Ilimitado / Servicio)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tipoProducto === 'producto' && inventariable ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
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
                          className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-lg focus:border-emerald-500 text-slate-900 dark:text-white" 
                        />
                        {errores.stock && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.stock}</p>}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20 p-4 flex flex-col justify-center">
                        <label className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Stock</label>
                        <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-black text-base">
                          <span>🛠️ Ilimitado</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">No requiere control de unidades</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
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
                        className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-lg focus:border-emerald-500 text-slate-900 dark:text-white" 
                      />
                      {errores.precio && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.precio}</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/5">
                    <h4 className="text-sm font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300 mb-3">Vista previa</h4>
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex items-center justify-between"><span>Tipo</span><strong>{tipoProducto === 'servicio' ? 'Servicio' : 'Producto'}</strong></div>
                      <div className="flex items-center justify-between"><span>Categoría</span><strong>{categoria || 'Sin categoría'}</strong></div>
                      <div className="flex items-center justify-between"><span>Stock</span><strong>{stock || '0'}</strong></div>
                      <div className="flex items-center justify-between"><span>Precio</span><strong>${formatearMonedaInput(precioVenta) || '0'}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-[#0f172a]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button onClick={() => setModalProducto(false)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl text-base transition-colors">Cancelar</button>
                <button onClick={agregarProductoALaCarga} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 rounded-2xl shadow-lg text-base">Agregar otro producto</button>
                <button onClick={guardarProducto} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-base">Guardar <CheckCircle2 size={18}/></button>
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
    </div>
  );
}

function formatearMonedaInput(valor: string) {
  if (!valor) return "";
  const numeroStr = valor.replace(/\D/g, '');
  if (!numeroStr) return "";
  return parseInt(numeroStr, 10).toLocaleString('es-CO');
}