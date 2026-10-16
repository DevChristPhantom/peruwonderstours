---
type: meta
title: Hot Cache
status: developing
created: 2026-10-07
updated: 2026-10-16
tags:
  - meta
  - hot-cache
---

# Recent Context

## Last Updated

- 2026-10-16 (Claude, auditoría integral): ver docs/qa/auditoria-2026-10-16.md. Pruebas en verde (API 253+32, admin 14, web 35, CI). Build de producción 216/216 en 200 (0,05 s). Corregido: filtro `?volver=` del login admin alineado con `safeNext`; 57 páginas PT en español pasan a noindex hasta traducirse. Pendiente: repo público, rama `feature/entrega-peruwonderstours` obsoleta, `PUBLIC_WEB_BASE_URL` apunta a :4000, precios DEMO y RUC de ejemplo antes de publicar.

- 2026-10-16 (Claude, revisión local): 216/216 URLs del sitemap en 200 (es/en/pt) y 73 redirecciones legadas OK. Causa de bucles 307 en 28 rutas traducidas: `next dev --hostname 127.0.0.1` (Next normaliza 127.0.0.1→localhost y el rewrite de next-intl se trata como externo); arrancar con `localhost`. BD local `pwt_admin_preview` sin tours publicados → `db:seed -- --publish --demo-pricing` (41 tours, 656 tarifas y 4920 salidas DEMO, solo local). `start-web-preview.ps1` pasa a `CATALOG_SOURCE=api` (con `seed` la ficha mostraba "A cotizar"). Compra sandbox E2E verificada: PWT-2026-000001, S/ 598 pagado al 100 % (salida <7 días), voucher por correo, reserva 404 sin cookie. Corregido: motivo de pago completo mostraba el código crudo (`departure_too_close`) → mensajes es/en/pt; quitada ruta `/cuenta/ingresar` sin página.

2026-10-13 — Continuidad en Codex sobre el backup del Sprint 3. Ver [[concepts/entrega-octubre-2026]] para la evidencia actual; el historial de abajo conserva las notas anteriores.

## Key Recent Facts

- Proyecto: [[entities/proyecto-turismo-peru]].
- Stack propuesto: [[decisions/ADR-0001-stack-tecnologico]].
- Plugins instalados (scope usuario): claude-obsidian 2.2.0, fullstack-dev-skills 0.4.18,
  ui-ux-pro-max 2.13.0.
- Equipo: 12 subagentes senior en `.claude/agents/`, dirigidos por `tech-lead-orchestrator`.

## Recent Changes

- 2026-10-16: independencia del sitio anterior: 366 imágenes propias, 41 tours y contenido ES/EN preservados; 227 rutas sin hosts retirados y 366 archivos verificados por HTTP/SHA-256 en demo compilada. Mapas API/admin sincronizados; 35 pruebas web, 14 admin y 16 API dirigidas aprobadas. Ver [[decisions/ADR-0022-independencia-de-medios]]. Validación de navegador actual en CI pendiente.

- 2026-10-15: manual de uso v0.1 en docs/manual/manual-de-uso.md; actualizar con cambios del sistema. Ver [[decisions/ADR-0021-manual-de-uso]].

- 2026-10-15: diario de historias/leyendas/cultura con filtros, propuestas moderadas y dos lecturas iniciales ES/EN/PT; ver [[decisions/ADR-0020-diario-viajeros]].

- 2026-10-15: SEO técnico, datos de agencia confirmados, tarjetas sociales y noindex rastreable; ver [[decisions/ADR-0019-seo-tecnico]].

- 2026-10-15: recorrido buscador→pago sandbox comprobado 24/24 en CI; teléfono cifrado corregido y bloqueos de viajeros/facturación documentados. Ver [[decisions/ADR-0018-auditoria-reservas]].

- 2026-10-14: rediseño login/MFA y dirección Puno confirmada; ver [[decisions/ADR-0017-acceso-visual-personal]].

- 2026-10-14: avatar del personal, nombre y rol estilizados en topbaradmin, sin cambios a logout/sesión; tipos/lint aprobados. Ver [[decisions/ADR-0015-avatar-del-administrador]].


- 2026-10-14: tercer idioma pt-BR con 1098 claves, banderaBR, rutas, legales, reservas/correos y editoresPT. Catálogo sin traducción muestraESconaviso; migracionesPTpreparadas, no aplicadas aBDcliente. Ver [[decisions/ADR-0014-portugues-brasil]].


- 2026-10-14: logo dorado diseñado por el cliente sustituye al anterior, transparente y completo sin recortes en web/admin; tipos/lint aprobados. Ver ADR-0013.


- 2026-10-14: retirado fondo blanco del logo en web y login admin por petición del cliente; PNG transparente intacto.


- 2026-10-14: marca definitiva peruwonderstours.com y logo PNG del cóndor proporcionado por el cliente; marca unificada, redes/reseñas heredadas archivadas y tipos/lint/pruebas focalizadas aprobadas. Ver [[decisions/ADR-0013-marca-y-logo-del-cliente]].


- 2026-10-14: selector de idioma con SVG locales de Perú/Reino Unido y nombres, conservando rutas equivalentes, búsqueda y etiquetas accesibles; ver [[decisions/ADR-0012-idiomas-con-banderas]].


- 2026-10-14: retirado nombre repetido en controles del banner; título de escena y motion preservados. Lint/tipos locales aprobados, ver [[decisions/ADR-0011-banner-sin-titulo-repetido]].


- 2026-10-14: prioridad comercial de home corregida; pruebas Chromium CI con PostgreSQL efímero, staff MFA ficticio y pagos sandbox. Ver [[decisions/ADR-0010-prioridad-comercial-y-pruebas]] y docs/qa/funcional-2026-10-14.md para estado y límites actuales. El historial siguiente conserva evidencias anteriores.


- 2026-10-13: UI/UX web/admin con siete skills instaladas y validadas, marca preservada,
  navegación agrupada, superficies/tablas y microinteracciones accesibles. Ver [[decisions/ADR-0007-ui-ux-y-skills-motion]].
  Web y login admin responden HTTP 200; la revisión visual automatizada sigue limitada.

- 2026-10-13: optimización progresiva de carga: drawer al primer uso, fuente Mono sin preload,
  GSAP omitido con movimiento reducido, hero opacity/transform y sizes compartido de galería.
  Ver [[decisions/ADR-0006-optimizacion-carga-web]]; medición HTTP compilada en CI, sin afirmar Web Vitals.

- 2026-10-13: dominio confirmado `peruwonderstours.com`, WhatsApp `+51 924 278 597`
  y correo `jorgechaveztourt@gmail.com`. El cliente dará el RUC real el día de entrega;
  ejemplo `20000000000` solo visual y etiquetado, sin sustituir la identidad fiscal real.
- Continuidad: Nosotros bilingüe con destinos del catálogo, sitemap editorial con slugs
  traducidos de la API, motion accesible, validación de fechas del panel y fuentes locales
  Geist/Geist Mono/Fraunces. Se mantienen arquitectura, diseño y agentes originales.
- Validación: 219 pruebas unitarias API, 32 e2e API, 12 pruebas admin y 3 pruebas web pasaron.
  GitHub aprobó la compilación de API/web/admin y 150 rutas HTTP públicas/legacy (run 38441950356).
  Integración PostgreSQL y revisión visual completas siguen pendientes; no acreditar producción lista.
- Hosting y pasarela aún no contratados. La API solo implementa sandbox y lo rechaza en
  producción: se requiere integración real antes de habilitar cobros. No se ha publicado.

- 2026-10-08: benchmark OTA 2026 en [[concepts/benchmark-ota-2026]] (Ola A: 10 HU-B sin terceros; búsqueda web incompleta por límite de sesión, celdas `?` pendientes).
- 2026-10-07: contenido público extraído a `data/seed/` (41 tours, 0 con precio; ver `_extraction-report.md`).
  Backlog en [[concepts/backlog-mvp]]; reglas de pago en [[negocio/reglas-reserva-y-pago]].

- Modelo de datos MVP diseñado ([[concepts/modelo-de-datos]]): `apps/api/prisma/schema.prisma` (Prisma 7, 36 modelos), `prisma.config.ts`, `prisma/sql/00_extensions.sql` y `constraints.sql` (+ reversos). Sin aplicar: falta instalar Prisma y Postgres local (recomendado: binarios ZIP EDB en puerto 5433).

- Vault creado desde el plan oficial de `init` (hashes verificados); escrituras
  transaccionales pendientes de WSL.

## Active Threads

- Resuelto: Node.js 24.19.0 LTS + pnpm 12.9.1 instalados (scope usuario).
- Monorepo listo (2026-10-07): pnpm 10.34.6 (pnpm 12 falla en Windows sin admin por symlinks),
  `apps/web` Next.js 16.3.8 y `apps/api` NestJS 12 → typecheck, build y tests en verde.
  Nota: en Next 16 el typecheck es `next typegen && tsc --noEmit`.
- 2026-10-07: PostgreSQL 16.15 portable en `C:\Users\ingjo\claude-tools\pgsql`, datos en
  `claude-tools\pgdata`, puerto 5433, BD `pwt_dev` (credencial solo en `apps/api/.env`).
  Arrancar: `pgsql\bin\pg_ctl -D pgdata -l pgdata\server.log -w start > /dev/null`.
  Migraciones aplicadas: extensions → init (36 tablas) → db_constraints.
- Logo: paleta "Titicaca y telar" elegida (falta OK de Jorge y archivo fuente).
- 2026-10-07 FIN DE SPRINT 0 (verificado por el coordinador):
  - Web `apps/web`: home + hero morph, listado/fichas/destinos/categorías (66 páginas SSG),
    carrito, checkout 3 pasos con 50 %/100 % y pago sandbox. typecheck/lint/build OK.
    Catálogo aún lee `data/seed` (`CATALOG_SOURCE`), falta conectarlo a la API.
  - API `apps/api`: catálogo, carritos, reservas (Idempotency-Key), pagos sandbox + webhooks
    HMAC. 103 unit + 9 e2e + 5 integración (Postgres real) en verde. Swagger `/api/docs`.
  - BD `pwt_dev`: 41 tours (borrador), 340 imágenes, 5 destinos, 5 categorías, 6 posts.
  - Drift conocido de Prisma (índices parciales/SQL-only): generar migraciones SIEMPRE con
    `--create-only` y revisar antes de aplicar.
  - Pendientes técnicos: enum `payment_provider` sin `sandbox`; tabla/Redis de idempotencia;
    auth/RBAC + token de acceso a reserva; helmet, throttler, cookie-parser, tsx, argon2,
    ioredis/bullmq; ADR de pasarela; logo nuevo; imágenes re-alojadas.
- Bloqueo: WSL para el modo transaccional del vault (opcional).
- Pendiente: respuestas del cliente (ver preguntas abiertas en el proyecto).
- 2026-10-07 FIN DE SPRINT 1 (commit ca52edc, mergeado a develop): web conectada a la API
  vía BFF, seguridad base, acceso a reservas por token, idempotencia en BD, Libro de
  Reclamaciones (API + formulario), políticas en borrador. E2E real con Postgres verificado:
  reserva PWT-2026-000001 (50 % + saldo, stock 2/12). Precios DEMO en `pwt_dev`
  (`db:seed -- --remove-demo-pricing` para quitarlos).
  Arrancar API: `pnpm --filter @pwt/api dev:prisma` (3001); web: `next dev` (3000).
- 2026-10-09 FIN DE SPRINT 2 (develop 4cb5122): panel `apps/admin` (3002) con login+MFA,
  tablero, reservas, reclamos, tours, precios, salidas, ARCO, usuarios; auth de staff; correo
  transaccional (.eml en `apps/api/.mail-outbox/`); consents v2 y doble opt-in; Ola A en la web
  (favoritos, Mi viaje, comparador, búsqueda por frase, WhatsApp, voucher offline con QR);
  endurecimiento H-01..H-19 ([[concepts/revision-seguridad-sprint2]]); fix zona horaria (sesión
  Prisma en UTC). 263 tests API verdes. Decisión: [[decisions/ADR-0003-pagos-manuales-sin-doble-control]].
  OJO: datos de pwt_dev escritos antes del fix tienen timestamps +5 h (solo dev).
  Usuarios de prueba en pwt_dev: qa-admin@peruwonders.test, qa-agent-panel@peruwonders.test
  (deshabilitar antes de cualquier demo pública).
- Pendientes: Redis (H-08), CSP 'unsafe-inline' en catálogo SSG (aceptado), PDF de constancia,
  subida de imágenes a S3/R2, pantalla de auditoría, "pagos manuales de hoy" en tablero,
  Ola A bloqueada por datos del cliente (A1, A3, A6, A7), pasarela real, QA E2E Playwright.
- Pedido al cliente: `docs/cliente/solicitud-de-informacion.md` (22 puntos).
- Siguiente (Sprint 2): auth + backoffice (tours, precios, reservas, responder reclamos),
  correo transaccional (constancias, vouchers), consents v2, pasarela real, QA/E2E Playwright,
  revisión de seguridad.
- 2026-10-09 SPRINT 3 (rama `feature/sprint-3-funcional`, en curso):
  - API cerrada (commit d120d27): enlaces mágicos de un solo uso (reserva, reclamo, cliente `/me`),
    i18n con fallback es + 301 entre slugs, blog/testimonios/contacto/site-content, CRUD admin
    de contenidos, subida de medios, anulación de pagos manuales, errores en inglés
    (`not-found`, `too-many-requests`). 219 unit + 32 e2e + 43 integración. Decisión:
    [[decisions/ADR-0004-enlaces-de-acceso-por-correo]].
  - Datos: traducciones `data/seed/en/` (41 tours, `machine_reviewed_pending_client`),
    contenido legado completo + 4 testimonios + manifiesto de 404 imágenes + sellos con URL
    oficial (`data/seed/trust-badges.json`; logos apagados hasta que el cliente pruebe).
    358 imágenes importadas a `apps/api/uploads/legacy` (gitignored); 21 fallaron (15 de
    turinet.turismoads.com sin DNS, 6 dan 404).
  - Web (`[locale]` con next-intl) y admin (pantallas nuevas) en curso.
  - Gotcha: `next typegen`/build necesitan `SWC_NATIVE_BINDING_CACHE` fuera de `AppData\Local\swc`.
  - Preguntas al cliente ampliadas a 45 (secciones 7–8).
- Detalle a revisar: `balanceDueAt` = 00:00 Lima del día −7 → la web dice "vence el 13 nov"
  pero en rigor vence al inicio del 13; aclarar regla con el cliente.



- 2026-10-13: banners HTML originales aislados, carrusel reiniciable, eventos de mouse y gestión admin. Web cinco pruebas, tipos y HTTP 200; API vieja requiere reinicio. Ver [[decisions/ADR-0008-banners-html-motion]].

- 2026-10-13: cliente aprueba sustituir iframes por banners nativos. Imágenes + título + efectos de agua/nubes, entrada reiniciable, admin con selector y titleEmbedded. Revisión independiente detectó y corrigió duplicado Machu, none no estático, geografía inferida y will-change permanente. Validación visual/FPS sigue pendiente.

- 2026-10-14: tarjetas de recursos oficiales con carrusel transform y bordes difuminados, pausa y acceso teclado; WhatsApp con símbolo y Libro con aviso INDECOPI Anexo III. Formularios preservados. Ver [[decisions/ADR-0009-recursos-oficiales-y-reclamaciones]].

- 2026-10-14: venta priorizada en home; recursos/aviso movidos tras CTA. Suite de navegador Chromium con PostgreSQL y MFA ficticios en CI para usuario/admin, capturas y tiempos por acción. Ejecución pendiente hasta disponer de resultados. Ver [[decisions/ADR-0010-prioridad-comercial-y-pruebas]].
