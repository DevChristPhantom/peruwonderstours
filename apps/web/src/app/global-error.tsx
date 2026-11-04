"use client";

import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * Último recurso: falla el layout raíz (`[locale]/layout.tsx`) y no hay diccionario ni proveedores.
 * Bilingüe y sin dependencias, como `global-not-found.tsx`.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-PE" className={fontVariables}>
      <body>
        <title>Error · peruwonderstours</title>
        <main className="pwt-container-narrow py-24 text-center" role="alert">
          <p className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">Error 500</p>
          <h1 className="mt-2 font-display text-h1 font-medium">Algo falló de nuestro lado</h1>
          <p lang="en" className="mt-2 text-foreground-muted">
            Something went wrong on our side.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="pwt-link inline-flex min-h-11 items-center">
              Intentar de nuevo · Try again
            </button>
            {/* <a> y no <Link>: recarga completa, porque el router puede ser lo que falló. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/es" className="pwt-link inline-flex min-h-11 items-center">
              Ir al inicio
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/en" lang="en" className="pwt-link inline-flex min-h-11 items-center">
              Go to the home page
            </a>
          </div>
          {error.digest ? <p className="mt-6 font-mono text-sm text-foreground-muted">Ref: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
