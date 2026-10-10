import "server-only";

import { apiRequest } from "./client";

/**
 * ADAPTADOR AISLADO del Libro de Reclamaciones (`POST /complaints`, en implementación en backend).
 * Contrato acordado: respuesta `{ data: { code, createdAt, responseDueAt } }`. También se aceptan los
 * nombres del dominio del backend (`submittedAt`, `sheetNumber`, `provider`, `accessToken`) por si
 * el controlador los expone; ajustar SOLO aquí si cambian.
 * Cuerpo: `ComplaintDraft` de apps/api/src/modules/complaints/domain/complaint.ts (montos en céntimos).
 */

export interface ComplaintDraftBody {
  consumer: {
    fullName: string;
    docType: "dni" | "ce" | "passport" | "other";
    docNumber: string;
    address: string;
    phone: string;
    email: string;
    isMinor: boolean;
  };
  guardian: { fullName: string; address: string; phone: string; email: string } | null;
  good: { type: "product" | "service"; description: string; claimedAmount: number | null; currency: "PEN" | "USD" | null };
  bookingCode?: string;
  /** null = "no sé" (se tramita como reclamo, art. 6). */
  declaredType: "reclamo" | "queja" | null;
  detail: string;
  consumerRequest: string;
  responseChannel: "email" | "letter";
  conformityAccepted: true;
}

export interface ComplaintCreated {
  code: string;
  sheetNumber: string | null;
  submittedAt: string;
  responseDueAt: string;
  provider: { legalName: string | null; ruc: string | null; establishmentAddress: string | null; establishmentCode: string | null } | null;
}

interface RawCreated {
  code: string;
  accessToken?: string;
  sheetNumber?: string;
  createdAt?: string;
  submittedAt?: string;
  responseDueAt: string;
  provider?: { legalName?: string; ruc?: string; establishmentAddress?: string; establishmentCode?: string };
}

/**
 * `bookingToken` (H-17, opcional): token de la reserva del propio visitante (cookie httpOnly). Con él la
 * API vincula el reclamo a la reserva de forma verificada; sin él, el código queda como "declarado".
 */
export async function submitComplaint(body: ComplaintDraftBody, idempotencyKey: string, bookingToken?: string | null): Promise<ComplaintCreated> {
  const res = await apiRequest<{ data: RawCreated & { complaint?: RawCreated } }>("/complaints", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey, "x-booking-token": bookingToken ?? undefined },
    body,
  });
  const raw: RawCreated = res!.body.data.complaint ?? res!.body.data;
  // El POST no trae el proveedor: se lee de la hoja (snapshot congelado) con el token de consulta.
  if (!raw.provider && raw.accessToken) {
    try {
      const sheet = await apiRequest<{ data: { provider?: RawCreated["provider"] } }>(`/complaints/${encodeURIComponent(raw.code)}`, {
        headers: { "x-complaint-token": raw.accessToken },
        nullOn404: true,
      });
      raw.provider = sheet?.body.data.provider;
    } catch {
      /* la constancia se muestra igual con los datos configurados en la web */
    }
  }
  return {
    code: raw.code,
    sheetNumber: raw.sheetNumber ?? null,
    submittedAt: raw.submittedAt ?? raw.createdAt ?? new Date().toISOString(),
    responseDueAt: raw.responseDueAt,
    provider: raw.provider
      ? {
          legalName: raw.provider.legalName ?? null,
          ruc: raw.provider.ruc ?? null,
          establishmentAddress: raw.provider.establishmentAddress ?? null,
          establishmentCode: raw.provider.establishmentCode ?? null,
        }
      : null,
  };
}

/** Resumen de una hoja para la página de consulta (sin documento ni teléfono del consumidor). */
export interface ComplaintStatusView {
  code: string;
  sheetNumber: string | null;
  status: string;
  submittedAt: string;
  responseDueAt: string;
  type: "reclamo" | "queja" | string;
  detail: string;
  consumerRequest: string;
  answer: { text: string; sentAt: string } | null;
}

/** `GET /complaints/:code` con `X-Complaint-Token`; `null` si no existe o el token no corresponde. */
export async function getComplaintStatus(code: string, token: string): Promise<ComplaintStatusView | null> {
  const res = await apiRequest<{ data: Partial<ComplaintStatusView> & { code: string; declaredType?: string } }>(
    `/complaints/${encodeURIComponent(code)}`,
    { headers: { "x-complaint-token": token }, nullOn404: true },
  );
  if (!res) return null;
  const d = res.body.data;
  return {
    code: d.code,
    sheetNumber: d.sheetNumber ?? null,
    status: d.status ?? "received",
    submittedAt: d.submittedAt ?? "",
    responseDueAt: d.responseDueAt ?? "",
    type: d.type ?? d.declaredType ?? "reclamo",
    detail: d.detail ?? "",
    consumerRequest: d.consumerRequest ?? "",
    answer: d.answer ?? null,
  };
}
