# Contenido editorial inicial del diario

`apps/web/src/lib/content/journal-articles.ts` contiene dos artículos breves en español, inglés y portugués. Son contenido editorial, no testimonios de viajeros; no se atribuyen autores ni fechas de publicación ficticios. Las fuentes primarias se muestran dentro del artículo. La imagen local representa el Titicaca, no una fotografía documental de una persona o pieza textil concreta.

Las etiquetas estables son `leyendas` y `guias`. La primera pieza diferencia la tradición de una crónica histórica y reconoce variantes; la segunda presenta el tejido de Taquile como patrimonio vivo. Las historias personales requieren contenido real publicado por el personal desde el CMS.

La lista conserva los artículos publicados recibidos de la API y agrega únicamente los editoriales que no tengan su misma clave canónica española ni ruta del idioma actual. En modo seed se aplica la misma prioridad. Un artículo del CMS sustituye al editorial cuando utiliza exactamente estas claves:

- `manco-capac-mama-ocllo-tradiciones-titicaca`
- `taquile-arte-textil-patrimonio-vivo`

El detalle consulta primero la API; cuando no existe el artículo solicitado, permite leer el editorial local. Una indisponibilidad de la API conserva el comportamiento previo de respaldo seed. Los errores de autenticación o validación no se ocultan como contenido editorial.

Limitación: estos artículos locales no aparecen como registros editables en administración. Para reemplazarlos se publica una entrada con su clave canónica; despublicar esa entrada vuelve a mostrar el respaldo local. Suprimir también el respaldo requiere una modificación de contenido versionada. No se importaron datos en ninguna base de datos.
