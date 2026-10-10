import clsx from "clsx";
import Link from "next/link";

export interface TabLink {
  key: string;
  href: string;
  label: React.ReactNode;
}

/**
 * Pestañas como enlaces GET (enlazables, sin JS): cada pestaña es una vista distinta de la página,
 * así nunca hay dos formularios con los mismos campos a la vez. `aria-current` marca la activa.
 */
export function TabLinks({ tabs, active, label }: { tabs: TabLink[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 border-b border-border">
      <ul className="-mb-px flex flex-wrap gap-1">
        {tabs.map((t) => {
          const current = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={current ? "page" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm no-underline",
                  current ? "border-primary font-semibold text-foreground" : "border-transparent text-foreground-muted hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
