# Guía Oficial del Comerciante — Capítulo 13: Preguntas Frecuentes, Dudas de Mostrador y Solución de Problemas

> **Manual de Operaciones para el Usuario Final**  
> **Aplica para:** Propietarios de Negocio, Administradores, Cajeros y Vendedores.  
> **Objetivo:** Resolver de forma inmediata las 40 dudas, errores cotidianos y situaciones imprevistas más comunes que ocurren en el mostrador de una tienda física, organizadas módulo por módulo, sin tecnicismos y con instrucciones paso a paso.  
> **Dónde consultar:** Ten este capítulo a la mano en el mostrador para capacitar a tu personal o salir de apuros en segundos.

---

## 1. Acceso, Conectividad e Instalación (PWA)

### ¿Qué pasa si se va la luz o el internet de la tienda?
Fiabono funciona con tecnología en la nube. Si el internet fijo de la tienda falla:
* **Solución inmediata:** Activa los datos móviles (red compartida o Wi-Fi móvil) de cualquier teléfono celular. Como la aplicación es ultra liviana y solo consume texto y datos comprimidos, consumirá menos de 10 megas al día.
* Toda la información que ya tenías cargada en pantalla permanecerá visible. Una vez restablezcas conexión, las operaciones se sincronizarán normalmente.

### ¿Puedo abrir Fiabono en varios dispositivos al mismo tiempo?
**Sí, 100%.** Puedes tener abierta la aplicación en el computador del mostrador principal, en una tablet en el pasillo y en el celular personal del dueño desde su casa. Si un cajero cobra una venta en la tienda física, el dueño verá aumentar el dinero de la caja en tiempo real en su celular sin importar en qué ciudad se encuentre.

### ¿Cómo cambio de teléfono celular o computador sin perder mis datos?
Tus datos **no están guardados en la memoria de un aparato físico**, sino en la nube segura de Fiabono respaldada por Google Cloud.
1. Abre Google Chrome o Safari en el nuevo dispositivo.
2. Ingresa a la página oficial de Fiabono (`https://fiabono.com`).
3. Escribe tu correo y contraseña habitual.
4. ¡Listo! Todo tu inventario, tus clientes y el dinero pendiente aparecerán intactos al instante.

### En mi iPhone la barra del navegador tapa los botones inferiores, ¿cómo lo soluciono?
Estás navegando en Safari como una página web normal en lugar de tener la aplicación instalada.
* **Solución:** Toca el botón compartir de Safari (cuadrado con flecha hacia arriba) y selecciona **`[ Agregar al inicio ]`**. Abre Fiabono desde el nuevo icono que se creó en tu pantalla de inicio; ahora abrirá a pantalla completa sin barras estorbosas.

---

## 2. Caja Diaria, Turnos y Arqueo

### ¿Qué hago si al final del día la caja no cuadra (me falta dinero)?
1. **Revisa las transferencias digitales:** La causa más frecuente de descuadre es haber marcado una venta como "Efectivo" cuando el cliente realmente pagó por "Nequi" o "Daviplata", o viceversa.
2. **Revisa los egresos de bolsillo:** Pregúntale a los cajeros si sacaron dinero en efectivo para pagar algún gasto imprevisto (un taxi, el almuerzo, bolsas plásticas o servicio de aseo) y olvidaron registrarlo.
3. **Revisa anulaciones:** Entra a **`Historial`**, filtra por **`Hoy`** y verifica si alguna venta fue anulada erróneamente.
4. Si el dinero efectivamente falta físicamente en el cajón, en el arqueo digita el monto real que tienes en las manos. Fiabono registrará un veredicto con **`FALTANTE`** para que quede el registro formal de auditoría y puedas acordar el descuento con el cajero responsable.

### ¿Puedo hacer un arqueo a mitad de tarde si cambia el cajero?
**Sí.** Se llama Arqueo de Cambio de Turno:
1. El cajero saliente entra a **`[ 🏦 Caja ]`** y toca **`[ Realizar Arqueo / Cierre ]`**.
2. Cuenta el dinero de su turno y guarda el cierre.
3. El cajero entrante recibe el cajón con la nueva base inicial y continúa cobrando con su propio usuario.

### ¿Qué pasa si olvidé cerrar la caja en la noche?
No te preocupes. A la mañana siguiente, al abrir el sistema:
1. Entra a **`Caja`** y realiza el arqueo con los billetes que quedaron de la jornada anterior.
2. Guarda el cierre.
3. Luego realiza una nueva **Apertura de Caja** con la base matutina del nuevo día.

---

## 3. Inventario, Prendas y Códigos QR

### ¿Qué hago si la cámara del celular no lee el código QR o de barras de una prenda?
1. **Limpia el lente de la cámara:** En las tiendas de ropa, la pelusa de las prendas suele empañar el lente del celular.
2. **Iluminación:** Asegúrate de que no haya una sombra oscura tapando la etiqueta.
3. **Escribe el SKU manualmente:** Todas las etiquetas tienen impreso el código en texto alfanumérico debajo del código. Solo escribe ese código en el buscador del carrito y la prenda se cargará al instante.

### ¿Puedo vender una prenda si el stock del sistema dice 0 unidades?
**Sí.** Si físicamente tienes la prenda en la mano pero el sistema dice que hay `0` (porque acabas de desembarcar mercancía y no tuviste tiempo de digitar la factura de compra):
* El sistema te permitirá venderla y el stock pasará temporalmente a `-1` (número negativo en color rojo).
* Tan pronto ingreses el nuevo pedido en inventario, el sistema sumará las unidades y el número volverá a ser positivo automáticamente.

### ¿Cómo cambio el precio de una prenda que ya está registrada?
1. Ve a **`[ 📦 Inventario ]`**.
2. Busca la prenda por nombre o escanea su etiqueta.
3. Toca sobre la tarjeta de la prenda y selecciona **`[ Editar Producto ]`**.
4. Modifica el campo **`Precio de Venta`** y toca **`[ Guardar Cambios ]`**.
* A partir de ese segundo, todas las cajas cobrarán el nuevo precio.

---

## 4. Ventas Rápidas (POS) de Contado

### El cliente pagó una parte en Nequi y otra parte en Efectivo, ¿cómo lo cobro?
1. Carga los productos al carrito.
2. Toca **`[ Cobrar ]`**.
3. En la selección de medios de pago, elige **`[ Pago Mixto / Combinado ]`**.
4. Digita cuánto te entregó en Efectivo (ej. `$50.000`) y cuánto te transfirió por Nequi (ej. `$30.000`).
5. Confirma el cobro. En el ticket saldrán desglosados ambos métodos y en el arqueo de caja el efectivo irá al cajón y el saldo digital irá a bancos.

### El cajero se equivocó y cobró una venta dos veces, ¿cómo se anula?
1. Ve a **`[ 📜 Historial ]`**.
2. Ubica la venta duplicada en la lista de transacciones de hoy.
3. Toca el botón rojo **`[ ✕ Anular / Devolución ]`** (requiere permiso de Administrador).
4. Escribe el motivo: *"Venta duplicada por error"*.
5. Confirma. El dinero saldrá de la caja y la prenda regresará de inmediato al inventario disponible.

---

## 5. Módulo de Crédito y Fiados

### ¿Cómo sé exactamente cuánto dinero me debe un cliente antes de fiarle otra prenda?
Al ingresar al módulo **`[ 🤝 Fiar ]`** y seleccionar al cliente:
* El sistema te mostrará una alerta destacada en color ámbar/rojo con su **`Deuda Total Pendiente`**.
* Podrás ver qué compras pasadas no ha pagado y cuántos días de retraso acumula para decidir si le autorizas una nueva prenda o le exiges un abono previo.

### ¿Qué pasa si el cliente deja un anticipo al momento de fiar?
En la pantalla de cobro del fiado, digita el valor en el campo **`Anticipo Recibido`** (ejemplo: la prenda vale `$120.000` y el cliente deja `$40.000` en efectivo):
* Los `$40.000` entran a la caja física de hoy.
* Los `$80.000` restantes se van a la cartera del cliente como saldo por cobrar.
* En el comprobante de WhatsApp saldrá: Total `$120.000`, Anticipo `$40.000`, Saldo Pendiente `$80.000`.

---

## 6. Módulo de Abonos y Recaudos

### Un cliente vino a pagar en efectivo, pero el cajero marcó por error que pagó por Nequi
1. Entra a **`[ 📜 Historial ]`** y filtra por **`[ Abonos ]`**.
2. Localiza el abono mal registrado.
3. Toca **`[ ✕ Anular Abono ]`** indicando *"Error en medio de pago"*.
4. Al anularse, la deuda vuelve a quedar intacta en la ficha del cliente.
5. Ahora entra a **`[ 💳 Abonar ]`**, selecciona de nuevo al cliente y registra el abono marcando correctamente **`Efectivo`**.

### ¿Qué pasa si el cliente abona más dinero del que debía?
Si un cliente debía `$45.000` y entrega un billete de `$50.000` diciendo *"Déjeme los \$5.000 de saldo para mi próxima compra"*:
* El sistema liquida la deuda a `$0` y le genera automáticamente un **`Saldo a Favor de $5.000`**.
* Cuando regrese a comprar, el sistema te avisará que tiene dinero a favor para descontárselo de su cuenta.

---

## 7. Plan Separe (Apartados)

### ¿Qué hago si se cumplió la fecha límite y el cliente no volvió por su prenda apartada?
1. Ve a **`[ 🏷️ Separes ]`** y filtra por la pastilla **`[ Vencidos 🔴 ]`**.
2. Toca el botón verde de WhatsApp para escribirle un recordatorio amable de retiro.
3. Si el cliente manifiesta que ya no desea la prenda:
   * Toca **`[ Cancelar Separe ]`**.
   * La prenda se desbloquea en bodega y vuelve a estar disponible para la venta en vitrina.
   * El dinero que había abonado se convierte en **Saldo a Favor en la Tienda** para que el cliente pueda comprar otra cosa en el futuro (política comercial estándar para no perder dinero).

### ¿Por qué una prenda de Plan Separe no se puede vender en el mostrador?
Porque Fiabono implementa **bloqueo estricto de inventario físico**. Aunque la prenda siga en la tienda, el sistema la descuenta del stock de vitrina y le asigna una etiqueta de ubicación en bodega (ej. *Caja 3, Estante B*). Así garantizas que ningún otro cajero venda por error una prenda que ya está apartada por otro cliente.

---

## 8. Cobranza y Mensajería por WhatsApp

### Al tocar el botón de WhatsApp no se abre la aplicación o dice número inválido
1. **Revisa el número en la ficha del cliente:** Verifica que tenga 10 dígitos (ejemplo: `310 123 4567`) sin caracteres raros ni espacios extraños.
2. Si estás desde un computador, asegúrate de tener abierta la sesión en **WhatsApp Web** (`web.whatsapp.com`) o tener instalada la aplicación de WhatsApp para Windows.

### ¿A mis clientes les llega publicidad de Fiabono cuando les mando un recibo?
**Absolutamente NO.** El mensaje sale desde tu propio número de WhatsApp personal o del negocio. El recibo web incluye únicamente **el nombre de tu negocio, tu logotipo, tu dirección, tu teléfono y tus cuentas bancarias**. Fiabono es un sistema de marca blanca pensado para enaltecer la identidad de tu almacén.

---

## 9. Colaboradores, Cajeros y Seguridad

### Un cajero olvidó su contraseña, ¿cómo la recupero?
El dueño del negocio tiene el control total:
1. Entra a **`[ ⚙️ Perfil ]`** desde la cuenta del Dueño.
2. En la lista de colaboradores, busca al empleado.
3. Toca el icono de la llave **`[ 🔑 Cambiar Contraseña ]`**.
4. Escribe una nueva clave (mínimo 6 dígitos) y dale guardar. El cajero podrá entrar de inmediato.

### ¿Cómo evito que mis empleados vean cuánto dinero vendo al día o cuánto me cuesta la ropa?
1. Entra a **`[ ⚙️ Perfil ]`** y edita el usuario del colaborador.
2. **Apaga** el interruptor **`Ver Reportes`**.
3. **Apaga** el interruptor **`Ver Costos`**.
* Al iniciar sesión con su cuenta, el cajero solo verá precios de venta al público y la pestaña de reportes financieros estará totalmente oculta.

### ¿Qué hago si un empleado renuncia o es despedido?
1. Entra a **`[ ⚙️ Perfil ]`**.
2. En la tarjeta del colaborador, desactiva el interruptor **`Activo`** o toca la papelera roja para eliminarlo.
* Su sesión se cerrará de inmediato y no podrá volver a entrar a tu negocio. Todas las ventas y abonos que realizó en el pasado permanecerán intactos en tu historial contable.

---

## 10. Suscripción y Facturación Electrónica DIAN

### ¿Qué pasa si se venció mi suscripción y no tengo dinero para pagar hoy?
Fiabono te otorga un **período de gracia** para que tu negocio nunca se quede frenado en plena venta. Además, **tus datos JAMÁS se eliminan**: tu inventario, tus clientes y el dinero que te deben continúan guardados en la nube para cuando decidas reactivar tu cuenta.

### ¿Estoy obligado a emitir Facturación Electrónica DIAN con Fiabono?
**No estás obligado a menos que tu régimen tributario lo exija.** 
* Si eres régimen simplificado (no responsable de IVA), puedes operar 100% con tickets térmicos y recibos digitales por WhatsApp estándar sin enviar nada a la DIAN.
* Si eres responsable de IVA o persona jurídica obligada a facturar electrónicamente, puedes activar el módulo DIAN en cualquier momento configurando tu resolución y prefijo UBL 2.1.
