# @pwt/admin — Panel de administración (BFF)

Next.js 16 (App Router), puerto 3002. Backoffice del staff de Peru Wonders Tours sobre la API
(`/api/v1/auth/staff/*` y `/api/v1/admin/*`). Español, denso, WCAG 2.2 AA.

```bash
cp .env.example .env.local   # ADMIN_SESSION_SECRET obligatorio (>= 32 caracteres aleatorios)
pnpm --filter @pwt/admin dev # http://localhost:3002 (API en :3001 con DATA_SOURCE=prisma)
pnpm --filter @pwt/admin typecheck && pnpm --filter @pwt/admin lint && pnpm --filter @pwt/admin build
```

## Arquitectura (BFF)

- El navegador **nunca** habla con la API. Server Components leen datos; Server Actions mutan.
- Sesión: `{accessToken, refreshToken, expiraciones, perfil}` en una cookie **cifrada** AES-256-GCM
  (`node:crypto`, clave HKDF de `ADMIN_SESSION_SECRET`, nombre de cookie como AAD), `HttpOnly`,
  `SameSite=Strict`, `Secure` + prefijo `__Host-` en producción. Desafíos de login (MFA, enrolamiento,
  cambio de contraseña inicial) en otra cookie cifrada de 5 min. Código: `src/lib/session/*`.
- Refresh: `src/proxy.ts` refresca cuando al access token le quedan < 2 min y reescribe la cookie en
  la respuesta y en la petición (en render no se pueden escribir cookies). Cola **serializada por
  sesión** en proceso (`src/lib/session/refresh.ts`, `globalThis`) con caché de gracia de 90 s por hash
  del refresh rotado: dos peticiones simultáneas con la cookie vieja no disparan `refresh-token-reused`.
  Con varias réplicas de Next hace falta afinidad de sesión o un store compartido (Redis).
- `refresh-token-reused` / `session-revoked` / refresh vencido → se borra la cookie y se va al login.
  En render, un 401 redirige a `/auth/salir` (Route Handler que sí puede borrar la cookie).
- Cabeceras hacia la API: `Authorization: Bearer`, `X-Request-Id` (generado en Proxy), `User-Agent` y
  `X-Forwarded-For` **solo** con `TRUSTED_PROXY_HOPS >= 1` (entrada N-ésima desde la derecha; el proxy
  de entrada debe sobrescribir/anexar la IP del socket). Con 0 la API ve la IP del servidor de Next.
- CSRF: Next compara `Origin` con `Host` en cada Server Action; además `assertSameOrigin()` (en
  `src/lib/auth/guard.ts`) rechaza `Sec-Fetch-Site` distinto de `same-origin` y orígenes fuera de
  `Host`/`ADMIN_TRUSTED_ORIGINS`.
- Todas las páginas: CSP estricta con nonce (`script-src 'nonce' 'strict-dynamic'`, `style-src 'nonce'`,
  `style-src-attr 'none'`, `frame-ancestors 'none'`), `Cache-Control: no-store`,
  `X-Robots-Tag: noindex`, HSTS (prod), nosniff, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- Permisos: el menú y los botones se ocultan con `user.permissions`; la API decide (403 → aviso claro).
- Formularios: Server Actions con zod (y React Hook Form + zodResolver en los complejos). Pagos y
  reembolsos manuales con `Idempotency-Key` generada al renderizar el formulario (estable ante doble clic
  o reintento; nueva tras un registro exitoso).
- Datos personales fuera de la URL: la búsqueda de reservas por correo guarda el correo en una cookie
  cifrada de 15 min y llama a `POST /admin/bookings/search` (H-15).

## Pantallas

Login → cambio obligatorio de contraseña temporal (H-14) → MFA (TOTP o código de recuperación) o
enrolamiento con QR (codificador propio, `src/lib/qr`) y 10 códigos de recuperación mostrados una vez;
bloqueos con tiempo de espera. Tablero (KPIs, semáforo de reclamos, ocupación, correo, conciliación de
pagos en línea), Reservas (filtros, detalle, pago manual, cancelación con cotización, reembolso,
reenvío de voucher), Tours (edición, traducción `es` con itinerario por días, publicar/despublicar con
`publication.errors`, imágenes por URL, 409 por versión), Precios (temporadas y tarifas, `rate-overlap`
explicado), Salidas (lote, capacidad, cierre de ventas), Libro de Reclamaciones (bandeja con semáforo y
días hábiles, detalle con PII, respuesta, reclasificación, solución directa, transcripción del libro
físico), ARCO (registro, trámite, ampliación, respuesta, historial de consentimientos), Usuarios (solo
admin) y Mi cuenta (sesiones, cerrar todas, contraseña, códigos de recuperación).

## Pendiente / supuestos

- Tipos de respuesta escritos a mano en `src/lib/api/types.ts` (el OpenAPI no describe los cuerpos del
  backoffice). Generar desde el contrato cuando la API los documente.
- Subida de imágenes a S3/R2 (hoy se registran por URL).
- Auditoría (`GET /admin/audit`) sin pantalla todavía.
