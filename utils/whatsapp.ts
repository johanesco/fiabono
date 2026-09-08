/**
 * Utilidad unificada para envio de mensajes a WhatsApp en Fiabono
 * 
 * 1. Elimina todos los emojis y caracteres especiales no compatibles que se corrompen en Windows/Web.
 * 2. En celulares (iOS / Android), utiliza navegacion directa para evitar que el navegador deje una pestana en blanco al regresar de WhatsApp.
 * 3. En computadores (PC / Mac), abre WhatsApp Web en una nueva pestana.
 */

export function limpiarTextoWhatsApp(texto: string): string {
  if (!texto) return "";
  return texto
    // Remover emojis usando Extended_Pictographic y rangos Unicode
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{00A9}\u{00AE}\u{203C}\u{2049}\u{2122}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{231A}-\u{231B}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{24C2}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '')
    // Reemplazar vinetas especiales por guiones estandar ASCII
    .replace(/[•●▪▶►]/g, '-')
    // Limpiar caracteres de sustitucion o corruptos de codificaciones antiguas
    .replace(/\uFFFD/g, '')
    // Corregir espacios dobles que hayan quedado tras remover emojis
    .replace(/[ \t]{2,}/g, ' ')
    // Normalizar saltos de linea
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function abrirEnlaceWhatsApp(celular: string, texto: string) {
  if (typeof window === 'undefined') return;

  const textoLimpio = limpiarTextoWhatsApp(texto);
  const celRaw = (celular || '').toString().replace(/\D/g, '');
  let celLimpio = celRaw;
  if (celRaw.length === 10 && !celRaw.startsWith('57')) {
    celLimpio = `57${celRaw}`;
  }

  const url = celLimpio 
    ? `https://wa.me/${celLimpio}?text=${encodeURIComponent(textoLimpio)}` 
    : `https://wa.me/?text=${encodeURIComponent(textoLimpio)}`;

  const esMovil = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  if (esMovil) {
    // En moviles: navegacion directa. Evita dejar una pestana en blanco huerfana en Safari/Chrome al volver de WhatsApp
    window.location.href = url;
  } else {
    // En PC / Computador: abrir en pestana nueva para WhatsApp Web
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
