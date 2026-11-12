import { LIMITE_MOVIMIENTOS_MES_GRATIS } from '@/constants/planes';

export async function validarLimiteMovimientosGratis(adminDb: FirebaseFirestore.Firestore, cuentaPrincipalId: string): Promise<{ permitido: boolean; totalMes: number; limite: number }> {
  const adminDoc = await adminDb.collection('usuarios').doc(cuentaPrincipalId).get();
  const data = adminDoc.data() as any;
  const plan = data?.plan || 'gratis';
  const esPlanPago = plan === 'comercio' || plan === 'pro';

  if (esPlanPago) {
    return { permitido: true, totalMes: 0, limite: LIMITE_MOVIMIENTOS_MES_GRATIS };
  }

  // Inicio del mes en curso en zona horaria local/servidor
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);

  const snapshot = await adminDb.collection('movimientos')
    .where('usuarioId', '==', cuentaPrincipalId)
    .where('fecha', '>=', inicioMes)
    .count()
    .get();

  const totalMes = snapshot.data().count;

  return {
    permitido: totalMes < LIMITE_MOVIMIENTOS_MES_GRATIS,
    totalMes,
    limite: LIMITE_MOVIMIENTOS_MES_GRATIS
  };
}
