"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRef, type Ref } from "react";
import { useForm, useWatch } from "react-hook-form";

import { contactSchema, COUNTRIES, PHONE_COUNTRIES, type ContactValues } from "@/lib/checkout/schemas";
import { buttonClass } from "@/components/ui/button-styles";
import { ErrorSummary, fieldId, flattenErrors, SelectField, TextField } from "./form-fields";

const LABELS: Record<string, string> = {
  firstName: "Nombres",
  lastName: "Apellidos",
  email: "Correo",
  phone: "Celular",
  country: "País",
  ruc: "RUC",
  businessName: "Razón social",
  privacy: "Privacidad",
};

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
  privacy: false,
  marketing: false,
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
  const summaryRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, submitCount },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues, mode: "onBlur" });
  const receipt = useWatch({ control, name: "receipt" });
  const flat = flattenErrors(errors);

  return (
    <form
      noValidate
      aria-labelledby="step-contact-title"
      onSubmit={(e) => handleSubmit(onSubmit, () => requestAnimationFrame(() => summaryRef.current?.focus()))(e)}
    >
      <h2 id="step-contact-title" ref={headingRef} tabIndex={-1} className="font-display text-h2 font-medium focus:outline-none">
        Tus datos
      </h2>
      <p className="mt-2 mb-6 text-foreground-muted">
        Quien reserva. Aquí te enviaremos la confirmación.{" "}
        {/* TODO(E6): inicio de sesión opcional. */}
        <span className="text-sm">¿Ya tienes cuenta? Podrás iniciar sesión pronto.</span>
      </p>

      {submitCount > 0 ? <ErrorSummary ref={summaryRef} errors={flat} labels={LABELS} /> : null}

      <div className="grid gap-5 md:grid-cols-2">
        <TextField path="firstName" label="Nombres" autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
        <TextField path="lastName" label="Apellidos" autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
        <div className="md:col-span-2">
          <TextField
            path="email"
            label="Correo electrónico"
            type="email"
            inputMode="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>
        <SelectField path="phoneCountry" label="Código de país" autoComplete="tel-country-code" {...register("phoneCountry")}>
          {PHONE_COUNTRIES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </SelectField>
        <TextField
          path="phone"
          label="Celular (WhatsApp)"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <div className="md:col-span-2">
          <SelectField path="country" label="País de residencia" autoComplete="country-name" error={errors.country?.message} {...register("country")}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Comprobante</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(["boleta", "factura"] as const).map((value) => (
            <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 has-[:checked]:border-primary">
              <input type="radio" value={value} {...register("receipt")} />
              {value === "boleta" ? "Boleta" : "Factura"}
            </label>
          ))}
        </div>
      </fieldset>
      {receipt === "factura" ? (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <TextField path="ruc" label="RUC" inputMode="numeric" maxLength={11} error={errors.ruc?.message} {...register("ruc")} />
          <TextField
            path="businessName"
            label="Razón social"
            autoComplete="organization"
            error={errors.businessName?.message}
            {...register("businessName")}
          />
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id={fieldId("privacy")}
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              aria-invalid={!!errors.privacy}
              aria-describedby={errors.privacy ? `${fieldId("privacy")}-error` : undefined}
              {...register("privacy")}
            />
            <span>
              Acepto la{" "}
              <Link href="/es/politicas/proteccion-de-datos-personales" className="pwt-link" target="_blank">
                Política de privacidad
              </Link>{" "}
              y el tratamiento de mis datos para gestionar mi reserva (Ley 29733).
            </span>
          </label>
          {errors.privacy ? (
            <p id={`${fieldId("privacy")}-error`} className="mt-1 ml-8 text-sm text-danger">
              {errors.privacy.message}
            </p>
          ) : null}
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input id={fieldId("marketing")} type="checkbox" className="mt-1 size-5 shrink-0" {...register("marketing")} />
          <span>Quiero recibir ofertas y novedades. (Opcional)</span>
        </label>
      </div>

      <button type="submit" className={buttonClass("primary", "lg", "mt-8 w-full md:w-auto")}>
        Continuar a viajeros
      </button>
    </form>
  );
}
