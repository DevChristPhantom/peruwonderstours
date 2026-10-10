"use client";

import clsx from "clsx";
import { Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { localePath } from "@/i18n/paths";

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
  const t = useTranslations("favorites.button");
  const locale = useLocale();
  const favoritesHref = localePath(locale, "/favoritos");

  const onClick = () => {
    const added = toggle({ slug, title, destinationSlugs });
    if (added) setPop((n) => n + 1);
    const count = useWishlistStore.getState().items.length;
    const persistent = canPersistFavorites();
    announce(added ? t("announceAdded", { title, count }) : t("announceRemoved", { title }));
    if (added && !persistent && !warnedNoStorage) {
      warnedNoStorage = true;
      showToast({
        message: t("noStorage"),
        duration: 8000,
        action: { label: t("view"), href: favoritesHref },
      });
    } else if (added) {
      showToast({ message: t("saved"), action: { label: t("view"), href: favoritesHref } });
    }
  };

  // Etiqueta fija + aria-pressed (patrón de botón conmutador): el estado lo anuncia "presionado".
  const label = t("label", { title });
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
        {t("inline")}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={active ? t("removeTitle") : t("inline")}
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
