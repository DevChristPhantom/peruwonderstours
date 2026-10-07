import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { breadcrumbJsonLd, JsonLd, type Crumb } from "@/lib/seo/json-ld";

/** Migas de pan + JSON-LD BreadcrumbList. El último ítem es la página actual. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items)} />
      <nav aria-label="Migas de pan" className="text-sm text-foreground-muted">
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
