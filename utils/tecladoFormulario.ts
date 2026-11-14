import type React from 'react';

/**
 * Permite navegar al siguiente campo de un formulario al presionar Enter.
 * Se aplica en el contenedor (<form> o <div data-enter-form>) para evitar
 * repetir handlers en cada input. Respeta <textarea> y botones.
 */
export function manejarEnterSiguienteCampo(
  e: React.KeyboardEvent<HTMLElement>,
  onUltimoCampo?: () => void
) {
  if (e.defaultPrevented || e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const tag = target.tagName;
  if (tag !== 'INPUT' && tag !== 'SELECT') return;
  if (target.dataset.noEnterNext === 'true') return;

  const inputType = (target as HTMLInputElement).type;
  if (inputType === 'submit' || inputType === 'button' || inputType === 'checkbox' || inputType === 'radio' || inputType === 'file') {
    return;
  }

  const contenedor = target.closest('form, [data-enter-form]') as HTMLElement | null;
  if (!contenedor) return;

  const campos = Array.from(
    contenedor.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([disabled]):not([readonly]), select:not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null && el.dataset.noEnterNext !== 'true');

  const idx = campos.indexOf(target);
  if (idx === -1) return;

  if (idx + 1 < campos.length) {
    e.preventDefault();
    const siguiente = campos[idx + 1];
    siguiente.focus();
    if (siguiente instanceof HTMLInputElement && typeof siguiente.select === 'function') {
      try {
        siguiente.select();
      } catch {
        // Algunos tipos de input (como date o number en ciertos navegadores) no soportan select()
      }
    }
  } else if (onUltimoCampo) {
    e.preventDefault();
    onUltimoCampo();
  }
}
