// app/api/caja-mostrador/route.ts
// Endpoint seguro para administrar el perfil independiente de Caja Mostrador (Plan PRO)

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { generarSlugNegocio } from '@/utils/slug';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const adminUid = decodedToken.uid;

    const snapshot = await adminDb
      .collection('usuarios')
      .where('adminId', '==', adminUid)
      .where('esCajaMostrador', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ existe: false, caja: null });
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();

    // Obtener slug del negocio del admin para asegurar formato multivendedor-{slug}
    let usuarioAcceso = data.usuarioAcceso;
    let email = data.email;

    // Si aún tiene el prefijo antiguo caja-, sincronizar a multivendedor-
    if (!usuarioAcceso || usuarioAcceso.startsWith('caja-')) {
      const adminDoc = await adminDb.collection('usuarios').doc(adminUid).get();
      const adminData = adminDoc.data() || {};
      const slug = adminData.slugNegocio || generarSlugNegocio(adminData.nombreNegocio || 'tienda');
      usuarioAcceso = `multivendedor-${slug}`;
      email = `${usuarioAcceso}@fiabono.caja`;

      try {
        await adminAuth.updateUser(docSnap.id, {
          email,
          displayName: 'Terminal Multivendedor'
        });
        await docSnap.ref.update({
          usuarioAcceso,
          email,
          baseUsuario: 'multivendedor',
          nombreUsuario: 'Terminal Multivendedor'
        });
      } catch (syncErr) {
        console.warn('Advertencia al sincronizar terminal a multivendedor:', syncErr);
      }
    }

    return NextResponse.json({
      existe: true,
      caja: {
        id: docSnap.id,
        nombreUsuario: 'Terminal Multivendedor',
        usuarioAcceso: usuarioAcceso,
        email: email,
        activo: data.activo !== false,
        permisos: data.permisos || null,
        fechaCreacion: data.fechaCreacion ? data.fechaCreacion.toDate?.() || data.fechaCreacion : null
      }
    });
  } catch (error: any) {
    console.error('Error al consultar terminal multivendedor:', error);
    return NextResponse.json({ error: error?.message || 'Error interno al consultar terminal multivendedor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const adminUid = decodedToken.uid;

    // Verificar que el usuario administrador existe y tiene Plan PRO
    const adminDoc = await adminDb.collection('usuarios').doc(adminUid).get();
    if (!adminDoc.exists) {
      return NextResponse.json({ error: 'Cuenta de negocio no encontrada.' }, { status: 404 });
    }

    const adminData = adminDoc.data()!;
    const esMaster = decodedToken.email === 'johanescobar1@gmail.com';
    const esPro = adminData.plan === 'pro' || esMaster;

    if (!esPro) {
      return NextResponse.json({ 
        error: 'La Terminal de Caja Mostrador es una función exclusiva del Plan PRO Almacén.' 
      }, { status: 403 });
    }

    const body = await request.json();
    const { accion = 'activar', password, nuevaPassword, activo } = body;

    const slug = adminData.slugNegocio || generarSlugNegocio(adminData.nombreNegocio || 'tienda');
    const usuarioAcceso = `multivendedor-${slug}`;
    const emailGenerado = `${usuarioAcceso}@fiabono.caja`;

    // Buscar si ya existe la terminal multivendedor de este negocio en Firestore
    const existingSnap = await adminDb
      .collection('usuarios')
      .where('adminId', '==', adminUid)
      .where('esCajaMostrador', '==', true)
      .limit(1)
      .get();

    // 1. ACCIÓN: CAMBIAR CONTRASEÑA
    if (accion === 'cambiar_password') {
      if (!nuevaPassword || typeof nuevaPassword !== 'string' || nuevaPassword.length < 6) {
        return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
      }

      if (existingSnap.empty) {
        return NextResponse.json({ error: 'No se encontró una Terminal Multivendedor configurada.' }, { status: 404 });
      }

      const cajaId = existingSnap.docs[0].id;
      await adminAuth.updateUser(cajaId, { password: nuevaPassword });

      return NextResponse.json({
        exito: true,
        mensaje: 'La contraseña de la Terminal Multivendedor se actualizó correctamente.'
      });
    }

    // 2. ACCIÓN: PAUSAR / ACTIVAR (TOGGLE)
    if (accion === 'toggle_activo') {
      if (typeof activo !== 'boolean') {
        return NextResponse.json({ error: 'Valor activo inválido.' }, { status: 400 });
      }

      if (existingSnap.empty) {
        return NextResponse.json({ error: 'No se encontró una Terminal Multivendedor configurada.' }, { status: 404 });
      }

      const cajaId = existingSnap.docs[0].id;
      await adminDb.collection('usuarios').doc(cajaId).update({ activo });

      return NextResponse.json({
        exito: true,
        activo,
        mensaje: activo ? 'Terminal Multivendedor activada.' : 'Terminal Multivendedor pausada.'
      });
    }

    // 3. ACCIÓN: ACTUALIZAR PERMISOS DE LA TERMINAL MULTIVENDEDOR
    if (accion === 'actualizar_permisos') {
      const { permisos } = body;
      if (!permisos || typeof permisos !== 'object') {
        return NextResponse.json({ error: 'Objeto de permisos requerido.' }, { status: 400 });
      }

      if (existingSnap.empty) {
        return NextResponse.json({ error: 'No se encontró una Terminal Multivendedor configurada.' }, { status: 404 });
      }

      const cajaId = existingSnap.docs[0].id;
      const permisosSanitizados = {
        ventaDirecta: permisos.ventaDirecta === true,
        abonar: permisos.abonar === true,
        terminalMultivendedor: true, // Siempre activo para Terminal Multivendedor
        planSepare: permisos.planSepare === true,
        verCelulares: permisos.verCelulares === true,
        verCartera: permisos.verCartera === true,
        verDirectorio: permisos.verDirectorio === true,
        verReportes: permisos.verReportes === true,
        editarInventario: permisos.editarInventario === true,
        ingresoInventario: permisos.ingresoInventario === true,
        modificarPrecios: permisos.modificarPrecios === true,
        aplicarDescuentos: permisos.aplicarDescuentos === true,
        enviarWhatsApp: permisos.enviarWhatsApp !== false,
      };

      await adminDb.collection('usuarios').doc(cajaId).update({
        permisos: permisosSanitizados
      });

      return NextResponse.json({
        exito: true,
        permisos: permisosSanitizados,
        mensaje: 'Permisos de la Terminal Multivendedor actualizados correctamente.'
      });
    }

    // 4. ACCIÓN: ACTIVAR / CREAR
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    if (!existingSnap.empty) {
      // Ya existe en Firestore, simplemente actualizamos su clave y sincronizamos usuario multivendedor-{slug}
      const docCaja = existingSnap.docs[0];
      await adminAuth.updateUser(docCaja.id, {
        password,
        email: emailGenerado,
        displayName: 'Terminal Multivendedor'
      });
      await docCaja.ref.update({
        activo: true,
        usuarioAcceso,
        email: emailGenerado,
        baseUsuario: 'multivendedor',
        nombreUsuario: 'Terminal Multivendedor'
      });

      return NextResponse.json({
        exito: true,
        mensaje: '¡Terminal Multivendedor reactivada con éxito!',
        caja: {
          id: docCaja.id,
          usuarioAcceso,
          nombreUsuario: 'Terminal Multivendedor',
          activo: true
        }
      });
    }

    // Si no existe en Firestore, verificamos si existe un usuario huérfano con este correo en Auth
    try {
      const userAuthExistente = await adminAuth.getUserByEmail(emailGenerado);
      if (userAuthExistente) {
        await adminAuth.deleteUser(userAuthExistente.uid);
      }
    } catch {
      // Si no existe, perfecto
    }

    // Crear en Firebase Auth
    const nuevoUser = await adminAuth.createUser({
      email: emailGenerado,
      password: password,
      displayName: 'Terminal Multivendedor'
    });

    // Guardar en Firestore con permisos predeterminados de Terminal Multivendedor
    const datosCaja = {
      nombreUsuario: 'Terminal Multivendedor',
      baseUsuario: 'multivendedor',
      usuarioAcceso: usuarioAcceso,
      email: emailGenerado,
      rol: 'cajero',
      adminId: adminUid,
      esCajaMostrador: true,
      permisos: {
        ventaDirecta: false, // Por defecto requiere aprobación del admin
        abonar: false,       // Por defecto no puede registrar abonos de deudas
        terminalMultivendedor: true, // Siempre multivendedor
        planSepare: false,
        verCelulares: false,
        verCartera: false,
        verDirectorio: false,
        verReportes: false,
        editarInventario: false,
        ingresoInventario: false,
        modificarPrecios: false,
        aplicarDescuentos: false,
        enviarWhatsApp: true
      },
      activo: true,
      fechaCreacion: new Date()
    };

    await adminDb.collection('usuarios').doc(nuevoUser.uid).set(datosCaja);

    return NextResponse.json({
      exito: true,
      mensaje: `¡Terminal Multivendedor creada exitosamente!\n\nUsuario de acceso: ${usuarioAcceso}`,
      caja: {
        id: nuevoUser.uid,
        usuarioAcceso,
        nombreUsuario: 'Terminal Multivendedor',
        activo: true
      }
    });

  } catch (error: any) {
    console.error('Error al procesar terminal multivendedor:', error);
    return NextResponse.json({ 
      error: error?.message || 'Error interno al procesar la terminal multivendedor.' 
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const adminUid = decodedToken.uid;

    const snapshot = await adminDb
      .collection('usuarios')
      .where('adminId', '==', adminUid)
      .where('esCajaMostrador', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'No se encontró la Terminal Multivendedor.' }, { status: 404 });
    }

    const docSnap = snapshot.docs[0];
    const cajaId = docSnap.id;

    // Eliminar de Firebase Auth
    try {
      await adminAuth.deleteUser(cajaId);
    } catch (e) {
      console.warn('Usuario de Auth ya estaba eliminado o no encontrado:', e);
    }

    // Eliminar de Firestore
    await docSnap.ref.delete();

    return NextResponse.json({
      exito: true,
      mensaje: 'La Terminal Multivendedor fue eliminada definitivamente del sistema.'
    });
  } catch (error: any) {
    console.error('Error al eliminar terminal multivendedor:', error);
    return NextResponse.json({ 
      error: error?.message || 'Error interno al eliminar la terminal multivendedor.' 
    }, { status: 500 });
  }
}
