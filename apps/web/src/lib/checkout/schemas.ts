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

/** Código telefónico de cada país de la lista: al elegir uno se completa el otro. */
export const COUNTRY_PHONE: Record<string, string> = {
  Perú: "+51",
  Argentina: "+54",
  Bolivia: "+591",
  Brasil: "+55",
  Chile: "+56",
  Colombia: "+57",
  Ecuador: "+593",
  España: "+34",
  "Estados Unidos": "+1",
  México: "+52",
};

const REGION_COUNTRY: Record<string, (typeof COUNTRIES)[number]> = {
  PE: "Perú", AR: "Argentina", BO: "Bolivia", BR: "Brasil", CL: "Chile", CO: "Colombia",
  EC: "Ecuador", US: "Estados Unidos", MX: "México",
};

/**
 * País probable según el idioma principal del navegador ("en-US" → Estados Unidos, "pt-BR" → Brasil);
 * null si no se puede saber. "es-ES" no cuenta: es el español por defecto de muchos navegadores
 * en Latinoamérica, así que el cliente peruano seguiría viendo Perú.
 */
export function guessCountry(languages: readonly string[]): (typeof COUNTRIES)[number] | null {
  const region = languages[0]?.split("-")[1]?.toUpperCase();
  if (!region || region === "ES") return null;
  return REGION_COUNTRY[region] ?? null;
}

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
    /** Datos para operaciones (opcionales): llegan a la reserva como notas del cliente. */
    hotel: z.string().trim().max(200, "maxChars|200").optional(),
    notes: z.string().trim().max(500, "maxChars|500").optional(),
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

export const paymentStepSchema = z.object({
  option: z.enum(["deposit", "full"]),
  method: z.enum(["card", "yape", "pagoefectivo"]),
  terms: z.boolean().refine((v) => v, "termsRequired"),
  /** Solo se exige si la revalidación en la API detectó un cambio de precio. */
  ackPrice: z.boolean(),
});

export type PaymentStepValues = z.infer<typeof paymentStepSchema>;
