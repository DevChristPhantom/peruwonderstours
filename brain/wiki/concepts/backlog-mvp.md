---
type: concept
title: Backlog MVP — Peru Wonders Tours
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - backlog
  - producto
  - mvp
  - scrum
---

# Backlog MVP — Peru Wonders Tours

Product Owner: agente `product-owner-turismo`. Basado en [[concepts/alcance-cliente-v1]],
[[sources/sitio-actual-andeanperutours]], [[concepts/modelo-de-datos]] y
[[negocio/reglas-reserva-y-pago]]. Contenido semilla: `data/seed/*.json` (41 tours, 5 categorías,
5 destinos, 6 posts, 73 redirects; **0 precios publicados**).

## Convenciones

- **Prioridad MoSCoW**: Must (sin esto no se lanza), Should (lanzamiento ideal), Could (si sobra
  capacidad), Won't (fuera del MVP, se documenta para después).
- **Valor de negocio (VN)**: 1–5 (5 = habilita ingreso o cumplimiento legal).
- **Estimación**: talla de camiseta (S/M/L/XL), a refinar en planning.
- **Definition of Ready**: historia con criterios Gherkin, dependencias resueltas o mockeadas,
  preguntas abiertas que la bloquean respondidas.
- **Definition of Done**: código revisado por otro rol, pruebas (unitarias de dominio ≥ 80 %, E2E del
  flujo feliz y bordes listados), WCAG 2.2 AA, textos es/en, trazabilidad historia → prueba.
- Roles: **viajero** (visitante anónimo), **cliente** (con cuenta), **asesor** (ventas/reservas),
  **operaciones**, **administrador**, **contador**.

## Mapa de épicas

| Épica | Nombre | MoSCoW | VN | Depende de |
|---|---|---|---|---|
| E0 | Migración de contenido y SEO | Must | 5 | — |
| E1 | Catálogo y búsqueda | Must | 5 | E0, E7 |
| E2 | Ficha de tour | Must | 5 | E1, E7 |
| E3 | Carrito | Must | 5 | E2, E7 (precios y cupos) |
| E4 | Checkout con adelanto 50 % / 100 % | Must | 5 | E3, pasarela (ADR pendiente), E8 |
| E5 | Pago del saldo | Must | 5 | E4 |
| E6 | Cuenta de cliente | Should | 3 | E4 |
| E7 | Backoffice (tours, precios, temporadas, cupos, reservas, pagos) | Must | 5 | modelo de datos |
| E8 | Libro de reclamaciones y legales | Must | 5 (legal) | — |
| E9 | Contenido / blog | Should | 3 | E0 |
| E10 | i18n es / en | Must (es) · Should (en) | 4 | E1–E5 |

Orden sugerido de sprints: S1 E0 + E7 (catálogo) + E8 · S2 E1 + E2 · S3 E7 (precios/cupos) + E3 ·
S4 E4 · S5 E5 + E7 (reservas/pagos) · S6 E6 + E9 + E10 (en) + endurecimiento.

---

## E0 — Migración de contenido y SEO

**HU-0.1 Importar el catálogo existente** · Must · VN 5 · M
Como administrador quiero que los 41 tours, 5 categorías, 5 destinos y 6 posts del sitio viejo se
carguen automáticamente para no reescribir el contenido a mano.

```gherkin
Escenario: importación inicial
  Dado los archivos data/seed/tours.json, categories.json, destinations.json y blog-posts.json
  Cuando se ejecuta el proceso de seed
  Entonces existen 41 tours en estado "borrador" con su slug original
  Y cada tour conserva itinerario, incluye, no incluye, recomendaciones, FAQ e imágenes
  Y los tours sin precio quedan "no reservables" hasta que se cargue una tarifa

Escenario: reimportación idempotente
  Dado que el seed ya se ejecutó
  Cuando se ejecuta de nuevo
  Entonces no se duplican tours, categorías, destinos ni posts

Escenario: datos inconsistentes del origen
  Dado un tour cuya duración de tarjeta ("1D") contradice su título ("3 días / 2 noches")
  Cuando se importa
  Entonces se marca con la alerta "revisar duración" en el backoffice
```

**HU-0.2 Redirecciones 301** · Must · VN 5 · S
Como dueño del negocio quiero que las URLs viejas redirijan a las nuevas para no perder
posicionamiento ni enlaces compartidos.

```gherkin
Escenario: URL vieja de tour
  Dado la regla "https://www.andeanperutours.com/es/tours/valle-sagrado-incas" → "/es/tours/valle-sagrado-incas"
  Cuando un visitante abre la URL vieja
  Entonces recibe un 301 hacia la ruta nueva en peruwonderstours.com

Escenario: URL vieja sin regla
  Dado una URL /es/tours/<slug> inexistente en redirects.json
  Cuando un visitante la abre
  Entonces ve una página 404 útil con buscador y tours sugeridos (código 404, no 200)
```

**HU-0.3 Re-alojar imágenes** · Must · VN 4 · S — descargar y servir desde el nuevo sitio las
340 imágenes de tours y las 7 del blog alojadas en `turinet.turismoads.com`.
**HU-0.4 SEO técnico** · Must · VN 4 · M — sitemap.xml propio, robots.txt que **permita** indexar
(el viejo tiene `Disallow: /`), metadatos por página, datos estructurados `TouristTrip`/`Product`,
`hreflang` es/en, `alt` en imágenes.

---

## E1 — Catálogo y búsqueda

**HU-1.1 Listado de tours con filtros** · Must · VN 5 · L
Como viajero quiero filtrar tours por destino, categoría, duración, dificultad y precio para encontrar
rápidamente lo que encaja con mi viaje.

```gherkin
Escenario: filtrar por destino y duración
  Dado el catálogo publicado
  Cuando el viajero filtra destino "Puno" y duración "1 día"
  Entonces ve solo tours de Puno con duración de 1 día
  Y la URL refleja los filtros (compartible y rastreable)

Escenario: sin resultados
  Cuando aplica filtros que no devuelven tours
  Entonces ve "No encontramos tours con esos filtros", un botón para limpiar filtros y 3 sugerencias

Escenario: tour sin precio
  Dado un tour sin tarifa vigente
  Entonces su tarjeta muestra "Consultar precio" y no muestra "Añadir al carrito"
```

**HU-1.2 Búsqueda por texto** · Must · VN 4 · M — búsqueda tolerante a tildes y errores
("machupicchu", "cuzco"/"cusco", "titikaka").

```gherkin
Escenario: sinónimos y tildes
  Cuando el viajero busca "cuzco machupichu"
  Entonces aparecen los tours de Machu Picchu ordenados por relevancia
```

**HU-1.3 Búsqueda por fecha y pasajeros** · Should · VN 4 · M — mostrar solo tours con salida y cupo
para la fecha y número de pasajeros elegidos.

```gherkin
Escenario: tour sin cupo en la fecha
  Dado "Full Day Machu Picchu" sin cupo el 2026-07-28
  Cuando el viajero busca esa fecha para 2 adultos
  Entonces el tour aparece como "Agotado para esta fecha" con las 3 fechas más próximas con cupo
```

**HU-1.4 Páginas de destino y categoría** · Must · VN 4 · M — con descripción, banner, tours y
mismo slug que el sitio viejo.
**HU-1.5 Ordenar** (relevancia, precio, duración, destacados) · Should · VN 3 · S.
**HU-1.6 Tipos de tour / estilos de viaje** · Could · VN 2 · S (en el viejo la página está vacía).

---

## E2 — Ficha de tour

**HU-2.1 Ver la ficha completa** · Must · VN 5 · L
Como viajero quiero ver resumen, itinerario por día, incluye/no incluye, recomendaciones, qué llevar,
FAQ, políticas, galería y precio para decidir sin tener que escribir a un asesor.

```gherkin
Escenario: ficha con todos los bloques
  Dado el tour "Perú Especial 14D/13N"
  Cuando el viajero abre su ficha
  Entonces ve duración "14 días / 13 noches", mínimo de pasajeros, dificultad e itinerario de 14 días
  Y ve "Precio desde" en la moneda elegida con nota "por persona, base doble" si aplica

Escenario: bloque vacío
  Dado un tour sin FAQ
  Entonces la pestaña FAQ no se muestra (no hay pestañas vacías)
```

**HU-2.2 Selector de fecha, pasajeros y tarifa** · Must · VN 5 · L
Como viajero quiero elegir fecha y número de adultos, menores, estudiantes y adultos mayores, y mi
condición de nacional/extranjero, para ver el precio total exacto.

```gherkin
Escenario: cálculo de precio
  Dado tarifa adulto extranjero USD 120 y menor extranjero USD 90 en temporada baja
  Cuando el viajero elige 2 adultos y 1 menor para una fecha de temporada baja
  Entonces el total mostrado es USD 330 y el desglose por tipo de pasajero es visible

Escenario: debajo del mínimo de pasajeros
  Dado un tour con mínimo 2 pasajeros
  Cuando el viajero elige 1 adulto
  Entonces ve el aviso de mínimo y, si el tour lo permite, el suplemento individual sumado al total
  Y si no lo permite, el botón "Añadir al carrito" queda deshabilitado con la explicación

Escenario: menor sin adulto
  Cuando elige 0 adultos y 2 menores
  Entonces se bloquea con "Los menores deben viajar con al menos un adulto"

Escenario: fecha sin salida o cerrada
  Dado un día sin salida programada o con ventas cerradas (cierre a N horas)
  Entonces ese día aparece deshabilitado en el calendario

Escenario: boleto de Machu Picchu con cupo limitado
  Dado un tour que incluye ingreso a Machu Picchu y el cupo de boletos del día está agotado
  Entonces la fecha aparece "Sin boletos" aunque haya cupo de transporte
```

**HU-2.3 Datos obligatorios por nacionalidad/edad** · Should · VN 3 · S — avisar que el descuento de
estudiante/menor/nacional exige documento (carné ISIC, DNI) el día del servicio.
**HU-2.4 Consulta por WhatsApp / cotización** · Must · VN 4 · S — mantener el canal actual
(+51 989 028 802) con mensaje prellenado con tour y fecha; formulario de cotización para tours sin precio.
**HU-2.5 Tours relacionados** · Could · VN 2 · S.
**HU-2.6 Reseñas/testimonios** · Could · VN 2 · M (migrar testimonios; integración TripAdvisor: Won't en MVP).

---

## E3 — Carrito

**HU-3.1 Añadir varios tours al carrito** · Must · VN 5 · M
Como viajero quiero añadir varios tours/paquetes con sus fechas y pasajeros a un mismo carrito para
pagar todo junto.

```gherkin
Escenario: añadir al carrito
  Dado que el viajero configuró fecha y pasajeros válidos
  Cuando pulsa "Añadir al carrito"
  Entonces el contador del carrito sube en 1 y ve un resumen con subtotal

Escenario: doble clic
  Cuando pulsa "Añadir al carrito" dos veces seguidas
  Entonces se agrega un solo ítem (botón deshabilitado durante la petición + clave de idempotencia)

Escenario: carrito anónimo persistente
  Dado un viajero sin sesión con 2 ítems en el carrito
  Cuando vuelve al sitio al día siguiente desde el mismo navegador
  Entonces conserva los ítems (vigencia del carrito: 7 días, configurable)

Escenario: fusionar al iniciar sesión
  Dado un carrito anónimo con 1 ítem y un carrito de cuenta con 1 ítem
  Cuando el viajero inicia sesión
  Entonces el carrito resultante tiene 2 ítems sin duplicados
```

**HU-3.2 Editar y quitar ítems** · Must · VN 4 · S.
**HU-3.3 Revalidación al abrir el carrito** · Must · VN 5 · M

```gherkin
Escenario: ítem que quedó sin cupo
  Dado un ítem para el 2026-12-30 que se agotó después de añadirlo
  Cuando el viajero abre el carrito
  Entonces el ítem aparece marcado "Sin cupo" con opción de cambiar fecha o quitarlo
  Y no se puede ir a pagar mientras exista

Escenario: precio cambió
  Dado que la tarifa del ítem subió desde que se añadió
  Cuando el viajero abre el carrito
  Entonces ve el precio anterior tachado, el nuevo y el aviso "El precio se actualizó"

Escenario: fecha pasada o dentro del cierre de ventas
  Entonces el ítem se marca "Fecha no disponible" y bloquea el pago
```

**HU-3.4 Choques de itinerario** · Should · VN 3 · S — avisar si dos ítems se superponen en fecha
(p. ej. full day en Cusco el mismo día que un tour en Puno).
**HU-3.5 Cupones de descuento** · Could · VN 2 · M.
**HU-3.6 Moneda del carrito** · Must · VN 4 · S — PEN o USD; si se mezclan precios, se muestra en la
moneda elegida con tipo de cambio de referencia del día.

---

## E4 — Checkout con adelanto 50 % (y opción 100 %)

**HU-4.1 Datos del titular y de los pasajeros** · Must · VN 5 · M
Como viajero quiero ingresar mis datos y los de cada pasajero (nombre, documento, nacionalidad, fecha
de nacimiento) para que el operador emita boletos de tren/Machu Picchu a nombre correcto.

```gherkin
Escenario: datos de pasajeros obligatorios por producto
  Dado un carrito con un tour que incluye ingreso a Machu Picchu
  Cuando el viajero llega a "Pasajeros"
  Entonces debe ingresar nombre completo tal como en el pasaporte/DNI, tipo y número de documento,
  nacionalidad y fecha de nacimiento de cada pasajero

Escenario: edad no coincide con la tarifa
  Dado que eligió tarifa "menor" para un pasajero
  Cuando su fecha de nacimiento indica 18 años o más a la fecha del servicio
  Entonces se muestra el error y se recalcula el total con tarifa adulto previa confirmación

Escenario: consentimientos (Ley 29733)
  Entonces el checkout muestra casillas separadas y no marcadas para aceptar términos y política de
  privacidad (obligatoria) y para recibir publicidad (opcional)
```

**HU-4.2 Elegir adelanto 50 % o pago 100 %** · Must · VN 5 · M
Como viajero quiero elegir pagar el 50 % ahora y el resto después, o pagar todo, para ajustar el pago
a mi presupuesto.

```gherkin
Escenario: adelanto disponible
  Dado un carrito de USD 1,000.00 cuyo primer servicio es en 30 días
  Cuando el viajero elige "Reservar con 50 %"
  Entonces paga hoy USD 500.00
  Y ve "Saldo USD 500.00 a pagar hasta el <fecha del primer servicio − 7 días>"

Escenario: adelanto no disponible por cercanía
  Dado un carrito cuyo primer servicio es en 5 días
  Entonces solo se ofrece "Pagar 100 %" con la explicación del plazo

Escenario: componentes no reembolsables
  Dado un tour con boleto Machu Picchu configurado con adelanto mínimo del 100 % del boleto
  Entonces el adelanto mostrado = 50 % del resto + 100 % del boleto, con el desglose visible

Escenario: política visible antes de pagar
  Entonces se muestran la política de cancelación y reembolso del adelanto y la comisión por tarjeta
  (si aplica) antes del botón "Pagar"
```

**HU-4.3 Bloqueo de cupo (hold) y precio congelado** · Must · VN 5 · L

```gherkin
Escenario: hold exitoso
  Cuando el viajero confirma el resumen
  Entonces se reservan los cupos por 15 minutos y se muestra el temporizador

Escenario: sin cupo al crear el hold
  Dado que otro cliente compró el último cupo segundos antes
  Cuando el viajero confirma
  Entonces ve "Se agotó el cupo para <tour, fecha>" y vuelve al carrito con el ítem marcado
  Y no se cobra nada

Escenario: cambio de tarifa durante el checkout
  Dado que el administrador cambió la tarifa después de que el viajero abrió el checkout
  Cuando el viajero confirma el resumen (antes del hold)
  Entonces ve el nuevo total y debe aceptarlo explícitamente para continuar
  Y una vez creado el hold, el precio no cambia aunque se edite la tarifa

Escenario: hold vencido (sesión expirada)
  Dado que pasaron 15 minutos sin pagar
  Cuando el viajero intenta pagar
  Entonces ve "Tu reserva temporal expiró", se liberan los cupos y puede reintentar desde el carrito
```

**HU-4.4 Pago con pasarela** · Must · VN 5 · L (proveedor por ADR: Izipay/Niubiz/Mercado Pago/Culqi)

```gherkin
Escenario: pago aprobado
  Cuando la pasarela confirma el pago del adelanto (webhook verificado)
  Entonces la reserva pasa a "partially_paid" (o "paid" si fue 100 %)
  Y el viajero ve el código PWT-AAAA-NNNNNN y recibe correo de confirmación y comprobante electrónico

Escenario: pago rechazado
  Cuando la pasarela rechaza la tarjeta
  Entonces ve un mensaje claro sin datos sensibles ("Tu banco rechazó el pago. Prueba otra tarjeta o
  medio") y el hold se mantiene hasta su vencimiento para reintentar

Escenario: doble clic en "Pagar"
  Cuando el viajero pulsa "Pagar" dos veces
  Entonces se genera un solo intento de cobro (clave de idempotencia por intento)

Escenario: webhook duplicado o tardío
  Dado que la pasarela reenvía el mismo evento
  Entonces el pago se registra una sola vez
  Y si el evento llega después de vencido el hold, se reasigna cupo si existe o se reembolsa
  automáticamente y se notifica al staff

Escenario: cierre de pestaña tras pagar
  Dado que el viajero cerró la pestaña antes del retorno de la pasarela
  Entonces la reserva se confirma igual por webhook y recibe el correo

Escenario: datos de tarjeta
  Entonces el formulario de tarjeta es el embebido/redirigido de la pasarela y el sitio nunca recibe
  ni almacena el número de tarjeta (PCI DSS SAQ-A)
```

**HU-4.5 Medios locales** · Should · VN 4 · M — Yape/Plin y PagoEfectivo (vía proveedor); pago
pendiente con vencimiento compatible con el hold.
**HU-4.6 Boleta o factura** · Must · VN 5 · M — elegir boleta (DNI/pasaporte) o factura (RUC, razón
social validada); se emite un comprobante por cada pago (adelanto y saldo). Depende de proveedor OSE/PSE.
**HU-4.7 Reserva por transferencia bancaria** · Could · VN 3 · M — reserva "pendiente de pago"
confirmada manualmente por el asesor (canal actual del cliente).

---

## E5 — Pago del saldo

**HU-5.1 Enlace de pago del saldo** · Must · VN 5 · M
Como cliente quiero pagar el saldo con un enlace seguro, sin crear cuenta, para completar mi reserva.

```gherkin
Escenario: pagar el saldo online
  Dado una reserva "partially_paid" con saldo USD 500.00
  Cuando el cliente abre el enlace del correo y paga
  Entonces la reserva pasa a "paid", recibe el segundo comprobante y la confirmación final

Escenario: enlace reutilizado
  Dado que el saldo ya se pagó
  Cuando el cliente abre otra vez el enlace
  Entonces ve "Tu reserva ya está pagada" y no se cobra

Escenario: enlace manipulado o vencido
  Entonces el sistema no revela datos de la reserva y ofrece pedir un enlace nuevo por correo
```

**HU-5.2 Recordatorios del saldo** · Must · VN 4 · S — correos (y WhatsApp como Could) a −10, −8 y −7
días según [[negocio/reglas-reserva-y-pago]].
**HU-5.3 Saldo vencido** · Must · VN 4 · S

```gherkin
Escenario: saldo no pagado al vencer el plazo
  Dado una reserva "partially_paid" cuyo plazo venció
  Entonces aparece en la bandeja "Saldos vencidos" del backoffice
  Y el estado no cambia automáticamente hasta que el cliente defina la política (pregunta abierta)
```

**HU-5.4 Registro manual del saldo** · Must · VN 5 · S — el asesor registra pago en efectivo,
transferencia o POS al llegar, con comprobante adjunto y usuario responsable; el sistema emite el
comprobante SUNAT.

```gherkin
Escenario: monto mayor al saldo
  Cuando el asesor registra USD 600 sobre un saldo de USD 500
  Entonces el sistema lo rechaza con "El monto supera el saldo pendiente"
```

---

## E6 — Cuenta de cliente

**HU-6.1 Registro e inicio de sesión** · Should · VN 3 · M — correo + contraseña o enlace mágico;
checkout como invitado siempre disponible.
**HU-6.2 Mis reservas** · Should · VN 4 · M — ver estado, saldo, fechas, vouchers y comprobantes;
pagar saldo desde la cuenta.

```gherkin
Escenario: reserva hecha como invitado
  Dado una reserva hecha como invitado con correo a@b.com
  Cuando el cliente crea su cuenta con a@b.com y verifica el correo
  Entonces ve esa reserva en "Mis reservas"

Escenario: sesión expirada
  Dado una sesión vencida
  Cuando el cliente intenta abrir "Mis reservas"
  Entonces se le pide iniciar sesión y vuelve a la misma página después
```

**HU-6.3 Solicitar cambio o cancelación** · Should · VN 3 · M — solicitud con motivo; el sistema
muestra la penalidad estimada según política; la aprobación la hace el staff.
**HU-6.4 Derechos ARCO** · Must · VN 5 (legal) · S — descargar/rectificar/eliminar datos personales y
retirar consentimiento publicitario.
**HU-6.5 Lista de deseos** · Could · VN 1 · S.

---

## E7 — Backoffice

**HU-7.1 Gestionar tours** · Must · VN 5 · L
Como administrador quiero crear, editar, publicar y despublicar tours (textos es/en, itinerario,
incluye/no incluye, imágenes, categorías, destinos, duración, mínimo de pasajeros, dificultad) para
mantener el catálogo sin depender de un programador.

```gherkin
Escenario: publicar requiere datos mínimos
  Dado un tour sin imagen principal o sin itinerario
  Cuando el administrador intenta publicarlo
  Entonces se bloquea con la lista de campos faltantes

Escenario: cambio de slug
  Cuando el administrador cambia el slug de un tour publicado
  Entonces se crea automáticamente una redirección 301 desde el slug anterior

Escenario: edición concurrente
  Dado dos usuarios editando el mismo tour
  Cuando el segundo guarda
  Entonces ve "Este tour fue modificado por <usuario>" y no sobrescribe sin confirmar
```

**HU-7.2 Gestionar precios y tarifas** · Must · VN 5 · L — tarifa por tipo de pasajero (adulto, menor,
estudiante, adulto mayor), residencia (nacional/CAN/extranjero), moneda, temporada, vigencia y
suplemento individual; precio "desde" calculado.

```gherkin
Escenario: vigencias superpuestas
  Cuando el administrador crea una tarifa cuya vigencia se superpone con otra del mismo tipo
  Entonces se rechaza indicando la tarifa en conflicto

Escenario: cambio de precio no afecta reservas existentes
  Dado reservas pagadas con la tarifa anterior
  Cuando se actualiza la tarifa
  Entonces esas reservas conservan su precio
```

**HU-7.3 Temporadas y feriados** · Must · VN 4 · M — calendario de temporadas (alta/baja/feriados
largos) que las tarifas referencian; fechas bloqueadas (p. ej. cierre del Camino Inca en febrero).
**HU-7.4 Salidas y cupos** · Must · VN 5 · L — salidas por fecha con capacidad, cierre de ventas N
horas antes, cupos de terceros (boletos Machu Picchu, tren) y carga masiva por rango de fechas.

```gherkin
Escenario: reducir capacidad por debajo de lo vendido
  Dado una salida con 10 cupos vendidos
  Cuando el operador intenta bajar la capacidad a 8
  Entonces se rechaza con "Hay 10 cupos vendidos"

Escenario: sobreventa imposible
  Dado 1 cupo libre y dos checkouts simultáneos
  Entonces solo uno obtiene el hold
```

**HU-7.5 Gestionar reservas** · Must · VN 5 · L — búsqueda por código, cliente, fecha, estado; detalle
con pasajeros, pagos e historial; crear reserva manual (venta telefónica/WhatsApp); cambiar fecha;
cancelar con cálculo de penalidad; exportar a Excel; manifiesto de pasajeros por salida para operaciones.
**HU-7.6 Gestionar pagos y reembolsos** · Must · VN 5 · M — ver pagos por reserva, conciliación con la
pasarela, registrar pagos manuales, iniciar reembolsos totales/parciales con nota de crédito.

```gherkin
Escenario: reembolso mayor a lo pagado
  Cuando el contador intenta reembolsar más de lo pagado neto
  Entonces se rechaza

Escenario: trazabilidad
  Entonces todo pago manual, reembolso o cambio de estado registra usuario, fecha y motivo (auditoría)
```

**HU-7.7 Roles y permisos** · Must · VN 5 · M — administrador, asesor, operaciones, contador, editor de
contenido; MFA obligatorio para administrador y contador.
**HU-7.8 Tablero** · Should · VN 3 · M — ventas del día/mes, adelantos vs saldos pendientes, saldos
vencidos, ocupación por salida.
**HU-7.9 Proveedores y costos/comisiones** · Won't (MVP) · VN 3 — depende de respuestas del cliente.

---

## E8 — Libro de reclamaciones y legales

**HU-8.1 Libro de Reclamaciones virtual** · Must · VN 5 (legal) · M
Como consumidor quiero registrar un reclamo o queja en línea para que la agencia lo atienda en el plazo
legal.

```gherkin
Escenario: registro de reclamo
  Dado el enlace "Libro de Reclamaciones" visible en la home y en el pie
  Cuando el consumidor completa la hoja (datos, bien contratado, monto, detalle, pedido) y envía
  Entonces recibe la hoja con correlativo anual y fecha por correo, y puede descargarla en PDF
  Y el staff recibe la alerta con el plazo de respuesta legal (pendiente de confirmar con compliance)

Escenario: menor de edad
  Cuando el consumidor indica ser menor de edad
  Entonces se exigen los datos del padre, madre o apoderado

Escenario: doble envío
  Cuando pulsa "Enviar" dos veces
  Entonces se crea una sola hoja
```

**HU-8.2 Gestión de reclamos en backoffice** · Must · VN 5 · M — bandeja con vencimientos, respuesta
y archivo histórico.
**HU-8.3 Datos del proveedor visibles** · Must · VN 5 · S — razón social, **RUC real** (el viejo
muestra el placeholder 20000000000), dirección, registro MINCETUR, en pie de página y comprobantes.
**HU-8.4 Términos, privacidad, cookies, ESNNA** · Must · VN 5 · S — páginas legales y banner de cookies
con rechazo igual de fácil que aceptar.

---

## E9 — Contenido / blog

**HU-9.1 Blog migrado** · Should · VN 3 · M — 6 posts con su slug, fecha, imágenes re-alojadas y SEO.
**HU-9.2 Editor de posts** · Should · VN 3 · M — borrador/publicado, programar publicación, enlazar
tours relacionados.
**HU-9.3 Páginas institucionales** · Must · VN 3 · S — Nosotros, Contacto, Testimonios, Preguntas
frecuentes generales, con el rebranding a Peru Wonders Tours (el viejo mezcla "Andean Peru Tours" y
"TURINETCUZCO").
**HU-9.4 Formulario de testimonio** · Could · VN 2 · S — con moderación antes de publicar.

---

## E10 — i18n es / en

**HU-10.1 Sitio en español (es-PE)** · Must · VN 5 · M — idioma por defecto, rutas `/es/...`.
**HU-10.2 Sitio en inglés** · Should · VN 4 · L — rutas `/en/...`, selector de idioma que mantiene la
página equivalente, `hreflang`.

```gherkin
Escenario: tour sin traducción
  Dado un tour sin versión en inglés
  Cuando el visitante cambia a inglés
  Entonces el tour no aparece en el listado en inglés y su URL /en/ responde 404 con enlace al español
  (no se mezcla texto en dos idiomas)

Escenario: correos y comprobantes en el idioma del cliente
  Dado un checkout hecho en inglés
  Entonces los correos de confirmación y recordatorios llegan en inglés
```

**HU-10.3 Moneda y formato regional** · Must · VN 4 · S — PEN/USD, fechas en `America/Lima`, formato
de números según idioma.
**HU-10.4 Traducción de contenido** · Should · VN 3 — la traducción de los 41 tours es tarea del
cliente o de un traductor (pregunta abierta); el backoffice muestra el estado de traducción por tour.
**HU-10.5 Portugués** · Won't (MVP).

---

## Requisitos no funcionales (resumen)

- La ficha y el listado cargan con LCP < 2,5 s en 4G (p75); imágenes en AVIF/WebP responsivas.
- El checkout soporta concurrencia sin sobreventa (garantía en base de datos, ver [[concepts/modelo-de-datos]]).
- Todos los pagos y webhooks son idempotentes; no se almacenan datos de tarjeta.
- Accesibilidad WCAG 2.2 AA en todo el flujo de compra; `prefers-reduced-motion` respetado.
- Disponibilidad objetivo 99,5 % mensual; alertas si falla la pasarela o los webhooks.
- Auditoría de toda acción del staff sobre reservas, pagos, tarifas y reclamos.

## Manejo de errores (bordes transversales)

| Situación | Comportamiento esperado | Historias |
|---|---|---|
| Sin cupo | Bloquea pago, sugiere fechas cercanas, no cobra | HU-1.3, HU-3.3, HU-4.3 |
| Pago rechazado | Mensaje claro, hold se mantiene, reintento con otro medio | HU-4.4 |
| Doble clic | Una sola operación (idempotencia + botón deshabilitado) | HU-3.1, HU-4.4, HU-8.1 |
| Sesión/hold expirado | Libera cupo, explica y permite reintentar | HU-4.3, HU-6.2 |
| Cambio de tarifa en checkout | Aceptación explícita antes del hold; congelado después | HU-3.3, HU-4.3, HU-7.2 |
| Webhook duplicado/tardío | Registro único; reasignar cupo o reembolso automático | HU-4.4 |
| Enlace de saldo reutilizado | No cobra dos veces | HU-5.1 |
| Edad/tarifa inconsistente | Error y recálculo con confirmación | HU-4.1 |

## Checklist de implementación (por orden)

- [ ] ADR de pasarela de pagos y de proveedor OSE/PSE (bloquea E4–E5).
- [ ] Seed desde `data/seed/` + redirecciones (E0).
- [ ] Backoffice de tours, tarifas, temporadas y salidas (E7.1–7.4).
- [ ] Listado, búsqueda y ficha (E1, E2).
- [ ] Carrito con revalidación (E3).
- [ ] Checkout con hold, adelanto/100 % y pasarela en modo prueba (E4).
- [ ] Saldo: enlace, recordatorios, registro manual (E5).
- [ ] Libro de reclamaciones y legales (E8) — revisión de `compliance-peru-analyst`.
- [ ] Cuenta de cliente y ARCO (E6).
- [ ] Blog e inglés (E9, E10).
- [ ] E2E de todos los bordes de la tabla anterior (`qa-automation-senior`).

---

## Preguntas abiertas para el cliente

**Pagos y políticas**
1. ¿Se mantiene la **comisión de 3,5 %** por tarjeta? ¿Se cobra al cliente (visible antes de pagar) o la
   absorbe la agencia?
2. **Política de cancelación del adelanto**: tabla de penalidades por tramos (p. ej. > 20 días hábiles,
   20–8, < 7 días). Hoy dice "20 días hábiles" y "unos días antes: sin devolución". ¿Qué porcentaje se
   devuelve en cada tramo?
3. **Reembolsos**: ¿por el mismo medio de pago? ¿Plazo? ¿Se ofrece crédito/cambio de fecha en lugar de
   devolución?
4. **Plazo del saldo**: ¿se confirma "7 días antes del servicio"? ¿Qué pasa si no se paga: se cancela
   automáticamente y se retiene el adelanto, o se da prórroga?
5. ¿Se puede **pagar el saldo en destino** (efectivo/POS en oficina Cusco/Puno/Arequipa)?
6. La política actual dice que la reserva solo es válida con el **pago total**: ¿confirmamos que con el
   50 % la reserva queda confirmada?
7. ¿Tours con **boleto Machu Picchu, tren o sobrevuelo de Nazca** exigen pagar el 100 % de ese
   componente al reservar?
8. ¿Política de cambio de fecha y su penalidad?

**Precios y tarifas**
9. Lista de **precios** de los 41 tours (ninguno está publicado). ¿Exportable desde el OTM?
10. ¿Tarifas distintas para **nacional / CAN / extranjero**? ¿Precio en PEN para nacionales y USD para
    extranjeros?
11. Descuentos y edades: **menores** (¿rango de edad? ¿infantes gratis?), **estudiantes** (¿ISIC?),
    **adultos mayores**.
12. **Temporadas**: fechas de temporada alta/baja y recargos en feriados (Semana Santa, Inti Raymi,
    Fiestas Patrias, Año Nuevo).
13. Precios de paquetes: ¿base doble? ¿suplemento individual? ¿categorías de hotel (3*/4*/5*)?
14. **Mínimo de pasajeros**: el sitio muestra "Mín. 2" en todo, incluso tours privados. ¿Es real? ¿Se
    vende a 1 pasajero con suplemento?
15. ¿Precio con o sin **IGV**? (¿Aplica exoneración por exportación de servicios a no domiciliados?)

**Operación y cupos**
16. ¿Qué tours son de **salida diaria** y cuáles por fecha fija? ¿Capacidad por salida?
17. ¿Con cuántas horas de anticipación se **cierran las ventas** por tour (Machu Picchu suele requerir días)?
18. ¿Quién gestiona el **cupo de boletos de Machu Picchu y tren**? ¿Hay integración con algún proveedor o
    se carga a mano?
19. Hay ~9 tours **despublicados** en el OTM (los conteos no cuadran). ¿Se migran?
20. Seis tours no tienen categoría y tres paquetes no tienen destino. ¿Dónde deben aparecer?
21. "Arequipa: Ruta Rápida" figura como 1D pero el título dice 3D/2N: ¿cuál es correcto?

**Empresa y legal**
22. **Razón social y RUC** de Peru Wonders Tours (el sitio muestra un RUC placeholder y "quienes somos"
    menciona otra razón social). Registro MINCETUR/DIRCETUR.
23. Proveedor de **facturación electrónica** (OSE/PSE) y si emiten factura a extranjeros.
24. Pasarela preferida y si ya tienen **cuenta comercial** (Niubiz aparece en las FAQ actuales).
25. ¿Se venden **servicios de terceros** (hoteles, vuelos) con comisión o solo tours propios?

**Contenido**
26. ¿Quién traduce los tours al **inglés**? ¿Se necesita portugués?
27. ¿Se conservan los nombres "Cuzco" o "Cusco" en URLs y textos? (el viejo usa ambos).
28. Logo final y paleta de colores (requisito de cambio de colores).
