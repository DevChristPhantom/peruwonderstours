---
type: concept
title: Benchmark OTA de tours y experiencias 2025-2026
status: active
created: 2026-10-08
updated: 2026-10-08
tags:
  - benchmark
  - producto
  - backlog
  - ota
  - tendencias-2026
---

# Benchmark OTA 2025-2026 y qué conviene a Peru Wonders Tours

Autor: agente `product-owner-turismo`. Contexto: [[concepts/alcance-cliente-v1]], [[concepts/backlog-mvp]],
[[negocio/reglas-reserva-y-pago]], [[normativa/informacion-al-consumidor]], [[normativa/proteccion-de-datos]].
Lo que ya existe (Sprint 0-1): catálogo de 41 tours, carrito, checkout 50 %/100 % con hold y precio
congelado, pago del saldo, Libro de Reclamaciones y políticas en borrador.

## Método y límites (leer antes de usar)

- Búsqueda web del 2026-10-08. Cada hallazgo lleva una referencia `[n]` a la lista del final, con URL y
  fecha de publicación cuando la fuente la da.
- **Se alcanzó el límite de búsquedas de la sesión** antes de terminar. Quedaron **sin verificar**:
  agencias top de Cusco y Puno, programas de lealtad (Viator, Klook, Booking Genius), multimoneda,
  filtros de accesibilidad y sostenibilidad, mapas y chat en vivo en cada plataforma. En la tabla eso se
  marca con `?` (no verificado), **no** con "No". Antes de presentar esto al cliente como "lo que hace la
  competencia", completar esas celdas (tarea abierta al final).
- Algunas fuentes son secundarias (tiendas de apps, blogs, agregadores). Se indica en la referencia.
- No se inventan funcionalidades: si no hay fuente, la celda queda `?`.

## 1. Funcionalidades × plataformas (verificado)

Leyenda: **Sí** = verificado con fuente · **Beta** = en pruebas · **Parcial** = existe con límites ·
`?` = no verificado en esta sesión.

| Funcionalidad | GetYourGuide | Viator | Klook | Civitatis | Airbnb Exp. | Booking.com | Despegar | Expedia | Tiqets | Headout | Inca Rail | PeruRail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Reserva ahora, paga después | Sí [1] | Sí, cobro 2 días antes [3] | ? | ? | ? | ? | ? | ? | ? | Sí [12] | ? | ? |
| Cancelación gratuita (por producto) | Sí, hasta 24 h [1] | Sí, 24 h; excepto "All Sales Final" [3] | ? | Parcial: varía por actividad [9] | ? | ? | ? | ? | ? | Parcial: según ficha [13] | Cambios hasta 24 h (72 h con servicios extra); tarifas promo sin cambios [15] | ? |
| Confirmación instantánea | Sí [1] | ? | ? | ? | ? | ? | ? | ? | Sí [14] | Sí [12] | ? | ? |
| Asistente IA conversacional | Sí, app en ChatGPT (abr 2026) [4] | ? | Beta: agente que busca, reserva y atiende posventa (jun 2026) [6] | ? | ? | Parcial: Q&A con IA sobre el alojamiento [7] | Sí: SOFIA, voz/texto/imagen, ~1 M conversaciones/mes [10] | Sí: Romie (EG Labs, 2024), también por WhatsApp [11] | ? | ? | ? | ? |
| Búsqueda en lenguaje natural / personalizada | Sí, búsqueda personalizada (2026) [5] | ? | Beta [6] | ? | ? | Sí, Smart Filter con IA (alojamiento) [7] | ? | Sí [11] | ? | ? | ? | ? |
| Resumen de reseñas con IA | Sí, desde reseñas verificadas [5] | Sí (fuente indirecta) [8] | ? | ? | ? | Anunciado [7] | ? | ? | ? | ? | ? | ? |
| Reseñas verificadas / con fotos | Sí, verificadas [5] | Sí, etiqueta "Verified" y fotos (fuente indirecta) [8] | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Itinerario / planificador | ? | ? | Sí, AI Trip Planner [6] | ? | ? | ? | Sí, SOFIA de la idea al regreso [10] | Sí, Romie arma itinerarios [11] | ? | ? | ? | ? |
| Wishlist | Sí [2] | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Voucher en app sin conexión (QR) | Sí [2] | ? | ? | ? | ? | ? | ? | ? | Sí, QR offline + app de escaneo [14] | ? | ? | ? |
| Gift cards | Sí [2] | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Add-ons / venta cruzada | ? | ? | Sí: traslados, seguros, autos, combos con hotel [6] | ? | Sí: "Services" (chef, masajes...) [16] | ? | ? | ? | Sí: comida, parking [14] | ? | Servicios adicionales [15] | ? |
| Packaging (combo experiencia + transporte/hotel) | ? | ? | Sí, combos con hotel [6] | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Soporte 24/7 multicanal | Sí [1] | ? | ? | ? | ? | ? | Sí, SOFIA 24/7 [10] | ? | ? | Sí [12] | ? | ? |
| WhatsApp como canal | ? | ? | ? | ? | ? | ? | ? | Sí, Romie [11] | ? | ? | ? | ? |
| Medios de pago | ? | ? | ? | Orquestación con Checkout.com [9b] | ? | ? | ? | ? | ? | ? | Tarjetas, PayPal, Apple Pay [15] | Orquestación con Yuno (jun 2025) [17] |
| Experiencias de anfitriones locales | ? | ? | ? | ? | Sí, relanzado 13-may-2025, 650 ciudades [16] | ? | ? | ? | ? | ? | n/a | n/a |

Contexto de mercado Perú: Yape y Plin dominan los pagos móviles entre personas y comercios [18].

**Lectura del PO**: el patrón común 2025-2026 es (a) **reducir el riesgo de reservar** (cancelación
gratuita visible, paga después, confirmación instantánea), (b) **confianza** (reseñas verificadas y
resumidas), (c) **IA en el descubrimiento y la posventa**, y (d) **vender más por pedido** (add-ons,
combos). Peru Wonders ya tiene parte de (a) con el adelanto del 50 %.

## 2. Evaluación por funcionalidad para Peru Wonders

Esfuerzo con nuestro stack (Next.js 16 + NestJS + PostgreSQL): **S** ≤ 3 días · **M** 1-2 semanas ·
**L** > 2 semanas. Valor: alto / medio / bajo.

| # | Funcionalidad | Valor | Por qué en el sur del Perú | Esf. | Dependencias / costos | Riesgo legal Perú |
|---|---|---|---|---|---|---|
| F1 | Cancelación gratuita visible por tour ("gratis hasta el 12 nov") | Alto | El turista extranjero reserva con 1-3 meses; la duda principal es "¿y si cambio de plan?". Tours de Puno sin terceros (Uros, Taquile, Sillustani) pueden ofrecerla; los que emiten boleto MP/tren no (RN-11). | S-M | Ninguna técnica; **decisión del cliente** sobre plazos por tour. | Debe mostrarse antes del pago y cumplirse (Código de Consumo; ver [[normativa/informacion-al-consumidor]]). Hoy RN-04 dice 20 días hábiles: la insignia debe reflejar eso, no "24 h" copiado de GYG. |
| F2 | Reserva ahora, paga después (0 % hoy) | Medio | Ya existe el 50 %. El 0 % sube conversión pero arriesga cupos de alta temporada (jun-ago, Inti Raymi, Fiestas Patrias) y no-shows. | M | Tokenizar tarjeta y cobrar luego: requiere pasarela con tokenización (Izipay/Niubiz/MP/Culqi). | Informar fecha y monto exacto del cobro futuro; consentimiento expreso para el cargo diferido. |
| F3 | Confirmación instantánea vs. "a solicitud" | Alto | Salidas propias de Puno: instantánea. Paquetes con Cusco/MP dependen de boletos: deben decir "confirmación en X horas". | S | Ninguna. | Engaño si se dice "confirmada" sin cupo real (DL 1044, actos de engaño). |
| F4 | Wishlist (favoritos) | Medio | Viaje largo y planeado en pareja/familia; compartir lista ayuda a cerrar. | S | Ninguna (anónimo en el navegador; en cuenta cuando exista E6). | Ninguno si es anónimo; con cuenta, dato personal (Ley 29733). |
| F5 | Reseñas verificadas con fotos | Alto | Agencia pequeña sin marca conocida: la confianza decide la compra frente a GYG/Viator. | M | Ninguna (almacenamiento de imágenes en el propio servidor). | Publicar todas las reseñas, no solo las buenas; no incentivar sin decirlo (DL 1044). Fotos con personas = dato personal: consentimiento y retirada. Prevención ESNNA: no publicar fotos de menores. |
| F6 | Resumen de reseñas con IA | Bajo (hoy) | Con pocas reseñas no aporta; sirve con > 50 por tour. | S | Proveedor de IA (costo por uso). | Debe rotularse como generado por IA; no tergiversar. |
| F7 | Búsqueda en lenguaje natural ligera (reglas, sin IA) | Medio | "full day titicaca en julio para 4" → filtros. Cubre el 80 % sin costo. | M | Ninguna. | Ninguno. |
| F8 | Asistente IA conversacional (web y WhatsApp) | Medio-alto | Hoy las ventas pasan por WhatsApp con un asesor; la IA puede responder FAQ (altura, clima, qué llevar) 24/7 en inglés. | L | Proveedor de IA (API de pago), base de conocimiento, guardrails, revisión humana. Si va por WhatsApp: WhatsApp Business Platform. | Flujo transfronterizo de datos (Ley 29733 y D.S. 016-2024-JUS): informar y registrar; no prometer precios/cupos que el sistema no confirme; aviso de que es un bot. |
| F9 | Itinerario personalizado / "Mi viaje" | Alto | El sur se vende en circuito: Lima-Arequipa-Colca-Puno-Cusco. Ver el carrito como plan día a día, con traslados y alertas de choque (HU-3.4) y de aclimatación, es un diferencial. | M | Ninguna (versión sin IA). La versión que "sugiere" itinerarios con IA: ver F8. | Información de salud (soroche) solo como recomendación general, no consejo médico. |
| F10 | Comparador de tours (2-3 lado a lado) | Medio | Hay tours casi iguales (Uros vs. Uros + Taquile; full day vs. 2D/1N Amantaní): ayuda a elegir y a subir ticket. | S | Ninguna. | Ninguno (comparación de productos propios). |
| F11 | Mapa de punto de recojo y ruta | Medio | Recojo en hoteles de Puno/Juliaca; rutas en lago. | S-M | Mapas: OpenStreetMap sin costo con política de uso justo; Google Maps con API de pago. | Ninguno. |
| F12 | Cupo en tiempo real ("quedan 3") | Medio | Dato ya existe en `departures`. Útil en alta temporada. | S | Ninguna. | Solo si es verdadero y actual (DL 1044). Nunca contadores falsos. |
| F13 | Add-ons y upsells (traslado aeropuerto Juliaca, almuerzo, noche extra, fotos, equipo) | Alto | Sube el ticket promedio sin costo de adquisición; traslados JUL-Puno son necesarios para casi todos. | M | Lista de precios del cliente. Seguro de viaje = aseguradora (Ola B). | Opt-in, nunca pre-marcados; precio total visible. |
| F14 | Packaging dinámico (combo con descuento) | Medio-alto | Combos Puno + Cusco + Arequipa con precio único. | M (reglas) / L (con hoteles y trenes) | Reglas internas = sin terceros. Con trenes/hoteles: APIs B2B de PeruRail/Inca Rail/hoteleras (contratos). | Si incluye transporte + alojamiento, revisar obligaciones de agencia (MINCETUR) y desglose de impuestos. |
| F15 | WhatsApp: enlace contextual (click-to-chat) | Alto | Canal dominante en Perú y del propio cliente. | S | Ninguna (enlaces wa.me). | Ninguno; no enviar datos personales en la URL. |
| F16 | WhatsApp Business API (notificaciones, catálogo, pago) | Alto | Voucher, recordatorio del saldo y punto de recojo por WhatsApp. | M | Cuenta Meta Business verificada + proveedor (BSP); costo por conversación. | Consentimiento previo para mensajes; plantillas aprobadas; Ley 29733. |
| F17 | Yape / Plin | Alto | Cliente nacional (feriados, Fiestas Patrias, Semana Santa) paga así [18]. | M | Vía pasarela (HU-4.5). | Comprobante SUNAT por cada pago. |
| F18 | Cuotas sin intereses | Medio | Paquetes largos de S/ 2 000+ para turismo nacional. | S (si la pasarela lo trae) | Pasarela + acuerdos con bancos. | Informar TCEA si hubiera intereses. |
| F19 | Multimoneda (mostrar EUR, BRL, etc.) | Bajo-medio | Cobrar en PEN/USD basta; mostrar referencia en EUR/BRL ayuda poco. | S | Fuente de tipo de cambio (BCRP es pública; verificar API). | Rotular como "referencial"; se cobra en PEN/USD. |
| F20 | Accesibilidad (atributos y filtros: altitud, esfuerzo, silla de ruedas, apto niños/mayores) | Alto | Puno está a ~3 800 m: la altitud es la pregunta más frecuente; adultos mayores son público clave. Además WCAG 2.2 AA ya es requisito. | S | Datos del cliente por tour. | No afirmar "accesible" sin verificarlo (engaño). |
| F21 | Sostenibilidad: turismo comunitario y prácticas | Medio | Uros, Taquile, Amantaní y Llachón son turismo vivencial: es contenido real y diferencial. | S | Ninguna. | Evitar "greenwashing": nada de "carbono neutral" sin medición (DL 1044). |
| F22 | Huella de carbono calculada | Bajo | Poca demanda del público actual; método discutible. | M | Factores de emisión de terceros. | Riesgo de afirmación no sustentada. |
| F23 | Gift cards | Medio | Regalo de viaje (aniversarios, Navidad); cash por adelantado. | M | Pasarela existente. | **Decisión contable y legal del cliente**: tratamiento SUNAT (anticipo), vigencia, reembolso, reglas de consumo sobre vencimiento (pregunta para `compliance-peru-analyst`). |
| F24 | Referidos / cupones | Medio | Boca a boca de mochileros y grupos. | M | Ninguna (cupones = HU-3.5). | Bases de la promoción visibles; envíos comerciales con consentimiento (Ley 28493). |
| F25 | Lealtad con puntos | Bajo | Turismo de una sola vez por destino; recompra baja salvo nacionales. | L | Ninguna técnica, pero pasivo contable. | Bases, vigencia, pasivo. |
| F26 | Voucher PWA offline con QR | Alto | En el lago Titicaca y en Colca no hay señal: el voucher debe abrir sin internet. | M | Ninguna. Apple/Google Wallet: cuentas de desarrollador (Ola B). | QR sin datos personales legibles; token firmado. |
| F27 | Chat en vivo | Medio | Ya existe WhatsApp humano; chat web duplica canal. | S | Herramienta de chat (gratuita o de pago). | Aviso de privacidad del tercero; transferencia de datos. |
| F28 | Precios dinámicos | Bajo (opacos) / Medio (reglas transparentes) | Temporadas y feriados ya son precio por calendario (RN-20). Ofertas "early bird" claras sí. | M | Ninguna. | Ver sección 4. |
| F29 | Distribuir los tours en Viator/GYG/Civitatis | Alto (canal) | La competencia es también canal de venta para una agencia pequeña. | M-L | Cuenta de proveedor, comisión del marketplace, channel manager o API. | Paridad de precios y condiciones coherentes. **Decisión comercial**. |
| F30 | Alertas de precio/cupo por correo | Bajo-medio | Útil para Inti Raymi y Año Nuevo en el lago. | S | Proveedor de correo (ya previsto en Sprint 2). | Consentimiento expreso (Ley 28493 / 29733). |

## 3. Recomendación en tres olas

Convención de historias igual que [[concepts/backlog-mvp]]. Las HU nuevas usan el prefijo **HU-B**
(benchmark). Dependencias explícitas en cada una.

### Ola A — implementable YA, sin terceros ni costos

Orden sugerido (valor/esfuerzo): A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8 → A9 → A10.

**HU-B.A1 Condiciones claras en la tarjeta y la ficha (cancelación, confirmación, pago)** · Must · VN 5 · S
Depende de: política de cancelación por tour (pregunta abierta P-B1). Cubre F1 y F3.
Como viajero quiero ver en la tarjeta del tour si puedo cancelar sin costo, hasta cuándo, si la
confirmación es inmediata y cuánto pago hoy para reservar sin miedo.

```gherkin
Escenario: tour con cancelación gratuita
  Dado el tour "Islas Uros y Taquile" con cancelación sin costo hasta 20 días hábiles antes
  Y una fecha elegida 15 de diciembre de 2026
  Cuando el viajero ve la ficha
  Entonces ve "Cancelación gratuita hasta el <fecha calculada en hora de Lima>"
  Y ve "Hoy pagas 50 %: USD 60" y "Confirmación inmediata"

Escenario: tour con boletos no reembolsables
  Dado un paquete con boleto de Machu Picchu (componente no reembolsable)
  Entonces no muestra "Cancelación gratuita"
  Y muestra "Boletos de Machu Picchu y tren no reembolsables una vez emitidos"
  Y muestra "Confirmación en hasta 24 h" si el cupo de boletos se confirma manualmente

Escenario: plazo vencido
  Dado que la fecha límite de cancelación gratuita ya pasó para la fecha elegida
  Entonces la insignia no aparece y se muestra la penalidad aplicable

Escenario: política no cargada
  Dado un tour sin política de cancelación configurada
  Entonces no se muestra ninguna insignia y el tour no se puede publicar como reservable
```

**HU-B.A2 Voucher digital offline (PWA con QR)** · Must · VN 5 · M
Depende de: E4 (reserva confirmada), token de acceso a reserva (Sprint 1). Cubre F26.
Como viajero quiero abrir mi voucher sin internet en el lago o en Colca para mostrarlo al guía.

```gherkin
Escenario: guardar voucher
  Dado una reserva confirmada PWT-2026-000123
  Cuando el viajero abre "Mi voucher" y pulsa "Guardar en este dispositivo"
  Entonces el voucher queda disponible sin conexión con QR, fecha, hora y punto de recojo

Escenario: sin señal
  Dado que el teléfono está en modo avión
  Cuando abre el sitio desde la pantalla de inicio
  Entonces ve el voucher guardado con la marca "Actualizado el <fecha y hora>"

Escenario: reserva modificada
  Dado que operaciones cambió la hora de recojo
  Cuando el viajero vuelve a tener conexión
  Entonces el voucher se actualiza y muestra "Cambió la hora de recojo"

Escenario: QR sin datos personales
  Entonces el QR contiene solo un token firmado, nunca nombre ni documento
```

**HU-B.A3 Atributos de accesibilidad, altitud y esfuerzo + filtros** · Must · VN 4 · S
Depende de: datos por tour del cliente (altitud máxima, nivel, edad mínima). Cubre F20.
Como viajero mayor o con movilidad reducida quiero saber la altitud, el esfuerzo y la accesibilidad de
cada tour para elegir uno que pueda hacer.

```gherkin
Escenario: ficha con altitud
  Dado el tour "Sillustani" con altitud máxima 3 950 m y esfuerzo "bajo"
  Entonces la ficha muestra ambos datos y un enlace a "Recomendaciones para la altura"

Escenario: filtrar
  Cuando el viajero filtra "Esfuerzo bajo" y "Apto adultos mayores"
  Entonces ve solo tours con esos atributos

Escenario: dato desconocido
  Dado un tour sin dato de accesibilidad
  Entonces se muestra "Consúltanos" y el tour no aparece al filtrar por accesibilidad
```

**HU-B.A4 Wishlist (favoritos)** · Should · VN 3 · S — sustituye a HU-6.5
Depende de: nada (anónimo). Fusión con cuenta depende de E6. Cubre F4.
Como viajero quiero guardar tours y compartir la lista con mi acompañante para decidir juntos.

```gherkin
Escenario: guardar sin cuenta
  Cuando pulsa el corazón en una tarjeta
  Entonces el tour se guarda en este navegador y el contador de favoritos sube

Escenario: compartir
  Cuando pulsa "Compartir mi lista"
  Entonces obtiene un enlace con solo los identificadores de tours (sin datos personales)

Escenario: tour despublicado
  Dado un favorito que ya no está publicado
  Entonces aparece como "Ya no disponible" con tours similares

Escenario: almacenamiento bloqueado
  Dado un navegador en modo privado que bloquea el almacenamiento
  Entonces el corazón funciona durante la sesión y avisa que la lista no se conservará
```

**HU-B.A5 "Mi viaje": plan día a día del carrito** · Should · VN 4 · M
Depende de: E3 (carrito), HU-3.4 (choques). Cubre F9.
Como viajero que arma un circuito por el sur quiero ver mi carrito como itinerario por días, con avisos
de choques y de aclimatación, para no comprar algo imposible.

```gherkin
Escenario: vista de itinerario
  Dado un carrito con "City tour Arequipa" el 10/12, "Colca 2D/1N" el 11/12 y "Uros" el 13/12
  Cuando abre "Mi viaje"
  Entonces ve los días 10 a 13 en orden y el 12/12 como "día libre o traslado"

Escenario: choque de fechas
  Dado dos tours el mismo día en ciudades distintas
  Entonces ve "Estos tours se superponen" y no puede pagar sin cambiar uno o confirmar que es correcto

Escenario: aclimatación
  Dado que el primer tour en Puno es el mismo día de llegada desde Lima
  Entonces ve una recomendación (no bloqueante) de descansar un día a la llegada

Escenario: exportar
  Cuando pulsa "Descargar calendario"
  Entonces obtiene un archivo .ics con los tours y la hora de recojo en hora de Lima
```

**HU-B.A6 Reseñas verificadas con fotos y moderación** · Should · VN 5 · M
Depende de: E4 (reserva), correo transaccional (Sprint 2) para invitar a reseñar; mientras tanto, enlace
en el voucher. Backoffice de moderación (E7). Cubre F5.
Como viajero quiero leer reseñas de personas que sí hicieron el tour, con fotos, para confiar en una
agencia que no conozco.

```gherkin
Escenario: solo quien viajó
  Dado una reserva cuyo servicio terminó hace menos de 90 días
  Cuando el viajero abre el enlace de reseña de su voucher
  Entonces puede publicar puntaje 1-5, texto y hasta 5 fotos
  Y la reseña muestra "Reserva verificada" y el mes del viaje

Escenario: sin reserva
  Cuando alguien sin reserva intenta reseñar
  Entonces no puede hacerlo

Escenario: moderación sin censura
  Dado una reseña de 2 estrellas sin insultos ni datos personales
  Entonces se publica igual que una de 5 (solo se rechaza por reglas publicadas)

Escenario: fotos con menores
  Dado una foto donde aparece un menor identificable
  Entonces el moderador la rechaza y se avisa al autor

Escenario: respuesta de la agencia
  Cuando la agencia responde
  Entonces la respuesta aparece debajo con la etiqueta "Respuesta de Peru Wonders Tours"

Escenario: doble envío
  Cuando el viajero pulsa "Publicar" dos veces
  Entonces se crea una sola reseña por reserva
```

**HU-B.A7 Add-ons operados por la agencia** · Should · VN 5 · M
Depende de: precios de add-ons del cliente (P-B3); E3/E4 (se suman al hold y al 50 %). Cubre F13.
Como viajero quiero añadir traslado desde el aeropuerto de Juliaca, almuerzo u otros extras al reservar
para resolver todo en una compra.

```gherkin
Escenario: añadir extra
  Dado el tour "Uros y Taquile" con extra "Traslado aeropuerto Juliaca - hotel Puno" USD 25 por grupo
  Cuando el viajero lo marca
  Entonces el total y el adelanto de 50 % se recalculan y el extra aparece en el desglose

Escenario: nunca pre-marcado
  Entonces todos los extras empiezan desmarcados

Escenario: extra sin cupo
  Dado que el extra tiene capacidad agotada en la fecha
  Entonces aparece deshabilitado con "No disponible para esta fecha"

Escenario: cambio de precio del extra en checkout
  Dado que el precio del extra cambió después de crear el hold
  Entonces se respeta el precio congelado del hold (RN-12)
```

**HU-B.A8 Comparador de tours** · Could · VN 3 · S — Cubre F10.
Como viajero quiero comparar hasta 3 tours lado a lado para elegir el que me conviene.

```gherkin
Escenario: comparar
  Cuando marca "Comparar" en 2 o 3 tarjetas
  Entonces ve una tabla con duración, precio desde, altitud, esfuerzo, incluye, cancelación y salidas

Escenario: cuarto tour
  Cuando intenta añadir un cuarto
  Entonces ve "Puedes comparar hasta 3 tours"
```

**HU-B.A9 Búsqueda por frase (reglas, sin IA)** · Could · VN 3 · M — amplía HU-1.2. Cubre F7.
```gherkin
Escenario: frase con destino, mes y personas
  Cuando busca "titicaca julio 4 personas"
  Entonces se aplican los filtros destino Puno, mes julio y 4 pasajeros, visibles y editables

Escenario: frase no entendida
  Cuando busca algo sin destino ni categoría reconocible
  Entonces se hace búsqueda de texto normal y no se aplican filtros ocultos
```

**HU-B.A10 WhatsApp contextual, cupo real y contenido de turismo comunitario** · Should · VN 4 · S
Cubre F12, F15 y F21.
```gherkin
Escenario: WhatsApp con contexto
  Dado el viajero en el paso de pago con un problema
  Cuando pulsa "Ayuda por WhatsApp"
  Entonces se abre un mensaje prellenado con el código de carrito o reserva (sin nombre ni documento)

Escenario: cupo real
  Dado una salida con 3 cupos libres de 12
  Entonces la ficha muestra "Quedan 3 lugares" solo si el dato tiene menos de 5 minutos
  Y nunca se muestran contadores de "personas viendo"

Escenario: sostenibilidad sin afirmaciones no medidas
  Dado un tour de turismo vivencial en Amantaní
  Entonces la ficha muestra la sección "Turismo comunitario" con hechos (quién recibe, qué incluye)
  Y no muestra afirmaciones de huella o neutralidad de carbono
```

### Ola B — requiere cuentas o servicios que el cliente debe contratar

| ID | Funcionalidad | Qué debe contratar | MoSCoW · VN · Esf. |
|---|---|---|---|
| B1 | Pasarela real con Yape/Plin, cuotas y tokenización (F17, F18) | Izipay/Niubiz/MP/Culqi (ADR pendiente) | Must · 5 · L |
| B2 | Reserva ahora, paga después 0 % para tours sin terceros (F2) | Tokenización en la pasarela | Could · 3 · M |
| B3 | WhatsApp Business API: voucher, recordatorio del saldo, cambio de recojo (F16) | Meta Business verificado + BSP; costo por conversación | Should · 5 · M |
| B4 | Asistente IA de FAQ y planificación en web (F8, F6) | Proveedor de IA; presupuesto mensual | Could · 4 · L |
| B5 | Gift cards (F23) | Decisión contable/legal; pasarela | Could · 3 · M |
| B6 | Seguro de viaje como add-on | Convenio con aseguradora | Could · 3 · M |
| B7 | Voucher en Apple/Google Wallet | Cuentas de desarrollador | Could · 2 · S |
| B8 | Alertas y correos de marketing (F30, F24) | Proveedor de correo | Could · 2 · S |
| B9 | Venta de los tours en Viator/GYG/Civitatis (F29) | Cuentas de proveedor; comisión | Should · 4 · M-L (decisión comercial) |

```gherkin
# B1 — Yape
Escenario: pago con Yape rechazado
  Dado un hold vigente y el viajero elige Yape
  Cuando la operación es rechazada o expira
  Entonces el hold se conserva hasta su vencimiento y puede reintentar con otro medio

# B2 — paga después
Escenario: cobro diferido
  Dado un tour sin componentes de terceros con salida a más de 30 días
  Cuando el viajero elige "Reserva hoy, paga después"
  Entonces ve "Se cobrará USD 240 el <fecha>" y debe aceptarlo expresamente
Escenario: cobro diferido rechazado
  Cuando el cobro programado es rechazado
  Entonces se notifica, se da 48 h para pagar con enlace y luego se libera el cupo

# B3 — WhatsApp
Escenario: sin consentimiento
  Dado un viajero que no aceptó mensajes por WhatsApp
  Entonces no recibe mensajes por ese canal (solo correo)

# B4 — asistente IA
Escenario: pregunta de precio
  Cuando el viajero pregunta "¿cuánto cuesta Uros el 28 de julio para 3?"
  Entonces el asistente responde con el precio que devuelve la API de cotización, no uno generado
Escenario: fuera de su alcance
  Cuando pregunta por requisitos migratorios o salud
  Entonces responde con información general y deriva a un asesor humano
Escenario: aviso
  Entonces el chat indica que es un asistente automático y enlaza la política de privacidad
```

### Ola C — a futuro

- **C1 Agente IA que reserva y atiende posventa** (como el beta de Klook [6] o SOFIA de Despegar [10]),
  cuando la Ola B4 tenga métricas.
- **C2 Packaging dinámico con trenes y hoteles** (APIs B2B de PeruRail/Inca Rail y hoteles; contratos).
- **C3 Presencia en asistentes externos** (app en ChatGPT como GYG [4]) — requiere API pública de catálogo.
- **C4 Lealtad/referidos con saldo**, si los datos muestran recompra (nacionales).
- **C5 App nativa** solo si la PWA no basta.
- **C6 Precios por reglas transparentes** (early bird, último minuto) publicados como reglas.

## 4. Lo que NO recomiendo (y por qué)

| No hacer | Motivo |
|---|---|
| Precios dinámicos opacos o personalizados por perfil, dispositivo o IP | Choca con el deber de informar el precio total y con prácticas abusivas del Código de Protección y Defensa del Consumidor (Ley 29571); daña la confianza en una agencia pequeña. La diferencia nacional/extranjero solo cuando la origina una tarifa oficial (p. ej. entradas) y se explica. |
| Urgencia falsa ("15 personas viendo", cuenta regresiva ficticia) | Acto de engaño (D. Leg. 1044). Solo cupo real (HU-B.A10). |
| Filtrar reseñas negativas o pagar por reseñas sin decirlo | D. Leg. 1044; riesgo de sanción de INDECOPI y reputacional. |
| Copiar "cancelación gratis hasta 24 h" de GYG/Viator | No coincide con la política publicada (RN-04: 20 días hábiles) ni con boletos no reembolsables (RN-11). |
| "Paga después" en paquetes con Machu Picchu o tren | La agencia debe emitir boletos con cupo limitado y no reembolsables; asumiría el riesgo. |
| Extras o seguros pre-marcados (opt-out) | Método comercial abusivo; el consumidor debe elegir activamente. |
| Asistente IA que cotiza o confirma por su cuenta | Alucinaciones = precio/cupo inexistente que hay que honrar. Debe consultar la API. |
| Enviar datos de clientes a IA externa sin informar | Flujo transfronterizo sin cláusula informativa (Ley 29733, D.S. 016-2024-JUS). |
| "Carbono neutral" o huella sin medición | Greenwashing = publicidad engañosa. |
| Programa de puntos ahora | Pasivo contable y bajo uso en turismo de una sola visita. |
| App nativa en el MVP | Costo alto; la PWA cubre voucher offline. |

## Preguntas abiertas para el cliente

- **P-B1** Política de cancelación por tour: ¿qué tours admiten cancelación sin costo y hasta cuándo? (bloquea HU-B.A1).
- **P-B2** ¿Se acepta "paga después" (0 %) en algún tour? ¿Con qué anticipación mínima?
- **P-B3** Lista y precios de extras (traslado aeropuerto Juliaca, almuerzo, noche extra, fotos).
- **P-B4** Datos por tour: altitud máxima, esfuerzo, edad mínima, accesibilidad.
- **P-B5** ¿Quiere vender también en Viator/GYG/Civitatis? ¿Con qué comisión máxima?
- **P-B6** Presupuesto mensual para WhatsApp Business API e IA.
- **P-B7** Gift cards: vigencia, reembolso y tratamiento contable (consultar con su contador).
- **P-B8** ¿Autoriza pedir reseñas por correo/WhatsApp tras el viaje?

## Tareas abiertas del benchmark

- Completar las celdas `?` (búsqueda interrumpida por límite de sesión): agencias top de Cusco y Puno,
  lealtad (Viator, Klook, Booking Genius), multimoneda, accesibilidad, sostenibilidad, mapas, chat en vivo,
  medios de pago de PeruRail.
- Verificar API de tipo de cambio del BCRP antes de usarla (F19).
- Pasar a `compliance-peru-analyst`: reseñas (D. Leg. 1044), gift cards, mensajes por WhatsApp, IA.

## Referencias (consultadas el 2026-10-08)

1. GetYourGuide, ficha de la app en App Store y fichas de producto (reserve now & pay later, cancelación 24 h, soporte 24/7, confirmación instantánea): https://apps.apple.com/app/id705079381 y https://www.getyourguide.com/antwerp-l1028/antwerp-historical-walking-tour-and-pub-crawl-t585332/ — sin fecha de publicación.
2. GetYourGuide wishlist, tickets offline y gift cards (fuentes secundarias): https://www.antwort.net/a/technologie/wie-erhalte-ich-meine-tickets-oder-gutscheine-nach-der-buchung-in-der-getyourguide-app.html ; https://bitrefill.com/pl/en/gift-cards/getyourguide-poland — sin fecha.
3. Viator, Reserve Now & Pay Later (cobro 2 días antes, cancelación 24 h, "All Sales Final"): https://agentcenter.viator.com/resources/reserve-now-pay-later/ — sin fecha visible.
4. GetYourGuide, app en ChatGPT (catálogo desde 21-abr-2026) y nuevo CPO: https://www.phocuswire.com/getyourguide-194-million-global-expansion-ai-development — 2026.
5. Skift, "GetYourGuide's AI Updates Target the Gap Between Planning and Booking" (resúmenes de reseñas verificadas con IA, búsqueda personalizada, herramientas para operadores): https://skift.com/2026/04/22/getyourguide-ai-updates/ — 22-abr-2026. Lanzamiento de otoño 2025: https://www.phocuswire.com/getyourguide-experiences-ai-features-fall-product-release (no se pudo abrir, 403).
6. Skift, "Klook co-founder bets AI can finally fix travel experiences discovery" (agente en beta; traslados, seguros, autos, combos con hotel): https://skift.com/2026/06/09/klook-co-founder-bets-ai-can-finally-fix-travel-experiences-discovery/ — 09-jun-2026. AI Trip Planner: https://www.altexsoft.com/travel-industry-news/klook-tests-ai-agent-as-experiences-need-easier-search/.
7. Booking Holdings, "Booking.com enhances travel planning with new AI-powered features" (Smart Filter, Property Q&A, Review Summaries): https://www.bookingholdings.com/press-releases/booking-com-enhances-travel-planning-with-new-ai-powered-features-for-easier-smarter-decisions/ — fecha no confirmada (2025).
8. Viator, resumen de reseñas con IA, etiqueta "Verified" y fotos (fuente indirecta, Trustpilot/agregadores): https://www.trustpilot.com/review/www.viator.com?page=7 — consulta 2026-10-08. Verificar en viator.com.
9. Civitatis, condiciones de cancelación según actividad (reclamos públicos OCU, 2025): https://www.ocu.org/reclamar/lista-reclamaciones-publicas/cancelacion-reserva-a33823506/ed8517b0d3832ba9b0 . 9b. Checkout.com, caso Civitatis: https://www.checkout.com/es-es/case-studies/mas-aventuras-por-delante-civitatis-acelera-su-crecimiento-internacional-y-mejora-la-experiencia-de-pago-de-los-viajeros-con-checkout-com — sin fecha.
10. Despegar SOFIA (1 M de conversaciones mensuales, voz/texto/imagen, 24/7): https://www.excelsior.com.mx/nacional/ia-despegar-llega-millon-conversaciones-mensuales ; https://dplnews.com/?p=283356 — 2025.
11. Expedia Romie (mayo 2024, EG Labs, WhatsApp/iMessage, itinerarios): https://travelmarketreport.com/RetailStrategies/articles/Expedia-Unveils-Romie-an-AI-Powered-Travel-Planner — 2024.
12. Headout, "Headout Now, Pay Later": https://evanevans.headout.com/news/headout-launches-headout-now-pay-later — sin fecha visible.
13. Headout, política de cancelación por experiencia: https://hop-on-hop-off-tickets.com/cancellation-policy — sin fecha.
14. Tiqets, QR, offline, ScanApp y add-ons (fuente secundaria): https://www.thetraveler.org/tiqets-features-every-traveler-should-know-before-booking/ ; https://www.tiqets.com/en/apps — sin fecha.
15. Inca Rail, cambios y flexibilidad; medios de pago: https://incarail.com/en/flexibility-changes ; https://incarail.com/terms-and-conditions — consulta 2026-10-08 (vía resultados de búsqueda).
16. Airbnb relanza Experiences y lanza Services (13-may-2025, 650 ciudades): https://www.phocuswire.com/airbnb-summer-release-2025-experiences-services-short-term-rentals ; https://www.altexsoft.com/travel-industry-news/airbnb-relaunches-experiences-and-adds-services-will-travelers-care-this-time/ — mayo 2025.
17. Yuno, "PeruRail selects Yuno as payment orchestration partner": https://y.uno/newsroom/perurail-selects-yuno-as-payment-orchestration-partner-to-drive-efficiency-and-regional-growth — jun-2025.
18. Wise, medios de pago en Perú (Yape y Plin): https://wise.com/gb/hub/payment-methods/peru — sin fecha.
