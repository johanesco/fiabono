# Guía Oficial del Comerciante — Capítulo 9: Historial de Movimientos y Auditoría Antifraude

> **Manual de Operaciones para el Usuario Final**  
> **Aplica para:** Propietarios de Negocio, Administradores y Cajeros con permisos de consulta.  
> **Objetivo:** Consultar en tiempo real la bitácora inmutable de todo lo que ocurre en la tienda (ventas, abonos, fiados, separes, ingresos de mercancía y cierres), buscar recibos pasados, reimprimir tickets, reenviar comprobantes por WhatsApp y anular operaciones de manera segura y transparente.  
> **Dónde se hace:** En el menú inferior o lateral, tocando el icono de reloj o lista **`[ 📜 Historial ]`**.

---

## 1. ¿Qué es el Historial de Movimientos en Fiabono?

El **Historial** es la caja negra y el libro contable digital de tu negocio. Cada vez que alguien cobra una venta, recibe un billete por abono, entrega una prenda de separe, carga mercancía nueva al inventario o cierra la caja, el sistema registra un **Movimiento Inmutable**.

### ¿Por qué protege a tu negocio contra fraudes y pérdidas?
* **Ninguna transacción se borra a escondidas:** Si un cajero se equivoca y anula una venta, la venta original no desaparece mágicamente; queda marcada visiblemente como `[ ANULADA ]` con el motivo, la hora exacta y el nombre de quien la anuló.
* **Trazabilidad de cada peso:** Sabes exactamente qué vendedor atendió a qué cliente, qué prendas se llevaron, a qué hora exacta pagaron y por qué medio (Efectivo, Nequi, Daviplata, Bancolombia o Mixto).
* **Solución de reclamos de clientes en 5 segundos:** Si un comprador regresa diciendo *"Ayer vine y me cobraron de más"* o *"Perdí mi recibo"*, solo buscas su nombre o número de ticket y tienes en pantalla el comprobante completo.

---

## 2. Pantalla Principal del Historial y sus Herramientas de Búsqueda

Al ingresar a **`Historial`**, encontrarás arriba una barra de herramientas completa diseñada para encontrar cualquier movimiento rápidamente:

```
┌────────────────────────────────────────────────────────┐
│  📜 HISTORIAL DE MOVIMIENTOS                           │
├────────────────────────────────────────────────────────┤
│  🔍 [ Buscar por ticket #, cliente o producto...     ] │
│                                                        │
│  📅 PERÍODO:                                           │
│  [ Hoy ]  [ Ayer ]  [ Esta Semana ]  [ Este Mes ] [Todos]
│                                                        │
│  🏷️ TIPO DE OPERACIÓN:                                 │
│  [ Todos ] [ Ventas ] [ Abonos ] [ Separes ] [ Fiados ]│
│  [ Devoluciones ] [ Entradas Inv. ] [ Cierres Caja ]   │
│                                                        │
│  👤 VENDEDOR: [ Todos los Colaboradores ▼ ]            │
└────────────────────────────────────────────────────────┘
```

### A. Buscador Universal Rápido
Escribe en el campo de texto:
* **El número del ticket:** Por ejemplo `#1045` o simplemente `1045`.
* **El nombre o apellido del cliente:** Por ejemplo `Camila` o `Pérez`.
* **El nombre del producto:** Por ejemplo `Jean Flare`.

### B. Filtros de Tiempo
* **Hoy:** Movimientos ocurridos desde las 00:00 del día en curso (ideal para monitorear el turno actual).
* **Ayer:** Transacciones del día anterior (perfecto para revisar el turno de la noche previa).
* **Esta Semana:** Los últimos 7 días.
* **Este Mes:** Todo el mes calendario actual.
* **Todos:** Registro histórico completo del negocio.

### C. Filtros por Tipo de Movimiento
Si solo necesitas revisar ciertas operaciones específicas, toca la pastilla correspondiente:
1. **Ventas:** Solo compras de contado liquidadas en mostrador.
2. **Abonos:** Recaudos de dinero recibidos para pagar fiados pendientes.
3. **Separes:** Creación de planes separe o entregas finales de prendas apartadas.
4. **Fiados:** Salidas de mercancía a crédito sin cobro total.
5. **Devoluciones / Anulaciones:** Operaciones canceladas o reversadas.
6. **Entradas de Inventario:** Lotes de prendas ingresados desde compras a proveedores.
7. **Cierres de Caja:** Resúmenes de los arqueos y cierres de turno realizados.

### D. Filtro por Colaborador / Vendedor
Si tienes 2 o más cajeros o vendedores, puedes filtrar para ver únicamente los movimientos realizados por una persona específica (útil para auditorías individuales de turno o cálculo de comisiones).

---

## 3. Anatomía de una Tarjeta de Movimiento

Cada renglón o tarjeta del historial te muestra de un vistazo toda la información clave:

```
┌────────────────────────────────────────────────────────┐
│ 🟢 VENTA CONTADO  #1048            Hace 12 min (3:45 PM)│
├────────────────────────────────────────────────────────┤
│ 👤 Vendedor: Andrés Gómez (Caja Principal)             │
│ 🛍️ Cliente: María Fernanda Castro                     │
│ 🏷️ Artículos: 2 prendas (Blusa Seda x1, Jean Talle x1) │
│ 💳 Medio de Pago: Nequi ($80.000) + Efectivo ($40.000) │
│                                                        │
│ 💰 TOTAL: $120.000 COP                                 │
├────────────────────────────────────────────────────────┤
│ [ 👁️ Ver Detalle ]  [ 🖨️ Ticket ]  [ 📲 WhatsApp ] [ ✕ ]│
└────────────────────────────────────────────────────────┘
```

### Colores de los Distintivos (Badges)
* **🟢 Verde:** Venta de contado pagada exitosamente.
* **🔵 Azul:** Abono a crédito o anticipo de dinero recibido.
* **🟣 Morado:** Plan Separe registrado.
* **🟠 Naranja / Ámbar:** Fiado (crédito nuevo otorgado).
* **🔴 Rojo con tachado:** Movimiento Anulado o Devolución.
* **🟡 Mostaza:** Ingreso de mercancía o cierre de caja auditado.

---

## 4. Acciones Disponibles en Cada Movimiento

Al tocar los botones de la tarjeta del movimiento, tienes 4 opciones clave:

### 1. `[ 👁️ Ver Detalle ]` (Comprobante de Mostrador)
Abre una ventana emergente con el desglose exacto de la operación:
* Cada prenda vendida con su talla, color, SKU, precio unitario y cantidad.
* Descuentos aplicados (en porcentaje o en dinero).
* Dinero recibido del cliente y cambio/vuelto entregado.
* Notas internas agregadas durante la venta.

### 2. `[ 🖨️ Ticket ]` (Reimpresión Térmica)
Si la impresora se quedó sin papel durante la venta, o el cliente solicita un duplicado de su factura:
* Toca **`[ 🖨️ Ticket ]`**.
* Selecciona tu impresora térmica (Bluetooth, USB o Wi-Fi) o imprime en PDF estándar.
* El ticket saldrá exactamente igual al original, con tu logo, datos de contacto y fecha original de compra.

### 3. `[ 📲 WhatsApp ]` (Reenvío Digital de Comprobante)
Si el cliente olvidó pedir el recibo al salir del local o te escribe por WhatsApp pidiendo su comprobante:
* Toca el botón verde **`[ 📲 WhatsApp ]`**.
* Se abrirá automáticamente una conversación en WhatsApp con el cliente prellenada con el resumen de la compra y el enlace público oficial:
  > `https://fiabono.com/t/TICKET_ID`
* El cliente podrá abrir el enlace desde su teléfono, ver su ticket interactivo con colores y descargarlo en PDF.

---

## 5. Anulaciones y Devoluciones Seguras (Reglas de Control Interno)

En el comercio físico ocurren equivocaciones: un cajero marcó 2 blusas en vez de 1, el cliente se arrepintió antes de salir o la prenda salió defectuosa.

> [!IMPORTANT]
> **Seguridad y Permisos:**  
> Por defecto, los cajeros **NO pueden anular ventas** a menos que el Dueño les active el permiso explícito `Hacer Devoluciones` en la gestión de colaboradores. Si no tienen el permiso, el botón de anulación estará oculto o bloqueado con candado.

### ¿Cómo anular una venta correctamente?
1. Ubica la venta en el **Historial**.
2. Toca el botón rojo **`[ ✕ Anular / Devolución ]`**.
3. Se abrirá una ventana de confirmación donde el sistema te preguntará:
   * **Motivo de la anulación:** (Por ejemplo: *"Error de digitación en mostrador"*, *"Cliente cambió de parecer"*, *"Cambio por garantía"*).
4. Confirma la operación.

### ¿Qué ocurre internamente en Fiabono cuando anulas una venta?
El sistema ejecuta 3 acciones automáticas simultáneas para que la tienda quede perfectamente cuadrada:

| Aspecto | Qué hace el sistema |
| :--- | :--- |
| **📦 Inventario Físico** | Las prendas vendidas **regresan automáticamente al stock disponible**. Si el Jean tenía stock `0`, vuelve a tener `1` unidad lista para venderse en vitrina. |
| **💵 Dinero en Caja** | El monto cobrado **se resta del arqueo de caja del día**. Si se cobró en Efectivo, se descuenta del efectivo esperado para que la caja nocturna no presente sobrantes falsos. Si fue Nequi, se descuenta de bancos. |
| **🛡️ Auditoría Contable** | El movimiento original no se borra. Cambia su estado a **`ANULADO`**, registra la fecha/hora de la anulación y el nombre de quien la autorizó. |

---

## 6. ¿Cómo anular un Abono Mal Registrado?

Si un cajero digitó que el cliente abonó `$500.000` en lugar de `$50.000`:
1. Filtra por **`[ Abonos ]`** en el Historial.
2. Localiza el abono erróneo del cliente.
3. Toca **`[ ✕ Anular Abono ]`**.
4. Escribe el motivo del error.
5. Al confirmar:
   * **La deuda del cliente se restaura automáticamente:** El saldo pendiente vuelve a aumentar por el valor que se había descontado indebidamente.
   * **El dinero se retira de la caja:** La base de recaudos del día se actualiza de inmediato.

---

## 7. Consejos de Auditoría Rápida para el Dueño del Negocio

1. **Revisión antes del almuerzo y al cierre de la noche:** Entra a **`Historial`**, filtra por **`Hoy`** y luego por **`Devoluciones / Anuladas`**. Si ves anulaciones, pregúntale de inmediato al cajero el motivo para evitar fugas de mercancía.
2. **Cruzar Nequi/Daviplata contra la app del banco:** Si el historial muestra 8 ventas por Nequi sumando `$350.000`, abre la app de tu celular bancario y verifica que los 8 movimientos de entrada estén reflejados con el mismo monto.
3. **Cargar más movimientos:** Por defecto, el historial carga las últimas 15 transacciones para máxima velocidad. Si necesitas ver transacciones más antiguas de la semana, desliza hacia abajo y toca el botón azul **`[ Cargar más movimientos ]`**.
