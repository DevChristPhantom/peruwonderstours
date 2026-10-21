import { LogOut, Menu, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { logoutAction } from "@/app/login/actions";
import { NavLinks, type NavItem } from "@/components/layout/NavLinks";
import { buttonClass } from "@/components/ui/styles";
import { can, requireSession } from "@/lib/auth/guard";
import { ROLE_LABELS, type Permission } from "@/lib/auth/permissions";

const NAV: (NavItem & { perm?: Permission })[] = [
  { key: "tablero", href: "/", label: "Tablero", perm: "dashboard:read" },
  { key: "reservas", href: "/reservas", label: "Reservas", perm: "bookings:read" },
  { key: "pagos-manuales", href: "/pagos-manuales", label: "Pagos manuales", perm: "dashboard:read" },
  { key: "reclamos", href: "/reclamos", label: "Libro de Reclamaciones", perm: "complaints:read" },
  { key: "contacto", href: "/contacto", label: "Mensajes de contacto", perm: "contact:read" },
  { key: "tours", href: "/tours", label: "Tours", perm: "tours:read" },
  { key: "precios", href: "/precios", label: "Precios", perm: "pricing:read" },
  { key: "salidas", href: "/salidas", label: "Salidas y cupos", perm: "departures:read" },
  { key: "destinos", href: "/destinos", label: "Destinos", perm: "content:read" },
  { key: "categorias", href: "/categorias", label: "Categorías", perm: "content:read" },
  { key: "blog", href: "/blog", label: "Blog", perm: "content:read" },
  { key: "banners", href: "/banners", label: "Banners de inicio", perm: "tours:read" },
  { key: "testimonios", href: "/testimonios", label: "Testimonios", perm: "content:read" },
  { key: "privacidad", href: "/privacidad", label: "Protección de datos", perm: "privacy:read" },
  { key: "auditoria", href: "/auditoria", label: "Auditoría", perm: "audit:read" },
  { key: "usuarios", href: "/usuarios", label: "Usuarios", perm: "users:manage" },
  { key: "cuenta", href: "/cuenta", label: "Mi cuenta" },
];

/**
 * Marco del panel. El menú se arma con `user.permissions` (solo oculta opciones): la API valida
 * cada petición y responde 403 si falta el permiso.
 */
export default async function PanelLayout({ children }: LayoutProps<"/">) {
  await connection();
  const session = await requireSession();
  const items = NAV.filter((n) => !n.perm || can(session, n.perm)).map((n): NavItem => ({ key: n.key, href: n.href, label: n.label }));
  const nav = (
    <nav aria-label="Secciones del panel">
      <NavLinks items={items} />
    </nav>
  );

  return (
    <div className="admin-shell min-h-dvh lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="border-b border-border px-5 py-6">
          <Link href="/" className="block text-sm font-semibold text-foreground no-underline">
            <Image src="/brand/peruwonderstours-dorado.png" alt="peruwonderstours.com" width={2171} height={724} sizes="212px" className="block h-auto w-full max-w-[212px]" preload />
            <span className="mt-1 block text-xs font-normal text-foreground-muted">Panel de administración</span>
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">{nav}</div>
      </aside>

      <div className="min-w-0">
        <header className="admin-topbar sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:px-7">
          <details className="relative shrink-0 lg:hidden">
            <summary className={buttonClass("outline", "sm", "list-none")}>
              <Menu aria-hidden size={18} /> Menú
            </summary>
            <div className="absolute left-0 z-30 mt-2 max-h-[calc(100dvh-100px)] w-[min(288px,calc(100vw-32px))] overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-lg">{nav}</div>
          </details>
          <p className="hidden min-w-0 truncate text-sm font-semibold lg:block">Administración <span className="ml-2 font-normal text-foreground-muted">/ peruwonderstours</span></p>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/cuenta"
              title={`${session.user.fullName} · ${ROLE_LABELS[session.user.role] ?? session.user.role}`}
              className="flex min-h-11 min-w-11 max-w-[min(50vw,22rem)] items-center gap-2.5 rounded-lg border border-transparent p-1 text-foreground no-underline hover:border-border hover:bg-surface-muted sm:px-2"
            >
              {/* Nombre accesible = texto visible (WCAG 2.5.3); en móvil el nombre solo lo oye el lector. */}
              <span className="sr-only">Mi cuenta: </span>
              <span className="sr-only sm:hidden">{session.user.fullName}</span>
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-primary">
                <UserRound size={19} strokeWidth={1.75} />
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block truncate text-sm font-semibold leading-5">{session.user.fullName} </span>
                <span className="mt-0.5 inline-flex max-w-full truncate rounded-pill border border-border bg-surface-muted px-2 py-0.5 text-xs leading-4 text-foreground-muted">{ROLE_LABELS[session.user.role] ?? session.user.role}</span>
              </span>
            </Link>
            <form action={logoutAction} className="shrink-0">
              <button type="submit" className={buttonClass("outline", "md")}>
                <LogOut aria-hidden size={16} /> Salir
              </button>
            </form>
          </div>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-7 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
