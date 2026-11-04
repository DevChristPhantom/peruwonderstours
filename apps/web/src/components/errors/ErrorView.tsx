"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startTransition, useEffect, useRef } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { whatsappHref } from "@/lib/site";

interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** `checkout`: tranquiliza sobre el carrito y un posible pago ya hecho. */
  variant?: "site" | "checkout";
}

/**
 * Pantalla de error 500 (error.tsx). No muestra el mensaje técnico: solo el `digest`, que el equipo
 * cruza con los logs del servidor cuando el cliente lo envía por WhatsApp.
 */
export function ErrorView({ error, reset, variant = "site" }: ErrorViewProps) {
  const t = useTranslations("errorPage");
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const digest = error.digest ?? "—";

  useEffect(() => {
    console.error(error);
    heading.current?.focus();
  }, [error]);

  // Los errores de componentes de servidor solo se reintentan pidiendo de nuevo los datos.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  const checkout = variant === "checkout";
  return (
    <div className="pwt-container-narrow py-24 text-center" role="alert">
      <p className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">{t("eyebrow")}</p>
      <h1 ref={heading} tabIndex={-1} className="mt-2 font-display text-h1 font-medium focus:outline-none">
        {checkout ? t("checkoutTitle") : t("title")}
      </h1>
      <p className="mx-auto mt-3 max-w-prose text-foreground-muted">{checkout ? t("checkoutBody") : t("body")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} className={buttonClass("primary", "lg")}>
          <RotateCw aria-hidden size={18} /> {t("retry")}
        </button>
        <Link href={checkout ? "/carrito" : "/"} className={buttonClass("outline", "lg")}>
          {checkout ? t("checkoutCart") : t("home")}
        </Link>
        <a
          href={whatsappHref(t("whatsappMessage", { digest }))}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("ghost", "lg")}
        >
          {t("whatsapp")}
        </a>
      </div>
      {error.digest ? <p className="mt-6 font-mono text-sm text-foreground-muted">{t("reference", { digest })}</p> : null}
    </div>
  );
}
