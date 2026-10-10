import type { Metadata } from "next";
import Link from "next/link";

import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * 404 para URLs que no coinciden con ninguna ruta (fuera de `/[locale]`). Las páginas con idioma usan
 * `app/[locale]/not-found.tsx`, con header y footer. Bilingüe y neutro (L10: no habla solo de tours).
 */
export const metadata: Metadata = {
  title: "Página no encontrada · Page not found",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="es-PE" className={fontVariables}>
      <body>
        <main className="pwt-container-narrow py-24 text-center">
          <p className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">Error 404</p>
          <h1 className="mt-2 font-display text-h1 font-medium">No encontramos esta página</h1>
          <p lang="en" className="mt-2 text-foreground-muted">
            We could not find this page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/es" className="pwt-link inline-flex min-h-11 items-center">
              Ir al inicio
            </Link>
            <Link href="/en" lang="en" className="pwt-link inline-flex min-h-11 items-center">
              Go to the home page
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
