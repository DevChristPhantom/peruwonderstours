---
type: decision
title: Avatar del administrador en la barra superior
status: accepted
created: 2026-10-14
updated: 2026-10-14
---

# ADR-0015 — Identidad del personal en la barra

El cliente solicita un icono de usuario junto al nombre y rol del personal. Se añade UserRound decorativo en un avatar circular, nombre destacado y rol discreto, conservando los datos reales de sesión. El enlace lleva a Mi cuenta. En móvil se mantiene el avatar y controles de 44px; textos largos truncan. Salir conserva logoutAction sin cambiar autenticación, permisos ni sesiones.

Cambio acotado al layout del panel. Revisión de fuente, lint focal y typecheck del admin aprobados. No se accedió al navegador desktop ni se modificaron usuarios/datos.


El cliente solicita además su logo dorado en la cabecera lateral: se reemplaza el texto de marca por el PNG original transparente, con Panel de administración debajo; enlace de inicio y nombre accesible conservados.
