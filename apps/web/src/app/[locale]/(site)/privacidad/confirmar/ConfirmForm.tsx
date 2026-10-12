"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass } from "@/components/ui/button-styles";

import { confirmMarketingAction, type ConfirmResult } from "./actions";

const PURPOSES = ["marketing_email", "marketing_whatsapp"] as const;
type Purpose = (typeof PURPOSES)[number];
const isPurpose = (value: string): value is Purpose => (PURPOSES as readonly string[]).includes(value);

function Submit() {
  const t = useTranslations("privacy.confirm");
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "lg")}>
      {pending ? t("processing") : t("submit")}
    </button>
  );
}

export function ConfirmForm({ token, pending }: { token: string; pending: string[] }) {
  const t = useTranslations("privacy.confirm");
  const [state, action] = useActionState<ConfirmResult | null, FormData>(confirmMarketingAction, null);
  const label = (purpose: string) => (isPurpose(purpose) ? t(`purposes.${purpose}`) : purpose);

  if (state?.ok) {
    const done = [...state.confirmed, ...state.alreadyConfirmed].map(label);
    return (
      <div role="status" className="rounded-md border border-success bg-success-soft p-4">
        <p className="font-semibold text-success">{done.length ? t("doneTitle") : t("nothingPending")}</p>
        {done.length ? <p className="mt-1 text-sm">{t("doneText", { channels: done.join(t("and")) })}</p> : null}
      </div>
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
      <p>{t.rich("question", { channels: pending.map(label).join(t("and")), strong: (chunks) => <strong>{chunks}</strong> })}</p>
      <Submit />
      <p className="text-sm text-foreground-muted">{t("ignore")}</p>
    </form>
  );
}
