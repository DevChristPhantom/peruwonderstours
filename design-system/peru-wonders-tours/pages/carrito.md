# Página: Carrito (`/es/carrito`) + mini-carrito

**Objetivo:** revisar varios tours/paquetes en una sola compra, con total transparente y la opción del
adelanto del 50 % visible antes de pagar. **CTA primario:** "Continuar con la reserva" (`accent`).

Persistencia: carrito de invitado en Redis + cookie `httpOnly` de 7 días; se fusiona al iniciar sesión.
Los cupos **no** se bloquean en el carrito; se bloquean 15 min al entrar al paso de pago (checkout).

## Mini-carrito (drawer)

- Se abre desde el ícono del header o el toast. Drawer derecho 420 px (desktop) / hoja inferior a 90 %
  (móvil). `role="dialog"`, `aria-modal`, foco al título, Esc cierra y devuelve el foco, scrim `overlay`.
- Lista compacta (foto 64 px, título, fecha, viajeros, precio), subtotal, botones "Ver carrito" (outline)
  y "Continuar con la reserva" (`accent`).
- Movimiento: `x 100% → 0` 500 ms ease-out (móvil `y`), scrim opacidad 250 ms; cierre 360 ms ease-in.
  Reducido: aparición instantánea.

## Página de carrito

### Estructura

- h1 "Tu carrito" + "3 tours" (`foreground-muted`).
- **Lista de ítems** (columna principal) y **resumen** (columna lateral sticky en 1024+).
- Bajo la lista: "Seguir explorando" (enlace) y bloque "Combina con…" (2 tours relacionados por destino
  y fecha; sin presión).

### Ítem de carrito

| Parte | Detalle |
|---|---|
| Foto | 120×90 (desktop), 88×66 (móvil), `radius-md` |
| Título | Enlace a la ficha, h3 |
| Meta | Fecha "sáb, 14 nov. 2026 · 7:00 a. m." · "2 adultos, 1 niño" · "Grupal · Español" |
| Acciones | "Editar" (abre hoja con fecha/viajeros), "Quitar" (ghost, ícono `trash-2`) |
| Precio | Total del ítem `h4` tabular + desglose plegable "2 × S/ 189.00 · 1 × S/ 140.00" |
| Avisos | `warning-soft` si quedan ≤ 3 cupos ("Quedan 3 cupos para esta fecha"), `danger-soft` si se agotó |
| Pago | Etiqueta si el ítem exige 100 % ("Pago completo requerido: incluye boletos de tren") |

Quitar: el ítem se colapsa (360 ms) y aparece toast "Quitaste Uros y Taquile · Deshacer" (8 s, se pausa con hover/foco; el foco pasa al ítem
siguiente o al título de la lista). Si el toast se pierde, el ítem se puede volver a agregar desde "Vistos recientemente". No hay
modal de confirmación (el deshacer es menos fricción).

### Resumen del pedido

```
Resumen
Uros y Taquile (2 adultos, 1 niño)        S/ 518.00
Colca 2D/1N (2 adultos)                   S/ 760.00
Machu Picchu full day (2 adultos)       S/ 2,100.00
──────────────────────────────────────────────────
Total (impuestos incluidos)             S/ 3,378.00

Hoy pagas desde                          S/ 2,739.00   ← 50 % de los tours que lo permiten
                                                          + 100 % de Machu Picchu
Saldo pendiente                            S/ 639.00   por tour; el primero vence el 7 nov. 2026

[ Continuar con la reserva ]   (accent, 48 px)
Puedes pagar el 50 % o el total en el siguiente paso.
Pago seguro · Comprobante electrónico SUNAT · Libro de Reclamaciones
```

- El total mostrado aquí es **el mismo** que en el checkout. No hay cargos que aparezcan después
  (si el proveedor de pagos cobra comisión, se incluye ya aquí o se absorbe).
- Moneda: selector PEN/USD solo si el cliente lo aprueba; por defecto PEN. Si se muestra USD, aclarar
  "Se cobrará en soles (S/). Monto referencial en USD".
- Código promocional: enlace plegado "¿Tienes un código de descuento?" (no un campo abierto que
  distraiga).

### Estados

| Estado | Comportamiento |
|---|---|
| Vacío | Ilustración lineal (montaña del logo, trazo `border-strong`), h2 "Tu carrito está vacío", texto "Explora tours en Puno, Cusco y Arequipa." y botón `secondary` "Ver tours" + 3 destinos. |
| Cargando | Skeleton de 2 ítems y resumen. |
| Ítem agotado | Ítem atenuado, aviso `danger-soft` "Ya no hay cupos para el 14 nov.", botones "Cambiar fecha" / "Quitar"; el CTA queda deshabilitado con explicación hasta resolverlo. |
| Precio actualizado | Banner `warning-soft` arriba: "El precio de Colca 2D/1N cambió de S/ 760.00 a S/ 800.00." Requiere ver el cambio antes de continuar. |
| Error de red | "No pudimos actualizar tu carrito. Reintentar." Los datos mostrados se mantienen. |
| Carrito recuperado | "Guardamos tu carrito desde tu última visita." (una vez). |

## Responsive

| | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Layout | 1 col; resumen debajo + barra sticky inferior con total y CTA | 1 col + barra sticky | 2 col 1fr / 380 | 2 col 1fr / 400, max 1280 |
| Ítem | Foto izquierda pequeña, precio debajo del título | Foto + datos + precio a la derecha | igual | igual |

## Accesibilidad

- Cambios de cantidad y eliminación anunciados por `aria-live="polite"` ("Total actualizado: S/ 3,378.00").
- "Quitar" con nombre accesible completo: "Quitar Uros y Taquile del carrito".
- Botón deshabilitado acompañado de texto que explica por qué.
