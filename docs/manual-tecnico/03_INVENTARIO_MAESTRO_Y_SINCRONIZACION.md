# Manual Técnico Fiabono — Capítulo 3: Inventario Maestro, SKU y Sincronización Transaccional

> **Versión del Sistema:** Fiabono v1.0 (Producción)  
> **Propósito:** Documentación técnica de arquitectura, modelo de datos de Firestore, reglas de concurrencia ACID, motor de códigos QR/1D e ingesta masiva para el Agente RAG.  
> **Ubicación en Código:** `servicios/db.ts`, `app/dashboard/inventario/page.tsx`, `utils/analiticaProductos.ts`.

---

## 1. Arquitectura de Inventario y Control de Stock Concurrente

Fiabono gestiona inventarios minoristas en alta concurrencia (múltiples cajeros vendiendo simultáneamente la misma prenda). Para garantizar integridad sin sobreventas (*overselling*):

1. **Lecturas y Escrituras Atómicas:** Todas las salidas e ingresos de mercancía se procesan mediante `runTransaction(db, ...)` en Google Cloud Firestore.
2. **Productos vs Servicios:** El sistema admite ítems inventariables (prendas con control de stock) e ítems no inventariables o intangibles (`tipoProducto: 'servicio'`, por ejemplo composturas, arreglos de sastrería o domicilios).
3. **Escaneo Dual Híbrido:**
   * **QR (2D):** Código bidimensional denso que incluye el SKU. Optimizado para cámaras de celulares comunes sin láser físico.
   * **Code 128 (1D):** Código de barras tradicional horizontal para pistolas lectoras USB/Bluetooth industriales.

---

## 2. Modelo de Datos Firestore: Colección `inventario`

Ruta del documento: `/inventario/{productoId}`

### Esquema del Documento (JSON / Firestore)

```typescript
export interface ProductoInventario {
  id: string;                     // ID autogenerado de Firestore
  usuarioId: string;              // Tenant ID (cuentaPrincipalId del negocio)
  codigo: string;                 // SKU único del producto (ej: "JEA-BLU-32" o autogenerado)
  nombre: string;                 // Nombre comercial de la prenda (ej: "Jean Bota Campana")
  precio: number;                 // Precio de venta al público en COP
  costoUnitario?: number;         // Costo de compra al proveedor (Oculto para cajeros)
  stock: number;                  // Unidades disponibles en vitrina
  stockMinimo?: number;           // Umbral de alerta de stock bajo (por defecto: 2)
  categoria: string;              // Categoría comercial (Damas, Caballeros, Calzado, etc.)
  talla?: string;                 // Talla de la prenda (S, M, L, XL, 28, 30, etc.)
  color?: string;                 // Color de la referencia
  
  // Tipología
  tipoProducto?: 'producto' | 'servicio'; // 'servicio' no descuenta existencias
  inventariable?: boolean;        // true por defecto
  
  // Metadatos
  creadoEn: Timestamp;
  actualizadoEn: Timestamp;
  ultimoIngreso?: Timestamp;
}
```

---

## 3. Transacciones Atómicas de Stock (`servicios/db.ts`)

En Firestore, una transacción exige que **todas las lecturas se ejecuten antes de cualquier escritura**. El motor de Fiabono sigue rigurosamente este patrón:

```typescript
await runTransaction(db, async (transaction) => {
  // 1. FASE DE LECTURA: Verificar existencias de todos los ítems del carrito
  const stockDocsMap = new Map<string, any>();
  
  for (const item of itemsInventario) {
    const prodRef = doc(db, "inventario", item.productoId);
    const prodSnap = await transaction.get(prodRef);
    
    if (!prodSnap.exists()) {
      throw new Error(`El producto ${item.productoId} fue eliminado por otro usuario.`);
    }
    
    const data = prodSnap.data();
    const stockActual = Number(data.stock || 0);
    
    if (data.tipoProducto !== 'servicio' && data.inventariable !== false) {
      if (item.cantidad > stockActual) {
        throw new Error(`Sin stock suficiente de "${data.nombre}". Solicitado: ${item.cantidad}, Quedan: ${stockActual}`);
      }
    }
    stockDocsMap.set(item.productoId, { ref: prodRef, stockActual });
  }

  // 2. FASE DE ESCRITURA: Decrementar inventario atómicamente
  for (const item of itemsInventario) {
    const { ref } = stockDocsMap.get(item.productoId);
    transaction.update(ref, {
      stock: increment(-item.cantidad),
      actualizadoEn: serverTimestamp()
    });
  }

  // 3. Crear el documento de Movimiento de Venta
  const movRef = doc(collection(db, "movimientos"));
  transaction.set(movRef, payloadMovimiento);
});
```

---

## 4. Algoritmo de Semáforo de Stock (`utils/analiticaProductos.ts`)

La interfaz móvil clasifica el estado visual de cada producto mediante 4 umbrales en tiempo real:

$$\text{Estado de Stock} = 
\begin{cases} 
\textbf{Rojo (Déficit)} & \text{si } \text{stock} < 0 \\
\textbf{Gris (Agotado)} & \text{si } \text{stock} == 0 \\
\textbf{Amarillo (Bajo)} & \text{si } 0 < \text{stock} \le \text{stockMinimo (default: 2)} \\
\textbf{Verde (Óptimo)} & \text{si } \text{stock} > \text{stockMinimo}
\end{cases}$$

---

## 5. Ingesta Masiva desde Excel (`xlsx`)

Cuando un comercio importa cientos de referencias desde su archivo Excel:
1. El archivo se parsea en el navegador del cliente mediante la librería `xlsx`.
2. Se ejecuta una validación estricta de columnas: `NOMBRE`, `PRECIO`, `STOCK`, `CODIGO` y `COSTO`.
3. Para evitar superar el límite de 500 operaciones por lote de Google Cloud Firestore, el motor divide el array en **chunks de 400 documentos** y los persiste secuencialmente usando `writeBatch(db)`.

---

## 6. Base de Conocimiento para el Agente RAG (Preguntas y Diagnóstico)

### `Q-INV-01`: ¿Cómo responde el agente si el comerciante pregunta por qué el stock está en negativo (-1)?
* **Explicación del Agente:**
  Fiabono permite continuar vendiendo en mostrador incluso si el sistema reporta existencias en cero, evitando frenar una venta física cuando la prenda acaba de llegar a la tienda y aún no ha sido digitada en el sistema. Al registrar la compra de mercancía, el saldo se normalizará automáticamente.

### `Q-INV-02`: ¿Qué sucede con el stock cuando se anula una venta?
* **Lógica del Sistema:**
  El sistema ejecuta una transacción inversa `increment(+cantidad)`, devolviendo exactamente las unidades al documento del producto en `/inventario/{productoId}`.
