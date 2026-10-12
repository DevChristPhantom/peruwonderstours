"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass } from "@/components/ui/button-styles";

import { unsubscribeAction, type UnsubscribeResult } from "./actions";

const PURPOSES = ["marketing_email", "marketing_whatsapp"] as const;
type Purpose = (typeof PURPOSES)[number];
const isPurpose = (value: string): value is Purpose => (PURPOSES as readonly string[]).includes(value);

function Submit() {
  const t = useTranslations("privacy.unsubscribe");
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "lg")}>
      {pending ? t("processing") : t("submit")}
    </button>
  );
}

export function UnsubscribeForm({ token, purposes }: { token: string; purposes: { purpose: string; granted: boolean }[] }) {
  const t = useTranslations("privacy.unsubscribe");
  const [state, action] = useActionState<UnsubscribeResult | null, FormData>(unsubscribeAction, null);
  const active = purposes.filter((p) => p.granted);
  const label = (purpose: string) => (isPurpose(purpose) ? t(`purposes.${purpose}`) : purpose);

  if (state?.ok) {
    const done = [...state.revoked, ...state.alreadyRevoked].map(label);
    return (
      <div role="status" className="rounded-md border border-success bg-success-soft p-4 text-success">
        <p className="font-semibold">{t("doneTitle")}</p>
        <p className="mt-1 text-sm text-foreground">
          {t("doneText", { channels: done.join(t("and")).toLowerCase() || t("commercial") })}
        </p>
        <p className="mt-1 text-sm text-foreground">{t("transactional")}</p>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <p role="status" className="rounded-md border border-border bg-surface-muted p-4 text-sm">
        {t("nothingActive")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p role="alert" className="rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">{t("legend")}</legend>
        {active.map((p) => (
          <label key={p.purpose} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3">
            <input type="checkbox" name="purposes" value={p.purpose} defaultChecked className="size-5" />
            {label(p.purpose)}
          </label>
        ))}
      </fieldset>
      <Submit />
    </form>
  );
}
