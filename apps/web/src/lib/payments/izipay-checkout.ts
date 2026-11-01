import type { CardHolder, PaymentBuyer, PaymentMethod, ProviderAction } from "./types";

/**
 * Formulario de Izipay (SDK web «Web Core», modalidad pop-up) en el navegador.
 * La tarjeta se escribe dentro del iframe de Izipay; aquí solo se arma su configuración pública
 * (la que entrega la API) y se devuelve la respuesta firmada para que la API la verifique.
 * Docs: https://developers.izipay.pe/web-core/
 */

const SDK_URL = /^https:\/\/(sandbox-)?checkout\.izipay\.pe\/payments\/v1\/js\/index\.js$/;
const SDK_TIMEOUT_MS = 20_000;

/** Respuesta del SDK (`callbackResponse`). Solo `payloadHttp` + `signature` cuentan: la API los verifica. */
export interface IzipayResponse {
  code?: string;
  message?: string;
  messageUser?: string;
  payloadHttp?: string;
  signature?: string;
}

interface IzipayInstance {
  LoadForm(options: { authorization: string; keyRSA: string; callbackResponse: (response: IzipayResponse) => void }): void;
}

declare global {
  interface Window {
    Izipay?: new (options: { config: Record<string, unknown> }) => IzipayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Carga el SDK una sola vez (solo desde los dominios de Izipay). */
export function loadIzipaySdk(url: string): Promise<void> {
  if (!SDK_URL.test(url)) return Promise.reject(new Error("izipay-sdk-url"));
  if (window.Izipay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(new Error("izipay-sdk-timeout")), SDK_TIMEOUT_MS);
    function fail(error: Error) {
      window.clearTimeout(timer);
      script.remove();
      loading = null;
      reject(error);
    }
    script.src = url;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.Izipay) resolve();
      else fail(new Error("izipay-sdk-missing"));
    };
    script.onerror = () => fail(new Error("izipay-sdk-load"));
    document.head.appendChild(script);
  });
  return loading;
}

/* ---------- Normalización a los formatos que valida Izipay ---------- */

const stripMarks = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nombres: letras (con tildes del español y ñ) y espacios, 2–50. */
export function izipayName(value: string, fallback: string): string {
  const kept = [...value]
    .map((ch) => (/[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s]/.test(ch) ? ch : stripMarks(ch).replace(/[^a-zA-Z]/g, "")))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
  return kept.length >= 2 ? kept : fallback;
}

/** Ciudad / región: solo letras sin tilde y espacios (regex de Izipay), 3–25. */
export function izipayPlace(value: string): string {
  return stripMarks(value)
    .replace(/[^A-Za-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

/** Dirección: letras, números, espacios y - / . ' ´ `, 5–40. */
export function izipayStreet(value: string): string {
  return value
    .replace(/[^a-zA-ZÀ-ſ0-9 \-/.'´`]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

/** Valida los datos del titular; devuelve el campo con error (o null). */
export function holderError(holder: CardHolder): keyof CardHolder | null {
  const doc = holder.document.trim();
  const docOk =
    holder.documentType === "DNI" ? /^\d{8}$/.test(doc) : holder.documentType === "CE" ? /^[A-Za-z0-9]{9,12}$/.test(doc) : /^[A-Za-z0-9]{8,12}$/.test(doc);
  if (!docOk) return "document";
  const street = izipayStreet(holder.street);
  if (street.length < 5) return "street";
  if (izipayPlace(holder.city).length < 3) return "city";
  if (izipayPlace(holder.state).length < 3) return "state";
  if (!/^\d{5,10}$/.test(holder.postalCode.trim())) return "postalCode";
  return null;
}

/** Valida los datos del comprador pedidos en la página de la reserva; devuelve el campo con error. */
export function buyerError(buyer: PaymentBuyer): keyof PaymentBuyer | null {
  if (izipayName(buyer.firstName, "").length < 2) return "firstName";
  if (izipayName(buyer.lastName, "").length < 2) return "lastName";
  if (!/^\d{7,15}$/.test(buyer.phone.replace(/[\s()+-]/g, ""))) return "phone";
  if (!/^[A-Z]{2}$/.test(buyer.country)) return "country";
  return null;
}

export interface IzipayBuyer {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164 (+51987654321). */
  phone: string;
  /** ISO 3166-1 alfa-2. */
  country: string;
  holder: CardHolder;
}

/** `config` del SDK a partir de la acción de la API y los datos del comprador. */
export function izipayConfig(action: ProviderAction, buyer: IzipayBuyer, method: PaymentMethod, locale: string, bookingCode: string): Record<string, unknown> {
  const p = action.params;
  const phone = buyer.phone.replace(/\D/g, "").slice(-15);
  return {
    transactionId: p.transactionId,
    action: "pay",
    merchantCode: p.merchantCode,
    order: {
      orderNumber: p.orderNumber,
      currency: p.currency,
      amount: p.amount,
      processType: p.processType ?? "AT",
      // Identificador del comprador en el comercio (6–100): la reserva.
      merchantBuyerId: bookingCode,
      // 16 dígitos (milisegundos + 000), formato del ejemplo oficial.
      dateTimeTransaction: `${Date.now()}000`,
      payMethod: method === "yape" ? "YAPE_CODE" : "CARD",
      showAmount: true,
    },
    billing: {
      firstName: izipayName(buyer.firstName, "Viajero"),
      lastName: izipayName(buyer.lastName, "Viajero"),
      ...(buyer.email.length >= 5 && buyer.email.length <= 50 ? { email: buyer.email } : {}),
      phoneNumber: phone,
      street: izipayStreet(buyer.holder.street),
      city: izipayPlace(buyer.holder.city),
      state: izipayPlace(buyer.holder.state),
      country: buyer.country,
      postalCode: buyer.holder.postalCode.trim(),
      documentType: buyer.holder.documentType,
      document: buyer.holder.document.trim().toUpperCase(),
    },
    render: { typeForm: "pop-up" },
    urlIPN: p.urlIPN,
    language: { init: locale === "es" ? "ESP" : "ENG", showControlMultiLang: false },
  };
}

/** Abre el pop-up de Izipay y resuelve con su respuesta (firmada si hubo resultado de la transacción). */
export async function openIzipayForm(action: ProviderAction, config: Record<string, unknown>): Promise<IzipayResponse> {
  await loadIzipaySdk(action.params.scriptUrl ?? "");
  const Izipay = window.Izipay;
  if (!Izipay) throw new Error("izipay-sdk-missing");
  const keyRSA = action.params.keyRSA ?? "";
  return new Promise<IzipayResponse>((resolve, reject) => {
    try {
      new Izipay({ config }).LoadForm({ authorization: action.token, keyRSA, callbackResponse: resolve });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("izipay-load-form"));
    }
  });
}
