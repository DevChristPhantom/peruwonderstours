---
type: source
title: Sitio actual andeanperutours.com (inventario de migración)
status: active
created: 2026-10-07
updated: 2026-10-07
tags:
  - migracion
  - contenido
---

# Sitio actual: www.andeanperutours.com

Fuente: revisión de la home pública el 2026-10-07. Se migra al nuevo dominio
`peruwonderstours.com` conservando contenido y paquetes, rehecho con mucho mejor calidad.
El sitio viejo se abandona tras la migración (ver [[entities/proyecto-turismo-peru]]).

## Estructura de URLs (conservar slugs y redirigir 301 desde el dominio viejo)
- Categorías: `/es/categorias/rutas-del-altiplano`, `/es/categorias/tours-a-machu-picchu`,
  `/es/categorias/paquetes-turisticos-en-peru`
- Destinos: `/es/destinos/cuzco`, `/es/destinos/tours-en-puno`, `/es/destinos/tours-en-arequipa`,
  `/es/destinos/tours-en-ica-paracas`, `/es/destinos/tours-en-lima`
- Otras: `/es/tours`, `/es/blog`, `/es/contactenos`, `/es/testimonios`, `/es/dejar-testimonio`,
  `/es/andean-peru-tours/quienes-somos`, `/es/libro-de-reclamaciones`
- Sistema interno OTM en `/otm/` (credenciales en poder del cliente; **no se guardan aquí**).

## Inventario de productos (~55 tours)
- Cusco 18 · Puno 15 · Arequipa 13 · Ica-Paracas 5 · Lima 4.
- Altiplano: Uros; Sillustani; Uros + Taquile full day; Aramu Muru (privado); Inka Uyo
  (privado, medio día); Titicaca vivencial Uros-Amantaní-Taquile 2D.
- Machu Picchu: full day; Escapada Rápida 3D/2N; Explorador Imperial 4D/3N; Aventura Andina
  5D/4N; Lo Mejor de Perú 5D/4N; Perú Mágico 6D/5N.
- Paquetes multi-destino (mín. 2 pax): Perú Especial 14D/13N; Perú Milenario 10D/9N; Rutas
  Andinas 8D/7N; Perú de Ensueño 8D/7N; Perú Express 5D/4N.
- Arequipa: Ruta Rápida 3D/2N; Ruta del Sillar; Salinas; Pillones; Colca 3D/2N; Colca Profundo 4D/3N.

## Contacto público
- WhatsApp/teléfono +51 989 028 802 · info@ y reservas@ (dominio viejo, migrar a peruwonderstours.com).
- Oficina: Calle N 500, Puno.
- Sellos mostrados: Safe Travels, ESNNA, GERCETUR, MINCETUR, Marca Perú, SERNANP.

## Problemas detectados (oportunidades)
- **Precios no visibles** en ninguna ficha → sin motor de reservas ni carrito.
- Pagos: solo botón PayPal y Western Union, sin checkout integrado.
- **RUC mostrado `20000000000` es un placeholder** → incumple la identificación del proveedor;
  pedir el RUC real.
- Solo español (mercado receptivo necesita inglés como mínimo).
- Enlaces `javascript:void(0)`, alt text y SEO técnico deficientes.

## Pendiente
- Extraer el detalle de cada ficha (itinerario, incluye/no incluye, fotos) y los posts del blog.
- Pedir al cliente exportación de precios y tarifas del OTM.
