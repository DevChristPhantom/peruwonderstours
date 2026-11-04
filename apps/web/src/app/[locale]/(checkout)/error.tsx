"use client";

import { ErrorView } from "@/components/errors/ErrorView";

/** Error 500 en el checkout: avisa que el carrito sigue guardado y que no se pague dos veces. */
export default function CheckoutError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView {...props} variant="checkout" />;
}
