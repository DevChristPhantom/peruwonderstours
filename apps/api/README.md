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
pnpm dev:prisma              # PostgreSQL, http://localhost:3001/api/v1 (recarga en caliente)
pnpm build && pnpm start:prod # PORT por defecto 3001
```

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / oxlint type-aware |
| `pnpm test` | Unitarios de dominio y casos de uso (repos en memoria) |
| `pnpm test:e2e` | API completa en modo seed (supertest) |
| `pnpm test:integration` | Repos Prisma contra PostgreSQL real; cada caso en transacción revertida (se omite sin `DATABASE_URL`) |
| `pnpm dev:prisma` | API con `DATA_SOURCE=prisma` en el puerto 3001 (`nest start --watch`; lee `DATABASE_URL` de `.env`) |
| `pnpm openapi:export` | Compila y escribe `openapi.json` (contrato para generar tipos en el front) |
| `pnpm build && pnpm db:seed` | Carga idempotente de `data/seed` (tours en borrador, HU-0.1). `-- --publish` publica, `-- --refresh` sobrescribe textos |

## Endpoints v1

- `GET /health`, `GET /health/ready`
- Catálogo: `GET /tours` (q, destination, category, type, difficulty, minDays, maxDays, featured, minPrice, maxPrice, sort, page, pageSize, locale, currency), `GET /tours/:slug`, `GET /tours/:slug/departures`, `GET /destinations`, `GET /categories`
- Carrito (cabecera `X-Cart-Token`): `POST /carts`, `GET /carts/:id`, `POST /carts/:id/items`, `DELETE /carts/:id/items/:itemId`, `POST /carts/:id/recalculate`, `GET /carts/:id/payment-options`
- Reservas: `POST /bookings` (checkout; `Idempotency-Key` + `X-Cart-Token`; devuelve `accessToken` una sola vez),
  `GET /bookings/:code` (código `PWT-AAAA-NNNNNN` + cabecera `X-Booking-Token`)
- Pagos (todas con `X-Booking-Token`): `POST /bookings/:code/payments` (`Idempotency-Key`), `GET /bookings/:code/payments`,
  `GET /bookings/:code/payments/:paymentId`, `POST /bookings/:code/payments/:paymentId/confirm`;
  `POST /payments/webhooks/:provider` (HMAC sobre cuerpo crudo, idempotente por `eventId`)
- Libro de Reclamaciones: `POST /complaints` (sin cuenta; `Idempotency-Key`; devuelve constancia + `accessToken`),
  `GET /complaints/:code` (`LR-AAAA-NNNNNN` + cabecera `X-Complaint-Token`)

### Contrato de acceso sin cuenta

- Los tokens (`X-Cart-Token`, `X-Booking-Token`, `X-Complaint-Token`) son 256 bits base64url; la base guarda solo
  su SHA-256 y se comparan en tiempo constante. Sin cabecera o con formato inválido: **401** `*-token-required`.
  Token incorrecto o código inexistente: **404 genérico** idéntico (no revela si el código existe).
- Un replay idempotente de `POST /bookings` o `POST /complaints` devuelve **200** + `Idempotent-Replayed: true` y un
  token **nuevo** (el anterior queda invalidado).
- La API está pensada para llamarse desde el servidor de Next (no desde el navegador): los tokens no deben llegar al
  cliente ni a logs.

### Seguridad HTTP

helmet (CSP `default-src 'none'` en la API; CSP propia para Swagger), CORS con allowlist `WEB_ORIGIN`, límite de
cuerpo `BODY_LIMIT_KB` (413 problem+json), `TRUST_PROXY` configurable y rate limiting por IP con
`@nestjs/throttler` (global `THROTTLE_LIMIT`/`THROTTLE_TTL_SECONDS`; estricto `THROTTLE_STRICT_LIMIT` en
`POST /bookings`, pagos y `POST /complaints`). Con Next delante: reenviar la IP real en `X-Forwarded-For` y confiar
en ese salto (`TRUST_PROXY=loopback` si comparten host). Datos personales de reclamaciones cifrados con AES-256-GCM
(`PII_ENCRYPTION_KEY`, obligatoria en producción).

Reglas de adelanto/saldo: `src/modules/booking/domain/payment-plan.ts` (configurables por entorno;
supuestos pendientes del cliente, ver `brain/wiki/negocio/reglas-reserva-y-pago.md`).
