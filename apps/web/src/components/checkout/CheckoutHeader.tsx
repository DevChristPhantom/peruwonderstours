"use client";

import { Lock } from "lucide-react";
import Link from "next/link";

import Image from "next/image";

export function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="pwt-container flex h-16 items-center justify-between">
        <Link
          href="/es"
          aria-label="Peru Wonders Tours, inicio"
          className="inline-flex min-h-11 items-center gap-2.5 text-foreground"
          onClick={(e) => {
            if (!window.confirm("¿Salir del pago? Tu carrito se guarda.")) e.preventDefault();
          }}
        >
          <Image src="/logo.png" alt="" width={120} height={40} className="h-9 w-auto" />
        </Link>
        <p className="inline-flex items-center gap-2 text-sm text-success">
          <Lock aria-hidden size={16} strokeWidth={1.5} />
          Pago seguro
        </p>
      </div>
    </header>
  );
}
