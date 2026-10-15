# ADR-0018 — Auditoría del recorrido de reserva

Fecha: 2026-10-15.

Se amplían los tres escenarios de pago sandbox para comenzar en el buscador público y navegar al tour elegido. Se corrige el espacio inicial introducido por iconos en labels del login, detectado en CI. Commit0815ebd: Quality38759404452 y Browser38759404437 aprobados, 24/24 casos.

Revisión especialista hero_banner_backend y revisión de integración root detectan pérdida de datos en checkout. Se corrige teléfono E.164 con cifrado AES-GCM/AAD en clientes nuevos, sin sobrescribir perfiles existentes mediante correo no verificado. Se conserva contrato de importes e idempotencia. 42 pruebas API de checkout/notificaciones y 2 pruebas web nuevas aprobadas, tipos/lint aprobados por especialista. CI posterior pendiente al preparar esta nota.

Bloqueos operativos: persistencia estructurada/cifrada de viajeros y facturación, contacto actualizado por reserva, pasarela y SMTP reales. No afirmar sitio listo para ventas. Ver docs/qa/checkout-datos-2026-10-15.md. Sin cobros reales, DB cliente ni navegador local.
