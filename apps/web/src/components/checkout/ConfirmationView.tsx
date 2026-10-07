"use client";

import { Clock, Copy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useIsClient } from "@/hooks/useClientOnly";

import { describeTravelers } from "@/lib/cart/types";
import { loadConfirmation, type OrderConfirmation } from "@/lib/checkout/sandbox-order";
import { formatDate, formatMoney } from "@/lib/format";
import { whatsappHref, SITE } from "@/lib/site";
import { formatTotals, lineTotalLabel } from "@/components/cart/cart-helpers";
import { buttonClass } from "@/components/ui/button-styles";

const TITLES: Record<OrderConfirmation["status"], string> = {
  confirmed: "¡Tu reserva está confirmada",
  paid: "¡Tu reserva está confirmada",
  pending_payment: "Tu reserva está pendiente de pago",
  quote_requested: "Recibimos tu solicitud de reserva",
};

/** Confirmación (confirmacion.md). Lee la orden sandbox de sessionStorage (sin datos personales en la URL). */
export function ConfirmationView() {
  const isClient = useIsClient();
  const [order] = useState<OrderConfirmation | null>(() => (typeof window === "undefined" ? null : loadConfirmation()));
  const [copied, setCopied] = useState(false);

  if (!isClient) {
    return <div className="pwt-container-narrow h-96 py-16" aria-busy="true" />;
  }

  if (order === null) {
    return (
      <div className="pwt-container-narrow py-20 text-center">
        <h1 className="font-display text-h1 font-medium">No encontramos tu reserva</h1>
        <p className="mt-3 text-foreground-muted">
          Este enlace ya no es válido en este navegador. Revisa el correo de confirmación o escríbenos por WhatsApp.
        </p>
        <Link href="/es/tours" className={buttonClass("secondary", "lg", "mt-6")}>
          Ver tours
        </Link>
      </div>
    );
  }

  const pending = order.status === "pending_payment";
  const quote = order.status === "quote_requested";
  const hasBalance = order.plan.totals.some((t) => t.balanceCents > 0) && !quote && !pending;
  const title = `${TITLES[order.status]}${order.status === "confirmed" || order.status === "paid" ? `, ${order.firstName}!` : ""}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el código sigue visible para copiarlo a mano */
    }
  };

  return (
    <div className="pwt-container py-12">
      {order.sandbox ? (
        <p className="mx-auto mb-8 max-w-[720px] rounded-md border border-dashed border-warning bg-warning-soft px-4 py-2 text-center text-sm text-warning">
          Sandbox: esta reserva es simulada; no se cobró nada ni se enviaron correos.
        </p>
      ) : null}

      <section className="mx-auto max-w-[720px] text-center" aria-labelledby="confirm-title">
        {pending || quote ? (
          <Clock aria-hidden size={48} strokeWidth={1.5} className="mx-auto text-warning" />
        ) : (
          <svg viewBox="0 0 52 52" className="mx-auto size-12 text-success" aria-hidden="true">
            <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2" />
            <path className="pwt-check-draw" d="M15 27 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <h1 id="confirm-title" className="mt-4 font-display text-h1 font-medium">
          {title}
        </h1>
        <p className="mt-3 text-foreground-muted">
          {quote
            ? `Te enviaremos la cotización a ${order.emailMasked} y por WhatsApp para confirmar fechas y precio.`
            : `Enviaremos los detalles a ${order.emailMasked} y a tu WhatsApp.`}
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3">
          <p className="font-mono text-[28px] tracking-wide">{order.code}</p>
          <button type="button" onClick={copy} className={buttonClass("outline", "md")}>
            <Copy aria-hidden size={16} strokeWidth={1.5} />
            {copied ? "Copiado" : "Copiar código"}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? "Código copiado" : ""}
          </span>
        </div>
      </section>

      <div className="mx-auto mt-12 grid max-w-[1120px] gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section aria-labelledby="pay-status" className="rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 id="pay-status" className="text-h4 font-medium">
                Estado del pago
              </h2>
              <span
                className={`rounded-pill px-3 py-1 text-sm ${hasBalance || pending || quote ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}
              >
                {quote ? "Por cotizar" : pending ? "Pendiente" : hasBalance ? "Saldo pendiente" : "Pagado completo"}
              </span>
            </div>
            <dl className="mt-4 space-y-2">
              {order.payment ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Pagaste hoy</dt>
                  <dd className="tabular text-right">
                    {formatMoney(order.payment.amountCents, order.payment.currency)}
                    <span className="block text-sm text-foreground-muted">{order.payment.methodLabel}</span>
                  </dd>
                </div>
              ) : null}
              {pending && order.pending ? (
                <div>
                  <dt className="text-foreground-muted">Código de pago</dt>
                  <dd className="font-mono">{order.pending.reference}</dd>
                  <dd className="text-sm text-foreground-muted">{order.pending.instructions}</dd>
                </div>
              ) : null}
              {hasBalance ? (
                <div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-foreground-muted">Saldo pendiente</dt>
                    <dd className="tabular">{formatTotals(order.plan.totals, "balanceCents")}</dd>
                  </div>
                  <ul className="mt-1 space-y-1 text-sm text-foreground-muted">
                    {order.plan.lines
                      .filter((l) => (l.balanceCents ?? 0) > 0 && l.balanceDueDate && l.currency)
                      .map((l) => (
                        <li key={l.lineId}>
                          {l.title}: {formatMoney(l.balanceCents ?? 0, l.currency!)} · vence {formatDate(l.balanceDueDate!)}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-medium">Total de la reserva</dt>
                <dd className="tabular font-semibold">{formatTotals(order.plan.totals, "totalCents")}</dd>
              </div>
            </dl>
            {hasBalance ? (
              <p className="mt-3 text-sm text-foreground-muted">
                Te recordaremos el saldo por correo y WhatsApp antes del vencimiento.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="your-tours">
            <h2 id="your-tours" className="text-h4 font-medium">
              Tus tours
            </h2>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {[...order.lines]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((line) => (
                  <li key={line.id} className="flex gap-4 py-4">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                      {line.image ? <Image src={line.image.src} alt="" fill sizes="64px" className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <Link href={line.path} className="hover:underline">
                          {line.title}
                        </Link>
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {formatDate(line.date)} · {describeTravelers(line.travelers)}
                      </p>
                    </div>
                    <p className="tabular text-sm">{lineTotalLabel(line)}</p>
                  </li>
                ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="next-steps" className="rounded-lg bg-surface-muted p-6">
            <h2 id="next-steps" className="text-h4 font-medium">
              Próximos pasos
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>Revisa tu correo: ahí estará tu voucher.</li>
              <li>Te escribiremos por WhatsApp antes del tour para coordinar el recojo.</li>
              <li>Lleva tu DNI o pasaporte original (obligatorio para Machu Picchu).</li>
              <li>Si vas a Puno, llega un día antes para aclimatarte a la altura.</li>
            </ol>
          </section>
          <section aria-labelledby="help" className="text-sm">
            <h2 id="help" className="font-medium">
              ¿Necesitas cambiar algo?
            </h2>
            <a href={whatsappHref(`Hola, tengo una consulta sobre mi reserva ${order.code}.`)} target="_blank" rel="noopener noreferrer" className="pwt-link mt-1 inline-flex min-h-11 items-center">
              Escríbenos por WhatsApp {SITE.whatsapp.display}
            </a>
            <p>
              <Link href="/es/libro-de-reclamaciones" className="pwt-link">
                Libro de Reclamaciones
              </Link>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
