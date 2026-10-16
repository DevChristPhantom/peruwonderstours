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
- Workflow de calidad ejecutado en GitHub: instalación congelada, lint/tipos/pruebas/build y recorrido HTTP local.
- El listado de tours se renderiza por petición con `connection()` y conserva la caché de datos. Se eliminó el fallback que duplicaba las mismas tarjetas asíncronas; antes bloqueaba el prerender y la respuesta HTTP. Requiere runtime Next, no exportación estática.
- Se agregó Turborepo a las dependencias de desarrollo: los scripts raíz lo utilizaban sin declararlo.

## Evidencia inicial del 13 de octubre

- API: 219 unitarias y 32 e2e aprobadas; tipos y compilación aprobados.
- Admin: 12 pruebas aprobadas; tipos y lint aprobados.
- Web: 3 pruebas de slugs aprobadas; diccionarios es/en con paridad; tipos sin caché incremental aprobados.
- Lint web: sin errores; un warning previo del selector de idioma.
- GitHub Actions: API, web y admin compilados; lint, tipos, 266 pruebas y 150 rutas públicas/legacy aprobados en el commit `a7ec153f432b5aacb648981245389c88c2c65f9d` (run `38441950356`). El recorrido usa catálogo seed; no acredita reservas ni pagos contra datos reales.
- Next build local: errores EPERM al escribir carpetas generadas en este entorno Windows; la compilación se acreditó en Linux mediante GitHub.
- Vista en navegador: no verificada; el navegador no alcanzó el servidor local del entorno.
- Integración con PostgreSQL: no ejecutada. No se modificó ni restauró la base original.

## Ampliación del 14 de octubre

Se ejecutó integración funcional en Chromium CI con PostgreSQL efímero, migraciones, catálogo, reservas y personal ficticio con MFA. La base original no se modificó. La cobertura y el resultado vigente están en docs/qa/funcional-2026-10-14.md y [[decisions/ADR-0010-prioridad-comercial-y-pruebas]]. Esta evidencia supera las limitaciones de la revisión inicial, pero no acredita SMTP, pasarela ni rendimiento del hosting real.

## Antes de publicar

1. Revisar el resultado de la suite Chromium CI, incluido móvil y movimiento reducido, y realizar aceptación visual final del cliente sobre el contenido aprobado.
2. Configurar PostgreSQL, restaurar/importar medios y validar admin con sesión/MFA y datos reales.
3. Integrar pasarela contratada: production no permite el único proveedor actual sandbox.
4. Configurar SMTP real y confirmar entrega de enlaces, vouchers, contactos y reclamos.
5. Sustituir RUC de ejemplo, completar identidad legal/registro/dirección y aprobar textos y tarifas.
6. Configurar hosting/TLS/dominio y obtener la confirmación de publicación prevista en CLAUDE.md.
