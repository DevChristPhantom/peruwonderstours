# Banners HTML de peruwonderstours

La portada incluye Lago Titicaca y Machu Picchu. Los documentos se ejecutan dentro de un iframe aislado: conservan sus scripts, estilos, letras y eventos del mouse. Al volver a una escena se crea un documento nuevo y se repite la entrada.

Solo se monta el banner visible. Se desmonta cuando el usuario pausa, cambia de pestaña o sale del hero; movimiento reducido y pantallas táctiles usan una imagen estática. La selección manual detiene el avance automático, pero deja funcionando los efectos del banner elegido. El botón pausa/play vuelve a habilitar el avance.

En el panel, abrir /banners: subir HTML completo UTF-8 (.html o .htm, máximo 16 MB), poner título, guardar y activar. Se puede ajustar el orden y desactivar. Archivos autocontenidos con imágenes embebidas funcionan; scripts, fuentes o imágenes externos no se habilitan. No ejecutar código del documento en el admin.

Almacenamiento privado: MEDIA_LOCAL_DIR/.hero-banners. Incluirlo en los respaldos. La implementación usa un único proceso escritor; para varias instancias hace falta almacenamiento compartido y coordinación. Las copias iniciales locales no se incluyen en Git ni en el paquete de código. Las dos escenas incluidas en web permiten probar sin API.

Las imágenes incluidas se separaron del HTML y se convirtieron a WebP sin pérdidas: comparación RGBA confirma igualdad píxel a píxel. Pasaron de 6.80 MB a 3.75 MB. No se cambió el código visual de los efectos.

Verificación local: cinco pruebas web, compilación TypeScript API y tipos web, ESLint de HeroMotion y política de documentos. HTTP portada 200 y documento Titicaca 200 (5200 bytes, 82 ms, entorno dev; no representa FPS ni Web Vitals). Revisión independiente de capas/puntero. No se acredita inspección visual automatizada.

La API actualmente iniciada en 3001 usa código anterior (GET hero-banners devuelve 404): reiniciar la API con el código compilado para probar gestión admin. La portada funciona con las escenas incluidas mientras tanto.
