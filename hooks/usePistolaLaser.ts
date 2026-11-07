import { useEffect, useRef } from 'react';

interface UsePistolaLaserOptions {
  /** Si el detector global está activo */
  activo?: boolean;
  /** Callback cuando se detecta una lectura completa de pistola láser / QR 2D */
  onScan: (codigo: string) => void;
  /** Longitud mínima del código (por defecto 3 caracteres) */
  minLength?: number;
  /** Tiempo máximo en ms entre teclas para considerarse ráfaga de pistola láser (por defecto 65ms) */
  maxIntervalMs?: number;
}

/**
 * Hook global 24/7 para detectar disparos de pistolas lectoras de códigos de barras (1D) o QR (2D)
 * conectadas por USB o Bluetooth (modo HID teclado), sin necesidad de hacer clic previo en ningún botón.
 */
export function usePistolaLaser({
  activo = true,
  onScan,
  minLength = 3,
  maxIntervalMs = 65,
}: UsePistolaLaserOptions) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const firstKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!activo || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar combinaciones con Ctrl, Alt o Meta
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() || '';
      const esElementoEditable =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        Boolean(target?.isContentEditable);

      // Si el cursor está dentro de un input normal (ej. precio, cliente, notas) que NO está marcado
      // como receptor de escáner (`data-laser-allow="true"`), no interceptamos para no interferir con la escritura manual.
      const permiteLaserEnInput = target?.getAttribute('data-laser-allow') === 'true';
      if (esElementoEditable && !permiteLaserEnInput) {
        bufferRef.current = '';
        return;
      }

      const ahora = Date.now();

      if (e.key === 'Enter') {
        const codigo = bufferRef.current.trim();
        const duracionTotal = ahora - firstKeyTimeRef.current;
        const promedioPorTecla = codigo.length > 1 ? duracionTotal / (codigo.length - 1) : 0;

        bufferRef.current = '';
        lastKeyTimeRef.current = 0;

        // Si se acumuló un código válido a velocidad de pistola láser
        if (codigo.length >= minLength && promedioPorTecla <= maxIntervalMs) {
          e.preventDefault();
          e.stopPropagation();
          // Evita que un botón enfocado accidentalmente se active con el Enter de la pistola
          if (tagName === 'button' && typeof target?.blur === 'function') {
            target.blur();
          }
          onScanRef.current(codigo);
        }
        return;
      }

      // Ignorar teclas especiales que no imprimen caracteres (Shift, Tab, Escape, Flechas, etc.)
      if (e.key.length !== 1) return;

      const delta = ahora - lastKeyTimeRef.current;

      if (delta > maxIntervalMs) {
        // Si pasó demasiado tiempo desde la última tecla, reiniciamos el buffer con el carácter actual
        bufferRef.current = e.key;
        firstKeyTimeRef.current = ahora;
      } else {
        bufferRef.current += e.key;
      }

      lastKeyTimeRef.current = ahora;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activo, minLength, maxIntervalMs]);
}
