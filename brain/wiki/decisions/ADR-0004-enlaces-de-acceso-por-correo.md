---
type: concept
title: ADR-0004 Enlaces de acceso por correo
status: active
created: 2026-10-09
updated: 2026-10-09
tags:
  - adr
  - seguridad
  - reservas
---

# ADR-0004 — Enlaces de acceso por correo (reservas, reclamos y clientes)

**Estado:** aceptado por el equipo técnico (Sprint 3). Revisable por Christian.

## Contexto
Los correos de reserva enlazaban a `/reserva/CODIGO`, que daba 404 sin el token de acceso
([[concepts/auditoria-funcional-sprint3]]). Poner el token permanente de la reserva en un correo
lo expone en buzones, reenvíos y registros.

## Decisión
- Los correos llevan un **enlace de un solo uso** (`/{locale}/reserva/acceso?token=`) que se
  canjea por un acceso nuevo. En la BD solo se guarda el hash del token (`access_tokens`).
- Vigencia: **72 h** para enlaces dentro de correos transaccionales (`EMAIL_LINK_TTL_HOURS`) y
  **30 min** para los pedidos desde "recuperar acceso". Reusar el enlace responde 410.
- "Recuperar acceso" siempre responde 202 genérico (no revela si el código o el correo existen)
  y está limitado por IP y por reserva.
- Igual esquema para la consulta de reclamos y para "Mis reservas" del cliente (sesión opaca de
  30 días, revocable, sin contraseña).
- Anular un pago manual (ADR-0003) habilita transiciones de estado inversas
  (`paid` → `partially_paid`/`confirmed`) solo desde la acción de anulación auditada.

## Consecuencias
- Un correo reenviado o viejo deja de servir tras 72 h o tras usarse; el cliente pide uno nuevo.
- Los reclamos aún no guardan idioma: sus correos van en español.
