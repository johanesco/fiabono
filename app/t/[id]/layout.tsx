import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase-admin';

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

const TEXTO_PUBLICITARIO_GRATIS = 'Sistema fácil para ventas, fiados y plan separe. Pruébalo gratis en fiabono.com';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    const db = getAdminDb();
    const movimiento = await db.collection('movimientos').doc(id).get();
    const comprobante = movimiento.exists
      ? movimiento.data()
      : (await db.collection('separes').doc(id).get()).data();

    if (comprobante?.usuarioId) {
      const usuario = await db.collection('usuarios').doc(comprobante.usuarioId).get();
      let datos = usuario.data();
      if (datos?.rol === 'cajero' && datos.adminId) {
        const adminSnap = await db.collection('usuarios').doc(datos.adminId).get();
        if (adminSnap.exists) datos = adminSnap.data();
      }

      const planNormalizado = (datos?.plan || 'gratis').toLowerCase();
      const esPago = planNormalizado === 'pro' || planNormalizado === 'comercio' || datos?.esPro === true || datos?.esComercio === true;

      const nombreNegocio = datos?.nombreNegocio || datos?.nombreUsuario || 'Comprobante';
      const titulo = esPago ? nombreNegocio : `${nombreNegocio} | Fiabono.com`;
      const descripcion = esPago ? '' : TEXTO_PUBLICITARIO_GRATIS;

      return {
        title: titulo,
        description: descripcion,
        openGraph: {
          title: titulo,
          description: descripcion,
          siteName: nombreNegocio,
          type: 'website',
        },
        twitter: {
          title: titulo,
          description: descripcion,
        },
      };
    }
  } catch (error) {
    console.error('[TicketLayout] Error generando metadata:', error);
  }

  return {
    title: 'Comprobante | Fiabono.com',
    description: TEXTO_PUBLICITARIO_GRATIS,
    openGraph: {
      title: 'Comprobante | Fiabono.com',
      description: TEXTO_PUBLICITARIO_GRATIS,
      type: 'website',
    },
    twitter: {
      title: 'Comprobante | Fiabono.com',
      description: TEXTO_PUBLICITARIO_GRATIS,
    },
  };
}

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
