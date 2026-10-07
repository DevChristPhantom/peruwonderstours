# @pwt/api — Peru Wonders Tours API (NestJS 12, ESM)

Monolito modular hexagonal: `src/modules/<módulo>/{domain,application,infrastructure,interface}`.
Prefijo `/api/v1`, OpenAPI en `/api/docs` (JSON en `/api/docs/openapi.json`), errores RFC 9457
`application/problem+json`, montos en céntimos (enteros) + moneda `PEN`/`USD`, fechas-hora UTC.

## Modos de datos (`DATA_SOURCE`)

| Modo | Uso |
|---|---|
| `seed` | Demo/desarrollo: catálogo de `data/seed/*.json` publicado en memoria. Con `DEMO_PRICING=true` genera tarifas y salidas **ficticias** (el cliente aún no entregó precios). |
| `memory` | Memoria vacía (tests). |
| `prisma` | PostgreSQL 16 vía Prisma 7 + `@prisma/adapter-pg` (`DATABASE_URL` en `.env`). |

```bash
cp .env.example .env          # ajustar; nunca versionar .env
pnpm build && pnpm start:prod # http://localhost:4000/api/v1
```

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / oxlint type-aware |
| `pnpm test` | Unitarios de dominio y casos de uso (repos en memoria) |
| `pnpm test:e2e` | API completa en modo seed (supertest) |
| `pnpm test:integration` | Repos Prisma contra PostgreSQL real; cada caso en transacción revertida (se omite sin `DATABASE_URL`) |
| `pnpm build && pnpm db:seed` | Carga idempotente de `data/seed` (tours en borrador, HU-0.1). `-- --publish` publica, `-- --refresh` sobrescribe textos |

## Endpoints v1

- `GET /health`, `GET /health/ready`
- Catálogo: `GET /tours` (q, destination, category, type, difficulty, minDays, maxDays, featured, minPrice, maxPrice, sort, page, pageSize, locale, currency), `GET /tours/:slug`, `GET /tours/:slug/departures`, `GET /destinations`, `GET /categories`
- Carrito (cabecera `X-Cart-Token`): `POST /carts`, `GET /carts/:id`, `POST /carts/:id/items`, `DELETE /carts/:id/items/:itemId`, `POST /carts/:id/recalculate`, `GET /carts/:id/payment-options`
- Reservas: `POST /bookings` (checkout; `Idempotency-Key` obligatoria), `GET /bookings/:id`
- Pagos: `POST /bookings/:id/payments` (`Idempotency-Key`), `GET /payments/:id`, `POST /payments/:id/confirm`, `POST /payments/webhooks/:provider` (HMAC sobre cuerpo crudo, idempotente por `eventId`)

Reglas de adelanto/saldo: `src/modules/booking/domain/payment-plan.ts` (configurables por entorno;
supuestos pendientes del cliente, ver `brain/wiki/negocio/reglas-reserva-y-pago.md`).
