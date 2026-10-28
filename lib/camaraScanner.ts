// lib/camaraScanner.ts
// Utilidades de alto rendimiento para escaneo de códigos de barra (1D) y QR (2D)
// con aceleración por hardware, enfoque continuo, linterna y zoom.

import { Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { notificarScan } from './feedbackNativo';

export const FORMATOS_CODIGO_SOPORTADOS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF
];

/**
 * Configuración de video optimizada para retail:
 * - Aceleración nativa de Google BarcodeDetector
 * - Enfoque continuo por hardware (evita fotos borrosas de cerca)
 * - Proporción rectangular amplia para atrapar códigos de barras largos (EAN/Code128)
 */
export const obtenerConfiguracionCamaraScanner = (fps = 20) => {
  return {
    fps,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      // Caja amplia y rectangular que permite leer tanto códigos de barras 1D horizontales como QR cuadrados
      const width = Math.floor(viewfinderWidth * 0.90);
      const height = Math.floor(Math.min(viewfinderHeight * 0.70, width * 0.55));
      return { 
        width: Math.max(width, 240), 
        height: Math.max(height, 130) 
      };
    },
    aspectRatio: 1.0,
    videoConstraints: {
      facingMode: "environment",
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
      advanced: [{ focusMode: "continuous" } as any]
    }
  };
};

/**
 * Obtiene el MediaStreamTrack de la cámara activa dentro del contenedor de escaneo
 */
export const obtenerTrackCamara = (scannerId: string): MediaStreamTrack | null => {
  if (typeof document === 'undefined') return null;
  const container = document.getElementById(scannerId);
  const video = container?.querySelector('video') as HTMLVideoElement | null;
  if (video && video.srcObject instanceof MediaStream) {
    const videoTracks = video.srcObject.getVideoTracks();
    if (videoTracks.length > 0) return videoTracks[0];
  }
  return null;
};

/**
 * Verifica si la cámara actual soporta encender la linterna / flash (Torch)
 */
export const soportaLinternaCamara = (scannerId: string): boolean => {
  const track = obtenerTrackCamara(scannerId);
  if (!track) return false;
  const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
  return Boolean(capabilities?.torch);
};

/**
 * Enciende o apaga la linterna (Torch) de la cámara trasera
 */
export const toggleLinternaCamara = async (scannerId: string, encender: boolean): Promise<boolean> => {
  const track = obtenerTrackCamara(scannerId);
  if (!track) return false;
  const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
  if (!capabilities?.torch) return false;

  try {
    await track.applyConstraints({
      advanced: [{ torch: encender } as any]
    });
    return true;
  } catch (err) {
    console.warn("No se pudo alternar la linterna:", err);
    return false;
  }
};

/**
 * Verifica si la cámara actual soporta zoom digital por hardware
 */
export const soportaZoomCamara = (scannerId: string): boolean => {
  const track = obtenerTrackCamara(scannerId);
  if (!track) return false;
  const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
  return Boolean(capabilities?.zoom && capabilities.zoom.max > 1);
};

/**
 * Ajusta el nivel de zoom de la cámara (ej. 1x, 1.8x, 2x)
 */
export const cambiarZoomCamara = async (scannerId: string, zoomDeseado: number): Promise<boolean> => {
  const track = obtenerTrackCamara(scannerId);
  if (!track) return false;
  const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
  if (!capabilities?.zoom) return false;

  try {
    const zoomMin = capabilities.zoom.min || 1;
    const zoomMax = capabilities.zoom.max || 4;
    const zoomFinal = Math.min(Math.max(zoomDeseado, zoomMin), zoomMax);

    await track.applyConstraints({
      advanced: [{ zoom: zoomFinal } as any]
    });
    return true;
  } catch (err) {
    console.warn("No se pudo aplicar zoom a la cámara:", err);
    return false;
  }
};

export { notificarScan };
