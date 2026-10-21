# Página: Home (`/es`)

> Actualización 2026-10-19 (ADR-0027): después del buscador, tours recomendados antes de destinos. Filtros de destacados con salto de línea en pantallas estrechas; tarjetas con ubicación superior y acción visible de itinerario/fechas. Los apartados históricos siguientes describen los componentes, no sustituyen este orden comercial.

> Sobrescribe a `MASTER.md` solo donde se indica. Hero y header: **valores exactos** de
> `docs/design/hero-morph-spec.md`; aquí solo se documenta la adaptación a la marca y lo que va debajo.

**Objetivo:** que el visitante busque (o entre a un destino) en ≤ 1 interacción y confíe en la agencia.
**CTA primario:** buscador. **CTA secundario:** "Reservar" en el header (abre el carrito si tiene ítems,
si no lleva a `/es/tours`).

## Estructura (orden del DOM = orden visual)

1. Skip link "Saltar al contenido" (visible al foco).
2. **Header** (sobre el hero, absoluto, z 20).
3. **Hero** a pantalla completa con indicador "( desliza )".
4. **Buscador** de tours, montado sobre el borde inferior del hero.
5. **Destinos** (5 tarjetas).
6. **Paquetes destacados** (4–6 tarjetas de producto).
7. **Por qué viajar con nosotros** (4 razones con datos verificables).
8. **Testimonios**.
9. **Confianza y legales** (sellos + Libro de Reclamaciones).
10. **CTA final** (WhatsApp / asesor).
11. **Footer** (datos de la agencia, MINCETUR, RUC real, Libro de Reclamaciones, privacidad).

---

## 1–3. Header y hero (adaptación de la spec)

| Elemento | Contenido Peru Wonders Tours |
|---|---|
| Logo | Versión negativa (ver `logo-colores.md`), alto 32 px desktop / 28 px móvil, enlace a `/es` con `aria-label="Peru Wonders Tours, inicio"` |
| Nav (desktop ≥ 861) | `Descubre ▾` · `Viajes ▾` · `Destinos ▾` · `Nosotros` |
| Panel A "Descubre" (664×358) | Lago Titicaca — "Islas flotantes de los Uros, Taquile y Amantaní" · Machu Picchu — "La ciudadela inca, en tren o por el Camino Inca" · Cañón del Colca — "Cóndores y miradores a 3 000 m de profundidad" · Huacachina y Paracas — "Dunas, oasis e islas Ballestas". Imagen derecha = foto real del cliente de cada destino (`alt=""`, spec). |
| Panel B "Viajes" (446×308) | Tarjetas foto: "Tours en grupo" · "Viajes privados" |
| Panel C "Destinos" (232×218) | Cusco · Puno · Arequipa · Ica-Paracas · Lima (5 filas `flex: 1` dentro de 232×218 → ≈ 40 px por fila; el área táctil se completa con el padding del panel) |
| Acciones (derecha) | Selector de idioma `ES ▾` (ES/EN, `aria-label="Idioma"`), ícono carrito (Lucide `shopping-bag` 20 px, botón 44×44, contador pill dorado-300 con texto piedra-900, `aria-label="Carrito, 2 tours"`), CTA pill blanco "Reservar" |
| Móvil (≤ 860) | Logo · carrito · botón menú (spec 36×32, área 44). Hoja con secciones "Descubre / Viajes / Destinos" + "Nosotros", idioma y WhatsApp al final |
| Fondo del hero | Foto propia del cliente (recomendado: Lago Titicaca al amanecer o Uros; `role="img"`, `aria-label="Amanecer sobre el lago Titicaca, Puno"`). AVIF/WebP, 2400 px, `fetchpriority="high"`, `background-position: center 45%` |
| Titular | La spec no lleva titular. Para SEO y claridad añadimos un **h1 visualmente discreto** en la parte inferior izquierda del hero: Fraunces `display-xl`, blanco: "El Perú, contado desde Puno". Sublínea `body-lg` hero-soft: "Tours y paquetes con guías locales, precios claros y reserva con el 50 %." Entrada: `fadeUp` 900 ms, delay 600 ms. En reducción: estático. |

Header al hacer scroll (> 80 px): pasa a `position: sticky` con fondo `hero-panel` + `backdrop-filter: blur(22px)`,
alto 64 px, transición de fondo 250 ms. Al entrar al buscador, el header muestra un mini-buscador
compacto solo en ≥ 1024 (opcional, fase 2).

## 4. Buscador (CTA primario)

- Contenedor `surface`, `radius-lg`, `shadow-lg`, max 1080 px, centrado, `margin-top: -48px` (monta
  sobre el hero; z 10). En modo oscuro: `surface` + borde `border`.
- Campos (desktop en una fila, separados por divisor vertical 1 px `border`):
  1. **Destino o experiencia** — combobox (`role="combobox"`, lista con destinos, categorías y tours;
     teclado ↑↓ Enter Esc). Placeholder de ejemplo, label visible "¿A dónde vas?".
  2. **Fecha** — selector de fecha (calendario de 2 meses en desktop, 1 en móvil a pantalla completa),
     label "¿Cuándo?". Atajos "Este fin de semana", "Fechas flexibles".
  3. **Viajeros** — popover con contadores Adultos / Niños (3–11) / Bebés (0–2), mín. 1 adulto;
     label "Viajeros", resumen "2 adultos".
  4. Botón `accent` "Buscar tours" (ícono `search`), 56 px alto.
- 768: 2×2 (destino a todo ancho, fecha + viajeros, botón a todo ancho).
- 375: tarjeta apilada; cada campo 56 px; botón a todo ancho. Al tocar destino se abre una vista
  a pantalla completa con campo de texto con foco y "Destinos populares".
- Debajo, chips de acceso rápido (pill outline): "Uros y Taquile" · "Machu Picchu" · "Colca 2D/1N" ·
  "Paquetes desde 5 días".

**Estados:** foco (ring 2 px por campo) · sugerencias cargando (skeleton de 3 filas, 200 ms de
debounce) · sin coincidencias ("No encontramos «xyz». Prueba con un destino como Puno o Cusco.") ·
error de red ("No pudimos cargar sugerencias. Puedes buscar igual.") · enviar sin destino permitido
(muestra todos los tours en la fecha elegida).

## 5. Destinos

- h2 "Destinos que conocemos de memoria" + enlace "Ver todos los destinos →".
- 5 tarjetas foto vertical 4:5 (Puno, Cusco, Arequipa, Ica-Paracas, Lima), texto sobre gradiente
  inferior (spec panel B: `linear-gradient(to top, rgba(6,9,11,.8), transparent 60%)`), nombre en
  Fraunces h3 blanco y "15 tours" en hero-soft.
- 1440: grid 5 col; 1024: 3 + 2 (Puno grande 2 filas); 768: 2 col; 375: carrusel horizontal con
  scroll-snap, 82 % ancho, botones Anterior/Siguiente visibles (no solo swipe), sin autoplay.
- Hover: zoom de imagen 1.05 + brillo 1.08 (spec), 900 ms ease-out.

## 6. Paquetes destacados

- h2 "Paquetes destacados" + tabs filtro (`role="tablist"`): Todos · Altiplano · Machu Picchu ·
  Multidestino.
- Tarjeta de producto (MASTER §7): foto 4:3, badge (`highlight` "Más vendido" o `accent-soft`
  "Quedan 3 cupos" solo si inventario ≤ 5 en la próxima salida), título, meta "8 días · Cusco, Puno,
  Arequipa", rating "4.9 (128 reseñas)", precio "Desde **S/ 2,890.00** por persona", línea
  `success` "Reserva con 50 %: S/ 1,445.00", botón icono "Guardar" (corazón, `aria-pressed`).
- 1440: 3 col (6 tarjetas) · 1024: 3 col · 768: 2 col · 375: 1 col (máx. 4, luego "Ver los 55 tours").
- Estados: skeleton (foto + 3 líneas, shimmer desactivado en movimiento reducido) · vacío por filtro
  ("Aún no tenemos paquetes en esta categoría. Mira los tours de 1 día.") · error ("No pudimos
  cargar los paquetes. Reintentar").

## 7. Por qué viajar con nosotros

4 columnas con ícono Lucide 24 px en `primary` y texto: "Oficina en Puno desde [año]" ·
"Guías locales certificados" · "Paga el 50 % y reserva" · "Atención por WhatsApp 7 días".
Solo datos que el cliente confirme (no inventar cifras).

## 8. Testimonios

- h2 "Lo que cuentan nuestros viajeros". Tarjetas `surface` con cita (body), nombre, país, tour y
  fecha, estrellas en `highlight` con texto alternativo "5 de 5".
- Fuente: testimonios reales migrados de `/es/testimonios` (con consentimiento). Si se integra
  TripAdvisor/Google, mostrar el logo oficial y enlace a la fuente.
- Carrusel manual (sin autoplay) con botones y paginación "2 de 8"; en 1024+ grid de 3.
- Vacío: se oculta la sección. Enlace "Deja tu testimonio" → `/es/dejar-testimonio`.

## 9. Confianza y legales (obligatorio)

- Banda `surface-muted`, título `label` "Agencia registrada y segura".
- Sellos oficiales con sus archivos originales (sin recolorear ni pasar a escala de grises: son
  sellos de garantía), alto 48 px: MINCETUR / GERCETUR (registro de
  agencia, n.º visible en texto), Safe Travels (WTTC), Código de Conducta ESNNA, Marca Perú (si el
  cliente tiene licencia), SERNANP (si aplica). Cada sello con `alt` descriptivo y enlace a la
  verificación oficial cuando exista.
- **Libro de Reclamaciones**: bloque visible (no solo en el footer) con ícono oficial del libro,
  texto "Libro de Reclamaciones" y enlace a `/es/libro-de-reclamaciones`; botón outline 44 px.
- Medios de pago aceptados (logos oficiales): Visa, Mastercard, Yape, PagoEfectivo… según proveedor.
- 375: sellos en grid 3 col; Libro de Reclamaciones a todo ancho.

## 10. CTA final

Fondo `primary` (titicaca-700), texto `on-primary`: h2 Fraunces "¿Armamos tu viaje a medida?",
párrafo, botones "Escríbenos por WhatsApp" (blanco sobre primary, ícono oficial de WhatsApp) y
"Ver paquetes" (outline blanco). El único `accent` de esta vista sigue siendo el del buscador.

## 11. Footer

Fondo `noche-ink`. Columnas: Peru Wonders Tours (razón social, RUC real, registro MINCETUR, dirección
Calle N 500, Puno, teléfono, correo `@peruwonderstours.com`) · Destinos · Ayuda (Preguntas frecuentes,
Términos, Política de cancelación, Política de privacidad, Derechos ARCO, Cookies) · Libro de
Reclamaciones (ícono + enlace) · redes. Texto ESNNA: "Peru Wonders Tours rechaza toda forma de
explotación sexual de niñas, niños y adolescentes (Ley 30802)" (validar texto con cumplimiento).

---

## Movimiento de la home

| Momento | Animación | Duración / ease | Reducido |
|---|---|---|---|
| Carga | Spec: `heroIn` 2.4 s, header en cascada 350/450/550, scroll cue 900 | spec | Estado final inmediato |
| Carga | Buscador `y 24→0` + opacidad | 900 ms, delay 700, ease-out | Estático |
| Scroll | Títulos de sección y tarjetas (stagger 60 ms, y 20 px) | 500 ms ease-out | Visibles |
| Scroll | Imágenes de destinos `clip-path inset(8%)→0` | 600 ms | Sin clip |
| Hover | Zoom imagen tarjeta 1.04–1.05 | 900 ms | Sin zoom |
| Click "Agregar" | Pulso del ícono carrito + contador | 250 ms | Solo cambio de número + anuncio `aria-live` |

## Responsive (resumen)

| | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Header | Logo + carrito + menú (hoja) | igual | Nav completo con dropdown morph (≥ 861) | igual, gutter 52 px |
| Hero | 100svh, h1 bottom 120 px | igual | igual | igual |
| Buscador | Apilado, botón a todo ancho | 2×2 | 1 fila | 1 fila, 1080 px |
| Destinos | Carrusel 82 % | 2 col | 3+2 | 5 col |
| Paquetes | 1 col | 2 col | 3 col | 3 col |
| Sellos | 3 col | 6 col | 1 fila | 1 fila |

## Copy (es-PE)

Botones con verbo: "Buscar tours", "Ver detalles", "Agregar al carrito", "Reservar". Evitar
anglicismos ("tour" y "full day" se aceptan por uso local; preferir "día completo" en títulos nuevos).
Tuteo cercano y respetuoso. Montos `S/ 1,250.00`.

## Accesibilidad específica

- Dropdown: patrón "disclosure navigation" (botones con `aria-expanded` + `aria-controls`), no `menu`.
- El hero se lee: h1 → sublínea; el indicador de scroll es `aria-hidden`.
- Carruseles con controles y sin autoplay; tarjetas con un solo enlace principal (toda la tarjeta
  clicable vía `::after` del enlace del título) y el botón Guardar separado.
- Contador del carrito anunciado con `aria-live="polite"`: "Se agregó Uros y Taquile. Tu carrito tiene 2 tours."
