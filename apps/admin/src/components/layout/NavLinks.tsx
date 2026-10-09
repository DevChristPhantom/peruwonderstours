"use client";

import clsx from "clsx";
import {
  BookOpenCheck,
  CalendarDays,
  Gauge,
  Map,
  ReceiptText,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavKey = "tablero" | "reservas" | "tours" | "precios" | "salidas" | "reclamos" | "privacidad" | "usuarios" | "cuenta";

const ICONS: Record<NavKey, LucideIcon> = {
  tablero: Gauge,
  reservas: ReceiptText,
  tours: Map,
  precios: Tags,
  salidas: CalendarDays,
  reclamos: BookOpenCheck,
  privacidad: ShieldCheck,
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
