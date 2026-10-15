# Manual de uso — peruwonderstours.com

Versión 0.1 · 15 de octubre de 2026 · Documento en elaboración

Este manual describe la versión de trabajo. Las direcciones locales sirven solo mientras los programas de prueba están abiertos. No se ha publicado todavía el sitio definitivo. Las funciones pendientes se identifican expresamente.

## Índice

1. Inicio rápido y acceso
2. Seguridad y autenticador
3. Recorrido del viajero
4. Secciones del administrador
5. Tours, precios y salidas
6. Banners y movimiento
7. Historias, leyendas y guías
8. Reservas y pagos
9. Contacto, testimonios y reclamos
10. Idiomas y SEO
11. Rutina de operación
12. Problemas frecuentes
13. Pendientes y control de versiones

## 1. Inicio rápido y acceso

### Probar la web en este equipo

1. Abre el Explorador de Windows y entra en `C:\Users\ingjo\Documents\Codex\2026-10-13\pu\outputs`.
2. Ejecuta `Probar-web.cmd` con doble clic.
3. Espera el mensaje `Ready` y abre <http://127.0.0.1:3000/es>.
4. Mantén la ventana del servidor abierta durante la prueba. Al cerrarla, la dirección local deja de funcionar.

### Probar el panel

1. Ejecuta `Probar-admin.cmd` desde la misma carpeta.
2. Espera el mensaje que indica que el panel está listo.
3. Abre <http://localhost:3002/login>.
4. Ingresa con el correo y contraseña entregados por el responsable del proyecto.
5. Completa la verificación en dos pasos cuando se solicite.

No se incluyen contraseñas, claves de autenticador ni códigos de recuperación en este manual. Las credenciales de demostración no son cuentas para producción. Los lanzadores preparan una vista local de pruebas; no deben usarse como alojamiento público.

## 2. Seguridad y autenticador

### Primera configuración

1. Si el sistema exige cambiar una contraseña temporal, crea una propia y confirma el cambio.
2. En la pantalla de activación, solicita mostrar el código QR.
3. Escanéalo con tu app autenticadora o introduce manualmente la clave que aparece.
4. Escribe el código de seis dígitos generado por la app y pulsa `Activar y entrar`.
5. Guarda los códigos de recuperación en un gestor de contraseñas o en un lugar seguro. Se muestran una sola vez.
6. Confirma que los guardaste para continuar.

### Ingresos posteriores

Después de correo y contraseña, escribe el código actual de la app. Si no tienes el teléfono, utiliza la opción de código de recuperación; cada código sirve una sola vez. Un código rechazado no implica que debas cambiar la contraseña: comprueba primero la hora automática del teléfono y que estés usando la cuenta correcta.

En `Mi cuenta` puedes consultar el perfil, cambiar contraseña y gestionar sesiones según las opciones disponibles. Pulsa `Salir` al terminar en un equipo compartido. Los permisos del rol determinan qué secciones aparecen y qué acciones están autorizadas.

## 3. Recorrido del viajero

1. En inicio, elige idioma: español, inglés o portugués.
2. Usa el buscador para elegir destino y viajeros.
3. Abre un tour y revisa itinerario, inclusiones, condiciones y disponibilidad.
4. Elige fecha y número de viajeros; añade el tour al carrito.
5. Revisa el carrito antes de continuar.
6. Completa los pasos de contacto y viajeros del checkout.
7. Revisa el importe y las condiciones antes de pagar.
8. Consulta el resultado de la reserva. En el escenario aprobado de pruebas se puede descargar el calendario del viaje.

**Estado actual:** el pago es simulado. No introducir datos de tarjetas reales. La persistencia completa de identidad de viajeros y datos fiscales sigue pendiente; no usar esta versión para emitir boletos nominativos ni facturas. Consultar el apartado 13.

## 4. Secciones del administrador

| Sección | Uso principal |
|---|---|
| Tablero | Consultar el resumen disponible de operaciones. |
| Reservas | Buscar reservas y abrir sus detalles y estados. |
| Pagos manuales | Revisar operaciones manuales con los permisos correspondientes. |
| Tours | Crear y mantener las fichas comerciales. |
| Precios | Gestionar tarifas del catálogo. |
| Salidas y cupos | Mantener fechas y disponibilidad. |
| Destinos / Categorías | Organizar los productos turísticos. |
| Blog | Publicar historias, leyendas, cultura y guías. |
| Banners de inicio | Gestionar imágenes y efectos de la portada. |
| Testimonios | Revisar las reseñas antes de su publicación. |
| Mensajes de contacto | Consultar consultas recibidas. |
| Libro de Reclamaciones | Gestionar hojas registradas según el flujo disponible. |
| Protección de datos | Revisar solicitudes relacionadas con datos personales. |
| Auditoría | Consultar el registro de actividad autorizado. |
| Usuarios | Administrar personal y permisos, si tu rol lo permite. |
| Mi cuenta | Gestionar tu acceso y sesiones. |

## 5. Tours, precios y salidas

Trabaja primero en borrador. Prepara título, descripción, itinerario, inclusiones, exclusiones, condiciones y fotografías. Organiza el tour por destino y categoría; guarda y revisa la ficha antes de publicarla.

Gestiona las tarifas en `Precios` y las fechas/cupos en `Salidas y cupos`. Comprueba moneda, tipo de pasajero y condiciones aplicables. Un tour publicado no equivale automáticamente a una salida con cupo y tarifa disponible.

Después de un cambio comercial, abre la ficha como visitante y comprueba fecha, número de personas y total del carrito. No inventes tarifas ni marques disponibilidad que la agencia no haya confirmado. Las traducciones se revisan por separado; un aviso de contenido en español significa que todavía falta una traducción completa.

## 6. Banners y movimiento

En `Banners de inicio`, utiliza las acciones disponibles para las imágenes, el orden y los efectos. Revisa siempre el resultado en la portada y en móvil después de guardar.

La portada usa imágenes y efectos nativos de la web. No asumas que subir un archivo HTML ejecutará sus scripts tal cual: los documentos ejecutables originales no se sirven como páginas dentro del banner. Verifica el formato que admite el formulario actual antes de preparar archivos.

Mantén los textos legibles y evita repetir un nombre ya incluido dentro de la imagen. Los controles permiten pausar la animación; el sitio respeta la preferencia de movimiento reducido del dispositivo.

## 7. Historias, leyendas y guías

El botón `Historias` del menú abre el diario. También hay un apartado en inicio, después del contenido comercial.

### Crear una publicación

1. Entra en `Blog` y elige crear un artículo.
2. Completa título, slug, extracto y cuerpo.
3. Añade portada y revisa su descripción cuando corresponda.
4. En `Etiquetas`, escribe una categoría estable y, si lo deseas, destinos separados por coma:
   - `historias`: experiencias reales de viajeros.
   - `leyendas`: mitos y relatos de tradición oral.
   - `guias`: información cultural y práctica.
5. Guarda el borrador.
6. Añade o revisa inglés y portugués si los vas a publicar.
7. Revisa el texto, sus fuentes y permisos antes de publicar.
8. Abre `Historias` en la web y comprueba el filtro correspondiente.

Si no incluyes una categoría reconocida, la publicación se muestra como guía. Si incluyes varias, `historias` tiene prioridad sobre `leyendas`; utiliza preferentemente una sola.

### Historias de viajeros

El botón `Proponer mi historia` abre WhatsApp para contactar al equipo; no publica automáticamente. Revisa el relato y conserva la autorización de su autor antes de publicarlo. Obtén permiso también para fotografías y nombres. No incluyas documentos, teléfonos personales ni datos de reservas en el artículo.

### Leyendas y fuentes

Distingue tradición oral de hechos documentados. Enlaza fuentes cuando afirmes información histórica o cultural. Las primeras lecturas tratan sobre Manco Cápac/Mama Ocllo y el patrimonio textil de Taquile; incluyen fuentes de PROMPERÚ y UNESCO.

Estas dos lecturas iniciales son contenido local versionado y no aparecen como registros editables del panel. Su reemplazo o retirada tiene condiciones específicas: ver [Contenido editorial inicial](../content/journal-editorial.md). Los nuevos artículos sí se gestionan mediante el blog del administrador.

## 8. Reservas y pagos

Busca la reserva y abre su detalle antes de actuar. Revisa código, estado, fechas e importes; no interpretes un pago pendiente o rechazado como dinero recibido.

En pruebas hay resultados simulados aprobado, pendiente y rechazado. Para operaciones manuales, confirma el sustento y usa exclusivamente las acciones autorizadas por tu rol. Registrar un pago manual no equivale a cobrar una tarjeta desde el panel. Una anulación contable tampoco acredita una devolución bancaria real.

No repitas una operación dudosa sin revisar primero el estado y la auditoría. La integración con la pasarela real y el procedimiento de conciliación/devolución deben verificarse cuando se contrate el proveedor.

## 9. Contacto, testimonios y reclamos

Revisa las consultas en `Mensajes de contacto`. Ver un mensaje en el panel no acredita por sí mismo que se haya enviado un correo al viajero.

Publica testimonios reales y autorizados; no conviertas textos promocionales en reseñas de clientes. El flujo contempla moderación.

El Libro de Reclamaciones cuenta con formulario público y consulta de constancia. El equipo debe verificar los datos oficiales de la agencia y acordar su procedimiento de respuesta antes de operar en producción. Este manual no sustituye las políticas ni asesoramiento legal.

## 10. Idiomas y SEO

El sitio tiene español, inglés y portugués. Los campos traducidos deben revisarse antes de publicar. Cuando una ficha no tiene traducción, el sitio puede mostrar contenido español con un aviso.

Para cada artículo o tour, utiliza un título concreto y una descripción propia. El SEO técnico ya incluye canonical, idiomas, sitemap y datos estructurados; no garantiza posiciones en Google. No inventes reseñas, certificaciones ni datos fiscales para mejorarlo.

Search Console, Analytics y la verificación del dominio requieren configuración al publicar. No se consideran conectados por aparecer mencionados en el manual. Ver [Preparación SEO](../seo/preparacion-lanzamiento.md).

## 11. Rutina de operación

- Al comenzar: revisar reservas, pagos pendientes, consultas y reclamos.
- Antes de publicar cambios: comprobar contenido, importes, cupos, traducciones y permisos de imágenes.
- Después de guardar: revisar la vista pública y, para cambios comerciales, el recorrido hasta el carrito.
- Al terminar: cerrar sesión si el equipo es compartido.
- Al publicar en hosting: definir y probar copias de seguridad, restauración y monitoreo. No asumir que están contratados o activos en la vista local.

## 12. Problemas frecuentes

| Situación | Qué revisar |
|---|---|
| localhost rechazó la conexión | Ejecutar el lanzador correcto y mantenerlo abierto; esperar Ready/panel listo. |
| No veo un cambio visual | Recargar con Ctrl + F5. Si persiste, informar qué pantalla y qué cambio falta. |
| Falta una sección o aparece sin permiso | Revisar el rol con un administrador; no se resuelve cambiando la URL. |
| Mi código del autenticador falla | Revisar hora automática y cuenta; usar recuperación si corresponde. |
| Un cambio de edición entra en conflicto | Volver a cargar y revisar la versión actual antes de repetir; puede haber otra edición. |
| El artículo no aparece | Revisar estado publicado, etiqueta y traducción. Los borradores no son publicaciones públicas. |
| No hay tarifa o fecha disponible | Revisar precios, salidas, cupos y condiciones comerciales del tour. |
| No llega el correo en pruebas | El entorno puede capturarlo sin enviarlo. SMTP real sigue pendiente de validación. |

Al reportar un error, indicar pantalla, acción, resultado esperado y mensaje visible. Ocultar contraseñas, QR, códigos de recuperación y datos personales en capturas.

## 13. Pendientes y control de versiones

| Pendiente | Consecuencia |
|---|---|
| Datos de viajeros y facturación | Se solicitan en checkout pero todavía no se guardan completos. Bloquea uso operativo definitivo. |
| Teléfono actualizado por reserva | Se cifra para clientes nuevos; una reserva de invitado no sobrescribe el perfil existente. |
| Pasarela real | Los pagos actuales son simulados. |
| Hosting y dominio público | Las direcciones localhost no son la web publicada. |
| SMTP y entrega real | Falta validar correos en buzones reales. |
| Identidad fiscal y documentación final | RUC y razón social reales pendientes; ejemplos no son datos oficiales. |
| Analytics / Search Console | Requieren configuración de cuentas y dominio. |

Este documento se actualiza junto con las funciones. Las capturas finales y la capacitación se completarán cuando se estabilice la interfaz. No se incluyen capturas simuladas como evidencia de funciones terminadas.

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-15 | 0.1 | Primer manual: acceso, MFA, navegación, catálogo, diario y límites de la versión de pruebas. |
