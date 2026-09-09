import React from 'react';
import Image from 'next/image';

interface LogoFiabonoProps {
  /** Tamaño del isotipo en píxeles (ancho y alto) */
  size?: number;
  /** Mostrar u ocultar el texto 'Fiabono' */
  showText?: boolean;
  /** Mostrar badge 'POS' al lado del texto */
  showBadge?: boolean;
  /** Variante de fondo: 'dark' (por defecto en squircle oscuro con línea neón) o 'light' (fondo blanco con línea esmeralda) */
  variant?: 'default' | 'dark' | 'light';
  /** Clase CSS adicional para el contenedor */
  className?: string;
}

/**
 * Isotipo Oficial de Fiabono EXACTO a la imagen aprobada.
 * Utiliza la imagen oficial de alta resolución con las líneas verdes exactas.
 */
export const IsotipoFiabono: React.FC<{ size?: number; className?: string; isLight?: boolean }> = ({
  size = 32,
  className = "",
  isLight = false,
}) => {
  const imgSrc = isLight ? "/logo-blanco-linea-verde-grande.png" : "/logo-verde-linea-blanca-grande.png";

  return (
    <div 
      className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm shrink-0 ${isLight ? 'border border-slate-200 dark:border-slate-800' : 'border border-emerald-500/30'} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image 
        src={imgSrc} 
        alt="Fiabono Logo" 
        width={size} 
        height={size} 
        className="w-full h-full object-cover select-none"
        priority
      />
    </div>
  );
};

export default function LogoFiabono({
  size = 32,
  showText = true,
  showBadge = true,
  variant = 'default',
  className = "",
}: LogoFiabonoProps) {
  const isLight = variant === 'light';
  const textClass =
    variant === 'dark'
      ? 'text-white'
      : variant === 'light'
      ? 'text-slate-900'
      : 'text-slate-900 dark:text-white';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Isotipo Oficial idéntico a la imagen aprobada */}
      <IsotipoFiabono size={size} isLight={isLight} />

      {/* Texto de Marca Oficial */}
      {showText && (
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black tracking-tight text-lg sm:text-xl ${textClass}`}>
            Fiabono
          </span>
          <span className="text-emerald-500 font-bold text-lg sm:text-xl -ml-1">.com</span>
          
          {showBadge && (
            <span className="ml-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              POS
            </span>
          )}
        </div>
      )}
    </div>
  );
}
