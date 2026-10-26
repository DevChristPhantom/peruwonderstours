"use client";

import clsx from "clsx";
import {
  BookOpenCheck,
  CalendarDays,
  FolderTree,
  Gauge,
  Inbox,
  PanelsTopLeft,
  Map,
  MapPin,
  Megaphone,
  MessageSquareQuote,
  Newspaper,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  Wallet,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from 'react';

export type NavKey =
  | "tablero"
  | "banners"
  | "eventos"
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
  banners: PanelsTopLeft,
  eventos: Megaphone,
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

const NAV_GROUP: Record<NavKey, string> = {
  tablero: "Operación", reservas: "Operación", "pagos-manuales": "Operación", reclamos: "Operación", contacto: "Operación",
  tours: "Catálogo", precios: "Catálogo", salidas: "Catálogo", destinos: "Catálogo", categorias: "Catálogo",
  blog: "Contenido", testimonios: "Contenido", banners: "Contenido", eventos: "Contenido",
  privacidad: "Administración", auditoria: "Administración", usuarios: "Administración", cuenta: "Administración",
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = items.filter(item => normalize(`${item.label} ${NAV_GROUP[item.key]}`).includes(normalize(query.trim())));
  return (
    <div>
      <label htmlFor={searchId} className="sr-only">Buscar sección del panel</label>
      <div className="admin-nav-search">
        <Search aria-hidden size={17} />
        <input ref={searchRef} id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar sección…" autoComplete="off" />
        {query ? <button type="button" aria-label="Limpiar búsqueda de secciones" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X aria-hidden size={16} /></button> : null}
      </div>
      {query ? <p role="status" className="px-3 pt-3 text-xs text-foreground-muted">{filtered.length ? `${filtered.length} secciones encontradas` : 'No hay coincidencias. Prueba con tours, reservas o precios.'}</p> : null}
    <ul className="space-y-0.5">
      {filtered.map((item, index) => {
        const Icon = ICONS[item.key];
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.key}>
            {index === 0 || NAV_GROUP[filtered[index - 1].key] !== NAV_GROUP[item.key] ? (
              <p className="px-3 pb-2 pt-5 text-[11px] font-semibold tracking-[0.1em] text-foreground-muted uppercase">{NAV_GROUP[item.key]}</p>
            ) : null}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                // The mobile disclosure must not cover the destination after navigation.
                const disclosure = event.currentTarget.closest('details');
                if (disclosure) {
                  disclosure.open = false;
                  disclosure.querySelector('summary')?.focus();
                }
                setQuery('');
              }}
              className={clsx(
                "admin-nav-link flex min-h-11 items-center gap-2.5 rounded-sm px-3 text-sm no-underline",
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
    </div>
  );
}
