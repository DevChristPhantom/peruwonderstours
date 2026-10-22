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

## Revisión 2026-10-22 (pedido del cliente)

- Se cortan los primeros 6 s (el video abre en el título «PERU») y se sube la calidad: se reencoda desde el original 1920×1080 recortando las franjas a 1920×816 (antes 1280×544 reescalado). Escritorio: H.264 CRF 22 con tope 2,6 Mb/s, 113 s, 32.061.460 bytes. Móvil (≤ 900 px): variante 1280×544 a 1,3 Mb/s, 15.778.947 bytes (`peru-wonders-720.mp4`, campo `videoMobile`). Portada WebP 1920×816 desde el primer cuadro.
- Bug corregido: `proxy.ts` del admin hace que Next.js limite el cuerpo de la petición a 10 MB; toda subida de video mayor quedaba en «Procesando…». `experimental.proxyClientMaxBodySize = "52mb"` (video 50 MiB + portada + campos). Verificado: subida de 30,6 MB desde el panel, bytes idénticos (sha256) en la web, rangos 206/416.
- Los banners subidos al admin tienen prioridad sobre el video integrado: para ver el nuevo video en un entorno con banners propios, desactivar o reemplazar el banner subido.
- Mismo día, el cliente entrega un nuevo video 2K (`banner2k.webm`, VP9 2560×1440, 60 s, 51,6 MB) que reemplaza al anterior. Escritorio 1920×1080 H.264 CRF 21 / tope 4,5 Mb/s, 30.196.643 bytes; móvil 1280×720 CRF 23 / tope 1,8 Mb/s, 12.171.837 bytes; portada WebP 150.688 bytes. Se refuerza el degradado superior del hero (0,35 → 0,6) para que el menú blanco siga legible sobre cielos y nubes claras.

## Validación

Tipos y lint web/admin/API aprobados; 40 pruebas web y 14 admin aprobadas. Build web webpack: 261 páginas generadas. Pruebas API de video y regresión del serializador y navegador CI se registran al concluir su ejecución. No acredita producción, pasarela real ni SMTP.
