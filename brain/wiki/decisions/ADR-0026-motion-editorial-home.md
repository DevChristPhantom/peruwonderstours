# ADR-0026 — Motion editorial después del banner

Fecha: 2026-10-19

## Decisión

Adaptar patrones observados en el HTML/configuración pública de andeanperuvian.com: entradas direccionales, acercamiento fotográfico y paneles de tarjetas. Implementación propia con contenido existente. No se modificó el banner ni se importaron dependencias o recursos del sitio de referencia.

- Galería: entrada individual por tarjeta, acercamiento de imagen, panel con degradado y flecha diagonal.
- Diario: entradas izquierda/arriba/derecha y panel con profundidad.
- Tours destacados: elevación breve con hover/foco, conservando botones de favoritos/comparación.
- Fotografía de motivos de viaje: entrada vertical.
- Se reutiliza GSAP diferido y su contexto con limpieza. Mediciones agrupadas antes de escribir estilos. Elementos ya visibles al cargar el motor no se ocultan.
- Movimiento reducido conserva contenido estático; táctil usa entradas verticales breves y no depende del hover para leer acciones. Sin nuevo carrusel automático: se conservan los existentes.

## Verificación

- TypeScript `tsc --noEmit`: aprobado.
- ESLint de los componentes modificados: aprobado.
- GET localhost:3000/es: HTTP 200, 11 marcadores de escenas y galería presentes.
- Tres hojas CSS enlazadas: HTTP 200; estilos nuevos presentes en el recurso servido.
- Revisión independiente de código realizada; no se ejecutó navegador local. No acredita rendimiento visual, FPS ni Web Vitals.

## Alcance

Cambios locales sobre el árbol compartido que ya contiene trabajo pendiente. No se publicó producción ni se sustituyó contenido, precios o enlaces.
