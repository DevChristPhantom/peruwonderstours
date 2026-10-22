# ADR-0030 — Banner de video administrable

Fecha: 2026-10-22

## Decisión

El cliente reemplaza las fotos con efectos por su video MP4. Se conserva el contenido completo (119 segundos), sin audio en la versión web; se retiran solo las franjas negras incorporadas y se prepara H.264 1280×544, yuv420p, faststart. Original 28.279.250 bytes; versión web 9.899.658 bytes (65 % menos), portada WebP 105.658 bytes. Los originales del cliente no se modifican.

- Assets propios en `apps/web/public/hero-video/`; no dependencia del sitio retirado.
- El hero monta solo el video activo, solicita sus bytes después de conocer preferencias y muestra la portada como contenido inicial. Pausa por botón, pestaña oculta o fuera de pantalla. Movimiento reducido no descarga el MP4 hasta reproducción explícita. No canvas ni paralaje en escenas de video.
- Un único video se repite; con varios banners, termina antes de avanzar. Imágenes anteriores siguen compatibles. El cambio de preferencia de movimiento revoca la reproducción manual anterior.
- Admin admite MP4 hasta 50 MiB, portada opcional JPEG/PNG/WebP hasta 16 MiB, vista previa y operaciones existentes de activación, orden y eliminación. Instrucciones incluidas en pantalla y manual. No transcodifica futuras subidas; validar su vista previa y recomendar H.264.
- API valida estructura ISO BMFF y tamaño, almacena en repositorio privado y entrega streams con rangos 200/206/416. La ruta pública rechaza inactivos; la privada exige `tours:read`. BFF no carga el video entero en memoria ni expone tokens. El límite de espera de cabeceras no interrumpe la reproducción lenta.
- La respuesta pública distingue catálogo sin configurar de banners deliberadamente desactivados mediante `configured`; nunca expone registros inactivos.
- Se detectó mediante HTTP real que el serializador global convertía StreamableFile en JSON; se conserva esta instancia y se prueba el flujo con el interceptor real.
- Preview local: nuevo video activo, cuatro banners anteriores desactivados sin borrar sus archivos. Manifiesto anterior respaldado fuera del repositorio.

## Validación

Tipos y lint web/admin/API aprobados; 40 pruebas web y 14 admin aprobadas. Build web webpack: 261 páginas generadas. Pruebas API de video y regresión del serializador y navegador CI se registran al concluir su ejecución. No acredita producción, pasarela real ni SMTP.
