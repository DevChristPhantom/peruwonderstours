"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { bookingPath, localePath } from "@/i18n/paths";
import { isLocale, type Locale } from "@/i18n/routing";
import {
  exchangeBookingAccessLink,
  exchangeComplaintAccessLink,
  requestBookingAccessLink,
  requestComplaintAccessLink,
} from "@/lib/api/access";
import { ApiError } from "@/lib/api/client";
import { BOOKING_CODE_RE, COMPLAINT_CODE_RE, writeBookingToken, writeComplaintToken } from "@/lib/checkout/session";

import type { AccessKind, AccessState } from "./types";

/**
 * Server Actions del acceso sin contraseña (F0/F0b y F7). El navegador nunca ve el `accessToken`: el
 * canje ocurre aquí y el token queda en una cookie httpOnly. El token del enlace se canjea con un POST
 * (botón), no al abrir la página: los antivirus de correo que "visitan" los enlaces no lo consumen.
 */

const CODE_RE: Record<AccessKind, RegExp> = { booking: BOOKING_CODE_RE, complaint: COMPLAINT_CODE_RE };

const requestSchema = z.object({
  code: z.string().trim().toUpperCase().max(40),
  email: z.email().trim().max(254),
  locale: z.string(),
});

function localeOf(value: FormDataEntryValue | null): Locale {
  return isLocale(value) ? value : "es";
}

function stateFromError(error: unknown): AccessState {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === "too-many-requests") return { status: "busy" };
    if (error.status === 410 || error.code === "access-link-expired") return { status: "expired" };
    if (error.status === 404 || error.status === 400 || error.code === "access-link-not-found" || error.code === "invalid-access-link") {
      return { status: "linkNotFound" };
    }
  }
  return { status: "unavailable" };
}

/** Pide el enlace por correo. La API responde 202 siempre (no revela si el código existe). */
export async function requestAccessLinkAction(kind: AccessKind, _prev: AccessState, formData: FormData): Promise<AccessState> {
  const parsed = requestSchema.safeParse({ code: formData.get("code"), email: formData.get("email"), locale: formData.get("locale") });
  if (!parsed.success || !CODE_RE[kind].test(parsed.data.code)) return { status: "invalid" };
  const locale = localeOf(parsed.data.locale);
  try {
    if (kind === "booking") await requestBookingAccessLink(parsed.data.code, parsed.data.email, locale);
    else await requestComplaintAccessLink(parsed.data.code, parsed.data.email, locale);
    return { status: "sent" };
  } catch (error) {
    return stateFromError(error);
  }
}

/** Canjea el token del enlace (un solo uso), guarda el acceso en cookie httpOnly y abre la página. */
export async function exchangeAccessLinkAction(kind: AccessKind, _prev: AccessState, formData: FormData): Promise<AccessState> {
  const token = formData.get("token");
  const locale = localeOf(formData.get("locale"));
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(token)) return { status: "linkNotFound" };
  let target: string;
  try {
    if (kind === "booking") {
      const { code, accessToken } = await exchangeBookingAccessLink(token);
      await writeBookingToken(code, accessToken);
      target = bookingPath(locale, code);
    } else {
      const { code, accessToken } = await exchangeComplaintAccessLink(token);
      await writeComplaintToken(code, accessToken);
      target = localePath(locale, { pathname: "/libro-de-reclamaciones/consulta", query: { codigo: code } });
    }
  } catch (error) {
    return stateFromError(error);
  }
  // Fuera del try: `redirect` lanza una excepción de control que no debe tratarse como error.
  redirect(target);
}
