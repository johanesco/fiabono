// Detección centralizada de "Modo App": PWA instalada, TWA de Google Play o iOS standalone.
// Se persiste en sessionStorage porque tras navegar (ej. cerrar sesión -> "/") se pierden
// el ?source=pwa del start_url y el document.referrer android-app://.
const CLAVE = 'fiabono_modo_app';

export function detectarModoApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const detectado =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.startsWith('android-app://') ||
      /[?&]source=(pwa|twa)/.test(window.location.search);

    if (detectado) {
      sessionStorage.setItem(CLAVE, '1');
      return true;
    }
    return sessionStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}
