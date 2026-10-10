import type messages from "../../messages/es.json";
import type { routing } from "./routing";

/** Tipado estricto de next-intl: claves de mensajes (desde `es.json`) e idiomas válidos. */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
