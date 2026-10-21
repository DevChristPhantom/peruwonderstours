# ADR-0024: entrega directa de imágenes y transporte de la demo local

2026-10-16. El usuario informa que no ve todas o casi todas las imágenes en `http://localhost:4000/es`.

Se comprobaron respuestas 200 de imágenes originales y del optimizador. Una tanda de catorce conversiones frías a ancho 3840 tardó aproximadamente 6–8 segundos con AVIF; los originales comprimidos de muestra respondieron en 7–74 ms por HTTP local. Esa tanda no representa las anchuras que solicita cada navegador ni demuestra por sí sola la causa de la experiencia del usuario. También se observó `upgrade-insecure-requests` y HSTS en una demo HTTP: se corrige esa incompatibilidad potencial sin afirmar haber visto errores de red del navegador del usuario.

Con `PWT_DEMO_BUILD=1` y `PUBLIC_WEB_BASE_URL` HTTP de loopback exacto, Next Image entrega directamente las imágenes ya comprimidas. La producción pública mantiene su optimizador responsivo. Se evita forzar HTTPS en HTTP loopback, sin habilitar modo desarrollo, eval, websockets o scripts externos. Las cabeceras estáticas solo omiten HSTS con configuración explícita de demo local. Las imágenes nuevas de la API local permiten únicamente el origen configurado, sin habilitar hosts anteriores.

Se agregan pruebas de transporte, nonce, hosts engañosos y configuración real. CI de navegador utiliza el mismo modo de demo; el trabajo de calidad conserva compilación y optimización normales de producción. La prueba de rendimiento comprueba entrega directa de una imagen real y las cabeceras HTTP locales. Las fuentes, archivos y el dominio confirmado se conservan.
