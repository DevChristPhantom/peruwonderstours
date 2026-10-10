import type { Metadata } from "next";

import { TaxonomyListPage } from "@/components/taxonomy/TaxonomyListPage";

export const metadata: Metadata = { title: "Destinos" };

export default async function DestinationsPage({ searchParams }: PageProps<"/destinos">) {
  const sp = await searchParams;
  return <TaxonomyListPage kind="destination" deleted={sp.eliminado === "1"} />;
}
