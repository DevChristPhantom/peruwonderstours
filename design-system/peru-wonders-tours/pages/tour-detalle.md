# Página: Ficha de tour (`/es/tours/[slug]`)

> Ejemplo de contenido: "Uros y Taquile día completo" (Puno). Mantener slugs del sitio actual con 301.

**Objetivo:** que el viajero entienda qué compra, cuánto cuesta en total y elija fecha y viajeros sin salir
de la página. **CTA primario:** "Agregar al carrito" (único `accent`). **Secundario:** "Reservar ahora"
(outline; agrega y va directo al checkout).

## Estructura

1. Header sólido (`hero-panel` + blur, sticky, 64 px) — no hay hero a pantalla completa.
2. Migas: Inicio / Destinos / Puno / Uros y Taquile (`nav aria-label="Migas de pan"`).
3. **Galería**: 1 foto grande + 4 miniaturas (1024+), botón "Ver las 18 fotos" → visor modal con
   teclado (← → Esc), contador "3 de 18", `alt` descriptivo por foto.
4. **Cabecera del producto**: h1 Fraunces `display-xl` · rating "4.9 · 128 reseñas" (enlace al bloque) ·
   meta con íconos: "Día completo (10 h)" · "Grupo de máx. 16" · "Español e inglés" · "Recojo en hotel
   de Puno" · badges `success-soft`: "Cancelación gratuita hasta 48 h antes" (solo si la política lo dice).
5. Columna principal (contenido) + **columna de reserva** (sticky a 88 px del top en 1024+).
6. Secciones de contenido (con índice ancla sticky horizontal en 768+: Resumen · Itinerario · Incluye ·
   Recomendaciones · Mapa · Reseñas · Preguntas):
   - **Resumen** (máx. 3 párrafos, 70 ch) + 4 "Lo mejor" con ícono check `success`.
   - **Itinerario** día/hora a día/hora: línea de tiempo vertical (punto + línea `border`), cada parada
     con hora, título, duración y descripción; en multidía, acordeones por día (Día 1 abierto). Aquí sí se
     usa storytelling suave: al hacer scroll, el punto activo se rellena `primary` (scrub desactivado en
     movimiento reducido).
   - **Incluye / No incluye**: dos listas con íconos `check` (`success`) y `x` (`foreground-muted`); el ícono
     es decorativo, el sentido lo da el encabezado de la lista.
   - **Recomendaciones y altura**: aviso `warning-soft` "Puno está a 3 812 m s. n. m. Te recomendamos
     llegar un día antes para aclimatarte." + qué llevar.
   - **Punto de encuentro / mapa**: mapa estático con enlace "Abrir en Google Maps" (mapa interactivo
     solo bajo demanda, por rendimiento).
   - **Política de cancelación** (texto completo, obligatorio antes de pagar; pendiente del cliente).
   - **Reseñas**: resumen (promedio, distribución), 3 reseñas + "Ver todas".
   - **Preguntas frecuentes**: acordeón (`button[aria-expanded]`).
   - **Tours relacionados**: 3 tarjetas.
7. Datos de la agencia y Libro de Reclamaciones en el footer.

## Columna / módulo de reserva

Contenedor `surface`, `radius-lg`, `shadow-md`, padding 24, ancho 380 (1024) / 400 (1440).

1. Precio: "Desde" (`sm` muted) **S/ 189.00** (`price-lg`) "por persona". Si hay precio por temporada o
   por tamaño de grupo, nota "El precio baja desde 4 viajeros".
2. **Fecha**: botón campo "Elige una fecha" → calendario en popover (desktop) / hoja inferior (móvil).
   Días con disponibilidad en `foreground`, sin cupos tachados y con `aria-disabled`, días con ≤ 5 cupos
   con punto `accent` y texto en el `aria-label` ("14 de noviembre, quedan 3 cupos"); leyenda visible
   bajo el calendario ("● Últimos cupos · ~~14~~ Sin cupos") para no depender solo del color. Navegación por
   teclado del calendario: flechas día/semana, PageUp/PageDown mes, Enter elige, Esc cierra.
   Si el tour tiene horarios: chips de hora debajo (`radiogroup`).
3. **Viajeros**: contadores Adultos (S/ 189.00), Niños 3–11 (S/ 140.00), Bebés 0–2 (gratis); botones
   −/+ de 44 px, `aria-label` "Quitar un adulto"; límite = cupos disponibles con mensaje "Solo quedan 3
   cupos para esta fecha".
4. **Opciones** (si existen): Grupal / Privado (radio cards), idioma del guía.
5. **Desglose**: "2 adultos × S/ 189.00" … líneas; impuestos incluidos; **Total S/ 378.00**.
   Debajo, bloque `success-soft`: "Reserva hoy con el 50 %: **S/ 189.00**. El saldo de S/ 189.00 se paga
   hasta el 7 nov. 2026." (fecha = salida − 7 días, a confirmar con el cliente). Si el tour exige 100 %
   (boletos de tren o Machu Picchu): "Este tour requiere el pago completo al reservar porque incluye boletos
   de terceros."
6. Botón `accent` "Agregar al carrito" (48 px, ancho completo) + outline "Reservar ahora".
7. Microcopy de confianza: "Sin cargos ocultos · Pago seguro · Confirmación inmediata por correo".
8. Enlace "¿Dudas? Escríbenos por WhatsApp".

**Móvil (375/768):** el módulo se convierte en **barra inferior sticky** (`surface`, `shadow-sticky`,
safe-area): "Desde S/ 189.00 / persona" + botón `accent` "Ver fechas". Al tocar, hoja inferior a 92 % de
alto con los pasos 2–6. La barra no tapa contenido (padding-bottom del `main` = alto de la barra).

## Estados

| Estado | Comportamiento |
|---|---|
| Cargando disponibilidad | Skeleton del calendario; botones deshabilitados con `aria-busy`. |
| Sin fecha elegida y clic en "Agregar" | No se deshabilita el botón: se enfoca el campo fecha y aparece error inline "Elige una fecha para continuar". |
| Fecha sin cupos para la cantidad elegida | Error inline en viajeros: "Para el 14 nov. quedan 3 cupos. Reduce viajeros o elige otra fecha." + sugerencia de 3 fechas cercanas. |
| Agregado | Botón muestra check + "Agregado" (1.5 s) y vuelve; toast "Agregado a tu carrito" con "Ver carrito"; contador del header se actualiza (`aria-live`). |
| Ya en carrito | Nota "Ya tienes este tour el 14 nov. en tu carrito · Ver carrito". Agregar otra fecha es válido. |
| Tour agotado / pausado | Banner `warning-soft` "Este tour no tiene salidas próximas." + "Avísame cuando haya fechas" (correo, con consentimiento) + relacionados. |
| Error de red | "No pudimos consultar la disponibilidad. Reintentar" (botón), el resto de la ficha sigue usable. |
| Precio cambió (inventario) | Si al agregar el precio difiere: aviso antes de confirmar, nunca en silencio. |

## Responsive

| | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Galería | Carrusel a sangre 4:3 con contador y botones | Grid 1 + 2 | Grid 1 grande + 4 | igual, max 1280 |
| Layout | 1 col + barra sticky | 1 col + barra sticky | 2 col: 1fr / 380 px | 2 col: 1fr / 400 px, gap 48 |
| Índice de secciones | Oculto (acordeones) | Sticky horizontal con scroll | Sticky | Sticky |
| Itinerario | Línea de tiempo compacta | igual | igual | igual |

## Movimiento

- Entrada: galería con `clip-path` 600 ms; título y meta stagger 60 ms.
- Al agregar al carrito (con movimiento): miniatura de la foto vuela al ícono del carrito (GSAP Flip,
  500 ms ease-out, opcional) + pulso del ícono 250 ms. Reducido: solo toast y contador.
- Acordeones: altura con `grid-template-rows: 0fr → 1fr` 360 ms ease-in-out.

## Copy clave

- "Elige una fecha" · "¿Cuántos viajan?" · "Total para 2 viajeros" · "Agregar al carrito" ·
  "Reservar ahora" · "Incluye" · "No incluye" · "Antes de viajar" · "Política de cancelación".

## SEO / datos estructurados

`Product` + `Offer` (precio PEN, disponibilidad), `AggregateRating` solo con reseñas reales,
`BreadcrumbList`; hreflang es/en; imágenes con dimensiones para evitar CLS.
