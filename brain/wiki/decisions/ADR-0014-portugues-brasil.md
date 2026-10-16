---
type: decision
title: Português brasileiro como tercer idioma
status: accepted
created: 2026-10-14
updated: 2026-10-14
---

# ADR-0014 — Português brasileiro

El cliente solicita portugués. Se integra pt-BR con bandera brasileña y rutas /pt, conservando español e inglés. Diccionarios completos: 1098 claves por idioma, incluyendo 2 nombres nuevos de portugués. Revisión cruzada de traducción e ICU: variables, plurales y etiquetas enriquecidas conservados. Cuatro documentos legales traducidos mantienen aviso de borrador e identidad pendiente. Rótulos/constancias legales del Libro siguen canónicos en español, con ayuda portuguesa marcada pt-BR.

El catálogo y blog aceptan traducciones PT desde el admin. Si falta contenido editorial PT, se muestra español con fallback visible y slugs coherentes; nunca se presenta inglés como portugués ni se inventa traducción. El editor permite guardar/revisar/eliminar traducciones PT sin eliminar la española canónica. Hreflang, metadata, fechas y moneda usan pt-BR, sin convertir importes ni cambiar políticas.

API/Prisma admiten pt; dos migraciones aditivas separan ADD VALUE del enum de la configuración de búsqueda portuguesa. No se aplicaron a la base del cliente. CI las aplica sobre PostgreSQL efímero; al actualizar un entorno real deben ejecutarse las migraciones antes de servir solicitudes PT. No se modifica la identidad, pagos reales ni autenticación del personal.

Reservas, correos y enlaces preservan pt. El nuevo consentimiento de marketing conserva el idioma de la solicitud incluso para un cliente cuyo idioma previo sea español, sin cambiar arbitrariamente su preferencia global. Se corrigió que el checkout descartaba sus opciones de marketing: solo se transmiten las casillas explícitas y validadas; por defecto son falsas. No se envían comunicaciones reales durante pruebas.

Validación local: tipos web/API/admin, lint web/admin y pruebas dirigidas API aprobados (61 iniciales; 19 adicionales de consentimiento/cliente existente). Web: 13 pruebas, incluida precedencia del slug PT, errores PT y consentimiento explícito. Tres nuevos recorridos Chromium aislados verifican selector, búsqueda, fallback señalado, carrito/checkout y contacto/reclamaciones PT. Resultado CI pendiente al preparar esta nota; no acredita producción ni base local migrada.
