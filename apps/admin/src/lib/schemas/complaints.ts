import { z } from "zod";

import { limaLocalToIso, parseAmountToCents } from "@/lib/format";

/** Respuesta / reclasificación / solución directa (FormData de formularios simples). */
export const respondSchema = z
  .object({
    responseText: z.string().trim().min(10, "Mínimo 10 caracteres.").max(10_000),
    letterSentAt: z.string().optional().default(""),
    letterDeliveryRef: z.string().trim().max(150).optional().default(""),
  })
  .transform((v, ctx) => {
    let letterSentAt: string | undefined;
    if (v.letterSentAt) {
      letterSentAt = limaLocalToIso(v.letterSentAt) ?? undefined;
      if (!letterSentAt) ctx.addIssue({ code: "custom", path: ["letterSentAt"], message: "Fecha inválida." });
    }
    return { responseText: v.responseText, letterSentAt, letterDeliveryRef: v.letterDeliveryRef || undefined };
  });

export const reclassifySchema = z.object({
  type: z.enum(["reclamo", "queja"], { error: "Elige el tipo." }),
  reason: z.string().trim().min(5, "Mínimo 5 caracteres.").max(500),
});

export const offerSchema = z.object({ offerText: z.string().trim().min(10, "Mínimo 10 caracteres.").max(5000) });

export const acceptanceSchema = z
  .object({ evidence: z.string().trim().min(10, "Mínimo 10 caracteres.").max(5000), acceptedAt: z.string().optional().default("") })
  .transform((v, ctx) => {
    const acceptedAt = v.acceptedAt ? limaLocalToIso(v.acceptedAt) : null;
    if (v.acceptedAt && !acceptedAt) ctx.addIssue({ code: "custom", path: ["acceptedAt"], message: "Fecha inválida." });
    return { evidence: v.evidence, acceptedAt: acceptedAt ?? undefined };
  });

export const rejectionSchema = z.object({ note: z.string().trim().max(500).optional().default("") });

/** Transcripción de una hoja del libro físico (art. 4-A). */
export const transcriptionSchema = z
  .object({
    backupSheetNumber: z.string().trim().regex(/^[A-Za-z0-9-]{1,40}$/, "1-40 caracteres: letras, números y guiones."),
    submittedAt: z.string().min(1, "Indica cuándo se llenó la hoja."),
    declaredType: z.enum(["reclamo", "queja", ""]).default(""),
    consumer: z.object({
      fullName: z.string().trim().min(3, "Mínimo 3 caracteres.").max(200),
      docType: z.enum(["dni", "ce", "passport", "other"]),
      docNumber: z.string().trim().min(3, "Documento inválido.").max(20),
      address: z.string().trim().min(5, "Mínimo 5 caracteres.").max(300),
      phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Formato internacional: +51987654321."),
      email: z.email("Correo inválido.").max(254),
      isMinor: z.boolean().default(false),
    }),
    guardian: z.object({
      fullName: z.string().trim().max(200).default(""),
      address: z.string().trim().max(300).default(""),
      phone: z.string().trim().max(30).default(""),
      email: z.string().trim().max(254).default(""),
    }),
    good: z.object({
      type: z.enum(["product", "service"]),
      description: z.string().trim().min(5, "Mínimo 5 caracteres.").max(500),
      claimedAmount: z.string().trim().default(""),
      currency: z.enum(["PEN", "USD"]).default("PEN"),
    }),
    detail: z.string().trim().min(10, "Mínimo 10 caracteres.").max(5000),
    consumerRequest: z.string().trim().min(5, "Mínimo 5 caracteres.").max(2000),
    responseChannel: z.enum(["email", "letter"]),
    bookingCode: z.string().trim().max(20).default(""),
  })
  .transform((v, ctx) => {
    const submittedAt = limaLocalToIso(v.submittedAt);
    if (!submittedAt) ctx.addIssue({ code: "custom", path: ["submittedAt"], message: "Fecha y hora inválidas." });
    else if (Date.parse(submittedAt) > Date.now() + 60_000) ctx.addIssue({ code: "custom", path: ["submittedAt"], message: "No puede ser futura." });
    let claimedAmount: number | undefined;
    if (v.good.claimedAmount) {
      const cents = parseAmountToCents(v.good.claimedAmount);
      if (cents === null) ctx.addIssue({ code: "custom", path: ["good", "claimedAmount"], message: "Monto inválido." });
      else claimedAmount = cents;
    }
    if (v.consumer.isMinor) {
      if (v.guardian.fullName.length < 3) ctx.addIssue({ code: "custom", path: ["guardian", "fullName"], message: "Obligatorio si el consumidor es menor de edad." });
      if (!z.email().safeParse(v.guardian.email).success) ctx.addIssue({ code: "custom", path: ["guardian", "email"], message: "Correo del apoderado inválido." });
      if (v.guardian.address.length < 5) ctx.addIssue({ code: "custom", path: ["guardian", "address"], message: "Obligatorio (mín. 5)." });
      if (!/^\+[1-9]\d{6,14}$/.test(v.guardian.phone)) ctx.addIssue({ code: "custom", path: ["guardian", "phone"], message: "Formato internacional: +51987654321." });
    }
    return {
      backupSheetNumber: v.backupSheetNumber,
      submittedAt: submittedAt ?? "",
      consumer: v.consumer,
      guardian: v.consumer.isMinor ? v.guardian : null,
      good: { type: v.good.type, description: v.good.description, ...(claimedAmount !== undefined ? { claimedAmount, currency: v.good.currency } : {}) },
      declaredType: v.declaredType || undefined,
      detail: v.detail,
      consumerRequest: v.consumerRequest,
      responseChannel: v.responseChannel,
      bookingCode: v.bookingCode || undefined,
    };
  });
export type TranscriptionInput = z.input<typeof transcriptionSchema>;
