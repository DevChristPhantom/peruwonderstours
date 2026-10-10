/** Flujos con enlace de acceso por correo: reserva (F0/F0b) y Hoja de Reclamación (F7). */
export type AccessKind = "booking" | "complaint";

/** Resultado de las Server Actions de acceso; cada estado tiene su texto en `access.*`. */
export type AccessState = {
  status: "idle" | "sent" | "invalid" | "busy" | "unavailable" | "expired" | "linkNotFound";
};

export const ACCESS_IDLE: AccessState = { status: "idle" };
