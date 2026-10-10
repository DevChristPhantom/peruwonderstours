"use client";

import { ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { useTravelersText } from "@/hooks/useTravelersText";
import { computePaymentPlan } from "@/lib/checkout/payment-plan";
import { formatDate, todayInLima } from "@/lib/format";
import { useCartStore } from "@/stores/cart-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";
import { formatTotals, lineTotalLabel } from "./cart-helpers";

/**
 * Mini-carrito (carrito.md): <dialog> modal nativo → foco atrapado, Esc cierra, fondo inerte.
 * Drawer derecho 420 px en desktop; hoja inferior al 90 % en móvil.
 */
export default function CartDrawer() {
  const travelersText = useTravelersText();
  const open = useUiStore((s) => s.cartDrawerOpen);
  const close = useUiStore((s) => s.closeCartDrawer);
  const lines = useCartStore((s) => s.lines);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      close();
      const returnTo = useUiStore.getState().cartDrawerReturnFocus;
      if (returnTo?.isConnected) returnTo.focus();
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [close]);

  const plan = computePaymentPlan(lines, "deposit", todayInLima());

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-drawer-title"
      className="pwt-drawer m-0 mt-auto rounded-t-xl md:mt-0 md:ml-auto md:rounded-none h-[90svh] max-h-none w-full max-w-none bg-surface p-0 text-foreground shadow-overlay backdrop:bg-overlay md:h-full md:w-[420px]"
      onClick={(e) => {
        // Clic en el scrim (el propio <dialog>, fuera del contenido) cierra.
        if (e.target === e.currentTarget) close();
      }}
      data-lenis-prevent
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="cart-drawer-title" ref={titleRef} tabIndex={-1} className="font-display text-h3 font-medium focus:outline-none">
            Tu carrito
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar carrito"
            className="inline-flex size-11 items-center justify-center rounded-pill hover:bg-surface-muted"
          >
            <X aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag aria-hidden size={40} strokeWidth={1.25} className="text-border-strong" />
            <p className="text-h4 font-medium">Tu carrito está vacío</p>
            <p className="text-foreground-muted">Explora tours en Puno, Cusco y Arequipa.</p>
            <Link href="/es/tours" onClick={close} className={buttonClass("secondary", "lg")}>
              Ver tours
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5" aria-label="Tours en tu carrito">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3 py-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {line.image ? <Image src={line.image.src} alt="" fill sizes="64px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium">{line.title}</p>
                    <p className="text-sm text-foreground-muted">
                      {formatDate(line.date)} · {travelersText(line.travelers)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-medium">{lineTotalLabel(line)}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-border p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
              <div className="flex items-baseline justify-between">
                <span className="text-foreground-muted">Subtotal</span>
                <span className="tabular text-h4 font-semibold">{formatTotals(plan.totals, "totalCents")}</span>
              </div>
              {plan.unpricedCount > 0 ? (
                <p className="text-sm text-foreground-muted">
                  {plan.unpricedCount === lines.length
                    ? "Te enviaremos el precio de estos tours antes de cobrar."
                    : `${plan.unpricedCount} ${plan.unpricedCount === 1 ? "tour está" : "tours están"} por cotizar.`}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href="/es/carrito" onClick={close} className={buttonClass("outline", "lg")}>
                  Ver carrito
                </Link>
                <Link href="/es/checkout" onClick={close} className={buttonClass("primary", "lg")}>
                  Continuar con la reserva
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
