# Velocidad e independencia: evidencia local

16 de octubre de 2026. Demo compilada con Webpack, API de prueba local y catálogo de 41 tours. Web `http://localhost:4000/es`; administración `http://localhost:4002/login`.

- Web y administración compilan correctamente; API compilada y `/health` responde 200.
- 227 rutas públicas y heredadas responden sin referencias a los hosts retirados. Se verifican idioma, enlaces alternativos, canonical, contactos y redirecciones.
- 366 imágenes se sirven por HTTP desde la propia web con tamaños y SHA-256 iguales al manifiesto. El optimizador de imágenes devuelve 200.
- 35 pruebas web, 14 de administración y 16 dirigidas de API aprobadas. Los mapas API/administración concuerdan con 366 imágenes y 423 claves.
- Los dos fondos del hero pasan de 3 747 882 a 659 608 bytes, sin cambiar dimensiones ni recortar. Las fotos archivadas pasan de 84 525 354 a 74 549 477 bytes.
- El efecto del mouse agrupa lecturas en un frame, evita dibujar el canvas cuando está inactivo y libera su bitmap al cambiar de escena. El ticker de scroll se pausa en pestañas ocultas. No se midieron FPS ni memoria real.

En una tanda local con caché caliente, las medianas de cinco respuestas HTTP fueron 36/32/31 ms para las portadas ES/EN/PT y 110/90/95 ms para sus catálogos. Otra tanda durante tareas intensivas de respaldo dio 33/53/39 ms y 214/226/311 ms respectivamente. La carga del equipo influye: estas cifras no equivalen a tiempo de carga completa, latencia de Internet ni Core Web Vitals de visitantes.

Reproducción: establecer `PWT_SMOKE_ORIGIN` al origen local compilado y ejecutar `node scripts/check-public-routes.mjs` y `node scripts/check-owned-media.mjs`. Los scripts solo hacen GET contra loopback y no contactan al servidor anterior. La prueba de navegador preparada para CI bloquea hosts retirados, decodifica una foto real de producto y registra métricas sin simular red móvil; no se ejecutó un navegador local.

El informe `legacy-content-coverage-2026-10-16.md` distingue contenido recuperado de fotos faltantes. No se acredita alojamiento público, pagos reales, tarifas vigentes ni la identidad fiscal pendiente.
