"use client";

import clsx from "clsx";
import { Heart } from "lucide-react";
import { useState } from "react";

import { canPersistFavorites, useIsFavorite, useWishlistStore } from "@/stores/wishlist-store";
import { useUiStore } from "@/stores/ui-store";
import { buttonClass } from "@/components/ui/button-styles";

interface FavoriteButtonProps {
  slug: string;
  title: string;
  destinationSlugs: string[];
  /** `card`: botón redondo sobre la foto de la tarjeta. `inline`: botón con texto (ficha). */
  variant?: "card" | "inline";
  className?: string;
}

let warnedNoStorage = false;

/** Corazón de favoritos (HU-B.A4). Botón conmutador accesible (`aria-pressed`), objetivo de 44 px. */
export function FavoriteButton({ slug, title, destinationSlugs, variant = "card", className }: FavoriteButtonProps) {
  const active = useIsFavorite(slug);
  const toggle = useWishlistStore((s) => s.toggle);
  const announce = useUiStore((s) => s.announce);
  const showToast = useUiStore((s) => s.showToast);
  const [pop, setPop] = useState(0);

  const onClick = () => {
    const added = toggle({ slug, title, destinationSlugs });
    if (added) setPop((n) => n + 1);
    const count = useWishlistStore.getState().items.length;
    const persistent = canPersistFavorites();
    announce(
      added
        ? `Guardaste ${title} en favoritos. Tienes ${count} ${count === 1 ? "favorito" : "favoritos"}.`
        : `Quitaste ${title} de favoritos.`,
    );
    if (added && !persistent && !warnedNoStorage) {
      warnedNoStorage = true;
      showToast({
        message: "Tu navegador no permite guardar datos: tus favoritos se perderán al cerrarlo.",
        duration: 8000,
        action: { label: "Ver favoritos", href: "/es/favoritos" },
      });
    } else if (added) {
      showToast({ message: "Guardado en favoritos", action: { label: "Ver favoritos", href: "/es/favoritos" } });
    }
  };

  // Etiqueta fija + aria-pressed (patrón de botón conmutador): el estado lo anuncia "presionado".
  const label = `Guardar ${title} en favoritos`;
  const icon = (
    <span key={pop} className={pop ? "pwt-heart-pop inline-flex" : "inline-flex"}>
      <Heart aria-hidden size={20} strokeWidth={1.5} fill={active ? "currentColor" : "none"} />
    </span>
  );

  if (variant === "inline") {
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={buttonClass("outline", "md", clsx(active && "border-accent text-accent", className))}
      >
        {icon}
        {/* Texto fijo (2.5.3 Label in Name); el estado lo comunican aria-pressed y el relleno. */}
        Guardar en favoritos
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={active ? "Quitar de favoritos" : "Guardar en favoritos"}
      onClick={onClick}
      className={clsx(
        "relative z-[2] inline-flex size-11 items-center justify-center rounded-pill bg-surface/95 shadow-xs",
        "transition-[background-color,color,transform] duration-150 hover:bg-surface active:scale-95",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "text-accent" : "text-foreground",
        className,
      )}
    >
      {icon}
    </button>
  );
}
