import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { generarSlugNegocio } from '@/utils/slug';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    const body = await request.json();
    const nombreUsuario = typeof body.nombreUsuario === 'string' ? body.nombreUsuario.trim() : 'Comerciante';
    const nombreNegocio = typeof body.nombreNegocio === 'string' ? body.nombreNegocio.trim() : '';
    const tipoNegocio = typeof body.tipoNegocio === 'string' ? body.tipoNegocio.trim() : 'Moda y Ropa';
    const telefonoNegocio = typeof body.telefonoNegocio === 'string' ? body.telefonoNegocio.trim() : '';
    const moduloSepare = body.moduloSepare !== false;
    const planSolicitado = typeof body.plan === 'string' ? body.plan.toLowerCase() : 'comercio';
    const cicloPlan = body.cicloPlan === 'anual' ? 'anual' : 'mensual';
    const codigoPromocional = typeof body.codigoPromocional === 'string' ? body.codigoPromocional.trim().toUpperCase() : '';

    if (!nombreNegocio) {
      return NextResponse.json({ error: 'El nombre del negocio es obligatorio.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection('usuarios').doc(uid);
    const existingUserSnap = await userDocRef.get();

    if (existingUserSnap.exists) {
      const existingData = existingUserSnap.data() as any;
      if (existingData?.fechaRegistro || existingData?.rol) {
        return NextResponse.json({ ok: true, slugNegocio: existingData.slugNegocio || generarSlugNegocio(nombreNegocio), yaExistia: true });
      }
    }

    // Validar código promocional si fue enviado
    const planSolicitadoLimpio: 'gratis' | 'comercio' | 'pro' =
      planSolicitado === 'pro' ? 'pro' : (planSolicitado === 'gratis' ? 'gratis' : 'comercio');
    let planFinal: 'gratis' | 'comercio' | 'pro' = planSolicitadoLimpio;
    let diasOtorgados: number | null = planFinal !== 'gratis' ? 14 : null;
    let promoData: any = null;
    let esCuponValido = false;

    if (codigoPromocional) {
      try {
        const promoSnap = await adminDb.collection('codigos_promocionales').doc(codigoPromocional).get();
        if (promoSnap.exists) {
          const promo = promoSnap.data() as any;
          const usosActuales = typeof promo.usosActuales === 'number' ? promo.usosActuales : (typeof promo.totalCanjes === 'number' ? promo.totalCanjes : 0);
          const cupoDisponible = !(typeof promo.usosMaximos === 'number' && promo.usosMaximos > 0 && usosActuales >= promo.usosMaximos);
          let noExpirado = true;
          if (promo.fechaExpiracion) {
            const expTime = promo.fechaExpiracion.toDate ? promo.fechaExpiracion.toDate().getTime() : new Date(promo.fechaExpiracion).getTime();
            if (!isNaN(expTime) && Date.now() > expTime) noExpirado = false;
          }

          if (promo.activo !== false && cupoDisponible && noExpirado) {
            // Verificar restricción de correo
            const emailAutorizado = !promo.emailObjetivo || promo.emailObjetivo.trim() === '' || promo.emailObjetivo.trim().toLowerCase() === email.trim().toLowerCase();
            if (emailAutorizado) {
              planFinal = promo.planOtorgado || 'pro';
              const dias = typeof promo.diasOtorgados === 'number' ? promo.diasOtorgados : (promo.descuento === '1mes' ? 30 : 30);
              diasOtorgados = dias;
              promoData = promo;
              esCuponValido = true;
            }
          }
        }
      } catch (e) {
        console.warn('Error al verificar cupón en servidor:', e);
      }
    }

    let fechaVence: Date | null = null;
    if (diasOtorgados) {
      const d = new Date();
      d.setDate(d.getDate() + diasOtorgados);
      fechaVence = d;
    }

    // Generar slug único garantizado
    const slugBase = generarSlugNegocio(nombreNegocio);
    let slugAsignado = slugBase;
    let contador = 1;
    let slugDisponible = false;

    while (!slugDisponible && contador <= 50) {
      const snapSlug = await adminDb.collection('usuarios').where('slugNegocio', '==', slugAsignado).limit(1).get();
      if (snapSlug.empty) {
        slugDisponible = true;
      } else {
        slugAsignado = `${slugBase}${contador}`;
        contador++;
      }
    }

    if (!slugDisponible) {
      slugAsignado = `${slugBase}${Math.floor(100 + Math.random() * 900)}`;
    }

    await userDocRef.set({
      nombreUsuario: nombreUsuario || (decodedToken.name || 'Comerciante'),
      nombreNegocio,
      slugNegocio: slugAsignado,
      tipoNegocio,
      moduloSepareActivo: moduloSepare,
      email,
      telefonoNegocio,
      rol: 'admin',
      plan: planFinal,
      planVence: fechaVence,
      cicloPlan,
      creadoCon: decodedToken.firebase?.sign_in_provider === 'google.com' ? 'google' : 'email',
      pruebaGratisUsada: planFinal !== 'gratis',
      terminosAceptados: true,
      fechaAceptacionTerminos: new Date(),
      fechaRegistro: new Date(),
      ...(esCuponValido ? { codigoPromocionalUsado: codigoPromocional, codigosCanjeados: [codigoPromocional] } : {})
    }, { merge: true });

    if (promoData && esCuponValido) {
      try {
        const emailNorm = email.trim().toLowerCase();
        const usosPrevios = typeof promoData.usosActuales === 'number' ? promoData.usosActuales : (typeof promoData.totalCanjes === 'number' ? promoData.totalCanjes : 0);
        const nuevosUsos = usosPrevios + 1;
        const agotaMultiUso = typeof promoData.usosMaximos === 'number' && promoData.usosMaximos > 0 && nuevosUsos >= promoData.usosMaximos;

        if (promoData.unSoloUso !== false || agotaMultiUso) {
          await adminDb.collection('codigos_promocionales').doc(codigoPromocional).update({
            activo: false,
            usosActuales: nuevosUsos,
            totalCanjes: FieldValue.increment(1),
            canjeadoPor: uid,
            usadoPor: uid,
            emailCanje: emailNorm,
            fechaCanje: new Date(),
            fechaUso: new Date(),
            usuariosQueCanjearon: FieldValue.arrayUnion(uid)
          });
        } else {
          await adminDb.collection('codigos_promocionales').doc(codigoPromocional).update({
            usosActuales: FieldValue.increment(1),
            totalCanjes: FieldValue.increment(1),
            canjeadoPor: uid,
            usadoPor: uid,
            emailCanje: emailNorm,
            fechaCanje: new Date(),
            ultimoCanjePor: uid,
            ultimoEmailCanje: emailNorm,
            fechaUltimoCanje: new Date(),
            usuariosQueCanjearon: FieldValue.arrayUnion(uid)
          });
        }
      } catch (e) {
        console.error('Error al actualizar trazabilidad del cupón usado:', e);
      }
    }

    return NextResponse.json({ ok: true, slugNegocio: slugAsignado });
  } catch (error: any) {
    console.error('Error en /api/auth/completar-onboarding:', error);
    return NextResponse.json({ error: error?.message || 'No se pudo completar el registro del negocio.' }, { status: 500 });
  }
}
