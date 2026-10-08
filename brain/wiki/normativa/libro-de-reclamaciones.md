---
type: concept
title: Libro de Reclamaciones virtual — requisitos vigentes y especificación técnica
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - normativa
  - indecopi
  - libro-de-reclamaciones
  - consumidor
  - E8
---

# Libro de Reclamaciones virtual

Épica: [[concepts/backlog-mvp]] (E8, HU-8.1 y HU-8.2). Modelo: `complaints` en
`apps/api/prisma/schema.prisma` ([[concepts/modelo-de-datos]]). Relacionado:
[[normativa/proteccion-de-datos]], [[normativa/informacion-al-consumidor]].

> Página elaborada por `compliance-peru-analyst` el 2026-10-07. No es asesoría legal:
> los puntos marcados **[A VALIDAR CON ASESOR LEGAL]** deben confirmarse antes de producción.

## 1. Marco normativo vigente (verificado el 2026-10-07)

| Norma | Qué regula | Estado | Fuente consultada (2026-10-07) |
|---|---|---|---|
| Ley 29571, Código de Protección y Defensa del Consumidor, arts. 24, 150, 151, 152 | Obligación de atender reclamos; obligación de tener libro y aviso | Vigente, con modificaciones | Texto: https://diariooficial.elperuano.pe/Normas/obtenerDocumento?idNorma=17 (copia consolidada no oficial revisada: https://alertas.directoriolegislativo.org/wp-content/uploads/2023/05/CodigoDProteccionyDefensaDelConsumidor1-1.pdf) |
| Ley 32495 (El Peruano, 11-11-2025) | Modifica arts. 150 y 151: **toda plataforma digital de comercio electrónico** debe tener libro y exhibir **permanentemente** el enlace en lugar visible y fácilmente accesible | Vigente | https://busquedas.elperuano.pe/dispositivo/NL/2457203-1/ (texto leído en la reproducción de la página de El Peruano: https://img.lpderecho.pe/wp-content/uploads/2025/11/Ley-32495-LPDerecho.pdf) |
| Ley 31435 (2022) | Reduce el plazo de respuesta a 15 días hábiles | Vigente | Referida por el D.S. 101-2022-PCM y por https://prcp-r2-prd.postedin.com/Se-modifica-el-Reglamento-del-Libro-de-Reclamaciones-1-2.pdf. Texto de la ley no leído directamente **[A VALIDAR CON ASESOR LEGAL]** |
| D.S. 011-2011-PCM, Reglamento del Libro de Reclamaciones | Reglamento base | Vigente, modificado | https://www.inei.gob.pe/media/libro_reclamaciones/DS011_2011_PCM.pdf |
| D.S. 006-2014-PCM (El Peruano, 23-01-2014) | Arts. 4, 4-A (libro de respaldo), 4-B (proveedores virtuales), 5 (contenido de la hoja), 9 y Anexo III (aviso web), 12 (conservación), Anexos IV y V (infracciones) | Vigente | https://busquedas.elperuano.pe/normaslegales/decreto-supremo-que-modifica-el-reglamento-del-libro-de-recl-ds-n-006-2014-pcm-1041477-1/ ; texto íntegro: https://faolex.fao.org/docs/pdf/per130742.pdf |
| D.S. 058-2017-PCM (El Peruano, 29-05-2017) | Art. 6-A: solución directa aceptada por el consumidor | Vigente (plazo de suspensión modificado en 2022) | https://faolex.fao.org/docs/pdf/per173073.pdf |
| D.S. 101-2022-PCM (El Peruano, 16-08-2022) | Art. 3.4 (queja), art. 6 (**15 días hábiles improrrogables**), suspensión por oferta de solución a 5 días hábiles, **nuevo Anexo I** | Vigente | https://busquedas.elperuano.pe/dispositivo/NL/2095978-1 ; Anexo I oficial: https://cdn.www.gob.pe/uploads/document/file/3510113/Anexo%20I%20DS%20N%20101-2022-PCM_.pdf.pdf |
| Proyecto de D.S. que adecúa el reglamento a la Ley 32495 (R.M. 244-2026-PCM, El Peruano, 18-07-2026) | Enlace visible y permanente en la página de inicio, **sin registro ni autenticación previa**, formulario adaptable a móvil, confirmación automática por correo, adjuntos, alertas de validación | **PROYECTO, no vigente** al 2026-10-07 (no se encontró publicación del decreto final) | https://busquedas.elperuano.pe/dispositivo/NL/2536260-1 ; resumen: https://www.cuatrecasas.com/es/latam/publico/art/se-propone-obligaciones-libro-reclamaciones-plataformas-digitales |

Decisión de diseño: **cumplir hoy el reglamento vigente y, por defecto, también lo que propone
el proyecto de 2026** (no exige trabajo extra relevante y evita rehacer el módulo cuando se
apruebe). Revisar El Peruano antes de cada release de E8.

## 2. Requisitos vigentes

### 2.1 Quién está obligado y cuántos libros
- Peru Wonders Tours vende por web (proveedor virtual, art. 3.6) **y** tiene oficina en Puno
  (establecimiento abierto al público). Debe tener:
  1. **Libro de Reclamaciones Virtual** alojado en la página de inicio del portal (art. 4-B) y,
     por Ley 32495, enlace exhibido **permanentemente**.
  2. En la oficina de Puno: libro (físico o virtual con soporte al consumidor, art. 4) y
     **aviso** en formato Anexo II (mín. A4; letras de "Libro de Reclamaciones" ≥ 1×1 cm).
  3. Como usa libro virtual, un **"Libro de Reclamaciones de Respaldo"** físico en el
     establecimiento para cuando el virtual no esté disponible; lo registrado en él se
     transcribe al virtual, con su número de hoja, en **1 día calendario** desde que el
     virtual vuelva a estar habilitado (art. 4-A).
  4. Si hay más oficinas (Cusco, Arequipa: el sitio viejo las menciona), un libro por
     establecimiento y un **código de identificación** para consolidar en registro único (arts. 7 y 8).
     **[POR CONFIRMAR con el cliente: número de establecimientos con RUC/anexo SUNAT]**.
- Debe brindarse apoyo al consumidor para registrar bien su reclamo (art. 4).

### 2.2 Reclamo vs. queja (art. 3.3 y 3.4, texto D.S. 101-2022-PCM; Anexo I)
- **Reclamo**: disconformidad relacionada con los productos o servicios.
- **Queja**: disconformidad no relacionada con los productos o servicios; o malestar o
  descontento respecto a la atención al público.
- Desde 2022 **ambos se responden** en el mismo plazo (se suprimió que la queja "no busca
  pronunciamiento").
- Si el consumidor marcó "queja" o no marcó nada pero el detalle evidencia un reclamo, el
  proveedor **debe tramitarlo como reclamo** (art. 6).
- Ninguno es denuncia ni vía previa obligatoria ante INDECOPI (art. 13); la hoja debe decirlo.

### 2.3 Campos obligatorios de la Hoja de Reclamación, en el orden del Anexo I oficial (D.S. 101-2022-PCM)

Encabezado
1. Título "LIBRO DE RECLAMACIONES" y "HOJA DE RECLAMACIÓN".
2. Número correlativo con año: formato del anexo `Nº 000000001-202X`.
3. Fecha: día, mes, año.
4. Nombre de la persona natural o **razón social** del proveedor / **RUC** del proveedor.
5. **Domicilio del establecimiento** donde se coloca el libro / **código de identificación**.

Sección 1 — Identificación del consumidor reclamante
6. Nombre.
7. Domicilio.
8. DNI / CE (documento de identidad).
9. Teléfono / e-mail.
10. Padre o madre — para el caso de menores de edad (art. 5: nombre, domicilio, teléfono y
    correo de uno de los padres o representantes).

Sección 2 — Identificación del bien contratado
11. Producto / Servicio (selección).
12. Monto reclamado.
13. Descripción.

Sección 3 — Detalle de la reclamación y pedido del consumidor
14. Tipo: Reclamo / Queja (con las dos definiciones a pie de página).
15. Detalle.
16. Pedido (pedido concreto del consumidor).
17. Firma del consumidor — en el libro virtual se reemplaza por un **mecanismo que acredite
    conformidad** con los términos (exigencia del texto original del art. 5; el texto 2014
    reserva la firma al libro físico). Implementar casilla de declaración + registro de
    fecha/hora/IP. **[A VALIDAR CON ASESOR LEGAL el mecanismo exacto]**.

Sección 4 — Observaciones y acciones adoptadas por el proveedor
18. Fecha de comunicación de la respuesta (día, mes, año).
19. Texto de observaciones y acciones adoptadas.
20. Firma del proveedor (en virtual: identificación del usuario que responde).

Pie
21. Destinatario (consumidor / proveedor / INDECOPI).
22. Leyenda: "La formulación del reclamo no impide acudir a otras vías de solución de
    controversias ni es requisito previo para interponer una denuncia ante el INDECOPI."
23. Leyenda: "El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince
    (15) días hábiles, el cual es improrrogable."

Requisito de validez (art. 5, texto 2014): si el consumidor no consigna como mínimo **nombre,
DNI, domicilio o correo electrónico, fecha y detalle**, el reclamo se considera no presentado.
El formulario no debe permitir enviar sin esos datos (y debe avisar antes, no después).

### 2.4 Numeración correlativa
- Numeración correlativa que aparece **por defecto** (no la digita el consumidor), con código de
  identificación del establecimiento si hay varios libros (art. 5 y 8).
- Sin huecos ni reutilización: el esquema ya usa `DocumentSequence` con bloqueo de fila.
- Formato recomendado para el PDF: `000000045-2026` (como el Anexo I); el código interno
  `LR-2026-000045` puede mantenerse como alias. **[A VALIDAR: si INDECOPI exige reiniciar por año;
  el anexo muestra año en el número, por eso se propone correlativo anual]**.

### 2.5 Constancia y copia al consumidor (art. 4-B; Anexo IV infracción 6)
- Al concluir el registro: (a) **permitir imprimir** la hoja (descarga PDF / vista imprimible) y
  (b) **enviarla automáticamente** al correo indicado por el consumidor, (c) dejando constancia
  de **fecha y hora** de presentación.
- "Cuándo": inmediatamente al confirmar el envío. Si el correo falla, reintentar y registrar el
  error; la pantalla de confirmación y la descarga deben estar disponibles igualmente.
- No condicionar la atención al pago previo de nada (art. 6; Ley 29571 art. 24.3).

### 2.6 Plazo de respuesta
- **15 días hábiles, improrrogables**, por comunicación escrita (carta y/o correo, **según lo
  solicitado por el consumidor**) — art. 6 (D.S. 101-2022-PCM) y Anexo I.
- Cómputo: desde el día siguiente al registro; hábiles = lunes a viernes salvo feriados
  nacionales y días no laborables declarados. **[A VALIDAR CON ASESOR LEGAL: tratamiento de
  feriados regionales (p. ej. Puno) y de días no laborables del sector público]**.
- Nota: algunas fuentes secundarias siguen citando "prorrogable"; el Anexo I oficial vigente dice
  "improrrogable". Se adopta **improrrogable**.
- Solución directa (art. 6-A): si el proveedor ofrece una solución no presencial (correo), el
  plazo se suspende hasta **5 días hábiles** (D.S. 101-2022-PCM; antes 10 días calendario). Si el
  consumidor acepta expresamente con la frase "ACUERDO ACEPTADO PARA SOLUCIONAR EL RECLAMO" u otra
  equivalente, el reclamo concluye y el acuerdo es exigible; si no responde, se entiende rechazado
  y sigue la obligación de responder.

### 2.7 Conservación (art. 12)
- Mínimo **2 años** desde la presentación: hojas, constancia de la respuesta y, si aplica,
  información SIREC. (La "ampliación de plazo" ya no existe por ser improrrogable).
- Pérdida/extravío: denuncia policial en 48 horas.
- SIREC solo aplica a proveedores con ingresos anuales ≥ 3000 UIT (art. 16) — previsiblemente no
  aplica al cliente **[POR CONFIRMAR ventas anuales]**.
- Tras el plazo mínimo, aplicar política de conservación de datos personales
  ([[normativa/proteccion-de-datos]]): se propone conservar 5 años y luego anonimizar
  **[A VALIDAR CON ASESOR LEGAL: plazo de prescripción de acciones administrativas/civiles]**.

### 2.8 Aviso visible obligatorio y acceso desde la página principal
- Art. 9 y Anexo III: los proveedores virtuales colocan como mínimo un **aviso fácilmente
  identificable en la página de inicio**, con **vínculo** al libro virtual, legible y visible
  según el diseño de la home.
- Art. 4-B: el libro virtual debe estar **alojado en la página de inicio** del portal.
- Ley 32495: enlace exhibido **permanentemente** en lugar visible y fácilmente accesible.
- Proyecto 2026 (no vigente): sin registro ni autenticación previa; adaptable a móvil.
- Implementación propuesta (cumple todo lo anterior):
  - Ícono oficial de libro + texto "Libro de Reclamaciones" en el **pie de página global**
    (presente en todas las páginas, incluida la home) y además visible en la home sin depender
    de un menú desplegable ni de scroll infinito. En móvil, el pie siempre incluye el enlace.
  - Ruta pública `/es/libro-de-reclamaciones` (conservar el slug del sitio viejo) y
    `/en/complaints-book` que muestra la versión en castellano como texto obligatorio.
  - Sin login, sin captcha intrusivo (si se usa antibot, que sea invisible y con alternativa).
  - Contraste WCAG 2.2 AA; tamaño de texto ≥ al de los demás enlaces legales.
  - Para redes sociales / WhatsApp Business donde se vende: enlace al mismo libro en la bio
    **[A VALIDAR: obligatorio solo si se aprueba el proyecto 2026]**.

### 2.9 Menores de edad
- Pueden registrar reclamo; la hoja exige nombre, domicilio, teléfono y correo de **uno de los
  padres o representante** (art. 5; Anexo I "Padre o madre").
- Datos de menores: ver [[normativa/proteccion-de-datos]] (art. 22 del reglamento de la Ley 29733:
  hasta 14 años consiente el padre/tutor).

### 2.10 Infracciones relevantes (Anexo IV, D.S. 006-2014-PCM)
No alojar el libro virtual en la web (A); no responder (A); condicionar atención a pago (A);
no permitir imprimir/enviar copia al correo (C); no exhibir aviso (B); no responder en plazo (B);
no conservar 2 años (B); no transcribir el respaldo en 1 día (C). Todas son infracciones leves
del art. 110 del Código, graduadas por los Anexos IV y V.

## 3. Especificación técnica para el equipo

### 3.1 Campos del formulario público (orden de pantalla = orden del Anexo I)

| # | Campo (UI es-PE) | Clave API (camelCase) | Tipo | Obligatorio | Validación |
|---|---|---|---|---|---|
| 1 | N.º de hoja | `sheetNumber` | string (servidor) | auto | Asignado al confirmar; no editable |
| 2 | Fecha y hora de registro | `submittedAt` | timestamptz (servidor) | auto | UTC; se muestra en America/Lima |
| 3 | Proveedor: razón social, RUC, domicilio del establecimiento, código | `provider.*` | snapshot (servidor) | auto | Desde configuración; se congela en la hoja |
| 4 | Nombres y apellidos | `consumer.fullName` | string | sí | 3–200 caracteres; sin solo espacios |
| 5 | Tipo de documento | `consumer.docType` | enum `dni`,`ce`,`passport`,`other` | sí | `ruc` no se ofrece al consumidor persona natural **[A VALIDAR]** |
| 6 | N.º de documento | `consumer.docNumber` | string | sí | DNI: 8 dígitos; CE: 9–12 alfanum.; pasaporte: 5–20 alfanum. |
| 7 | Domicilio | `consumer.address` | string | sí | 5–300 caracteres |
| 8 | Teléfono | `consumer.phone` | string E.164 | sí | `+` y 8–15 dígitos |
| 9 | Correo electrónico | `consumer.email` | string | sí | RFC 5322 simplificado, ≤ 254; doble ingreso o confirmación |
| 10 | ¿Eres menor de edad? | `consumer.isMinor` | boolean | sí | Si `true`, exige 11–14 |
| 11 | Nombre del padre/madre/representante | `guardian.fullName` | string | si menor | 3–200 |
| 12 | Domicilio del representante | `guardian.address` | string | si menor | 5–300 |
| 13 | Teléfono del representante | `guardian.phone` | E.164 | si menor | igual que 8 |
| 14 | Correo del representante | `guardian.email` | string | si menor | igual que 9 |
| 15 | Bien contratado | `good.type` | enum `product`,`service` | sí | Por defecto `service` |
| 16 | Monto reclamado | `good.claimedAmount` + `good.currency` | integer céntimos + ISO 4217 | sí para reclamo; opcional para queja | ≥ 0; `PEN` o `USD` |
| 17 | Descripción del bien/servicio | `good.description` | string | sí | 5–500; si viene de una reserva, prellenar con código y tour |
| 18 | Código de reserva (opcional) | `bookingCode` | string | no | Si existe, vincular `bookingId`; nunca obligatorio |
| 19 | Tipo | `declaredType` | enum `reclamo`,`queja` | sí (permitir "no sé" → null) | Mostrar definiciones del Anexo I |
| 20 | Detalle | `detail` | text | sí | 10–5000 |
| 21 | Pedido | `consumerRequest` | text | sí | 5–2000 |
| 22 | Canal de respuesta | `responseChannel` | enum `email`,`letter` | sí | Por defecto `email`; si `letter`, domicilio obligatorio (ya lo es) |
| 23 | Declaración de conformidad (sustituye firma) | `conformityAccepted` | boolean | sí | Debe ser `true`; texto versionado |
| 24 | Aviso de privacidad (informativo) | `privacyNoticeVersion` | string | sí | Mostrar cláusula; no es casilla de marketing |
| 25 | Adjuntos | `attachments[]` | archivo | no | PDF/JPG/PNG, ≤ 5 MB c/u, máx. 3; antivirus **[proyecto 2026]** |

Reglas de servidor
- Idempotencia: cabecera `Idempotency-Key` del formulario → una sola hoja ante doble envío.
- Rate limit por IP y por correo; antibot invisible; nunca bloquear sin alternativa.
- PII cifrada (documento, teléfono, datos del representante) como ya hace el esquema.
- Cálculo de `responseDueAt` = 15 días hábiles con calendario de feriados (tabla nueva).
- Envío del PDF por correo en la misma transacción lógica (outbox) y registro de entrega.
- PDF: incluye todos los campos 1–23, destinatario "Consumidor" y las dos leyendas del pie.
- Respaldo físico: alta manual en backoffice con `channel = backup_book`, número de hoja física y
  alerta si se transcribe después de 1 día calendario.

### 3.2 Comparación con la tabla `complaints` del schema

| Requisito | Estado en `complaints` | Acción para `backend-senior` / `dba-senior` |
|---|---|---|
| Correlativo anual sin huecos | OK (`year`, `sequence`, `code`, `DocumentSequence`) | Agregar formato de impresión `000000045-2026` |
| Fecha y hora de presentación | OK (`submittedAt`) | — |
| Razón social, RUC, domicilio del establecimiento, código | **Falta** | Agregar snapshot: `providerLegalName`, `providerRuc`, `establishmentAddress`, `establishmentCode` (o FK a tabla `establishments`) |
| Domicilio del consumidor | `consumerAddress` **opcional** | Hacer **NOT NULL** |
| Teléfono del consumidor | `consumerPhoneEnc` opcional | Hacer obligatorio en API (art. 5); en BD puede quedar nullable por hojas de respaldo incompletas |
| Datos del padre/madre (nombre, domicilio, teléfono, correo) | Solo `guardianName` | Agregar `guardianAddress`, `guardianPhoneEnc`, `guardianEmail` + CHECK `is_minor = false OR guardian_* NOT NULL` |
| Tipo declarado vs. tipo tramitado | Solo `type` | Agregar `declaredType` (nullable) y mantener `type` como tipo de trámite; registrar reclasificación |
| Canal de respuesta elegido (carta/correo) | **Falta** | Agregar enum `responseChannel` (`email`,`letter`) |
| Conformidad que reemplaza la firma | **Falta** | Agregar `conformityAcceptedAt`, `conformityTextVersion` |
| Monto reclamado | OK (`claimedAmount`, `claimedCurrency`) | CHECK: requerido si `type = reclamo` **[A VALIDAR]** |
| Respuesta y fecha de comunicación | `responseText`, `respondedAt` | Separar `respondedAt` (redacción) de `responseSentAt` (comunicación efectiva) + `responseDeliveryRef` (id del correo/cargo de carta) |
| Firma del proveedor | `respondedByUserId` | OK (identificación del usuario) |
| Constancia al consumidor | `acknowledgmentSentAt` | Agregar `acknowledgmentDeliveryRef`, `pdfSha256` (integridad del PDF enviado) |
| Solución directa art. 6-A | **Falta** | Agregar `settlementOfferText`, `settlementOfferedAt`, `settlementAcceptedAt`, `settlementAcceptanceEvidence`; estado `settled`; suspensión de plazo ≤ 5 días hábiles |
| Estados | `received`, `in_review`, `answered`, `closed` | Agregar `settled` (acuerdo aceptado) |
| Libro de respaldo | **Falta** | Agregar `channel` (`web`,`backup_book`,`office_assisted`), `backupSheetNumber`, `transcribedAt` |
| Plazo 15 días hábiles | `responseDueAt` existe | Crear tabla `business_holidays` (fecha, ámbito nacional/regional, fuente) y servicio de cálculo |
| Conservación ≥ 2 años y no borrado | Trigger bloquea DELETE | Definir job de anonimización tras el plazo de conservación aprobado |
| Adjuntos (proyecto 2026) | **Falta** | Tabla `complaint_attachments` (storage key, sha256, mime, size) — Could |
| Campo `ip` | OK | Informar en la cláusula de privacidad |
| `goodType` por defecto `service` | OK | — |
| `bookingId` opcional | OK | Nunca exigir reserva para reclamar |
| Sobra | `consumerDocType = ruc` | Aceptable para microempresas consumidoras, pero no ofrecer por defecto |

### 3.3 Criterios de aceptación (Gherkin) para QA

```gherkin
Característica: Libro de Reclamaciones virtual (Ley 29571; D.S. 011-2011-PCM y modificatorias; Ley 32495)

  Escenario: acceso visible desde la página de inicio sin autenticación
    Dado un visitante anónimo en "/es" en escritorio y en móvil (375 px)
    Entonces ve un enlace con el texto "Libro de Reclamaciones" e ícono de libro sin abrir menús
    Y el enlace también está en el pie de página de todas las páginas públicas
    Cuando lo pulsa
    Entonces llega al formulario sin que se le pida iniciar sesión ni registrarse
    Y el formulario muestra razón social, RUC, domicilio del establecimiento y el número de hoja se asignará al enviar

  Escenario: registro exitoso de un reclamo
    Dado el formulario completo con datos válidos, tipo "Reclamo", monto 450.00 PEN y canal de respuesta "correo"
    Y la casilla de conformidad marcada
    Cuando pulsa "Enviar"
    Entonces se crea una hoja con correlativo anual consecutivo al último (sin huecos)
    Y se muestra la constancia con fecha y hora (America/Lima) y botón "Descargar / imprimir PDF"
    Y en menos de 5 minutos llega al correo del consumidor el PDF con todos los campos del Anexo I
    Y el PDF incluye las leyendas "no impide acudir a otras vías" y "15 días hábiles, el cual es improrrogable"
    Y el staff ve la hoja en la bandeja con vencimiento = 15 días hábiles excluyendo feriados

  Escenario: datos mínimos faltantes
    Cuando intenta enviar sin nombre, documento, domicilio, correo o detalle
    Entonces el formulario no se envía y señala cada campo faltante con mensaje accesible
    Y no se consume número correlativo

  Escenario: doble envío
    Cuando pulsa "Enviar" dos veces o reintenta por red lenta con la misma clave de idempotencia
    Entonces existe una sola hoja y ambos intentos devuelven el mismo número

  Escenario: menor de edad
    Cuando marca "Soy menor de edad"
    Entonces son obligatorios nombre, domicilio, teléfono y correo del padre, madre o representante
    Y aparecen en el PDF en la sección 1

  Escenario: queja mal clasificada
    Dado una hoja registrada como "Queja" cuyo detalle trata del servicio contratado
    Cuando el staff la revisa
    Entonces puede reclasificarla como "Reclamo" conservando el tipo declarado original y quedando auditado
    Y el plazo de 15 días hábiles no cambia

  Escenario: respuesta dentro de plazo por el canal elegido
    Dado una hoja con canal "correo"
    Cuando el staff publica la respuesta
    Entonces se envía por correo, se registra la fecha de comunicación y la referencia de entrega
    Y el estado pasa a "respondida"
    Y la bandeja alerta en amarillo a los 10 días hábiles y en rojo a los 13 días hábiles sin respuesta

  Escenario: el plazo no se puede ampliar
    Cuando el staff intenta ampliar el plazo de respuesta
    Entonces el sistema no ofrece esa acción

  Escenario: solución directa aceptada (art. 6-A)
    Dado una oferta de solución enviada por correo
    Cuando el consumidor responde "ACUERDO ACEPTADO PARA SOLUCIONAR EL RECLAMO" dentro de 5 días hábiles
    Entonces el estado pasa a "acuerdo aceptado" con la evidencia adjunta
    Pero si no responde en 5 días hábiles, el plazo de respuesta se reanuda

  Escenario: no se condiciona la atención a pagos
    Dado una reserva con saldo pendiente
    Cuando el consumidor registra un reclamo
    Entonces el formulario no solicita pago ni código de reserva obligatorio

  Escenario: falla del correo de constancia
    Dado que el proveedor de correo devuelve error
    Entonces la pantalla igual permite descargar el PDF
    Y el envío se reintenta y queda registrado el error en el backoffice

  Escenario: libro de respaldo
    Dado una hoja física de respaldo registrada en la oficina de Puno
    Cuando el staff la transcribe en el backoffice con su número de hoja física
    Entonces queda con canal "libro de respaldo" y alerta si pasaron más de 1 día calendario

  Escenario: conservación
    Cuando un usuario con cualquier rol intenta eliminar una hoja
    Entonces la operación es rechazada y queda en auditoría

  Escenario: accesibilidad
    Entonces el formulario cumple WCAG 2.2 AA (etiquetas, foco, errores anunciados, contraste)
```

## 4. Pendientes y datos a pedir
- RUC, razón social, domicilio fiscal y de cada establecimiento; número de oficinas abiertas al
  público (Puno, ¿Cusco?, ¿Arequipa?).
- Correo y responsable de atención de reclamos; horario.
- Confirmar si la oficina de Puno ya tiene libro físico y aviso Anexo II.
- Ventas anuales (para SIREC y oficial de datos personales).
- Revisar en El Peruano si se aprobó el decreto final del proyecto R.M. 244-2026-PCM.
