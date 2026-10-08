import { BookOpenText } from "lucide-react";
import Link from "next/link";

import { SITE, whatsappHref } from "@/lib/site";
import Image from "next/image";
const PENDING = "por confirmar";

const DESTINATIONS = [
  { label: "Puno y lago Titicaca", href: "/es/destinos/tours-en-puno" },
  { label: "Cusco y Machu Picchu", href: "/es/destinos/cuzco" },
  { label: "Arequipa y Colca", href: "/es/destinos/tours-en-arequipa" },
  { label: "Ica y Paracas", href: "/es/destinos/tours-en-ica-paracas" },
  { label: "Lima", href: "/es/destinos/tours-en-lima" },
];

// Textos legales publicados como BORRADOR desde docs/legal (E8).
const HELP = [
  { label: "Todos los tours", href: "/es/tours" },
  { label: "Términos y condiciones", href: "/es/politicas/terminos-y-condiciones" },
  { label: "Pagos, cancelación y reembolsos", href: "/es/politicas/condiciones-de-pago" },
  { label: "Protección de datos personales", href: "/es/politicas/proteccion-de-datos-personales" },
  { label: "Política de cookies", href: "/es/politicas/cookies" },
  { label: "Nosotros", href: "/es/nosotros" },
];

function LegalItem({ label, value }: { label: string; value: string | null }) {
  return (
    <li>
      <span className="text-hero-muted">{label}: </span>
      {value ?? <span className="italic">{PENDING}</span>}
    </li>
  );
}

/** Footer legal (home.md §11). Datos no confirmados se muestran como "por confirmar"; no se inventan. */
export function SiteFooter({ variant = "full" }: { variant?: "full" | "minimal" }) {
  const { legal } = SITE;
  const year = new Date().getFullYear();

  if (variant === "minimal") {
    return (
      <footer className="border-t border-border bg-surface-muted">
        <div className="pwt-container flex flex-col gap-3 py-6 text-sm text-foreground-muted md:flex-row md:items-center md:justify-between">
          <p>
            {legal.businessName ?? SITE.name} · RUC: {legal.ruc ?? PENDING}
            {/* TODO(cliente): RUC y razón social reales. */}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link className="pwt-link" href="/es/politicas/terminos-y-condiciones">
                Términos
              </Link>
            </li>
            <li>
              <Link className="pwt-link" href="/es/politicas/condiciones-de-pago">
                Pagos y cancelación
              </Link>
            </li>
            <li>
              <Link className="pwt-link" href="/es/politicas/proteccion-de-datos-personales">
                Privacidad
              </Link>
            </li>
            <li>
              <Link className="pwt-link" href="/es/libro-de-reclamaciones">
                Libro de Reclamaciones
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
        Información de la agencia
      </h2>
      <div className="pwt-container grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Link href="/es" className="inline-flex min-h-11 items-center" aria-label="Peru Wonders Tours, inicio">
            <Image src="/logo.png" alt="Peru Wonders Tours" width={120} height={40} className="h-10 w-auto" />
          </Link>
          <ul className="space-y-1.5 text-sm">
            {/* TODO(cliente): completar razón social, RUC, registro MINCETUR y correo del dominio nuevo. */}
            <LegalItem label="Razón social" value={legal.businessName} />
            <LegalItem label="RUC" value={legal.ruc} />
            <LegalItem label="Registro de agencia (MINCETUR)" value={legal.minceturRegistry} />
            <LegalItem label="Oficina" value={legal.address} />
            <LegalItem label="Correo" value={legal.email} />
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
            Destinos
          </h3>
          <ul className="space-y-1 text-sm">
            {DESTINATIONS.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="inline-flex min-h-11 items-center hover:text-white md:min-h-9">
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-ayuda">
          <h3 id="footer-ayuda" className="mb-3 text-xs font-medium tracking-[0.08em] text-hero-muted uppercase">
            Ayuda
          </h3>
          <ul className="space-y-1 text-sm">
            {HELP.map((d) => (
              <li key={d.href}>
                <Link href={d.href} className="inline-flex min-h-11 items-center hover:text-white md:min-h-9">
                  {d.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="mb-3 text-xs font-medium tracking-[0.08em] text-hero-muted uppercase">Libro de Reclamaciones</h3>
          <Link
            href="/es/libro-de-reclamaciones"
            className="inline-flex min-h-11 items-center gap-3 rounded-md border border-[color:var(--pwt-hero-line)] px-4 py-2 text-sm text-white hover:bg-hero-hover"
          >
            {/* TODO(cumplimiento): reemplazar por el ícono oficial del Libro de Reclamaciones. */}
            <BookOpenText aria-hidden size={24} strokeWidth={1.5} />
            Libro de Reclamaciones
          </Link>
          <p className="mt-4 text-sm">
            {/* TODO(cumplimiento): validar redacción (Ley 30802). */}
            {SITE.name} rechaza toda forma de explotación sexual de niñas, niños y adolescentes (Ley 30802).
          </p>
        </div>
      </div>
      <div className="border-t border-[color:var(--pwt-hero-line)]">
        <p className="pwt-container py-6 text-sm text-hero-muted">
          © {year} {SITE.name}. Precios en soles (S/) con impuestos incluidos.
        </p>
      </div>
    </footer>
  );
}
