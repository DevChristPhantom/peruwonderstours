import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { TourPicker } from "@/components/tours/TourPicker";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { api, apiData, type Paged } from "@/lib/api/client";
import type { Departure, TourListItem } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { addDaysIso, formatDate, formatWeekday, todayInLima } from "@/lib/format";
import { WEEKDAYS } from "@/lib/labels";

import { bulkDeparturesAction, deleteDepartureAction, toggleSalesAction, updateCapacityAction } from "./actions";

export const metadata: Metadata = { title: "Salidas y cupos" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DeparturesPage({ searchParams }: PageProps<"/salidas">) {
  const session = await requireSession();
  const sp = await searchParams;
  const tourId = one(sp.tourId) && /^[0-9a-f-]{36}$/i.test(one(sp.tourId)!) ? one(sp.tourId) : undefined;
  const today = todayInLima();
  const from = one(sp.from) && DATE.test(one(sp.from)!) ? one(sp.from)! : today;
  const to = one(sp.to) && DATE.test(one(sp.to)!) ? one(sp.to)! : addDaysIso(from, 90);
  const canWrite = can(session, "departures:write");

  const [tours, departures] = await Promise.all([
    load(() => api<Paged<TourListItem>>("/admin/tours", { query: { page: 1, pageSize: 100 } })),
    tourId ? load(() => apiData<Departure[]>(`/admin/tours/${tourId}/departures`, { query: { from, to } })) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Salidas y cupos" description="Genera salidas en lote, ajusta la capacidad (nunca por debajo de lo vendido + retenido) y cierra ventas." />
      {tours.ok ? (
        <TourPicker
          tours={tours.data.data}
          selected={tourId}
          extra={
            <>
              <label className="text-xs font-medium">
                Desde
                <input type="date" name="from" defaultValue={from} className="field-input mt-1" />
              </label>
              <label className="text-xs font-medium">
                Hasta
                <input type="date" name="to" defaultValue={to} className="field-input mt-1" />
              </label>
            </>
          }
        />
      ) : (
        <ErrorPanel error={tours.error} />
      )}

      {!tourId ? (
        <EmptyState>Elige un tour para ver sus salidas.</EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Section title="Salidas" id="salidas" description={`${formatDate(from)} – ${formatDate(to)}`}>
            {departures && !departures.ok ? (
              <ErrorPanel error={departures.error} />
            ) : departures && departures.data.length === 0 ? (
              <EmptyState>Sin salidas en el rango.</EmptyState>
            ) : departures ? (
              <TableWrap label="Salidas del tour">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col" className="num">
                        Vendidos
                      </th>
                      <th scope="col" className="num">
                        Retenidos
                      </th>
                      <th scope="col" className="num">
                        Disponibles
                      </th>
                      <th scope="col">Capacidad</th>
                      <th scope="col">Ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departures.data.map((d) => (
                      <tr key={d.id}>
                        <td className="whitespace-nowrap">
                          {formatWeekday(d.departureDate)} {formatDate(d.departureDate)}
                          {d.startTime !== "00:00" ? <span className="text-foreground-muted"> {d.startTime}</span> : null}
                        </td>
                        <td className="num">{d.booked}</td>
                        <td className="num">{d.held}</td>
                        <td className="num font-medium">{d.available}</td>
                        <td>
                          {canWrite ? (
                            <ActionForm showSuccess={false} action={updateCapacityAction.bind(null, d.id, d.version)} className="flex items-start gap-1 space-y-0">
                              <label className="sr-only" htmlFor={`cap-${d.id}`}>
                                Capacidad del {formatDate(d.departureDate)}
                              </label>
                              <input id={`cap-${d.id}`} name="capacity" inputMode="numeric" defaultValue={d.capacity} className="field-input min-h-9 w-20 py-1" />
                              <SubmitButton variant="outline" size="sm" pendingLabel="…">
                                Guardar
                              </SubmitButton>
                            </ActionForm>
                          ) : (
                            d.capacity
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1">
                            {d.isClosed ? <Badge>Cerradas</Badge> : <Badge tone="success">Abiertas</Badge>}
                            {canWrite ? (
                              <ActionForm showSuccess={false} action={toggleSalesAction.bind(null, d.id, d.version, !d.isClosed)}>
                                <SubmitButton variant="outline" size="sm">
                                  {d.isClosed ? "Reabrir" : "Cerrar ventas"}
                                </SubmitButton>
                              </ActionForm>
                            ) : null}
                            {canWrite && d.booked + d.held === 0 ? (
                              <ActionForm action={deleteDepartureAction.bind(null, d.id, d.version)} confirm="¿Eliminar esta salida? Solo es posible sin ventas.">
                                <SubmitButton variant="danger" size="sm">
                                  Eliminar
                                </SubmitButton>
                              </ActionForm>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : null}
          </Section>

          {canWrite ? (
            <Section title="Generar salidas en lote" id="lote" description="Las fechas que ya existen a la misma hora se omiten.">
              <ActionForm action={bulkDeparturesAction.bind(null, tourId)}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Desde" name="from" required>
                    <input type="date" className="field-input" defaultValue={today} min={today} />
                  </Field>
                  <Field label="Hasta" name="to" hint="Máx. 366 días." required>
                    <input type="date" className="field-input" defaultValue={addDaysIso(today, 90)} />
                  </Field>
                </div>
                <fieldset>
                  <legend className="mb-1 text-sm font-medium">Días de la semana</legend>
                  <div className="grid grid-cols-4 gap-1">
                    {WEEKDAYS.map((w) => (
                      <label key={w.value} className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-sm border border-border px-2 text-sm">
                        <input type="checkbox" name="weekdays" value={w.value} defaultChecked className="size-4" />
                        <abbr title={w.label} className="no-underline">
                          {w.short}
                        </abbr>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Hora (Lima)" name="startTime" hint="Vacío = sin hora fija.">
                    <input type="time" className="field-input" />
                  </Field>
                  <Field label="Capacidad" name="capacity" required>
                    <input inputMode="numeric" className="field-input" defaultValue="16" />
                  </Field>
                </div>
                <SubmitButton variant="primary" pendingLabel="Generando…">
                  Generar salidas
                </SubmitButton>
              </ActionForm>
            </Section>
          ) : null}
        </div>
      )}
    </>
  );
}
