# ADR-0029 — Interfaz operativa del administrador

Fecha: 2026-10-21

## Alcance

Mejorar navegación y legibilidad del panel sin cambiar inicio de sesión, MFA, permisos, contratos API o acciones de negocio.

- Búsqueda local por nombre/grupo del menú; ignora tildes y mayúsculas. Filtra únicamente los items ya autorizados en servidor. Campo etiquetado con useId, estado de resultados y botón para limpiar.
- Menú móvil se cierra al seguir enlace; foco devuelto a summary, sin interceptar clics con modificadores. Estado activo por ruta exacta/prefijo con barra conservado.
- Accesos rápidos del tablero a reservas/tours/salidas/banners, filtrados con can para cada permiso. Son navegación, no acciones mutantes.
- KPI con iconos decorativos y composición adaptable; mismas cifras reales, sin tendencias inventadas ni conversión de moneda.
- Superficies, títulos de secciones, campos, tablas y estados vacíos con espaciado/radios consistentes. CSS del panel aislado de auth; foco/error/disabled y scroll de tablas preservados. Sin librerías ni consultas adicionales.
- Manual actualizado v0.4 con pasos para buscar secciones y usar accesos rápidos.

## Evidencia de ejecución

- TypeScript y ESLint dirigido aprobados.
- 14 pruebas existentes de administrador aprobadas, 0 omitidas.
- Build Next webpack en .next-demo aprobado (compilación 21.9 s); no interrumpe servidor de desarrollo.
- GET localhost:3002/login: HTTP 200 y cabecera noindex conservada.
- Revisión independiente de fuente sin bloqueantes. Se incorporó su observación de devolver foco al input al limpiar la búsqueda. No se ejecutó navegador local ni sesión autenticada interactiva; la evidencia anterior no acredita pruebas visuales o de todos los botones.
