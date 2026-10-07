---
type: concept
title: ADR-0001 Stack tecnológico
status: provisional
created: 2026-10-07
updated: 2026-10-07
tags:
  - adr
  - arquitectura
---

# ADR-0001 — Stack tecnológico

**Estado:** propuesto (pendiente de validación del cliente sobre hosting y pagos).

## Contexto
Plataforma tipo OTA para turismo nacional en Perú: alto tráfico estacional, reservas con
cupos limitados, pagos locales, SEO crítico, efectos visuales premium, equipo con skills
TypeScript.

## Decisión
- Monorepo pnpm + Turborepo, TypeScript estricto end-to-end.
- Frontend: Next.js (App Router) + Tailwind + GSAP/ScrollTrigger + anime.js + Lenis.
- Backend: NestJS como monolito modular hexagonal (módulos extraíbles a servicios).
- Datos: PostgreSQL 16 (Prisma), Redis (holds de cupo, carrito, rate limit, colas BullMQ).
- Pagos: puerto `PaymentGateway` con adaptadores Izipay / Niubiz / Mercado Pago / Culqi.
- Metodología: Scrum + NTP-ISO/IEC 29110.

## Alternativas consideradas
- Laravel + MySQL (muy común en agencias peruanas): descartado por menor coherencia de tipos
  front/back y peor encaje con SSR/ISR para SEO.
- WordPress + WooCommerce: rápido de lanzar, pero limitado para cupos, sagas de pago y escalado.
- Microservicios desde el día 1: sobrecosto operativo; se prefiere monolito modular.

## Consecuencias
- Requiere Node.js 22 LTS y pnpm en la máquina de desarrollo.
- Hosting con soporte Node (Vercel/Railway/Render/AWS).
