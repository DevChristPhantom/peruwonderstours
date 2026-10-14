"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ImageIcon, Loader2, RefreshCw, Upload } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Section } from "@/components/ui/Layout";
import { buttonClass } from "@/components/ui/styles";
import { BANNER_EFFECTS, BANNER_EFFECT_LABELS, validBannerFile, type HeroBanner } from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok || !body || body.data === undefined) throw new Error(body?.error?.message ?? "No se pudo completar la operación. Recarga e intenta de nuevo.");
  return body.data;
}

export function BannerManager({ initial, canUpload, canEdit }: { initial: HeroBanner[]; canUpload: boolean; canEdit: boolean }) {
  const [records, setRecords] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const id = useId();
  const uploadRef = useRef<HTMLFormElement>(null);
  const replace = (record: HeroBanner) => setRecords((old) => [...old.filter((item) => item.id !== record.id), record].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)));
  async function refresh() {
    setBusy(true); setFeedback(null);
    try { setRecords(await request<HeroBanner[]>("/bff/banners")); }
    catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo cargar la lista." }); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(null);
    const form = new FormData(event.currentTarget);
    form.set("titleEmbedded", form.get("titleEmbedded") === "on" ? "true" : "false");
    const file = form.get("file");
    if (!(file instanceof File) || !validBannerFile(file)) {
      setFeedback({ error: true, text: "Selecciona PNG, JPEG, WebP, AVIF o HTML de hasta 16 MB." }); return;
    }
    setBusy(true);
    try {
      replace(await request<HeroBanner>("/bff/banners", { method: "POST", body: form }));
      uploadRef.current?.reset();
      setFeedback({ error: false, text: "Archivo guardado como inactivo. Actívalo cuando quieras mostrarlo en la portada." });
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo subir el archivo." }); }
    finally { setBusy(false); }
  }
  async function update(record: HeroBanner, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(null);
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    try {
      replace(await request<HeroBanner>(`/bff/banners?id=${encodeURIComponent(record.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: String(fields.get("title") ?? "").trim(), enabled: fields.get("enabled") === "on", sortOrder: Number(fields.get("sortOrder")), revision: record.revision, effect: fields.get("effect") ?? "none", titleEmbedded: fields.get("titleEmbedded") === "on" }),
      }));
      setFeedback({ error: false, text: "Banner actualizado. Los activos aparecen en la portada según su orden." });
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : "No se pudo guardar. Recarga la lista." }); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5" aria-busy={busy || undefined}>
    <Alert tone="info">Sube una imagen PNG, JPEG, WebP o AVIF, máximo 16 MB, y elige agua, nubes o sin movimiento. El efecto se integra directamente en la portada y respeta movimiento reducido. Los nuevos banners quedan inactivos. También puedes importar un HTML anterior con imagen incluida; se usará su imagen, sin ejecutar su código.</Alert>
    {feedback ? <Alert tone={feedback.error ? "danger" : "success"} role={feedback.error ? "alert" : "status"}>{feedback.text}</Alert> : null}
    {canUpload ? <Section title="Subir un banner" description="Dale un nombre que permita reconocerlo en la lista.">
      <form ref={uploadRef} onSubmit={(event) => void upload(event)}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-title`} className="mb-1 block font-medium">Título</label><input id={`${id}-title`} name="title" required maxLength={120} className="field-input" placeholder="Ej. Experiencias en el Titicaca" /></div>
          <div><label htmlFor={`${id}-file`} className="mb-1 block font-medium">Imagen del banner</label><input id={`${id}-file`} name="file" type="file" accept="image/png,image/jpeg,image/webp,image/avif,.png,.jpg,.jpeg,.webp,.avif,.html,.htm" required className="field-input" /></div>
          <div><label htmlFor={`${id}-effect`} className="mb-1 block font-medium">Efecto</label><select id={`${id}-effect`} name="effect" defaultValue="none" className="field-input">{BANNER_EFFECTS.map((effect) => <option key={effect} value={effect}>{BANNER_EFFECT_LABELS[effect]}</option>)}</select></div>
          <div><label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input name="titleEmbedded" type="checkbox" className="size-5 accent-primary" /> La imagen ya contiene el título</label><p className="text-xs text-foreground-muted">Evita repetirlo sobre la imagen. El título sigue disponible para lectores de pantalla.</p></div>
          <button type="submit" className={buttonClass("primary", "md", "justify-self-start sm:col-span-2")}><Upload aria-hidden size={17} /> Subir como inactivo</button>
        </fieldset>
      </form>
    </Section> : null}
    <Section title="Banners guardados" description="Menor número de orden primero. Desactiva un banner para retirarlo de la portada." actions={<button type="button" disabled={busy} onClick={() => void refresh()} className={buttonClass("outline", "sm")}>{busy ? <Loader2 aria-hidden size={16} className="animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden size={16} />} Recargar</button>}>
      {records.length === 0 ? <EmptyState>Todavía no hay banners. Sube la primera imagen para comenzar.</EmptyState> : <div className="space-y-4">{records.map((record) => <form key={`${record.id}-${record.revision}`} onSubmit={(event) => void update(record, event)} className="rounded-md border border-border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2"><ImageIcon aria-hidden size={18} className="text-primary" /><span className="font-semibold break-all">{record.title}</span><Badge tone={record.enabled ? "success" : "neutral"}>{record.enabled ? "Activo" : "Inactivo"}</Badge><span className="text-xs text-foreground-muted">{(record.bytes / 1024 / 1024).toLocaleString("es-PE", { maximumFractionDigits: 2 })} MB · {record.hasPoster ? "Imagen disponible" : "Sin imagen disponible"}</span></div>
        {!record.hasPoster ? <p className="mb-4 text-sm text-foreground-muted">Este archivo anterior no contiene una imagen compatible. Sube una imagen nueva para mostrar el banner.</p> : null}
        <fieldset disabled={busy || !canEdit} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(180px,1fr)_100px]">
          <div><label htmlFor={`${id}-${record.id}-title`} className="mb-1 block text-sm font-medium">Título</label><input id={`${id}-${record.id}-title`} name="title" required maxLength={120} defaultValue={record.title} className="field-input" /></div>
          <div><label htmlFor={`${id}-${record.id}-effect`} className="mb-1 block text-sm font-medium">Efecto</label><select id={`${id}-${record.id}-effect`} name="effect" defaultValue={record.effect ?? "none"} className="field-input">{BANNER_EFFECTS.map((effect) => <option key={effect} value={effect}>{BANNER_EFFECT_LABELS[effect]}</option>)}</select></div>
          <div><label htmlFor={`${id}-${record.id}-order`} className="mb-1 block text-sm font-medium">Orden</label><input id={`${id}-${record.id}-order`} name="sortOrder" type="number" min={0} max={999} step={1} required defaultValue={record.sortOrder} className="field-input" /></div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input name="enabled" type="checkbox" defaultChecked={record.enabled} className="size-5 accent-primary" /> Mostrar en portada</label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input name="titleEmbedded" type="checkbox" defaultChecked={record.titleEmbedded ?? false} className="size-5 accent-primary" /> La imagen ya contiene el título</label>
          <button type="submit" className={buttonClass("outline", "md")}>Guardar cambios</button>
        </fieldset>
      </form>)}</div>}
    </Section>
  </div>;
}
