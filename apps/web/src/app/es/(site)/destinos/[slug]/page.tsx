import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionPage } from "@/components/tours/CollectionPage";
import { getDestination, getDestinations, getToursBySlugs } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export async function generateStaticParams() {
  const destinations = await getDestinations();
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/es/destinos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getDestination(slug);
  if (!destination) return {};
  return pageMetadata({
    title: `Tours en ${destination.name}`,
    description: destination.description ?? `Tours y paquetes en ${destination.name} con Peru Wonders Tours.`,
    path: destination.path,
    image: destination.bannerImage?.src,
  });
}

export default async function DestinationPage({ params }: PageProps<"/es/destinos/[slug]">) {
  const { slug } = await params;
  const destination = await getDestination(slug);
  if (!destination) notFound();
  const tours = await getToursBySlugs(destination.tourSlugs);
  return (
    <CollectionPage
      eyebrow="Destino"
      title={destination.name}
      description={destination.description}
      banner={destination.bannerImage}
      tours={tours}
      filterHref={`/es/tours?destino=${destination.slug}`}
      crumbs={[
        { name: "Inicio", path: "/es" },
        { name: "Destinos", path: "/es/destinos" },
        { name: destination.name, path: destination.path },
      ]}
    />
  );
}
