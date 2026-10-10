"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { Link } from "@/i18n/navigation";
import { submitContactAction } from "@/lib/content/actions";
import { FORM_IDLE } from "@/lib/content/form-state";

import { Consent, Field, FormMessage } from "./FormBits";

/** Formulario de contacto (F3). Validación nativa en el navegador y con Zod en el servidor. */
export function ContactForm() {
  const t = useTranslations("contact");
  const locale = useLocale();
  const id = useId();
  const [state, action, pending] = useActionState(submitContactAction, FORM_IDLE);
  const invalid = state.status === "invalid" ? new Set(state.fields) : new Set<string>();
  const err = (name: string, message = t("required")) => (invalid.has(name) ? message : null);

  if (state.status === "success") return <FormMessage state={state} text={(s) => t(s)} />;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <Field id={`${id}-name`} name="name" label={t("name")} required maxLength={120} autoComplete="name" error={err("name")} />
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
      <Field id={`${id}-phone`} name="phone" type="tel" label={t("phone")} maxLength={40} autoComplete="tel" />
      <Field id={`${id}-subject`} name="subject" label={t("subject")} required maxLength={160} error={err("subject")} />
      <Field id={`${id}-message`} name="message" label={t("message")} hint={t("messageHint")} required maxLength={4000} multiline error={err("message")} />
      <Consent id={`${id}-privacy`} name="privacy" error={invalid.has("privacy")}>
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/politicas/proteccion-de-datos-personales" className="pwt-link" target="_blank">
              {chunks}
            </Link>
          ),
        })}
      </Consent>
      {invalid.has("privacy") ? <p className="text-sm text-danger">{t("privacyRequired")}</p> : null}
      <FormMessage state={state} text={(s) => t(s)} />
      <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
        {pending ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
