"use client";

import clsx from "clsx";
import {
  BookOpenCheck,
  CalendarDays,
  FolderTree,
  Gauge,
  Inbox,
  Map,
  MapPin,
  MessageSquareQuote,
  Newspaper,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavKey =
  | "tablero"
  | "reservas"
  | "pagos-manuales"
  | "tours"
  | "precios"
  | "salidas"
  | "destinos"
  | "categorias"
  | "blog"
  | "testimonios"
  | "contacto"
  | "reclamos"
  | "privacidad"
  | "auditoria"
  | "usuarios"
  | "cuenta";

const ICONS: Record<NavKey, LucideIcon> = {
  tablero: Gauge,
  reservas: ReceiptText,
  "pagos-manuales": Wallet,
  tours: Map,
  precios: Tags,
  salidas: CalendarDays,
  destinos: MapPin,
  categorias: FolderTree,
  blog: Newspaper,
  testimonios: MessageSquareQuote,
  contacto: Inbox,
  reclamos: BookOpenCheck,
  privacidad: ShieldCheck,
  auditoria: ScrollText,
  usuarios: Users,
  cuenta: UserCog,
};

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  badge?: number;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex min-h-10 items-center gap-2.5 rounded-sm px-3 text-sm no-underline transition-colors duration-150",
                active ? "bg-primary font-medium text-on-primary" : "text-foreground hover:bg-surface-muted",
              )}
            >
              <Icon aria-hidden size={18} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className={clsx("rounded-pill px-1.5 text-xs font-semibold", active ? "bg-on-primary text-primary" : "bg-danger text-surface")}>
                  {item.badge}
                  <span className="sr-only"> pendientes</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
