import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminStorage } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 });

    const usuario = usuarioSnap.data() as any;
    const esAdmin = usuario.rol !== 'cajero';
    const cuentaPrincipalId = esAdmin ? decodedToken.uid : usuario.adminId;
    const puedeSubir = esAdmin || usuario.permisos?.editarInventario === true || usuario.permisos?.ingresoInventario === true;
    if (!cuentaPrincipalId || !puedeSubir) {
      return NextResponse.json({ error: 'No tienes permiso para subir fotos de inventario.' }, { status: 403 });
    }

    const formData = await request.formData();
    const archivo = formData.get('file');
    if (!(archivo instanceof File)) return NextResponse.json({ error: 'No se recibió ninguna imagen.' }, { status: 400 });
    if (archivo.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'La imagen debe pesar menos de 8MB.' }, { status: 400 });
    const contentType = archivo.type || 'image/jpeg';
    if (!contentType.startsWith('image/')) return NextResponse.json({ error: 'El archivo debe ser una imagen.' }, { status: 400 });

    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const ruta = `negocios/${cuentaPrincipalId}/productos/${Date.now()}_${randomUUID()}.${extension}`;
    const token = randomUUID();
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const bucket = getAdminStorage().bucket();
    const fileRef = bucket.file(ruta);

    await fileRef.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: token }
      }
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error('Error subiendo foto de inventario:', error);
    return NextResponse.json({ error: 'No se pudo subir la foto.' }, { status: 500 });
  }
}
