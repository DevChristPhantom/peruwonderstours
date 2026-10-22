/**
 * Navegación con rutas traducidas. `Link`, `redirect`, `useRouter` y `usePathname` trabajan con las
 * rutas INTERNAS (`/destinos/[slug]`) y producen la URL del idioma activo (`/en/destinations/...`).
 * Para hrefs ya resueltos (p. ej. `tour.path` del catálogo, que trae el slug traducido) se usa
 * `@/components/ui/IntentLink` (envoltorio de `next/link`).
 *
 * `Link` precarga la página solo con intención del usuario (no todas las que aparecen en pantalla).
 */
export { redirect, permanentRedirect, usePathname, useRouter, getPathname } from "./navigation-base";
export { Link } from "./IntentIntlLink";
