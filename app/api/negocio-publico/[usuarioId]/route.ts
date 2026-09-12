// app/api/negocio-publico/[usuarioId]/route.ts
// Route Handler del servidor que usa Firebase Admin SDK para leer datos
// del negocio sin exponer la coleccion /usuarios a clientes no autenticados.
// SOLO devuelve los campos necesarios para los comprobantes publicos.

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Evita que Vercel almacene en cache una respuesta antigua (por ejemplo,
// antes de que el negocio subiera su logo a Storage).
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
      return NextResponse.json({
        nombreNegocio: 'Comprobante de Venta',
        logoNegocio: '/logo-verde-linea-blanca-grande.png',
        mensajePieTicket: 'Gracias por su preferencia!',
      });
    }

    let u = docSnap.data()!;

    // Las transacciones de un colaborador pueden guardar su UID; el branding
    // siempre pertenece a la cuenta principal del negocio.
    if (u.rol === 'cajero' && u.adminId) {
      const adminSnap = await db.collection('usuarios').doc(u.adminId).get();
      if (adminSnap.exists) u = adminSnap.data()!;
    }

    // IMPORTANTE: Solo se exponen campos visuales del comprobante.
    // Correo, uid, plan, planVence, etc. NUNCA salen de este endpoint.
    //
    // Si el logo esta en Firebase Storage (logoUrl), lo servimos a traves de
    // /api/logo-negocio para evitar el bloqueo de CORS que hace el navegador
    // al usar <img crossOrigin="anonymous"> directo contra Storage.
    const logoNegocio = typeof u.logoUrl === 'string' && u.logoUrl.trim()
      ? `/api/logo-negocio/${usuarioId}`
      : typeof u.logoNegocio === 'string' && u.logoNegocio.trim()
        ? u.logoNegocio.trim()
        : typeof u.logo === 'string' && u.logo.trim()
          ? u.logo.trim()
          : '/logo-verde-linea-blanca-grande.png';

    return NextResponse.json({
      nombreNegocio: u.nombreNegocio || 'Mi Negocio',
      telefonoNegocio: u.telefonoNegocio || '',
      logoNegocio,
      nitNegocio: u.nitNegocio || '',
      direccionNegocio: u.direccionNegocio || '',
      mensajePieTicket: u.mensajePieTicket || 'Gracias por su compra!',
    });
  } catch (error) {
    console.error('[API] Error al obtener datos del negocio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}