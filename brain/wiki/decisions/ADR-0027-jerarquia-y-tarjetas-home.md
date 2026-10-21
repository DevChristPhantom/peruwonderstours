# ADR-0027 — Jerarquía comercial y tarjetas legibles

Fecha: 2026-10-19

## Decisión

Tras el buscador se presentan primero tours recomendados y luego destinos. La galería, motivos, diario y recursos mantienen su lugar posterior. Se preservan banner, marca, fotografías y datos.

- Encabezados de tours y destinos incorporan orientación breve en ES/EN/PT.
- La pestaña inicial se llama Recomendados, pues contiene una selección y no todo el catálogo.
- Tabs permite wrap opcional para que los filtros de portada sean visibles en móvil. Conserva teclado, roles y paneles.
- Tarjetas del catálogo: ubicación separada encima del título, duración y viajeros agrupados, precio y comparación con flex-wrap, CTA visual Ver itinerario y fechas. El enlace extendido del título cubre el CTA; no se añaden enlaces anidados ni se interfiere con controles z-index 2.
- Motivos de viaje con recuadros y medallones de iconos. Colores y tipografía existentes.
- Sin librerías, imágenes, consultas o listeners adicionales.

## Evidencia

- Generación de mensajes: 1128 claves por idioma.
- TypeScript y ESLint de componentes modificados: aprobados.
- HTTP local /es, /en y /pt: 200, orden tours antes de destinos y CTA nuevo presentes, sin MISSING_MESSAGE.
- Prueba existente public.spec.ts actualizada para el orden y nombre de pestaña. No ejecutada en navegador en esta entrega.
- Revisión independiente de fuente aprobada sin bloqueantes. Verificación visual responsive y tiempos de interacción pendientes; HTTP de servidor de desarrollo no equivale a velocidad percibida.

## Guía de diseño

Se consultó UI/UX Pro Max. Su recomendación automática de Aurora UI y tipografía tailandesa no encaja con la marca y se descartó. Se conserva MASTER.md del proyecto; se aplican la jerarquía consistente, acciones legibles y accesibilidad de controles.
