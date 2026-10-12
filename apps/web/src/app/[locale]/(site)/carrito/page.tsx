import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CartView } from "@/components/cart/CartView";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps<"/[locale]/carrito">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "cart" });
  return pageMetadata({ locale, title: t("title"), description: t("metaDescription"), paths: alternatesFor("/carrito"), index: false });
}

export default function CartPage() {
  return <CartView />;
}
