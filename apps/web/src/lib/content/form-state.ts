/** Estado de los formularios públicos (contacto, testimonio); cada estado tiene su texto traducido. */
export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "invalid"; fields: string[] }
  | { status: "busy" }
  | { status: "unavailable" };

export const FORM_IDLE: FormState = { status: "idle" };
