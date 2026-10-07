---
type: concept
title: Reglas de negocio de reserva y pago
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - negocio
  - reservas
  - pagos
---

# Reglas de negocio: reserva, adelanto, saldo y cancelación

Fuente: página pública `politicas-y-condiciones-de-pago` del sitio viejo
([[sources/sitio-actual-andeanperutours]]), revisada el 2026-10-07, más el alcance
[[concepts/alcance-cliente-v1]] y la máquina de estados de [[concepts/modelo-de-datos]].
Backlog que las usa: [[concepts/backlog-mvp]].

## Lo que el cliente ya publica hoy (vigente en el sitio viejo)

| ID | Regla publicada | Estado para el nuevo sitio |
|---|---|---|
| RN-01 | Para reservar se paga el **50 %** del total. | Coincide con el alcance. Adoptar. |
| RN-02 | El **saldo 50 %** se paga **al menos 7 días antes** del servicio. | Adoptar como valor por defecto, configurable. |
| RN-03 | **Comisión de 3,5 %** si se paga con tarjeta de crédito. | Pregunta abierta: ¿se traslada al cliente en el nuevo checkout? Requiere mostrarse antes de pagar (Código de Consumo). |
| RN-04 | Cancelación con **mínimo 20 días hábiles** de anticipación; se descuentan gastos operativos según servicios ya emitidos (entradas, tren). | Base de la política; falta tabla de penalidades por tramo. |
| RN-05 | Cancelación pocos días antes o el mismo día: **sin devolución**. | Falta definir el umbral exacto ("unos días"). |
| RN-06 | Servicio no usado voluntariamente: sin reembolso. | Adoptar. |
| RN-07 | Cambios sujetos a penalidad y disponibilidad. | Falta monto/porcentaje de penalidad. |
| RN-08 | Precios sujetos a cambio y disponibilidad. | En el sitio nuevo el precio **se congela** al crear el hold del checkout (ver RN-12). |
| RN-09 | "La reserva solo es válida cuando ha sido liquidado el importe total". | **Contradice RN-01.** Proponer: reserva *confirmada* con el adelanto; *pagada* con el total. Confirmar con el cliente. |
| RN-10 | Machu Picchu tiene cupo limitado: reservar con anticipación (paquetes largos: 90 días recomendados). | Ver RN-14. |
| RN-11 | Tickets de tren, ingreso a Machu Picchu y sobrevuelo de Nazca **no reembolsables** una vez emitidos (pestaña "Políticas" de 4 paquetes). | Adoptar como atributo por componente del tour. |

## Reglas propuestas para el sistema nuevo (supuestos a validar)

- **RN-12 Precio congelado**: al pasar a checkout se crea un hold de cupo (15 min, configurable) y
  se congela el precio de cada ítem. Si el precio cambió entre carrito y checkout, se muestra el
  nuevo precio y se pide aceptación explícita antes de crear el hold.
- **RN-13 Opción de pago**: el cliente elige adelanto 50 % o 100 %. Si el primer servicio cae dentro
  del plazo del saldo (≤ 7 días), solo se ofrece 100 %.
- **RN-14 Adelanto mayor para componentes con terceros**: tours con boleto Machu Picchu/tren pueden
  tener `depositPercentOverride` (p. ej. 100 % del costo del boleto). Pendiente del cliente.
- **RN-15 Redondeo**: montos en céntimos; el adelanto se redondea al céntimo y saldo = total − adelanto.
- **RN-16 Comprobante**: se emite boleta/factura por cada pago recibido (adelanto y saldo).
- **RN-17 Saldo vencido**: recordatorios a −10, −8 y −7 días; vencido el plazo, la reserva pasa a
  revisión del staff (no se cancela automáticamente hasta que el cliente defina la política).
- **RN-18 Mínimo de pasajeros**: el sitio viejo muestra "Mín. 2" en todos los tours (incluidos privados).
  Se respeta `minPax` por tour; si el cliente reserva con menos, se permite solo con suplemento
  *single* definido por el cliente (pendiente).
- **RN-19 Tarifas diferenciadas**: el modelo soporta tarifa por tipo de pasajero (adulto, menor,
  estudiante, adulto mayor) y por residencia (nacional/CAN/extranjero), porque las entradas
  (Machu Picchu, boleto turístico del Cusco) difieren por nacionalidad y edad. Valores pendientes.
- **RN-20 Temporadas**: precio por temporada (alta, baja, feriados largos: Semana Santa, Fiestas
  Patrias 28-29 jul, Inti Raymi 24 jun, fin de año). Calendario y recargos pendientes.

## Preguntas abiertas
Ver la lista completa al final de [[concepts/backlog-mvp]].
