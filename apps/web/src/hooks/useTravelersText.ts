"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import type { Travelers } from "@/lib/cart/types";
import { describeTravelers } from "@/lib/i18n/units";

/** "2 adultos, 1 niño" / "2 adults, 1 child" en el idioma de la página. */
export function useTravelersText(): (travelers: Travelers) => string {
  const t = useTranslations("units");
  return useCallback((travelers: Travelers) => describeTravelers(t, travelers), [t]);
}
