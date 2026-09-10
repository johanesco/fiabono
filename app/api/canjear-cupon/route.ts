// app/api/canjear-cupon/route.ts
// Endpoint seguro del servidor que procesa la validación y canje de cupones
// utilizando Firebase Admin SDK para prevenir auto-escalamiento de privilegios.

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
    } catch (authErr) {
      return NextResponse.json({ error: 'Sesión inválida o expirada. Por favor recarga e inicia sesión.' }, { status: 401 });
    }

    const body = await request.json();
    const { codigo, usuarioId } = body;

    if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
      return NextResponse.json({ error: 'Código de bono no proporcionado o inválido.' }, { status: 400 });
    }

    if (!usuarioId || typeof usuarioId !== 'string' || !usuarioId.trim()) {
      return NextResponse.json({ error: 'ID de cuenta de usuario no válido.' }, { status: 400 });
    }

    // Seguridad estricta: El token debe pertenecer al usuario que canjea, o ser el Super-Admin Master
    const esMaster = decodedToken.email === 'johanescobar1@gmail.com';
    if (decodedToken.uid !== usuarioId && !esMaster) {
      return NextResponse.json({ error: 'No estás autorizado para canjear cupones en esta cuenta.' }, { status: 403 });
    }

    const adminDb = getAdminDb();
    const codigoNormalizado = codigo.trim().toUpperCase();
    const emailUsuario = (decodedToken.email || '').trim().toLowerCase();

    const resultadoCanje = await adminDb.runTransaction(async (transaction) => {
      const codigoRef = adminDb.collection('codigos_promocionales').doc(codigoNormalizado);
      const codigoSnap = await transaction.get(codigoRef);

      if (!codigoSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const codigoData = codigoSnap.data()!;
      if (!codigoData.activo) {
        throw new Error('INACTIVE');
      }

      // Validar si el código está asignado a un correo en específico
      if (codigoData.emailObjetivo && typeof codigoData.emailObjetivo === 'string' && codigoData.emailObjetivo.trim()) {
        if (codigoData.emailObjetivo.trim().toLowerCase() !== emailUsuario && !esMaster) {
          throw new Error('UNAUTHORIZED_EMAIL');
        }
      }

      const userRef = adminDb.collection('usuarios').doc(usuarioId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error('USER_NOT_FOUND');
      }

      const userData = userSnap.data()!;
      const planOtorgado = codigoData.planOtorgado || 'pro';
      const diasOtorgados = typeof codigoData.diasOtorgados === 'number' ? codigoData.diasOtorgados : 30;
      const esUnSoloUso = codigoData.unSoloUso !== false;

      let baseDate = new Date();
      // Si renueva el mismo plan y aún tiene días vigentes o está en periodo de gracia (-1 a -2 días):
      if (userData.plan === planOtorgado && userData.planVence) {
        const timeVence = userData.planVence.toDate ? userData.planVence.toDate().getTime() : new Date(userData.planVence).getTime();
        const diasRestantes = Math.ceil((timeVence - Date.now()) / (1000 * 3600 * 24));
        if (diasRestantes >= -2) {
          baseDate = new Date(timeVence);
        }
      }

      const nuevaFechaVencimiento = new Date(baseDate);
      nuevaFechaVencimiento.setDate(nuevaFechaVencimiento.getDate() + diasOtorgados);
      const cicloAsignado = diasOtorgados >= 365 ? 'anual' : 'mensual';

      // 1. Asignar plan en /usuarios
      transaction.update(userRef, {
        plan: planOtorgado,
        planVence: nuevaFechaVencimiento,
        cicloPlan: cicloAsignado,
        fechaActualizacionPlan: new Date()
      });

      // 2. Quemar el código si es de un solo uso
      if (esUnSoloUso) {
        transaction.update(codigoRef, {
          activo: false,
          canjeadoPor: usuarioId,
          emailCanje: emailUsuario,
          fechaCanje: new Date()
        });
      }

      return {
        planOtorgado,
        diasOtorgados,
        nuevaFechaVencimiento
      };
    });

    return NextResponse.json({
      ok: true,
      mensaje: '¡Felicidades! Cupón canjeado exitosamente.',
      plan: resultadoCanje.planOtorgado,
      dias: resultadoCanje.diasOtorgados,
      vencimiento: resultadoCanje.nuevaFechaVencimiento
    });

  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'El código ingresado no existe.' }, { status: 404 });
    }
    if (error?.message === 'INACTIVE') {
      return NextResponse.json({ error: 'El código ingresado ya fue usado o está inactivo.' }, { status: 400 });
    }
    if (error?.message === 'UNAUTHORIZED_EMAIL') {
      return NextResponse.json({ error: 'Este código promocional no está autorizado para tu correo electrónico.' }, { status: 403 });
    }
    if (error?.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'No se encontró la cuenta de usuario especificada.' }, { status: 404 });
    }

    console.error('[API] Error al canjear cupón:', error);
    return NextResponse.json({ error: 'Ocurrió un error inesperado al canjear el cupón.' }, { status: 500 });
  }
}