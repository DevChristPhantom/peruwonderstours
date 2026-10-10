import type { Metadata } from "next";

import { TaxonomyDetailPage } from "@/components/taxonomy/TaxonomyDetailPage";

export const metadata: Metadata = { title: "Editar categoría" };

export default async function CategoryDetailPage({ params, searchParams }: PageProps<"/categorias/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <TaxonomyDetailPage kind="category" id={id} tab={typeof sp.pestana === "string" ? sp.pestana : undefined} />;
}
