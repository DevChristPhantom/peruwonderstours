import { LogOut, Menu } from "lucide-react";
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
  { key: "reclamos", href: "/reclamos", label: "Libro de Reclamaciones", perm: "complaints:read" },
  { key: "tours", href: "/tours", label: "Tours", perm: "tours:read" },
  { key: "precios", href: "/precios", label: "Precios", perm: "pricing:read" },
  { key: "salidas", href: "/salidas", label: "Salidas y cupos", perm: "departures:read" },
  { key: "privacidad", href: "/privacidad", label: "Protección de datos", perm: "privacy:read" },
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
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface lg:flex lg:min-h-dvh lg:flex-col">
        <div className="border-b border-border px-4 py-3">
          <Link href="/" className="block text-sm font-semibold text-foreground no-underline">
            Peru Wonders Tours
            <span className="block text-xs font-normal text-foreground-muted">Panel de administración</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-2">{nav}</div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
          <details className="relative lg:hidden">
            <summary className={buttonClass("outline", "sm", "list-none")}>
              <Menu aria-hidden size={18} /> Menú
            </summary>
            <div className="absolute left-0 z-30 mt-2 w-64 rounded-md border border-border bg-surface p-2 shadow-lg">{nav}</div>
          </details>
          <p className="hidden text-sm font-semibold lg:block">Panel</p>
          <div className="flex items-center gap-2">
            <Link href="/cuenta" className="hidden text-right text-xs leading-tight text-foreground no-underline sm:block">
              <span className="block font-medium">{session.user.fullName}</span>
              <span className="text-foreground-muted">{ROLE_LABELS[session.user.role] ?? session.user.role}</span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass("outline", "sm")}>
                <LogOut aria-hidden size={16} /> Salir
              </button>
            </form>
          </div>
        </header>
        <main id="contenido" className="mx-auto w-full max-w-[1400px] px-4 py-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
