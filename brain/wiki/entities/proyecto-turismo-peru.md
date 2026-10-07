---
type: entity
title: Proyecto Plataforma Turismo Perú
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - proyecto
  - turismo
---

# Proyecto Plataforma Turismo Perú

Contrato del usuario (Christian Atamari) para construir el sitio web de una agencia de
turismo nacional en Perú con capacidades de OTA grande.

## Marca y dominio
- Marca: **Peru Wonders Tours** (operador: Jorge Chávez Turismo).
- Dominio: `peruwonderstours.com`, registrado en Namecheap el 2026-10-06 por 1 año
  (vence 2027-10-06), con privacidad WHOIS. DNS aún sin apuntar a hosting.
- Oficina: Puno, Perú → el lago Titicaca y el altiplano son producto ancla, junto con Cusco.

## Alcance acordado
- Catálogo de destinos, tours, paquetes, traslados (y hoteles/trenes según proveedores).
- Buscador con disponibilidad y filtros; carrito; checkout; pasarela de pagos peruana.
- Cuentas de cliente, backoffice de operadores, CMS de contenidos.
- Seguridad (OWASP, PCI DSS SAQ-A), UX/UI premium con efectos (referencias: motionsites.ai,
  manus.im, animejs.com).
- Base de datos PostgreSQL normalizada para reservas/pagos.
- Cumplimiento: Libro de Reclamaciones, Ley 29733, SUNAT, MINCETUR, ESNNA.

## Equipo
Ver `CLAUDE.md` en la raíz y los subagentes de `.claude/agents/`.

## Decisiones
- [[decisions/ADR-0001-stack-tecnologico]]

## Preguntas abiertas para el cliente
- Razón social, RUC, logo e identidad existente (nombre comercial ya definido).
- Proveedor de pagos preferido (Izipay, Niubiz, Mercado Pago, Culqi) y si ya tiene cuenta.
- Proveedor de facturación electrónica (OSE/PSE).
- Hosting/presupuesto mensual y dominio.
- Inventario: ¿productos propios, de operadores locales o integración con proveedores (trenes, hoteles)?
- Idiomas requeridos (es, en, ¿pt?) y monedas (PEN, USD).
