import { BookOpenText, CreditCard, MapPinned, MessageCircle, ShieldCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { SITE, whatsappHref } from "@/lib/site";
import { buttonClass } from "@/components/ui/button-styles";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ---------- Por qué viajar con nosotros (home.md §7) ---------- */

export function WhyUsSection({ tourCount, destinationCount }: { tourCount: number; destinationCount: number }) {
  // Solo datos verificables: conteos del catálogo y reglas ya publicadas por el cliente (RN-01).
  // TODO(cliente): año de apertura de la oficina y certificación de guías antes de afirmarlos.
  const reasons = [
    { icon: MapPinned, title: "Oficina en Puno", text: "Organizamos tu viaje desde el altiplano, con gente que conoce el terreno." },
    { icon: Users, title: "Guías locales", text: "Recorridos guiados por personas de cada destino." },
    { icon: Wallet, title: "Paga el 50 % y reserva", text: "Separa tu cupo con la mitad y paga el saldo antes de viajar." },
    { icon: MessageCircle, title: "Atención por WhatsApp", text: "Resolvemos tus dudas antes, durante y después del viaje." },
  ];
  return (
    <section className="pwt-section" aria-labelledby="porque-title">
      <div className="pwt-container">
        <SectionHeading id="porque-title" title="Por qué viajar con nosotros" />
        <dl className="mb-12 grid grid-cols-2 gap-6 border-y border-border py-8 md:max-w-xl" data-reveal>
          <div>
            <dt className="text-sm text-foreground-muted">Tours publicados</dt>
            <dd className="tabular font-display text-display-xl" data-count-to={tourCount}>
              {tourCount}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-foreground-muted">Destinos en el Perú</dt>
            <dd className="tabular font-display text-display-xl" data-count-to={destinationCount}>
              {destinationCount}
            </dd>
          </div>
        </dl>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" data-reveal-stagger>
          {reasons.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon aria-hidden size={24} strokeWidth={1.5} className="text-primary" />
              <h3 className="mt-3 text-h4 font-medium">{title}</h3>
              <p className="mt-1 text-foreground-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Testimonios (placeholder explícito) ---------- */

export function TestimonialsPlaceholder() {
  // TODO(E0): migrar testimonios reales de /es/testimonios (con consentimiento) y retirar este bloque.
  return (
    <section className="pwt-section bg-surface-muted" aria-labelledby="testimonios-title">
      <div className="pwt-container">
        <SectionHeading
          id="testimonios-title"
          title="Lo que cuentan nuestros viajeros"
          description={
            <p className="inline-flex items-center gap-2 rounded-pill bg-warning-soft px-3 py-1 text-sm text-warning">
              Contenido de ejemplo: los testimonios reales se están migrando.
            </p>
          }
        />
        <ul className="grid gap-6 md:grid-cols-3" data-reveal-stagger>
          {[1, 2, 3].map((n) => (
            <li key={n}>
              <figure className="h-full rounded-lg border border-dashed border-border-strong bg-surface p-6">
                <p className="mb-3 text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">
                  Testimonio de ejemplo {n}
                </p>
                <blockquote className="text-foreground-muted">
                  Aquí irá la opinión real de un viajero, con su permiso, sobre el tour que hizo con nosotros.
                </blockquote>
                <figcaption className="mt-4 text-sm text-foreground-muted">Nombre, país · Tour · Fecha</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- Confianza y legales (obligatorio) ---------- */

export function TrustSection() {
  // TODO(cumplimiento): sellos oficiales (MINCETUR/GERCETUR, Safe Travels, Código ESNNA, Marca Perú)
  // con sus archivos originales y enlaces de verificación. No se dibujan versiones propias.
  const seals = ["Registro de agencia MINCETUR", "Safe Travels (WTTC)", "Código de Conducta ESNNA", "Marca Perú"];
  return (
    <section className="border-y border-border bg-surface-muted py-12" aria-labelledby="confianza-title">
      <div className="pwt-container grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 id="confianza-title" className="text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">
            Agencia registrada y segura
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Sellos (pendientes de archivo oficial)">
            {seals.map((seal) => (
              <li
                key={seal}
                className="flex min-h-12 items-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-2 text-sm text-foreground-muted"
              >
                <ShieldCheck aria-hidden size={18} strokeWidth={1.5} className="shrink-0" />
                <span>
                  {seal} <span className="italic">(sello por confirmar)</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-foreground-muted">
            <CreditCard aria-hidden size={18} strokeWidth={1.5} />
            Medios de pago según la pasarela elegida (tarjeta, Yape, PagoEfectivo). Logos oficiales por confirmar.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="flex items-center gap-3 font-medium">
            <BookOpenText aria-hidden size={28} strokeWidth={1.5} className="text-primary" />
            Libro de Reclamaciones
          </p>
          <p className="mt-1 max-w-xs text-sm text-foreground-muted">
            Conforme a la Ley 29571, puedes registrar un reclamo o queja en línea.
          </p>
          <Link href="/es/libro-de-reclamaciones" className={buttonClass("outline", "md", "mt-4 w-full")}>
            Ir al Libro de Reclamaciones
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA final ---------- */

export function FinalCta() {
  return (
    <section className="bg-primary py-20 text-on-primary [&_:focus-visible]:outline-on-primary" aria-labelledby="cta-title">
      <div className="pwt-container flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl" data-reveal>
          <h2 id="cta-title" className="font-display text-h2 font-medium">
            ¿Armamos tu viaje a medida?
          </h2>
          <p className="mt-3 text-body-lg opacity-90">
            Cuéntanos fechas, número de viajeros y lo que quieres conocer. Te respondemos con una propuesta y su precio.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            href={whatsappHref(`Hola ${SITE.name}, quiero armar un viaje a medida.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("inverse", "lg")}
          >
            <MessageCircle aria-hidden size={20} strokeWidth={1.5} />
            Escríbenos por WhatsApp
          </a>
          <Link href="/es/categorias/paquetes-turisticos-en-peru" className={buttonClass("outline-inverse", "lg")}>
            Ver paquetes
          </Link>
        </div>
      </div>
    </section>
  );
}
