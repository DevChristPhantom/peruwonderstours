---
type: decision
title: Banners HTML aislados y administrables
status: accepted
created: 2026-10-13
updated: 2026-10-13
---

# ADR-0008 — Banners HTML con motion

El cliente aporta dos HTML autocontenidos y solicita efectos originales, reinicio por cambio de carrusel y carga desde administración. Conservar JS/CSS dentro de iframe sandbox allow-scripts, sin allow-same-origin y CSP sin conexiones, formularios, frames ni workers. Admin nunca ejecuta el documento.

API guarda documentos privados, manifest atómico, permisos de catálogo/medios, revisión optimista y activación explícita. BFF conserva sesión y limita cuerpos. Una única escena activa evita acumulación de RAF/listeners y reinicia entradas al regresar. Pausa/offscreen/pestaña oculta desmontan el documento. Touch/reduced-motion usa poster.

Dos escenas offline extraen imágenes base64 y usan WebP lossless con píxeles verificados idénticos. Gestión local necesita reiniciar API; la instancia vieja devuelve 404. Ver docs/design/hero-html-banners.md para límites y evidencia.
