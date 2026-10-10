import type { Metadata } from "next";

import { TaxonomyDetailPage } from "@/components/taxonomy/TaxonomyDetailPage";

export const metadata: Metadata = { title: "Editar destino" };

export default async function DestinationDetailPage({ params, searchParams }: PageProps<"/destinos/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <TaxonomyDetailPage kind="destination" id={id} tab={typeof sp.pestana === "string" ? sp.pestana : undefined} />;
}
