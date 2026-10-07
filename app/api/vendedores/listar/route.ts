// app/api/vendedores/listar/route.ts
// Endpoint seguro para consultar la lista de vendedores reales (Admin + Colaboradores Activos)
// Accesible tanto para el Administrador como para Colaboradores y la Terminal Multivendedor.

import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

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
    const userUid = decodedToken.uid;

    // Obtener datos del usuario que consulta para identificar el negocio (adminId)
    const userDoc = await adminDb.collection('usuarios').doc(userUid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const adminUid = userData.rol === 'cajero' && userData.adminId ? userData.adminId : userUid;

    // 1. Obtener datos del Administrador / Dueño del negocio
    const adminDoc = await adminDb.collection('usuarios').doc(adminUid).get();
    const adminData = adminDoc.exists ? adminDoc.data() : {};
    const adminNombre = adminData?.nombreUsuario || adminData?.nombreNegocio || 'Administrador';

    const listaNombres: string[] = [];
    if (adminNombre && !adminNombre.toLowerCase().includes('multivendedor') && !adminNombre.toLowerCase().includes('caja mostrador')) {
      listaNombres.push(adminNombre);
    }

    // 2. Consultar colaboradores activos de este negocio (excluyendo la terminal multivendedor / caja mostrador)
    const colabsSnapshot = await adminDb
      .collection('usuarios')
      .where('adminId', '==', adminUid)
      .where('rol', '==', 'cajero')
      .get();

    const colaboradores: { id: string; nombre: string; usuarioAcceso?: string }[] = [];

    colabsSnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.activo === false || d.esCajaMostrador === true || d.esTerminalMultivendedor === true) return;

      // Verificar si el colaborador tiene horarios asignados y si está dentro de su turno
      if (Array.isArray(d.horariosActividad) && d.horariosActividad.length > 0) {
        const tieneHorariosValidos = d.horariosActividad.some((h: any) => h?.activoAuto !== false);
        if (tieneHorariosValidos && d.manualOverride !== true) {
          const ahoraCo = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
          const nombresDias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
          const diaHoy = nombresDias[ahoraCo.getDay()];
          const horaActual = `${String(ahoraCo.getHours()).padStart(2, '0')}:${String(ahoraCo.getMinutes()).padStart(2, '0')}`;

          const dentroDeHorario = d.horariosActividad.some((h: any) => {
            if (h?.activoAuto === false) return false;
            const dias = h.dias || [];
            if (!dias.includes(diaHoy)) return false;
            const inicio = h.inicio || '00:00';
            const fin = h.fin || '23:59';
            return inicio <= horaActual && horaActual < fin;
          });

          if (!dentroDeHorario) return; // Fuera de horario de trabajo
        }
      }

      const nom = d.nombreUsuario || d.nombre || d.displayName;
      if (!nom) return;
      if (nom.toLowerCase().includes('multivendedor') || nom.toLowerCase().includes('caja mostrador')) return;

      if (!listaNombres.includes(nom)) {
        listaNombres.push(nom);
      }
      colaboradores.push({
        id: docSnap.id,
        nombre: nom,
        usuarioAcceso: d.usuarioAcceso
      });
    });

    const listaFinal = listaNombres.length > 0 ? listaNombres : [adminNombre || 'Vendedor'];

    return NextResponse.json({
      adminNombre,
      vendedores: listaFinal,
      colaboradores
    });
  } catch (error: any) {
    console.error('Error al listar vendedores:', error);
    return NextResponse.json({ error: error?.message || 'Error interno al consultar vendedores.' }, { status: 500 });
  }
}
