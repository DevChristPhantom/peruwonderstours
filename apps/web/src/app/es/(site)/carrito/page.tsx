import type { Metadata } from "next";

import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Tu carrito",
  description: "Revisa tus tours antes de reservar.",
  alternates: { canonical: "/es/carrito" },
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return <CartView />;
}
