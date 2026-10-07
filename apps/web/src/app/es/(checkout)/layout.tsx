import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

/** Checkout con header reducido: sin nav, sin dropdown, sin carrito (checkout.md · Layout). */
export default function CheckoutLayout({ children }: LayoutProps<"/es">) {
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
