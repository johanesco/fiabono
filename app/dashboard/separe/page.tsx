"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, getDocs, query, where, Timestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../../firebase";
import { 
  Camera, X, Plus, Minus, ArrowLeft, Bookmark, Calendar, 
  MessageCircle, CheckCircle2, Search, User, ChevronRight, 
  Tag, AlertCircle, Printer, Image as ImageIcon, Banknote, 
  Smartphone, CreditCard, Zap, Trash2, UserCog, RotateCcw, 
  Upload, Package, Store, Check, FileText, Percent, Eye,
  QrCode, Receipt
} from 'lucide-react';
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/AuthContext";
import TicketFacturaModal, { DatosFacturaProps } from "@/components/TicketFacturaModal";
import { Html5Qrcode } from "html5-qrcode";

export default function SeparePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Cargando módulo de plan separe...</div>}>
      <SepareContenido />
    </Suspense>
  );
}

function SepareContenido() {
  const { datosSesion } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const cuentaPrincipalId = datosSesion?.cuentaPrincipalId;
  const nombreUsuario = datosSesion?.nombreUsuario || "Vendedor";
  const nombreNegocio = datosSesion?.nombreNegocio || "Mi Negocio";
  const esAdmin = datosSesion?.tipoUsuario === 'principal';
  const puedeVentaDirecta = esAdmin || (datosSesion?.puedeVentaDirecta === true);
  const puedeModificarPrecios = esAdmin || (datosSesion?.permisos?.modificarPrecios === true) || (datosSesion?.permisos?.editarInventario === true);
  const puedeAplicarDescuentos = esAdmin || (datosSesion?.permisos?.aplicarDescuentos === true);
  const puedeGestionarSepares = esAdmin || (datosSesion?.permisos?.abonar === true);

  const [listaVendedores, setListaVendedores] = useState<string[]>([]);
  const [vendedorActivo, setVendedorActivo] = useState<string>(nombreUsuario || "Vendedor");
  const [modalNuevoVendedor, setModalNuevoVendedor] = useState(false);
  const [nombreNuevoVendedor, setNombreNuevoVendedor] = useState("");
  const esTerminalMultivendedor: boolean = datosSesion?.esTerminalMultivendedor ?? false;

  const registrarVendedorRapido = () => {
    const nombreLimpio = nombreNuevoVendedor.trim();
    if (!nombreLimpio) return;
    if (!listaVendedores.includes(nombreLimpio)) {
      const actualizada = [...listaVendedores, nombreLimpio];
      setListaVendedores(actualizada);
      try {
        localStorage.setItem(`fiabono_vendedores_${cuentaPrincipalId || 'local'}`, JSON.stringify(actualizada));
      } catch (e) {}
    }
    setVendedorActivo(nombreLimpio);
    setNombreNuevoVendedor("");
    setModalNuevoVendedor(false);
    toast.success(`Vendedor "${nombreLimpio}" seleccionado`);
  };

  // Cargar colaboradores registrados en Firebase y locales
  useEffect(() => {
    if (!cuentaPrincipalId) return;

    const cargarVendedores = async () => {
      try {
        const nombres: string[] = [];
        if (nombreUsuario) nombres.push(nombreUsuario);

        // 1. Consultar colaboradores creados en Perfil (adminId == cuentaPrincipalId)
        try {
          const qAdmin = query(collection(db, "usuarios"), where("adminId", "==", cuentaPrincipalId));
          const snapAdmin = await getDocs(qAdmin);
          snapAdmin.forEach(d => {
            const u = d.data();
            const nom = u.nombreUsuario || u.nombre || u.nombreColaborador;
            if (nom && !nombres.includes(nom)) {
              nombres.push(nom);
            }
          });
        } catch (e) {}

        // 2. Consultar usuarios donde cuentaPrincipalId == cuentaPrincipalId
        try {
          const qUsers = query(collection(db, "usuarios"), where("cuentaPrincipalId", "==", cuentaPrincipalId));
          const snapU = await getDocs(qUsers);
          snapU.forEach(d => {
            const u = d.data();
            const nom = u.nombreUsuario || u.nombre || u.nombreColaborador;
            if (nom && !nombres.includes(nom)) {
              nombres.push(nom);
            }
          });
        } catch (e) {}

        // 3. Vendedores guardados en localStorage
        const guardadosLocales = localStorage.getItem(`fiabono_vendedores_${cuentaPrincipalId || 'local'}`) || localStorage.getItem('fiabono_vendedores_rapidos');
        if (guardadosLocales) {
          try {
            const parseados: string[] = JSON.parse(guardadosLocales);
            if (Array.isArray(parseados)) {
              parseados.forEach(n => {
                if (n && !nombres.includes(n)) nombres.push(n);
              });
            }
          } catch (e) {}
        }

        setListaVendedores(nombres.length > 0 ? nombres : [nombreUsuario || "Vendedor"]);
      } catch (e) {
        console.error("Error al cargar vendedores:", e);
      }
    };

    cargarVendedores();
  }, [cuentaPrincipalId, nombreUsuario]);

  const scrollArticulosRef = useRef<HTMLDivElement | null>(null);

  // Escáner de Código de Barras / QR
  const [modalEscanner, setModalEscanner] = useState(false);
  const html5QrCodeRef = useRef<any>(null);
  const [camaraIniciada, setCamaraIniciada] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [flashExito, setFlashExito] = useState(false);
  const [mensajeScaneo, setMensajeScaneo] = useState<{ texto: string; tipo: 'exito' | 'error' } | null>(null);
  const [ultimoProductoEscaneado, setUltimoProductoEscaneado] = useState<{ nombre: string; precio: number; cantidad: number } | null>(null);
  const ultimoScanRef = useRef<{ sku: string; timestamp: number } | null>(null);

  // Clientes
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [mostrarResultadosCliente, setMostrarResultadosCliente] = useState(false);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [celularNuevo, setCelularNuevo] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Inventario de la base de datos
  const [inventario, setInventario] = useState<any[]>([]);
  const [busquedaProductoIndex, setBusquedaProductoIndex] = useState<number | null>(null);

  // Filas de productos separados
  interface FilaProductoSepare {
    id: string;
    descripcion: string;
    valor: string;
    cantidad: number;
    fotoUrl?: string | null;
    esDeInventario?: boolean;
    idProducto?: string | null;
  }

  // Estructura de Pestañas Multi-Separe en Vivo
  interface PestanaSepare {
    id: string;
    nombre: string;
    vendedor: string;
    filas: FilaProductoSepare[];
    cliente: any | null;
    descuentoTipo: 'porcentaje' | 'fijo' | null;
    descuentoValor: string;
    fechaLimite: string;
    notas: string;
    abonoInicial: string;
    metodoPago: 'efectivo' | 'transferencia' | 'datafono' | 'credito_externo';
    subMetodoPago: string;
    referenciaPago: string;
  }

  const [pestanas, setPestanas] = useState<PestanaSepare[]>([
    {
      id: '1',
      nombre: 'Separe #1',
      vendedor: nombreUsuario || 'Vendedor',
      filas: [{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }],
      cliente: null,
      descuentoTipo: null,
      descuentoValor: "",
      fechaLimite: "",
      notas: "",
      abonoInicial: "",
      metodoPago: 'efectivo',
      subMetodoPago: "",
      referenciaPago: ""
    }
  ]);
  const [pestanaActivaId, setPestanaActivaId] = useState<string>('1');

  // Estados del Formulario Activo
  const [filas, setFilas] = useState<FilaProductoSepare[]>([
    { id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }
  ]);
  const [descuentoTipo, setDescuentoTipo] = useState<'porcentaje' | 'fijo' | null>(null);
  const [descuentoValor, setDescuentoValor] = useState<string>("");
  const [mostrarModalDescuento, setMostrarModalDescuento] = useState(false);
  const [fechaLimite, setFechaLimite] = useState<string>("");
  const [notas, setNotas] = useState<string>("");
  const [abonoInicial, setAbonoInicial] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'datafono' | 'credito_externo'>('efectivo');
  const [subMetodoPago, setSubMetodoPago] = useState("");
  const [referenciaPago, setReferenciaPago] = useState("");

  // Clave de almacenamiento dinámico por usuario/vendedor para separes
  const getStorageKey = (vendedor: string) => {
    const vLimpio = (vendedor || nombreUsuario || "vendedor").toLowerCase().replace(/\s+/g, '_');
    return `fiabono_draft_separes_${cuentaPrincipalId || 'local'}_${vLimpio}`;
  };

  const persistirPestanas = (nuevasPestanas: PestanaSepare[], vendedor: string = vendedorActivo) => {
    try {
      const key = getStorageKey(vendedor);
      localStorage.setItem(key, JSON.stringify(nuevasPestanas));
    } catch (e) {}
  };

  // Cargar pestañas iniciales desde LocalStorage para el vendedor activo
  useEffect(() => {
    if (!vendedorActivo) return;
    try {
      // 1. Revisar si hay productos precargados desde inventario
      const precarga = sessionStorage.getItem('fiabono_productos_precargados');
      let itemsPrecargados: any[] | null = null;
      if (precarga) {
        try {
          const parsedPrecarga = JSON.parse(precarga);
          if (Array.isArray(parsedPrecarga) && parsedPrecarga.length > 0) {
            itemsPrecargados = parsedPrecarga;
          }
        } catch (e) {}
        sessionStorage.removeItem('fiabono_productos_precargados');
      }

      const key = getStorageKey(vendedorActivo);
      const dataGuardada = localStorage.getItem(key);
      let listaPestanas: PestanaSepare[] = [];

      if (dataGuardada) {
        try {
          const parsed = JSON.parse(dataGuardada);
          if (Array.isArray(parsed) && parsed.length > 0) {
            listaPestanas = parsed;
          }
        } catch (e) {}
      }

      if (listaPestanas.length === 0) {
        listaPestanas = [{
          id: '1',
          nombre: 'Separe #1',
          vendedor: vendedorActivo,
          filas: [{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }],
          cliente: null,
          descuentoTipo: null,
          descuentoValor: "",
          fechaLimite: "",
          notas: "",
          abonoInicial: "",
          metodoPago: 'efectivo',
          subMetodoPago: "",
          referenciaPago: ""
        }];
      }

      if (itemsPrecargados && itemsPrecargados.length > 0) {
        const nuevasFilasPrecarga: FilaProductoSepare[] = itemsPrecargados.map((it: any, idx: number) => ({
          id: String(Date.now() + idx),
          descripcion: it.descripcion || "",
          valor: it.valor ? String(it.valor).replace(/\D/g, "") : "",
          cantidad: Number(it.cantidad) || 1,
          fotoUrl: null,
          esDeInventario: true,
          idProducto: it.idProducto || null
        }));

        const pestanaInicial: PestanaSepare = {
          ...listaPestanas[0],
          filas: nuevasFilasPrecarga
        };
        const actualizadas = [pestanaInicial, ...listaPestanas.slice(1)];
        setPestanas(actualizadas);
        setPestanaActivaId(pestanaInicial.id);
        cargarDatosDePestana(pestanaInicial);
        persistirPestanas(actualizadas, vendedorActivo);
        toast.success(`Se cargaron ${nuevasFilasPrecarga.length} producto(s) desde el inventario.`);
      } else {
        setPestanas(listaPestanas);
        setPestanaActivaId(listaPestanas[0].id);
        cargarDatosDePestana(listaPestanas[0]);
      }
    } catch (e) {
      console.error("Error al cargar borrador de separes:", e);
    }
  }, [vendedorActivo, cuentaPrincipalId]);

  // Sincronizar en tiempo real cada cambio del formulario al estado de pestañas y localStorage
  useEffect(() => {
    setPestanas(prev => {
      const actualizadas = prev.map(p => {
        if (p.id === pestanaActivaId) {
          return {
            ...p,
            vendedor: vendedorActivo,
            filas: filas,
            cliente: clienteSeleccionado,
            descuentoTipo: descuentoTipo,
            descuentoValor: descuentoValor,
            fechaLimite: fechaLimite,
            notas: notas,
            abonoInicial: abonoInicial,
            metodoPago: metodoPago,
            subMetodoPago: subMetodoPago,
            referenciaPago: referenciaPago,
            nombre: p.nombre.startsWith('Separe #') && clienteSeleccionado?.nombre ? clienteSeleccionado.nombre : p.nombre
          };
        }
        return p;
      });
      persistirPestanas(actualizadas, vendedorActivo);
      return actualizadas;
    });
  }, [
    filas,
    clienteSeleccionado,
    descuentoTipo,
    descuentoValor,
    fechaLimite,
    notas,
    abonoInicial,
    metodoPago,
    subMetodoPago,
    referenciaPago,
    vendedorActivo,
    pestanaActivaId
  ]);

  // Sincronizar estado actual a la pestaña activa antes de cambiar
  const guardarEstadoEnPestanaActiva = (idActual: string = pestanaActivaId) => {
    setPestanas(prev => {
      const actualizadas = prev.map(p => {
        if (p.id === idActual) {
          return {
            ...p,
            vendedor: vendedorActivo,
            filas: filas,
            cliente: clienteSeleccionado,
            descuentoTipo: descuentoTipo,
            descuentoValor: descuentoValor,
            fechaLimite: fechaLimite,
            notas: notas,
            abonoInicial: abonoInicial,
            metodoPago: metodoPago,
            subMetodoPago: subMetodoPago,
            referenciaPago: referenciaPago,
            nombre: p.nombre.startsWith('Separe #') && clienteSeleccionado?.nombre ? clienteSeleccionado.nombre : p.nombre
          };
        }
        return p;
      });
      persistirPestanas(actualizadas, vendedorActivo);
      return actualizadas;
    });
  };

  // Cargar datos de una pestaña en el formulario
  const cargarDatosDePestana = (p: PestanaSepare) => {
    setVendedorActivo(p.vendedor || nombreUsuario || "Vendedor");
    setFilas(p.filas?.length > 0 ? p.filas : [{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }]);
    setClienteSeleccionado(p.cliente || null);
    setDescuentoTipo(p.descuentoTipo || null);
    setDescuentoValor(p.descuentoValor || "");
    setFechaLimite(p.fechaLimite || "");
    setNotas(p.notas || "");
    setAbonoInicial(p.abonoInicial || "");
    setMetodoPago(p.metodoPago || 'efectivo');
    setSubMetodoPago(p.subMetodoPago || "");
    setReferenciaPago(p.referenciaPago || "");
  };

  // Cambiar de pestaña
  const cambiarPestana = (idDestino: string) => {
    if (idDestino === pestanaActivaId) return;
    guardarEstadoEnPestanaActiva(pestanaActivaId);
    const destino = pestanas.find(p => p.id === idDestino);
    if (destino) {
      cargarDatosDePestana(destino);
      setPestanaActivaId(idDestino);
    }
  };

  // Cambiar vendedor con aislamiento de pestañas
  const cambiarVendedor = (nuevoVendedor: string) => {
    if (nuevoVendedor === vendedorActivo) return;

    // 1. Guardar estado actual del vendedor que sale
    const pestanasActualizadas = pestanas.map(p => {
      if (p.id === pestanaActivaId) {
        return {
          ...p,
          vendedor: vendedorActivo,
          filas: filas,
          cliente: clienteSeleccionado,
          descuentoTipo: descuentoTipo,
          descuentoValor: descuentoValor,
          fechaLimite: fechaLimite,
          notas: notas,
          abonoInicial: abonoInicial,
          metodoPago: metodoPago,
          subMetodoPago: subMetodoPago,
          referenciaPago: referenciaPago,
          nombre: p.nombre.startsWith('Separe #') && clienteSeleccionado?.nombre ? clienteSeleccionado.nombre : p.nombre
        };
      }
      return p;
    });
    persistirPestanas(pestanasActualizadas, vendedorActivo);

    // 2. Cambiar a nuevo vendedor
    setVendedorActivo(nuevoVendedor);

    // 3. Cargar datos del nuevo vendedor
    try {
      const key = getStorageKey(nuevoVendedor);
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPestanas(parsed);
          setPestanaActivaId(parsed[0].id);
          cargarDatosDePestana(parsed[0]);
          return;
        }
      }
    } catch (e) {}

    // Si no tiene datos previos, inicializar 1 pestaña
    const inicial: PestanaSepare = {
      id: '1',
      nombre: 'Separe #1',
      vendedor: nuevoVendedor,
      filas: [{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }],
      cliente: null,
      descuentoTipo: null,
      descuentoValor: "",
      fechaLimite: "",
      notas: "",
      abonoInicial: "",
      metodoPago: 'efectivo',
      subMetodoPago: "",
      referenciaPago: ""
    };
    setPestanas([inicial]);
    setPestanaActivaId('1');
    cargarDatosDePestana(inicial);
    persistirPestanas([inicial], nuevoVendedor);
  };

  // Crear nueva pestaña
  const crearNuevaPestana = (nombreOpcional?: string) => {
    guardarEstadoEnPestanaActiva(pestanaActivaId);
    const nuevoId = Date.now().toString();
    const nueva: PestanaSepare = {
      id: nuevoId,
      nombre: nombreOpcional || `Separe #${pestanas.length + 1}`,
      vendedor: vendedorActivo || nombreUsuario || "Vendedor",
      filas: [{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }],
      cliente: null,
      descuentoTipo: null,
      descuentoValor: "",
      fechaLimite: "",
      notas: "",
      abonoInicial: "",
      metodoPago: 'efectivo',
      subMetodoPago: "",
      referenciaPago: ""
    };
    const nuevas = [...pestanas, nueva];
    setPestanas(nuevas);
    persistirPestanas(nuevas, vendedorActivo);
    cargarDatosDePestana(nueva);
    setPestanaActivaId(nuevoId);
  };

  // Cerrar pestaña
  const cerrarPestana = (idACerrar: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (pestanas.length <= 1) {
      // Si es la única pestaña, resetearla limpia
      const reseteada: PestanaSepare = {
        id: '1',
        nombre: 'Separe #1',
        vendedor: vendedorActivo,
        filas: [{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }],
        cliente: null,
        descuentoTipo: null,
        descuentoValor: "",
        fechaLimite: "",
        notas: "",
        abonoInicial: "",
        metodoPago: 'efectivo',
        subMetodoPago: "",
        referenciaPago: ""
      };
      setPestanas([reseteada]);
      setPestanaActivaId('1');
      cargarDatosDePestana(reseteada);
      persistirPestanas([reseteada], vendedorActivo);
      return;
    }

    const restantes = pestanas.filter(p => p.id !== idACerrar);
    setPestanas(restantes);
    persistirPestanas(restantes, vendedorActivo);

    if (pestanaActivaId === idACerrar) {
      const nuevaActiva = restantes[restantes.length - 1];
      setPestanaActivaId(nuevaActiva.id);
      cargarDatosDePestana(nuevaActiva);
    }
  };

  // Renombrar pestaña
  const renombrarPestana = (id: string, nuevoNombre: string) => {
    setPestanas(prev => {
      const actualizadas = prev.map(p => p.id === id ? { ...p, nombre: nuevoNombre.trim() || p.nombre } : p);
      persistirPestanas(actualizadas, vendedorActivo);
      return actualizadas;
    });
  };

  // Lightbox de Fotos
  const [fotoLightbox, setFotoLightbox] = useState<string | null>(null);

  // Carga y Modales de Éxito / Ticket
  const [guardando, setGuardando] = useState(false);
  const [modalExito, setModalExito] = useState<{
    visible: boolean;
    separe: any;
    ticketDatos?: DatosFacturaProps;
    esOrdenPendiente?: boolean;
  } | null>(null);
  const [modalTicketFactura, setModalTicketFactura] = useState<{ visible: boolean; datos: DatosFacturaProps | null }>({
    visible: false,
    datos: null
  });

  // Modal de Cámara en Vivo
  const [modalCamaraEnVivo, setModalCamaraEnVivo] = useState(false);
  const [filaParaFoto, setFilaParaFoto] = useState<number | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [iniciandoCamara, setIniciandoCamara] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar Clientes e Inventario
  useEffect(() => {
    if (cuentaPrincipalId) {
      cargarClientes(cuentaPrincipalId);
      cargarInventario(cuentaPrincipalId);
    }
  }, [cuentaPrincipalId]);

  const cargarClientes = async (uid: string) => {
    try {
      const q = query(collection(db, "clientes"), where("usuarioId", "==", uid));
      const snap = await getDocs(q);
      const lista: any[] = [];
      snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setClientes(lista);

      const clienteParamId = searchParams.get('clienteId');
      if (clienteParamId) {
        const encontrado = lista.find(c => c.id === clienteParamId);
        if (encontrado) setClienteSeleccionado(encontrado);
      }
    } catch (e) {
      console.error("Error cargando clientes:", e);
    }
  };

  const cargarInventario = async (uid: string) => {
    try {
      const q = query(collection(db, "inventario"), where("usuarioId", "==", uid));
      const snap = await getDocs(q);
      const lista: any[] = [];
      snap.forEach((docSnap) => {
        lista.push({ id: docSnap.id, ...docSnap.data() });
      });
      setInventario(lista);
    } catch (e) {
      console.error("Error cargando inventario:", e);
    }
  };

  // Crear cliente rápido
  const guardarNuevoCliente = async () => {
    if (!nombreNuevo.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    setGuardandoCliente(true);
    try {
      const docRef = await addDoc(collection(db, "clientes"), {
        nombre: nombreNuevo.trim(),
        celular: celularNuevo.trim(),
        deudaTotal: 0,
        usuarioId: cuentaPrincipalId,
        fecha_creacion: new Date()
      });
      const nuevo = {
        id: docRef.id,
        nombre: nombreNuevo.trim(),
        celular: celularNuevo.trim(),
        deudaTotal: 0,
        usuarioId: cuentaPrincipalId
      };
      setClientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setClienteSeleccionado(nuevo);
      setModalNuevoCliente(false);
      setNombreNuevo("");
      setCelularNuevo("");
      toast.success("Cliente registrado con éxito");
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar cliente");
    } finally {
      setGuardandoCliente(false);
    }
  };

  // Referencias para auto-focus inteligente en filas
  const inputsDescripcionRef = useRef<(HTMLInputElement | null)[]>([]);

  // Ordenamiento inteligente de sugerencias de inventario (Prioridad: Inicia con > Palabra inicia con > Contiene)
  const ordenarProductosSugeridos = (lista: any[], queryText: string) => {
    const q = queryText.trim().toLowerCase();
    if (!q) return [];
    return lista.filter(p => {
      const n = (p.nombre || "").toLowerCase();
      const s = (p.sku || "").toLowerCase();
      const c = (p.codigo || "").toLowerCase();
      return n.includes(q) || s.includes(q) || c.includes(q);
    }).sort((a, b) => {
      const aName = (a.nombre || "").toLowerCase();
      const bName = (b.nombre || "").toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      const aWordStarts = aName.split(/\s+/).some((w: string) => w.startsWith(q));
      const bWordStarts = bName.split(/\s+/).some((w: string) => w.startsWith(q));
      if (aWordStarts && !bWordStarts) return -1;
      if (!aWordStarts && bWordStarts) return 1;
      return aName.localeCompare(bName);
    }).slice(0, 8);
  };

  // Gestión de filas con Enter Inteligente y autofocus
  const agregarFila = () => {
    setFilas(prev => {
      const nuevoIndex = prev.length;
      const nueva = [
        ...prev,
        { id: Date.now().toString(), descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }
      ];
      setBusquedaProductoIndex(nuevoIndex);
      setTimeout(() => {
        inputsDescripcionRef.current[nuevoIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        inputsDescripcionRef.current[nuevoIndex]?.focus();
      }, 80);
      return nueva;
    });
  };

  const eliminarFila = (index: number) => {
    if (filas.length <= 1) {
      setFilas([{ id: "1", descripcion: "", valor: "", cantidad: 1, fotoUrl: null, esDeInventario: false }]);
      return;
    }
    setFilas(prev => prev.filter((_, i) => i !== index));
  };

  const actualizarFila = (index: number, campo: keyof FilaProductoSepare, valor: any) => {
    setFilas(prev => {
      const copia = [...prev];
      if (campo === 'valor') {
        copia[index] = { ...copia[index], valor: valor.replace(/\D/g, '') };
      } else {
        copia[index] = { ...copia[index], [campo]: valor };
      }
      return copia;
    });
  };

  const actualizarCantidadFila = (index: number, delta: number) => {
    const filaActual = filas[index];
    const nuevaCant = filaActual.cantidad + delta;
    if (nuevaCant < 1) return;

    if (filaActual.descripcion.trim() !== "") {
      const descLim = filaActual.descripcion.toLowerCase().trim();
      const productoEnInventario = inventario.find(p => 
        p.nombre.toLowerCase().trim() === descLim ||
        (p.sku && p.sku.toLowerCase().trim() === descLim) ||
        (p.codigo && p.codigo.toLowerCase().trim() === descLim)
      );
      const esInventariable = productoEnInventario && productoEnInventario.tipoProducto !== 'servicio' && productoEnInventario.inventariable !== false;
      
      if (esInventariable) {
        const cantidadEnOtrasFilas = filas.reduce((acc, f, i) => {
          const fDesc = f.descripcion.toLowerCase().trim();
          if (i !== index && (
            fDesc === productoEnInventario.nombre.toLowerCase().trim() ||
            (productoEnInventario.sku && fDesc === productoEnInventario.sku.toLowerCase().trim())
          )) {
            return acc + f.cantidad;
          }
          return acc;
        }, 0);

        const stockTotalPermitido = (productoEnInventario.stock || 0) - cantidadEnOtrasFilas;

        if (nuevaCant > stockTotalPermitido) {
          const totalYaEnLista = cantidadEnOtrasFilas + filaActual.cantidad;
          if (totalYaEnLista >= (productoEnInventario.stock || 0)) {
            toast.error(`⚠️ Ya tienes todas las unidades disponibles de "${productoEnInventario.nombre}" en tu lista (${productoEnInventario.stock || 0} en total).`, { position: 'bottom-center', icon: '🚫' });
          } else {
            toast.error(`⚠️ Solo puedes agregar ${Math.max(0, stockTotalPermitido - filaActual.cantidad)} unidad(es) más de "${productoEnInventario.nombre}".`, { position: 'bottom-center', icon: '🚫' });
          }
          return;
        }
      }
    }

    actualizarFila(index, 'cantidad', nuevaCant);
  };

  // Seleccionar producto del inventario y avanzar
  const seleccionarProductoInventario = (index: number, prod: any) => {
    const esInventariable = prod && prod.tipoProducto !== 'servicio' && prod.inventariable !== false;
    
    if (esInventariable) {
      const cantidadEnOtrasFilas = filas.reduce((acc, f, i) => {
        if (i !== index && f.descripcion.toLowerCase() === prod.nombre.toLowerCase()) {
          return acc + f.cantidad;
        }
        return acc;
      }, 0);

      const stockDisp = (prod.stock || 0) - cantidadEnOtrasFilas;

      if (stockDisp <= 0) {
        toast.error(`¡Sin stock disponible! Ya has seleccionado todo el stock (${prod.stock || 0}) de "${prod.nombre}".`);
        return;
      }
    }

    const precio = prod.precioVenta !== undefined ? prod.precioVenta : (prod.precio || 0);
    setFilas(prev => {
      const copia = [...prev];
      copia[index] = {
        ...copia[index],
        descripcion: prod.nombre,
        valor: precio.toString(),
        fotoUrl: prod.imagenUrl || prod.fotoUrl || copia[index].fotoUrl || null,
        esDeInventario: true
      };
      return copia;
    });
    setBusquedaProductoIndex(null);
    setTimeout(() => {
      agregarFila();
    }, 100);
  };

  // -------------------------------------------------------------
  // CÁMARA EN VIVO / CAPTURA REAL
  // -------------------------------------------------------------
  const abrirCamaraEnVivo = async (index: number) => {
    setFilaParaFoto(index);
    setIniciandoCamara(true);
    setModalCamaraEnVivo(true);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        setMediaStream(stream);
      } catch (err) {
        console.warn("No se pudo iniciar cámara en vivo directa, permitiendo archivo/captura:", err);
      } finally {
        setIniciandoCamara(false);
      }
    } else {
      setIniciandoCamara(false);
    }
  };

  // Vincular stream al elemento <video>
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(e => console.log("Play error:", e));
    }
  }, [mediaStream, modalCamaraEnVivo]);

  // Cambiar cámara frontal / trasera
  const alternarCamara = async () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    const nuevoModo = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nuevoModo);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nuevoModo }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setMediaStream(stream);
    } catch (e) {
      console.error("Error al cambiar cámara:", e);
    }
  };

  const [flashEfecto, setFlashEfecto] = useState(false);

  // Sonido de obturador de cámara Ultra-Satisfactorio (Mechanical Snap + Crystal Chime)
  const reproducirSonidoCamara = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Click de obturador rápido (2400Hz -> 300Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2400, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);
      gain1.gain.setValueAtTime(0.8, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.04);

      // Golpe mecánico secundario (950Hz -> 120Hz)
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(950, ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.05);
          gain2.gain.setValueAtTime(0.6, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.05);
        } catch (e) {}
      }, 30);

      // Chime cristalino de confirmación armónica
      setTimeout(() => {
        try {
          const osc3 = ctx.createOscillator();
          const gain3 = ctx.createGain();
          osc3.type = 'sine';
          osc3.frequency.setValueAtTime(1760, ctx.currentTime);
          osc3.frequency.exponentialRampToValueAtTime(2093, ctx.currentTime + 0.06);
          gain3.gain.setValueAtTime(0.35, ctx.currentTime);
          gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
          osc3.connect(gain3);
          gain3.connect(ctx.destination);
          osc3.start(ctx.currentTime);
          osc3.stop(ctx.currentTime + 0.06);
        } catch (e) {}
      }, 65);
    } catch (e) {
      console.log("Audio no disponible:", e);
    }
  };

  // Sonido de éxito al registrar Separe
  const reproducirSonidoExito = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notas = [523.25, 659.25, 783.99]; // C5, E5, G5
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.2);
      });
    } catch (e) {}
  };

  // Capturar foto del video en vivo
  const capturarFotoEnVivo = () => {
    if (!videoRef.current || filaParaFoto === null) return;
    reproducirSonidoCamara();
    setFlashEfecto(true);
    setTimeout(() => setFlashEfecto(false), 200);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 800;
    canvas.height = videoRef.current.videoHeight || 600;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      actualizarFila(filaParaFoto, 'fotoUrl', dataUrl);
      toast.success("Foto del producto capturada 📸");
    }

    cerrarCamara();
  };

  const cerrarCamara = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setModalCamaraEnVivo(false);
    setFilaParaFoto(null);
  };

  // Abrir selector de archivo fallback
  const activarArchivoFallback = (index: number) => {
    setFilaParaFoto(index);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const procesarFotoArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && filaParaFoto !== null) {
      reproducirSonidoCamara();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        actualizarFila(filaParaFoto, 'fotoUrl', dataUrl);
        toast.success("Foto adjuntada al artículo");
      };
      reader.readAsDataURL(file);
    }
  };

  // -------------------------------------------------------------
  // ESCÁNER DE CÓDIGO DE BARRAS / QR CON HTML5-QRCODE
  // -------------------------------------------------------------
  const abrirEscanner = () => {
    setErrorCamara(null);
    setCamaraIniciada(false);
    setModalEscanner(true);
  };

  const reproducirSonidoScan = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  const reproducirSonidoNoEncontrado = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      // Pulso 1: Tono medio descendente
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(360, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.1);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.1);

      // Pulso 2: Tono grave descendente
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(220, ctx.currentTime + 0.12);
      osc2.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.26);
      gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.26);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.26);
    } catch (e) {}
  };

  const manejarProductoScaneado = (codigoTexto: string) => {
    const texto = (codigoTexto || '').trim().toLowerCase();
    if (!texto) return;

    const ahora = Date.now();
    if (ultimoScanRef.current && ultimoScanRef.current.sku === texto && (ahora - ultimoScanRef.current.timestamp < 1200)) {
      return;
    }
    ultimoScanRef.current = { sku: texto, timestamp: ahora };

    const prod = inventario.find(p => 
      (p.sku && p.sku.toLowerCase() === texto) ||
      (p.codigo && p.codigo.toLowerCase() === texto) ||
      (p.nombre && p.nombre.toLowerCase() === texto)
    );

    if (prod) {
      const esInventariable = prod.tipoProducto !== 'servicio' && prod.inventariable !== false;
      const totalEnCarrito = filas.filter(f => f.descripcion.toLowerCase() === prod.nombre.toLowerCase()).reduce((acc, f) => acc + f.cantidad, 0);

      if (esInventariable && totalEnCarrito >= (prod.stock || 0)) {
        reproducirSonidoNoEncontrado();
        setMensajeScaneo({ texto: `⚠️ Sin stock disponible (${prod.stock || 0} máx) de "${prod.nombre}"`, tipo: 'error' });
        return;
      }

      reproducirSonidoScan();
      setFlashExito(true);

      const precioUnit = prod.precioVenta !== undefined ? prod.precioVenta : (prod.precio || 0);

      setFilas(prev => {
        const idxExistente = prev.findIndex(f => f.descripcion.toLowerCase() === prod.nombre.toLowerCase());
        if (idxExistente >= 0) {
          const copia = [...prev];
          copia[idxExistente].cantidad += 1;
          setUltimoProductoEscaneado({
            nombre: prod.nombre,
            precio: precioUnit,
            cantidad: copia[idxExistente].cantidad
          });
          return copia;
        }

        const idxVacia = prev.findIndex(f => !f.descripcion.trim() && !f.valor);
        const nuevaFila: FilaProductoSepare = {
          id: String(Date.now()),
          descripcion: prod.nombre,
          valor: String(precioUnit),
          cantidad: 1,
          fotoUrl: prod.imagenUrl || prod.fotoUrl || null,
          esDeInventario: true
        };

        setUltimoProductoEscaneado({
          nombre: prod.nombre,
          precio: precioUnit,
          cantidad: 1
        });

        if (idxVacia >= 0) {
          const copia = [...prev];
          copia[idxVacia] = nuevaFila;
          return copia;
        } else {
          return [...prev, nuevaFila];
        }
      });

      setMensajeScaneo({ texto: `+1 "${prod.nombre}"`, tipo: 'exito' });
      setTimeout(() => setMensajeScaneo(null), 2000);
    } else {
      reproducirSonidoNoEncontrado();
      setMensajeScaneo({ texto: `Código no reconocido: "${codigoTexto}"`, tipo: 'error' });
    }

    setModalEscanner(false);
  };

  useEffect(() => {
    if (!modalEscanner) return;

    let mounted = true;
    const scannerId = "qr-reader-separe";

    const iniciarCamara = async () => {
      try {
        const html5Qr = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5Qr;

        await html5Qr.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(edge * 0.75);
              return { width: size, height: size };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (mounted) {
              manejarProductoScaneado(decodedText);
            }
          },
          () => {}
        );

        if (mounted) {
          setCamaraIniciada(true);
        }
      } catch (err: any) {
        console.error("Error al iniciar cámara escáner:", err);
        if (mounted) {
          setErrorCamara(
            err?.message || "No se pudo acceder a la cámara. Por favor verifica los permisos en tu navegador."
          );
        }
      }
    };

    const timer = setTimeout(iniciarCamara, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().then(() => {
            html5QrCodeRef.current?.clear();
          }).catch((e: any) => console.error("Error al detener cámara escáner:", e));
        } else {
          try { html5QrCodeRef.current.clear(); } catch (e) {}
        }
      }
    };
  }, [modalEscanner]);

  // Limpieza total al desmontar para evitar que la luz de cámara quede activa
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [mediaStream]);

  // -------------------------------------------------------------
  // TOTALES, DESCUENTOS Y REGISTRO
  // -------------------------------------------------------------
  const totalBruto = filas.reduce((acc, f) => {
    const valor = parseFloat(f.valor) || 0;
    return acc + (valor * f.cantidad);
  }, 0);

  // Calcular Descuento Comercial
  const valorDescuentoNum = parseFloat(descuentoValor.replace(/\D/g, '')) || 0;
  let montoDescuento = 0;
  if (descuentoTipo === 'porcentaje') {
    montoDescuento = Math.round(totalBruto * (Math.min(100, valorDescuentoNum) / 100));
  } else if (descuentoTipo === 'fijo') {
    montoDescuento = Math.min(totalBruto, valorDescuentoNum);
  }

  const totalSepare = Math.max(0, totalBruto - montoDescuento);
  const abonoInicialNum = Math.max(0, parseFloat(abonoInicial.replace(/\D/g, '')) || 0);
  const saldoPendiente = Math.max(0, totalSepare - abonoInicialNum);

  const guardarSepare = async () => {
    if (!clienteSeleccionado) {
      toast.error("Debes seleccionar o crear un cliente para el plan separe", { icon: "👤" });
      return;
    }

    const itemsGuardar = filas
      .filter(f => f.descripcion.trim() !== "" && (parseFloat(f.valor) || 0) > 0)
      .map(f => {
        const pInv = inventario.find(p => (p.nombre || "").trim().toLowerCase() === f.descripcion.trim().toLowerCase());
        return {
          descripcion: f.descripcion.trim(),
          valor: (parseFloat(f.valor) || 0).toString(),
          cantidad: f.cantidad,
          fotoUrl: f.fotoUrl || null,
          idProducto: f.idProducto || pInv?.id || null
        };
      });

    if (itemsGuardar.length === 0) {
      toast.error("Agrega al menos un artículo con descripción y precio válido");
      return;
    }

    // Validación rigurosa de stock acumulado para todos los productos
    for (const item of itemsGuardar) {
      const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
      const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
      if (esInv) {
        const totalRequerido = itemsGuardar
          .filter(it => it.descripcion.toLowerCase() === item.descripcion.toLowerCase())
          .reduce((sum, it) => sum + it.cantidad, 0);

        if (totalRequerido > (pInv.stock || 0)) {
          toast.error(`¡Stock insuficiente! Para "${pInv.nombre}" solicitas ${totalRequerido} pero solo quedan ${pInv.stock || 0} disponibles.`);
          return;
        }
      }
    }

    if (abonoInicialNum > totalSepare) {
      toast.error("El abono inicial no puede ser mayor que el total del separe");
      return;
    }

    setGuardando(true);
    try {
      const todasLasFotos = itemsGuardar.map(i => i.fotoUrl).filter(Boolean);

      const abonosIniciales: any[] = [];
      if (abonoInicialNum > 0) {
        const abonoObj: any = {
          id: `abono_${Date.now()}`,
          monto: abonoInicialNum,
          metodoPago: metodoPago,
          fecha: new Date(),
          registradoPor: vendedorActivo || nombreUsuario || "Vendedor"
        };
        if (metodoPago !== 'efectivo' && subMetodoPago.trim()) abonoObj.subMetodoPago = subMetodoPago.trim();
        if (metodoPago !== 'efectivo' && referenciaPago.trim()) abonoObj.referenciaPago = referenciaPago.trim();
        abonosIniciales.push(abonoObj);
      }

      const payloadSepare: any = {
        usuarioId: cuentaPrincipalId || "",
        creadoPor: vendedorActivo || nombreUsuario || "Vendedor",
        vendedor: vendedorActivo || nombreUsuario || "Vendedor",
        estado: 'activo',
        clienteId: clienteSeleccionado.id,
        clienteNombre: clienteSeleccionado.nombre,
        clienteCelular: clienteSeleccionado.celular || "",
        items: itemsGuardar,
        totalBruto: totalBruto,
        descuentoTipo: descuentoTipo || null,
        descuentoValor: descuentoTipo ? valorDescuentoNum : null,
        montoDescuento: montoDescuento,
        total: totalSepare,
        montoPagado: abonoInicialNum,
        saldoPendiente: saldoPendiente,
        metodoPago: metodoPago,
        subMetodoPago: (metodoPago === 'efectivo') ? null : (subMetodoPago || null),
        referenciaPago: (metodoPago === 'efectivo') ? null : (referenciaPago || null),
        abonos: abonosIniciales,
        fotos: todasLasFotos,
        fechaCreacion: new Date(),
        fechaLimite: fechaLimite ? new Date(fechaLimite + "T23:59:59") : null
      };

      if (notas.trim()) {
        payloadSepare.notas = notas.trim();
      }

      let separeIdFinal = "";

      if (puedeVentaDirecta) {
        const docRef = await addDoc(collection(db, "separes"), payloadSepare);
        separeIdFinal = docRef.id;

        // Si hubo abono inicial, registrar el ingreso en la caja contable (colección movimientos)
        if (abonoInicialNum > 0) {
          const payloadMovAbono: any = {
            clienteId: clienteSeleccionado.id,
            clienteNombre: clienteSeleccionado.nombre,
            usuarioId: cuentaPrincipalId,
            tipo: 'abono',
            subtipo: 'abono_inicial_separe',
            monto: abonoInicialNum,
            descripcion: `Abono inicial Plan Separe - ${clienteSeleccionado.nombre}`,
            detalles: itemsGuardar,
            fecha: new Date(),
            registradoPor: vendedorActivo || nombreUsuario || "Vendedor",
            metodoPago: metodoPago,
            idSepareOrigen: separeIdFinal
          };
          if (metodoPago !== 'efectivo' && subMetodoPago.trim()) payloadMovAbono.subMetodoPago = subMetodoPago.trim();
          if (metodoPago !== 'efectivo' && referenciaPago.trim()) payloadMovAbono.referenciaPago = referenciaPago.trim();

          await addDoc(collection(db, "movimientos"), payloadMovAbono);
        }

        // Descontar inventario físico de forma atómica y precisa
        const cantidadesPorProducto: Record<string, number> = {};
        for (const item of itemsGuardar) {
          const pInv = inventario.find(p => p.nombre.toLowerCase() === item.descripcion.toLowerCase());
          const esInv = pInv && pInv.tipoProducto !== 'servicio' && pInv.inventariable !== false;
          if (esInv && pInv.id) {
            cantidadesPorProducto[pInv.id] = (cantidadesPorProducto[pInv.id] || 0) + item.cantidad;
          }
        }
        for (const [pId, cant] of Object.entries(cantidadesPorProducto)) {
          await updateDoc(doc(db, "inventario", pId), {
            stock: increment(-cant)
          });
        }

        toast.success("¡Plan Separe registrado con éxito! 🏷️");
      } else {
        // Enviar como orden pendiente para que el administrador la apruebe
        const docOrden: any = {
          tipo: 'separe',
          estado: 'pendiente',
          usuarioId: cuentaPrincipalId || "",
          creadoPor: datosSesion?.uid || "",
          nombreColaborador: vendedorActivo || nombreUsuario || "Colaborador",
          vendedor: vendedorActivo || nombreUsuario || "Vendedor",
          clienteId: clienteSeleccionado.id,
          clienteNombre: clienteSeleccionado.nombre,
          clienteCelular: clienteSeleccionado.celular || "",
          items: itemsGuardar,
          totalBruto: totalBruto,
          descuentoTipo: descuentoTipo || null,
          descuentoValor: descuentoTipo ? valorDescuentoNum : null,
          montoDescuento: montoDescuento,
          total: totalSepare,
          pagoCliente: abonoInicialNum,
          metodoPago: metodoPago,
          subMetodoPago: (metodoPago === 'efectivo') ? null : (subMetodoPago || null),
          referenciaPago: (metodoPago === 'efectivo') ? null : (referenciaPago || null),
          fecha: new Date(),
          fechaLimite: fechaLimite ? new Date(fechaLimite + "T23:59:59") : null,
          notas: notas.trim() || "",
          payloadSepare: payloadSepare
        };

        const docRefOrden = await addDoc(collection(db, "ordenes_pendientes"), docOrden);
        separeIdFinal = docRefOrden.id;
        toast.success("¡Plan Separe enviado para aprobación del Administrador! ⏳");
      }

      reproducirSonidoExito();

      // Preparar datos para el Ticket Térmico
      const ticketDatos: DatosFacturaProps = {
        nombreNegocio: nombreNegocio || "Mi Negocio",
        telefonoNegocio: datosSesion?.telefonoNegocio || "",
        correoNegocio: datosSesion?.correoNegocio || "",
        logoNegocio: datosSesion?.logoNegocio || null,
        nitNegocio: datosSesion?.nitNegocio || "",
        direccionNegocio: datosSesion?.direccionNegocio || "",
        mensajePieTicket: datosSesion?.mensajePieTicket || "Gracias por separar con nosotros.",
        nombreCliente: clienteSeleccionado.nombre,
        celularCliente: clienteSeleccionado.celular || "",
        registradoPor: nombreUsuario || "Vendedor",
        fecha: new Date(),
        tipo: 'separe',
        detalles: itemsGuardar.map(i => ({
          descripcion: i.descripcion,
          valor: (parseFloat(i.valor) || 0) * i.cantidad,
          cantidad: i.cantidad,
          valorUnitario: parseFloat(i.valor) || 0
        })),
        descripcionGeneral: `Plan Separe: ${itemsGuardar.map(i => i.descripcion).join(', ')}`,
        montoTotal: totalSepare,
        pagoRecibido: abonoInicialNum,
        saldoNuevo: saldoPendiente,
        idTransaccion: separeIdFinal,
        metodoPago: metodoPago,
        descuentoTipo: descuentoTipo,
        descuentoValor: descuentoTipo ? valorDescuentoNum : undefined,
        montoDescuento: montoDescuento > 0 ? montoDescuento : undefined,
        referenciaPago: subMetodoPago ? `${subMetodoPago}${referenciaPago ? ` - ${referenciaPago}` : ''}` : (referenciaPago || undefined)
      };

      setModalExito({
        visible: true,
        separe: {
          ...payloadSepare,
          id: separeIdFinal
        },
        ticketDatos,
        esOrdenPendiente: !puedeVentaDirecta
      });

    } catch (e) {
      console.error("Error al registrar separe:", e);
      toast.error("Error al registrar el plan separe");
    } finally {
      setGuardando(false);
    }
  };

  // Normalizador de texto para WhatsApp
  const normalizarMensajeWhatsApp = (texto: string) => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\uFFFD\u007F-\u009F]/g, '');
  };

  // Enviar mensaje de WhatsApp estructurado y limpio
  const enviarWhatsApp = () => {
    if (!clienteSeleccionado) return;

    let itemsTexto = "";
    filas
      .filter(f => f.descripcion.trim() !== "" && (parseFloat(f.valor) || 0) > 0)
      .forEach(f => {
        const precio = parseFloat(f.valor) || 0;
        const subtotal = precio * f.cantidad;
        itemsTexto += `• ${f.cantidad}x ${f.descripcion.trim()}\n  Precio unitario: *$${precio.toLocaleString('es-CO')}*\n  Total: *$${subtotal.toLocaleString('es-CO')}*\n\n`;
      });

    let texto = `¡Hola, *${clienteSeleccionado.nombre}*! Gracias por separar con nosotros en *${nombreNegocio}*.

===================
*COMPROBANTE DE PLAN SEPARE*
===================

${itemsTexto}`;

    if (montoDescuento > 0) {
      const dtoDesc = descuentoTipo === 'porcentaje' ? `${valorDescuentoNum}%` : `$${valorDescuentoNum.toLocaleString('es-CO')}`;
      texto += `*Subtotal:* $${totalBruto.toLocaleString('es-CO')}\n*Descuento (${dtoDesc}):* -$${montoDescuento.toLocaleString('es-CO')}\n`;
    }

    texto += `*TOTAL SEPARE:* *$${totalSepare.toLocaleString('es-CO')}*
*ABONO INICIAL RECIBIDO:* *$${abonoInicialNum.toLocaleString('es-CO')}*
*SALDO PENDIENTE:* *$${saldoPendiente.toLocaleString('es-CO')}*`;

    if (fechaLimite) {
      const fechaObj = new Date(fechaLimite + "T00:00:00");
      const fechaFmt = fechaObj.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      texto += `\n*Fecha límite de pago:* ${fechaFmt}`;
    }

    if (notas.trim()) {
      texto += `\n*Nota:* ${notas.trim()}`;
    }

    texto += `\n*Atendido por:* ${nombreUsuario}

Gracias por tu preferencia y confianza.
Estamos atentos para cualquier consulta.

*¡Que tengas un gran día!*`;

    const textoLimpio = normalizarMensajeWhatsApp(texto);
    const celLimpio = clienteSeleccionado.celular ? clienteSeleccionado.celular.replace(/\D/g, '') : '';
    const url = celLimpio ? `https://wa.me/57${celLimpio}?text=${encodeURIComponent(textoLimpio)}` : `https://wa.me/?text=${encodeURIComponent(textoLimpio)}`;
    window.open(url, '_blank');
  };

  // Clientes filtrados
  const clientesFiltrados = clientes.filter(c =>
    (c.nombre || "").toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    (c.celular || "").toString().includes(busquedaCliente)
  );

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-[#0f172a] md:rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl min-h-0 animate-in fade-in duration-300 relative">
      {/* INPUT FILE OCULTO PARA FALLBACK DE FOTO */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={procesarFotoArchivo}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* ENCABEZADO VIOLETA ESPEJO EXACTO A FIAR / VENDER */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-700 to-indigo-800 p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0 z-30 shadow-sm gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push('/dashboard/inicio')}
            className="bg-white/20 hover:bg-white/30 p-2 sm:p-2.5 rounded-full transition-colors backdrop-blur-sm cursor-pointer active:scale-95 shrink-0"
            title="Volver al inicio"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Bookmark size={20} className="shrink-0 text-violet-200" />
            <h2 className="text-base sm:text-xl font-black uppercase tracking-wide truncate">
              Plan Separe
            </h2>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-violet-200 font-medium hidden sm:block">Aparta artículos con abono inicial y cuotas flexibles</p>

        <div className="flex items-center gap-2 shrink-0">
          {/* Selector de Vendedor Responsable (Visible si es Terminal Multivendedor o Admin) */}
          {esTerminalMultivendedor ? (
            <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-1.5 border border-white/20">
              <User size={14} className="text-white/80 mr-1.5 shrink-0" />
              <select
                value={vendedorActivo}
                onChange={(e) => {
                  if (e.target.value === '__nuevo__') {
                    setModalNuevoVendedor(true);
                  } else {
                    setVendedorActivo(e.target.value);
                  }
                }}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-1"
              >
                {listaVendedores.map((v) => (
                  <option key={v} value={v} className="bg-slate-900 text-white">
                    {v}
                  </option>
                ))}
                {esAdmin && (
                  <option value="__nuevo__" className="bg-slate-900 text-amber-300 font-bold">
                    + Agregar otro vendedor...
                  </option>
                )}
              </select>
            </div>
          ) : (
            <div className="hidden sm:flex items-center bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-1.5 border border-white/20 text-white text-xs font-bold gap-1.5">
              <User size={13} className="text-white/80" />
              <span>{vendedorActivo}</span>
            </div>
          )}

          {/* Escanear QR */}
          <button
            type="button"
            onClick={() => setModalEscanner(true)}
            className="bg-white text-violet-700 hover:bg-violet-50 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer shrink-0"
            title="Escanear producto con código de barras o QR"
          >
            <QrCode size={15} className="shrink-0" />
            <span>Escanear QR</span>
          </button>

          {puedeGestionarSepares && (
            <button
              onClick={() => router.push('/dashboard/separes')}
              className="text-xs font-bold bg-white/15 hover:bg-white/25 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 cursor-pointer border border-white/10"
            >
              <span>Ver Separes</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE PESTAÑAS MULTI-SEPARE POS */}
      <div className="bg-gradient-to-r from-violet-700 via-purple-800 to-indigo-900 dark:bg-slate-900 px-3 py-2 border-b border-violet-800/40 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 z-20">
        {pestanas.map((p) => {
          const activa = p.id === pestanaActivaId;
          const subtotalPestana = (activa ? filas : p.filas).reduce((acc, f) => acc + ((parseFloat(f.valor) || 0) * f.cantidad), 0);

          return (
            <div
              key={p.id}
              onClick={() => cambiarPestana(p.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0 text-xs font-bold select-none ${
                activa
                  ? 'bg-white text-slate-900 shadow-md font-black'
                  : 'bg-violet-900/60 hover:bg-violet-900 text-white/90 border border-white/10'
              }`}
            >
              <Bookmark size={13} className={activa ? 'text-violet-600' : 'text-white/70'} />
              <span className="truncate max-w-[120px]">
                {p.nombre}
              </span>

              {subtotalPestana > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${activa ? 'bg-violet-100 text-violet-800' : 'bg-white/20 text-white'}`}>
                  ${subtotalPestana.toLocaleString('es-CO')}
                </span>
              )}

              {pestanas.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => cerrarPestana(p.id, e)}
                  className={`p-0.5 rounded-full hover:bg-black/10 transition-colors ${activa ? 'text-slate-500 hover:text-slate-900' : 'text-white/60 hover:text-white'}`}
                  title="Cerrar este separe"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}

        {/* Botón para agregar nueva pestaña */}
        <button
          type="button"
          onClick={() => crearNuevaPestana()}
          className="flex items-center gap-1 bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 border border-white/10"
          title="Abrir otro separe en paralelo"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nuevo Separe</span>
        </button>
      </div>

      {/* CONTENEDOR PRINCIPAL: ESTRUCTURA 2 COLUMNAS SIN SCROLL GENERAL */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 relative overflow-y-auto lg:overflow-hidden pb-40 lg:pb-0">
        
        {/* COLUMNA IZQUIERDA: ARTÍCULOS A SEPARAR */}
        <div className="flex-1 flex flex-col relative bg-slate-50/50 dark:bg-[#020617]/50 lg:min-h-0 lg:overflow-hidden shrink-0">
          
          <div ref={scrollArticulosRef} className="p-3 sm:p-5 lg:p-6 xl:p-8 space-y-3 sm:space-y-4 lg:flex-1 lg:overflow-y-auto min-h-0">
            <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
              <h4 className="font-bold text-slate-400 uppercase text-[10px] md:text-xs tracking-wider">
                Artículos a Separar <span className="text-rose-500">*</span>
              </h4>

              <div className="space-y-3">
                {filas.map((fila, index) => {
                  const productosSugeridos = ordenarProductosSugeridos(inventario, fila.descripcion);
                  const itemInventarioRegistrado = inventario.find(p => p.nombre.trim().toLowerCase() === fila.descripcion.trim().toLowerCase());
                  const esPrecioBloqueado = !puedeModificarPrecios && (fila.esDeInventario || !!itemInventarioRegistrado);

                  return (
                    <div
                      key={fila.id}
                      className={`flex flex-col sm:flex-row gap-2.5 sm:gap-3 md:gap-4 p-3 sm:p-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-800 relative shadow-sm transition-colors hover:border-violet-300 ${busquedaProductoIndex === index ? 'z-40' : 'z-10'}`}
                    >
                      {filas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarFila(index)}
                          className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 rounded-full p-1 shadow-sm hover:scale-110 transition-transform z-10 cursor-pointer"
                          title="Eliminar fila"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {/* Input de descripción con buscador de inventario */}
                      <div className="flex-1 min-w-0 relative">
                        <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap truncate flex items-center gap-1">
                          <Package size={11} /> Descripción o SKU
                        </label>
                        <input
                          ref={(el) => { inputsDescripcionRef.current[index] = el; }}
                          type="text"
                          value={fila.descripcion}
                          onChange={(e) => {
                            actualizarFila(index, 'descripcion', e.target.value);
                            actualizarFila(index, 'esDeInventario', false);
                            setBusquedaProductoIndex(index);
                          }}
                          onFocus={() => {
                            setBusquedaProductoIndex(index);
                            inputsDescripcionRef.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (busquedaProductoIndex === index && productosSugeridos.length > 0) {
                                e.preventDefault();
                                seleccionarProductoInventario(index, productosSugeridos[0]);
                              } else if (fila.descripcion.trim().length > 0) {
                                e.preventDefault();
                                agregarFila();
                              }
                            }
                          }}
                          placeholder="Escribe nombre o SKU..."
                          className="w-full px-3 py-2 h-[42px] sm:h-[46px] md:h-[50px] bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl outline-none font-bold text-xs sm:text-sm md:text-base min-w-0 shadow-sm focus:border-violet-500 transition-colors text-slate-900 dark:!text-white placeholder:text-slate-400 placeholder:font-normal"
                        />

                        {/* Dropdown de autocompletar inventario */}
                        {busquedaProductoIndex === index && fila.descripcion.trim().length > 0 && productosSugeridos.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 backdrop-blur-md">
                            {productosSugeridos.map(p => {
                              const precioP = p.precioVenta !== undefined ? p.precioVenta : (p.precio || 0);
                              const esInv = p.tipoProducto !== 'servicio' && p.inventariable !== false;
                              const cantEnOtras = filas.reduce((acc, f, i) => i !== index && f.descripcion.toLowerCase().trim() === p.nombre.toLowerCase().trim() ? acc + f.cantidad : acc, 0);
                              const stockDisp = (p.stock || 0) - cantEnOtras;
                              const estaAgotado = esInv && stockDisp <= 0;

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (estaAgotado) {
                                      toast.error(`⚠️ "${p.nombre}" no tiene existencias disponibles.`, { position: 'bottom-center', icon: '🚫' });
                                      return;
                                    }
                                    seleccionarProductoInventario(index, p);
                                  }}
                                  className={`p-3 transition-all flex justify-between items-center text-xs sm:text-sm ${
                                    estaAgotado 
                                      ? 'bg-rose-50/50 dark:bg-rose-950/20 opacity-60 cursor-not-allowed hover:bg-rose-100/60 border-l-4 border-rose-500' 
                                      : 'hover:bg-violet-50/80 dark:hover:bg-slate-800/80 cursor-pointer active:scale-[0.99]'
                                  }`}
                                >
                                  <div className="min-w-0 pr-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold block truncate ${estaAgotado ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                                        {p.nombre}
                                      </span>
                                      {p.sku && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                                          {p.sku}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      {!esInv ? (
                                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          🛠️ Servicio / Ilimitado
                                        </span>
                                      ) : estaAgotado ? (
                                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                          🚫 Agotado ({cantEnOtras > 0 ? `${cantEnOtras} en tu lista` : '0 disponibles'})
                                        </span>
                                      ) : stockDisp <= 5 ? (
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                          ⚡ ¡Solo quedan {stockDisp}!
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                          ✓ {stockDisp} disponibles
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <span className={`font-black shrink-0 ${estaAgotado ? 'text-slate-400' : 'text-violet-600 dark:text-violet-400'}`}>
                                    ${precioP.toLocaleString('es-CO')}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Controles de Cantidad + Precio + Foto */}
                      <div className="flex flex-row gap-2 sm:gap-3 w-full sm:w-auto shrink-0 items-end">
                        
                        {/* Cantidad (+/-) */}
                        <div className="w-[85px] sm:w-[95px] shrink-0">
                          <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">
                            Cant.
                          </label>
                          <div className="flex items-center bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shrink-0 h-[42px] sm:h-[46px] md:h-[50px]">
                            <button
                              type="button"
                              onClick={() => actualizarCantidadFila(index, -1)}
                              className="px-2 sm:px-2.5 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 font-black cursor-pointer"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="flex-1 text-center font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                              {fila.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => actualizarCantidadFila(index, 1)}
                              className="px-2 sm:px-2.5 h-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 font-black cursor-pointer"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Precio Unitario */}
                        <div className="flex-1 sm:w-32 min-w-0">
                          <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block whitespace-nowrap">
                            Precio Unit.
                          </label>
                          <div className="relative h-[42px] sm:h-[46px] md:h-[50px]">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={fila.valor ? parseInt(fila.valor.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : ''}
                              onChange={(e) => actualizarFila(index, 'valor', e.target.value)}
                              disabled={esPrecioBloqueado}
                              placeholder="0"
                              className={`w-full pl-6 pr-2.5 h-full bg-slate-50 dark:bg-[#020617] border rounded-xl outline-none font-black text-xs sm:text-sm text-right text-slate-900 dark:text-white focus:border-violet-500 ${
                                esPrecioBloqueado ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'border-slate-200 dark:border-slate-800'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Botón de Cámara y Miniatura con Lightbox */}
                        <div className="shrink-0 h-[42px] sm:h-[46px] md:h-[50px] flex items-end">
                          {fila.fotoUrl ? (
                            <div className="relative group w-10 h-10 rounded-xl overflow-hidden border border-violet-300 dark:border-violet-700 shadow-sm shrink-0 bg-slate-900">
                              <img
                                src={fila.fotoUrl}
                                alt="Foto"
                                onClick={() => setFotoLightbox(fila.fotoUrl!)}
                                className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                                title="Clic para ampliar y confirmar foto"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  actualizarFila(index, 'fotoUrl', null);
                                }}
                                className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 z-10 cursor-pointer"
                                title="Eliminar foto"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirCamaraEnVivo(index)}
                              className="h-10 px-2.5 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-xl hover:bg-violet-100 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
                              title="Tomar o adjuntar foto"
                            >
                              <Camera size={14} />
                              <span className="hidden sm:inline">Foto</span>
                            </button>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}

                {/* BOTONES INFERIORES: AÑADIR ARTÍCULO + APLICAR DESCUENTO */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={agregarFila}
                    className="font-bold text-violet-600 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-3.5 py-2 sm:py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-sm cursor-pointer active:scale-95"
                  >
                    <Plus size={15} /> Añadir artículo
                  </button>

                  {!mostrarModalDescuento && puedeAplicarDescuentos && (
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarModalDescuento(true);
                        setDescuentoValor('');
                      }}
                      className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-950/40 dark:hover:text-violet-400 px-3.5 py-2 sm:py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
                    >
                      <Tag size={14} className="text-violet-500" />
                      <span>+ Aplicar Descuento</span>
                    </button>
                  )}
                </div>

                {/* TARJETA DE DESCUENTO EN COLUMNA IZQUIERDA */}
                {mostrarModalDescuento && puedeAplicarDescuentos && (
                  <div className="mt-2 bg-slate-50 dark:bg-[#020617] p-2.5 sm:p-3 rounded-2xl border border-violet-300 dark:border-violet-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                        <Tag size={12} /> Descuento:
                      </span>
                      <div className="flex items-center bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setDescuentoTipo('porcentaje'); setDescuentoValor(''); }}
                          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${descuentoTipo === 'porcentaje' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDescuentoTipo('fijo'); setDescuentoValor(''); }}
                          className={`px-2 py-0.5 rounded text-[10px] font-black transition-all ${descuentoTipo === 'fijo' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >
                          $
                        </button>
                      </div>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={descuentoTipo === 'porcentaje' ? descuentoValor : (descuentoValor ? parseInt(descuentoValor.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : '')}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          if (descuentoTipo === 'porcentaje') {
                            setDescuentoValor(raw ? String(Math.min(100, Number(raw))) : '');
                          } else {
                            setDescuentoValor(raw);
                          }
                        }}
                        placeholder={descuentoTipo === 'porcentaje' ? "Ej: 10%" : "Ej: 5.000"}
                        className="w-24 px-2 py-1 text-xs font-black bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-violet-500 text-slate-900 dark:text-white"
                      />

                      {montoDescuento > 0 && (
                        <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">
                          = -${montoDescuento.toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarModalDescuento(false);
                          setDescuentoTipo(null);
                          setDescuentoValor('');
                        }}
                        className="text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1 rounded-lg flex items-center gap-0.5 transition-colors whitespace-nowrap cursor-pointer"
                        title="Quitar descuento"
                      >
                        <X size={12} /> Quitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO: CLIENTE + FECHA LÍMITE + ABONO INICIAL + RESUMEN FIJO */}
        <div className="w-full lg:w-[380px] xl:w-[410px] bg-slate-50 dark:bg-[#020617] lg:border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shrink-0 lg:min-h-0 lg:overflow-hidden">
          
          {/* SECCIÓN INTERNA SCROLLABLE: CLIENTE + FECHA LÍMITE + ABONO INICIAL */}
          <div className="p-3 lg:p-3.5 space-y-2 flex-1 min-h-0 lg:overflow-y-auto">
            
            {/* 1. TARJETA CLIENTE OBLIGATORIO */}
            <div className={`flex flex-col bg-white dark:bg-[#0f172a] p-3 rounded-2xl border shadow-sm relative transition-colors ${!clienteSeleccionado ? 'border-violet-200 dark:border-violet-900 bg-violet-50/20' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <User size={13} className="text-violet-600" /> Cliente para el Separe <span className="text-rose-500">*</span>
                </label>
              </div>

              {clienteSeleccionado ? (
                <div className="py-2 px-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl border border-violet-200 flex justify-between items-center shadow-sm">
                  <div className="flex flex-col min-w-0 mr-2">
                    <span className="font-black text-slate-900 dark:text-violet-300 text-xs sm:text-sm truncate">{clienteSeleccionado.nombre}</span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {clienteSeleccionado.celular ? `WhatsApp: ${clienteSeleccionado.celular}` : "Sin celular"}
                    </span>
                  </div>
                  <button
                    onClick={() => { setClienteSeleccionado(null); setBusquedaCliente(""); }}
                    className="text-rose-500 shrink-0 hover:bg-rose-100 p-1 rounded-full cursor-pointer"
                    title="Cambiar cliente"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-500" size={15} />
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => { setBusquedaCliente(e.target.value); setMostrarResultadosCliente(true); }}
                    onFocus={() => setMostrarResultadosCliente(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (clientesFiltrados.length > 0) {
                          setClienteSeleccionado(clientesFiltrados[0]);
                          setBusquedaCliente("");
                          setMostrarResultadosCliente(false);
                        } else if (busquedaCliente.trim()) {
                          setNombreNuevo(busquedaCliente.trim());
                          setModalNuevoCliente(true);
                          setMostrarResultadosCliente(false);
                        }
                      }
                    }}
                    placeholder="Buscar cliente por nombre o celular..."
                    className="w-full pl-8 pr-2.5 py-2 bg-white dark:bg-[#0f172a] border border-violet-200 dark:border-violet-800 rounded-xl text-xs font-bold outline-none focus:border-violet-500 transition-colors shadow-sm text-slate-900 dark:!text-white placeholder:text-slate-400"
                  />

                  {mostrarResultadosCliente && busquedaCliente.trim() && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto p-1">
                      {clientesFiltrados.map(c => (
                        <div
                          key={c.id}
                          onClick={() => { setClienteSeleccionado(c); setBusquedaCliente(""); setMostrarResultadosCliente(false); }}
                          className="p-2 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.nombre}</span>
                            {c.celular && <span className="text-[10px] text-slate-400">{c.celular}</span>}
                          </div>
                          <ChevronRight size={13} className="text-slate-400" />
                        </div>
                      ))}
                      {!clientesFiltrados.some(c => c.nombre.toLowerCase() === busquedaCliente.toLowerCase()) && (
                        <button
                          onClick={() => { setNombreNuevo(busquedaCliente.trim()); setModalNuevoCliente(true); setMostrarResultadosCliente(false); }}
                          className="w-full text-left p-2 bg-violet-50 text-violet-700 text-xs font-bold"
                        >
                          + Crear cliente "{busquedaCliente}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. FECHA LÍMITE DE PAGO & NOTAS (INTEGRADAS EN PANEL DERECHO) */}
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-3 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar size={13} className="text-violet-600" />
                  Fecha Límite de Pago
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: '1m', meses: 1 },
                    { label: '3m', meses: 3 },
                    { label: '6m', meses: 6 }
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + btn.meses);
                        setFechaLimite(d.toISOString().split('T')[0]);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 text-violet-700 dark:text-violet-300 font-bold text-[10px] transition-colors border border-violet-200/60 dark:border-violet-800/40"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-violet-500"
              />

              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Nota / Ubicación (Opcional)..."
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-xs text-slate-900 dark:text-white outline-none focus:border-violet-500"
              />
            </div>

            {/* 3. SECCIÓN ABONO INICIAL */}
            <div className="bg-white dark:bg-[#0f172a] p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Banknote size={13} className="text-violet-600" /> Abono Inicial (Opcional)
              </label>

              {/* Formas de Pago del Abono */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'efectivo', label: 'Efectivo', icon: Banknote, activeClass: 'bg-emerald-600 text-white shadow-sm' },
                  { id: 'transferencia', label: 'Transf.', icon: Smartphone, activeClass: 'bg-blue-600 text-white shadow-sm' },
                  { id: 'datafono', label: 'Datáfono', icon: CreditCard, activeClass: 'bg-indigo-600 text-white shadow-sm' },
                  { id: 'credito_externo', label: 'Crédito', icon: Zap, activeClass: 'bg-purple-600 text-white shadow-sm' }
                ].map((m) => {
                  const Icon = m.icon;
                  const activo = metodoPago === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMetodoPago(m.id as any); setSubMetodoPago(''); }}
                      className={`py-1.5 px-0.5 rounded-xl font-bold text-[10px] flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                        activo
                          ? m.activeClass
                          : 'bg-slate-50 dark:bg-[#020617] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <Icon size={13} />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-selector Transferencia */}
              {metodoPago === 'transferencia' && (
                <div className="flex flex-wrap gap-1 pt-0.5 animate-in fade-in duration-150">
                  {['Nequi', 'Daviplata', 'Bancolombia', 'PSE', 'Otro'].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSubMetodoPago(subMetodoPago === b ? '' : b)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                        subMetodoPago === b ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {/* Sub-selector Crédito */}
              {metodoPago === 'credito_externo' && (
                <div className="flex flex-wrap gap-1 pt-0.5 animate-in fade-in duration-150">
                  {['Addi', 'Sistecrédito', 'Krediya', 'Otro'].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSubMetodoPago(subMetodoPago === b ? '' : b)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                        subMetodoPago === b ? 'bg-purple-600 text-white border-purple-700' : 'bg-slate-50 dark:bg-[#020617] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Dinero del Abono Inicial */}
              <div className="relative pt-0.5">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-600 font-black text-sm">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={abonoInicial ? parseInt(abonoInicial.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : ''}
                  onChange={(e) => setAbonoInicial(e.target.value.replace(/\D/g, ''))}
                  placeholder="0 (Sin abono inicial)"
                  className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Referencia de pago */}
              {metodoPago !== 'efectivo' && (
                <input
                  type="text"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  placeholder={
                    metodoPago === 'transferencia'
                      ? `Ref. ${subMetodoPago || 'comprobante'} (Opcional)`
                      : metodoPago === 'datafono'
                      ? "No. Voucher (Opcional)"
                      : `Aprobación ${subMetodoPago || 'crédito'} (Opcional)`
                  }
                  className="w-full p-1.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-xs outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              )}
            </div>

          </div>

          {/* FOOTER FIJO EN LA BASE DEL PANEL DERECHO: RESUMEN DE SALDOS + BOTÓN REGISTRAR */}
          <div className="hidden lg:flex flex-col bg-slate-900 dark:bg-black text-white p-3.5 shrink-0 border-t border-slate-800 z-30 space-y-2">
            
            {/* Resumen de totales */}
            <div className="space-y-1 text-xs border-b border-slate-800 pb-2">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-bold text-slate-200">${totalBruto.toLocaleString('es-CO')}</span>
              </div>
              {montoDescuento > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Descuento:</span>
                  <span>-${montoDescuento.toLocaleString('es-CO')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Total Separe:</span>
                <span className="font-black text-white">${totalSepare.toLocaleString('es-CO')}</span>
              </div>
              {abonoInicialNum > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Abono Inicial:</span>
                  <span>-${abonoInicialNum.toLocaleString('es-CO')}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-800">
                <span className="font-black uppercase tracking-wider text-[11px] text-amber-400">Saldo Pendiente:</span>
                <span className="font-black text-xl text-amber-400">${saldoPendiente.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* Botón Registrar / Enviar */}
            <button
              onClick={guardarSepare}
              disabled={guardando || !clienteSeleccionado || totalSepare <= 0}
              className={`w-full font-black text-xs sm:text-sm py-3 rounded-2xl shadow-lg flex justify-center items-center gap-2 transition-all cursor-pointer ${
                guardando || !clienteSeleccionado || totalSepare <= 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-700 text-white active:scale-95'
              }`}
            >
              <span>{puedeVentaDirecta ? "Registrar Plan Separe" : "Enviar Orden de Separe"}</span>
              <CheckCircle2 size={16} />
            </button>
          </div>

        </div>

      </div>

      {/* BARRA FLOTANTE MÓVIL */}
      <div className="lg:hidden fixed bottom-[76px] sm:bottom-[84px] left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-2.5 rounded-2xl shadow-xl z-40 flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0 shrink pl-1">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total Separe</span>
          <span className="text-base font-black text-violet-600 truncate">${totalSepare.toLocaleString('es-CO')}</span>
        </div>
        <button
          onClick={guardarSepare}
          disabled={guardando || !clienteSeleccionado || totalSepare <= 0}
          className={`flex-1 font-black text-xs py-2.5 px-3 rounded-xl shadow-md flex justify-center items-center gap-1.5 transition-all ${
            guardando || !clienteSeleccionado || totalSepare <= 0
              ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
              : 'bg-violet-600 text-white active:scale-95'
          }`}
        >
          <span>{puedeVentaDirecta ? "Registrar Separe" : "Enviar Orden"}</span>
          <CheckCircle2 size={15} />
        </button>
      </div>

      {/* MODAL DE CÁMARA EN VIVO */}
      {modalCamaraEnVivo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl flex flex-col">
            <div className="p-3.5 bg-slate-950/80 flex items-center justify-between border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Camera size={17} className="text-violet-400" />
                <span className="font-bold text-xs sm:text-sm">Foto del Producto</span>
              </div>
              <button
                type="button"
                onClick={cerrarCamara}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            <div className="relative bg-black aspect-[4/3] sm:aspect-video flex items-center justify-center overflow-hidden">
              {iniciandoCamara ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Iniciando lente de la cámara...</span>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {flashEfecto && <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200"></div>}
            </div>

            <div className="p-3.5 bg-slate-950 flex items-center justify-around border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  cerrarCamara();
                  if (filaParaFoto !== null) activarArchivoFallback(filaParaFoto);
                }}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors flex flex-col items-center gap-1 text-[10px] font-bold"
                title="Adjuntar desde galería"
              >
                <Upload size={16} />
                <span>Galería</span>
              </button>

              <button
                type="button"
                onClick={capturarFotoEnVivo}
                className="w-14 h-14 rounded-full bg-white border-4 border-violet-600 shadow-xl flex items-center justify-center text-violet-700 hover:scale-105 active:scale-90 transition-transform cursor-pointer"
                title="Capturar Foto"
              >
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white">
                  <Camera size={20} />
                </div>
              </button>

              <button
                type="button"
                onClick={alternarCamara}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors flex flex-col items-center gap-1 text-[10px] font-bold"
                title="Girar cámara"
              >
                <RotateCcw size={16} />
                <span>Girar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PARA VER FOTO EN DETALLE */}
      {fotoLightbox && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[250] animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full flex flex-col items-center space-y-3">
            <div className="w-full flex justify-between items-center text-white px-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-violet-300">
                <Eye size={15} /> Vista previa del artículo
              </span>
              <button
                type="button"
                onClick={() => setFotoLightbox(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="w-full max-h-[75vh] overflow-hidden rounded-3xl border border-white/20 shadow-2xl bg-black flex items-center justify-center">
              <img
                src={fotoLightbox}
                alt="Foto ampliada"
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => setFotoLightbox(null)}
              className="px-5 py-2 bg-white text-slate-900 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors shadow-lg cursor-pointer"
            >
              Cerrar Vista Previa
            </button>
          </div>
        </div>
      )}

      {/* MODAL DESCUENTO COMERCIAL */}
      {mostrarModalDescuento && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[210] animate-in zoom-in-95 duration-150">
          <div className="bg-white dark:bg-[#0f172a] p-5 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800 space-y-3.5">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Percent size={16} className="text-emerald-600" /> Aplicar Descuento
              </h3>
              <button
                onClick={() => setMostrarModalDescuento(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDescuentoTipo('porcentaje')}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  descuentoTipo === 'porcentaje' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Porcentaje (%)
              </button>
              <button
                type="button"
                onClick={() => setDescuentoTipo('fijo')}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  descuentoTipo === 'fijo' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Valor Fijo ($)
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-emerald-600">
                {descuentoTipo === 'porcentaje' ? '%' : '$'}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={descuentoValor ? parseInt(descuentoValor.replace(/\D/g, '') || '0', 10).toLocaleString('es-CO') : ''}
                onChange={(e) => setDescuentoValor(e.target.value.replace(/\D/g, ''))}
                placeholder={descuentoTipo === 'porcentaje' ? "Ej: 10 (para 10%)" : "Ej: 20.000"}
                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-black text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setDescuentoTipo(null); setDescuentoValor(""); setMostrarModalDescuento(false); }}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs"
              >
                Quitar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!descuentoTipo) setDescuentoTipo('porcentaje');
                  setMostrarModalDescuento(false);
                }}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE RÁPIDO */}
      {modalNuevoCliente && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[210]">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <UserCog size={22} className="text-violet-600" /> Registrar Cliente
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Nombre completo"
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-violet-500"
              />
              <input
                type="tel"
                value={celularNuevo}
                onChange={(e) => setCelularNuevo(e.target.value)}
                placeholder="WhatsApp (Opcional)"
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-violet-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevoCliente(false)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold py-3.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarNuevoCliente}
                disabled={guardandoCliente}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-xl shadow-md text-sm"
              >
                {guardandoCliente ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ÉXITO CON WHATSAPP Y TICKET */}
      {modalExito?.visible && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[220] animate-in zoom-in-95 duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                {modalExito.esOrdenPendiente ? "¡Orden de Separe Enviada!" : "¡Plan Separe Creado!"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cliente: <strong className="text-slate-800 dark:text-slate-200">{modalExito.separe.clienteNombre}</strong>
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-2xl space-y-1 text-xs text-left font-bold">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Separe:</span>
                <span className="text-slate-900 dark:text-white">${totalSepare.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Abono inicial:</span>
                <span className="text-emerald-600">${abonoInicialNum.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>Saldo pendiente:</span>
                <span className="text-amber-500">${saldoPendiente.toLocaleString('es-CO')}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={enviarWhatsApp}
                className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer"
              >
                <MessageCircle size={18} /> Enviar Comprobante por WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setModalTicketFactura({ visible: true, datos: modalExito.ticketDatos || null })}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <Printer size={18} /> Ver / Imprimir Ticket
              </button>

              {modalExito.esOrdenPendiente ? (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/ordenes')}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3.5 rounded-xl transition-all text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                >
                  <Receipt size={15} />
                  <span>Ver Mis Órdenes Enviadas</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/separes')}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-xl transition-all text-xs cursor-pointer shadow-md"
                >
                  Ir a Lista de Separes
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setModalExito(null);
                  cerrarPestana(pestanaActivaId);
                }}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 hover:opacity-90"
              >
                <Plus size={15} />
                <span>Nuevo Separe</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEL ESCÁNER ULTRA RÁPIDO POS CON LÁSER Y MARCO */}
      {modalEscanner && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-[#0f172a] text-white p-4 sm:p-6 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-800 flex flex-col items-center relative overflow-hidden">
            
            {/* Mensaje flotante de feedback */}
            {mensajeScaneo && (
              <div className={`absolute top-4 left-4 right-4 z-50 p-3.5 rounded-2xl text-white font-black text-center shadow-2xl animate-in slide-in-from-top duration-200 flex items-center justify-center gap-2 ${
                mensajeScaneo.tipo === 'exito' ? 'bg-violet-600 text-sm sm:text-base' : 'bg-rose-600 text-xs sm:text-sm'
              }`}>
                {mensajeScaneo.texto}
              </div>
            )}

            {/* Cabecera del Modal */}
            <div className="flex justify-between items-center w-full mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-500/20 text-violet-400 rounded-xl">
                  <QrCode size={20}/>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black uppercase tracking-wide">
                    Escáner Rápido Separe
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Apunta a los códigos QR o de barras de tus productos
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setModalEscanner(false)} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-full transition-colors active:scale-95 cursor-pointer"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Visor de Cámara con Marco POS y Línea Láser */}
            <div className="w-full relative rounded-2xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-slate-800 shadow-inner">
              
              {/* Elemento de video HTML5 */}
              <div id="qr-reader-separe" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>

              {/* Destello verde al escanear */}
              {flashExito && (
                <div className="absolute inset-0 bg-violet-500/40 pointer-events-none z-30 animate-in fade-in duration-100"></div>
              )}

              {/* Guías de encuadre */}
              {!errorCamara && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
                  <div className="w-[72%] h-[72%] border-2 border-dashed border-violet-400/70 rounded-2xl relative flex items-center justify-center">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-violet-400 rounded-tl-md"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-violet-400 rounded-tr-md"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-violet-400 rounded-bl-md"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-violet-400 rounded-br-md"></div>
                    
                    {/* Línea Láser Animada con barrido vertical continuo */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent shadow-[0_0_12px_#a78bfa] animate-laser-sweep"></div>
                  </div>
                </div>
              )}

              {/* Estado de carga */}
              {!camaraIniciada && !errorCamara && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2.5 z-10 p-4">
                  <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-slate-400">Iniciando cámara trasera...</span>
                </div>
              )}

              {/* Estado de error si no hay permisos */}
              {errorCamara && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 z-10 p-6 text-center">
                  <AlertCircle size={32} className="text-rose-500" />
                  <p className="text-xs text-rose-300 font-bold leading-relaxed">{errorCamara}</p>
                </div>
              )}
            </div>

            {/* Resumen del último producto escaneado y total en vivo */}
            <div className="w-full mt-3 space-y-2">
              {ultimoProductoEscaneado ? (
                <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-2xl flex items-center justify-between animate-in zoom-in-95 duration-150">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-black tracking-wider text-violet-400 block">Último Agregado</span>
                    <h5 className="font-black text-white text-xs truncate">{ultimoProductoEscaneado.nombre}</h5>
                    <span className="text-[11px] text-slate-400 font-bold">${ultimoProductoEscaneado.precio.toLocaleString('es-CO')} c/u</span>
                  </div>
                  <div className="bg-violet-500 text-white font-black px-2.5 py-1 rounded-xl text-xs shrink-0 ml-2">
                    x{ultimoProductoEscaneado.cantidad}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                  <span className="text-[11px] text-slate-400 font-medium">Pasa los códigos frente al recuadro</span>
                </div>
              )}

              {/* Botón para cerrar y volver a los artículos */}
              <button 
                onClick={() => setModalEscanner(false)} 
                className="w-full bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-violet-900/20 cursor-pointer"
              >
                <span>Listo ({filas.filter(f => f.descripcion.trim()).length} artículos • ${totalBruto.toLocaleString('es-CO')})</span>
                <CheckCircle2 size={16}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVO VENDEDOR RÁPIDO */}
      {modalNuevoVendedor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white text-center mb-1">
              Agregar Vendedor
            </h3>
            <p className="text-xs text-slate-500 text-center mb-4">
              Ingresa el nombre de quien atenderá este plan separe.
            </p>

            <input
              type="text"
              value={nombreNuevoVendedor}
              onChange={(e) => setNombreNuevoVendedor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrarVendedorRapido(); } }}
              placeholder="Ej: Laura Turno Tarde, Andrés..."
              className="w-full p-3.5 bg-slate-50 dark:bg-[#020617] border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-violet-500 text-slate-900 dark:text-white mb-5"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setModalNuevoVendedor(false); setNombreNuevoVendedor(""); }}
                className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarVendedorRapido}
                className="py-3 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={16} /> Guardar y Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET FACTURA */}
      <TicketFacturaModal
        isOpen={modalTicketFactura.visible}
        onClose={() => setModalTicketFactura({ visible: false, datos: null })}
        datos={modalTicketFactura.datos}
      />
    </div>
  );
}
