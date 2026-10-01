import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim().toUpperCase() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!codigo) {
      return NextResponse.json({ ok: false, error: 'Por favor escribe un código.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const promoSnap = await adminDb.collection('codigos_promocionales').doc(codigo).get();

    if (!promoSnap.exists) {
      return NextResponse.json({ ok: false, error: 'El código ingresado no existe o no es válido.' }, { status: 404 });
    }

    const data = promoSnap.data() as any;

    if (data.activo === false) {
      return NextResponse.json({ ok: false, error: 'Este código ya fue utilizado o no se encuentra activo.' }, { status: 400 });
    }

    if (data.emailObjetivo && data.emailObjetivo.trim() !== '') {
      if (!email || data.emailObjetivo.trim().toLowerCase() !== email) {
        return NextResponse.json({ 
          ok: false, 
          error: `Este código es exclusivo para la cuenta ${data.emailObjetivo}` 
        }, { status: 403 });
      }
    }

    const planOtorgado: 'gratis' | 'comercio' | 'pro' = data.planOtorgado || 'pro';
    const diasOtorgados = typeof data.diasOtorgados === 'number' 
      ? data.diasOtorgados 
      : (data.descuento === '1mes' ? 30 : 30);
    const unSoloUso = data.unSoloUso !== false;

    return NextResponse.json({
      ok: true,
      codigo,
      planOtorgado,
      diasOtorgados,
      unSoloUso
    });
  } catch (error: any) {
    console.error('Error al validar cupón en servidor:', error);
    return NextResponse.json({ ok: false, error: 'Error al verificar el código en el servidor. Intenta de nuevo.' }, { status: 500 });
  }
}
