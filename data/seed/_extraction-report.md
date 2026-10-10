# Reporte de extracción — www.andeanperutours.com

Fecha: 2026-10-07. Alcance: solo páginas públicas en español (`/es/...`). No se accedió a `/otm/`
ni a nada con login. Descarga con HTTP GET simple (sin formularios, sin envío de datos).

## Resultado

| Archivo | Registros | Notas |
|---|---|---|
| `tours.json` | 41 fichas | 41/41 descargadas (HTTP 200). 0 con precio. |
| `categories.json` | 5 | excursiones, full-days, paquetes-turisticos-en-peru, rutas-del-altiplano, tours-a-machu-picchu |
| `destinations.json` | 5 | cuzco, tours-en-arequipa, tours-en-ica-paracas, tours-en-lima, tours-en-puno |
| `blog-posts.json` | 6 | Con cuerpo completo en texto plano (`body`) e imágenes del cuerpo. |
| `redirects.json` | 73 reglas 301 | 41 tours + 5 categorías + 5 destinos + 6 posts + 16 páginas estáticas/legales. |

Fuentes recorridas: `/es/tours` (40 tarjetas), las 5 categorías, `/es/destinos` y los 5 destinos,
`/es/tipos-de-tours`, `/es/blog`, las 41 fichas, los 6 posts, `politicas-y-condiciones-de-pago` y
`quienes-somos`. Unión de enlaces a fichas: 41 slugs únicos (40 de `/es/tours` +
`cusco-machu-picchu-premium-4d-3n`, que solo aparece en la categoría Machu Picchu).

## Cómo se mapearon los campos

- `durationLabel`, `minPax`, `destinations` (región), `difficulty`, `featured` y `cardSummary`
  salen de la **tarjeta del listado**; la ficha no los muestra.
- `destinationSlugs` / `categorySlugs`: páginas de destino/categoría donde aparece la tarjeta.
- `description` (bloque "Descripción"), `summary` ("Resumen"), `itinerary`, `includes`,
  `notIncludes`, `recommendations`, `important`, `faqs`, `policies` (pestaña "Políticas",
  solo 4 paquetes) salen de la ficha.
- `durationHours` siempre `null`: el sitio no publica duración en horas (los medio día figuran como `1D`).
- `itinerary[].day`: en tours `1D` con varios bloques, todos se asignan a `day: 1`.
  En `peru-express-...-5-dias-4-noches` el título y la descripción del día vienen fusionados en un solo
  texto; se dejó `title: null` y el texto completo en `description`.
- `price`: `null` en las 41 fichas (el bloque de precio de la tarjeta está vacío y ninguna ficha
  tiene pestaña de precios).
- Imágenes: banner de la ficha + galería (`data-src` en tamaño original). Se omitió la variante
  `/sm/` cuando existía la original. Total: 340 URLs, todas en `www.andeanperutours.com`.

## Correcciones ortográficas aplicadas (solo evidentes)

- `Trasferencia` → `Transferencia` (11 ocurrencias, en FAQs).
- `opcionall` → `opcional` (1).
No se tocó estilo, mayúsculas ni el uso alterno "Cuzco"/"Cusco" (aparecen ambos en el original).

## Lo que faltó o es inconsistente (no se inventó nada)

1. **Precios**: ninguno publicado. Hay que pedirlos al cliente (export del OTM).
2. **Conteos declarados vs. publicados** ("N tours encontrados" vs tarjetas visibles):
   paquetes-turisticos-en-peru 16 vs 13; cuzco 18 vs 17; puno 15 vs 13; ica-paracas 5 vs 1.
   Probablemente hay ~9 tours **despublicados** en el OTM que no son accesibles públicamente.
   Ica-Paracas solo tiene 1 tour visible (el paquete de 14 días); no hay tours propios de Ica/Paracas.
3. **Tours sin categoría** (no aparecen en ninguna página de categoría): `cultura-titicaca-uros-llachon-taquile-3d-2n`,
   `puno-clasico-lago-titicaca-3d-2n`, `qeswachaka-experiencia-ultimo-puente-inca`,
   `ruta-del-sol-puno-desde-cusco-3d-2n`, `vivencia-titicaca-uros-amantani-taquile-3d-2n`,
   `waqrapukara-fortaleza-entre-nubes`.
4. **Paquetes sin región ni destino** (tarjeta sin "region-pill"): `lo-mejor-peru-en-5-dias-5d-4n`,
   `peru-de-ensueno-andes-incas-8d-7n`, `peru-magico-cusco-lima-6d-5n` → `destinations: null`.
5. **Duración contradictoria**: `arequipa-ruta-rapida-ciudad-blanca-3d-2n` tiene tarjeta `1D` pero el
   título dice "03 días / 02 noches". Se conservó el dato tal cual; corregir en backoffice.
6. **Mínimo de pasajeros = 2 en las 41 fichas**, incluidos los tours "privados" (Aramu Muru, Inka Uyo).
   Parece un valor por defecto del CMS; validar con el cliente.
7. **Categorías mal descritas**: la descripción del megamenú de "Paquetes turísticos" habla de prácticas
   místicas y observación de aves (no corresponde) y el megamenú lista tours de Arequipa bajo esa categoría.
   "Excursiones" y "Full Days" no tienen descripción (`null`).
8. **Blog**: las fechas del listado no coinciden con el orden (posts de 2025 aparecen antes que los de 2026).
   7 imágenes del cuerpo de los posts están alojadas en un dominio de terceros (`turinet.turismoads.com`):
   hay que descargarlas y re-alojarlas antes de apagar el sitio viejo.
9. **Sitemap ajeno**: `https://www.andeanperutours.com/sitemap.xml` lista URLs de otro dominio
   (`www.perupaths.com`, 113 URLs). No se usó como fuente. El sitio nuevo debe generar su propio sitemap.
10. **robots.txt** del sitio viejo tiene `Disallow: /` para todos los agentes: el sitio está bloqueado
    para buscadores (impacto SEO grave). Se extrajo igual por ser contenido propio del cliente y con
    su autorización, a ritmo bajo (≈1 petición/s).
11. **Identidad legal inconsistente**: el pie muestra RUC `20000000000` (placeholder), mientras
    `quienes-somos` declara razón social "TURINET CUZCO EIRL" y otro RUC, y el texto usa la marca
    "TURINETCUZCO". Pendiente que el cliente confirme la razón social/RUC de Peru Wonders Tours.
12. **Páginas no extraídas** (fuera del alcance pedido o sin contenido de catálogo): `/es/testimonios`,
    `/es/contactenos`, `/es/dejar-testimonio`, `/es/libro-de-reclamaciones` (formulario),
    `/es/andean-peru-tours/proteccion-de-datos-personales`, versión en inglés (no existe).
    `/es/tipos-de-tours` se descargó pero no lista tarjetas (página vacía).
13. Interrupción: la primera descarga en segundo plano se cortó con la sesión anterior (23/41 fichas);
    se reanudó solo con las faltantes y se guardó `tours.json` de forma incremental cada 10 fichas.

## Redirects

`redirects.json` mantiene las mismas rutas `/es/...` para tours, categorías, destinos y blog.
Se proponen rutas nuevas solo donde la ruta vieja lleva la marca anterior
(`/es/andean-peru-tours/quienes-somos` → `/es/nosotros`, políticas → `/es/politicas/...`) y para los
endpoints de formulario (`/es/reservar-tour`, `/es/resultados-busqueda`). Si se renombra
"cuzco" a "cusco", agregar la regla correspondiente.

## Extracción 2 (2026-10-09)

Alcance: solo páginas públicas `/es` (home, quienes-somos, políticas de pago, protección de datos,
testimonios, contáctenos, libro-de-reclamaciones vista sin enviar, blog, tours, destinos). Unas 15 peticiones
al sitio viejo, a ≤1 petición/s. No se entró a `/otm/` ni se envió ningún formulario. No se descargaron imágenes
(los SVG de sellos se leyeron una sola vez para identificarlos). No se tocó `data/seed/en/` (solo se leyeron
los títulos en inglés para los alt).

| Archivo | Contenido |
|---|---|
| `site-content.json` | Quiénes somos (historia, equipo con 6 personas, datos de empresa, oficina Lima), política de pago y política de datos **al pie de la letra** (secciones + `fullText`), ESNNA, FAQ, textos de la home, contacto, horario, redes, medios de pago, pie, tours despublicados y estado del blog. |
| `testimonials.json` | 4 testimonios (los únicos visibles), todos de TripAdvisor con 5/5 burbujas. |
| `media-manifest.json` | 404 imágenes únicas (340 de tour, 14 de blog, 14 de páginas, 7 de sellos, 5 de destinos, 5 de categorías, 9 de marca, 4 ilustraciones/banderas, 3 de pago, 2 de confianza, 1 de TripAdvisor) + `officialAssets` (kits oficiales). 16 alojadas en terceros: 15 en `turinet.turismoads.com` (8 del blog y 7 de quiénes somos) y 1 en `perusacredexperiences.com` (afiche ESNNA). |
| `trust-badges.json` | 8 sellos (6 del sitio viejo + distintivo MINCETUR + Libro de Reclamaciones), 7 enlaces oficiales para el turista y preguntas abiertas. |

Hallazgos:
1. **Redes**: solo Facebook (`https://www.facebook.com/andeanperutours`) y TripAdvisor (URL con espacios sin codificar).
   No hay Instagram, TikTok ni YouTube en el HTML.
2. **Sin misión, visión ni valores** publicados. No se redactaron.
3. **Protección de datos copiada de una plantilla colombiana** (Ley 1581 de 2012, Superintendencia de Industria y Comercio, "cédula de ciudadanía").
   No sirve como base legal en el Perú (Ley 29733); usarla solo como insumo.
4. **Política de pago**: 50% al reservar y 50% 7 días antes, 3,5% de recargo con tarjeta y cancelación con ≥20 días hábiles; además dice que la reserva solo es válida con el pago completo
   (contradicción). Se copió con sus erratas.
5. **ESNNA**: no hay texto propio. El sello abre un afiche alojado en el dominio de otra agencia.
6. **FAQ generales**: no existe la página (404). Se tomaron las 3 preguntas repetidas en 17 fichas. La FAQ archivada de 2016 es lorem ipsum.
7. **Testimonios**: `/es/testimonios` está vacía; los 4 de la home no tienen enlace individual (`sourceUrl: null`).
8. **Medios de pago incoherentes**: el pie muestra PayPal (`paypal.me/andeanperutours`) y Western Union; las políticas y FAQs hablan de transferencia y Niubiz.
9. **Tours despublicados**: 0 URLs accesibles (ni en el HTML ni en Wayback). Se listan 24 slugs del WordPress antiguo `/pe/portfolio-view/` (2016-2017) como referencia.
10. **Blog**: los 6 cuerpos ya estaban completos.
11. Meta description de la home menciona "Qori Alva" (otra marca). Horario: Lun-Sáb 09:00-19:00. Segundo WhatsApp en quiénes somos: +51 985619968.
12. **Sellos**: Safe Travels es un programa histórico (WTTC lo declara inactivo). PromPerú, SERNANP y Gercetur son logos institucionales sin licencia pública.
    Marca Perú exige licencia de PromPerú. El distintivo MINCETUR es obligatorio en la web si la agencia está inscrita en el Directorio.
    El Libro de Reclamaciones es obligatorio, debe ir en la home y hoy está en inglés. En Puno el órgano es DIRCETUR, no GERCETUR.
