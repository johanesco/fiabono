import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

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
    const tienePermiso = esAdmin || usuario.permisos?.planSepare === true || usuario.permisos?.abonar === true;
    if (!cuentaPrincipalId || !tienePermiso) {
      return NextResponse.json({ error: 'No tienes permiso para actualizar notas o fotos de Separes.' }, { status: 403 });
    }

    const body = await request.json();
    const separeId = typeof body.separeId === 'string' ? body.separeId.trim() : '';
    const nuevaFoto = typeof body.nuevaFoto === 'string' && body.nuevaFoto.trim().length > 10 ? body.nuevaFoto.trim() : null;
    const nuevaNota = typeof body.nuevaNota === 'string' && body.nuevaNota.trim() ? body.nuevaNota.trim() : null;
    const ubicacionBodega = typeof body.ubicacionBodega === 'string' ? body.ubicacionBodega.trim() : null;

    const productoIndex = typeof body.productoIndex === 'number' && body.productoIndex >= 0 ? body.productoIndex : null;

    if (!separeId) {
      return NextResponse.json({ error: 'ID de Plan Separe requerido.' }, { status: 400 });
    }

    if (!nuevaFoto && !nuevaNota && ubicacionBodega === null) {
      return NextResponse.json({ error: 'No hay datos nuevos para actualizar.' }, { status: 400 });
    }

    const separeRef = adminDb.collection('separes').doc(separeId);
    const separeSnap = await separeRef.get();
    if (!separeSnap.exists) {
      return NextResponse.json({ error: 'El Plan Separe no existe.' }, { status: 404 });
    }

    const separe = separeSnap.data() as any;
    if (separe.usuarioId !== cuentaPrincipalId) {
      return NextResponse.json({ error: 'El Plan Separe no pertenece a tu negocio.' }, { status: 403 });
    }

    const updates: any = {};
    const autor = usuario.nombreUsuario || decodedToken.email || 'Usuario';

    // ANTIFRAUDE: Las fotos solo se ACUMULAN / ANEXAN, nunca se sobreescriben ni borran las anteriores
    if (nuevaFoto) {
      const fotosExistentes = Array.isArray(separe.fotos) ? separe.fotos : [];
      if (!fotosExistentes.includes(nuevaFoto)) {
        updates.fotos = [...fotosExistentes, nuevaFoto];
      }

      // Si se especificó un producto específico del separe, asociarle la foto a ese ítem
      if (productoIndex !== null && Array.isArray(separe.items) && separe.items[productoIndex]) {
        const itemsActualizados = [...separe.items];
        itemsActualizados[productoIndex] = {
          ...itemsActualizados[productoIndex],
          fotoUrl: nuevaFoto
        };
        updates.items = itemsActualizados;
      }
    }

    // Bitácora de novedades con autor y marca de tiempo
    if (nuevaNota) {
      const bitacoraExistente = Array.isArray(separe.bitacoraNovedades) ? separe.bitacoraNovedades : [];
      updates.bitacoraNovedades = [
        ...bitacoraExistente,
        {
          id: `nov_${Date.now()}`,
          texto: nuevaNota,
          autor,
          fecha: new Date()
        }
      ];
    }

    // Actualizar ubicación física en bodega si se proporcionó
    if (ubicacionBodega !== null) {
      updates.ubicacionBodega = ubicacionBodega;
      updates.notas = ubicacionBodega; // Mantener retrocompatibilidad con notas
    }

    updates.fechaUltimaActualizacion = new Date();
    await separeRef.update(updates);

    return NextResponse.json({ ok: true, mensaje: 'Plan Separe actualizado correctamente.' });
  } catch (error: any) {
    console.error('Error actualizando notas/fotos de Separe:', error);
    return NextResponse.json({ error: error?.message || 'Error al actualizar.' }, { status: 500 });
  }
}
