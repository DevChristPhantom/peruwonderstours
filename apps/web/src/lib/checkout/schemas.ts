import { z } from "zod";

/** Validación del checkout (checkout.md). Mensajes en español, se muestran en blur. */

export const PHONE_COUNTRIES = [
  { code: "+51", label: "Perú (+51)" },
  { code: "+54", label: "Argentina (+54)" },
  { code: "+591", label: "Bolivia (+591)" },
  { code: "+55", label: "Brasil (+55)" },
  { code: "+56", label: "Chile (+56)" },
  { code: "+57", label: "Colombia (+57)" },
  { code: "+593", label: "Ecuador (+593)" },
  { code: "+34", label: "España (+34)" },
  { code: "+1", label: "Estados Unidos / Canadá (+1)" },
  { code: "+52", label: "México (+52)" },
] as const;

export const COUNTRIES = [
  "Perú",
  "Argentina",
  "Bolivia",
  "Brasil",
  "Chile",
  "Colombia",
  "Ecuador",
  "España",
  "Estados Unidos",
  "México",
  "Otro país",
] as const;

export const contactSchema = z
  .object({
    firstName: z.string().trim().min(1, "Escribe tus nombres."),
    lastName: z.string().trim().min(1, "Escribe tus apellidos."),
    email: z.string().trim().email("Revisa el correo; aquí te enviaremos la confirmación."),
    phoneCountry: z.string().min(1),
    phone: z.string().trim(),
    country: z.string().min(1, "Elige tu país de residencia."),
    receipt: z.enum(["boleta", "factura"]),
    ruc: z.string().trim().optional(),
    businessName: z.string().trim().optional(),
    /**
     * Ley 29733: los datos necesarios para la reserva se tratan SIN consentimiento (art. 14.5,
     * ejecución del contrato) y solo se informa. El marketing es consentimiento aparte, opcional,
     * desmarcado y por canal (brain/wiki/normativa/proteccion-de-datos.md §2.3).
     */
    marketingEmail: z.boolean(),
    marketingWhatsapp: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const digits = v.phone.replace(/\D/g, "");
    const peru = v.phoneCountry === "+51";
    if (peru ? !/^9\d{8}$/.test(digits) : !/^\d{6,15}$/.test(digits)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: peru ? "Ingresa un celular de 9 dígitos." : "Ingresa un número de teléfono válido.",
      });
    }
    if (v.receipt === "factura") {
      if (!/^(10|15|17|20)\d{9}$/.test(v.ruc ?? "")) {
        ctx.addIssue({ code: "custom", path: ["ruc"], message: "El RUC tiene 11 dígitos y empieza con 10, 15, 17 o 20." });
      }
      if (!v.businessName) {
        ctx.addIssue({ code: "custom", path: ["businessName"], message: "Escribe la razón social." });
      }
    }
  });

export type ContactValues = z.infer<typeof contactSchema>;

export const DOC_TYPES = [
  { value: "dni", label: "DNI" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "ce", label: "Carné de extranjería" },
] as const;

export const travelerSchema = z
  .object({
    fullName: z.string().trim().min(3, "Escribe el nombre completo, como figura en el documento."),
    docType: z.enum(["dni", "pasaporte", "ce"]),
    docNumber: z.string().trim(),
    nationality: z.string().trim().min(2, "Escribe la nacionalidad."),
  })
  .superRefine((v, ctx) => {
    const ok = v.docType === "dni" ? /^\d{8}$/.test(v.docNumber) : /^[A-Za-z0-9]{5,15}$/.test(v.docNumber);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        path: ["docNumber"],
        message: v.docType === "dni" ? "El DNI tiene 8 dígitos." : "Revisa el número de documento.",
      });
    }
  });

export const travelersSchema = z.object({
  useContactForFirst: z.boolean(),
  lines: z.array(z.object({ lineId: z.string(), travelers: z.array(travelerSchema) })),
  hotel: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
});

export type TravelersValues = z.infer<typeof travelersSchema>;
export type TravelerValues = z.infer<typeof travelerSchema>;

export const paymentStepSchema = z.object({
  option: z.enum(["deposit", "full"]),
  method: z.enum(["card", "yape", "pagoefectivo"]),
  terms: z.boolean().refine((v) => v, "Para pagar, acepta los Términos y condiciones y la Política de cancelación."),
  /** Solo se exige si la revalidación en la API detectó un cambio de precio. */
  ackPrice: z.boolean(),
});

export type PaymentStepValues = z.infer<typeof paymentStepSchema>;
