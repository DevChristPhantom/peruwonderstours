import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionPage } from "@/components/tours/CollectionPage";
import { getCategories, getCategory, getToursBySlugs } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo/metadata";

// Slugs nuevos publicados en la API se generan bajo demanda (ISR); los desconocidos dan 404.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/es/categorias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  return pageMetadata({
    title: category.name,
    // TODO(contenido): varias categorías no tienen descripción en el sitio viejo o la tienen errada.
    description: category.description ?? `${category.name}: tours de Peru Wonders Tours en el sur del Perú.`,
    path: category.path,
    image: category.bannerImage?.src,
  });
}

export default async function CategoryPage({ params }: PageProps<"/es/categorias/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const tours = await getToursBySlugs(category.tourSlugs);
  return (
    <CollectionPage
      eyebrow="Categoría"
      title={category.name}
      description={category.description}
      banner={category.bannerImage}
      tours={tours}
      filterHref={`/es/tours?categoria=${category.slug}`}
      crumbs={[
        { name: "Inicio", path: "/es" },
        { name: "Tours", path: "/es/tours" },
        { name: category.name, path: category.path },
      ]}
    />
  );
}
