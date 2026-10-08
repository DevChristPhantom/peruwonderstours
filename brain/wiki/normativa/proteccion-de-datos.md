---
type: concept
title: Protección de datos personales (Ley 29733 y D.S. 016-2024-JUS)
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - normativa
  - datos-personales
  - ley-29733
  - anpd
  - E8
---

# Protección de datos personales

Épica: [[concepts/backlog-mvp]] (E6 ARCO, E8 legales). Modelo: `consents`, `customers`,
`travelers` en `apps/api/prisma/schema.prisma` ([[concepts/modelo-de-datos]]). Borradores:
`docs/legal/politica-de-privacidad.md`, `docs/legal/politica-de-cookies.md`.
Relacionado: [[normativa/libro-de-reclamaciones]], [[normativa/informacion-al-consumidor]].

> Elaborado por `compliance-peru-analyst` el 2026-10-07. No es asesoría legal.
> **[A VALIDAR CON ASESOR LEGAL]** donde se indica.

## 1. Marco normativo (verificado el 2026-10-07)

| Norma | Estado | Fuente consultada (2026-10-07) |
|---|---|---|
| Ley 29733, Ley de Protección de Datos Personales (modificada por D. Leg. 1353) | Vigente | Compendio oficial MINJUSDH, 1.ª ed. dic. 2025: https://cdn.www.gob.pe/uploads/document/file/9231033/7575393-compendio_proteccion_datos_personales.pdf |
| **D.S. 016-2024-JUS**, nuevo Reglamento de la Ley 29733 (publicado 30-11-2024; vigencia a los 120 días calendario; el compendio oficial indica **vigente desde el 31-03-2025**). Deroga el D.S. 003-2013-JUS | Vigente | Mismo compendio; ficha: https://www.gob.pe/institucion/smv/normas-legales/6426760-016-2024-jus |
| Ley 29571 (Código del Consumidor), art. 58 y ss. (métodos comerciales agresivos — comunicaciones comerciales) | Vigente | Ver [[normativa/informacion-al-consumidor]] |

En el reglamento, "días" = **días hábiles** (Título Preliminar, art. III, num. 8 del reglamento).
No existe en el Perú una norma específica de cookies: se aplican la Ley 29733 y su reglamento
cuando las cookies tratan datos personales **[A VALIDAR CON ASESOR LEGAL]**.

## 2. Requisitos aplicables a este sitio

### 2.1 Bases de legitimación (Ley art. 13–14)
- **Sin consentimiento** (art. 14.5 Ley): datos necesarios para preparar, celebrar y ejecutar la
  reserva (nombre, correo, teléfono, datos de viajeros exigidos por el tour, pago, comprobante).
  Se **informa** (art. 18) pero no se pide casilla de consentimiento.
- **Con consentimiento** (art. 1 y 13 Reglamento): todo lo que no sea necesario para el contrato:
  publicidad y prospección comercial, perfiles/personalización, cookies analíticas y
  publicitarias, publicación de testimonios con nombre/foto, transferencias a terceros para sus
  propios fines.
- **Datos sensibles** (salud, alimentación por motivos de salud, discapacidad): consentimiento
  **por escrito**, con firma manuscrita, digital, **electrónica** u otra modalidad que garantice la
  voluntad (art. 8 Reglamento). `travelers.special_needs_enc` cae aquí.
  **[A VALIDAR CON ASESOR LEGAL: si una casilla + registro de evidencia califica como "firma
  electrónica" para el art. 8; alternativa: OTP por correo o firma en la cuenta]**.
- Carga de la prueba del consentimiento: siempre del responsable (art. 9 Reglamento).

### 2.2 Consentimiento válido (arts. 2–6 Reglamento)
- **Libre**: no condicionar el servicio a datos no indispensables (art. 3.2). Marketing nunca
  obligatorio para reservar.
- **Previo**: antes de recopilar o del nuevo tratamiento (art. 4). Cookies no esenciales: antes de
  cargarse.
- **Expreso e inequívoco**: acción afirmativa; "clic" vale (art. 5.1.3). Casillas **desmarcadas
  por defecto**; una casilla por finalidad.
- **Informado** (art. 6.1): identidad y domicilio del responsable; finalidades; destinatarios;
  banco de datos; obligatoriedad de cada dato; consecuencias de no darlos; transferencias
  nacionales e internacionales; decisiones automatizadas/perfiles; plazo de conservación;
  mecanismos de ejercicio de derechos.
- Publicar la política de privacidad cumple el deber de información pero **no sustituye** el
  consentimiento (art. 7).
- **Revocación** en cualquier momento, gratuita, sencilla, rápida (art. 10.4); efectos sobre
  tratamientos en curso en **≤ 10 días** (art. 10.2).

### 2.3 Finalidades separadas (diseño de casillas)

| Momento | Casilla / control | Base | Por defecto |
|---|---|---|---|
| Checkout / registro | "He leído la Política de Privacidad" (enlace) — **acuse de información**, no consentimiento | art. 18 Ley | sin marcar; requerido para continuar solo como acuse |
| Checkout | "Acepto los Términos y Condiciones y la Política de Cancelación" | contrato (art. 47 Código) | sin marcar; requerido |
| Checkout / registro / pie | "Quiero recibir ofertas y novedades por correo" | consentimiento marketing | **sin marcar, opcional** |
| Checkout / perfil | "…por WhatsApp/SMS" (canal separado) | consentimiento marketing | sin marcar, opcional |
| Datos de salud/alimentación del viajero | Consentimiento expreso para datos sensibles, con firma electrónica | art. 8 Reglamento | sin marcar, solo si se ingresan esos datos |
| Banner de cookies | Analíticas / Publicitarias (por categoría) | consentimiento | desactivadas; "Rechazar" igual de visible que "Aceptar" |
| Testimonios | Publicar nombre, ciudad y foto | consentimiento | sin marcar |

### 2.4 Cláusula informativa (texto base para formularios)

> **Tus datos personales.** [RAZÓN SOCIAL] (RUC [RUC]), con domicilio en [DOMICILIO], es
> responsable del tratamiento. Usamos tus datos para gestionar tu reserva, pagos, comprobantes y
> la atención de consultas y reclamos (necesarios para el contrato). Si lo autorizas con las
> casillas opcionales, también para enviarte ofertas. Tus datos se almacenan en el banco de datos
> "[NOMBRE]" inscrito ante la Autoridad Nacional de Protección de Datos Personales con código
> [CÓDIGO]. Podemos compartirlos con operadores turísticos, transportistas, hoteles y entidades
> (p. ej. venta de boletos a Machu Picchu) necesarios para prestar el servicio, y con proveedores
> tecnológicos (alojamiento web, pasarela de pago, correo) ubicados en [PAÍSES]. Los datos marcados
> con * son obligatorios; sin ellos no podemos procesar la reserva. Los conservamos durante [PLAZO].
> Puedes ejercer tus derechos de información, acceso, rectificación, cancelación, oposición y
> portabilidad escribiendo a [CORREO DE PRIVACIDAD]. Más información en la [Política de Privacidad].

### 2.5 Transferencia nacional e internacional (Ley art. 15; Reglamento arts. 12–21, 28–33)
- Escenario del proyecto: hosting/CDN (Vercel/Railway/Render/AWS — ADR-0001), correo
  transaccional, analítica y posiblemente pasarela con procesamiento fuera del Perú.
- Proveedores que solo **procesan por encargo** (hosting, correo, pasarela) son **encargados de
  tratamiento** (arts. 28–33): requieren contrato con las prestaciones mínimas del art. 29
  (transparencia de subcontratación, no titularidad, confidencialidad/integridad/disponibilidad,
  control del responsable, destrucción al terminar).
- Si el servidor está fuera del Perú, hay **flujo transfronterizo**:
  - País con nivel adecuado (resolución de la Dirección General) o, si no, **garantías** como
    cláusulas contractuales modelo (arts. 18–20).
  - Excepción del art. 15.4 de la Ley: no se exigen las garantías cuando el flujo es necesario
    para ejecutar la relación contractual (incluye autenticación, soporte, facturación).
  - **En todos los casos** el flujo transfronterizo debe **comunicarse a la Dirección General**
    e inscribirse en el Registro Nacional con el formato aprobado (art. 21.2).
  - Informar al titular (art. 18 Ley; art. 6.1.7 Reglamento) — en la política de privacidad.
- Transferencias a operadores locales (hoteles, trenes, guías) para ejecutar el servicio:
  informar; se enmarcan en el art. 14.5 Ley **[A VALIDAR CON ASESOR LEGAL si son encargados o
  responsables independientes]**.

### 2.6 Derechos del titular (Ley arts. 18–25; Reglamento arts. 61–87)

| Derecho | Plazo máximo de respuesta (días hábiles, desde el día siguiente) | Ampliable |
|---|---|---|
| Información | 8 días (art. 69.1) | No |
| Acceso (incluye **portabilidad**, art. 76, vigente desde ~set. 2025) | 20 días (art. 69.2) | Una vez, por igual plazo, justificando (art. 71) |
| Rectificación, actualización, inclusión, cancelación/supresión, oposición | 10 días (art. 69.3) | Una vez, por igual plazo |
| Negarse/revocar/oponerse a publicidad | 10 días (art. 26.5) | — |

- Solicitud: nombre y acreditación, petición concreta, domicilio o correo, fecha y firma, documentos
  (art. 64). Observaciones en 5 días; subsanación 5 días (art. 66). Pedido de información
  adicional en 7 días (art. 70).
- **Gratuito** para el titular (art. 67.3); procedimiento sencillo; se puede usar el canal de
  atención al cliente (art. 65).
- La revocación/oposición a marketing no puede ser más compleja que dar el consentimiento (art. 26.5)
  → enlace "darse de baja" en cada correo + switch en el perfil.
- Ante negativa: plataforma "Yo cuido mis datos personales" de la Autoridad (4.ª DCF).

### 2.7 Registro de bancos de datos (Reglamento arts. 42–45)
- Obligación de inscribir creación, modificación y cancelación de bancos de datos ante el Registro
  Nacional de Protección de Datos Personales; gratuito; mantener actualizado.
- Bancos propuestos para Peru Wonders Tours **[A VALIDAR con el cliente y asesor]**:
  1. Clientes y viajeros (reservas, pagos, comprobantes).
  2. Libro de Reclamaciones.
  3. Prospectos y marketing (newsletter, leads de WhatsApp/formulario de contacto).
  4. Trabajadores y postulantes.
  5. Proveedores (personas naturales: guías, choferes).
  6. Videovigilancia de la oficina (si existe).
- Comunicar flujo transfronterizo en la misma inscripción (art. 21.2).

### 2.8 Seguridad, incidentes y oficial de datos
- Medidas para medios digitales (art. 46): gestión de accesos, autenticación, revisión semestral de
  privilegios, registros de trazabilidad; documento de seguridad (art. 47); respaldos (art. 48).
- **Incidentes**: notificar a la Autoridad en **48 horas** desde que se conoce cuando el incidente
  es de gran volumen, datos sensibles o perjuicio evidente; comunicar al titular afectado en 48 h;
  notificar también al Centro Nacional de Seguridad Digital si es en entorno digital (art. 34);
  documentar todos los incidentes (art. 35); los encargados avisan de inmediato (art. 36).
- **Oficial de Datos Personales** (art. 37): obligatorio si hay grandes volúmenes, datos sensibles
  como giro de negocio, etc. Para privados, entrada progresiva según ventas: > 2300 UIT (1 año desde
  publicación), > 1700 UIT (2 años), > 150 UIT (3 años), microempresa (4 años: ~30-11-2028).
  **[A VALIDAR: si el cliente cae en los supuestos 37.1.2 o 37.1.3 y su tamaño]**. Aunque no sea
  obligatorio, se recomienda designar un punto de contacto de privacidad y publicarlo.

### 2.9 Menores de edad (arts. 22–25 Reglamento)
- Menores de 14: consentimiento de padres/tutores. Entre 14 y 18: pueden consentir si la
  información está en lenguaje comprensible (art. 22.2).
- No recopilar de menores datos de otros miembros de la familia (art. 23).
- Diseño: las cuentas y el checkout son para mayores de 18; los datos de viajeros menores los
  aporta el adulto que reserva y declara tener la representación.

### 2.10 Cookies (aplicación por analogía de la Ley 29733) **[A VALIDAR CON ASESOR LEGAL]**
- Categorías: estrictamente necesarias (sesión, carrito, seguridad, preferencia de consentimiento) →
  sin consentimiento; analíticas, personalización y publicitarias → consentimiento previo.
- Banner con "Aceptar todo", "Rechazar todo" y "Configurar", mismo peso visual; sin casillas
  premarcadas; no cargar scripts no esenciales antes de elegir; enlace permanente "Configurar
  cookies" en el pie; registro de la elección con versión de la política.

## 3. Comparación con la tabla `consents`

| Requisito | Estado | Acción |
|---|---|---|
| Histórico de otorgamiento/revocación | OK (una fila por evento; última fila = estado) | — |
| Versión de la política | `policyVersion` | Agregar `textHash` (SHA-256 del texto mostrado) y `locale` |
| Evidencia (IP, user agent, origen) | OK (`ip`, `userAgent`, `source`) | Agregar `method` (`checkbox`,`banner`,`email_link`,`otp_signature`) y, para datos sensibles, `signatureRef` |
| Titular sin cuenta (invitado, visitante del banner, reclamante, suscriptor de newsletter) | **Falla**: `customerId` es NOT NULL | Hacer `customerId` nullable y agregar `subjectEmailHash` (HMAC) y/o `anonymousId` (cookie de consentimiento), con CHECK de al menos uno; o separar `cookie_consents` |
| Consentimiento por viajero (datos sensibles de un acompañante) | **Falta** | Agregar `travelerId` nullable o tabla `traveler_consents` |
| Finalidades | `privacy_policy`, `terms_and_conditions`, `marketing`, `international_transfer`, `analytics_cookies` | **Sobran como "consentimiento"**: `privacy_policy` (es acuse de información, art. 7) y `terms_and_conditions` (es aceptación contractual) → moverlas a una tabla `legal_acceptances` o renombrar el enum a `acceptance_type`. **Faltan**: `marketing_email`, `marketing_whatsapp` (separar canales), `advertising_cookies`, `personalization`, `sensitive_data_health`, `testimonial_publication`. `international_transfer` solo si no aplica la excepción del art. 15.4 Ley **[A VALIDAR]** |
| Revocación ≤ 10 días y canal sencillo | Modelo lo permite | Endpoint público de baja con token firmado; job que propague a proveedores de correo en ≤ 10 días hábiles |
| Prueba del consentimiento (carga del responsable) | Parcial | Conservar las filas mientras dure el tratamiento + plazo de prescripción **[A VALIDAR]** |
| Solicitudes ARCO | **Falta** modelo | Tabla `data_subject_requests` (tipo, fecha, vencimiento calculado en días hábiles, ampliación única, respuesta, evidencia) |
| Incidentes | **Falta** | Tabla `security_incidents` (detectado, notificado ANPD, notificado titulares, CNSD) o registro fuera de la BD |
| Conservación / anonimización | `anonymizedAt` en `customers`/`travelers` | Definir plazos por banco (p. ej. reservas: plazo tributario SUNAT; marketing: hasta revocación) **[A VALIDAR]** |

## 4. Checklist de aceptación (QA)

- [ ] Ninguna casilla de consentimiento aparece premarcada (inspección DOM y E2E).
- [ ] Se puede completar una reserva sin aceptar marketing ni cookies no esenciales.
- [ ] Antes de elegir en el banner, no se cargan scripts de analítica/publicidad (verificar red).
- [ ] "Rechazar todo" está en la primera capa del banner con el mismo tamaño que "Aceptar todo".
- [ ] Cada consentimiento guarda: titular, finalidad, versión, hash del texto, fecha UTC, IP, origen.
- [ ] La política de privacidad está enlazada en el pie, el checkout, el registro, el libro de
      reclamaciones y el formulario de contacto, y contiene los 10 elementos del art. 6.1.
- [ ] Cada correo de marketing tiene enlace de baja de un clic; la baja se refleja en ≤ 10 días.
- [ ] Formulario/correo ARCO visible; la bandeja calcula vencimientos 8/20/10 días hábiles.
- [ ] Ingresar datos de salud de un viajero exige el consentimiento específico para datos sensibles.
- [ ] Datos de documento, teléfono y salud se almacenan cifrados (ya diseñado).
- [ ] Existe inventario de encargados (hosting, correo, pasarela, analítica) con país y contrato.
- [ ] Constancia de inscripción de bancos de datos y comunicación de flujo transfronterizo archivada.

## 5. Datos a pedir al cliente
Razón social, RUC, domicilio; correo de privacidad; ventas anuales (oficial de datos); si ya tiene
bancos de datos inscritos y sus códigos; proveedores actuales (OTM, correo, CRM, WhatsApp Business,
Google Analytics/Meta Pixel); si recoge datos de salud/alimentación; plazos de conservación deseados.
