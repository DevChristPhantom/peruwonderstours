"use client";

import { CheckCircle2, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { COMPLAINT_DEFINITIONS, COMPLAINT_LEGENDS, CONFORMITY_TEXT, DOC_TYPES, amountToCents, type ComplaintReceipt } from "@/lib/complaints/schema";
import { formatDateTime, formatInstantDate, formatMoney } from "@/lib/format";
import { buttonClass } from "@/components/ui/button-styles";

/** La constancia es el documento legal: se emite en español en todos los idiomas (Anexo I). */
const PENDING = "por confirmar";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1 border-b border-border py-2 sm:grid-cols-[220px_1fr]">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="whitespace-pre-line">{value || <span className="italic">{PENDING}</span>}</dd>
    </div>
  );
}

/**
 * Constancia de la Hoja de Reclamación (art. 4-B): código, fecha y hora de presentación (Lima),
 * fecha límite de respuesta y todos los campos, imprimible / guardable como PDF desde el navegador.
 * Los datos personales solo viven en memoria de esta página (no se guardan en el navegador).
 */
export function ComplaintReceiptView({ receipt }: { receipt: ComplaintReceipt }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const locale = useLocale();
  const t = useTranslations("complaints.receipt");
  useEffect(() => headingRef.current?.focus(), []);
  const v = receipt.values;
  const amount = amountToCents(v.claimedAmount);
  const typeLabel = v.declaredType === "unknown" ? "No indicado (se tramita como reclamo)" : v.declaredType === "queja" ? "Queja" : "Reclamo";

  return (
    <div className="pwt-print-area">
      <div lang={locale} className="rounded-lg border border-success bg-success-soft p-5 text-success print:hidden" role="status">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 aria-hidden size={20} strokeWidth={1.5} />
          {t("registered")}
        </p>
        <p className="mt-1 text-sm text-foreground">
          {t.rich("copySent", {
            email: v.email,
            date: formatInstantDate(receipt.responseDueAt, locale),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="mt-8 font-display text-h2 font-medium focus:outline-none">
        Libro de Reclamaciones · Hoja de reclamación
      </h2>
      <dl className="mt-4 text-sm">
        <Row label="Código" value={receipt.code} />
        <Row label="N.º de hoja" value={receipt.sheetNumber ?? receipt.code} />
        <Row label="Fecha y hora de presentación" value={`${formatDateTime(receipt.submittedAt)} (hora de Lima)`} />
        <Row label="Fecha límite de respuesta" value={`${formatInstantDate(receipt.responseDueAt)} (15 días hábiles)`} />
        <Row label="Proveedor / RUC" value={`${receipt.provider.legalName ?? PENDING} · RUC ${receipt.provider.ruc ?? PENDING}`} />
        <Row
          label="Establecimiento"
          value={[receipt.provider.establishmentAddress, receipt.provider.establishmentCode].filter(Boolean).join(" · ") || null}
        />
      </dl>

      <h3 className="mt-6 font-medium">1. Identificación del consumidor reclamante</h3>
      <dl className="mt-2 text-sm">
        <Row label="Nombre" value={v.fullName} />
        <Row label="Domicilio" value={v.address} />
        <Row label="Documento" value={`${DOC_TYPES.find((d) => d.value === v.docType)?.label ?? v.docType} ${v.docNumber}`} />
        <Row label="Teléfono / correo" value={`${v.phone} · ${v.email}`} />
        {v.isMinor ? (
          <Row
            label="Padre, madre o representante"
            value={`${v.guardianFullName}\n${v.guardianAddress}\n${v.guardianPhone} · ${v.guardianEmail}`}
          />
        ) : null}
      </dl>

      <h3 className="mt-6 font-medium">2. Identificación del bien contratado</h3>
      <dl className="mt-2 text-sm">
        <Row label="Bien" value={v.goodType === "product" ? "Producto" : "Servicio"} />
        <Row label="Monto reclamado" value={amount === null ? "No indicado" : formatMoney(amount, v.currency)} />
        <Row label="Descripción" value={v.goodDescription} />
        {v.bookingCode ? <Row label="Código de reserva" value={v.bookingCode} /> : null}
      </dl>

      <h3 className="mt-6 font-medium">3. Detalle de la reclamación y pedido</h3>
      <dl className="mt-2 text-sm">
        <Row label="Tipo" value={typeLabel} />
        <Row label="Detalle" value={v.detail} />
        <Row label="Pedido" value={v.consumerRequest} />
        <Row label="Respuesta por" value={v.responseChannel === "letter" ? "Carta al domicilio" : "Correo electrónico"} />
        <Row label="Conformidad (reemplaza la firma)" value={`Aceptada. «${CONFORMITY_TEXT}»`} />
      </dl>

      <div className="mt-6 space-y-1 text-xs text-foreground-muted">
        <p>{COMPLAINT_DEFINITIONS.reclamo}</p>
        <p>{COMPLAINT_DEFINITIONS.queja}</p>
        <p>Destinatario: consumidor.</p>
        {COMPLAINT_LEGENDS.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>

      <button type="button" className={buttonClass("primary", "lg", "mt-8 print:hidden")} onClick={() => window.print()}>
        <Printer aria-hidden size={18} strokeWidth={1.5} />
        <span lang={locale}>{t("print")}</span>
      </button>
    </div>
  );
}
