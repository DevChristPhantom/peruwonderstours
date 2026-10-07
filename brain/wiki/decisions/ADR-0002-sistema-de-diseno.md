---
type: concept
title: ADR-0002 Sistema de diseño Peru Wonders Tours
status: provisional
created: 2026-10-07
updated: 2026-10-07
tags:
  - adr
  - diseno
---

# ADR-0002 — Sistema de diseño

**Estado:** propuesto; la paleta del logo espera elección del cliente.

## Decisión
- Fuente de verdad: `design-system/peru-wonders-tours/MASTER.md` (+ `pages/*.md` por pantalla).
  Tokens en `packages/ui/src/tokens.css`, `theme.css` (Tailwind v4) y `tokens.ts`.
- Paleta peruana: primario azul Titicaca `#153F63`, compra terracota textil `#A34224`,
  éxito verde selva `#1A6140`, dorado inca `#E3A92B` solo decorativo (2.10:1, nunca texto),
  fondos piedra `#F7F5F2` / noche `#0B1013`. Todo texto ≥ 4.5:1 en claro y oscuro.
- Tipografía: Geist (UI, cifras tabulares en precios) + Fraunces (titulares ≥ 28 px).
- Movimiento: easing `cubic-bezier(0.22,1,0.36,1)`, morph 500 ms, reducido a 0.01 ms.
- Hero según [[concepts/alcance-cliente-v1]] y `docs/design/hero-morph-spec.md`.

## Descartado (sugerencias de ui-ux-pro-max)
Noto Sans Thai, celeste+naranja genérico, Aurora UI, storytelling por scroll en la home,
Flip como movimiento base, foco negro, `transition: all`, rebotes en tarjetas, Playfair/Cormorant.

## Logo
Logo actual (andeanperutours.com): ámbar `#F7A924`, marino `#163A70`, verde `#046E3A`.
Propuestas en `design-system/peru-wonders-tours/logo-colores.md`. **Elegida (2026-10-07):
"Titicaca y telar"** — cóndor y nombre `#10304D`, montaña y descriptor `#A34224`; versión
oscura `#F7F5F2` + `#E3A92B`. Aprobada por Christian; pendiente visto bueno final de Jorge.
Falta el archivo fuente del logo nuevo para aplicarla.

## Supuestos de negocio usados en las specs (por confirmar)
Saldo vence 7 días antes del tour; tours con boletos de terceros o que salen en < 7 días al 100 %.
