import type { Metadata } from "next";

import { TaxonomyNewPage } from "@/components/taxonomy/TaxonomyNewPage";

export const metadata: Metadata = { title: "Nueva categoría" };

export default function NewCategoryPage() {
  return <TaxonomyNewPage kind="category" />;
}
