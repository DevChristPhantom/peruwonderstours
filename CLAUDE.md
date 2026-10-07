# Plataforma de Turismo Nacional — Perú (OTA)

Sitio web de agencia de viajes y turismo a escala de una OTA grande: catálogo de
destinos/tours/paquetes, buscador con disponibilidad, carrito, checkout, pasarela de
pagos peruana, cuentas de cliente, backoffice de operadores y cumplimiento legal peruano.

## Cerebro del proyecto (claude-obsidian)

- Vault: `brain/` (abrir en Obsidian). Fuente de verdad para decisiones, ADRs, glosario,
  normativa y estado del sprint.
- **Antes de empezar cualquier tarea**: leer `brain/wiki/hot.md` y `brain/wiki/index.md`.
- **Al terminar**: registrar decisiones en `brain/wiki/decisions/ADR-XXXX-*.md` y actualizar
  `brain/wiki/hot.md`. Consultas: `/claude-obsidian:wiki-query`.
- En Windows nativo el vault es solo lectura para el CLI transaccional (requiere WSL);
  mientras tanto se edita como Markdown plano.

## Equipo (subagentes en `.claude/agents/`)

El `tech-lead-orchestrator` dirige; delega en especialistas y revisa todo antes de integrar.
Ningún especialista integra su propio trabajo sin revisión de otro rol.

| Rol | Agente | Skills principales |
|---|---|---|
| Director técnico / Scrum | `tech-lead-orchestrator` | feature-forge, architecture-designer, code-reviewer |
| Product Owner turismo | `product-owner-turismo` | feature-forge, spec-miner |
| Arquitecto de soluciones | `solution-architect` | architecture-designer, microservices-architect, api-designer |
| Backend senior | `backend-senior` | nestjs-expert, typescript-pro, api-designer |
| Frontend senior | `frontend-senior` | nextjs-developer, react-expert, typescript-pro |
| UX/UI senior | `ux-ui-designer-senior` | ui-ux-pro-max, design, design-system |
| DBA senior | `dba-senior` | postgres-pro, database-optimizer, sql-pro |
| Pagos senior | `payments-integration-senior` | secure-code-guardian, api-designer |
| Seguridad senior | `security-engineer-senior` | secure-code-guardian, security-reviewer |
| Cumplimiento Perú | `compliance-peru-analyst` | spec-miner |
| QA automation senior | `qa-automation-senior` | test-master, playwright-expert |
| DevOps / SRE senior | `devops-sre-senior` | devops-engineer, sre-engineer, monitoring-expert, terraform-engineer |

Skills instaladas como plugins: `fullstack-dev-skills:*` (jeffallan), `ui-ux-pro-max:*`,
`claude-obsidian:*`.

## Stack (ver ADR-0001)

- Monorepo `pnpm` + Turborepo: `apps/web` (Next.js App Router, TypeScript strict),
  `apps/api` (NestJS, monolito modular listo para extraer servicios), `apps/admin`,
  `packages/ui`, `packages/config`, `packages/types`.
- PostgreSQL 16 (Prisma ORM + migraciones versionadas), Redis (sesiones, carrito,
  bloqueos de cupo, rate limiting, colas BullMQ).
- Efectos: GSAP + ScrollTrigger, anime.js, Lenis; siempre con `prefers-reduced-motion`.
- Pagos detrás de un puerto `PaymentGateway` (adaptadores: Izipay, Niubiz, Mercado Pago,
  Culqi; Yape/PagoEfectivo vía proveedor). Nunca se almacenan datos de tarjeta (PCI DSS SAQ-A).

## Convenciones de código

- Variables y funciones: `camelCase`. Clases, tipos, componentes React: `PascalCase`.
  Constantes globales: `UPPER_SNAKE_CASE`. Archivos: `kebab-case.ts`; componentes `PascalCase.tsx`.
- Base de datos: tablas y columnas `snake_case` en plural (`bookings`, `created_at`);
  Prisma mapea a `camelCase` con `@map`/`@@map`.
- Endpoints REST: `/api/v1/recurso-en-plural`, kebab-case, JSON en camelCase.
- Código e identificadores en inglés; textos de UI en español (i18n `es-PE` por defecto, `en`).
- Montos en céntimos (`integer`) + `currency` ISO 4217 (`PEN`, `USD`). Nunca `float` para dinero.
- Fechas en UTC (`timestamptz`); se muestran en `America/Lima`.
- Commits: Conventional Commits. Ramas: `feature/`, `fix/`, `chore/` sobre `develop`; `main` = producción.
- ESLint + Prettier + `tsc --noEmit` en CI; cobertura mínima 80 % en dominio.
- SOLID, arquitectura hexagonal por módulo (`domain` / `application` / `infrastructure` / `interface`).

## Metodología

Scrum (sprints de 2 semanas) + prácticas de NTP-ISO/IEC 29110 (perfil básico): backlog,
Definition of Ready/Done, revisiones de código obligatorias, trazabilidad requisito → prueba.

## Normativa peruana obligatoria (ver `brain/wiki/normativa/`)

- Libro de Reclamaciones virtual (Ley 29571 y su reglamento) — visible en la home.
- Protección de datos personales (Ley 29733 y reglamento vigente): consentimiento explícito,
  política de privacidad, derechos ARCO, registro de bancos de datos.
- Comprobantes electrónicos SUNAT (boleta/factura vía OSE/PSE).
- Reglamento de Agencias de Viajes y Turismo (MINCETUR): datos de registro visibles.
- Prevención de ESNNA en turismo; accesibilidad WCAG 2.2 AA.

## Producción

No se despliega a producción ni se publica nada externo sin confirmación explícita del usuario.
