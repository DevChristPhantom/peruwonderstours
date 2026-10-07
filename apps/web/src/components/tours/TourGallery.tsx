"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CatalogImage } from "@/lib/catalog/types";

/**
 * Galería (tour-detalle.md §3): 1 grande + 4 miniaturas (≥ 1024), carrusel en móvil y visor modal
 * con teclado (← → Esc) y contador "3 de 18".
 */
export function TourGallery({ images, title }: { images: CatalogImage[]; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const total = images.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + total) % total), [total]);

  const openAt = (i: number, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setIndex(i);
    dialogRef.current?.showModal();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const onClose = () => openerRef.current?.focus();
    dialog.addEventListener("keydown", onKey);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("close", onClose);
    };
  }, [go]);

  if (!total) return null;
  const [main, ...rest] = images;
  const thumbs = rest.slice(0, 4);

  return (
    <div>
      {/* Desktop/tablet: grid */}
      <div className="hidden gap-2 md:grid md:h-[420px] md:grid-cols-[2fr_1fr] lg:h-[480px] lg:grid-cols-[2fr_1fr_1fr]">
        <button
          type="button"
          className="relative overflow-hidden rounded-l-lg bg-surface-muted md:row-span-2"
          onClick={(e) => openAt(0, e.currentTarget)}
          aria-label={`Ampliar foto 1 de ${total}`}
          data-reveal-clip
        >
          <Image src={main.src} alt={main.alt} fill preload sizes="(min-width: 1024px) 640px, 66vw" className="object-cover" />
        </button>
        {thumbs.map((img, i) => (
          <button
            key={img.src}
            type="button"
            className={`relative overflow-hidden bg-surface-muted ${i >= 2 ? "hidden lg:block" : ""} ${i === 1 ? "md:rounded-br-lg lg:rounded-none lg:rounded-tr-lg" : ""} ${i === 3 ? "lg:rounded-br-lg" : ""}`}
            onClick={(e) => openAt(i + 1, e.currentTarget)}
            aria-label={`Ampliar foto ${i + 2} de ${total}`}
          >
            <Image src={img.src} alt={img.alt} fill sizes="320px" className="object-cover transition-transform duration-[900ms] ease-out hover:scale-105" />
          </button>
        ))}
      </div>

      {/* Móvil: carrusel a sangre 4:3 */}
      <div className="relative -mx-4 md:hidden">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
          <Image src={images[mobileIndex].src} alt={images[mobileIndex].alt} fill loading={mobileIndex === 0 ? "eager" : "lazy"} sizes="100vw" className="object-cover" />
        </div>
        <p className="absolute top-3 right-3 rounded-pill bg-hero-panel px-3 py-1 text-sm text-white" aria-live="polite">
          {mobileIndex + 1} de {total}
        </p>
        <div className="absolute inset-x-3 bottom-3 flex justify-between">
          <button
            type="button"
            onClick={() => setMobileIndex((i) => (i - 1 + total) % total)}
            aria-label="Foto anterior"
            className="inline-flex size-11 items-center justify-center rounded-pill bg-hero-panel text-white"
          >
            <ChevronLeft aria-hidden size={20} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setMobileIndex((i) => (i + 1) % total)}
            aria-label="Foto siguiente"
            className="inline-flex size-11 items-center justify-center rounded-pill bg-hero-panel text-white"
          >
            <ChevronRight aria-hidden size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {total > 1 ? (
        <button
          type="button"
          onClick={(e) => openAt(0, e.currentTarget)}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-link underline underline-offset-2"
        >
          <Images aria-hidden size={18} strokeWidth={1.5} />
          Ver las {total} fotos
        </button>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={`Fotos de ${title}`}
        className="pwt-modal m-auto h-full max-h-none w-full max-w-none bg-hero-ink p-0 text-white backdrop:bg-overlay"
        data-lenis-prevent
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <p aria-live="polite" className="tabular text-sm">
              {index + 1} de {total}
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Cerrar visor"
              className="inline-flex size-11 items-center justify-center rounded-pill hover:bg-hero-hover"
              autoFocus
            >
              <X aria-hidden size={22} strokeWidth={1.5} />
            </button>
          </div>
          <div className="relative flex-1">
            <Image key={images[index].src} src={images[index].src} alt={images[index].alt} fill sizes="100vw" className="object-contain" />
          </div>
          <div className="flex justify-center gap-4 p-4">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="inline-flex size-11 items-center justify-center rounded-pill border border-[color:var(--pwt-hero-line)] hover:bg-hero-hover"
            >
              <ChevronLeft aria-hidden size={22} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Foto siguiente"
              className="inline-flex size-11 items-center justify-center rounded-pill border border-[color:var(--pwt-hero-line)] hover:bg-hero-hover"
            >
              <ChevronRight aria-hidden size={22} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
