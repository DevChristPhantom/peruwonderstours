import "server-only";

import { cookies } from "next/headers";

import { unseal } from "@/lib/session/seal";

/** Cookie con el correo buscado: así el correo (dato personal) nunca viaja en la URL del panel. */
export const EMAIL_FILTER_COOKIE = "pwt_admin_bk_email";

export async function readEmailFilter(): Promise<string | null> {
  const value = unseal((await cookies()).get(EMAIL_FILTER_COOKIE)?.value, EMAIL_FILTER_COOKIE) as { email?: unknown } | null;
  return typeof value?.email === "string" ? value.email : null;
}
