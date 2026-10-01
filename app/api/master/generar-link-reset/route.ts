import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Se requiere token de sesión.' }, { status: 401 });
    }

    const token = authHeader.slice(7).trim();
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // Verificación de seguridad: solo el SuperAdmin Master (Johan) puede generar estos enlaces
    if (decodedToken.email !== 'johanescobar1@gmail.com') {
      return NextResponse.json({ error: 'Acceso restringido únicamente al SuperAdmin Master.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Se requiere un correo electrónico válido.' }, { status: 400 });
    }

    // Generar enlace seguro oficial de restablecimiento a través de Firebase Admin SDK
    const rawLink = await adminAuth.generatePasswordResetLink(email.trim().toLowerCase());

    // Extraer el código seguro oobCode para construir la URL oficial de Fiabono
    let linkFinal = rawLink;
    try {
      const urlObj = new URL(rawLink);
      const oobCode = urlObj.searchParams.get('oobCode');
      if (oobCode) {
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'fiabono.com';
        const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
        linkFinal = `${baseUrl}/restablecer-clave?oobCode=${oobCode}`;
      }
    } catch (e) {
      console.error('Error parseando link de reset:', e);
    }

    return NextResponse.json({
      ok: true,
      email: email.trim().toLowerCase(),
      link: linkFinal,
      rawFirebaseLink: rawLink
    });
  } catch (error: any) {
    console.error('Error al generar enlace de restablecimiento en Master:', error);
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'No existe ningún usuario registrado con ese correo en Firebase Auth.' }, { status: 404 });
    }
    return NextResponse.json({ 
      error: error?.message || 'Error al generar el enlace de recuperación.' 
    }, { status: 500 });
  }
}
