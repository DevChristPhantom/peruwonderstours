import { ArrowRight, MapPin } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import Link from "@/components/ui/IntentLink";
import type { Destination } from "@/lib/catalog/types";

/**
 * «Sobre el lugar»: descripción corta de cada destino del tour (texto editable en Panel → Destinos).
 * Un destino: tarjeta horizontal con foto. Varios (paquetes): grilla compacta, el principal primero.
 * Solo muestra destinos con descripción; sin ninguna, la sección no se renderiza.
 */
export async function TourPlaces({ id, destinations }: { id: string; destinations: Destination[] }) {
  const places = destinations.filter((d) => d.description?.trim());
  if (places.length === 0) return null;
  const t = await getTranslations("tour.place");
  const many = places.length > 1;

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="scroll-mt-32 font-display text-h2 font-medium" data-reveal>
        {many ? t("titleMany") : t("title")}
      </h2>
      <ul className={`mt-6 grid gap-5 ${many ? "sm:grid-cols-2" : ""}`} data-reveal-stagger>
        {places.map((d, index) => {
          const image = d.cardImage ?? d.bannerImage;
          return (
            <li key={d.key} lang={d.fallback ? "es-PE" : undefined}>
              <article
                className={`group relative flex h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-xs has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring ${
                  many ? "flex-col" : "flex-col md:flex-row"
                }`}
              >
                {image ? (
                  <div className={`relative shrink-0 overflow-hidden bg-surface-muted ${many ? "aspect-[16/9]" : "aspect-[16/9] md:aspect-auto md:w-2/5"}`}>
                    <Image
                      src={image.src}
                      alt={image.alt || t("imageAlt", { name: d.name })}
                      fill
                      sizes={many ? "(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw" : "(min-width: 1024px) 320px, (min-width: 768px) 40vw, 100vw"}
                      className="object-cover transition-transform duration-(--pwt-duration-slow) ease-out [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:group-hover:scale-[1.04] motion-reduce:transition-none"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col gap-3 p-5 md:p-6">
                  {/* Un solo destino: el nombre va como etiqueta. Varios: título por tarjeta y etiqueta solo en el principal. */}
                  {!many || index === 0 ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary uppercase">
                      <MapPin aria-hidden size={14} strokeWidth={1.5} />
                      {many ? t("primary") : d.name}
                    </p>
                  ) : null}
                  {many ? <h3 className="font-display text-h4 font-medium">{d.name}</h3> : null}
                  <p className="pwt-prose text-foreground-muted">{d.description}</p>
                  <Link href={d.path} className="pwt-card-link mt-auto inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary">
                    {t("cta", { name: d.name })}
                    <ArrowRight aria-hidden size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
