import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Navegación con rutas traducidas. `Link`, `redirect`, `useRouter` y `usePathname` trabajan con las
 * rutas INTERNAS (`/destinos/[slug]`) y producen la URL del idioma activo (`/en/destinations/...`).
 * Para hrefs ya resueltos (p. ej. `tour.path` del catálogo, que trae el slug traducido) se usa
 * `next/link` directamente.
 */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(routing);
