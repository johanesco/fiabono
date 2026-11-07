export interface LoteCostoItem {
  id: string;
  cantidad: number;
  cantidadInicial: number;
  costoUnitario: number;
  fecha: string;
  proveedor?: string | null;
}

/**
 * Normaliza y sincroniza los lotes de costo de un producto con su stock actual.
 * Garantiza que productos antiguos sin `lotesCosto` tengan su lote base intacto
 * y que la suma de unidades en lotes coincida siempre con Math.max(0, stockActual).
 */
export function obtenerLotesNormalizados(productoActual: any): LoteCostoItem[] {
  const stockActual = Math.max(0, Math.round(Number(productoActual?.stock) || 0));
  const costoBase = Math.max(0, Number(productoActual?.costoCompra) || 0);
  const lotesRaw = Array.isArray(productoActual?.lotesCosto) ? productoActual.lotesCosto : [];

  const lotesValidos: LoteCostoItem[] = lotesRaw
    .map((l: any, idx: number) => ({
      id: typeof l?.id === 'string' && l.id ? l.id : `lote_${idx}_${Date.now()}`,
      cantidad: Math.max(0, Math.round(Number(l?.cantidad) || 0)),
      cantidadInicial: Math.max(1, Math.round(Number(l?.cantidadInicial || l?.cantidad) || 1)),
      costoUnitario: Math.max(0, Number(l?.costoUnitario) || 0),
      fecha: typeof l?.fecha === 'string' && l.fecha ? l.fecha : new Date().toISOString(),
      ...(typeof l?.proveedor === 'string' && l.proveedor.trim() ? { proveedor: l.proveedor.trim() } : {}),
    }))
    .filter((l: LoteCostoItem) => l.cantidad > 0);

  if (stockActual === 0) {
    return [];
  }

  if (lotesValidos.length === 0) {
    return [
      {
        id: `lote_base_${Date.now()}`,
        cantidad: stockActual,
        cantidadInicial: stockActual,
        costoUnitario: costoBase,
        fecha: new Date().toISOString(),
      },
    ];
  }

  const sumaLotes = lotesValidos.reduce((acc, l) => acc + l.cantidad, 0);

  if (sumaLotes < stockActual) {
    const faltante = stockActual - sumaLotes;
    // Si el primer lote tiene el mismo costo base, sumarlo ahí; si no, agregarlo al inicio
    if (lotesValidos[0].costoUnitario === costoBase) {
      lotesValidos[0] = {
        ...lotesValidos[0],
        cantidad: lotesValidos[0].cantidad + faltante,
        cantidadInicial: Math.max(lotesValidos[0].cantidadInicial, lotesValidos[0].cantidad + faltante),
      };
    } else {
      lotesValidos.unshift({
        id: `lote_prev_${Date.now()}`,
        cantidad: faltante,
        cantidadInicial: faltante,
        costoUnitario: costoBase,
        fecha: new Date().toISOString(),
      });
    }
  } else if (sumaLotes > stockActual) {
    // Recortar de los lotes más antiguos (PEPS) para igualar al stockActual
    let exceso = sumaLotes - stockActual;
    const ajustados: LoteCostoItem[] = [];
    for (const lote of lotesValidos) {
      if (exceso <= 0) {
        ajustados.push(lote);
      } else if (lote.cantidad <= exceso) {
        exceso -= lote.cantidad;
      } else {
        ajustados.push({
          ...lote,
          cantidad: lote.cantidad - exceso,
        });
        exceso = 0;
      }
    }
    return ajustados;
  }

  return lotesValidos;
}

/**
 * Registra una nueva entrada de mercancía como un lote PEPS independiente (sin mezclar costos).
 */
export function agregarLoteEntrada(
  productoActual: any,
  cantidadAgregada: number,
  nuevoCostoUnitario: number,
  proveedor?: string | null
): {
  lotesActualizados: LoteCostoItem[];
  costoCompraActivo: number;
} {
  const cant = Math.max(0, Math.round(Number(cantidadAgregada) || 0));
  const costoAnterior = Math.max(0, Number(productoActual?.costoCompra) || 0);
  const costoNuevo = Number(nuevoCostoUnitario) > 0 ? Math.max(0, Number(nuevoCostoUnitario)) : costoAnterior;
  const provLimpio = typeof proveedor === 'string' && proveedor.trim() ? proveedor.trim().slice(0, 80) : null;

  const lotes = obtenerLotesNormalizados(productoActual);

  if (cant > 0) {
    const ultimo = lotes[lotes.length - 1];
    if (ultimo && ultimo.costoUnitario === costoNuevo && (!provLimpio || !ultimo.proveedor || ultimo.proveedor === provLimpio)) {
      ultimo.cantidad += cant;
      ultimo.cantidadInicial += cant;
      if (provLimpio) ultimo.proveedor = provLimpio;
    } else {
      lotes.push({
        id: `lote_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        cantidad: cant,
        cantidadInicial: cant,
        costoUnitario: costoNuevo,
        fecha: new Date().toISOString(),
        ...(provLimpio ? { proveedor: provLimpio } : {}),
      });
    }
  }

  const costoCompraActivo = lotes.length > 0 ? lotes[0].costoUnitario : costoNuevo;
  return {
    lotesActualizados: lotes,
    costoCompraActivo,
  };
}

/**
 * Ajusta los lotes cuando el administrador edita manualmente el stock o el costo total del producto.
 */
export function ajustarLotesEnEdicionManual(
  productoActual: any,
  nuevoStock: number,
  nuevoCosto: number,
  proveedor?: string | null
): {
  lotesActualizados: LoteCostoItem[];
  costoCompraActivo: number;
} {
  const stockActual = Math.max(0, Math.round(Number(productoActual?.stock) || 0));
  const stockFinal = Math.max(0, Math.round(Number(nuevoStock) || 0));
  const costoAnterior = Math.max(0, Number(productoActual?.costoCompra) || 0);
  const costoFinal = Number(nuevoCosto) >= 0 ? Number(nuevoCosto) : costoAnterior;

  // Si aumentó el stock, se trata como una nueva entrada por la diferencia
  if (stockFinal > stockActual) {
    return agregarLoteEntrada(productoActual, stockFinal - stockActual, costoFinal, proveedor);
  }

  // Si el stock se mantuvo o disminuyó:
  const lotes = obtenerLotesNormalizados({ ...productoActual, stock: stockFinal });
  // Si el usuario cambió manualmente el costo sin subir el stock (corrección de costo en ficha)
  if (costoFinal !== costoAnterior && lotes.length > 0) {
    lotes[0] = {
      ...lotes[0],
      costoUnitario: costoFinal,
    };
  }

  return {
    lotesActualizados: lotes,
    costoCompraActivo: lotes.length > 0 ? lotes[0].costoUnitario : costoFinal,
  };
}

/**
 * Consume unidades siguiendo PEPS / FIFO (del lote más antiguo al más reciente).
 * Devuelve el costo unitario real exacto de las unidades vendidas y los lotes restantes.
 */
export function consumirLotesPEPS(
  productoActual: any,
  cantidadVendida: number
): {
  lotesActualizados: LoteCostoItem[];
  costoUnitarioVenta: number;
  nuevoCostoCompraActivo: number;
} {
  const cant = Math.max(1, Math.round(Number(cantidadVendida) || 1));
  const costoFallback = Math.max(0, Number(productoActual?.costoCompra) || 0);
  const lotes = obtenerLotesNormalizados(productoActual);

  if (lotes.length === 0) {
    return {
      lotesActualizados: [],
      costoUnitarioVenta: costoFallback,
      nuevoCostoCompraActivo: costoFallback,
    };
  }

  let porConsumir = cant;
  let costoTotalAcumulado = 0;
  let ultimoCostoVisto = costoFallback;
  const lotesRestantes: LoteCostoItem[] = [];

  for (const lote of lotes) {
    ultimoCostoVisto = lote.costoUnitario;
    if (porConsumir <= 0) {
      lotesRestantes.push(lote);
      continue;
    }

    if (lote.cantidad <= porConsumir) {
      costoTotalAcumulado += lote.cantidad * lote.costoUnitario;
      porConsumir -= lote.cantidad;
    } else {
      costoTotalAcumulado += porConsumir * lote.costoUnitario;
      lotesRestantes.push({
        ...lote,
        cantidad: lote.cantidad - porConsumir,
      });
      porConsumir = 0;
    }
  }

  // Si se vendió más del stock disponible (stock en negativo), valorar el excedente al último costo conocido
  if (porConsumir > 0) {
    costoTotalAcumulado += porConsumir * ultimoCostoVisto;
  }

  const costoUnitarioVenta = Math.round(costoTotalAcumulado / cant);
  const nuevoCostoCompraActivo =
    lotesRestantes.length > 0 ? lotesRestantes[0].costoUnitario : ultimoCostoVisto;

  return {
    lotesActualizados: lotesRestantes,
    costoUnitarioVenta,
    nuevoCostoCompraActivo,
  };
}

/**
 * Restaura unidades al anular o devolver una venta, devolviéndolas al lote de su costo original.
 */
export function restaurarLoteDevolucion(
  productoActual: any,
  cantidadDevuelta: number,
  costoUnitarioDevuelto?: number
): {
  lotesActualizados: LoteCostoItem[];
  nuevoCostoCompraActivo: number;
} {
  const cant = Math.max(0, Math.round(Number(cantidadDevuelta) || 0));
  const costoFallback = Math.max(0, Number(productoActual?.costoCompra) || 0);
  const costoRestaurar =
    Number(costoUnitarioDevuelto) > 0 ? Number(costoUnitarioDevuelto) : costoFallback;

  const lotes = obtenerLotesNormalizados(productoActual);
  if (cant <= 0) {
    return {
      lotesActualizados: lotes,
      nuevoCostoCompraActivo: lotes.length > 0 ? lotes[0].costoUnitario : costoFallback,
    };
  }

  const idxCoincidente = lotes.findIndex((l) => l.costoUnitario === costoRestaurar);
  if (idxCoincidente >= 0) {
    lotes[idxCoincidente] = {
      ...lotes[idxCoincidente],
      cantidad: lotes[idxCoincidente].cantidad + cant,
      cantidadInicial: Math.max(
        lotes[idxCoincidente].cantidadInicial,
        lotes[idxCoincidente].cantidad + cant
      ),
    };
  } else {
    // Se inserta al inicio porque corresponde a unidades de una venta previa (lote anterior)
    lotes.unshift({
      id: `lote_dev_${Date.now()}`,
      cantidad: cant,
      cantidadInicial: cant,
      costoUnitario: costoRestaurar,
      fecha: new Date().toISOString(),
    });
  }

  return {
    lotesActualizados: lotes,
    nuevoCostoCompraActivo: lotes.length > 0 ? lotes[0].costoUnitario : costoRestaurar,
  };
}

/**
 * Calcula el valor total al costo de un producto sumando cada lote individualmente.
 */
export function calcularValorCostoProducto(producto: any): number {
  if (!producto || producto.inventariable === false || producto.tipoProducto === 'servicio') {
    return 0;
  }
  const stock = Math.max(0, Number(producto.stock) || 0);
  if (stock <= 0) return 0;

  const lotes = obtenerLotesNormalizados(producto);
  if (lotes.length > 0) {
    return lotes.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
  }
  return stock * (Math.max(0, Number(producto.costoCompra)) || 0);
}
