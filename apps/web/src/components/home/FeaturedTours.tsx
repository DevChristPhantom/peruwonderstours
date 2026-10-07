import Link from "next/link";

import type { TourSummary } from "@/lib/catalog/types";
import { TourCard } from "@/components/tours/TourCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";

export interface FeaturedGroup {
  key: string;
  label: string;
  tours: TourSummary[];
  emptyText: string;
}

function Grid({ group }: { group: FeaturedGroup }) {
  if (!group.tours.length) {
    return (
      <p className="rounded-lg border border-dashed border-border-strong p-6 text-foreground-muted">
        {group.emptyText}{" "}
        <Link href="/es/categorias/full-days" className="pwt-link">
          Mira los tours de 1 día.
        </Link>
      </p>
    );
  }
  return (
    <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
      {group.tours.map((t) => (
        <li key={t.slug}>
          <TourCard tour={t} />
        </li>
      ))}
    </ul>
  );
}

export function FeaturedTours({ groups, totalTours }: { groups: FeaturedGroup[]; totalTours: number }) {
  return (
    <section className="pwt-section bg-surface-muted" aria-labelledby="paquetes-title">
      <div className="pwt-container">
        <SectionHeading
          id="paquetes-title"
          title="Paquetes destacados"
          link={{ href: "/es/tours", label: `Ver los ${totalTours} tours` }}
        />
        <Tabs
          label="Filtrar paquetes destacados"
          items={groups.map((g) => ({ key: g.key, label: g.label, content: <Grid group={g} /> }))}
        />
      </div>
    </section>
  );
}
