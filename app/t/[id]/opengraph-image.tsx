import { ImageResponse } from 'next/og';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Comprobante digital de Fiabono';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = {
  params: Promise<{ id: string }>;
};

const obtenerLogoYNegocio = async (id: string) => {
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
      return {
        nombreNegocio: datos?.nombreNegocio || 'Comprobante digital',
        logoNegocio: typeof datos?.logoUrl === 'string' && datos.logoUrl.trim()
          ? datos.logoUrl.trim()
          : typeof datos?.logoNegocio === 'string' && datos.logoNegocio.trim()
            ? datos.logoNegocio.trim()
            : typeof datos?.logo === 'string' && datos.logo.trim()
              ? datos.logo.trim()
              : null,
      };
    }
  } catch (error) {
    console.error('[OG] Error al generar imagen del comprobante:', error);
  }

  return { nombreNegocio: 'Comprobante digital', logoNegocio: null };
};

export default async function OpenGraphImage({ params }: Props) {
  const { id } = await params;
  const { nombreNegocio, logoNegocio } = await obtenerLogoYNegocio(id);
  const logoFallback = new URL('/logo-verde-linea-blanca-grande.png', 'https://fiabono.com').toString();
  const logo = logoNegocio || logoFallback;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f1f5f9',
          color: '#0f172a',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 1040,
            height: 470,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            border: '2px solid #dbe4ea',
            borderRadius: 28,
          }}
        >
          <img
            src={logo}
            alt=""
            width="180"
            height="120"
            style={{ objectFit: 'contain', marginBottom: 24 }}
          />
          <div style={{ display: 'flex', fontSize: 42, fontWeight: 800 }}>
            {nombreNegocio}
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 24, color: '#059669' }}>
            Comprobante digital verificado
          </div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 20, color: '#64748b' }}>
            Emitido mediante Fiabono.com
          </div>
        </div>
      </div>
    ),
    size,
  );
}
