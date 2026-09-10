// app/api/negocio-publico/[usuarioId]/route.ts
// Route Handler del servidor que usa Firebase Admin SDK para leer datos
// del negocio sin exponer la coleccion /usuarios a clientes no autenticados.
// SOLO devuelve los campos necesarios para los comprobantes publicos.

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';


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