# UI refresh — web y administración

Modo: Redesign · Preserve. Autorización: el cliente pide mejorar ambas interfaces con sus skills y guía de motion; se conserva la identidad previamente acordada.

Web: turismo editorial cálido, fotos reales, contraste claro entre explorar y reservar. Diales: variación 6, motion 7, densidad 4, activos 9, fidelidad 10.
Admin: herramienta de operación, lectura rápida y acciones predecibles. Diales: variación 3, motion 3, densidad 7, activos 3, fidelidad 10.

Se mantienen azul Titicaca, terracota, piedra, estados semánticos, Geist/Fraunces y tokens del MASTER. Logo: `apps/web/public/logo.png`. Fotos: catálogo `data/seed`, manifiesto de medios y origen legado ya configurado. Las fuentes están en `packages/ui/src/fonts`.

Mejorar: jerarquía de encabezados, agrupación, navegación y superficies; respuesta de botones, campos, tablas y enlaces; entrada más rápida de hero/buscador; estados de foco, carga y deshabilitado.

Motion: botones 150 ms, entradas 400–600 ms, easing existente, transform/opacity. Hover de elevación solo con puntero fino; movimiento reducido sin desplazamientos. Sin cursor perseguidor, scroll pinning nuevo ni librerías redundantes. Admin sin movimiento en confirmaciones destructivas.

Contratos protegidos: rutas, slugs, formularios, acciones, validación, permisos, MFA, cookies/CSP, precios, traducciones, contenido legal, estado persistido y datos reales. Sin nuevas cifras o testimonios.

Las recomendaciones de UI UX Pro Max se contrastan con el MASTER: no se reemplaza la paleta por negro/dorado ni se adoptan efectos Apple Liquid Glass ajenos a la marca. Las skills adjuntas se instalaron desde sus repositorios completos y la guía del cliente como `tourism-motion-designer`.

Verificación: inspección de código, tipos/lint, pruebas existentes, builds y rutas HTTP. La inspección visual automatizada está limitada por la política del navegador integrado; no afirmar capturas ni aprobación responsive que no se hayan ejecutado.
