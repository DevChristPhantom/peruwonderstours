"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/client";
import { submitComplaint, type ComplaintDraftBody } from "@/lib/api/complaints";
import { toUserError } from "@/lib/api/problems";
import {
  amountToCents,
  complaintSchema,
  normalizeDoc,
  normalizePhone,
  type ComplaintReceipt,
} from "@/lib/complaints/schema";
import { readBookingToken } from "@/lib/checkout/session";
import { isProduction } from "@/lib/env";
import { SITE } from "@/lib/site";

export type ComplaintActionResult =
  | { ok: true; receipt: ComplaintReceipt }
  | { ok: false; message: string; fieldErrors?: { path: string; message: string }[] };

/** Ruta de campo de la API (`consumer.docNumber`) → campo del formulario (`docNumber`). */
const FIELD_MAP: Record<string, string> = {
  "consumer.fullName": "fullName",
  "consumer.docType": "docType",
  "consumer.docNumber": "docNumber",
  "consumer.address": "address",
  "consumer.phone": "phone",
  "consumer.email": "email",
  "consumer.isMinor": "isMinor",
  guardian: "guardianFullName",
  "guardian.fullName": "guardianFullName",
  "guardian.address": "guardianAddress",
  "guardian.phone": "guardianPhone",
  "guardian.email": "guardianEmail",
  "good.type": "goodType",
  "good.claimedAmount": "claimedAmount",
  "good.currency": "claimedAmount",
  "good.description": "goodDescription",
  bookingCode: "bookingCode",
  declaredType: "declaredType",
  detail: "detail",
  consumerRequest: "consumerRequest",
  responseChannel: "responseChannel",
  conformityAccepted: "conformityAccepted",
};

const ATTEMPT_COOKIE = "pwt_lr_attempt";
const ATTEMPT_PATH = "/es/libro-de-reclamaciones";

/**
 * Registra la Hoja de Reclamación en la API (BFF). Idempotencia: la clave se guarda en una cookie
 * httpOnly ligada a la huella del contenido, así un doble clic o un reintento por red lenta
 * devuelven la MISMA hoja; si el consumidor cambia el contenido, se usa una clave nueva.
 */
export async function submitComplaintAction(raw: unknown): Promise<ComplaintActionResult> {
  const parsed = complaintSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos indicados.",
      fieldErrors: parsed.error.issues.map((i) => ({ path: String(i.path[0] ?? "fullName"), message: i.message })),
    };
  }
  const v = parsed.data;
  const claimedAmount = amountToCents(v.claimedAmount);
  const body: ComplaintDraftBody = {
    consumer: {
      fullName: v.fullName,
      docType: v.docType,
      docNumber: normalizeDoc(v.docNumber),
      address: v.address,
      phone: normalizePhone(v.phone),
      email: v.email.toLowerCase(),
      isMinor: v.isMinor,
    },
    guardian: v.isMinor
      ? { fullName: v.guardianFullName, address: v.guardianAddress, phone: normalizePhone(v.guardianPhone), email: v.guardianEmail.toLowerCase() }
      : null,
    good: { type: v.goodType, description: v.goodDescription, claimedAmount, currency: claimedAmount === null ? null : v.currency },
    bookingCode: v.bookingCode || undefined,
    declaredType: v.declaredType === "unknown" ? null : v.declaredType,
    detail: v.detail,
    consumerRequest: v.consumerRequest,
    responseChannel: v.responseChannel,
    conformityAccepted: true,
  };

  const fp = createHash("sha256").update(JSON.stringify(body)).digest("base64url");
  const store = await cookies();
  const [prevFp, prevKey] = (store.get(ATTEMPT_COOKIE)?.value ?? "").split(".");
  const key = prevFp === fp && prevKey && /^[0-9a-f-]{36}$/.test(prevKey) ? prevKey : randomUUID();
  const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: isProduction, path: ATTEMPT_PATH };
  store.set(ATTEMPT_COOKIE, `${fp}.${key}`, { ...cookieOptions, maxAge: 60 * 60 });

  try {
    const bookingToken = body.bookingCode ? await readBookingToken(body.bookingCode.trim().toUpperCase()) : null;
    const created = await submitComplaint(body, key, bookingToken);
    store.set(ATTEMPT_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { emailConfirm, conformityAccepted, ...values } = v;
    return {
      ok: true,
      receipt: {
        code: created.code,
        sheetNumber: created.sheetNumber,
        submittedAt: created.submittedAt,
        responseDueAt: created.responseDueAt,
        provider: created.provider ?? {
          legalName: SITE.legal.businessName,
          ruc: SITE.legal.ruc,
          establishmentAddress: SITE.legal.address,
          establishmentCode: null,
        },
        values: {
          ...values,
          docNumber: body.consumer.docNumber,
          phone: body.consumer.phone,
          guardianPhone: body.guardian?.phone ?? "",
        },
      },
    };
  } catch (error) {
    if (error instanceof ApiError) {
      const apiFields = error.problem?.errors ?? (error.problem?.details?.errors as { field: string; messages: string[] }[] | undefined);
      if (apiFields?.length) {
        return {
          ok: false,
          message: "Revisa los campos indicados.",
          fieldErrors: apiFields.map((f) => ({ path: FIELD_MAP[f.field] ?? "fullName", message: f.messages[0] ?? "Revisa este campo." })),
        };
      }
      if (error.unavailable || error.status === 404) {
        return {
          ok: false,
          message: `No pudimos registrar tu hoja en este momento. Intenta de nuevo en unos minutos; si persiste, escríbenos por WhatsApp al ${SITE.whatsapp.display} o acércate a nuestra oficina, donde tenemos el Libro de Reclamaciones de respaldo.`,
        };
      }
      return { ok: false, message: toUserError(error.code, error.problem?.detail).message };
    }
    console.error("[libro-de-reclamaciones] error inesperado", error);
    return { ok: false, message: toUserError("api-unavailable").message };
  }
}
