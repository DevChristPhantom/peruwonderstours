"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, type Ref } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Link } from "@/i18n/navigation";
import { COUNTRY_ISO } from "@/lib/checkout/api-checkout";
import { contactSchema, COUNTRIES, COUNTRY_PHONE, PHONE_COUNTRIES, type ContactValues } from "@/lib/checkout/schemas";
import { buttonClass } from "@/components/ui/button-styles";
import { ErrorSummary, fieldId, flattenErrors, inputClass, SelectField, TextField, useErrorText } from "./form-fields";

/** Regiones ISO de cada código telefónico (el nombre se muestra en el idioma de la página). */
const PHONE_REGIONS: Record<string, string[]> = {
  "+51": ["PE"],
  "+54": ["AR"],
  "+591": ["BO"],
  "+55": ["BR"],
  "+56": ["CL"],
  "+57": ["CO"],
  "+593": ["EC"],
  "+34": ["ES"],
  "+1": ["US", "CA"],
  "+52": ["MX"],
};

/** Nombres de país del idioma activo; el VALOR enviado sigue siendo el de `COUNTRIES`. */
function useCountryNames() {
  const locale = useLocale();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      names = null;
    }
    return (iso: string, fallback: string) => names?.of(iso) ?? fallback;
  }, [locale]);
}

export const EMPTY_CONTACT: ContactValues = {
  firstName: "",
  lastName: "",
  email: "",
  phoneCountry: "+51",
  phone: "",
  country: "Perú",
  receipt: "boleta",
  ruc: "",
  businessName: "",
  marketingEmail: false,
  marketingWhatsapp: false,
  hotel: "",
  notes: "",
};

export function ContactStep({
  defaultValues,
  onSubmit,
  headingRef,
}: {
  defaultValues: ContactValues;
  onSubmit: (values: ContactValues) => void;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations("checkout.contact");
  const countryName = useCountryNames();
  const LABELS: Record<string, string> = {
    firstName: t("firstName"),
    lastName: t("lastName"),
    email: t("emailShort"),
    phone: t("phoneShort"),
    country: t("countryShort"),
    ruc: "RUC",
    businessName: t("businessName"),
    hotel: t("hotel"),
    notes: t("notes"),
  };
  const summaryRef = useRef<HTMLDivElement>(null);
  const errorText = useErrorText();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getFieldState,
    formState: { errors, submitCount },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues, mode: "onBlur" });
  const receipt = useWatch({ control, name: "receipt" });
  const country = useWatch({ control, name: "country" });
  const flat = flattenErrors(errors);
  // Boleta o factura solo aplica en Perú (la factura exige RUC); fuera del Perú siempre es boleta.
  const peru = country === "Perú";

  // País y código telefónico se completan uno con el otro mientras la persona no haya tocado el segundo.
  const syncPhone = (next: string) => {
    if (!getFieldState("phoneCountry").isDirty && COUNTRY_PHONE[next]) setValue("phoneCountry", COUNTRY_PHONE[next]);
    if (next !== "Perú") setValue("receipt", "boleta");
  };
  const syncCountry = (code: string) => {
    if (getFieldState("country").isDirty) return;
    const match = Object.entries(COUNTRY_PHONE).find(([, c]) => c === code)?.[0];
    if (match) {
      setValue("country", match);
      if (match !== "Perú") setValue("receipt", "boleta");
    }
  };

  return (
    <form
      noValidate
      aria-labelledby="step-contact-title"
      onSubmit={(e) => handleSubmit(onSubmit, () => requestAnimationFrame(() => summaryRef.current?.focus()))(e)}
    >
      <h2 id="step-contact-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
        {t("title")}
      </h2>
      <p className="mt-2 mb-6 text-foreground-muted">
        {t("intro")}{" "}
        <span className="text-sm">
          {t("haveBookings")}{" "}
          <Link href="/cuenta/acceso" className="pwt-link" target="_blank">
            {t("myBookingsLink")}
          </Link>
        </span>
      </p>

      {submitCount > 0 ? <ErrorSummary ref={summaryRef} errors={flat} labels={LABELS} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <TextField path="firstName" label={t("firstName")} autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
        <TextField path="lastName" label={t("lastName")} autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
        <div className="md:col-span-2">
          <TextField
            path="email"
            label={t("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>
        <SelectField
          path="phoneCountry"
          label={t("phoneCountry")}
          autoComplete="tel-country-code"
          {...register("phoneCountry", { onChange: (e: { target: { value: string } }) => syncCountry(e.target.value) })}
        >
          {PHONE_COUNTRIES.map((p) => (
            <option key={p.code} value={p.code}>
              {`${(PHONE_REGIONS[p.code] ?? []).map((iso) => countryName(iso, p.label)).join(" / ") || p.label} (${p.code})`}
            </option>
          ))}
        </SelectField>
        <TextField
          path="phone"
          label={t("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <div className="md:col-span-2">
          <SelectField
            path="country"
            label={t("country")}
            autoComplete="country-name"
            error={errors.country?.message}
            {...register("country", { onChange: (e: { target: { value: string } }) => syncPhone(e.target.value) })}
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_ISO[c] ? countryName(COUNTRY_ISO[c], c) : t("otherCountry")}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {peru ? (
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">{t("receipt")}</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["boleta", "factura"] as const).map((value) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 has-[:checked]:border-primary">
                <input type="radio" value={value} {...register("receipt")} />
                {t(value)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {peru && receipt === "factura" ? (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <TextField path="ruc" label="RUC" inputMode="numeric" maxLength={11} error={errors.ruc?.message} {...register("ruc")} />
          <TextField
            path="businessName"
            label={t("businessName")}
            autoComplete="organization"
            error={errors.businessName?.message}
            {...register("businessName")}
          />
        </div>
      ) : null}

      {/* Opcionales para operaciones: plegados para no alargar el formulario. */}
      <details className="mt-6 rounded-md border border-border" open={!!(defaultValues.hotel || defaultValues.notes)}>
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium">
          {t("extrasTitle")} <span className="ml-1 font-normal text-foreground-muted">{t("optional")}</span>
        </summary>
        <div className="grid gap-5 border-t border-border p-4">
          <TextField path="hotel" label={t("hotel")} optional autoComplete="off" error={errors.hotel?.message} {...register("hotel")} />
          <div>
            <label htmlFor={fieldId("notes")} className="block text-sm font-medium">
              {t("notes")} <span className="font-normal text-foreground-muted">{t("optional")}</span>
            </label>
            <textarea
              id={fieldId("notes")}
              rows={3}
              className={`${inputClass} py-3`}
              aria-invalid={!!errors.notes}
              aria-describedby={errors.notes ? `${fieldId("notes")}-error` : undefined}
              {...register("notes")}
            />
            {errors.notes ? (
              <p id={`${fieldId("notes")}-error`} className="mt-1 text-sm text-danger">
                {errorText(errors.notes.message)}
              </p>
            ) : null}
          </div>
        </div>
      </details>

      {/* Datos para la reserva: solo se INFORMA (Ley 29733 art. 18), sin casilla de consentimiento. */}
      <div className="mt-8 rounded-md bg-surface-muted p-4 text-sm" id="aviso-privacidad">
        <p className="font-medium">{t("dataUseTitle")}</p>
        <p className="mt-1 text-foreground-muted">
          {t.rich("dataUseText", {
            link: (chunks) => (
              <Link href="/politicas/proteccion-de-datos-personales" className="pwt-link" target="_blank">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      {/* Marketing: consentimiento aparte, opcional, desmarcado y por canal. */}
      <fieldset className="mt-6">
        <legend className="text-sm font-medium">
          {t("marketingTitle")} <span className="font-normal text-foreground-muted">{t("marketingHint")}</span>
        </legend>
        <div className="mt-2 space-y-2">
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input id={fieldId("marketingEmail")} type="checkbox" className="mt-1 size-5 shrink-0" {...register("marketingEmail")} />
            <span>{t("marketingEmail")}</span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input id={fieldId("marketingWhatsapp")} type="checkbox" className="mt-1 size-5 shrink-0" {...register("marketingWhatsapp")} />
            <span>{t("marketingWhatsapp")}</span>
          </label>
        </div>
      </fieldset>

      <button type="submit" className={buttonClass("primary", "lg", "mt-8 w-full md:w-auto")}>
        {t("next")}
      </button>
    </form>
  );
}
