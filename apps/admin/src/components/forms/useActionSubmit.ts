"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { UserError } from "@/lib/api/errors";
import type { ActionResult } from "@/lib/auth/guard";

/**
 * Puente React Hook Form → Server Action: envía los valores, pasa los errores por campo de la API
 * a RHF (`setError`) y refresca los datos del servidor al terminar bien.
 */
export function useActionSubmit<TValues extends FieldValues, TResult>(
  run: (values: TValues) => Promise<ActionResult<TResult>>,
  options: { setError?: UseFormSetError<TValues>; refresh?: boolean; onSuccess?: (data: TResult) => void } = {},
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setErrorState] = useState<UserError | null>(null);
  const [success, setSuccess] = useState<TResult | null>(null);

  const submit = (values: TValues) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        setErrorState(null);
        const result = await run(values);
        if (result.ok) {
          setSuccess(result.data);
          options.onSuccess?.(result.data);
          if (options.refresh !== false) router.refresh();
        } else {
          setErrorState(result.error);
          for (const [field, message] of Object.entries(result.error.fields ?? {})) {
            options.setError?.(field as Path<TValues>, { type: "server", message });
          }
        }
        resolve();
      });
    });

  return { submit, pending, error, success, reset: () => (setErrorState(null), setSuccess(null)) };
}
