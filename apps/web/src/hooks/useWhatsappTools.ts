"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type { WhatsappTools } from "@/lib/whatsapp/messages";

import { useFormat } from "./useFormat";

/** Traductores y formato para armar mensajes de WhatsApp en el idioma de la página. */
export function useWhatsappTools(): WhatsappTools {
  const t = useTranslations("whatsapp");
  const units = useTranslations("units");
  const format = useFormat();
  return useMemo(() => ({ t, units, format }), [t, units, format]);
}
