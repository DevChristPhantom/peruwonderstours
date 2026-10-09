import type { Metadata } from "next";

import { ActionForm, SubmitButton } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { TourPicker } from "@/components/tours/TourPicker";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { EmptyState, PageHeader, Section, TableWrap } from "@/components/ui/Layout";
import { api, apiData, type Paged } from "@/lib/api/client";
import type { Rate, Season, TourListItem } from "@/lib/api/types";
import { can, load, requireSession } from "@/lib/auth/guard";
import { formatDate, formatMoney, todayInLima } from "@/lib/format";
import { PAX_TYPE, RESIDENCY, label } from "@/lib/labels";

import { createRateAction, createSeasonAction, deleteRateAction, deleteSeasonAction, setRateActiveAction, updateSeasonAction } from "./actions";

export const metadata: Metadata = { title: "Precios" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

function SeasonFields({ s }: { s?: Season }) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      <Field label="Código" name="code" required>
        <input className="field-input font-mono uppercase" defaultValue={s?.code} maxLength={40} />
      </Field>
      <Field label="Nombre" name="name" required>
        <input className="field-input" defaultValue={s?.name} maxLength={120} />
      </Field>
      <Field label="Inicio" name="startDate" required>
        <input type="date" className="field-input" defaultValue={s?.startDate} />
      </Field>
      <Field label="Fin" name="endDate" required>
        <input type="date" className="field-input" defaultValue={s?.endDate} />
      </Field>
      <Field label="Prioridad" name="priority" hint="Mayor gana si se solapan.">
        <input inputMode="numeric" className="field-input" defaultValue={s?.priority ?? 0} />
      </Field>
    </div>
  );
}

export default async function PricingPage({ searchParams }: PageProps<"/precios">) {
  const session = await requireSession();
  const sp = await searchParams;
  const tourId = one(sp.tourId) && /^[0-9a-f-]{36}$/i.test(one(sp.tourId)!) ? one(sp.tourId) : undefined;
  const includeInactive = one(sp.inactivas) === "1";
  const canWrite = can(session, "pricing:write");

  const [seasons, tours, rates] = await Promise.all([
    load(() => apiData<Season[]>("/admin/seasons")),
    load(() => api<Paged<TourListItem>>("/admin/tours", { query: { page: 1, pageSize: 100 } })),
    tourId ? load(() => apiData<Rate[]>(`/admin/tours/${tourId}/rates`, { query: { includeInactive } })) : Promise.resolve(null),
  ]);
  const seasonName = new Map(seasons.ok ? seasons.data.map((s) => [s.id, s.name]) : []);
  const today = todayInLima();

  return (
    <>
      <PageHeader title="Precios" description="Tarifas por persona en céntimos exactos. Los cambios no alteran reservas existentes (precio congelado)." />

      <div className="space-y-4">
        <Section title="Tarifas por tour" id="tarifas">
          {tours.ok ? (
            <TourPicker
              tours={tours.data.data}
              selected={tourId}
              extra={
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name="inactivas" value="1" defaultChecked={includeInactive} className="size-5" /> Incluir inactivas
                </label>
              }
            />
          ) : (
            <ErrorPanel error={tours.error} />
          )}

          {!tourId ? (
            <EmptyState>Elige un tour para ver y editar sus tarifas.</EmptyState>
          ) : rates && !rates.ok ? (
            <ErrorPanel error={rates.error} />
          ) : rates && rates.ok ? (
            <>
              {rates.data.length === 0 ? (
                <EmptyState>El tour no tiene tarifas{includeInactive ? "" : " activas"}: no se puede reservar en línea.</EmptyState>
              ) : (
                <TableWrap label="Tarifas del tour">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Pasajero</th>
                        <th scope="col">Residencia</th>
                        <th scope="col">Temporada</th>
                        <th scope="col">Vigencia</th>
                        <th scope="col">Grupo</th>
                        <th scope="col" className="num">
                          Precio p/p
                        </th>
                        <th scope="col">Estado</th>
                        {canWrite ? (
                          <th scope="col">
                            <span className="sr-only">Acciones</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rates.data.map((r) => (
                        <tr key={r.id}>
                          <td>{label(PAX_TYPE, r.paxType)}</td>
                          <td>{label(RESIDENCY, r.residency)}</td>
                          <td>{r.seasonId ? (seasonName.get(r.seasonId) ?? "—") : "Todo el año"}</td>
                          <td className="whitespace-nowrap">
                            {formatDate(r.validFrom)} – {formatDate(r.validTo)}
                            {r.validTo < today ? <span className="block text-xs text-foreground-muted">vencida</span> : null}
                          </td>
                          <td>{r.maxGroupSize ? `${r.minGroupSize}-${r.maxGroupSize}` : `${r.minGroupSize}+`} pax</td>
                          <td className="num font-medium">{formatMoney(r.price)}</td>
                          <td>{r.isActive ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
                          {canWrite ? (
                            <td>
                              <div className="flex gap-1">
                                <ActionForm showSuccess={false} action={setRateActiveAction.bind(null, r.id, r.version, !r.isActive)}>
                                  <SubmitButton variant="outline" size="sm">
                                    {r.isActive ? "Desactivar" : "Activar"}
                                  </SubmitButton>
                                </ActionForm>
                                <ActionForm action={deleteRateAction.bind(null, r.id)} confirm="¿Eliminar la tarifa? Las reservas existentes conservan su precio.">
                                  <SubmitButton variant="danger" size="sm">
                                    Eliminar
                                  </SubmitButton>
                                </ActionForm>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}

              {canWrite ? (
                <div className="mt-4 rounded-sm border border-border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Nueva tarifa</h3>
                  <Alert tone="info">
                    Dos tarifas activas del mismo tipo de pasajero, residencia, moneda y temporada no pueden coincidir a la vez en fechas y rango de grupo. Si se cruzan, el sistema indica con
                    cuál.
                  </Alert>
                  <ActionForm action={createRateAction.bind(null, tourId)} className="mt-3">
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      <Field label="Pasajero" name="paxType" required>
                        <select className="field-input">
                          {Object.entries(PAX_TYPE).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Residencia" name="residency" required>
                        <select className="field-input">
                          <option value="national">Nacional</option>
                          <option value="foreign">Extranjero</option>
                        </select>
                      </Field>
                      <Field label="Moneda" name="currency" required>
                        <select className="field-input">
                          <option value="PEN">PEN</option>
                          <option value="USD">USD</option>
                        </select>
                      </Field>
                      <Field label="Precio por persona" name="amount" hint="Ej. 450.00" required>
                        <input inputMode="decimal" className="field-input" />
                      </Field>
                      <Field label="Temporada" name="seasonId">
                        <select className="field-input" defaultValue="">
                          <option value="">Todo el año (sin temporada)</option>
                          {seasons.ok
                            ? seasons.data.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))
                            : null}
                        </select>
                      </Field>
                      <Field label="Vigente desde" name="validFrom" required>
                        <input type="date" className="field-input" defaultValue={today} />
                      </Field>
                      <Field label="Vigente hasta" name="validTo" required>
                        <input type="date" className="field-input" />
                      </Field>
                      <Field label="Grupo mínimo" name="minGroupSize">
                        <input inputMode="numeric" className="field-input" defaultValue="1" />
                      </Field>
                      <Field label="Grupo máximo" name="maxGroupSize" hint="Vacío = sin tope.">
                        <input inputMode="numeric" className="field-input" />
                      </Field>
                    </div>
                    <SubmitButton variant="primary">Crear tarifa</SubmitButton>
                  </ActionForm>
                </div>
              ) : null}
            </>
          ) : null}
        </Section>

        <Section title="Temporadas" id="temporadas" description="Comunes a todos los tours. Una temporada con tarifas no se puede eliminar.">
          {!seasons.ok ? (
            <ErrorPanel error={seasons.error} />
          ) : seasons.data.length === 0 ? (
            <EmptyState>Sin temporadas.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {seasons.data.map((s) => (
                <li key={s.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-mono text-xs">{s.code}</span> <strong>{s.name}</strong> · {formatDate(s.startDate)} – {formatDate(s.endDate)} · prioridad {s.priority}
                    </p>
                    {canWrite ? (
                      <ActionForm action={deleteSeasonAction.bind(null, s.id)} confirm={`¿Eliminar la temporada ${s.name}?`}>
                        <SubmitButton variant="danger" size="sm">
                          Eliminar
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-link">Editar</summary>
                      <ActionForm action={updateSeasonAction.bind(null, s.id, s.version)} className="mt-2">
                        <SeasonFields s={s} />
                        <SubmitButton variant="outline" size="sm">
                          Guardar temporada
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canWrite ? (
            <div className="mt-4 rounded-sm border border-border p-3">
              <h3 className="mb-2 text-sm font-semibold">Nueva temporada</h3>
              <ActionForm action={createSeasonAction} resetOnSuccess>
                <SeasonFields />
                <SubmitButton variant="outline">Crear temporada</SubmitButton>
              </ActionForm>
            </div>
          ) : null}
        </Section>
      </div>
    </>
  );
}
