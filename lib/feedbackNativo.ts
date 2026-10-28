/**
 * feedbackNativo.ts
 * Utilidades para dar sensación táctil (haptic feedback) y auditiva nativa
 * en dispositivos móviles Android (PWA / Play Store TWA) y navegadores web.
 * Seguro y tolerante a fallos: si el dispositivo no soporta vibración o audio,
 * se ejecuta silenciosamente sin interrumpir ninguna operación.
 */

export const vibrarToque = (duracionMs = 10) => {
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(duracionMs);
    }
  } catch (_) {}
};

export const vibrarExito = () => {
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Pulso doble rítmico de confirmación exitosa
      navigator.vibrate([20, 50, 35]);
    }
  } catch (_) {}
};

export const vibrarAlerta = () => {
  try {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([40, 50, 40]);
    }
  } catch (_) {}
};

/**
 * Acorde alegre estilo caja registradora moderna (C5 -> E5 -> G5 -> C6)
 * Generado mediante Web Audio API sintetizado puro (sin archivos externos ni latencia).
 */
export const reproducirSonidoCaja = () => {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notas = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = ctx.currentTime + i * 0.07;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  } catch (_) {}
};

/**
 * Beep nítido y corto clásico de lector de código de barras láser (1760Hz)
 */
export const reproducirSonidoBeep = () => {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime);
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (_) {}
};

/**
 * Notificación integral de éxito en ventas, abonos, fiados o entregas
 * (Vibración de confirmación + acorde de caja registradora)
 */
export const notificarExitoPOS = () => {
  vibrarExito();
  reproducirSonidoCaja();
};

/**
 * Notificación al escanear código de barras exitosamente con la cámara
 * (Vibración sutil + beep de lectura)
 */
export const notificarScan = () => {
  vibrarToque(14);
  reproducirSonidoBeep();
};
