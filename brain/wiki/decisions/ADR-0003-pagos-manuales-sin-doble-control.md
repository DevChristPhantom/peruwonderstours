---
type: concept
title: ADR-0003 Pagos manuales sin doble aprobación
status: active
created: 2026-10-09
updated: 2026-10-09
tags:
  - adr
  - backoffice
  - seguridad
---

# ADR-0003 — Pagos manuales sin doble aprobación

**Estado:** aceptado por Christian (2026-10-09). Criterio: "lo más fácil de usar tanto para el
usuario como para el admin".

## Contexto
La revisión de seguridad ([[concepts/revision-seguridad-sprint2]], hallazgo H-09) señaló que
el rol `agent` puede registrar pagos en efectivo o por transferencia
(`POST /admin/bookings/:code/payments`) sin que un admin los apruebe.

## Decisión
Se mantiene **sin doble aprobación**: el pago manual se aplica al instante y la reserva cambia de
estado en el acto. El control es posterior y no frena la operación:
- Cada pago manual guarda `recordedBy`, referencia única y hora, y queda en `audit_log`.
- La API rechaza un número de operación repetido (`payment-reference-taken`) y los sobrepagos.
- Un cobro en línea en curso bloquea el pago manual (`payment-in-progress`).
- **Pendiente (próximo sprint):** sección "Pagos manuales de hoy" en el tablero, por usuario,
  con enlace a cada reserva, para revisarla al cierre del día; y posibilidad de que un admin
  anule un pago manual con motivo (con reembolso o contra-asiento auditado).

## Consecuencias
- Riesgo aceptado: un agente podría marcar como pagada una reserva sin haber recibido el dinero.
  Se mitiga con la trazabilidad y la revisión diaria.
- Si el cliente contrata más agentes o detecta abusos, se puede activar una aprobación para
  montos mayores a un umbral sin rediseñar (el permiso `payments:record` ya está separado).
