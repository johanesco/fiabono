"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, doc, updateDoc, increment, where } from "firebase/firestore";
import { db } from "../firebase";

export default function Home() {
  // --- ESTADOS GENERALES ---
  const [clientes, setClientes] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [verTodosClientes, setVerTodosClientes] = useState(false);

  // --- FLUJO DE ACCIÓN DIRECTA (FIAR / ABONAR PRIMERO) ---
  const [accionGlobal, setAccionGlobal] = useState<'fiado' | 'abono' | null>(null);
  const [buscandoClienteParaAccion, setBuscandoClienteParaAccion] = useState(false);

  // --- FILAS MÚLTIPLES PARA FIADOS Y ABONOS ---
  const [filasTransaccion, setFilasTransaccion] = useState<{ descripcion: string; valor: string }[]>([
    { descripcion: "", valor: "" }
  ]);

  // --- ESTADOS DE NUEVO CLIENTE (SI NO EXISTE) ---
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // --- ESTADOS DEL PERFIL Y HISTORIAL ---
  const [clienteActivo, setClienteActivo] = useState<any | null>(null);
  const [movimientos, setMovimientos] = useState<any[]>([]);

  // --- ESTADO PARA COMPARTIR POR WHATSAPP POST-TRANSACCIÓN ---
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [whatsappClienteNombre, setWhatsappClienteNombre] = useState<string>("");

  // --- CARGAR DATOS ---
  const cargarClientes = async () => {
    try {
      const q = query(collection(db, "clientes"));
      const querySnapshot = await getDocs(q);
      const listaTemporal: any[] = [];
      querySnapshot.forEach((doc) => {
        listaTemporal.push({ id: doc.id, ...doc.data() });
      });
      listaTemporal.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClientes(listaTemporal);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    }
  };

  const cargarMovimientos = async (clienteId: string) => {
    try {
      const q = query(collection(db, "movimientos"), where("clienteId", "==", clienteId));
      const querySnapshot = await getDocs(q);
      const historial: any[] = [];
      querySnapshot.forEach((doc) => {
        historial.push({ id: doc.id, ...doc.data() });
      });
      historial.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
      setMovimientos(historial);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const clientesFiltrados = clientes.filter(cliente => 
    cliente.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // --- MANEJO DE FILAS MÚLTIPLES ---
  const agregarFila = () => {
    setFilasTransaccion([...filasTransaccion, { descripcion: "", valor: "" }]);
  };

  const actualizarFila = (index: number, campo: 'descripcion' | 'valor', valor: string) => {
    const nuevasFilas = [...filasTransaccion];
    nuevasFilas[index][campo] = valor;
    setFilasTransaccion(nuevasFilas);
  };

  const eliminarFila = (index: number) => {
    if (filasTransaccion.length === 1) return; // Mantener al menos una fila
    const nuevasFilas = filasTransaccion.filter((_, i) => i !== index);
    setFilasTransaccion(nuevasFilas);
  };

  // Calcular suma total de las filas
  const totalFilas = filasTransaccion.reduce((acc, fila) => {
    const val = parseFloat(fila.valor);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // --- PROCESAR TRANSACCIÓN (FIADO O ABONO MÚLTIPLE) ---
  const seleccionarClienteParaTransaccion = async (cliente: any) => {
    // Validar filas
    const filasValidas = filasTransaccion.filter(f => parseFloat(f.valor) > 0);
    if (filasValidas.length === 0) {
      alert("Por favor, ingresa al menos un monto válido mayor a 0.");
      return;
    }

    try {
      let montoTotalAcumulado = 0;
      let descripcionesResumen: string[] = [];

      for (const fila of filasValidas) {
        const val = parseFloat(fila.valor);
        montoTotalAcumulado += val;

        let descFinal = fila.descripcion.trim();
        if (accionGlobal === 'abono' && descFinal === "") {
          descFinal = "Abono";
        }
        if (accionGlobal === 'fiado' && descFinal === "") {
          descFinal = "Artículo fiado";
        }

        descripcionesResumen.push(`${descFinal} ($${val.toLocaleString('es-CO')})`);

        // Registrar cada fila como un movimiento individual o consolidado
        await addDoc(collection(db, "movimientos"), {
          clienteId: cliente.id,
          tipo: accionGlobal,
          monto: val,
          descripcion: descFinal,
          fecha: new Date()
        });
      }

      // Actualizar la deuda total del cliente
      const refCliente = doc(db, "clientes", cliente.id);
      const ajuste = accionGlobal === 'fiado' ? montoTotalAcumulado : -montoTotalAcumulado;
      await updateDoc(refCliente, { deudaTotal: increment(ajuste) });

      const nuevaDeudaTotal = (cliente.deudaTotal || 0) + ajuste;

      // Preparar enlace de WhatsApp semimanual
      const celularLimpio = cliente.celular ? cliente.celular.replace(/\D/g, '') : '';
      const textoDetalle = descripcionesResumen.join(", ");
      const mensajeTexto = `Hola ${cliente.nombre}, te escribimos de Gases Cachaco. 🧾 Registro de ${accionGlobal === 'fiado' ? 'Fiado' : 'Abono'}: ${textoDetalle}. Tu saldo pendiente total es de: $${nuevaDeudaTotal.toLocaleString('es-CO')}. ¡Gracias por tu preferencia!`;
      
      const linkWp = `https://api.whatsapp.com/send?phone=57${celularLimpio}&text=${encodeURIComponent(mensajeTexto)}`;

      setWhatsappLink(linkWp);
      setWhatsappClienteNombre(cliente.nombre);

      // Limpiar estados de transacción
      setAccionGlobal(null);
      setBuscandoClienteParaAccion(false);
      setFilasTransaccion([{ descripcion: "", valor: "" }]);
      setBusqueda("");
      cargarClientes();

    } catch (error) {
      console.error("Error en transacción:", error);
      alert("Hubo un error al procesar la operación.");
    }
  };

  // --- CREAR CLIENTE NUEVO RÁPIDO ---
  const guardarClienteNuevoRapido = async () => {
    if (!nombreNuevo.trim() || !celularNuevo.trim()) {
      alert("Por favor, llena el nombre y el celular.");
      return;
    }
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), {
        nombre: nombreNuevo.trim(),
        celular: celularNuevo.trim(),
        deudaTotal: 0,
        fecha_creacion: new Date()
      });

      const nuevoClienteObj = {
        id: docRef.id,
        nombre: nombreNuevo.trim(),
        celular: celularNuevo.trim(),
        deudaTotal: 0
      };

      setModalNuevoCliente(false);
      setNombreNuevo(""); setCelularNuevo("");
      await cargarClientes();

      // Aplicar transacción al cliente recién creado
      await seleccionarClienteParaTransaccion(nuevoClienteObj);

    } catch (error) {
      console.error("Error al crear cliente:", error);
      alert("Error al guardar el cliente.");
    } finally {
      setGuardandoCliente(false);
    }
  };

  return (
    <main className="flex flex-col gap-6 py-4 relative max-w-4xl mx-auto px-4">
      
      {/* SECCIÓN 1: BUSCADOR SIEMPRE DISPONIBLE */}
      <section className="relative z-20">
        <input 
          type="text" 
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar cliente registrado..." 
          className="w-full text-xl p-4 border-2 border-gray-300 rounded-2xl focus:border-blue-500 outline-none shadow-sm bg-white"
        />

        {/* Lista desplegable al buscar */}
        {busqueda.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-200 rounded-2xl mt-1 shadow-2xl max-h-72 overflow-y-auto z-30">
            {clientesFiltrados.length > 0 ? (
              clientesFiltrados.map((cliente) => (
                <div 
                  key={cliente.id} 
                  onClick={() => {
                    setClienteActivo(cliente);
                    cargarMovimientos(cliente.id);
                    setBusqueda(""); 
                  }}
                  className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                >
                  <span className="font-bold text-gray-800 text-lg">{cliente.nombre}</span>
                  <span className={`font-bold ${cliente.deudaTotal > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    ${(cliente.deudaTotal || 0).toLocaleString('es-CO')}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500">
                <p className="mb-2">No se encontró el cliente.</p>
                <button 
                  onClick={() => setModalNuevoCliente(true)}
                  className="bg-blue-600 text-white font-bold py-2 px-4 rounded-xl text-sm"
                >
                  + Crear Cliente Nuevo
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECCIÓN 2: BOTONES PRINCIPALES (FIAR / ABONAR) */}
      <section className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => {
            setAccionGlobal('fiado');
            setBuscandoClienteParaAccion(true);
            setFilasTransaccion([{ descripcion: "", valor: "" }]);
          }}
          className="bg-red-500 hover:bg-red-600 text-white font-black text-3xl py-10 rounded-3xl shadow-lg flex items-center justify-center transition-transform transform active:scale-95"
        >
          FIAR
        </button>
        
        <button 
          onClick={() => {
            setAccionGlobal('abono');
            setBuscandoClienteParaAccion(true);
            setFilasTransaccion([{ descripcion: "", valor: "" }]);
          }}
          className="bg-green-500 hover:bg-green-600 text-white font-black text-3xl py-10 rounded-3xl shadow-lg flex items-center justify-center transition-transform transform active:scale-95"
        >
          ABONAR
        </button>
      </section>

      {/* SECCIÓN 3: DIRECTORIO DE CLIENTES */}
      <button 
        onClick={() => setVerTodosClientes(true)}
        className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-lg py-4 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2"
      >
        👥 Ver Lista de Clientes Registrados
      </button>

      {/* MODAL / FLUJO DE FILAS MÚLTIPLES Y SELECCIÓN DE CLIENTE */}
      {accionGlobal && buscandoClienteParaAccion && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            
            <div className={`p-6 text-white flex justify-between items-center ${accionGlobal === 'fiado' ? 'bg-red-500' : 'bg-green-500'}`}>
              <h2 className="text-2xl font-black uppercase">
                {accionGlobal === 'fiado' ? '📝 Registrar Fiado (Múltiples ítems)' : '💰 Registrar Abono (Múltiples pagos)'}
              </h2>
              <button onClick={() => setAccionGlobal(null)} className="text-white text-3xl font-bold hover:opacity-80">✕</button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              
              {/* GRILLA DE FILAS (Descripción y Valor al frente) */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-gray-700">Ingresa los conceptos y sus valores:</p>
                  <button 
                    onClick={agregarFila}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded-xl shadow-xs"
                  >
                    + Añadir otra fila
                  </button>
                </div>

                {filasTransaccion.map((fila, index) => (
                  <div key={index} className="flex gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-200">
                    <input 
                      type="text" 
                      value={fila.descripcion}
                      onChange={(e) => actualizarFila(index, 'descripcion', e.target.value)}
                      placeholder={accionGlobal === 'fiado' ? "Descripción (Ej. Cilindro gas)" : "Descripción (Ej. Efectivo)"}
                      className="flex-2 p-3 bg-white border border-gray-300 rounded-xl outline-none text-sm"
                    />
                    <input 
                      type="number" 
                      value={fila.valor}
                      onChange={(e) => actualizarFila(index, 'valor', e.target.value)}
                      placeholder="Valor ($)"
                      className="flex-1 p-3 bg-white border border-gray-300 rounded-xl outline-none text-sm font-bold text-gray-800"
                    />
                    {filasTransaccion.length > 1 && (
                      <button 
                        onClick={() => eliminarFila(index)}
                        className="text-red-500 hover:text-red-700 font-bold p-2 text-xl"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex justify-between items-center px-2 pt-2 border-t font-black text-lg">
                  <span className="text-gray-700">Total general:</span>
                  <span className={accionGlobal === 'fiado' ? 'text-red-600 text-2xl' : 'text-green-600 text-2xl'}>
                    ${totalFilas.toLocaleString('es-CO')}
                  </span>
                </div>
              </div>

              <hr className="my-2" />

              {/* SELECCIONAR CLIENTE PARA APLICAR */}
              <div>
                <h3 className="font-bold text-gray-800 mb-2">Selecciona al cliente:</h3>
                <input 
                  type="text" 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="🔍 Buscar cliente..." 
                  className="w-full p-3 border-2 border-gray-300 rounded-xl outline-none mb-3 text-lg"
                />

                <div className="max-h-48 overflow-y-auto flex flex-col gap-2">
                  {clientesFiltrados.map(cliente => (
                    <div 
                      key={cliente.id}
                      onClick={() => seleccionarClienteParaTransaccion(cliente)}
                      className="p-3 bg-gray-50 hover:bg-blue-50 border rounded-xl cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <span className="font-bold text-gray-800">{cliente.nombre}</span>
                      <span className="text-sm text-gray-500">Deuda: ${(cliente.deudaTotal || 0).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                  {clientesFiltrados.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-500 mb-2">No se encontró el cliente.</p>
                      <button 
                        onClick={() => setModalNuevoCliente(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-sm"
                      >
                        + Crear Cliente Nuevo
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPARTIR POR WHATSAPP SEMIMANUAL */}
      {whatsappLink && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl text-center flex flex-col gap-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto font-bold">
              ✓
            </div>
            <h3 className="text-2xl font-black text-gray-900">¡Transacción Guardada!</h3>
            <p className="text-gray-600 text-sm">
              El registro para <span className="font-bold">{whatsappClienteNombre}</span> se guardó correctamente en la base de datos.
            </p>
            <p className="text-gray-500 text-xs">
              Haz clic en el botón inferior para abrir WhatsApp y enviar el comprobante de cuenta manualmente:
            </p>

            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setWhatsappLink(null)}
              className="bg-green-500 hover:bg-green-600 text-white font-bold text-lg py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-colors mt-2"
            >
              💬 Enviar comprobante por WhatsApp
            </a>

            <button 
              onClick={() => setWhatsappLink(null)}
              className="text-gray-400 hover:text-gray-600 font-bold text-sm mt-1"
            >
              Cerrar (Omitir)
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CREAR CLIENTE NUEVO */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-blue-900 mb-4">Registrar Cliente Nuevo</h3>
            <div className="flex flex-col gap-4 mb-4">
              <input type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Nombre completo" className="p-3 border border-gray-300 rounded-xl outline-none" />
              <input type="tel" value={celularNuevo} onChange={(e) => setCelularNuevo(e.target.value)} placeholder="Celular" className="p-3 border border-gray-300 rounded-xl outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModalNuevoCliente(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 font-bold py-3 rounded-xl">Cancelar</button>
              <button onClick={guardarClienteNuevoRapido} disabled={guardandoCliente} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:bg-blue-400">
                {guardandoCliente ? 'Guardando...' : 'Guardar y Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VER TODOS LOS CLIENTES (DIRECTORIO) */}
      {verTodosClientes && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center p-4 z-40 overflow-y-auto pt-10">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative">
            <div className="bg-gray-800 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Directorio de Clientes</h2>
              <button onClick={() => setVerTodosClientes(false)} className="text-white text-3xl hover:text-gray-300">✕</button>
            </div>
            <div className="p-0 max-h-[70vh] overflow-y-auto">
              {clientes.length === 0 ? (
                <p className="p-8 text-center text-gray-500 text-lg">No hay clientes registrados aún.</p>
              ) : (
                clientes.map(c => (
                  <div key={c.id} 
                    onClick={() => { setClienteActivo(c); cargarMovimientos(c.id); setVerTodosClientes(false); }}
                    className="p-5 border-b border-gray-200 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-xl text-gray-900">{c.nombre}</p>
                      <p className="text-gray-500">{c.celular}</p>
                    </div>
                    <p className={`font-black text-2xl ${c.deudaTotal > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      ${(c.deudaTotal || 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL DEL CLIENTE Y SU HISTORIAL */}
      {clienteActivo && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center p-4 z-50 overflow-y-auto pt-10">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col">
            <div className="bg-blue-50 p-6 rounded-t-3xl border-b border-blue-100 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black text-gray-900">{clienteActivo.nombre}</h2>
                <p className="text-gray-500 mt-1">{clienteActivo.celular}</p>
              </div>
              <button onClick={() => setClienteActivo(null)} className="text-gray-400 hover:text-gray-800 text-3xl font-bold">✕</button>
            </div>

            <div className="p-6 text-center border-b border-gray-100">
              <p className="text-gray-500 font-bold mb-1">DEUDA TOTAL</p>
              <p className={`text-5xl font-black ${(clienteActivo.deudaTotal || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${(clienteActivo.deudaTotal || 0).toLocaleString('es-CO')}
              </p>
            </div>

            <div className="p-6 bg-gray-50 flex-1 overflow-y-auto max-h-80 rounded-b-3xl">
              <h3 className="font-bold text-gray-800 mb-4 text-lg">Historial de Movimientos</h3>
              {movimientos.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay registros para este cliente.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {movimientos.map(mov => (
                    <div key={mov.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900">{mov.descripcion}</p>
                        <p className="text-sm text-gray-500">{mov.fecha?.toDate().toLocaleDateString('es-CO')} - {mov.fecha?.toDate().toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <p className={`font-black text-xl ${mov.tipo === 'fiado' ? 'text-red-500' : 'text-green-600'}`}>
                        {mov.tipo === 'fiado' ? '-' : '+'}${mov.monto.toLocaleString('es-CO')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </main>
  );
}