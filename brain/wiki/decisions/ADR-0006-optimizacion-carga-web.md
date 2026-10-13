---
type: decision
title: Optimización progresiva de carga web
status: accepted
created: 2026-10-13
updated: 2026-10-13
---

# ADR-0006 — Optimización progresiva de carga web

El cliente pide optimizar la web tras probarla localmente. La muestra de desarrollo
observó /es 0,87–1,31 s y /es/tours 9,17 s en la primera petición medida, luego 2,66 s.
No son Web Vitals ni un arranque frío garantizado; no se usan para prometer resultados publicados.

- El drawer se importa al primer uso y se mantiene montado después para conservar cierre y foco.
- Geist Mono (23.128 bytes) conserva su CSS pero deja de precargarse globalmente.
- Movimiento reducido evita importar GSAP para reveals; los cambios de preferencia siguen
  activando/desactivando efectos con cancelación y limpieza de cargas asíncronas.
- El hero usa opacity/transform en vez de animar brightness sobre toda la pantalla.
- Las dos variantes de la imagen inicial de galería comparten sizes; se conservan
  layout, carrusel, miniaturas y visor. No se acredita ahorro de bytes sin medición en navegador.
- El recorrido CI registra cinco muestras HTTP por ruta en servidor compilado y caliente.

Se conservan paneles ocultos de pestañas y diccionarios completos: reducirlos requiere
validar SEO, estado de interacción y todos los namespaces. No se atribuye un porcentaje
universal de mejora ni se modifica caché privada, autenticación o pagos.

Tipos y lint local aprobados (warning previo del selector de idioma); revisión independiente.
La comprobación definitiva de compilación/rutas se ejecuta en el PR; QA visual y Web Vitals
requieren navegador real y condiciones de hosting. Ver [[../concepts/entrega-octubre-2026]].
