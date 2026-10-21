# Manual paso a paso de peruwonderstours

**Para la persona que atenderá la agencia y actualizará la página.**

Versión 0.3 · 16 de octubre de 2026

Este manual está pensado para una persona que no tiene conocimientos de programación. No necesitas instalar programas ni escribir comandos para seguir los pasos de uso habitual.

**Antes de comenzar:** todavía estamos probando la página. Los pagos son de demostración y hay funciones pendientes. No uses esta versión para cobrar dinero real ni para emitir boletos o facturas.

## Cómo leer este manual

- Cuando diga **haz clic**, presiona una vez el botón izquierdo del mouse.
- Cuando diga **doble clic**, presiona dos veces seguidas el botón izquierdo.
- Los nombres en **negrita** son botones, casillas o secciones que debes buscar en la pantalla.
- Una casilla con **asterisco (*)** es obligatoria: debes completarla para continuar.
- **Guardar** conserva los cambios. **Publicar** hace que un contenido pueda aparecer a los visitantes. No significan lo mismo.
- Un **borrador** es un contenido que puedes preparar sin mostrarlo todavía a los visitantes.
- Las direcciones que comienzan con `localhost` o `127.0.0.1` funcionan solamente en el equipo de pruebas y mientras el programa esté abierto.

Si no aparece un botón indicado aquí, puede que tu cuenta no tenga permiso para usarlo. Pide ayuda al administrador; no necesitas modificar el navegador.

## Busca la tarea que necesitas

1. Encender la página de prueba y abrir el panel.
2. Entrar con tu correo, contraseña y código del teléfono.
3. Reconocer los botones del panel y salir de tu cuenta.
4. Crear una historia o una leyenda.
5. Corregir un artículo que ya existe.
6. Subir una imagen y activar un banner.
7. Preparar un tour nuevo.
8. Añadir un precio y fechas disponibles.
9. Revisar una reserva y sus pagos.
10. Ver mensajes, testimonios y reclamos.
11. Probar la página como visitante.
12. Resolver problemas frecuentes.
13. Revisar qué falta antes de atender clientes reales.

## 1. Encender la página de prueba

### Demostración rápida para presentar al cliente

La versión compilada prepara la página antes de abrirla. Es la recomendada para presentar el avance.

1. Abre la carpeta `C:\Users\ingjo\Documents\Codex\2026-10-13\pu\outputs`.
2. Si está apagada, haz doble clic en **Preparar-demo.cmd**. Espera a que diga **DEMO LISTA**; la preparación puede tardar varios minutos.
3. Abre `http://localhost:4000/es` para ver la web y `http://localhost:4002/login` para el panel. Usa tus datos de acceso habituales del entorno de prueba.
4. No necesitas repetir la preparación para navegar. Si el programador modificó el código, ejecuta **Actualizar-demo.cmd**, espera **DEMO LISTA** y recarga la página.
5. Para apagar la demostración, ejecuta **Detener-demo.cmd**. Esto no borra tours, reservas ni la base de prueba.

Las fotos recuperadas se guardan con este proyecto: no necesitas abrir ni mantener funcionando el sitio anterior. Si ves un recuadro de imagen pendiente, falta reemplazar una foto que no se pudo recuperar; avisa al encargado, sin pegar enlaces del sitio antiguo.

Los cobros siguen siendo simulados. Estos accesos funcionan únicamente en el equipo donde se preparó la demostración. Las siguientes instrucciones de desarrollo siguen disponibles para trabajar con cambios de código.

### A. Abrir la carpeta de trabajo

1. En el teclado, mantén presionada la tecla con el símbolo de **Windows** y presiona **E**. Se abrirá una ventana llamada Explorador de archivos.
2. Haz clic en la barra de dirección que está arriba, donde aparece el nombre de la carpeta.
3. Copia y pega esta dirección completa: `C:\Users\ingjo\Documents\Codex\2026-10-13\pu\outputs`.
4. Presiona **Enter**. Debes ver los archivos de la carpeta de pruebas.

### B. Encender la web que ve el visitante

1. Busca **Probar-web.cmd**. Dependiendo de Windows, puede verse simplemente como **Probar-web**.
2. Haz doble clic en ese archivo.
3. Se abrirá una ventana con letras. Espera hasta que aparezca la palabra **Ready**.
4. **No cierres esa ventana.** Puedes minimizarla con el botón de la raya que aparece arriba a la derecha.
5. Abre Chrome, Edge o el navegador que utilizas.
6. Haz clic en la barra superior de direcciones y escribe: <http://127.0.0.1:3000/es>.
7. Presiona **Enter**.

**Resultado esperado:** aparece la página de peruwonderstours con el logo y los tours.

**Si aparece “rechazó la conexión”:** vuelve al paso 1 y comprueba que el archivo de prueba esté ejecutándose. Recargar el navegador no enciende el programa.

### C. Encender el panel de administración

1. Regresa a la carpeta del apartado A.
2. Haz doble clic en **Probar-admin.cmd**.
3. Espera hasta que el mensaje indique que el panel está listo. El primer arranque puede tardar más.
4. Mantén abierta la ventana que se acaba de abrir.
5. En el navegador, abre una pestaña nueva y entra en <http://localhost:3002/login>.

**Resultado esperado:** aparece tu logo y el formulario **Iniciar sesión**.

Si aparece un error dentro de la ventana con letras, copia las últimas líneas y envíalas al responsable técnico. No borres carpetas ni vuelvas a instalar nada por tu cuenta.

## 2. Entrar a tu cuenta

### A. Escribir correo y contraseña

1. En **Correo**, escribe la dirección que te entregó el administrador.
2. En **Contraseña**, escribe tu contraseña. Respeta mayúsculas, minúsculas y símbolos.
3. Si necesitas comprobar lo que escribiste, presiona el dibujo del **ojo**. Vuelve a presionarlo para ocultarla.
4. Pulsa **Continuar** una sola vez y espera.

**Resultado esperado:** aparece **Verificación en dos pasos** o, si es tu primera entrada, una pantalla para configurar la verificación.

**Si dice “Correo o contraseña incorrectos”:** revisa lo que escribiste y vuelve a completar ambos campos. No compartas una captura en la que se vea tu contraseña.

### B. Si ya tienes configurada la app del teléfono

La app autenticadora es una aplicación del teléfono que muestra un código de seis números. No es el código del bloqueo del teléfono ni un mensaje de WhatsApp.

1. Abre tu app autenticadora en el teléfono.
2. Busca la cuenta correspondiente al panel de peruwonderstours.
3. Mira el código de seis números que aparece.
4. Escríbelo en **Código de 6 dígitos**, en la computadora. Si empieza con cero, escribe también ese cero.
5. Pulsa **Ingresar**.

**Resultado esperado:** aparece el **Tablero** y el menú del administrador.

Si el código está a punto de cambiar, espera el siguiente y úsalo. Comprueba que el teléfono tenga fecha y hora automáticas.

### C. Si es la primera vez y te pide activar la app

1. Si aparece **Crea tu contraseña**, escribe una contraseña propia en los dos campos y pulsa **Guardar y continuar**.
2. En la pantalla de verificación, sigue la indicación para instalar una app autenticadora si aún no la tienes. Pide ayuda al responsable si no conoces este paso.
3. En la computadora, pulsa **Mostrar código QR**.
4. En la app del teléfono, elige añadir una cuenta y escanear un código QR.
5. Apunta la cámara al cuadrado que aparece en la computadora.
6. La app mostrará seis números. Escríbelos en **Código de 6 dígitos**.
7. Pulsa **Activar y entrar**.
8. Aparecerán los códigos de recuperación. Guárdalos en un lugar seguro y privado. Sirven para entrar si pierdes acceso al teléfono.
9. Marca **Guardé los códigos en un lugar seguro.**
10. Pulsa **Ya los guardé, entrar al panel**.

**Importante:** no publiques el QR, la clave manual ni los códigos de recuperación. No se incluyen contraseñas en este manual.

### D. Si no tienes el teléfono

1. Pulsa **No tengo mi teléfono: usar código de recuperación**.
2. Escribe uno de los códigos que guardaste.
3. Pulsa **Ingresar**.
4. Marca ese código como usado en tu copia privada: no volverá a servir.

Si no tienes teléfono ni códigos, contacta al administrador. No crees otra cuenta para intentar recuperar la anterior.

## 3. Ubicarte dentro del panel

En una pantalla grande, el menú aparece a la izquierda. En una pantalla pequeña, pulsa **Menú** para verlo.

| Quiero hacer esto | Sección que debo abrir |
|---|---|
| Ver el resumen de trabajo | **Tablero** |
| Buscar una reserva | **Reservas** |
| Revisar pagos registrados manualmente | **Pagos manuales** |
| Crear o corregir un tour | **Tours** |
| Añadir o revisar una tarifa | **Precios** |
| Elegir días disponibles y número de plazas | **Salidas y cupos** |
| Crear una historia o guía | **Blog** |
| Cambiar imágenes del banner principal | **Banners de inicio** |
| Revisar consultas de visitantes | **Mensajes de contacto** |
| Revisar opiniones | **Testimonios** |
| Revisar hojas de reclamación | **Libro de Reclamaciones** |
| Revisar tu contraseña y sesiones | **Mi cuenta** |

**Para salir:** pulsa **Salir**, arriba a la derecha. Hazlo siempre que termines en una computadora compartida. Cerrar una pestaña no equivale necesariamente a cerrar la sesión.

## 4. Crear una historia, una leyenda o una guía

### Antes de escribir

Ten preparado el texto y una foto que tengas permiso de utilizar. Si cuentas la experiencia de una persona, pide su autorización para publicar el relato, su nombre y sus imágenes. No incluyas números de documentos, teléfonos ni códigos privados de reservas.

El ejemplo de abajo es una guía cultural. **No lo presentes como si fuera el testimonio de un cliente.**

### A. Llenar el artículo

1. Pulsa **Blog** en el menú izquierdo.
2. Abre la opción para crear un artículo. Se abrirá la pantalla **Nuevo artículo**.
3. Completa los campos así:

| Campo | Qué significa | Ejemplo de práctica |
|---|---|---|
| **Título** | Nombre que verá el lector | Qué conocer antes de visitar Taquile |
| **Slug (URL)** | Nombre corto que irá en la dirección del artículo. Usa letras minúsculas y guiones, sin espacios ni tildes. | visitar-taquile |
| **Extracto** | Resumen breve que aparece en la tarjeta | Una introducción a la cultura de Taquile y recomendaciones para una visita respetuosa. |
| **Cuerpo** | Texto completo del artículo | Escribe la introducción y luego los párrafos. Deja una línea vacía entre párrafos. |
| **Título SEO** | Título para los buscadores. Puede ser parecido al título normal. | Visitar Taquile: cultura y recomendaciones |
| **Descripción SEO** | Resumen para los buscadores, de una o dos frases | Conoce el patrimonio textil de Taquile y cómo preparar una visita respetuosa al Lago Titicaca. |
| **Etiquetas** | Palabras que indican dónde aparecerá el artículo | guias, taquile, puno |

No necesitas escribir HTML ni código. Puedes empezar con párrafos sencillos. Revisa la ortografía y comprueba las fuentes antes de publicar afirmaciones históricas.

### B. Elegir la categoría correcta

En **Etiquetas**, utiliza una de estas palabras exactamente como aparece, sin tildes, y añade después los destinos separados por comas:

| Si el contenido es… | Escribe por ejemplo… |
|---|---|
| Un relato real de un viajero | historias, puno |
| Un mito o una leyenda | leyendas, titicaca |
| Información cultural o consejos | guias, taquile |

Usa una sola categoría principal. La palabra `historias` es una etiqueta de clasificación: no significa que el relato ya tenga autorización para publicarse.

### C. Añadir una fotografía

1. Busca **Imagen de portada**.
2. Pulsa **Subir imagen**.
3. En la ventana de archivos, busca la foto y selecciónala.
4. Pulsa **Abrir**.
5. Espera mientras aparece **Subiendo…**.
6. Comprueba que se vea la foto seleccionada.

Se admiten fotos JPEG, PNG, WebP o AVIF, de hasta **8 MB** en este selector. Si supera el límite, pide una copia más ligera. No cambies solo el nombre del archivo para intentar reducir su tamaño.

### D. Guardar sin publicar todavía

1. Pulsa **Crear borrador**.
2. Espera a que se abra la pantalla del artículo creado.
3. Comprueba que el título sea correcto y revisa su estado.

**Resultado esperado:** el artículo queda guardado para seguir editándolo. Un borrador todavía no se muestra al público.

### E. Revisar y publicar

1. Entra en la pestaña **Español** y comprueba el texto.
2. Si vas a ofrecerlo en otros idiomas, prepara sus pestañas **Inglés** y **Português (Brasil)**. No copies español y lo marques como traducido.
3. Guarda cada formulario antes de cambiar de pestaña.
4. Revisa título, fotografía, permisos y fuentes.
5. Usa la acción **Publicar**, si tu cuenta tiene permiso.
6. Abre la web en otra pestaña y pulsa **Historias** en el menú superior.
7. Elige la categoría correspondiente y abre el artículo para leerlo completo.

**Si no aparece:** revisa primero que esté publicado y que la etiqueta esté bien escrita. Si tu cuenta no puede publicar, pide a la persona responsable que revise el borrador.

Las dos lecturas iniciales sobre Manco Cápac/Mama Ocllo y Taquile se añadieron como contenido inicial del proyecto. Para modificarlas o retirarlas, pide ayuda al responsable técnico. Los artículos nuevos que crees desde el panel sí se gestionan desde **Blog**.

## 5. Corregir un artículo existente

1. Abre **Blog**.
2. Busca el artículo por su título y abre su detalle.
3. Para cambiar foto o etiquetas, entra en **General**.
4. Modifica lo necesario y pulsa **Guardar cambios**.
5. Para cambiar el texto, abre la pestaña del idioma correspondiente y guarda ese formulario.
6. Vuelve a la web y revisa el resultado.

Evita cambiar el **Slug (URL)** de un artículo que ya compartiste. Esa es la dirección que otras personas podrían tener guardada. Si necesitas cambiarla, pide ayuda para revisar los enlaces anteriores.

Si aparece un aviso de que otra persona modificó el artículo, vuelve a abrirlo y compara la información antes de repetir tu cambio.

## 6. Cambiar una imagen del banner principal

El banner es la imagen grande que aparece al inicio de la página. Puede tener efectos de agua o nubes.

### A. Subir la imagen

1. Pulsa **Banners de inicio**.
2. Busca el bloque **Subir un banner**.
3. En **Título**, escribe un nombre que permita reconocerlo, por ejemplo: `Experiencias en el Titicaca`.
4. En **Imagen del banner**, elige el archivo de tu computadora.
5. En **Efecto**, selecciona agua, nubes o la opción sin movimiento que corresponda a la imagen.
6. Si la foto ya tiene letras con su nombre, marca **La imagen ya contiene el título**. Así no se repetirá el texto.
7. Pulsa **Subir como inactivo**.

Admite imágenes PNG, JPEG, WebP o AVIF, hasta **16 MB**. Subirlo como inactivo significa que queda guardado pero aún no aparece en la portada.

### B. Mostrarlo al visitante

1. Busca la imagen en **Banners guardados**.
2. Revisa su título y el efecto elegido.
3. En **Orden**, escribe el lugar en el que debe aparecer: por ejemplo, `1` antes que `2`.
4. Marca **Mostrar en portada**.
5. Pulsa **Guardar cambios**.
6. Abre la web y revisa el banner. Usa las flechas del carrusel para encontrarlo.

**Para retirarlo sin perderlo:** desmarca **Mostrar en portada** y pulsa **Guardar cambios**.

Si importas un HTML anterior que contiene una imagen incorporada compatible, el sistema puede extraerla; no se ejecutan sus efectos originales. Si aparece «Sin imagen disponible», utiliza una foto normal. Si no sabes qué es un HTML, utiliza una foto normal desde el principio.

## 7. Preparar un tour nuevo

Antes de comenzar, pide al encargado comercial la duración, el itinerario, lo que incluye, las condiciones y las tarifas confirmadas.

1. Pulsa **Tours**.
2. Abre la opción de nuevo tour. Debe aparecer **Nuevo tour**.
3. Completa los datos iniciales:

| Campo | Cómo completarlo |
|---|---|
| **Tipo** | Tour para una excursión; Paquete para varios días/noches; Traslado para un transporte. |
| **Código** | Identificador interno acordado con la agencia, por ejemplo `PUN-UROS-01`. No reutilices el de otro tour. |
| **Slug (URL en español)** | Nombre corto, por ejemplo `uros-y-taquile-un-dia`. No uses espacios ni tildes. |
| **Duración (horas)** | Horas del tour o traslado, según la información comercial. |
| **Días / Noches** | Para paquetes, los días y noches confirmados. |
| **Pasajeros mínimos** | Número mínimo de personas que la agencia puede atender en esa opción. |

4. Pulsa **Crear borrador**.
5. En el tour creado, completa los apartados de texto, itinerario, portada y clasificación que muestra el panel.
6. Guarda cada apartado antes de salir de él.
7. Revisa la información con la persona responsable antes de publicar.

**Un tour guardado todavía puede necesitar precios y fechas.** Continúa con el apartado 8. No inventes una tarifa para completar una casilla.

## 8. Añadir una tarifa y fechas disponibles

### A. Precio por persona

1. Pulsa **Precios**.
2. Selecciona el tour con el que trabajarás y revisa que sea el correcto.
3. En el formulario de tarifa, revisa **Pasajero**, **Residencia** y **Moneda**.
4. En **Precio por persona**, escribe el importe confirmado. Ejemplo de formato: `450.00` significa 450 unidades de la moneda elegida; no significa 4.50.
5. Completa **Vigente desde** y **Vigente hasta** según el periodo autorizado.
6. Revisa temporada y límites de grupo si se aplican.
7. Pulsa **Crear tarifa**.
8. Comprueba que la nueva tarifa figure en la lista.

Los importes de ejemplo de este manual sirven para explicar el formato. No son precios aprobados de la agencia.

### B. Fechas y plazas

1. Pulsa **Salidas y cupos**.
2. Selecciona el tour correcto.
3. Busca **Generar salidas en lote**. Significa crear varias fechas de una sola vez.
4. En **Desde** y **Hasta**, elige el periodo autorizado.
5. En **Días de la semana**, deja marcados solo los días en que habrá atención.
6. Completa **Hora (Lima)** si hay hora fija.
7. En **Capacidad**, escribe cuántas plazas puede atender la agencia en cada salida.
8. Revisa los datos y pulsa **Generar salidas**.
9. Comprueba que aparezcan las fechas previstas en la lista.
10. Abre el tour como visitante y verifica que se pueda elegir una fecha con el precio correcto.

No reduzcas las plazas por debajo de las que ya están vendidas o reservadas temporalmente. Si el sistema rechaza el cambio, consulta la reserva o pide ayuda; no intentes borrar fechas para evitar el aviso.

## 9. Revisar una reserva y sus pagos

1. Pulsa **Reservas**.
2. Busca el código de reserva proporcionado por el viajero y abre su detalle.
3. Comprueba que sea la reserva correcta: tour, fecha, cantidad de personas y estado.
4. Revisa los importes antes de informar al cliente.

| Lo que ves | Qué debes hacer |
|---|---|
| Pago pendiente | No confirmar que el dinero ya fue recibido. Revisar el medio y la operación. |
| Pago rechazado | No registrarlo como pagado. Informar que debe revisarse el intento de pago. |
| Importe pagado registrado | Revisar el estado y el sustento antes de dar instrucciones operativas. En pruebas sigue siendo una simulación. |

**Pagos manuales:** utiliza esta sección solo si te autorizaron a gestionar esas operaciones. Comprueba el sustento y el importe. No pulses anular, cancelar o devolver por prueba en una reserva real.

Registrar un pago en el panel no cobra una tarjeta. Anular un registro tampoco prueba que el banco haya devuelto dinero. Si hay dudas, consulta al encargado de pagos antes de repetir la acción.

## 10. Mensajes, opiniones y reclamos

### Mensajes de contacto

1. Pulsa **Mensajes de contacto**.
2. Abre el mensaje que necesitas atender.
3. Lee la consulta completa antes de responder por el canal acordado por la agencia.
4. No supongas que abrir el mensaje envía una respuesta al viajero.

### Testimonios

1. Pulsa **Testimonios**.
2. Revisa que el texto corresponda a una experiencia real y autorizada.
3. Usa las acciones de revisión/publicación disponibles para tu cuenta.
4. Comprueba después la vista pública.

### Libro de Reclamaciones

1. Pulsa **Libro de Reclamaciones**.
2. Ubica la hoja que corresponde al caso.
3. Revisa sus datos y el estado de atención.
4. Sigue el procedimiento de la agencia; no publiques el reclamo como una historia o testimonio.
5. Si no sabes cómo responder, deriva el caso al responsable.

Los plazos y el procedimiento legal deben verificarse con la persona responsable de la agencia. Este manual enseña a ubicar la sección; no sustituye esa revisión.

## 11. Probar la página como visitante

1. Abre <http://127.0.0.1:3000/es> en otra pestaña.
2. Elige español, inglés o portugués en el selector de idioma.
3. Busca un destino y abre un tour.
4. Revisa la información y elige fecha y viajeros.
5. Añádelo al carrito y comprueba el total.
6. Continúa para probar el formulario de reserva.

**Durante las pruebas:** usa datos ficticios y no introduzcas tarjetas reales. Los pagos todavía son simulados. Aunque aparezcan campos de documentos de viajeros o facturación, todavía falta completar su guardado; no se debe operar con boletos nominativos ni facturas desde esta versión.

Para revisar una historia, pulsa **Historias** arriba y elige una categoría. **Proponer mi historia** abre WhatsApp: el relato no se publica automáticamente.

## 12. Si algo no funciona

| Problema | Qué hacer primero |
|---|---|
| “No se puede acceder” o “rechazó la conexión” | Abre el archivo de prueba correspondiente, espera a que esté listo y deja su ventana abierta. Luego recarga la página. |
| No veo el último cambio | Mantén presionada **Ctrl** y pulsa **F5** en la pestaña de la web. |
| Contraseña incorrecta | Revisa el correo, mayúsculas y símbolos. Vuelve a escribir ambos campos. |
| El código de seis dígitos no sirve | Comprueba la hora automática del teléfono y usa un código nuevo de la cuenta correcta. |
| No puedo guardar | Busca un mensaje debajo de los campos o al principio del formulario. Completa lo que indique. |
| El botón muestra “Guardando…” o “Subiendo…” | Espera a que termine antes de volver a pulsarlo. |
| No aparece un botón del manual | Puede faltar permiso. Consulta al administrador. |
| La imagen pesa demasiado | Pide una copia más ligera: portada hasta 8 MB; banner hasta 16 MB. |
| Publiqué un artículo y no lo veo en su categoría | Comprueba estado publicado y etiqueta: historias, leyendas o guias. |
| No llega un correo de la prueba | Todavía no se ha validado el envío real. Informa al responsable técnico. |

### Cómo pedir ayuda

Envía estos cuatro datos:

1. La pantalla donde estabas. Ejemplo: **Blog → artículo de Taquile**.
2. El botón que pulsaste. Ejemplo: **Guardar cambios**.
3. Qué esperabas que pasara.
4. El mensaje que apareció, copiado tal cual, o una captura sin información privada.

No envíes contraseñas, QR, códigos de recuperación ni documentos personales en la captura.

## 13. Qué revisar cada día

Al comenzar la jornada:

1. Entrar a tu cuenta.
2. Revisar reservas y pagos pendientes.
3. Revisar consultas y reclamos.
4. Comprobar cambios de precios y disponibilidad autorizados.

Antes de publicar un contenido:

1. Leerlo completo.
2. Revisar foto y permiso de uso.
3. Revisar la traducción si la incluyes.
4. Guardar y comprobar el estado publicado.
5. Abrir la web como visitante y comprobar el resultado.

Al terminar: pulsar **Salir** si compartes la computadora.

## 14. Qué sigue pendiente antes de usarlo con clientes reales

- Publicar la web en el alojamiento contratado y conectar el dominio.
- Contratar y probar el cobro real.
- Comprobar que los correos lleguen a buzones reales.
- Completar el guardado de documentos de viajeros y datos de facturación.
- Completar el contacto actualizado de cada reserva. Por ahora el teléfono se guarda cifrado para clientes nuevos y no reemplaza el perfil anterior de otro cliente desde una reserva de invitado.
- Confirmar razón social, RUC real y documentación oficial.
- Preparar copias de seguridad y probar cómo recuperar la información.

El SEO ayuda a que los buscadores entiendan la página, pero no garantiza aparecer primero. La conexión con las herramientas de Google se configura al publicar; no necesitas modificarla para crear historias o tours.

## 15. Palabras que puedes encontrar

| Palabra | Explicación sencilla |
|---|---|
| Navegador | Programa para entrar a las páginas: Chrome, Edge, Firefox, etc. |
| Pestaña | Cada página abierta dentro del navegador. |
| Panel | Parte privada donde el personal administra la web. |
| Borrador | Trabajo guardado que todavía no está publicado. |
| Publicar | Permitir que un contenido aparezca a los visitantes. |
| Slug | Nombre corto de una página dentro de su dirección. |
| Etiqueta | Palabra que clasifica un contenido. |
| Portada | Foto principal de un artículo o tour. |
| Banner | Imagen grande de la parte superior de la página de inicio. |
| Carrusel | Grupo de imágenes que cambia con flechas o automáticamente. |
| Cupo | Número de plazas disponibles. |
| Autenticador | App del teléfono que genera códigos para entrar con seguridad. |
| SEO | Preparación de la página para que los buscadores comprendan su contenido. |
| Simulado / sandbox | Prueba que no realiza un cobro real. |

## Control del manual

Este documento se actualizará junto con las funciones. Las capturas paso a paso se añadirán cuando se estabilicen las pantallas; todavía no están incluidas.

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-10-15 | 0.1 | Primera documentación del uso general. |
| 2026-10-15 | 0.2 | Reescritura para principiantes: clic por clic, campos explicados, ejemplos, resultados y solución de problemas. |

Documentación para el responsable técnico: [Contenido editorial inicial](../content/journal-editorial.md), [Preparación SEO](../seo/preparacion-lanzamiento.md) y [Límites del checkout](../qa/checkout-datos-2026-10-15.md).
