import { buttonClass } from "@/components/ui/styles";
import type { TourListItem } from "@/lib/api/types";

/** Selector de tour por GET (`?tourId=`), enlazable y sin JS. */
export function TourPicker({ tours, selected, extra }: { tours: TourListItem[]; selected?: string; extra?: React.ReactNode }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3" aria-label="Elegir tour">
      <label className="min-w-64 flex-1 text-xs font-medium">
        Tour
        <select name="tourId" defaultValue={selected ?? ""} className="field-input mt-1" required>
          <option value="" disabled>
            Elige un tour…
          </option>
          {tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title ?? t.slug} ({t.code}){t.status !== "published" ? " · borrador" : ""}
            </option>
          ))}
        </select>
      </label>
      {extra}
      <button type="submit" className={buttonClass("secondary")}>
        Ver
      </button>
    </form>
  );
}
