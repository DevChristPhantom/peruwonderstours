# Auditoría de contenido conservado y fotos originales

Fecha: 16 de octubre de 2026. Alcance: respaldo JSON, adaptadores de la web y consultas HTTP públicas al sitio anterior. Sin navegador local, acceso a base de datos ni cambios en publicaciones del CMS.

## Catálogo y blog

| Contenido | Respaldo ES | Respaldo EN | Observación |
|---|---:|---:|---|
| Tours | 41 | 41 | Todas las claves originales conservadas |
| Destinos | 5 | 5 | Todas las claves originales conservadas |
| Categorías | 5 | 5 | Todas las claves originales conservadas |
| Artículos del blog | 6 | 6 | Los 12 cuerpos contienen texto |

Se comprobaron 17 páginas públicas: listado de tours, blog, destinos, tipos de tours, cinco destinos, cinco categorías, Nosotros, políticas y `/en/tours`. Las 16 páginas españolas devolvieron HTTP 200. La unión de enlaces publicados contiene exactamente los 41 tours y seis artículos del respaldo, sin slugs nuevos. El menú se repite en varias páginas, por lo que los conteos por página del JSON no representan exclusivamente sus tarjetas.

La ruta inglesa del sitio anterior devolvió HTTP 500: los textos EN del proyecto son traducciones locales del respaldo español, no una extracción acreditada de una web inglesa funcional. `data/seed/en/_notes.md` identifica revisión comercial pendiente. Tener un registro traducido no acredita que una tarifa, condición o dato histórico esté confirmado.

El respaldo no contiene precios publicados para los 41 tours. Los precios de demostración y las tarifas del CMS son otra fuente; esta auditoría no los sobrescribe ni los valida comercialmente. Persisten las inconsistencias documentadas en `_extraction-report.md` y `en/_notes.md`, incluidas duración, destinos/categorías faltantes y condiciones de paquetes.

## Imágenes: mismas fuentes, sin sustitución ficticia

| Grupo visible en la web actual | URL únicas | Copias locales verificadas | Sin recuperar |
|---|---:|---:|---:|
| Portadas y galerías de los 41 tours | 340 | 340 | 0 |
| Imágenes de destinos | 10 | 10 | 0 |
| Imágenes de categorías | 5 | 5 | 0 |
| Portadas de los seis artículos | 6 | 6 | 0 |

Los grupos pueden compartir URL. El manifiesto completo tiene 366 archivos únicos: 329 WebP y 37 originales. Total de las fuentes: 84 525 354 bytes; copias locales: 74 549 477 bytes (9 975 877 bytes menos, aproximadamente 11,80 %). Cada registro conserva URL exacta, SHA-256 del archivo original y local, dimensiones y tamaño. La compresión no recorta ni inventa elementos.

Se recuperaron las cuatro URL terminadas en `.heic`: el servidor las entrega como `application/octet-stream`, pero Sharp pudo decodificar imágenes raster válidas. La excepción de MIME queda restringida a esas extensiones y exige decodificación y formato admitido; la extensión del archivo guardado corresponde al formato real. Tres se optimizaron a WebP y una conserva JPEG porque pesaba menos.

## Las 28 referencias pendientes

- Ocho fotos del cuerpo de tres artículos, alojadas en `turinet.turismoads.com`: el host no resuelve. Se conservaron sus URL en el respaldo; no se dispone de los archivos originales. Además, el adaptador actual muestra el cuerpo textual pero no utiliza el campo separado `bodyImages`: esas ocho fotos no están reproducidas dentro de los artículos. Es un faltante real de contenido, aunque no provoca solicitudes al host retirado.
- Siete fotos de la antigua página Nosotros, del mismo host sin resolución. Solo forman parte del archivo histórico `site-content.json`; la página Nosotros actual usa el contenido de la marca vigente y destinos del catálogo.
- Tres imágenes históricas de Open Graph, Nosotros y políticas devuelven HTTP 404. Se probaron nueve variantes convencionales `sm`, `md` y `lg`, manteniendo exactamente el nombre del archivo: todas devolvieron 404. No se reemplazaron por fotografías distintas. Las páginas actuales no utilizan esas referencias históricas como banners.
- Diez SVG históricos de pagos y sellos no se importaron como fotografías. No forman parte de la franja actual, que usa recursos locales y enlaces informativos. No se acredita una certificación por conservar un logotipo antiguo en el respaldo.

Los errores y usos exactos están en el JSON adjunto y en `tour-image-failures.json`. Cualquier referencia a una imagen no disponible de los hosts retirados se resuelve a un marcador local neutro; eso evita depender del sitio anterior, pero no equivale a haber recuperado la misma foto.

## Páginas e información institucional

`site-content.json` conserva contenido de inicio, megamenú, Nosotros, políticas, tres preguntas generales, contacto, redes, métodos de pago y pie. No todo ese archivo se publica literalmente. Nosotros, datos de contacto, políticas y componentes legales actuales utilizan los datos confirmados de peruwonderstours y sus documentos vigentes/borradores. El archivo anterior contiene otra razón social, otro RUC, oficinas, personal, teléfonos, correos y afirmaciones de experiencia que no deben presentarse como datos confirmados de la agencia actual.

Por tanto, la migración del catálogo y sus fotos está cubierta, pero no sería correcto afirmar «todo el sitio anterior está copiado íntegramente». Faltan las ocho fotos de artículos, las siete de Nosotros y una decisión editorial sobre información institucional/condiciones antiguas. Los formularios de contacto, testimonios y reclamaciones actuales son funciones nuevas; el reporte inicial no había extraído esas páginas como contenido histórico. No se accedió a registros privados ni a reseñas desde administración.

## Evidencia y reproducción

`node scripts/audit-legacy-content.mjs` guarda estado HTTP, títulos, hashes HTML, conjuntos de enlaces y variantes probadas en `legacy-content-coverage-2026-10-16.json`; no almacena el HTML entero ni modifica el CMS. La verificación de las fotos se reproduce con `catalog-image-source.test.mjs` y `legacy-content-coverage.test.mjs`. La disponibilidad remota refleja la fecha de ejecución, no una garantía futura.
