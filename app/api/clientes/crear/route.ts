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
    const cuentaPrincipalId = usuario.rol === 'cajero' ? usuario.adminId : decodedToken.uid;
    if (!cuentaPrincipalId || (usuario.rol === 'cajero' && usuario.activo === false)) return NextResponse.json({ error: 'Cuenta no habilitada.' }, { status: 403 });

    const body = await request.json();
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    if (!nombre) return NextResponse.json({ error: 'El nombre del cliente es obligatorio.' }, { status: 400 });

    const cuentaSnap = await adminDb.collection('usuarios').doc(cuentaPrincipalId).get();
    const cuenta = cuentaSnap.data() as any;
    const plan = String(cuenta?.plan || 'gratis').toLowerCase();
    if ((plan === 'gratis' || plan === 'basico') && !decodedToken.email?.toLowerCase().includes('johanescobar1@gmail.com')) {
      const clientesSnap = await adminDb.collection('clientes').where('usuarioId', '==', cuentaPrincipalId).get();
      if (clientesSnap.size >= 15) return NextResponse.json({ error: 'Has alcanzado el límite de 15 clientes del Plan Gratuito.' }, { status: 409 });
    }

    const clienteRef = adminDb.collection('clientes').doc();
    const cliente = {
      nombre,
      celular: typeof body.celular === 'string' ? body.celular.trim() : '',
      direccion: typeof body.direccion === 'string' ? body.direccion.trim() : '',
      notas: typeof body.notas === 'string' ? body.notas.trim() : '',
      deudaTotal: 0,
      usuarioId: cuentaPrincipalId,
      fecha_creacion: new Date()
    };
    await clienteRef.create(cliente);
    return NextResponse.json({ ok: true, id: clienteRef.id, cliente: { id: clienteRef.id, ...cliente } });
  } catch (error) {
    console.error('Error creando cliente:', error);
    return NextResponse.json({ error: 'No se pudo crear el cliente.' }, { status: 500 });
  }
}
