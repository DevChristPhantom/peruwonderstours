# Pruebas funcionales — 14 de octubre de 2026

La home muestra destinos y tours antes del Libro de Reclamaciones y los recursos oficiales. Se conserva el acceso legal desde el footer. Los efectos del banner son nativos, con pausa, limpieza y movimiento reducido.

## Entorno y cobertura

Playwright Chromium en GitHub Actions: API, web y admin compilados, PostgreSQL 16 efímero, catálogo y cuentas ficticias. Correo en memoria y proveedor de pagos sandbox. No se ejecutan fixtures contra la base del cliente ni se envían mensajes o cargos reales.

La suite contiene 21 recorridos; cada recorrido verifica varios controles y su resultado, incluida persistencia cuando corresponde:

- Usuario escritorio: buscador, viajeros, filtros/chips/reset, favoritos, comparación, itinerario/FAQ, galería, teclado/Escape/foco, idioma y carrito.
- Banner: navegación, pausa, reinicio al volver, desplazamiento opuesto al mouse, dibujo de agua, capas de nubes y movimiento reducido.
- Reservas: calendario, añadir/editar/quitar/deshacer, validación de checkout y pagos sandbox aprobado/pendiente/rechazado. Se verifica estado, importe pagado y descarga ICS.
- Contacto, testimonio pendiente de moderación, Libro de Reclamaciones, consulta de hoja y conexión del botón de impresión. La impresión se intercepta en el test; no acredita la maquetación física del PDF.
- Recursos oficiales: enlaces, pausa/reanudación, carga efectiva de imágenes visibles y destino accesible de WhatsApp. No se envían mensajes a WhatsApp.
- Admin: login incorrecto, MFA real de fixture, 17 rutas, categorías/destinos, borrador de tour, tarifas, salidas/cupo/estado, contacto y notas, auditoría, banners y cierre de sesión.
- Finanzas admin: registrar y anular un pago manual ficticio propio, comprobar importe persistido y cancelar la reserva propia.
- Personal admin: crear y editar una cuenta propia, bloqueo/desbloqueo, acciones de revocación y reset, contraseña temporal e inactivación. La cuenta recién creada no tiene sesiones ni MFA enrolado; no acredita la revocación de una sesión activa o un factor existente.
- Móvil: menú táctil, viajeros, carrusel de destinos, recursos, Libro, reserva y carrito; se exige ausencia de desbordamiento horizontal.

## Resultado final y fallos corregidos

Los 21 recorridos aprobaron en [Browser functional checks 38618120902](https://github.com/DevChristPhantom/peruwonderstours/actions/runs/38618120902), commit `e156ccad96e7faf9f387620167d0b73ebc41741d`. La [calidad 38618121143](https://github.com/DevChristPhantom/peruwonderstours/actions/runs/38618121143) también aprobó. Localmente pasaron 9 pruebas web, tipos y lint de componentes modificados. Los artefactos incluyen informe HTML, capturas y medidas; caducan el 21 de octubre.

Las pruebas descubrieron un fallo real de contrato en contacto/testimonios: faltaba el consentimiento requerido y se enviaban campos no admitidos. Los adaptadores y límites del formulario se corrigieron con cuatro regresiones unitarias, manteniendo la validación del servidor.

El diagnóstico aisló TrustStrip: la tarjeta del Libro activaba tres columnas desde sm=375px y las descripciones accesibles posicionadas del carrusel escapaban de su contenedor. El Libro pasa a columnas desde md=768px con minmax(0,1fr); tarjetas y viewport del carrusel establecen su bloque de posición. Se limitan las capas flotantes al ancho móvil, manteniendo aria-live, y se retiran recortes globales. El test final confirma raíz/body/main de 390px, sin desbordamiento, menú y viajeros táctiles, carrusel alineado, Libro, reserva y carrito. El rail usa scroll-padding-inline coherente con px-4; el test espera cada tarjeta alineada antes de invertir el movimiento.

## Muestras de respuesta de la ejecución final

| Acción | Tiempo observado |
| --- | ---: |
| Home escritorio lista, caché del mismo runner | 432 ms |
| Home móvil lista | 2407 ms |
| Seleccionar una pestaña de tours | 104–141 ms |
| Navegar entre secciones admin | 84–237 ms |
| Abrir reserva móvil y añadir tour | 297 ms |
| Abrir y cerrar menú móvil, ambas acciones | 1292 ms |
| Crear/editar borrador de tour admin, recorrido conjunto | 1271 ms |

La muestra móvil de 2,4 segundos es aceptable para revisión; se debe medir su carga real y Web Vitals tras configurar hosting. El menú tiene animaciones: el tiempo conjunto no es latencia de una sola pulsación. No se ha medido estabilidad de FPS. La aprobación cubre los recorridos definidos; no afirma todos los estados posibles, todos los teléfonos o toda la impresión física.

## Límites de entrega

Los tiempos de acción incluyen interacción, animación y espera de respuesta. Son muestras individuales de Chromium CI sin limitación de red/CPU; no son garantías de producción ni mediciones de FPS o Web Vitals. Las esperas de un nuevo período TOTP respetan la protección contra reutilización y no representan latencia del admin.

Antes de publicar quedan hosting/TLS/dominio, RUC e identidad legal definitivos, tarifas y disponibilidad aprobadas, SMTP real y una pasarela contratada. Las pruebas sandbox no acreditan una integración con un banco real. El PR sigue en revisión y la web no se ha publicado en producción.
