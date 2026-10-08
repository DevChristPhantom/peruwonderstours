import { BookOpenText } from "lucide-react";
import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * Aviso del Libro de Reclamaciones en la página de inicio (art. 9 y Anexo III del reglamento;
 * Ley 32495: enlace visible y permanente). Complementa el enlace del pie, presente en todas las páginas.
 */
export function ComplaintsBookNotice() {
  return (
    <aside aria-label="Libro de Reclamaciones" className="pwt-container mt-8">
      <Link
        href="/es/libro-de-reclamaciones"
        className="flex min-h-11 items-center gap-3 rounded-md border border-border-strong bg-surface px-4 py-3 text-sm hover:bg-surface-muted"
      >
        {/* TODO(cumplimiento): reemplazar por el ícono oficial del Libro de Reclamaciones. */}
        <BookOpenText aria-hidden size={24} strokeWidth={1.5} className="shrink-0" />
        <span>
          <strong className="font-medium">Libro de Reclamaciones</strong>
          <span className="text-foreground-muted">
            {" "}
            · Conforme al Código de Protección y Defensa del Consumidor, {SITE.name} cuenta con un Libro de Reclamaciones
            virtual a tu disposición.
          </span>
        </span>
      </Link>
    </aside>
  );
}
