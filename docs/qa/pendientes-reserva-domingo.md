# Pendientes verificables de reservas para la entrega

Revisión de código del 16 de octubre de 2026. Este plan no acredita un checkout listo para ventas ni una emisión fiscal implementada. No se consultó la base del cliente.

## Estado observado

`PaymentStep` recoge identidades y preferencia boleta/factura, pero `placeInputSchema` y `CheckoutDto` aún no reciben esos datos. La tabla `travelers` existe, sin repositorio dentro de `TransactionalRepositories`. La tabla `invoices` representa comprobantes emitidos y exige serie, número, fecha e importes; no debe usarse como solicitud fiscal ficticia.

## Implementación mínima propuesta

1. Definir DTO de viajeros agrupado por `cartItemId` real. El BFF debe relacionarlo con la línea local por tour/fecha sin confiar en IDs arbitrarios. Pedir nombres y apellidos separados y nacionalidad ISO de una lista: no dividir automáticamente el actual nombre completo ni convertir textos libres en países supuestos.
2. Validar en backend pertenencia de cada ítem al carrito, cobertura exacta de servicios, cantidades y categorías contra sus líneas tarifarias; impedir grupos duplicados, personas sobrantes o faltantes y titulares menores. Aplicar `requiresTravelerDocument` y validar documentos antes de crear la reserva.
3. Añadir repositorio transaccional de viajeros con adaptadores Prisma y memoria. Cifrar documentos con el cifrador existente y AAD por ID/campo; usar su HMAC para el índice de documento. Guardar en la misma transacción que reserva/cupos; incluir viajeros y datos fiscales normalizados en la huella de idempotencia. Reintentar no debe duplicarlos ni aceptar otro contenido con la misma clave.
4. Añadir una estructura uno a uno de datos fiscales y contacto de la reserva, separada de `Invoice` y del perfil global del cliente: tipo solicitado, razón social, documento fiscal cifrado y datos necesarios expresamente proporcionados. No sobrescribir el perfil existente por conocer su correo. No generar serie, número ni estado SUNAT ni afirmar emisión sin el proveedor contratado.
5. Exponer al personal autorizado nombres, categorías y nacionalidad; ofrecer la lectura necesaria del documento por ruta privada con auditoría y sin caché. No incluir documentos, cifrados ni hashes en JSON público, notas, logs, URL o correo. No guardar necesidades de salud en notas abiertas: requieren tratamiento cifrado y finalidad explícita.

## Bebés: decisión necesaria

El enum tarifario compartido admite adulto, niño, estudiante y adulto mayor. No convertir bebés en niños ni asignarles tarifa/cupo por inferencia. Para una primera entrega puede bloquearse expresamente el checkout online que incluya bebés y ofrecer consulta al equipo. Para admitirlos se necesita una representación propia de acompañante no tarifado, junto con la regla confirmada de edad, asiento/cupo y acompañamiento. Extender el enum global sin esas reglas afectaría tarifas e inventario.

## Evidencia exigida para cerrar

- Pruebas de validación y pertenencia de ítems; cantidades/categorías exactas; factura/boleta y países/documentos válidos.
- Round trip de cifrado y rechazo con AAD incorrecto, ausencia de PII en respuestas públicas y lectura privada auditada.
- Replay idempotente sin duplicados, conflicto por payload diferente y rollback completo al fallar cupos o persistencia.
- Cliente nuevo y recurrente: contacto de la reserva conservado y perfil global intacto.
- Recorrido en CI con PostgreSQL desechable: formulario → checkout → reserva → panel con viajeros/datos fiscales persistidos; pago sandbox únicamente.

SMTP real, pasarela contratada, RUC definitivo y emisión fiscal requieren comprobaciones del entorno de entrega. Las pruebas de memoria/sandbox no prueban esos servicios.

## Catálogo: optimización segura aplicada

Los conteos de tours por destino y categoría se consultan en paralelo con los mismos filtros de publicación. No se cambian precios, orden ni disponibilidad. El listado ya agrupa tarifas por tours mediante consultas en lote; su coste crece con todos los candidatos y tarifas coincidentes, no mediante una consulta individual por tarjeta.

No se añadió caché global de conteos: el repositorio es singleton y los endpoints de destinos y categorías son peticiones HTTP distintas. Cada una usa un solo conteo; una memoización persistente inventaría una ventana de datos obsoletos sin invalidación. Una futura consolidación por petición o un endpoint de taxonomías conjunto debe diseñarse con invalidación explícita antes de reutilizar resultados entre peticiones.
