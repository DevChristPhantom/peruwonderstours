# ADR-0016 — Logo público del administrador

Fecha: 2026-10-14.

El proxy de sesión interceptaba el PNG del logo y enviaba al login la lectura interna sin cookie del optimizador Next Image. Se permite exclusivamente `/brand/peruwonderstours-dorado.png` dentro de PUBLIC_PATHS; se mantienen las cabeceras y la protección de las otras rutas. Revisión independiente aprobada por admin_qa_review. La prueba Chromium verifica PNG sin cookie, redirección de reservas sin sesión y carga real del logo en login y sidebar. Ejecución CI pendiente al preparar este cambio.
