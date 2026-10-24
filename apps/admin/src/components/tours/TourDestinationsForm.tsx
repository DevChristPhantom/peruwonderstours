"use client";

import Link from "next/link";
import { useState } from "react";

import { updateTourDestinationsAction } from "@/app/(panel)/tours/actions";
import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import type { TaxonomyItem } from "@/lib/api/content-types";
import type { TourDetail } from "@/lib/api/types";

/** Texto corto que el sitio muestra en «Sobre el lugar» (descripción del destino en español). */
function placeText(d: TaxonomyItem): string {
  return d.translations.find((t) => t.locale === "es")?.description?.trim() ?? "";
}

function placeName(d: TaxonomyItem): string {
  return d.translations.find((t) => t.locale === "es")?.name ?? d.slug;
}

/**
 * Destinos del tour. El principal encabeza «Sobre el lugar» en la ficha pública y define la
 * miga de pan; el resto se muestra como «También visitarás».
 */
export function TourDestinationsForm({ tour, destinations, readOnly }: { tour: TourDetail; destinations: TaxonomyItem[]; readOnly: boolean }) {
  const initial = [...tour.destinations].sort((a, b) => a.sortOrder - b.sortOrder);
  const [selected, setSelected] = useState<string[]>(initial.map((d) => d.destinationId));
  const [primary, setPrimary] = useState<string>(initial.find((d) => d.isPrimary)?.destinationId ?? initial[0]?.destinationId ?? "");
  const effectivePrimary = selected.includes(primary) ? primary : (selected[0] ?? "");

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  if (destinations.length === 0) {
    return (
      <Alert tone="warning">
        No hay destinos creados. <Link href="/destinos/nuevo">Crea un destino</Link> para poder asignarlo.
      </Alert>
    );
  }

  return (
    <ActionForm action={updateTourDestinationsAction.bind(null, tour.id, tour.version)} className="space-y-3">
      {selected.length === 0 ? (
        <Alert tone="warning">Este tour no tiene destino: su ficha no muestra «Sobre el lugar» y no aparece al filtrar por destino.</Alert>
      ) : null}
      <fieldset disabled={readOnly} className="grid gap-2 md:grid-cols-2">
        <legend className="sr-only">Destinos del tour</legend>
        {destinations.map((d) => {
          const checked = selected.includes(d.id);
          const text = placeText(d);
          const name = placeName(d);
          return (
            <div key={d.id} className={`rounded-lg border p-3 ${checked ? "border-primary bg-surface-muted" : "border-border"}`}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="destinationIds" value={d.id} checked={checked} onChange={(e) => toggle(d.id, e.target.checked)} className="size-5" />
                  {name}
                </label>
                {checked ? (
                  <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs">
                    <input type="radio" name="primaryDestinationId" value={d.id} checked={effectivePrimary === d.id} onChange={() => setPrimary(d.id)} className="size-4" />
                    Principal
                  </label>
                ) : null}
                {d.status !== "published" ? <Badge tone="warning">Borrador</Badge> : null}
              </div>
              <p className={`mt-1 text-xs ${text ? "text-foreground-muted" : "text-warning"}`}>
                {text ? (text.length > 160 ? `${text.slice(0, 160)}…` : text) : "Sin descripción del lugar: la ficha no mostrará «Sobre el lugar» para este destino."}{" "}
                <Link href={`/destinos/${d.id}?pestana=es`} className="whitespace-nowrap">
                  Editar texto del lugar
                </Link>
              </p>
            </div>
          );
        })}
      </fieldset>
      {!readOnly ? (
        <SubmitButton variant="secondary" pendingLabel="Guardando…">
          Guardar destinos
        </SubmitButton>
      ) : null}
    </ActionForm>
  );
}
