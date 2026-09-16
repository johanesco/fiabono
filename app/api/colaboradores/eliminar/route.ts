// app/api/colaboradores/eliminar/route.ts
// Endpoint seguro para eliminar un colaborador tanto de Firebase Auth como de Firestore

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      return NextResponse.json({ error: 'Token de autenticación faltante.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada. Por favor recarga e intenta de nuevo.' }, { status: 401 });
    }

    const body = await request.json();
    const { colaboradorId } = body;

    if (!colaboradorId || typeof colaboradorId !== 'string') {
      return NextResponse.json({ error: 'ID de colaborador requerido.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const colabRef = adminDb.collection('usuarios').doc(colaboradorId);
    const colabSnap = await colabRef.get();

    if (!colabSnap.exists) {
      return NextResponse.json({ error: 'El colaborador no existe en el sistema.' }, { status: 404 });
    }

    const colabData = colabSnap.data()!;

    // Verificación de seguridad estricta: el solicitante debe ser el dueño de la cuenta principal o el superadmin
    const esMaster = decodedToken.email === 'johanescobar1@gmail.com';
    if (colabData.adminId !== decodedToken.uid && !esMaster) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este colaborador.' }, { status: 403 });
    }

    // 1. Eliminar de Firebase Authentication (libera el correo/usuario)
    try {
      await adminAuth.deleteUser(colaboradorId);
    } catch (authErr: any) {
      console.warn(`Aviso: el usuario ${colaboradorId} no estaba en Auth o ya fue eliminado:`, authErr?.message);
    }

    // 2. Eliminar de Firestore
    await colabRef.delete();

    return NextResponse.json({
      exito: true,
      mensaje: `El colaborador ${colabData.nombreUsuario || ''} fue eliminado definitivamente del sistema.`
    });
  } catch (error: any) {
    console.error('Error al eliminar colaborador:', error);
    return NextResponse.json({
      error: error?.message || 'Error interno al eliminar el colaborador.'
    }, { status: 500 });
  }
}
