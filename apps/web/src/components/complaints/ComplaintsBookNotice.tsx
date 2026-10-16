import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
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
        className="group grid grid-cols-1 items-center gap-5 rounded-xl border border-border-strong bg-surface p-5 text-sm shadow-sm hover:bg-surface-muted md:grid-cols-[220px_minmax(0,1fr)_auto] md:p-6"
      >
        <Image src="/official/complaints-book.webp" width={686} height={386} alt="" className="h-auto w-full max-w-[220px] rounded-sm" />
        <span className="min-w-0">
          <strong className="block font-display text-2xl font-medium text-foreground">{t("label")}</strong>
          <span className="mt-2 block leading-relaxed text-foreground-muted">{t("text", { name: SITE.name })}</span>
        </span>
        <span className="flex size-11 items-center justify-center rounded-pill bg-primary text-on-primary"><ArrowUpRight aria-hidden size={20} /></span>
      </Link>
    </aside>
  );
}
