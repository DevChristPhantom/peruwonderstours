# Design System Master File — Peru Wonders Tours

> **LÓGICA:** al construir una página, revisa primero `design-system/peru-wonders-tours/pages/[pagina].md`.
> Si existe, sus reglas **prevalecen** sobre este archivo. Si no, aplica estrictamente lo de abajo.
> Implementación en código: `packages/ui/src/tokens.css`, `packages/ui/src/theme.css` (Tailwind v4)
> y `packages/ui/src/tokens.ts`. **Si cambias un valor aquí, cámbialo también allí.**

---

**Proyecto:** Peru Wonders Tours (OTA de turismo nacional, oficina en Puno)
**Generado:** 2026-10-07 con `ui-ux-pro-max` 2.13.0 (`--variance 6 --motion 8 --density 4`)
**Curado:** 2026-10-07 por UX/UI senior. La salida bruta de la skill se revisó y se reemplazó
donde no encajaba con el Perú (ver §11 "Sugerencias descartadas").
**Categoría:** Travel/Tourism Agency → patrón de OTA "Marketplace / Directory" con hero de marca.
**Referencias obligatorias:** `docs/design/hero-morph-spec.md` (hero + dropdown morph, valores exactos),
`brain/wiki/concepts/alcance-cliente-v1.md` (carrito, adelanto 50 %, cambio de colores del logo).

---

## 1. Concepto de identidad: "Piedra, lago y telar"

El sitio debe sentirse como un viaje bien organizado por gente de Puno que conoce el terreno:
sobrio, cálido y confiable, no un folleto saturado.

| Fuente peruana | Traducción a UI | Dónde se usa |
|---|---|---|
| **Lago Titicaca** (azul profundo a 3 812 m) | Color primario de marca, navegación, enlaces, foco | Header sólido, botones secundarios, links, anillo de foco |
| **Textil andino** (cochinilla y achiote, rojos-terracota de Taquile y Chinchero) | Acento de conversión, único color "cálido fuerte" | Botón principal (Reservar, Pagar), badges de cupos reales |
| **Selva** (Tambopata, Manu) | Estado de éxito y confirmación | "Reserva confirmada", "Cancelación gratuita", check de incluido |
| **Dorado inca** (Qorikancha) | Detalle decorativo y destacado, **nunca texto sobre claro** | Estrellas de reseñas, sello "Más vendido" con texto oscuro, línea de la montaña del logo |
| **Piedra inca** (granito de Sacsayhuamán, sillar de Arequipa) | Neutros cálidos de fondos, bordes y texto | Fondos, tarjetas, divisores, texto |
| **Noche altiplánica** (`--ink #0B1013` de la spec del hero) | Fondo del modo oscuro y del hero | Hero, dropdown, footer, modo oscuro |

Recurso gráfico propio (opcional, con moderación): una greca escalonada (chakana simplificada en
escalones de 4 px) como divisor de secciones o borde inferior de la tarjeta destacada. Nada de
llamas en caricatura, zampoñas, ni tipografías "incaicas" de fantasía. Las fotos reales del cliente
son la protagonista; la UI se retira para dejarlas hablar.

---

## 2. Color

### 2.1 Primitivos (escalas)

| Escala | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **titicaca** | `#EEF5FA` | `#D6E6F2` | `#ADCBE3` | `#7AA8CC` | `#4A84B0` | `#2A6593` | `#1C4F7A` | `#153F63` | `#10304D` | `#0B2238` | `#06141F` |
| **terracota** | `#FCF2EE` | `#F7DFD5` | `#EEBDA9` | `#E29576` | `#D46F4D` | `#C0532F` | `#A34224` | `#84351E` | `#66291A` | `#4A1F15` | `#2E130D` |
| **selva** | `#EDF7F1` | `#D2EBDC` | `#A6D6BA` | `#6FBA92` | `#3E9A6C` | `#23794F` | `#1A6140` | `#144D33` | `#103B28` | `#0B2A1D` | `#061A12` |
| **dorado** | `#FDF8EA` | `#FAEDC7` | `#F4D98C` | `#EDC152` | `#E3A92B` | `#C98C17` | `#A06C12` | `#7A5210` | `#573B0D` | `#3B280A` | `#231805` |
| **piedra** | `#F7F5F2` | `#EFEBE6` | `#E0DAD2` | `#C9C0B5` | `#A39889` | `#7D7365` | `#5F574C` | `#48423A` | `#312D28` | `#1F1C19` | `#141210` |
| **noche** | `#0B1013` (ink) · `#12191E` (surface) · `#1A232A` (raised) · `#2A353D` (line) · `#6B7A86` (line-strong) |

Rojo de error (no es color de marca, para no confundirlo con el terracota del CTA):
`danger-50 #FEF1EF`, `danger-600 #B42318`, `danger-300 #F08A7C` (oscuro).

### 2.2 Tokens semánticos

| Token (`--pwt-*`) | Claro | Oscuro | Uso |
|---|---|---|---|
| `background` | `#F7F5F2` piedra-50 | `#0B1013` noche-ink | Fondo de página |
| `surface` | `#FFFFFF` | `#12191E` | Tarjetas, formularios, paneles |
| `surface-muted` | `#EFEBE6` piedra-100 | `#1A232A` | Filas alternas, resumen de pedido, skeleton |
| `foreground` | `#1F1C19` piedra-900 | `#F3F0EB` | Texto principal |
| `foreground-muted` | `#5F574C` piedra-600 | `#B3ABA0` | Texto secundario, ayudas |
| `primary` | `#153F63` titicaca-700 | `#7AA8CC` titicaca-300 | Marca, botón secundario relleno, header sólido |
| `primary-hover` | `#10304D` | `#ADCBE3` | |
| `on-primary` | `#FFFFFF` | `#06141F` | |
| `link` | `#1C4F7A` titicaca-600 | `#7AA8CC` | Enlaces en texto (siempre subrayados en cuerpo) |
| `accent` (CTA) | `#A34224` terracota-600 | `#D46F4D` terracota-400 | **Un solo** CTA principal por vista |
| `accent-hover` | `#84351E` | `#E29576` | |
| `on-accent` | `#FFFFFF` | `#1A0D08` | |
| `accent-soft` / `on-accent-soft` | `#FCF2EE` / `#84351E` | `#2E130D` / `#E29576` | Badge "Quedan 3 cupos" |
| `success` / `success-soft` | `#1A6140` / `#EDF7F1` | `#6FBA92` / `#0B2A1D` | Confirmado, incluido, cancelación gratis |
| `warning` / `warning-soft` | `#7A5210` / `#FDF8EA` | `#EDC152` / `#231805` | Saldo pendiente, avisos de altura |
| `danger` / `danger-soft` | `#B42318` / `#FEF1EF` | `#F08A7C` / `#2B1210` | Errores de formulario y pago |
| `highlight` | `#E3A92B` dorado-400 | `#EDC152` | Estrellas, sello "Más vendido" (texto `#1F1C19` encima) |
| `border` | `#E0DAD2` | `#2A353D` | Divisores decorativos |
| `border-strong` | `#7D7365` | `#6B7A86` | Bordes de inputs y controles (≥ 3:1) |
| `ring` | `#2A6593` | `#9CC3E0` | Anillo de foco (2 px + offset 2 px) |
| `overlay` | `rgba(11,16,19,.56)` | `rgba(0,0,0,.66)` | Scrim de modales/drawer |

Tokens del hero (copiados de la spec, no cambian con el tema porque el hero siempre es oscuro):
`--pwt-hero-ink #0B1013`, `--pwt-hero-panel rgba(14,19,23,.84)`, `--pwt-hero-line rgba(255,255,255,.08)`,
`--pwt-hero-hover rgba(255,255,255,.065)`, `--pwt-hero-text #FFF`, `--pwt-hero-soft rgba(255,255,255,.74)`,
`--pwt-hero-muted rgba(255,255,255,.60)`.

### 2.3 Pares de contraste verificados (WCAG 2.x, fórmula de luminancia relativa)

| Par | Ratio | Umbral |
|---|---|---|
| foreground / background (claro) | 15.58 | 4.5 ✔ |
| foreground-muted / surface (claro) | 7.11 | 4.5 ✔ |
| foreground-muted / surface-muted (claro) | 5.99 | 4.5 ✔ |
| on-primary / primary (claro) | 10.92 | 4.5 ✔ |
| link / surface (claro) | 8.58 | 4.5 ✔ |
| on-accent / accent (claro) | 6.25 | 4.5 ✔ |
| on-accent / accent-hover (claro) | 8.37 | 4.5 ✔ |
| accent como texto / background (claro) | 5.74 | 4.5 ✔ |
| success / surface (claro) | 7.43 | 4.5 ✔ |
| warning / warning-soft (claro) | 6.51 | 4.5 ✔ |
| danger / surface (claro) · danger / danger-soft | 6.57 · 5.96 | 4.5 ✔ |
| on-accent-soft / accent-soft (claro) | 7.60 | 4.5 ✔ |
| texto `#1F1C19` / highlight dorado | 8.06 | 4.5 ✔ |
| border-strong / surface · / background (claro) | 4.65 · 4.28 | 3.0 ✔ (no texto) |
| ring / background (claro) | 5.71 | 3.0 ✔ |
| foreground / background (oscuro) | 16.83 | 4.5 ✔ |
| foreground-muted / surface-muted (oscuro) | 7.02 | 4.5 ✔ |
| on-primary / primary (oscuro) | 7.36 | 4.5 ✔ |
| on-accent / accent (oscuro) | 5.59 | 4.5 ✔ |
| success · warning · danger / surface (oscuro) | 7.70 · 10.44 · 7.29 | 4.5 ✔ |
| border-strong / surface (oscuro) | 4.02 | 3.0 ✔ |
| ring / background (oscuro) | 10.29 | 3.0 ✔ |
| hero-muted (≈`#9FA1A2`) / panel (≈`#0E1317`) | 7.20 | 4.5 ✔ |
| CTA del hero `#0B0F12` / `#FFF` | 19.24 | 4.5 ✔ |

**Prohibido:** dorado-400/500 como texto o borde informativo sobre claro (2.10 y 2.90:1). Para texto
dorado sobre claro usar dorado-700 `#7A5210` (6.90:1). Texto sobre fotos solo con el scrim del hero
o una placa `hero-panel`; nunca confiar en la foto.

---

## 3. Tipografía

| Rol | Familia | Pesos | Por qué |
|---|---|---|---|
| **UI y cuerpo** | **Geist** (Google Fonts, variable 100–900, subsets latin + latin-ext) | 400, 500, 600 | Es la de la referencia del hero; neutra, legible a 13–15 px, cifras tabulares (`font-variant-numeric: tabular-nums`) para precios. Cubre á é í ó ú ñ ü ¿ ¡ y comillas « ». |
| **Display (titulares editoriales)** | **Fraunces** (variable, ejes `opsz` 9–144, `SOFT` 0–100, `wght`; latin + latin-ext) | 400, 500 · `opsz` auto · `SOFT 50` | Serif cálida con carácter artesanal que dialoga con el wordmark serif del logo actual sin caer en el cliché "lujo" de Playfair. Solo ≥ 28 px: títulos de sección, nombre del tour, número de reserva grande. |
| Mono (opcional) | Geist Mono | 400, 500 | Código de reserva (`PWT-7K4Q2`), referencias de pago. |

Fallbacks: `"Geist", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` ·
`"Fraunces", Georgia, "Times New Roman", serif`. Carga con `next/font/google` (`display: swap`,
`subsets: ['latin','latin-ext']`, `adjustFontFallback`), sin `@import` bloqueante.

### Escala (fluida, base 16 px; nunca < 16 px en inputs para evitar zoom en iOS)

| Token | Tamaño | Interlineado | Fuente / peso | Uso |
|---|---|---|---|---|
| `display-2xl` | `clamp(2.75rem, 1.6rem + 4.2vw, 5rem)` | 1.02, tracking −0.02em | Fraunces 400 | Titular de campaña (si hubiera) |
| `display-xl` | `clamp(2.25rem, 1.5rem + 2.8vw, 3.75rem)` | 1.05, −0.015em | Fraunces 400 | Nombre del tour en ficha |
| `h1` | `clamp(2rem, 1.5rem + 1.8vw, 3rem)` | 1.1 | Fraunces 500 | Títulos de página |
| `h2` | `clamp(1.625rem, 1.3rem + 1.2vw, 2.25rem)` | 1.15 | Fraunces 500 | Secciones de la home |
| `h3` | `1.375rem` (22) | 1.3 | Geist 500 | Tarjetas, pasos |
| `h4` | `1.125rem` (18) | 1.4 | Geist 500 | Subtítulos |
| `body-lg` | `1.125rem` | 1.6 | Geist 400 | Introducciones |
| `body` | `1rem` | 1.6 | Geist 400 | Texto general (medida 60–75 caracteres) |
| `sm` | `0.875rem` (14) | 1.5 | Geist 400 | Metadatos, ayudas |
| `nav` | `0.90625rem` (14.5) | 1.2 | Geist 400/500 | Triggers del header (spec) |
| `xs` | `0.8125rem` (13) | 1.42 | Geist 400 | Descripción en dropdown (spec), legales |
| `label` | `0.75rem` (12) | 1.3, uppercase, tracking 0.08em | Geist 500 | Encabezados de la hoja móvil (spec), eyebrow |
| `price-lg` | `1.75rem` | 1.1 | Geist 600 tabular | Precio total |

Copy: sentence case en español ("Paquetes destacados", no "Paquetes Destacados"). Precios con
`Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })` → `S/ 1,250.00` (coma de miles,
punto decimal, verificado en Node 24); en dólares → `USD 1,250.00`. Fechas con
`Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Lima' })`
→ `sáb, 14 nov. 2026`. Los montos viajan en céntimos (`integer`) y solo se formatean al mostrar.

---

## 4. Espaciado, layout y breakpoints

Base 4 px (densidad 4/10, "estándar con aire").

| Token | px | Token | px |
|---|---|---|---|
| `space-0-5` | 2 | `space-8` | 32 |
| `space-1` | 4 | `space-10` | 40 |
| `space-2` | 8 | `space-12` | 48 |
| `space-3` | 12 | `space-16` | 64 |
| `space-4` | 16 | `space-20` | 80 |
| `space-5` | 20 | `space-24` | 96 |
| `space-6` | 24 | `space-32` | 128 |

- `section-y`: `clamp(4rem, 2.5rem + 6vw, 8rem)` entre secciones de la home.
- `gutter`: `clamp(16px, 3.4vw, 52px)` (mismo que el `.bar` del header, spec: `clamp(20px,3.4vw,52px)`
  en header; el contenido usa mínimo 16 px a 375).
- `container`: `max-width: 1280px` (contenido), `1440px` (bleed de galerías), `720px` (texto/checkout de 1 columna).
- Grid: 4 col (375) · 8 col (768) · 12 col (1024+), gap 16/24/24/32.

| Breakpoint | Valor | Notas |
|---|---|---|
| `sm` | 375 px | Diseño base móvil (probar también 320) |
| `md` | 768 px | Tablet vertical |
| `nav` | 861 px | Cambio menú hoja ↔ nav con dropdown morph (spec: móvil ≤ 860) |
| `lg` | 1024 px | Desktop compacto; aparecen columnas laterales (filtros, resumen) |
| `xl` | 1440 px | Desktop amplio; contenedor máx. |

Objetivos táctiles ≥ 44×44 px (botones de 32 px del hero amplían su área con padding/`::after`).

---

## 5. Radios, bordes, elevación

| Token | Valor | Uso |
|---|---|---|
| `radius-xs` | 6 px | Anillo de foco (spec), chips |
| `radius-sm` | 9 px | Filas del panel Destinos (spec), inputs pequeños |
| `radius-md` | 10 px | Tarjetas foto del dropdown (spec), inputs, botones rectangulares |
| `radius-lg` | 16 px | Dropdown, hoja móvil, tarjetas, buscador |
| `radius-xl` | 24 px | Contenedores grandes, modales en desktop |
| `radius-pill` | 999 px | CTA del header, botón menú, chips de filtro |

Sombras cálidas (tono piedra, no negro puro), y la del dropdown tal cual de la spec:

| Token | Valor |
|---|---|
| `shadow-xs` | `0 1px 2px rgba(31,28,25,.06)` |
| `shadow-sm` | `0 1px 3px rgba(31,28,25,.08), 0 1px 2px rgba(31,28,25,.04)` |
| `shadow-md` | `0 6px 16px -4px rgba(31,28,25,.12), 0 2px 4px rgba(31,28,25,.06)` |
| `shadow-lg` | `0 18px 40px -12px rgba(31,28,25,.20), 0 4px 10px rgba(31,28,25,.06)` |
| `shadow-overlay` | `0 30px 70px -25px rgba(0,0,0,.65), 0 2px 10px rgba(0,0,0,.2)` (dropdown/hoja, spec) |
| `shadow-sticky` | `0 -8px 24px -12px rgba(31,28,25,.18)` (barra inferior móvil de reserva) |

En modo oscuro la elevación se expresa con superficie más clara (`surface` → `surface-muted`) y
borde `border`, no con sombras más fuertes.

Z-index: base 0 · sticky 10 · header 20 (spec) · dropdown 30 · drawer 40 · modal 50 · toast 60.

---

## 6. Movimiento

Lenguaje: **"llegar con calma"**. Todo se desacelera al final (ease-out expo de la spec); nada rebota
en UI informativa. Referencias de coreografía: motionsites.ai (reveals por capas), manus.im (transiciones
de contenido suaves con blur), animejs.com (stagger con timeline).

### 6.1 Curvas

| Token | Valor | GSAP | anime.js v4 | Uso |
|---|---|---|---|---|
| `ease-out` (firma) | `cubic-bezier(0.22, 1, 0.36, 1)` | `CustomEase.create('pwt', '0.22,1,0.36,1')` (≈ `power4.out`) | `cubicBezier(0.22,1,0.36,1)` | Entradas, morph, reveals |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | `power2.inOut` | `inOutQuad` | Cambios de lugar (acordeones, tabs) |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | `power2.in` | `inQuad` | Salidas (cierre de drawer, toasts) |
| `ease-standard` | `ease` | — | — | Fades de opacidad cortos (spec: nav `fadeIn .9s ease`) |

### 6.2 Duraciones

| Token | ms | Origen / uso |
|---|---|---|
| `duration-instant` | 100 | Feedback de press, check de checkbox |
| `duration-fast` | 160 | Hover de color/fondo de botones |
| `duration-base` | 250 | Color de triggers del nav (spec `.25s`), inputs, chips |
| `duration-moderate` | 360 | Panel activo (spec `.36s`), hoja móvil opacidad (`.3s`), chevron (`.35s`) |
| `duration-morph` | 500 | Morph del dropdown (spec `--morph .5s`), transiciones de paso del checkout |
| `duration-slow` | 900 | Entradas del header (spec `.9s`), zoom de imágenes del dropdown |
| `duration-hero` | 2400 | `heroIn` del fondo (spec `2.4s`) |
| `stagger` | 60 | Entre tarjetas en un reveal (máx. 6 elementos escalonados; el resto entra junto) |

Delays de coreografía del hero (spec): logo 350 · nav 450 · acciones 550 · indicador de scroll 900.
Debounce de cierre del dropdown: 140 ms (60 ms al ir a "Nosotros").

### 6.3 Coreografía tipo

1. **Hero (0–2.4 s):** fondo `scale(1.08) brightness(.6) → 1` · header entra en cascada (logo → nav solo
   opacidad → acciones) · indicador "( desliza )" sube 10 px · el buscador bajo el hero entra con
   `y: 24 → 0`, opacidad, 900 ms, delay 700 ms (mismo ease).
2. **Scroll (ScrollTrigger, `start: 'top 85%'`, una sola vez):** título de sección (opacidad + y 16 px,
   500 ms) → tarjetas con stagger 60 ms (y 20 px, 500 ms). Imágenes: `clip-path inset(8% 8% 8% 8% round 16px) → inset(0)`
   600 ms. Sin parallax en móvil.
3. **Lenis:** `lerp 0.1`, desactivado con movimiento reducido y en `pointer: coarse` si hay jank.
4. **Carrito:** al añadir, el ícono del carrito hace `scale 1 → 1.12 → 1` (250 ms) y el contador cambia
   con crossfade vertical; aparece un toast "Agregado a tu carrito" con acción "Ver carrito" (5 s, pausable).
5. **Checkout:** cambio de paso = crossfade + `x: ±24px` + blur 4 px → 0 (500 ms), dirección según
   avance/retroceso (mismo principio direccional que el dropdown). El total se anima con conteo de
   cifras solo si cambia (300 ms).
6. **Confirmación:** check que se dibuja (`stroke-dashoffset`, 600 ms) y luego el contenido (stagger 60 ms).
   Sin confeti.

Solo se animan `transform`, `opacity`, `filter` y `clip-path`. Nunca `transition: all`.

### 6.4 Versión reducida (`prefers-reduced-motion: reduce`)

- Todas las duraciones → `0.01ms`, delays → 0 (spec). `--pwt-morph` → `.01s`.
- Sin blur en paneles ni imágenes, sin zoom de `heroIn` (la foto aparece en su estado final), sin
  parallax, sin Lenis, sin conteos de cifras, sin scroll-scrub; los reveals muestran el estado final.
- Se conservan: cambios de color/opacidad instantáneos, foco visible, mensajes de estado.
- Implementación: `gsap.matchMedia()` con `(prefers-reduced-motion: no-preference)` para registrar
  animaciones; en anime.js comprobar `matchMedia` antes de crear timelines.

---

## 7. Componentes (resumen; detalle por pantalla en `pages/`)

### Botones
| Variante | Fondo / texto | Alto | Radio | Notas |
|---|---|---|---|---|
| `primary` (CTA) | `accent` / `on-accent` | 48 (44 mín. móvil) | `radius-md` | 1 por vista. Hover `accent-hover`, `translateY(-1px)` 160 ms. |
| `secondary` | `primary` / `on-primary` | 48 | `radius-md` | Acciones de navegación fuertes |
| `outline` | transparente, borde `border-strong`, texto `foreground` | 44 | `radius-md` | |
| `ghost` | transparente, texto `link` | 40 | `radius-sm` | Acciones terciarias |
| `hero-cta` | `#FFF` / `#0B0F12`, 32 px alto, pill | 32 (área 44) | pill | Exactamente spec §3 |

Estados: hover (color 160 ms) · focus-visible (`ring` 2 px offset 2 px; en hero blanco, spec) ·
active (`translateY(0)`, sin escala) · loading (spinner 16 px + texto "Procesando…", `aria-busy`,
mismo ancho) · disabled (`opacity .5`, `cursor: not-allowed`, atributo `disabled`).
`transition-property: background-color, color, border-color, transform, box-shadow`.

### Inputs
Alto 48 px, padding 12/16, `radius-md`, borde 1 px `border-strong`, fondo `surface`, texto 16 px.
Label siempre visible arriba (Geist 500 14 px), ayuda debajo (`sm`, muted). Focus: borde `primary` +
ring. Error: borde `danger`, ícono + mensaje con `aria-describedby`; validación en blur.

### Tarjetas de tour
Foto 4:3 (`radius-lg` arriba), badge opcional, título h3 (2 líneas máx.), meta (duración · ciudad ·
idioma), rating, precio "Desde S/ 189.00 por persona", cupos reales si ≤ 5. Hover: imagen `scale 1.04`
900 ms dentro de `overflow:hidden` (no desplaza layout), sombra `md → lg`.

### Íconos
**Lucide** (trazo 1.5 px, 20/24 px), nunca emojis. Tamaños: `icon-sm 16`, `icon-md 20`, `icon-lg 24`.
Los sellos oficiales (MINCETUR, Safe Travels, ESNNA, Marca Perú) se usan con sus archivos oficiales,
sin recolorear.

---

## 8. Patrón de página y flujo de compra

Patrón base: **Marketplace / Directory con hero de marca** — Hero (morph) → Buscador → Destinos →
Paquetes destacados → Por qué reservar con nosotros / confianza → Testimonios → CTA final → Footer
legal (Libro de Reclamaciones visible). El buscador es el CTA primario de la home.

Flujo (mínima fricción): búsqueda → resultados con filtros → ficha → fecha/pasajeros → carrito →
checkout en 3 pasos (Viajeros → Pago → Revisión implícita en el botón final) → confirmación.
Checkout de invitado por defecto; carrito persistente (Redis + cookie, 7 días); precio final con
impuestos y cargos desde el primer precio mostrado; urgencia solo con cupos reales del inventario.

---

## 9. Anti-patrones (no usar)

- Fotos genéricas de stock o de otras marcas (incluida la referencia Halden).
- Booking complejo: más de 3 pasos, registro obligatorio, campos que no se usan.
- Emojis como íconos; llamas/cóndores en caricatura; tipografías "incas" de fantasía.
- Gradientes aurora / neón, glassmorphism fuera del dropdown y la hoja móvil.
- Urgencia falsa (contadores que se reinician, "12 personas viendo esto" inventado).
- Precios que cambian en el checkout (cargos sorpresa).
- Hovers que desplazan layout; `transition: all`; foco invisible; texto < 4.5:1.
- Carruseles que rotan solos sin pausa.

---

## 10. Checklist previa a entrega (cada pantalla)

- [ ] Sin emojis como íconos; Lucide en todo el set.
- [ ] `cursor: pointer` en todo lo clicable; objetivos ≥ 44×44.
- [ ] Hover 150–300 ms solo en propiedades concretas.
- [ ] Contraste ≥ 4.5:1 texto y ≥ 3:1 bordes/íconos informativos, **claro y oscuro** por separado.
- [ ] Foco visible y orden de tabulación = orden visual; Escape cierra overlays y devuelve el foco.
- [ ] `prefers-reduced-motion` probado.
- [ ] 375 / 768 / 1024 / 1440 (+ 320 de control) sin scroll horizontal; nada oculto bajo barras fijas.
- [ ] Errores de formulario inline + resumen enfocable al enviar.
- [ ] Copy en español peruano, montos con `es-PE`, fechas en `America/Lima`.
- [ ] Revisión con `design:accessibility-review` (WCAG 2.2 AA).

---

## 11. Sugerencias de la skill descartadas (y por qué)

| Sugerencia de `ui-ux-pro-max` | Decisión | Motivo |
|---|---|---|
| Tipografía **Noto Sans Thai** | Descartada | Familia para escritura tailandesa; el match vino por la palabra "tourism". No aporta nada al español ni al Perú. Se usa Geist (spec) + Fraunces. |
| Paleta **sky blue `#0EA5E9` + naranja `#EA580C`** con texto negro en el CTA | Descartada | Paleta genérica de Tailwind sin identidad peruana; el texto negro sobre naranja se ve barato. Reemplazada por titicaca/terracota/selva/dorado/piedra con contrastes verificados. |
| Estilo **Aurora UI** (auroras boreales, mesh gradients) | Descartado | Las auroras boreales no existen en el Perú y competirían con la fotografía. Solo se conserva su idea de "smooth morph", ya cubierta por el dropdown de la spec. |
| Patrón **Scroll-Triggered Storytelling** (problema → viaje → solución) | Adaptado | En una OTA el CTA primario es la búsqueda (patrón Marketplace/Directory de la misma base). El storytelling se usa solo en el itinerario día a día de la ficha. |
| Transición de página con **GSAP Flip** como movimiento principal | Opcional | Costosa en Android de gama media (público peruano mayoritario). Solo como mejora progresiva tarjeta → ficha, una pareja de elementos, desactivada en movimiento reducido. |
| `--color-ring: #000000` | Reemplazado | Invisible en modo oscuro. Ring `#2A6593` / `#9CC3E0`; blanco en el hero (spec). |
| `.btn-primary { transition: all }`, `.card` con fondo celeste | Reemplazado | `transition: all` anima layout; tarjetas blancas sobre piedra-50 separan mejor. |
| Easing `back.out(1.4)` para grillas | Descartado | El rebote en tarjetas con precios se lee descuidado; se usa la curva firma de la spec. |
| Pares **Playfair + Inter**, **Cormorant + Libre Baskerville** | Descartados | Playfair es el cliché "lujo"; Cormorant tiene x-height baja e ilegible a tamaños medianos en móvil. |
| `pro-rules.md` (orientado a apps nativas) | Aplicado en su equivalente web | Se usó junto con `quick-reference.md` (web): objetivos 44 px, safe areas → barras sticky, tokens semánticos. |

---

## 12. Revisión de accesibilidad (design:accessibility-review, WCAG 2.1/2.2 AA) — 2026-10-07

Hallazgos sobre specs y tokens, ya corregidos en `pages/`:

| # | Hallazgo | Criterio | Corrección |
|---|---|---|---|
| 1 | Temporizador de 15 min de bloqueo de cupos sin extensión | 2.2.1 Tiempo ajustable | Botón "Necesito más tiempo" (+15 min, hasta 3 veces) en `checkout.md` |
| 2 | Toast "Deshacer" de 8 s | 2.2.1 | Pausa con hover/foco y foco gestionado en `carrito.md` |
| 3 | Días con últimos cupos marcados solo con punto de color | 1.4.1 Uso del color | Leyenda visible + `aria-label` + teclado del calendario en `tour-detalle.md` |
| 4 | CTA del hero de 32 px (spec) | 2.5.8 (AA 2.2) / 2.5.5 | Área táctil ampliada a 44 px sin cambiar lo visual |
| 5 | Dorado como texto sobre claro (2.10:1) | 1.4.3 | Prohibido; dorado solo decorativo o con texto `#1F1C19` encima (8.06:1) |
| 6 | Texto sobre fotos | 1.4.3 | Solo con scrim del hero/tarjeta; verificar con las fotos reales del cliente |

Pendiente de prueba real: NVDA + Firefox y VoiceOver iOS sobre el dropdown morph y el checkout, zoom 200 % y reflow a 320 px.
