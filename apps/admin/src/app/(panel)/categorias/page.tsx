import type { Metadata } from "next";

import { TaxonomyListPage } from "@/components/taxonomy/TaxonomyListPage";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriesPage({ searchParams }: PageProps<"/categorias">) {
  const sp = await searchParams;
  return <TaxonomyListPage kind="category" deleted={sp.eliminado === "1"} />;
}
