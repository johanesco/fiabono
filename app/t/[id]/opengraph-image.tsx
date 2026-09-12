import { ImageResponse } from 'next/og';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Comprobante digital de Fiabono';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = {
  params: Promise<{ id: string }>;
};

// El renderizador de next/og (Satori) no carga de forma confiable imagenes
// remotas puestas como URL en <img src>. La forma soportada es descargar la
// imagen nosotros mismos y pasarla como data URI (base64). Por eso esta
// funcion siempre devuelve bytes ya listos para <img src>, nunca una URL.
const obtenerLogoComoDataUri = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('[OG] Error al descargar el logo del negocio:', error);
    return null;
  }
};

const obtenerLogoFallbackComoDataUri = async (): Promise<string> => {
  const buffer = await readFile(
    join(process.cwd(), 'public', 'logo-verde-linea-blanca-grande.png')
  );
  return `data:image/png;base64,${buffer.toString('base64')}`;
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

      const logoUrl = typeof datos?.logoUrl === 'string' && datos.logoUrl.trim()
        ? datos.logoUrl.trim()
        : typeof datos?.logoNegocio === 'string' && datos.logoNegocio.trim()
          ? datos.logoNegocio.trim()
          : typeof datos?.logo === 'string' && datos.logo.trim()
            ? datos.logo.trim()
            : null;

      return {
        nombreNegocio: datos?.nombreNegocio || 'Comprobante digital',
        logoUrl,
      };
    }
  } catch (error) {
    console.error('[OG] Error al generar imagen del comprobante:', error);
  }

  return { nombreNegocio: 'Comprobante digital', logoUrl: null };
};

export default async function OpenGraphImage({ params }: Props) {
  const { id } = await params;
  const { logoUrl } = await obtenerLogoYNegocio(id);

  // logoUrl puede ya venir en Base64 (campo antiguo "logoNegocio"), en cuyo
  // caso se usa directo; si es una URL de Storage, se descarga aqui.
  let logo: string | null = null;
  if (logoUrl) {
    logo = logoUrl.startsWith('data:') ? logoUrl : await obtenerLogoComoDataUri(logoUrl);
  }
  if (!logo) {
    logo = await obtenerLogoFallbackComoDataUri();
  }

  // Solo se muestra el logo del negocio, centrado y lo mas grande posible
  // dentro del lienzo (sin nombre ni textos adicionales), para que WhatsApp
  // aproveche la mayor cantidad de pixeles reales del logo al recortar su
  // miniatura y se vea lo menos pixelado posible.
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <img
          src={logo}
          alt=""
          width={size.height}
          height={size.height}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    size,
  );
}
