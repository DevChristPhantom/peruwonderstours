# Google: Perfil de Empresa (Maps) y Search Console

Dos herramientas gratis de Google. Ninguna cambia la web: solo hacen que Google la encuentre y la
muestre mejor.

---

## 1. Perfil de Empresa de Google (la ficha en Google Maps)

**Quién lo hace:** Jorge, con su propia cuenta de Google (jorgechaveztourt@gmail.com). La ficha es del
negocio, no del programador. Después, si quiere, puede agregar a Christian como administrador.

**Dónde:** https://business.google.com → "Administrar ahora".

Antes de empezar, Jorge busca en Google Maps "Peru Wonders Tours Puno". Si ya hay una ficha, la
**reclama** ("¿Eres el propietario?") en vez de crear otra; si hay dos fichas, Google penaliza.

### Datos para copiar y pegar

| Campo | Qué poner |
|---|---|
| Nombre | `Peru Wonders Tours` (exactamente así, sin agregar "tours Puno Machu Picchu": Google suspende fichas con palabras de relleno en el nombre) |
| Categoría principal | `Agencia de viajes` |
| Categorías adicionales | `Operador turístico` y, si aparece, `Agencia de excursiones` |
| ¿Tiene un local que los clientes pueden visitar? | **Sí**, la oficina |
| Dirección | Calle N 500, Puno (confirmar número, referencia y que el pin del mapa caiga en la puerta) |
| Zona de servicio | Puno, Cusco, Arequipa, Lima, Ica |
| Teléfono | +51 924 278 597 |
| Sitio web | `https://peruwonderstours.com` **(ponerlo el día del lanzamiento; hoy la web tiene contraseña)** |
| Horario | Lunes a sábado, 09:00 a 19:00. Domingo cerrado |
| Atributos | WhatsApp, "Atiende en inglés" (si es verdad), formas de pago que acepta |

**Descripción** (máx. 750 caracteres; esta tiene unos 560):

> PERU WONDERS TOURS es una agencia de viajes peruana con oficina en Puno, dedicada a crear experiencias
> inolvidables por los destinos del Perú. Nos especializamos en turismo cultural, histórico, arqueológico
> y de aventura: tours por el Lago Titicaca, Cusco, Machu Picchu, Arequipa y la costa sur. Ofrecemos
> servicios personalizados, atención en español, inglés y portugués, y reservas en línea. Nuestro
> compromiso es brindar calidad y experiencias memorables para que cada viajero descubra las verdaderas
> maravillas del Perú. Descubre la magia del Perú.

(Solo poner "inglés y portugués" si de verdad atienden en esos idiomas.)

### Verificación

Google pide verificar que el negocio existe. Hoy casi siempre es con **un video corto** grabado con el
celular desde la app de Google Maps: mostrar el letrero exterior con el nombre, la calle, entrar a la
oficina y mostrar algo del negocio (RUC, folletos, la computadora con la web). Sin letrero visible suele
rechazarse. Tarda de unos días a un par de semanas.

### Después de verificada (esto es lo que más pesa)

1. **Fotos reales**: logo, portada, fachada con letrero, oficina por dentro, equipo y fotos propias de
   los tours. Mínimo 10. Nada de fotos bajadas de internet.
2. **Servicios / productos**: agregar los tours principales con su precio "desde".
3. **Reseñas**: pedírsela a cada cliente al terminar el tour (Google da un enlace corto para
   compartir por WhatsApp). Responder todas, también las malas, con calma.
4. **Publicaciones**: una novedad o promoción cada 1–2 semanas mantiene la ficha activa.
5. Mismo nombre, dirección y teléfono en todos lados (web, Facebook, TripAdvisor, ficha).

---

## 2. Google Search Console

**Estado (2026-11-16): HECHO.** Propiedad de dominio `peruwonderstours.com` verificada con la cuenta de
Jorge (jorgechaveztourt@gmail.com), por registro TXT en Namecheap (Host `@`,
`google-site-verification=LeOz5b08...`). **No borrar ese TXT**: si se quita, se pierde la verificación.
Falta solo lo del día del lanzamiento (pasos 5–7). Opcional: agregar a Christian como usuario en
Configuración → Usuarios y permisos.

Pasos que se siguieron:

**Dónde:** https://search.google.com/search-console

1. "Agregar propiedad" → tipo **Dominio** → `peruwonderstours.com` (cubre www, panel, http y https).
2. Google da un registro **TXT** (`google-site-verification=...`). Se agrega en Namecheap →
   Domain List → Manage → Advanced DNS → Add New Record → TXT, Host `@`, Value el texto de Google.
3. Esperar unos minutos y pulsar **Verificar**. Esto funciona aunque la web aún tenga contraseña.
4. (Se hizo directo con la cuenta de Jorge, así que él ya es propietario.)

**El día del lanzamiento** (cuando se quite la contraseña y el `noindex`):

5. Sitemaps → enviar `sitemap.xml`.
6. Inspección de URLs → pegar `https://peruwonderstours.com/es` → "Solicitar indexación". Repetir con
   `/en` y `/pt` y 3–4 tours principales.
7. Revisar a la semana: "Páginas" (cuántas indexó) y "Rendimiento" (con qué búsquedas aparece).

Opcional: hacer lo mismo en **Bing Webmaster Tools** (https://www.bing.com/webmasters), que puede
importar todo desde Search Console en un clic. Bing alimenta a ChatGPT y Copilot en sus búsquedas.
