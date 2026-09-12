// app/api/logo-negocio/[usuarioId]/route.ts
// Proxy del logo del negocio: descarga la imagen desde Firebase Storage en el
// servidor y la reenvia al navegador con encabezados CORS correctos.
//
// Por que existe esto: la factura publica (/t/[id]) usa <img crossOrigin="anonymous">
// para poder "capturar" el ticket como imagen (boton de descargar/compartir).
// Firebase Storage NO envia el encabezado Access-Control-Allow-Origin por
// defecto, asi que el navegador bloquea la imagen y se ve como icono roto,
// aunque la URL sea publica y accesible directamente. Sirviendola desde
// nuestro propio dominio evita ese bloqueo sin tener que configurar CORS
// en el bucket de Storage (lo cual requiere gcloud/gsutil).

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ usuarioId: string }> }
) {
  const { usuarioId } = await params;

  if (!usuarioId || typeof usuarioId !== 'string') {
    return NextResponse.json({ error: 'usuarioId invalido' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const docSnap = await db.collection('usuarios').doc(usuarioId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    let u = docSnap.data()!;
    if (u.rol === 'cajero' && u.adminId) {
      const adminSnap = await db.collection('usuarios').doc(u.adminId).get();
      if (adminSnap.exists) u = adminSnap.data()!;
    }

    const logoUrl = typeof u.logoUrl === 'string' && u.logoUrl.trim()
      ? u.logoUrl.trim()
      : '';

    if (!logoUrl) {
      return NextResponse.json({ error: 'Sin logo en Storage' }, { status: 404 });
    }

    const upstream = await fetch(logoUrl, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'No se pudo descargar el logo' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[API] Error al servir logo del negocio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
