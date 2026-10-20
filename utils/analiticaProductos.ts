import { Movimiento } from "@/types";

/**
 * Motor de analítica de productos.
 *
 * Reglas de exactitud:
 *  - Una venta mixta (contado + fiado) genera DOS movimientos con los mismos `detalles`.
 *    Se emparejan para contar cada ítem UNA sola vez y repartir el dinero proporcionalmente.
 *  - Los ingresos por ítem se prorratean con el descuento global (neto de descuento, tope 1 para no
 *    atribuir IVA a ingresos).
 *  - Las devoluciones restan unidades, ingresos y costo (usando el costo snapshot del movimiento origen).
 *  - La utilidad/margen SOLO se calcula sobre las ventas cuyo costo es conocido (costo > 0).
 *    Nunca se asume costo cero: eso inflaría el margen.
 *  - Los abonos NO se atribuyen a productos (pagan deuda global del cliente).
 */

export interface ProductoStat {
  clave: string;
  productoId: string | null;
  nombre: string;
  categoria: string;
  imagen: string | null;
  enCatalogo: boolean;
  unidades: number;
  ingresos: number;
  ingresosContado: number;
  ingresosFiado: number;
  ingresosSepare: number;
  /** Costo total de las unidades con costo conocido */
  costo: number;
  /** Ingresos de las líneas con costo conocido (base del margen) */
  ingresosConCosto: number;
  /** null si ninguna línea tiene costo conocido */
  utilidad: number | null;
  /** Porcentaje 0-100. null si no hay base de costo */
  margen: number | null;
}

export interface ResumenProductos {
  productos: ProductoStat[];
  totalIngresos: number;
  totalUnidades: number;
  totalCosto: number;
  totalIngresosConCosto: number;
  /** % de los ingresos cuyo costo es conocido (0-100) */
  coberturaCosto: number;
}

const SIN_CATEGORIA = "Sin categoría";
const VENTANA_EMPAREJADO_MS = 5000;

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const norm = (s: any): string => String(s ?? "").trim().toLowerCase();

const aMs = (f: any): number => {
  if (!f) return 0;
  if (typeof f.toMillis === "function") return f.toMillis();
  if (typeof f.toDate === "function") return f.toDate().getTime();
  if (typeof f.seconds === "number") return f.seconds * 1000;
  const t = new Date(f).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const valorLinea = (det: any): number => {
  const cant = num(det?.cantidad) || 1;
  return num(det?.valor) || num(det?.valorUnitario) * cant;
};

const firmaDetalles = (detalles: any[]): string =>
  detalles.map(d => `${d?.productoId || norm(d?.descripcion)}|${num(d?.cantidad) || 1}|${num(d?.valor)}`).join(";");

type Canal = "venta" | "separe";

interface Contexto {
  porId: Map<string, any>;
  porNombre: Map<string, any>;
  acc: Map<string, ProductoStat>;
}

function acumular(
  ctx: Contexto,
  det: any,
  o: { cantidad: number; ingresos: number; canal: Canal; fiadoShare: number; signo: 1 | -1; costoUnit?: number }
) {
  const inv =
    (det?.productoId && ctx.porId.get(det.productoId)) ||
    ctx.porNombre.get(norm(det?.descripcion)) ||
    null;

  const clave: string = inv?.id || det?.productoId || `n:${norm(det?.descripcion)}`;
  const categoriaInv = typeof inv?.categoria === "string" ? inv.categoria.trim() : "";
  const categoriaDet = typeof det?.categoria === "string" ? det.categoria.trim() : "";
  const categoria = categoriaInv || categoriaDet || SIN_CATEGORIA;

  let st = ctx.acc.get(clave);
  if (!st) {
    st = {
      clave,
      productoId: inv?.id || det?.productoId || null,
      nombre: inv?.nombre || String(det?.descripcion || "Artículo").trim(),
      categoria,
      imagen: inv?.imagen || inv?.imagenUrl || inv?.foto || null,
      enCatalogo: Boolean(inv),
      unidades: 0,
      ingresos: 0,
      ingresosContado: 0,
      ingresosFiado: 0,
      ingresosSepare: 0,
      costo: 0,
      ingresosConCosto: 0,
      utilidad: null,
      margen: null,
    };
    ctx.acc.set(clave, st);
  }

  const s = o.signo;
  const ingresosFiado = o.canal === "venta" ? o.ingresos * o.fiadoShare : 0;
  const ingresosSepare = o.canal === "separe" ? o.ingresos : 0;
  const ingresosContado = o.ingresos - ingresosFiado - ingresosSepare;

  st.unidades += s * o.cantidad;
  st.ingresos += s * o.ingresos;
  st.ingresosContado += s * ingresosContado;
  st.ingresosFiado += s * ingresosFiado;
  st.ingresosSepare += s * ingresosSepare;

  const costoUnit =
    num(o.costoUnit) > 0 ? num(o.costoUnit)
    : num(det?.costoUnitario) > 0 ? num(det.costoUnitario)
    : num(inv?.costoCompra) > 0 ? num(inv.costoCompra)
    : 0;

  if (costoUnit > 0) {
    st.costo += s * costoUnit * o.cantidad;
    st.ingresosConCosto += s * o.ingresos;
  }
}

export function calcularRendimientoProductos(
  movimientos: Movimiento[],
  todosMovimientos: Movimiento[],
  inventario: any[]
): ResumenProductos {
  const ctx: Contexto = { porId: new Map(), porNombre: new Map(), acc: new Map() };
  inventario.forEach(p => {
    if (p?.id) ctx.porId.set(p.id, p);
    if (p?.nombre) ctx.porNombre.set(norm(p.nombre), p);
  });

  const indiceOrigen = new Map<string, Movimiento>();
  todosMovimientos.forEach(m => indiceOrigen.set(m.id, m));

  const conDetalles = (m: Movimiento) => Array.isArray(m.detalles) && m.detalles.length > 0;
  const ventas = movimientos.filter(m => m.tipo === "venta" && conDetalles(m));
  const fiados = movimientos.filter(m => m.tipo === "fiado" && conDetalles(m));

  const procesarVenta = (detalles: any[], ventaMonto: number, fiadoMonto: number) => {
    const total = ventaMonto + fiadoMonto;
    const bruto = detalles.reduce((a, d) => a + valorLinea(d), 0);
    const factor = bruto > 0 && total > 0 ? Math.min(1, total / bruto) : 1;
    const fiadoShare = total > 0 ? fiadoMonto / total : 0;
    detalles.forEach(det => {
      acumular(ctx, det, {
        cantidad: num(det?.cantidad) || 1,
        ingresos: valorLinea(det) * factor,
        canal: "venta",
        fiadoShare,
        signo: 1,
      });
    });
  };

  // Emparejar venta+fiado de una misma transacción mixta
  const ventasPorFirma = new Map<string, { mov: Movimiento; ms: number; usada: boolean }[]>();
  ventas.forEach(mov => {
    const firma = firmaDetalles(mov.detalles as any[]);
    const lista = ventasPorFirma.get(firma) || [];
    lista.push({ mov, ms: aMs(mov.fecha), usada: false });
    ventasPorFirma.set(firma, lista);
  });

  fiados.forEach(fiado => {
    const firma = firmaDetalles(fiado.detalles as any[]);
    const msF = aMs(fiado.fecha);
    const par = (ventasPorFirma.get(firma) || []).find(
      c => !c.usada &&
        Math.abs(c.ms - msF) <= VENTANA_EMPAREJADO_MS &&
        (c.mov.clienteId || "") === (fiado.clienteId || "")
    );
    if (par) {
      par.usada = true;
      procesarVenta(fiado.detalles as any[], num(par.mov.monto), num(fiado.monto));
    } else {
      procesarVenta(fiado.detalles as any[], 0, num(fiado.monto));
    }
  });

  ventasPorFirma.forEach(lista =>
    lista.forEach(c => {
      if (!c.usada) procesarVenta(c.mov.detalles as any[], num(c.mov.monto), 0);
    })
  );

  // Entregas de separe: mercancía que sale contra abonos acumulados
  movimientos
    .filter(m => m.tipo === "entrega_separe" && conDetalles(m))
    .forEach(m => {
      (m.detalles as any[]).forEach(det => {
        acumular(ctx, det, {
          cantidad: num(det?.cantidad) || 1,
          ingresos: valorLinea(det),
          canal: "separe",
          fiadoShare: 0,
          signo: 1,
        });
      });
    });

  // Devoluciones: restan unidades, ingresos y costo exacto del movimiento origen
  movimientos
    .filter(m => m.tipo === "devolucion" && Array.isArray(m.articulosDevueltos))
    .forEach(m => {
      const origen = m.movimientoOrigenId ? indiceOrigen.get(m.movimientoOrigenId) : undefined;
      (m.articulosDevueltos as any[]).forEach(art => {
        const cantidad = num(art?.cantidad);
        if (cantidad <= 0) return;
        const detOrigen: any = Array.isArray(origen?.detalles) && Number.isInteger(art?.detalleIndex)
          ? (origen!.detalles as any[])[art.detalleIndex]
          : undefined;
        acumular(ctx, { ...detOrigen, ...art, productoId: art?.productoId || detOrigen?.productoId }, {
          cantidad,
          ingresos: num(art?.subtotal) || num(art?.valorUnitario) * cantidad,
          canal: "venta",
          fiadoShare: (m as any).origenTipo === "fiado" ? 1 : 0,
          signo: -1,
          costoUnit: num(detOrigen?.costoUnitario),
        });
      });
    });

  const productos = Array.from(ctx.acc.values())
    .filter(p => p.unidades > 0 || p.ingresos > 0)
    .map(p => {
      const utilidad = p.ingresosConCosto > 0 ? p.ingresosConCosto - p.costo : null;
      const margen = utilidad !== null && p.ingresosConCosto > 0 ? (utilidad / p.ingresosConCosto) * 100 : null;
      return { ...p, utilidad, margen };
    });

  const totalIngresos = productos.reduce((a, p) => a + p.ingresos, 0);
  const totalUnidades = productos.reduce((a, p) => a + p.unidades, 0);
  const totalCosto = productos.reduce((a, p) => a + p.costo, 0);
  const totalIngresosConCosto = productos.reduce((a, p) => a + p.ingresosConCosto, 0);
  const coberturaCosto = totalIngresos > 0 ? Math.min(100, (totalIngresosConCosto / totalIngresos) * 100) : 100;

  return { productos, totalIngresos, totalUnidades, totalCosto, totalIngresosConCosto, coberturaCosto };
}

export interface CategoriaStat {
  clave: string;
  nombre: string;
  productosDistintos: number;
  unidades: number;
  ingresos: number;
  ingresosContado: number;
  ingresosFiado: number;
  ingresosSepare: number;
  costo: number;
  ingresosConCosto: number;
  utilidad: number | null;
  margen: number | null;
  /** Productos de la categoría ordenados por facturación (mayor a menor) */
  productos: ProductoStat[];
}

/**
 * Agrupa los productos por categoría (insensible a mayúsculas/espacios).
 * La suma de las categorías cuadra exactamente con los totales del resumen de productos.
 */
export function agruparPorCategoria(productos: ProductoStat[]): CategoriaStat[] {
  const mapa = new Map<string, CategoriaStat>();
  productos.forEach(p => {
    const clave = norm(p.categoria) || norm(SIN_CATEGORIA);
    let c = mapa.get(clave);
    if (!c) {
      c = {
        clave,
        nombre: p.categoria || SIN_CATEGORIA,
        productosDistintos: 0,
        unidades: 0,
        ingresos: 0,
        ingresosContado: 0,
        ingresosFiado: 0,
        ingresosSepare: 0,
        costo: 0,
        ingresosConCosto: 0,
        utilidad: null,
        margen: null,
        productos: [],
      };
      mapa.set(clave, c);
    }
    c.productosDistintos += 1;
    c.unidades += p.unidades;
    c.ingresos += p.ingresos;
    c.ingresosContado += p.ingresosContado;
    c.ingresosFiado += p.ingresosFiado;
    c.ingresosSepare += p.ingresosSepare;
    c.costo += p.costo;
    c.ingresosConCosto += p.ingresosConCosto;
    c.productos.push(p);
  });

  return Array.from(mapa.values()).map(c => {
    const utilidad = c.ingresosConCosto > 0 ? c.ingresosConCosto - c.costo : null;
    const margen = utilidad !== null && c.ingresosConCosto > 0 ? (utilidad / c.ingresosConCosto) * 100 : null;
    return { ...c, utilidad, margen, productos: c.productos.sort((a, b) => b.ingresos - a.ingresos) };
  });
}
