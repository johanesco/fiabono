import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(authHeader.slice(7).trim());
    const adminDb = getAdminDb();
    const usuarioSnap = await adminDb.collection('usuarios').doc(decodedToken.uid).get();
    if (!usuarioSnap.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 403 });
    }

    const usuario = usuarioSnap.data() as any;
    const cuentaPrincipalId = usuario.rol === 'cajero' ? usuario.adminId : decodedToken.uid;
    if (!cuentaPrincipalId || (usuario.rol === 'cajero' && usuario.activo === false)) {
      return NextResponse.json({ error: 'Cuenta no habilitada.' }, { status: 403 });
    }

    const body = await request.json();
    const clienteId = typeof body.id === 'string' ? body.id.trim() : (typeof body.clienteId === 'string' ? body.clienteId.trim() : '');
    if (!clienteId) {
      return NextResponse.json({ error: 'ID de cliente no proporcionado.' }, { status: 400 });
    }

    const clienteRef = adminDb.collection('clientes').doc(clienteId);
    const clienteSnap = await clienteRef.get();
    if (!clienteSnap.exists) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    const clienteData = clienteSnap.data() as any;
    if (clienteData.usuarioId !== cuentaPrincipalId) {
      return NextResponse.json({ error: 'No tienes permisos para modificar este cliente.' }, { status: 403 });
    }

    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : clienteData.nombre;
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre del cliente no puede estar vacío.' }, { status: 400 });
    }

    // Validar si el número de documento ya pertenece a otro cliente
    const numeroDocLimpio = typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim() : '';
    if (numeroDocLimpio) {
      const docExistenteSnap = await adminDb.collection('clientes')
        .where('usuarioId', '==', cuentaPrincipalId)
        .where('numeroDocumento', '==', numeroDocLimpio)
        .limit(2)
        .get();

      const docOtroCliente = docExistenteSnap.docs.find(d => d.id !== clienteId);
      if (docOtroCliente) {
        const otroData = docOtroCliente.data();
        return NextResponse.json({ 
          error: `Ya existe otro cliente registrado con este documento (${otroData.nombre || 'Sin nombre'}).` 
        }, { status: 409 });
      }
    }

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
    } else if (clienteData.etiquetas) {
      etiquetasFinales = Array.isArray(clienteData.etiquetas) ? clienteData.etiquetas : [];
    }

    const datosActualizar: Record<string, any> = {
      nombre,
      apodo: typeof body.apodo === 'string' ? body.apodo.trim() : (clienteData.apodo || ''),
      tipoDocumento: typeof body.tipoDocumento === 'string' ? body.tipoDocumento.trim() : (clienteData.tipoDocumento || 'CC'),
      numeroDocumento: typeof body.numeroDocumento === 'string' ? body.numeroDocumento.trim() : (clienteData.numeroDocumento || ''),
      celular: typeof body.celular === 'string' ? body.celular.trim() : (clienteData.celular || ''),
      direccion: typeof body.direccion === 'string' ? body.direccion.trim() : (clienteData.direccion || ''),
      notas: typeof body.notas === 'string' ? body.notas.trim() : (clienteData.notas || ''),
      etiquetas: etiquetasFinales,
      fechaActualizacion: new Date()
    };

    if (typeof body.dv === 'string') datosActualizar.dv = body.dv.trim();
    if (typeof body.email === 'string') datosActualizar.email = body.email.trim();
    if (typeof body.razonSocial === 'string') datosActualizar.razonSocial = body.razonSocial.trim();

    await clienteRef.update(datosActualizar);

    return NextResponse.json({
      ok: true,
      cliente: {
        id: clienteId,
        ...clienteData,
        ...datosActualizar
      }
    });
  } catch (error: any) {
    console.error('Error actualizando cliente:', error);
    return NextResponse.json({ error: error.message || 'Error interno al actualizar cliente.' }, { status: 500 });
  }
}
