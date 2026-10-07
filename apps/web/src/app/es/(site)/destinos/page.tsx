import type { Metadata } from "next";

import { DestinationCard } from "@/components/home/DestinationsSection";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { getDestinations } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Destinos",
  description: "Puno, Cusco, Arequipa, Ica-Paracas y Lima: elige tu destino y descubre nuestros tours.",
  path: "/es/destinos",
});

export default async function DestinationsPage() {
  const destinations = await getDestinations();
  return (
    <div className="pwt-container pt-8 pb-20">
      <Breadcrumbs
        items={[
          { name: "Inicio", path: "/es" },
          { name: "Destinos", path: "/es/destinos" },
        ]}
      />
      <h1 className="mt-4 mb-8 font-display text-h1 font-medium">Destinos</h1>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
        {destinations.map((d) => (
          <li key={d.slug}>
            <DestinationCard destination={d} />
          </li>
        ))}
      </ul>
    </div>
  );
}
