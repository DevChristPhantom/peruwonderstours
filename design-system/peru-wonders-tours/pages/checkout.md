# Página: Checkout (`/es/checkout`) — 3 pasos

**Objetivo:** pagar en el menor tiempo posible, como invitado, entendiendo exactamente cuánto se paga hoy,
cuánto queda y cuándo. **Pasos:** 1. Tus datos · 2. Viajeros · 3. Pago. (La revisión final está integrada en el
paso 3; no hay paso "Revisar" aparte.) Al pulsar "Pagar" se va a la confirmación.

Reglas de negocio (supuestos de `alcance-cliente-v1.md`, a confirmar con el cliente): se cobra el 50 % del
total de los ítems que lo permiten y el 100 % de los que incluyen boletos de terceros; el saldo vence
**7 días antes de la salida de cada tour** y se paga online con enlace o en efectivo/transferencia en Puno;
el comprobante SUNAT se emite por el monto pagado. La política de cancelación del adelanto se muestra
completa antes de pagar (pendiente del cliente).

## Layout general

- Header de checkout **reducido**: logo (enlace con confirmación "¿Salir del pago? Tu carrito se guarda"),
  indicador de pasos y "Pago seguro" con candado. Sin nav, sin dropdown, sin carrito (menos fugas).
- Indicador de pasos: `ol` con 3 ítems, actual con `aria-current="step"`, completados con check y enlace
  para volver. Texto visible "Paso 2 de 3 · Viajeros" en móvil.
- 2 columnas en 1024+: formulario (max 640) + **resumen del pedido** sticky (380–400 px). En 375/768 el
  resumen es un acordeón arriba "Ver resumen · S/ 3,378.00" + barra inferior sticky con el monto a pagar
  hoy y el botón del paso.
- Footer mínimo: términos, privacidad, Libro de Reclamaciones, RUC y razón social.
- Contenedor `narrow` (720) en 768; inputs 48 px, labels visibles, `autocomplete` correcto.

## Paso 1 — Tus datos (contacto de quien reserva)

| Campo | Tipo / autocomplete | Validación (en blur) | Mensaje de error |
|---|---|---|---|
| Nombres | text / `given-name` | requerido | "Escribe tus nombres." |
| Apellidos | text / `family-name` | requerido | "Escribe tus apellidos." |
| Correo electrónico | email / `email`, `inputmode=email` | formato | "Revisa el correo; aquí te enviaremos la confirmación." |
| Celular (WhatsApp) | tel / `tel`, selector de país (+51 por defecto) | 9 dígitos en Perú | "Ingresa un celular de 9 dígitos." |
| País de residencia | select / `country-name` | requerido | — |
| Comprobante | radio: Boleta (por defecto) / Factura | — | Si Factura: RUC (11 dígitos, `inputmode=numeric`) y razón social (autocompletar vía consulta RUC si hay API) |

- Checkbox **no marcado por defecto**: "Acepto la Política de privacidad y el tratamiento de mis datos para
  gestionar mi reserva (Ley 29733)." (requerido). Segundo checkbox opcional: "Quiero recibir ofertas y
  novedades." (separado, Ley 29733).
- Enlace discreto "¿Ya tienes cuenta? Inicia sesión" (no obligatorio). Al final del proceso se ofrece crear
  cuenta con un clic.
- Botón `accent` "Continuar a viajeros".

## Paso 2 — Viajeros

- Un bloque por tour del carrito, plegable, con los viajeros que requiere (nombres completos, tipo y número
  de documento, nacionalidad, fecha de nacimiento si el tour lo exige — p. ej. Machu Picchu requiere
  pasaporte/DNI exacto).
- Atajo: "Usar mis datos para el viajero 1" (checkbox marcado por defecto) y "Copiar viajeros del tour
  anterior" cuando las personas se repiten.
- Campos opcionales agrupados: "Necesidades especiales o alimentación" (textarea), "Hotel en Puno para el
  recojo" (texto con sugerencias).
- Aviso informativo `warning-soft` cuando aplique: "Los boletos de Machu Picchu se emiten con el nombre y
  documento exactos. Revísalos bien."
- Botón `accent` "Continuar al pago" · enlace "Volver a tus datos".

## Paso 3 — Pago (con revisión integrada)

### 3.1 ¿Cuánto quieres pagar hoy? (selector principal)

`fieldset` + `legend` "¿Cuánto quieres pagar hoy?" con dos **radio cards** (48 px+ de alto, borde 2 px
`primary` + check cuando está seleccionada; no depende solo del color):

```
(●) Pagar 50 % ahora                                     S/ 2,739.00
    Reserva tus cupos hoy y paga el resto antes de viajar.
    ┌──────────────────────────────────────────────────────────────┐
    │ Hoy                                           S/ 2,739.00    │
    │   Uros y Taquile · 50 %                        S/ 259.00     │
    │   Colca 2D/1N · 50 %                           S/ 380.00     │
    │   Machu Picchu full day · 100 % (boletos)    S/ 2,100.00     │
    │ Saldo pendiente                                 S/ 639.00    │
    │   S/ 259.00 hasta el sáb, 7 nov. 2026 (Uros y Taquile)       │
    │   S/ 380.00 hasta el lun, 9 nov. 2026 (Colca 2D/1N)          │
    │ Cómo pagar el saldo: enlace de pago que te enviaremos por    │
    │ correo y WhatsApp, o en efectivo/transferencia en Puno.      │
    └──────────────────────────────────────────────────────────────┘

( ) Pagar el 100 % ahora                                 S/ 3,378.00
    Sin saldos pendientes. Recibes un solo comprobante.
```

- Por defecto: **50 %** (es el diferencial pedido por el cliente). El desglose del saldo se muestra siempre
  que el 50 % esté seleccionado, no en un tooltip.
- Si ningún ítem admite 50 %, el selector se reemplaza por una línea: "Este pedido se paga completo porque
  incluye boletos de terceros."
- Si una salida es en menos de 7 días, ese ítem pasa a 100 % automáticamente con la nota "Sale en menos de
  7 días: se paga completo".
- Cambiar la opción actualiza el monto del botón y del resumen con crossfade de cifras (300 ms; reducido:
  instantáneo) y anuncio `aria-live`: "Pagarás hoy S/ 3,378.00".

### 3.2 Método de pago

- Tabs/radios: **Tarjeta** (Visa, Mastercard, Amex, Diners) · **Yape** · **PagoEfectivo** (banca por
  internet/agentes) — según el proveedor que se elija. Logos oficiales.
- Tarjeta: **formulario embebido del proveedor** (iframe/hosted fields) — nunca campos propios (PCI SAQ-A).
  El contenedor hereda radios y tipografía donde el proveedor lo permita. Texto: "Tus datos de tarjeta van
  directo a [proveedor]; Peru Wonders Tours no los guarda."
- Yape: monto + instrucción del proveedor (QR en desktop, app en móvil).
- PagoEfectivo: "Generaremos un código CIP válido por 24 h. Tus cupos quedan bloqueados hasta entonces."

### 3.3 Revisión y consentimiento

- Resumen compacto editable: contacto (enlace "Editar" → paso 1), viajeros por tour ("Editar" → paso 2).
- **Política de cancelación** visible (resumen de 3 líneas + "Ver política completa" en modal) — obligatorio
  antes de pagar.
- Checkbox requerido: "Leí y acepto los Términos y condiciones y la Política de cancelación."
- Temporizador honesto de bloqueo de cupos: "Guardamos tus cupos 15:00 min" (`aria-live` solo en los
  minutos 5 y 1; sin animación agresiva). A los 2 min restantes aparece el botón
  "Necesito más tiempo" que extiende 15 min más (WCAG 2.2.1, hasta 3 veces; luego se revalida disponibilidad). Al vencer: "Liberamos tus cupos. Revisamos la disponibilidad otra
  vez…" y se reintenta el bloqueo.

### 3.4 Botón final

`accent`, ancho completo, 56 px: **"Pagar S/ 2,739.00"** (o "Pagar S/ 3,378.00"). Debajo: "Pago seguro ·
Recibirás tu boleta electrónica por correo".

Estados del botón: normal · loading ("Procesando tu pago…", spinner, deshabilitado para evitar doble
cobro, `aria-busy`) · error (vuelve a habilitarse).

## Resumen lateral (todos los pasos)

Ítems (foto 56 px, título, fecha, viajeros, total), Total `price-lg`, y según la opción: "Hoy pagas
S/ 2,739.00" y "Saldo S/ 639.00". Botón "Editar carrito". Sellos: pago seguro, Libro de Reclamaciones.

## Estados y errores

| Caso | UX |
|---|---|
| Error de validación al continuar | Resumen de errores enfocable arriba del formulario (`role="alert"`, `tabindex=-1`, enlaces a cada campo) + errores inline con `aria-describedby`. |
| Pago rechazado | Mensaje `danger-soft` arriba del método, en lenguaje claro según código: "Tu banco rechazó el pago. Prueba con otra tarjeta o paga con Yape." Los datos se conservan; los cupos siguen bloqueados mientras dure el temporizador. |
| Tiempo de espera / respuesta incierta | Pantalla "Estamos confirmando tu pago con el banco…" con polling; nunca pedir pagar de nuevo hasta saber el estado (webhook). |
| Cupos agotados al bloquear | Antes del pago: "Mientras completabas tus datos se agotaron los cupos de Colca 2D/1N del 16 nov." + "Elegir otra fecha" / "Quitar y continuar". |
| Sesión expirada | Se recupera desde el carrito persistente; los datos del formulario se guardan en `sessionStorage` (sin datos de pago). |
| Sin conexión | Banner "Sin conexión. Tus datos están guardados; reintenta cuando vuelvas a tener señal." |

## Responsive

| | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Pasos | "Paso 1 de 3 · Tus datos" + barra de progreso | Indicador de 3 pasos horizontal | igual | igual |
| Layout | 1 col; resumen en acordeón arriba; barra inferior sticky con "Hoy pagas S/ …" + botón | 1 col, 720 | 2 col 640 / 380 | 2 col 640 / 400, centrado |
| Radio cards 50/100 | Apiladas a todo ancho | Apiladas | Apiladas | Apiladas (claridad > compacidad) |

## Movimiento

- Cambio de paso: contenido sale `x: -24px` + opacidad + blur 4 px y el nuevo entra desde `+24px`
  (500 ms ease-out); al volver, dirección inversa. Foco al `h2` del nuevo paso.
- Radio card seleccionada: borde y fondo 160 ms; desglose del saldo con altura animada 360 ms.
- Reducido: todo instantáneo; el foco y los anuncios se mantienen.

## Copy clave (es-PE)

"Tus datos" · "Viajeros" · "Pago" · "¿Cuánto quieres pagar hoy?" · "Pagar 50 % ahora" · "Pagar el 100 %
ahora" · "Saldo pendiente" · "Hasta el" · "Pagar S/ …" · "Procesando tu pago…" · "Pago seguro".
Evitar: "Submit", "Checkout", "Depósito no reembolsable" (salvo que la política lo diga, y entonces
explicado).

## Accesibilidad

- Cada paso es un `form` con `h2`; el indicador de pasos no es la única forma de navegar (botones "Volver").
- Radio cards: `input type=radio` nativo visualmente integrado (no `div` clicables).
- Montos con `tabular-nums`; los montos dinámicos en una región `aria-live="polite"`.
- El iframe del proveedor debe tener `title` ("Formulario de pago con tarjeta").
- Orden de foco: método → campos → consentimiento → Pagar; la barra sticky móvil no tapa el foco
  (`scroll-padding-bottom`).
