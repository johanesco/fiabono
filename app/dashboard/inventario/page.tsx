"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, doc, updateDoc, deleteDoc, where, addDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { Package, Plus, Search, Trash2, Edit3, ArrowLeft, FileText, CheckCircle2, LayoutList, QrCode, Sliders } from 'lucide-react';
import { useAuth } from "@/hooks/AuthContext";
import toast from "react-hot-toast";
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';

export default function InventarioPage() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;

  const [inventario, setInventario] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [vistaActual, setVistaActual] = useState<'lista' | 'qr'>('lista');
  const [modalProducto, setModalProducto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Estados para el modal de configuración de exportación QR
  const [modalExportarQR, setModalExportarQR] = useState(false);
  const [opcionNombre, setOpcionNombre] = useState(true);
  const [opcionSku, setOpcionSku] = useState(true);
  const [opcionPrecio, setOpcionPrecio] = useState(true);

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
      const q = query(collection(db, "inventario"), where("usuarioId", "==", uid));
      const snap = await getDocs(q);
      const lista: any[] = [];
      snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setInventario(lista);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar inventario.");
    }
  };

  const agregarProductoALaCarga = () => {
    const erroresNuevos = {
      nombre: '',
      categoria: '',
      stock: '',
      precio: ''
    };

    if (!nombre.trim()) erroresNuevos.nombre = 'El nombre del producto es obligatorio.';
    if (!categoria.trim()) erroresNuevos.categoria = 'Selecciona o agrega una categoría.';
    else if (!categoriasDisponibles.some(item => item.toLowerCase() === categoria.trim().toLowerCase())) {
      erroresNuevos.categoria = 'Agrega esta categoría antes de continuar.';
    }
    if (stock.trim() === '') erroresNuevos.stock = 'El stock es obligatorio.';
    if (!precioVenta) erroresNuevos.precio = 'El precio de venta es obligatorio.';

    setErrores(erroresNuevos);

    if (erroresNuevos.nombre || erroresNuevos.categoria || erroresNuevos.stock || erroresNuevos.precio) {
      return;
    }

    const productoTmp = {
      id: Date.now().toString(),
      nombre: nombre.trim(),
      sku: (sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase(),
      stock: Math.max(0, Number(stock) || 0),
      precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
      tipoProducto,
      categoria: categoria.trim() || 'General',
      inventariable,
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
    return {
      usuarioId: cuentaPrincipalId,
      nombre: nombre.trim(),
      sku: skuLimpio,
      stock: Math.max(0, Number(stock) || 0),
      precioVenta: Number(precioVenta.replace(/\D/g, '')) || 0,
      tipoProducto,
      categoria: (categoria.trim() || 'General'),
      inventariable,
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
      stock: Number(prod.stock) || 0,
      precioVenta: Number(prod.precioVenta) || 0,
      tipoProducto: prod.tipoProducto || 'producto',
      categoria: prod.categoria || 'General',
      inventariable: prod.inventariable !== false,
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

    if (!nombre.trim()) erroresNuevos.nombre = 'El nombre del producto es obligatorio.';
    if (!categoria.trim()) erroresNuevos.categoria = 'Selecciona o agrega una categoría.';
    else if (!categoriasDisponibles.some(item => item.toLowerCase() === categoria.trim().toLowerCase())) {
      erroresNuevos.categoria = 'Agrega esta categoría antes de guardar.';
    }
    if (stock.trim() === '') erroresNuevos.stock = 'El stock es obligatorio.';
    if (!precioVenta) erroresNuevos.precio = 'El precio de venta es obligatorio.';

    setErrores(erroresNuevos);

    if (erroresNuevos.nombre || erroresNuevos.categoria || erroresNuevos.stock || erroresNuevos.precio) {
      return;
    }
    
    const skuLimpio = sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const skuExistente = inventario.find(p => p.sku?.toLowerCase() === skuLimpio.toLowerCase() && p.id !== editandoId);
    if (skuExistente) {
      return toast.error(`El SKU "${skuLimpio}" ya le pertenece al producto "${skuExistente.nombre}". Usa uno diferente.`);
    }

    setGuardando(true);
    try {
      const stockNum = parseInt(stock) || 0;
      const precioNum = parseFloat(precioVenta.replace(/\D/g, '')) || 0;
      const categoriaLimpia = categoria.trim() || 'General';
      const datosBase = {
        nombre: nombre.trim(),
        sku: skuLimpio,
        stock: stockNum,
        precioVenta: precioNum,
        tipoProducto,
        categoria: categoriaLimpia,
        inventariable,
        fechaActualizacion: new Date()
      };

      if (editandoId) {
        await updateDoc(doc(db, "inventario", editandoId), datosBase);
        toast.success("Producto actualizado con éxito");
      } else {
        const productosTotal = [...productosEnCarga].map((prod) => ({
          usuarioId: cuentaPrincipalId,
          nombre: prod.nombre,
          sku: prod.sku,
          stock: Number(prod.stock) || 0,
          precioVenta: Number(prod.precioVenta) || 0,
          tipoProducto: prod.tipoProducto || 'producto',
          categoria: prod.categoria || 'General',
          inventariable: prod.inventariable !== false,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        }));

        productosTotal.push({
          usuarioId: cuentaPrincipalId,
          nombre: nombre.trim(),
          sku: skuLimpio,
          stock: stockNum,
          precioVenta: precioNum,
          tipoProducto,
          categoria: categoriaLimpia,
          inventariable,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        });

        await Promise.all(productosTotal.map((producto) => addDoc(collection(db, "inventario"), producto)));
        setProductosEnCarga([]);
        toast.success(`${productosTotal.length} producto(s) guardados en lote.`);
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
        toast.success("Producto eliminado");
        if (cuentaPrincipalId) cargarInventario(cuentaPrincipalId);
      } catch (error) {
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

  // GENERAR PDF CON DISEÑO SIMÉTRICO Y CENTRADO SEGÚN PREFERENCIAS
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

      for (const prod of inventario) {
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

          // Dibujar marco de etiqueta simétrico
          docPdf.setDrawColor(180, 180, 180);
          docPdf.rect(x, y, anchoEtiqueta, altoEtiqueta);

          let cursorY = y + 6;

          // Nombre centrado si está seleccionado
          if (opcionNombre) {
            docPdf.setFontSize(9);
            docPdf.setFont("helvetica", "bold");
            const nombreCorto = prod.nombre.length > 25 ? prod.nombre.substring(0, 23) + '...' : prod.nombre;
            docPdf.text(nombreCorto, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += 5;
          }

          // SKU centrado si está seleccionado
          if (opcionSku) {
            docPdf.setFontSize(8);
            docPdf.setFont("helvetica", "normal");
            docPdf.text(`SKU: ${prod.sku || 'N/A'}`, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += 4.5;
          }

          // Precio centrado si está seleccionado
          if (opcionPrecio) {
            docPdf.setFontSize(8);
            docPdf.setFont("helvetica", "bold");
            docPdf.text(`$${(prod.precioVenta || 0).toLocaleString('es-CO')}`, x + (anchoEtiqueta / 2), cursorY, { align: 'center' });
            cursorY += 2;
          }

          // Imagen QR centrada simétricamente en la parte inferior de la caja
          if (qrDataUrl) {
            const qrSize = 24;
            const qrX = x + (anchoEtiqueta - qrSize) / 2;
            docPdf.addImage(qrDataUrl, 'PNG', qrX, cursorY + 2, qrSize, qrSize);
          }

          // Cuadrícula de 3 columnas
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

  const inventarioFiltrado = inventario.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.sku?.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.categoria || 'General')?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const categoriasSugeridas = [
    'General', 'Varios', 'Servicios', 'Ropa hombre', 'Ropa dama', 'Ropa interior', 'Hogar', 'Joyería',
    'Calzado', 'Ropa infantil', 'Bolsos', 'Deporte', 'Juguetería', 'Tecnología', 'Gorras y accesorios',
    'Tienda del Peluquero', 'Bebe accesorios', 'Bienestar', 'Buzos', 'Cacharro', 'Colegial'
  ];

  const categoriasOrdenadas = [...new Set([...categoriasSugeridas, ...categoriasDisponibles])].sort((a, b) => a.localeCompare(b, 'es'));

  const normalizarCategoria = (valor: string | undefined) => {
    const texto = (valor || 'General').trim();
    if (!texto) return 'General';
    const sinPrefijo = texto.replace(/^\d+\s+/, '');
    return sinPrefijo || 'General';
  };

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

  const getEtiquetasProducto = (prod: any) => {
    const etiquetas = [
      { label: prod.tipoProducto === 'servicio' ? 'Servicio' : 'Producto', tone: 'indigo' },
      { label: prod.inventariable === false ? 'No inventariable' : 'Inventariable', tone: 'emerald' },
      { label: (Number(prod.stock) || 0) <= 3 ? 'Stock bajo' : 'Stock ok', tone: (Number(prod.stock) || 0) <= 3 ? 'rose' : 'slate' },
      { label: prod.updatedAt ? `Últ. mod: ${formatearFechaRelativa(prod.updatedAt)}` : 'Sin fecha', tone: 'amber' }
    ];

    return etiquetas.slice(0, 3).map((etiqueta) => ({
      ...etiqueta,
      label: etiqueta.label.length > 18 ? `${etiqueta.label.slice(0, 16)}...` : etiqueta.label
    }));
  };

  const formatearStock = (valor: any) => {
    const cantidad = Number(valor || 0);
    return cantidad === 1 ? '1 unidad' : `${cantidad} unidades`;
  };

  return (
    <div className="flex flex-col w-full h-full pb-24 md:pb-0 bg-slate-50 dark:bg-[#020617] md:rounded-[2.5rem] overflow-hidden md:border md:border-slate-100 dark:md:border-slate-800/60 shadow-none md:shadow-2xl animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="bg-emerald-600 dark:bg-emerald-700 p-4 md:p-6 text-white flex justify-between items-center shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={() => router.push('/dashboard/inicio')} className="bg-white/20 hover:bg-white/30 p-2.5 rounded-full transition-colors backdrop-blur-sm">
            <ArrowLeft size={22} />
          </button>
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-wide flex items-center gap-2">
            <Package size={26}/> Inventario General
          </h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setModalExportarQR(true)} 
            className="bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors backdrop-blur-sm"
          >
            <FileText size={18}/> <span className="hidden sm:inline">Exportar QRs</span>
          </button>
          <button 
            onClick={() => { limpiarFormulario(); setModalProducto(true); }} 
            className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition-transform active:scale-95"
          >
            <Plus size={18}/> Nuevo Producto
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* BARRA DE BÚSQUEDA Y PESTAÑAS DE VISTA */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
                placeholder="Buscar por nombre o SKU..." 
                className="w-full p-4 pl-12 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl font-bold outline-none focus:border-emerald-500 shadow-sm transition-colors text-base" 
              />
            </div>

            {/* Selector de Pestañas */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shrink-0">
              <button 
                onClick={() => setVistaActual('lista')} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${vistaActual === 'lista' ? 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <LayoutList size={18} /> Vista Lista
              </button>
              <button 
                onClick={() => setVistaActual('qr')} 
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${vistaActual === 'qr' ? 'bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <QrCode size={18} /> Vista QR
              </button>
            </div>
          </div>

          {/* QR OCULTOS PARA GENERAR EL PDF CORRECTAMENTE */}
          <div className="hidden">
            {inventario.map(prod => (
              <QRCodeSVG key={prod.id} id={`qr-svg-${prod.id}`} value={prod.sku || prod.id} size={128} />
            ))}
          </div>

          {/* VISTA 1: TABLA TRADICIONAL ORDENADA */}
          {vistaActual === 'lista' && (
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Categoría</th>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Código</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Precio</th>
                      <th className="p-4">Etiquetas</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                    {inventarioFiltrado.map(prod => (
                      <tr key={prod.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-top">
                        <td className="p-4">
                          <span className="inline-flex rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 px-2.5 py-1 text-[11px] font-bold leading-none">
                            {normalizarCategoria(prod.categoria)}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white max-w-[220px]">{prod.nombre}</td>
                        <td className="p-4 font-mono text-slate-500">{prod.sku || 'N/A'}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${Number(prod.stock || 0) <= 3 ? 'text-rose-500 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                            {formatearStock(prod.stock)}
                          </span>
                        </td>
                        <td className="p-4 font-black text-emerald-600 dark:text-emerald-400">${(prod.precioVenta || 0).toLocaleString('es-CO')}</td>
                        <td className="p-4 min-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {getEtiquetasProducto(prod).map((etiqueta, index) => {
                              const tones: Record<string, string> = {
                                indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
                                emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
                                rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
                                slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
                                amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                              };

                              return (
                                <span
                                  key={`${prod.id}-${index}`}
                                  className={`inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] ${tones[etiqueta.tone] || tones.slate}`}
                                >
                                  {etiqueta.label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-1">
                          <button onClick={() => abrirEdicion(prod)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors"><Edit3 size={16}/></button>
                          <button onClick={() => eliminarProducto(prod.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 rounded-xl transition-colors"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {inventarioFiltrado.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">No se encontraron productos.</td>
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
              {inventarioFiltrado.map(prod => (
                <div key={prod.id} className="bg-white dark:bg-[#0f172a] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center relative group">
                  
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => abrirEdicion(prod)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"><Edit3 size={14}/></button>
                    <button onClick={() => eliminarProducto(prod.id)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"><Trash2 size={14}/></button>
                  </div>

                  <div className="w-28 h-28 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-center mb-3">
                    <QRCodeSVG value={prod.sku || prod.id} size={96} />
                  </div>

                  <h4 className="font-black text-slate-900 dark:text-white text-base truncate w-full">{prod.nombre}</h4>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 mt-1">SKU: {prod.sku || 'N/A'}</span>
                  
                  <div className="flex justify-between items-center w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prod.stock <= 3 ? 'text-rose-500 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                      Stock: {prod.stock}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">${(prod.precioVenta || 0).toLocaleString('es-CO')}</span>
                  </div>
                </div>
              ))}
              {inventarioFiltrado.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-400 font-bold">No se encontraron productos con QR.</div>
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
          <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] w-full max-w-6xl shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 overflow-hidden">
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
                      <input type="text" value={nombre} onChange={(e) => { setNombre(e.target.value); setErrores(prev => ({ ...prev, nombre: '' })); }} placeholder="Ej. Camisa Polo" className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500" />
                      {errores.nombre && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.nombre}</p>}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">SKU / Código</label>
                      <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. CAM-001" className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500" />
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
                                  <span>Costo: ${Number(prod.precioVenta || 0).toLocaleString('es-CO')}</span>
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
                        <select value={tipoProducto} onChange={(e) => setTipoProducto(e.target.value as 'producto' | 'servicio')} className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500">
                          <option value="producto">Producto</option>
                          <option value="servicio">Servicio</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">¿Inventariable?</label>
                        <select value={inventariable ? 'si' : 'no'} onChange={(e) => setInventariable(e.target.value === 'si')} className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500">
                          <option value="si">Sí</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Stock</label>
                        <input type="number" min="0" value={stock} onChange={(e) => { const valor = Number(e.target.value); setStock(String(Math.max(0, valor))); setErrores(prev => ({ ...prev, stock: '' })); }} placeholder="0" className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-lg focus:border-emerald-500" />
                        {errores.stock && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.stock}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Venta</label>
                        <input type="text" inputMode="numeric" value={formatearMonedaInput(precioVenta)} onChange={(e) => { setPrecioVenta(e.target.value.replace(/\D/g, '')); setErrores(prev => ({ ...prev, precio: '' })); }} placeholder="0" className="w-full p-4 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-lg focus:border-emerald-500" />
                        {errores.precio && <p className="mt-1 text-[11px] text-rose-500 font-medium">{errores.precio}</p>}
                      </div>
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

function formatearFechaRelativa(valor: any) {
  if (!valor) return 'Reciente';

  try {
    const fecha = valor?.toDate ? valor.toDate() : new Date(valor);
    const diffMs = Date.now() - fecha.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias <= 0) return 'Hoy';
    if (diffDias === 1) return 'Hace 1 día';
    if (diffDias < 30) return `Hace ${diffDias} días`;
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_error) {
    return 'Reciente';
  }
}