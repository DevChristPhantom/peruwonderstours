/** Resultado de las Server Actions de la cuenta; cada estado tiene su texto en `account.states.*`. */
export type AccountState = {
  status: "idle" | "sent" | "invalid" | "busy" | "unavailable" | "expired" | "linkNotFound";
};

export const ACCOUNT_IDLE: AccountState = { status: "idle" };
