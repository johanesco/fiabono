"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, doc, updateDoc, deleteDoc, where, addDoc } from "firebase/firestore";
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
  X
} from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';

type ColumnaOrden = 'categoria' | 'nombre' | 'sku' | 'stock' | 'precioVenta';
type DireccionOrden = 'asc' | 'desc';
type FiltroStock = 'todos' | 'en_stock' | 'stock_bajo' | 'sin_stock' | 'servicios';

export default function InventarioPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;

  const [inventario, setInventario] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [vistaActual, setVistaActual] = useState<'lista' | 'qr'>('lista');
  const [modalProducto, setModalProducto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Estados de Ordenamiento y Filtrado con Multi-Selección
  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrden>('nombre');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');
  const [filtrosCategoria, setFiltrosCategoria] = useState<string[]>([]);
  const [filtrosStock, setFiltrosStock] = useState<('en_stock' | 'stock_bajo' | 'sin_stock' | 'servicios')[]>([]);

  // Estados para el modal de configuración de exportación QR
  const [modalExportarQR, setModalExportarQR] = useState(false);
  const [opcionNombre, setOpcionNombre] = useState(true);
  const [opcionSku, setOpcionSku] = useState(true);
  const [opcionPrecio, setOpcionPrecio] = useState(true);

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
    const totalReferencias = inventario.length;
    const valorTotal = inventario.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.precioVenta) || 0)), 0);
    const totalServicios = inventario.filter(p => p.tipoProducto === 'servicio' || p.inventariable === false).length;
    const stockBajo = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) > 0 && Number(p.stock) <= 5).length;
    const sinStock = inventario.filter(p => p.inventariable !== false && p.tipoProducto !== 'servicio' && Number(p.stock) <= 0).length;
    const enStock = inventario.filter(p => (p.inventariable !== false && p.tipoProducto !== 'servicio') && Number(p.stock) > 5).length;

    return {
      totalReferencias,
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
          if (filtro === 'en_stock') return !esServicio && cant > 5;
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

  const eliminarProducto = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto del inventario?")) {
      try {
        await deleteDoc(doc(db, "inventario", id));
        toast.success("Producto eliminado.");
        if (cuentaPrincipalId) cargarInventario(cuentaPrincipalId);
      } catch (error) {
        console.error(error);
        toast.error("Error al eliminar");
      }
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

  // GENERAR PDF CON DISEÑO SIMÉTRICO Y CENTRADO
  const generarPDFConQRs = async () => {
    if (inventario.length === 0) {
      return toast.error("No hay productos en el inventario para exportar.");
    }

    try {
      setModalExportarQR(false);
      const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      
      let x = 15;
      let y = 15;
      const anchoEtiqueta = 55;
      const altoEtiqueta = 48;
      const margenX = 10;
      const margenY = 10;
      let contadorCol = 0;

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(14);
      docPdf.text("Etiquetas de Inventario - Códigos QR", 15, 10);

      for (const prod of inventarioProcesado) {
        const cantidadImprimir = Number(prod.stock) > 0 ? Number(prod.stock) : 1;
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
              canvas.width = 150;
              canvas.height = 150;
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
          if (y + altoEtiqueta > 270) {
            docPdf.addPage();
            x = 15;
            y = 15;
            contadorCol = 0;
          }

          docPdf.setDrawColor(180, 180, 180);
          docPdf.rect(x, y, anchoEtiqueta, altoEtiqueta);

          let cursorY = y + 6;

          if (opcionNombre) {
            docPdf.setFontSize(9);
            docPdf.setFont("helvetica", "bold");
            const nombreCorto = prod.nombre.length > 25 ? prod.nombre.substring(0, 23) + '...' : prod.nombre;
            docPdf.text(nombreCorto, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += 5;
          }

          if (opcionSku) {
            docPdf.setFontSize(8);
            docPdf.setFont("helvetica", "normal");
            docPdf.text(`SKU: ${prod.sku || 'N/A'}`, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += 4.5;
          }

          if (opcionPrecio) {
            docPdf.setFontSize(8);
            docPdf.setFont("helvetica", "bold");
            docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += 2;
          }

          if (qrDataUrl) {
            const qrSize = 24;
            const qrX = x + (anchoEtiqueta - qrSize) / 2;
            docPdf.addImage(qrDataUrl, 'PNG', qrX, cursorY + 2, qrSize, qrSize);
          }

          contadorCol++;
          if (contadorCol < 3) {
            x += anchoEtiqueta + margenX;
          } else {
            x = 15;
            y += altoEtiqueta + margenY;
            contadorCol = 0;
          }
        }
      }

      docPdf.save(`Etiquetas_QR_Inventario_${Date.now()}.pdf`);
      toast.success("¡PDF de etiquetas simétricas generado!");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el PDF de etiquetas.");
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
      <div className="bg-emerald-600 dark:bg-emerald-700 p-4 md:p-6 text-white flex justify-between items-center shrink-0 z-30 shadow-sm gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4 min-w-0">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm shrink-0">
            <ArrowLeft size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-1.5 sm:gap-2 truncate">
              <Package size={22} className="sm:w-[26px] sm:h-[26px] shrink-0" /> <span className="truncate">Inventario General</span>
            </h2>
            <p className="text-xs text-white/80 font-medium hidden sm:block">Control de stock, precios y catálogo de productos</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button 
            onClick={() => setModalExportarQR(true)} 
            className="bg-white/20 hover:bg-white/30 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors backdrop-blur-sm shadow-sm"
          >
            <FileText size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">Exportar QRs</span>
          </button>
          <button 
            onClick={() => { limpiarFormulario(); setModalProducto(true); }} 
            className="bg-white text-emerald-700 hover:bg-emerald-50 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 shadow-md transition-transform active:scale-95 shrink-0"
          >
            <Plus size={16} className="sm:w-[18px] sm:h-[18px]" /> <span className="hidden sm:inline">Nuevo Producto</span><span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* TARJETAS DE MÉTRICAS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            
            {/* Tarjeta 1: Total Referencias */}
            <div 
              onClick={limpiarTodosLosFiltros}
              className={`p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all cursor-pointer shadow-sm ${
                filtrosStock.length === 0 && filtrosCategoria.length === 0 && !busqueda
                  ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-500/20'
                  : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Referencias</span>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Boxes size={18} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {metricas.totalReferencias}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1 font-medium">En catálogo (Clic para ver todo)</p>
            </div>

            {/* Tarjeta 2: Valor del Inventario */}
            <div className="p-4 md:p-5 rounded-2xl md:rounded-3xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Valor Inventario</span>
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
                  <DollarSign size={18} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                ${metricas.valorTotal.toLocaleString('es-CO')}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1 font-medium">En mercancía activa</p>
            </div>

            {/* Tarjeta 3: Stock Bajo */}
            <div 
              onClick={() => toggleFiltroStock('stock_bajo')}
              className={`p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all cursor-pointer shadow-sm ${
                filtrosStock.includes('stock_bajo')
                  ? 'bg-amber-500/15 border-amber-500 dark:bg-amber-500/25 ring-2 ring-amber-500/20'
                  : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-amber-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Stock Bajo (1-5)</span>
                <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {metricas.stockBajo}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1 font-medium">Por agotarse</p>
            </div>

            {/* Tarjeta 4: Sin Stock / Agotados */}
            <div 
              onClick={() => toggleFiltroStock('sin_stock')}
              className={`p-4 md:p-5 rounded-2xl md:rounded-3xl border transition-all cursor-pointer shadow-sm ${
                filtrosStock.includes('sin_stock')
                  ? 'bg-rose-500/15 border-rose-500 dark:bg-rose-500/25 ring-2 ring-rose-500/20'
                  : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-rose-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] md:text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Sin Stock (0)</span>
                <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
                  <XCircle size={18} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                {metricas.sinStock}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1 font-medium">Agotados</p>
            </div>

          </div>

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

            {/* Selector de Pestañas */}
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
              <CheckCircle2 size={13} /> En Stock ({metricas.enStock})
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
                Todas ({inventario.length})
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

              {(filtrosStock.length > 0 || filtrosCategoria.length > 0 || busqueda) && (
                <button
                  onClick={limpiarTodosLosFiltros}
                  className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 flex items-center gap-1 ml-auto"
                >
                  <X size={13} /> Limpiar filtros ({filtrosStock.length + filtrosCategoria.length})
                </button>
              )}
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
                    {inventarioProcesado.map(prod => (
                      <tr key={prod.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        
                        {/* Categoría */}
                        <td className="p-4">
                          <span className="inline-flex rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-3 py-1 text-[11px] font-bold border border-blue-100 dark:border-blue-900/50">
                            {normalizarCategoria(prod.categoria)}
                          </span>
                        </td>

                        {/* Nombre del Producto */}
                        <td className="p-4">
                          <span className="font-bold text-slate-900 dark:text-white block max-w-[180px] sm:max-w-[240px] md:max-w-none truncate">{prod.nombre}</span>
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

                        {/* Acciones */}
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button 
                              onClick={() => abrirEdicion(prod)} 
                              title="Editar producto"
                              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-500 hover:text-blue-600 rounded-xl transition-colors"
                            >
                              <Edit3 size={16}/>
                            </button>
                            <button 
                              onClick={() => eliminarProducto(prod.id)} 
                              title="Eliminar producto"
                              className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}

                    {inventarioProcesado.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-14 text-center text-slate-400">
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

          {/* VISTA 2: TARJETAS CON CÓDIGOS QR */}
          {vistaActual === 'qr' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {inventarioProcesado.map(prod => (
                <div key={prod.id} className="bg-white dark:bg-[#0f172a] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center relative group hover:shadow-md transition-shadow">
                  
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => abrirEdicion(prod)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><Edit3 size={14}/></button>
                    <button onClick={() => eliminarProducto(prod.id)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"><Trash2 size={14}/></button>
                  </div>

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

      {/* MODAL CONFIGURAR EXPORTACIÓN QR */}
      {modalExportarQR && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[950]">
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Sliders size={24}/> Configurar Etiquetas QR
            </h3>
            <p className="text-slate-500 text-sm mb-6">Selecciona qué datos deseas mostrar en cada etiqueta impresa:</p>
            
            <div className="space-y-4 mb-8">
              <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer border border-slate-100 dark:border-slate-800">
                <input type="checkbox" checked={opcionNombre} onChange={(e) => setOpcionNombre(e.target.checked)} className="w-5 h-5 accent-emerald-600 rounded" />
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Incluir Nombre del Producto</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer border border-slate-100 dark:border-slate-800">
                <input type="checkbox" checked={opcionSku} onChange={(e) => setOpcionSku(e.target.checked)} className="w-5 h-5 accent-emerald-600 rounded" />
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Incluir SKU</span>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer border border-slate-100 dark:border-slate-800">
                <input type="checkbox" checked={opcionPrecio} onChange={(e) => setOpcionPrecio(e.target.checked)} className="w-5 h-5 accent-emerald-600 rounded" />
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Incluir Precio de Venta</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalExportarQR(false)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl text-base transition-colors">Cancelar</button>
              <button onClick={generarPDFConQRs} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-base">Generar PDF <CheckCircle2 size={18}/></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR PRODUCTO */}
      {modalProducto && (
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
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-300">
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
    </div>
  );
}

function formatearMonedaInput(valor: string) {
  if (!valor) return "";
  const numeroStr = valor.replace(/\D/g, '');
  if (!numeroStr) return "";
  return parseInt(numeroStr, 10).toLocaleString('es-CO');
}