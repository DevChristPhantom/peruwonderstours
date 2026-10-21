import { ChevronRight } from "lucide-react";
import Link from "@/components/ui/IntentLink";
import { getTranslations } from "next-intl/server";

import { breadcrumbJsonLd, JsonLd, type Crumb } from "@/lib/seo/json-ld";

/**
 * Migas de pan + JSON-LD BreadcrumbList. El último ítem es la página actual. Las rutas llegan ya
 * resueltas por idioma (`localePath`), por eso se usa `next/link`.
 */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslations("common");
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label={t("breadcrumbs")} className="text-sm text-foreground-muted">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.path} className="inline-flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="line-clamp-1 text-foreground">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.path} className="inline-flex min-h-11 items-center hover:text-foreground hover:underline md:min-h-8">
                      {item.name}
                    </Link>
                    <ChevronRight aria-hidden size={14} strokeWidth={1.5} />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
