# Guía Oficial del Comerciante — Capítulo 2: Tu Caja Diaria (Apertura de Turno, Cobros en Vivo y Arqueo de Caja)

> **Manual de Operaciones para el Usuario Final**  
> **Aplica para:** Propietarios de Negocio, Administradores, Supervisores y Cajeros de Mostrador.  
> **Objetivo:** Garantizar que al final del día no falte ni un solo peso en el cajón de dinero, auditando entradas en efectivo, transferencias bancarias y gastos menores.  
> **Dónde se hace:** En la pantalla de **Inicio (`/dashboard/inicio`)** tocando el botón de estado de caja o en **Reportes > Cierres de Caja**.

---

## 1. ¿Qué es el Control de Caja y por qué evita pérdidas de dinero?

En un negocio tradicional, el mayor dolor de cabeza ocurre a las 7:00 PM cuando el dueño cuenta el dinero del cajón y dice:  
*“Se supone que vendimos \$800.000, pero en billetes solo cuento \$650.000... ¿dónde están los \$150.000 que faltan?”*.

Fiabono soluciona este problema dividiendo el dinero con precisión matemática:
* **El Efectivo en el Cajón (Billetes y Monedas):** Lo que físicamente tienes en la mano para dar cambio.
* **El Dinero en Bancos (Nequi, Daviplata, Bancolombia, Datáfono):** Lo que entró directamente a tus cuentas bancarias.
* **Los Abonos de Cartera:** Dinero de deudas viejas que los clientes vinieron a pagar hoy.

---

## 2. Paso 1: Abrir el Turno en la Mañana (La Base Inicial)

Todos los días, antes de registrar la primera venta, el cajero debe ingresar la **Base Inicial** (el dinero menudo que se deja en la caja para dar cambio a los primeros clientes).

```
[ PASO A PASO: APERTURA DE CAJA ]
 1. Entra a Fiabono en tu celular o computador y ve a la pantalla de [ Inicio ].
 2. En la parte superior verás un botón con un punto gris que dice: 
    [ ⚪ Abrir Caja ] o [ Caja Cerrada ].
 3. Toca ese botón. Se abrirá la ventana "Apertura de Turno de Mostrador".
 4. Escribe el valor exacto de la base con la que arrancas el día.
    - Ejemplo: $100.000 o $50.000.
    - Si no tienes base y arrancas en ceros, escribe 0.
 5. Toca el botón verde [ Abrir Turno de Caja ].
 6. ¡Listo! El punto se pondrá VERDE (🟢 Caja Abierta) y el sistema comenzará 
    a sumar automáticamente cada venta que se cobre.
```

> 💡 **Consejo de Mostrador:**  
> Nunca dejes de registrar la base. Si arrancas con \$100.000 de cambio y no los anotas en el sistema, en la noche parecerá que te "sobran" \$100.000 que en realidad eran tuyos desde la mañana.

---

## 3. ¿Qué pasa con la Caja durante el Día?

A medida que atiendes clientes en el mostrador, Fiabono clasifica el dinero en segundo plano sin que tengas que hacer nada:

* **Cuando haces una venta en Efectivo:**  
  El dinero se suma a la cuenta de billetes físicos que deben estar en el cajón.
* **Cuando un cliente paga con Nequi o Daviplata:**  
  El dinero se suma al total del día, pero **NO** al cajón de billetes (porque está en tu cuenta bancaria).
* **Cuando un cliente viene a pagar una deuda (Abono):**  
  Si te paga en efectivo, el sistema sabe que ese dinero debe estar en el cajón aunque no corresponda a una venta de hoy.
* **Cuando sacas dinero para un gasto menor (Egresos):**  
  Si sacaste \$15.000 del cajón para comprar bolsas o pagar el almuerzo, el sistema lo descuenta para que no te marque como faltante.

---

## 4. Arqueo Parcial a Mitad del Día (Cambio de Cajera o Turno)

Si en tu tienda hay cambio de turno a las 2:00 PM (sale una cajera y entra otra), no es necesario cerrar el día por completo:

1. Toca el botón de **`[ 🟢 Caja Abierta ]`** en Inicio.
2. Toca la opción **`[ Realizar Arqueo Parcial ]`**.
3. La cajera que sale cuenta los billetes que entrega.
4. El sistema guarda un registro de auditoría con la fecha, hora y el nombre de la empleada que entregó el turno, dejando la caja lista para que la siguiente continúe vendiendo.

---

## 5. El Cierre de Caja en la Noche (Arqueo Ciego Paso a Paso)

Al finalizar la jornada laboral se realiza el **Cierre de Caja Definitivo**. Fiabono utiliza la técnica del **Arqueo Ciego**, que significa que el empleado primero cuenta los billetes reales sin que el sistema le "sople" el número, evitando manipulaciones.

```
[ PASO A PASO: CIERRE DE CAJA EN LA NOCHE ]
 1. En la pantalla de [ Inicio ], toca el botón superior [ 🟢 Caja Abierta ].
 2. Selecciona la opción [ Cerrar Caja del Día ].
 3. Se abrirá el formulario de arqueo de dinero con dos herramientas clave:
    - La Calculadora de Billetes y Monedas.
    - La Auditoría de Comprobantes Digitales (Nequi / Daviplata).
```

---

### 5.1. Herramienta 1: Calculadora de Billetes de Colombia (COP)
No necesitas usar una calculadora externa ni sumar en un papel:
* Toca el botón azul **`[ 🧮 Contar Billetes y Monedas ]`**.
* Verás una lista con todas las denominaciones oficiales de Colombia:
  * Billetes de: `$100.000`, `$50.000`, `$20.000`, `$10.000`, `$5.000`, `$2.000`.
  * Monedas de: `$1.000`, `$500`, `$200`, `$100`, `$50`.
* Solo escribe cuántos billetes tienes de cada uno (ejemplo: 4 billetes de \$50.000, 7 de \$20.000).
* El sistema multiplica y suma todo automáticamente. Toca **`[ Aplicar Total Contado ]`** y el valor pasará al formulario.

---

### 5.2. Herramienta 2: Auditoría de Transferencias (Antifraude Nequi)
Muchos comerciantes sufren por comprobantes falsos de Nequi o Daviplata (fotos editadas que muestran clientes inescrupulosos).
* En el cierre de caja, toca **`[ 📱 Verificar Transferencias Digitales ]`**.
* Verás la lista de cada pago por Nequi o Daviplata que registraron tus cajeros en el día, con la hora, el valor y el número de referencia.
* Abres tu aplicación de Nequi en tu celular y vas marcando con un chulo (`[✓]`) cada transferencia que realmente haya entrado a tu cuenta. Si falta alguna, detectas el fraude al instante.

---

### 5.3. El Veredicto: ¿Cómo quedó la Caja?

Una vez ingresas el dinero contado, el sistema compara:
> **Dinero Esperado:** `Base Inicial + Ventas Efectivo + Abonos - Gastos`  
> contra  
> **Dinero Real Contado en Billetes**

El sistema te mostrará uno de tres resultados en pantalla grande:

1. 🟢 **Caja Cuadrada Perfecta (Diferencia: \$0):**  
   Todo coincide al centavo. No falta ni sobra nada.
2. 🔴 **Faltante de Dinero (Diferencia en Rojo Negativa, ej: `-$12.000`):**  
   Falta dinero en el cajón. Puede deberse a un vuelto mal entregado o a una venta no cobrada.
3. 🔵 **Sobrante de Dinero (Diferencia en Azul Positiva, ej: `+$5.000`):**  
   Hay más dinero del que se registró. Puede ser una venta que olvidaron anotar o un cambio que el cliente no reclamó.

* **Campo de Notas:** El cajero puede escribir una aclaración (ej: *"Se dejaron \$5.000 de monedas en el cajón para mañana"* o *"El cliente de la blusa roja dejó \$2.000 de propina"*).
* Toca el botón rojo **`[ Confirmar y Cerrar Caja Definitivamente ]`**.

---

## 6. Reporte Automático por WhatsApp al Dueño del Negocio

Apenas se confirma el cierre, la pantalla te muestra el botón verde brillante:  
**`[ 📲 Enviar Resumen de Cierre por WhatsApp ]`**

Al tocarlo, se abre automáticamente WhatsApp con un mensaje estructurado y formal listo para enviar al dueño del local:

```
📊 *CIERRE DE CAJA — BOUTIQUE PARÍS*
📅 Fecha: 28 de Octubre, 2026 | 07:15 PM
👤 Cajero: Andrea Gómez

💵 *DETALLE DE EFECTIVO:*
• Base Inicial: $100.000
• Ventas en Efectivo: $540.000
• Abonos en Efectivo: $120.000
• Salidas / Gastos: $0
---------------------------------
💰 *Efectivo Esperado:* $760.000
📥 *Efectivo Contado:* $760.000
⚖️ *Diferencia:* $0 (Caja Cuadrada ✅)

📱 *PAGOS DIGITALES (En Bancos):*
• Nequi: $210.000 (3 transacciones)
• Daviplata: $85.000 (1 transacción)
• Datáfono: $150.000 (2 transacciones)
---------------------------------
💳 *Total en Bancos:* $445.000

🏆 *TOTAL RECAUDADO EN EL DÍA: $1.205.000*
📝 Notas: Todo en orden, turno entregado sin novedades.
```

> 💡 **La tranquilidad del dueño:**  
> No importa si estás en tu casa cenando con tu familia; a las 7:15 PM recibes este mensaje en tu WhatsApp y sabes con total certeza cuánto dinero se produjo en el día y si la caja cuadró.

---

## 7. Dónde Consultar Cierres Anteriores (Historial de Arqueos)

Si necesitas revisar la caja del sábado pasado o de hace dos semanas:
1. Ve al menú y selecciona **`[ Reportes ]`**.
2. Toca la pestaña superior **`[ Cierres de Caja ]`**.
3. Verás la lista cronológica de todos los cierres realizados en la historia de tu negocio, con su fecha, quién cerró, el total vendido, si hubo descuadre y el botón para volver a imprimir el recibo térmico de cierre o reenviarlo por WhatsApp.
