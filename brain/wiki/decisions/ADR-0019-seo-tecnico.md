# ADR-0019 — SEO técnico antes del lanzamiento

Fecha: 2026-10-15.

Metadatos de Open Graph/Twitter completos, fallback de imagen real y max-image-preview large para páginas públicas. JSON-LD de agencia con identidad y contactos confirmados; no se declara InStock por tener precio. Se mantiene noindex en páginas personales y se permite su rastreo para leer la directiva; robots.txt solo excluye API. Metadatos y sitemap conservan tres idiomas y dominio canónico.

Revisión independiente hero_banner_backend de robots y revisión root de helpers. Cuatro pruebas SEO, lint acotado y tipos web aprobados. Smoke de CI ampliado: home title/descripción/canonical/hreflang tres idiomas, noindex nueve rutas personales y exclusión de sitemap. Ejecución nueva pendiente al preparar esta nota. Ver docs/seo/preparacion-lanzamiento.md. No se activa Google Analytics, no se publican cambios en hosting y no se garantiza posición en Google.
