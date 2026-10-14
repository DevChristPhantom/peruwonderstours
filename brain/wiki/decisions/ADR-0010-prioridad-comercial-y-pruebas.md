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

## Evidencia inicial, 14 de octubre

La ejecución de navegador 38598788542 sobre `3eb43db` aprobó 11 recorridos de escritorio, incluido pago sandbox aprobado, contacto, reclamaciones, acceso de cliente y testimonio pendiente de moderación. Registró cero errores JavaScript en esos recorridos. La carga inicial de home tardó 1736 ms; agregar al carrito 91 ms; búsqueda 293 ms; contacto 300 ms. Son muestras únicas de Chromium CI, sin emulación de red/CPU, no garantías de producción ni Web Vitals.

Las pruebas descubrieron un error real en el adaptador de contacto/testimonios: faltaba el consentimiento requerido y se enviaban campos fuera del DTO. Corregido sin debilitar validación, con cuatro pruebas de regresión entre contrato y límites. El menú móvil continúa en diagnóstico: el encabezado medía 1221 px con body de 390 px, colocando el botón fuera de pantalla. El reintento de login del test admin debe reintroducir ambos campos tras el reset de React; no cambió autenticación. Validación posterior aún pendiente.
