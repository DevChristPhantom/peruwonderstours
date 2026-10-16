# ADR-0022: independencia del sitio anterior

Fecha: 2026-10-16. Requisito confirmado por el propietario: el sitio anterior dejará de existir este mes.

Se conservan 362 imágenes en `apps/web/public/tours`, con manifiesto de procedencia y SHA-256. El contenido público y la API resuelven sus referencias hacia archivos propios; una referencia antigua no recuperable utiliza un marcador local. No se depende de la disponibilidad del servidor anterior para servir esas imágenes. Los archivos históricos conservan URL de procedencia únicamente para trazabilidad.

La API genera su mapa mediante `node scripts/sync-api-media-map.mjs`; `--check` verifica sincronización y existencia de los archivos. Los nuevos medios del administrador conservan su contrato de almacenamiento. No se modificaron datos de clientes ni se inventaron imágenes, tarifas o certificaciones.

Comprobaciones ejecutadas: 30 pruebas web aprobadas y verificación del mapa (362 archivos, 419 claves URL). Las 32 referencias no recuperadas se documentan en `docs/content/tour-image-mirror.md`. La prueba de navegador que bloquea los hosts antiguos está preparada para CI; este registro no acredita su ejecución.

Además, ambos fondos del banner mantienen dimensiones y composición y pasan de 3 747 882 a 659 608 bytes. Esta reducción de peso no equivale a una medición de velocidad de conexión o de Core Web Vitals.
