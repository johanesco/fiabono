// app/api/master/eliminar-negocio/route.ts
// Endpoint administrativo seguro para purga y eliminación en cascada de un negocio por el SuperAdmin Master

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';

// Helper para eliminar documentos asociados en lotes seguros (máximo 400 por batch)
async function eliminarLotesPorUsuarioId(db: Firestore, nombreColeccion: string, usuarioId: string): Promise<number> {
  try {
    const snap = await db.collection(nombreColeccion).where('usuarioId', '==', usuarioId).get();
    if (snap.empty) return 0;

    const docs = snap.docs;
    const BATCH_SIZE = 400;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);
      chunk.forEach(docSnap => batch.delete(docSnap.ref));
      await batch.commit();
    }
    return docs.length;
  } catch (error) {
    console.error(`Error eliminando coleccion ${nombreColeccion} para usuario ${usuarioId}:`, error);
    return 0;
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesion.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesion invalida o expirada.' }, { status: 401 });
    }

    // Verificación de seguridad estricta: solo el SuperAdmin Master (Johan)
    if (decodedToken.email !== 'johanescobar1@gmail.com') {
      return NextResponse.json({ error: 'Acceso denegado. Solo el SuperAdmin Master puede ejecutar purgas.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { usuarioId } = body;

    if (!usuarioId || typeof usuarioId !== 'string') {
      return NextResponse.json({ error: 'Se requiere el ID del usuario/negocio a eliminar.' }, { status: 400 });
    }

    // Regla de oro: No auto-eliminarse
    if (usuarioId === decodedToken.uid) {
      return NextResponse.json({ error: 'Accion bloqueada: No puedes eliminar tu propia cuenta de SuperAdmin.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const targetUserRef = adminDb.collection('usuarios').doc(usuarioId);
    const targetUserSnap = await targetUserRef.get();

    if (!targetUserSnap.exists) {
      return NextResponse.json({ error: 'El usuario/negocio especificado no existe en la base de datos.' }, { status: 404 });
    }

    const targetData = targetUserSnap.data() || {};
    if (targetData.email === 'johanescobar1@gmail.com') {
      return NextResponse.json({ error: 'Accion bloqueada: Esta cuenta esta protegida permanentemente.' }, { status: 403 });
    }

    const detallesEliminacion: Record<string, number> = {};

    // 1. Eliminar todos los colaboradores asociados al negocio
    try {
      const colabsSnap = await adminDb.collection('usuarios').where('adminId', '==', usuarioId).get();
      detallesEliminacion.colaboradores = colabsSnap.size;

      for (const colabDoc of colabsSnap.docs) {
        const colabId = colabDoc.id;
        // Eliminar colaborador de Firebase Authentication
        try {
          await adminAuth.deleteUser(colabId);
        } catch (e: any) {
          console.warn(`Aviso Auth colab ${colabId}:`, e?.message);
        }
        // Eliminar documento de colaborador en Firestore
        await colabDoc.ref.delete();
      }
    } catch (errColab) {
      console.error('Error limpiando colaboradores:', errColab);
    }

    // 2. Eliminar colecciones asociadas en cascada
    const coleccionesAsociadas = [
      'inventario',
      'clientes',
      'movimientos',
      'separes',
      'ordenes_pendientes',
      'caja_mostrador'
    ];

    for (const colName of coleccionesAsociadas) {
      const eliminados = await eliminarLotesPorUsuarioId(adminDb, colName, usuarioId);
      detallesEliminacion[colName] = eliminados;
    }

    // 3. Eliminar el documento principal del negocio en Firestore
    await targetUserRef.delete();

    // 4. Eliminar el usuario de Firebase Authentication
    try {
      await adminAuth.deleteUser(usuarioId);
      detallesEliminacion.auth = 1;
    } catch (authErr: any) {
      console.warn(`Aviso Auth usuario principal ${usuarioId}:`, authErr?.message);
      detallesEliminacion.auth = 0;
    }

    return NextResponse.json({
      ok: true,
      mensaje: 'Negocio y todos sus datos vinculados eliminados definitivamente del sistema.',
      usuarioId,
      nombreNegocio: targetData.nombreNegocio || targetData.nombreUsuario || 'Sin nombre',
      detalles: detallesEliminacion
    });

  } catch (error: any) {
    console.error('Error durante la eliminacion en cascada del negocio:', error);
    return NextResponse.json({
      error: error?.message || 'Error interno al procesar la eliminacion del negocio.'
    }, { status: 500 });
  }
}
