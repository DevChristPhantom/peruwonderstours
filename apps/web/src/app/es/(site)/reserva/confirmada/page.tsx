import type { Metadata } from "next";

import { ConfirmationView } from "@/components/checkout/ConfirmationView";

export const metadata: Metadata = {
  title: "Reserva",
  robots: { index: false, follow: false },
};

// TODO(backend): ruta definitiva /es/reserva/[codigo]/confirmada con token firmado (confirmacion.md).
export default function ConfirmationPage() {
  return <ConfirmationView />;
}
