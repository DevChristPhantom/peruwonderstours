# SEO de peruwonderstours.com — 15 de octubre de 2026

## Implementación

Se conservan títulos y descripciones por página, canonical del dominio comprado, hreflang es-PE/en/pt-BR y x-default, sitemap de páginas comerciales y blog. Se completan tarjetas Open Graph/Twitter con foto de la página o logo real como alternativa. TravelAgency usa logo, teléfono, correo y oficina confirmados, sin RUC ficticio ni reseñas inventadas. Una tarifa no implica cupo: se elimina InStock inferido del precio.

robots.txt deja rastrear las páginas HTML para que Google pueda leer su noindex (carrito, checkout, favoritos, cuentas y reservas ya tienen esta directiva). Autenticación y tokens continúan protegiendo datos; robots.txt no es una barrera de seguridad. API excluida del rastreo. El sitemap no contiene páginas personales.

Comprobaciones CI: inicio en tres idiomas con title/descripción/canonical/hreflang; nueve páginas personales con noindex; dominio y ausencia de duplicados del sitemap; recursos y redirecciones existentes. El test unitario comprueba identidad comercial y metadatos sociales sin disponibilidad inventada.

## Contenido antes de publicar

Cada tour necesita nombre claro de destino y experiencia, duración, itinerario propio, inclusiones/exclusiones, condiciones y fotos con textos alternativos descriptivos. Publicar precios y cupos solo tras confirmación comercial. Traducir las fichas completas: el aviso de fallback no sustituye la traducción editorial. No repetir palabras clave artificialmente ni generar reseñas.

## Activación con hosting

Verificar HTTPS, redirección www al dominio canónico elegido y errores404; enviar sitemap a Search Console tras verificar dominio por DNS. Mantener el entorno de pruebas fuera de indexación desde hosting. Preparar redirecciones del dominio anterior con acceso al mismo; un archivo en el dominio nuevo no redirige por sí solo el antiguo. Revisar resultados y Core Web Vitals con datos reales cuando haya tráfico.

No se crean cuentas Google ni se activa Analytics en esta tarea. El SEO técnico no garantiza posiciones ni indexación inmediata.

Fuentes: https://developers.google.com/search/docs/crawling-indexing/block-indexing ; https://developers.google.com/search/docs/appearance/title-link ; https://developers.google.com/search/docs/appearance/snippet .
