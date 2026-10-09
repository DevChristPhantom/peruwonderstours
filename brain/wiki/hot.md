---
type: meta
title: Hot Cache
status: developing
created: 2026-10-07
updated: 2026-10-07
tags:
  - meta
  - hot-cache
---

# Recent Context

## Last Updated

2026-10-07 — Fase 0 (setup) completada: cerebro, equipo de subagentes y skills instalados.

## Key Recent Facts

- Proyecto: [[entities/proyecto-turismo-peru]].
- Stack propuesto: [[decisions/ADR-0001-stack-tecnologico]].
- Plugins instalados (scope usuario): claude-obsidian 2.2.0, fullstack-dev-skills 0.4.18,
  ui-ux-pro-max 2.13.0.
- Equipo: 12 subagentes senior en `.claude/agents/`, dirigidos por `tech-lead-orchestrator`.

## Recent Changes

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
- Detalle a revisar: `balanceDueAt` = 00:00 Lima del día −7 → la web dice "vence el 13 nov"
  pero en rigor vence al inicio del 13; aclarar regla con el cliente.
