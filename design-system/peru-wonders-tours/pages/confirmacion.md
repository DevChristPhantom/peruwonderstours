# Página: Confirmación (`/es/reserva/[codigo]/confirmada`)

**Objetivo:** dar tranquilidad inmediata (pago recibido, cupos asegurados), dejar claro qué falta (saldo y
fecha) y qué hacer después. Sin confeti, sin upsell agresivo.

Acceso: URL con token firmado (no se exponen datos personales en la URL); se envía el mismo enlace por
correo. Los datos personales no van en query strings.

## Estructura

1. Header normal (sólido), carrito vacío.
2. **Bloque de estado** (centrado, max 720):
   - Ícono check en círculo `success` (48 px) dibujado con `stroke-dashoffset` 600 ms.
   - h1 Fraunces: "¡Tu reserva está confirmada, Ana!"
   - Texto: "Enviamos los detalles a ana•••@gmail.com y a tu WhatsApp."
   - **Código de reserva** grande en Geist Mono 28 px: `PWT-7K4Q2` + botón "Copiar código" (feedback
     "Copiado" 1.5 s, `aria-live`).
3. **Estado del pago** (tarjeta `surface`):

```
Pagaste hoy                                   S/ 2,739.00   Visa •••• 4242 · 7 oct. 2026
Saldo pendiente                                 S/ 639.00
  Uros y Taquile       S/ 259.00   vence sáb, 7 nov. 2026    [Pagar saldo ahora]
  Colca 2D/1N          S/ 380.00   vence lun, 9 nov. 2026
Total de la reserva                           S/ 3,378.00
Comprobante: Boleta B001-000123 (PDF)  ·  se emitirá otro por el saldo
```

   - Saldo con badge `warning-soft` "Pendiente"; si pagó el 100 %: badge `success-soft` "Pagado completo"
     y sin bloque de saldo.
   - "Pagar saldo ahora" (outline): opción para adelantar; no es el foco de la página.
   - Recordatorios: "Te recordaremos el saldo por correo y WhatsApp 3 días antes del vencimiento."
4. **Tus tours** (lista cronológica): foto, título, fecha y hora, punto de encuentro/recojo, viajeros, botón
   "Agregar al calendario" (.ics / Google) y "Ver detalles".
5. **Próximos pasos** (lista numerada):
   1. "Revisa tu correo: ahí está tu voucher."
   2. "Te escribiremos por WhatsApp 24 h antes para coordinar el recojo."
   3. "Lleva tu DNI o pasaporte original (obligatorio para Machu Picchu)."
   4. "Llega un día antes a Puno para aclimatarte a la altura."
6. **Acciones**: `secondary` "Descargar voucher (PDF)" · ghost "Imprimir" · "Crear cuenta con un clic"
   (opcional, para gestionar la reserva; contraseña o enlace mágico).
7. **Ayuda**: "¿Necesitas cambiar algo? Escríbenos por WhatsApp +51 989 028 802" · Política de cancelación ·
   Libro de Reclamaciones.
8. Al final (sutil): "También te puede interesar" 3 tours del mismo destino.

## Estados

| Estado | Comportamiento |
|---|---|
| Pago confirmado (webhook recibido) | Vista descrita arriba. |
| Pago pendiente (PagoEfectivo / confirmación bancaria en curso) | Ícono reloj `warning`, h1 "Tu reserva está pendiente de pago", código CIP grande + "Copiar", monto, vencimiento ("Paga antes del jue, 8 oct. 2026, 11:20 a. m."), instrucciones por canal, aviso "Tus cupos están guardados hasta entonces". Polling silencioso; al confirmarse, transición a la vista confirmada con anuncio `aria-live`. |
| Pago fallido tras redirección | No se muestra esta página: vuelve al paso 3 del checkout con el error. |
| Comprobante en emisión | "Tu boleta se está generando; te la enviaremos por correo en unos minutos." |
| Enlace expirado/inválido | "Este enlace ya no es válido. Busca tu reserva con tu código y correo." (formulario simple). |

## Responsive

| | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Layout | 1 col, padding 16; acciones a todo ancho apiladas | 1 col 720 | 2 col: estado + pago (izq.) / próximos pasos y ayuda (der., 360) | igual, max 1120 |
| Código | 24 px, botón copiar debajo | 28 px en línea | igual | igual |

## Movimiento

Check dibujado 600 ms ease-out → h1 y código (stagger 60 ms, y 12 px, 500 ms) → tarjetas. Reducido: todo
visible de inmediato con el check ya dibujado. El foco inicial va al `h1` (`tabindex=-1`) para que el lector
de pantalla anuncie la confirmación.

## Copy

Cálido y concreto: "¡Listo!", "Tu reserva está confirmada", "Pagaste hoy", "Saldo pendiente", "Vence el",
"Agregar al calendario", "Descargar voucher". Nunca "Transacción exitosa".

## Notas técnicas para frontend

- Página con `noindex`. Evento de analítica `purchase` una sola vez (idempotente por código).
- Correo de confirmación con el mismo contenido y los mismos colores (hex de `colors.light` en
  `packages/ui/src/tokens.ts`, ya que los clientes de correo no soportan variables CSS).
