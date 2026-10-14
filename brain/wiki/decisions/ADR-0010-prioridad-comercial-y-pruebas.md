---
type: decision
title: Prioridad comercial y pruebas funcionales en navegador
status: accepted
created: 2026-10-14
updated: 2026-10-14
---

# ADR-0010 — Venta primero y pruebas aisladas

El cliente señala que recursos oficiales/Libro estaban antes del catálogo. Corregir orden: hero, buscador, destinos, tours destacados, ventajas, testimonios, CTA, recursos/aviso y footer. El Libro conserva accesos permanentes en footer y home. La franja informativa no debe desplazar el producto.

El cliente solicita probar controles/tiempos en usuario y admin. Añadir Playwright Chromium en CI con PostgreSQL efímero, migraciones, catálogo/tarifas ficticias, banners y staff MFA propios. Nunca ejecutar fixtures contra bases desktop o producción. Mail memory y pagos sandbox; no enviar comunicaciones reales. Capturas, trazas y métricas de acción/nav como artefactos.

No equiparar respuesta HTTP con FPS/Web Vitals ni afirmar todos los botones sin inventario y evidencia. La suite cubre flujos representativos y tendrá fallos corregidos/pendientes documentados. El navegador de CI usa servidores aislados; no accede al navegador ni datos protegidos del escritorio del cliente.
