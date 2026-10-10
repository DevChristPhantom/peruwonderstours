import { BookOpenText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SITE } from "@/lib/site";

/**
 * Aviso del Libro de Reclamaciones en la página de inicio (art. 9 y Anexo III del reglamento;
 * Ley 32495: enlace visible y permanente). Complementa el enlace del pie, presente en todas las páginas.
 */
export async function ComplaintsBookNotice() {
  const t = await getTranslations("complaints.notice");
  return (
    <aside aria-label={t("label")} className="pwt-container">
      <Link
        href="/libro-de-reclamaciones"
        className="flex min-h-11 items-center gap-3 rounded-md border border-border-strong bg-surface px-4 py-3 text-sm hover:bg-surface-muted"
      >
        {/* PENDIENTE(cumplimiento): ícono oficial del Libro de Reclamaciones. */}
        <BookOpenText aria-hidden size={24} strokeWidth={1.5} className="shrink-0" />
        <span>
          <strong className="font-medium">{t("label")}</strong>
          <span className="text-foreground-muted"> · {t("text", { name: SITE.name })}</span>
        </span>
      </Link>
    </aside>
  );
}
