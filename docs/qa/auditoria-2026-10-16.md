# Auditoría integral — 2026-10-16

Rama `feature/sprint-3-funcional` (commit base `19da301`). Entorno local: web dev `localhost:3000`,
compilación de producción `localhost:4100` (`PWT_DEMO_BUILD=1`), API `127.0.0.1:3001`, admin
`localhost:3002`, PostgreSQL `pwt_admin_preview` (:55433) con tarifas y salidas **DEMO**.

Todo lo marcado "verificado" se ejecutó en esta auditoría; lo demás se indica como pendiente.

## Resumen

| Área | Estado | Comentario |
|---|---|---|
| Pruebas automáticas | ✅ | API 253 unit + 32 e2e + 43 con PostgreSQL; admin 14; web 35; navegador 27/27; CI en verde |
| Funcionamiento público | ✅ | 216/216 URLs del sitemap en 200 (es/en/pt); 73 redirecciones legadas OK |
| Compra de punta a punta | ✅ | Reserva sandbox PWT-2026-000001 pagada, voucher por correo, cupos descontados |
| Seguridad | ✅ con notas | Cabeceras, CORS, MFA, bloqueo de login, panel protegido; 2 correcciones menores aplicadas |
| Rendimiento (build) | ✅ | 0,05 s promedio por página; LCP 1,07 s y CLS 0,013 en local |
| Móvil | ✅ | Sin scroll horizontal en 375 px en las páginas clave |
| SEO | ✅ con notas | Etiquetas completas; duplicados PT corregidos; títulos/descripciones largos |
| Legal y datos | ⚠️ | Libro de Reclamaciones, ESNNA y políticas presentes; faltan RUC y datos reales del cliente |
| Repositorio | ⚠️ | Repo **público**; rama `feature/entrega-peruwonderstours` obsoleta |

## 1. Pruebas (verificado)

- API: `typecheck`, `lint`, `test` (253/253, 29 archivos) y `test:e2e` (32/32).
- Admin: `typecheck`, `lint`, `test` (14/14).
- Web: `typecheck`, `lint` (1 aviso previo en `LanguageSwitcher.tsx`), `test` (35/35), paridad de
  1120 claves por idioma.
- `next build` de producción sin errores.
- GitHub Actions "Quality checks" en verde para `51fd38c`, `11956f0` y `19da301`.
- API `test:integration` contra PostgreSQL real: **43/43** sobre bases desechables (`pwt_int_seeded`
  sembrada y `pwt_test` recreada), sin tocar `pwt_admin_preview`. **Corregido:** la prueba de
  `--demo-pricing` solo pasaba en una base con uso previo; en una base limpia la "medición de línea
  base" borraba lo DEMO y fallaba. Ahora lo vuelve a cargar y relee la temporada.
- Suite Playwright local (réplica de `browser-checks.yml` en `pwt_browser_test`, API/web/admin
  compiladas): **27/27**, incluidas las 3 del panel con login real + segundo factor TOTP (catálogo,
  banners, pagos manuales con anulación, usuarios del personal). Un fallo inicial en portugués fue
  caché de datos de Next (`.next-demo/cache/fetch-cache`) heredada de un build contra la API de la
  demo; con la caché limpia pasa. Lección: limpiar `fetch-cache` al cambiar de base entre builds.

## 2. Funcionamiento (verificado)

- 216 URLs del sitemap (72 por idioma) responden 200 en dev y en producción.
- Las 73 reglas de `data/seed/redirects.json` terminan en 200.
- Compra sandbox completa: ficha → calendario (salidas reales) → 3 pasos de checkout → pago
  aprobado → página "¡Tu reserva está pagada!" → correo con voucher. Regla de pago completo en
  salidas a menos de 7 días aplicada (S/ 598 = 2 × S/ 299).
- Sin la cookie de acceso, `/es/reserva/PWT-2026-000001` responde 404.
- Error 500 transitorio `useInsertionEffect of null` en `/pt/tours` **solo en dev**, tras una recarga
  rápida (Fast Refresh) por edición de archivos; no se reproduce en el build de producción.
- Bucle 307 en 28 rutas traducidas al arrancar dev con `--hostname 127.0.0.1` (Next normaliza
  127.0.0.1 → localhost y el rewrite de next-intl se trata como externo). Usar `localhost`.

## 3. Seguridad (verificado)

- Sin secretos en el historial de Git; las URLs de BD en el repo son de CI efímero o marcadores.
- Cabeceras: CSP (nonce en rutas sensibles), `X-Frame-Options: DENY`, `nosniff`, COOP, CORP,
  `Referrer-Policy`, `Permissions-Policy`; la API añade HSTS. Sin `X-Powered-By`.
- CORS: la API solo devuelve `Access-Control-Allow-Origin` para el origen de la web.
- Login de personal: 5 intentos fallidos → 429.
- Panel: todas las rutas sin sesión redirigen a `/login`; `/bff/medios` rechaza otro origen (403);
  la API admin responde 401 sin token o con un JWT falso.
- El sitio no se puede incrustar en iframes (protección contra clickjacking comprobada).
- **Corregido:** el filtro de `?volver=` del login admin aceptaba `/\dominio-externo` (el servidor
  ya lo rechazaba, así que no era explotable); ahora usa el mismo criterio estricto que `safeNext`.
- **Dependencias (`pnpm audit --prod`):** 2 altas y 1 moderada, todas dentro de Prisma
  (`mysql2`, no usado porque la BD es PostgreSQL; `deepmerge-ts`, solo une configuración). Riesgo
  real bajo; actualizar cuando Prisma publique la corrección.
- HSTS de la web: lo debe poner el hosting/proxy en producción (en dev no aplica).

## 4. Rendimiento (verificado en build de producción, red local)

- 216 páginas: 0,053 s promedio, máximo 0,31 s.
- Home: DOMContentLoaded 0,69 s, carga 0,99 s, LCP 1,07 s (H1), CLS 0,013.
- Transferencia home: JS 264 KB, CSS 147 KB, imágenes 243 KB, sin imágenes > 250 KB.
- HTML promedio 234 KB por página (incluye datos de hidratación): revisar en la fase de diseño.
- Valores locales: no sustituyen una medición Web Vitals en el hosting real.

## 5. Móvil (verificado en 375 × 812)

- Sin desbordamiento horizontal en home, tours, ficha, checkout, Libro de Reclamaciones.
- El botón flotante de WhatsApp tapa el borde derecho del campo "Viajeros" al desplazarse; no tapa
  los controles del banner en un teléfono de tamaño real. Aceptable; revisar en el rediseño.

## 6. Accesibilidad (revisión automática parcial)

- axe-core 4.14 (reglas WCAG 2.0/2.1 A y AA) en 11 páginas clave × escritorio y móvil (22 vistas):
  **0 incumplimientos** tras corregir uno: el botón flotante "Reservar" de la ficha en móvil tenía un
  nombre accesible distinto del texto visible (WCAG 2.5.3); ahora el lector anuncia el texto real,
  el precio y la pista "elegir fecha y viajeros".
- `lang` correcto por idioma (es-PE, en, pt-BR); todas las imágenes con `alt`; encabezados sin
  saltos; foco de teclado visible en las tarjetas de destino.
- axe cubre solo las reglas automatizables: falta una prueba manual con lector de pantalla
  (NVDA/VoiceOver) y de navegación completa con teclado.

## 7. SEO (verificado)

- Las 216 páginas tienen `title`, `description`, canonical, hreflang (es-PE/en/pt-BR/x-default),
  `og:image`, JSON-LD y un solo H1.
- 88 títulos > 65 caracteres y 96 descripciones > 160 (Google los recorta): ajustar textos.
- **Corregido:** 57 páginas en portugués (41 tours, 5 categorías, 5 destinos, 6 entradas de blog)
  mostraban el texto en español y eran indexables: contenido duplicado con la versión `es`. Ahora
  llevan `noindex, follow` mientras no tengan traducción propia y se indexan solas al traducirse.
  Español e inglés: 72 + 72 páginas indexables; portugués: 15 indexables.

## 8. Legal y datos del cliente

- Presentes: Libro de Reclamaciones (home y pie), aviso ESNNA, políticas en 3 idiomas, cláusula de
  datos en el checkout. No se usan cookies de analítica ni publicidad, por lo que no se requiere
  banner de consentimiento.
- El pie muestra "RUC: 20000000000 (ejemplo; RUC real pendiente)" y "Razón social: Por confirmar":
  aceptable en una demo, **no** en producción.
- Precios y salidas son DEMO (`db:seed -- --demo-pricing`); quitarlos con
  `db:seed -- --remove-demo-pricing` antes de publicar.
- Los correos de la API enlazan a `PUBLIC_WEB_BASE_URL` (hoy `localhost:4000`, una compilación
  antigua): apuntarlo al servidor que se use en la demo.
- Pendientes del cliente: ver `docs/cliente/solicitud-de-informacion.md` (precios, RUC, pasarela,
  hosting, sellos, redes, dirección).

## 9. Repositorio

- `DevChristPhantom/peruwonderstours` es **público**: cualquiera puede leer el código y los
  documentos internos (preguntas al cliente, revisiones de seguridad, decisiones). No hay
  credenciales, pero conviene hacerlo privado. Decisión del dueño del repo.
- `origin/feature/entrega-peruwonderstours` (1d0ae16, 2026-10-15) es una versión anterior del mismo
  trabajo: no contiene nada que falte en `feature/sprint-3-funcional` (todavía enlaza fotos de
  andeanperutours.com). Se puede archivar o borrar cuando el dueño lo decida.
