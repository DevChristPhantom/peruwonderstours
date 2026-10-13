---
type: concept
title: Preparación de entrega de peruwonderstours
status: active
created: 2026-10-13
updated: 2026-10-13
---

# Preparación de entrega

## Confirmado por el cliente

- Web: peruwonderstours.com.
- WhatsApp: +51 924 278 597.
- Correo: jorgechaveztourt@gmail.com (en minúsculas).
- RUC real: pendiente para el día de entrega; ejemplo visual etiquetado por petición.
- Hosting y pasarela: se contratarán el día de entrega.

## Cambios preparados

- Nosotros bilingüe con contenido neutral y destinos reales, sin historia ni credenciales inventadas.
- Sitemap de blog, tipos de tours, contacto y testimonios; se conservan traducciones de slugs publicadas por la API.
- Motion: progreso por transform, zoom solo hover/fine/no-preference, Lenis se destruye al deshabilitar y contadores recuperan el valor final.
- Fechas del panel: se rechazan días imposibles antes de convertir a ISO.
- Fuentes originales locales, configuraciones Next ESM, README y ejemplos de entorno.
- Workflow de calidad preparado: instalación congelada, lint/tipos/pruebas/build; aún no ejecutado en GitHub.

## Evidencia ejecutada

- API: 219 unitarias y 32 e2e aprobadas; tipos y compilación aprobados.
- Admin: 12 pruebas aprobadas; tipos y lint aprobados.
- Web: 3 pruebas de slugs aprobadas; diccionarios es/en con paridad; tipos sin caché incremental aprobados.
- Lint web: sin errores; un warning previo del selector de idioma.
- Next build: no completado; errores EPERM al escribir carpetas generadas en este entorno Windows.
- Vista en navegador: no verificada; el navegador no alcanzó el servidor local del entorno.
- Integración con PostgreSQL: no ejecutada. No se modificó ni restauró la base original.

## Antes de publicar

1. Compilar y revisar en navegador en un entorno sin la limitación local, incluido móvil y movimiento reducido.
2. Configurar PostgreSQL, restaurar/importar medios y validar admin con sesión/MFA y datos reales.
3. Integrar pasarela contratada: production no permite el único proveedor actual sandbox.
4. Configurar SMTP real y confirmar entrega de enlaces, vouchers, contactos y reclamos.
5. Sustituir RUC de ejemplo, completar identidad legal/registro/dirección y aprobar textos y tarifas.
6. Configurar hosting/TLS/dominio y obtener la confirmación de publicación prevista en CLAUDE.md.
