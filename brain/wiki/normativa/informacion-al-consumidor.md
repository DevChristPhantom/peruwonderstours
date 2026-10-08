---
type: concept
title: Información obligatoria al consumidor antes del pago
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - normativa
  - consumidor
  - mincetur
  - esnna
  - sunat
  - checkout
  - E8
---

# Información al consumidor antes del pago

Épicas: [[concepts/backlog-mvp]] (E3 carrito, E4 checkout, E8 legales). Reglas de negocio:
[[negocio/reglas-reserva-y-pago]]. Relacionado: [[normativa/libro-de-reclamaciones]],
[[normativa/proteccion-de-datos]]. Borradores: `docs/legal/terminos-y-condiciones.md`,
`docs/legal/politica-de-cancelacion-y-reembolso.md`.

> Elaborado por `compliance-peru-analyst` el 2026-10-07. No es asesoría legal.

## 1. Fuentes (consultadas el 2026-10-07)

| Norma | Puntos usados | Fuente |
|---|---|---|
| Ley 29571, Código de Protección y Defensa del Consumidor | Art. 2 (información relevante, veraz, oportuna, en castellano), 3 (no inducir a error), **4 (precio total con tributos, comisiones y cargos; recargos solo informados y aceptados antes)**, 6 (moneda extranjera), **7 (precio distinto por medio de pago)**, 46 (la oferta obliga), 47 (contrato electrónico: el proveedor prueba que puso la información a disposición; desvinculación por el mismo medio), 48 (cláusulas claras y accesibles antes de contratar), 50–51 (cláusulas abusivas) | https://diariooficial.elperuano.pe/Normas/obtenerDocumento?idNorma=17 (copia consolidada revisada: https://alertas.directoriolegislativo.org/wp-content/uploads/2023/05/CodigoDProteccionyDefensaDelConsumidor1-1.pdf). Verificar en SPIJ que esos artículos no tengan modificaciones posteriores **[A VALIDAR CON ASESOR LEGAL]** |
| D.S. 005-2020-MINCETUR, Reglamento de Agencias de Viajes y Turismo (El Peruano, 14-05-2020) | Art. 8 (RUC), 9 (declaración jurada en 30 días), 12 (Directorio Nacional), **15.4–15.7 (mención "Agencia de Viajes y Turismo" y distintivo en canal digital)**, **17.2 (ESNNA)**, 18 (suscripción del Código de Conducta), **22 (contenidos mínimos del canal digital)** | https://busquedas.elperuano.pe/normaslegales/aprueban-reglamento-de-agencias-de-viajes-y-turismo-decreto-supremo-n-005-2020-mincetur-1866352-4/ (texto leído en https://img.lpderecho.pe/wp-content/uploads/2020/05/DS-5-2020-mincetur-LP.pdf). No se hallaron modificatorias posteriores en la búsqueda **[A VALIDAR en SPIJ]** |
| R.M. 061-2021-MINCETUR | Aprueba el distintivo de agencias inscritas | https://busquedas.elperuano.pe/dispositivo/NL/1947877-1 (no se abrió el texto; **[A VALIDAR formato del distintivo]**) |
| Ley 30802 (2.ª DCF) | Base del Código de Conducta contra la ESNNA | Citada por el D.S. 005-2020-MINCETUR; texto no leído **[A VALIDAR]** |
| Ley 32495 + reglamento del Libro de Reclamaciones | Enlace permanente al libro | Ver [[normativa/libro-de-reclamaciones]] |
| Ley 29733 y D.S. 016-2024-JUS | Política de datos personales visible | Ver [[normativa/proteccion-de-datos]] |
| Ley del IGV, art. 33 num. 9 y Reglamento art. 9-B (exportación de servicios turísticos a no domiciliados) | Tratamiento tributario | Informes SUNAT, p. ej. https://www.sunat.gob.pe/legislacion/oficios/2017/informe-oficios/i029-2017.pdf — **no verificado el texto vigente; [A VALIDAR CON ASESOR TRIBUTARIO]** |

## 2. Requisitos

### 2.1 Precio total final (Código arts. 2, 3, 4, 6, 7)
- Mostrar en forma **destacada el precio total** que incluya **tributos (IGV si aplica),
  comisiones y cargos** en catálogo, ficha de tour, carrito y checkout. Nada de "desde" sin total
  calculado al elegir fecha y pasajeros.
- Recargos adicionales (p. ej. suplemento single, traslado opcional) solo si son servicios
  distintos, informados **antes** con su precio y **aceptados expresamente** (art. 4.2).
- **Comisión de 3,5 % por tarjeta (RN-03)**: si se cobra, debe mostrarse **antes de elegir el
  medio de pago** y sumarse visiblemente al total; si no se informa, no puede cobrarse (art. 7.1).
  En ofertas/promociones, cualquier medio de pago salvo aviso previo (art. 7.2).
- **Moneda**: si se publican precios en USD, mostrar también PEN con el tipo de cambio aplicado
  al pago (art. 6.1), y aceptar pago en cualquiera de las dos a elección del consumidor (art. 6.2).
  La excepción para quien vende "desde y hacia el exterior" **[A VALIDAR CON ASESOR LEGAL]**;
  recomendación: mostrar ambas siempre.
- Desglose en checkout: precio por tipo de pasajero, suplementos, comisión por medio de pago,
  descuentos, **total**, **adelanto (50 %)**, **saldo** y **fecha límite del saldo**.
- Precio congelado al crear el hold (RN-12); si cambió, mostrar el nuevo y pedir aceptación.

### 2.2 Condiciones antes del pago (Código arts. 2, 47, 48; D.S. 005-2020-MINCETUR art. 22.1.a.6)
Antes del botón de pago, en la misma pantalla o enlazado y con casilla de aceptación:
- Qué incluye y qué no incluye; punto y hora de encuentro; idioma; mínimo de pasajeros; requisitos
  (documentos, edad, condición física, altitud).
- **Política de cobro** (adelanto 50 %, saldo 7 días antes, medios de pago, comisión).
- **Política de cancelación y reembolso** con tabla de penalidades, plazos y forma de devolución,
  y componentes **no reembolsables** (boleto Machu Picchu, tren, sobrevuelo Nazca — RN-11)
  identificados en la ficha y en el resumen.
- Política de cambios de fecha.
- Qué pasa si no se paga el saldo.
- Conservar la versión aceptada con la reserva (`bookings.terms_version`,
  `cancellation_policy_version` ya existen) y enviarla en el correo de confirmación (art. 47.e).
- Permitir cancelar/desvincularse por el mismo medio (web/correo) usado para contratar (art. 47.c).

### 2.3 Identificación del proveedor (D.S. 005-2020-MINCETUR art. 22.1.a; Reglamento Libro de Reclamaciones art. 5)
Visible en el pie de todas las páginas y en el checkout y comprobantes:
1. Razón social o nombres y apellidos.
2. Nombre comercial ("Peru Wonders Tours").
3. **RUC real** (el sitio viejo muestra `20000000000`, placeholder: incumplimiento).
4. Dirección (oficina de Puno) y datos de contacto: teléfono, correo electrónico.
5. Política de Protección de Datos Personales.
6. Términos y Condiciones de Uso, con políticas de cobro, cancelación y reembolso.
7. **Constancia de inscripción en el Directorio Nacional de Prestadores de Servicios Turísticos
   Calificados** (número de constancia y clasificación: minorista/mayorista/operador).
8. **Distintivo** de agencia aprobado por el MINCETUR y la mención "Agencia de Viajes y Turismo"
   (art. 15.4 y 15.6), solo si está inscrita (art. 15.7).
9. **Versión digital del afiche ESNNA** con las disposiciones penales sobre ESNNA y sobre
   relaciones sexuales con menores, según contenido del MINCETUR (art. 22.1.a.8).
10. Enlace permanente al Libro de Reclamaciones.

### 2.4 Turismo responsable — ESNNA (D.S. 005-2020-MINCETUR arts. 17.2 y 18)
- Obligaciones del titular: no promover e impedir la ESNNA, trata y tráfico de migrantes;
  denunciar; **suscribir el Código de Conducta** mediante Declaración Jurada de Suscripción
  Obligatoria; afiche visible en oficina y versión digital en la web.
- Implementación web: página `/es/turismo-responsable` con el afiche oficial (imagen + texto
  accesible), declaración de compromiso y canales de denuncia oficiales
  **[POR CONFIRMAR con MINCETUR/GERCETUR Puno el afiche vigente y los canales de denuncia]**;
  enlace en el pie.
- Recomendación (no norma): en la ficha de viajeros, si un menor viaja, solicitar relación con el
  adulto responsable, sin pedir datos innecesarios.

### 2.5 SUNAT (resumen; detalle con `payments-integration-senior`)
- Comprobante electrónico (boleta/factura) por cada pago (RN-16), vía OSE/PSE.
- Servicios turísticos vendidos a personas naturales no domiciliadas (estadía ≤ 60 días por
  ingreso) pueden calificar como **exportación** (sin IGV) bajo el art. 33 num. 9 de la Ley del IGV
  y el art. 9-B de su reglamento, con requisitos documentales (pasaporte, TAM/registro migratorio,
  inscripción en registros SUNAT). Esto afecta el **precio total mostrado** (con o sin IGV según
  residencia), por lo que la tarifa por residencia (RN-19) debe reflejarlo.
  **[A VALIDAR CON ASESOR TRIBUTARIO antes de implementar precios diferenciados por IGV]**.

## 3. Checklist verificable (QA)

Catálogo y ficha de tour
- [ ] Cada precio mostrado es total (incluye IGV y cargos) o indica explícitamente "por persona,
      impuestos incluidos"; no hay cargos que aparezcan por primera vez en el último paso.
- [ ] Si hay precio en USD, también se muestra en PEN con tipo de cambio y fecha.
- [ ] La ficha muestra incluye / no incluye, requisitos, mínimo de pax y componentes no reembolsables.

Carrito y checkout
- [ ] El desglose muestra subtotal por pasajero, suplementos, comisión por medio de pago (si
      aplica), descuentos, total, adelanto 50 %, saldo y fecha límite del saldo.
- [ ] La comisión de tarjeta se muestra al seleccionar el medio de pago **antes** del botón pagar;
      si se elige otro medio, desaparece.
- [ ] La política de cancelación (resumen + enlace) y los T&C están visibles antes del botón de
      pago con casilla obligatoria, desmarcada por defecto.
- [ ] El correo de confirmación incluye: código de reserva, desglose, adelanto pagado, saldo y
      fecha límite, política de cancelación aceptada (versión) y datos del proveedor.
- [ ] El botón de pago indica el monto exacto que se cobrará ("Pagar S/ 1 234,50").
- [ ] Si el precio cambió entre carrito y checkout, se pide aceptación explícita del nuevo precio.

Identificación y legales (pie de todas las páginas)
- [ ] Razón social, nombre comercial, RUC real (11 dígitos, validado con dígito verificador),
      dirección, teléfono y correo.
- [ ] Número de constancia del Directorio Nacional de Prestadores y clasificación.
- [ ] Distintivo MINCETUR de agencia de viajes y turismo.
- [ ] Enlaces: Términos y Condiciones, Política de Privacidad, Política de Cookies, Política de
      Cancelación y Reembolso, Turismo responsable (ESNNA), Libro de Reclamaciones (con ícono).
- [ ] Afiche ESNNA digital accesible (texto alternativo/transcripción).
- [ ] Todo lo anterior existe en castellano; la versión en inglés no reemplaza la castellana.

## 4. Datos a pedir al cliente
RUC y razón social; nombre comercial registrado; domicilio fiscal y de la oficina de Puno (y otras);
número y fecha de la constancia del Directorio Nacional y clasificación; archivo del distintivo;
copia de la Declaración Jurada ESNNA suscrita; afiche ESNNA vigente; decisión sobre la comisión
3,5 %; monedas de venta y tipo de cambio; tratamiento de IGV para extranjeros (contador).
