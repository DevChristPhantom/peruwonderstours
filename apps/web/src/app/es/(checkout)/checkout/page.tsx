import type { Metadata } from "next";

import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Pago",
  description: "Completa tu reserva en 3 pasos.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutFlow cardFeePercent={env.CARD_FEE_PERCENT ?? null} />;
}
