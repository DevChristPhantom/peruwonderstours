import Link from "next/link";

import { buttonClass } from "@/components/ui/styles";

/** 404 fuera del panel (URL inexistente): sin sesión ni menú, solo vuelve al inicio. */
export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 text-center">
      <title>Página no encontrada · Panel PWT</title>
      <p className="text-xs font-semibold tracking-[0.08em] text-foreground-muted uppercase">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold">Esta página no existe en el panel</h1>
      <p className="mt-2 text-foreground-muted">Revisa la dirección o vuelve al tablero.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
        Ir al tablero
      </Link>
    </main>
  );
}
