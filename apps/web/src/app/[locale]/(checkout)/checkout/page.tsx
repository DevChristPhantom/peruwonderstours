import type { Metadata } from "next";
import { connection } from "next/server";

import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Pago",
  description: "Completa tu reserva en 3 pasos.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Render dinámico: la CSP con nonce (H-02) exige HTML generado por petición.
  await connection();
  return <CheckoutFlow cardFeePercent={env.CARD_FEE_PERCENT ?? null} />;
}
