/**
 * Formatea un ID de transacción (Firestore auto-ID o ID local) en un código
 * numérico corto, limpio y determinista de 6 dígitos para mostrar en tickets
 * y comprobantes impresos (ej. "482915").
 *
 * Si ya se pasa un número de factura o consecutivo corto (<= 12 caracteres sin
 * prefijo LOCAL-), se conserva tal cual.
 */
export function formatearCodigoComprobante(id?: string | number | null): string {
  if (id === undefined || id === null) return "";
  const raw = String(id).trim();
  if (!raw) return "";

  // Consecutivos cortos o numeración DIAN explícita (ej. "FEV-123", "00342")
  if (!raw.startsWith("LOCAL-") && raw.length <= 10 && /^[A-Z0-9-]+$/i.test(raw)) {
    return raw.toUpperCase();
  }

  // Hash FNV-1a 32-bit determinista -> siempre 6 dígitos limpios (100000 - 999999)
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const numero = 100000 + ((hash >>> 0) % 900000);
  return String(numero);
}
