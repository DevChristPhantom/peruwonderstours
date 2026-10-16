# Peru Wonders Tours — peruwonderstours.com

Plataforma de turismo con web bilingüe (español/inglés), API y panel administrativo.
El dominio confirmado por el cliente es **peruwonderstours.com**. Hosting y pasarela
de pago están pendientes de contratación. Este repositorio todavía no acredita una
entrega pública lista para cobrar.

## Estructura y contexto

| Carpeta | Aplicación / propósito |
| --- | --- |
| `apps/web` | Next.js, web pública y BFF; desarrollo en puerto 3000 |
| `apps/api` | NestJS, catálogo, reservas, pagos y backoffice; puerto 3001 |
| `apps/admin` | Next.js, panel del equipo; puerto 3002 |
| `data/seed` | Contenido importado y traducciones pendientes de aprobación |
| `docs/cliente` | Solicitud de información y pendientes del cliente |
| `docs/legal` | Borradores legales; revisar antes de publicar |
| `brain/wiki` | Decisiones, auditorías, backlog y continuidad |

Antes de modificar el proyecto, leer `CLAUDE.md`, `brain/wiki/hot.md` y
`brain/wiki/index.md`. Conservar sus agentes, decisiones y recursos de diseño.

## Preparación local

Requiere Node.js >=22 y **pnpm 10.34.6**, declarado en `package.json`.
Desde la raíz del repositorio:

```powershell
pnpm install --frozen-lockfile
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/admin/.env.example apps/admin/.env.local
```

Copiar solo si esos archivos todavía no existen; preservar cualquier configuración
local previa. Los archivos `.env` y `.env.local` no deben versionarse ni compartirse.

En `apps/api/.env`, configurar `SANDBOX_WEBHOOK_SECRET` con al menos 16 caracteres
aleatorios incluso para desarrollo. Reemplazar el marcador público del ejemplo.
En `apps/admin/.env.local`, generar `ADMIN_SESSION_SECRET` de al menos 32 caracteres.
Los comandos siguientes imprimen valores nuevos: guardarlos únicamente en los
archivos locales correspondientes, nunca en documentación o commits.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Vista previa sin la base de datos original

La API soporta catálogo en memoria desde `data/seed`:

Si falta el cliente Prisma generado, ejecutar `pnpm --filter @pwt/api prisma:generate`
antes de arrancar. `prisma.config.ts` requiere una `DATABASE_URL` sintácticamente
válida incluso para generar; esa generación no conecta ni migra la base. Utilizar
la URL de la base local prevista, sin copiar credenciales del entorno original.

- API: `NODE_ENV=development`, `DATA_SOURCE=seed`, `DEMO_PRICING=false`.
- Web: `CATALOG_SOURCE=api`, `API_BASE_URL=http://localhost:3001/api/v1`.
- Ejecutar cada aplicación en una terminal independiente desde la raíz:

```powershell
pnpm --filter @pwt/api dev
pnpm --filter @pwt/web dev
```

Abrir `http://localhost:3000/es` o `http://localhost:3000/en`.
La API expone `http://localhost:3001/api/v1/health` y Swagger en
`http://localhost:3001/api/docs` durante desarrollo.

Para revisar solamente el catálogo sin API, usar `CATALOG_SOURCE=seed` en la web.
Carrito, reservas, contacto y demás operaciones con backend requieren API; el
fallback del catálogo no prueba que esas operaciones funcionen.

Si se necesita probar checkout local, `DEMO_PRICING=true` en la API genera tarifas
y salidas **ficticias**, solo con `DATA_SOURCE=seed` o `memory`. Las reservas en
memoria no son persistentes. No presentar esos precios como tarifas comerciales.
El backoffice completo, sus usuarios y la continuidad de las reservas deben
verificarse con PostgreSQL.

## Desarrollo con PostgreSQL

Crear una base local nueva en PostgreSQL 16 o restaurar una copia autorizada. No se
incluye la base original ni sus credenciales en Git. Configurar `DATABASE_URL` en
`apps/api/.env` y `DATA_SOURCE=prisma`. Antes de migrar una base existente, hacer
respaldo y revisar el destino; estos comandos modifican su esquema y datos:

```powershell
pnpm --filter @pwt/api prisma:generate
pnpm --filter @pwt/api prisma:migrate
pnpm --filter @pwt/api build
pnpm --filter @pwt/api db:seed
pnpm --filter @pwt/api dev:prisma
```

El seed normal importa tours como borradores; `-- --publish` publica el catálogo y
`-- --refresh` reemplaza textos. Aplicar estas opciones solo tras revisar el
contenido. `-- --demo-pricing` introduce tarifas ficticias y no se usa en producción.
Las migraciones nuevas requieren revisión por el drift conocido de índices SQL
(ver `brain/wiki/hot.md`); no regenerar ni resetear el esquema existente a ciegas.

Para crear el primer administrador en la base local:

```powershell
pnpm --filter @pwt/api admin:create -- --email administrador@ejemplo.com --name "Administrador"
pnpm --filter @pwt/admin dev
```

Usar un correo del responsable real, introducir la contraseña por stdin y enrolar
MFA al iniciar sesión. No se entregan usuarios de prueba como accesos de producción.

## Validación

Comandos disponibles desde la raíz; sus resultados deben registrarse en la entrega:

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter @pwt/api test
pnpm --filter @pwt/api test:e2e
pnpm --filter @pwt/admin test
pnpm --filter @pwt/web messages:check
```

**Integración modifica bases de datos.** `pnpm --filter @pwt/api test:integration`
recrea y migra `pwt_test` en el servidor indicado por `DATABASE_URL`, mediante
`DROP DATABASE ... WITH (FORCE)`. Si existe `TEST_DATABASE_URL`, recrea la base
indicada por esa variable (su nombre debe contener `test`). Otras pruebas de la
misma suite usan `DATABASE_URL` con transacciones revertidas. Ejecutar solamente
contra un servidor local/de pruebas aislado, con destinos revisados y credenciales
adecuadas; nunca contra bases con datos que se necesiten conservar.

Los comandos de esta guía fueron cotejados con los scripts y validadores del
repositorio. La guía por sí sola no certifica que hayan pasado pruebas o builds.

## Pendientes de publicación y cobro

1. Contratar hosting compatible con Next.js en servidor, NestJS y PostgreSQL;
   configurar DNS y HTTPS para `peruwonderstours.com`. Los subdominios de API/admin
   todavía no están acordados. Mantener el panel protegido.
2. Contratar la pasarela e implementar/probar su adaptador, webhook y conciliación.
   **La API actual solo acepta `PAYMENT_GATEWAY=sandbox` y rechaza sandbox con
   `NODE_ENV=production`: su arranque en producción está bloqueado hasta resolver
   esta integración.** Cambiar `NEXT_PUBLIC_PAYMENTS_MODE=live` no la implementa.
   No quitar la validación para aparentar pagos reales.
3. Configurar correo transaccional real (`MAIL_TRANSPORT=smtp`) y validar remitente,
   entrega y enlaces. `file` guarda `.eml` localmente: no envía mensajes a clientes.
4. Confirmar razón social, RUC, dirección, registro de agencia, contacto, tarifas,
   cupos, condiciones y traducciones con el cliente; revisar borradores legales.
5. Configurar secretos únicos: `PII_ENCRYPTION_KEY` (32 bytes en base64),
   `JWT_ACCESS_SECRET`, `MARKETING_LINK_SECRET` y `ADMIN_SESSION_SECRET`. Conservar
   de forma segura la clave de cifrado para poder leer datos y restaurar respaldos.
6. Configurar `PUBLIC_WEB_BASE_URL=https://peruwonderstours.com`, URL HTTPS de API
   en ambos BFF, `WEB_ORIGIN`, URLs HTTPS de medios y proxies según el hosting.
   Desactivar Swagger en producción y conservar `API_ALLOW_HTTP=false` en la web.
7. Persistir y respaldar PostgreSQL y `apps/api/uploads`: esos archivos no están
   incluidos en Git. El almacenamiento de medios implementado es local; S3/R2
   requiere un adaptador. Reimportar/verificar imágenes ausentes antes de entrega.
8. Revisar la auditoría de seguridad y los pendientes de Redis, ejecutar pruebas
   de reserva/pago/correo/reclamos/administración y QA visual móvil/español/inglés.

La publicación externa requiere la confirmación explícita indicada en `CLAUDE.md`.
