# Guía Oficial del Comerciante — Capítulo 3: Inventario Maestro (Productos, Alertas de Stock, Escáner y Etiquetas)

> **Manual de Operaciones para el Usuario Final**  
> **Aplica para:** Propietarios de Negocio, Administradores, Supervisores y Encargados de Bodega.  
> **Objetivo:** Tener todo el catálogo de tu tienda organizado, saber exactamente cuántas prendas o artículos te quedan, evitar quedarte sin mercancía e imprimir etiquetas adhesivas profesionales para cobrar en 1 segundo.  
> **Dónde se hace:** En el menú inferior o lateral, tocando el icono de caja **`[ 📦 Inventario ]`**.

---

## 1. Conociendo tu Pantalla de Inventario

Al ingresar a **Inventario**, verás la lista completa de todo lo que vendes en tu negocio. La pantalla está dividida en 3 zonas principales:

1. **La Barra de Búsqueda y Filtros Rápidos (Arriba):**  
   Para encontrar cualquier producto en un segundo escribiendo su nombre, su código o seleccionando una categoría.
2. **Los Filtros de Stock (Pastillas de Color):**  
   * **Todos:** Todo tu catálogo activo.
   * **Con Stock (Verde):** Artículos listos para vender.
   * **Poco Stock (Amarillo):** Alerta de artículos que están a punto de agotarse.
   * **Sin Stock (Gris):** Artículos en cero unidades.
   * **En Déficit (Rojo):** Artículos que se vendieron antes de registrarlos en el sistema (números negativos como `-1` o `-2`).
3. **El Listado de Productos:**  
   * En celular se ve como **tarjetas limpias en 3 filas** cómodas para el pulgar.
   * En computador se ve como una **tabla completa** con columnas de precio, costo, stock y acciones.

---

## 2. Cómo Crear un Producto Nuevo (Paso a Paso)

Para ingresar un nuevo artículo a tu catálogo:

```
[ PASO A PASO: CREAR PRODUCTO ]
 1. En la pantalla de Inventario, toca el botón verde arriba a la derecha:
    [ + Nuevo Producto ] o [ + Agregar ].
 2. Se abrirá el formulario de creación.
 3. Completa los datos básicos del producto (explicados abajo).
 4. Toca el botón verde [ Guardar Producto ].
 5. ¡Listo! El artículo ya queda disponible para vender en caja.
```

---

### Campos del Formulario de Producto:

* **Nombre del Producto (Obligatorio):**  
  * Escribe el nombre con el que tus clientes y vendedores lo conocen.  
  * *Recomendación:* Incluye un detalle clave si aplica (ej: `Jean Clásico Azul Dama`, `Labial Mate Tono 04`, `Gaseosa Postobón 1.5L`).
* **Código de Barras o SKU (Identificador Único):**  
  * Es el código que se leerá al escanear. Tienes 3 opciones para llenarlo:
    1. **Si el producto ya trae código de fábrica:** Toca el botón **`[ 📷 Escanear ]`** y apunta la cámara al código de barras del paquete; el número se escribirá solo.
    2. **Si es mercancía propia (ropa, confección, etc.):** Toca el botón **`[ ✨ Auto ]`** y Fiabono le inventará un código único alfanumérico automático.
    3. **Escribirlo a mano:** Puedes inventar tu propia referencia (ej: `JEAN-01`, `BLUSA-ROJA-M`).
* **Categoría (Obligatorio):**  
  * Selecciona a qué grupo pertenece (ej: *Pantalones, Blusas, Calzado, Bebidas*).  
  * *¿Quieres crear una categoría nueva?:* Escribe el nombre nuevo y el sistema la creará inmediatamente.
* **Precio de Venta al Público (Obligatorio):**  
  * El precio final al que le vendes al cliente (ej: `$45.000`). No te preocupes por los puntos o signos de pesos; el sistema los formatea solo.
* **Costo de Compra (Confidencial / Opcional):**  
  * Cuánto te costó comprar esa prenda al fabricante o proveedor (ej: `$22.000`).  
  * *Privacidad total:* Tus empleados **nunca verán este número** si no tienen el permiso de ver costos. Solo le sirve al dueño para que en la sección de Reportes el sistema calcule tu **Ganancia Neta Real**.
* **Stock Inicial (Cantidad Física):**  
  * Cuántas unidades tienes en tu tienda en este momento (ej: `12`).
* **Stock Mínimo (Alerta de Reabastecimiento):**  
  * La cantidad de seguridad (ej: `3`). Cuando te queden 3 unidades o menos, el producto se pintará de amarillo para avisarte que debes pedirle más al proveedor antes de quedarte sin nada.
* **Foto del Producto (Opcional pero muy recomendada):**  
  * Toca el recuadro de imagen para tomarle una foto con la cámara de tu celular o elegirla de la galería.  
  * Tener foto ayuda a que los cajeros nuevos identifiquen la prenda de inmediato sin confundirse.

---

## 3. ¿Cómo Funciona la Tarjeta de Producto en el Celular?

Para que tus vendedores atiendan a toda velocidad sin enredos, cada tarjeta de producto en el teléfono tiene **3 niveles claros**:

```
┌────────────────────────────────────────────────────────┐
│ [ ] 🖼️ Jean Clásico Azul Dama                $85.000   │  <- Fila 1: Nombre y Precio
│     SKU: JEAN-0412                                     │
├────────────────────────────────────────────────────────┤
│ [ ✅ 18 un. ]  [ Ropa Dama ]              [ ✏️ ] [ 🗑️ ] │  <- Fila 2: Stock y Edición
├────────────────────────────────────────────────────────┤
│  [ 🛒 Vender ]       [ 🏷️ Fiar ]       [ 🔖 Separe ]   │  <- Fila 3: Botones de Acción
└────────────────────────────────────────────────────────┘
```

* **Fila 1:** El nombre claro del producto, su foto ampliable y el precio destacado en verde.
* **Fila 2:** Cuántas unidades te quedan en bodega (`18 un.`), la categoría y los botones de editar (`✏️`) o borrar (`🗑️`).
* **Fila 3 (Botones táctiles grandes):**
  * Toca **`[ 🛒 Vender ]`** para mandarlo directo a la caja de cobro de contado.
  * Toca **`[ 🏷️ Fiar ]`** para despacharlo a crédito a un cliente deudor.
  * Toca **`[ 🔖 Separe ]`** para apartárselo a un cliente con anticipo.

---

## 4. Escáner Rápido de Entrada de Mercancía (+1 y Lotes)

Cuando te llega una caja grande de fábrica con 50 prendas o productos, ingresarlos uno por uno a mano toma mucho tiempo. Para eso existe el **Escáner Rápido de Mercancía**:

1. En Inventario, toca el botón que dice **`[ 📷 Escaneo Rápido ]`**.
2. Se abrirá la cámara de tu celular en pantalla completa.
3. Elige tu modo de trabajo arriba:
   * **Modo Continuo (+1 al inventario):** Cada vez que pases un código frente a la cámara, el sistema hace un sonido "Beep" y le suma 1 unidad al stock automáticamente. Ideal para pasar prendas una tras otra.
   * **Modo Lote (Preguntar cantidad):** Escaneas una sola prenda y la pantalla te pregunta: *¿Cuántas unidades llegaron?*. Escribes `24` y le suma las 24 de un solo golpe.

> 💡 **Consejos de Escaneo con el Celular:**  
> * **Distancia ideal:** Mantén el teléfono a **15 o 20 cm de distancia** (la distancia de una cuarta de mano). No pegues la cámara a la etiqueta para no desenfocar la imagen.  
> * **Botón Zoom (`🔍 2x`):** Si el código es muy chiquito, toca el botón de Zoom arriba a la derecha en lugar de acercar la mano.  
> * **Botón Linterna (`💡`):** Si estás en una bodega oscura, enciende la linterna de la cámara con ese botón.

---

## 5. Selección Masiva y Barra Flotante de Acciones

Si quieres despachar varios productos al mismo tiempo o imprimir etiquetas de varias prendas juntas:

1. Toca la casilla cuadrada blanca (`[ ]`) a la izquierda de cada producto que quieras seleccionar.
2. Al seleccionar el primer producto, aparecerá una **Barra Flotante Oscura** en la parte inferior de tu pantalla.
3. La barra te mostrará:
   * Cuántos productos llevas seleccionados (ej: `3 seleccionados`).
   * La suma total de dinero de esos productos (ej: `Total: $240.000`).
4. **Botones de la Barra Flotante:**
   * **`[ Vender (3) ]`:** Manda todos los productos seleccionados al carrito de venta de contado de un solo golpe.
   * **`[ Fiar (3) ]`:** Se los asigna a la cuenta de crédito de un cliente.
   * **`[ Separar (3) ]`:** Los manda al módulo de Plan Separe.
   * **`[ Etiquetas (3) ]`:** Abre el asistente de impresión para generar los códigos adhesivos de esos artículos.
   * **`[ ✕ ]`:** Cancela la selección múltiple.

---

## 6. Generador de Etiquetas Adhesivas (Código QR vs. Código de Barras)

Una de las joyas de Fiabono es que puedes generar tus propias etiquetas adhesivas con el nombre de tu tienda, el nombre de la prenda, el precio de venta y su código escaneable, listas para pegar en ganchos de ropa, cajas o estanterías.

### ¿Cómo imprimir etiquetas?
1. Selecciona los productos con las casillas o toca el botón **`[ 🖨️ Etiquetas ]`** arriba en el menú de herramientas.
2. Se abrirá el asistente de exportación de etiquetas:

```
[ ASISTENTE DE ETIQUETAS ADHESIVAS ]
 1. ¿Qué tipo de código prefieres?
    - 🟢 Código QR (2D) [Recomendado]: 
      Lectura instantánea con cualquier celular y pistolas ópticas 2D. 
      Lee torcido, en diagonal o a cualquier distancia.
    - 🔵 Código de Barras (1D / Líneas tradicionales): 
      El formato tradicional de líneas paralelas para cajas con pistolas 
      láser de raya roja.
 2. ¿En qué impresora vas a imprimir?
    - Impresora Térmica en Rollo (Jaltech, Xprinter, POS): 
      Para rollos adhesivos de 40x30 mm o 50x30 mm.
    - Impresora Convencional (Hoja Carta de Oficina): 
      Genera un archivo PDF con una cuadrícula de etiquetas para imprimir 
      en hojas adhesivas tamaño carta y recortar.
 3. Elige cuántas copias quieres de cada etiqueta.
 4. Toca [ Imprimir Etiquetas ] o [ Descargar PDF ].
```

---

## 7. Importar y Exportar en Excel (Cargas Masivas)

Si ya tienes un inventario de 500 productos anotado en un archivo de Excel en tu computador:

* **Para subirlos todos en 3 segundos:**  
  1. En Inventario, toca el menú de herramientas (`SlidersHorizontal`) y elige **"Importar desde Excel"**.
  2. Descarga la **Plantilla Oficial de Ejemplo** en Excel para que veas las columnas requeridas (*Nombre, SKU, Categoría, Precio Venta, Costo, Stock*).
  3. Pega tus productos en esa plantilla y súbela. En un parpadeo todo tu inventario quedará cargado en el sistema.
* **Para descargar tu catálogo:**  
  Toca **"Exportar a Excel"** y se descargará un archivo `.xlsx` limpio con todo tu stock actualizado para revisiones contables.
