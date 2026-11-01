"use client";

import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";

import { buyerError, holderError } from "@/lib/payments/izipay-checkout";
import type { CardHolder, PaymentBuyer, PaymentWidgetProps } from "@/lib/payments/types";
import { FieldShell, inputClass } from "./form-fields";

const DOCUMENT_TYPES = ["DNI", "CE", "PASAPORTE", "OTROS"] as const;
/** ISO 3166-1 alfa-2 (Izipay pide el país de facturación como código). */
const ISO_COUNTRIES =
  "AD AE AF AG AI AL AM AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW".split(
    " ",
  );
const HOLDER_FIELDS = ["document", "street", "city", "state", "postalCode"] as const;
const BUYER_FIELDS = ["firstName", "lastName", "phone"] as const;
type Field = keyof CardHolder | keyof PaymentBuyer;

const AUTOCOMPLETE: Partial<Record<Field, string>> = {
  firstName: "given-name",
  lastName: "family-name",
  phone: "tel",
  street: "billing street-address",
  city: "billing address-level2",
  state: "billing address-level1",
  postalCode: "billing postal-code",
};
const MAX_LENGTH: Partial<Record<Field, number>> = { firstName: 50, lastName: 50, phone: 20, document: 12, street: 40, city: 25, state: 25, postalCode: 10 };

/**
 * Implementación Izipay de `PaymentWidget`: pide los datos del titular que exige Izipay (documento y
 * dirección de facturación) y, con `askBuyer`, nombre, celular y país (pago desde la página de la
 * reserva). La tarjeta o Yape se ingresan después, en el pop-up de Izipay.
 */
export function IzipayPaymentWidget({
  method,
  disabled,
  ref,
  national,
  country = "",
  askBuyer = false,
}: PaymentWidgetProps & {
  national: boolean;
  /** País ISO ya conocido (checkout); vacío = se pregunta. */
  country?: string;
  /** Pedir nombre, celular y país (pago desde la página de la reserva). */
  askBuyer?: boolean;
}) {
  const id = useId();
  const locale = useLocale();
  const t = useTranslations("checkout.izipay");
  const tp = useTranslations("checkout.payment");
  const [holder, setHolder] = useState<CardHolder>({
    documentType: national ? "DNI" : "PASAPORTE",
    document: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [buyer, setBuyer] = useState<PaymentBuyer>({ firstName: "", lastName: "", phone: "", country: country || (national ? "PE" : "") });
  const askCountry = askBuyer || !country;
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return ISO_COUNTRIES.map((iso) => ({ iso, name: names.of(iso) ?? iso })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);
  const [invalid, setInvalid] = useState<Field | null>(null);
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | HTMLSelectElement | null>>>({});
  // `collect()` corre con el pago en curso (fieldset deshabilitado, no enfocable): se enfoca al habilitarse.
  const focusNext = useRef<Field | null>(null);
  useEffect(() => {
    if (disabled || !focusNext.current) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  }, [disabled, invalid]);

  useImperativeHandle(
    ref,
    () => ({
      collect: async () => {
        const field = (askBuyer ? buyerError(buyer) : askCountry && !/^[A-Z]{2}$/.test(buyer.country) ? "country" : null) ?? holderError(holder);
        setInvalid(field);
        if (field) {
          focusNext.current = field;
          return null;
        }
        return { simulate: "approved", holder, ...(askCountry ? { buyer } : {}) };
      },
    }),
    [askBuyer, askCountry, buyer, holder],
  );

  const fid = (key: string) => `${id}-${key}`;
  const clear = (key: Field) => {
    if (invalid === key) setInvalid(null);
  };
  const textInput = (key: (typeof HOLDER_FIELDS)[number] | (typeof BUYER_FIELDS)[number]) => {
    const isBuyer = (BUYER_FIELDS as readonly string[]).includes(key);
    const value = isBuyer ? buyer[key as keyof PaymentBuyer] : holder[key as keyof CardHolder];
    const describedBy = invalid === key ? `${fid(key)}-error` : key === "postalCode" || key === "phone" ? `${fid(key)}-hint` : undefined;
    return (
      <FieldShell
        key={key}
        id={fid(key)}
        label={t(key)}
        hint={key === "postalCode" ? t("postalCodeHint") : key === "phone" ? t("phoneHint") : undefined}
        error={invalid === key ? t(`errors.${key}`) : undefined}
      >
        <input
          ref={(el) => {
            inputs.current[key] = el;
          }}
          id={fid(key)}
          className={inputClass}
          value={value}
          onChange={(e) => {
            if (isBuyer) setBuyer((b) => ({ ...b, [key]: e.target.value }));
            else setHolder((h) => ({ ...h, [key]: e.target.value }));
            clear(key);
          }}
          aria-invalid={invalid === key}
          aria-describedby={describedBy}
          type={key === "phone" ? "tel" : "text"}
          inputMode={key === "postalCode" || (key === "document" && holder.documentType === "DNI") ? "numeric" : undefined}
          autoComplete={AUTOCOMPLETE[key] ?? "off"}
          maxLength={MAX_LENGTH[key]}
          required
        />
      </FieldShell>
    );
  };

  return (
    <fieldset className="rounded-lg border border-border bg-surface p-4" disabled={disabled}>
      <legend className="px-1 font-medium">{t("holderLegend")}</legend>
      <p className="text-sm text-foreground-muted">{t("holderIntro", { method: tp(`methods.${method}.label`) })}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {askBuyer ? BUYER_FIELDS.map(textInput) : null}
        {askCountry ? (
          <FieldShell id={fid("country")} label={t("country")} error={invalid === "country" ? t("errors.country") : undefined}>
            <select
              ref={(el) => {
                inputs.current.country = el;
              }}
              id={fid("country")}
              className={inputClass}
              value={buyer.country}
              aria-invalid={invalid === "country"}
              aria-describedby={invalid === "country" ? `${fid("country")}-error` : undefined}
              onChange={(e) => {
                setBuyer((b) => ({ ...b, country: e.target.value }));
                clear("country");
              }}
            >
              <option value="">{t("countryPlaceholder")}</option>
              {countries.map(({ iso, name }) => (
                <option key={iso} value={iso}>
                  {name}
                </option>
              ))}
            </select>
          </FieldShell>
        ) : null}
        <FieldShell id={fid("documentType")} label={t("documentType")}>
          <select
            id={fid("documentType")}
            className={inputClass}
            value={holder.documentType}
            onChange={(e) => {
              setHolder((h) => ({ ...h, documentType: e.target.value as CardHolder["documentType"] }));
              clear("document");
            }}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`documentTypes.${type}`)}
              </option>
            ))}
          </select>
        </FieldShell>
        {HOLDER_FIELDS.map(textInput)}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-foreground-muted">
        <Lock aria-hidden size={16} strokeWidth={1.5} />
        {t("secure")}
      </p>
    </fieldset>
  );
}
