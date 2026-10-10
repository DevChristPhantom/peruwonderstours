import { BookOpenText } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { SITE, whatsappHref } from "@/lib/site";

function LegalItem({ label, value, pending }: { label: string; value: string | null; pending: string }) {
  return (
    <li>
      <span className="text-hero-muted">{label}: </span>
      {value ?? <span className="italic">{pending}</span>}
    </li>
  );
}

/** Footer legal (home.md §11). Datos no confirmados se muestran como "por confirmar"; no se inventan. */
export async function SiteFooter({ variant = "full" }: { variant?: "full" | "minimal" }) {
  const t = await getTranslations("footer");
  const tc = await getTranslations("common");
  const { legal } = SITE;
  const pending = tc("pending");
  const year = new Date().getFullYear();

  if (variant === "minimal") {
    return (
      <footer className="border-t border-border bg-surface-muted">
        <div className="pwt-container flex flex-col gap-3 py-6 text-sm text-foreground-muted md:flex-row md:items-center md:justify-between">
          <p>
            {legal.businessName ?? SITE.name} · RUC: {legal.ruc ?? pending}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link className="pwt-link" href="/politicas/terminos-y-condiciones">
                {t("short.terms")}
              </Link>
            </li>
            <li>
              <Link className="pwt-link" href="/politicas/condiciones-de-pago">
                {t("short.payments")}
              </Link>
            </li>
            <li>
              <Link className="pwt-link" href="/politicas/proteccion-de-datos-personales">
                {t("short.privacy")}
              </Link>
            </li>
            <li>
              <Link className="pwt-link" href="/libro-de-reclamaciones">
                {t("complaintsBook")}
              </Link>
            </li>
          </ul>
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-hero-ink text-[color:var(--pwt-hero-soft)]" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">
        {t("title")}
      </h2>
      <div className="pwt-container grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label={tc("logoHome")}>
            <Image src="/logo.png" alt={tc("logoAlt")} width={120} height={40} className="h-10 w-auto" />
          </Link>
          <ul className="space-y-1.5 text-sm">
            <LegalItem label={t("legal.businessName")} value={legal.businessName} pending={pending} />
            <LegalItem label={t("legal.ruc")} value={legal.ruc} pending={pending} />
            <LegalItem label={t("legal.mincetur")} value={legal.minceturRegistry} pending={pending} />
            <LegalItem label={t("legal.office")} value={legal.address} pending={pending} />
            <LegalItem label={t("legal.email")} value={legal.email} pending={pending} />
            <li>
              <span className="text-hero-muted">WhatsApp: </span>
              <a className="underline underline-offset-2 hover:text-white" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                {SITE.whatsapp.display}
              </a>
            </li>
          </ul>
        </div>

        <nav aria-labelledby="footer-destinos">
          <h3 id="footer-destinos" className="mb-3 text-xs font-medium tracking-[0.08em] text-hero-muted uppercase">
            {tc("destinations")}
          </h3>
          <ul className="space-y-1 text-sm">
            {(
              [
                ["tours-en-puno", "puno"],
                ["cuzco", "cusco"],
                ["tours-en-arequipa", "arequipa"],
                ["tours-en-ica-paracas", "ica"],
                ["tours-en-lima", "lima"],
              ] as const
            ).map(([slug, key]) => (
              <li key={slug}>
                <Link
                  href={{ pathname: "/destinos/[slug]", params: { slug } }}
                  className="inline-flex min-h-11 items-center hover:text-white md:min-h-9"
                >
                  {t(`destinations.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-ayuda">
          <h3 id="footer-ayuda" className="mb-3 text-xs font-medium tracking-[0.08em] text-hero-muted uppercase">
            {t("help")}
          </h3>
          <ul className="space-y-1 text-sm">
            {(
              [
                ["/tours", "allTours"],
                ["/politicas/terminos-y-condiciones", "terms"],
                ["/politicas/condiciones-de-pago", "payments"],
                ["/politicas/proteccion-de-datos-personales", "privacy"],
                ["/politicas/cookies", "cookies"],
                ["/nosotros", "about"],
              ] as const
            ).map(([href, key]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center hover:text-white md:min-h-9">
                  {t(`links.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="mb-3 text-xs font-medium tracking-[0.08em] text-hero-muted uppercase">{t("complaintsBook")}</h3>
          <Link
            href="/libro-de-reclamaciones"
            className="inline-flex min-h-11 items-center gap-3 rounded-md border border-[color:var(--pwt-hero-line)] px-4 py-2 text-sm text-white hover:bg-hero-hover"
          >
            {/* PENDIENTE(cumplimiento): ícono oficial del Libro de Reclamaciones. */}
            <BookOpenText aria-hidden size={24} strokeWidth={1.5} />
            {t("complaintsBook")}
          </Link>
          <p className="mt-4 text-sm">{t("esnna", { name: SITE.name })}</p>
        </div>
      </div>
      <div className="border-t border-[color:var(--pwt-hero-line)]">
        <p className="pwt-container py-6 text-sm text-hero-muted">{t("copyright", { year, name: SITE.name })}</p>
      </div>
    </footer>
  );
}
