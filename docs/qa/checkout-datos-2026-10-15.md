# Auditoría de datos del checkout — 15 de octubre de 2026

Revisión de código del recorrido cliente: carrito, datos de contacto, viajeros, pago, acceso a la reserva y notificaciones. No se accedió a la base del cliente ni se ejecutó un navegador local.

## Corrección acotada: teléfono de clientes nuevos

El teléfono y el código internacional recogidos por el formulario ahora se normalizan a E.164 y viajan por `PaymentStep` → esquema del Server Action → adaptador de reservas → `CheckoutCustomerDto` → caso de uso. El backend vuelve a validar el formato; no acepta un número nacional sin código internacional.

Para un cliente nuevo se guarda únicamente el cifrado AES-256-GCM en la columna existente `customers.phone_enc`, con el contexto autenticado `customers:phone_enc:<id>`. Se utiliza el cifrador del proyecto y la misma transacción de la reserva. La persistencia en memoria conserva el campo y el adaptador Prisma lo escribe como bytes. No hay migraciones ni datos telefónicos en notas o logs. Las respuestas públicas conservan su lista explícita de campos, que no incluye el teléfono ni los bytes cifrados.

**Límite deliberado:** si el correo ya pertenece a un cliente, un checkout invitado no cambia su perfil ni su teléfono existente, incluso si este es nulo. Conocer un correo no acredita control de la cuenta. El número recién introducido por un cliente recurrente no queda guardado como contacto específico de esa reserva; falta un flujo autenticado de actualización o una estructura de contacto por reserva. Tampoco se añadió visualización o edición del teléfono en el panel. Por tanto, esta corrección no acredita que la coordinación por WhatsApp esté completa para todos los clientes.

## Bloqueos de entrega: viajeros y datos fiscales

1. **Identidad de los viajeros:** el paso de viajeros recoge nombres, documentos y nacionalidad, pero `PaymentStep` no los remite al backend. `CheckoutDto` y el caso de uso tampoco admiten todavía ese contrato. Solo se envían hotel, necesidades y cantidad de bebés en las notas existentes. No se debe afirmar que la agencia recibe los datos necesarios para emitir billetes nominativos.
2. **Datos fiscales:** el formulario recoge tipo de comprobante, RUC y razón social, pero el contrato del checkout no los transmite ni guarda como datos de facturación de la reserva.
3. **Bebés:** la base admite tipos `adult`, `child`, `student`, `senior`, sin un tipo `infant`. No se ha reclasificado a los bebés como niños ni alterado precios o inventario. Es necesario acordar y validar su representación antes de persistir identidades de todos los pasajeros.

La solución pendiente debe usar DTOs explícitos, validación de cada grupo contra los pasajeros y servicios del carrito, cifrado de documentos con AAD por viajero, repositorios transaccionales y exposición mínima al personal autorizado. Nunca deben colocarse documentos en notas de texto, logs, URL o correos. La tabla `travelers` existe, pero su mera existencia no completa el recorrido.

## Montos, reintentos y correo

- La API recalcula el carrito, compara el total esperado, fija el importe del pago y limita a un intento activo por reserva. Las claves de idempotencia se conservan para reintentos.
- `CARD_FEE_PERCENT`, si se habilita, añade un recargo visual que no está implementado en el cálculo del backend. Debe permanecer desactivado hasta implementar un contrato coherente.
- Las notificaciones usan outbox transaccional, reintentos con backoff y registro de entregas. Existe la ventana documentada de entrega al menos una vez: una caída después del envío y antes del registro puede duplicar un correo.
- Los enlaces de gestión enviados por correo son de un solo uso. La entrega real a un buzón requiere comprobar el SMTP del entorno contratado; el transporte de memoria del CI no prueba esa entrega.

## Evidencia de esta corrección

- Tres pruebas API: formato DTO E.164; cifrado y AAD con replay idempotente; protección del teléfono de un cliente existente.
- Dos pruebas web: normalización de números peruanos y brasileños; rechazo de teléfonos inválidos antes de reenviar.
- TypeScript API y web, oxlint acotado de API y ESLint acotado de web: aprobados localmente.
- No se ejecutaron migraciones ni pruebas contra PostgreSQL del cliente. La persistencia real del nuevo campo debe verificarse además en el CI aislado.

**Estado:** corrección parcial verificable. Viajeros, facturación y contacto actualizado por reserva siguen siendo bloqueos operativos; esta revisión no declara el checkout listo para producción.
