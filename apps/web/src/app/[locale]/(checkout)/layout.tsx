import { setRequestLocale } from "next-intl/server";

import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import type { Locale } from "@/i18n/routing";

/** Checkout con header reducido: sin nav, sin dropdown, sin carrito (checkout.md · Layout). */
export default async function CheckoutLayout({ children, params }: LayoutProps<"/[locale]">) {
  setRequestLocale((await params).locale as Locale);
  return (
    <>
      <CheckoutHeader />
      <main id="contenido" tabIndex={-1} className="min-h-[70vh] focus:outline-none">
        {children}
      </main>
      <SiteFooter variant="minimal" />
    </>
  );
}
