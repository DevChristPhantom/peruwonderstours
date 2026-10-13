---
type: decision
title: UI UX y skills de motion para web y panel
status: accepted
created: 2026-10-13
updated: 2026-10-13
---

# ADR-0007 — UI UX y motion preservando la marca

El cliente adjunta web-design-reviewer, web-design-engineer y su guía de turismo inmersivo; solicita instalarlas y mejorar web/admin. Se instalan versiones completas con referencias desde github/awesome-copilot y ConardLi/garden-skills (tag web-design-engineer-v1.3.0), una adaptación ejecutable de la guía como tourism-motion-designer, UI UX Pro Max 2.13.0 y skills oficiales GSAP React/Performance/ScrollTrigger.

Modo Redesign · Preserve: identidad Titicaca/terracota/piedra, fuentes, fotos, logo, rutas, traducciones, acciones y auth/MFA se conservan. El pedido existente autoriza la evolución del sistema ya acordado; no se introduce una dirección de marca nueva.

Web: botones compartidos con brillo/elevación de 150 ms solo hover fino, enlace de sección con feedback, entradas hero/buscador de 500–600 ms, zoom de destinos sin brightness y checkout sin blur. Foco/disabled/touch/movimiento reducido se mantienen.

Admin: navegación agrupada con permisos intactos, sidebar sticky con scroll, menú móvil acotado al viewport, login/encabezados/secciones/tablas más legibles, targets táctiles de 44 px y microinteracciones de 140 ms. Confirmaciones peligrosas permanecen estáticas.

No se añade Framer Motion para duplicar microinteracciones CSS ni otro scroll engine: el stack GSAP/Lenis existente cubre el movimiento complejo. Las búsquedas UI UX Pro Max se curan: las sugerencias genéricas de Liquid Glass/Aurora y tipografía de turismo tailandés no corresponden a esta marca y se descartan.

Skills validadas con quick_validate; tipos/lint local y revisión independiente aprobados. Servidores web y login admin responden HTTP 200. CI sobre la rama revisa compilación, pruebas y rutas; la aprobación visual multi-viewport no se acredita porque la política del navegador impide la inspección automatizada.

Ver `docs/design/brand-spec.md`, `design-system/peru-wonders-tours/ui-refresh.md` y el manifiesto de skills.
