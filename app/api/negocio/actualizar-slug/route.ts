// app/api/negocio/actualizar-slug/route.ts
// Endpoint seguro para actualizar el identificador/slug del negocio
// y sincronizar automáticamente las credenciales de todos sus colaboradores en Firebase Auth y Firestore.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

function limpiarSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') return '';
  return slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

function extraerBaseUsuario(data: any, oldSlug: string): string {
  if (data.esCajaMostrador === true) {
    return 'multivendedor';
  }

  if (data.baseUsuario && typeof data.baseUsuario === 'string') {
    const base = data.baseUsuario.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return base === 'caja' ? 'multivendedor' : base;
  }

  const rawUser = data.usuarioAcceso || (data.email ? data.email.split('@')[0] : '');
  if (rawUser && oldSlug && rawUser.endsWith(`-${oldSlug}`)) {
    const base = rawUser.slice(0, -(oldSlug.length + 1));
    return base === 'caja' ? 'multivendedor' : base;
  }

  if (rawUser && rawUser.includes('-')) {
    const parts = rawUser.split('-');
    return parts[0] === 'caja' ? 'multivendedor' : parts[0];
  }

  return rawUser ? rawUser.replace(/[^a-z0-9]/g, '') : 'cajero';
}

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
    const { nuevoSlug } = body;

    const slugLimpio = limpiarSlug(nuevoSlug);
    if (!slugLimpio || slugLimpio.length < 2) {
      return NextResponse.json({ error: 'El identificador debe tener al menos 2 caracteres alfanuméricos.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const adminRef = adminDb.collection('usuarios').doc(decodedToken.uid);
    const adminSnap = await adminRef.get();

    if (!adminSnap.exists) {
      return NextResponse.json({ error: 'No se encontró la cuenta de usuario.' }, { status: 404 });
    }

    const adminData = adminSnap.data()!;
    const oldSlug = adminData.slugNegocio || '';

    // 1. Validar unicidad: ningún otro negocio debe tener el mismo slugNegocio
    const slugEnUsoSnap = await adminDb
      .collection('usuarios')
      .where('slugNegocio', '==', slugLimpio)
      .get();

    const ocupadoPorOtro = slugEnUsoSnap.docs.some(d => d.id !== decodedToken.uid);
    if (ocupadoPorOtro) {
      return NextResponse.json({ 
        error: `El identificador '${slugLimpio}' ya está en uso por otro comercio. Intenta con '${slugLimpio}1' o '${slugLimpio}negocio'.` 
      }, { status: 409 });
    }

    if (oldSlug === slugLimpio) {
      return NextResponse.json({ 
        exito: true, 
        nuevoSlug: slugLimpio, 
        sinCambios: true, 
        mensaje: 'El identificador es el mismo actual.' 
      });
    }

    // 2. Obtener todos los colaboradores de este negocio
    const colabsSnap = await adminDb
      .collection('usuarios')
      .where('adminId', '==', decodedToken.uid)
      .where('rol', '==', 'cajero')
      .get();

    const colaboradoresActualizados: Array<{ id: string; nombre: string; nuevoUsuario: string }> = [];

    // 3. Sincronizar en Firebase Auth y preparar batch de Firestore
    const batch = adminDb.batch();

    for (const docSnap of colabsSnap.docs) {
      const colabData = docSnap.data();
      const baseUsuario = extraerBaseUsuario(colabData, oldSlug) || 'cajero';
      const nuevoUsuarioAcceso = `${baseUsuario}-${slugLimpio}`;
      const nuevoCorreoAuth = `${nuevoUsuarioAcceso}@fiabono.caja`;

      try {
        const esTerminal = colabData.esCajaMostrador === true || baseUsuario === 'multivendedor';
        const nombreFinal = esTerminal ? 'Terminal Multivendedor' : (colabData.nombreUsuario || colabData.nombre || baseUsuario);

        await adminAuth.updateUser(docSnap.id, {
          email: nuevoCorreoAuth,
          ...(esTerminal ? { displayName: 'Terminal Multivendedor' } : {})
        });

        batch.update(docSnap.ref, {
          usuarioAcceso: nuevoUsuarioAcceso,
          email: nuevoCorreoAuth,
          baseUsuario: baseUsuario,
          ...(esTerminal ? { nombreUsuario: 'Terminal Multivendedor' } : {})
        });

        colaboradoresActualizados.push({
          id: docSnap.id,
          nombre: nombreFinal,
          nuevoUsuario: nuevoUsuarioAcceso
        });
      } catch (authErr: any) {
        console.error(`Error actualizando colaborador ${docSnap.id} en Auth:`, authErr);
      }
    }

    // 4. Actualizar el slug en la cuenta del Administrador
    batch.update(adminRef, {
      slugNegocio: slugLimpio
    });

    await batch.commit();

    return NextResponse.json({
      exito: true,
      nuevoSlug: slugLimpio,
      colaboradoresActualizados,
      mensaje: `Identificador actualizado a '${slugLimpio}'. ${colaboradoresActualizados.length} colaborador(es) sincronizados.`
    });
  } catch (error: any) {
    console.error('Error al actualizar slug de negocio:', error);
    return NextResponse.json({
      error: error?.message || 'Error interno al actualizar el identificador.'
    }, { status: 500 });
  }
}
