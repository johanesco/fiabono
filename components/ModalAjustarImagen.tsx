"use client";
import React, { useState, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move, Sparkles } from "lucide-react";

interface ModalAjustarImagenProps {
  isOpen: boolean;
  imagenSrc: string | null;
  onClose: () => void;
  onAplicar: (imagenBase64: string) => void;
}

export default function ModalAjustarImagen({
  isOpen,
  imagenSrc,
  onClose,
  onAplicar,
}: ModalAjustarImagenProps) {
  const [zoom, setZoom] = useState(1);
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [arrastrando, setArrastrando] = useState(false);
  const inicioArrastreRef = useRef({ x: 0, y: 0 });
  const posicionRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [cargando, setCargando] = useState(true);

  // Dimensiones del visor en pantalla
  const VIEWPORT_SIZE = 260;
  // Dimensiones del canvas de exportación final
  const EXPORT_SIZE = 300;

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosicion({ x: 0, y: 0 });
      posicionRef.current = { x: 0, y: 0 };
      setCargando(false);
    }
  }, [isOpen, imagenSrc]);

  if (!isOpen || !imagenSrc) return null;

  // Manejo de Arrastre (Mouse y Touch)
  const iniciarArrastre = (clientX: number, clientY: number) => {
    setArrastrando(true);
    inicioArrastreRef.current = {
      x: clientX - posicionRef.current.x,
      y: clientY - posicionRef.current.y,
    };
  };

  const moverArrastre = (clientX: number, clientY: number) => {
    if (!arrastrando) return;
    const nuevaX = clientX - inicioArrastreRef.current.x;
    const nuevaY = clientY - inicioArrastreRef.current.y;
    setPosicion({ x: nuevaX, y: nuevaY });
    posicionRef.current = { x: nuevaX, y: nuevaY };
  };

  const finalizarArrastre = () => {
    setArrastrando(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    iniciarArrastre(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    moverArrastre(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      iniciarArrastre(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      moverArrastre(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(Math.max(Number((prev + factor).toFixed(2)), 1), 3));
  };

  const restablecerAjustes = () => {
    setZoom(1);
    setPosicion({ x: 0, y: 0 });
    posicionRef.current = { x: 0, y: 0 };
  };

  // Recortar y generar la imagen final optimizada
  const procesarRecorte = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fondo blanco limpio
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    const natW = img.naturalWidth || img.width || 300;
    const natH = img.naturalHeight || img.height || 300;

    // Escala para ajustarse a los 260px del visor
    const scaleToFit = Math.min(VIEWPORT_SIZE / natW, VIEWPORT_SIZE / natH);
    const displayedW = natW * scaleToFit * zoom;
    const displayedH = natH * scaleToFit * zoom;

    const escalaExportacion = EXPORT_SIZE / VIEWPORT_SIZE;
    const centroX = VIEWPORT_SIZE / 2 + posicion.x;
    const centroY = VIEWPORT_SIZE / 2 + posicion.y;

    const drawX = (centroX - displayedW / 2) * escalaExportacion;
    const drawY = (centroY - displayedH / 2) * escalaExportacion;
    const drawW = displayedW * escalaExportacion;
    const drawH = displayedH * escalaExportacion;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const base64Final = canvas.toDataURL("image/jpeg", 0.88);
    onAplicar(base64Final);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Cabecera */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-tight">
                Ajustar Logo del Negocio
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Encuadra y haz zoom a tu imagen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Área de Encuadre Interactivo */}
        <div className="p-6 flex flex-col items-center select-none">
          
          <div
            className="relative rounded-3xl overflow-hidden border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-inner flex items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={finalizarArrastre}
            onMouseLeave={finalizarArrastre}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={finalizarArrastre}
            onWheel={handleWheel}
          >
            {/* Imagen que se transforma con zoom y desplazamiento */}
            <img
              ref={imgRef}
              src={imagenSrc}
              alt="Ajustar Logo"
              className="pointer-events-none select-none block transition-transform duration-75"
              style={{
                transform: `translate(${posicion.x}px, ${posicion.y}px) scale(${zoom})`,
                transformOrigin: "center center",
                maxWidth: `${VIEWPORT_SIZE}px`,
                maxHeight: `${VIEWPORT_SIZE}px`,
                objectFit: "contain",
              }}
              draggable={false}
            />

            {/* Máscara de Guía de Encuadre */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[88%] h-[88%] rounded-2xl border-2 border-dashed border-blue-500 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"></div>
            </div>

            {/* Indicador de ayuda */}
            <div className="absolute bottom-2 left-2 right-2 pointer-events-none flex items-center justify-center">
              <span className="bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <Move size={11} /> Arrastra para mover
              </span>
            </div>
          </div>

          {/* Control de Zoom y Botones */}
          <div className="w-full mt-5 space-y-3">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(Number((prev - 0.2).toFixed(2)), 1))}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Alejar"
              >
                <ZoomOut size={18} />
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-blue-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />

              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(Number((prev + 0.2).toFixed(2)), 3))}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Acercar"
              >
                <ZoomIn size={18} />
              </button>

              <span className="text-xs font-black text-blue-600 dark:text-blue-400 w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="flex justify-between items-center px-1">
              <button
                type="button"
                onClick={restablecerAjustes}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={13} /> Centrar y restablecer
              </button>
              <span className="text-[11px] text-slate-400">Rueda del mouse / Pellizco</span>
            </div>
          </div>

        </div>

        {/* Acciones */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={procesarRecorte}
            className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-transform transform active:scale-95 text-sm"
          >
            <Check size={18} /> Usar este Logo
          </button>
        </div>

      </div>
    </div>
  );
}
