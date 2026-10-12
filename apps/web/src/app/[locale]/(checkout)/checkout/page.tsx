import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import type { Locale } from "@/i18n/routing";
import { env } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("metaTitle"), description: t("metaDescription"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage() {
  // Render dinámico: la CSP con nonce (H-02) exige HTML generado por petición.
  await connection();
  return <CheckoutFlow cardFeePercent={env.CARD_FEE_PERCENT ?? null} />;
}
