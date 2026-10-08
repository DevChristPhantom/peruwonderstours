"use client";

import { Heart, HeartOff, Info, Link2, Share2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import { parseSharedSlugs, SHARE_PARAM, sharePath } from "@/lib/wishlist/share";
import { useUiStore } from "@/stores/ui-store";
import {
  usePersistentFavorites,
  useWishlistHydrated,
  useWishlistStore,
  type FavoriteEntry,
} from "@/stores/wishlist-store";
import { buttonClass } from "@/components/ui/button-styles";

export interface FavoriteCatalogEntry {
  slug: string;
  title: string;
  destinationSlugs: string[];
  categorySlugs: string[];
  featured: boolean;
}

interface FavoritesViewProps {
  catalog: FavoriteCatalogEntry[];
  /** Tarjetas renderizadas en el servidor, por slug. */
  cards: Record<string, ReactNode>;
}

/** Similares para un tour despublicado: mismo destino primero, luego destacados. */
function similarTo(
  entry: Pick<FavoriteEntry, "slug" | "destinationSlugs">,
  catalog: FavoriteCatalogEntry[],
  exclude: Set<string>,
  limit = 2,
): FavoriteCatalogEntry[] {
  return catalog
    .filter((t) => !exclude.has(t.slug) && t.slug !== entry.slug)
    .map((t) => ({
      t,
      score: t.destinationSlugs.filter((d) => entry.destinationSlugs.includes(d)).length * 2 + (t.featured ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t);
}

function UnavailableItem({
  title,
  similar,
  onRemove,
}: {
  title: string | null;
  similar: FavoriteCatalogEntry[];
  onRemove?: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-dashed border-border-strong bg-surface p-5">
      <p className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-surface-muted px-3 py-1 text-sm text-foreground-muted">
        <HeartOff aria-hidden size={16} strokeWidth={1.5} />
        Ya no disponible
      </p>
      <h3 className="mt-3 text-h4 font-medium">{title ?? "Un tour de esta lista"}</h3>
      <p className="mt-1 text-sm text-foreground-muted">Este tour ya no se ofrece. Te sugerimos tours parecidos:</p>
      {similar.length ? (
        <ul className="mt-3 space-y-1">
          {similar.map((t) => (
            <li key={t.slug}>
              <Link href={`/es/tours/${t.slug}`} className="pwt-link inline-flex min-h-11 items-center">
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {onRemove ? (
        <button type="button" className={buttonClass("ghost", "md", "mt-auto w-fit")} onClick={onRemove}>
          Quitar de favoritos
        </button>
      ) : null}
    </article>
  );
}

export function FavoritesView({ catalog, cards }: FavoritesViewProps) {
  const id = useId();
  const params = useSearchParams();
  const shared = useMemo(() => parseSharedSlugs(params.get(SHARE_PARAM)), [params]);
  const hydrated = useWishlistHydrated();
  const items = useWishlistStore((s) => s.items);
  const remove = useWishlistStore((s) => s.remove);
  const addMany = useWishlistStore((s) => s.addMany);
  const persistent = usePersistentFavorites();
  const announce = useUiStore((s) => s.announce);
  const showToast = useUiStore((s) => s.showToast);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const shareInputRef = useRef<HTMLInputElement>(null);
  const bySlug = useMemo(() => new Map(catalog.map((t) => [t.slug, t])), [catalog]);

  const isShared = shared.length > 0;
  const savedSlugs = new Set(items.map((i) => i.slug));

  if (!hydrated && !isShared) {
    return (
      <div aria-busy="true" className="mt-6">
        <div className="h-10 w-56 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none" />
        <span className="sr-only">Cargando tus favoritos…</span>
      </div>
    );
  }

  /* ---------- Lista compartida por enlace ---------- */
  if (isShared) {
    const available = shared.filter((s) => bySlug.has(s));
    const missing = shared.filter((s) => !bySlug.has(s));
    const exclude = new Set(shared);
    const notSaved = available.filter((s) => !savedSlugs.has(s));
    return (
      <div className="mt-4">
        <h1 className="font-display text-h1 font-medium">Lista de tours compartida</h1>
        <p className="mt-2 max-w-prose text-foreground-muted">
          Alguien compartió contigo {shared.length} {shared.length === 1 ? "tour" : "tours"}. El enlace solo contiene los
          tours, ningún dato personal.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {notSaved.length ? (
            <button
              type="button"
              className={buttonClass("secondary", "md")}
              onClick={() => {
                const added = addMany(
                  notSaved.map((slug) => {
                    const t = bySlug.get(slug)!;
                    return { slug, title: t.title, destinationSlugs: t.destinationSlugs };
                  }),
                );
                announce(`Guardaste ${added} ${added === 1 ? "tour" : "tours"} en tus favoritos.`);
                showToast({ message: "Guardados en tus favoritos", action: { label: "Ver mis favoritos", href: "/es/favoritos" } });
              }}
            >
              <Heart aria-hidden size={18} strokeWidth={1.5} />
              Guardar en mis favoritos
            </button>
          ) : null}
          <Link href="/es/favoritos" className={buttonClass("outline", "md")}>
            Ver mis favoritos
          </Link>
        </div>
        <ul className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {available.map((slug, i) => (
            <li key={slug} className="pwt-stagger-in" style={{ ["--i" as string]: i }}>
              {cards[slug]}
            </li>
          ))}
          {missing.map((slug) => (
            <li key={slug}>
              <UnavailableItem
                title={null}
                similar={similarTo({ slug, destinationSlugs: [] }, catalog, exclude)}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ---------- Mis favoritos (este navegador) ---------- */
  const onShare = async () => {
    const url = new URL(sharePath(items.map((i) => i.slug)), window.location.origin).toString();
    const text = "Mira estos tours que guardé en Peru Wonders Tours";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Mis tours favoritos", text, url });
        announce("Lista compartida.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareUrl(url);
      announce("Enlace copiado. Pégalo para compartir tu lista.");
      showToast({ message: "Enlace copiado: solo incluye los tours, sin datos personales." });
    } catch (error) {
      // Cancelado por el usuario o portapapeles bloqueado: se muestra el enlace para copiarlo a mano.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareUrl(url);
      requestAnimationFrame(() => shareInputRef.current?.select());
      announce("No pudimos copiar el enlace. Cópialo del campo de texto.");
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-medium">Mis favoritos</h1>
          <p className="mt-2 text-foreground-muted">
            {items.length
              ? `${items.length} ${items.length === 1 ? "tour guardado" : "tours guardados"} en este navegador.`
              : "Guarda tours con el corazón para decidir con calma."}
          </p>
        </div>
        {items.length ? (
          <button type="button" className={buttonClass("secondary", "md")} onClick={onShare}>
            <Share2 aria-hidden size={18} strokeWidth={1.5} />
            Compartir mi lista
          </button>
        ) : null}
      </div>

      {persistent === false ? (
        <p className="mt-5 flex gap-2 rounded-md bg-warning-soft p-4 text-sm text-warning" role="status">
          <Info aria-hidden size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          Tu navegador no permite guardar datos (por ejemplo, en modo privado): tus favoritos funcionan mientras tengas
          esta pestaña abierta, pero no se conservarán al cerrarla. Comparte tu lista para no perderla.
        </p>
      ) : null}

      {shareUrl ? (
        <div className="mt-5 max-w-xl">
          <label htmlFor={`${id}-share`} className="flex items-center gap-2 text-sm font-medium">
            <Link2 aria-hidden size={16} strokeWidth={1.5} />
            Enlace para compartir (sin datos personales)
          </label>
          <input
            ref={shareInputRef}
            id={`${id}-share`}
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 block min-h-12 w-full rounded-md border border-border-strong bg-surface px-3 text-body"
          />
        </div>
      ) : null}

      {items.length ? (
        <ul className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((entry, i) => (
            <li key={entry.slug} className="pwt-stagger-in" style={{ ["--i" as string]: i }}>
              {bySlug.has(entry.slug) ? (
                cards[entry.slug]
              ) : (
                <UnavailableItem
                  title={entry.title}
                  similar={similarTo(entry, catalog, savedSlugs)}
                    onRemove={() => {
                    remove(entry.slug);
                    announce(`Quitaste ${entry.title} de favoritos.`);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-14 text-center">
          <Heart aria-hidden size={32} strokeWidth={1.5} className="text-foreground-muted" />
          <h2 className="mt-4 text-h3 font-medium">Aún no guardaste tours</h2>
          <p className="mt-2 max-w-prose text-foreground-muted">
            Pulsa el corazón en cualquier tour para guardarlo aquí y compartir la lista con quien viaja contigo.
          </p>
          <Link href="/es/tours" className={buttonClass("secondary", "lg", "mt-6")}>
            Ver tours
          </Link>
        </div>
      )}
    </div>
  );
}
