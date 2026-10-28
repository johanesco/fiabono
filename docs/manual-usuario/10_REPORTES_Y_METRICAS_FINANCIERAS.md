# Guía Oficial del Comerciante — Capítulo 10: Reportes Financieros, Utilidades y Métricas de Negocio

> **Manual de Operaciones para el Usuario Final**  
> **Aplica para:** Propietarios de Negocio y Administradores (con permiso `Ver Reportes`).  
> **Objetivo:** Conocer en tiempo real los números reales de tu negocio: cuánto dinero entró a caja, cuánto diste en fiado, cuál es tu Ganancia Neta Real (restando el costo de las prendas), cuáles son tus productos estrella y el rendimiento de tus vendedores, con exportación a PDF y Excel para tu contador.  
> **Dónde se hace:** En el menú inferior o lateral, tocando el icono de gráfica **`[ 📊 Reportes ]`**.

---

## 1. De Vender a Ciegas a Gestionar con Datos Reales

Muchos comerciantes cometen el error de mirar únicamente el dinero total que hay en la cuenta al final del día. Pero tener `$1.000.000` en la caja no significa haber ganado `$1.000.000`: gran parte de ese dinero corresponde al costo de reposición de la mercancía, a fiados o a anticipos de apartados.

Fiabono separa automáticamente cada centavo para que conozcas tu **Utilidad Neta Real**:
$$\text{Utilidad Real} = \text{Ventas Cobradas} - \text{Costo de Mercancía (Costo de Compra)}$$

* **Si ingresaste el costo de compra de cada prenda al darla de alta en inventario**, el sistema calcula de inmediato tu margen de rentabilidad exacto en porcentaje (`%`) y en pesos colombianos (`COP`).
* **Si eres el dueño del negocio**, tienes acceso total. A tus cajeros y colaboradores puedes ocultarles esta pantalla por completo para proteger la privacidad financiera de tu tienda.

---

## 2. Pestañas Principales del Módulo de Reportes

Al ingresar a **`Reportes`**, verás tres vistas superiores para analizar tu negocio:

```
┌────────────────────────────────────────────────────────┐
│  📊 REPORTES Y ANALÍTICA DEL NEGOCIO                   │
├────────────────────────────────────────────────────────┤
│  [ 📈 Resumen Financiero ] [ 👕 Productos ] [ 🏦 Cierres Caja ]
│                                                        │
│  📅 PERÍODO:                                           │
│  [ Hoy ]  [ Ayer ]  [ Esta Semana ]  [ Este Mes ] [ Año ]
└────────────────────────────────────────────────────────┘
```

1. **`[ 📈 Resumen Financiero ]`**: El termómetro general de caja, ventas, fiados, abonos y rentabilidad.
2. **`[ 👕 Productos ]`**: Ranking de qué prendas se venden solas, cuáles están estancadas y cuánto vale tu inventario actual en vitrina.
3. **`[ 🏦 Cierres de Caja ]`**: Historial consolidado de todos los arqueos de caja realizados en la tienda, con detalle de sobrantes y faltantes.

---

## 3. Las Tarjetas Clave del Resumen Financiero

Al seleccionar un período (por ejemplo, **`Este Mes`**), Fiabono calcula de forma instantánea 4 tarjetas maestras:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ 🟢 VENTAS COBRADAS       │  │ 🟠 FIADOS DEL PERÍODO   │
│ $ 4.850.000             │  │ $ 820.000               │
│ 142 transacciones       │  │ 18 créditos otorgados   │
└─────────────────────────┘  └─────────────────────────┘
┌─────────────────────────┐  ┌─────────────────────────┐
│ 🔵 ABONOS RECAUDADOS    │  │ 💰 CAJA NETA REAL       │
│ $ 650.000               │  │ $ 5.500.000             │
│ Cartera recuperada      │  │ Efectivo + Bancos       │
└─────────────────────────┘  └─────────────────────────┘
```

### ¿Qué significa cada indicador?
* **🟢 Ventas Cobradas:** Dinero total ingresado por compras de contado en mostrador durante el período.
* **🟠 Fiados Otorgados:** Mercancía que salió de la tienda a crédito sin cobro total (deuda que tus clientes tienen pendiente contigo).
* **🔵 Abonos Recaudados:** Dinero en efectivo o transferencias que los clientes pagaron para bajar sus cuentas fiadas anteriores.
* **💰 Recaudo Neto Total (Caja Neta):** La suma del dinero real que ingresó a tu negocio:
  $$\text{Caja Neta} = \text{Ventas de Contado} + \text{Abonos Cobrados} + \text{Anticipos de Separe}$$

---

## 4. Ganancia Real y Margen de Utilidad

Justo debajo de las tarjetas de caja, encontrarás el bloque de **Rentabilidad del Negocio**:

```
┌────────────────────────────────────────────────────────┐
│ 💎 UTILIDAD NETA DEL PERÍODO                           │
├────────────────────────────────────────────────────────┤
│  Ingresos por Mercancía:            $ 4.850.000        │
│  Menos Costo de Adquisición (CMV): -$ 2.620.000        │
│  ──────────────────────────────────────────────        │
│  ✨ GANANCIA NETA REAL:             $ 2.230.000 COP    │
│  📈 Margen Bruto Promedio:          45.9% de ganancia  │
└────────────────────────────────────────────────────────┘
```

> [!TIP]
> **El Secreto del Margen:**  
> Si tu margen promedio está por encima del **40%**, tu negocio tiene una excelente salud comercial para cubrir costos fijos (arriendo, servicios, sueldos) y dejar ganancias libres.

---

## 5. Gráfica Interactiva de Tendencia de Ventas

En la misma pantalla verás una gráfica de barras o líneas que te permite comparar el comportamiento de las ventas a lo largo del tiempo:

* **Vista Semanal:** Muestra el rendimiento de Lunes a Domingo. Te permite identificar qué días de la semana son los más fuertes (por ejemplo, viernes y sábados de quincena) y qué días son más flojos para lanzar promociones.
* **Vista Mensual:** Comparativa de los últimos meses del año.
* **Vista Anual / Histórica:** Permite ver el crecimiento del negocio año tras año.

---

## 6. Rendimiento de Vendedores y Colaboradores

Si tienes personal contratado, el sistema desglosa cuánto vendió cada miembro del equipo:

```
┌────────────────────────────────────────────────────────┐
│ 👥 RENDIMIENTO POR VENDEDOR                            │
│ Criterio: [ Por Dinero ($) ]  [ Por Cantidad (#) ]     │
├────────────────────────────────────────────────────────┤
│ 1. 🥇 Andrés Gómez     | $ 2.850.000  (62 ventas)      │
│ 2. 🥈 Laura Restrepo   | $ 1.620.000  (48 ventas)      │
│ 3. 🥉 Caja Mostrador   | $   380.000  (12 ventas)      │
└────────────────────────────────────────────────────────┘
```

### ¿Para qué te sirve esta tabla?
1. **Calcular Comisiones de Ventas:** Si pagas el 2% o 3% sobre ventas a tus colaboradores, tienes la cifra exacta sin discusiones ni necesidad de sumar recibos de papel.
2. **Motivar a tu Equipo:** Saber quién es tu mejor vendedor y capacitar a quienes tienen menor volumen.

---

## 7. Pestaña de Productos: Ranking y Salud del Inventario

Al tocar la pestaña superior **`[ 👕 Productos ]`**, obtienes una radiografía de tus prendas:

### A. Productos Estrella (Los Más Vendidos)
Muestra el Top 10 de prendas con mayor salida, indicando unidades vendidas y dinero recaudado. Te ayuda a saber qué referencias debes volver a comprarle a tus proveedores antes de que se agoten.

### B. Productos de Mayor Rentabilidad
Prendas que, aunque quizás no se vendan en masas gigantescas, dejan el margen de ganancia más alto por cada unidad vendida.

### C. Valor Total del Inventario Físico
Al final de la página, Fiabono te dice exactamente cuánto dinero tienes invertido en mercancía parada en la tienda:
* **Valor a Precio de Costo:** La inversión real que hiciste de tu bolsillo.
* **Valor a Precio de Venta:** Lo que vas a recaudar cuando vendas toda la mercancía.
* **Ganancia Proyectada:** La diferencia entre ambos valores si liquidas tu bodega.

---

## 8. Exportación Contable a Excel y PDF Oficial

En la esquina superior derecha encontrarás el botón **`[ 📥 Exportar Reporte ]`**:

```
┌────────────────────────────────────────────────────────┐
│  📥 EXPORTAR REPORTE FINANCIERO                        │
├────────────────────────────────────────────────────────┤
│  Selecciona el formato de descarga:                   │
│                                                        │
│  🟢 [ Descargar en Excel (.xlsx) ]                     │
│  Hojas de cálculo tabuladas con detalle de cada venta, │
│  costo, cliente y medio de pago. Ideal para tu         │
│  contador o para abrir en Google Sheets.               │
│                                                        │
│  🔴 [ Descargar Informe en PDF Ejecutivo ]             │
│  Documento formal con membrete de tu tienda, logo,     │
│  gráficas y resumen financiero listo para imprimir o   │
│  presentar a socios o bancos.                          │
└────────────────────────────────────────────────────────┘
```
