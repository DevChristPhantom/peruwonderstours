import { z } from "zod";

/**
 * Validación del checkout (checkout.md). Los mensajes son CLAVES de `formErrors` (messages/{es,en}/formErrors.json);
 * los campos (`form-fields.tsx`) los traducen al idioma de la página. `clave|n` pasa el número `n`.
 */

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
    firstName: z.string().trim().min(1, "firstNameRequired"),
    lastName: z.string().trim().min(1, "lastNameRequired"),
    email: z.string().trim().email("emailForConfirmation"),
    phoneCountry: z.string().min(1),
    phone: z.string().trim(),
    country: z.string().min(1, "countryRequired"),
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
        message: peru ? "phonePeru" : "phoneInvalid",
      });
    }
    if (v.receipt === "factura") {
      if (!/^(10|15|17|20)\d{9}$/.test(v.ruc ?? "")) {
        ctx.addIssue({ code: "custom", path: ["ruc"], message: "rucInvalid" });
      }
      if (!v.businessName) {
        ctx.addIssue({ code: "custom", path: ["businessName"], message: "businessNameRequired" });
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
    fullName: z.string().trim().min(3, "travelerFullName"),
    docType: z.enum(["dni", "pasaporte", "ce"]),
    docNumber: z.string().trim(),
    nationality: z.string().trim().min(2, "nationalityRequired"),
  })
  .superRefine((v, ctx) => {
    const ok = v.docType === "dni" ? /^\d{8}$/.test(v.docNumber) : /^[A-Za-z0-9]{5,15}$/.test(v.docNumber);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        path: ["docNumber"],
        message: v.docType === "dni" ? "dniInvalid" : "docInvalid",
      });
    }
  });

export const travelersSchema = z.object({
  useContactForFirst: z.boolean(),
  lines: z.array(z.object({ lineId: z.string(), travelers: z.array(travelerSchema) })),
  hotel: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500, "maxChars|500").optional(),
});

export type TravelersValues = z.infer<typeof travelersSchema>;
export type TravelerValues = z.infer<typeof travelerSchema>;

export const paymentStepSchema = z.object({
  option: z.enum(["deposit", "full"]),
  method: z.enum(["card", "yape", "pagoefectivo"]),
  terms: z.boolean().refine((v) => v, "termsRequired"),
  /** Solo se exige si la revalidación en la API detectó un cambio de precio. */
  ackPrice: z.boolean(),
});

export type PaymentStepValues = z.infer<typeof paymentStepSchema>;
