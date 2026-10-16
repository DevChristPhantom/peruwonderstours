---
type: decision
title: Idiomas con banderas y nombres
status: accepted
created: 2026-10-14
updated: 2026-10-14
---

# ADR-0012 — Selector de idioma visual

El cliente solicita banderas en lugar de abreviaturas ES/EN. Se usan SVG locales decorativos de Perú para español y Reino Unido para inglés, acompañados de los nombres de idioma. Se incluyen en el botón desktop y los enlaces del menú desktop/móvil. En anchos desktop ajustados se oculta el texto del botón para conservar espacio; aria-label mantiene el nombre.

No cambian rutas traducidas, parámetros de búsqueda, lang/hreflang, aria-current, controles ni teclado. Los SVG no añaden solicitudes de red y no dependen de emojis de Windows. Enlaces desktop con altura mínima 44px. Lint sin errores (warning previo en window.location.assign) y tipos aprobados localmente; no acredita revisión visual desktop.
