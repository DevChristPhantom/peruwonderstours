# ADR-0031 — Eventos y promociones (Lo más relevante + anuncio emergente)

**Estado:** aceptado · 2026-10-26

## Contexto

El cliente quiere promocionar eventos como la Festividad de la Virgen de la Candelaria: una sección
de lo más relevante en la portada y un anuncio que aparezca a los 3 segundos de entrar, con acceso
al paquete. Debe poder repetirlo cada temporada sin programador.

## Decisión

- **Datos:** tablas `promotions` y `promotion_translations` (es/en/pt; español obligatorio). Ventana
  de difusión (`starts_at`/`ends_at`), fechas del evento (día de Lima), imagen, orden, anuncio
  emergente y botón de tres tipos: paquete del catálogo (`tour_id`), página del sitio (`cta_path`,
  solo ruta interna) o WhatsApp con mensaje precargado. La base lo garantiza con CHECK (tipos de
  botón, fechas coherentes y rutas internas: un anuncio nunca puede llevar a un sitio externo).
- **API:** `GET /promotions?locale=` (vigentes, con respaldo en español; un paquete despublicado
  cambia el botón a WhatsApp) y `/admin/promotions` con permisos `content:*`, auditoría y bloqueo
  optimista, igual que el blog.
- **Panel:** Contenido → Eventos y promociones (lista con estado real: programado, en el sitio,
  finalizado; alta, edición por pestañas de idioma, publicar/despublicar/eliminar). La ruta se pega
  tal como se ve en el sitio (con o sin dominio y /es) y se normaliza.
- **Sitio:** sección «Lo más relevante» tras el buscador (el primero destacado). Anuncio con
  `<dialog>` nativo: escritorio modal (foco atrapado, Escape, clic fuera); móvil tarjeta inferior no
  modal que no tapa la página ni roba el foco (guía de Google sobre intersticiales en móviles). Se
  muestra el primero vigente marcado, a los 3 s con la pestaña visible; cerrado, no vuelve en 24 h
  salvo que el equipo edite el evento. La ruta interna se traduce a cada idioma con el catálogo
  (`/es/destinos/tours-en-puno` → `/en/destinations/puno`).
- **Caché:** etiqueta `promotions` (5 min); el panel la invalida al guardar, como el resto.

## Consecuencias

- El cliente aporta textos, fechas oficiales y foto de cada evento; no se inventan datos.
- En el entorno aislado de pruebas, las imágenes de la API local no pasan por el optimizador de
  Next (bloqueo de IP local en producción); en la demo y en el hosting real sí se muestran.

## Validación

API: 5 pruebas de reglas (ventana, botón, rutas externas, fechas). Playwright
`admin-promotions.spec.ts`: alta y publicación desde el panel → sección → anuncio a los 3 s →
Escape → no reaparece. Verificación manual adicional: móvil sin salto de scroll ni robo de foco,
inglés con enlace traducido. Suite completa 30/30.
