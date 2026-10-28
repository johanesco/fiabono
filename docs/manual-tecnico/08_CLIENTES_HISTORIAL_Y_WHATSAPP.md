# Manual Técnico Fiabono — Capítulo 8: Clientes, Historial, Cobranza por WhatsApp y Auditoría Antifraude

> **Versión del Sistema:** Fiabono v1.0 (Producción)  
> **Propósito:** Documentación técnica de arquitectura, motor de enlaces profundos (Deep Linking) para WhatsApp, auditoría contable inmutable y reversión de transacciones para el Agente RAG.  
> **Ubicación en Código:** `utils/whatsapp.ts`, `app/dashboard/historial/page.tsx`, `servicios/db.ts`.

---

## 1. Arquitectura de Cobranza y Notificaciones por WhatsApp

Fiabono utiliza un modelo de mensajería **Client-Side Deep Linking** que elimina intermediarios y reduce costos de SMS masivos o APIs comerciales costosas:
1. **Sin Almacenamiento en Agenda Personal:** El comerciante no necesita guardar el número del cliente en los contactos del teléfono.
2. **Formateo E.164 Automático:** Los números colombianos de 10 dígitos (ej. `3101234567`) se normalizan automáticamente anteponiendo el código de país `57`.
3. **Generación de Enlaces Universales (`api.whatsapp.com`):**
   $$\text{URL WhatsApp} = \text{https://api.whatsapp.com/send?phone=57}\{\text{celular}\}\&text=\{\text{mensajeCodificadoURI}\}$$

---

## 2. Motor de Plantillas de Cobranza Amable (`utils/whatsapp.ts`)

Para maximizar el recaudo sin generar fricción, el sistema implementa 3 plantillas contextuales según el estado de la deuda:

### 1. Plantilla Preventiva (2 a 3 días antes del vencimiento)
* **Objetivo:** Recordar cordialmente el compromiso antes de que caiga en mora.
* **Tono:** Comercial, servicial y amigable.
* **Variables:** Nombre del cliente, nombre del negocio, saldo pendiente, fecha límite y cuentas bancarias (Nequi, Daviplata, Bancolombia).

### 2. Plantilla de Vencimiento (Día pactado)
* **Objetivo:** Notificar que el plazo llegó a su fecha límite.
* **Tono:** Formal e institucional.
* **Enlace:** Incluye el link interactivo al estado de cuenta del cliente en `/t/[id]`.

### 3. Plantilla de Cartera Vencida (En mora)
* **Objetivo:** Invitar a concertar un acuerdo de pago o abono parcial.
* **Tono:** Respetuoso pero firme, destacando la importancia de mantener abierto el cupo de crédito en la tienda.

---

## 3. Arquitectura del Historial Inmutable y Auditoría Antifraude

La pantalla de `/dashboard/historial` actúa como la bitácora canónica de auditoría. A nivel de base de datos:

1. **Inmutabilidad de Transacciones:** Ningún documento de la colección `movimientos` se elimina con `deleteDoc()`.
2. **Marcador de Anulación:** Al anular una venta o abono, se actualiza el documento con:
   * `anulado: true`
   * `motivoAnulacion: string`
   * `anuladoPor: string` (UID y nombre del operador)
   * `fechaAnulacion: serverTimestamp()`
3. **Reversión Contable en Cascada:**
   * **Si se anula una venta:** Se devuelven las prendas al inventario (`increment(+qty)`) y se resta el monto del arqueo de caja.
   * **Si se anula un abono:** Se vuelve a sumar la deuda al cliente (`increment(+abono)`) y se resta el dinero de la caja.

---

## 4. Estrategia de Paginación y Fallback Indexado (`app/dashboard/historial/page.tsx`)

Para garantizar tiempos de carga inferiores a 200 ms con miles de registros:
* **Carga Inicial:** Se consultan los primeros 15 movimientos mediante `orderBy("fecha", "desc")` y `limit(16)`.
* **Puntero de Snapshot:** Se almacena el último documento visible (`ultimoDocSnapshot`) para continuar la paginación con `startAfter(ultimoDocSnapshot)`.
* **Fallback sin Índices Compuestos:** Si el índice compuesto de Firestore está en proceso de creación, el código atrapa el error y activa automáticamente un listener de contingencia con ordenamiento local para no dejar inoperante al comerciante.

---

## 5. Base de Conocimiento para el Agente RAG (Preguntas y Diagnóstico)

### `Q-AUD-01`: ¿Cómo responde el agente si el usuario pregunta cómo auditar si un cajero borró una venta?
* **Respuesta del Agente:**
  En Fiabono los cajeros no pueden borrar ventas del sistema. Si una venta fue anulada, ingresa a **`Historial`**, filtra por **`Devoluciones / Anuladas`** y verás el movimiento original tachado con el nombre de la persona que autorizó la anulación, la hora exacta y el motivo.

### `Q-AUD-02`: ¿Por qué al tocar el botón de WhatsApp sale error en la computadora?
* **Diagnóstico:**
  Verificar que el equipo tenga una sesión activa en WhatsApp Web (`web.whatsapp.com`) o que el navegador permita ventanas emergentes (*popups*).
