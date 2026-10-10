import type { Metadata } from "next";

import { TripPlanView } from "@/components/trip/TripPlanView";

export const metadata: Metadata = {
  title: "Mi viaje",
  description: "Tu carrito como itinerario día a día, con avisos de fechas y de aclimatación.",
  alternates: { canonical: "/es/mi-viaje" },
  robots: { index: false, follow: true },
};

/** HU-B.A5. El carrito vive en el navegador: la página es estática y el plan se arma en el cliente. */
export default function TripPage() {
  return <TripPlanView />;
}
