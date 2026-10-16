# ADR-0017 — Acceso del personal con identidad turística

Fecha: 2026-10-14.

Rediseño visual autorizado por el propietario a partir de su referencia: paisaje de Machu Picchu, superficie marfil, logo dorado completo e iconos Lucide; formulario prioritario en móvil. Login, MFA, configuración QR, cambio inicial de contraseña y recuperación conservan acciones, campos, validaciones y desafíos. Se añade control accesible para mostrar contraseña y entrada transform/opacity con movimiento reducido. Dirección confirmada: Calle N 500, Puno, también actualizada en SITE.

Assets: logo apps/admin/public/brand/peruwonderstours-dorado.png; paisaje apps/admin/public/brand/admin-machu-picchu.webp, copia del existente web/hero-motion/machu-picchu-0.webp. Tipografía Geist y tokens compartidos, marfil #f7f5ef y texto #243b31. Sin dependencias adicionales. El proxy permite exclusivamente ambos recursos visuales públicos.

Revisión independiente admin_qa_review: contratos de autenticación preservados; corregido ajuste de botones largos MFA en móvil. Lint y TypeScript admin aprobados; 12 pruebas unitarias admin aprobadas. Nueva prueba CI verifica mostrar/ocultar contraseña. La versión previa f2dba0e aprobó Quality38650893375 y Browser38650893253; ese resultado no acredita todavía este rediseño. Navegador local no ejecutado.

## Ajuste de altura — 2026-10-15

El propietario aportó fondo Machu Picchu y amanecer. Se integra WebP de 267644 bytes derivado del PNG de 2624631 bytes, fondo continuo y logo dentro de tarjeta unificada. Ajustes por altura <=760px compactan logo, padding e interlineados conservando controles >=44px. No se bloquea overflow: QR, errores, zoom y pantallas excepcionalmente bajas siguen desplazándose cuando sea necesario. Lint aprobado; no se ejecutó revisión visual en navegador local. Revisión independiente nueva interrumpida por límite de uso del agente; revisión fuente propia completada.
