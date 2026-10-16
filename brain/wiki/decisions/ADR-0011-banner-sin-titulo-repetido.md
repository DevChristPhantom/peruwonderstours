---
type: decision
title: Un solo nombre visible por destino en el banner
status: accepted
created: 2026-10-14
updated: 2026-10-14
---

# ADR-0011 — Nombre del banner sin repetición

El cliente identifica duplicidad en el banner principal. HeroMotion repetía el nombre del destino en la barra de controles, además del título de la escena. Se elimina esa etiqueta y su CSS; se mantienen flechas, indicadores, pausa, nombres accesibles de botones y aria-pressed.

Titicaca conserva su título animado. La imagen incorporada de Machu Picchu ya trae texto y tiene titleEmbedded=true, por lo que no añade otro título visible. Para imágenes administradas con texto, el editor debe activar la opción existente de título incorporado; no se infiere ni altera la configuración de sus datos.

Revisión cruzada de fuentes sin nuevos bloqueos; lint del componente y tsc --noEmit aprobados localmente. No se accedió al navegador desktop. La suite anterior de 21 recorridos no acredita esta revisión posterior; las comprobaciones GitHub se ejecutan sobre el nuevo commit.
