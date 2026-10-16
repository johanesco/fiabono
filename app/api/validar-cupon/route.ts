import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Limitador simple por IP (en memoria por instancia): frena fuerza bruta de códigos.
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 15;
const intentosPorIp = new Map<string, { cuenta: number; inicio: number }>();

function excedeLimite(ip: string): boolean {
  const ahora = Date.now();
  if (intentosPorIp.size > 5000) {
    for (const [clave, v] of intentosPorIp) if (ahora - v.inicio > VENTANA_MS) intentosPorIp.delete(clave);
  }
  const registro = intentosPorIp.get(ip);
  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    intentosPorIp.set(ip, { cuenta: 1, inicio: ahora });
    return false;
  }
  registro.cuenta += 1;
  return registro.cuenta > MAX_INTENTOS;
}

export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || 'desconocida').split(',')[0].trim();
    if (excedeLimite(ip)) {
      return NextResponse.json({ ok: false, error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }, { status: 429 });
    }

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
          error: 'Este código es exclusivo para otra cuenta. Verifica que uses el correo con el que fue asignado.' 
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
