# ADR-0025 — Refresco inmediato de la web y botones Eliminar en el panel

Fecha: 2026-10-19. Autor: Claude (pedido de Christian).

## Contexto
La web cachea catálogo, contenido y banners hasta 1 h (`revalidate: 3600`). Un cambio en el panel
(portada, precio, banner, testimonio) tardaba hasta una hora en verse. Además faltaban acciones de
eliminar: banners (sin endpoint), testimonios (solo rechazar), tours (la API archivaba pero el panel no
tenía botón) y en el blog el botón decía "Archivar".

## Decisión
- Web: `POST /api/revalidate` con secreto compartido (`REVALIDATE_SECRET`, comparación en tiempo
  constante) y lista cerrada de tags (`catalog`, `departures`, `content`, `testimonials`,
  `hero-banners`); `revalidateTag(tag, { expire: 0 })`. Sin secreto el endpoint responde 404.
- Panel: tras cada escritura exitosa, `lib/api/client.ts` avisa a la web según la ruta modificada
  (`lib/api/public-site.ts`). El aviso nunca hace fallar la acción (timeout 2 s); `WEB_REVALIDATE_URLS`
  admite varias webs.
- API: `DELETE /admin/hero-banners/:id` (revisión obligatoria, borra manifiesto y archivos);
  `DELETE /admin/testimonials/:id` (borrado lógico, auditado sin datos personales);
  `GET /admin/hero-banners/:id/poster` (vista previa también de inactivos).
- Panel: Eliminar en banners (con vista previa), testimonios, tours (archiva; la API lo impide con
  reservas activas futuras) y blog (antes "Archivar").
- Espaciado: el `xl` del tema es 1440 px, así que en laptops de 1280–1366 px todo quedaba en una
  columna. Tablero en 2–3 columnas, ocupación limitada a salidas con movimiento (máx. 12, enlace a
  Salidas), etiqueta corta de traducción con el texto completo como ayuda, columnas de tablas ajustadas.

## Verificación
Entorno aislado (`pwt_browser_test`): aprobar un testimonio se ve en la web en 0,18 s y al eliminarlo
desaparece en 0,15 s; secreto falso → 403, tag no permitido → 400; tablero de 8402 → 1946 px.
API 254, admin 14, web 40 pruebas en verde.
