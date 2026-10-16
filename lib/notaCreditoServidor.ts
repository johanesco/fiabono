import { FieldValue } from 'firebase-admin/firestore';
import { emitirNotaCreditoDian } from '@/servicios/facturacionDian';

interface ParametrosNotaCreditoServidor {
  adminDb: FirebaseFirestore.Firestore;
  cuentaPrincipalId: string;
  usuario: any;
  movimientoDevolucionId: string;
  movimientoOrigenId: string;
  totalDevolver: number;
  articulosDevueltos: any[];
  origenClienteId?: string | null;
  origenClienteNombre?: string | null;
  origenFecha?: any;
  origenFacturaElectronica: any;
}

/**
 * Emite la Nota Credito ante la DIAN (via MATIAS) con auto-recuperacion de consecutivo
 * y persiste el resultado: exito -> notaCreditoElectronica; fallo -> errorNotaCredito
 * (permite reintentar luego desde el Historial).
 */
export async function emitirYGuardarNotaCredito(p: ParametrosNotaCreditoServidor): Promise<{ datos: any | null; error: string | null }> {
  const { adminDb, cuentaPrincipalId, usuario } = p;
  const movDevRef = adminDb.collection('movimientos').doc(p.movimientoDevolucionId);
  let error: string | null = null;

  try {
    const ambiente = (process.env.NODE_ENV === 'production' && process.env.MATIAS_API_TOKEN_PROD)
      ? 'produccion'
      : 'sandbox';

    const userRef = adminDb.collection('usuarios').doc(cuentaPrincipalId);
    const campoConsecutivoNC = ambiente === 'produccion'
      ? 'consecutivoNotaCreditoProd'
      : 'consecutivoNotaCreditoSandbox';

    let clienteObj: any = null;
    if (p.origenClienteId && p.origenClienteId !== 'mostrador' && p.origenClienteId !== 'consumidor_final') {
      const cliDoc = await adminDb.collection('clientes').doc(p.origenClienteId).get();
      if (cliDoc.exists && cliDoc.data()?.usuarioId === cuentaPrincipalId) {
        clienteObj = { id: cliDoc.id, ...cliDoc.data() };
      }
    }

    const prefijo = usuario.matiasPrefijoNotaCredito || (ambiente === 'produccion' ? 'NC' : 'NCFE');
    const resolucion = usuario.matiasResolucionNotaCredito || usuario.matiasResolucionCustom || '18760000001';
    const maxReintentos = 10;

    for (let intento = 0; intento < maxReintentos; intento++) {
      const consecutivoNC = await adminDb.runTransaction(async (t) => {
        const uDoc = await t.get(userRef);
        const uData = uDoc.data() || {};
        const actual = typeof uData[campoConsecutivoNC] === 'number' ? uData[campoConsecutivoNC] : 0;
        const siguiente = actual + 1;
        t.update(userRef, { [campoConsecutivoNC]: siguiente });
        return siguiente;
      });

      const resNC = await emitirNotaCreditoDian({
        movimientoDevolucion: {
          id: p.movimientoDevolucionId,
          monto: p.totalDevolver,
          clienteNombre: p.origenClienteNombre,
          articulosDevueltos: p.articulosDevueltos
        },
        movimientoFacturaOriginal: {
          fecha: p.origenFecha,
          clienteNombre: p.origenClienteNombre,
          facturaElectronica: p.origenFacturaElectronica
        },
        cliente: clienteObj,
        resolucion,
        prefijo,
        consecutivo: consecutivoNC,
        ambiente,
        tokenOverride: usuario.matiasTokenCustom || undefined
      } as any);

      if (resNC.success && resNC.datos) {
        await movDevRef.update({
          facturaElectronica: resNC.datos,
          notaCreditoElectronica: resNC.datos,
          errorNotaCredito: null
        });
        await adminDb.collection('movimientos').doc(p.movimientoOrigenId).update({
          notasCredito: FieldValue.arrayUnion(resNC.datos)
        });
        return { datos: resNC.datos, error: null };
      }

      const errorMsg = (resNC.error || '').toLowerCase();
      const esDuplicado =
        errorMsg.includes('ya se encuentra validado') ||
        errorMsg.includes('ya existe') ||
        errorMsg.includes('duplicado') ||
        errorMsg.includes('con numero');

      if (esDuplicado && intento < maxReintentos - 1) {
        console.warn(`[DIAN NC Auto-Recover] Consecutivo ${prefijo}${consecutivoNC} ya existe en MATIAS. Reintentando con el siguiente...`);
        continue;
      }

      error = resNC.error || 'No se pudo emitir la Nota Crédito ante la DIAN.';
      break;
    }
  } catch (ncErr: any) {
    console.error('Error emitiendo Nota Crédito DIAN:', ncErr);
    error = ncErr?.message || 'Fallo de conexión al emitir Nota Crédito.';
  }

  if (error) {
    try {
      await movDevRef.update({ errorNotaCredito: error });
    } catch (e) {
      console.error('No se pudo guardar errorNotaCredito:', e);
    }
  }
  return { datos: null, error };
}
