# Logo — propuesta de nuevos colores (Peru Wonders Tours)

> Estado: **propuesta para aprobación del cliente**. No se rediseña la forma: aún no tenemos el archivo
> fuente del logo de Peru Wonders Tours. La forma de referencia es la del logo público actual de
> www.andeanperutours.com (revisado el 2026-10-07, solo páginas públicas).

## 1. Logo actual (referencia)

Archivos públicos: `/images/logo.svg` (vertical, 300×253) y `/images/logo-large.svg` (horizontal, 300×74),
exportados desde CorelDRAW 2021, codificados en UTF-16. Cuatro piezas de color:

| Pieza | Descripción | Color actual |
|---|---|---|
| A. Montaña | Trazo lineal de cumbres (silueta tipo Huayna Picchu), detrás del ave | `#F7A924` amarillo-ámbar |
| B. Cóndor | Silueta de cóndor en vuelo, sólida | `#163A70` azul marino |
| C. Wordmark principal | "Andean" en serif | `#163A70` azul marino |
| D. Wordmark secundario | "Peru Tours" en serif, más pequeño | `#046E3A` verde |

Problemas cromáticos detectados:
- El ámbar `#F7A924` sobre blanco tiene 1.97:1: la montaña "desaparece" en fondos claros y en impresión
  en papel blanco.
- Tres colores saturados sin jerarquía (marino + verde + ámbar) leen como bandera/institucional, no como
  marca de viajes premium.
- No existe versión para fondo oscuro ni para foto (el nuevo hero es oscuro a pantalla completa).

Las propuestas mapean A–D a la paleta del sistema (`MASTER.md` §2). El nuevo logo de Peru Wonders
debería conservar esta lógica de 4 piezas si su forma es equivalente; si no, se reasigna por rol
(isotipo-trazo, isotipo-sólido, nombre, descriptor).

## 2. Propuestas

### Opción 1 — "Titicaca y telar" (recomendada)

| Pieza | Fondo claro (`#FFFFFF` / `#F7F5F2`) | Fondo oscuro / hero (`#0B1013`) |
|---|---|---|
| A. Montaña | terracota-600 `#A34224` | dorado-400 `#E3A92B` |
| B. Cóndor | titicaca-800 `#10304D` | piedra-50 `#F7F5F2` |
| C. Wordmark principal | titicaca-800 `#10304D` | piedra-50 `#F7F5F2` |
| D. Descriptor | terracota-600 `#A34224` | dorado-400 `#E3A92B` |

Contrastes: `#10304D`/blanco 13.53:1 · `#A34224`/blanco 6.25:1 · `#F7F5F2`/`#0B1013` 17.58:1 ·
`#E3A92B`/`#0B1013` 9.09:1.
Por qué: dos colores con jerarquía clara (azul del lago = nombre y ave; terracota textil = montaña y
descriptor) y coincide con los colores de acción del sitio (primario y CTA), así el logo y el botón
"Reservar" se refuerzan. En oscuro el dorado aparece como "luz de atardecer" sobre el hero.

### Opción 2 — "Selva y oro"

| Pieza | Fondo claro | Fondo oscuro / hero |
|---|---|---|
| A. Montaña | dorado-600 `#A06C12` | dorado-300 `#EDC152` |
| B. Cóndor | selva-700 `#144D33` | piedra-50 `#F7F5F2` |
| C. Wordmark principal | selva-700 `#144D33` | piedra-50 `#F7F5F2` |
| D. Descriptor | dorado-600 `#A06C12` | dorado-300 `#EDC152` |

Contrastes: `#144D33`/blanco 9.82:1 · `#A06C12`/blanco 4.52:1 y /`#F7F5F2` 4.15:1 (≥ 3:1, válido para gráfico; el descriptor en dorado-600 no debe bajar de 18 px) · `#EDC152`/`#0B1013` 11.25:1.
Por qué: conserva el verde que el cliente ya tiene (continuidad con su clientela) pero más profundo y
con dorado inca. Riesgo: el verde se acerca al color de "éxito" de la UI; en el sitio el logo convive
bien, pero el CTA terracota quedaría sin relación con la marca.

### Opción 3 — "Piedra monocroma + acento"

| Pieza | Fondo claro | Fondo oscuro / hero |
|---|---|---|
| A. Montaña | dorado-600 `#A06C12` | dorado-400 `#E3A92B` |
| B. Cóndor | piedra-900 `#1F1C19` | `#FFFFFF` |
| C. Wordmark principal | piedra-900 `#1F1C19` | `#FFFFFF` |
| D. Descriptor | piedra-600 `#5F574C` | piedra-300 `#C9C0B5` |

Contrastes: `#1F1C19`/blanco 16.96:1 · `#5F574C`/blanco 7.11:1 · `#A06C12`/blanco 4.52:1 · `#C9C0B5`/`#0B1013` 10.65:1.
Por qué: la opción más "editorial premium"; deja todo el color a las fotos y al CTA. Riesgo: menos
reconocible en miniatura (favicon, redes) y menos "Perú" a primera vista.

## 3. Versiones obligatorias para cualquier opción

1. **Positivo** (fondos claros) y **negativo** (hero, footer oscuro, modo oscuro).
2. **Monocromo** 1 tinta: titicaca-800 `#10304D` y blanco; para sellos, facturas SUNAT, bordado.
3. **Isotipo solo** (montaña + cóndor) para favicon 32/48 px y avatar de redes: en tamaños < 48 px
   unir el trazo de la montaña (grosor mínimo 2 px a 32 px) o usar solo el cóndor.
4. Zona de protección: altura de la "P" de "Peru" alrededor; tamaño mínimo horizontal 120 px de ancho
   en pantalla.
5. Sobre fotos: solo versión negativa y únicamente sobre el scrim del hero (spec §2), nunca sobre zonas
   claras de cielo o nieve.

## 4. Pendientes para el cliente

- Enviar el **archivo fuente** del logo de Peru Wonders Tours (AI, SVG, CDR o PDF vectorial). Con el
  SVG basta con cambiar las clases `fil0..fil3` del bloque `<style>`; no hace falta redibujar.
- Elegir opción (recomendamos la 1) y confirmar si se mantiene el cóndor y la montaña en la nueva marca.
- Aprobar el pase a UTF-8 y la optimización con SVGO (el SVG actual pesa ~26 KB por estar en UTF-16).
