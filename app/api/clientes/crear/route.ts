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

    const numeroDocLimpio = typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim() : '';
    if (numeroDocLimpio) {
      const clienteExistenteSnap = await adminDb.collection('clientes')
        .where('usuarioId', '==', cuentaPrincipalId)
        .where('numeroDocumento', '==', numeroDocLimpio)
        .limit(1)
        .get();
      if (!clienteExistenteSnap.empty) {
        const clienteExistenteData = clienteExistenteSnap.docs[0].data();
        return NextResponse.json({ 
          error: `Ya existe un cliente registrado con este documento (${clienteExistenteData.nombre || 'Sin nombre'}).` 
        }, { status: 409 });
      }
    }

    const cuentaSnap = await adminDb.collection('usuarios').doc(cuentaPrincipalId).get();
    const cuenta = cuentaSnap.data() as any;
    const plan = String(cuenta?.plan || 'gratis').toLowerCase();
    if ((plan === 'gratis' || plan === 'basico') && !decodedToken.email?.toLowerCase().includes('johanescobar1@gmail.com')) {
      const clientesSnap = await adminDb.collection('clientes').where('usuarioId', '==', cuentaPrincipalId).get();
      if (clientesSnap.size >= 15) return NextResponse.json({ error: 'Has alcanzado el límite de 15 clientes del Plan Gratuito.' }, { status: 409 });
    }

    const saldoInicialNum = typeof body.saldoInicial === 'number' 
      ? Math.max(0, Math.round(body.saldoInicial)) 
      : (typeof body.saldoInicial === 'string' ? Math.max(0, Math.round(Number(body.saldoInicial.replace(/[^\d]/g, '')) || 0)) : 0);

    let etiquetasFinales: string[] = [];
    if (Array.isArray(body.etiquetas)) {
      body.etiquetas.forEach((item: any) => {
        if (typeof item === 'string') {
          item.split(/[,;-]/).forEach((t: string) => {
            const clean = t.trim();
            if (clean && !etiquetasFinales.some(exist => exist.toLowerCase() === clean.toLowerCase())) {
              etiquetasFinales.push(clean);
            }
          });
        }
      });
    } else if (typeof body.etiquetas === 'string' && body.etiquetas.trim()) {
      body.etiquetas.split(/[,;-]/).forEach((t: string) => {
        const clean = t.trim();
        if (clean && !etiquetasFinales.some(exist => exist.toLowerCase() === clean.toLowerCase())) {
          etiquetasFinales.push(clean);
        }
      });
    }

    const clienteRef = adminDb.collection('clientes').doc();
    const cliente = {
      nombre,
      celular: typeof body.celular === 'string' ? body.celular.trim() : '',
      apodo: typeof body.apodo === 'string' ? body.apodo.trim() : '',
      direccion: typeof body.direccion === 'string' ? body.direccion.trim() : '',
      notas: typeof body.notas === 'string' ? body.notas.trim() : '',
      tipoDocumento: typeof body.tipoDocumento === 'string' ? body.tipoDocumento.trim() : 'CC',
      numeroDocumento: typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim() : '',
      dv: typeof body.dv === 'string' ? body.dv.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      razonSocial: typeof body.razonSocial === 'string' ? body.razonSocial.trim() : '',
      etiquetas: etiquetasFinales,
      deudaTotal: saldoInicialNum,
      usuarioId: cuentaPrincipalId,
      fecha_creacion: new Date()
    };
    await clienteRef.create(cliente);

    if (saldoInicialNum > 0) {
      const movRef = adminDb.collection('movimientos').doc();
      await movRef.set({
        usuarioId: cuentaPrincipalId,
        clienteId: clienteRef.id,
        clienteNombre: nombre,
        tipo: 'fiado',
        monto: saldoInicialNum,
        total: saldoInicialNum,
        subtotal: saldoInicialNum,
        metodoPago: 'fiado',
        descripcion: 'Saldo inicial pendiente / Cartera heredada (Migración)',
        detalles: [
          {
            descripcion: 'Saldo inicial heredado de libreta/sistema anterior',
            valor: saldoInicialNum,
            cantidad: 1
          }
        ],
        fecha: new Date(),
        registradoPor: usuario.nombre || usuario.nombreUsuario || 'Administrador',
        esPublico: false
      });
    }

    return NextResponse.json({ ok: true, id: clienteRef.id, cliente: { id: clienteRef.id, ...cliente } });
  } catch (error) {
    console.error('Error creando cliente:', error);
    return NextResponse.json({ error: 'No se pudo crear el cliente.' }, { status: 500 });
  }
}
