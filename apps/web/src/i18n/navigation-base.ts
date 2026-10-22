import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/** Navegación de next-intl sin envolver (ver `navigation.ts`, que expone el `Link` con prefetch por intención). */
export const { Link: BaseLink, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(routing);
