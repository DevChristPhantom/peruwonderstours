---
type: concept
title: Auditoría funcional Sprint 3 (web, panel, API, i18n, rutas del sitio viejo)
status: active
created: 2026-10-09
updated: 2026-10-09
tags:
  - qa
  - auditoria
  - sprint-3
  - i18n
  - seo
---

# Auditoría funcional Sprint 3

Auditoría **de solo lectura** sobre la rama `feature/sprint-3-funcional` (2026-10-09), con los
servidores en marcha: web `:3000` (Next dev), API `:3001/api/v1` (modo prisma, `pwt_dev`, 41 tours
publicados y precios DEMO) y panel `:3002`. Objetivo: lista de trabajo para que **todo funcione antes
del rediseño**. No se tocó código ni datos. En el panel no se inició sesión (solo HTTP sin sesión y
lectura de código). Las consultas SQL fueron de solo lectura (`default_transaction_read_only=on`).

## Método y evidencia

- **Crawler** (script Node temporal, ya borrado): parte de `/es`, sigue todos los `href` internos con
  `redirect: manual`, añade las 60 URLs de `sitemap.xml` y 17 rutas de prueba (sitio viejo, `/en`,
  cuenta, contacto). Resultado: **91 URLs**: 71 → 200, 4 → 301, 12 → 404, **4 → 500**.
- **Reglas de `data/seed/redirects.json`** (73) siguiendo redirecciones hasta el final: 59 → 200,
  **12 → 404**, **2 → 500**.
- Enlaces `#`: solo anclas internas válidas (`#contenido`, que es el salto al contenido, en 82 páginas, y
  las pestañas de la ficha `#resumen`, `#itinerario`, `#incluye`, `#antes-de-viajar`, `#politicas`,
  `#preguntas` y `#reservar`). **No hay `href="#"` vacíos ni `javascript:`.**
- Enlaces externos: **solo `wa.me/51989028802`** (82 páginas, más 41 mensajes por tour). No hay
  `mailto:`, `tel:` ni redes sociales.
- Marcas en el código (`grep -rniE "próximamente|TODO|FIXME|por confirmar"` en `apps/web/src` y
  `apps/admin/src`): **85 coincidencias**, de las cuales **46 son reales** (29 `TODO`, 2
  "Próximamente" y 15 "por confirmar"). El resto son falsos positivos ("todos", "todo el año"). En
  `apps/admin/src` no hay ninguna marca real. En `docs/legal/` hay **66 marcas** `[POR CONFIRMAR]` o
  `[A VALIDAR]`.
- Base de datos `pwt_dev`: `tour_translations` tiene 42 filas `es` y **0 `en`**; `destination_translations`
  tiene 5 `es` y 0 `en`; `category_translations`, 5 `es` y 0 `en`; `blog_post_translations`, 6 `es` y 0
  `en` (6 posts publicados). `testimonials` tiene **0** filas, `customers` 2 y `bookings` 2. El enum
  `locale` es `{es, en}`.

Leyenda. **Estado**: roto, placeholder, falta u OK. **Severidad** para tener un "sitio funcional":
bloqueante, importante o menor. **Cliente**: indica si depende de datos del cliente.

## 1. Enlaces, rutas y sitemap (web)

| # | Ítem | Ubicación | Estado | Severidad | Cliente |
|---|---|---|---|---|---|
| L1 | Las 4 páginas legales devuelven **500** con el error "No se encontró docs/legal". `legalDir()` resuelve la carpeta con `process.cwd()`, y el servidor de desarrollo se lanzó con `next dev <ruta>` desde otro directorio. Se enlazan desde el footer de las 71 páginas, el sitemap, el checkout y 2 redirecciones. | `/es/politicas/{terminos-y-condiciones,condiciones-de-pago,proteccion-de-datos-personales,cookies}`; `apps/web/src/lib/legal/documents.ts:31-37` | roto | bloqueante | no |
| L2 | El sitemap incluye 60 URLs: 56 dan 200 y **4 dan 500** (las de L1). Solo hay `es-PE` y no aparece `en`. | `/sitemap.xml`; `apps/web/src/app/sitemap.ts:8-30` | roto | bloqueante (por L1) | no |
| L3 | Redirecciones del sitio viejo que llevan a páginas en 500: `/es/andean-peru-tours/politicas-y-condiciones-de-pago` y `/es/andean-peru-tours/proteccion-de-datos-personales` (el 301 está bien, el destino falla). | `next.config.ts` (`buildLegacyRedirects`) | roto | importante | no |
| L4 | 12 reglas de `redirects.json` con origen igual al destino terminan en **404**, porque `buildLegacyRedirects` omite las reglas en las que coinciden y la página no existe: `/es/blog`, sus 6 posts, `/es/blog/categorias/informacion-turistica-del-peru`, `/es/contactenos`, `/es/testimonios`, `/es/dejar-testimonio` y `/es/tipos-de-tours`. | `data/seed/redirects.json`; `apps/web/next.config.ts:13-21` | roto | importante (SEO de la migración) | no |
| L5 | `/` redirige a `/es` (301); `quienes-somos` a `/es/nosotros`; `reservar-tour` a `/es/carrito`; `resultados-busqueda` a `/es/tours`. Los 5 destinos, 5 categorías y 41 tours conservan su slug y dan 200. | `next.config.ts` | OK | — | — |
| L6 | No hay enlaces vacíos `#` ni `javascript:`. Las anclas de la ficha y el enlace de salto funcionan. | todas | OK | — | — |
| L7 | El único canal de contacto enlazado es WhatsApp `+51 989 028 802`, un dato del sitio viejo que falta validar. No hay correo, teléfono `tel:` ni redes. | `apps/web/src/lib/site.ts:31-34`; footer | placeholder | importante | sí |
| L8 | `robots.txt` bloquea checkout, carrito y reserva, y apunta al sitemap del dominio nuevo. | `/robots.txt` | OK | — | — |
| L9 | `/es/tours?q=...` repite el título y el canonical del listado (13 variantes rastreadas). Es aceptable si el canonical apunta a `/es/tours`; conviene confirmarlo. | `/es/tours` | OK con observación | menor | no |
| L10 | La página 404 es genérica pero el texto habla siempre de "tour" ("Puede que el tour haya cambiado de nombre"), también para `/en`, `/es/blog`, etc. | `apps/web/src/app/not-found.tsx:23` | placeholder | menor | no |
| L11 | Las fotos se sirven desde `www.andeanperutours.com` (dominio viejo). Si ese sitio se apaga o cambia, el catálogo se queda sin imágenes. | `apps/web/next.config.ts:39-47`; `apps/web/src/proxy.ts:22` | placeholder (temporal HU-0.3) | importante | sí (archivos fuente) |

## 2. Rutas del sitio viejo frente a lo que existe hoy

| Ruta vieja | Hoy | ¿Útil? | Acción propuesta |
|---|---|---|---|
| `/` | 301 → `/es` | sí | — |
| `/es/contactenos` | **404** | no | Crear `/es/contacto` con formulario y añadir el 301 (ver F3) |
| `/es/testimonios` | **404** | no | Crear la página con testimonios moderados (F2) o, de forma temporal, 301 a `/es/nosotros` |
| `/es/dejar-testimonio` | **404** | no | Crear el formulario (F2) o un 301 temporal |
| `/es/blog` y 6 posts | **404** | no | Los posts existen en la BD (6 publicados) y en `data/seed/blog-posts.json`. Falta la API y las páginas (F1) |
| `/es/blog/categorias/informacion-turistica-del-peru` | **404** | no | 301 a `/es/blog` cuando exista |
| `/es/andean-peru-tours/quienes-somos` | 301 → `/es/nosotros` (200) | parcial | La página es un placeholder "en preparación" (W8) |
| `/es/tipos-de-tours` | **404** | no | 301 a `/es/tours` (o a un índice de categorías) |
| `/es/andean-peru-tours/politicas-y-condiciones-de-pago` | 301 → **500** | no | Corregir L1 |
| `/es/andean-peru-tours/proteccion-de-datos-personales` | 301 → **500** | no | Corregir L1 |
| `/es/libro-de-reclamaciones` | 200 | sí | — |
| `/es/reservar-tour`, `/es/resultados-busqueda` | 301 → carrito y tours | sí | — |
| `/es/destinos/*` (5), `/es/categorias/*` (5), tours (41) | 200, mismo slug | sí | — |

## 3. Botones y controles de la web

| # | Ítem | Ubicación | Estado | Severidad | Cliente |
|---|---|---|---|---|---|
| W1 | Selector de idioma: "English · Próximamente" con `aria-disabled`. En el menú móvil aparece "English (próximamente)". | `apps/web/src/components/layout/SiteHeader.tsx:512-514, 593` | placeholder | importante | no (traducciones: sí) |
| W2 | En el checkout aparece "¿Ya tienes cuenta? Podrás iniciar sesión pronto." No hay login de cliente en ninguna parte. | `apps/web/src/components/checkout/ContactStep.tsx:66-67` | placeholder | importante | no |
| W3 | No hay newsletter en la web ni en la API. El opt-in de marketing solo existe dentro del checkout. | — | falta | menor | no |
| W4 | El buscador y los filtros funcionan (frase, destino, categoría, duración, en el cliente). En cambio, **la fecha y el número de viajeros no filtran**: solo se muestra "Buscaste para el…". | `apps/web/src/components/tours/TourExplorer.tsx:318-323` | placeholder parcial | importante | no |
| W5 | El listado no tiene orden (precio, duración, popularidad) ni filtros de precio o dificultad, aunque la API ya los admite (`sort`, `minPrice`, `maxPrice`, `difficulty`). | `TourExplorer.tsx:45-140` | falta | menor | no |
| W6 | El panel de reserva de la ficha usa un selector de fecha nativo **sin cupos ni salidas reales**, aunque existe `GET /tours/:slug/departures`. | `apps/web/src/components/tours/BookingPanel.tsx:40` | placeholder | importante | no |
| W7 | El bloque de testimonios de la home muestra "Contenido de ejemplo" y 3 tarjetas falsas. | `apps/web/src/components/home/HomeSections.tsx:54-80` | placeholder | importante (visible) | sí |
| W8 | La página Nosotros es un `PendingContentPage` con el aviso "Contenido en preparación". | `apps/web/src/app/es/(site)/nosotros/page.tsx:14-25` | placeholder | importante | sí |
| W9 | En el footer, la razón social, el RUC, el registro MINCETUR y el correo aparecen como "por confirmar". Es la identificación obligatoria del proveedor. | `apps/web/src/components/layout/SiteFooter.tsx:45-46, 86-91`; `apps/web/src/lib/site.ts:14-22` | placeholder | bloqueante (producción) | sí |
| W10 | Los sellos (MINCETUR, Safe Travels, ESNNA, Marca Perú) y los logos de medios de pago figuran como "por confirmar". | `HomeSections.tsx:90-115` | placeholder | importante | sí |
| W11 | Falta el ícono oficial del Libro de Reclamaciones y validar el texto según la Ley 30802. | `SiteFooter.tsx:137, 142`; `apps/web/src/components/complaints/ComplaintsBookNotice.tsx:17` | placeholder | importante | sí (cumplimiento) |
| W12 | Hay 66 marcas `[POR CONFIRMAR]`/`[A VALIDAR]` en los textos legales: 22 en cancelación, 23 en privacidad, 14 en T&C y 7 en cookies. Se publican con el aviso de BORRADOR. | `docs/legal/*.md`; `apps/web/src/components/layout/LegalDocumentPage.tsx:29` | placeholder | bloqueante (producción) | sí |
| W13 | Falta la política de cancelación completa y la tabla de penalidades en la ficha y en el paso de pago. | `apps/web/src/app/es/(site)/tours/[slug]/page.tsx:288`; `apps/web/src/components/checkout/PaymentStep.tsx:476` | placeholder | importante | sí |
| W14 | El pago solo funciona con `SandboxPaymentWidget`; no hay pasarela real. | `PaymentStep.tsx:448`; `PayBookingForm.tsx:101` | placeholder | bloqueante (producción) | sí (contrato con la pasarela) |
| W15 | En el comparador, dificultad, incluye y no incluye muestran "Por confirmar" cuando falta el dato, y no hay filas de altitud, esfuerzo ni salidas. | `apps/web/src/app/es/(site)/comparar/page.tsx:50-67` | placeholder | menor | sí |
| W16 | En la página de la reserva falta la hora y el punto de recojo por ítem. | `apps/web/src/app/es/(site)/reserva/[codigo]/page.tsx:137` | falta | importante | no (backend y operaciones) |
| W17 | El `alt` de las fotos repite el título del tour. | `apps/web/src/lib/catalog/api-repository.ts:206`; `apps/web/src/lib/catalog/seed-repository.ts:108` | placeholder | menor | sí |
| W18 | Hay categorías sin descripción o con una descripción errónea, y FAQ incompletas que se omiten. | `apps/web/src/app/es/(site)/categorias/[slug]/page.tsx:23`; `seed-repository.ts:72, 131` | placeholder | menor | sí |
| W19 | El carrito y los favoritos viven solo en localStorage, sin sincronizar con el servidor ni con una cuenta. | `apps/web/src/stores/cart-store.ts:12`; `apps/web/src/stores/wishlist-store.ts:14` | falta | menor | no |
| W20 | Las regiones de "Mi viaje" (altitud y esfuerzo) salen de heurísticas. | `apps/web/src/lib/trip/regions.ts:5` | placeholder | menor | sí |
| W21 | Falta el "año de apertura" y la certificación de guías en "Por qué viajar con nosotros". | `HomeSections.tsx:12` | placeholder | menor | sí |
| W22 | Favoritos, Mi viaje, Comparar, Carrito, Checkout, Libro de Reclamaciones y Privacidad (baja y confirmación) responden 200. El JSON-LD no incluye `AggregateRating` porque no hay reseñas reales, y está bien así. | varias | OK | — | — |

## 4. Panel de administración (`apps/admin`, :3002)

**Sin sesión:** las 16 rutas probadas (`/`, `/reservas`, `/reservas/[code]`, `/reclamos`,
`/reclamos/transcribir`, `/reclamos/[id]`, `/tours`, `/tours/nuevo`, `/tours/[id]`, `/precios`,
`/salidas`, `/privacidad`, `/privacidad/[id]`, `/usuarios`, `/cuenta` y `/auditoria`) responden **303 →
`/login?volver=...`**. `/login` da 200 y `/auth/salir` redirige con 303 a `/login?motivo=sesion`.
Resultado: **OK**.

Las 10 secciones son: login, tablero, reservas, reclamos, tours, precios, salidas, protección de
datos, usuarios y mi cuenta. Las 54 Server Actions están enlazadas a la UI salvo una.

| # | Ítem | Ubicación | Estado | Severidad | Cliente |
|---|---|---|---|---|---|
| A1 | `GET /admin/audit` no tiene pantalla (`/auditoria` no existe). | `apps/api/src/modules/backoffice/interface/backoffice.controllers.ts:641-646` | falta | importante | no |
| A2 | El editor de traducciones del tour **solo edita `es`**. `PUT /admin/tours/:id/translations/en` no se usa, y sin él no hay contenido en inglés. | `apps/admin/src/app/(panel)/tours/actions.ts:52`; `apps/admin/src/app/(panel)/tours/[id]/page.tsx:38` | falta | bloqueante (i18n) | sí (textos EN) |
| A3 | `DELETE /admin/tours/:id/translations/:locale` no se usa. | `backoffice.controllers.ts:164` | falta | menor | no |
| A4 | `POST /admin/tours/:id/archive` no se usa: no se puede archivar un tour, solo despublicarlo. | `backoffice.controllers.ts:142` | falta | menor | no |
| A5 | Las imágenes solo se registran por URL; no hay subida de archivos a S3/R2. | `apps/admin/src/app/(panel)/tours/[id]/page.tsx:103` | placeholder | importante | no |
| A6 | `cancellationQuoteAction` está definida pero no se usa: la cotización llega dentro del detalle. Es código muerto. | `apps/admin/src/app/(panel)/reservas/actions.ts:87-88` | deuda | menor | no |
| A7 | Borrar temporada y tarifa sí está expuesto. Solución directa (oferta, aceptación y rechazo), conciliación de pagos, reenvío de voucher, ARCO completo y usuarios (reiniciar MFA, desbloquear, cerrar sesiones, restablecer contraseña) también. | `precios/actions.ts:45, 98`; `reclamos/actions.ts:55-69`; `usuarios/actions.ts` | OK | — | — |
| A8 | No existen módulos para **destinos y categorías** (tampoco hay endpoints de escritura en la API), blog, testimonios (moderación), clientes, leads de contacto ni newsletter. | — | falta | importante | no |
| A9 | En el tablero falta "pagos manuales de hoy" (pendiente de hot.md). Hoy tiene ventas del día, saldos vencidos y saldos por vencer en 7 días. | `apps/admin/src/app/(panel)/page.tsx:82-174` | falta | menor | no |
| A10 | Los tipos de la API están escritos a mano (el OpenAPI no describe los cuerpos del backoffice), así que hay riesgo de desalineación. | `apps/admin/src/lib/api/types.ts` | deuda | menor | no |
| A11 | `GET /admin/users/:id` no se usa (basta con la lista). | `apps/api/src/modules/identity/interface/staff-auth.controller.ts:196` | OK con observación | menor | no |

## 5. Internacionalización (inglés)

| # | Ítem | Ubicación | Estado | Severidad | Cliente |
|---|---|---|---|---|---|
| I1 | No hay rutas `/en` (todo vive en `app/es`): `/en`, `/en/tours` y `/en/tours/x` dan 404. | `apps/web/src/app/` | falta | bloqueante (requisito i18n) | no |
| I2 | No hay diccionarios ni librería i18n. Todos los textos de UI están escritos en español dentro de los componentes. | `apps/web/src/components/**` | falta | bloqueante (i18n) | no |
| I3 | El hreflang solo declara `es-PE` y `x-default`, ambos a la misma URL. `<html lang="es-PE">` está fijo. | `apps/web/src/lib/seo/metadata.ts:24-27`; `apps/web/src/app/layout.tsx:58` | falta | importante | no |
| I4 | El sitemap solo tiene `es` ("`en` se agrega con E10"). | `apps/web/src/app/sitemap.ts:8` | falta | importante | no |
| I5 | La web pide a la API siempre `locale: "es"`. | `apps/web/src/lib/catalog/api-repository.ts:129-130, 212, 264` | falta | importante | no |
| I6 | API: `GET /tours?locale=en` devuelve **0 resultados** (sin fallback), mientras que `GET /destinations?locale=en` devuelve los textos en español. El comportamiento es inconsistente; hay que decidir entre fallback o 404 por idioma. | `apps/api/src/modules/catalog/interface/catalog.controller.ts` | roto (inconsistente) | importante | no |
| I7 | BD: **0 traducciones `en`** (tours 0/41 publicados, destinos 0/5, categorías 0/5, blog 0/6). | `pwt_dev` | falta | bloqueante (contenido) | sí (o traducción profesional) |
| I8 | Los correos solo existen en es-PE. Los enlaces llevan `/es/` fijo y `bookings.locale` no se usa para elegir la plantilla. | `apps/api/src/modules/notifications/domain/templates.ts:79-81`; `apps/api/src/modules/notifications/application/mail-composer.ts:119, 223` | falta | importante | no |
| I9 | En el panel no hay editor `en` (ver A2). | — | falta | bloqueante (i18n) | no |
| I10 | Los códigos de error de la API mezclan idiomas: el 404 de ruta devuelve `code: "no-encontrado"` y el resto usa inglés (`validation-failed`). | filtro de excepciones de la API | inconsistente | menor | no |

## 6. Funcionalidades declaradas pero desconectadas

| # | Ítem | Ubicación | Estado | Severidad | Cliente |
|---|---|---|---|---|---|
| F0 | **El enlace "Ver mi reserva" y "Pagar el saldo" de los correos lleva a 404.** `manageUrl = /es/reserva/CODE` no incluye token. La página exige la cookie `httpOnly` del navegador donde se compró (30 días, `path` de reserva), así que cualquier otro dispositivo, otro navegador o una cookie vencida da 404 (verificado: `/es/reserva/PWT-2026-000001` sin cookie → 404). El recordatorio de saldo resulta inútil y el voucher por correo no se puede abrir. | `mail-composer.ts:119`; `templates.ts:177, 208, 224`; `apps/web/src/app/es/(site)/reserva/[codigo]/page.tsx:56-60`; `apps/web/src/lib/checkout/session.ts:103` | roto | **bloqueante** | no |
| F0b | No existe forma de **recuperar el acceso** a una reserva (código + correo → enlace mágico de un solo uso, o un token firmado en el correo). | API y web | falta | bloqueante (va con F0) | no |
| F1 | Blog: la BD tiene 6 posts publicados y `data/seed/blog-posts.json` también, pero no hay endpoint en la API (`/blog-posts` y `/posts` dan 404), ni rutas web (`/es/blog`), ni módulo en el panel. | — | falta | importante (SEO: 8 URLs viejas) | no (contenido ya migrado) |
| F2 | Testimonios: existe la tabla `testimonials` (0 filas, con moderación y `publish_consent`), pero no hay API, páginas `/es/testimonios` ni `/es/dejar-testimonio`, ni moderación en el panel. La home muestra un placeholder. | `apps/api/prisma/schema.prisma:1502-1524` | falta | importante | sí (testimonios reales con consentimiento) |
| F3 | No hay formulario de contacto ni endpoint en la API, y `/es/contactenos` da 404. El contacto se reduce a WhatsApp. | — | falta | importante | sí (correo de destino) |
| F4 | No hay newsletter (ver W3). | — | falta | menor | no |
| F5 | No hay reseñas por tour (ni modelo de reseña verificada post-viaje). | — | falta | menor | no |
| F6 | Cuenta de cliente y "Mis reservas": `customers` solo tiene dominio y repositorio, sin controlador ni auth de cliente (`/auth/customer/*` y `/customers/me` dan 404). En la web no hay login (W2) y `/es/cuenta` y `/es/mis-reservas` dan 404. | `apps/api/src/modules/customers/` | falta | importante | no |
| F7 | El reclamo no se puede consultar desde la web. El correo de constancia dice "consulta el estado con el enlace que recibiste", pero `consultUrl` apunta al formulario `/es/libro-de-reclamaciones`. La API tiene `GET /complaints/:code` con `X-Complaint-Token` y la web no lo expone. | `mail-composer.ts:223`; `templates.ts:354` | roto | importante (cumplimiento) | no |
| F8 | Falta el PDF de la constancia del Libro de Reclamaciones y del voucher. Hoy se adjunta una hoja HTML imprimible. | notificaciones | falta | menor | no |
| F9 | El calendario de disponibilidad con cupos reales en la ficha está pendiente (W6). | — | falta | importante | no |
| F10 | En producción, el correo se envía por SMTP, pero en desarrollo solo genera `.eml` en `apps/api/.mail-outbox/`. Falta configurar el SMTP y el dominio (SPF/DKIM). | `apps/api` | placeholder | importante (producción) | sí (dominio y correo) |
| F11 | La confirmación de marketing (`/es/privacidad/confirmar`) y la baja (`/es/privacidad/baja`) existen y responden 200. | web | OK | — | — |

## Conteo

| Área | Ítems | Roto | Placeholder | Falta | OK | Bloqueantes |
|---|---|---|---|---|---|---|
| Enlaces y rutas (L) | 11 | 4 | 3 | 0 | 4 | 2 |
| Rutas del sitio viejo | 13 grupos | 2 en 500 | 1 | 6 grupos en 404 | 4 | (por L1) |
| Controles web (W) | 22 | 0 | 17 | 4 | 1 | 3 |
| Panel (A) | 11 | 0 | 1 | 6 | 2 | 1 |
| i18n (I) | 10 | 1 | 0 | 8 | 0 | 4 |
| Desconectadas (F) | 13 | 2 | 1 | 9 | 1 | 2 |
| **Total** | **67 ítems** (sin contar la tabla de rutas viejas) | **7** | **22** | **27** | **8** | **12** |

En la columna OK se cuentan también los ítems "OK con observación" (L9 y A11). Otros 3 son deuda o inconsistencias (A6, A10 e I10). La fila de rutas del
sitio viejo cuenta grupos de URLs y no suma en el total.

## Lista priorizada de trabajo

### Backend (API)

1. **F0/F0b:** enlace seguro de acceso a la reserva en los correos (token firmado de un solo uso que la
   web canjea por la cookie) y un flujo "recuperar mi reserva" (código + correo → enlace al correo, con
   respuesta genérica y rate limit).
2. **F7:** incluir en el correo de constancia el enlace con el token del reclamo, y hacer que
   `consultUrl` apunte a la página de consulta.
3. **F1:** `GET /blog-posts` y `GET /blog-posts/:slug` (con `locale`), y CRUD admin del blog.
4. **I6:** decidir la regla de fallback de `locale` y aplicarla igual en tours, destinos y categorías.
   Además, `/tours/:slug?locale=en` debe devolver el slug alterno para el hreflang.
5. **A8:** CRUD admin de destinos y categorías (textos y traducciones).
6. **F2:** API pública de testimonios (crear con consentimiento, listar los aprobados) y moderación admin.
7. **F3:** `POST /contact-requests` (lead con consentimiento, rate limit y correo al staff).
8. **I8:** plantillas de correo en `en` según `bookings.locale` y enlaces con el prefijo de idioma.
9. **W16:** hora y punto de recojo por ítem de reserva (modelo y API).
10. **F6:** auth de cliente (enlace mágico o OTP por correo) y `GET /customers/me/bookings`. Puede
    reemplazar a F0b a mediano plazo.
11. **I10:** unificar los códigos de error (`not-found`). **F8:** PDF de constancia y voucher.
    **W3/F4:** newsletter con doble opt-in.

### Web

1. **L1:** resolver `docs/legal` sin depender de `process.cwd()` (p. ej. con una ruta relativa al
   módulo o importando el contenido en el build). Hoy rompe las 4 políticas, el sitemap y 2
   redirecciones.
2. **F0/F7:** página que canjea el token del correo (reserva) y página de consulta de reclamos
   (`/es/libro-de-reclamaciones/consulta`).
3. **L4 y rutas viejas:** crear `/es/blog` y sus posts (F1), `/es/contacto` (F3), `/es/testimonios` y
   `/es/dejar-testimonio` (F2). Mientras tanto, 301 temporales: `tipos-de-tours` → `/es/tours`,
   `contactenos` → `/es/nosotros` (o WhatsApp) y `testimonios` → `/es`. Ajustar `buildLegacyRedirects`
   para no omitir reglas cuyo destino no existe.
4. **I1–I5:** i18n completo: segmento `[locale]` (o `/en` en paralelo), diccionarios, hreflang
   recíproco, sitemap con `alternates`, `lang` dinámico, selector de idioma activo (W1) y `locale`
   hacia la API.
5. **W6/F9:** selector de fecha con las salidas y los cupos reales (`/tours/:slug/departures`).
   **W4:** que la fecha y los viajeros filtren de verdad.
6. **W2/F6:** login de cliente y "Mis reservas" (o, de momento, quitar el texto "Podrás iniciar sesión
   pronto").
7. **W5:** orden y filtros de precio y dificultad. **L10:** texto de 404 neutro.
8. **W19:** sincronizar el carrito y los favoritos con el servidor (cuando exista F6).

### Admin (panel)

1. **A2/I9:** editor de traducciones por idioma (`es`/`en`) con un indicador de completitud por tour.
2. **A1:** pantalla de auditoría (`GET /admin/audit`) con filtros por actor, entidad y fecha.
3. **A8:** módulos de destinos y categorías, blog y moderación de testimonios. Más adelante, leads de
   contacto.
4. **A5:** subida de imágenes a S3/R2 con `alt` por foto (resuelve también W17).
5. **A4/A3:** archivar tours y borrar traducciones. **A9:** "pagos manuales de hoy" en el tablero.
6. **A6:** eliminar `cancellationQuoteAction` o usarla. **A10:** generar los tipos desde OpenAPI.

### Contenido y cliente (ver `docs/cliente/solicitud-de-informacion.md`)

1. **W9/W12:** razón social, RUC, registro MINCETUR, correo del dominio y cierre de las 66 marcas
   `[POR CONFIRMAR]` de los textos legales. Es **bloqueante para publicar**.
2. **W14/F10:** contrato de la pasarela real y dominio de correo (SMTP, SPF/DKIM).
3. **I7:** traducción al inglés de 41 tours, 5 destinos, 5 categorías y 6 posts (más la UI).
4. **W13:** política de cancelación con la tabla de penalidades (RN-04 a RN-07).
5. **W7/F2:** testimonios reales con consentimiento. **W8:** texto de Nosotros. **W10/W11:** sellos
   oficiales e ícono del Libro de Reclamaciones.
6. **L11:** archivos fuente de las fotos para re-alojarlas. **L7:** validar WhatsApp, correo y redes.
7. **W15/W18/W20/W21:** dificultad, altitud, incluye y no incluye, descripciones de categorías, FAQ y
   año de apertura.

## Relacionado

- [[concepts/backlog-mvp]] (E0 contenido, E6 cuentas, E7 disponibilidad, E10 i18n)
- [[concepts/benchmark-ota-2026]] (Ola A: A1, A3, A6 y A7 bloqueadas por datos del cliente)
- [[concepts/revision-seguridad-sprint2]]
- [[sources/sitio-actual-andeanperutours]]
- [[normativa/informacion-al-consumidor]] y [[normativa/libro-de-reclamaciones]]
