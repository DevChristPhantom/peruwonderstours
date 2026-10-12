"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";

import { submitComplaintAction } from "@/app/[locale]/(site)/libro-de-reclamaciones/actions";
import {
  COMPLAINT_DEFINITIONS,
  COMPLAINT_LEGENDS,
  CONFORMITY_TEXT,
  DOC_TYPES,
  EMPTY_COMPLAINT,
  complaintSchema,
  type ComplaintReceipt,
  type ComplaintValues,
} from "@/lib/complaints/schema";
import { useFormat } from "@/hooks/useFormat";
import { useLimaToday } from "@/hooks/useClientOnly";
import { Link } from "@/i18n/navigation";
import { useUiStore } from "@/stores/ui-store";
import { ErrorSummary, fieldId, flattenErrors, SelectField, TextField, useErrorText } from "@/components/checkout/form-fields";
import { buttonClass } from "@/components/ui/button-styles";
import { ComplaintReceiptView } from "./ComplaintReceiptView";
import { EnglishHelp, Section, TextArea, useHint, useLegalLabel } from "./ComplaintFormParts";

/** Campos del resumen de errores, en el orden del formulario. */
const SUMMARY_FIELDS = [
  "fullName", "docNumber", "address", "phone", "email", "emailConfirm", "guardianFullName", "guardianAddress",
  "guardianPhone", "guardianEmail", "claimedAmount", "goodDescription", "bookingCode", "declaredType", "detail",
  "consumerRequest", "conformityAccepted",
] as const;

export interface ProviderInfo {
  legalName: string | null;
  ruc: string | null;
  establishmentAddress: string | null;
  establishmentCode: string | null;
}

/** Formulario público del Libro de Reclamaciones (sin cuenta, sin pagos previos, orden del Anexo I). */
export function ComplaintForm({ provider }: { provider: ProviderInfo }) {
  // Fecha de Lima del visitante (no la del build: la página es estática).
  const today = useLimaToday();
  const locale = useLocale();
  const t = useTranslations("complaints.form");
  const fmt = useFormat();
  const L = useLegalLabel();
  const hint = useHint();
  const errorText = useErrorText();
  const english = locale !== "es";
  const PENDING = t("pending");
  const LABELS = Object.fromEntries(SUMMARY_FIELDS.map((k) => [k, t(`summary.${k}`)]));
  const announce = useUiStore((s) => s.announce);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ComplaintReceipt | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, submitCount },
  } = useForm<ComplaintValues>({
    resolver: zodResolver(complaintSchema),
    defaultValues: EMPTY_COMPLAINT,
    mode: "onBlur",
    // El foco va al resumen de errores (enlaza a cada campo), no al primer campo.
    shouldFocusError: false,
  });
  const isMinor = useWatch({ control, name: "isMinor" });
  const hasErrors = Object.keys(errors).length > 0;
  // Tras cada intento fallido, el foco va al resumen ya renderizado (WCAG 3.3.1).
  useEffect(() => {
    if (submitCount > 0 && hasErrors) summaryRef.current?.focus();
  }, [submitCount, hasErrors]);
  const declaredType = useWatch({ control, name: "declaredType" });

  const submit = useMutation({
    mutationFn: (values: ComplaintValues) => submitComplaintAction(values),
    onSuccess: (res) => {
      if (res.ok) {
        setReceipt(res.receipt);
        announce(t("announceRegistered", { code: res.receipt.code }));
        window.scrollTo({ top: 0 });
        return;
      }
      setServerError(res.fieldErrors?.length ? null : res.message);
      for (const fe of res.fieldErrors ?? []) setError(fe.path as Path<ComplaintValues>, { type: "server", message: fe.message });
      requestAnimationFrame(() => summaryRef.current?.focus());
    },
    onError: () => {
      setServerError(t("connectionError"));
      requestAnimationFrame(() => summaryRef.current?.focus());
    },
  });

  if (receipt) return <ComplaintReceiptView receipt={receipt} />;

  // Errores en el orden del formulario (= orden del Anexo I).
  const order = Object.keys(EMPTY_COMPLAINT);
  const flat = flattenErrors(errors).sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));

  return (
    <form
      noValidate
      aria-labelledby="hoja-title"
      onSubmit={(e) => {
        setServerError(null);
        handleSubmit((values) => submit.mutate(values))(e);
      }}
    >
      {/* Encabezado de la hoja (Anexo I) */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <p id="hoja-title" className="font-display text-h3 font-medium">
          {L("sheet")}
        </p>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-foreground-muted">{L("sheetNumber")}</dt>
            <dd lang={locale}>{t("autoNumber")}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">{L("date")}</dt>
            <dd>{today ? fmt.date(today) : "…"}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">{L("provider")}</dt>
            <dd>
              {provider.legalName ?? <span className="italic">{PENDING}</span>} · RUC {provider.ruc ?? <span className="italic">{PENDING}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">{L("establishment")}</dt>
            <dd>
              {provider.establishmentAddress ?? <span className="italic">{PENDING}</span>}
              {provider.establishmentCode ? ` · ${provider.establishmentCode}` : ""}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        {serverError ? (
          <ErrorSummary ref={summaryRef} title={t("serverErrorTitle")} errors={[{ path: "submit-complaint", message: serverError }]} />
        ) : submitCount > 0 ? (
          <ErrorSummary ref={summaryRef} errors={flat} labels={LABELS} />
        ) : null}
      </div>

      <Section n={1} title={L("section1")}>
        <div className="md:col-span-2">
          <TextField path="fullName" label={L("fullName")} autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        </div>
        <SelectField path="docType" label={L("docType")} {...register("docType")}>
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
              {english ? ` (${t(`docTypes.${d.value}`)})` : ""}
            </option>
          ))}
        </SelectField>
        <TextField path="docNumber" label={L("docNumber")} autoComplete="off" error={errors.docNumber?.message} {...register("docNumber")} />
        <div className="md:col-span-2">
          <TextField path="address" label={L("address")} autoComplete="street-address" error={errors.address?.message} {...register("address")} />
        </div>
        <TextField
          path="phone"
          label={L("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint={hint("phone")}
          error={errors.phone?.message}
          {...register("phone")}
        />
        <div />
        <TextField path="email" label={L("email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          path="emailConfirm"
          label={L("emailConfirm")}
          type="email"
          autoComplete="email"
          hint={hint("emailConfirm")}
          error={errors.emailConfirm?.message}
          {...register("emailConfirm")}
        />
        <label className="flex min-h-11 cursor-pointer items-start gap-3 md:col-span-2">
          <input id={fieldId("isMinor")} type="checkbox" className="mt-1 size-5 shrink-0" {...register("isMinor")} />
          <span>{L("isMinor")}</span>
        </label>
        {isMinor ? (
          <div className="grid gap-5 rounded-md bg-surface-muted p-4 md:col-span-2 md:grid-cols-2">
            <p className="text-sm font-medium md:col-span-2">{L("guardian")}</p>
            <div className="md:col-span-2">
              <TextField path="guardianFullName" label={L("guardianFullName")} error={errors.guardianFullName?.message} {...register("guardianFullName")} />
            </div>
            <div className="md:col-span-2">
              <TextField path="guardianAddress" label={L("guardianAddress")} error={errors.guardianAddress?.message} {...register("guardianAddress")} />
            </div>
            <TextField path="guardianPhone" label={L("guardianPhone")} type="tel" inputMode="tel" error={errors.guardianPhone?.message} {...register("guardianPhone")} />
            <TextField path="guardianEmail" label={L("guardianEmail")} type="email" error={errors.guardianEmail?.message} {...register("guardianEmail")} />
          </div>
        ) : null}
      </Section>

      <Section n={2} title={L("section2")}>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">{L("goodType")}</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(
              [
                ["service", L("service")],
                ["product", L("product")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 has-[:checked]:border-primary">
                <input type="radio" value={value} {...register("goodType")} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextField
          path="claimedAmount"
          label={declaredType === "reclamo" ? L("claimedAmount") : L("claimedAmountOptional")}
          inputMode="decimal"
          hint={hint("claimedAmount")}
          error={errors.claimedAmount?.message}
          {...register("claimedAmount")}
        />
        <SelectField path="currency" label={L("currency")} {...register("currency")}>
          <option value="PEN">{t("currencyPEN")}</option>
          <option value="USD">{t("currencyUSD")}</option>
        </SelectField>
        <TextArea
          path="goodDescription"
          label={L("goodDescription")}
          rows={2}
          hint={hint("goodDescription")}
          error={errors.goodDescription?.message}
          {...register("goodDescription")}
        />
        <TextField
          path="bookingCode"
          label={L("bookingCode")}
          autoComplete="off"
          hint={hint("bookingCode")}
          error={errors.bookingCode?.message}
          {...register("bookingCode")}
        />
      </Section>

      <Section n={3} title={L("section3")}>
        <fieldset className="md:col-span-2" aria-describedby="tipo-definiciones">
          <legend className="text-sm font-medium">{L("declaredType")}</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(
              [
                ["reclamo", L("reclamo")],
                ["queja", L("queja")],
                ["unknown", L("unknown")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 has-[:checked]:border-primary">
                <input type="radio" value={value} {...register("declaredType")} />
                {label}
              </label>
            ))}
          </div>
          <ul id="tipo-definiciones" className="mt-3 space-y-1 text-sm text-foreground-muted">
            <li>
              {COMPLAINT_DEFINITIONS.reclamo}
              {english ? <EnglishHelp>{t("definitions.reclamo")}</EnglishHelp> : null}
            </li>
            <li>
              {COMPLAINT_DEFINITIONS.queja}
              {english ? <EnglishHelp>{t("definitions.queja")}</EnglishHelp> : null}
            </li>
            <li lang={locale}>{t("unknownNote")}</li>
          </ul>
        </fieldset>
        <TextArea path="detail" label={L("detail")} rows={6} hint={hint("detail")} error={errors.detail?.message} {...register("detail")} />
        <TextArea path="consumerRequest" label={L("consumerRequest")} rows={3} hint={hint("consumerRequest")} error={errors.consumerRequest?.message} {...register("consumerRequest")} />
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">{L("responseChannel")}</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(
              [
                ["email", L("channelEmail")],
                ["letter", L("channelLetter")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 has-[:checked]:border-primary">
                <input type="radio" value={value} {...register("responseChannel")} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      {/* Conformidad que sustituye a la firma (art. 5) */}
      <div className="mt-8">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            id={fieldId("conformityAccepted")}
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            aria-invalid={!!errors.conformityAccepted}
            aria-describedby={errors.conformityAccepted ? `${fieldId("conformityAccepted")}-error` : undefined}
            {...register("conformityAccepted")}
          />
          <span>
            {CONFORMITY_TEXT}
            {english ? <EnglishHelp>{t("conformity")}</EnglishHelp> : null}
          </span>
        </label>
        {errors.conformityAccepted ? (
          <p id={`${fieldId("conformityAccepted")}-error`} className="mt-1 ml-8 text-sm text-danger">
            {errorText(errors.conformityAccepted.message)}
          </p>
        ) : null}
      </div>

      {/* Aviso de privacidad: informativo, no es casilla de consentimiento */}
      <p lang={locale} className="mt-6 rounded-md bg-surface-muted p-4 text-sm text-foreground-muted">
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/politicas/proteccion-de-datos-personales" className="pwt-link" target="_blank">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <button
        id={fieldId("submit-complaint")}
        type="submit"
        className={buttonClass("primary", "lg", "mt-8 w-full md:w-auto")}
        disabled={submit.isPending}
        aria-busy={submit.isPending}
      >
        {submit.isPending ? (
          <>
            <Loader2 aria-hidden size={18} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
            {t("sending")}
          </>
        ) : (
          <span lang={locale}>{t("submit")}</span>
        )}
      </button>

      <div className="mt-8 space-y-2 border-t border-border pt-4 text-sm text-foreground-muted">
        {COMPLAINT_LEGENDS.map((l, i) => (
          <p key={l}>
            {l}
            {english ? <EnglishHelp>{t(i === 0 ? "legends.first" : "legends.second")}</EnglishHelp> : null}
          </p>
        ))}
      </div>
    </form>
  );
}
