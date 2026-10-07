import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface SectionHeadingProps {
  id: string;
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  link?: { href: string; label: string };
  as?: "h1" | "h2";
}

/** Título de sección (Fraunces h2) con enlace opcional; se revela al hacer scroll. */
export function SectionHeading({ id, title, eyebrow, description, link, as: Tag = "h2" }: SectionHeadingProps) {
  return (
    <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between" data-reveal>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-label font-medium tracking-[0.08em] text-foreground-muted uppercase">{eyebrow}</p>
        ) : null}
        <Tag id={id} className={Tag === "h1" ? "font-display text-h1 font-medium" : "font-display text-h2 font-medium"}>
          {title}
        </Tag>
        {description ? <div className="mt-3 text-body-lg text-foreground-muted">{description}</div> : null}
      </div>
      {link ? (
        <Link href={link.href} className="pwt-link inline-flex min-h-11 shrink-0 items-center gap-1.5 font-medium">
          {link.label}
          <ArrowRight aria-hidden size={18} strokeWidth={1.5} />
        </Link>
      ) : null}
    </div>
  );
}
