// app/api/colaboradores/reset-password/route.ts
// Endpoint seguro para que el administrador restablezca la contraseña de uno de sus colaboradores

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
    const { colaboradorId, nuevaPassword } = body;

    if (!colaboradorId || typeof colaboradorId !== 'string') {
      return NextResponse.json({ error: 'ID de colaborador requerido.' }, { status: 400 });
    }

    if (!nuevaPassword || typeof nuevaPassword !== 'string' || nuevaPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const colabDoc = await adminDb.collection('usuarios').doc(colaboradorId).get();

    if (!colabDoc.exists) {
      return NextResponse.json({ error: 'El colaborador no existe en el sistema.' }, { status: 404 });
    }

    const colabData = colabDoc.data()!;

    // Verificación estricta de seguridad: el solicitante debe ser el dueño del comercio (adminId) o el SuperAdmin
    const esMaster = decodedToken.email === 'johanescobar1@gmail.com';
    if (colabData.adminId !== decodedToken.uid && !esMaster) {
      return NextResponse.json({ error: 'No tienes permisos para modificar este colaborador.' }, { status: 403 });
    }

    // Actualizar la contraseña en Firebase Authentication
    await adminAuth.updateUser(colaboradorId, {
      password: nuevaPassword
    });

    return NextResponse.json({ 
      exito: true, 
      mensaje: 'Contraseña actualizada exitosamente para el colaborador.' 
    });
  } catch (error: any) {
    console.error('Error al restablecer contraseña del colaborador:', error);
    return NextResponse.json({ 
      error: error?.message || 'Error interno al actualizar la contraseña.' 
    }, { status: 500 });
  }
}
