# ADR-0028 — Logos informativos e ilustración de cierre

Fecha: 2026-10-19

## Pedido y resultado

El cliente pidió los seis logos de su captura y la ilustración final de montañas/caminantes. Se recuperaron del sitio anterior los SVG con sus query strings correctos (sin ellos habían fallado en la migración histórica) y bg-top-footer.png. Son archivos propios del despliegue, sin hotlinking ni dependencia del dominio anterior.

- `/official/`: Safe Travels, Protégeme/ESNNA, GERCETUR, PROMPERÚ, Marca Perú y SERNANP. Se retiraron declaraciones XML/DOCTYPE y comentarios; comprobación sin scripts, eventos, foreignObject o recursos HTTP externos. XML válido y proporciones originales preservadas con object-fit:contain.
- Logos en la franja Enlaces oficiales, identificados como recursos informativos, sin activar BADGE_SWITCHES. Safe Travels etiquetado programa histórico conforme a https://wttc.org/initiatives/crisis-preparedness-management-recovery/safetravels-stamp-application. GERCETUR enlaza Cusco, no Puno. Los seis enlaces útiles anteriores permanecen como lista compacta debajo.
- Carrusel existente conserva pausa, difuminado lateral, teclado y alternativas táctil/movimiento reducido.
- `/brand/andes-travelers.png`: imagen original 1600×252, 22.122 bytes, verificada visualmente. Decorativa, lazy y con espacio reservado. Pie azul #133464 coincide con píxel inferior. En móvil recorta lateralmente sin deformar figuras.
- Procedencia y hashes: `docs/content/official-logo-assets.json`.

## Evidencia

TypeScript y lint dirigidos aprobados. Siete medios locales HTTP 200 y seis SVG XML válidos. Home ES/EN/PT HTTP 200. Mensajes generados: 1135 claves por idioma. No se ejecutó navegador local; revisión de fuente independiente y visualización del PNG de origen.

La prueba móvil existente se actualizó al orden tours→destinos establecido en ADR-0027; no se ejecutó en este turno.
