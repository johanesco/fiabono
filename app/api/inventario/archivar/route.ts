import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists || usuarioSnap.data()?.rol === 'cajero') {
      return NextResponse.json({ error: 'Sólo el administrador puede archivar productos.' }, { status: 403 });
    }

    const body = await request.json();
    const productoId = typeof body.productoId === 'string' ? body.productoId : '';
    if (!productoId) return NextResponse.json({ error: 'Producto requerido.' }, { status: 400 });

    const productoRef = adminDb.collection('inventario').doc(productoId);
    const productoSnap = await productoRef.get();
    if (!productoSnap.exists || productoSnap.data()?.usuarioId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Producto no encontrado o no pertenece a tu negocio.' }, { status: 403 });
    }

    await productoRef.update({ activo: false, fechaActualizacion: new Date() });
    return NextResponse.json({ ok: true, productoId });
  } catch (error) {
    console.error('Error archivando producto:', error);
    return NextResponse.json({ error: 'No se pudo archivar el producto.' }, { status: 500 });
  }
}
