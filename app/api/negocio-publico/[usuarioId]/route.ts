// app/api/negocio-publico/[usuarioId]/route.ts
// Route Handler del servidor que usa Firebase Admin SDK para leer datos
// del negocio sin exponer la coleccion /usuarios a clientes no autenticados.
// SOLO devuelve los campos necesarios para los comprobantes publicos.

import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializacion singleton del Admin SDK (segura en hot-reload de Next.js)
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Las llaves privadas en variables de entorno tienen los \n como literal \\n
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

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
        mensajePieTicket: 'Gracias por su preferencia!',
      });
    }

    const u = docSnap.data()!;

    // IMPORTANTE: Solo se exponen campos visuales del comprobante.
    // Correo, uid, plan, planVence, etc. NUNCA salen de este endpoint.
    return NextResponse.json({
      nombreNegocio: u.nombreNegocio || 'Mi Negocio',
      telefonoNegocio: u.telefonoNegocio || '',
      logoNegocio: u.logoNegocio || null,
      nitNegocio: u.nitNegocio || '',
      direccionNegocio: u.direccionNegocio || '',
      mensajePieTicket: u.mensajePieTicket || 'Gracias por su compra!',
    });
  } catch (error) {
    console.error('[API] Error al obtener datos del negocio:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}