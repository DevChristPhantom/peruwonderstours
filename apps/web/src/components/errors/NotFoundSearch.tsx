"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { whatsappHref } from "@/lib/site";

/** Palabras de la URL que no ayudan a buscar ("tours-en-puno" → "puno"). */
const STOPWORDS = new Set(["tour", "tours", "en", "de", "del", "la", "el", "los", "las", "y", "a", "es", "pt", "and", "the", "of", "in"]);

/** Convierte el último tramo de la URL rota en una búsqueda probable: "/es/tours/machu-picchu-2d" → "machu picchu". */
export function guessQuery(pathname: string): string {
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  let text: string;
  try {
    text = decodeURIComponent(last);
  } catch {
    text = last;
  }
  return text
    .toLowerCase()
    .split(/[-_+.\s]+/)
    .filter((w) => w.length > 2 && !/\d/.test(w) && !STOPWORDS.has(w))
    .slice(0, 4)
    .join(" ");
}

/** Buscador del 404 (GET a /tours?q=) prellenado con lo que parecía buscar la URL rota. */
export function NotFoundSearch({ action }: { action: string }) {
  const t = useTranslations("notFound");
  const pathname = usePathname();
  const id = useId();
  return (
    <form action={action} method="get" role="search" className="mx-auto mt-8 w-full max-w-xl text-left">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {t("searchLabel")}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="q"
          type="search"
          defaultValue={guessQuery(pathname)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="min-h-12 w-full min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-4 text-body text-foreground placeholder:text-foreground-muted focus-visible:outline-2 focus-visible:outline-ring"
        />
        <button type="submit" className={buttonClass("primary", "lg")}>
          <Search aria-hidden size={18} /> {t("searchButton")}
        </button>
      </div>
    </form>
  );
}

/** Enlace a WhatsApp que lleva la URL rota para que el equipo pueda corregirla. */
export function BrokenLinkReport() {
  const t = useTranslations("notFound");
  const pathname = usePathname();
  return (
    <p className="mt-6 text-sm text-foreground-muted">
      {t("help")}{" "}
      <a href={whatsappHref(t("whatsappMessage", { path: pathname }))} target="_blank" rel="noopener noreferrer" className="pwt-link">
        {t("helpLink")}
      </a>
    </p>
  );
}
