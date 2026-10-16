# ADR-0022: independencia del sitio anterior

Fecha: 2026-10-16. Requisito confirmado por el propietario: el sitio anterior dejará de existir este mes.

Se conservan 366 imágenes en `apps/web/public/tours`, con manifiesto de procedencia y SHA-256. El contenido público y la API resuelven sus referencias hacia archivos propios; una referencia antigua no recuperable utiliza un marcador local. No se depende de la disponibilidad del servidor anterior para servir esas imágenes. Los archivos históricos conservan URL de procedencia únicamente para trazabilidad.

La API genera su mapa mediante `node scripts/sync-api-media-map.mjs`; `--check` verifica sincronización y existencia de los archivos. Los nuevos medios del administrador conservan su contrato de almacenamiento. No se modificaron datos de clientes ni se inventaron imágenes, tarifas o certificaciones.

Comprobaciones ejecutadas: 35 pruebas web, 14 de administración y 16 de API dirigidas aprobadas; mapa sincronizado (366 archivos, 423 claves URL). Demo compilada: 227 rutas públicas/antiguas responden sin referencias a hosts retirados; las 366 imágenes responden desde el origen propio con SHA-256 correcto y el optimizador devuelve 200. Las 28 referencias no recuperadas se documentan en `docs/content/tour-image-mirror.md`. La prueba de navegador que bloquea los hosts antiguos está preparada para CI; este registro no acredita su ejecución.

El inventario conserva 41 tours, 5 destinos, 5 categorías y 6 artículos ES/EN. Todas las fotos de galerías de tours, destinos, categorías y portadas del blog están archivadas. Ocho fotos internas del blog y siete institucionales procedían de un host ya inaccesible; el resto pendiente son referencias históricas no utilizadas. No se copia como identidad actual la sociedad, el RUC ni el personal del sitio anterior.

Además, ambos fondos del banner mantienen dimensiones y composición y pasan de 3 747 882 a 659 608 bytes. Esta reducción de peso no equivale a una medición de velocidad de conexión o de Core Web Vitals.
