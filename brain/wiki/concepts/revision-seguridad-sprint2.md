---
type: concept
title: Revisión de seguridad Sprint 2 (backoffice, auth, pagos, privacidad)
status: active
created: 2026-10-08
updated: 2026-10-08
tags:
  - seguridad
---

# Revisión de seguridad Sprint 2

Revisión **solo de lectura** de la rama `feature/sprint-2-backoffice` de [[entities/proyecto-turismo-peru]]
(OWASP ASVS L2 / Top 10, Ley 29733). No se modificó código. Alcance: `apps/api` (identity, backoffice,
booking, payments, complaints, privacy, `app.setup.ts`, `config/`) y el BFF de `apps/web`
(`lib/api/*`, `lib/checkout/session.ts`, Server Actions, `public/sw-voucher.js`, cabeceras/CSP).

Evidencia: lectura del código citado; tests unitarios de identity, payments, privacy y shared
ejecutados (7 archivos, 65 tests, todos verdes). `pnpm audit` no devolvió salida (sin red):
**pendiente**. No se hicieron pruebas en vivo (los hallazgos de concurrencia se sustentan en el
código: lecturas sin bloqueo + escrituras completas en READ COMMITTED). `apps/admin/` existe sin
versionar y **no** se revisó.

Rutas relativas a la raíz del repo. Bloquea = debe corregirse antes de pasar a producción.

## Resumen

| # | Severidad | Hallazgo | Bloquea |
|---|---|---|---|
| H-01 | Alta | Reserva y pago se guardan con sobrescritura ciega (lost update) en webhook/confirmación | Sí |
| H-02 | Alta | La web no envía CSP, HSTS, frame-ancestors ni ninguna cabecera de seguridad | Sí |
| H-03 | Media | Bloqueo progresivo eludible con peticiones concurrentes (contador sin bloqueo de fila) | Sí |
| H-04 | Media | `users.update` sobrescribe la fila entera: un fallo de login concurrente puede reactivar a un usuario deshabilitado | Sí (junto con H-03) |
| H-05 | Media | Consentimiento de marketing registrable para un correo ajeno (sin doble opt-in) | Sí (Ley 29733) |
| H-06 | Media | `audit_log` (append-only) guarda PII de reclamos no redactada | Sí (Ley 29733) |
| H-07 | Media | IP del visitante falsificable vía `X-Forwarded-For` del BFF (evasión de rate limit) | Sí |
| H-08 | Media | Rate limiting en memoria del proceso | Sí si hay más de 1 réplica |
| H-09 | Media | El rol `agent` registra pagos manuales sin doble control | No (decisión de negocio) |
| H-10 | Media | Pasarela sandbox: el navegador decide si el cobro se aprueba (`simulate`) | Sí para cualquier entorno público |
| H-11 | Baja | Swagger habilitado por defecto y no forzado a `false` en producción | Sí (trivial) |
| H-12 | Baja | Regenerar códigos de recuperación y cambiar contraseña ignoran el bloqueo | No |
| H-13 | Baja | Enumeración de cuentas del staff y DoS por bloqueo | No |
| H-14 | Baja | Contraseña temporal sin cambio obligatorio en el primer ingreso | No |
| H-15 | Baja | Lectura de PII de reservas sin auditar; correos en query string | No |
| H-16 | Baja | `returnUrl` del pago sin allowlist | No |
| H-17 | Baja | Un reclamo puede vincularse a cualquier reserva por código | No |
| H-18 | Baja | Voucher con PII guardado offline sin caducidad | No |
| H-19 | Info | AES-GCM sin AAD; `getAllAndOverride` en el guard; CORS sin Origin; `API_BASE_URL` http | No |

## Hallazgos

### H-01 (Alta) Lost update en reservas y pagos

- **Dónde:** `apps/api/src/modules/booking/infrastructure/prisma-booking.repository.ts:87-113`
  (`save` hace `update` de `status`, `paidAmount`, `refundedAmount`... sin `version` ni condición);
  `apps/api/src/modules/payments/application/payment.use-cases.ts:235-259` (`syncFromProvider` lee la
  reserva con `findById`, sin `FOR UPDATE`); `apps/api/src/modules/booking/application/booking-lifecycle.ts:49-80`;
  `persistence/prisma/prisma-unit-of-work.ts` (READ COMMITTED). El backoffice sí bloquea
  (`bookings-admin.service.ts:387-396`), pero el webhook y la confirmación del cliente no.
- **Explotación:** (a) un operador cancela la reserva (libera cupos y fija el reembolso) mientras llega el
  webhook de un pago aprobado: el webhook leyó la reserva antes y escribe `status=paid` sobre la
  cancelación. Resultado: reserva pagada con cupos liberados (sobreventa) y reembolso perdido.
  (b) Dos intentos de pago con claves de idempotencia distintas (dos pestañas, o el comprador a propósito,
  `payment.use-cases.ts:69-91` no impide un segundo intento activo) se aprueban a la vez: `paidAmount` refleja
  uno solo. Si se aprueban en serie, el segundo lanza `OverpaymentError` (`booking.ts:273-275`): el
  dinero queda capturado en la pasarela, el pago queda `pending` y no hay reembolso automático.
- **Corrección:** `SELECT ... FOR UPDATE` de la reserva en `applySucceededPayment` y en todo cambio de
  estado (o columna `version` con `updateMany where {id, version}` y reintento); índice único parcial
  "un pago no terminal por reserva y tipo"; ante sobrepago, registrar como `late_payment`/reembolso automático
  en vez de lanzar; job de conciliación de pagos `pending` contra la pasarela.

### H-02 (Alta) Sin CSP ni cabeceras de seguridad en la web

- **Dónde:** `apps/web/next.config.ts:46-57` (`headers()` solo configura `/sw-voucher.js`); no existe
  `middleware.ts`/`proxy.ts`; ninguna coincidencia de `Content-Security-Policy`, `Strict-Transport-Security`,
  `frame-ancestors` o `nonce` en `apps/web/src`.
- **Explotación:** clickjacking del checkout y de la página de pago de la reserva (se pueden enmarcar);
  cualquier XSS futuro (p. ej. contenido de tours editable desde el backoffice) no tiene contención;
  sin HSTS el primer acceso es degradable a http.
- **Corrección:** middleware que genere un nonce por petición y envíe
  `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…';
  img-src 'self' data: https://<cdn>; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`
  (más el dominio de la pasarela cuando exista), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` restrictiva. Probar primero en `Content-Security-Policy-Report-Only`.

### H-03 (Media) Bloqueo progresivo eludible por concurrencia

- **Dónde:** `apps/api/src/modules/identity/application/staff-auth.use-cases.ts:177-189` (el bloqueo se
  comprueba antes del Argon2, fuera de transacción) y `:534-550` (`recordFailure`/`applyFailure`:
  `findById` + `failedLoginCount + 1` + `update`); `identity-stores.ts:87-96` (`findById` sin
  `FOR UPDATE`). Lo mismo en `verifyMfa` (`:219-245`).
- **Explotación:** se envían N intentos en paralelo contra el mismo correo; todos pasan la comprobación de
  bloqueo y todos leen el mismo contador, así que N fallos cuentan como ~1. Con varias IP (el límite
  estricto es por IP, 10/min) la adivinación de contraseñas del staff deja de estar acotada por el bloqueo.
  El TOTP sigue protegiendo, pero la contraseña queda expuesta a fuerza bruta distribuida.
- **Corrección:** incremento atómico
  `UPDATE users SET failed_login_count = failed_login_count + 1, locked_until = … WHERE id = $1 RETURNING …`
  (o `SELECT … FOR UPDATE` dentro de la misma transacción que verifica); limitador adicional por cuenta
  (no solo por IP) en Redis.

### H-04 (Media) Escritura completa de `users` con datos viejos

- **Dónde:** `identity-stores.ts:62-79,94-96` (`mutableUser` escribe `role`, `status`, `passwordHash`,
  `mfaSecretEnc`, `version`...); lo usan `applyFailure`, `completeLogin` y el rehash del login.
- **Explotación:** un admin deshabilita al usuario X (`staff-users.use-cases.ts:412-445`) mientras llega un
  intento de login fallido de X: `recordFailure` leyó `status=active` y lo vuelve a escribir. La cuenta
  queda activa otra vez (las sesiones sí se revocaron). Igual con un reinicio de MFA o de contraseña
  concurrente (se restauraría el secreto TOTP o el hash anterior).
- **Corrección:** actualizar solo las columnas que cambian cada operación y condicionar por `version`
  (`updateMany where {id, version}`), o bloquear la fila.

### H-05 (Media) Consentimiento de marketing para correos ajenos

- **Dónde:** `apps/api/src/modules/booking/application/booking.use-cases.ts:144-149,218-227`;
  `apps/api/src/modules/privacy/application/privacy.use-cases.ts:192-246` (filas `consents` con `granted=true`
  para el correo escrito en el checkout).
- **Explotación:** cualquiera hace un checkout (no hace falta pagar: el hold expira solo) con el correo de
  un tercero y marca "quiero ofertas". Queda "prueba" de consentimiento del tercero (IP/UA del atacante) y
  la empresa le envía marketing: incumple la Ley 29733 (consentimiento libre, informado e inequívoco del
  titular) y sirve para spam/acoso. Además la reserva se asocia al `customer` existente de ese correo.
- **Corrección:** doble opt-in: guardar el consentimiento como `pending` y activarlo con un enlace firmado
  enviado al correo (o activarlo solo cuando se confirma el pago de esa reserva); no vincular reservas a un
  cliente existente sin verificar el correo.

### H-06 (Media) PII de reclamos en `audit_log` append-only

- **Dónde:** `apps/api/prisma/migrations/20261007000200_db_constraints/migration.sql:419-429` (`audit_redact`)
  y `:469-470` (trigger en `complaints`, `customers`, `travelers`...). No se redactan
  `guardian_address`, `guardian_email`, `ip`, `good_description`, `response_text`, `settlement_offer_text`,
  `settlement_acceptance_evidence`, ni en `bookings` `cancellation_reason` e `internal_notes`.
- **Explotación:** la dirección y el correo del apoderado de un menor quedan copiados en `audit_log`, que es
  append-only: una solicitud ARCO de cancelación o anonimización no puede borrarlos, y cualquiera con
  `audit:read` los ve en `GET /admin/audit`.
- **Corrección:** cambiar a una **allowlist** de columnas auditables por tabla (en vez de una denylist);
  como mínimo agregar `guardian_address`, `guardian_email`, `ip`, `user_agent`, `response_text`, `settlement_*`,
  `good_description`, `internal_notes`, `cancellation_reason`, `subject_name`, `subject_email`; migración que
  limpie las filas ya escritas.

### H-07 (Media) IP del visitante falsificable a través del BFF

- **Dónde:** `apps/web/src/lib/api/client.ts:73-91` (toma el primer valor de `X-Forwarded-For` entrante y lo
  reenvía); `apps/api/src/app.setup.ts:74` + `config/environment.ts:69-70` (`TRUST_PROXY=loopback`: la API
  confía en el XFF que manda Next).
- **Explotación:** si el proxy de entrada **anexa** en vez de sobrescribir (comportamiento por defecto de
  nginx con `$proxy_add_x_forwarded_for`), el atacante envía `X-Forwarded-For: <ip aleatoria>` en cada
  petición y obtiene un cubo de rate limit nuevo: spam ilimitado de hojas de reclamación, checkouts que
  retienen cupo (agotamiento de inventario) y pagos.
- **Corrección:** en el BFF usar la IP que fija la plataforma (último salto confiable, p. ej. `x-real-ip`
  del proxy propio o la cabecera de la CDN) y no el primer valor; documentar y probar que el proxy
  sobrescribe; en la API, `TRUST_PROXY` con la IP/subred exacta del BFF.

### H-08 (Media) Rate limiting en memoria

- **Dónde:** `apps/api/src/shared/interface/throttling.ts:11` (comentario) y `app.module.ts:23-26` (sin storage).
- **Explotación:** con 2+ réplicas o reinicios, cada instancia tiene su contador: los límites se multiplican.
- **Corrección:** `ThrottlerStorageRedisService`; validar en producción que exista `REDIS_URL` si hay réplicas.

### H-09 (Media) Pagos manuales sin doble control

- **Dónde:** `apps/api/src/modules/identity/domain/permissions.ts:56-64` (`agent` tiene `payments:record`);
  `apps/api/src/modules/backoffice/application/bookings-admin.service.ts:240-304`.
- **Explotación:** un asesor registra un pago "efectivo" con una referencia inventada: la reserva pasa a
  `paid`, se envía el voucher y se consume cupo sin dinero real. Queda auditado, pero nadie lo revisa antes.
- **Corrección:** que los pagos manuales del `agent` queden `pending_verification` hasta que un `operator`/
  `admin` (distinto del que registró) los apruebe, o quitar el permiso al `agent`; reporte diario de pagos
  manuales; límite de monto.

### H-10 (Media) Cobro simulado decidido por el cliente

- **Dónde:** `apps/web/src/app/es/(site)/reserva/[codigo]/actions.ts:14` y `lib/checkout/checkout-service.ts:254-262`
  (`simulate: "approved"`); `apps/api/src/modules/payments/infrastructure/sandbox-payment-gateway.ts:78-87`.
- **Explotación:** en cualquier entorno público con sandbox (demo/staging) cualquiera confirma su reserva
  sin pagar: se emite voucher y correo, y se consume cupo real si la base es compartida.
- **Producción:** la API ya rechaza `PAYMENT_GATEWAY=sandbox` con `NODE_ENV=production`
  (`config/environment.ts:372`), así que hoy **no hay pasarela utilizable en producción**. Al integrar la
  real: confirmar siempre con consulta servidor a servidor y validar `state.amount` y la moneda contra el
  pago (hoy `confirmPayment`, `payment.use-cases.ts:127-136`, ignora `state.amount`), y exigir que el
  webhook traiga monto y moneda (hoy, si faltan, se omite la comparación: `:212`).
- **Corrección:** proteger los entornos públicos con sandbox (basic auth o allowlist de IP).

### H-11 (Baja) Swagger expuesto por defecto

- **Dónde:** `apps/api/src/config/environment.ts:97-99` (`SWAGGER_ENABLED = true`) sin regla en `:369-382`;
  `app.setup.ts:112-114`.
- **Explotación:** el mapa completo de la API (endpoints `admin/*` y códigos de error) queda publicado.
- **Corrección:** en producción, error de validación si `SWAGGER_ENABLED=true`.

### H-12 (Baja) Operaciones con TOTP o contraseña que ignoran el bloqueo

- **Dónde:** `staff-auth.use-cases.ts:416-439` (`regenerateRecoveryCodes`) y `:442-449` (`changePassword`)
  no llaman a `lockRemainingSeconds`.
- **Explotación:** con un access token robado (10 min) se puede probar TOTP o la contraseña actual a 10/min
  por IP sin que el bloqueo lo detenga. Si acierta el TOTP, obtiene códigos de recuperación (persistencia).
- **Corrección:** comprobar el bloqueo al inicio; al fallar varias veces, revocar la sesión.

### H-13 (Baja) Enumeración y DoS por bloqueo

- **Dónde:** `staff-auth.use-cases.ts:178-181` (solo un correo existente produce `429 account-locked`).
- **Explotación:** 5 intentos por correo revelan si es del staff; el mismo método bloquea a todos los
  admins hasta 1 h.
- **Corrección:** respuesta igual para correos inexistentes (contador "fantasma") y bloqueo por par
  cuenta+IP con reto anti-bot antes de bloquear la cuenta.

### H-14 (Baja) Contraseña temporal sin cambio obligatorio

- **Dónde:** `staff-users.use-cases.ts:363-410,473-482`.
- **Explotación:** la contraseña que el admin vio y transmitió sigue valiendo indefinidamente.
- **Corrección:** marca `mustChangePassword` y forzar el cambio en el primer ingreso (antes de emitir sesión).

### H-15 (Baja) PII sin auditoría de lectura y en query strings

- **Dónde:** `backoffice.controllers.ts:358-365` (detalle de reserva con correo y viajeros, sin `actor`
  ni registro); `:353` (`?email=`) y `:620-627` (`consents?email=`); `privacy-admin.service.ts:59-72`.
- **Explotación:** consultas masivas de datos de clientes por un usuario interno no dejan rastro; los
  correos quedan en los logs de acceso del proxy (contra "logs sin PII").
- **Corrección:** auditar `BOOKING_PII_VIEWED` como ya se hace en reclamos; pasar el correo por `POST`
  o por su HMAC.

### H-16 (Baja) `returnUrl` sin allowlist

- **Dónde:** `payments.controller.ts:38-42`. **Corrección:** aceptar solo rutas bajo `PUBLIC_WEB_BASE_URL`.

### H-17 (Baja) Vinculación de reclamos a reservas ajenas

- **Dónde:** `complaint.use-cases.ts:109`. **Explotación:** se adjuntan hojas falsas a cualquier
  `PWT-AAAA-NNNNNN` (códigos secuenciales), lo que ensucia el expediente de la reserva en el backoffice.
  **Corrección:** marcar el vínculo como "declarado por el consumidor, sin verificar".

### H-18 (Baja) Voucher offline sin caducidad

- **Dónde:** `apps/web/public/sw-voucher.js:48-69`. **Explotación:** en un equipo compartido la copia con
  nombres de viajeros queda servible sin conexión indefinidamente. **Corrección:** caducidad (fin del viaje
  + N días) y borrado al detectar 404.

### H-19 (Info)

- `shared/infrastructure/aes-gcm-pii-cipher.ts:28-33`: sin AAD, un cifrado se puede copiar a otra fila o
  columna; usar `tabla:columna:id` como AAD en la próxima versión del formato.
- `identity/interface/staff-auth.guard.ts:47`: `getAllAndOverride` permite que un `@StaffAuth()` vacío en
  un método anule los permisos de la clase. Hoy ningún controlador lo hace; usar `getAllAndMerge` o una
  regla de lint.
- `app.setup.ts:87-96`: CORS con `credentials: true` y peticiones sin `Origin` permitidas. Sin riesgo
  hoy (auth por Bearer y no por cookies), pero no se deben agregar cookies de sesión a la API.
- `apps/web/src/lib/env.ts:19-22`: `API_BASE_URL` admite http; exigir https o red privada en producción.

## Lo que está bien hecho

- Argon2id con parámetros OWASP y rehash; hash ficticio para igualar tiempos con correos inexistentes.
- MFA TOTP obligatorio para todo el staff, anti-replay (`afterTimeStep`), códigos de recuperación de uso
  único con hash; secreto TOTP cifrado.
- Access JWT corto con `iss`/`aud`/`typ`, solo HS256; cada petición revalida la sesión y el rol en la base.
  Refresh opaco con hash, rotación bajo `FOR UPDATE`, detección de reutilización que revoca la familia,
  caducidad por inactividad y absoluta; cierre de sesión global y por sesión con anti-IDOR.
- RBAC por permisos en **todos** los endpoints `admin/*`; los 403 quedan auditados; no se puede quitar el
  último admin ni modificar el propio acceso.
- Tokens de reserva y reclamo de 256 bits guardados como SHA-256, comparación en tiempo constante,
  404 genérico; solo en cookies httpOnly del BFF con path acotado.
- Idempotencia con huella del cuerpo en checkout, pagos, reclamos y pagos manuales.
- Webhook HMAC sobre cuerpo crudo, tolerancia de tiempo, `timingSafeEqual`, deduplicación por evento,
  verificación de monto.
- `ValidationPipe` con `whitelist` + `forbidNonWhitelisted` (sin mass assignment); los servicios mapean
  campos explícitamente.
- Helmet en la API con CSP `default-src 'none'`, `frame-ancestors 'none'` y HSTS por defecto; límite de cuerpo.
- AES-256-GCM con subclaves HKDF y HMAC separado para búsquedas; validación de entorno que exige claves en
  producción; `.env` ignorado y nunca versionado.
- Enlaces de baja HMAC sin PII en claro; baja idempotente y sin cuenta.
- `audit_log` append-only con contexto del actor por `set_config`; vista de reclamos con PII auditada.

## Checklist de endurecimiento para producción

- [ ] H-01: bloqueo o versión en reservas y pagos; un pago activo por reserva; conciliación.
- [ ] H-02: CSP con nonce, HSTS con preload, `frame-ancestors 'none'`, nosniff, Referrer y Permissions-Policy en la web.
- [ ] H-03/H-04: contador de fallos atómico y updates parciales con versión en `users`.
- [ ] H-05: doble opt-in del marketing.
- [ ] H-06: allowlist en `audit_redact` y limpieza de filas existentes.
- [ ] H-07/H-08: IP confiable de extremo a extremo y throttler en Redis; `TRUST_PROXY` con IP exacta.
- [ ] H-11: `SWAGGER_ENABLED=false` forzado en producción.
- [ ] Pasarela real: confirmación servidor a servidor con validación de monto y moneda; secreto de
      webhook en el gestor de secretos; allowlist de IPs del proveedor si la ofrece.
- [ ] Secretos (`JWT_ACCESS_SECRET`, `PII_ENCRYPTION_KEY`, `MARKETING_LINK_SECRET`, SMTP) en un gestor de
      secretos con rotación documentada (el byte de versión del cifrado lo permite).
- [ ] TLS hasta la base (`sslmode=require`) y cifrado del disco y los backups.
- [ ] CI: `pnpm audit`/Dependabot, CodeQL o Semgrep, gitleaks y OWASP ZAP baseline contra staging.
- [ ] Reto anti-bot (Turnstile o hCaptcha) en checkout, Libro de Reclamaciones y login del staff ante señales de abuso.
- [ ] Logs sin PII: revisar los access logs del proxy (query strings) y los logs de Nest.
- [ ] Procedimiento de incidentes y de atención de solicitudes ARCO probado (Ley 29733).
- [ ] Revisar `apps/admin/` (no versionado, fuera de esta revisión) antes de exponerlo: cookies,
      almacenamiento del refresh token, CSP y CSRF.

Relacionado: [[concepts/modelo-de-datos]], [[negocio/reglas-reserva-y-pago]].
