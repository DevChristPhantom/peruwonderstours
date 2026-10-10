"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import { formatFor, type Formatter } from "@/lib/format";

/** Formateadores de dinero y fechas del idioma activo (es-PE / en-US, hora de Lima). */
export function useFormat(): Formatter {
  const locale = useLocale();
  return useMemo(() => formatFor(locale), [locale]);
}
