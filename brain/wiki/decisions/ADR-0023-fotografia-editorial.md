# ADR-0023: fotografía del catálogo en portada y páginas informativas

2026-10-16. El propietario solicita más fotografías en la página.

La portada incorpora una galería de cinco experiencias después de los tours destacados, enlazada a sus fichas reales: Titicaca, Machu Picchu, Humantay, Vinicunca y Colca. Se seleccionan imágenes del catálogo vigente, se omiten marcadores y duplicados, y se usan otras fotografías publicadas si falta un tour. No se añaden solicitudes de catálogo, dependencias ni un carrusel de JavaScript.

La sección de motivos de viaje incorpora una fotografía, el cierre tiene fondo panorámico y los tres temas del diario usan imágenes diferentes del catálogo. Nosotros añade fotografía de cabecera y tarjetas de los destinos; Contacto añade un paisaje de Puno, identificado como destino y sin presentarlo como fotografía de la oficina o del equipo.

Las fotos nuevas utilizan Next Image con carga diferida y `sizes` acordes con las columnas. Contenedores de proporción definida reservan espacio. El pequeño zoom de la galería solo se activa con puntero fino, hover y sin movimiento reducido. Se conserva el orden comercial, formularios, enlaces, testimonios auténticos y contratos de reservas.

Los cuatro textos nuevos de la galería se traducen a ES/EN/PT. Las fotos siguen siendo medios propios; no se vuelve a habilitar el servidor anterior. Validación de tipos/lint y navegador CI se registra con la entrega; no se acredita un navegador local por leer el código.
