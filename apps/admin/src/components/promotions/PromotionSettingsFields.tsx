"use client";

import { useState } from "react";

import { Field } from "@/components/forms/Field";
import { ImageUploader } from "@/components/media/ImageUploader";
import type { Promotion, PromotionCtaKind } from "@/lib/api/content-types";
import { instantToLimaDay } from "@/lib/schemas/promotions";

export interface TourOption {
  id: string;
  title: string;
  published: boolean;
}

const KINDS: { value: PromotionCtaKind; label: string; hint: string }[] = [
  { value: "tour", label: "Un paquete o tour", hint: "Lleva a la ficha para reservar." },
  { value: "page", label: "Una página del sitio", hint: "P. ej. todos los tours en Puno." },
  { value: "whatsapp", label: "WhatsApp", hint: "Abre el chat con un mensaje listo." },
];

/**
 * Configuración del evento: fechas, imagen, a dónde lleva el botón y si sale como anuncio al entrar.
 * Solo los campos del tipo de botón elegido se envían (el resto se limpia al guardar).
 */
export function PromotionSettingsFields({
  promotion,
  tours,
  mediaUrl,
  canUpload,
}: {
  promotion?: Promotion;
  tours: TourOption[];
  mediaUrl: string | null;
  canUpload: boolean;
}) {
  const [kind, setKind] = useState<PromotionCtaKind>(promotion?.ctaKind ?? "whatsapp");
  const p = promotion;

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿A dónde lleva el botón?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <label key={k.value} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${kind === k.value ? "border-primary bg-surface-muted" : "border-border"}`}>
              <input type="radio" name="ctaKind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-0.5 size-4" />
              <span>
                <span className="block font-medium">{k.label}</span>
                <span className="block text-xs text-foreground-muted">{k.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "tour" ? (
        <Field label="Paquete o tour" name="tourId" required hint="Para publicar el evento, el paquete debe estar publicado.">
          <select className="field-input" defaultValue={p?.tourId ?? ""}>
            <option value="">Elige un paquete…</option>
            {tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.published ? "" : " (borrador)"}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {kind === "page" ? (
        <Field label="Página del sitio" name="ctaPath" required hint="Copia la dirección de la página en español; se acepta con o sin el dominio. Ej.: /destinos/tours-en-puno">
          <input className="field-input font-mono" maxLength={300} defaultValue={p?.ctaPath ?? ""} placeholder="/destinos/tours-en-puno" autoComplete="off" />
        </Field>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <fieldset className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">Fechas del evento</legend>
          <Field label="Primer día" name="eventStartsOn" hint="Se muestra en la tarjeta.">
            <input type="date" className="field-input" defaultValue={p?.eventStartsOn ?? ""} />
          </Field>
          <Field label="Último día" name="eventEndsOn">
            <input type="date" className="field-input" defaultValue={p?.eventEndsOn ?? ""} />
          </Field>
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">¿Cuándo se muestra en el sitio?</legend>
          <Field label="Desde" name="showFrom" hint="Vacío = desde que se publica.">
            <input type="date" className="field-input" defaultValue={instantToLimaDay(p?.startsAt ?? null)} />
          </Field>
          <Field label="Hasta (incluido)" name="showUntil" hint="Vacío = sin fin. Al terminar se oculta solo.">
            <input type="date" className="field-input" defaultValue={instantToLimaDay(p?.endsAt ?? null, true)} />
          </Field>
        </fieldset>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm">
          <input type="checkbox" name="showPopup" defaultChecked={p?.showPopup ?? false} className="mt-0.5 size-5" />
          <span>
            <span className="block font-medium">Mostrar como anuncio al entrar a la portada</span>
            <span className="block text-xs text-foreground-muted">
              Aparece a los 3 segundos. Si el visitante lo cierra, no vuelve a salir en 24 horas. Si hay varios, se muestra el de menor orden.
            </span>
          </span>
        </label>
        <Field label="Orden" name="sortOrder" hint="Menor = primero.">
          <input inputMode="numeric" className="field-input w-28" defaultValue={String(p?.sortOrder ?? 0)} />
        </Field>
      </div>

      <ImageUploader
        name="coverStorageKey"
        folder="promotions"
        label="Imagen del evento"
        initial={p?.coverStorageKey ? { storageKey: p.coverStorageKey, url: mediaUrl ?? p.coverStorageKey } : null}
        canUpload={canUpload}
      />
    </div>
  );
}
