/**
 * Errores de la API (problem+json) → mensajes para el staff. Módulo puro: el servidor arma el
 * `UserError` y el navegador solo recibe `{ code, message, fields, items }` (nunca el problem crudo).
 */

export interface UserError {
  code: string;
  message: string;
  /** Errores por campo (`field` de la API → mensaje). */
  fields?: Record<string, string>;
  /** Lista adicional (p. ej. requisitos de publicación faltantes). */
  items?: string[];
  retryAfterSeconds?: number;
  status?: number;
}

export interface ProblemLike {
  status: number;
  code: string;
  detail?: string;
  errors?: { field: string; messages: string[] }[];
  details?: Record<string, unknown>;
  retryAfterSeconds?: number | null;
}

/** "3 min", "1 h 5 min", "45 s". */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} s`;
  const min = Math.ceil(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

const FIXED: Record<string, string> = {
  "api-unavailable": "No pudimos conectar con la API. Intenta de nuevo en unos segundos.",
  "no-session": "Tu sesión terminó. Vuelve a iniciar sesión.",
  "insufficient-permissions": "No tienes permiso para realizar esta acción. Si lo necesitas, pídeselo a un administrador.",
  "invalid-credentials": "Correo o contraseña incorrectos.",
  "account-disabled": "Tu cuenta está suspendida o deshabilitada. Contacta a un administrador.",
  "invalid-mfa-code": "El código no es válido o ya fue usado. Revisa la hora de tu teléfono e intenta con el siguiente código.",
  "invalid-mfa-token": "El paso de verificación expiró (5 min). Vuelve a ingresar tu correo y contraseña.",
  "mfa-already-enrolled": "El segundo factor ya está activo. Inicia sesión con tu código.",
  "mfa-enrollment-not-started": "Primero genera el código QR.",
  "backoffice-requires-database": "El backoffice necesita la API en modo base de datos (DATA_SOURCE=prisma).",
  "csrf-origin-mismatch": "La solicitud no vino de este panel. Recarga la página e intenta de nuevo.",
  "idempotency-in-progress": "La operación ya se está procesando. Espera unos segundos y recarga.",
  "idempotency-key-reused": "Este formulario ya se usó con otros datos. Recarga la página para registrar otra operación.",
  "payment-in-progress": "Hay un cobro en línea en curso para esta reserva. Espera a que termine (o concilia los pagos pendientes desde el tablero) antes de registrar un pago manual.",
  "too-many-requests": "Demasiadas solicitudes seguidas. Espera un minuto e intenta de nuevo.",
  "http-429": "Demasiadas solicitudes seguidas. Espera un minuto e intenta de nuevo.",
};

/** Etiquetas legibles para los campos que devuelve la API en `errors[].field`. */
const FIELD_LABELS: Record<string, string> = {
  "translations.es": "Traducción en español",
  "translations.es.title": "Título (es)",
  "translations.es.summary": "Resumen (es)",
  "translations.es.itinerary": "Itinerario (es)",
  media: "Imagen de portada",
  reason: "Motivo",
  responseText: "Respuesta",
  letterSentAt: "Fecha de envío",
  letterDeliveryRef: "N.º de cargo",
  offerText: "Propuesta",
  evidence: "Evidencia",
  acceptedAt: "Fecha de aceptación",
  note: "Nota",
  amount: "Monto",
  reference: "Referencia",
  receivedAt: "Fecha de recepción",
  capacity: "Capacidad",
  from: "Desde",
  to: "Hasta",
  weekdays: "Días de la semana",
  startTime: "Hora",
  validFrom: "Vigente desde",
  validTo: "Vigente hasta",
  minGroupSize: "Grupo mínimo",
  maxGroupSize: "Grupo máximo",
  seasonId: "Temporada",
  slug: "Slug",
  title: "Título",
  summary: "Resumen",
  code: "Código",
  name: "Nombre",
  startDate: "Inicio",
  endDate: "Fin",
  subjectName: "Titular",
  subjectEmail: "Correo del titular",
  detail: "Detalle",
  fullName: "Nombre completo",
  email: "Correo",
  newPassword: "Contraseña nueva",
  password: "Contraseña",
  currentPassword: "Contraseña actual",
  "translations.es.body": "Cuerpo (es)",
  body: "Texto",
  excerpt: "Extracto",
  description: "Descripción",
  tags: "Etiquetas",
  coverStorageKey: "Imagen de portada",
  sortOrder: "Orden",
  parentId: "Destino padre",
  translationStatus: "Estado de la traducción",
  authorName: "Autor",
  authorCountry: "País",
  rating: "Calificación",
  internalNote: "Nota interna",
  status: "Estado",
  file: "Archivo",
};

/** 409 por bloqueo optimista (`tour-version-conflict`, `blog-post-version-conflict`, `destination-version-conflict`…). */
export function isVersionConflict(code: string): boolean {
  return code === "concurrency-conflict" || code.endsWith("-version-conflict");
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function toUserError(p: ProblemLike): UserError {
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) if (e.field && e.messages?.length) fields[e.field] = e.messages.join(" ");
  const base: UserError = { code: p.code, status: p.status, message: "", fields: Object.keys(fields).length ? fields : undefined };

  if (p.code === "account-locked") {
    const wait = p.retryAfterSeconds ?? Number(p.details?.retryAfterSeconds);
    return {
      ...base,
      retryAfterSeconds: Number.isFinite(wait) && wait > 0 ? wait : undefined,
      message:
        Number.isFinite(wait) && wait > 0
          ? `Demasiados intentos fallidos: la cuenta está bloqueada. Intenta de nuevo en ${formatWait(wait)}.`
          : "Demasiados intentos fallidos: la cuenta está bloqueada temporalmente.",
    };
  }
  if (p.status === 429 && p.code !== "account-locked") {
    const wait = p.retryAfterSeconds;
    return { ...base, retryAfterSeconds: wait ?? undefined, message: wait ? `Demasiadas solicitudes seguidas. Espera ${formatWait(wait)} e intenta de nuevo.` : FIXED["http-429"] };
  }
  if (p.code === "tour-not-publishable") {
    return {
      ...base,
      message: "El tour aún no cumple los requisitos para publicarse:",
      items: (p.errors ?? []).map((e) => `${fieldLabel(e.field)}: ${e.messages.join(" ")}`),
      fields: undefined,
    };
  }
  if (p.code === "tour-version-conflict" || p.code === "concurrency-conflict") {
    return { ...base, message: p.detail ?? "Otro usuario modificó este registro. Recarga para ver los cambios antes de guardar." };
  }
  if (isVersionConflict(p.code)) {
    return { ...base, message: "Alguien más editó esto mientras lo tenías abierto. Recarga la página para ver la versión vigente antes de guardar." };
  }
  if (p.code === "blog-post-not-publishable") {
    return { ...base, message: "El artículo aún no cumple los requisitos para publicarse:", items: (p.errors ?? []).map((e) => `${fieldLabel(e.field)}: ${e.messages.join(" ")}`), fields: undefined };
  }
  if (p.code === "rate-overlap") {
    const other = typeof p.details?.conflictingRate === "string" ? p.details.conflictingRate : null;
    return {
      ...base,
      message: "Esta tarifa se cruza con otra tarifa activa del mismo tour, tipo de pasajero, residencia, moneda y temporada.",
      items: [
        other ? `Tarifa en conflicto: ${other}.` : p.detail ?? "",
        "Dos tarifas activas no pueden compartir fechas de vigencia y rango de grupo a la vez.",
        "Solución: acorta la vigencia, separa los rangos de grupo (p. ej. 1-5 y 6+) o desactiva la otra tarifa.",
      ].filter(Boolean),
    };
  }
  if (p.status === 403 && !FIXED[p.code]) return { ...base, message: p.detail ?? FIXED["insufficient-permissions"] };
  if (FIXED[p.code]) return { ...base, message: FIXED[p.code] };
  if (p.status >= 500 || p.status === 0) return { ...base, message: FIXED["api-unavailable"] };
  // La API ya responde `detail` en español (es-PE) para los errores de dominio.
  return { ...base, message: p.detail?.trim() || "No se pudo completar la operación." };
}
