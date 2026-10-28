# Guía Oficial del Comerciante — Capítulo 11: Gestión de Colaboradores, Cajeros y Seguridad del Negocio

> **Manual de Operaciones para el Usuario Final**  
> **Aplica para:** Propietarios de Negocio y Administradores Principales.  
> **Objetivo:** Delegar la operación diaria en empleados, cajeros o administradores de turno de forma 100% segura; crear accesos sin compartir tu correo personal, asignar permisos exactos según la confianza de cada colaborador y proteger tus secretos comerciales (utilidades, costos de prendas y teléfonos de clientes).  
> **Dónde se hace:** En el menú inferior o lateral, tocando **`[ ⚙️ Perfil / Configuración ]`** y deslizando hasta la sección **`Gestión de Colaboradores`**.

---

## 1. El Dilema del Comerciante: Delegar sin Perder el Control

Cuando un negocio crece, el dueño no puede estar pegado al mostrador las 12 horas del día. Necesita contratar ayudantes, cajeros o administradores. Sin embargo, surgen miedos muy comunes:
* *"¿Y si el cajero ve cuánto me cuesta la ropa y cuánta ganancia me queda?"*
* *"¿Y si anula ventas para quedarse con el dinero en efectivo?"*
* *"¿Y si se copia los números de WhatsApp de mis mejores clientes para montarles competencia?"*
* *"¿Y si le tengo que prestar mi cuenta personal de Google o mi correo privado?"*

Fiabono soluciona todos estos problemas mediante **Cuentas de Colaborador con Roles y Permisos Granulares**.

---

## 2. Cómo Entran tus Empleados al Sistema (Sin Correos Personales)

Tus colaboradores **NO necesitan un correo electrónico** para trabajar en la tienda. Fiabono les genera un usuario de acceso directo:

```
┌────────────────────────────────────────────────────────┐
│  🔐 INICIO DE SESIÓN PARA COLABORADORES                │
├────────────────────────────────────────────────────────┤
│  Identificador de la Tienda:  boutiqueliliana          │
│  Usuario del Colaborador:     andres                   │
│  Contraseña:                  ••••••••                 │
│                                                        │
│  [ Iniciar Turno de Trabajo ]                          │
└────────────────────────────────────────────────────────┘
```

1. Cada tienda tiene un identificador único (Slug), por ejemplo `boutiqueliliana`.
2. El colaborador solo escribe el nombre de la tienda, su usuario (ej. `andres`) y su contraseña secreta.
3. El sistema lo reconoce de inmediato, lo vincula a tu inventario y aplica las restricciones que tú configuraste.

---

## 3. Cómo Crear un Nuevo Colaborador Paso a Paso

1. Entra a **`[ ⚙️ Perfil ]`**.
2. Desliza hacia abajo hasta la tarjeta **`Colaboradores del Negocio`**.
3. Toca el botón verde **`[ + Agregar Colaborador ]`**.
4. Completa la ficha básica:
   * **Nombre Completo:** (Ejemplo: *Andrés Gómez*).
   * **Nombre de Usuario:** (Ejemplo: *andres* — sin espacios ni tildes).
   * **Contraseña Inicial:** (Mínimo 6 caracteres).
5. Configura la lista de permisos (interruptores de encendido/apagado).
6. Toca **`[ Guardar Colaborador ]`**.

---

## 4. Diccionario de Permisos: Qué Dejarles Hacer y Qué Prohibirles

Fiabono cuenta con interruptores independientes para que adaptes el sistema al nivel de confianza de cada empleado:

| Permiso | ¿Qué permite hacer? | Recomendación de Seguridad |
| :--- | :--- | :--- |
| **`Venta Directa`** | Cobrar en mostrador de contado y registrar fiados. | **ACTIVAR** a todos los cajeros para que puedan operar. |
| **`Abonar`** | Recibir dinero de clientes que van a pagar sus deudas. | **ACTIVAR** si el colaborador maneja dinero en mostrador. |
| **`Ver Reportes`** | Ver las ganancias netas, margen de utilidad y ventas totales del negocio. | **DESACTIVAR SIEMPRE** para cajeros. Solo debe verlo el dueño o administrador general. |
| **`Ver Directorio`** | Ver la lista de clientes registrados en el negocio. | Activar solo si necesita consultar datos de compradores. |
| **`Ver Cartera`** | Ver el módulo completo de deudas, quién debe plata y cuánto. | Desactivar para cajeros simples; activar para jefes de cartera o administradores. |
| **`Ver Celulares`** | Ver los números completos de teléfono de los clientes. | **DESACTIVAR:** Si lo desactivas, los números aparecerán protegidos (ejemplo: `315 *** **24`). Así evitas que un empleado se robe tu base de datos de clientes. |
| **`Hacer Devoluciones`** | Anular ventas ya cobradas o regresar dinero de la caja. | **DESACTIVAR:** Es el permiso más delicado. Si lo apagas, el cajero tendrá que llamarte para autorizar cualquier anulación. |
| **`Cierre de Caja`** | Realizar el arqueo nocturno y cerrar el turno. | Activar si el cajero se queda solo al final de la jornada y debe entregar cuentas. |
| **`Editar Inventario`** | Cambiar nombres de prendas, agregar stock o borrar productos. | Activar solo a la persona encargada de bodega. |
| **`Ingreso Inventario`** | Cargar facturas de compra de nuevos pedidos a proveedores. | Activar a personal de compras o bodega. |
| **`Modificar Precios`** | Cambiar el precio de venta en mostrador al momento de cobrar. | **DESACTIVAR:** Evita que el cajero le baje el precio a sus amigos o cobre menos de lo establecido. |
| **`Aplicar Descuentos`** | Aplicar rebajas comerciales (en `%` o `$`) al carrito de compras. | Activar solo si tienen autorización de hacer descuentos de mostrador. |
| **`Venta Libre`** | Cobrar prendas o servicios que no están en inventario. | Desactivar si quieres que todo lo que se venda tenga código y descuento de stock obligatorio. |
| **`Plan Separe`** | Crear apartados y entregar prendas bajo plan separe. | Activar en tiendas de ropa y calzado que usen separe. |
| **`Enviar WhatsApp`** | Enviar recibos y tickets digitales a clientes vía WhatsApp. | **ACTIVAR** para agilizar la entrega de recibos ecológicos. |
| **`Terminal Multivendedor`**| Cambiar de vendedor rápidamente en una misma tablet o computador de mostrador. | Activar si 2 o 3 asesores comparten la misma caja registradora. |

---

## 5. El Escudo de Protección Antifraude: Secretos Comerciales a Salvo

### A. Costos y Márgenes 100% Ocultos para el Personal
Cuando un colaborador con rol `cajero` entra al sistema:
* **En el Inventario:** Solo ve el precio de venta al público. Los campos de *"Costo de Compra"* y *"Margen de Ganancia"* desaparecen de su pantalla.
* **En el Carrito de Cobro:** Jamás sabrá cuánto te costó la prenda en fábrica o a tu distribuidor mayorista.
* **En el Menú Principal:** La opción de **`Reportes`** ni siquiera aparece visible si no tiene el permiso activado.

### B. Enmascaramiento de Números de Teléfono
Si apagas el permiso **`Ver Celulares`**:
* El cajero podrá tocar el botón verde de WhatsApp para enviar el ticket al cliente.
* Pero en la pantalla el número se mostrará enmascarado: `320 *** **89`.
* El empleado no podrá copiar ni exportar los números personales de tus clientes para llevárselos a otro negocio.

---

## 6. Cómo Restablecer la Contraseña de un Colaborador Olvidadizo

Si un empleado olvidó su clave:
1. Entra a **`[ ⚙️ Perfil ]`** desde la cuenta del dueño.
2. En la lista de colaboradores, busca su nombre.
3. Toca el botón de la llave **`[ 🔑 Cambiar Contraseña ]`**.
4. Escribe la nueva contraseña y confirma.
5. El colaborador ya podrá ingresar inmediatamente con su nueva clave.

---

## 7. Desactivar o Eliminar un Colaborador que Renunció

Si un colaborador termina su contrato de trabajo:
1. Entra a **`[ ⚙️ Perfil ]`**.
2. En la tarjeta del colaborador, tienes dos alternativas:
   * **Desactivar (Interruptor Activo/Inactivo):** Bloquea su acceso de forma temporal o inmediata sin borrar su historial de ventas pasadas.
   * **Eliminar (Icono de Papelera Roja):** Remueve definitivamente el usuario del negocio. Todas las ventas que hizo en el pasado se conservan intactas en el **Historial** para efectos de auditoría y garantías de clientes.
