import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { ComplaintStatusView } from "@/lib/api/complaints";
import { formatDateTime, formatInstantDate } from "@/lib/format";

const KNOWN_STATUSES = ["received", "in_review", "answered", "closed", "settled"] as const;
type KnownStatus = (typeof KNOWN_STATUSES)[number];
const isKnownStatus = (s: string): s is KnownStatus => (KNOWN_STATUSES as readonly string[]).includes(s);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[200px_1fr]">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  );
}

/**
 * Estado de una Hoja de Reclamación (F7). Solo datos del caso: no muestra documento ni teléfono del
 * consumidor. El detalle y la respuesta se muestran tal como se registraron (en español, `lang="es-PE"`).
 */
export async function ComplaintStatusCard({ sheet, locale }: { sheet: ComplaintStatusView; locale: Locale }) {
  const t = await getTranslations("access.complaint");
  const status = isKnownStatus(sheet.status) ? t(`statuses.${sheet.status}`) : sheet.status;
  const kind = sheet.type === "reclamo" || sheet.type === "queja" ? t(`types.${sheet.type}`) : sheet.type;
  return (
    <section aria-labelledby="hoja-estado" className="mt-8 rounded-lg border border-border bg-surface p-6">
      <h2 id="hoja-estado" className="text-h3 font-medium">
        {t("sheet", { code: sheet.code })}
      </h2>
      <dl className="mt-4 text-sm">
        {sheet.sheetNumber ? <Row label={t("sheetNumber")}>{sheet.sheetNumber}</Row> : null}
        <Row label={t("status")}>
          <strong className="font-medium">{status}</strong>
        </Row>
        {sheet.submittedAt ? <Row label={t("submittedAt")}>{formatDateTime(sheet.submittedAt, locale)}</Row> : null}
        {sheet.responseDueAt ? <Row label={t("responseDueAt")}>{formatInstantDate(sheet.responseDueAt, locale)}</Row> : null}
        <Row label={t("kind")}>{kind}</Row>
        <Row label={t("detail")}>
          <span lang="es-PE">{sheet.detail}</span>
        </Row>
        <Row label={t("request")}>
          <span lang="es-PE">{sheet.consumerRequest}</span>
        </Row>
      </dl>
      <h3 className="mt-6 text-h4 font-medium">{t("answer")}</h3>
      {sheet.answer ? (
        <div className="mt-2">
          <p className="text-sm text-foreground-muted">{t("answeredAt", { date: formatDateTime(sheet.answer.sentAt, locale) })}</p>
          <p lang="es-PE" className="mt-2 whitespace-pre-line">
            {sheet.answer.text}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-foreground-muted">{t("noAnswer")}</p>
      )}
    </section>
  );
}
