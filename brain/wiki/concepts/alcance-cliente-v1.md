---
type: concept
title: Alcance acordado con el cliente (v1)
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - alcance
  - negocio
---

# Alcance acordado con Jorge (v1)

Requisitos explícitos del cliente para [[entities/proyecto-turismo-peru]]:

1. **Rediseño completo** del sitio (contenido y paquetes de
   [[sources/sitio-actual-andeanperutours]], "mucho más mejor").
2. **Pasarela de pagos** integrada (proveedor por definir; puerto `PaymentGateway`).
3. **Carrito de compras** (varios tours/paquetes en una misma compra).
4. **Reserva con adelanto del 50 %**: el cliente paga el 50 % online para confirmar y el
   saldo después (reglas exactas por confirmar, ver abajo).
5. **Cambiar colores del logo** (rebranding a Peru Wonders Tours; falta archivo del logo).

## Referencia visual del hero
Especificación entregada por el usuario: hero a pantalla completa con header y **dropdown
que se transforma (morph)** entre menús, con desenfoque y deslizamiento direccional. Texto
completo en `docs/design/hero-morph-spec.md`. Se adapta a la marca: menús en español,
imágenes del Perú, colores de la marca.

## Reglas del adelanto 50 % (supuestos a confirmar con el cliente)
- Se cobra el 50 % del total del carrito al reservar; el comprobante se emite por el monto pagado.
- Saldo: pago online con enlace antes del viaje (p. ej. 7 días antes) o en efectivo/transferencia
  al llegar. El sistema registra ambos pagos contra la misma reserva.
- Opción de pagar el 100 % de una vez.
- Política de cancelación y reembolso del adelanto: **pendiente del cliente** (obligatorio
  mostrarla antes del pago).
- Tours con boletos de terceros (Machu Picchu, tren) pueden exigir pago mayor: pendiente.

## Hosting
El dominio ya está comprado; el hosting se compra **al terminar la web**. Hasta entonces todo
corre en local.
