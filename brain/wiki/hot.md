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
- Siguiente (Sprint 1): conectar web ↔ API, seguridad (helmet, rate limit, auth), formulario
  del Libro de Reclamaciones, pasarela real (según elección del cliente), primer commit en git.
