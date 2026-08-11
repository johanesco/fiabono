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
  const [guardando, setGuardando] = useState(false);

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

  const guardarProducto = async () => {
    if (!nombre.trim() || !precioVenta) {
      return toast.error("El nombre y el precio de venta son obligatorios.");
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

      if (editandoId) {
        await updateDoc(doc(db, "inventario", editandoId), {
          nombre: nombre.trim(),
          sku: skuLimpio,
          stock: stockNum,
          precioVenta: precioNum
        });
        toast.success("Producto actualizado con éxito");
      } else {
        await addDoc(collection(db, "inventario"), {
          usuarioId: cuentaPrincipalId,
          nombre: nombre.trim(),
          sku: skuLimpio,
          stock: stockNum,
          precioVenta: precioNum,
          fechaCreacion: new Date()
        });
        toast.success("Producto creado con éxito");
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
    setModalProducto(true);
  };

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre("");
    setSku("");
    setStock("");
    setPrecioVenta("");
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
    p.sku?.toLowerCase().includes(busqueda.toLowerCase())
  );

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
                      <th className="p-4">Producto</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Precio Venta</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium">
                    {inventarioFiltrado.map(prod => (
                      <tr key={prod.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{prod.nombre}</td>
                        <td className="p-4 font-mono text-slate-500">{prod.sku || 'N/A'}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${prod.stock <= 3 ? 'text-rose-500 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                            {prod.stock} un.
                          </span>
                        </td>
                        <td className="p-4 font-black text-emerald-600 dark:text-emerald-400">${(prod.precioVenta || 0).toLocaleString('es-CO')}</td>
                        <td className="p-4 text-right flex justify-end gap-1">
                          <button onClick={() => abrirEdicion(prod)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors"><Edit3 size={16}/></button>
                          <button onClick={() => eliminarProducto(prod.id)} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500 rounded-xl transition-colors"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {inventarioFiltrado.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">No se encontraron productos.</td>
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
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Package size={24}/> {editandoId ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nombre del Producto</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Camisa Polo" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">SKU o Código (Opcional)</label>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. CAM-001" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-base focus:border-emerald-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Stock Inicial</label>
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-lg focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Precio Venta</label>
                  <input type="text" inputMode="numeric" value={formatearMonedaInput(precioVenta)} onChange={(e) => setPrecioVenta(e.target.value.replace(/\D/g, ''))} placeholder="0" className="w-full p-4 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-black text-lg focus:border-emerald-500" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setModalProducto(false)} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl text-base transition-colors">Cancelar</button>
              <button onClick={guardarProducto} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center items-center gap-2 text-base">Guardar <CheckCircle2 size={18}/></button>
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