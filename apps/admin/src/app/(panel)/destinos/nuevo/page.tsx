import type { Metadata } from "next";

import { TaxonomyNewPage } from "@/components/taxonomy/TaxonomyNewPage";

export const metadata: Metadata = { title: "Nuevo destino" };

export default function NewDestinationPage() {
  return <TaxonomyNewPage kind="destination" />;
}
