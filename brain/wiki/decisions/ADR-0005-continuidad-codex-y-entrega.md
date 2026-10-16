---
type: decision
title: Continuidad en Codex y preparación de entrega
status: accepted
created: 2026-10-13
updated: 2026-10-13
---

# ADR-0005 — Continuidad en Codex y preparación de entrega

El cliente solicita continuar el trabajo de Claude, conservar arquitectura, diseño,
skills y orquestador y entregar esta semana. Dominio confirmado: peruwonderstours.com.

Se conservan CLAUDE.md, el vault y los 12 roles; AGENTS.md adapta su lectura en Codex.
Cada cambio se revisa por otro rol antes de integrar. Las auditorías previas se contrastan
con el código del backup 4ea3485, que ya incluye los commits finales de web y admin del Sprint 3.

Se aplican las skills originales pertinentes y las skills oficiales GSAP React,
ScrollTrigger y Performance. El movimiento permanece una mejora progresiva: limpieza,
scroll nativo con movimiento reducido/puntero táctil y contenido accesible si falla la carga.

Las configuraciones Next usan ESM explícito en next.config.mjs para evitar depender
del transpiler para cargar la configuración. Las fuentes existentes se alojan en
packages/ui/src/fonts con sus licencias, conservando familias y variables CSS.

El RUC de ejemplo solicitado no sustituye el dato fiscal real ni se agrega a JSON-LD.
Hosting y pasarela serán contratados por el cliente; no se publica ni activa pago real
hasta configurarlos y verificar la entrega. Ver [[../concepts/entrega-octubre-2026]].
