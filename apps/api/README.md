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
| `pnpm test:integration` | PostgreSQL real (se omite sin `DATABASE_URL`): `*.int-spec.ts` en transacción revertida sobre `pwt_dev` y `*.db-e2e-spec.ts` (API HTTP completa en modo prisma) sobre `pwt_test`, que se **recrea y migra** en cada corrida |
| `pnpm admin:create -- --email a@b.pe --name "Nombre" [--generate]` | Crea el primer admin (contraseña por stdin o generada e impresa una sola vez; nunca a archivo). MFA se enrola al primer ingreso |
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

## Sprint 2: auth del staff, backoffice, correo y privacidad

### Auth del staff (`/api/v1/auth/staff/*`)

1. `POST login` {email, password} -> `{status: "mfa_required", mfaToken}` o `{status: "mfa_enrollment_required", enrollmentToken}` (desafíos JWT de 5 min; nunca tokens de sesión).
2. Primer ingreso: `POST mfa/enrollment` {enrollmentToken} -> `otpauthUri` (QR) + `secret`; `POST mfa/enrollment/confirm` {enrollmentToken, code} -> sesión + 10 `recoveryCodes` (una sola vez).
3. Siguientes: `POST mfa/verify` {mfaToken, code} (TOTP de 6 dígitos o código de recuperación `XXXXX-XXXXX`) -> sesión.
4. Sesión = `accessToken` (JWT HS256, 10 min, cabecera `Authorization: Bearer`) + `refreshToken` opaco (rotativo, 12 h de inactividad, 72 h absolutas). `POST refresh` {refreshToken} rota; reusar uno rotado revoca toda la sesión (`refresh-token-reused`).
5. `POST logout`, `POST logout-all`, `GET me`, `GET sessions`, `DELETE sessions/:id`, `POST mfa/recovery-codes`, `POST password`.

Contraseñas Argon2id (m=19 MiB, t=2, p=1); bloqueo progresivo (5 fallos de contraseña o TOTP -> 1, 2, 4... min, tope 1 h; `429 account-locked` + `Retry-After`); TOTP anti-replay (`mfa_last_time_step`); RBAC por **permisos** (`src/modules/identity/domain/permissions.ts`) con roles admin/operator/agent; el guard valida la sesión en BD en cada petición (logout y cambios de rol aplican de inmediato) y audita los 403 (`ACCESS_DENIED`).

**Cómo debe guardarlos el BFF (Next)**: los tokens nunca llegan al navegador. El servidor de Next guarda `{accessToken, refreshToken, accessTokenExpiresAt, sessionId}` en una cookie de sesión propia **cifrada** (p. ej. iron-session/JWE), `HttpOnly; Secure; SameSite=Lax; Path=/admin`, o en un store de servidor con id opaco en la cookie. Llama a la API con `Authorization: Bearer`; ante `401 access-token-expired` (o 1 min antes del vencimiento) hace `POST /auth/staff/refresh` **serializado por sesión** (mutex: dos refresh simultáneos con el mismo token disparan la detección de reutilización) y reemplaza ambos tokens; ante `refresh-token-reused`/`refresh-token-expired`/`session-revoked` borra la cookie y redirige al login. Reenviar `X-Forwarded-For` (bloqueo y rate limit por IP) y `X-Request-Id`. Protección CSRF en las acciones del BFF (SameSite + token o Server Actions).

### Backoffice (`/api/v1/admin/*`, requiere `DATA_SOURCE=prisma`; si no, 503 `backoffice-requires-database`)

Tours (CRUD, publicar/despublicar con checklist, traducciones, medios por URL, 301 al cambiar slug, bloqueo optimista `version`), temporadas y tarifas (solapes con mensaje claro antes del EXCLUDE), salidas (lote por rango/días de semana, capacidad >= vendido, cierre de ventas), reservas (filtros, detalle, cancelación con política `CANCELLATION_REFUND_TIERS`, pagos y reembolsos manuales idempotentes, reenvío de voucher), Libro de Reclamaciones (semáforo 10/13/15 días hábiles, respuesta, reclasificación, solución directa art. 6-A, transcripción del libro de respaldo), ARCO, auditoría, usuarios y tablero. Toda escritura corre en una transacción con `app.actor_id` (los triggers de `audit_log` registran al usuario) y además escribe la acción semántica en `audit_log`.

### Correo transaccional

Outbox -> relay en proceso (`OUTBOX_RELAY_INTERVAL_MS`): reclamo con lease y `FOR UPDATE SKIP LOCKED`, idempotente por `email_deliveries` (UNIQUE evento + plantilla, Message-ID determinista), reintentos con backoff 30 s x 2^n (tope 1 h) hasta `OUTBOX_MAX_ATTEMPTS`. Plantillas HTML + texto (es-PE): confirmación/voucher, pago recibido, recordatorio de saldo 7 y 2 días (dedupe `outbox_events.dedupe_key`), cancelación, constancia del Libro de Reclamaciones (hoja imprimible HTML adjunta; PDF pendiente), oferta de solución directa y respuesta. Desarrollo: `.eml` en `apps/api/.mail-outbox/` (gitignored); producción: SMTP con TLS.

### Privacidad (Consents v2)

`consents` admite titular sin cuenta (`subject_email_hash` = HMAC del correo, `anonymous_id`), método y hash del texto; `legal_acceptances` separa acuse de privacidad y aceptación de T&C/política de cancelación (se registran en el checkout junto con `marketingEmailOptIn`/`marketingWhatsappOptIn`, desmarcados por defecto). Baja pública: `GET/POST /api/v1/privacy/unsubscribe` con enlace firmado (HMAC, sin correo en claro). Solicitudes ARCO en `/admin/privacy/requests`.

## Endurecimiento de seguridad (revisión Sprint 2, `brain/wiki/concepts/revision-seguridad-sprint2.md`)

### Cambios de CONTRATO para `apps/admin` y `apps/web`

| Hallazgo | Antes | Ahora |
|---|---|---|
| H-14 | `POST /auth/staff/login` devolvía `mfa_required` o `mfa_enrollment_required` | Nuevo estado **`password_change_required`** con `passwordChangeToken` (5 min) cuando la contraseña es temporal (alta desde el backoffice, `--generate` del CLI o reinicio por un admin). El BFF muestra "elige tu contraseña" y llama a **`POST /auth/staff/password/initial`** `{passwordChangeToken, newPassword}`, que devuelve el paso siguiente (`mfa_required` / `mfa_enrollment_required`). Errores: 400 `weak-password` / `password-unchanged`, 401 `invalid-mfa-token`. |
| H-15 | `GET /admin/bookings?email=` | `GET /admin/bookings` ya **no** acepta `email` (400). Búsqueda con correo: **`POST /admin/bookings/search`** con los mismos filtros en el cuerpo + `email`. `GET /admin/bookings/:code` queda auditado (`BOOKING_PII_VIEWED`). |
| H-15 | `GET /admin/privacy/consents?email=` | **`POST /admin/privacy/consents/search`** `{email}` (el GET se eliminó). |
| H-13 | `429 account-locked` solo con correos existentes; bloqueo de la cuenta hasta 1 h | Mismo código, mensaje y `Retry-After` para correos existentes o no. Bloqueo **por cuenta+IP** (5 fallos -> 1, 2, 4... min, tope 1 h) + límite **por cuenta** (20 fallos -> tope 15 min). |
| H-12 | — | `POST /auth/staff/mfa/recovery-codes` y `POST /auth/staff/password` respetan el bloqueo (429) y, al bloquearse, cierran la sesión actual. |
| H-01 | Un segundo `POST /bookings/:code/payments` con otra clave creaba otro cobro | Retoma el intento activo (200 + `Idempotent-Replayed: true`, mismo `payment.id`) o 409 `payment-in-progress` si cambió el monto. Pago manual del staff con un cobro en línea en curso: 409 `payment-in-progress`. Nuevo `POST /admin/payments/reconcile` (`payments:refund`). |
| H-10 | Webhook aprobado sin monto se aceptaba | Se rechaza (`failed`, `amount_missing`); confirmación con otro monto: 422 `payment-amount-mismatch`. |
| H-16 | `returnUrl` cualquiera | Solo bajo el origen de `PUBLIC_WEB_BASE_URL` (400 `invalid-return-url`). |
| H-17 | `bookingCode` vinculaba cualquier reserva | `POST /complaints` acepta `X-Booking-Token` opcional; se vincula solo con el token o si el correo coincide con el del comprador; si no, queda en `declaredBookingCode` (detalle admin). |
| H-05 | Marcar marketing en el checkout otorgaba el consentimiento | Queda **pendiente**: se envía un correo con enlace firmado (7 días). Nuevos públicos **`GET/POST /privacy/marketing-confirmation`** `{token}` (página web `/es/privacidad/confirmar?token=` pendiente en `apps/web`). Sin confirmar no hay marketing ni enlace de baja. |
| H-19 | CORS con `credentials: true` | `credentials: false` (la API usa Bearer, nunca cookies). |

### Cambios internos
- H-01: `bookings.version` (UPDATE condicionado) + `SELECT ... FOR UPDATE` en pagos, webhooks, expiración y cancelación; índice único "un cobro activo por reserva"; excedentes y pagos tardíos se reembolsan solos; conciliación cada 5 min (`reconcileStalePayments`).
- H-03/H-04: contador atómico en SQL (`auth_login_throttle` + `users.failed_login_count = failed_login_count + 1`); `users` se actualiza solo en las columnas que cambian y condicionado por `version`.
- H-06: `audit_log` con **allowlist** de columnas por tabla (`audit_allowed_columns`) y limpieza de filas existentes.
- H-11: `SWAGGER_ENABLED` se apaga por defecto en producción y encenderlo falla la validación.
- H-19: AES-256-GCM con AAD `tabla:columna:id` (formato v2; v1 se sigue leyendo) en hojas de reclamación y secretos TOTP; permisos del guard con `getAllAndMerge`.
- H-08 (no hecho, sin Redis en este entorno): el rate limiting por IP sigue en memoria del proceso; con más de una réplica hay que usar `ThrottlerStorageRedisService` y exigir `REDIS_URL` en producción. El limitador de login ya es compartido (PostgreSQL).
- H-09 (sin cambios, decisión de negocio): el rol `agent` sigue registrando pagos manuales.
