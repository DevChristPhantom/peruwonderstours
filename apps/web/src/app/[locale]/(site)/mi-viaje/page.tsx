import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TripPlanView } from "@/components/trip/TripPlanView";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/mi-viaje">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "trip" });
  return pageMetadata({ locale, title: t("title"), description: t("metaDescription"), paths: alternatesFor("/mi-viaje"), index: false });
}

/** HU-B.A5. El carrito vive en el navegador: la página es estática y el plan se arma en el cliente. */
export default function TripPage() {
  return <TripPlanView />;
}
