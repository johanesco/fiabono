// lib/codigoBarras.ts
// Generador universal de Códigos de Barra 1D (Code 128) para inventario y marquillas
import JsBarcode from 'jsbarcode';

export interface OpcionesCodigoBarras {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
}

/**
 * Limpia y normaliza el texto para que sea compatible con Code 128
 */
export const sanitizarParaCode128 = (texto: string): string => {
  if (!texto) return "000000";
  // Code 128 soporta caracteres ASCII 32 a 126
  return texto
    .trim()
    .replace(/[^\x20-\x7E]/g, '') // Eliminar caracteres fuera de ASCII estándar (tildes, emojis)
    .toUpperCase() || "000000";
};

/**
 * Genera el código de barras en formato SVG (Vectorial puro, ideal para HTML e impresión térmica)
 */
export const generarSvgCodigoBarras = (
  valor: string,
  opciones: OpcionesCodigoBarras = {}
): string => {
  if (typeof document === 'undefined') return '';
  const valorLimpio = sanitizarParaCode128(valor);

  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svgNode, valorLimpio, {
      format: "CODE128",
      width: opciones.width ?? 1.6,
      height: opciones.height ?? 38,
      displayValue: opciones.displayValue ?? false,
      fontSize: opciones.fontSize ?? 10,
      margin: opciones.margin ?? 0,
      background: opciones.background ?? "transparent",
      lineColor: opciones.lineColor ?? "#000000"
    });
    return svgNode.outerHTML;
  } catch (error) {
    console.warn("Error generando SVG Code 128:", error);
    return '';
  }
};

/**
 * Genera el código de barras en formato Data URL PNG (Ideal para jsPDF e imágenes)
 */
export const generarDataUrlCodigoBarras = (
  valor: string,
  opciones: OpcionesCodigoBarras = {}
): string => {
  if (typeof document === 'undefined') return '';
  const valorLimpio = sanitizarParaCode128(valor);

  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, valorLimpio, {
      format: "CODE128",
      width: opciones.width ?? 2,
      height: opciones.height ?? 40,
      displayValue: opciones.displayValue ?? false,
      fontSize: opciones.fontSize ?? 12,
      margin: opciones.margin ?? 2,
      background: opciones.background ?? "#ffffff",
      lineColor: opciones.lineColor ?? "#000000"
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn("Error generando DataURL Code 128:", error);
    return '';
  }
};
