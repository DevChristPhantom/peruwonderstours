# Especificación de referencia: hero con dropdown "morph"

Fuente: especificación entregada por el usuario (marca de ejemplo "Halden"). Se usa como
**referencia exacta de movimiento, tiempos y estructura**; el contenido se adapta a
Peru Wonders Tours:

| Halden | Peru Wonders Tours |
|---|---|
| Discover: Glaciers / Volcanoes / Dunes / Islands | Descubre: Lago Titicaca / Machu Picchu / Cañón del Colca / Huacachina y Paracas |
| Journeys: Small Group Treks / Solo Expeditions | Viajes: Tours en grupo / Viajes privados |
| Regions: Nordics / Patagonia / Himalaya / Oceania | Destinos: Cusco / Puno / Arequipa / Ica-Paracas / Lima |
| Our story | Nosotros |
| Enquire | Reservar (+ ícono de carrito con contador) |
| Imágenes CloudFront de Halden | Fotos propias del cliente (no reutilizar las de Halden) |
| Fuente Geist | Se mantiene Geist salvo que el sistema de diseño indique otra |

Diferencias funcionales para la OTA: el header agrega carrito y selector de idioma;
debajo del hero va el buscador de tours (destino, fecha, pasajeros).

---

## 1. Fuentes y global
- Google Fonts Geist 400 y 500. `font-family: "Geist", "Inter", system-ui, sans-serif`, antialiased.
- Reset: `box-sizing: border-box`; márgenes 0; links heredan color sin subrayado; botones sin fondo/borde/padding; img block.
- `:focus-visible { outline: 2px solid #fff; outline-offset: 3px; border-radius: 6px }`
- Tokens: `--ink #0b1013`, `--panel rgba(14,19,23,.84)`, `--line rgba(255,255,255,.08)`,
  `--hover rgba(255,255,255,.065)`, `--text #fff`, `--soft rgba(255,255,255,.74)`,
  `--muted rgba(255,255,255,.60)`, `--ease cubic-bezier(0.22,1,0.36,1)`, `--morph .5s`.

## 2. Fondo del hero (imagen fija)
- `.hero`: relative; `height: 100vh` y luego `100svh`; min-height 560px; overflow hidden; isolation isolate.
- `.hero-bg` (role img + aria-label descriptivo): absolute inset 0; z -2; background cover `center 45%`;
  `animation: heroIn 2.4s var(--ease) both` (de `scale(1.08) brightness(.6)` a `scale(1) brightness(1)`).
- `.hero::after`: z -1; dos gradientes: `linear-gradient(to bottom, rgba(6,10,12,.35) 0%, rgba(6,10,12,0) 22%)`,
  `linear-gradient(to top, rgba(6,9,11,.8) 0%, rgba(6,9,11,.25) 30%, rgba(6,9,11,0) 55%)`.
- Indicador de scroll centrado `( desliza )`: left 50%, top 44%, flex gap 16px, 13.5px, letter-spacing .01em,
  color rgba(255,255,255,.92), text-shadow `0 1px 12px rgba(0,0,0,.35)`, paréntesis opacidad .8,
  `fadeUp 1s var(--ease) .9s both` (desde translate(-50%,10px) opacidad 0).
- Sin titular en la referencia (en nuestro caso el buscador va debajo del hero).

## 3. Header
- `header` absolute top/left/right 0, z 20; es el contenedor del dropdown.
- `.bar`: alto 76px; padding `0 clamp(20px,3.4vw,52px)`; grid `1fr auto 1fr`.
- Entradas con fill-mode **backwards**: logo `fadeDown .9s var(--ease) .35s`; nav `fadeIn .9s ease .45s`
  (**solo opacidad, nunca transform en el nav**); acciones `fadeDown .9s var(--ease) .55s`.
- Nav centrado: `ul` flex gap 26px; triggers con `aria-expanded`, inline-flex gap 6px, padding 8px 0,
  14.5px, color `--soft` → #fff en hover/expandido, transición .25s. Chevron SVG 8x5 `M1 1l3 3 3-3`,
  stroke 1.3, rota 180° expandido (.35s var(--ease)). El dropdown va **dentro del nav** tras el `ul`.
- CTA: alto 32px, padding 0 15px, pill, fondo #fff, color #0b0f12, 14px/500; hover fondo #e9eef0 y translateY(-1px).

## 4. Dropdown morph (elemento firma)
- Un solo contenedor `.dd` con tres paneles; al pasar entre triggers **no se cierra**: anima x, ancho y alto,
  y el contenido entra en la dirección del movimiento con crossfade + blur.
- `.dd`: props `--x 0px; --w 400px; --h 300px; --s .97`; absolute top 64px left 0; width/height de las props;
  `transform: translateX(var(--x)) scale(var(--s))`, origin `50% 0`; opacidad 0; radius 16px; fondo `--panel`;
  borde `--line`; sombra `0 30px 70px -25px rgba(0,0,0,.65), 0 2px 10px rgba(0,0,0,.2)`;
  `backdrop-filter: blur(22px) saturate(140%)`; overflow hidden;
  transición transform/width/height `var(--morph) var(--ease)`, opacity .3s.
  `.open { --s:1; opacity:1; pointer-events:auto }`; `.instant` sin animar tamaño/posición; `.instant.snap` sin transición.
- `.panel`: absolute; opacidad 0; hidden; blur(8px); transiciones opacity .26s, transform morph, filter .4s,
  visibility diferida; `exit-left` translateX(-56px), `exit-right` 56px; `active` visible, sin blur
  (opacity .36s delay .06s, filter .45s delay .04s). `.snap` sin transición.
- Panel A "Descubre": 664x358, grid `236px 1fr`; lista de 4 filas (título 15px/500, descripción 13px/1.42 muted,
  fila activa con fondo `--hover`); columna de imagen con fade izquierdo de 70px; 4 imágenes apiladas que pasan de
  opacidad 0 / scale(1.06) / blur(10px) a activas (opacity .6s, transform .9s, filter .6s).
- Panel B "Viajes": 446x308, padding 7px, 2 columnas gap 7px; tarjetas foto radius 10px, padding 14px,
  zoom 1.05 + brightness 1.08 al hover; gradiente inferior; título 15.5px/500.
- Panel C "Destinos": 232x218, padding 8px, filas flex 1, radius 9px, 15px, hover `--hover`.

## 5. Comportamiento JS
- Orden: descubre, viajes, destinos. `PAD = 20`.
- `place(id)`: x = left del trigger − PAD, acotado entre header.left+12 y header.right−ancho−12, menos el left del offsetParent; fija `--x --w --h`.
- `open(id)`: primera apertura con `.instant .snap`, reflow, quitar snap, `.open`, quitar `.instant` en el siguiente rAF.
  Cambio: dirección según índice; panel viejo `exit-left/right`; panel nuevo entra desde el lado opuesto con snap + reflow; luego `place`.
  Activo: `data-state=active`, `aria-expanded=true` solo en su trigger.
- `close()`, `scheduleClose(ms=140)` con debounce.
- Eventos: pointerenter (solo mouse) abre; click alterna (touch/teclado); link "Nosotros" cierra a 60ms;
  pointerleave del nav cierra a 140ms; focusout fuera del nav cierra; Escape cierra y devuelve el foco;
  pointerdown fuera cierra; resize recalcula; filas de "Descubre" activan su imagen al hover/focus.

## 6. Móvil (≤ 860px)
- Grid `1fr auto`; nav oculto; botón menú 36x32 pill, fondo rgba(255,255,255,.12) con blur(10px), ícono de 2 líneas.
- Hoja `.sheet`: absolute top 68px, left/right 12px, padding 10px, radius 16px, fondo panel con blur; cerrada con
  opacidad 0, translateY(-6px) scale(.98); abierta normal (opacity .3s, transform .45s). Encabezados h3 12px
  mayúsculas muted; links 15px padding 10px 12px. Clic en un link la cierra. Oculta ≥ 861px.

## 7. Accesibilidad y movimiento reducido
- Hero con aria-label; indicador de scroll aria-hidden; imágenes de vista previa `alt=""`.
- `prefers-reduced-motion: reduce`: `--morph .01s`, animaciones de .01s sin retraso, sin blur en paneles ni imágenes.
