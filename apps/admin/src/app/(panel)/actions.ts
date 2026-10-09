"use server";

import { apiData } from "@/lib/api/client";
import { action } from "@/lib/auth/guard";

/** H-01: concilia con la pasarela los cobros en línea atascados (permiso `payments:refund`). */
export async function reconcilePaymentsAction(_prev: unknown, _fd: FormData) {
  const result = await action(() => apiData<{ checked: number; synced: number; expired: number; failed: number }>("/admin/payments/reconcile", { method: "POST" }));
  if (!result.ok) return result;
  const r = result.data;
  return { ...result, message: `Conciliación lista: ${r.checked} revisados, ${r.synced} sincronizados, ${r.expired} vencidos, ${r.failed} con error.` };
}
