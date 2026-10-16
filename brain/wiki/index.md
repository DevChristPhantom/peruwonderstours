---
type: meta
title: Wiki Index
status: evergreen
created: 2026-10-07
updated: 2026-10-13
tags:
  - meta
  - index
---

# Wiki Index

This catalog is updated by completed knowledge operations.

## Concepts

- [[decisions/ADR-0024-imagenes-demo-http]] — imágenes de demo sin conversión fría y transporte local compatible.

- [[decisions/ADR-0023-fotografia-editorial]] — más fotografías del catálogo, galería enlazada y carga diferida.

- [[decisions/ADR-0022-independencia-de-medios]] — contenido y fotos propias, rendimiento y verificación de la demo compilada.

- [[decisions/ADR-0014-portugues-brasil]] — tercer idioma pt-BR, fallback editorial explícito y migraciones aditivas.


- [[decisions/ADR-0010-prioridad-comercial-y-pruebas]] — tours antes de recursos legales, pruebas Chromium aisladas y límites de evidencia.


- [[decisions/ADR-0007-ui-ux-y-skills-motion]] — diseño preservado, mejoras compartidas y skills instaladas.

- [[decisions/ADR-0006-optimizacion-carga-web]] — carga bajo demanda, movimiento reducido y medición HTTP compilada.

- [[concepts/entrega-octubre-2026]] — cambios y evidencia actual para la entrega de peruwonderstours; pendientes externos y validación restante.
- [[decisions/ADR-0005-continuidad-codex-y-entrega]] — conservación de metodología, motion accesible y fuentes locales.
- [[decisions/ADR-0001-stack-tecnologico]] — stack y metodología propuestos.
- [[decisions/ADR-0002-sistema-de-diseno]] — paleta peruana, tipografía, movimiento, logo.
- [[decisions/ADR-0003-pagos-manuales-sin-doble-control]] — pagos manuales al instante, control posterior.
- [[decisions/ADR-0004-enlaces-de-acceso-por-correo]] — enlaces de un solo uso (72 h / 30 min), solo hash en BD.
- [[concepts/alcance-cliente-v1]] — 5 requisitos del cliente (adelanto 50 %, carrito, pagos).
- [[concepts/backlog-mvp]] — épicas E0–E10, historias MoSCoW con Gherkin y 28 preguntas abiertas.
- [[negocio/reglas-reserva-y-pago]] — reglas publicadas (50 %, saldo 7 días, 3,5 % tarjeta, cancelación 20 días hábiles) y propuestas.
- [[concepts/modelo-de-datos]] — esquema PostgreSQL/Prisma del MVP, ERD, máquina de estados reserva/pago, Postgres local sin admin.
- [[concepts/revision-seguridad-sprint2]] — revisión AppSec (ASVS L2, Ley 29733) de auth staff, backoffice, pagos, reclamos, privacidad y BFF: 2 altas, 8 medias, checklist de producción.
- [[concepts/benchmark-ota-2026]] — benchmark GYG/Viator/Klook/Civitatis/Airbnb/Booking/Despegar/Expedia/Tiqets/Headout/Inca Rail/PeruRail; 30 funcionalidades evaluadas, olas A/B/C con HU-B y Gherkin, lo que no se recomienda.
- [[concepts/auditoria-funcional-sprint3]] — auditoría funcional (2026-10-09): crawler 91 URLs (4 políticas en 500), 12 rutas viejas en 404, i18n sin `en` (0 traducciones), enlace de reserva en correos da 404; 67 ítems, 12 bloqueantes, plan por backend/web/admin/contenido.

## Normativa

- [[normativa/libro-de-reclamaciones]] — Libro de Reclamaciones virtual: Anexo I vigente (D.S. 101-2022-PCM), 15 días hábiles improrrogables, Ley 32495, especificación técnica, brechas de `complaints` y Gherkin.
- [[normativa/proteccion-de-datos]] — Ley 29733 y D.S. 016-2024-JUS: consentimientos separados, cláusula informativa, flujo transfronterizo, ARCO (8/20/10 días hábiles), registro de bancos, cookies, brechas de `consents`.
- [[normativa/informacion-al-consumidor]] — precio total, comisión por tarjeta, condiciones antes del pago, identificación del proveedor, D.S. 005-2020-MINCETUR (art. 22), ESNNA, SUNAT y checklist QA.
- Borradores legales (fuera del vault): `docs/legal/` — privacidad, términos, cancelación y reembolso, cookies.

## Entities

- [[entities/proyecto-turismo-peru]] — alcance, equipo y preguntas abiertas.

## Sources

- [[sources/sitio-actual-andeanperutours]] — inventario del sitio a migrar.

## Questions

- No questions indexed yet.



- [[decisions/ADR-0008-banners-html-motion]] — HTML aislado, carrusel reiniciable y administración.

- [[decisions/ADR-0009-recursos-oficiales-y-reclamaciones]] — recursos visuales, WhatsApp y Libro de Reclamaciones.

- [[decisions/ADR-0010-prioridad-comercial-y-pruebas]] — jerarquía comercial y controles probados en CI aislado.
