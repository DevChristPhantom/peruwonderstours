"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { submitTestimonialAction } from "@/lib/content/actions";
import { FORM_IDLE } from "@/lib/content/form-state";

import { Consent, Field, FormMessage, inputClass } from "./FormBits";

/** Formulario "deja tu testimonio" (F2): se publica solo tras moderación y con consentimiento. */
export function TestimonialForm() {
  const t = useTranslations("reviews.leave");
  const locale = useLocale();
  const id = useId();
  const [state, action, pending] = useActionState(submitTestimonialAction, FORM_IDLE);
  const invalid = state.status === "invalid" ? new Set(state.fields) : new Set<string>();
  const err = (name: string, message = t("required")) => (invalid.has(name) ? message : null);
  const consentError = invalid.has("privacy") || invalid.has("publishConsent");

  if (state.status === "success") return <FormMessage state={state} text={(s) => t(s)} />;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <Field id={`${id}-name`} name="authorName" label={t("name")} required minLength={2} maxLength={80} autoComplete="given-name" error={err("authorName")} />
      <Field id={`${id}-country`} name="authorCountry" label={t("country")} hint={t("countryHint")} maxLength={2} pattern="[A-Za-z]{2}" autoComplete="country" error={err("authorCountry", t("invalidCountry"))} />
      <Field
        id={`${id}-email`}
        name="email"
        type="email"
        label={t("email")}
        required
        maxLength={254}
        autoComplete="email"
        error={err("email", t("invalidEmail"))}
      />
      <div>
        <label htmlFor={`${id}-rating`} className="block text-sm font-medium">
          {t("rating")}
        </label>
        <select id={`${id}-rating`} name="rating" required defaultValue="5" className={inputClass}>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {t("ratingOption", { count: n })}
            </option>
          ))}
        </select>
      </div>
      <Field id={`${id}-body`} name="body" label={t("body")} hint={t("bodyHint")} required minLength={20} maxLength={2000} multiline error={err("body", t("invalidBody"))} />
      <Field id={`${id}-date`} name="travelDate" type="date" label={t("travelDate")} />
      <Consent id={`${id}-publish`} name="publishConsent" error={consentError}>
        {t("publishConsent")}
      </Consent>
      <Consent id={`${id}-privacy`} name="privacy" error={consentError}>
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/politicas/proteccion-de-datos-personales" className="pwt-link" target="_blank">
              {chunks}
            </Link>
          ),
        })}
      </Consent>
      {consentError ? <p className="text-sm text-danger">{t("consentRequired")}</p> : null}
      <FormMessage state={state} text={(s) => t(s)} />
      <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
