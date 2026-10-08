"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";

import { submitComplaintAction } from "@/app/es/(site)/libro-de-reclamaciones/actions";
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
import { formatDate } from "@/lib/format";
import { useLimaToday } from "@/hooks/useClientOnly";
import { useUiStore } from "@/stores/ui-store";
import { ErrorSummary, fieldId, flattenErrors, inputClass, SelectField, TextField } from "@/components/checkout/form-fields";
import { buttonClass } from "@/components/ui/button-styles";
import { ComplaintReceiptView } from "./ComplaintReceiptView";

const LABELS: Record<string, string> = {
  fullName: "Nombres y apellidos",
  docNumber: "Documento",
  address: "Domicilio",
  phone: "Teléfono",
  email: "Correo",
  emailConfirm: "Confirmar correo",
  guardianFullName: "Representante",
  guardianAddress: "Domicilio del representante",
  guardianPhone: "Teléfono del representante",
  guardianEmail: "Correo del representante",
  claimedAmount: "Monto reclamado",
  goodDescription: "Descripción",
  bookingCode: "Código de reserva",
  declaredType: "Tipo",
  detail: "Detalle",
  consumerRequest: "Pedido",
  conformityAccepted: "Conformidad",
};

export interface ProviderInfo {
  legalName: string | null;
  ruc: string | null;
  establishmentAddress: string | null;
  establishmentCode: string | null;
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-8 rounded-lg border border-border p-5">
      <legend className="px-2 font-medium">
        {n}. {title}
      </legend>
      <div className="grid gap-5 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function TextArea({
  path,
  label,
  error,
  hint,
  rows = 4,
  ...rest
}: { path: string; label: string; error?: string; hint?: string; rows?: number } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = fieldId(path);
  return (
    <div className="md:col-span-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-foreground-muted">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        className={`${inputClass} py-3`}
        aria-invalid={!!error}
        aria-describedby={[error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const PENDING = "por confirmar";

/** Formulario público del Libro de Reclamaciones (sin cuenta, sin pagos previos, orden del Anexo I). */
export function ComplaintForm({ provider }: { provider: ProviderInfo }) {
  // Fecha de Lima del visitante (no la del build: la página es estática).
  const today = useLimaToday();
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
        announce(`Registramos tu hoja ${res.receipt.code}.`);
        window.scrollTo({ top: 0 });
        return;
      }
      setServerError(res.fieldErrors?.length ? null : res.message);
      for (const fe of res.fieldErrors ?? []) setError(fe.path as Path<ComplaintValues>, { type: "server", message: fe.message });
      requestAnimationFrame(() => summaryRef.current?.focus());
    },
    onError: () => {
      setServerError("No pudimos registrar tu hoja. Revisa tu conexión e intenta de nuevo.");
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
          Hoja de reclamación
        </p>
        <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <dt className="text-foreground-muted">N.º de hoja</dt>
            <dd>Se asigna automáticamente al enviar</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Fecha</dt>
            <dd>{today ? formatDate(today) : "…"}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Proveedor (razón social) / RUC</dt>
            <dd>
              {provider.legalName ?? <span className="italic">{PENDING}</span>} · RUC {provider.ruc ?? <span className="italic">{PENDING}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Domicilio del establecimiento / código</dt>
            <dd>
              {provider.establishmentAddress ?? <span className="italic">{PENDING}</span>}
              {provider.establishmentCode ? ` · ${provider.establishmentCode}` : ""}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        {serverError ? (
          <ErrorSummary ref={summaryRef} title="No pudimos registrar tu hoja:" errors={[{ path: "submit-complaint", message: serverError }]} />
        ) : submitCount > 0 ? (
          <ErrorSummary ref={summaryRef} errors={flat} labels={LABELS} />
        ) : null}
      </div>

      <Section n={1} title="Identificación del consumidor reclamante">
        <div className="md:col-span-2">
          <TextField path="fullName" label="Nombres y apellidos" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        </div>
        <SelectField path="docType" label="Tipo de documento" {...register("docType")}>
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </SelectField>
        <TextField path="docNumber" label="Número de documento" autoComplete="off" error={errors.docNumber?.message} {...register("docNumber")} />
        <div className="md:col-span-2">
          <TextField path="address" label="Domicilio" autoComplete="street-address" error={errors.address?.message} {...register("address")} />
        </div>
        <TextField
          path="phone"
          label="Teléfono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="Celular de Perú o con código de país (+56…)."
          error={errors.phone?.message}
          {...register("phone")}
        />
        <div />
        <TextField path="email" label="Correo electrónico" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          path="emailConfirm"
          label="Confirma tu correo"
          type="email"
          autoComplete="email"
          hint="Aquí te enviaremos la copia de la hoja y la respuesta."
          error={errors.emailConfirm?.message}
          {...register("emailConfirm")}
        />
        <label className="flex min-h-11 cursor-pointer items-start gap-3 md:col-span-2">
          <input id={fieldId("isMinor")} type="checkbox" className="mt-1 size-5 shrink-0" {...register("isMinor")} />
          <span>Soy menor de edad (se piden los datos de mi padre, madre o representante).</span>
        </label>
        {isMinor ? (
          <div className="grid gap-5 rounded-md bg-surface-muted p-4 md:col-span-2 md:grid-cols-2">
            <p className="text-sm font-medium md:col-span-2">Padre, madre o representante</p>
            <div className="md:col-span-2">
              <TextField path="guardianFullName" label="Nombres y apellidos del representante" error={errors.guardianFullName?.message} {...register("guardianFullName")} />
            </div>
            <div className="md:col-span-2">
              <TextField path="guardianAddress" label="Domicilio del representante" error={errors.guardianAddress?.message} {...register("guardianAddress")} />
            </div>
            <TextField path="guardianPhone" label="Teléfono del representante" type="tel" inputMode="tel" error={errors.guardianPhone?.message} {...register("guardianPhone")} />
            <TextField path="guardianEmail" label="Correo del representante" type="email" error={errors.guardianEmail?.message} {...register("guardianEmail")} />
          </div>
        ) : null}
      </Section>

      <Section n={2} title="Identificación del bien contratado">
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">Bien contratado</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(
              [
                ["service", "Servicio"],
                ["product", "Producto"],
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
          label={declaredType === "reclamo" ? "Monto reclamado" : "Monto reclamado (opcional)"}
          inputMode="decimal"
          hint="Puede ser 0 si no reclamas un monto."
          error={errors.claimedAmount?.message}
          {...register("claimedAmount")}
        />
        <SelectField path="currency" label="Moneda" {...register("currency")}>
          <option value="PEN">Soles (S/)</option>
          <option value="USD">Dólares (USD)</option>
        </SelectField>
        <TextArea
          path="goodDescription"
          label="Descripción del servicio o producto"
          rows={2}
          hint="Por ejemplo: tour, fecha y cantidad de viajeros."
          error={errors.goodDescription?.message}
          {...register("goodDescription")}
        />
        <TextField
          path="bookingCode"
          label="Código de reserva (opcional)"
          autoComplete="off"
          hint="Si tienes uno, con la forma PWT-2026-000123. No es obligatorio."
          error={errors.bookingCode?.message}
          {...register("bookingCode")}
        />
      </Section>

      <Section n={3} title="Detalle de la reclamación y pedido del consumidor">
        <fieldset className="md:col-span-2" aria-describedby="tipo-definiciones">
          <legend className="text-sm font-medium">Tipo</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(
              [
                ["reclamo", "Reclamo"],
                ["queja", "Queja"],
                ["unknown", "No estoy seguro"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-4 has-[:checked]:border-primary">
                <input type="radio" value={value} {...register("declaredType")} />
                {label}
              </label>
            ))}
          </div>
          <ul id="tipo-definiciones" className="mt-3 space-y-1 text-sm text-foreground-muted">
            <li>{COMPLAINT_DEFINITIONS.reclamo}</li>
            <li>{COMPLAINT_DEFINITIONS.queja}</li>
            <li>Si no estás seguro, lo revisamos y lo tramitamos como reclamo.</li>
          </ul>
        </fieldset>
        <TextArea path="detail" label="Detalle" rows={6} hint="Cuéntanos qué pasó, cuándo y con quién." error={errors.detail?.message} {...register("detail")} />
        <TextArea path="consumerRequest" label="Pedido" rows={3} hint="¿Qué solución esperas?" error={errors.consumerRequest?.message} {...register("consumerRequest")} />
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium">¿Cómo quieres recibir la respuesta?</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(
              [
                ["email", "Por correo electrónico"],
                ["letter", "Por carta a mi domicilio"],
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
          <span>{CONFORMITY_TEXT}</span>
        </label>
        {errors.conformityAccepted ? (
          <p id={`${fieldId("conformityAccepted")}-error`} className="mt-1 ml-8 text-sm text-danger">
            {errors.conformityAccepted.message}
          </p>
        ) : null}
      </div>

      {/* Aviso de privacidad: informativo, no es casilla de consentimiento */}
      <p className="mt-6 rounded-md bg-surface-muted p-4 text-sm text-foreground-muted">
        Usaremos estos datos solo para atender tu reclamo o queja y responderte, como exige el Código de Protección y Defensa
        del Consumidor, y los conservaremos al menos 2 años. Registramos la fecha, hora e IP del envío. Más información en la{" "}
        <Link href="/es/politicas/proteccion-de-datos-personales" className="pwt-link" target="_blank">
          Política de privacidad
        </Link>
        .
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
            Enviando…
          </>
        ) : (
          "Enviar hoja de reclamación"
        )}
      </button>

      <div className="mt-8 space-y-2 border-t border-border pt-4 text-sm text-foreground-muted">
        {COMPLAINT_LEGENDS.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </form>
  );
}
