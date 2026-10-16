# Banners nativos de peruwonderstours

La portada renderiza las imágenes directamente, sin iframe ni ejecutar HTML subido. Los efectos React/CSS/canvas incluyen parallax opuesto al mouse, entrada del título, ondas y destellos sobre agua y tres capas de nubes. Son recreaciones nativas, no ejecución idéntica de los scripts originales.

Cada cambio o selección reinicia la escena. Solo existe una escena activa; el RAF se inicia con eventos del mouse y termina al asentarse el movimiento y agotarse las ondas. Máximo 32 ondas, DPR limitado a 1.5, sin actualizaciones React por pointermove. Cancelación y limpieza al pausar, salir del hero o cambiar pestaña. Touch y movimiento reducido conservan imagen y texto estáticos; efecto none también es estático.

Admin /banners: imagen PNG/JPEG/WebP/AVIF hasta 16 MB, título, efecto none/water/clouds, orden y activación. La opción 'La imagen ya contiene el título' evita duplicar el texto integrado en la foto. Archivos HTML anteriores se pueden importar para extraer la primera imagen compatible; sus scripts no se ejecutan en la portada.

Machu Picchu conserva el nombre integrado en la foto; no se duplica visualmente. Las imágenes iniciales WebP son sin pérdidas y se verificaron píxel a píxel: 3.75 MB en total frente a 6.80 MB PNG. Poster y administración requieren API actualizada. Escenas incluidas funcionan sin API.

Almacenamiento privado: MEDIA_LOCAL_DIR/.hero-banners. Respaldarlo. Manifest atómico y revisión optimista; un único proceso escritor. Para múltiples instancias hace falta coordinación y almacenamiento compartido.

Verificaciones: tipos web/API/admin, lint y pruebas de almacenamiento/validación. CI comprueba compilaciones, pruebas, rutas y que la portada nativa no renderice iframe. No se acredita validación visual multi-viewport ni FPS desde el navegador.
